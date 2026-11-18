import {
  Info,
  Cpu,
  Flame,
  Bell,
  Zap,
  BookOpen,
  Activity,
  Users,
  ShieldCheck,
  CloudSun,
  Droplets,
  Radio,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

function FeatureCard({
  title,
  description,
  badge,
  icon: Icon,
  badgeTone = 'green',
}: {
  title: string;
  description: string;
  badge?: string;
  icon: typeof Info;
  badgeTone?: 'green' | 'amber' | 'blue' | 'purple';
}) {
  const badgeColors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60',
  };

  const iconColors = {
    green: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/60',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800/60',
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-emerald-500/40 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/60 dark:hover:border-emerald-500/30">
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className={`rounded-xl border p-2.5 shadow-xs ${iconColors[badgeTone]}`}>
            <Icon size={20} />
          </div>
          {badge && (
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColors[badgeTone]}`}>
              {badge}
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {title}
        </h3>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {description}
        </p>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="space-y-6 pb-12">
      {/* Banner Utama */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 sm:p-8 text-white shadow-xl dark:border-emerald-500/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_40%)]"
        />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md mb-3">
              <Sparkles size={14} className="text-amber-300" />
              <span>Smart Agriculture & Peatland AIoT Ecosystem</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
              Tentang TeraNova
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-emerald-50/90 dark:text-emerald-100/90">
              Platform integrasi ekosistem AIoT terdepan yang menggabungkan presisi pertanian modern (Smart Agriculture) dan deteksi dini mitigasi kebakaran hutan lahan gambut (Karhutla) berbasis sensor multi-node, analitik data, dan kecerdasan buatan.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md text-xs space-y-1.5 shrink-0 w-full sm:w-auto">
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-200">Versi Sistem:</span>
              <span className="font-bold font-mono">v2.4.0 (2026)</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-200">Arsitektur:</span>
              <span className="font-bold">ESP32 + Multi ESP8266</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-200">Protokol:</span>
              <span className="font-bold">MQTT + Supabase REST</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Informasi Mengenal TeraNova & Arsitektur Sistem */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="rounded-xl border border-emerald-600/20 bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Info size={20} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Visi & Misi TeraNova
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            TeraNova dirancang untuk mengatasi dua tantangan besar sekaligus: efisiensi penyiraman & nutrisi tanaman hortikultura melalui otomasi presisi, serta perlindungan lahan gambut dari ancaman api bawah tanah (smoldering fire) yang sulit dideteksi secara visual.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              🌱 Smart Horticulture
            </span>
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
              🔥 Mitigasi Karhutla Gambut
            </span>
            <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300">
              💧 Presisi Efisiensi Air
            </span>
            <span className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300">
              🤖 AI Multi-Router Telemetri
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="rounded-xl border border-blue-600/20 bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
              <Cpu size={20} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Struktur Hardware & Jaringan
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-4">
            Sistem beroperasi dalam topologi jaringan terdistribusi yang tangguh:
          </p>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">• ESP32 Gateway:</span>
              <span>Koordinator pusat, kontrol pompa, flow rate sensor, dan relay aktuator.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">• Node 1 & 2 (Wemos D1):</span>
              <span>Monitoring mikroklimat tanaman (DHT22, Soil Moisture Kapasitif).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-amber-600 dark:text-amber-400">• Node 3 (Gambut & Karhutla):</span>
              <span>Sensor DS18B20 suhu bawah tanah gambut & skor FDRS BMKG real-time.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Profil Pengembang */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 sm:p-8 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-emerald-600/20 bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tim Pengembang</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Inovasi karya siswa berprestasi SMK Negeri 1 Semarang
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck size={14} /> Club Riset C.R.E.S.T
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 p-5 dark:border-slate-800/60 dark:bg-slate-800/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Lembaga</span>
            <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">Tim C.R.E.S.T</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">(Club Riset Elektronika Stemsa)</p>
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              SMK Negeri 1 Semarang
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Jawa Tengah, Indonesia</p>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 p-5 dark:border-slate-800/60 dark:bg-slate-800/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Guru Pembimbing</span>
            <h4 className="mt-1 text-base font-bold text-slate-900 dark:text-white">Rifqi Setiawan, S.Pd.</h4>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 p-5 dark:border-slate-800/60 dark:bg-slate-800/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Anggota Peneliti</span>
            <ul className="mt-2 space-y-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Habibullah Naja Alfatih Wibowo</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>Ishar Bayu Ibroni</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Grid 6 Fitur Utama */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 px-1">
          Kapabilitas & Fitur Utama Sistem
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            title="Multi-Node Telemetri"
            description="Monitoring data real-time suhu, kelembapan udara, kelembapan tanah, dan level baterai dari berbagai titik bedeng secara terdistribusi."
            icon={Activity}
            badge="Telemetry"
            badgeTone="green"
          />
          <FeatureCard
            title="Mitigasi Karhutla Gambut"
            description="Pemantauan suhu tanah gambut bawah permukaan (DS18B20) dan perhitungan indeks bahaya FDRS BMKG untuk deteksi dini smoldering fire."
            icon={Flame}
            badge="Khusus Node 3"
            badgeTone="amber"
          />
          <FeatureCard
            title="TeraNova AI Assistant"
            description="Asisten cerdas multi-provider (Gemini, OpenRouter, Groq) yang menganalisis langsung data Supabase untuk prediksi panen dan mitigasi kebakaran."
            icon={Sparkles}
            badge="AI Powered"
            badgeTone="purple"
          />
          <FeatureCard
            title="Kontrol Otomasi Irigasi"
            description="Eksekusi pompa air dan katup fertigasi secara otomatis atau manual jarak jauh dengan monitoring debit dan volume air tersiram."
            icon={Droplets}
            badge="Actuator"
            badgeTone="blue"
          />
          <FeatureCard
            title="Integrasi Prakiraan BMKG"
            description="Prakiraan cuaca spesifik lokasi dengan API BMKG untuk menyesuaikan jadwal penyiraman otomatis berdasarkan peluang hujan."
            icon={CloudSun}
            badge="Weather API"
            badgeTone="green"
          />
          <FeatureCard
            title="HiveMQ Broker & Realtime"
            description="Infrastruktur MQTT broker cloud berkecepatan tinggi dengan latensi rendah dan sinkronisasi otomatis ke database Supabase."
            icon={Radio}
            badge="MQTT Cloud"
            badgeTone="blue"
          />
        </div>
      </div>
    </div>
  );
}
