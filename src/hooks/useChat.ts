import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { SensorSnapshotContext } from '../services/openrouter';
import type { DailyHistory } from './useDailyHistory';
import { useAuth } from './useAuthContext';
import { buildFirebaseAuthHeaders, buildOptionalFirebaseAuthHeaders } from '../lib/apiAuth';
import type { Settings } from './useSettings';
import type { AiDecision } from '../components/AiAnalysisView';

export interface ChatMessage {
  id: number;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  created_at: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  conversation_date: string;
  created_at: string;
  updated_at: string;
}

function getJakartaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function createConversation(): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'Percakapan baru',
    conversation_date: getJakartaDateKey(),
    created_at: now,
    updated_at: now,
  };
}

function createMessage(
  role: 'user' | 'assistant',
  content: string,
  userId: string,
  images?: string[],
): ChatMessage {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    user_id: userId,
    role,
    content,
    images: images && images.length > 0 ? images : undefined,
    created_at: new Date().toISOString(),
  };
}

async function fetchApiMessages(conversationId: string): Promise<ChatMessage[]> {
  const response = await fetch(`/api/chat?conversationId=${encodeURIComponent(conversationId)}`, {
    headers: await buildFirebaseAuthHeaders(),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || `Chat API tidak merespons (${response.status})`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Format riwayat chat dari API tidak valid.');
  return data;
}

function normalizeSensorContext(sensorContext?: Partial<SensorSnapshotContext> | null) {
  if (!sensorContext || typeof sensorContext !== 'object') return null;
  return sensorContext;
}

export function useChat() {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AiDecision | null>(null);
  const [yesterdayHistory, setYesterdayHistory] = useState<DailyHistory | null>(null);
  const [connectionStatus, setConnectionStatus] = useState({
    state: 'checking',
    label: 'Memeriksa AI Router',
    detail: 'Menghubungkan chatbot ke sistem...',
  });
  const fetchSequence = useRef(0);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [conversations, activeConversationId],
  );
  const isReadOnlyConversation = Boolean(
    activeConversation && activeConversation.conversation_date !== getJakartaDateKey(),
  );

  const refreshConnectionStatus = useCallback(async () => {
    setConnectionStatus({
      state: 'checking',
      label: 'Memeriksa AI Router',
      detail: 'Menghubungkan chatbot ke sistem...',
    });
    try {
      const res = await fetch('/api/airouter', { headers: await buildOptionalFirebaseAuthHeaders() });
      const status = await res.json().catch(() => null);
      if (res.ok) {
        setConnectionStatus({
          state: 'connected',
          label: status?.label || 'AI Router Aktif',
          detail: status?.detail || 'Sistem siap.',
        });
      } else {
        setConnectionStatus({
          state: 'error',
          label: status?.label || 'AI Router Error',
          detail: status?.detail || status?.error || `AI Router gagal (${res.status})`,
        });
      }
    } catch (statusError) {
      setConnectionStatus({
        state: 'error',
        label: 'AI Router Offline',
        detail: statusError instanceof Error ? statusError.message : 'Gagal menghubungi server',
      });
    }
  }, []);

  const loadYesterdayHistory = useCallback(async () => {
    if (!userId) {
      setYesterdayHistory(null);
      return;
    }

    try {
      const response = await fetch('/api/chat-daily-history?target=yesterday', {
        headers: await buildFirebaseAuthHeaders(),
      });
      if (!response.ok) throw new Error(`Gagal memuat histori (${response.status})`);
      const result = await response.json();
      setYesterdayHistory(result.data as DailyHistory | null);
    } catch (historyError) {
      console.warn('Failed to load yesterday history:', historyError);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      fetchSequence.current += 1;
      setMessages([]);
      setConversations([]);
      setActiveConversationId(null);
      setAnalysisData(null);
      setError(null);
      setYesterdayHistory(null);
      if (!userId) return;

      void refreshConnectionStatus();
      void loadYesterdayHistory();
      try {
        const response = await fetch('/api/chat?list=conversations', {
          headers: await buildFirebaseAuthHeaders(),
        });
        const result = await response.json();
        if (!response.ok || !Array.isArray(result)) {
          throw new Error(result?.error || 'Gagal memuat daftar percakapan.');
        }

        if (!active) return;
        const today = getJakartaDateKey();
        const todayConversations = result as ChatConversation[];
        const savedId = window.localStorage.getItem(`teranova-active-chat-${userId}`);
        const selectedConversation = todayConversations.find((item) => item.id === savedId && item.conversation_date === today)
          || todayConversations.find((item) => item.conversation_date === today)
          || createConversation();
        const nextConversations = todayConversations.some((item) => item.id === selectedConversation.id)
          ? todayConversations
          : [selectedConversation, ...todayConversations];
        setConversations(nextConversations);
        setActiveConversationId(selectedConversation.id);
        window.localStorage.setItem(`teranova-active-chat-${userId}`, selectedConversation.id);
        setError(null);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat percakapan.');
      }
    };

    void initialize();
    return () => { active = false; };
  }, [userId, loadYesterdayHistory, refreshConnectionStatus]);

  useEffect(() => {
    if (!activeConversationId || !userId) return;
    let active = true;
    const sequence = ++fetchSequence.current;
    fetchApiMessages(activeConversationId).then((apiMessages) => {
      if (active && sequence === fetchSequence.current) {
        setMessages(apiMessages);
        setError(null);
      }
    }).catch((fetchError: unknown) => {
      if (active && sequence === fetchSequence.current) {
        setError(fetchError instanceof Error ? fetchError.message : 'Gagal mengambil riwayat chat');
      }
    });
    return () => { active = false; };
  }, [activeConversationId, userId]);

  const selectConversation = useCallback((conversationId: string) => {
    if (!conversations.some((item) => item.id === conversationId)) return;
    setActiveConversationId(conversationId);
    setMessages([]);
    setAnalysisData(null);
    setError(null);
    if (userId) {
      window.localStorage.setItem(`teranova-active-chat-${userId}`, conversationId);
    }
  }, [conversations, userId]);

  const fetchMessages = useCallback(async () => {
    if (!userId || !activeConversationId) return [];

    const sequence = ++fetchSequence.current;
    try {
      const apiMessages = await fetchApiMessages(activeConversationId);
      if (sequence === fetchSequence.current) {
        setMessages(apiMessages);
        setError(null);
      }
      return apiMessages;
    } catch (fetchError) {
      if (sequence === fetchSequence.current) {
        setError(fetchError instanceof Error ? fetchError.message : 'Gagal mengambil riwayat chat');
      }
      return [];
    }
  }, [activeConversationId, userId]);

  const startNewConversation = useCallback(() => {
    if (!userId) return;
    const conversation = createConversation();
    setConversations((existing) => [conversation, ...existing]);
    setActiveConversationId(conversation.id);
    setMessages([]);
    setAnalysisData(null);
    setError(null);
    window.localStorage.setItem(`teranova-active-chat-${userId}`, conversation.id);
  }, [userId]);

  const clearMessages = useCallback(async () => {
    if (!activeConversationId || !userId) return;
    try {
      const response = await fetch(`/api/chat?conversationId=${encodeURIComponent(activeConversationId)}`, {
        method: 'DELETE',
        headers: await buildFirebaseAuthHeaders(),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Gagal menghapus percakapan.');
      }

      setConversations((existing) => existing.filter((item) => item.id !== activeConversationId));
      setMessages([]);
      setAnalysisData(null);
      setError(null);
      startNewConversation();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Gagal menghapus percakapan.');
    }
  }, [activeConversationId, userId, startNewConversation]);

  const sendMessage = useCallback(
    async (
      message: string,
      sensorContext?: Partial<SensorSnapshotContext> | null,
      settings?: Settings | null,
      images?: string[],
    ) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage && (!images || images.length === 0)) return;
      if (userId && !activeConversation) {
        setError('Percakapan belum siap. Buat percakapan baru lalu coba lagi.');
        return;
      }
      if (userId && activeConversation?.conversation_date !== getJakartaDateKey()) {
        setError('Percakapan hari sebelumnya hanya dapat dibaca. Mulai percakapan baru untuk hari ini.');
        return;
      }

      setLoading(true);
      setError(null);

      const displayMessage = trimmedMessage || '[Mengunggah foto tanaman untuk analisis visual...]';
      const userMessage = createMessage('user', displayMessage, userId || 'guest', images);
      const optimisticMessages = [...messages, userMessage];
      setMessages(optimisticMessages);

      try {
        const response = await fetch('/api/airouter', {
          method: 'POST',
          headers: await buildOptionalFirebaseAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            message: displayMessage,
            conversationId: activeConversation?.id,
            images: images || [],
            history: messages.map((item) => ({ role: item.role, content: item.content })),
            sensorContext: normalizeSensorContext(sensorContext),
            aiSettings: settings,
            yesterdayHistory: yesterdayHistory ? {
              summary: yesterdayHistory.summary,
              insights: yesterdayHistory.insights,
              recommendations: yesterdayHistory.recommendations,
            } : null,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal menghubungi AI Router');

        const assistantMessage = createMessage('assistant', data.content || 'Maaf, jawaban kosong.', userId || 'guest');
        setMessages([...optimisticMessages, assistantMessage]);
        if (userId && activeConversation) {
          setConversations((existing) => existing.map((item) => item.id === activeConversation.id
            ? {
                ...item,
                title: item.title === 'Percakapan baru' ? displayMessage.slice(0, 120) : item.title,
                updated_at: new Date().toISOString(),
              }
            : item));
        }

        if (data.analysis) setAnalysisData(data.analysis);
        setConnectionStatus({
          state: 'connected',
          label: 'AI Router Aktif',
          detail: `Respons diterima via ${data.provider} (${data.model})`,
        });
      } catch (sendError) {
        const detail = sendError instanceof Error ? sendError.message : 'Unknown chat error';
        setError(detail);
        setConnectionStatus({ state: 'error', label: 'AI Router Error', detail });
      } finally {
        setLoading(false);
      }
    },
    [activeConversation, userId, messages, yesterdayHistory],
  );

  return {
    messages,
    conversations,
    activeConversation,
    activeConversationId,
    isReadOnlyConversation,
    loading,
    error,
    analysisData,
    yesterdayHistory,
    sendMessage,
    refetch: fetchMessages,
    clearMessages,
    selectConversation,
    startNewConversation,
    connectionStatus,
    refreshConnectionStatus,
  };
}
