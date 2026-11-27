import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceSimulationFlow,
  evaluateIrrigationScenario,
  getVirtualRelayOutputs,
  type IrrigationSimulationInput,
} from './irrigationSimulation';

function scenario(overrides: Partial<IrrigationSimulationInput> = {}): IrrigationSimulationInput {
  return {
    node1: { soil: 30, temperature: 28, humidity: 65 },
    node2: { soil: 34, temperature: 29, humidity: 62 },
    rainChance: 0,
    ph: 6.5,
    phase: 'vegetatif',
    automaticMode: true,
    node3Online: false,
    node3SoilTemp: 32,
    node3AmbientTemp: 30,
    node3AmbientRh: 65,
    windKmh: 5,
    previousFfmc: 85,
    previousDmc: 30,
    previousDc: 200,
    fireLevelOverride: null,
    criticalSoil: 35,
    upperSoil: 75,
    activeScoreThreshold: 55,
    lowerScoreThreshold: 25,
    highTemperatureThreshold: 35,
    lowHumidityThreshold: 60,
    previousCycleActive: false,
    irrigationCooldownReady: true,
    fireCooldownReady: true,
    timeValid: true,
    hour: 7,
    minute: 0,
    day: 10,
    month: 6,
    fertilizerIntervalDays: 2,
    lastFertilizerDay: -1,
    lastFertilizerMonth: 6,
    fertilizerDueOverride: null,
    scheduleEnabled: false,
    scheduleTime: '06:00',
    scheduleDurationSeconds: 600,
    scheduleAlreadyDone: false,
    ...overrides,
  };
}

test('critical dryness selects emergency irrigation ahead of score-based fertigation', () => {
  const result = evaluateIrrigationScenario(scenario({
    node1: { soil: 22, temperature: 28, humidity: 65 },
    node2: { soil: 27, temperature: 29, humidity: 62 },
  }));

  assert.equal(result.irrigationDecision, 'EMERGENCY');
  assert.equal(result.priority, 'Prioritas 2 · Kekeringan kritis');
  assert.equal(result.actuator.stage, 'IRIGASI');
  assert.ok(result.waterTarget);
  assert.ok(result.waterTarget.appliedLiters >= 1.2);
});

test('Karhutla protection takes priority and keeps virtual relay outputs interlocked', () => {
  const result = evaluateIrrigationScenario(scenario({
    node3Online: true,
    node3SoilTemp: 42,
    fireLevelOverride: 2,
  }));

  assert.equal(result.priority, 'Prioritas 1 · Karhutla gambut');
  assert.equal(result.actuator.stage, 'PRE_WET');
  assert.equal(result.fire?.level, 2);
  assert.ok(result.fire?.trigger);
  assert.deepEqual(getVirtualRelayOutputs(result.actuator.stage), {
    irrigation: true,
    fertilizer: false,
    pump: true,
  });
});

test('fertigation guards block high rain and show the first blocking reason', () => {
  const result = evaluateIrrigationScenario(scenario({
    rainChance: 65,
  }));

  assert.equal(result.fertilizer.allowed, false);
  assert.equal(result.fertilizer.guards.rain, true);
  assert.equal(result.fertilizer.firstBlockReason, 'Peluang hujan >=60% (cegah leaching)');
  assert.equal(result.actuator.stage, 'IRIGASI');
});

test('fertigation flow advances PRE-WET, DOSING, and POST-FLUSH without overlapping relays', () => {
  let result = evaluateIrrigationScenario(scenario({
    node1: { soil: 55, temperature: 34, humidity: 35 },
    node2: { soil: 60, temperature: 34, humidity: 35 },
  }));
  assert.equal(result.actuator.stage, 'PRE_WET');

  result = advanceSimulationFlow(result, 135, 10);
  assert.equal(result.actuator.stage, 'INTER_DELAY');
  assert.deepEqual(getVirtualRelayOutputs(result.actuator.stage), {
    irrigation: false,
    fertilizer: false,
    pump: false,
  });

  result = advanceSimulationFlow(result, 0, 1.5);
  assert.equal(result.actuator.stage, 'INTER_DELAY');
  result = advanceSimulationFlow(result, 0, 1.5);
  assert.equal(result.actuator.stage, 'FERTIGASI');
  assert.deepEqual(getVirtualRelayOutputs(result.actuator.stage), {
    irrigation: false,
    fertilizer: true,
    pump: true,
  });

  result = advanceSimulationFlow(result, 324, 10);
  assert.equal(result.actuator.stage, 'POST_FLUSH_DELAY');
  assert.deepEqual(getVirtualRelayOutputs(result.actuator.stage), {
    irrigation: false,
    fertilizer: false,
    pump: false,
  });

  result = advanceSimulationFlow(result, 0, 3);
  assert.equal(result.actuator.stage, 'POST_FLUSH');
  assert.deepEqual(getVirtualRelayOutputs(result.actuator.stage), {
    irrigation: true,
    fertilizer: false,
    pump: true,
  });

  result = advanceSimulationFlow(result, 113, 10);
  assert.equal(result.actuator.stage, 'IDLE');
  assert.equal(result.actuator.stopReason, 'SIKLUS_3TAHAP_SELESAI');
  assert.equal(getVirtualRelayOutputs(result.actuator.stage).pump, false);
});

test('a due schedule runs before the Karhutla priority when not blocked', () => {
  const result = evaluateIrrigationScenario(scenario({
    node3Online: true,
    node3SoilTemp: 45,
    fireLevelOverride: 3,
    scheduleEnabled: true,
    scheduleTime: '07:00',
    scheduleDurationSeconds: 300,
  }));

  assert.equal(result.scheduledWateringDue, true);
  assert.equal(result.priority, 'Jadwal penyiraman');
  assert.equal(result.actuator.stage, 'JADWAL');
});
