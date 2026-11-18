import { requireFirebaseAuth } from '../lib/apiHelpers/_auth.js';
import supabase from '../lib/apiHelpers/_supabase.js';
import {
  ensureChatConversation,
  getJakartaDateRange,
  insertChatMessage,
  isConversationId,
} from '../lib/apiHelpers/chatConversations.js';

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

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

  const authenticatedUser = await requireFirebaseAuth(req, res);
  if (!authenticatedUser) return;

  try {
    if (req.method === 'GET') {
      const { limit = 50, conversationId } = req.query;
      if (String(req.query?.list || '').toLowerCase() === 'conversations') {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('id, title, conversation_date, created_at, updated_at')
          .eq('user_id', authenticatedUser.uid)
          .order('updated_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        return res.status(200).json(data || []);
      }

      if (!conversationId) {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('user_id', authenticatedUser.uid)
          .order('created_at', { ascending: false })
          .limit(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500));
        if (error) throw error;
        return res.status(200).json(data || []);
      }
      if (!isConversationId(conversationId)) return res.status(400).json({ error: 'ID percakapan tidak valid.' });
      const { data: conversation, error: conversationError } = await supabase
        .from('chat_conversations')
        .select('id, user_id, conversation_date')
        .eq('id', conversationId)
        .maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation) return res.status(200).json([]);
      if (conversation.user_id !== authenticatedUser.uid) {
        return res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      }
      const { start, end } = getJakartaDateRange(conversation.conversation_date);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .gte('created_at', start)
        .lt('created_at', end)
        .eq('user_id', authenticatedUser.uid)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500));

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { message, conversationId, yesterdayHistory = null } = req.body || {};
      const user_id = authenticatedUser.uid;
      if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }
      const conversation = await ensureChatConversation({
        conversationId,
        userId: user_id,
        title: message,
      });

      // Ambil data terbaru dari setiap node secara spesifik (0: Gateway, 1: Node 1, 2: Node 2, 3: Node 3)
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

      const multiNode = {};
      nodeIds.forEach((n, idx) => {
        if (nodeResults[idx]?.data) {
          multiNode[n] = nodeResults[idx].data;
        }
      });

      // Ambil juga beberapa riwayat data Node 3 untuk melihat tren pergerakan suhu gambut & FWI
      const { data: n3History } = await supabase
        .from('sensor_data')
        .select('soil_temp, score, created_at')
        .eq('node_id', 3)
        .order('id', { ascending: false })
        .limit(5);

      // Prioritaskan node tanaman (Node 2 atau Node 1) untuk metrik hortikultura dasar
      const latestSensor = multiNode[2] || multiNode[1] || multiNode[3] || multiNode[0] || {};

      let trendSummary = '';
      if (Array.isArray(n3History) && n3History.length > 1) {
        const oldest = n3History[n3History.length - 1];
        const newest = n3History[0];
        trendSummary += `- Tren Suhu Gambut (Node 3): bergerak dari ${oldest.soil_temp ?? '-'}°C ke ${newest.soil_temp ?? '-'}°C (Skor FWI terkini: ${newest.score ?? '-'})\n`;
      }
      if (multiNode[0]) {
        trendSummary += `- Status Irigasi Gateway: Total air terakumulasi ${multiNode[0].total_water ?? 0}L, debit aliran ${multiNode[0].flow_rate ?? 0} L/menit, valve: ${multiNode[0].valve_status ?? 'IDLE'}\n`;
      }

      const { data: latestSettings } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      const userChatMetadata = buildChatMetadata(latestSensor, latestSettings || {}, 'user');

      await insertChatMessage({
        user_id,
        conversation_id: conversation.id,
        role: 'user',
        content: message,
        metadata: userChatMetadata,
      });

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
      const assistantMessage = await insertChatMessage({
        user_id: authenticatedUser.uid,
        conversation_id: conversation.id,
        role: 'assistant',
        content: aiResponse,
        metadata: assistantMetadata,
      });
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation.id)
        .eq('user_id', authenticatedUser.uid);

      return res.status(200).json({
        success: true,
        message: aiResponse,
        data: assistantMessage,
        conversationId: conversation.id,
      });
    }

    if (req.method === 'DELETE') {
      const conversationId = req.query?.conversationId || req.body?.conversationId;
      if (!isConversationId(conversationId)) {
        return res.status(400).json({ error: 'ID percakapan tidak valid.' });
      }
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', authenticatedUser.uid);

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(Number.isInteger(error?.statusCode) ? error.statusCode : 500).json({
      error: error instanceof Error ? error.message : 'Unknown chat error',
    });
  }
}
