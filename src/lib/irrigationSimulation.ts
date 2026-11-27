export type SimulationPhase = 'vegetatif' | 'generatif';
export type SimulationStage =
  | 'IDLE'
  | 'IRIGASI'
  | 'JADWAL'
  | 'PRE_WET'
  | 'INTER_DELAY'
  | 'FERTIGASI'
  | 'POST_FLUSH_DELAY'
  | 'POST_FLUSH';

export interface SimulationNodeInput {
  soil: number | null;
  temperature: number | null;
  humidity: number | null;
}

export interface IrrigationSimulationInput {
  node1: SimulationNodeInput;
  node2: SimulationNodeInput;
  rainChance: number;
  ph: number;
  phase: SimulationPhase;
  automaticMode: boolean;
  node3Online: boolean;
  node3SoilTemp: number | null;
  node3AmbientTemp: number | null;
  node3AmbientRh: number | null;
  windKmh: number;
  previousFfmc: number;
  previousDmc: number;
  previousDc: number;
  fireLevelOverride: number | null;
  criticalSoil: number;
  upperSoil: number;
  activeScoreThreshold: number;
  lowerScoreThreshold: number;
  highTemperatureThreshold: number;
  lowHumidityThreshold: number;
  previousCycleActive: boolean;
  irrigationCooldownReady: boolean;
  fireCooldownReady: boolean;
  timeValid: boolean;
  hour: number;
  minute: number;
  day: number;
  month: number;
  fertilizerIntervalDays: number;
  lastFertilizerDay: number;
  lastFertilizerMonth: number;
  fertilizerDueOverride: boolean | null;
  scheduleEnabled: boolean;
  scheduleTime: string;
  scheduleDurationSeconds: number;
  scheduleAlreadyDone: boolean;
}

export interface WaterTargetBreakdown {
  soilDeficit: number;
  evaporationBase: number;
  temperatureAdjustment: number;
  humidityAdjustment: number;
  evaporationFactor: number;
  phaseFactor: number;
  scoreFactor: number;
  rawLiters: number;
  calculatedLiters: number;
  appliedLiters: number;
}

export interface FireWeatherResult {
  ffmc: number;
  dmc: number;
  dc: number;
  isi: number;
  bui: number;
  fwi: number;
  level: number;
  levelLabel: string;
  soilTemperatureOverride: boolean;
  trigger: boolean;
}

export interface FertilizerResult {
  intervalDue: boolean;
  daysSinceLastFertilizer: number | null;
  biologicalWindow: boolean;
  guards: {
    rain: boolean;
    wetSoil: boolean;
    hotHour: boolean;
    dangerousPh: boolean;
  };
  firstBlockReason: string | null;
  peatAcid: boolean;
  allowed: boolean;
  baseDoseLiters: number | null;
  phaseDoseLiters: number | null;
  finalDoseLiters: number | null;
  preWetLiters: number | null;
  postFlushLiters: number | null;
}

export interface VirtualActuatorState {
  stage: SimulationStage;
  targetLiters: number;
  stageLiters: number;
  stagePulses: number;
  elapsedSeconds: number;
  flowRateLitersPerMinute: number;
  scheduleDurationSeconds: number;
  completedStages: SimulationStage[];
  resultMessage: string;
  stopReason: string | null;
}

export interface IrrigationSimulationResult {
  soilRepresentative: number;
  soilMinimum: number;
  averageTemperature: number;
  averageHumidity: number;
  vpd: number;
  score: {
    soil: number;
    vpd: number;
    interaction: number;
    rainPenalty: number;
    total: number;
    cycleActive: boolean;
  };
  fire: FireWeatherResult | null;
  fertilizer: FertilizerResult;
  scheduledWateringDue: boolean;
  scheduledWateringSkippedReason: string | null;
  irrigationDecision: string;
  priority: string;
  action: string;
  waterTarget: WaterTargetBreakdown | null;
  actuator: VirtualActuatorState;
  trace: string[];
}

const FLOW_PULSES_PER_LITER = 450;
const MAX_FERTILIZER_LITERS_NORMAL = 2.5;
const MAX_FERTILIZER_LITERS_PEAT = 3.5;
const FIRE_LEVEL_LABELS = ['RENDAH', 'SEDANG', 'TINGGI', 'SANGAT TINGGI', 'DARURAT'];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function validateRange(value: number | null, label: string, min: number, max: number) {
  if (value !== null && (!Number.isFinite(value) || value < min || value > max)) {
    throw new Error(`${label} harus bernilai ${min} sampai ${max}.`);
  }
}

function validateInput(input: IrrigationSimulationInput) {
  validateRange(input.node1.soil, 'Soil Node 1', 0, 100);
  validateRange(input.node2.soil, 'Soil Node 2', 0, 100);
  validateRange(input.node1.temperature, 'Suhu Node 1', -40, 80);
  validateRange(input.node2.temperature, 'Suhu Node 2', -40, 80);
  validateRange(input.node1.humidity, 'RH Node 1', 0, 100);
  validateRange(input.node2.humidity, 'RH Node 2', 0, 100);
  validateRange(input.rainChance, 'Peluang hujan', 0, 100);
  validateRange(input.ph, 'pH larutan', 0, 14);
  validateRange(input.node3SoilTemp, 'Suhu tanah gambut', -40, 100);
  validateRange(input.node3AmbientTemp, 'Suhu udara Node 3', -40, 80);
  validateRange(input.node3AmbientRh, 'RH Node 3', 0, 100);
  validateRange(input.windKmh, 'Kecepatan angin', 0, 150);
  validateRange(input.previousFfmc, 'FFMC sebelumnya', 0, 101);
  validateRange(input.previousDmc, 'DMC sebelumnya', 0, 10_000);
  validateRange(input.previousDc, 'DC sebelumnya', 0, 10_000);
  validateRange(input.fireLevelOverride, 'Override level FWI', 0, 4);
  validateRange(input.criticalSoil, 'Ambang tanah kritis', 0, 100);
  validateRange(input.upperSoil, 'Ambang tanah atas', 0, 100);
  validateRange(input.activeScoreThreshold, 'Ambang skor aktif', 0, 100);
  validateRange(input.lowerScoreThreshold, 'Ambang skor bawah', 0, 100);
  validateRange(input.highTemperatureThreshold, 'Ambang suhu tinggi', 0, 80);
  validateRange(input.lowHumidityThreshold, 'Ambang RH rendah', 0, 100);
  validateRange(input.hour, 'Jam', 0, 23);
  validateRange(input.minute, 'Menit', 0, 59);
  validateRange(input.day, 'Tanggal', 1, 31);
  validateRange(input.month, 'Bulan', 1, 12);
  validateRange(input.fertilizerIntervalDays, 'Interval fertigasi', 1, 30);
  validateRange(input.lastFertilizerDay, 'Tanggal fertigasi terakhir', -1, 31);
  validateRange(input.lastFertilizerMonth, 'Bulan fertigasi terakhir', -1, 12);
  validateRange(input.scheduleDurationSeconds, 'Durasi jadwal', 1, 3_600);

  if (!Number.isInteger(input.hour) || !Number.isInteger(input.minute) ||
      !Number.isInteger(input.day) || !Number.isInteger(input.month) ||
      !Number.isInteger(input.fertilizerIntervalDays) ||
      !Number.isInteger(input.lastFertilizerDay) ||
      !Number.isInteger(input.lastFertilizerMonth) ||
      !Number.isInteger(input.scheduleDurationSeconds)) {
    throw new Error('Jam, tanggal, interval, dan durasi jadwal harus berupa bilangan bulat.');
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.scheduleTime)) {
    throw new Error('Waktu jadwal harus memakai format HH:MM.');
  }
  if (input.fireLevelOverride !== null && !Number.isInteger(input.fireLevelOverride)) {
    throw new Error('Override level FWI harus bilangan bulat 0 sampai 4.');
  }
}

function soilMetrics(soil1: number | null, soil2: number | null) {
  if (soil1 !== null && soil2 !== null) {
    const min = Math.min(soil1, soil2);
    const difference = Math.abs(soil1 - soil2);
    const representative = difference > 8
      ? min * 0.7 + ((soil1 + soil2) / 2) * 0.3
      : (soil1 + soil2) / 2;
    return { representative, min };
  }
  if (soil1 !== null) return { representative: soil1, min: soil1 };
  if (soil2 !== null) return { representative: soil2, min: soil2 };
  return { representative: 50, min: 50 };
}

function averageValid(values: Array<number | null>, fallback: number) {
  const valid = values.filter((value): value is number => value !== null && value > 0);
  return valid.length > 0
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : fallback;
}

function calculateVpd(temperature: number, humidity: number) {
  const saturationVaporPressure = 0.6108 * Math.exp((17.27 * temperature) / (temperature + 237.3));
  return clamp(saturationVaporPressure * (1 - humidity / 100), 0.4, 2.0);
}

function calculateFfmc(temperature: number, humidity: number, previousFfmc: number) {
  const moisture = 147.2 * (101 - previousFfmc) / (59.5 + previousFfmc);
  const dryEquilibrium =
    0.942 * Math.pow(humidity, 0.679) +
    11 * Math.exp((humidity - 100) / 10) +
    0.18 * (21.1 - temperature) * (1 - Math.exp(-0.115 * humidity));
  const wetEquilibrium =
    0.618 * Math.pow(humidity, 0.753) +
    10 * Math.exp((humidity - 100) / 10) +
    0.18 * (21.1 - temperature) * (1 - Math.exp(-0.115 * humidity));
  let newMoisture = moisture;

  if (moisture > dryEquilibrium) {
    const drying = (0.424 * (1 - Math.pow(humidity / 100, 1.7)) +
      0.0694 * (1 - Math.pow(humidity / 100, 8))) * 0.581 * Math.exp(0.0365 * temperature);
    newMoisture = dryEquilibrium + (moisture - dryEquilibrium) * Math.pow(10, -drying);
  } else if (moisture < wetEquilibrium) {
    const wetting = (0.424 * (1 - Math.pow((100 - humidity) / 100, 1.7)) +
      0.0694 * (1 - Math.pow((100 - humidity) / 100, 8))) * 0.581 * Math.exp(0.0365 * temperature);
    newMoisture = wetEquilibrium - (wetEquilibrium - moisture) * Math.pow(10, -wetting);
  }

  return clamp(59.5 * (250 - newMoisture) / (147.2 + newMoisture), 0, 101);
}

function calculateDmc(temperature: number, humidity: number, previousDmc: number) {
  let drying = 0;
  if (temperature >= -1.1) {
    const factor = 1.894 * (temperature + 1.1) * (100 - humidity) * 0.0001;
    drying = 1.1 * factor * 24;
  }
  return Math.max(previousDmc + drying, 0);
}

function calculateDc(temperature: number, soilTemperature: number | null, previousDc: number) {
  let drying = 0;
  if (temperature >= -2.8) {
    drying = (0.36 * (temperature + 2.8) + 9) / 2;
  }
  let dc = previousDc + 0.5 * drying;
  if (soilTemperature !== null) {
    if (soilTemperature >= 35) dc += 10;
    if (soilTemperature >= 40) dc += 25;
    if (soilTemperature >= 45) dc += 45;
  }
  return Math.max(dc, 0);
}

function calculateIsi(ffmc: number, windKmh: number) {
  const windFactor = Math.exp(0.05039 * windKmh);
  const moisture = 147.2 * (101 - ffmc) / (59.5 + ffmc);
  const fineFuelFactor = 91.9 * Math.exp(-0.1386 * moisture) *
    (1 + Math.pow(moisture, 5.31) / 49_300_000);
  return Math.max(0.208 * windFactor * fineFuelFactor, 0);
}

function calculateBui(dmc: number, dc: number) {
  if (dmc === 0 && dc === 0) return 0;
  const bui = dmc <= 0.4 * dc
    ? 0.8 * dmc * dc / (dmc + 0.4 * dc)
    : dmc - (1 - 0.8 * dc / (dmc + 0.4 * dc)) *
      (0.92 + Math.pow(0.0114 * dmc, 1.7));
  return Math.max(bui, 0);
}

function calculateFwi(isi: number, bui: number) {
  const droughtFactor = bui <= 80
    ? 0.626 * Math.pow(bui, 0.809) + 2
    : 1000 / (25 + 108.64 * Math.exp(-0.023 * bui));
  const buildup = 0.1 * isi * droughtFactor;
  return Math.max(buildup > 1
    ? Math.exp(2.72 * Math.pow(0.434 * Math.log(buildup), 0.647))
    : buildup, 0);
}

function fireLevelFor(fwi: number, soilTemperature: number | null) {
  if (soilTemperature !== null && soilTemperature >= 50) return 4;
  if (fwi > 32) return 3;
  if (fwi > 17) return 2;
  if (fwi > 8) return 1;
  return 0;
}

function calculateWaterTarget(
  soil: number,
  vpd: number,
  score: number,
  temperature: number,
  humidity: number,
  input: IrrigationSimulationInput,
): WaterTargetBreakdown {
  const soilDeficit = Math.max(0, input.upperSoil - soil);
  const evaporationBase = 1 + ((vpd - 0.8) * 0.4);
  const temperatureAdjustment = temperature > input.highTemperatureThreshold ? 0.15 : 0;
  const humidityAdjustment = humidity < input.lowHumidityThreshold ? 0.1 : 0;
  const evaporationFactor = clamp(
    evaporationBase + temperatureAdjustment + humidityAdjustment,
    0.8,
    1.8,
  );
  const phaseFactor = input.phase === 'vegetatif' ? 1 : 0.85;
  const scoreFactor = clamp(score / 50, 0.6, 1.5);
  const rawLiters = (soilDeficit / 30) * 1.5 *
    evaporationFactor * phaseFactor * scoreFactor;
  const calculatedLiters = soilDeficit <= 0 ? 0 : clamp(rawLiters, 0.4, 3.5);
  return {
    soilDeficit,
    evaporationBase,
    temperatureAdjustment,
    humidityAdjustment,
    evaporationFactor,
    phaseFactor,
    scoreFactor,
    rawLiters,
    calculatedLiters,
    appliedLiters: calculatedLiters,
  };
}

function startActuator(
  stage: SimulationStage,
  targetLiters: number,
  message: string,
  scheduleDurationSeconds = 0,
): VirtualActuatorState {
  return {
    stage,
    targetLiters,
    stageLiters: 0,
    stagePulses: 0,
    elapsedSeconds: 0,
    flowRateLitersPerMinute: 0,
    scheduleDurationSeconds,
    completedStages: [],
    resultMessage: message,
    stopReason: null,
  };
}

function idleActuator(message: string): VirtualActuatorState {
  return startActuator('IDLE', 0, message);
}

function biologicalWindow(hour: number, minute: number) {
  return (hour === 6 && minute >= 30) || hour === 7 ||
    (hour === 8 && minute <= 30) || hour === 16 ||
    (hour === 17 && minute <= 30);
}

function intervalDue(input: IrrigationSimulationInput) {
  if (!input.timeValid) return { due: false, daysSince: null as number | null };
  if (input.lastFertilizerDay === -1) return { due: true, daysSince: null as number | null };

  let daysSince: number | null = null;
  let due = false;
  if (input.lastFertilizerDay !== input.day ||
      input.lastFertilizerMonth !== input.month) {
    daysSince = input.day >= input.lastFertilizerDay
      ? input.day - input.lastFertilizerDay
      : input.day + 30 - input.lastFertilizerDay;
    due = daysSince >= input.fertilizerIntervalDays;
  }
  if (input.fertilizerDueOverride !== null) due = input.fertilizerDueOverride;
  return { due, daysSince };
}

function irrigationDecisionFor(
  soilRepresentative: number,
  soilMinimum: number,
  rainChance: number,
  input: IrrigationSimulationInput,
  scoreTotal: number,
  cycleActive: boolean,
) {
  if (soilMinimum > 5 && soilMinimum <= input.criticalSoil && input.irrigationCooldownReady) {
    return 'EMERGENCY';
  }
  if (soilRepresentative >= input.upperSoil) return 'SOIL_SATURATED';
  if (rainChance >= 85) return 'HEAVY_RAIN';
  if (!input.irrigationCooldownReady) return 'WAIT_COOLDOWN';
  if (cycleActive || scoreTotal >= input.activeScoreThreshold) return 'SCORE_TRIGGER';
  return 'SCORE_BELOW_TRIGGER';
}

export function evaluateIrrigationScenario(input: IrrigationSimulationInput): IrrigationSimulationResult {
  validateInput(input);
  const soils = soilMetrics(input.node1.soil, input.node2.soil);
  const averageTemperature = averageValid(
    [input.node1.temperature, input.node2.temperature],
    28,
  );
  const averageHumidity = averageValid(
    [input.node1.humidity, input.node2.humidity],
    65,
  );

  const vpd = calculateVpd(averageTemperature, averageHumidity);
  const vpdScore = clamp(((vpd - 0.4) * 30) / (2 - 0.4), 0, 30);
  let soilScoreUpper = input.upperSoil;
  if (soilScoreUpper <= input.criticalSoil) soilScoreUpper = input.criticalSoil + 1;
  const soilScore = clamp(
    ((soilScoreUpper - soils.representative) * 50) /
      (soilScoreUpper - input.criticalSoil),
    0,
    50,
  );
  const rainPenalty = clamp((clamp(input.rainChance, 0, 100) / 100) * 40, 0, 40);
  const interaction = clamp((soilScore * vpdScore) / 75, 0, 20);
  const scoreTotal = clamp(soilScore + vpdScore + interaction - rainPenalty, 0, 100);
  const cycleActive = scoreTotal >= input.activeScoreThreshold
    ? true
    : scoreTotal <= input.lowerScoreThreshold
      ? false
      : input.previousCycleActive;

  let fire: FireWeatherResult | null = null;
  if (input.node3Online) {
    const ambientTemperature = input.node3AmbientTemp ?? averageTemperature;
    const ambientRh = input.node3AmbientRh ?? averageHumidity;
    const ffmc = calculateFfmc(ambientTemperature, ambientRh, input.previousFfmc);
    const dmc = calculateDmc(ambientTemperature, ambientRh, input.previousDmc);
    const dc = calculateDc(ambientTemperature, input.node3SoilTemp, input.previousDc);
    const isi = calculateIsi(ffmc, input.windKmh);
    const bui = calculateBui(dmc, dc);
    const fwi = calculateFwi(isi, bui);
    const calculatedLevel = fireLevelFor(fwi, input.node3SoilTemp);
    const level = input.fireLevelOverride ?? calculatedLevel;
    fire = {
      ffmc,
      dmc,
      dc,
      isi,
      bui,
      fwi,
      level,
      levelLabel: FIRE_LEVEL_LABELS[level] ?? FIRE_LEVEL_LABELS[0],
      soilTemperatureOverride: input.node3SoilTemp !== null && input.node3SoilTemp >= 50,
      trigger: (input.node3SoilTemp !== null && input.node3SoilTemp >= 40) || level >= 2,
    };
  }

  const due = intervalDue(input);
  const inWindow = input.timeValid && biologicalWindow(input.hour, input.minute);
  const peatAcid = input.node3Online && input.ph < 4.8;
  const guards = {
    rain: input.rainChance >= 60,
    wetSoil: soils.representative >= input.upperSoil,
    hotHour: input.timeValid && input.hour >= 11 && input.hour < 14,
    dangerousPh: input.ph < 4 || input.ph > 8.5,
  };
  const firstBlockReason = guards.rain
    ? 'Peluang hujan >=60% (cegah leaching)'
    : guards.wetSoil
      ? 'Tanah sudah basah (cegah busuk akar)'
      : guards.hotHour
        ? 'Siang terik 11:00–14:00 (cegah root burn)'
        : guards.dangerousPh
          ? 'pH tandon berbahaya (<4 atau >8.5)'
          : null;
  const fertilizerAllowed = firstBlockReason === null &&
    ((due.due && inWindow) || peatAcid);
  const fertilizer: FertilizerResult = {
    intervalDue: due.due,
    daysSinceLastFertilizer: due.daysSince,
    biologicalWindow: inWindow,
    guards,
    firstBlockReason,
    peatAcid,
    allowed: fertilizerAllowed,
    baseDoseLiters: null,
    phaseDoseLiters: null,
    finalDoseLiters: null,
    preWetLiters: null,
    postFlushLiters: null,
  };

  const scheduleTimeParts = input.scheduleTime.split(':').map(Number);
  const scheduledWateringDue = input.timeValid && input.scheduleEnabled &&
    !input.scheduleAlreadyDone && input.hour === scheduleTimeParts[0] &&
    input.minute === scheduleTimeParts[1];
  const scheduledWateringSkippedReason = scheduledWateringDue
    ? soils.representative >= input.upperSoil
      ? 'Tanah sudah jenuh'
      : input.rainChance >= 85
        ? 'Peluang hujan >=85%'
        : null
    : null;

  const irrigationDecision = irrigationDecisionFor(
    soils.representative,
    soils.min,
    input.rainChance,
    input,
    scoreTotal,
    cycleActive,
  );
  const trace: string[] = [];
  let priority = 'Tidak ada prioritas aktif';
  let action = 'Tidak ada aktuator berjalan';
  let waterTarget: WaterTargetBreakdown | null = null;
  let actuator = idleActuator('Semua relay virtual OFF');

  if (scheduledWateringDue && scheduledWateringSkippedReason === null) {
    priority = 'Jadwal penyiraman';
    action = `Irigasi terjadwal selama ${input.scheduleDurationSeconds} detik`;
    actuator = startActuator(
      'JADWAL',
      0,
      action,
      input.scheduleDurationSeconds,
    );
    trace.push('Jadwal cocok dan lolos guard tanah jenuh/hujan; evaluasi otomatis tidak dijalankan pada siklus ini.');
    return buildResult();
  }
  if (scheduledWateringDue && scheduledWateringSkippedReason !== null) {
    trace.push(`Jadwal dibatalkan: ${scheduledWateringSkippedReason}; jalur otomatis dilanjutkan.`);
  }
  if (!input.automaticMode) {
    priority = 'Mode manual';
    trace.push('Mode MANUAL: evaluator otomatis dilewati.');
    return buildResult();
  }

  if (input.node3Online && fire?.trigger) {
    if (input.fireCooldownReady) {
      priority = 'Prioritas 1 · Karhutla gambut';
      const preWetLiters = fire.level === 3 ? 5 : 3;
      const adjustedPreWet = fire.level >= 4 ||
        (input.node3SoilTemp !== null && input.node3SoilTemp >= 50)
        ? 8
        : preWetLiters;
      const doseLiters = Math.min(input.ph < 4.8 ? 2.5 : 1.5, MAX_FERTILIZER_LITERS_PEAT);
      fertilizer.baseDoseLiters = doseLiters;
      fertilizer.phaseDoseLiters = doseLiters;
      fertilizer.finalDoseLiters = doseLiters;
      fertilizer.preWetLiters = adjustedPreWet;
      fertilizer.postFlushLiters = 0.8;
      action = `Rewetting ${adjustedPreWet.toFixed(2)} L → amelioran ${doseLiters.toFixed(2)} L → flush 0.80 L`;
      actuator = startActuator('PRE_WET', adjustedPreWet, action);
      trace.push(`Bahaya terdeteksi (suhu gambut >=40°C atau FWI level >=2), cooldown gambut siap; target rewetting ${adjustedPreWet.toFixed(2)} L.`);
      return buildResult();
    }
    trace.push('Bahaya Karhutla terdeteksi tetapi cooldown gambut belum siap; evaluasi lanjut ke prioritas berikutnya.');
  } else {
    trace.push('Prioritas Karhutla tidak aktif.');
  }

  if (input.node3Online && input.node1.soil !== null && input.node1.soil >= 85) {
    priority = 'Prioritas 1B · Gambut jenuh';
    action = 'Penyiraman diblokir karena kelembapan Node 1 >=85%';
    trace.push(action);
    return buildResult();
  }

  trace.push(`Skor hortikultura menghasilkan keputusan ${irrigationDecision}.`);
  if (irrigationDecision === 'EMERGENCY') {
    priority = 'Prioritas 2 · Kekeringan kritis';
    waterTarget = calculateWaterTarget(
      soils.min,
      vpd,
      65,
      averageTemperature,
      averageHumidity,
      input,
    );
    waterTarget.appliedLiters = Math.max(waterTarget.calculatedLiters, 1.2);
    action = `Irigasi air bersih darurat ${waterTarget.appliedLiters.toFixed(2)} L`;
    actuator = startActuator('IRIGASI', waterTarget.appliedLiters, action);
    return buildResult();
  }

  if (irrigationDecision !== 'SCORE_TRIGGER') {
    priority = irrigationDecision === 'SOIL_SATURATED' || irrigationDecision === 'HEAVY_RAIN'
      ? 'Prioritas 3 · Proteksi kejenuhan/cuaca'
      : 'Prioritas 4 · Menunggu kondisi';
    action = `Tidak menyiram: ${irrigationDecision}`;
    trace.push(action);
    return buildResult();
  }

  if (fertilizerAllowed) {
    const baseDose = 0.8 * (1 + (Math.abs(input.ph - 6.5) * 0.35));
    const clampedBase = clamp(baseDose, 0.3, 2.5);
    const phaseDose = input.phase === 'vegetatif'
      ? clamp(clampedBase * 0.9, 0.4, 1.2)
      : clamp(clampedBase * 1.15, 0.6, 1.8);
    const finalDose = peatAcid
      ? clamp(phaseDose * 1.4, 1, MAX_FERTILIZER_LITERS_PEAT)
      : Math.min(phaseDose, MAX_FERTILIZER_LITERS_NORMAL);
    const preWet = peatAcid ? 1 : Math.max(finalDose * 0.35, 0.3);
    const postFlush = peatAcid ? 0.6 : Math.max(finalDose * 0.25, 0.25);
    fertilizer.baseDoseLiters = clampedBase;
    fertilizer.phaseDoseLiters = phaseDose;
    fertilizer.finalDoseLiters = finalDose;
    fertilizer.preWetLiters = preWet;
    fertilizer.postFlushLiters = postFlush;
    priority = peatAcid
      ? 'Prioritas 4 · Ameliorasi gambut masam'
      : 'Prioritas 4 · Fertigasi';
    action = `PRE-WET ${preWet.toFixed(2)} L → DOSING ${finalDose.toFixed(2)} L → POST-FLUSH ${postFlush.toFixed(2)} L`;
    actuator = startActuator('PRE_WET', preWet, action);
    trace.push(peatAcid
      ? 'Node 3 online dan pH <4.8; fertigasi gambut dipercepat setelah semua guard lolos.'
      : 'Skor memicu irigasi; interval fertigasi dan jendela biologis terpenuhi.');
    return buildResult();
  }

  priority = 'Prioritas 4 · Irigasi air bersih';
  if (firstBlockReason !== null) {
    trace.push(`Fertigasi diblokir: ${firstBlockReason}.`);
  } else if (!due.due) {
    trace.push('Fertigasi ditunda: interval hari belum tiba.');
  } else if (!inWindow) {
    trace.push('Fertigasi ditunda: di luar jendela biologis atau waktu belum valid.');
  }
  waterTarget = calculateWaterTarget(
    soils.representative,
    vpd,
    scoreTotal,
    averageTemperature,
    averageHumidity,
    input,
  );
  action = waterTarget.appliedLiters >= 0.3
    ? `Irigasi air bersih ${waterTarget.appliedLiters.toFixed(2)} L`
    : 'Target air di bawah minimum; relay tetap OFF';
  if (waterTarget.appliedLiters >= 0.3) {
    actuator = startActuator('IRIGASI', waterTarget.appliedLiters, action);
  }
  return buildResult();

  function buildResult(): IrrigationSimulationResult {
    return {
      soilRepresentative: soils.representative,
      soilMinimum: soils.min,
      averageTemperature,
      averageHumidity,
      vpd,
      score: {
        soil: soilScore,
        vpd: vpdScore,
        interaction,
        rainPenalty,
        total: scoreTotal,
        cycleActive,
      },
      fire,
      fertilizer,
      scheduledWateringDue,
      scheduledWateringSkippedReason,
      irrigationDecision,
      priority,
      action,
      waterTarget,
      actuator,
      trace,
    };
  }
}

function stageTarget(stage: SimulationStage, run: IrrigationSimulationResult) {
  switch (stage) {
    case 'PRE_WET': return run.fertilizer.preWetLiters ?? 0;
    case 'FERTIGASI': return run.fertilizer.finalDoseLiters ?? 0;
    case 'POST_FLUSH': return run.fertilizer.postFlushLiters ?? 0;
    case 'IRIGASI': return run.waterTarget?.appliedLiters ?? 0;
    default: return 0;
  }
}

function finishedActuator(
  actuator: VirtualActuatorState,
  message: string,
  reason: string,
): VirtualActuatorState {
  return {
    ...actuator,
    stage: 'IDLE',
    targetLiters: 0,
    resultMessage: message,
    stopReason: reason,
  };
}

export function advanceSimulationFlow(
  run: IrrigationSimulationResult,
  pulses: number,
  seconds: number,
): IrrigationSimulationResult {
  if (!Number.isInteger(pulses) || pulses < 0 || pulses > 2_000_000) {
    throw new Error('Pulsa flow harus bilangan bulat 0 sampai 2.000.000.');
  }
  if (!Number.isFinite(seconds) || seconds < 0.01 || seconds > 1_800) {
    throw new Error('Durasi flow harus bernilai 0,01 sampai 1.800 detik.');
  }

  const actuator = run.actuator;
  if (actuator.stage === 'IDLE') {
    throw new Error('Tidak ada tahap aktuator virtual yang aktif.');
  }

  if (actuator.stage === 'INTER_DELAY' || actuator.stage === 'POST_FLUSH_DELAY') {
    if (pulses !== 0) throw new Error('Jeda antar tahap berjalan tanpa pulsa flow.');
    const elapsedSeconds = actuator.elapsedSeconds + seconds;
    if (elapsedSeconds < 3) {
      return {
        ...run,
        actuator: { ...actuator, elapsedSeconds, flowRateLitersPerMinute: 0 },
      };
    }

    const nextStage = actuator.stage === 'INTER_DELAY' ? 'FERTIGASI' : 'POST_FLUSH';
    const message = nextStage === 'FERTIGASI'
      ? 'Jeda 3 detik selesai; valve fertigasi virtual ON.'
      : 'Jeda 3 detik selesai; valve irigasi virtual ON untuk POST-FLUSH.';
    return {
      ...run,
      actuator: {
        ...actuator,
        stage: nextStage,
        targetLiters: stageTarget(nextStage, run),
        stageLiters: 0,
        stagePulses: 0,
        elapsedSeconds: 0,
        flowRateLitersPerMinute: 0,
        resultMessage: message,
        stopReason: null,
      },
    };
  }

  const stagePulses = actuator.stagePulses + pulses;
  const stageLiters = stagePulses / FLOW_PULSES_PER_LITER;
  const elapsedSeconds = actuator.elapsedSeconds + seconds;
  const flowRateLitersPerMinute = (pulses / FLOW_PULSES_PER_LITER) * 60 / seconds;
  const updated: VirtualActuatorState = {
    ...actuator,
    stagePulses,
    stageLiters,
    elapsedSeconds,
    flowRateLitersPerMinute,
  };

  if (actuator.stage === 'JADWAL') {
    const next = elapsedSeconds >= actuator.scheduleDurationSeconds
      ? finishedActuator(updated, 'Durasi jadwal tercapai; semua relay virtual OFF.', 'DURASI_JADWAL_TERCAPAI')
      : updated;
    return { ...run, actuator: next };
  }

  if (stageLiters + 1e-9 >= actuator.targetLiters) {
    const completedStages = [...actuator.completedStages, actuator.stage];
    let nextStage: SimulationStage = 'IDLE';
    let message = 'Target irigasi tercapai; semua relay virtual OFF.';
    let stopReason = 'TARGET_IRIGASI_TERCAPAI';

    if (actuator.stage === 'PRE_WET' && (run.fertilizer.finalDoseLiters ?? 0) > 0) {
      nextStage = 'INTER_DELAY';
      message = 'PRE-WET selesai; semua relay virtual OFF selama jeda 3 detik.';
      stopReason = '';
    } else if (actuator.stage === 'FERTIGASI' && (run.fertilizer.postFlushLiters ?? 0) > 0) {
      nextStage = 'POST_FLUSH_DELAY';
      message = 'Dosing selesai; semua relay virtual OFF selama jeda 3 detik.';
      stopReason = '';
    } else if (actuator.stage === 'POST_FLUSH') {
      message = 'Siklus 3 tahap selesai; semua relay virtual OFF.';
      stopReason = 'SIKLUS_3TAHAP_SELESAI';
    } else if (actuator.stage === 'FERTIGASI') {
      message = 'Target fertigasi tercapai; semua relay virtual OFF.';
      stopReason = 'TARGET_FERTIGASI_TERCAPAI';
    }

    if (nextStage === 'IDLE') {
      return {
        ...run,
        actuator: finishedActuator(
          { ...updated, completedStages },
          message,
          stopReason,
        ),
      };
    }
    return {
      ...run,
      actuator: {
        ...updated,
        stage: nextStage,
        targetLiters: stageTarget(nextStage, run),
        stageLiters: 0,
        stagePulses: 0,
        elapsedSeconds: 0,
        completedStages,
        resultMessage: message,
        stopReason: null,
      },
    };
  }

  const timeoutSeconds = actuator.stage === 'IRIGASI' || actuator.stage === 'PRE_WET' ? 180 : 120;
  if (elapsedSeconds > timeoutSeconds) {
    return {
      ...run,
      actuator: finishedActuator(updated, 'Safety timeout; semua relay virtual OFF.', 'SAFETY_TIMEOUT'),
    };
  }
  if (elapsedSeconds > 35 && stageLiters < 0.03) {
    return {
      ...run,
      actuator: finishedActuator(updated, 'Tidak ada aliran; semua relay virtual OFF.', 'NO_FLOW_DETECTED'),
    };
  }
  return { ...run, actuator: updated };
}

export function getVirtualRelayOutputs(stage: SimulationStage) {
  const irrigationOn = stage === 'IRIGASI' || stage === 'JADWAL' ||
    stage === 'PRE_WET' || stage === 'POST_FLUSH';
  const fertilizerOn = stage === 'FERTIGASI';
  return {
    irrigation: irrigationOn,
    fertilizer: fertilizerOn,
    pump: irrigationOn || fertilizerOn,
  };
}
