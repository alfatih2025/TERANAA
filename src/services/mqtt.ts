import type { MqttClient } from 'mqtt';

const DEFAULT_BROKER_URL = 'wss://083ac0ac0dbf4e78877e4a5cd24d426d.s1.eu.hivemq.cloud:8884/mqtt';
const DEFAULT_MQTT_USERNAME = 'TeraNova';
const DEFAULT_MQTT_PASSWORD = 'TeraNova2026';

const BROKER_URL = (import.meta.env.VITE_BROKER_URL as string | undefined)?.trim() || DEFAULT_BROKER_URL;
const MQTT_USERNAME = (import.meta.env.VITE_MQTT_USERNAME as string | undefined)?.trim() || DEFAULT_MQTT_USERNAME;
const MQTT_PASSWORD = (import.meta.env.VITE_MQTT_PASSWORD as string | undefined)?.trim() || DEFAULT_MQTT_PASSWORD;

const WEB_STATUS_TOPIC = 'sproutai/web/status';
const DEVICE_STATUS_TOPIC = 'sproutai/esp32/status';
const DEVICE_BOOT_TOPIC = 'sproutai/esp32/boot';
const DEVICE_PANIC_TOPIC = 'sproutai/esp32/panic';
const SYSTEM_STATUS_TOPIC = 'sproutai/system/status';

const TOPIC_POMPA_CMD = 'sproutai/pompa/cmd';
const TOPIC_POMPA_STATUS = 'sproutai/pompa/status';
const TOPIC_LAMPU_CMD = 'sproutai/lampu/cmd';
const TOPIC_LAMPU_STATUS = 'sproutai/lampu/status';
const TOPIC_LAMPU_SYSTEM_STATUS = 'sproutai/lampu/system/status';
const TOPIC_LAMPU_MODE_STATUS = 'sproutai/lampu/mode/status';
const TOPIC_LAMPU_ONLINE_STATUS = 'sproutai/lampu/online/status';
const TOPIC_MODE_CMD = 'sproutai/mode/cmd';
const TOPIC_MODE_STATUS = 'sproutai/mode/status';
const TOPIC_WIFI_CMD = 'sproutai/wifi/cmd';
const TOPIC_WIFI_STATUS = 'sproutai/wifi/status';
const TOPIC_SETTINGS_CMD = 'sproutai/settings/cmd';
const TOPIC_SETTINGS_STATUS = 'sproutai/settings/status';
const TOPIC_SCHEDULE_CMD = 'sproutai/schedule/cmd';
const TOPIC_SCHEDULE_STATUS = 'sproutai/schedule/status';
const TOPIC_SENSOR_JSON = 'sproutai/sensor/data';
const TOPIC_SENSOR_NODE = 'sproutai/sensor/node/+';
const TOPIC_PH = 'sproutai/sensor/ph';
const TOPIC_RAIN_CHANCE = 'sproutai/weather/rain_chance';
const TOPIC_SOIL = 'sproutai/sensor/soil';
const TOPIC_TEMP = 'sproutai/sensor/temp';
const TOPIC_HUMIDITY = 'sproutai/sensor/humidity';
const TOPIC_SCORE = 'sproutai/sensor/score';
const TOPIC_FLOW_RESET_COMMAND = 'sproutai/flow/reset/cmd';
const TOPIC_FLOW_RESET_STATUS = 'sproutai/flow/reset/status';
const TOPIC_SYSTEM_FAULT = 'sproutai/system/fault';
const TOPIC_KARHUTLA_FWI = 'sproutai/karhutla/fwi';
const TOPIC_KARHUTLA_ALERT = 'sproutai/karhutla/alert';
const TOPIC_FLOW = 'sproutai/sensor/flow';
const TOPIC_ACTUATOR_STATUS = 'sproutai/actuator/status';

const SUBSCRIBE_TOPICS = [
  DEVICE_STATUS_TOPIC,
  DEVICE_BOOT_TOPIC,
  DEVICE_PANIC_TOPIC,
  SYSTEM_STATUS_TOPIC,
  TOPIC_SENSOR_JSON,
  TOPIC_SENSOR_NODE,
  TOPIC_FLOW_RESET_STATUS,
  TOPIC_KARHUTLA_FWI,
  TOPIC_KARHUTLA_ALERT,
  TOPIC_PH,
  TOPIC_FLOW,
  TOPIC_ACTUATOR_STATUS,
  TOPIC_SOIL,
  TOPIC_TEMP,
  TOPIC_HUMIDITY,
  TOPIC_SCORE,
  TOPIC_POMPA_STATUS,
  TOPIC_LAMPU_STATUS,
  TOPIC_LAMPU_SYSTEM_STATUS,
  TOPIC_LAMPU_MODE_STATUS,
  TOPIC_LAMPU_ONLINE_STATUS,
  TOPIC_MODE_STATUS,
  TOPIC_WIFI_STATUS,
  TOPIC_SETTINGS_CMD,
  TOPIC_SETTINGS_STATUS,
  TOPIC_SCHEDULE_STATUS,
  TOPIC_SYSTEM_FAULT,
];

const ESP_ONLINE_TIMEOUT_MS = 15_000; // 15 detik sebelum ESP32 dianggap offline
const HISTORY_LIMIT = 120;
const SETTINGS_EVENT = 'nexagrow:settings-updated';

// Pengaturan Penyimpanan Cerdas ke Supabase (Smart Change-Detection + Throttle + Heartbeat)
const MIN_PERSIST_GAP_MS = 15_000; // Minimal jeda 15 detik per node sebelum kirim lagi
const HEARTBEAT_PERSIST_INTERVAL_MS = 5 * 60 * 1000; // Tetap simpan 1x tiap 5 menit jika data stabil

interface PersistedMetrics {
  temperature: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  soil_temp: number | null;
  ph: number | null;
  flow_rate: number | null;
  valve_status: string | null;
  score: number | null;
  at: number;
}

const lastPersistedMetricsByNode = new Map<number, PersistedMetrics>();

export interface MqttSensorSnapshot {
  device_id: string | null;
  node_id: number | null;
  temperature: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  ph: number | null;
  flow_rate?: number | null;
  total_water?: number | null;
  session_water?: number | null;
  valve_status?: string | null;
  soil_temp?: number | null;
  fwi?: number | null;
  fwi_level?: number | null;
  fwi_status?: string | null;
  ffmc?: number | null;
  dmc?: number | null;
  dc?: number | null;
  isi?: number | null;
  bui?: number | null;
  updatedAt: string | null;
  sourceTopic: string | null;
  simulation?: boolean;
}

export interface MqttActuatorSnapshot {
  irigasi: boolean | null;
  fertigasi: boolean | null;
  pompa: boolean | null;
  mode: 'manual' | 'auto' | null;
  activeValve: string | null;
  ph?: number | null;
  flowRate?: number | null;
  currentLiters?: number | null;
  totalLiters?: number | null;
  targetLiters?: number | null;
  lampuMode?: boolean | null;
  lampuSystem?: boolean | null;
  lampuOnline?: boolean | null;
  updatedAt: string | null;
  sourceTopic: string | null;
}

export interface MqttFlowCounterResetSnapshot {
  requestId: string;
  counter: 'session' | 'total';
  state: 'queued' | 'accepted' | 'rejected' | 'error';
  message: string;
  sessionLiters: number | null;
  totalLiters: number | null;
  updatedAt: string;
}

export interface MqttScheduleSnapshot {
  schedule_enabled: boolean;
  watering_time: string;
  watering_duration: number;
  time_valid: boolean;
  current_time: string;
  last_watered: string;
  updatedAt: string | null;
  sourceTopic: string | null;
}

export interface MqttStatusSnapshot {
  brokerUrl: string;
  browserOnline: boolean;
  mqttConnected: boolean;
  mqttConnecting: boolean;
  mqttReconnecting: boolean;
  mqttError: string | null;
  espOnline: boolean;
  espLastSeenAt: string | null;
  bootDiagnosticSnapshot: MqttBootDiagnosticSnapshot | null;
  panicDumpSnapshot: MqttPanicDumpSnapshot | null;
  flowCounterResetSnapshot: MqttFlowCounterResetSnapshot | null;
  systemOnline: boolean;
  systemLabel: string;
  systemDetail: string;
  lastTopic: string | null;
  lastPayload: string | null;
  lastMessageAt: string | null;
  webPublishedAt: string | null;
  subscribedTopics: string[];
  sensorSnapshot: MqttSensorSnapshot | null;
  actuatorSnapshot: MqttActuatorSnapshot | null;
  scheduleSnapshot?: MqttScheduleSnapshot | null;
}

export interface MqttBootDiagnosticSnapshot {
  bootCount: number;
  resetReason: string;
  resetReasonCode: number;
  uptimeMs: number;
  updatedAt: string;
}

export interface MqttPanicDumpSnapshot {
  available: boolean;
  errorCode: number;
  publishedAfterResetReason: string;
  task: string | null;
  pc: string | null;
  exceptionCause: number | null;
  exceptionAddress: string | null;
  backtrace: string[];
  backtraceCorrupted: boolean | null;
  firmwareElfSha256: string | null;
  updatedAt: string;
}

type SensorDelta = Partial<Omit<MqttSensorSnapshot, 'updatedAt' | 'sourceTopic'>>;

interface MqttAckWaiter {
  topic: string;
  matcher: (topic: string, payload: string) => boolean;
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

const pendingMqttAcks = new Set<MqttAckWaiter>();

let client: MqttClient | null = null;
const listeners = new Set<() => void>();

const emptySensorSnapshot: MqttSensorSnapshot = {
  device_id: null,
  node_id: null,
  temperature: null,
  humidity: null,
  soil_moisture: null,
  soil_temp: null,
  fwi: null,
  fwi_level: null,
  fwi_status: null,
  ph: null,
  flow_rate: null,
  total_water: null,
  session_water: null,
  valve_status: null,
  updatedAt: null,
  sourceTopic: null,
};

function getInitialSavedActuator(): MqttActuatorSnapshot {
  const fallback: MqttActuatorSnapshot = {
    irigasi: false,
    fertigasi: false,
    pompa: false,
    mode: getInitialSavedMode(),
    activeValve: 'IDLE',
    ph: null,
    flowRate: 0,
    currentLiters: 0,
    totalLiters: 0,
    targetLiters: null,
    updatedAt: null,
    sourceTopic: null,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem('teranova_gateway_actuator');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...fallback, ...parsed };
    }
  } catch {}
  return fallback;
}

function getInitialSavedSchedule(): MqttScheduleSnapshot {
  const fallback: MqttScheduleSnapshot = {
    schedule_enabled: true,
    watering_time: '06:00',
    watering_duration: 10,
    time_valid: false,
    current_time: '--:--',
    last_watered: 'Belum ada',
    updatedAt: null,
    sourceTopic: null,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem('teranova_gateway_schedule');
    if (saved) {
      return { ...fallback, ...JSON.parse(saved) };
    }
  } catch {}
  return fallback;
}

const defaultSnapshot = (): MqttStatusSnapshot => ({
  brokerUrl: BROKER_URL,
  browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  mqttConnected: false,
  mqttConnecting: Boolean(BROKER_URL),
  mqttReconnecting: false,
  mqttError: BROKER_URL ? null : 'VITE_BROKER_URL belum diisi',
  espOnline: false,
  espLastSeenAt: null,
  bootDiagnosticSnapshot: null,
  panicDumpSnapshot: null,
  flowCounterResetSnapshot: null,
  systemOnline: false,
  systemLabel: 'Sistem Offline',
  systemDetail: 'Koneksi belum tersedia',
  lastTopic: null,
  lastPayload: null,
  lastMessageAt: null,
  webPublishedAt: null,
  subscribedTopics: SUBSCRIBE_TOPICS,
  sensorSnapshot: null,
  actuatorSnapshot: getInitialSavedActuator(),
  scheduleSnapshot: getInitialSavedSchedule(),
});

let snapshot: MqttStatusSnapshot = defaultSnapshot();
let sensorSnapshot: MqttSensorSnapshot | null = null;
let actuatorSnapshot: MqttActuatorSnapshot | null = getInitialSavedActuator();
let bootDiagnosticSnapshot: MqttBootDiagnosticSnapshot | null = null;
let panicDumpSnapshot: MqttPanicDumpSnapshot | null = null;
let flowCounterResetSnapshot: MqttFlowCounterResetSnapshot | null = null;
let scheduleSnapshot: MqttScheduleSnapshot = getInitialSavedSchedule();
let sensorSnapshotByNode: Map<number, MqttSensorSnapshot> = new Map();
let sensorHistory: MqttSensorSnapshot[] = [];
let reconnectTimer: number | null = null;

function emit() {
  const now = Date.now();

  const browserOnline = snapshot.browserOnline;
  const mqttConnected = snapshot.mqttConnected;

  const espLastSeenMs = snapshot.espLastSeenAt ? now - new Date(snapshot.espLastSeenAt).getTime() : null;
  const espOnline = Boolean(
    snapshot.espOnline &&
    espLastSeenMs !== null &&
    espLastSeenMs <= ESP_ONLINE_TIMEOUT_MS
  );

  // System online hanya jika web + mqtt + ESP32 aktif
  const systemOnline = browserOnline && mqttConnected && espOnline;

  const reasonParts: string[] = [];

  if (!browserOnline) reasonParts.push('Web offline');
  if (!mqttConnected) reasonParts.push(snapshot.mqttError || 'MQTT belum terhubung');

  if (!espOnline) {
    if (espLastSeenMs === null) {
      reasonParts.push('ESP32 status belum diterima');
    } else {
      reasonParts.push(`ESP32 offline • ${Math.floor(espLastSeenMs / 1000)} detik lalu`);
    }
  }

  snapshot = {
    ...snapshot,
    espOnline,
    systemOnline,
    systemLabel: systemOnline ? 'Sistem Online' : 'Sistem Offline',
    systemDetail: systemOnline
      ? 'Web & MQTT aktif' + (espOnline ? ', ESP32 aktif' : ', menunggu data sensor')
      : reasonParts.filter(Boolean).join(' • ') || 'Sistem belum siap',
    sensorSnapshot,
  };

  listeners.forEach((listener) => listener());
}

function setSnapshot(next: Partial<MqttStatusSnapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

function pushHistory(entry: MqttSensorSnapshot) {
  sensorHistory = [...sensorHistory, entry].slice(-HISTORY_LIMIT);
}

function setSensorSnapshot(next: SensorDelta, sourceTopic: string, force = false) {
  const now = new Date().toISOString();
  const nodeId = next.node_id;

  // --- Per-node snapshot (anti-glitch & state retention) ---
  if (nodeId != null) {
    const prevNode = sensorSnapshotByNode.get(nodeId) ?? { ...emptySensorSnapshot, node_id: nodeId };
    
    // Gabungkan data: pertahankan nilai sebelumnya jika paket baru hanya mengirim sebagian sensor (field bernilai undefined)
    const mergedNode: MqttSensorSnapshot = {
      ...prevNode,
      node_id: nodeId,
      device_id: next.device_id !== undefined ? next.device_id : prevNode.device_id,
      temperature: next.temperature !== undefined ? next.temperature : prevNode.temperature,
      humidity: next.humidity !== undefined ? next.humidity : prevNode.humidity,
      soil_moisture: next.soil_moisture !== undefined ? next.soil_moisture : prevNode.soil_moisture,
      soil_temp: next.soil_temp !== undefined ? next.soil_temp : prevNode.soil_temp,
      ph: next.ph !== undefined ? next.ph : prevNode.ph,
      flow_rate: next.flow_rate !== undefined ? next.flow_rate : prevNode.flow_rate,
      total_water: next.total_water !== undefined ? next.total_water : prevNode.total_water,
      session_water: next.session_water !== undefined ? next.session_water : prevNode.session_water,
      valve_status: next.valve_status !== undefined ? next.valve_status : prevNode.valve_status,
      simulation: next.simulation !== undefined ? next.simulation : prevNode.simulation,
      fwi: next.fwi !== undefined ? next.fwi : prevNode.fwi,
      fwi_level: next.fwi_level !== undefined ? next.fwi_level : prevNode.fwi_level,
      fwi_status: next.fwi_status !== undefined ? next.fwi_status : prevNode.fwi_status,
      updatedAt: now,
      sourceTopic,
    };

    // Deduplikasi nilai sensor numerik agar tidak spam re-render
    const prevKey = `${prevNode.temperature}|${prevNode.humidity}|${prevNode.soil_moisture}|${prevNode.ph}|${prevNode.flow_rate}|${prevNode.fwi}`;
    const nextKey = `${mergedNode.temperature}|${mergedNode.humidity}|${mergedNode.soil_moisture}|${mergedNode.ph}|${mergedNode.flow_rate}|${mergedNode.fwi}`;

    sensorSnapshotByNode.set(nodeId, mergedNode);

    // Simpan ke Supabase (menggunakan mergedNode yang lengkap)
    if (!mergedNode.simulation) {
      persistSensorDataToApi(JSON.stringify(mergedNode), mergedNode);
    }

    if (!force && prevKey === nextKey) {
      // Nilai sensor sama persis, lewati emit re-render
      return;
    }
  }

  // --- Legacy single snapshot (untuk kompabilitas) ---
  const previous = sensorSnapshot ?? emptySensorSnapshot;
  const base = nodeId != null && nodeId !== previous.node_id
    ? { ...emptySensorSnapshot, node_id: nodeId }
    : previous;
  const merged: MqttSensorSnapshot = {
    ...base,
    ...next,
    updatedAt: now,
    sourceTopic,
  };

  sensorSnapshot = merged;
  pushHistory(merged);
  snapshot = {
    ...snapshot,
    lastTopic: sourceTopic,
    lastPayload: JSON.stringify(merged),
    lastMessageAt: now,
    sensorSnapshot,
  };
  
  emit();
}


function dispatchSettingsEvent(detail: Record<string, unknown>) {
  if (typeof window === 'undefined' || detail.simulation) return;
  try {
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail }));
  } catch {
    // ignore dispatch failures
  }
}

export function parseMqttJsonPayload(payload: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function persistSensorDataToApi(payload: string, parsed: SensorDelta) {
  if (typeof window === 'undefined') return;

  const nodeId = parsed.node_id;
  // Jika node_id tidak diketahui, jangan simpan sembarangan
  if (nodeId == null) return;

  // Pastikan ada setidaknya 1 metrik sensor numerik yang valid (hindari simpan row kosong)
  const hasValidMetric =
    parsed.temperature != null ||
    parsed.humidity != null ||
    parsed.soil_moisture != null ||
    parsed.soil_temp != null ||
    parsed.ph != null ||
    parsed.flow_rate != null ||
    parsed.fwi != null;

  if (!hasValidMetric) return;

  const now = Date.now();
  // Gunakan null bukan undefined agar JSON.stringify tidak menghapus field
  const normalizedObj: Record<string, unknown> = {
    node_id: nodeId,
  };
  if (parsed.temperature !== undefined) normalizedObj.temperature = parsed.temperature;
  if (parsed.humidity !== undefined) normalizedObj.humidity = parsed.humidity;
  if (parsed.soil_moisture !== undefined) normalizedObj.soil_moisture = parsed.soil_moisture;
  if (parsed.soil_temp !== undefined) normalizedObj.soil_temp = parsed.soil_temp;
  if (parsed.ph !== undefined) normalizedObj.ph = parsed.ph;
  if (parsed.flow_rate !== undefined) normalizedObj.flow_rate = parsed.flow_rate;
  if (parsed.total_water !== undefined) normalizedObj.total_water = parsed.total_water;
  if (parsed.session_water !== undefined) normalizedObj.session_water = parsed.session_water;
  if (parsed.valve_status !== undefined) normalizedObj.valve_status = parsed.valve_status;
  if (parsed.fwi !== undefined) normalizedObj.score = parsed.fwi;
  const normalized = JSON.stringify(normalizedObj);

  // Cache ke localStorage browser per node agar data terakhir selalu tersimpan & tampil
  try {
    localStorage.setItem(`teranova_node_${nodeId}`, JSON.stringify({
      ...normalizedObj,
      created_at: new Date().toISOString(),
    }));
  } catch {}

  const prev = lastPersistedMetricsByNode.get(nodeId);
  const timeSinceLast = prev ? now - prev.at : Infinity;

  // 1. Throttle: Jangan kirim jika belum lewat MIN_PERSIST_GAP_MS (15 detik)
  if (timeSinceLast < MIN_PERSIST_GAP_MS) {
    return;
  }

  // 2. Evaluasi apakah ada perubahan sensor yang signifikan (Smart Deadband)
  let hasSignificantChange = false;
  if (!prev) {
    // Belum pernah disimpan sejak buka web -> simpan pertama kali
    hasSignificantChange = true;
  } else if (timeSinceLast >= HEARTBEAT_PERSIST_INTERVAL_MS) {
    // Sudah lewat 5 menit tanpa perubahan -> simpan sebagai heartbeat periodik
    hasSignificantChange = true;
  } else {
    // Cek perbedaan metrik sensor yang melampaui toleransi fluktuasi/noise
    const diff = (a: number | null | undefined, b: number | null | undefined) => {
      if (a == null && b == null) return 0;
      if (a == null || b == null) return Infinity;
      return Math.abs(a - b);
    };

    if (diff(parsed.temperature, prev.temperature) >= 0.3) hasSignificantChange = true;
    if (diff(parsed.humidity, prev.humidity) >= 1.0) hasSignificantChange = true;
    if (diff(parsed.soil_moisture, prev.soil_moisture) >= 1.0) hasSignificantChange = true;
    if (diff(parsed.soil_temp, prev.soil_temp) >= 0.3) hasSignificantChange = true;
    if (diff(parsed.ph, prev.ph) >= 0.1) hasSignificantChange = true;
    if (diff(parsed.fwi, prev.score) >= 0.5) hasSignificantChange = true;

    // Water flow: catat jika mulai mengalir/berhenti atau laju berubah >= 5 L/min
    const curFlow = parsed.flow_rate ?? 0;
    const prevFlow = prev.flow_rate ?? 0;
    if ((curFlow > 0) !== (prevFlow > 0) || Math.abs(curFlow - prevFlow) >= 5.0) {
      hasSignificantChange = true;
    }

    // Status valve berubah
    if ((parsed.valve_status ?? '') !== (prev.valve_status ?? '')) {
      hasSignificantChange = true;
    }
  }

  // Jika tidak ada perubahan signifikan dan belum waktunya heartbeat, hemat kuota DB & jangan kirim
  if (!hasSignificantChange) {
    return;
  }

  // Catat metrik yang disimpan
  lastPersistedMetricsByNode.set(nodeId, {
    temperature: parsed.temperature ?? null,
    humidity: parsed.humidity ?? null,
    soil_moisture: parsed.soil_moisture ?? null,
    soil_temp: parsed.soil_temp ?? null,
    ph: parsed.ph ?? null,
    flow_rate: parsed.flow_rate ?? null,
    valve_status: parsed.valve_status ?? null,
    score: parsed.fwi ?? null,
    at: now,
  });

  const apiToken = (import.meta.env.VITE_API_AUTH_TOKEN as string | undefined)?.trim() || 'teranova-iot-secret-2026';

  try {
    await fetch('/api/sensor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiToken,
      },
      body: normalized,
    });
  } catch (err) {
    console.warn(`[SENSOR PERSIST] Gagal simpan ke API sensor untuk node ${nodeId}:`, err);
  }
}

function getInitialSavedMode(): 'manual' | 'auto' {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('teranova_control_mode');
      if (saved === 'manual' || saved === 'auto') return saved;
    } catch {
      // ignore
    }
  }
  return 'manual';
}

function consumePendingMqttAcks(topic: string, payload: string) {
  for (const waiter of Array.from(pendingMqttAcks)) {
    try {
      if (waiter.matcher(topic, payload)) {
        pendingMqttAcks.delete(waiter);
        window.clearTimeout(waiter.timeoutId);
        waiter.resolve();
      }
    } catch (err) {
      pendingMqttAcks.delete(waiter);
      window.clearTimeout(waiter.timeoutId);
      waiter.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

function applySettingsSnapshot(detail: Record<string, unknown>, sourceTopic: string) {
  // MQTT sensor snapshot is intentionally sensor-only. Settings remain a separate signal through the settings context/event bus.
  const settingsDetail = {
    ...(detail as Record<string, unknown>),

    // Normalize keys to common web settings keys
    plant_phase:
      typeof detail.plant_phase === 'string'
        ? detail.plant_phase
        : typeof detail.crop_mode === 'string'
          ? detail.crop_mode
          : undefined,

    location:
      typeof detail.location === 'string'
        ? detail.location
        : typeof detail.weather_location === 'string'
          ? detail.weather_location
          : undefined,

    watering_time:
      typeof detail.watering_time === 'string' ? detail.watering_time : undefined,

    watering_duration: parseNumeric(detail.watering_duration),

    watering_enabled:
      detail.watering_enabled === undefined
        ? detail.schedule_enabled === undefined
          ? undefined
          : parseBoolean(detail.schedule_enabled)
        : Boolean(detail.watering_enabled),

    // thresholds: support both ESP32 web payload keys and sensor-derived keys
    temp_threshold_low: parseNumeric(detail.temp_threshold_low ?? detail.threshold_bawah),
    temp_threshold_high: parseNumeric(detail.temp_threshold_high ?? detail.threshold_atas),
    humidity_threshold_low: parseNumeric(detail.humidity_threshold_low ?? detail.h_low ?? detail.humidity_low),
    humidity_threshold_high: parseNumeric(detail.humidity_threshold_high ?? detail.h_high ?? detail.humidity_high),
    soil_threshold_low: parseNumeric(detail.soil_threshold_low ?? detail.threshold_bawah),
    soil_threshold_high: parseNumeric(detail.soil_threshold_high ?? detail.threshold_atas),
    soil_threshold_critical: parseNumeric(detail.soil_threshold_critical ?? detail.threshold_kritis),

    auto_report:
      detail.auto_report === undefined ? undefined : Boolean(detail.auto_report),
    report_time:
      typeof detail.report_time === 'string' ? detail.report_time : undefined,

    // user_name & user_email dihapus
    user_name: undefined,
    user_email: undefined,

    // keep compatibility with some pages that use crop_mode
    crop_mode:
      typeof detail.crop_mode === 'string'
        ? detail.crop_mode
        : undefined,
  } as Record<string, unknown>;

  dispatchSettingsEvent(settingsDetail);
}


function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  }
  return undefined;
}

function parseMode(value: unknown): 'manual' | 'auto' | null | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'manual') return 'manual';
  if (normalized === 'auto' || normalized === 'otomatis') return 'auto';
  return undefined;
}

function parseActuatorStatusPayload(payload: string): Partial<Omit<MqttActuatorSnapshot, 'updatedAt' | 'sourceTopic'>> | null {
  const parsed = parseMqttJsonPayload(payload);
  if (!parsed) return null;

  const irigasi = parseBoolean(parsed.irigasi);
  const fertigasi = parseBoolean(parsed.fertigasi);
  const pompa = parseBoolean(parsed.pompa ?? parsed.pump);
  const mode = parseMode(parsed.mode ?? parsed.device_mode);
  const activeValve = typeof parsed.active_valve === 'string'
    ? parsed.active_valve.trim().toUpperCase()
    : undefined;
  const ph = parseNumeric(parsed.ph);
  const flowRate = parseNumeric(parsed.flow_rate ?? parsed.flow);
  const currentLiters = parseNumeric(parsed.current_liters ?? parsed.session_liters ?? parsed.session_water);
  const totalLiters = parseNumeric(parsed.total_liters ?? parsed.total_water);
  const targetLiters = parseNumeric(parsed.target_liters ?? parsed.target_water);
  const lampuMode = parseBoolean(parsed.lampu_mode);
  const lampuSystem = parseBoolean(parsed.lampu_sistem ?? parsed.lampu_system ?? parsed.lampu_mode);
  const lampuOnline = parseBoolean(parsed.lampu_online);

  if (
    irigasi === undefined &&
    fertigasi === undefined &&
    pompa === undefined &&
    mode === undefined &&
    activeValve === undefined &&
    ph === null &&
    flowRate === null &&
    currentLiters === null &&
    totalLiters === null &&
    lampuMode === undefined &&
    lampuSystem === undefined &&
    lampuOnline === undefined
  ) {
    return null;
  }

  return {
    irigasi,
    fertigasi,
    pompa,
    mode,
    activeValve,
    ph: ph ?? undefined,
    flowRate: flowRate ?? undefined,
    currentLiters: currentLiters ?? undefined,
    totalLiters: totalLiters ?? undefined,
    targetLiters: targetLiters ?? undefined,
    lampuMode,
    lampuSystem,
    lampuOnline,
  };
}

function setActuatorSnapshot(
  next: Partial<Omit<MqttActuatorSnapshot, 'updatedAt' | 'sourceTopic'>>,
  sourceTopic: string,
) {
  const previous: MqttActuatorSnapshot = actuatorSnapshot ?? {
    irigasi: null,
    fertigasi: null,
    pompa: null,
    mode: null,
    activeValve: null,
    ph: null,
    flowRate: null,
    currentLiters: null,
    totalLiters: null,
    targetLiters: null,
    lampuMode: null,
    lampuSystem: null,
    lampuOnline: null,
    updatedAt: null,
    sourceTopic: null,
  };

  actuatorSnapshot = {
    ...previous,
    irigasi: next.irigasi ?? previous.irigasi,
    fertigasi: next.fertigasi ?? previous.fertigasi,
    pompa: next.pompa ?? previous.pompa,
    mode: next.mode ?? previous.mode,
    activeValve: next.activeValve ?? previous.activeValve,
    ph: next.ph !== undefined ? next.ph : previous.ph,
    flowRate: next.flowRate !== undefined ? next.flowRate : previous.flowRate,
    currentLiters: next.currentLiters !== undefined ? next.currentLiters : previous.currentLiters,
    totalLiters: next.totalLiters !== undefined ? next.totalLiters : previous.totalLiters,
    targetLiters: next.targetLiters !== undefined ? next.targetLiters : previous.targetLiters,
    lampuMode: next.lampuMode !== undefined ? next.lampuMode : (next.mode ? next.mode === 'auto' : previous.lampuMode),
    lampuSystem: next.lampuSystem !== undefined ? next.lampuSystem : (next.lampuMode !== undefined ? next.lampuMode : previous.lampuSystem),
    lampuOnline: next.lampuOnline !== undefined ? next.lampuOnline : previous.lampuOnline,
    updatedAt: new Date().toISOString(),
    sourceTopic,
  };

  if (typeof window !== 'undefined') {
    try {
      if (actuatorSnapshot.mode) {
        localStorage.setItem('teranova_control_mode', actuatorSnapshot.mode);
      }
      localStorage.setItem('teranova_gateway_actuator', JSON.stringify(actuatorSnapshot));
    } catch {
      // ignore
    }
  }

  setSnapshot({ actuatorSnapshot });
}

function setScheduleSnapshot(
  next: Partial<Omit<MqttScheduleSnapshot, 'updatedAt' | 'sourceTopic'>>,
  sourceTopic: string,
) {
  const previous = scheduleSnapshot;
  scheduleSnapshot = {
    ...previous,
    schedule_enabled: next.schedule_enabled !== undefined ? next.schedule_enabled : previous.schedule_enabled,
    watering_time: next.watering_time !== undefined ? next.watering_time : previous.watering_time,
    watering_duration: next.watering_duration !== undefined ? next.watering_duration : previous.watering_duration,
    time_valid: next.time_valid !== undefined ? next.time_valid : previous.time_valid,
    current_time: next.current_time !== undefined ? next.current_time : previous.current_time,
    last_watered: next.last_watered !== undefined ? next.last_watered : previous.last_watered,
    updatedAt: new Date().toISOString(),
    sourceTopic,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('teranova_gateway_schedule', JSON.stringify(scheduleSnapshot));
    } catch {
      // ignore
    }
  }

  setSnapshot({ scheduleSnapshot });
}

function normalizeJsonSensorPayload(payload: string): SensorDelta | null {
  try {
    const obj = JSON.parse(payload);
    if (!obj || typeof obj !== 'object') return null;

    const nodeIdParsed = parseNumeric(obj.node_id);
    const flowRate = parseNumeric(obj.flow_rate);
    const totalWater = parseNumeric(obj.total_water ?? obj.total_liters);
    const sessionWater = parseNumeric(obj.session_water ?? obj.session_liters);
    const phVal = parseNumeric(obj.ph);

    return {
      device_id: typeof obj.device_id === 'string' ? obj.device_id : (nodeIdParsed === 0 || flowRate != null || phVal != null ? 'ESP32_Gateway' : undefined),
      node_id: nodeIdParsed ?? (flowRate != null || phVal != null ? 0 : null),
      temperature: 'temperature' in obj ? parseNumeric(obj.temperature) : undefined,
      humidity: 'humidity' in obj ? parseNumeric(obj.humidity) : undefined,
      soil_moisture: ('soil_moisture' in obj) ? parseNumeric(obj.soil_moisture) : (('soil' in obj) ? parseNumeric(obj.soil) : undefined),
      soil_temp: ('soil_temp' in obj) ? parseNumeric(obj.soil_temp) : (('battery' in obj && nodeIdParsed === 3) ? parseNumeric(obj.battery) : undefined),
      fwi: ('fwi' in obj) ? parseNumeric(obj.fwi) : (('fwi_score' in obj) ? parseNumeric(obj.fwi_score) : undefined),
      fwi_level: 'fwi_level' in obj ? parseNumeric(obj.fwi_level) : undefined,
      fwi_status: typeof obj.fwi_status === 'string' ? obj.fwi_status : undefined,
      ph: 'ph' in obj ? phVal : undefined,
      flow_rate: 'flow_rate' in obj ? flowRate : undefined,
      total_water: ('total_water' in obj || 'total_liters' in obj) ? totalWater : undefined,
      session_water: ('session_water' in obj || 'session_liters' in obj) ? sessionWater : undefined,
      valve_status: typeof obj.active_valve === 'string' ? obj.active_valve : (typeof obj.valve_status === 'string' ? obj.valve_status : undefined),
      simulation: obj.simulation === true,
      ffmc: 'ffmc' in obj ? parseNumeric(obj.ffmc) : undefined,
      dmc: 'dmc' in obj ? parseNumeric(obj.dmc) : undefined,
      dc: 'dc' in obj ? parseNumeric(obj.dc) : undefined,
      isi: 'isi' in obj ? parseNumeric(obj.isi) : undefined,
      bui: 'bui' in obj ? parseNumeric(obj.bui) : undefined,
    };
  } catch {
    return null;
  }
}

function parseStatusValue(payload: string): boolean | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (['online', 'connected', 'true', '1', 'on', 'ready', 'active'].includes(lower)) return true;
  if (['offline', 'disconnected', 'false', '0', 'off', 'inactive', 'error'].includes(lower)) return false;

  try {
    const obj = JSON.parse(trimmed);
    if (!obj || typeof obj !== 'object') return null;
    const candidate =
      (obj as Record<string, unknown>).status ??
      (obj as Record<string, unknown>).state ??
      (obj as Record<string, unknown>).online ??
      (obj as Record<string, unknown>).connected;
    if (typeof candidate === 'boolean') return candidate;
    if (typeof candidate === 'number') return candidate !== 0;
    if (typeof candidate === 'string') return parseStatusValue(candidate);
  } catch {
    return null;
  }

  return null;
}

function updateFromTopic(topic: string, payload: string) {
  const now = new Date().toISOString();
  const trimmed = payload.trim();

  if (topic === DEVICE_BOOT_TOPIC) {
    const parsed = parseMqttJsonPayload(trimmed);
    const bootCount = parsed ? parseNumeric(parsed.boot_count) : null;
    const resetReason = parsed?.reset_reason;
    const resetReasonCode = parsed ? parseNumeric(parsed.reset_reason_code) : null;
    const uptimeMs = parsed ? parseNumeric(parsed.uptime_ms) : null;

    if (
      bootCount === null ||
      !Number.isInteger(bootCount) ||
      bootCount < 1 ||
      typeof resetReason !== 'string' ||
      resetReason.length === 0 ||
      resetReasonCode === null ||
      uptimeMs === null ||
      uptimeMs < 0
    ) {
      console.warn('[MQTT] Diagnostik boot ESP32 tidak valid:', payload);
      return;
    }

    bootDiagnosticSnapshot = {
      bootCount,
      resetReason,
      resetReasonCode,
      uptimeMs,
      updatedAt: now,
    };
    setSnapshot({
      bootDiagnosticSnapshot,
      lastTopic: topic,
      lastPayload: payload,
      lastMessageAt: now,
    });
    return;
  }

  if (topic === DEVICE_PANIC_TOPIC) {
    const parsed = parseMqttJsonPayload(trimmed);
    const errorCode = parsed ? parseNumeric(parsed.error_code) : null;
    const available = parsed?.available;
    const rawBacktrace = parsed?.backtrace;

    if (
      typeof available !== 'boolean' ||
      errorCode === null ||
      (rawBacktrace !== undefined &&
        (!Array.isArray(rawBacktrace) ||
          rawBacktrace.some((address) => typeof address !== 'string')))
    ) {
      console.warn('[MQTT] Ringkasan core dump ESP32 tidak valid:', payload);
      return;
    }

    panicDumpSnapshot = {
      available,
      errorCode,
      publishedAfterResetReason: typeof parsed.published_after_reset_reason === 'string'
        ? parsed.published_after_reset_reason
        : 'UNKNOWN',
      task: typeof parsed.task === 'string' ? parsed.task : null,
      pc: typeof parsed.pc === 'string' ? parsed.pc : null,
      exceptionCause: parseNumeric(parsed.exception_cause),
      exceptionAddress: typeof parsed.exception_address === 'string' ? parsed.exception_address : null,
      backtrace: Array.isArray(rawBacktrace) ? rawBacktrace.filter((address): address is string => typeof address === 'string').slice(0, 16) : [],
      backtraceCorrupted: typeof parsed.backtrace_corrupted === 'boolean' ? parsed.backtrace_corrupted : null,
      firmwareElfSha256: typeof parsed.firmware_elf_sha256 === 'string' ? parsed.firmware_elf_sha256 : null,
      updatedAt: now,
    };
    setSnapshot({
      panicDumpSnapshot,
      lastTopic: topic,
      lastPayload: payload,
      lastMessageAt: now,
    });
    return;
  }

  if (topic === TOPIC_FLOW_RESET_STATUS) {
    const parsed = parseMqttJsonPayload(trimmed);
    const requestId = parsed?.request_id;
    const counter = parsed?.counter;
    const state = parsed?.state;
    const sessionLiters = parsed ? parseNumeric(parsed.session_liters) : null;
    const totalLiters = parsed ? parseNumeric(parsed.total_liters) : null;

    if (
      typeof requestId !== 'string' ||
      requestId.length === 0 ||
      (counter !== 'session' && counter !== 'total') ||
      (state !== 'queued' && state !== 'accepted' && state !== 'rejected' && state !== 'error') ||
      typeof parsed?.message !== 'string' ||
      sessionLiters === null ||
      totalLiters === null
    ) {
      console.warn('[MQTT] Status reset volume ESP32 tidak valid:', payload);
      return;
    }

    flowCounterResetSnapshot = {
      requestId,
      counter,
      state,
      message: parsed.message,
      sessionLiters,
      totalLiters,
      updatedAt: now,
    };
    setActuatorSnapshot({
      currentLiters: sessionLiters,
      totalLiters,
    }, topic);
    setSnapshot({
      flowCounterResetSnapshot,
      lastTopic: topic,
      lastPayload: payload,
      lastMessageAt: now,
    });
    return;
  }

  if (topic === DEVICE_STATUS_TOPIC) {
    const parsedStatus = parseStatusValue(trimmed);
    const isOnline = parsedStatus ?? true;

    setSnapshot({
      espOnline: isOnline,
      espLastSeenAt: now,
      lastTopic: topic,
      lastPayload: payload,
      lastMessageAt: now,
    });
    return;
  }

  if (topic === SYSTEM_STATUS_TOPIC) {
    setSnapshot({
      lastTopic: topic,
      lastPayload: payload,
      lastMessageAt: now,
    });
    return;
  }

  if (topic === TOPIC_ACTUATOR_STATUS) {
    const actuator = parseActuatorStatusPayload(trimmed);
    if (actuator) setActuatorSnapshot(actuator, topic);

    setSnapshot({
      lastTopic: topic,
      lastPayload: payload,
      lastMessageAt: now,
    });
    return;
  }

  if (topic === TOPIC_POMPA_STATUS) {
    const pompa = parseBoolean(trimmed);
    if (pompa !== undefined) setActuatorSnapshot({ pompa }, topic);
  }

  if (topic === TOPIC_MODE_STATUS) {
    const mode = parseMode(trimmed);
    if (mode !== undefined) setActuatorSnapshot({ mode }, topic);
  }

  if (topic === TOPIC_FLOW) {
    const parsed = normalizeJsonSensorPayload(payload);
    if (parsed) {
      setSensorSnapshot(parsed, topic, false);
      setActuatorSnapshot({
        flowRate: parsed.flow_rate,
        currentLiters: parsed.session_water,
        totalLiters: parsed.total_water,
        activeValve: parsed.valve_status ?? undefined,
      }, topic);
      setSnapshot({
        lastTopic: topic,
        lastPayload: payload,
        lastMessageAt: now,
      });
    }
    return;
  }

  if (topic === TOPIC_PH) {
    let phVal: number | null = null;
    let simulated = false;
    try {
      const obj = JSON.parse(trimmed);
      if (typeof obj === 'number') phVal = obj;
      else if (obj && typeof obj === 'object') {
        phVal = parseNumeric(obj.ph);
        simulated = obj.simulation === true;
      }
    } catch {
      phVal = parseNumeric(trimmed);
    }
    if (phVal != null) {
      setSensorSnapshot({ node_id: 0, ph: phVal, device_id: 'ESP32_Gateway', simulation: simulated }, topic, false);
      setActuatorSnapshot({ ph: phVal }, topic);
      setSnapshot({
        lastTopic: topic,
        lastPayload: payload,
        lastMessageAt: now,
      });
    }
    return;
  }

  if (topic === TOPIC_LAMPU_SYSTEM_STATUS || topic === TOPIC_LAMPU_MODE_STATUS) {
    const isLampOn = parseBoolean(trimmed);
    if (isLampOn !== undefined) setActuatorSnapshot({ lampuSystem: isLampOn, lampuMode: isLampOn }, topic);
  }

  if (topic === TOPIC_LAMPU_ONLINE_STATUS) {
    const isLampOn = parseBoolean(trimmed);
    if (isLampOn !== undefined) setActuatorSnapshot({ lampuOnline: isLampOn }, topic);
  }

  if (
    topic === TOPIC_SENSOR_JSON ||
    topic === TOPIC_KARHUTLA_FWI ||
    topic === TOPIC_KARHUTLA_ALERT ||
    topic.startsWith('sproutai/sensor/node/')
  ) {
    const parsed = normalizeJsonSensorPayload(payload);
    if (parsed) {
      setSensorSnapshot(parsed, topic, false);
      if (parsed.node_id === 0) {
        if (parsed.ph != null) setActuatorSnapshot({ ph: parsed.ph }, topic);
        if (parsed.flow_rate != null) setActuatorSnapshot({ flowRate: parsed.flow_rate }, topic);
      }
      setSnapshot({
        lastTopic: topic,
        lastPayload: payload,
        lastMessageAt: now,
      });
    }
    return;
  }

  if (topic === TOPIC_SETTINGS_CMD || topic === TOPIC_SETTINGS_STATUS) {
    const parsed = parseMqttJsonPayload(trimmed);
    if (parsed) {
      applySettingsSnapshot(parsed, topic);
    }
  }

  if (topic === TOPIC_SCHEDULE_STATUS || topic === TOPIC_SCHEDULE_CMD) {
    const parsed = parseMqttJsonPayload(trimmed);
    if (parsed) {
      const schedEn = parseBoolean(parsed.schedule_enabled ?? parsed.watering_enabled ?? parsed.se);
      const wt = typeof parsed.watering_time === 'string'
        ? parsed.watering_time.trim()
        : (typeof parsed.wt === 'string' ? parsed.wt.trim() : undefined);
      const wd = parseNumeric(parsed.watering_duration ?? parsed.wd);
      const tv = parseBoolean(parsed.time_valid);
      const ct = typeof parsed.current_time === 'string' ? parsed.current_time : undefined;
      const lw = typeof parsed.last_watered === 'string'
        ? parsed.last_watered
        : (typeof parsed.last_watered_time === 'string' ? parsed.last_watered_time : undefined);

      setScheduleSnapshot({
        schedule_enabled: schedEn ?? undefined,
        watering_time: wt ?? undefined,
        watering_duration: wd ?? undefined,
        time_valid: tv ?? undefined,
        current_time: ct ?? undefined,
        last_watered: lw ?? undefined,
      }, topic);
    }
  }

  if (
    topic.startsWith('sproutai/sensor/') ||
    topic.startsWith('sproutai/pompa/') ||
    topic.startsWith('sproutai/lampu/') ||
    topic.startsWith('sproutai/mode/') ||
    topic.startsWith('sproutai/wifi/') ||
    topic.startsWith('sproutai/settings/') ||
    topic.startsWith('sproutai/schedule/') ||
    topic.startsWith('sproutai/esp32/') ||
    topic.startsWith('sproutai/system/')
  ) {
    setSnapshot({
      lastTopic: topic,
      lastPayload: payload,
      lastMessageAt: now,
    });
  }
}

async function connectOnce() {
  if (client || !BROKER_URL) return client;

  if (!isWebSocketBroker(BROKER_URL)) {
    console.error('[MQTT] invalid broker URL', BROKER_URL);
    setSnapshot({
      mqttError: 'VITE_BROKER_URL harus ws:// atau wss:// untuk browser.',
      mqttConnecting: false,
    });
    return null;
  }

  const { default: mqtt } = await import('mqtt');
  if (client) return client;

  client = mqtt.connect(BROKER_URL, {
    username: MQTT_USERNAME || undefined,
    password: MQTT_PASSWORD || undefined,
    reconnectPeriod: 3000,
    connectTimeout: 20000,
    clean: true,
    keepalive: 60,
    reschedulePings: true,
    clientId: `nexagrow_web_${Math.random().toString(16).slice(2, 10)}`,
  });

  client.on('connect', () => {
    console.debug('[MQTT] connected to broker', BROKER_URL);
    setSnapshot({
      mqttConnected: true,
      mqttConnecting: false,
      mqttReconnecting: false,
      mqttError: null,
    });

    for (const topic of SUBSCRIBE_TOPICS) {
      client?.subscribe(topic, { qos: 1 });
    }

    announceWebPresence('online').catch((error: unknown) => {
      console.error('[MQTT] gagal mengirim status web:', error);
    });

    // Otomatis sinkronkan waktu browser ke ESP32 agar RTC tepat dan sinkron
    try {
      const epoch = Math.floor(Date.now() / 1000);
      client?.publish('sproutai/time/cmd', JSON.stringify({ epoch }), { qos: 0 });
    } catch {}

    setSnapshot({ webPublishedAt: new Date().toISOString() });
  });

  client.on('reconnect', () => {
    console.debug('[MQTT] reconnecting');
    setSnapshot({
      mqttConnected: false,
      mqttConnecting: true,
      mqttReconnecting: true,
    });
  });

  client.on('offline', () => {
    console.warn('[MQTT] offline');
    setSnapshot({
      mqttConnected: false,
      mqttConnecting: false,
      mqttReconnecting: false,
    });
  });

  client.on('close', () => {
    console.warn('[MQTT] connection closed');
    setSnapshot({
      mqttConnected: false,
      mqttConnecting: false,
    });
  });

  client.on('error', (err: Error) => {
    const isTimeout = /keepalive|connack/i.test(err?.message || '');
    if (isTimeout) {
      console.warn('[MQTT] transient connection event:', err.message);
      setSnapshot({
        mqttConnected: false,
        mqttConnecting: true,
        mqttReconnecting: true,
      });
    } else {
      console.error('[MQTT] error', err.message);
      setSnapshot({
        mqttConnected: false,
        mqttConnecting: false,
        mqttError: err.message,
      });
    }
  });

  client.on('message', (topic: string, message: Buffer) => {
    const payload = message.toString();
    updateFromTopic(topic, payload);
    consumePendingMqttAcks(topic, payload);
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (client?.connected) {
        client.publish(
          WEB_STATUS_TOPIC,
          JSON.stringify({
            device: 'sprout-web',
            status: 'offline',
            at: new Date().toISOString(),
          }),
          { retain: true, qos: 0 },
        );
      }
    });
  }

  return client;
}

function isWebSocketBroker(url: string) {
  return /^wss?:\/\//i.test(url);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setSnapshot({ browserOnline: true }));
  window.addEventListener('offline', () => setSnapshot({ browserOnline: false }));
  window.setInterval(() => emit(), 3000);
}

export async function getMqttClient() {
  return connectOnce();
}

export function getMqttStatusSnapshot() {
  return snapshot;
}

export function getSensorSnapshot() {
  return snapshot.sensorSnapshot;
}

export function getNodeSensorSnapshot(nodeId: number): MqttSensorSnapshot | null {
  return sensorSnapshotByNode.get(nodeId) ?? null;
}

export function getScheduleSnapshot(): MqttScheduleSnapshot {
  return scheduleSnapshot;
}

export async function syncBrowserTimeToEsp32(): Promise<void> {
  try {
    const epoch = Math.floor(Date.now() / 1000);
    await publishMqtt('sproutai/time/cmd', JSON.stringify({ epoch }), { qos: 0 });
  } catch (e) {
    console.warn('[MQTT] Gagal mengirim sinkronisasi waktu browser:', e);
  }
}

export function getSensorHistorySnapshot() {
  return sensorHistory.slice();
}

export function subscribeMqttStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function publishMqtt(
  topic: string,
  payload: string,
  options: Record<string, unknown> = {},
) {
  const currentClient = await connectOnce();
  if (!currentClient) {
    console.error('[MQTT] client unavailable for publish', topic, payload);
    throw new Error('MQTT client belum tersedia');
  }

  console.debug('[MQTT] publish', {
    topic,
    payload,
    connected: currentClient.connected,
    options,
  });

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('MQTT publish timeout'));
    }, 7000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      currentClient.off('connect', onConnect);
      currentClient.off('error', onError);
    };

    const onError = (err: Error) => {
      cleanup();
      console.error('[MQTT] publish failed', topic, payload, err.message);
      reject(err);
    };

    const onConnect = () => {
      currentClient.publish(
        topic,
        payload,
        { qos: 1, retain: false, ...options },
        (err: Error | null | undefined) => {
          cleanup();
          if (err) {
            console.error('[MQTT] publish callback error', topic, payload, err.message);
            reject(err);
            return;
          }

          console.debug('[MQTT] publish success', topic, payload);
          snapshot = {
            ...snapshot,
            lastTopic: topic,
            lastPayload: payload,
            lastMessageAt: new Date().toISOString(),
          };
          emit();
          resolve();
        },
      );
    };

    if (currentClient.connected) {
      onConnect();
      return;
    }

    currentClient.once('connect', onConnect);
    currentClient.once('error', onError);
  });
}

export async function publishMqttWithAck(
  topic: string,
  payload: string,
  ackTopic: string,
  matcher: (topic: string, payload: string) => boolean,
  timeoutMs = 12000,
  options: Record<string, unknown> = {},
) {
  const currentClient = await connectOnce();
  if (!currentClient) {
    throw new Error('MQTT client belum tersedia');
  }

  console.debug('[MQTT] publishWithAck', { topic, payload, ackTopic, options });

  return new Promise<void>((resolve, reject) => {
    let timeoutId = 0;
    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      pendingMqttAcks.delete(waiter);
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for MQTT ACK on ${ackTopic}`));
    }, timeoutMs);

    const waiter: MqttAckWaiter = {
      topic: ackTopic,
      matcher,
      resolve: () => {
        cleanup();
        resolve();
      },
      reject: (error: Error) => {
        cleanup();
        reject(error);
      },
      timeoutId,
    };

    pendingMqttAcks.add(waiter);

    publishMqtt(topic, payload, options).catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

export async function resetFlowCounter(
  counter: MqttFlowCounterResetSnapshot['counter'],
): Promise<MqttFlowCounterResetSnapshot> {
  const requestId = `flow-reset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const payload = JSON.stringify({ request_id: requestId, counter });

  await publishMqttWithAck(
    TOPIC_FLOW_RESET_COMMAND,
    payload,
    TOPIC_FLOW_RESET_STATUS,
    (_topic, message) => {
      const response = parseMqttJsonPayload(message);
      return response?.request_id === requestId &&
        response.counter === counter &&
        response.state !== 'queued';
    },
    15_000,
    { retain: false, qos: 1 },
  );

  const response = flowCounterResetSnapshot;
  if (!response || response.requestId !== requestId || response.counter !== counter) {
    throw new Error('ESP32 tidak mengirim status hasil reset volume.');
  }
  if (response.state !== 'accepted') {
    throw new Error(response.message || 'ESP32 menolak reset volume.');
  }
  return response;
}

function applyLocalSnapshot(action: string, duration?: number, data?: Record<string, any>) {
  const now = new Date().toISOString();

  switch (action) {
    case 'settings_sync': {
      const nextSettings = {
        plant_phase: String(data?.plant_phase ?? data?.crop_mode ?? '').trim() || undefined,
        location: String(data?.location ?? '').trim() || undefined,
        temperature_high: parseNumeric(data?.temp_threshold_high),
        temperature_low: parseNumeric(data?.temp_threshold_low),
        humidity_high: parseNumeric(data?.humidity_threshold_high),
        humidity_low: parseNumeric(data?.humidity_threshold_low),
        soil_threshold_critical: parseNumeric(data?.soil_threshold_critical),
        soil_threshold_high: parseNumeric(data?.soil_threshold_high),
        soil_threshold_low: parseNumeric(data?.soil_threshold_low),
        watering_time: typeof data?.watering_time === 'string' ? data.watering_time : undefined,
        watering_duration: parseNumeric(data?.watering_duration),
        watering_enabled: data?.watering_enabled === undefined ? undefined : Boolean(data.watering_enabled),
        auto_report: data?.auto_report === undefined ? undefined : Boolean(data.auto_report),
        report_time: typeof data?.report_time === 'string' ? data.report_time : undefined,
        user_name: typeof data?.user_name === 'string' ? data.user_name : undefined,
        user_email: typeof data?.user_email === 'string' ? data.user_email : undefined,
      } as Record<string, unknown>;

      dispatchSettingsEvent(nextSettings);
      break;
    }
    case 'mode_auto':
      setActuatorSnapshot({ mode: 'auto' }, action);
      break;
    case 'mode_manual':
      setActuatorSnapshot({ mode: 'manual' }, action);
      break;
    case 'irrigation_on':
      setActuatorSnapshot({ irigasi: true, fertigasi: false, pompa: true, activeValve: 'IRIGASI' }, action);
      break;
    case 'irrigation_off':
      setActuatorSnapshot({ irigasi: false, fertigasi: false, pompa: false, activeValve: 'IDLE' }, action);
      break;
    case 'fertigation_on':
      setActuatorSnapshot({ irigasi: false, fertigasi: true, pompa: true, activeValve: 'FERTIGASI' }, action);
      break;
    case 'fertigation_off':
      setActuatorSnapshot({ irigasi: false, fertigasi: false, pompa: false, activeValve: 'IDLE' }, action);
      break;
    default:
      break;
  }

  setSnapshot({
    lastTopic: action,
    lastPayload: data ? JSON.stringify(data) : duration != null ? String(duration) : action,
    lastMessageAt: now,
  });
}

export function syncLocalControlState(action: string, duration?: number, data?: Record<string, any>) {
  applyLocalSnapshot(action, duration, data);
}

/**
 * Publish rain chance data to MQTT for ESP32 consumption.
 * This is called automatically every 3 hours (or when value changes)
 * from App.tsx so it works without opening Settings page.
 */
export async function publishRainChance(rainChance: number) {
  const currentClient = await connectOnce();
  if (!currentClient) return Promise.resolve(false);

  const payload = JSON.stringify({
    rainChance: Math.round(rainChance),
    timestamp: new Date().toISOString(),
  });

  return new Promise<boolean>((resolve) => {
    currentClient.publish(
      TOPIC_RAIN_CHANCE,
      payload,
      { retain: true, qos: 1 },
      (err?: Error | null) => {
        if (err) {
          console.warn('[RAIN] publish rainChance failed', err.message);
          resolve(false);
          return;
        }
        console.debug('[RAIN] published rainChance', rainChance, '%');
        resolve(true);
      },
    );
  });
}

export async function announceWebPresence(status: 'online' | 'offline' = 'online') {
  const currentClient = await connectOnce();
  if (!currentClient) return Promise.resolve(false);

  const payload = JSON.stringify({
    device: 'sprout-web',
    status,
    at: new Date().toISOString(),
  });

  return new Promise<boolean>((resolve) => {
    currentClient.publish(
      WEB_STATUS_TOPIC,
      payload,
      { retain: true, qos: 0 },
      () => {
        setSnapshot({
          webPublishedAt: new Date().toISOString(),
          lastTopic: WEB_STATUS_TOPIC,
          lastPayload: payload,
          lastMessageAt: new Date().toISOString(),
        });
        resolve(true);
      },
    );
  });
}
