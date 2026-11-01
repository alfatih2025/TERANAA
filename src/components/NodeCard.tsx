import { Thermometer, Droplets, Activity } from 'lucide-react';
import type { NodeSensorData } from '../hooks/useMultiNodeSensorData';
import { timeAgo } from '../lib/timeUtils';

interface NodeCardProps {
  nodeName: string;
  nodeId: 1 | 2;
  data: NodeSensorData | null;
}

function formatOneDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(1);
}

export function NodeCard({ nodeName, nodeId, data }: NodeCardProps) {
  const soilValue = data?.soil_moisture;

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 flex flex-col relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-1000 bg-blue-500" />
      
      <div className="flex justify-between items-center mb-4 sm:mb-6 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] text-green-700 dark:text-green-400">
              Node {String(nodeId).padStart(2, '0')}
            </p>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight truncate">{nodeName}</h2>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-300">
          SENSOR IoT
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-6 relative z-10">
        {/* Temperature */}
        <div className="bg-slate-100/80 dark:bg-slate-900/50 rounded-2xl p-3 sm:p-4 border border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Suhu</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">{formatOneDecimal(data?.temperature)}</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">°C</span>
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-slate-100/80 dark:bg-slate-900/50 rounded-2xl p-3 sm:p-4 border border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <Droplets className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Kelembapan</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">{formatOneDecimal(data?.humidity)}</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">%</span>
          </div>
        </div>
      </div>

      {/* Kelembapan Tanah */}
      <div className="bg-slate-100/80 dark:bg-slate-900/50 rounded-2xl p-3 sm:p-4 border border-slate-100 dark:border-slate-800/50 relative z-10">
        <div className="flex justify-between items-end mb-2 sm:mb-3">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-green-600 dark:text-green-400" />
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              Kelembapan Tanah
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {formatOneDecimal(soilValue)}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">%</span>
          </div>
        </div>

        <div className="h-2.5 sm:h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-blue-400 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(Math.max(soilValue || 0, 0), 100)}%` }}
          />
        </div>
      </div>
      
      {/* Last Update */}
      <div className="mt-3 sm:mt-4 text-right text-[10px] sm:text-xs text-slate-600 dark:text-slate-500 relative z-10 font-medium">
        {data?.created_at ? `Data terakhir: ${timeAgo(data.created_at)}` : 'Menunggu data...'}
      </div>
    </div>
  );
}
