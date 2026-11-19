import supabase from '../lib/apiHelpers/_supabase.js';

const ONLINE_THRESHOLD_MINUTES = 15;

function isRecentEnough(createdAt) {
  if (!createdAt) return false;
  const diff = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60);
  return !isNaN(diff) && diff < ONLINE_THRESHOLD_MINUTES;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(200).json({
        online: false,
        gateway_online: false,
        system_online: false,
        nodes: {
          0: { online: false, last_seen: null },
          1: { online: false, last_seen: null },
          2: { online: false, last_seen: null },
          3: { online: false, last_seen: null },
        },
      });
    }

    // Ambil data terbaru per node (0=Gateway, 1, 2, 3) dari Supabase
    const nodeIds = [0, 1, 2, 3];
    const results = await Promise.all(
      nodeIds.map((nId) =>
        supabase
          .from('sensor_data')
          .select('node_id, temperature, humidity, soil_moisture, soil_temp, score, flow_rate, ph, total_water, valve_status, pump_status, created_at, wifi_status, device_id')
          .eq('node_id', nId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    );

    const nodes = {};
    for (let i = 0; i < nodeIds.length; i++) {
      const nId = nodeIds[i];
      const row = results[i]?.data;

      if (!row) {
        nodes[nId] = { online: false, last_seen: null };
        continue;
      }

      const isRecent = isRecentEnough(row.created_at);
      let hasRealData = false;

      if (nId === 0) {
        // Gateway: online jika ada data flow_rate, pH, atau total_water nyata
        hasRealData = Boolean(
          (row.flow_rate != null && row.flow_rate > 0) ||
          (row.ph != null && row.ph > 0) ||
          (row.total_water != null && row.total_water > 0)
        );
      } else if (nId === 3) {
        // Node 3 (Gambut/Karhutla): online jika soil_temp, temp, hum, atau score ada
        hasRealData = Boolean(
          row.soil_temp != null || row.temperature != null || row.humidity != null || row.score != null
        );
      } else {
        // Node 1 & 2 (Hortikultura): online jika ada data sensor (0 = valid, hanya null = tidak ada)
        hasRealData = Boolean(
          row.temperature != null ||
          row.humidity != null ||
          row.soil_moisture != null
        );
      }

      nodes[nId] = {
        online: isRecent && hasRealData,
        last_seen: row.created_at || null,
        wifi_status: row.wifi_status || null,
        device_id: row.device_id || null,
      };
    }

    // Gateway online = node_id=0 punya data riil ATAU ada node manapun yang baru kirim data
    // (karena semua data melewati ESP32 Gateway sebelum masuk Supabase)
    const anyNodeRecent = nodeIds.some((nId) => {
      const row = results[nId]?.data;
      return row && isRecentEnough(row.created_at);
    });

    const gatewayOnline = nodes[0].online || anyNodeRecent;
    const systemOnline = gatewayOnline;

    return res.status(200).json({
      online: systemOnline,
      gateway_online: gatewayOnline,
      system_online: systemOnline,
      nodes,
      // Legacy fields untuk kompatibilitas
      wifi_status: nodes[0]?.wifi_status || 'unknown',
      last_update: nodes[0]?.last_seen || null,
      device_id: nodes[0]?.device_id || 'ESP32_001',
      pump_status: false,
      feeder_status: false,
    });
  } catch (err) {
    console.error('Device status error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
