import supabase from './_supabase.js';

/**
 * Get current date in WIB (UTC+7) timezone
 */
function getWIBDate(baseDate = new Date()) {
  // Shift to WIB: UTC + 7 hours
  const wib = new Date(baseDate.getTime() + 7 * 60 * 60 * 1000);
  return wib;
}

function getWIBDateKey(baseDate = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(baseDate);
}

function getDateRange(dateKey) {
  const start = new Date(`${dateKey}T00:00:00+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Ambil riwayat harian untuk tanggal tertentu
 */
export async function getDailyHistory(date = null) {
  try {
    const targetDate = date ? new Date(date) : getWIBDate();
    const dateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)
      ? date.slice(0, 10)
      : getWIBDateKey(targetDate);

    // 1. Ambil data tersimpan di chat_daily_history jika ada
    const { data, error } = await supabase
      .from('chat_daily_history')
      .select('*')
      .eq('history_date', dateStr)
      .maybeSingle();

    if (error) {
      console.warn('[chatDailyHistory] Fetch daily history warning:', error.message);
    }

    // 2. Ambil pesan chat aktual untuk tanggal tersebut
    const messages = await getMessagesForDate(dateStr);

    if (!data && (!messages || messages.length === 0)) {
      return null;
    }

    // 3. Jika belum ada ringkasan tersimpan tapi ada pesan, buat secara live
    if (!data && messages && messages.length > 0) {
      const sensorMetrics = await generateSensorMetricsForDate(targetDate);
      const chatMetrics = generateMetricsFromMessages(messages);
      const summaryText = generateSummaryText(chatMetrics, sensorMetrics, messages);

      return {
        history_date: dateStr,
        summary_text: summaryText,
        key_metrics: sensorMetrics,
        message_count: messages.length,
        daily_messages: messages,
        sensor_summary: sensorMetrics ? {
          status: getStatusFromMetrics(sensorMetrics),
          critical_events: extractCriticalEvents(messages),
        } : null,
        ai_insights: generateAiInsights(messages, sensorMetrics),
        recommendations: generateRecommendations(messages, sensorMetrics),
      };
    }

    return {
      ...(data || {}),
      history_date: data?.history_date || dateStr,
      message_count: messages?.length || data?.message_count || 0,
      daily_messages: (messages && messages.length > 0) ? messages : (data?.daily_messages || []),
    };
  } catch (error) {
    console.error('Error fetching daily history:', error);
    return null;
  }
}

/**
 * Ambil riwayat kemarin
 */
export async function getYesterdayHistory() {
  try {
    const yesterday = getWIBDate();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateKey = getWIBDateKey(yesterday);
    return await getDailyHistory(dateKey);
  } catch (error) {
    console.error('Error fetching yesterday history:', error);
    return null;
  }
}

/**
 * Ambil chat messages untuk tanggal tertentu
 */
export async function getMessagesForDate(date) {
  try {
    const dateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : getWIBDateKey(new Date(date));
    const { start: startOfDay, end: endOfDay } = getDateRange(dateStr);

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching messages for date:', error);
    return [];
  }
}

export async function getAvailableHistoryDates() {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) throw error;

    return Array.from(new Set((data || []).map((message) => getWIBDateKey(new Date(message.created_at)))))
      .sort((left, right) => right.localeCompare(left));
  } catch (error) {
    console.error('Error fetching available history dates:', error);
    return [];
  }
}

export async function deleteHistoryForDate(date) {
  const dateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : getWIBDateKey(new Date(date));
  const { start, end } = getDateRange(dateStr);

  const { error: messagesError } = await supabase
    .from('chat_messages')
    .delete()
    .gte('created_at', start)
    .lt('created_at', end);
  if (messagesError) throw messagesError;

  const { error: historyError } = await supabase
    .from('chat_daily_history')
    .delete()
    .eq('history_date', dateStr);
  if (historyError) throw historyError;

  return dateStr;
}

/**
 * Generate metrics dari messages
 */
function generateMetricsFromMessages(messages) {
  const metrics = {
    total_messages: messages.length,
    user_messages: 0,
    assistant_messages: 0,
    topics: {},
  };

  messages.forEach((msg) => {
    if (msg.role === 'user') metrics.user_messages += 1;
    if (msg.role === 'assistant') metrics.assistant_messages += 1;

    // Extract topics dari content
    const content = (msg.content || '').toLowerCase();
    if (content.includes('siram') || content.includes('pompa')) metrics.topics.watering = (metrics.topics.watering || 0) + 1;
    if (content.includes('suhu') || content.includes('temperature')) metrics.topics.temperature = (metrics.topics.temperature || 0) + 1;
    if (content.includes('kelembapan') || content.includes('humidity')) metrics.topics.humidity = (metrics.topics.humidity || 0) + 1;
    if (content.includes('tanah') || content.includes('soil')) metrics.topics.soil = (metrics.topics.soil || 0) + 1;
  });

  return metrics;
}

/**
 * Generate sensor metrics summary dari sensor data
 */
export async function generateSensorMetricsForDate(date) {
  try {
    const dateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : getWIBDateKey(new Date(date));
    const { start: startOfDay, end: endOfDay } = getDateRange(dateStr);

    const { data, error } = await supabase
      .from('sensor_data')
      .select('temperature, humidity, soil_moisture, pump_status, score')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) return null;

    const temps = data.map((d) => d.temperature).filter((t) => t !== null);
    const humidities = data.map((d) => d.humidity).filter((h) => h !== null);
    const soils = data.map((d) => d.soil_moisture).filter((s) => s !== null);
    const scores = data.map((d) => d.score).filter((s) => s !== null);

    const avg = (arr) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;
    const min = (arr) => arr.length > 0 ? Math.min(...arr).toFixed(2) : 0;
    const max = (arr) => arr.length > 0 ? Math.max(...arr).toFixed(2) : 0;

    return {
      temperature: { min: min(temps), max: max(temps), avg: avg(temps) },
      humidity: { min: min(humidities), max: max(humidities), avg: avg(humidities) },
      soil_moisture: { min: min(soils), max: max(soils), avg: avg(soils) },
      score: { min: min(scores), max: max(scores), avg: avg(scores) },
      total_readings: data.length,
      pump_activations: data.filter((d) => d.pump_status === true).length,
    };
  } catch (error) {
    console.error('Error generating sensor metrics:', error);
    return null;
  }
}

/**
 * Generate summary text dari messages
 */
function generateSummaryText(metrics, sensorMetrics, messages) {
  let summary = `📊 **Ringkasan Analisis ${new Date().toLocaleDateString('id-ID')}**\n\n`;

  summary += `**Statistik Chat:**\n`;
  summary += `- Pesan Pengguna: ${metrics.user_messages}\n`;
  summary += `- Respons AI: ${metrics.assistant_messages}\n`;
  summary += `- Topik Utama: ${Object.keys(metrics.topics).join(', ') || 'Umum'}\n\n`;

  if (sensorMetrics) {
    summary += `**Kondisi Perangkat:**\n`;
    summary += `- Suhu: ${sensorMetrics.temperature.min}°C - ${sensorMetrics.temperature.max}°C (rata-rata ${sensorMetrics.temperature.avg}°C)\n`;
    summary += `- Kelembapan Udara: ${sensorMetrics.humidity.min}% - ${sensorMetrics.humidity.max}% (rata-rata ${sensorMetrics.humidity.avg}%)\n`;
    summary += `- Kelembapan Tanah: ${sensorMetrics.soil_moisture.min}% - ${sensorMetrics.soil_moisture.max}% (rata-rata ${sensorMetrics.soil_moisture.avg}%)\n`;
    summary += `- Skor Kesehatan: ${sensorMetrics.score.min} - ${sensorMetrics.score.max} (rata-rata ${sensorMetrics.score.avg})\n`;
    summary += `- Aktivasi Pompa: ${sensorMetrics.pump_activations} kali\n`;
  }

  return summary;
}

/**
 * Simpan daily history ke Supabase
 */
export async function saveDailyHistory(date = null, overrideData = null) {
  try {
    const targetDate = date ? new Date(date) : getWIBDate();
    const dateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)
      ? date.slice(0, 10)
      : getWIBDateKey(targetDate);

    // Ambil messages untuk hari itu
    const messages = await getMessagesForDate(targetDate);

    // Generate sensor metrics
    const sensorMetrics = await generateSensorMetricsForDate(targetDate);

    // Generate chat metrics
    const chatMetrics = generateMetricsFromMessages(messages);

    // Generate summary text
    const summaryText = generateSummaryText(chatMetrics, sensorMetrics, messages);

    // Persiapkan data untuk insert/update
    const historyData = overrideData || {
      history_date: dateStr,
      summary_text: summaryText,
      key_metrics: sensorMetrics,
      message_count: messages.length,
      daily_messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      })),
      sensor_summary: sensorMetrics ? {
        status: getStatusFromMetrics(sensorMetrics),
        critical_events: extractCriticalEvents(messages),
      } : null,
      ai_insights: generateAiInsights(messages, sensorMetrics),
      recommendations: generateRecommendations(messages, sensorMetrics),
    };

    // Upsert ke Supabase
    const { data, error } = await supabase
      .from('chat_daily_history')
      .upsert([historyData], { onConflict: 'history_date' })
      .select();

    if (error) throw error;
    return data ? data[0] : null;
  } catch (error) {
    console.error('Error saving daily history:', error);
    return null;
  }
}

/**
 * Extract status dari metrics
 */
function getStatusFromMetrics(metrics) {
  if (!metrics) return 'unknown';

  const soilMin = parseFloat(metrics.soil_moisture.min);
  if (soilMin < 30) return 'kritis';
  if (soilMin < 40) return 'waspada';
  return 'normal';
}

/**
 * Extract critical events dari messages
 */
function extractCriticalEvents(messages) {
  const events = [];
  messages.forEach((msg) => {
    if (msg.role === 'assistant') {
      const content = msg.content || '';
      if (content.includes('kritis') || content.includes('critical')) {
        events.push({ type: 'critical', time: msg.created_at });
      }
      if (content.includes('waspada') || content.includes('warning')) {
        events.push({ type: 'warning', time: msg.created_at });
      }
    }
  });
  return events;
}

/**
 * Generate AI insights dari data
 */
function generateAiInsights(messages, sensorMetrics) {
  let insights = '';

  // Ambil insight terakhir dari assistant
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  if (lastAssistantMsg) {
    insights = lastAssistantMsg.content.substring(0, 500); // Ambil 500 karakter pertama
  }

  return insights;
}

/**
 * Generate recommendations untuk hari berikutnya
 */
function generateRecommendations(messages, sensorMetrics) {
  let recommendations = '💡 **Saran untuk Hari Berikutnya:**\n\n';

  if (sensorMetrics) {
    const soilAvg = parseFloat(sensorMetrics.soil_moisture.avg);
    if (soilAvg < 50) {
      recommendations += '1. Tingkatkan frekuensi penyiraman - kelembapan tanah cenderung rendah\n';
    }

    const tempAvg = parseFloat(sensorMetrics.temperature.avg);
    if (tempAvg > 32) {
      recommendations += '2. Pantau suhu lebih ketat - suhu relatif tinggi\n';
    }

    const humAvg = parseFloat(sensorMetrics.humidity.avg);
    if (humAvg < 65) {
      recommendations += '3. Pertimbangkan penambahan sistem pendingin atau ventilasi\n';
    }
  }

  recommendations += '4. Terus monitor data sensor secara berkala';

  return recommendations;
}

/**
 * Format history untuk ditampilkan di UI
 */
export function formatHistoryForDisplay(history) {
  if (!history) return null;

  return {
    date: new Date(history.history_date).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    summary: history.summary_text,
    metrics: history.key_metrics,
    insights: history.ai_insights,
    recommendations: history.recommendations,
    messageCount: history.message_count || history.daily_messages?.length || 0,
    messages: (history.daily_messages || []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.created_at,
    })),
  };
}
