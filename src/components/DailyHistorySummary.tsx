import { Calendar, TrendingUp, Lightbulb, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, MessageCircle, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import type { DailyHistory } from '../hooks/useDailyHistory';

interface DailyHistorySummaryProps {
  history: DailyHistory | null;
  isLoading?: boolean;
  selectedTarget?: 'yesterday' | 'today';
  onTargetChange?: (target: 'yesterday' | 'today') => void;
  hasYesterday?: boolean;
  hasToday?: boolean;
  availableDates?: string[];
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  onDeleteDate?: (date: string) => Promise<boolean>;
}

export function DailyHistorySummary({
  history,
  isLoading = false,
  selectedTarget = 'today',
  onTargetChange,
  hasYesterday = false,
  hasToday = false,
  availableDates = [],
  selectedDate = '',
  onDateChange,
  onDeleteDate,
}: DailyHistorySummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  const isToday = selectedTarget === 'today';
  const targetLabel = isToday ? 'Hari Ini' : 'Kemarin';
  const formatDate = (date: string) => new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(`${date}T00:00:00+07:00`));

  const handleDelete = async () => {
    if (!selectedDate || !onDeleteDate) return;
    if (!window.confirm(`Hapus seluruh riwayat analisis AI pada ${history?.date || formatDate(selectedDate)}?`)) return;
    await onDeleteDate(selectedDate);
    setIsExpanded(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header with Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3 dark:border-amber-500/30">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Riwayat Analisis AI</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {history ? history.date : 'Pilih tanggal histori'}
            </p>
          </div>
        </div>

        {/* Tab switcher: Hari Ini | Kemarin */}
        {availableDates.length > 0 && onDateChange ? (
          <select
            value={selectedDate}
            onChange={(event) => void onDateChange(event.target.value)}
            className="min-w-48 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-500/40 dark:bg-slate-900 dark:text-amber-100"
            aria-label="Pilih tanggal histori chat"
          >
            {availableDates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
          </select>
        ) : onTargetChange && (
          <div className="flex items-center gap-1 rounded-full bg-amber-100/80 p-1 dark:bg-amber-950/40">
            <button
              type="button"
              onClick={() => onTargetChange('today')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                isToday
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100'
              }`}
            >
              Hari Ini {hasToday ? '●' : ''}
            </button>
            <button
              type="button"
              onClick={() => onTargetChange('yesterday')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                !isToday
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100'
              }`}
            >
              Kemarin {hasYesterday ? '●' : ''}
            </button>
          </div>
        )}
      </div>

      {!history ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isToday
              ? 'Belum ada riwayat percakapan hari ini. Kirim pesan pada chatbot di bawah untuk mulai berdiskusi.'
              : 'Belum ada riwayat dari hari sebelumnya.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsExpanded((expanded) => !expanded)}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
              aria-expanded={isExpanded}
            >
              <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                <MessageCircle className="h-4 w-4" />
                {history.messageCount} pesan tersimpan
              </span>
              <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                {isExpanded ? 'Sembunyikan detail' : 'Lihat riwayat pesan & analisis'}
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {onDeleteDate && selectedDate && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
                title="Hapus histori tanggal ini"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus
              </button>
            )}
          </div>

          {isExpanded && history.messages.length > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-white/70 p-3 dark:border-amber-500/30 dark:bg-slate-950/70">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Pesan pada {history.date}
              </h5>
              {history.messages.map((message, index) => (
                <div
                  key={message.id || `${message.created_at}-${index}`}
                  className="rounded-md border border-slate-200 bg-white/60 p-2 dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium">{message.role === 'user' ? 'Anda' : 'TERANA AI'}</span>
                    <time dateTime={message.created_at}>
                      {new Date(message.created_at).toLocaleString('id-ID')}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                    {message.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Metrics Summary */}
          {history.metrics && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300">📊 Kondisi Perangkat</h5>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <MetricCard
                  label="Suhu"
                  value={`${history.metrics.temperature?.min}°C`}
                  unit={`max ${history.metrics.temperature?.max}°C`}
                  icon="🌡️"
                />
                <MetricCard
                  label="Kelembapan"
                  value={`${history.metrics.humidity?.min}%`}
                  unit={`max ${history.metrics.humidity?.max}%`}
                  icon="💧"
                />
                <MetricCard
                  label="Tanah"
                  value={`${history.metrics.soil_moisture?.min}%`}
                  unit={`max ${history.metrics.soil_moisture?.max}%`}
                  icon="🌱"
                />
                <MetricCard
                  label="Pesan"
                  value={history.messageCount.toString()}
                  unit="total"
                  icon="💬"
                />
              </div>
            </div>
          )}

          {/* Insights */}
          {history.insights && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Analisis AI</h5>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-950/30">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {history.insights.length > 300 ? `${history.insights.substring(0, 300)}...` : history.insights}
                </p>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {history.recommendations && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rekomendasi</h5>
              </div>
              <div className="space-y-1 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-500/30 dark:bg-green-950/30">
                {history.recommendations.split('\n').map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    {rec.trim().startsWith('1.') || rec.trim().startsWith('2.') || rec.trim().startsWith('3.') || rec.trim().startsWith('4.') ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{rec.replace(/^\d\.\s/, '')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary Text */}
          {history.summary && (
            <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {history.summary}
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  icon: string;
}

function MetricCard({ label, value, unit, icon }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-2xl">{icon}</div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-500">{unit}</p>
    </div>
  );
}
