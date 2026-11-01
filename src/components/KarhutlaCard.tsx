import { useState } from 'react';
import { Flame, Thermometer, Droplets, AlertTriangle, ShieldCheck, Info, ChevronDown, ChevronUp, Wind } from 'lucide-react';
import type { NodeSensorData } from '../hooks/useMultiNodeSensorData';
import { timeAgo } from '../lib/timeUtils';

interface KarhutlaCardProps {
  data: NodeSensorData | null;
  isOnline: boolean;
}

function formatOneDecimal(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '--';
  return Number(val).toFixed(1);
}

export function KarhutlaCard({ data, isOnline }: KarhutlaCardProps) {
  const [showFdrsDetails, setShowFdrsDetails] = useState(false);

  // Level BMKG: 0=Rendah, 1=Sedang, 2=Tinggi, 3=Sangat Tinggi, 4=Darurat
  const soilTemp = data?.soil_temp ?? null;
  const soilMoisture = data?.soil_moisture ?? null;
  const fwiScore = data?.fwi ?? 0;

  // Tentukan level bahaya BMKG (dengan override darurat jika suhu tanah >= 50°C)
  let level = data?.fwi_level ?? 0;
  if (soilTemp !== null && soilTemp >= 50.0) {
    level = 4;
  } else if (fwiScore > 32) {
    level = 3;
  } else if (fwiScore > 17) {
    level = 2;
  } else if (fwiScore > 8) {
    level = 1;
  } else {
    level = 0;
  }

  // Konfigurasi Level BMKG
  const levelConfig = [
    {
      label: 'RENDAH (AMAN)',
      statusText: 'Lahan gambut basah. Potensi kebakaran sangat kecil.',
      colorClass: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300 dark:border-blue-700',
      glowBg: 'bg-blue-500',
      progressColor: 'bg-blue-500',
      recommendation: 'Kondisi gambut aman dan lembap. Pertahankan tata kelola air dan sekat kanal alami.',
      severity: 'safe',
    },
    {
      label: 'SEDANG (WASPADA)',
      statusText: 'Api dapat tersulut namun penyebaran masih lambat.',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
      glowBg: 'bg-emerald-500',
      progressColor: 'bg-emerald-500',
      recommendation: 'Lakukan pemantauan berkala pada lapisan serasah permukaan dan hindari aktivitas pembakaran lahan.',
      severity: 'moderate',
    },
    {
      label: 'TINGGI (SIAGA)',
      statusText: 'Lahan gambut mengering. Api mudah tersulut dan menyebar.',
      colorClass: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300 dark:border-amber-700',
      glowBg: 'bg-amber-500',
      progressColor: 'bg-amber-500',
      recommendation: 'Siaga karhutla! Lakukan pembasahan berkala (rewetting) dan siagakan pompa air serta sekat kanal.',
      severity: 'warning',
    },
    {
      label: 'SANGAT TINGGI (BAHAYA EKSTREM)',
      statusText: 'Kondisi sangat kering! Api menyebar cepat dan sangat sulit dipadamkan.',
      colorClass: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border-rose-300 dark:border-rose-700',
      glowBg: 'bg-rose-500',
      progressColor: 'bg-rose-500',
      recommendation: 'PERINGATAN DARURAT: Aktifkan pompa pembasahan gambut intensif dan larang mutlak aktivitas api di sekitar lahan!',
      severity: 'danger',
    },
    {
      label: 'DARURAT (BARA BAWAH TANAH)',
      statusText: 'Suhu tanah kedalaman ≥ 50°C! Terdeteksi indikasi api/bara gambut aktif (smoldering fire).',
      colorClass: 'text-fuchsia-600 dark:text-fuchsia-400',
      badgeBg: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/60 dark:text-fuchsia-200 border-fuchsia-400 dark:border-fuchsia-600 animate-pulse',
      glowBg: 'bg-fuchsia-600',
      progressColor: 'bg-fuchsia-600',
      recommendation: 'TINDAKAN CEPAT: Terdeteksi panas ekstrem di bawah tanah! Lakukan injeksi air langsung ke lapisan gambut (peat injection).',
      severity: 'critical',
    },
  ];

  const currentLevel = levelConfig[Math.min(Math.max(level, 0), 4)];

  return (
    <div className="glass-card p-5 sm:p-6 flex flex-col relative overflow-hidden border border-slate-200 dark:border-slate-800 group shadow-md transition-all duration-300 hover:shadow-xl">
      {/* Background Glow dinamis sesuai level bahaya */}
      <div
        className={`absolute -right-24 -top-24 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-1000 ${currentLevel.glowBg}`}
      />

      {/* Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${level >= 2 ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'}`}>
            <Flame className={`w-6 h-6 ${level >= 3 ? 'animate-bounce text-rose-500' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Node 3: Pencegahan Karhutla Gambut
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Sistem Peringatan Dini FDRS BMKG (Fire Weather Index)
            </p>
          </div>
        </div>

        {/* Status Online Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {isOnline ? 'Sensor Aktif' : 'Menunggu Sinyal'}
          </span>
        </div>
      </div>

      {/* Banner Utama Status FWI BMKG */}
      <div className="mb-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tingkat Bahaya Karhutla (BMKG):
            </span>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-black uppercase border ${currentLevel.badgeBg}`}>
            {currentLevel.label}
          </span>
        </div>

        <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {currentLevel.statusText}
        </p>

        {/* FWI Score Bar */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1 font-semibold">
            <span className="text-slate-500 dark:text-slate-400">Skor FWI: <strong className={currentLevel.colorClass}>{formatOneDecimal(fwiScore)}</strong></span>
            <span className="text-slate-500 dark:text-slate-400">Skala BMKG: 0 - 50+</span>
          </div>
          <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
            {/* Step 1: Rendah (0-8) */}
            <div className="h-full bg-blue-500" style={{ width: '16%' }} title="Rendah: 0-8" />
            {/* Step 2: Sedang (9-17) */}
            <div className="h-full bg-emerald-500" style={{ width: '18%' }} title="Sedang: 9-17" />
            {/* Step 3: Tinggi (18-32) */}
            <div className="h-full bg-amber-500" style={{ width: '30%' }} title="Tinggi: 18-32" />
            {/* Step 4: Sangat Tinggi (>32) */}
            <div className="h-full bg-rose-500" style={{ width: '36%' }} title="Sangat Tinggi: >32" />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 px-0.5">
            <span>🔵 0 Rendah</span>
            <span>🟢 9 Sedang</span>
            <span>🟡 18 Tinggi</span>
            <span>🔴 32+ Sangat Tinggi</span>
          </div>
        </div>
      </div>

      {/* Grid 4 Sensor Utama */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 relative z-10">
        {/* 1. Suhu Tanah Gambut (DS18B20) */}
        <div className={`rounded-2xl p-3.5 border transition-all ${
          soilTemp !== null && soilTemp >= 50
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700'
            : soilTemp !== null && soilTemp >= 40
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/60'
        }`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Thermometer className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Suhu Gambut</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatOneDecimal(soilTemp)}
            </span>
            <span className="text-xs font-semibold text-slate-500">°C</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">DS18B20 (Bawah Tanah)</span>
        </div>

        {/* 2. Kadar Air Tanah Gambut (Capacitive) */}
        <div className={`rounded-2xl p-3.5 border transition-all ${
          soilMoisture !== null && soilMoisture < 30
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700'
            : soilMoisture !== null && soilMoisture < 50
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/60'
        }`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Droplets className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Kadar Air Gambut</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatOneDecimal(soilMoisture)}
            </span>
            <span className="text-xs font-semibold text-slate-500">%</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {soilMoisture !== null && soilMoisture < 30 ? '⚠️ Kering Kritis' : 'Kapasitif v1.2'}
          </span>
        </div>

        {/* 3. Suhu Udara Mikro (DHT22) */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800/60">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Thermometer className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Suhu Udara</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatOneDecimal(data?.temperature)}
            </span>
            <span className="text-xs font-semibold text-slate-500">°C</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">DHT22 (Mikroklimat)</span>
        </div>

        {/* 4. Kelembaban Udara (DHT22) */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800/60">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Droplets className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Lembap Udara</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatOneDecimal(data?.humidity)}
            </span>
            <span className="text-xs font-semibold text-slate-500">%</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Laju Evaporasi</span>
        </div>
      </div>

      {/* Rekomendasi Tindakan / Pencegahan */}
      <div className={`p-3.5 rounded-2xl border mb-4 relative z-10 flex items-start gap-3 ${
        level >= 3
          ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-200'
          : level === 2
          ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200'
          : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-200'
      }`}>
        {level >= 2 ? (
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
        )}
        <div className="text-xs sm:text-sm font-medium">
          <strong>Rekomendasi Pencegahan: </strong>
          {currentLevel.recommendation}
        </div>
      </div>

      {/* Accordion Detail 6 Parameter FDRS BMKG */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden relative z-10">
        <button
          onClick={() => setShowFdrsDetails(!showFdrsDetails)}
          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/70 hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            Detail 6 Komponen Indeks BMKG FDRS
          </span>
          {showFdrsDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFdrsDetails && (
          <div className="p-4 bg-white dark:bg-slate-950/60 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <span className="text-slate-500 font-medium block">FFMC (Bahan Bakar Halus):</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formatOneDecimal(data?.ffmc)}</span>
                <span className="text-[10px] text-slate-400 block">Kekeringan serasah</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <span className="text-slate-500 font-medium block">DMC (Lapisan Sedang):</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formatOneDecimal(data?.dmc)}</span>
                <span className="text-[10px] text-slate-400 block">Kadar air gambut atas</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <span className="text-slate-500 font-medium block">DC (Kekeringan Dalam):</span>
                <span className="text-sm font-black text-rose-600 dark:text-rose-400">{formatOneDecimal(data?.dc)}</span>
                <span className="text-[10px] text-slate-400 block">★ Kritis Lahan Gambut</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <span className="text-slate-500 font-medium block">ISI (Penyebaran Api):</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formatOneDecimal(data?.isi)}</span>
                <span className="text-[10px] text-slate-400 block">Laju kecepatan awal</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <span className="text-slate-500 font-medium block">BUI (Akumulasi Bahan):</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formatOneDecimal(data?.bui)}</span>
                <span className="text-[10px] text-slate-400 block">Total bahan kering</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <span className="text-slate-500 font-medium block">FWI (Indeks Akhir):</span>
                <span className={`text-sm font-black ${currentLevel.colorClass}`}>{formatOneDecimal(fwiScore)}</span>
                <span className="text-[10px] text-slate-400 block">Tingkat bahaya api</span>
              </div>
            </div>
            <p className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              * Perhitungan menggunakan model Van Wagner 1987 yang diadopsi resmi oleh BMKG pada sistem SPARTAN. Khusus lahan gambut, nilai DC (Drought Code) dikoreksi langsung oleh data sensor kelembaban kapasitif dan probe suhu kedalaman DS18B20.
            </p>
          </div>
        )}
      </div>

      {/* Footer Timestamp */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 relative z-10 font-medium">
        <span>Lokasi: Lahan Gambut / Sektor Pencegahan Api</span>
        <span>
          {data?.created_at ? `Data: ${timeAgo(data.created_at)}` : 'Menunggu data sensor...'}
        </span>
      </div>
    </div>
  );
}
