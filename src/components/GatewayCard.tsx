import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Droplets, FlaskConical, Gauge, Radio, Waves, Wifi, WifiOff } from 'lucide-react';
import type { NodeSensorData } from '../hooks/useMultiNodeSensorData';
import { resetFlowCounter, type MqttActuatorSnapshot } from '../services/mqtt';

interface GatewayCardProps {
  data: NodeSensorData | null;
  actuatorSnapshot?: MqttActuatorSnapshot | null;
  isOnline?: boolean;
}

function formatVal(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '--';
  return Number(val).toFixed(decimals);
}

export function GatewayCard({ data, actuatorSnapshot, isOnline }: GatewayCardProps) {
  const [resettingCounter, setResettingCounter] = useState<'session' | 'total' | null>(null);
  const [resetFeedback, setResetFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Ambil nilai prioritas dari data sensor node 0 atau snapshot aktuator
  const ph = data?.ph ?? actuatorSnapshot?.ph ?? null;
  const flowRate = data?.flow_rate ?? actuatorSnapshot?.flowRate ?? 0;
  const sessionWater = data?.session_water ?? actuatorSnapshot?.currentLiters ?? 0;
  const totalWater = data?.total_water ?? actuatorSnapshot?.totalLiters ?? 0;
  const targetWater = actuatorSnapshot?.targetLiters ?? null;

  const isIrigasiActive = actuatorSnapshot?.irigasi === true || data?.valve_status === 'IRIGASI';
  const isFertigasiActive = actuatorSnapshot?.fertigasi === true || data?.valve_status === 'FERTIGASI';
  const isValveActive = isIrigasiActive || isFertigasiActive;
  const activeValveName = isIrigasiActive ? 'IRIGASI' : isFertigasiActive ? 'FERTIGASI' : 'IDLE';

  const mode = actuatorSnapshot?.mode ?? 'manual';
  const isWaterFlowing = flowRate > 0.05;
  const isValveOpenNoFlow = isValveActive && !isWaterFlowing;
  const resetDisabled = isOnline !== true || isValveActive || isWaterFlowing || resettingCounter !== null;

  // Analisis status pH
  let phCategory = {
    label: 'Menunggu Sensor',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400',
    advice: 'Sensor pH sedang membaca larutan atau tanah...',
    color: '#94a3b8'
  };

  if (ph !== null) {
    if (ph < 5.5) {
      phCategory = {
        label: 'Sangat Asam',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
        advice: '⚠️ Tanah sangat masam. Sangat disarankan fertigasi dolomit / bahan amelioran.',
        color: '#f43f5e'
      };
    } else if (ph < 6.0) {
      phCategory = {
        label: 'Agak Asam',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        advice: '⚠️ pH di bawah ambang ideal hortikultura (6.0 - 7.0). Fertigasi korektif diaktifkan.',
        color: '#f59e0b'
      };
    } else if (ph <= 7.2) {
      phCategory = {
        label: 'Ideal / Optimal',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        advice: '✅ pH optimal! Penyerapan unsur hara N-P-K dan mikronutrien berlangsung maksimal.',
        color: '#10b981'
      };
    } else {
      phCategory = {
        label: 'Basa (Alkali)',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
        advice: '⚠️ pH agak basa. Pantau ketersediaan unsur mikro besi (Fe) dan seng (Zn).',
        color: '#3b82f6'
      };
    }
  }

  // Persentase posisi jarum gauge pH (skala 0 - 14)
  const phPercent = ph !== null ? Math.min(100, Math.max(0, (ph / 14) * 100)) : 50;

  // Persentase progres volume sesi penyiraman
  const sessionPercent = (targetWater && targetWater > 0)
    ? Math.min(100, Math.max(0, (sessionWater / targetWater) * 100))
    : null;

  const handleResetCounter = async (counter: 'session' | 'total') => {
    const confirmation = counter === 'total'
      ? 'Reset total air kumulatif ke 0 L? Nilai ini tersimpan di ESP32 dan tidak dapat dipulihkan. Riwayat yang sudah tersimpan di web tidak dihapus.'
      : 'Reset volume sesi ke 0 L? Pastikan pompa/katup mati dan aliran sudah berhenti.';
    if (!window.confirm(confirmation)) return;

    setResettingCounter(counter);
    setResetFeedback(null);
    try {
      const result = await resetFlowCounter(counter);
      setResetFeedback({ tone: 'success', message: result.message });
    } catch (error) {
      setResetFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Reset volume gagal. Periksa koneksi MQTT dan ESP32.',
      });
    } finally {
      setResettingCounter(null);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 flex flex-col relative overflow-hidden border border-emerald-200/60 dark:border-slate-800 shadow-sm group">
      {/* Background Glow */}
      <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-1000 bg-emerald-500" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                STASIUN AKTUATOR & IRIGASI
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight truncate text-slate-900 dark:text-white">
              ESP32 Gateway
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Online/Offline Badge */}
          {isOnline !== undefined && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                  GATEWAY ONLINE
                </>
              ) : (
                <>
                  <WifiOff className="w-2.5 h-2.5 text-red-600 dark:text-red-400" />
                  GATEWAY OFFLINE
                </>
              )}
            </span>
          )}

          {/* Mode Badge */}
          <span className="rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300">
            MODE: {mode.toUpperCase()}
          </span>

          {/* Valve Status Badge */}
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold flex items-center gap-1.5 ${
              isIrigasiActive
                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 animate-pulse'
                : isFertigasiActive
                  ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 animate-pulse'
                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isValveActive ? 'bg-current animate-ping' : 'bg-slate-400'}`} />
            KATUP: {activeValveName}
          </span>
        </div>
      </div>

      {/* Grid Metrik Utama: Sensor pH & Sensor Waterflow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 relative z-10">
        {/* KARTU SENSOR pH */}
        <div className="rounded-2xl p-4 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Sensor pH Tanah / Larutan
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${phCategory.badgeClass}`}>
                {phCategory.label}
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {formatVal(ph, 2)}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                pH (0 - 14)
              </span>
            </div>

            {/* Visual pH Spectrum Scale */}
            <div className="mt-3 space-y-1">
              <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 via-emerald-500 via-cyan-400 to-blue-600">
                {/* Zona Ideal (pH 6.0 - 7.0) Highlight Box */}
                <div
                  className="absolute top-0 bottom-0 border-x-2 border-white dark:border-slate-900 bg-white/20"
                  style={{ left: `${(6.0 / 14) * 100}%`, width: `${(1.2 / 14) * 100}%` }}
                  title="Zona Ideal Hortikultura (6.0 - 7.2)"
                />
                {/* Indikator Posisi Jarum pH */}
                {ph !== null && (
                  <div
                    className="absolute -top-1 w-4 h-4 bg-white dark:bg-slate-900 rounded-full border-2 border-slate-900 dark:border-white shadow-md transform -translate-x-1/2 transition-all duration-500"
                    style={{ left: `${phPercent}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0 Asam</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">6.0-7.0 Ideal</span>
                <span>14 Basa</span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200/60 dark:border-slate-800/80 pt-2.5">
            {phCategory.advice}
          </p>
        </div>

        {/* KARTU SENSOR WATERFLOW */}
        <div className="rounded-2xl p-4 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isWaterFlowing ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                  <Gauge className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Sensor Water Flow (YF-S201)
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isWaterFlowing
                    ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 animate-pulse'
                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {isWaterFlowing ? '💧 Aliran Aktif' : 'Siaga'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${isWaterFlowing ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                {formatVal(flowRate, 2)}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Liter / Menit (Lpm)
              </span>
            </div>

            {/* Indikator Peringatan Aliran Nol Saat Valve Terbuka */}
            {isValveOpenNoFlow && (
              <div className="my-2 p-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Katup menyala namun aliran 0 L/min! Cek tandon air, daya pompa, atau kebuntuan pipa.</span>
              </div>
            )}

            {/* Metrik Volume: Sesi dan Total */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
              <div className="bg-white/80 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <Waves className="w-3 h-3 text-blue-500" />
                  <span>Sesi Ini</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatVal(sessionWater, 2)} <span className="text-xs font-normal text-slate-500">L</span>
                </div>
                {sessionPercent !== null && (
                  <div className="mt-1">
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${sessionPercent}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Target: {formatVal(targetWater, 2)} L ({sessionPercent.toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-white/80 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <Droplets className="w-3 h-3 text-emerald-500" />
                  <span>Total Kumulatif</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatVal(totalWater, 1)} <span className="text-xs font-normal text-slate-500">L</span>
                </div>
                <span className="text-[9px] text-slate-400">Penggunaan keseluruhan</span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleResetCounter('session')}
                  disabled={resetDisabled}
                  className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-400/30 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-500/10 dark:focus-visible:ring-offset-slate-900"
                >
                  {resettingCounter === 'session' ? 'Mereset sesi…' : 'Reset volume sesi'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetCounter('total')}
                  disabled={resetDisabled}
                  className="min-h-11 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400/30 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10 dark:focus-visible:ring-offset-slate-900"
                >
                  {resettingCounter === 'total' ? 'Mereset total…' : 'Reset total air'}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Reset tersedia saat gateway online, aktuator mati, dan aliran berhenti stabil selama 5 detik. Reset total tidak menghapus riwayat web.
              </p>
              {resetFeedback && (
                <p
                  role={resetFeedback.tone === 'error' ? 'alert' : 'status'}
                  aria-live={resetFeedback.tone === 'error' ? 'assertive' : 'polite'}
                  className={`text-xs ${resetFeedback.tone === 'error'
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-emerald-700 dark:text-emerald-300'}`}
                >
                  {resetFeedback.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info / Safety Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800/80 relative z-10">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Closed-Loop Metering: Penyiraman presisi dihentikan otomatis saat target liter tercapai.</span>
        </div>
        <div className="font-mono text-[11px]">
          Target Aktif: {targetWater && targetWater > 0 ? `${formatVal(targetWater, 2)} L` : 'Sesuai Kebutuhan'}
        </div>
      </div>
    </div>
  );
}
