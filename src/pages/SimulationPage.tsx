import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Droplets, FlaskConical, Gauge, Play, Send, ShieldAlert, Square, Thermometer, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMqttStatus } from '../hooks/useMqttStatus';
import { sendSimulationCommand, type SimulationCommand } from '../services/mqtt';

type NodeId = 1 | 2 | 3;

const initialSensorValues = {
  soil: '30',
  temp: '28',
  rh: '65',
  battery: '3.7',
  soil_temp: '42',
  ambient_temp: '34',
  ambient_hum: '45',
};

function readNumber(value: string, label: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} harus bernilai ${min} sampai ${max}.`);
  }
  return parsed;
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled: boolean;
  onChange: (value: string) => void;
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
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rentang {min}–{max} {unit}</p>
    </div>
  );
}

function StatusCard({ label, value, detail, good }: { label: string; value: string; detail: string; good: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-lg font-bold ${good ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export function SimulationPage() {
  const mqttStatus = useMqttStatus();
  const simulation = mqttStatus.simulationSnapshot;
  const actuator = mqttStatus.actuatorSnapshot;
  const [node, setNode] = useState<NodeId>(1);
  const [sensorValues, setSensorValues] = useState(initialSensorValues);
  const [ph, setPh] = useState('6.5');
  const [rain, setRain] = useState('0');
  const [flowPulses, setFlowPulses] = useState('450');
  const [flowSeconds, setFlowSeconds] = useState('10');
  const [confirmPhysicalRun, setConfirmPhysicalRun] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const actuatorValues = [actuator?.irigasi, actuator?.fertigasi, actuator?.pompa];
  const actuatorStateFresh = Boolean(actuator?.updatedAt && mqttStatus.espOnline);
  const actuatorsIdle = actuatorStateFresh && actuatorValues.every((value) => value === false);
  const modeIsAutomatic = actuator?.mode === 'auto';
  const isReady = mqttStatus.mqttConnected && mqttStatus.espOnline;
  const armed = simulation?.armed === true;
  const activeValve = actuator?.activeValve ?? simulation?.activeValve ?? 'IDLE';
  const valveActive = activeValve !== 'IDLE' && activeValve !== '';
  const busy = busyAction !== null;

  const updateSensorValue = (key: keyof typeof initialSensorValues, value: string) => {
    setSensorValues((current) => ({ ...current, [key]: value }));
  };

  const sendCommand = async (command: SimulationCommand, label: string) => {
    setBusyAction(label);
    setFeedback(null);
    try {
      const result = await sendSimulationCommand(command);
      setFeedback({ tone: 'success', message: result.message || `${label} berhasil dikirim ke ESP32.` });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : `Gagal mengirim ${label}.`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const sendSensorData = () => {
    try {
      const battery = readNumber(sensorValues.battery, 'Tegangan baterai', 0, 6);
      if (node === 3) {
        void sendCommand({
          action: 'sensor',
          node,
          soil_temp: readNumber(sensorValues.soil_temp, 'Suhu tanah', -40, 100),
          ambient_temp: readNumber(sensorValues.ambient_temp, 'Suhu udara', -40, 80),
          ambient_hum: readNumber(sensorValues.ambient_hum, 'Kelembapan udara', 0, 100),
          battery,
        }, 'Data Node 3');
        return;
      }

      void sendCommand({
        action: 'sensor',
        node,
        soil: readNumber(sensorValues.soil, 'Kelembapan tanah', 0, 100),
        temp: readNumber(sensorValues.temp, 'Suhu udara', -40, 80),
        rh: readNumber(sensorValues.rh, 'Kelembapan udara', 0, 100),
        battery,
      }, `Data Node ${node}`);
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Periksa kembali nilai sensor.' });
    }
  };

  const sendPh = () => {
    try {
      void sendCommand({ action: 'ph', value: readNumber(ph, 'pH', 0, 14) }, 'Data pH');
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Periksa nilai pH.' });
    }
  };

  const sendRain = () => {
    try {
      void sendCommand({ action: 'rain', value: readNumber(rain, 'Peluang hujan', 0, 100) }, 'Peluang hujan');
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Periksa peluang hujan.' });
    }
  };

  const sendFlow = () => {
    try {
      const pulses = readNumber(flowPulses, 'Pulsa flow', 0, 2_000_000);
      if (!Number.isInteger(pulses)) throw new Error('Pulsa flow harus bilangan bulat.');
      void sendCommand({
        action: 'flow',
        pulses,
        seconds: readNumber(flowSeconds, 'Durasi flow', 0.01, 1800),
      }, 'Pulsa waterflow');
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Periksa nilai waterflow.' });
    }
  };

  const statusTone = feedback?.tone === 'error'
    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
    : 'border-green-300 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200';

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-green-100 p-3 text-green-700 dark:bg-green-500/15 dark:text-green-300">
            <FlaskConical size={24} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Simulasi Sistem</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Kirim data sensor dari web, evaluasi logika ESP32, dan pantau status aktuator melalui MQTT.
            </p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-sm font-semibold ${isReady ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'}`}>
          <Wifi size={16} aria-hidden="true" />
          {isReady ? 'ESP32 & MQTT terhubung' : 'Menunggu ESP32 dan MQTT'}
        </div>
      </header>

      <section className="rounded-3xl border border-amber-300 bg-amber-50 p-4 sm:p-5 dark:border-amber-500/30 dark:bg-amber-500/10" aria-labelledby="physical-warning">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" size={22} aria-hidden="true" />
          <div>
            <h2 id="physical-warning" className="font-bold text-amber-900 dark:text-amber-100">Peringatan: mode ini dapat mengaktifkan relay fisik</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
              Gunakan hanya dengan pompa/katup dalam kondisi aman dan diawasi. ESP32 hanya menerima arm saat mode OTOMATIS,
              MQTT aktif, dan semua aktuator terkonfirmasi OFF. Arm berakhir otomatis setelah 10 menit; tombol stop juga
              mematikan aktuator yang sedang berjalan.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Status simulasi dan perangkat">
        <StatusCard
          label="Sesi simulasi"
          value={armed ? 'ARMED' : 'Tidak aktif'}
          detail={simulation?.updatedAt ? `Status diperbarui ${new Date(simulation.updatedAt).toLocaleTimeString('id-ID')}` : 'Belum menerima status dari ESP32'}
          good={armed}
        />
        <StatusCard
          label="Mode sistem"
          value={actuator?.mode === 'auto' ? 'OTOMATIS' : actuator?.mode === 'manual' ? 'MANUAL' : 'Belum diketahui'}
          detail="Mode OTOMATIS dibutuhkan untuk evaluasi"
          good={modeIsAutomatic}
        />
        <StatusCard
          label="Aktuator"
          value={valveActive ? activeValve.replace(/_/g, ' ') : 'IDLE'}
          detail={`Irigasi ${actuator?.irigasi ? 'ON' : 'OFF'} · Fertigasi ${actuator?.fertigasi ? 'ON' : 'OFF'}`}
          good={!valveActive}
        />
        <StatusCard
          label="Volume sesi"
          value={`${(simulation?.currentLiters ?? actuator?.currentLiters ?? 0).toFixed(2)} L`}
          detail={`Target ${(simulation?.targetLiters ?? actuator?.targetLiters ?? 0).toFixed(2)} L · Debit ${(simulation?.flowRate ?? actuator?.flowRate ?? 0).toFixed(2)} L/menit`}
          good={true}
        />
      </section>

      {simulation?.message && (
        <div className={`flex items-start gap-2 rounded-2xl border p-3 text-sm ${simulation.state === 'rejected' ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'}`} role="status" aria-live="polite">
          {simulation.state === 'rejected' ? <AlertTriangle size={17} aria-hidden="true" /> : <CircleHelp size={17} aria-hidden="true" />}
          <span>{simulation.message}</span>
        </div>
      )}

      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-3 text-sm ${statusTone}`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
        >
          {feedback.message}
        </motion.div>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-2 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <Thermometer size={19} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Data sensor simulasi</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Nilai dikirim ke ESP32 dan ditandai sebagai data simulasi.</p>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Pilih node sensor">
              {([1, 2, 3] as const).map((nodeId) => (
                <button
                  key={nodeId}
                  type="button"
                  aria-pressed={node === nodeId}
                  onClick={() => setNode(nodeId)}
                  className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 ${node === nodeId ? 'border-green-700 bg-green-700 text-white dark:border-green-500 dark:bg-green-600' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                >
                  Node {nodeId}{nodeId === 3 ? ' · Gambut' : ''}
                </button>
              ))}
            </div>

            {node === 3 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField id="soil-temp" label="Suhu tanah gambut" value={sensorValues.soil_temp} min={-40} max={100} step={0.1} unit="°C" disabled={!armed || busy} onChange={(value) => updateSensorValue('soil_temp', value)} />
                <NumberField id="ambient-temp" label="Suhu udara" value={sensorValues.ambient_temp} min={-40} max={80} step={0.1} unit="°C" disabled={!armed || busy} onChange={(value) => updateSensorValue('ambient_temp', value)} />
                <NumberField id="ambient-hum" label="Kelembapan udara" value={sensorValues.ambient_hum} min={0} max={100} step={0.1} unit="%" disabled={!armed || busy} onChange={(value) => updateSensorValue('ambient_hum', value)} />
                <NumberField id="battery-n3" label="Baterai" value={sensorValues.battery} min={0} max={6} step={0.01} unit="V" disabled={!armed || busy} onChange={(value) => updateSensorValue('battery', value)} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField id="soil-moisture" label="Kelembapan tanah" value={sensorValues.soil} min={0} max={100} step={0.1} unit="%" disabled={!armed || busy} onChange={(value) => updateSensorValue('soil', value)} />
                <NumberField id="air-temp" label="Suhu udara" value={sensorValues.temp} min={-40} max={80} step={0.1} unit="°C" disabled={!armed || busy} onChange={(value) => updateSensorValue('temp', value)} />
                <NumberField id="air-rh" label="Kelembapan udara" value={sensorValues.rh} min={0} max={100} step={0.1} unit="%" disabled={!armed || busy} onChange={(value) => updateSensorValue('rh', value)} />
                <NumberField id="battery-node" label="Baterai" value={sensorValues.battery} min={0} max={6} step={0.01} unit="V" disabled={!armed || busy} onChange={(value) => updateSensorValue('battery', value)} />
              </div>
            )}

            <button
              type="button"
              onClick={sendSensorData}
              disabled={!armed || busy}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Send size={17} aria-hidden="true" />
              {busyAction?.startsWith('Data Node') ? 'Mengirim…' : `Kirim data Node ${node}`}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <Droplets size={19} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">pH, cuaca, dan flow</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Masukkan parameter lalu kirim satu per satu ke gateway.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <NumberField id="ph-input" label="pH larutan/tanah" value={ph} min={0} max={14} step={0.1} unit="pH" disabled={!armed || busy} onChange={setPh} />
                <button type="button" onClick={sendPh} disabled={!armed || busy} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  Kirim pH
                </button>
              </div>
              <div className="space-y-2">
                <NumberField id="rain-input" label="Peluang hujan" value={rain} min={0} max={100} step={1} unit="%" disabled={!armed || busy} onChange={setRain} />
                <button type="button" onClick={sendRain} disabled={!armed || busy} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  Kirim peluang hujan
                </button>
              </div>
              <div>
                <NumberField id="flow-pulses" label="Pulsa waterflow tambahan" value={flowPulses} min={0} max={2000000} step={1} unit="pulsa" disabled={!armed || busy || !valveActive} onChange={setFlowPulses} />
              </div>
              <div>
                <NumberField id="flow-seconds" label="Durasi pulsa" value={flowSeconds} min={0.01} max={1800} step={0.1} unit="detik" disabled={!armed || busy || !valveActive} onChange={setFlowSeconds} />
              </div>
            </div>
            <button
              type="button"
              onClick={sendFlow}
              disabled={!armed || busy || !valveActive}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20 sm:w-auto"
            >
              <Gauge size={17} aria-hidden="true" />
              {busyAction === 'Pulsa waterflow' ? 'Mengirim…' : 'Kirim pulsa flow'}
            </button>
            {!valveActive && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Pulsa flow baru bisa dikirim saat aktuator sedang aktif.</p>}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Kontrol uji fisik</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Arm membuka sesi pengujian terbatas. Evaluasi menggunakan logika otomatis ESP32 dan dapat menghidupkan relay.
            </p>

            {armed ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-100">
                  <p className="font-bold">Sesi simulasi aktif</p>
                  <p className="mt-1">Masukkan sensor, lalu jalankan evaluasi. Arm otomatis habis setelah 10 menit.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void sendCommand({ action: 'run' }, 'Evaluasi otomatis')}
                  disabled={busy || !modeIsAutomatic}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 font-bold text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play size={18} aria-hidden="true" />
                  {busyAction === 'Evaluasi otomatis' ? 'Mengevaluasi…' : 'Jalankan evaluasi otomatis'}
                </button>
                <button
                  type="button"
                  onClick={() => void sendCommand({ action: 'disarm' }, 'Stop dan disarm')}
                  disabled={busy}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-bold text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                >
                  <Square size={17} aria-hidden="true" />
                  {busyAction === 'Stop dan disarm' ? 'Menghentikan…' : 'STOP aktuator & disarm'}
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2"><CheckCircle2 size={16} className={mqttStatus.mqttConnected ? 'text-green-600' : 'text-slate-400'} aria-hidden="true" />MQTT browser {mqttStatus.mqttConnected ? 'terhubung' : 'belum terhubung'}</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={16} className={mqttStatus.espOnline ? 'text-green-600' : 'text-slate-400'} aria-hidden="true" />ESP32 {mqttStatus.espOnline ? 'online' : 'belum online'}</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={16} className={modeIsAutomatic ? 'text-green-600' : 'text-slate-400'} aria-hidden="true" />Mode {modeIsAutomatic ? 'OTOMATIS' : 'harus OTOMATIS'}</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={16} className={actuatorsIdle ? 'text-green-600' : 'text-slate-400'} aria-hidden="true" />Semua aktuator {actuatorsIdle ? 'OFF' : 'belum terkonfirmasi OFF'}</li>
                </ul>
                <label className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <input
                    type="checkbox"
                    checked={confirmPhysicalRun}
                    onChange={(event) => setConfirmPhysicalRun(event.target.checked)}
                    disabled={busy}
                    className="mt-1 h-4 w-4 accent-amber-700"
                  />
                  <span>Saya memahami bahwa evaluasi simulasi dapat mengaktifkan pompa/katup fisik dan saya mengawasi perangkat.</span>
                </label>
                <button
                  type="button"
                  onClick={() => void sendCommand({ action: 'arm', confirm: 'ARM' }, 'Arm simulasi')}
                  disabled={busy || !isReady || !modeIsAutomatic || !actuatorsIdle || !confirmPhysicalRun}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-3 font-bold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldAlert size={18} aria-hidden="true" />
                  {busyAction === 'Arm simulasi' ? 'Meminta arm…' : 'ARM simulasi live'}
                </button>
                {!actuatorStateFresh && <p className="text-xs text-amber-800 dark:text-amber-200">Menunggu status aktuator terbaru dari ESP32 sebelum arm dapat dibuka.</p>}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Urutan penggunaan</h2>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              <li>Hubungkan MQTT dan pastikan ESP32 online, mode OTOMATIS, serta aktuator OFF.</li>
              <li>Centang konfirmasi risiko fisik, lalu tekan ARM.</li>
              <li>Kirim data Node 1/2/3, pH, dan peluang hujan.</li>
              <li>Tekan evaluasi. Jika syarat otomatis terpenuhi, relay fisik menyala.</li>
              <li>Kirim pulsa flow tambahan untuk menguji penghentian berdasarkan volume.</li>
              <li>Tekan STOP &amp; disarm setelah uji selesai.</li>
            </ol>
            <p className="mt-4 rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Data sensor bertanda simulasi hanya untuk sesi uji dan tidak disimpan ESP32 ke NVS atau web ke riwayat database.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
