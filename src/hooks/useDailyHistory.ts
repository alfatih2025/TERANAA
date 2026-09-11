import { useState, useEffect, useCallback } from 'react';
import { buildApiHeaders } from '../lib/apiAuth';

export interface DailyHistory {
  date: string;
  summary: string;
  metrics: any;
  insights: string;
  recommendations: string;
  messageCount: number;
  messages: Array<{
    id?: number;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }>;
}

export function useDailyHistory() {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [yesterdayHistory, setYesterdayHistory] = useState<DailyHistory | null>(null);
  const [todayHistory, setTodayHistory] = useState<DailyHistory | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<DailyHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ambil history untuk tanggal tertentu
   */
  const fetchHistory = useCallback(async (target: 'yesterday' | 'today' | string = 'today') => {
    try {
      setLoading(true);
      setError(null);

      const query = target === 'today' || target === 'yesterday' ? `target=${target}` : `date=${encodeURIComponent(target)}`;
      const response = await fetch(`/api/chat-daily-history?${query}`, {
        headers: buildApiHeaders(),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Gagal mengambil riwayat');
        return null;
      }

      const history = result.data as DailyHistory;

      if (target === 'yesterday') {
        setYesterdayHistory(history);
      } else if (target === 'today') {
        setTodayHistory(history);
      }
      setSelectedHistory(history);

      return history;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableDates = useCallback(async () => {
    const response = await fetch('/api/chat-daily-history?list=dates', { headers: buildApiHeaders() });
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.data)) throw new Error(result.error || 'Gagal mengambil tanggal histori');
    setAvailableDates(result.data);
    return result.data as string[];
  }, []);

  const selectDate = useCallback(async (date: string) => {
    setSelectedDate(date);
    return fetchHistory(date);
  }, [fetchHistory]);

  /**
   * Simpan atau generate daily history
   */
  const saveHistory = useCallback(async (date?: string, overrideData?: any) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/chat-daily-history', {
        method: 'POST',
        headers: buildApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ date, overrideData }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Gagal menyimpan riwayat');
        return null;
      }

      return result.data as DailyHistory;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update history tertentu
   */
  const updateHistory = useCallback(
    async (date: string, updates: Partial<DailyHistory>) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/chat-daily-history', {
          method: 'PUT',
          headers: buildApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            date,
            summary_text: updates.summary,
            recommendations: updates.recommendations,
            ai_insights: updates.insights,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Gagal mengupdate riwayat');
          return null;
        }

        return result.data as DailyHistory;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Hapus history tertentu
   */
  const deleteHistory = useCallback(async (date: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/chat-daily-history?date=${date}`, {
        method: 'DELETE',
        headers: buildApiHeaders(),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Gagal menghapus riwayat');
        return false;
      }

      setAvailableDates((dates) => dates.filter((item) => item !== date));
      setSelectedDate((current) => current === date ? '' : current);
      setSelectedHistory((current) => current?.date === date ? null : current);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const [selectedTarget, setSelectedTarget] = useState<'yesterday' | 'today'>('today');

  /**
   * Load history on mount
   */
  useEffect(() => {
    fetchAvailableDates().then((dates) => {
      if (dates.length > 0) {
        setSelectedDate(dates[0]);
        void fetchHistory(dates[0]);
      }
    }).catch((err) => setError(err instanceof Error ? err.message : 'Gagal mengambil tanggal histori'));
  }, [fetchAvailableDates, fetchHistory]);

  const activeHistory = selectedDate ? selectedHistory : (selectedTarget === 'yesterday' ? yesterdayHistory : todayHistory);
  // Fallback: jika yang dipilih null tapi target lain ada datanya, gunakan yang ada
  const displayHistory = activeHistory || (selectedTarget === 'yesterday' ? todayHistory : yesterdayHistory);

  return {
    yesterdayHistory,
    todayHistory,
    activeHistory: displayHistory,
    selectedTarget,
    setSelectedTarget,
    availableDates,
    selectedDate,
    selectDate,
    loading,
    error,
    fetchHistory,
    saveHistory,
    updateHistory,
    deleteHistory,
  };
}
