import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Droplets,
  Flame,
  FlaskConical,
  Gauge,
  Play,
  RotateCcw,
  ShieldCheck,
  Thermometer,
} from 'lucide-react';
import { DEFAULT_SETTINGS, useSettings } from '../context/SettingsContext';
import { useMqttStatus } from '../hooks/useMqttStatus';
import {
  createSimulationRequestId,
  evaluateSimulationOnEsp32,
  stopAutomaticSimulationOnEsp32,
} from '../services/mqtt';
import type { MqttSimulationSnapshot } from '../services/mqtt';
import {
  evaluateIrrigationScenario,
  type IrrigationSimulationInput,
  type IrrigationSimulationResult,
  type SimulationPhase,
} from '../lib/irrigationSimulation';

type SimulationForm = {
  soil1: string;
  soil2: string;
  temperature1: string;
  temperature2: string;
  humidity1: string;
  humidity2: string;
  rainChance: string;
  ph: string;
  node3Online: boolean;
  peatTemperature: string;
  node3Temperature: string;
  node3Humidity: string;
  wind: string;
  timeValid: boolean;
  hour: string;
  minute: string;
  day: string;
  month: string;
  fertilizerInterval: string;
  lastFertilizerDay: string;
  lastFertilizerMonth: string;
  fertilizerOverride: 'calculated' | 'due' | 'not-due';
  automaticMode: boolean;
  previousCycleActive: boolean;
  irrigationCooldownReady: boolean;
  fireCooldownReady: boolean;
  scheduleEnabled: boolean | null;
  scheduleAlreadyDone: boolean;
  scheduleTime: string;
  scheduleDurationSeconds: string;
  previousFfmc: string;
  previousDmc: string;
  previousDc: string;
  fireLevelOverride: string;
  criticalSoil: string;
  upperSoil: string;
  activeScoreThreshold: string;
  lowerScoreThreshold: string;
  highTemperatureThreshold: string;
  lowHumidityThreshold: string;
};

const fieldClassName =
  'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

function makeInitialForm(): SimulationForm {
  const now = new Date();
  return {
    soil1: '30',
    soil2: '34',
    temperature1: '28',
    temperature2: '29',
    humidity1: '65',
    humidity2: '62',
    rainChance: '0',
    ph: '6.5',
    node3Online: false,
    peatTemperature: '32',
    node3Temperature: '30',
    node3Humidity: '65',
    wind: '5',
    timeValid: true,
    hour: String(now.getHours()),
    minute: String(now.getMinutes()),
    day: String(now.getDate()),
    month: String(now.getMonth() + 1),
    fertilizerInterval: '2',
    lastFertilizerDay: '-1',
    lastFertilizerMonth: String(now.getMonth() + 1),
    fertilizerOverride: 'calculated',
    automaticMode: true,
    previousCycleActive: false,
    irrigationCooldownReady: true,
    fireCooldownReady: true,
    scheduleEnabled: null,
    scheduleAlreadyDone: false,
    scheduleTime: '',
    scheduleDurationSeconds: '',
    previousFfmc: '85',
    previousDmc: '30',
    previousDc: '200',
    fireLevelOverride: '',
    criticalSoil: '',
    upperSoil: '',
    activeScoreThreshold: '',
    lowerScoreThreshold: '',
    highTemperatureThreshold: '',
    lowHumidityThreshold: '',
  };
}

function numberValue(value: string, label: string, min: number, max: number) {
  const parsed = Number(value);
  if (value.trim() === '' || !Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} harus bernilai ${min} sampai ${max}.`);
  }
  return parsed;
}

function optionalNumber(value: string, fallback: number, label: string, min: number, max: number) {
  return value.trim() === '' ? fallback : numberValue(value, label, min, max);
}

function nullableNumber(value: string, label: string, min: number, max: number) {
  return value.trim() === '' ? null : numberValue(value, label, min, max);
}

function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label} <span className="text-slate-500">({unit})</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rentang {min}–{max} {unit}</p>
    </div>
  );
}

function CheckField({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-green-700"
      />
      <span>
        <span className="block font-medium text-slate-800 dark:text-slate-100">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
    </label>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-green-100 p-2 text-green-700 dark:bg-green-500/15 dark:text-green-300" aria-hidden="true">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 sm:text-right">{value}</dd>
    </div>
  );
}

function formatValue(value: number | null | undefined, digits = 2) {
  return value == null ? '—' : value.toFixed(digits);
}

export function SimulationPage() {
  const { settings: storedSettings, loading: settingsLoading } = useSettings();
  const {
    actuatorSnapshot,
    espOnline,
    mqttConnected,
    sensorSnapshot,
    simulationSnapshot,
  } = useMqttStatus();
  const settings = storedSettings ?? DEFAULT_SETTINGS;
  const [form, setForm] = useState<SimulationForm>(makeInitialForm);
  const [phaseChoice, setPhaseChoice] = useState<'settings' | SimulationPhase>('settings');
  const [result, setResult] = useState<IrrigationSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulationRequestId, setSimulationRequestId] = useState<string | null>(null);
  const [firmwarePreviewResult, setFirmwarePreviewResult] = useState<MqttSimulationSnapshot | null>(null);
  const [previewInput, setPreviewInput] = useState<IrrigationSimulationInput | null>(null);
  const previewRequestIdRef = useRef<string | null>(null);
  const [firmwareSimulationPending, setFirmwareSimulationPending] = useState(false);
  const [firmwareSimulationError, setFirmwareSimulationError] = useState<string | null>(null);
  const [physicalExecutionRequestId, setPhysicalExecutionRequestId] = useState<string | null>(null);
  const [physicalExecutionResult, setPhysicalExecutionResult] = useState<MqttSimulationSnapshot | null>(null);
  const [physicalExecutionConfirmed, setPhysicalExecutionConfirmed] = useState(false);
  const [physicalStopPending, setPhysicalStopPending] = useState(false);
  const [physicalStopError, setPhysicalStopError] = useState<string | null>(null);

  const phase = phaseChoice === 'settings' ? settings.plant_phase : phaseChoice;
  const scheduleEnabled = form.scheduleEnabled ?? settings.watering_enabled;

  const updateForm = <K extends keyof SimulationForm,>(key: K, value: SimulationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setResult(null);
    setError(null);
    setSimulationRequestId(null);
    previewRequestIdRef.current = null;
    setFirmwarePreviewResult(null);
    setPreviewInput(null);
    setFirmwareSimulationError(null);
    setPhysicalExecutionRequestId(null);
    setPhysicalExecutionResult(null);
    setPhysicalExecutionConfirmed(false);
  };

  const makeInput = (): IrrigationSimulationInput => {
    const activeScoreDefault = phase === 'vegetatif' ? 55 : 60;
    const lowerScoreDefault = phase === 'vegetatif' ? 25 : 35;
    const scheduledTime = form.scheduleTime || settings.watering_time;
    const scheduleDurationSeconds = optionalNumber(
      form.scheduleDurationSeconds,
      settings.watering_duration,
      'Durasi jadwal',
      1,
      3_600,
    );
    const fireOverride = form.fireLevelOverride.trim() === ''
      ? null
      : numberValue(form.fireLevelOverride, 'Override level FWI', 0, 4);

    return {
      node1: {
        soil: nullableNumber(form.soil1, 'Kelembapan tanah Node 1', 0, 100),
        temperature: nullableNumber(form.temperature1, 'Suhu Node 1', -40, 80),
        humidity: nullableNumber(form.humidity1, 'RH Node 1', 0, 100),
      },
      node2: {
        soil: nullableNumber(form.soil2, 'Kelembapan tanah Node 2', 0, 100),
        temperature: nullableNumber(form.temperature2, 'Suhu Node 2', -40, 80),
        humidity: nullableNumber(form.humidity2, 'RH Node 2', 0, 100),
      },
      rainChance: numberValue(form.rainChance, 'Peluang hujan', 0, 100),
      ph: numberValue(form.ph, 'pH larutan', 0, 14),
      phase,
      automaticMode: form.automaticMode,
      node3Online: form.node3Online,
      node3SoilTemp: nullableNumber(form.peatTemperature, 'Suhu tanah gambut', -40, 100),
      node3AmbientTemp: nullableNumber(form.node3Temperature, 'Suhu udara Node 3', -40, 80),
      node3AmbientRh: nullableNumber(form.node3Humidity, 'RH Node 3', 0, 100),
      windKmh: numberValue(form.wind, 'Kecepatan angin', 0, 150),
      previousFfmc: numberValue(form.previousFfmc, 'FFMC sebelumnya', 0, 101),
      previousDmc: numberValue(form.previousDmc, 'DMC sebelumnya', 0, 10_000),
      previousDc: numberValue(form.previousDc, 'DC sebelumnya', 0, 10_000),
      fireLevelOverride: fireOverride,
      criticalSoil: optionalNumber(form.criticalSoil, settings.soil_threshold_critical, 'Ambang tanah kritis', 0, 100),
      upperSoil: optionalNumber(form.upperSoil, settings.soil_threshold_high, 'Ambang tanah atas', 0, 100),
      activeScoreThreshold: optionalNumber(form.activeScoreThreshold, activeScoreDefault, 'Ambang skor aktif', 0, 100),
      lowerScoreThreshold: optionalNumber(form.lowerScoreThreshold, lowerScoreDefault, 'Ambang skor bawah', 0, 100),
      highTemperatureThreshold: optionalNumber(form.highTemperatureThreshold, settings.temp_threshold_high, 'Ambang suhu tinggi', 0, 80),
      lowHumidityThreshold: optionalNumber(form.lowHumidityThreshold, settings.humidity_threshold_low, 'Ambang RH rendah', 0, 100),
      previousCycleActive: form.previousCycleActive,
      irrigationCooldownReady: form.irrigationCooldownReady,
      fireCooldownReady: form.fireCooldownReady,
      timeValid: form.timeValid,
      hour: numberValue(form.hour, 'Jam', 0, 23),
      minute: numberValue(form.minute, 'Menit', 0, 59),
      day: numberValue(form.day, 'Tanggal', 1, 31),
      month: numberValue(form.month, 'Bulan', 1, 12),
      fertilizerIntervalDays: numberValue(form.fertilizerInterval, 'Interval fertigasi', 1, 30),
      lastFertilizerDay: numberValue(form.lastFertilizerDay, 'Tanggal fertigasi terakhir', -1, 31),
      lastFertilizerMonth: numberValue(form.lastFertilizerMonth, 'Bulan fertigasi terakhir', -1, 12),
      fertilizerDueOverride: form.fertilizerOverride === 'calculated'
        ? null
        : form.fertilizerOverride === 'due',
      scheduleEnabled,
      scheduleTime: scheduledTime,
      scheduleDurationSeconds: Math.round(scheduleDurationSeconds),
      scheduleAlreadyDone: form.scheduleAlreadyDone,
    };
  };

  const runSimulation = async () => {
    setError(null);
    setFirmwareSimulationError(null);
    let requestStarted = false;
    try {
      const input = makeInput();
      setResult(evaluateIrrigationScenario(input));
      const requestId = createSimulationRequestId();
      setSimulationRequestId(requestId);
      previewRequestIdRef.current = requestId;
      setFirmwarePreviewResult(null);
      setPreviewInput(input);
      setPhysicalExecutionRequestId(null);
      setPhysicalExecutionResult(null);
      setPhysicalExecutionConfirmed(false);
      setFirmwareSimulationPending(true);
      requestStarted = true;
      const preview = await evaluateSimulationOnEsp32(requestId, input);
      if (previewRequestIdRef.current === requestId) {
        setFirmwarePreviewResult(preview);
      }
    } catch (cause) {
      if (!requestStarted) {
        setResult(null);
        setError(cause instanceof Error ? cause.message : 'Input simulasi tidak valid.');
      } else {
        setFirmwareSimulationError(cause instanceof Error ? cause.message : 'ESP32 tidak dapat mengevaluasi simulasi.');
      }
    } finally {
      setFirmwareSimulationPending(false);
    }
  };

  const resetSimulation = () => {
    setForm(makeInitialForm());
    setPhaseChoice('settings');
    setResult(null);
    setError(null);
    setSimulationRequestId(null);
    previewRequestIdRef.current = null;
    setFirmwarePreviewResult(null);
    setPreviewInput(null);
    setFirmwareSimulationError(null);
    setPhysicalExecutionRequestId(null);
    setPhysicalExecutionResult(null);
    setPhysicalExecutionConfirmed(false);
    setPhysicalStopError(null);
  };

  const hardwareStatusFresh = espOnline &&
    actuatorSnapshot?.updatedAt != null;
  const realFlowRate = actuatorSnapshot?.flowRate ?? null;
  const hardwareActuatorsIdle = actuatorSnapshot?.irigasi === false &&
    actuatorSnapshot.fertigasi === false &&
    actuatorSnapshot.pompa === false;
  const previewRequestsPhysicalAction = firmwarePreviewResult?.pumpPredicted === true &&
    firmwarePreviewResult.stage !== 'JADWAL';
  const canExecutePhysicalSimulation = mqttConnected &&
    espOnline &&
    hardwareStatusFresh &&
    actuatorSnapshot?.mode === 'auto' &&
    form.automaticMode &&
    previewInput !== null &&
    previewRequestsPhysicalAction &&
    hardwareActuatorsIdle &&
    realFlowRate !== null &&
    realFlowRate < 0.05 &&
    physicalExecutionConfirmed &&
    !firmwareSimulationPending;
  const canStopPhysicalSimulation = mqttConnected &&
    (actuatorSnapshot?.irigasi === true ||
      actuatorSnapshot?.fertigasi === true ||
      actuatorSnapshot?.pompa === true) &&
    !physicalStopPending;
  const firmwareSimulationResult = firmwarePreviewResult;
  const firmwareSimulationStatus = simulationRequestId !== null &&
    simulationSnapshot?.requestId === simulationRequestId
    ? simulationSnapshot
    : firmwarePreviewResult;
  const firmwareExecutionStatus = physicalExecutionRequestId !== null &&
    simulationSnapshot?.requestId === physicalExecutionRequestId
    ? simulationSnapshot
    : physicalExecutionResult;
  const executePhysicalSimulation = async () => {
    if (!canExecutePhysicalSimulation || !previewInput) return;
    setFirmwareSimulationError(null);
    setPhysicalExecutionConfirmed(false);
    setPhysicalStopError(null);
    const requestId = createSimulationRequestId();
    setPhysicalExecutionRequestId(requestId);
    setPhysicalExecutionResult(null);
    setFirmwareSimulationPending(true);
    try {
      const response = await evaluateSimulationOnEsp32(requestId, previewInput, 'EXECUTE');
      setPhysicalExecutionResult(response);
    } catch (cause) {
      setFirmwareSimulationError(cause instanceof Error
        ? cause.message
        : 'Eksekusi otomatis fisik tidak dapat dimulai.');
    } finally {
      setFirmwareSimulationPending(false);
    }
  };
  const updatePhaseChoice = (next: 'settings' | SimulationPhase) => {
    setPhaseChoice(next);
    setResult(null);
    setSimulationRequestId(null);
    previewRequestIdRef.current = null;
    setFirmwarePreviewResult(null);
    setPreviewInput(null);
    setPhysicalExecutionRequestId(null);
    setPhysicalExecutionResult(null);
    setPhysicalExecutionConfirmed(false);
  };
  const stopPhysicalSimulation = async () => {
    if (!canStopPhysicalSimulation) return;
    setPhysicalStopError(null);
    setPhysicalStopPending(true);
    try {
      const response = await stopAutomaticSimulationOnEsp32(createSimulationRequestId());
      setPhysicalExecutionRequestId(response.requestId);
      setPhysicalExecutionResult(response);
    } catch (cause) {
      setPhysicalStopError(cause instanceof Error ? cause.message : 'Perintah berhenti tidak dapat dikirim.');
    } finally {
      setPhysicalStopPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-green-100 p-3 text-green-700 dark:bg-green-500/15 dark:text-green-300">
            <FlaskConical size={24} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Simulasi Kontrol</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Hitung skenario dummy di ESP32, lalu jalankan hasilnya melalui mode OTOMATIS dan relay fisik.
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-10 items-center gap-2 self-start rounded-full bg-green-100 px-3 py-2 text-sm font-semibold text-green-800 dark:bg-green-500/15 dark:text-green-200">
          <ShieldCheck size={16} aria-hidden="true" />
          ESP32 · aktuator fisik OTOMATIS
        </span>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-green-300 bg-green-50 p-4 text-sm leading-6 text-green-950 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-100">
        <CheckCircle2 className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
        <p>
            Tahap hitung hanya menghasilkan pratinjau dan tidak mengubah relay. Eksekusi fisik memerlukan konfirmasi,
            Gateway OTOMATIS, semua relay mati, dan flowmeter nyata menunjukkan aliran nol. Input dummy tidak masuk
            ke telemetri Node 1–3; selama aktuator berjalan, cutoff volume/no-flow tetap berasal dari flowmeter fisik.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert" aria-live="assertive">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {firmwareSimulationError && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" role="alert" aria-live="assertive">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <span>Proses firmware ESP32 gagal: {firmwareSimulationError}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Sensor Node 1 · Bedeng A"
          description="Nilai tanah dan mikroklimat untuk kendali hortikultura."
          icon={<Thermometer size={19} />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="soil1" label="Kelembapan tanah" value={form.soil1} onChange={(value) => updateForm('soil1', value)} unit="%" min={0} max={100} step={0.1} />
            <NumberField id="temperature1" label="Suhu udara" value={form.temperature1} onChange={(value) => updateForm('temperature1', value)} unit="°C" min={-40} max={80} step={0.1} />
            <NumberField id="humidity1" label="Kelembapan udara" value={form.humidity1} onChange={(value) => updateForm('humidity1', value)} unit="%" min={0} max={100} step={0.1} />
          </div>
        </SectionCard>

        <SectionCard
          title="Sensor Node 2 · Bedeng B"
          description="Dua node tanah digabung untuk menentukan kelembapan representatif dan minimum."
          icon={<Activity size={19} />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="soil2" label="Kelembapan tanah" value={form.soil2} onChange={(value) => updateForm('soil2', value)} unit="%" min={0} max={100} step={0.1} />
            <NumberField id="temperature2" label="Suhu udara" value={form.temperature2} onChange={(value) => updateForm('temperature2', value)} unit="°C" min={-40} max={80} step={0.1} />
            <NumberField id="humidity2" label="Kelembapan udara" value={form.humidity2} onChange={(value) => updateForm('humidity2', value)} unit="%" min={0} max={100} step={0.1} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Cuaca, larutan, dan fase tanaman"
        description="Parameter tambahan yang memengaruhi guard hujan, dosis, evapotranspirasi, dan fase biologis."
        icon={<Droplets size={19} />}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField id="rain-chance" label="Peluang hujan" value={form.rainChance} onChange={(value) => updateForm('rainChance', value)} unit="%" min={0} max={100} />
          <NumberField id="solution-ph" label="pH larutan tandon" value={form.ph} onChange={(value) => updateForm('ph', value)} unit="pH" min={0} max={14} step={0.1} />
          <div>
            <label htmlFor="phase-choice" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Fase tanaman</label>
            <select id="phase-choice" value={phaseChoice} onChange={(event) => updatePhaseChoice(event.target.value as 'settings' | SimulationPhase)} className={fieldClassName}>
              <option value="settings">Ikuti pengaturan web ({settings.plant_phase})</option>
              <option value="vegetatif">Vegetatif</option>
              <option value="generatif">Generatif</option>
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{settingsLoading ? 'Memuat konfigurasi web…' : 'Fase menentukan ambang skor dan faktor dosis.'}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Node 3 · Karhutla gambut"
        description="Aktifkan untuk menghitung indeks FDRS dan prioritas rewetting. Jika offline, jalur Karhutla dilewati."
        icon={<Flame size={19} />}
      >
        <div className="space-y-4">
          <CheckField
            checked={form.node3Online}
            label="Node 3 online"
            description="Mengaktifkan perhitungan FFMC, DMC, DC, ISI, BUI, FWI, dan prioritas kebakaran."
            onChange={(checked) => updateForm('node3Online', checked)}
          />
          {form.node3Online && (
            <div className="grid gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField id="peat-temperature" label="Suhu tanah gambut" value={form.peatTemperature} onChange={(value) => updateForm('peatTemperature', value)} unit="°C" min={-40} max={100} step={0.1} />
              <NumberField id="node3-temperature" label="Suhu udara Node 3" value={form.node3Temperature} onChange={(value) => updateForm('node3Temperature', value)} unit="°C" min={-40} max={80} step={0.1} />
              <NumberField id="node3-humidity" label="RH udara Node 3" value={form.node3Humidity} onChange={(value) => updateForm('node3Humidity', value)} unit="%" min={0} max={100} step={0.1} />
              <NumberField id="wind-speed" label="Kecepatan angin" value={form.wind} onChange={(value) => updateForm('wind', value)} unit="km/jam" min={0} max={150} step={0.1} />
            </div>
          )}
        </div>
      </SectionCard>

      <details className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer rounded-3xl px-5 py-4 text-base font-bold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-green-600 dark:text-slate-100 sm:px-6">
          Parameter lanjutan · waktu, jadwal, threshold, dan kondisi awal
        </summary>
        <div className="space-y-6 border-t border-slate-100 p-5 dark:border-slate-800 sm:p-6">
          <div>
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Waktu simulasi</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <CheckField checked={form.timeValid} label="Waktu RTC valid" onChange={(checked) => updateForm('timeValid', checked)} />
              <NumberField id="hour" label="Jam" value={form.hour} onChange={(value) => updateForm('hour', value)} unit="0–23" min={0} max={23} />
              <NumberField id="minute" label="Menit" value={form.minute} onChange={(value) => updateForm('minute', value)} unit="0–59" min={0} max={59} />
              <NumberField id="day" label="Tanggal saat ini" value={form.day} onChange={(value) => updateForm('day', value)} unit="hari" min={1} max={31} />
              <NumberField id="month" label="Bulan saat ini" value={form.month} onChange={(value) => updateForm('month', value)} unit="1–12" min={1} max={12} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Fertigasi dan jadwal</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField id="fert-interval" label="Interval fertigasi" value={form.fertilizerInterval} onChange={(value) => updateForm('fertilizerInterval', value)} unit="hari" min={1} max={30} />
              <NumberField id="last-fert-day" label="Hari fertigasi terakhir" value={form.lastFertilizerDay} onChange={(value) => updateForm('lastFertilizerDay', value)} unit="-1 atau 1–31" min={-1} max={31} />
              <NumberField id="last-fert-month" label="Bulan fertigasi terakhir" value={form.lastFertilizerMonth} onChange={(value) => updateForm('lastFertilizerMonth', value)} unit="-1 atau 1–12" min={-1} max={12} />
              <div>
                <label htmlFor="fert-override" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Status interval</label>
                <select id="fert-override" value={form.fertilizerOverride} onChange={(event) => updateForm('fertilizerOverride', event.target.value as SimulationForm['fertilizerOverride'])} className={fieldClassName}>
                  <option value="calculated">Hitung dari tanggal</option>
                  <option value="due">Paksa sudah jatuh tempo</option>
                  <option value="not-due">Paksa belum jatuh tempo</option>
                </select>
              </div>
              <CheckField checked={scheduleEnabled} label="Jadwal penyiraman aktif" description={`Konfigurasi web: ${settings.watering_time}, ${settings.watering_duration} detik.`} onChange={(checked) => updateForm('scheduleEnabled', checked)} />
              <div>
                <label htmlFor="schedule-time" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Waktu jadwal</label>
                <input id="schedule-time" type="time" value={form.scheduleTime || settings.watering_time} onChange={(event) => updateForm('scheduleTime', event.target.value)} className={fieldClassName} />
              </div>
              <NumberField id="schedule-duration" label="Durasi jadwal" value={form.scheduleDurationSeconds} onChange={(value) => updateForm('scheduleDurationSeconds', value)} unit="detik" min={1} max={3_600} placeholder={String(settings.watering_duration)} />
              <CheckField checked={form.scheduleAlreadyDone} label="Jadwal hari ini sudah dijalankan" onChange={(checked) => updateForm('scheduleAlreadyDone', checked)} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Threshold dan kondisi awal kontrol</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField id="critical-soil" label="Tanah kritis" value={form.criticalSoil} onChange={(value) => updateForm('criticalSoil', value)} unit="%" min={0} max={100} placeholder={String(settings.soil_threshold_critical)} />
              <NumberField id="upper-soil" label="Ambang atas tanah" value={form.upperSoil} onChange={(value) => updateForm('upperSoil', value)} unit="%" min={0} max={100} placeholder={String(settings.soil_threshold_high)} />
              <NumberField id="score-active" label="Ambang skor aktif" value={form.activeScoreThreshold} onChange={(value) => updateForm('activeScoreThreshold', value)} unit="poin" min={0} max={100} placeholder={phase === 'vegetatif' ? '55' : '60'} />
              <NumberField id="score-lower" label="Ambang skor nonaktif" value={form.lowerScoreThreshold} onChange={(value) => updateForm('lowerScoreThreshold', value)} unit="poin" min={0} max={100} placeholder={phase === 'vegetatif' ? '25' : '35'} />
              <NumberField id="temp-high-threshold" label="Ambang suhu tinggi" value={form.highTemperatureThreshold} onChange={(value) => updateForm('highTemperatureThreshold', value)} unit="°C" min={0} max={80} placeholder={String(settings.temp_threshold_high)} />
              <NumberField id="humidity-low-threshold" label="Ambang RH rendah" value={form.lowHumidityThreshold} onChange={(value) => updateForm('lowHumidityThreshold', value)} unit="%" min={0} max={100} placeholder={String(settings.humidity_threshold_low)} />
              <CheckField checked={form.automaticMode} label="Mode OTOMATIS" description="Jika tidak aktif, evaluasi otomatis dilewati." onChange={(checked) => updateForm('automaticMode', checked)} />
              <CheckField checked={form.previousCycleActive} label="Siklus skor sebelumnya aktif" onChange={(checked) => updateForm('previousCycleActive', checked)} />
              <CheckField checked={form.irrigationCooldownReady} label="Cooldown irigasi selesai (pratinjau)" description="Eksekusi fisik tetap memakai cooldown aktual ESP32." onChange={(checked) => updateForm('irrigationCooldownReady', checked)} />
              <CheckField checked={form.fireCooldownReady} label="Cooldown Karhutla selesai (pratinjau)" description="Eksekusi fisik tetap memakai cooldown aktual ESP32." onChange={(checked) => updateForm('fireCooldownReady', checked)} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Kondisi awal indeks Karhutla</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField id="previous-ffmc" label="FFMC sebelumnya" value={form.previousFfmc} onChange={(value) => updateForm('previousFfmc', value)} unit="kode" min={0} max={101} step={0.1} />
              <NumberField id="previous-dmc" label="DMC sebelumnya" value={form.previousDmc} onChange={(value) => updateForm('previousDmc', value)} unit="kode" min={0} max={10000} step={0.1} />
              <NumberField id="previous-dc" label="DC sebelumnya" value={form.previousDc} onChange={(value) => updateForm('previousDc', value)} unit="kode" min={0} max={10000} step={0.1} />
              <NumberField id="fire-level-override" label="Override level FWI" value={form.fireLevelOverride} onChange={(value) => updateForm('fireLevelOverride', value)} unit="0–4" min={0} max={4} placeholder="Hitung otomatis" />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Override hanya mengganti level pemicu, bukan nilai FFMC/DMC/DC/ISI/BUI/FWI yang tetap dihitung dan ditampilkan.
            </p>
          </div>
        </div>
      </details>

      <div className="space-y-2">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
          Hitung dulu agar seluruh kalkulasi ESP32 dapat diperiksa. Tombol hitung tidak menyalakan relay; eksekusi nyata
          dilakukan terpisah setelah hasil dipastikan dan kotak konfirmasi dicentang.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={runSimulation}
            disabled={firmwareSimulationPending}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 font-bold text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={18} aria-hidden="true" />
            {firmwareSimulationPending ? 'ESP32 sedang memproses…' : 'Kirim data dummy & hitung (relay tetap OFF)'}
          </button>
          <button
            type="button"
            onClick={resetSimulation}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RotateCcw size={17} aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      <SectionCard
        title="Eksekusi sistem otomatis fisik"
        description="Jalankan keputusan logika firmware menggunakan input dummy. Relay dan cutoff memakai hardware/flowmeter nyata."
        icon={<ShieldCheck size={19} />}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            Eksekusi dapat membuka jalur irigasi maupun fertigasi sesuai keputusan otomatis, termasuk siklus rewetting/amelioran.
            Pastikan sumber air/larutan, pipa, dan area keluaran aman. Target mengikuti hasil firmware; flowmeter nyata menjadi
            cutoff volume, dengan proteksi no-flow dan timeout otomatis. Jadwal berbasis durasi tidak dijalankan dari uji dummy.
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Koneksi perangkat"
              value={!mqttConnected ? 'MQTT OFF' : !espOnline ? 'ESP32 OFF' : hardwareStatusFresh ? 'ONLINE' : 'Status lama'}
              detail={hardwareStatusFresh ? 'Telemetri ESP32 baru' : 'Menunggu status aktuator terbaru'}
            />
            <MetricCard
              label="Mode Gateway"
              value={actuatorSnapshot?.mode === 'manual' ? 'MANUAL' : actuatorSnapshot?.mode === 'auto' ? 'OTOMATIS' : '—'}
              detail="Eksekusi dummy hanya diizinkan pada OTOMATIS"
            />
            <MetricCard
              label="Relay irigasi / fertigasi"
              value={`${actuatorSnapshot?.irigasi === true ? 'ON' : actuatorSnapshot?.irigasi === false ? 'OFF' : '—'} / ${actuatorSnapshot?.fertigasi === true ? 'ON' : actuatorSnapshot?.fertigasi === false ? 'OFF' : '—'}`}
              detail={`${actuatorSnapshot?.activeValve ?? 'Belum ada status'} · target ${formatValue(actuatorSnapshot?.targetLiters)} L · pompa ${actuatorSnapshot?.pompa === true ? 'ON' : actuatorSnapshot?.pompa === false ? 'OFF' : '—'}`}
            />
            <MetricCard
              label="Flow nyata ESP32"
              value={realFlowRate === null ? '—' : `${formatValue(realFlowRate)} L/menit`}
              detail={`${formatValue(actuatorSnapshot?.currentLiters ?? sensorSnapshot?.session_water)} L sesi`}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Status hasil firmware dan aktuator nyata</p>
            <dl className="mt-2">
              <Detail label="Pratinjau otomatis" value={firmwareSimulationResult ? `${firmwareSimulationResult.stage ?? 'IDLE'} · ${firmwareSimulationResult.priority ?? 'tanpa prioritas'}` : 'Belum dihitung'} />
              <Detail label="Hasil eksekusi" value={firmwareExecutionStatus ? `${firmwareExecutionStatus.stage ?? 'IDLE'} · ${firmwareExecutionStatus.executionState ?? firmwareExecutionStatus.state} · ${firmwareExecutionStatus.message}` : 'Belum dijalankan'} />
              <Detail label="Flowmeter aktual" value={realFlowRate === null ? 'Belum ada pembacaan' : `${formatValue(realFlowRate)} L/menit`} />
            </dl>
          </div>

          <CheckField
            checked={physicalExecutionConfirmed}
            label="Saya memastikan aktuator fisik, jalur air dan larutan, serta area keluaran aman untuk eksekusi otomatis."
            description="Konfirmasi diwajibkan ulang setiap eksekusi. Siklus fertigasi dapat membuka katup larutan; hasil input dummy dapat menyalakan relay nyata."
            onChange={setPhysicalExecutionConfirmed}
          />

          {firmwareSimulationError && (
            <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
              {firmwareSimulationError}
            </p>
          )}
          {physicalStopError && (
            <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
              {physicalStopError}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={executePhysicalSimulation}
              disabled={!canExecutePhysicalSimulation}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={17} aria-hidden="true" />
              {firmwareSimulationPending ? 'Menghubungi ESP32…' : 'Jalankan hasil di aktuator fisik'}
            </button>
            {!hardwareActuatorsIdle && (
              <button
                type="button"
                onClick={stopPhysicalSimulation}
                disabled={!canStopPhysicalSimulation}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 font-semibold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
              >
                <AlertTriangle size={17} aria-hidden="true" />
                {physicalStopPending ? 'Menghentikan…' : '                Hentikan irigasi/fertigasi'}
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
            {!mqttConnected
              ? 'Belum siap: MQTT web belum terhubung.'
              : !espOnline
                ? 'Belum siap: Gateway ESP32 belum online.'
                : !hardwareStatusFresh
                  ? 'Belum siap: status aktuator ESP32 sudah kedaluwarsa.'
                  : actuatorSnapshot?.mode !== 'auto'
                    ? 'Belum siap: ubah mode Gateway menjadi OTOMATIS.'
                    : !form.automaticMode
                      ? 'Belum siap: aktifkan Mode OTOMATIS pada input skenario.'
                      : !firmwareSimulationResult
                        ? 'Hitung skenario terlebih dahulu; hasil pratinjau tidak menyalakan relay.'
                        : firmwareSimulationResult.stage === 'JADWAL'
                          ? 'Eksekusi diblokir: hasil berupa jadwal berbasis durasi, bukan siklus cutoff volume flowmeter.'
                          : !previewRequestsPhysicalAction
                            ? 'Hasil pratinjau tidak meminta aktuator menyala.'
                            : !hardwareActuatorsIdle
                              ? 'Belum siap: semua relay/pompa harus OFF.'
                              : realFlowRate === null
                                ? 'Belum siap: menunggu pembacaan flowmeter nyata.'
                                : realFlowRate >= 0.05
                                  ? 'Belum siap: flowmeter nyata masih mendeteksi aliran.'
                                  : !physicalExecutionConfirmed
                                    ? 'Centang konfirmasi keselamatan sebelum menjalankan aktuator fisik.'
                                    : 'Interlock terpenuhi. Eksekusi tetap menggunakan cooldown dan cutoff flowmeter aktual ESP32.'}
          </p>
        </div>
      </SectionCard>

      {result && (
        <section className="space-y-5" aria-labelledby="simulation-results" aria-live="polite">
          <div className="flex flex-col gap-3 rounded-3xl border border-green-300 bg-green-50 p-5 dark:border-green-500/30 dark:bg-green-500/10 sm:flex-row sm:items-start">
            <CheckCircle2 className="mt-0.5 shrink-0 text-green-700 dark:text-green-300" size={22} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 id="simulation-results" className="text-lg font-bold text-green-950 dark:text-green-100">Pembanding lokal: {result.priority}</h2>
              <p className="mt-1 text-sm leading-6 text-green-900 dark:text-green-100">{result.action}</p>
            </div>
          </div>

          <SectionCard
            title="Pratinjau hasil firmware ESP32"
            description="Dihitung oleh firmware tanpa mengubah relay. Jalankan terpisah setelah memeriksa hasil dan interlock."
            icon={<Gauge size={19} />}
          >
            {!firmwareSimulationStatus || firmwareSimulationStatus.state === 'queued' ? (
              <p className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100" role="status" aria-live="polite">
                {firmwareSimulationStatus?.message ?? 'Menunggu ESP32 menerima input simulasi.'}
              </p>
            ) : firmwareSimulationResult ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm dark:border-green-500/30 dark:bg-green-500/10">
                  <p className="font-semibold text-green-950 dark:text-green-100">
                    Prioritas: {firmwareSimulationResult.priority ?? '—'} · keputusan: {firmwareSimulationResult.decision ?? '—'}
                  </p>
                  <p className="mt-1 text-green-900 dark:text-green-100">
                    Prediksi tahap {firmwareSimulationResult.stage ?? 'IDLE'} · irigasi {firmwareSimulationResult.irrigationPredicted ? 'diminta' : 'tidak diminta'} · siklus fertigasi {firmwareSimulationResult.fertilizerCyclePredicted ? 'direncanakan' : 'tidak aktif'} · pompa {firmwareSimulationResult.pumpPredicted ? 'akan diminta ON' : 'tetap OFF'} · pratinjau tidak menyalakan relay.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Soil representatif / minimum" value={`${formatValue(firmwareSimulationResult.soilRepresentative)}% / ${formatValue(firmwareSimulationResult.soilMinimum)}%`} detail="Agregasi aktual firmware dari input Node 1–2." />
                  <MetricCard label="Suhu / RH rata-rata" value={`${formatValue(firmwareSimulationResult.averageTemperature)}°C / ${formatValue(firmwareSimulationResult.averageHumidity)}%`} detail={`VPD ${formatValue(firmwareSimulationResult.vpd, 3)} kPa`} />
                  <MetricCard label="Skor irigasi ESP32" value={`${formatValue(firmwareSimulationResult.totalScore)} / 100`} detail={`Tanah ${formatValue(firmwareSimulationResult.soilScore)} + VPD ${formatValue(firmwareSimulationResult.vpdScore)} + interaksi ${formatValue(firmwareSimulationResult.interactionScore)} − hujan ${formatValue(firmwareSimulationResult.rainScore)}.`} />
                  <MetricCard label="Target tahap air" value={`${formatValue(firmwareSimulationResult.targetLiters)} L`} detail={`Dosis ${formatValue(firmwareSimulationResult.fertilizerLiters)} L · bilas ${formatValue(firmwareSimulationResult.postFlushLiters)} L`} />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <dl>
                    <Detail label="Defisit tanah" value={`${formatValue(firmwareSimulationResult.waterSoilDeficit)}%`} />
                    <Detail label="Faktor evaporasi dasar + koreksi suhu/RH" value={`${formatValue(firmwareSimulationResult.waterEvaporationBase, 3)} + ${formatValue(firmwareSimulationResult.waterTemperatureAdjustment, 2)} + ${formatValue(firmwareSimulationResult.waterHumidityAdjustment, 2)}`} />
                    <Detail label="Faktor evaporasi terpakai" value={formatValue(firmwareSimulationResult.waterEvaporationFactor, 3)} />
                    <Detail label="Faktor fase / skor" value={`${formatValue(firmwareSimulationResult.waterPhaseFactor, 2)} / ${formatValue(firmwareSimulationResult.waterScoreFactor, 2)}`} />
                    <Detail label="Volume air mentah → target hitung" value={`${formatValue(firmwareSimulationResult.waterRawLiters)} → ${formatValue(firmwareSimulationResult.waterCalculatedLiters)} L`} />
                  </dl>
                  <dl>
                    <Detail label="Dosis dasar → dosis fase → final" value={`${formatValue(firmwareSimulationResult.fertilizerBaseDoseLiters)} → ${formatValue(firmwareSimulationResult.fertilizerPhaseDoseLiters)} → ${formatValue(firmwareSimulationResult.fertilizerFinalDoseLiters)} L`} />
                    <Detail label="Fertigasi gambut masam" value={firmwareSimulationResult.peatAcid ? 'Aktif' : 'Tidak aktif'} />
                    <Detail label="Target tahap / POST-FLUSH" value={`${formatValue(firmwareSimulationResult.targetLiters)} / ${formatValue(firmwareSimulationResult.postFlushLiters)} L`} />
                    <Detail label="Durasi jadwal" value={`${formatValue(firmwareSimulationResult.scheduleDurationSeconds, 0)} detik`} />
                  </dl>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <dl>
                    <Detail label="FDRS · FFMC / DMC / DC" value={`${formatValue(firmwareSimulationResult.ffmc)} / ${formatValue(firmwareSimulationResult.dmc)} / ${formatValue(firmwareSimulationResult.dc)}`} />
                    <Detail label="FDRS · ISI / BUI / FWI" value={`${formatValue(firmwareSimulationResult.isi)} / ${formatValue(firmwareSimulationResult.bui)} / ${formatValue(firmwareSimulationResult.fwi)}`} />
                    <Detail label="Level FWI / kondisi pemicu" value={`${formatValue(firmwareSimulationResult.fwiLevel, 0)} / ${firmwareSimulationResult.fireActive ? 'aktif' : 'tidak aktif'}`} />
                    <Detail label="Histeresis skor aktif" value={firmwareSimulationResult.cycleActive == null ? '—' : firmwareSimulationResult.cycleActive ? 'Aktif' : 'Tidak aktif'} />
                  </dl>
                  <dl>
                    <Detail label="Guard hujan / tanah basah" value={`${firmwareSimulationResult.guardRain ? 'BLOKIR' : 'Lolos'} / ${firmwareSimulationResult.guardWetSoil ? 'BLOKIR' : 'Lolos'}`} />
                    <Detail label="Guard jam terik / pH" value={`${firmwareSimulationResult.guardHotHour ? 'BLOKIR' : 'Lolos'} / ${firmwareSimulationResult.guardDangerousPh ? 'BLOKIR' : 'Lolos'}`} />
                    <Detail label="Interval / jendela biologis" value={`${firmwareSimulationResult.fertilizerIntervalDue ? 'Tercapai' : 'Belum'} / ${firmwareSimulationResult.fertilizerBiologicalWindow ? 'Terbuka' : 'Tertutup'}`} />
                    <Detail label="Hasil guard fertigasi" value={firmwareSimulationResult.fertilizerAllowed ? 'Diizinkan' : firmwareSimulationResult.fertilizerBlockReason ?? 'Tidak diizinkan'} />
                  </dl>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100" role="alert">
                {firmwareSimulationStatus.message}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Input sensor dummy" description="Nilai skenario untuk perhitungan ESP32 dan pembanding lokal. Input ini tidak menjadi telemetri produksi Node 1–3." icon={<Thermometer size={19} />}>
            <div className="grid gap-5 md:grid-cols-2">
              <dl>
                <Detail label="Node 1 · kelembapan tanah" value={`${form.soil1 || '—'}%`} />
                <Detail label="Node 1 · suhu udara" value={`${form.temperature1 || '—'} °C`} />
                <Detail label="Node 1 · kelembapan udara" value={`${form.humidity1 || '—'}% RH`} />
                <Detail label="Node 2 · kelembapan tanah" value={`${form.soil2 || '—'}%`} />
                <Detail label="Node 2 · suhu udara" value={`${form.temperature2 || '—'} °C`} />
                <Detail label="Node 2 · kelembapan udara" value={`${form.humidity2 || '—'}% RH`} />
              </dl>
              <dl>
                <Detail label="Node 3 · status" value={form.node3Online ? 'Online (input simulasi)' : 'Offline / tidak dipakai'} />
                <Detail label="Node 3 · suhu tanah gambut" value={form.node3Online ? `${form.peatTemperature || '—'} °C` : '—'} />
                <Detail label="Node 3 · suhu / RH udara" value={form.node3Online ? `${form.node3Temperature || '—'} °C / ${form.node3Humidity || '—'}%` : '—'} />
                <Detail label="pH larutan" value={form.ph || '—'} />
                <Detail label="Peluang hujan" value={`${form.rainChance || '—'}%`} />
                <Detail label="Kecepatan angin" value={`${form.wind || '—'} km/jam`} />
                <Detail label="Kondisi awal FDRS (FFMC / DMC / DC)" value={`${form.previousFfmc} / ${form.previousDmc} / ${form.previousDc}`} />
              </dl>
            </div>
          </SectionCard>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Soil representatif" value={`${formatValue(result.soilRepresentative)}%`} detail="Gabungan Node 1 & 2; bobot minimum meningkat jika selisih >8%." />
            <MetricCard label="Soil minimum" value={`${formatValue(result.soilMinimum)}%`} detail="Dipakai untuk mendeteksi kekeringan kritis." />
            <MetricCard label="Suhu / RH rata-rata" value={`${formatValue(result.averageTemperature)}°C`} detail={`RH ${formatValue(result.averageHumidity)}%`} />
            <MetricCard label="VPD" value={`${formatValue(result.vpd)} kPa`} detail="Dibatasi dalam rentang 0,4–2,0 kPa." />
            <MetricCard label="Skor irigasi" value={`${formatValue(result.score.total)} / 100`} detail={`Tanah ${formatValue(result.score.soil)} + VPD ${formatValue(result.score.vpd)} + interaksi ${formatValue(result.score.interaction)} − hujan ${formatValue(result.score.rainPenalty)}.`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Rincian FDRS / Karhutla" description="Indeks api dihitung dari kondisi awal, suhu/RH Node 3, dan angin." icon={<Flame size={19} />}>
              {result.fire ? (
                <dl>
                  <Detail label="FFMC" value={formatValue(result.fire.ffmc)} />
                  <Detail label="DMC" value={formatValue(result.fire.dmc)} />
                  <Detail label="DC" value={formatValue(result.fire.dc)} />
                  <Detail label="ISI" value={formatValue(result.fire.isi)} />
                  <Detail label="BUI" value={formatValue(result.fire.bui)} />
                  <Detail label="FWI" value={formatValue(result.fire.fwi)} />
                  <Detail label="Level bahaya" value={`${result.fire.level} · ${result.fire.levelLabel}`} />
                  <Detail label="Pemicu" value={result.fire.trigger ? 'AKTIF · FWI ≥2 atau tanah gambut ≥40°C' : 'Tidak aktif'} />
                  <Detail label="Koreksi suhu tanah" value={result.fire.soilTemperatureOverride ? 'DARURAT · tanah ≥50°C' : 'Normal'} />
                </dl>
              ) : (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Node 3 offline; perhitungan FDRS dan jalur Karhutla dilewati.
                </p>
              )}
            </SectionCard>

            <SectionCard title="Guard fertigasi" description="Urutan guard mengikuti firmware: hujan, tanah, jam terik, pH, interval, dan jendela biologis." icon={<CircleHelp size={19} />}>
              <dl>
                <Detail label="Interval tercapai" value={result.fertilizer.intervalDue ? 'Ya' : 'Tidak'} />
                <Detail label="Hari sejak fertigasi" value={result.fertilizer.daysSinceLastFertilizer == null ? 'Belum ada catatan' : `${result.fertilizer.daysSinceLastFertilizer} hari`} />
                <Detail label="Jendela biologis" value={result.fertilizer.biologicalWindow ? 'Terbuka' : 'Tertutup / waktu tidak valid'} />
                <Detail label="Guard hujan (>=60%)" value={result.fertilizer.guards.rain ? 'BLOKIR' : 'Lolos'} />
                <Detail label="Guard tanah basah" value={result.fertilizer.guards.wetSoil ? 'BLOKIR' : 'Lolos'} />
                <Detail label="Guard jam terik 11–14" value={result.fertilizer.guards.hotHour ? 'BLOKIR' : 'Lolos'} />
                <Detail label="Guard pH (<4 atau >8.5)" value={result.fertilizer.guards.dangerousPh ? 'BLOKIR' : 'Lolos'} />
                <Detail label="pH gambut masam (<4.8)" value={result.fertilizer.peatAcid ? 'Aktif' : 'Tidak aktif'} />
                <Detail label="Hasil guard" value={result.fertilizer.allowed ? 'Fertigasi diizinkan' : result.fertilizer.firstBlockReason ?? 'Tidak eligible saat ini'} />
              </dl>
            </SectionCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Perhitungan target air & dosis" description="Menampilkan nilai antara sebelum pembatasan target volume." icon={<Gauge size={19} />}>
              {result.waterTarget ? (
                <dl>
                  <Detail label="Defisit soil (ambang atas − soil)" value={`${formatValue(result.waterTarget.soilDeficit)}%`} />
                  <Detail label="Faktor evaporasi dasar" value={formatValue(result.waterTarget.evaporationBase, 3)} />
                  <Detail label="Koreksi suhu / RH" value={`${formatValue(result.waterTarget.temperatureAdjustment, 2)} / ${formatValue(result.waterTarget.humidityAdjustment, 2)}`} />
                  <Detail label="Faktor evaporasi terpakai" value={formatValue(result.waterTarget.evaporationFactor, 3)} />
                  <Detail label="Faktor fase / skor" value={`${formatValue(result.waterTarget.phaseFactor, 2)} / ${formatValue(result.waterTarget.scoreFactor, 2)}`} />
                  <Detail label="Volume mentah" value={`${formatValue(result.waterTarget.rawLiters)} L`} />
                  <Detail label="Target volume" value={`${formatValue(result.waterTarget.appliedLiters)} L`} />
                </dl>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">Tidak ada target irigasi air bersih pada jalur prioritas ini.</p>
              )}
              {result.fertilizer.finalDoseLiters !== null && (
                <dl className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Detail label="Dosis dasar dari pH" value={`${formatValue(result.fertilizer.baseDoseLiters)} L`} />
                  <Detail label={`Dosis fase ${phase}`} value={`${formatValue(result.fertilizer.phaseDoseLiters)} L`} />
                  <Detail label="Dosis akhir" value={`${formatValue(result.fertilizer.finalDoseLiters)} L`} />
                  <Detail label="PRE-WET" value={`${formatValue(result.fertilizer.preWetLiters)} L`} />
                  <Detail label="POST-FLUSH" value={`${formatValue(result.fertilizer.postFlushLiters)} L`} />
                </dl>
              )}
            </SectionCard>

            <SectionCard title="Prioritas kendali" description="Urutan keputusan dari jadwal hingga hasil aktuator." icon={<CheckCircle2 size={19} />}>
              <ol className="space-y-2">
                {result.trace.map((item, index) => (
                  <li key={`${index}-${item}`} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </div>

        </section>
      )}
    </div>
  );
}
