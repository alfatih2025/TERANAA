import supabase from '../lib/apiHelpers/_supabase.js';

const DEFAULT_LOCATION_CODE = '33.74.07.1010';
const WEATHER_LOCATION_MAP = {
  '33.74.01.1001': 'Semarang Tengah',
  '33.74.02.1001': 'Semarang Utara',
  '33.74.03.1001': 'Semarang Timur',
  '33.74.04.1001': 'Gayamsari',
  '33.74.05.1001': 'Genuk',
  '33.74.06.1001': 'Pedurungan',
  '33.74.07.1001': 'Semarang Selatan / Randusari',
  '33.74.07.1002': 'Semarang Selatan / Bulustalan',
  '33.74.07.1003': 'Semarang Selatan / Barusari',
  '33.74.07.1004': 'Semarang Selatan / Mugasari',
  '33.74.07.1005': 'Semarang Selatan / Pleburan',
  '33.74.07.1006': 'Semarang Selatan / Wonodri',
  '33.74.07.1007': 'Semarang Selatan / Peterongan',
  '33.74.07.1008': 'Semarang Selatan / Lamper Lor',
  '33.74.07.1009': 'Semarang Selatan / Lamper Kidul',
  '33.74.07.1010': 'Semarang Selatan / Lamper Tengah',
  '33.74.08.1001': 'Candisari',
  '33.74.09.1001': 'Gajahmungkur',
  '33.74.10.1001': 'Tembalang',
  '33.74.11.1001': 'Banyumanik',
  '33.74.12.1001': 'Gunungpati',
  '33.74.13.1001': 'Semarang Barat',
  '33.74.14.1001': 'Mijen',
  '33.74.15.1001': 'Ngaliyan',
  '33.74.16.1001': 'Tugu',
  '33.72.04.1010': 'Surakarta / Jebres',
  '33.73.01.1001': 'Salatiga',
  '33.75.01.1001': 'Pekalongan',
  '33.76.01.1001': 'Tegal',
};

const DISTRICT_DEFAULT_ADM4 = {
  '33.74.01': '33.74.01.1001',
  '33.74.02': '33.74.02.1001',
  '33.74.03': '33.74.03.1001',
  '33.74.04': '33.74.04.1001',
  '33.74.05': '33.74.05.1001',
  '33.74.06': '33.74.06.1001',
  '33.74.07': '33.74.07.1001',
  '33.74.08': '33.74.08.1001',
  '33.74.09': '33.74.09.1001',
  '33.74.10': '33.74.10.1001',
  '33.74.11': '33.74.11.1001',
  '33.74.12': '33.74.12.1001',
  '33.74.13': '33.74.13.1001',
  '33.74.14': '33.74.14.1001',
  '33.74.15': '33.74.15.1001',
  '33.74.16': '33.74.16.1001',
};

function resolveLocationCode(value) {
  const raw = String(value || '').trim();
  return /^\d{2}(?:\.\d{2}){1,2}(?:\.\d{1,4})?$/.test(raw) ? raw : DEFAULT_LOCATION_CODE;
}

function resolveBmkgForecastCode(value) {
  const normalized = resolveLocationCode(value);
  return DISTRICT_DEFAULT_ADM4[normalized] || normalized;
}

function resolveLocationLabel(code) {
  return WEATHER_LOCATION_MAP[code] || `Lokasi BMKG ${code}`;
}

function resolveBmkgUrl(locationCode) {
  const code = resolveLocationCode(locationCode);
  return `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(code)}`;
}

const DEFAULT_WEATHER = {
  location_code: DEFAULT_LOCATION_CODE,
  location: resolveLocationLabel(DEFAULT_LOCATION_CODE),
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

function createFallbackWeather(locationCode, location, reason) {
  const seed = [...String(locationCode)].reduce((total, char) => total + char.charCodeAt(0), 0);
  const temperature = 24 + (seed % 7);
  const humidity = 62 + (seed % 22);
  const conditions = ['Cerah', 'Cerah Berawan', 'Berawan', 'Hujan Ringan'];
  const forecast = Array.from({ length: 8 }, (_, index) => {
    const condition = conditions[(seed + index) % conditions.length];
    const forecastDate = new Date(Date.now() + (index + 1) * 3 * 60 * 60 * 1000);
    forecastDate.setMinutes(0, 0, 0);
    return {
      datetime: forecastDate.toISOString(),
      temperature: temperature + ((index % 3) - 1),
      humidity: Math.max(45, Math.min(96, humidity + ((index % 4) - 2) * 3)),
      weather: condition,
      rain_chance: condition.includes('Hujan') ? 55 : condition === 'Berawan' ? 24 : 10,
    };
  });

  return {
    ...DEFAULT_WEATHER,
    location_code: locationCode,
    location,
    current: {
      ...DEFAULT_WEATHER.current,
      temperature,
      humidity,
      weather: forecast[0].weather,
      rain_chance: forecast[0].rain_chance,
    },
    forecast,
    _fallback: true,
    _reason: reason,
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRainChance(weatherCode) {
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

function formatLocation(location, fallbackLocation = DEFAULT_WEATHER.location) {
  const parts = [
    location?.desa || location?.kelurahan,
    location?.kecamatan,
    location?.kotkab,
    location?.provinsi,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : fallbackLocation;
}

function formatWeatherDescription(forecast) {
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

function extractForecastRows(data) {
  const root = Array.isArray(data) ? data[0] : data;
  const candidates = [
    root?.data?.[0]?.cuaca,
    root?.data?.[0]?.forecast,
    root?.cuaca,
    root?.forecast,
  ].filter(Boolean);

  const flatten = (value) => Array.isArray(value) ? value.flatMap(flatten) : [value];
  return candidates.flatMap(flatten).filter((item) => item && typeof item === 'object');
}

function getForecastDate(value) {
  if (!value) return Number.NaN;
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  return new Date(`${normalized}+07:00`).getTime();
}

function selectCurrentForecastIndex(forecasts) {
  const now = Date.now();
  let selectedIndex = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;

  forecasts.forEach((forecast, index) => {
    const timestamp = getForecastDate(forecast?.local_datetime);
    if (!Number.isFinite(timestamp)) return;
    const distance = Math.abs(timestamp - now);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      selectedIndex = index;
    }
  });

  return selectedIndex;
}

function transformBmkgWeather(data, fallbackLocation = DEFAULT_WEATHER.location) {
  const root = Array.isArray(data) ? data[0] : data;
  const forecasts = extractForecastRows(data);
  const currentIndex = selectCurrentForecastIndex(forecasts);
  const currentForecast = forecasts[currentIndex];
  const nextForecasts = forecasts.slice(currentIndex + 1);
  if (!currentForecast) {
    return createFallbackWeather(
      resolveLocationCode(root?.lokasi?.adm4 || root?.location_code || root?.adm4 || DEFAULT_LOCATION_CODE),
      formatLocation(root?.lokasi, fallbackLocation),
      'BMKG response tidak memiliki data prakiraan',
    );
  }

  return {
    location_code: resolveLocationCode(root?.lokasi?.adm4 || root?.location_code || root?.adm4 || DEFAULT_LOCATION_CODE),
    location: formatLocation(root?.lokasi || root?.lokasi_terpilih, fallbackLocation),
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  let normalizedCode = DEFAULT_LOCATION_CODE;

  try {
      const urlStr = String(req.url || '');
      let queryLocation = req.query?.location || req.query?.adm4;
      if (Array.isArray(queryLocation)) {
        queryLocation = queryLocation[0];
      }

      // Fallback manual URL parsing if req.query is unavailable or stripped.
      if (!queryLocation && urlStr.includes('?')) {
        try {
          const url = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
          queryLocation = url.searchParams.get('location') || url.searchParams.get('adm4');
        } catch {
          // ignore URL parsing errors
        }
      }

      const locationCode = String(queryLocation || DEFAULT_LOCATION_CODE).trim();
      normalizedCode = resolveLocationCode(locationCode);
    const requestedLabel = String(req.query?.label || '').trim();
    const bmkgCode = resolveBmkgForecastCode(normalizedCode);
    const bmkgUrl = resolveBmkgUrl(bmkgCode);
    
    let bmkgData = null;
    let lastError = null;

    try {
      const response = await fetch(bmkgUrl, {
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
        next: { revalidate: 0 }, // Disable cache for Vercel
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
      } else {
        bmkgData = await response.json();
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (!bmkgData) {
      // Graceful fallback: return default weather data instead of 502
      const fallbackLabel = resolveLocationLabel(normalizedCode);
      return res.status(200).json(createFallbackWeather(
        normalizedCode,
        requestedLabel || fallbackLabel,
        lastError || 'BMKG API unavailable',
      ));
    }

    const responseRoot = Array.isArray(bmkgData) ? bmkgData[0] : bmkgData;
    const responseCode = String(responseRoot?.lokasi?.adm4 || '').trim();
    if (responseCode && responseCode !== bmkgCode) {
      return res.status(200).json(createFallbackWeather(
        normalizedCode,
        requestedLabel || resolveLocationLabel(normalizedCode),
        `BMKG mengembalikan kode wilayah ${responseCode}, bukan ${bmkgCode}`,
      ));
    }

    const weatherData = transformBmkgWeather(bmkgData, resolveLocationLabel(normalizedCode));
    weatherData.location_code = normalizedCode;

    if (supabase) {
      try {
        await supabase.from('activity_logs').insert({
          type: 'weather',
          message: `Weather data fetched for ${weatherData.location}`,
          details: weatherData.current,
        });
      } catch {
        // Audit logging must not block weather data delivery.
      }
    }

    return res.status(200).json(weatherData);
  } catch (err) {
    console.error('[Weather API] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      location_code: normalizedCode,
      location: resolveLocationLabel(normalizedCode)
    });
  }
}
