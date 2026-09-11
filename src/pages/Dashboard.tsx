import { MessageSquare, Network } from 'lucide-react';
import { ChatInterface } from '../components/ChatInterface';
import { NodeCard } from '../components/NodeCard';
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
  const { node1, node2, loading } = useMultiNodeSensorData();
  const { espOnline, mqttConnected } = useMqttStatus();

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
  
  const nodesOnline = [isNode1Online, isNode2Online].filter(Boolean).length;

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
              Platform smart agriculture berbasis AIoT.
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
                <div className={`w-2 h-2 rounded-full ${nodesOnline > 0 ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500'}`}></div>
                <span className="font-semibold text-green-700 dark:text-green-400 text-xs sm:text-sm">{nodesOnline}/2 Nodes Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

            {/* Node Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NodeCard 
          nodeName="Wemos Node 1" 
          nodeId={1}
          data={node1}
        />
        <NodeCard 
          nodeName="Wemos Node 2" 
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
                <th className="py-2 sm:py-3 px-2 sm:px-4 font-bold text-green-600 dark:text-green-400">Node 1</th>
                <th className="py-2 sm:py-3 px-2 sm:px-4 font-bold text-blue-600 dark:text-blue-400">Node 2</th>
                <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-slate-600 dark:text-slate-400">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              <tr className="hover:bg-slate-100 dark:hover:bg-slate-800/20 transition-colors">
                <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">Suhu</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node1?.temperature?.toFixed(1) || '--'} °C</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node2?.temperature?.toFixed(1) || '--'} °C</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 dark:text-slate-300">
                  {node1?.temperature && node2?.temperature ? Math.abs(node1.temperature - node2.temperature).toFixed(1) + ' °C' : '--'}
                </td>
              </tr>
              <tr className="hover:bg-slate-100 dark:hover:bg-slate-800/20 transition-colors">
                <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">Kelembapan</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node1?.humidity?.toFixed(1) || '--'} %</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node2?.humidity?.toFixed(1) || '--'} %</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 dark:text-slate-300">
                  {node1?.humidity && node2?.humidity ? Math.abs(node1.humidity - node2.humidity).toFixed(1) + ' %' : '--'}
                </td>
              </tr>
              <tr className="hover:bg-slate-100 dark:hover:bg-slate-800/20 transition-colors">
                <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">Tanah</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node1?.soil_moisture?.toFixed(1) || '--'} %</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4">{node2?.soil_moisture?.toFixed(1) || '--'} %</td>
                <td className="py-2 sm:py-3 px-2 sm:px-4 text-slate-600 dark:text-slate-300">
                  {node1?.soil_moisture && node2?.soil_moisture ? Math.abs(node1.soil_moisture - node2.soil_moisture).toFixed(1) + ' %' : '--'}
                </td>
              </tr>
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
            <p className="text-xs text-slate-600 dark:text-slate-400">Tanya analisis sensor, cuaca, dan saran perawatan.</p>
          </div>
        </div>
        <ChatInterface variant="compact" sensorData={sensorData} settings={settings} weatherData={weatherData} />
      </div>
    </div>
  );
}
