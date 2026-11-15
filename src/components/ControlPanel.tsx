import { useState } from 'react';
import { Bot, CirclePower, Droplets, FlaskConical, Hand, Radio } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useControl } from '../hooks/useControl';
import { useMqttStatus } from '../hooks/useMqttStatus';

type Feedback = { tone: 'success' | 'error'; message: string } | null;
type ActuatorKey = 'irrigation' | 'fertigation';
type CommandTarget = ActuatorKey | 'mode';

interface CommandButtonProps {
  label: string;
  icon: LucideIcon;
  variant: 'on' | 'off';
  onClick: () => void;
  disabled: boolean;
  pressed?: boolean;
}

function CommandButton({ label, icon: Icon, variant, onClick, disabled, pressed }: CommandButtonProps) {
  const style = variant === 'on'
    ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
    : 'border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-400/30 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900 ${style}`}
    >
      <Icon aria-hidden="true" size={18} />
      {label}
    </button>
  );
}

interface ActuatorCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  active: boolean | null;
  onTurnOn: () => void;
  onTurnOff: () => void;
  controlsLocked: boolean;
  commandsDisabled: boolean;
  pending: boolean;
  feedback: Feedback;
}

function ActuatorCard({
  title,
  description,
  icon: Icon,
  active,
  onTurnOn,
  onTurnOff,
  controlsLocked,
  commandsDisabled,
  pending,
  feedback,
}: ActuatorCardProps) {
  const isActive = active === true;
  const isInactive = active === false;
  const statusText = isActive ? 'Menyala' : isInactive ? 'Mati' : 'Menunggu status';
  const statusStyle = isActive
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
    : isInactive
      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-labelledby={`${title.toLowerCase()}-control-title`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Icon aria-hidden="true" size={22} />
          </div>
          <div>
            <h3 id={`${title.toLowerCase()}-control-title`} className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle}`} aria-live="polite">
          {statusText}
        </span>
      </div>

      {controlsLocked && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" role="status">
          Aktifkan mode <strong>Manual</strong> untuk mengirim perintah {title.toLowerCase()}.
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <CommandButton
          label="ON"
          icon={CirclePower}
          variant="on"
          onClick={onTurnOn}
          disabled={controlsLocked || commandsDisabled || isActive}
          pressed={isActive}
        />
        <CommandButton
          label="OFF"
          icon={CirclePower}
          variant="off"
          onClick={onTurnOff}
          disabled={controlsLocked || commandsDisabled || isInactive}
          pressed={isInactive}
        />
      </div>

      {pending && <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300" role="status">Mengirim perintah dan menunggu konfirmasi Gateway...</p>}
      {feedback && (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/50 dark:bg-emerald-950/80 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/50 dark:bg-rose-950/80 dark:text-rose-50'}`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
}

export function ControlPanel() {
  const { sendCommand } = useControl();
  const { actuatorSnapshot, espOnline } = useMqttStatus();
  const [modeFeedback, setModeFeedback] = useState<Feedback>(null);
  const [actuatorFeedback, setActuatorFeedback] = useState<Record<ActuatorKey, Feedback>>({
    irrigation: null,
    fertigation: null,
  });
  const [pendingTargets, setPendingTargets] = useState<Record<CommandTarget, boolean>>({
    irrigation: false,
    fertigation: false,
    mode: false,
  });

  const mode = actuatorSnapshot?.mode ?? null;
  const manualMode = mode === 'manual';
  // Hanya kunci kontrol manual jika sistem secara aktif berada di mode Otomatis
  const controlsLocked = mode === 'auto';

  const runCommand = async (
    target: CommandTarget,
    action: string,
    successMessage: string,
    setFeedback: (value: Feedback) => void,
  ) => {
    setFeedback(null);
    setPendingTargets((current) => ({ ...current, [target]: true }));
    try {
      const result = await sendCommand(action);
      setFeedback(
        result.success
          ? { tone: 'success', message: successMessage }
          : { tone: 'error', message: result.error ?? 'Gateway belum mengonfirmasi perintah.' },
      );
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Gagal mengirim perintah ke Gateway.',
      });
    } finally {
      setPendingTargets((current) => ({ ...current, [target]: false }));
    }
  };

  const sendModeCommand = (action: string, successMessage: string) => {
    void runCommand('mode', action, successMessage, setModeFeedback);
  };

  const sendActuatorCommand = (target: ActuatorKey, action: string, successMessage: string) => {
    void runCommand(target, action, successMessage, (feedback) => {
      setActuatorFeedback((current) => ({ ...current, [target]: feedback }));
    });
  };

  const modeLabel = mode === 'manual' ? 'Manual' : mode === 'auto' ? 'Otomatis' : 'Belum tersinkron';
  const modeDescription = mode === 'manual'
    ? 'Anda mengendalikan katup irigasi dan fertigasi secara langsung.'
    : mode === 'auto'
      ? 'ESP32 Gateway mengatur aktuator berdasarkan data sensor dan aturan otomatisasi.'
      : 'Pilih mode untuk meminta status terbaru dari ESP32 Gateway.';

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-labelledby="gateway-mode-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Radio aria-hidden="true" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pengendali aktuator</p>
              <h3 id="gateway-mode-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">ESP32 Gateway</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{modeDescription}</p>
            </div>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${espOnline ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            <span className={`h-2 w-2 rounded-full ${espOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
            {espOnline ? 'Gateway terhubung' : 'Menunggu Gateway'}
          </span>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Mode operasi</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Mode aktif: <span className="font-semibold">{modeLabel}</span></p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Pilih mode operasi Gateway">
              <button
                type="button"
                onClick={() => sendModeCommand('mode_manual', 'Mode Manual aktif. Anda dapat mengontrol aktuator.')}
                disabled={pendingTargets.mode || manualMode}
                aria-pressed={manualMode}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 ${manualMode ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
              >
                <Hand aria-hidden="true" size={17} />
                Manual
              </button>
              <button
                type="button"
                onClick={() => sendModeCommand('mode_auto', 'Mode Otomatis aktif. Gateway kembali mengatur aktuator.')}
                disabled={pendingTargets.mode || mode === 'auto'}
                aria-pressed={mode === 'auto'}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 ${mode === 'auto' ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
              >
                <Bot aria-hidden="true" size={17} />
                Otomatis
              </button>
            </div>
          </div>
          {pendingTargets.mode && <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300" role="status">Mengirim perubahan mode ke Gateway...</p>}
          {modeFeedback && (
            <p
              className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${modeFeedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/50 dark:bg-emerald-950/80 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/50 dark:bg-rose-950/80 dark:text-rose-50'}`}
              role={modeFeedback.tone === 'error' ? 'alert' : 'status'}
            >
              {modeFeedback.message}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ActuatorCard
          title="Irigasi"
          description="Membuka atau menutup jalur air irigasi."
          icon={Droplets}
          active={actuatorSnapshot?.irigasi ?? null}
          controlsLocked={controlsLocked}
          commandsDisabled={pendingTargets.irrigation}
          pending={pendingTargets.irrigation}
          feedback={actuatorFeedback.irrigation}
          onTurnOn={() => sendActuatorCommand('irrigation', 'irrigation_on', 'Irigasi dinyalakan oleh ESP32 Gateway.')}
          onTurnOff={() => sendActuatorCommand('irrigation', 'irrigation_off', 'Irigasi dimatikan oleh ESP32 Gateway.')}
        />
        <ActuatorCard
          title="Fertigasi"
          description="Membuka atau menutup jalur pemberian nutrisi."
          icon={FlaskConical}
          active={actuatorSnapshot?.fertigasi ?? null}
          controlsLocked={controlsLocked}
          commandsDisabled={pendingTargets.fertigation}
          pending={pendingTargets.fertigation}
          feedback={actuatorFeedback.fertigation}
          onTurnOn={() => sendActuatorCommand('fertigation', 'fertigation_on', 'Fertigasi dinyalakan oleh ESP32 Gateway.')}
          onTurnOff={() => sendActuatorCommand('fertigation', 'fertigation_off', 'Fertigasi dimatikan oleh ESP32 Gateway.')}
        />
      </div>

    </div>
  );
}
