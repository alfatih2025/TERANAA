import { ChatInterface } from '../components/ChatInterface';
import { DailyHistorySummary } from '../components/DailyHistorySummary';
import { MessageSquare, Sparkles } from 'lucide-react';
import { SensorData } from '../hooks/useSensorData';
import { Settings } from '../hooks/useSettings';
import { WeatherData } from '../hooks/useWeather';
import { getPlantPhaseProfile } from '../lib/plantPhase';
import { useDailyHistory } from '../hooks/useDailyHistory';
import { useAuth } from '../hooks/useAuthContext';

interface ChatPageProps {
  sensorData?: SensorData | null;
  settings?: Settings | null;
  weatherData?: WeatherData | null;
  onLogin?: () => void;
}

export function ChatPage({ sensorData = null, settings = null, weatherData = null, onLogin }: ChatPageProps) {
  const { currentUser } = useAuth();
  const phase = getPlantPhaseProfile(settings?.plant_phase);
  const {
    activeHistory,
    yesterdayHistory,
    todayHistory,
    selectedTarget,
    setSelectedTarget,
    availableDates,
    selectedDate,
    selectDate,
    deleteHistory,
    loading: historyLoading,
  } = useDailyHistory();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TeraNova AI</h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-200">
          <Sparkles size={12} />
          AI Pertanian
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl border border-green-100 bg-white light-card p-4 shadow-sm dark:border-green-500/20 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Fase aktif</p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{phase.label}</p>
        </div>
        <div className="rounded-3xl border border-green-100 bg-white light-card p-4 shadow-sm dark:border-green-500/20 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Lokasi cuaca</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{weatherData?.location || 'Lokasi cuaca belum dipilih'}</p>
        </div>
      </div>

      {currentUser ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-slate-900/80">
          <DailyHistorySummary
            history={activeHistory}
            isLoading={historyLoading}
            selectedTarget={selectedTarget}
            onTargetChange={setSelectedTarget}
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateChange={selectDate}
            onDeleteDate={deleteHistory}
            hasYesterday={Boolean(yesterdayHistory && yesterdayHistory.messageCount > 0)}
            hasToday={Boolean(todayHistory && todayHistory.messageCount > 0)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-100 sm:flex-row sm:items-center sm:justify-between">
          <p>Anda dapat chat tanpa login. Percakapan tamu hanya tersedia selama halaman ini terbuka dan tidak disimpan.</p>
          <button
            type="button"
            onClick={onLogin}
            className="min-h-11 shrink-0 rounded-xl bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
          >
            Login untuk menyimpan
          </button>
        </div>
      )}

      <ChatInterface sensorData={sensorData} settings={settings} weatherData={weatherData} />
    </div>
  );
}
