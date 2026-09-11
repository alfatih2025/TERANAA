import type { WeatherData } from '../hooks/useWeather';

type BmkgForecast = {
  local_datetime?: string;
  t?: number | string;
  hu?: number | string;
  weather?: number | string;
  weather_desc?: string;
  ws?: number | string;
  tp?: number | string;
};

type BmkgLocation = {
  desa?: string;
  kelurahan?: string;
  kecamatan?: string;
  kotkab?: string;
  provinsi?: string;
};

type BmkgResponse = {
  lokasi?: BmkgLocation;
  data?: Array<{
    cuaca?: BmkgForecast[][];
    forecast?: BmkgForecast[][];
  }>;
  cuaca?: BmkgForecast[][];
  forecast?: BmkgForecast[][];
};

const DEFAULT_WEATHER: WeatherData = {
  location: 'Lokasi BMKG',
  current: {
    temperature: 28,
    humidity: 75,
    weather: 'Cerah Berawan',
    wind_speed: 10,
    rain_chance: 20,
    rain_amount: 0,
  },
  forecast: [],
};

function toNumber(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRainChance(weatherCode: number | string | undefined) {
  const normalized = String(weatherCode ?? '').trim().toLowerCase();
  const numericCode = Number(normalized);
  if (Number.isFinite(numericCode)) {
    if (numericCode === 0) return 0;
    if ([1, 2, 3, 4, 5, 10, 45].includes(numericCode)) return 10;
    if ([60, 80].includes(numericCode)) return 55;
    if ([61, 62, 63, 95, 97].includes(numericCode)) return 80;
  }
  if (normalized === '0' || normalized === 'nol') return 0;
  if (['1', '2', '3', 'ringan', 'cerah'].includes(normalized)) return 10;
  if (['4', '5', '6', '7', 'berawan', 'hujan ringan'].includes(normalized)) return 35;
  if (normalized.includes('hujan')) return 70;
  return 60;
}

function formatLocation(location?: BmkgLocation, fallbackLocation = DEFAULT_WEATHER.location) {
  const parts = [
    location?.desa || location?.kelurahan,
    location?.kecamatan,
    location?.kotkab,
    location?.provinsi,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : fallbackLocation;
}

function formatWeatherDescription(forecast?: BmkgForecast) {
  if (forecast?.weather_desc) return forecast.weather_desc;
  const code = Number(forecast?.weather);
  if (code === 0) return 'Cerah';
  if ([1, 2].includes(code)) return 'Cerah Berawan';
  if ([3, 4, 5, 10, 45].includes(code)) return 'Berawan';
  if ([60, 80].includes(code)) return 'Hujan Ringan';
  if ([61, 62].includes(code)) return 'Hujan';
  if ([63, 95, 97].includes(code)) return 'Hujan Lebat';
  return DEFAULT_WEATHER.current.weather;
}

function extractForecastRows(data: BmkgResponse | BmkgResponse[]) {
  const root = Array.isArray(data) ? data[0] : data;
  const candidates = [
    root?.data?.[0]?.cuaca,
    root?.data?.[0]?.forecast,
    root?.cuaca,
    root?.forecast,
  ].filter(Boolean);

  const flatten = (value: unknown): unknown[] => Array.isArray(value) ? value.flatMap(flatten) : [value];
  const flattened = candidates.flatMap(flatten);

  return flattened.filter((item): item is NonNullable<BmkgForecast> => Boolean(item && typeof item === 'object'));
}

function getForecastDate(value: string | undefined) {
  if (!value) return Number.NaN;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  return new Date(`${normalized}+07:00`).getTime();
}

function selectCurrentForecastIndex(forecasts: BmkgForecast[]) {
  const now = Date.now();
  let selectedIndex = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;

  forecasts.forEach((forecast, index) => {
    const timestamp = getForecastDate(forecast.local_datetime);
    if (!Number.isFinite(timestamp)) return;
    const distance = Math.abs(timestamp - now);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      selectedIndex = index;
    }
  });

  return selectedIndex;
}

export function transformBmkgWeather(data: BmkgResponse | BmkgResponse[], fallbackLocation = DEFAULT_WEATHER.location): WeatherData {
  const root = Array.isArray(data) ? data[0] : data;
  const forecasts = extractForecastRows(data);
  const currentIndex = selectCurrentForecastIndex(forecasts);
  const currentForecast = forecasts[currentIndex];
  const nextForecasts = forecasts.slice(currentIndex + 1);

  if (!currentForecast) {
    return {
      ...DEFAULT_WEATHER,
      location: formatLocation(root?.lokasi, fallbackLocation),
    };
  }

  return {
    location: formatLocation(root?.lokasi, fallbackLocation),
    current: {
      temperature: toNumber(currentForecast.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(currentForecast.hu, DEFAULT_WEATHER.current.humidity),
      weather: formatWeatherDescription(currentForecast),
      wind_speed: toNumber(currentForecast.ws, DEFAULT_WEATHER.current.wind_speed),
      rain_chance: getRainChance(currentForecast.weather),
      rain_amount: toNumber(currentForecast.tp, 0),
    },
    forecast: nextForecasts.slice(0, 8).map((item) => ({
      datetime: item.local_datetime || new Date().toISOString(),
      temperature: toNumber(item.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(item.hu, DEFAULT_WEATHER.current.humidity),
      weather: formatWeatherDescription(item),
      rain_chance: getRainChance(item.weather),
      rain_amount: toNumber(item.tp, 0),
    })),
  };
}


const FALLBACK_WEATHER_CONDITIONS = ['Cerah', 'Cerah Berawan', 'Berawan', 'Hujan Ringan', 'Hujan', 'Hujan Lebat'];

function hashCode(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildForecastTime(index: number) {
  const date = new Date();
  date.setHours(date.getHours() + index * 3);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export function createStaticWeatherFallback(locationCode: string, locationLabel: string): WeatherData {
  const hash = hashCode(locationCode || locationLabel || 'fallback');
  const weather = FALLBACK_WEATHER_CONDITIONS[hash % FALLBACK_WEATHER_CONDITIONS.length];
  const temperature = 24 + (hash % 7);
  const humidity = 62 + (hash % 22);
  const windSpeed = 4 + (hash % 10);
  const rainChance = weather.includes('Hujan') ? 55 : weather === 'Berawan' ? 22 : weather === 'Cerah Berawan' ? 14 : 6;

  const forecast = Array.from({ length: 8 }).map((_, index) => {
    const condition = FALLBACK_WEATHER_CONDITIONS[(hash + index + 1) % FALLBACK_WEATHER_CONDITIONS.length];
    return {
      datetime: buildForecastTime(index + 1),
      temperature: temperature + ((index % 3) - 1),
      humidity: Math.max(45, Math.min(96, humidity + ((index % 4) - 2) * 3)),
      weather: condition,
      rain_chance: condition.includes('Hujan') ? 60 - index * 2 : condition === 'Berawan' ? 24 : condition === 'Cerah Berawan' ? 15 : 6,
      rain_amount: 0,
    };
  });

  return {
    location: locationLabel,
    location_code: locationCode,
    current: {
      temperature,
      humidity,
      weather,
      wind_speed: windSpeed,
      rain_chance: rainChance,
    },
    forecast,
  };
}

export { DEFAULT_WEATHER };
