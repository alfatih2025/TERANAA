import { Thermometer, Flame, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { NodeSensorData } from '../hooks/useMultiNodeSensorData';
import { timeAgo } from '../lib/timeUtils';

interface Node3CardProps {
  data: NodeSensorData | null;
}

function formatOneDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(1);
}

function formatTwoDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(2);
}

export function Node3Card({ data }: Node3CardProps) {
  const soilTemp = data?.soil_temp;
  const fwiScore = data?.fwi;
  const fwiLevel = data?.fwi_level ?? 0;
  const fwiStatus = data?.fwi_status ?? (
    fwiLevel === 4 ? 'DARURAT' :
    fwiLevel === 3 ? 'SANGAT TINGGI' :
    fwiLevel === 2 ? 'TINGGI' :
    fwiLevel === 1 ? 'SEDANG' : 'RENDAH'
  );

  // Status visual berdasarkan tingkat bahaya BMKG & suhu tanah
  const isSmoldering = soilTemp !== null && soilTemp !== undefined && soilTemp >= 45.0;
  const isHotPeat = soilTemp !== null && soilTemp !== undefined && soilTemp >= 38.0;

  // Warna badge status BMKG FDRS
  const badgeColors: Record<number, { bg: string; text: string; border: string; glow: string }> = {
    0: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-800', glow: 'bg-blue-500' },
    1: { bg: 'bg-green-500/10 dark:bg-green-500/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-300 dark:border-green-800', glow: 'bg-green-500' },
    2: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-800', glow: 'bg-amber-500' },
    3: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-800', glow: 'bg-rose-500' },
    4: { bg: 'bg-purple-500/15 dark:bg-purple-500/25', text: 'text-purple-600 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-800', glow: 'bg-purple-500' },
  };

  const currentBadge = badgeColors[fwiLevel] || badgeColors[0];

  return (
    <div className="glass-card p-6 flex flex-col relative overflow-hidden group border border-slate-200 dark:border-slate-800">
      {/* Background Glow */}
      <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-1000 ${currentBadge.glow}`} />

      {/* Header Card */}
      <div className="flex justify-between items-start mb-6 relative z-10 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Wemos Node 3</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Gambut & Karhutla
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Murni Sensor Suhu Tanah DS18B20 & Fire Weather Index (FWI)
          </p>
        </div>

        {/* Badge Tingkat Bahaya BMKG */}
        <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 shadow-sm ${currentBadge.bg} ${currentBadge.text} ${currentBadge.border}`}>
          {fwiLevel >= 3 || isSmoldering ? (
            <Flame className="w-3.5 h-3.5 animate-pulse" />
          ) : fwiLevel >= 2 ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          <span>{fwiStatus}</span>
        </div>
      </div>

      {/* Grid Utama: Suhu Tanah & FWI Score */}
      <div className="grid grid-cols-2 gap-4 mb-5 relative z-10">
        {/* Suhu Tanah Gambut DS18B20 */}
        <div className={`rounded-2xl p-3 sm:p-4 border transition-all ${
          isSmoldering
            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60 shadow-sm'
            : isHotPeat
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60'
            : 'bg-slate-100 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800/50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className={`w-4 h-4 ${isSmoldering ? 'text-rose-600 animate-bounce' : isHotPeat ? 'text-amber-500' : 'text-emerald-500'}`} />
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              T.Tanah (DS18B20)
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl sm:text-3xl font-black ${
              isSmoldering ? 'text-rose-600 dark:text-rose-400' : isHotPeat ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
            }`}>
              {formatOneDecimal(soilTemp)}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">°C</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isSmoldering ? '🚨 Smoldering Heat!' : isHotPeat ? '⚠️ Suhu Menghangat' : '✓ Suhu Tanah Sejuk'}
          </div>
        </div>

        {/* Fire Weather Index (FWI Score BMKG) */}
        <div className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl p-3 sm:p-4 border border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className={`w-4 h-4 ${fwiLevel >= 2 ? 'text-rose-500' : 'text-blue-500'}`} />
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              Indeks FWI
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {formatTwoDecimal(fwiScore)}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">pts</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {fwiLevel >= 3 ? '🔴 Potensi Ekstrem' : fwiLevel >= 2 ? '🟡 Perlu Pemantauan' : '🔵 Risiko Terkendali'}
          </div>
        </div>
      </div>

      {/* Thermometer Gauge Bar Suhu Tanah Gambut */}
      <div className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50 relative z-10">
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Monitoring Termal Lahan Gambut
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Ambien: {formatOneDecimal(data?.temperature)}°C | {formatOneDecimal(data?.humidity)}% RH
          </span>
        </div>

        <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-out ${
              isSmoldering
                ? 'bg-gradient-to-r from-amber-500 to-rose-600'
                : 'bg-gradient-to-r from-blue-400 via-emerald-400 to-amber-500'
            }`}
            style={{ width: `${Math.min(Math.max(((soilTemp || 25) - 20) * 3.3, 5), 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-300 mt-1.5">
          <span>20°C (Aman)</span>
          <span>35°C (Hangat)</span>
          <span>50°C+ (Bara/Api)</span>
        </div>
      </div>

      {/* Footer Update Time */}
      <div className="mt-4 text-right text-xs text-slate-600 dark:text-slate-300 relative z-10 font-medium">
        {data?.created_at ? `Data terakhir: ${timeAgo(data.created_at)}` : 'Menunggu probe DS18B20...'}
      </div>
    </div>
  );
}
