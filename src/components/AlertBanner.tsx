import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Thermometer, Droplets } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SensorData } from '../hooks/useSensorData';
import { Settings } from '../hooks/useSettings';

interface AlertBannerProps {
  sensorData: SensorData | null;
  settings: Settings | null;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'warning' | 'danger';
  icon: LucideIcon;
}

export function AlertBanner({ sensorData, settings }: AlertBannerProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sensorData || !settings) return;

    const newAlerts: Alert[] = [];

    if (sensorData.temperature != null && sensorData.temperature > settings.temp_threshold_high) {
      newAlerts.push({
        id: 'temp-high',
        type: 'temperature',
        message: `Suhu terlalu tinggi (${sensorData.temperature}°C).`,
        severity: 'danger',
        icon: Thermometer,
      });
    }

    if (sensorData.temperature != null && sensorData.temperature < settings.temp_threshold_low) {
      newAlerts.push({
        id: 'temp-low',
        type: 'temperature',
        message: `Suhu terlalu rendah (${sensorData.temperature}°C).`,
        severity: 'warning',
        icon: Thermometer,
      });
    }

    if (sensorData.soil_moisture != null && sensorData.soil_moisture < settings.soil_threshold_critical) {
      newAlerts.push({
        id: 'soil-critical',
        type: 'soil',
        message: `Kelembapan tanah kritis (${sensorData.soil_moisture}%).`,
        severity: 'danger',
        icon: Droplets,
      });
    } else if (sensorData.soil_moisture != null && sensorData.soil_moisture < settings.soil_threshold_low) {
      newAlerts.push({
        id: 'soil-low',
        type: 'soil',
        message: `Kelembapan tanah rendah (${sensorData.soil_moisture}%).`,
        severity: 'warning',
        icon: Droplets,
      });
    }

    setAlerts(newAlerts.filter((a) => !dismissed.has(a.id)));
  }, [sensorData, settings, dismissed]);

  const dismissAlert = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <AnimatePresence>
      {alerts.map((alert) => (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          role={alert.severity === 'danger' ? 'alert' : 'status'}
          className={`mb-4 rounded-xl border-l-4 p-4 ${
            alert.severity === 'danger'
              ? 'border-red-500 bg-red-50 text-red-950 dark:border-red-400 dark:bg-red-950/80 dark:text-red-50'
              : 'border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950/80 dark:text-amber-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <alert.icon className={`mt-0.5 h-5 w-5 shrink-0 ${alert.severity === 'danger' ? 'text-red-700 dark:text-red-200' : 'text-amber-700 dark:text-amber-200'}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{alert.message}</p>
                <button
                  type="button"
                  onClick={() => dismissAlert(alert.id)}
                  aria-label={`Tutup notifikasi: ${alert.message}`}
                  className={`rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-red-950 ${alert.severity === 'danger' ? 'text-red-800 hover:bg-red-200/70 hover:text-red-950 focus-visible:ring-red-500 dark:text-red-100 dark:hover:bg-red-900/70 dark:hover:text-white' : 'text-amber-800 hover:bg-amber-200/70 hover:text-amber-950 focus-visible:ring-amber-500 dark:text-amber-100 dark:hover:bg-amber-900/70 dark:hover:text-white'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className={`mt-1 text-xs ${alert.severity === 'danger' ? 'text-red-800 dark:text-red-100' : 'text-amber-800 dark:text-amber-100'}`}>{alert.type}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
