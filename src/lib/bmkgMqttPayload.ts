import type { WeatherData } from '../hooks/useWeather';

export interface BmkgWeatherMqttPayload {
  schema_version: 1;
  location_code: string;
  fetched_at: string;
  temperature_c: number;
  humidity_pct: number;
  wind_speed_kmh: number;
  rain_amount_mm: number;
  rain_chance_pct: number;
}

export function buildBmkgWeatherMqttPayload(
  weather: WeatherData | null | undefined,
  selectedLocationCode: string | null | undefined,
): BmkgWeatherMqttPayload | null {
  if (
    !weather ||
    weather.source !== 'bmkg' ||
    !selectedLocationCode ||
    weather.location_code !== selectedLocationCode ||
    !weather.fetched_at
  ) {
    return null;
  }

  const fetchedAt = Date.parse(weather.fetched_at);
  const { temperature, humidity, wind_speed, rain_amount, rain_chance } = weather.current;
  if (
    !Number.isFinite(fetchedAt) ||
    ![temperature, humidity, wind_speed, rain_amount, rain_chance].every(Number.isFinite)
  ) {
    return null;
  }

  return {
    schema_version: 1,
    location_code: selectedLocationCode,
    fetched_at: new Date(fetchedAt).toISOString(),
    temperature_c: temperature,
    humidity_pct: humidity,
    wind_speed_kmh: wind_speed,
    rain_amount_mm: rain_amount,
    rain_chance_pct: rain_chance,
  };
}
