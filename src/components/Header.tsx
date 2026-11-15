import { Bell, Wifi, WifiOff, ChevronDown, CheckCheck, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { MqttStatusSnapshot } from '../hooks/useMqttStatus';
import { useAlerts } from '../hooks/useAlerts';
import { PlantHealthSummary } from '../lib/plantPhase';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  mqttStatus: MqttStatusSnapshot;
  currentPage: string;
  health?: PlantHealthSummary | null;
}

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  monitoring: 'Monitoring Real-time',
  chat: 'TeraNova AI',
  control: 'Kontrol Perangkat',
  weather: 'Prakiraan Cuaca',
  logs: 'Log & Analitik',
  settings: 'Pengaturan',
  about: 'About / Tentang TeraNova',
};

const notificationTone = {
  danger: {
    container: 'border-red-200 bg-red-50 dark:border-red-400/60 dark:bg-red-950/80',
    title: 'text-red-950 dark:text-red-50',
    meta: 'text-red-800 dark:text-red-100',
    badge: 'bg-red-100 text-red-800 dark:bg-red-500/25 dark:text-red-50',
  },
  info: {
    container: 'border-blue-200 bg-blue-50 dark:border-blue-400/60 dark:bg-blue-950/80',
    title: 'text-blue-950 dark:text-blue-50',
    meta: 'text-blue-800 dark:text-blue-100',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-500/25 dark:text-blue-50',
  },
  warning: {
    container: 'border-amber-200 bg-amber-50 dark:border-amber-400/60 dark:bg-amber-950/80',
    title: 'text-amber-950 dark:text-amber-50',
    meta: 'text-amber-800 dark:text-amber-100',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-50',
  },
} as const;

export function Header({ mqttStatus, currentPage, health }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { alerts, unreadCount, markAsRead, fetchAlerts } = useAlerts();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isOnline = mqttStatus.espOnline;
  
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (open) fetchAlerts();
  }, [open, fetchAlerts]);

  const title = pageTitles[currentPage] || 'Dashboard';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 pl-12 pr-1 sm:pl-0">
          <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">{title}</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <motion.div
            initial={false}
            animate={{
              backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.14)' : 'rgba(248, 113, 113, 0.14)',
              color: isOnline ? (theme === 'dark' ? '#34d399' : '#065f46') : (theme === 'dark' ? '#f87171' : '#991b1b'),
            }}
            className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-semibold sm:px-3 sm:py-2 sm:text-xs"
          >
            {isOnline ? (
              <>
                <Wifi size={15} className="text-green-600 dark:text-green-400" />
                <span className="hidden sm:inline">Sistem Online</span>
                <span className="sm:hidden">Online</span>
              </>
            ) : (
              <>
                <WifiOff size={15} className="text-red-500" />
                <span className="hidden sm:inline">Sistem Offline</span>
                <span className="sm:hidden">Offline</span>
              </>
            )}
          </motion.div>

          <div className="relative" ref={panelRef}>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              aria-haspopup="dialog"
              className="relative inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              title="Notifikasi"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
              <ChevronDown size={14} className={`text-slate-600 transition-transform dark:text-slate-300 ${open ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  role="dialog"
                  aria-label="Histori notifikasi"
                  className="absolute right-0 mt-3 w-[min(92vw,24rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Histori Notifikasi</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{unreadCount} belum dibaca</p>
                    </div>
                    <button
                      onClick={() => markAsRead()}
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-400/50 dark:bg-emerald-950/80 dark:text-emerald-50 dark:hover:bg-emerald-950"
                    >
                      <CheckCheck size={14} />
                      Tandai semua
                    </button>
                  </div>

                  <div className="max-h-[22rem] space-y-2 overflow-y-auto p-3">
                    {alerts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-600 dark:border-gray-800 dark:text-slate-300">
                        Belum ada notifikasi.
                      </div>
                    )}

                    {alerts.slice(0, 10).map((alert) => {
                      const tone = notificationTone[alert.severity];
                      return (
                        <div key={alert.id} className={`rounded-2xl border p-3 ${tone.container}`}>
                          <p className={`text-sm font-semibold ${tone.title}`}>{alert.message}</p>
                          <div className="mt-1 flex items-center justify-between">
                            <p className={`text-xs ${tone.meta}`}>{alert.type}</p>
                            {!alert.read && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.badge}`}>
                                Baru
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
