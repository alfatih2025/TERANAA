import { requireFirebaseAuth } from '../lib/apiHelpers/_auth.js';
import supabase from '../lib/apiHelpers/_supabase.js';
import { getJakartaDateKey, getJakartaDateRange } from '../lib/apiHelpers/chatConversations.js';

function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isFinite(date.getTime()) && getJakartaDateKey(date) === value;
}

function formatHistory(dateKey, messages) {
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  return {
    date: new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(`${dateKey}T12:00:00+07:00`)),
    summary: `${messages.length} pesan tersimpan untuk hari ini.`,
    metrics: null,
    insights: latestAssistantMessage?.content || '',
    recommendations: '',
    messageCount: messages.length,
    messages: messages.map(({ id, role, content, created_at }) => ({ id, role, content, created_at })),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireFirebaseAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      if (String(req.query?.list || '').toLowerCase() === 'dates') {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('created_at')
          .eq('user_id', user.uid)
          .order('created_at', { ascending: false })
          .limit(2000);
        if (error) throw error;

        const dates = Array.from(new Set((data || []).map((message) => getJakartaDateKey(new Date(message.created_at)))))
          .sort((left, right) => right.localeCompare(left));
        return res.status(200).json({ success: true, data: dates });
      }

      const requestedDate = req.query?.date;
      let dateKey = requestedDate ? String(requestedDate) : getJakartaDateKey();
      if (!requestedDate && String(req.query?.target || '').toLowerCase() === 'yesterday') {
        const yesterday = new Date(`${dateKey}T12:00:00+07:00`);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        dateKey = getJakartaDateKey(yesterday);
      }
      if (!isDateKey(dateKey)) return res.status(400).json({ error: 'Format tanggal tidak valid.' });

      const { start, end } = getJakartaDateRange(dateKey);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('user_id', user.uid)
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: true })
        .limit(1000);
      if (error) throw error;

      const messages = data || [];
      return res.status(200).json({
        success: true,
        data: messages.length > 0 ? formatHistory(dateKey, messages) : null,
      });
    }

    if (req.method === 'DELETE') {
      const dateKey = String(req.query?.date || '');
      if (!isDateKey(dateKey)) return res.status(400).json({ error: 'Format tanggal tidak valid.' });

      const { start, end } = getJakartaDateRange(dateKey);
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', user.uid)
        .gte('created_at', start)
        .lt('created_at', end);
      if (error) throw error;
      const { error: conversationsError } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('user_id', user.uid)
        .eq('conversation_date', dateKey);
      if (conversationsError) throw conversationsError;
      return res.status(200).json({ success: true, date: dateKey });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in chat-daily-history handler:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
