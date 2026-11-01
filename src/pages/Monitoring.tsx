import { useState, useEffect, useRef } from 'react';
import { Activity, Flame } from 'lucide-react';
import { SensorChart } from '../components/SensorChart';
import type { NodeSensorData } from '../hooks/useMultiNodeSensorData';
import { subscribeMqttStatus, getNodeSensorSnapshot } from '../services/mqtt';

export function Monitoring() {
  const [activeNode, setActiveNode] = useState<number>(1);
  const [history, setHistory] = useState<NodeSensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const lastValueKeyRef = useRef<string>('');

  const fetchHistory = async (nodeId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sensor?node_id=${nodeId}&limit=60`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    lastValueKeyRef.current = '';
    fetchHistory(activeNode);
    const interval = setInterval(() => fetchHistory(activeNode), 15000);
    return () => clearInterval(interval);
  }, [activeNode]);

  // Real-time MQTT listener for chart history
  useEffect(() => {
    const unsubscribe = subscribeMqttStatus(() => {
      const snap = getNodeSensorSnapshot(activeNode);
      if (!snap) return;

      const valueKey = `${snap.temperature}|${snap.humidity}|${snap.soil_moisture}|${snap.soil_temp}|${snap.fwi}`;
      if (valueKey === lastValueKeyRef.current) return;
      lastValueKeyRef.current = valueKey;

      setHistory(prev => {
        if (prev.length > 0 && prev[0].created_at === snap.updatedAt) return prev;

        const newRow: NodeSensorData = {
          node_id: activeNode,
          temperature: snap.temperature,
          humidity: snap.humidity,
          soil_moisture: snap.soil_moisture,
          soil_temp: snap.soil_temp ?? null,
          fwi: snap.fwi ?? null,
          fwi_level: snap.fwi_level ?? null,
          fwi_status: snap.fwi_status ?? null,
          created_at: snap.updatedAt || new Date().toISOString()
        };

        return [newRow, ...prev].slice(0, 60);
      });
    });

    return () => {
      unsubscribe();
    };
  }, [activeNode]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-green-600 dark:text-blue-400" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Monitoring Real-time Multi-Node</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeNode === 3
                ? 'Monitoring khusus sektor lahan gambut & sistem prediksi bahaya karhutla (BMKG FDRS)'
                : 'Monitoring mikroklimat lahan pertanian hidroponik / bedeng'}
            </p>
          </div>
        </div>

        {/* Node Toggle: Node 1, Node 2, dan Node 3 Karhutla */}
        <div className="flex flex-wrap rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            onClick={() => setActiveNode(1)}
            className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all ${
              activeNode === 1
                ? 'bg-white text-green-600 shadow-sm dark:bg-slate-950 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Node 1
          </button>
          <button
            onClick={() => setActiveNode(2)}
            className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all ${
              activeNode === 2
                ? 'bg-white text-green-600 shadow-sm dark:bg-slate-950 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Node 2
          </button>
          <button
            onClick={() => setActiveNode(3)}
            className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeNode === 3
                ? 'bg-amber-600 text-white shadow-sm dark:bg-amber-500 dark:text-slate-950'
                : 'text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Node 3 (Karhutla Gambut)
          </button>
        </div>
      </div>

      {/* Grid Grafik Sensor */}
      {activeNode === 3 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <SensorChart
            data={history}
            type="soil_temp"
            title="Tren Suhu Tanah Gambut (DS18B20)"
            color="#ef4444"
          />
          <SensorChart
            data={history}
            type="soil_moisture"
            title="Tren Kadar Air Gambut (Capacitive)"
            color="#10b981"
          />
          <SensorChart
            data={history}
            type="fwi"
            title="Tren Indeks Bahaya Api (FWI BMKG)"
            color="#f59e0b"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <SensorChart data={history} type="temperature" title="Tren Suhu Udara" color="#10b981" />
          <SensorChart data={history} type="humidity" title="Tren Kelembapan Udara" color="#0ea5e9" />
          <SensorChart
            data={history}
            type="soil_moisture"
            title="Tren Kelembapan Tanah"
            color="#f59e0b"
          />
        </div>
      )}

      {/* Tabel Data History */}
      <div className="glass-card overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 p-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Riwayat Log Sensor (Node {activeNode})
            {activeNode === 3 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 font-bold border border-amber-300">
                Zona Lahan Gambut
              </span>
            )}
          </h3>
          <span className="text-xs text-slate-500">Maksimum 60 rekaman terakhir</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm">Waktu</th>
                <th className="px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm">Suhu Udara (°C)</th>
                <th className="px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm">Lembap Udara (%)</th>
                <th className="px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm">Kadar Air Gambut/Tanah (%)</th>
                {activeNode === 3 && (
                  <>
                    <th className="px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                      Suhu Gambut (°C)
                    </th>
                    <th className="px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                      FWI BMKG
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white light-card dark:bg-slate-950/50">
              {loading && history.length === 0 ? (
                <tr>
                  <td colSpan={activeNode === 3 ? 6 : 4} className="px-6 py-8 text-center text-slate-600 dark:text-slate-300">
                    Memuat data sensor...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={activeNode === 3 ? 6 : 4} className="px-6 py-8 text-center text-slate-600 dark:text-slate-300">
                    Belum ada data sensor tercatat untuk node ini
                  </td>
                </tr>
              ) : (
                history.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                    <td className="px-3 sm:px-6 py-2 sm:py-4 font-medium text-slate-900 dark:text-slate-200 text-xs sm:text-sm whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                      {row.temperature != null ? row.temperature.toFixed(1) : '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                      {row.humidity != null ? row.humidity.toFixed(1) : '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-slate-600 dark:text-slate-400 text-xs sm:text-sm font-semibold">
                      {row.soil_moisture != null ? row.soil_moisture.toFixed(1) : '-'}
                    </td>
                    {activeNode === 3 && (
                      <>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                          {row.soil_temp != null ? `${row.soil_temp.toFixed(1)} °C` : '-'}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400">
                          {row.fwi != null ? row.fwi.toFixed(1) : '-'}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
