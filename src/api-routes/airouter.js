import { getOptionalFirebaseAuth } from '../lib/apiHelpers/_auth.js';
import { getAiRouterStatus, sendAiRouterMessage, isArduinoFormulaRequest, buildFormulaReference } from '../lib/apiHelpers/_airouter.js';
import supabase from '../lib/apiHelpers/_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') return res.status(204).end();
  const user = await getOptionalFirebaseAuth(req, res);
  if (res.headersSent) return;

  if (req.method === 'GET') {
    const status = await getAiRouterStatus(req.headers.origin);
    return res.status(status.ok ? 200 : 503).json(status);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      message,
      images = [],
      history = [],
      sensorContext = null,
      aiSettings = null,
      yesterdayHistory = null,
    } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (isArduinoFormulaRequest(message)) {
      const formulaContent = [
        '## Rumus Arduino TeraNova',
        '',
        buildFormulaReference(),
      ].join('\n');
      return res.status(200).json({
        content: formulaContent,
        model: 'local-formula-response',
        provider: 'local',
        checkedAt: new Date().toISOString(),
      });
    }

    // Selalu ambil data sensor terbaru per node langsung dari Supabase
    // agar data AI tidak bergantung pada state browser yang mungkin belum update
    const nodeIds = [0, 1, 2, 3];
    const nodeResults = await Promise.all(
      nodeIds.map((n) =>
        supabase
          .from('sensor_data')
          .select('*')
          .eq('node_id', n)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    );

    const dbNodes = {};
    nodeIds.forEach((n, idx) => {
      if (nodeResults[idx]?.data) {
        dbNodes[n] = nodeResults[idx].data;
      }
    });

    const n0 = dbNodes[0] || {};
    const n1 = dbNodes[1] || {};
    const n2 = dbNodes[2] || {};
    const n3 = dbNodes[3] || {};

    // Ambil juga tren riwayat terbaru
    const { data: recentHistory } = await supabase
      .from('sensor_data')
      .select('node_id, temperature, humidity, soil_temp, score, flow_rate, created_at')
      .order('id', { ascending: false })
      .limit(20);

    // Gabungkan data dari Supabase dengan sensorContext dari frontend
    const enrichedSensorContext = {
      ...(sensorContext || {}),
      // Hortikultura: ambil nilai aktif
      temperature: (n2.temperature != null && n2.temperature > 0) ? n2.temperature : (n1.temperature ?? sensorContext?.temperature ?? null),
      humidity: (n2.humidity != null && n2.humidity > 0) ? n2.humidity : (n1.humidity ?? sensorContext?.humidity ?? null),
      soil_moisture: n1.soil_moisture ?? n2.soil_moisture ?? sensorContext?.soil_moisture ?? null,
      
      // Node 3 Karhutla
      soil_temp: n3.soil_temp ?? sensorContext?.soil_temp ?? null,
      fwi: n3.score ?? sensorContext?.fwi ?? null,
      fwi_status: n3.fwi_status ?? (n3.score != null ? (n3.score >= 32 ? 'SANGAT TINGGI' : n3.score >= 18 ? 'TINGGI' : n3.score >= 9 ? 'SEDANG' : 'RENDAH (AMAN)') : null),
      
      // Gateway (Flow & pH)
      ph: n0.ph ?? sensorContext?.ph ?? null,
      flow_rate: n0.flow_rate ?? sensorContext?.flow_rate ?? null,
      total_water: n0.total_water ?? sensorContext?.total_water ?? null,
      valve_status: n0.valve_status ?? sensorContext?.valve_status ?? null,

      // Detail lengkap per node (semua parameter sensor)
      node1: n1.id ? { 
        temp: n1.temperature, 
        hum: n1.humidity, 
        soil: n1.soil_moisture,
        status: (n1.temperature === 0 && n1.humidity === 0) ? 'Sensor DHT22 perlu diperiksa/kabel lepas' : 'Normal'
      } : null,
      node2: n2.id ? { 
        temp: n2.temperature, 
        hum: n2.humidity, 
        soil: n2.soil_moisture,
        status: 'Normal'
      } : null,
      node3: n3.id ? { 
        soil_temp: n3.soil_temp, 
        temp: n3.temperature, 
        hum: n3.humidity, 
        soil_moisture: n3.soil_moisture,
        fwi: n3.score, 
        fwi_status: (n3.score != null ? (n3.score >= 32 ? 'SANGAT TINGGI' : n3.score >= 18 ? 'TINGGI' : n3.score >= 9 ? 'SEDANG' : 'RENDAH (AMAN)') : '-'),
        status: 'Normal'
      } : null,
      gateway: n0.id ? { 
        ph: n0.ph, 
        flow_rate: n0.flow_rate, 
        total_water: n0.total_water, 
        valve_status: n0.valve_status,
        pump_status: n0.pump_status ? 'MENYALA' : 'MATI'
      } : null,
    };

    const result = await sendAiRouterMessage({
      message,
      images,
      history,
      sensorContext: enrichedSensorContext,
      aiSettings,
      yesterdayHistory,
      origin: req.headers.origin,
    });

    // Resilient helper to insert chat message handling varying table schemas
    const insertChatRecord = async (payload, fallbackSnapshots = {}) => {
      try {
        // 1. Try insert with metadata
        const res = await supabase.from('chat_messages').insert(payload);
        if (!res.error) return true;

        // 2. If 'metadata' column doesn't exist in Supabase schema, try fallback to sensor_snapshot / settings_snapshot
        if (res.error.code === 'PGRST204' || res.error.message?.includes('metadata')) {
          const fallbackPayload = {
            role: payload.role,
            content: payload.content,
            sensor_snapshot: fallbackSnapshots.sensor_snapshot || null,
            settings_snapshot: fallbackSnapshots.settings_snapshot || null,
          };
          if (payload.user_id) fallbackPayload.user_id = payload.user_id;

          const res2 = await supabase.from('chat_messages').insert(fallbackPayload);
          if (!res2.error) return true;

          // 3. If user_id or snapshots also fail, try minimal insert
          if (res2.error.code === 'PGRST204' || res2.error.message?.includes('column')) {
            const minRes = await supabase.from('chat_messages').insert({
              role: payload.role,
              content: payload.content,
            });
            if (!minRes.error) return true;
          }
          console.warn('[AI Router] Supabase chat insert warning:', res2.error.message);
          return false;
        }

        console.warn('[AI Router] Supabase chat insert warning:', res.error.message);
        return false;
      } catch (err) {
        console.warn('[AI Router] Could not save message to Supabase:', err?.message);
        return false;
      }
    };

    if (user) {
      // Save user and assistant messages only for authenticated accounts.
      await insertChatRecord(
        {
          user_id: user.uid,
          role: 'user',
          content: message,
          metadata: { role: 'user', sensor_snapshot: sensorContext, settings_snapshot: aiSettings },
        },
        { sensor_snapshot: sensorContext, settings_snapshot: aiSettings }
      );

      await insertChatRecord(
        {
          user_id: user.uid,
          role: 'assistant',
          content: result.content || '',
          metadata: { role: 'assistant', analysis: result.analysis },
        },
        { sensor_snapshot: sensorContext, settings_snapshot: aiSettings }
      );
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown AI Router error',
    });
  }
}
