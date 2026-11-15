import { getOptionalFirebaseAuth, requireFirebaseAuth, authError } from '../lib/apiHelpers/_auth.js';
import supabase from '../lib/apiHelpers/_supabase.js';

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

function getJakartaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getJakartaDateRange(dateKey = getJakartaDateKey()) {
  const start = new Date(`${dateKey}T00:00:00+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}


const ARDUINO_FORMULA_REFERENCE = [
  'RUMUS ARDUINO NANO YANG WAJIB DIIKUTI:',
  'void hitungSkor() {',
  '  if (isnan(suhu) || isnan(kelembapan) || isnan(tanah) || suhu == 0.0 || kelembapan == 0.0) return;',
  '',
  '  float svp = 0.6108 * exp((17.27 * suhu) / (suhu + 237.3));',
  '  vdp = svp * (1.0 - (kelembapan / 100.0));',
  '  vdp = constrain(vdp, 0.4, 2.0);',
  '',
  '  if (Atas - Kritis == 0) Kritis = Atas - 1;',
  '',
  '  skorTanah = ((Atas - tanah) * 50.0) / (Atas - Kritis);',
  '  skorTanah = constrain(skorTanah, 0, 50);',
  '',
  '  skorvdp = ((vdp - 0.4) * 30.0) / (2.0 - 0.4);',
  '',
  '  skorHujan = (peluangHujan / 100.0) * 40.0;',
  '  skorHujan = constrain(skorHujan, 0, 40);',
  '',
  '  skorInteraksi = ((skorTanah * skorvdp) / 50.0) * 0.667;',
  '  skorInteraksi = constrain(skorInteraksi, 0, 30);',
  '',
  '  skorTotal = skorTanah + skorvdp + skorInteraksi - skorHujan;',
  '  durasiOff = durasiOn * (1.0 + ((Atas - tanah) / 100.0));',
  '}',
  '',
  'Deskripsi rumus:',
  '- VPD: dari suhu & kelembapan (0.4-2.0 kPa)',
  '- skorTanah: 0-50 berdasarkan posisi tanah antara Kritis-Atas',
  '- skorvdp: 0-30 berdasarkan VPD',
  '- skorHujan: 0-40 berdasarkan peluang hujan BMKG',
  '- skorInteraksi: 0-30 interaksi tanah&VPD (faktor 0.667)',
  '- skorTotal: 0-100 (total akhir)',
  '- durasiOff: jeda pematian pompa',
  '',
  'Gunakan rumus ini secara konsisten untuk semua perhitungan dan penjelasan angka.',
].join('\n');

function normalizeFormulaField(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildChatMetadata(latestSensor, latestSettings, role) {
  return {
    role,
    sensor_snapshot: {
      device_id: latestSensor?.device_id ?? null,
      temperature: latestSensor?.temperature ?? null,
      humidity: latestSensor?.humidity ?? null,
      soil_moisture: latestSensor?.soil_moisture ?? null,
      rain: latestSensor?.rain ?? null,
      score: latestSensor?.score ?? null,
      soil_score: latestSensor?.soil_score ?? null,
      vdp_score: latestSensor?.vdp_score ?? null,
      rain_score: latestSensor?.rain_score ?? null,
      vpd: latestSensor?.vpd ?? null,
      duration_estimate: latestSensor?.duration_estimate ?? null,
      pump_status: latestSensor?.pump_status ?? false,
      led_status: latestSensor?.led_status ?? false,
      device_mode: latestSensor?.device_mode ?? null,
      wifi_status: latestSensor?.wifi_status ?? null,
      threshold_kritis: latestSensor?.threshold_kritis ?? null,
      threshold_atas: latestSensor?.threshold_atas ?? null,
      threshold_bawah: latestSensor?.threshold_bawah ?? null,
      watering_time: latestSensor?.watering_time ?? null,
      watering_duration: latestSensor?.watering_duration ?? null,
      schedule_enabled: latestSensor?.schedule_enabled ?? null,
      formula_name: normalizeFormulaField(latestSensor?.formula_name),
      formula_soil: normalizeFormulaField(latestSensor?.formula_soil),
      formula_vpd: normalizeFormulaField(latestSensor?.formula_vpd),
      formula_score: normalizeFormulaField(latestSensor?.formula_score),
      soil_raw_dry: latestSensor?.soil_raw_dry ?? null,
      created_at: latestSensor?.created_at ?? null,
    },
    settings_snapshot: {
      plant_phase: latestSettings?.plant_phase ?? latestSettings?.crop_mode ?? null,
      location: latestSettings?.location ?? null,
      soil_threshold_low: latestSettings?.soil_threshold_low ?? latestSettings?.soil_moisture_threshold ?? null,
      soil_threshold_high: latestSettings?.soil_threshold_high ?? null,
      soil_threshold_critical: latestSettings?.soil_threshold_critical ?? null,
      temp_threshold_low: latestSettings?.temp_threshold_low ?? null,
      temp_threshold_high: latestSettings?.temp_threshold_high ?? null,
      humidity_threshold_low: latestSettings?.humidity_threshold_low ?? null,
      humidity_threshold_high: latestSettings?.humidity_threshold_high ?? null,
      watering_time: latestSettings?.watering_time ?? null,
      watering_duration: latestSettings?.watering_duration ?? null,
      watering_enabled: latestSettings?.watering_enabled ?? null,
      auto_report: latestSettings?.auto_report ?? null,
      report_time: latestSettings?.report_time ?? null,
      user_name: latestSettings?.user_name ?? null,
      user_email: latestSettings?.user_email ?? null,
    },
  };
}


function buildSystemPrompt(latestSensor, settings = {}, yesterdayHistory = null, multiNode = {}, trends = '') {
  const phase = String(settings.plant_phase || settings.crop_mode || 'vegetatif').trim().toLowerCase() === 'generatif'
    ? 'generatif'
    : 'vegetatif';

  const n1 = multiNode[1] || null;
  const n2 = multiNode[2] || null;
  const n3 = multiNode[3] || null;
  const gw = multiNode[0] || null;

  let multiNodeSection = `
DATA TERKINI SETIAP NODE DARI DATABASE SUPABASE:
- Node 1 (Hortikultura Bedeng A): Suhu ${n1?.temperature ?? '-'}°C, Kelembapan Udara ${n1?.humidity ?? '-'}%, Kelembapan Tanah ${n1?.soil_moisture ?? '-'}%
- Node 2 (Hortikultura Bedeng B): Suhu ${n2?.temperature ?? '-'}°C, Kelembapan Udara ${n2?.humidity ?? '-'}%, Kelembapan Tanah ${n2?.soil_moisture ?? '-'}%
- Node 3 (Sektor Gambut - Pencegahan Karhutla): Suhu Gambut (DS18B20) ${n3?.soil_temp ?? '-'}°C, Suhu Udara ${n3?.temperature ?? '-'}°C, Lembap Udara ${n3?.humidity ?? '-'}%, Skor FWI BMKG ${n3?.score ?? '-'}
- ESP32 Gateway (Irigasi & Aktuator): pH Tanah ${gw?.ph ?? '-'}, Debit Aliran Air ${gw?.flow_rate ?? 0} L/menit, Total Volume Air ${gw?.total_water ?? 0} Liter, Status Katup ${gw?.valve_status ?? 'IDLE'}, Status Pompa ${latestSensor?.pump_status ? 'MENYALA' : 'MATI'}`;

  let basePrompt = `Kamu adalah TeraNova AI Assistant, pakar cerdas Pertanian Presisi (Smart Agriculture) dan Mitigasi Karhutla Lahan Gambut. Kamu memiliki akses langsung ke database sensor Supabase untuk menganalisis, memprediksi, dan mengolah data.

FOKUS & METRIK TANAMAN:
- Fase tanaman aktif: ${phase.toUpperCase()}
- Suhu Mikro: ${latestSensor?.temperature ?? 28}°C
- Kelembapan Udara Mikro: ${latestSensor?.humidity ?? 70}%
- Kelembapan Tanah: ${latestSensor?.soil_moisture ?? 60}%
- Ambang Suhu: ${settings.temp_threshold_low ?? 0} - ${settings.temp_threshold_high ?? 0} °C
- Ambang Kelembapan Udara: ${settings.humidity_threshold_low ?? 0} - ${settings.humidity_threshold_high ?? 0} %
- Ambang Kelembapan Tanah: ${settings.soil_threshold_low ?? settings.soil_moisture_threshold ?? 40} - ${settings.soil_threshold_high ?? 80} % (kritis ${settings.soil_threshold_critical ?? 30} %)
- Status Pompa: ${latestSensor?.pump_status ? 'MENYALA' : 'MATI'}
- Jadwal Siram: ${latestSensor?.schedule_enabled === false ? 'NONAKTIF' : 'AKTIF'}
- Jam Siram: ${latestSensor?.watering_time ?? '-'}
- Durasi Siram: ${latestSensor?.watering_duration ?? '-'} detik
${multiNodeSection}
${trends ? `\nTREN DATA DATABASE TERKINI:\n${trends}\n` : ''}
PANDUAN ANALISIS & PREDIKSI:
1. Hubungkan data multi-node: bedeng hortikultura (Node 1 & 2), risiko karhutla gambut (Node 3), dan status air/irigasi (Gateway).
2. Jika pengguna bertanya tentang prediksi atau kondisi lahan, gunakan data real-time dan riwayat di atas untuk memberikan insight apakah tanah butuh penyiraman, apakah lahan gambut berpotensi terbakar, atau apakah debit air normal.
3. Gunakan rumus pengolahan Arduino/VPD yang relevan jika membahas rekomendasi penyiraman.
4. Gunakan bahasa Indonesia yang ramah, ringkas, solutif, dan profesional.`;

  // Tambahkan konteks kemarin jika tersedia
  if (yesterdayHistory && yesterdayHistory.insights) {
    basePrompt += `

RIWAYAT ANALISIS KEMARIN (untuk referensi konteks):
- Insight Kemarin: ${yesterdayHistory.insights.substring(0, 200)}
- Saran Kemarin: ${yesterdayHistory.recommendations ? yesterdayHistory.recommendations.substring(0, 150) : 'Tidak ada saran'}

Gunakan informasi ini untuk memberikan analisis yang lebih baik tentang perubahan kondisi atau tren dari hari ke hari.`;
  }

  return basePrompt;
}

function getStatusLevel(latestSensor, settings = {}) {

  const low = Number(settings.soil_threshold_low ?? settings.soil_moisture_threshold ?? 40);
  const critical = Number(settings.soil_threshold_critical ?? Math.max(20, low - 10));
  const soilMoisture = Number(latestSensor?.soil_moisture);
  if (!Number.isFinite(soilMoisture)) return 'belum dapat dinilai karena data sensor tanah belum tersedia';
  if (soilMoisture <= critical) return 'kritis';
  if (soilMoisture < low) return 'waspada';
  return 'aman';
}

function generateDailyReport(latestSensor) {
  return `📊 Laporan Harian:\n\n🌡️ Suhu: ${latestSensor?.temperature ?? 28}°C\n💧 Kelembapan Tanah: ${latestSensor?.soil_moisture ?? 60}%\n🔌 Pompa: ${latestSensor?.pump_status ? 'Aktif' : 'Nonaktif'}\n🕒 Jadwal Siram: ${latestSensor?.watering_time ?? '-'} (${latestSensor?.schedule_enabled === false ? 'Nonaktif' : 'Aktif'})\n\nSecara keseluruhan kondisi lahan ${getStatusLevel(latestSensor)}.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  let authenticatedUser;
  if (req.method === 'DELETE') {
    authenticatedUser = await getOptionalFirebaseAuth(req, res);
    if (res.headersSent) return;
    if (!authenticatedUser) {
      return res.status(200).json({ success: true, localOnly: true, date: getJakartaDateKey() });
    }
  } else {
    authenticatedUser = await requireFirebaseAuth(req, res);
    if (!authenticatedUser) return;
  }

  try {
    if (req.method === 'GET') {
      const { limit = 50 } = req.query;
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const startOfDay = new Date(`${today}T00:00:00+07:00`).toISOString();
      const startOfNextDay = new Date(`${today}T00:00:00+07:00`);
      startOfNextDay.setUTCDate(startOfNextDay.getUTCDate() + 1);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .gte('created_at', startOfDay)
        .lt('created_at', startOfNextDay.toISOString())
        .eq('user_id', authenticatedUser.uid)
        .order('created_at', { ascending: true })
        .limit(parseInt(limit, 10));

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { message, yesterdayHistory = null } = req.body || {};
      const user_id = authenticatedUser.uid;

      // Ambil 30 baris sensor data terbaru dari Supabase untuk multi-node & analisa tren
      const { data: recentRows } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      const multiNode = {};
      if (Array.isArray(recentRows)) {
        for (const r of recentRows) {
          if (r.node_id != null && !multiNode[r.node_id]) {
            multiNode[r.node_id] = r;
          }
        }
      }

      // Prioritaskan node tanaman (Node 1 atau Node 2) untuk metrik hortikultura dasar
      const latestSensor = multiNode[1] || multiNode[2] || (Array.isArray(recentRows) ? recentRows[0] : null) || {};

      // Buat ringkasan tren singkat dari database
      let trendSummary = '';
      if (Array.isArray(recentRows) && recentRows.length > 0) {
        const n3Rows = recentRows.filter(r => r.node_id === 3).slice(0, 5);
        if (n3Rows.length > 1) {
          const first = n3Rows[n3Rows.length - 1];
          const latest = n3Rows[0];
          trendSummary += `- Suhu Gambut (Node 3): bergerak dari ${first.soil_temp ?? '-'}°C ke ${latest.soil_temp ?? '-'}°C (Skor FWI: ${latest.score ?? '-'})\n`;
        }
        const gwRows = recentRows.filter(r => r.node_id === 0).slice(0, 5);
        if (gwRows.length > 0) {
          trendSummary += `- Gateway: Total air terakumulasi ${gwRows[0].total_water ?? 0}L, laju aliran saat ini ${gwRows[0].flow_rate ?? 0} L/menit\n`;
        }
      }

      const { data: latestSettings } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      const userChatMetadata = buildChatMetadata(latestSensor, latestSettings || {}, 'user');

      const safeInsertChatMessage = async (payload, fallbackSnapshots = {}) => {
        try {
          const res = await supabase.from('chat_messages').insert(payload).select().maybeSingle();
          if (!res.error) return res;

          if (res.error.code === 'PGRST204' || res.error.message?.includes('metadata')) {
            const fallback = {
              role: payload.role,
              content: payload.content,
              sensor_snapshot: fallbackSnapshots.sensor_snapshot || null,
              settings_snapshot: fallbackSnapshots.settings_snapshot || null,
            };
            if (payload.user_id) fallback.user_id = payload.user_id;

            const res2 = await supabase.from('chat_messages').insert(fallback).select().maybeSingle();
            if (!res2.error) return res2;

            if (res2.error.code === 'PGRST204' || res2.error.message?.includes('column')) {
              return await supabase.from('chat_messages').insert({
                role: payload.role,
                content: payload.content,
              }).select().maybeSingle();
            }
            return res2;
          }
          return res;
        } catch (err) {
          console.warn('[Chat] Supabase insert warning:', err?.message);
          return { data: null, error: err };
        }
      };

      await safeInsertChatMessage(
        {
          user_id,
          role: 'user',
          content: message,
          metadata: userChatMetadata,
        },
        {
          sensor_snapshot: userChatMetadata.sensor_snapshot,
          settings_snapshot: userChatMetadata.settings_snapshot,
        }
      );

      const systemPrompt = buildSystemPrompt(latestSensor, latestSettings || {}, yesterdayHistory, multiNode, trendSummary);

      let aiResponse = '';

      const lowerMessage = String(message || '').toLowerCase();

      if (lowerMessage.includes('siram') || lowerMessage.includes('pompa')) {
        const soilMoisture = latestSensor?.soil_moisture ?? 60;
        const low = Number(latestSettings?.soil_threshold_low ?? latestSettings?.soil_moisture_threshold ?? 40);
        const critical = Number(latestSettings?.soil_threshold_critical ?? Math.max(20, low - 10));
        if (soilMoisture <= critical) {
          aiResponse = `💧 Kondisi kritis. Kelembapan tanah ${soilMoisture}% sudah di bawah batas kritis ${critical}%.`;
        } else if (soilMoisture < low) {
          aiResponse = `⚠️ Kelembapan tanah ${soilMoisture}% mulai turun di bawah batas bawah ${low}%.`;
        } else {
          aiResponse = `✅ Kelembapan tanah ${soilMoisture}% masih cukup baik.`;
        }
      } else if (lowerMessage.includes('status') || lowerMessage.includes('sawah')) {
        aiResponse = `📊 Status lahan:\n\n🌡️ Suhu: ${latestSensor?.temperature ?? 28}°C\n💧 Kelembapan Tanah: ${latestSensor?.soil_moisture ?? 60}%\n🔌 Pompa: ${latestSensor?.pump_status ? 'Aktif' : 'Nonaktif'}\n🕒 Jadwal Siram: ${latestSensor?.watering_time ?? '-'} (${latestSensor?.schedule_enabled === false ? 'Nonaktif' : 'Aktif'})\n\nSecara keseluruhan kondisi lahan ${getStatusLevel(latestSensor, latestSettings)}.`;
      } else if (lowerMessage.includes('lapor') || lowerMessage.includes('harian')) {
        aiResponse = generateDailyReport(latestSensor);
      } else {
        try {
          const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY || 'demo-key'}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': req.headers.origin || 'https://sprout-v2.vercel.app',
            },
            body: JSON.stringify({
              model: process.env.OPENROUTER_MODEL || process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt + '\n\n' + ARDUINO_FORMULA_REFERENCE },
                { role: 'user', content: message },
              ],
              temperature: 0.5,
              max_tokens: 400,
            }),
          });

          const openRouterData = await openRouterRes.json();
          aiResponse = openRouterData?.choices?.[0]?.message?.content ||
            'Maaf, saya belum bisa memproses pertanyaan ini.';
        } catch (error) {
aiResponse = `Maaf, saya sedang kesulitan terhubung ke AI Online. ${error instanceof Error ? error.message : ''}`;

        }
      }

      const assistantMetadata = buildChatMetadata(latestSensor, latestSettings || {}, 'assistant');
      const assistantMessage = await safeInsertChatMessage(
        {
          user_id: authenticatedUser.uid,
          role: 'assistant',
          content: aiResponse,
          metadata: assistantMetadata,
        },
        {
          sensor_snapshot: assistantMetadata.sensor_snapshot,
          settings_snapshot: assistantMetadata.settings_snapshot,
        }
      );

      return res.status(200).json({
        success: true,
        message: aiResponse,
        data: assistantMessage.data,
      });
    }

    if (req.method === 'DELETE') {
      const { start, end } = getJakartaDateRange();
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .gte('created_at', start)
        .lt('created_at', end)
        .eq('user_id', authenticatedUser.uid);

      if (error) throw error;
      return res.status(200).json({ success: true, date: start.slice(0, 10) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown chat error',
    });
  }
}
