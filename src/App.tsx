import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar, type PageId } from './components/Sidebar';
import { Header } from './components/Header';
const Dashboard = lazy(() => import('./pages/Dashboard').then(({ Dashboard }) => ({ default: Dashboard })));
const Monitoring = lazy(() => import('./pages/Monitoring').then(({ Monitoring }) => ({ default: Monitoring })));
const ChatPage = lazy(() => import('./pages/ChatPage').then(({ ChatPage }) => ({ default: ChatPage })));
const ControlPage = lazy(() => import('./pages/ControlPage').then(({ ControlPage }) => ({ default: ControlPage })));
const SimulationPage = lazy(() => import('./pages/SimulationPage').then(({ SimulationPage }) => ({ default: SimulationPage })));
const WeatherPage = lazy(() => import('./pages/WeatherPage').then(({ WeatherPage }) => ({ default: WeatherPage })));
const LogsPage = lazy(() => import('./pages/LogsPage').then(({ LogsPage }) => ({ default: LogsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(({ SettingsPage }) => ({ default: SettingsPage })));
const AiRouterPage = lazy(() => import('./pages/AiRouterPage').then(({ AiRouterPage }) => ({ default: AiRouterPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then(({ AboutPage }) => ({ default: AboutPage })));
import { useMultiNodeSensorData } from './hooks/useMultiNodeSensorData';
import { getNodeSensorSnapshot } from './services/mqtt';

import { useWeather } from './hooks/useWeather';
import { useSettings } from './hooks/useSettings';
import { useAlerts } from './hooks/useAlerts';
import { useMqttStatus } from './hooks/useMqttStatus';
import { getPlantHealthSummary } from './lib/plantPhase';
import { recordActivity } from './lib/activityLog';
const LoginPage = lazy(() => import('./pages/LoginPage').then(({ LoginPage }) => ({ default: LoginPage })));
import { useAuth } from './hooks/useAuthContext';

function PageLoadingFallback() {
  return (
    <div className="space-y-6 p-1">
      <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="glass-card space-y-4 p-5">
            <div className="skeleton-shimmer h-4 w-24 rounded-md" />
            <div className="skeleton-shimmer h-8 w-32 rounded-lg" />
            <div className="skeleton-shimmer h-3 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

const RAIN_PUBLISH_INTERVAL_MS = 3 * 60 * 60 * 1000;

function resolvePageFromPath(pathname: string) {
  const normalized = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  switch (normalized) {
    case 'login': return 'login';
    case 'dashboard':
    case 'monitoring':
    case 'chat':
    case 'control':
    case 'simulation':
    case 'weather':
    case 'logs':
    case 'settings':
    case 'airouter':
    case 'about':
      return normalized;
    default:
      return 'dashboard';
  }
}

function App() {
  const { currentUser, loading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    return resolvePageFromPath(window.location.pathname) as PageId;
  });
  const activePage = currentUser && currentPage === 'login' ? 'dashboard' : currentPage;

  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const { data: weatherData } = useWeather(settingsLoading ? null : settings?.location);
  const { createAlert } = useAlerts();

  const mqttStatus = useMqttStatus();
  const lastAlertSignatureRef = useRef<string>('');

  useEffect(() => {
    import('./services/mqtt')
      .then(({ getMqttClient }) => getMqttClient())
      .catch((error: unknown) => {
        console.error('Gagal memulai koneksi MQTT:', error);
      });
  }, []);

  useEffect(() => {
    const pageName =
      activePage === 'dashboard'
        ? 'Dashboard'
        : activePage === 'monitoring'
          ? 'Monitoring'
          : activePage === 'chat'
            ? 'AI Chat'
            : activePage === 'control'
              ? 'Control'
              : activePage === 'simulation'
                ? 'Simulasi'
              : activePage === 'weather'
                ? 'Cuaca'
                : activePage === 'logs'
                  ? 'Log & Analitik'
                  : activePage === 'settings'
                    ? 'Setting'
                    : activePage === 'airouter'
                      ? 'AI Config'
                      : activePage === 'login'
                        ? 'Login'
                        : 'About';

    recordActivity({
      source: 'navigation',
      type: 'page_view',
      title: `Membuka halaman ${pageName}`,
      message: `Membuka halaman ${pageName}`,
      details: {
        page: activePage,
        title: pageName,
      },
    });
  }, [activePage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = activePage === 'dashboard' ? '/' : `/${activePage}`;
    if (window.location.pathname !== path) {
      window.history.replaceState(null, '', path);
    }
  }, [activePage]);
  const { node1, node2, node3, gateway, loading: sensorLoading } = useMultiNodeSensorData();
  
  const liveSensorData = useMemo(() => {
    if (!node1 && !node2 && !node3 && !gateway) return null;
    
    const gatewaySnap = getNodeSensorSnapshot(0);

    return {
      node_id: node1?.node_id ?? node2?.node_id ?? node3?.node_id ?? 1,
      device_id: 'ESP32_001',
      temperature: node1?.temperature ?? node2?.temperature ?? node3?.temperature ?? null,
      humidity: node1?.humidity ?? node2?.humidity ?? node3?.humidity ?? null,
      soil_moisture: node1?.soil_moisture ?? node2?.soil_moisture ?? null,
      soil_temp: node3?.soil_temp ?? null,
      fwi: node3?.fwi ?? null,
      fwi_status: node3?.fwi_status ?? null,
      ph: gateway?.ph ?? gatewaySnap?.ph ?? null,
      flow_rate: gateway?.flow_rate ?? gatewaySnap?.flow_rate ?? null,
      total_water: gateway?.total_water ?? gatewaySnap?.total_water ?? null,
      valve_status: gateway?.valve_status ?? gatewaySnap?.valve_status ?? null,
      node1: node1 ? { temp: node1.temperature, hum: node1.humidity, soil: node1.soil_moisture } : null,
      node2: node2 ? { temp: node2.temperature, hum: node2.humidity, soil: node2.soil_moisture } : null,
      node3: node3 ? { soil_temp: node3.soil_temp, temp: node3.temperature, hum: node3.humidity, fwi: node3.fwi, fwi_status: node3.fwi_status } : null,
      gateway: (gateway || gatewaySnap) ? {
        ph: gateway?.ph ?? gatewaySnap?.ph ?? null,
        flow_rate: gateway?.flow_rate ?? gatewaySnap?.flow_rate ?? null,
        total_water: gateway?.total_water ?? gatewaySnap?.total_water ?? null,
        valve_status: gateway?.valve_status ?? gatewaySnap?.valve_status ?? null
      } : null,
      created_at: node1?.created_at ?? node2?.created_at ?? node3?.created_at ?? new Date().toISOString(),
    };
  }, [node1, node2, node3, gateway]);

  const health = useMemo(() => {
    if (!settings) return null;
    return getPlantHealthSummary({
      phase: settings.plant_phase,
      soilMoisture: liveSensorData?.soil_moisture,
      temperature: liveSensorData?.temperature,
      weatherLabel: weatherData?.current.weather,
      rainChance: weatherData?.current.rain_chance,
      soilLow: settings.soil_threshold_low,
      soilHigh: settings.soil_threshold_high,
      soilCritical: settings.soil_threshold_critical,
      tempLow: settings.temp_threshold_low,
      tempHigh: settings.temp_threshold_high,
    });
  }, [settings, liveSensorData, weatherData]);

  useEffect(() => {
    const checkThresholds = async () => {
      if (!liveSensorData || !settings || !health) return;

      const alerts = health.alerts.filter((item) => item.severity !== 'info' || item.type !== 'phase');
      const signature = alerts.map((item) => item.key).join('|');
      if (!signature) {
        lastAlertSignatureRef.current = '';
        return;
      }

      if (signature === lastAlertSignatureRef.current) return;
      lastAlertSignatureRef.current = signature;

      for (const item of alerts) {
        await createAlert(item.type, item.message, item.severity, {
          sendEmail: false,
          metadata: item.metadata,
        });
      }
    };

    checkThresholds();
  }, [liveSensorData, settings, health, createAlert]);

  useEffect(() => {
    const handleSensorFault = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { device, isFault } = customEvent.detail;
      if (isFault) {
        const sensorName = device === 'DHT22' ? 'Suhu & Kelembapan (DHT22)' : 'Kelembapan Tanah (Soil)';
        createAlert(
          'sensor_fault',
          `⚠️ Sensor ${sensorName} tidak terdeteksi atau rusak! Periksa koneksi sensor.`,
          'danger'
        );
      }
    };
    
    window.addEventListener('nexagrow:sensor_fault', handleSensorFault);
    return () => window.removeEventListener('nexagrow:sensor_fault', handleSensorFault);
  }, [createAlert]);

  // ============================================================
  // AUTO-PUBLISH RAIN CHANCE KE ESP32 (setiap 3 jam)
  // ============================================================
  const lastRainPublishRef = useRef<number>(0);
  const lastRainValueRef = useRef<number | null>(null);
  const rainChance = weatherData?.current?.rain_chance;

  useEffect(() => {
    if (rainChance == null) return;

    const now = Date.now();
    const lastPublish = lastRainPublishRef.current;
    const lastValue = lastRainValueRef.current;

    // Publish jika: pertama kali, nilai berubah, atau sudah 3 jam
    const shouldPublish =
      lastPublish === 0 ||
      (rainChance !== lastValue) ||
      (now - lastPublish >= RAIN_PUBLISH_INTERVAL_MS);

    if (shouldPublish) {
      lastRainPublishRef.current = now;
      lastRainValueRef.current = rainChance;
      import('./services/mqtt')
        .then(({ publishRainChance }) => publishRainChance(rainChance))
        .catch((error: unknown) => {
          console.error('Gagal mengirim prakiraan hujan ke ESP32:', error);
        });
    }
  }, [rainChance]);

  const renderPage = () => {
    switch (activePage) {
      case 'login':
        return <LoginPage />;
      case 'dashboard':
        return (
          <Dashboard
            sensorData={liveSensorData}
            settings={settings}
            weatherData={weatherData}
          />
        );
      case 'monitoring':
        return <Monitoring />;
      case 'chat':
        return (
          <ChatPage
            sensorData={liveSensorData}
            settings={settings}
            weatherData={weatherData}
          />
        );
      case 'control':
        return <ControlPage />;
      case 'simulation':
        return <SimulationPage />;
      case 'weather':
        return <WeatherPage locationCode={settings?.location} settings={settings} updateSettings={updateSettings} />;
      case 'logs':
        return <LogsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'airouter':
        return <AiRouterPage />;
      case 'about':
        return <AboutPage />;
      default:
        return (
          <Dashboard
            sensorData={liveSensorData}
            settings={settings}
            weatherData={weatherData}
          />
        );
    }
  };

  // Tampilkan skeleton shimmer jika Auth masih diproses (tanpa spinner/teks memuat)
  if (authLoading) {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="skeleton-shimmer h-7 w-36 rounded-lg" />
              <div className="skeleton-shimmer h-4 w-52 rounded-md" />
            </div>
            <div className="skeleton-shimmer h-9 w-28 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="glass-card space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <div className="skeleton-shimmer h-4 w-24 rounded-md" />
                  <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
                </div>
                <div className="skeleton-shimmer h-9 w-32 rounded-lg" />
                <div className="skeleton-shimmer h-3 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (sensorLoading && !liveSensorData && activePage !== 'login') {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TeraNova</h2>
              <div className="skeleton-shimmer h-4 w-44 rounded-md" />
            </div>
            <div className="skeleton-shimmer h-9 w-28 rounded-xl" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="glass-card space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <div className="skeleton-shimmer h-4 w-24 rounded-md" />
                  <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
                </div>
                <div className="skeleton-shimmer h-9 w-32 rounded-lg" />
                <div className="skeleton-shimmer h-3 w-20 rounded-md" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass-card space-y-5 p-5">
              <div className="skeleton-shimmer h-5 w-36 rounded-md" />
              <div className="skeleton-shimmer h-48 w-full rounded-xl" />
            </div>
            <div className="glass-card space-y-5 p-5">
              <div className="skeleton-shimmer h-5 w-40 rounded-md" />
              <div className="skeleton-shimmer h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handlePageChange = (page: PageId) => {
    setCurrentPage(page);
  };

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar currentPage={currentPage} onPageChange={handlePageChange} />

        <div className="flex min-h-screen flex-1 flex-col min-w-0">
          <Header mqttStatus={mqttStatus} currentPage={activePage} health={health} />

          <main className="flex-1 overflow-auto overflow-x-hidden px-3 py-4 pt-16 sm:px-6 sm:py-6 sm:pt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePage}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <Suspense fallback={<PageLoadingFallback />}>
                  {renderPage()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
