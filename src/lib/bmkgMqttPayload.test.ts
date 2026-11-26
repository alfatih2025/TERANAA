import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBmkgWeatherMqttPayload } from './bmkgMqttPayload';
import type { WeatherData } from '../hooks/useWeather';

function weather(overrides: Partial<WeatherData> = {}): WeatherData {
  return {
    location: 'Semarang Selatan',
    location_code: '33.74.07.1010',
    source: 'bmkg',
    fetched_at: '2026-11-26T14:00:00.000Z',
    current: {
      temperature: 26,
      humidity: 91,
      weather: 'Berawan',
      wind_speed: 5.5,
      rain_amount: 0,
      rain_chance: 10,
    },
    forecast: [],
    ...overrides,
  };
}

test('builds the versioned BMKG retained-message contract for the chosen location', () => {
  assert.deepEqual(buildBmkgWeatherMqttPayload(weather(), '33.74.07.1010'), {
    schema_version: 1,
    location_code: '33.74.07.1010',
    fetched_at: '2026-11-26T14:00:00.000Z',
    temperature_c: 26,
    humidity_pct: 91,
    wind_speed_kmh: 5.5,
    rain_amount_mm: 0,
    rain_chance_pct: 10,
  });
});

test('does not publish fallback weather or data from a different selected area', () => {
  assert.equal(buildBmkgWeatherMqttPayload(weather({ source: 'fallback' }), '33.74.07.1010'), null);
  assert.equal(buildBmkgWeatherMqttPayload(weather(), '33.74.07.1001'), null);
});

test('requires a valid fetch timestamp and complete numeric weather fields', () => {
  assert.equal(buildBmkgWeatherMqttPayload(weather({ fetched_at: undefined }), '33.74.07.1010'), null);
  assert.equal(buildBmkgWeatherMqttPayload(weather({ fetched_at: 'invalid' }), '33.74.07.1010'), null);
  assert.equal(
    buildBmkgWeatherMqttPayload(
      weather({ current: { ...weather().current, wind_speed: Number.NaN } }),
      '33.74.07.1010',
    ),
    null,
  );
});
