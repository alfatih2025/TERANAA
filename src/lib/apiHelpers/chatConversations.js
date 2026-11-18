import supabase from './_supabase.js';

export function getJakartaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getJakartaDateRange(dateKey) {
  const start = new Date(`${dateKey}T00:00:00+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function isConversationId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureChatConversation({ conversationId, userId, title }) {
  if (!isConversationId(conversationId)) {
    const error = new Error('ID percakapan tidak valid.');
    error.statusCode = 400;
    throw error;
  }

  const { data: existing, error: lookupError } = await supabase
    .from('chat_conversations')
    .select('id, user_id, title, conversation_date')
    .eq('id', conversationId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const today = getJakartaDateKey();
  const safeTitle = String(title || 'Percakapan baru')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 120) || 'Percakapan baru';

  if (existing) {
    if (existing.user_id !== userId) {
      const error = new Error('Percakapan tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }
    if (existing.conversation_date !== today) {
      const error = new Error('Percakapan hari sebelumnya hanya dapat dibaca. Mulai percakapan baru untuk hari ini.');
      error.statusCode = 409;
      throw error;
    }
    if (existing.title === 'Percakapan baru') {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ title: safeTitle, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_id', userId);
      if (error) throw error;
      return { ...existing, title: safeTitle };
    }
    return existing;
  }

  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      id: conversationId,
      user_id: userId,
      title: safeTitle,
      conversation_date: today,
    })
    .select('id, user_id, title, conversation_date')
    .single();
  if (error) throw error;
  return data;
}

export async function insertChatMessage(message) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert(message)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
