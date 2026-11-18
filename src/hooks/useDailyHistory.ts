import { useState, useEffect, useCallback } from 'react';
import { buildFirebaseAuthHeaders } from '../lib/apiAuth';
import { useAuth } from './useAuthContext';

interface MetricRange {
  min?: number;
  max?: number;
}

interface DailyHistoryMetrics {
  temperature?: MetricRange;
  humidity?: MetricRange;
  soil_moisture?: MetricRange;
}

export interface DailyHistory {
  date: string;
  summary: string;
  metrics: DailyHistoryMetrics | null;
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
  const { currentUser } = useAuth();
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [yesterdayHistory, setYesterdayHistory] = useState<DailyHistory | null>(null);
  const [todayHistory, setTodayHistory] = useState<DailyHistory | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<DailyHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = currentUser?.id;

  /**
   * Ambil history untuk tanggal tertentu
   */
  const fetchHistory = useCallback(async (target: 'yesterday' | 'today' | string = 'today') => {
    try {
      setLoading(true);
      setError(null);

      const query = target === 'today' || target === 'yesterday' ? `target=${target}` : `date=${encodeURIComponent(target)}`;
      const response = await fetch(`/api/chat-daily-history?${query}`, {
        headers: await buildFirebaseAuthHeaders(),
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
    const response = await fetch('/api/chat-daily-history?list=dates', { headers: await buildFirebaseAuthHeaders() });
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
   * Hapus history tertentu
   */
  const deleteHistory = useCallback(async (date: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/chat-daily-history?date=${date}`, {
        method: 'DELETE',
        headers: await buildFirebaseAuthHeaders(),
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
    let active = true;
    const loadHistory = async () => {
      if (!userId) {
        setAvailableDates([]);
        setSelectedDate('');
        setSelectedHistory(null);
        setYesterdayHistory(null);
        setTodayHistory(null);
        return;
      }

      try {
        const dates = await fetchAvailableDates();
        if (!active) return;
        if (dates.length > 0) {
          setSelectedDate(dates[0]);
          await fetchHistory(dates[0]);
        } else {
          setSelectedDate('');
          setSelectedHistory(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Gagal mengambil tanggal histori');
      }
    };

    void loadHistory();
    return () => { active = false; };
  }, [userId, fetchAvailableDates, fetchHistory]);

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
    deleteHistory,
  };
}
