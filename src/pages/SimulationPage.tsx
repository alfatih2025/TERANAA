import { useState } from 'react';
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
  createIrrigationFlowTestRequestId,
  startIrrigationFlowTest,
  stopIrrigationFlowTest,
} from '../services/mqtt';
import {
  advanceSimulationFlow,
  evaluateIrrigationScenario,
  getVirtualRelayOutputs,
  type IrrigationSimulationInput,
  type IrrigationSimulationResult,
  type SimulationPhase,
  type SimulationStage,
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

const stageLabels: Record<SimulationStage, string> = {
  IDLE: 'IDLE',
  IRIGASI: 'IRIGASI',
  JADWAL: 'JADWAL',
  PRE_WET: 'PRE-WET',
  INTER_DELAY: 'JEDA ANTAR TAHAP',
  FERTIGASI: 'DOSING / FERTIGASI',
  POST_FLUSH_DELAY: 'JEDA POST-FLUSH',
  POST_FLUSH: 'POST-FLUSH',
};

function formatValue(value: number | null | undefined, digits = 2) {
  return value == null ? '—' : value.toFixed(digits);
}

export function SimulationPage() {
  const { settings: storedSettings, loading: settingsLoading } = useSettings();
  const { actuatorSnapshot, espOnline, mqttConnected, sensorSnapshot, irrigationFlowTestSnapshot } = useMqttStatus();
  const settings = storedSettings ?? DEFAULT_SETTINGS;
  const [form, setForm] = useState<SimulationForm>(makeInitialForm);
  const [phaseChoice, setPhaseChoice] = useState<'settings' | SimulationPhase>('settings');
  const [result, setResult] = useState<IrrigationSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flowPulses, setFlowPulses] = useState('450');
  const [flowSeconds, setFlowSeconds] = useState('10');
  const [hardwareTestConfirmed, setHardwareTestConfirmed] = useState(false);
  const [hardwareTestRequestId, setHardwareTestRequestId] = useState<string | null>(null);
  const [hardwareTestPending, setHardwareTestPending] = useState(false);
  const [hardwareTestError, setHardwareTestError] = useState<string | null>(null);

  const phase = phaseChoice === 'settings' ? settings.plant_phase : phaseChoice;
  const scheduleEnabled = form.scheduleEnabled ?? settings.watering_enabled;

  const updateForm = <K extends keyof SimulationForm,>(key: K, value: SimulationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setResult(null);
    setError(null);
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

  const runSimulation = () => {
    setError(null);
    try {
      setResult(evaluateIrrigationScenario(makeInput()));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'Input simulasi tidak valid.');
    }
  };

  const resetSimulation = () => {
    setForm(makeInitialForm());
    setPhaseChoice('settings');
    setResult(null);
    setError(null);
    setFlowPulses('450');
    setFlowSeconds('10');
  };

  const advanceFlow = () => {
    if (!result) return;
    try {
      if (result.actuator.stage === 'INTER_DELAY' || result.actuator.stage === 'POST_FLUSH_DELAY') {
        setResult(advanceSimulationFlow(result, 0, 3));
        setError(null);
        return;
      }
      const pulses = numberValue(flowPulses, 'Pulsa flow', 0, 2_000_000);
      if (!Number.isInteger(pulses)) throw new Error('Pulsa flow harus bilangan bulat.');
      const seconds = numberValue(flowSeconds, 'Durasi flow', 0.01, 1_800);
      setResult(advanceSimulationFlow(result, pulses, seconds));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Data flow tidak valid.');
    }
  };

  const resetStage = () => {
    if (!result) return;
    try {
      setResult(evaluateIrrigationScenario(makeInput()));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tidak dapat mengulang simulasi.');
    }
  };

  const relayOutputs = result ? getVirtualRelayOutputs(result.actuator.stage) : null;
  const isInterStageDelay = result?.actuator.stage === 'INTER_DELAY' || result?.actuator.stage === 'POST_FLUSH_DELAY';
  const stageProgress = result?.actuator.stage === 'JADWAL'
    ? Math.min(1, result.actuator.elapsedSeconds / result.actuator.scheduleDurationSeconds)
    : isInterStageDelay
      ? Math.min(1, result.actuator.elapsedSeconds / 3)
      : result && result.actuator.targetLiters > 0
        ? Math.min(1, result.actuator.stageLiters / result.actuator.targetLiters)
        : 0;
  const anyRelayActive = relayOutputs !== null &&
    (relayOutputs.irrigation || relayOutputs.fertilizer || relayOutputs.pump);
  const hardwareStatusFresh = espOnline && actuatorSnapshot?.updatedAt != null;
  const realFlowRate = actuatorSnapshot?.flowRate ?? sensorSnapshot?.flow_rate ?? null;
  const activeHardwareTestRequestId = irrigationFlowTestSnapshot?.state === 'started' &&
    actuatorSnapshot?.pompa !== false
    ? irrigationFlowTestSnapshot.requestId
    : null;
  const currentHardwareTestRequestId = hardwareTestRequestId ?? activeHardwareTestRequestId;
  const hardwareTestSnapshot = irrigationFlowTestSnapshot?.requestId === currentHardwareTestRequestId
    ? irrigationFlowTestSnapshot
    : null;
  const hardwareTestRunning = hardwareTestSnapshot?.state === 'started' &&
    actuatorSnapshot?.pompa !== false;
  const physicalWaterStage = result !== null &&
    ['IRIGASI', 'PRE_WET', 'POST_FLUSH'].includes(result.actuator.stage) &&
    relayOutputs?.irrigation === true;
  const hardwareTargetLiters = physicalWaterStage && result
    ? Math.min(0.5, Math.max(0.2, result.actuator.targetLiters))
    : 0;
  const hardwareTargetValid = hardwareTargetLiters >= 0.2 && hardwareTargetLiters <= 0.5;
  const hardwareActuatorsIdle = actuatorSnapshot?.irigasi === false &&
    actuatorSnapshot.fertigasi === false &&
    actuatorSnapshot.pompa === false;
  const canStartHardwareTest = mqttConnected &&
    espOnline &&
    hardwareStatusFresh &&
    actuatorSnapshot?.mode === 'manual' &&
    hardwareActuatorsIdle &&
    realFlowRate !== null &&
    realFlowRate < 0.05 &&
    hardwareTargetValid &&
    physicalWaterStage &&
    hardwareTestConfirmed &&
    !hardwareTestPending &&
    !hardwareTestRunning;
  const hardwareTestBlockedReason = hardwareTestPending
    ? 'Perintah sedang diproses.'
    : hardwareTestRunning
      ? 'Uji fisik sedang berjalan; gunakan tombol berhenti.'
      : !physicalWaterStage
        ? 'Hitung hasil simulasi yang meminta tahap IRIGASI, PRE-WET, atau POST-FLUSH.'
        : !mqttConnected
          ? 'MQTT web belum terhubung.'
          : !espOnline
            ? 'Gateway ESP32 belum online.'
            : !hardwareStatusFresh
              ? 'Menunggu status aktuator terbaru dari ESP32.'
              : actuatorSnapshot?.mode !== 'manual'
                ? 'Ubah mode Gateway ke MANUAL.'
                : !hardwareActuatorsIdle
                  ? 'Matikan aktuator yang sedang aktif sebelum uji.'
                  : realFlowRate === null
                    ? 'Menunggu pembacaan flowmeter nyata.'
                    : realFlowRate >= 0.05
                      ? 'Flowmeter masih mendeteksi aliran; tunggu hingga berhenti.'
                      : !hardwareTestConfirmed
                        ? 'Centang konfirmasi jalur air bersih dan keluaran aman.'
                        : null;

  const startHardwarePumpTest = async () => {
    if (!canStartHardwareTest) return;
    const requestId = createIrrigationFlowTestRequestId();
    setHardwareTestRequestId(requestId);
    setHardwareTestError(null);
    setHardwareTestConfirmed(false);
    setHardwareTestPending(true);
    try {
      await startIrrigationFlowTest(requestId, hardwareTargetLiters);
    } catch (cause) {
      setHardwareTestError(cause instanceof Error ? cause.message : 'Uji pompa tidak dapat dimulai.');
    } finally {
      setHardwareTestPending(false);
    }
  };

  const stopHardwarePumpTest = async () => {
    if (!currentHardwareTestRequestId || hardwareTestPending) return;
    setHardwareTestError(null);
    setHardwareTestPending(true);
    try {
      await stopIrrigationFlowTest(currentHardwareTestRequestId);
    } catch (cause) {
      setHardwareTestError(cause instanceof Error ? cause.message : 'Perintah berhenti tidak dapat dikirim.');
    } finally {
      setHardwareTestPending(false);
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
              Simulasikan input sensor, semua perhitungan kontrol, dan keluaran aktuator virtual.
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-10 items-center gap-2 self-start rounded-full bg-green-100 px-3 py-2 text-sm font-semibold text-green-800 dark:bg-green-500/15 dark:text-green-200">
          <ShieldCheck size={16} aria-hidden="true" />
          Simulasi lokal · uji hardware terpisah
        </span>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-green-300 bg-green-50 p-4 text-sm leading-6 text-green-950 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-100">
        <CheckCircle2 className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
        <p>
            Perhitungan dan pulsa simulasi tetap lokal. Data Node 1–3 yang sebenarnya tetap dikirim seperti biasa;
            nilai simulasi tidak menggantikan atau mengirim data sensor palsu. Setelah hasil menunjukkan tahap air bersih
            aktif, Anda dapat memilih uji fisik terpisah yang dibatasi flowmeter ESP32.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert" aria-live="assertive">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <span>{error}</span>
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
            <select id="phase-choice" value={phaseChoice} onChange={(event) => setPhaseChoice(event.target.value as 'settings' | SimulationPhase)} className={fieldClassName}>
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
              <CheckField checked={form.irrigationCooldownReady} label="Cooldown irigasi selesai" onChange={(checked) => updateForm('irrigationCooldownReady', checked)} />
              <CheckField checked={form.fireCooldownReady} label="Cooldown Karhutla selesai" onChange={(checked) => updateForm('fireCooldownReady', checked)} />
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={runSimulation}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 font-bold text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
        >
          <Play size={18} aria-hidden="true" />
          Hitung simulasi lokal
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

      <SectionCard
        title="Uji pompa nyata · air saja"
        description="Menjalankan keluaran tahap irigasi air bersih dari hasil simulasi sebagai uji fisik terbatas. Tidak mengubah data node atau menjalankan dosing pupuk."
        icon={<ShieldCheck size={19} />}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            Uji hanya dengan jalur air bersih, buang aliran ke area aman, dan pastikan tidak ada pupuk/larutan kimia.
            Target uji dibatasi 0,2–0,5 L. ESP32 mematikan relay saat target flowmeter nyata tercapai, jika tidak ada flow selama 8 detik,
            atau setelah 30 detik. Dosing fertigasi dan jadwal berbasis waktu tidak dijalankan sebagai uji fisik.
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
              detail="Uji fisik hanya diizinkan pada MANUAL"
            />
            <MetricCard
              label="Relay/pompa nyata"
              value={actuatorSnapshot?.pompa === true ? 'ON' : actuatorSnapshot?.pompa === false ? 'OFF' : '—'}
              detail={actuatorSnapshot?.activeValve ?? 'Belum ada status aktuator'}
            />
            <MetricCard
              label="Flow nyata ESP32"
              value={realFlowRate === null ? '—' : `${formatValue(realFlowRate)} L/menit`}
              detail={`${formatValue(actuatorSnapshot?.currentLiters ?? sensorSnapshot?.session_water)} L sesi`}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {result === null
                ? 'Hitung simulasi untuk memeriksa apakah hasil meminta tahap air bersih.'
                : physicalWaterStage
                  ? `Hasil simulasi: ${stageLabels[result.actuator.stage]} · target dihitung ${formatValue(result.actuator.targetLiters)} L. Uji fisik memakai ${formatValue(hardwareTargetLiters)} L (batas aman 0,2–0,5 L).`
                  : `Hasil simulasi: ${stageLabels[result.actuator.stage]} · tahap ini tidak dapat dijalankan sebagai uji air bersih.`}
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              Syarat mulai: hasil simulasi meminta irigasi/air bersih aktif, gateway online, mode perangkat MANUAL,
              semua relay OFF, flow nyata di bawah 0,05 L/menit, dan konfirmasi jalur air aman.
              Mode otomatis di form hanya memengaruhi perhitungan simulasi; mode Gateway ditampilkan terpisah di atas.
            </p>
          </div>

          <CheckField
            checked={hardwareTestConfirmed}
            label="Saya sudah memastikan jalur hanya berisi air bersih dan area keluaran aman."
            description="Konfirmasi ini wajib untuk setiap uji; simulasi virtual tidak ikut menyalakan relay."
            onChange={setHardwareTestConfirmed}
          />

          {hardwareTestError && (
            <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
              {hardwareTestError}
            </p>
          )}

          {hardwareTestSnapshot && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800" role="status" aria-live="polite">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Status uji: {hardwareTestSnapshot.state.toUpperCase()} · {hardwareTestSnapshot.message}
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                Flowmeter nyata: {formatValue(hardwareTestSnapshot.currentLiters)} / {formatValue(hardwareTestSnapshot.targetLiters)} L
                {' · '}debit {formatValue(hardwareTestSnapshot.flowRate)} L/menit
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={startHardwarePumpTest}
              disabled={!canStartHardwareTest}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={17} aria-hidden="true" />
              {hardwareTestPending ? 'Menghubungi ESP32…' : 'Jalankan hasil simulasi pada pompa'}
            </button>
            {hardwareTestRunning && currentHardwareTestRequestId && (
              <button
                type="button"
                onClick={stopHardwarePumpTest}
                disabled={hardwareTestPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 font-semibold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
              >
                <AlertTriangle size={17} aria-hidden="true" />
                Hentikan uji sekarang
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
            {hardwareTestBlockedReason
              ? `Belum siap: ${hardwareTestBlockedReason}`
              : `Siap menjalankan uji air bersih ${formatValue(hardwareTargetLiters)} L.`}
          </p>
        </div>
      </SectionCard>

      {result && (
        <section className="space-y-5" aria-labelledby="simulation-results" aria-live="polite">
          <div className="flex flex-col gap-3 rounded-3xl border border-green-300 bg-green-50 p-5 dark:border-green-500/30 dark:bg-green-500/10 sm:flex-row sm:items-start">
            <CheckCircle2 className="mt-0.5 shrink-0 text-green-700 dark:text-green-300" size={22} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 id="simulation-results" className="text-lg font-bold text-green-950 dark:text-green-100">{result.priority}</h2>
              <p className="mt-1 text-sm leading-6 text-green-900 dark:text-green-100">{result.action}</p>
            </div>
            <button type="button" onClick={resetStage} className="min-h-10 shrink-0 rounded-xl border border-green-700/30 px-3 text-sm font-semibold text-green-900 hover:bg-green-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 dark:text-green-100 dark:hover:bg-green-500/20">
              Ulangi tahap
            </button>
          </div>

          <SectionCard title="Data input sensor yang dihitung" description="Nilai lokal yang dipakai untuk menghasilkan ringkasan agregasi, skor, FDRS, guard, dan target aktuator di bawah. Telemetri node fisik tetap berjalan terpisah." icon={<Thermometer size={19} />}>
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

          <SectionCard title="Aktuator virtual & progres flow" description="Pulsa flow memajukan state lokal; interlock dan urutan tahap ditampilkan tanpa kendali hardware." icon={<Gauge size={19} />}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">State virtual</p>
                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{stageLabels[result.actuator.stage]}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${anyRelayActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200' : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'}`}>
                    {anyRelayActive ? 'Relay virtual aktif' : 'Semua relay virtual OFF'}
                  </span>
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">{result.actuator.resultMessage}</p>
                {(result.actuator.targetLiters > 0 || result.actuator.stage === 'JADWAL' || isInterStageDelay) && (
                  <>
                    <label htmlFor="stage-progress" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      {isInterStageDelay
                        ? `Progres jeda: ${result.actuator.elapsedSeconds.toFixed(1)} / 3 detik`
                        : result.actuator.stage === 'JADWAL'
                          ? `Durasi: ${result.actuator.elapsedSeconds.toFixed(1)} / ${result.actuator.scheduleDurationSeconds} detik`
                          : `Progres tahap: ${formatValue(result.actuator.stageLiters)} / ${formatValue(result.actuator.targetLiters)} L`}
                    </label>
                    <progress id="stage-progress" aria-label="Progres tahap aktuator" className="h-3 w-full accent-green-700" max={1} value={stageProgress} />
                  </>
                )}
                <dl>
                  <Detail label="Flow tahap ini" value={`${result.actuator.stagePulses} pulsa · ${formatValue(result.actuator.stageLiters)} L`} />
                  <Detail label="Debit terakhir" value={`${formatValue(result.actuator.flowRateLitersPerMinute)} L/menit`} />
                  <Detail label="Waktu tahap" value={`${formatValue(result.actuator.elapsedSeconds, 1)} detik`} />
                  <Detail label="Tahap selesai" value={result.actuator.completedStages.length ? result.actuator.completedStages.map((stage) => stageLabels[stage]).join(' → ') : 'Belum ada'} />
                  <Detail label="Alasan berhenti" value={result.actuator.stopReason ?? '—'} />
                </dl>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Relay irigasi" value={relayOutputs?.irrigation ? 'ON' : 'OFF'} detail="Status virtual" />
                  <MetricCard label="Relay fertigasi" value={relayOutputs?.fertilizer ? 'ON' : 'OFF'} detail="Status virtual" />
                  <MetricCard label="Pompa" value={relayOutputs?.pump ? 'ON' : 'OFF'} detail="Status virtual" />
                </div>
                {!isInterStageDelay && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberField id="flow-pulses" label="Pulsa flow tambahan" value={flowPulses} onChange={setFlowPulses} unit="pulsa" min={0} max={2_000_000} />
                    <NumberField id="flow-seconds" label="Lama pulsa" value={flowSeconds} onChange={setFlowSeconds} unit="detik" min={0.01} max={1_800} step={0.1} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={advanceFlow}
                  disabled={result.actuator.stage === 'IDLE'}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 font-semibold text-blue-800 transition-colors hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                >
                  <Gauge size={17} aria-hidden="true" />
                  {isInterStageDelay ? 'Jalankan jeda virtual 3 detik' : 'Tambahkan flow virtual'}
                </button>
              </div>
            </div>
          </SectionCard>

        </section>
      )}
    </div>
  );
}
