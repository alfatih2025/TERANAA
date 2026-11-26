import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFwiComponents, selectLiveBmkgConditions } from './karhutlaFwi';
import { transformBmkgWeather } from './bmkgWeather';
import type { WeatherData } from '../hooks/useWeather';

function weather(overrides: Partial<WeatherData> = {}): WeatherData {
  return {
    location: 'Semarang Selatan',
    location_code: '33.74.07.1010',
    source: 'bmkg',
    current: {
      temperature: 30,
      humidity: 65,
      weather: 'Cerah Berawan',
      wind_speed: 8,
      rain_chance: 20,
      rain_amount: 0,
    },
    forecast: [],
    ...overrides,
  };
}

test('uses current live BMKG conditions only for the selected location', () => {
  const liveWeather = weather();
  assert.deepEqual(selectLiveBmkgConditions(liveWeather, '33.74.07.1010'), {
    temperature: 30,
    humidity: 65,
    wind_speed: 8,
    rain_amount: 0,
    rain_chance: 20,
  });
  assert.equal(selectLiveBmkgConditions(liveWeather, '33.74.07.1001'), null);
});

test('rejects cached/static fallback weather for live FWI inputs', () => {
  assert.equal(
    selectLiveBmkgConditions(weather({ source: 'fallback', fallback_reason: 'BMKG unavailable' }), '33.74.07.1010'),
    null,
  );
  assert.equal(selectLiveBmkgConditions(null, '33.74.07.1010'), null);
});

test('marks incomplete BMKG forecasts as fallback instead of live weather', () => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const live = transformBmkgWeather({
    lokasi: { adm4: '33.74.07.1010' },
    data: [{ cuaca: [[{ local_datetime: timestamp, t: 30, hu: 65, ws: 8, tp: 1, weather: 60 }]] }],
  });
  const incomplete = transformBmkgWeather({
    lokasi: { adm4: '33.74.07.1010' },
    data: [{ cuaca: [[{ local_datetime: timestamp, t: 30, hu: 65, ws: 8, weather: 60 }]] }],
  });

  assert.equal(live.source, 'bmkg');
  assert.equal(live.current.rain_amount, 1);
  assert.equal(incomplete.source, 'fallback');
  assert.ok(incomplete.fallback_reason);
});

test('live wind and rainfall change the estimated FWI components', () => {
  const base = {
    temperature: 30,
    humidity: 50,
    soilMoisture: 45,
    soilTemperature: 28,
    month: 5,
  };
  const calmDry = calculateFwiComponents({ ...base, windSpeedKmh: 2, rainAmountMm: 0 });
  const windyDry = calculateFwiComponents({ ...base, windSpeedKmh: 20, rainAmountMm: 0 });
  const rainy = calculateFwiComponents({ ...base, windSpeedKmh: 2, rainAmountMm: 10 });

  assert.ok(windyDry.isi > calmDry.isi);
  assert.ok(rainy.ffmc < calmDry.ffmc);
  assert.notEqual(rainy.fwi, calmDry.fwi);
});
