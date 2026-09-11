import { requireApiAuth } from '../lib/apiHelpers/_auth.js';
import { getAiRouterStatus, sendAiRouterMessage, isArduinoFormulaRequest, buildFormulaReference } from '../lib/apiHelpers/_airouter.js';
import supabase from '../lib/apiHelpers/_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!requireApiAuth(req, res)) return;

  if (req.method === 'GET') {
    const status = await getAiRouterStatus(req.headers.origin);
    return res.status(status.ok ? 200 : 503).json(status);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, images = [], history = [], sensorContext = null, aiSettings = null } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (isArduinoFormulaRequest(message)) {
      const formulaContent = [
        '## Rumus Arduino TERANA',
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

    const result = await sendAiRouterMessage({
      message,
      images,
      history,
      sensorContext,
      aiSettings,
      origin: req.headers.origin,
    });

    const user_id = req.body?.user_id || 'user_001';

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

    // Save user message (non-blocking for UI response)
    await insertChatRecord(
      {
        user_id,
        role: 'user',
        content: message,
        metadata: { role: 'user', sensor_snapshot: sensorContext, settings_snapshot: aiSettings },
      },
      { sensor_snapshot: sensorContext, settings_snapshot: aiSettings }
    );

    // Save assistant message (non-blocking for UI response)
    await insertChatRecord(
      {
        user_id: 'assistant_001',
        role: 'assistant',
        content: result.content || '',
        metadata: { role: 'assistant', analysis: result.analysis },
      },
      { sensor_snapshot: sensorContext, settings_snapshot: aiSettings }
    );

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown AI Router error',
    });
  }
}
