import { useState, useEffect } from 'react';
import { MessageSquare, Network, Flame, ShieldAlert } from 'lucide-react';
import { ChatInterface } from '../components/ChatInterface';
import { NodeCard } from '../components/NodeCard';
import { KarhutlaCard } from '../components/KarhutlaCard';
import { useMultiNodeSensorData } from '../hooks/useMultiNodeSensorData';
import { SensorData } from '../hooks/useSensorData';
import { Settings } from '../hooks/useSettings';
import { WeatherData } from '../hooks/useWeather';
import { useMqttStatus } from '../hooks/useMqttStatus';

interface DashboardProps {
  sensorData: SensorData | null;
  settings: Settings | null;
  weatherData?: WeatherData | null;
}

export function Dashboard({ sensorData, settings, weatherData }: DashboardProps) {
  const { node1, node2, node3, loading, isNode3Active } = useMultiNodeSensorData();
  const { espOnline, mqttConnected } = useMqttStatus();

  // Mode implementasi Karhutla: Aktif otomatis jika Node 3 mengirim data, atau diaktifkan manual oleh user
  const [karhutlaEnabled, setKarhutlaEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('terana_karhutla_mode');
      if (saved !== null) return saved === 'true';
    }
    return false;
  });

  // Jika Node 3 mengirim data riil secara otomatis aktifkan mode karhutla
  useEffect(() => {
    if (isNode3Active && !karhutlaEnabled) {
      setKarhutlaEnabled(true);
      localStorage.setItem('terana_karhutla_mode', 'true');
    }
  }, [isNode3Active, karhutlaEnabled]);

  const toggleKarhutlaMode = () => {
    const next = !karhutlaEnabled;
    setKarhutlaEnabled(next);
    localStorage.setItem('terana_karhutla_mode', String(next));
  };

  const isNode1Online = Boolean(
    node1 &&
      (node1.temperature !== null || node1.humidity !== null || node1.soil_moisture !== null) &&
      (!node1.created_at || new Date().getTime() - new Date(node1.created_at).getTime() < 15 * 60 * 1000)
  );
  const isNode2Online = Boolean(
    node2 &&
      (node2.temperature !== null || node2.humidity !== null || node2.soil_moisture !== null) &&
      (!node2.created_at || new Date().getTime() - new Date(node2.created_at).getTime() < 15 * 60 * 1000)
  );
  const isNode3Online = Boolean(
    node3 &&
      (node3.temperature !== null || node3.humidity !== null || node3.soil_moisture !== null || node3.soil_temp !== null || node3.fwi !== null) &&
      (!node3.created_at || new Date().getTime() - new Date(node3.created_at).getTime() < 15 * 60 * 1000)
  );

  const activeNodesCount = [isNode1Online, isNode2Online, karhutlaEnabled ? isNode3Online : false].filter(Boolean).length;
  const totalConfiguredNodes = karhutlaEnabled ? 3 : 2;

  return (
    <div className="space-y-6 pb-8">
      {/* Hero / Network Status */}
      <div className="glass-card overflow-hidden border-0 bg-gradient-to-br from-green-50 to-emerald-100/50 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-white relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 dark:opacity-10"></div>
        <div className="relative p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-white font-black tracking-tight mb-2 flex items-center gap-2">
              <Network className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span>TERANA (Terrain Intelligent Systems)</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm md:text-base max-w-xl">
              Platform smart agriculture & mitigasi bencana lahan gambut berbasis AIoT.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 bg-white/60 dark:bg-slate-950/50 p-3 sm:p-4 rounded-2xl border border-white/40 dark:border-white/10 backdrop-blur-md shadow-sm dark:shadow-none w-full sm:w-auto">
            <div className="text-xs sm:text-sm text-slate-600 font-medium dark:text-slate-300">Status Jaringan</div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${mqttConnected ? 'bg-blue-500 dark:bg-blue-400' : 'bg-red-500'}`}></div>
                <span className="font-semibold text-slate-700 dark:text-slate-100 text-xs sm:text-sm">{mqttConnected ? 'Broker OK' : 'Broker Disconnected'}</span>
              </div>
              <div className="w-px h-4 bg-slate-300 dark:bg-slate-700"></div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${activeNodesCount > 0 ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500'}`}></div>
                <span className="font-semibold text-green-700 dark:text-green-400 text-xs sm:text-sm">{activeNodesCount}/{totalConfiguredNodes} Nodes Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kontrol Zona Pantau Gambut / Karhutla */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Modul Sensor Node 3: Mitigasi Karhutla Lahan Gambut
              {isNode3Online && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300">
                  ONLINE
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {karhutlaEnabled
                ? 'Zona pantau karhutla diaktifkan. Memantau suhu tanah DS18B20 & indeks bahaya BMKG FDRS.'
                : 'Sensor Node 3 standby untuk implementasi di lahan gambut atau lahan rawan terbakar.'}
            </p>
          </div>
        </div>
        <button
          onClick={toggleKarhutlaMode}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
            karhutlaEnabled
              ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-500/20'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          {karhutlaEnabled ? 'Matikan Zona' : 'Aktifkan Zona'}
        </button>
      </div>

      {/* Monitoring Card Khusus Karhutla (Jika diaktifkan atau sensor Node 3 aktif) */}
      {karhutlaEnabled && (
        <div className="space-y-2">
          <KarhutlaCard data={node3} isOnline={isNode3Online} />
        </div>
      )}

      {/* Node Cards Pertanian (Node 1 & Node 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NodeCard 
          nodeName="Wemos Node 1"
          nodeId={1}
          data={node1}
        />
        <NodeCard 
          nodeName="Wemos Node 2)"
          nodeId={2}
          data={node2}
        />
      </div>

      {/* Comparison Panel */}
      <div className="glass-card p-4 sm:p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
          <Network className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
          Perbandingan Node
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-slate-600 dark:text-slate-400">Parameter</th>
                <th className="py-2 sm:py-3 px-2 sm:px-4 font-bold text-green-600 dark:text-green-400">Node 1 (Bedeng A)</th>
                <th className="py-2 sm:py-3 px-2 sm:px-4 font-bold text-blue-600 dark:text-blue-400">Node 2 (Bedeng B)</th>
                {karhutlaEnabled && (
                  <th className="py-2 sm:py-3 px-2 sm:px-4 font-bold text-amber-600 dark:text-amber-400">Node 3 (Gambut)</th>
                )}
                <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-slate-600 dark:text-slate-400">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              <tr className="hover:bg-slate-100 dark:hover:bg-slate-800/20 transition-colors">
                <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">Suhu Udara</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node1?.temperature?.toFixed(1) || '--'} °C</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node2?.temperature?.toFixed(1) || '--'} °C</td>
                {karhutlaEnabled && (
                  <td className="py-2 sm:py-3 px-2 sm:px-4">{node3?.temperature?.toFixed(1) || '--'} °C</td>
                )}
                <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 dark:text-slate-300">
                  {node1?.temperature && node2?.temperature ? 'ΔN1-N2: ' + Math.abs(node1.temperature - node2.temperature).toFixed(1) + ' °C' : '--'}
                </td>
              </tr>
              <tr className="hover:bg-slate-100 dark:hover:bg-slate-800/20 transition-colors">
                <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">Lembap Udara</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node1?.humidity?.toFixed(1) || '--'} %</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node2?.humidity?.toFixed(1) || '--'} %</td>
                {karhutlaEnabled && (
                  <td className="py-2 sm:py-3 px-2 sm:px-4">{node3?.humidity?.toFixed(1) || '--'} %</td>
                )}
                <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 dark:text-slate-300">
                  {node1?.humidity && node2?.humidity ? 'ΔN1-N2: ' + Math.abs(node1.humidity - node2.humidity).toFixed(1) + ' %' : '--'}
                </td>
              </tr>
              <tr className="hover:bg-slate-100 dark:hover:bg-slate-800/20 transition-colors">
                <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">Kadar Air Tanah</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node1?.soil_moisture?.toFixed(1) || '--'} %</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node2?.soil_moisture?.toFixed(1) || '--'} %</td>
                {karhutlaEnabled && (
                  <td className="py-2 sm:py-3 px-2 sm:px-4 font-bold text-amber-600 dark:text-amber-400">
                    {node3?.soil_moisture?.toFixed(1) || '--'} %
                  </td>
                )}
                <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 dark:text-slate-300">
                  {karhutlaEnabled && node3?.soil_moisture !== undefined && node3?.soil_moisture !== null
                    ? (node3.soil_moisture < 30 ? '⚠️ Gambut Kritis' : 'Normal')
                    : '--'}
                </td>
              </tr>
              {karhutlaEnabled && (
                <tr className="hover:bg-slate-100 dark:hover:bg-slate-800/20 transition-colors bg-amber-50/40 dark:bg-amber-950/20">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 font-bold text-amber-700 dark:text-amber-400">Suhu Tanah (Bawah Permukaan)</td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-400">N/A</td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-400">N/A</td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 font-black text-rose-600 dark:text-rose-400">
                    {node3?.soil_temp ? `${node3.soil_temp.toFixed(1)} °C` : '--'}
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {node3?.soil_temp && node3.soil_temp >= 50 ? '🚨 SMOLDERING ACTIVE' : 'Sensor DS18B20'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Chat */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Chat</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Tanya analisis sensor, prediksi karhutla, cuaca, dan rekomendasi perawatan.</p>
          </div>
        </div>
        <ChatInterface variant="compact" sensorData={sensorData} settings={settings} weatherData={weatherData} />
      </div>
    </div>
  );
}
