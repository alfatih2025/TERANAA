import { getOptionalFirebaseAuth } from '../lib/apiHelpers/_auth.js';
import { getAiRouterStatus, sendAiRouterMessage, isArduinoFormulaRequest, buildFormulaReference } from '../lib/apiHelpers/_airouter.js';
import supabase from '../lib/apiHelpers/_supabase.js';
import { ensureChatConversation, insertChatMessage } from '../lib/apiHelpers/chatConversations.js';

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
      conversationId,
      images = [],
      history = [],
      sensorContext = null,
      aiSettings = null,
      yesterdayHistory = null,
    } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const conversation = user
      ? await ensureChatConversation({
          conversationId,
          userId: user.uid,
          title: message,
        })
      : null;

    if (isArduinoFormulaRequest(message)) {
      const formulaContent = [
        '## Rumus Arduino TeraNova',
        '',
        buildFormulaReference(),
      ].join('\n');
      if (user && conversation) {
        await insertChatMessage({
          user_id: user.uid,
          conversation_id: conversation.id,
          role: 'user',
          content: message,
        });
        await insertChatMessage({
          user_id: user.uid,
          conversation_id: conversation.id,
          role: 'assistant',
          content: formulaContent,
        });
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversation.id)
          .eq('user_id', user.uid);
      }
      return res.status(200).json({
        content: formulaContent,
        model: 'local-formula-response',
        provider: 'local',
        checkedAt: new Date().toISOString(),
        conversationId: conversation?.id || null,
      });
    }

    // 1. Ambil data terbaru per node (Node 0, 1, 2, 3) dari Supabase
    const nodeIds = [0, 1, 2, 3];
    const [nodeResults, n3HistRes, gwHistRes, hortiHistRes] = await Promise.all([
      Promise.all(
        nodeIds.map((n) =>
          supabase
            .from('sensor_data')
            .select('*')
            .eq('node_id', n)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle()
        )
      ),
      // 2. Ambil 15 rekaman riwayat Node 3 dari Supabase untuk analisis tren & prediksi Karhutla
      supabase
        .from('sensor_data')
        .select('id, soil_temp, score, temperature, humidity, soil_moisture, created_at')
        .eq('node_id', 3)
        .order('id', { ascending: false })
        .limit(15),
      // 3. Ambil 10 rekaman riwayat Gateway dari Supabase untuk analisis debit & efisiensi air
      supabase
        .from('sensor_data')
        .select('id, flow_rate, total_water, valve_status, created_at')
        .eq('node_id', 0)
        .order('id', { ascending: false })
        .limit(10),
      // 4. Ambil 10 rekaman riwayat Hortikultura dari Supabase
      supabase
        .from('sensor_data')
        .select('id, node_id, temperature, humidity, soil_moisture, created_at')
        .in('node_id', [1, 2])
        .order('id', { ascending: false })
        .limit(10),
    ]);

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

    // Deteksi status online hardware per node
    const isNode1Online = Boolean(n1.id && (n1.temperature > 0 || n1.humidity > 0 || n1.soil_moisture > 0));
    const isNode2Online = Boolean(n2.id && (n2.temperature > 0 || n2.humidity > 0 || n2.soil_moisture > 0));
    const isNode3Online = Boolean(n3.id && (n3.soil_temp != null || n3.temperature != null || n3.humidity != null));
    const isGatewayOnline = Boolean(n0.id && (n0.flow_rate > 0 || n0.total_water > 0 || n0.ph > 0));

    // Format riwayat time-series Node 3 (Karhutla & Suhu Gambut) dari Supabase
    const n3History = (n3HistRes?.data || []).map((r, idx) => {
      const time = r.created_at ? new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }) : '-';
      const tempDisplay = (r.soil_temp != null && r.soil_temp > 70) ? `${r.soil_temp}°C (glitch sensor)` : `${r.soil_temp ?? '-'}°C`;
      const soilMoistDisplay = r.soil_moisture != null ? `${r.soil_moisture}%` : '-';
      return `[Pencatatan #${idx + 1} @ ${time} WIB] Suhu Lapisan Gambut (DS18B20): ${tempDisplay} | Suhu Udara: ${r.temperature ?? '-'}°C | Lembap Udara: ${r.humidity ?? '-'}% | Kadar Air Gambut: ${soilMoistDisplay} | Skor FWI BMKG: ${r.score ?? '-'}`;
    });

    // Format riwayat time-series Gateway (Irigasi & Efisiensi Air) dari Supabase
    const gwHistory = (gwHistRes?.data || []).map((r, idx) => {
      const time = r.created_at ? new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }) : '-';
      return `[Pencatatan #${idx + 1} @ ${time} WIB] Debit Air: ${r.flow_rate ?? 0} L/min | Total Volume Air: ${r.total_water ?? 0} L | Status Katup: ${r.valve_status ?? 'IDLE'}`;
    });

    const node3TimeWib = n3.created_at ? new Date(n3.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }) : 'Terkini';

    // Gabungkan data dari Supabase dengan sensorContext dari frontend
    const enrichedSensorContext = {
      ...(sensorContext || {}),
      primary_source: 'Database Supabase (sensor_data)',
      last_sync_time: `${node3TimeWib} WIB`,
      active_node: 'Node 3 (Sektor Gambut & Pencegahan Karhutla)',

      // Metrik terkini Node 3 (Aktif di Supabase)
      temperature: n3.temperature ?? (n2.temperature > 0 ? n2.temperature : sensorContext?.temperature ?? null),
      humidity: n3.humidity ?? (n2.humidity > 0 ? n2.humidity : sensorContext?.humidity ?? null),
      soil_temp: n3.soil_temp ?? sensorContext?.soil_temp ?? null,
      soil_moisture: n3.soil_moisture ?? (n1.soil_moisture ?? sensorContext?.soil_moisture ?? null),
      fwi: n3.score ?? sensorContext?.fwi ?? null,
      fwi_status: n3.score != null ? (n3.score >= 32 ? 'SANGAT TINGGI (EKSTREM)' : n3.score >= 18 ? 'TINGGI' : n3.score >= 9 ? 'SEDANG' : 'RENDAH (AMAN)') : 'AMAN',

      // Gateway
      ph: n0.ph ?? sensorContext?.ph ?? null,
      flow_rate: n0.flow_rate ?? sensorContext?.flow_rate ?? null,
      total_water: n0.total_water ?? sensorContext?.total_water ?? null,
      valve_status: n0.valve_status ?? sensorContext?.valve_status ?? null,

      // Riwayat time-series langsung dari Supabase
      n3_history: n3History,
      gateway_history: gwHistory,

      // Detail lengkap per node
      node1: {
        status: isNode1Online ? 'Online' : 'Belum aktif / hardware belum terpasang (nilai belum tersedia)',
        temp: isNode1Online ? n1.temperature : null,
        hum: isNode1Online ? n1.humidity : null,
        soil: isNode1Online ? n1.soil_moisture : null,
      },
      node2: {
        status: isNode2Online ? 'Online' : 'Belum aktif / hardware belum terpasang (nilai belum tersedia)',
        temp: isNode2Online ? n2.temperature : null,
        hum: isNode2Online ? n2.humidity : null,
        soil: isNode2Online ? n2.soil_moisture : null,
      },
      node3: {
        status: isNode3Online ? 'AKTIF & MENGIRIM DATA REAL-TIME KE SUPABASE' : 'Menunggu data',
        recorded_at: `${node3TimeWib} WIB`,
        soil_temp: n3.soil_temp,
        temp: n3.temperature,
        hum: n3.humidity,
        soil_moisture: n3.soil_moisture,
        fwi: n3.score,
        fwi_status: n3.score != null ? (n3.score >= 32 ? 'SANGAT TINGGI (EKSTREM)' : n3.score >= 18 ? 'TINGGI' : n3.score >= 9 ? 'SEDANG' : 'RENDAH (AMAN)') : 'AMAN',
      },
      gateway: {
        status: isGatewayOnline ? 'Online' : 'Belum aktif / hardware belum terpasang (nilai belum tersedia)',
        ph: isGatewayOnline ? n0.ph : null,
        flow_rate: isGatewayOnline ? n0.flow_rate : 0,
        total_water: isGatewayOnline ? n0.total_water : 0,
        valve_status: isGatewayOnline ? n0.valve_status : 'IDLE',
        pump_status: isGatewayOnline && n0.pump_status ? 'MENYALA' : 'MATI',
      },
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

    if (user && conversation) {
      try {
        await insertChatMessage({
          user_id: user.uid,
          conversation_id: conversation.id,
          role: 'user',
          content: message,
          metadata: { role: 'user', sensor_snapshot: sensorContext, settings_snapshot: aiSettings },
        });
        await insertChatMessage({
          user_id: user.uid,
          conversation_id: conversation.id,
          role: 'assistant',
          content: result.content || '',
          metadata: { role: 'assistant', analysis: result.analysis },
        });
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversation.id)
          .eq('user_id', user.uid);
      } catch (dbSaveError) {
        console.error('[AI Router] Warning: Gagal menyimpan pesan ke riwayat database:', dbSaveError);
      }
    }

    return res.status(200).json({ ...result, conversationId: conversation?.id || null });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    const message = error instanceof Error
      ? error.message
      : (error?.message || error?.details || error?.hint || JSON.stringify(error) || 'Unknown AI Router error');
    console.error('[AI Router] Error:', message, error);
    return res.status(statusCode).json({ error: message });
  }
}
