import { useCallback, useEffect, useState } from 'react';
import { getMqttClient, publishMqtt, publishMqttWithAck, syncLocalControlState } from '../services/mqtt';

export interface ControlLog {
  id: number;
  action: string;
  device: string;
  duration: number | null;
  status: string;
  executed_at: string;
}

// sendCommand() SELALU resolve dengan bentuk ini (tidak pernah reject) —
// caller WAJIB mengecek field `success`. Sebelumnya di SettingsPage.tsx hasil
// ini dibuang lewat `.catch(() => undefined)` yang tidak pernah kepanggil
// (karena promise-nya memang tidak pernah reject), sehingga kegagalan kirim
// ke ESP32 tidak pernah terlihat di UI walau field `success: false` sudah ada.
export interface SendCommandResult {
  success: boolean;
  error?: string;
}

const STORAGE_KEY = 'nexagrow-control-logs';
const TOPIC_ACTUATOR_STATUS = 'sproutai/actuator/status';
const TOPIC_POMPA_STATUS = 'sproutai/pompa/status';
const TOPIC_MODE_STATUS = 'sproutai/mode/status';

interface MqttCommand {
  topic: string;
  payload: string;
  acknowledgement?: {
    topic: string;
    matches: (topic: string, payload: string) => boolean;
  };
}

function parseActuatorPayload(payload: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function actuatorMatches(field: 'irigasi' | 'fertigasi', expected: boolean) {
  return (topic: string, payload: string) => {
    if (topic !== TOPIC_ACTUATOR_STATUS) return false;
    const status = parseActuatorPayload(payload)?.[field];
    return status === expected || status === (expected ? 'true' : 'false') || status === (expected ? 1 : 0);
  };
}

function modeMatches(expected: 'AUTO' | 'MANUAL') {
  return (topic: string, payload: string) => {
    if (topic !== TOPIC_MODE_STATUS) return false;
    const normalized = payload.trim().toUpperCase();
    return expected === 'AUTO'
      ? normalized === 'AUTO' || normalized === 'OTOMATIS'
      : normalized === 'MANUAL';
  };
}

function readStoredLogs(): ControlLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ControlLog[]) : [];
  } catch {
    return [];
  }
}

function persistStoredLogs(logs: ControlLog[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function createLog(action: string, device: string, duration: number | null, status: string): ControlLog {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    action,
    device,
    duration,
    status,
    executed_at: new Date().toISOString(),
  };
}

function resolveControlCommand(action: string, duration?: number, data?: Record<string, any>): MqttCommand | null {
  switch (action) {
    case 'pump_on':
      return {
        topic: 'sproutai/pompa/cmd',
        payload: 'ON',
        acknowledgement: {
          topic: TOPIC_POMPA_STATUS,
          matches: (topic, payload) => topic === TOPIC_POMPA_STATUS && payload.trim().toUpperCase() === 'ON',
        },
      };
    case 'pump_off':
      return {
        topic: 'sproutai/pompa/cmd',
        payload: 'OFF',
        acknowledgement: {
          topic: TOPIC_POMPA_STATUS,
          matches: (topic, payload) => topic === TOPIC_POMPA_STATUS && payload.trim().toUpperCase() === 'OFF',
        },
      };
    case 'irrigation_on':
      return {
        topic: 'sproutai/irigasi/cmd',
        payload: 'ON',
        acknowledgement: { topic: TOPIC_ACTUATOR_STATUS, matches: actuatorMatches('irigasi', true) },
      };
    case 'irrigation_off':
      return {
        topic: 'sproutai/irigasi/cmd',
        payload: 'OFF',
        acknowledgement: { topic: TOPIC_ACTUATOR_STATUS, matches: actuatorMatches('irigasi', false) },
      };
    case 'fertigation_on':
      return {
        topic: 'sproutai/fertigasi/cmd',
        payload: 'ON',
        acknowledgement: { topic: TOPIC_ACTUATOR_STATUS, matches: actuatorMatches('fertigasi', true) },
      };
    case 'fertigation_off':
      return {
        topic: 'sproutai/fertigasi/cmd',
        payload: 'OFF',
        acknowledgement: { topic: TOPIC_ACTUATOR_STATUS, matches: actuatorMatches('fertigasi', false) },
      };
    // Kasus led_on dan led_off dihapus karena LED dikontrol ESP32 secara hardware
    case 'mode_auto':
      return {
        topic: 'sproutai/mode/cmd',
        payload: 'AUTO',
        acknowledgement: { topic: TOPIC_MODE_STATUS, matches: modeMatches('AUTO') },
      };
    case 'mode_manual':
      return {
        topic: 'sproutai/mode/cmd',
        payload: 'MANUAL',
        acknowledgement: { topic: TOPIC_MODE_STATUS, matches: modeMatches('MANUAL') },
      };
    case 'settings_sync': {
      const phaseValue = String(data?.plant_phase ?? '').trim().toLowerCase() === 'generatif' ? 1 : 0;
      const autoModeValue = typeof data?.auto_mode === 'string'
        ? (String(data?.auto_mode).trim().toLowerCase() === 'manual' ? 0 : 1)
        : Boolean(data?.auto_mode) ? 1 : 0;
      const enabled = Boolean(data?.watering_enabled ?? data?.schedule_enabled ?? true);
      const location = String(data?.location ?? '').trim();
      const weatherLocation = String(data?.weather_location ?? data?.location ?? '').trim();
      const weatherCondition = String(data?.weather_condition ?? '').trim();
      const weatherTemperature = Number(data?.weather_temperature ?? 0);
      const weatherRainChance = Number(data?.weather_rain_chance ?? data?.rain_chance ?? 0);
      const rawWt = String(data?.watering_time ?? '').trim();
      // Bug #4 Fix: Validasi format HH:MM sebelum dikirim via settings_sync.
      const wateringTime = /^\d{2}:\d{2}$/.test(rawWt) ? rawWt : '06:00';
      const wateringDuration = Number(data?.watering_duration ?? 10);

      return {
        topic: 'sproutai/settings/cmd',
        payload: JSON.stringify({
          plant_phase: phaseValue === 1 ? 'generatif' : 'vegetatif',
          pp: phaseValue,
          auto_mode: autoModeValue === 1,
          am: autoModeValue,
          location,
          weather_location: weatherLocation,
          weather_location_code: weatherLocation,
          weather_condition: weatherCondition,
          weather_desc: weatherCondition,
          weather_temperature: weatherTemperature,
          weather_temp: weatherTemperature,
          weather_rain_chance: weatherRainChance,
          rain: weatherRainChance,
          rc: weatherRainChance,
          weather_forecast: String(data?.weather_forecast ?? '').trim(),
          watering_time: wateringTime,
          wt: wateringTime,
          watering_duration: wateringDuration,
          wd: wateringDuration,
          watering_enabled: enabled,
          schedule_enabled: enabled,
          se: enabled,
          temp_threshold_low: Number(data?.temp_threshold_low ?? 0),
          temp_threshold_high: Number(data?.temp_threshold_high ?? 0),
          humidity_threshold_low: Number(data?.humidity_threshold_low ?? 0),
          humidity_threshold_high: Number(data?.humidity_threshold_high ?? 0),
          soil_threshold_low: Number(data?.soil_threshold_low ?? 0),
          soil_threshold_high: Number(data?.soil_threshold_high ?? 0),
          soil_threshold_critical: Number(data?.soil_threshold_critical ?? 0),
          tk: Number(data?.soil_threshold_critical ?? 0),
          fertigation_interval: Number(data?.fertigation_interval ?? 2),
          auto_report: Boolean(data?.auto_report ?? true),
          report_time: String(data?.report_time ?? '08:00').trim(),
          user_name: String(data?.user_name ?? '').trim(),
          user_email: String(data?.user_email ?? '').trim(),
        }),
      };
    }
    case 'schedule_set':
      {
        const enabled = Boolean(data?.schedule_enabled ?? data?.watering_enabled ?? true);
        const rawWateringTime = String(data?.watering_time ?? '').trim();
        // Bug #4 Fix: Validasi format HH:MM sebelum dikirim ke ESP32.
        // Jika kosong atau format salah, fallback ke '06:00' agar jadwal tetap valid.
        const wateringTime = /^\d{2}:\d{2}$/.test(rawWateringTime) ? rawWateringTime : '06:00';
        const wateringDuration = Number(data?.watering_duration ?? 10);
        return {
          topic: 'sproutai/schedule/cmd',
          payload: JSON.stringify({
            schedule_enabled: enabled,
            watering_enabled: enabled,
            se: enabled,
            watering_time: wateringTime,
            wt: wateringTime,
            watering_duration: wateringDuration,
            wd: wateringDuration,
          }),
        };
      }
    case 'wifi_update': {
      const ssid = String(data?.ssid ?? '').trim();
      const password = String(data?.password ?? '');
      return {
        topic: 'sproutai/wifi/cmd',
        payload: JSON.stringify({ ssid, password }),
        acknowledgement: {
          topic: 'sproutai/wifi/status',
          matches: (topic, payload) => {
            if (topic !== 'sproutai/wifi/status') return false;
            try {
              const res = JSON.parse(payload);
              if (res.status === 'SUCCESS') return true;
              if (res.status === 'FAILED_REVERTED') {
                throw new Error(res.error || 'Gagal koneksi ke WiFi baru (salah SSID/password). ESP32 kembali ke WiFi sebelumnya.');
              }
            } catch (e) {
              if (e instanceof Error && e.message.includes('Gagal koneksi')) throw e;
            }
            return false;
          },
        },
      };
    }
    default:
      return null;
  }
}

export function useControl() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ControlLog[]>(() => readStoredLogs());

  const pushLog = useCallback((log: ControlLog) => {
    setLogs((prev) => {
      const next = [log, ...prev].slice(0, 50);
      persistStoredLogs(next);
      return next;
    });
  }, []);

  const fetchLogs = useCallback(async () => {
    const stored = readStoredLogs();
    setLogs(stored);
    return stored;
  }, []);

  const sendCommand = useCallback(async (action: string, duration?: number, data?: Record<string, any>): Promise<SendCommandResult> => {
    setLoading(true);
    setError(null);

    try {
      const client = await getMqttClient();
      if (!client) throw new Error('MQTT client belum tersedia');

      const mqttCommand = resolveControlCommand(action, duration, data);
      if (!mqttCommand) throw new Error(`Perintah "${action}" tidak dikenal`);
      console.debug('[CONTROL] sendCommand', { action, duration, data, mqttCommand, connected: client.connected });

      if (!client.connected) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error('MQTT belum terhubung'));
          }, 10_000);

          const cleanup = () => {
            window.clearTimeout(timeout);
            client.off('connect', onConnect);
            client.off('error', onError);
          };

          const onConnect = () => {
            cleanup();
            resolve();
          };

          const onError = (err: Error) => {
            cleanup();
            reject(err);
          };

          client.once('connect', onConnect);
          client.once('error', onError);
        });
      }

      if (mqttCommand.acknowledgement) {
        const timeoutMs = action === 'wifi_update' ? 18_000 : 8_000;
        await publishMqttWithAck(
          mqttCommand.topic,
          mqttCommand.payload,
          mqttCommand.acknowledgement.topic,
          mqttCommand.acknowledgement.matches,
          timeoutMs,
          { retain: false, qos: 1 },
        );
      } else if (action === 'settings_sync' || action === 'schedule_set') {
        await publishMqtt(mqttCommand.topic, mqttCommand.payload, {
          retain: false,
          qos: 1,
        });
      } else {
        await publishMqtt(mqttCommand.topic, mqttCommand.payload, {
          retain: false,
          qos: 1,
        });
      }

      syncLocalControlState(action, duration, data);
      pushLog(createLog(action, 'ESP32_Gateway', duration ?? null, 'completed'));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      pushLog(createLog(action, 'ESP32_Gateway', duration ?? null, 'failed'));
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [pushLog]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { sendCommand, fetchLogs, logs, loading, error };
}
