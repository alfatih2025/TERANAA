import type { WeatherData } from '../hooks/useWeather';

export type LiveBmkgConditions = Pick<WeatherData['current'], 'temperature' | 'humidity' | 'wind_speed' | 'rain_amount' | 'rain_chance'>;

export function selectLiveBmkgConditions(
  weather: WeatherData | null | undefined,
  selectedLocationCode: string | null | undefined,
): LiveBmkgConditions | null {
  if (
    !weather ||
    weather.source !== 'bmkg' ||
    !selectedLocationCode ||
    weather.location_code !== selectedLocationCode
  ) {
    return null;
  }

  const { temperature, humidity, wind_speed, rain_amount, rain_chance } = weather.current;
  if (![temperature, humidity, wind_speed, rain_amount, rain_chance].every(Number.isFinite)) {
    return null;
  }

  return { temperature, humidity, wind_speed, rain_amount, rain_chance };
}

export interface FwiInputs {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  soilTemperature: number;
  windSpeedKmh: number;
  rainAmountMm: number;
  month?: number;
}

export interface FwiComponents {
  ffmc: number;
  dmc: number;
  dc: number;
  isi: number;
  bui: number;
  fwi: number;
}

export function calculateFwiComponents({
  temperature: T,
  humidity: rawHumidity,
  soilMoisture: rawSoilMoisture,
  soilTemperature: ST,
  windSpeedKmh: rawWindSpeed,
  rainAmountMm: rawRainAmount,
  month = new Date().getMonth(),
}: FwiInputs): FwiComponents {
  const H = Math.min(100, Math.max(0, rawHumidity));
  const SM = Math.min(100, Math.max(0, rawSoilMoisture));
  const W = Math.max(0, rawWindSpeed);
  const rainfall = Math.max(0, rawRainAmount);

  const initialMoisture = 147.2 * (101 - 85) / (59.5 + 85);
  let moisture = initialMoisture;
  if (rainfall > 0.5) {
    let rainMoisture = moisture + 42.5 * rainfall * Math.exp(-100 / (251 - moisture)) * (1 - Math.exp(-6.93 / rainfall));
    if (moisture > 150) {
      rainMoisture += 0.0015 * (moisture - 150) ** 2 * Math.sqrt(rainfall);
    }
    moisture = Math.min(rainMoisture, 250);
  }

  const dryingEquilibrium = 0.942 * H ** 0.679
    + 11 * Math.exp((H - 100) / 10)
    + 0.18 * (21.1 - T) * (1 - Math.exp(-0.115 * H));
  const wettingEquilibrium = 0.618 * H ** 0.753
    + 10 * Math.exp((H - 100) / 10)
    + 0.18 * (21.1 - T) * (1 - Math.exp(-0.115 * H));
  let fineFuelMoisture: number;
  if (moisture > dryingEquilibrium) {
    const ko = 0.424 * (1 - (H / 100) ** 1.7)
      + 0.0694 * Math.sqrt(W) * (1 - (H / 100) ** 8);
    fineFuelMoisture = dryingEquilibrium + (moisture - dryingEquilibrium)
      * 10 ** (-ko * 0.581 * Math.exp(0.0365 * T));
  } else if (moisture < wettingEquilibrium) {
    const inverseHumidity = (100 - H) / 100;
    const kl = 0.424 * (1 - inverseHumidity ** 1.7)
      + 0.0694 * Math.sqrt(W) * (1 - inverseHumidity ** 8);
    fineFuelMoisture = wettingEquilibrium - (wettingEquilibrium - moisture)
      * 10 ** (-kl * 0.581 * Math.exp(0.0365 * T));
  } else {
    fineFuelMoisture = moisture;
  }
  const ffmc = Math.max(0, Math.min(101, 59.5 * (250 - fineFuelMoisture) / (147.2 + fineFuelMoisture)));

  const dayLength = [6.4, 5.0, 3.0, 1.1, 0.4, 0.1, 0, 0.3, 0.9, 1.9, 3.5, 5.3][month] ?? 0;
  const dryingFactor = 1.894 * (T + 1.1) * (100 - H) * dayLength * 1e-6;
  const dmc = Math.max(0, (6 + 100 * dryingFactor) * (1 - (SM / 100) * 0.5));

  const droughtFactor = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5.0, 2.4, 0.4, -1.6, -1.6][month] ?? 0;
  const droughtWeatherFactor = 0.36 * (T + 2.8) + droughtFactor;
  const soilTemperatureBonus = Math.max(0, (ST - 25) * 5);
  const soilDryFactor = Math.max(0, (100 - SM) / 100);
  const dc = Math.min(800, Math.max(0, 15 + 0.5 * Math.max(0, droughtWeatherFactor) + soilTemperatureBonus + soilDryFactor * 50));

  const fineFuelMoistureCode = 147.2 * (101 - ffmc) / (59.5 + ffmc);
  const fineFuelFunction = 91.9 * Math.exp(-0.1386 * fineFuelMoistureCode)
    * (1 + fineFuelMoistureCode ** 5.31 / 4.93e7);
  const isi = Math.max(0, 0.208 * Math.exp(0.05039 * W) * fineFuelFunction);

  let bui = dmc <= 0.4 * dc
    ? 0.8 * dmc * dc / (dmc + 0.4 * dc)
    : dmc - (1 - 0.8 * dc / (dmc + 0.4 * dc)) * (0.92 + (0.0114 * dmc) ** 1.7);
  bui = Math.max(0, bui);
  const duffMoistureFunction = bui <= 80
    ? 0.626 * bui ** 0.809 + 2
    : 1000 / (25 + 108.64 * Math.exp(-0.023 * bui));
  const fireIntensity = 0.1 * isi * duffMoistureFunction;
  const fwi = fireIntensity <= 1
    ? fireIntensity
    : Math.exp(2.72 * (0.434 * Math.log(fireIntensity)) ** 0.647);

  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    ffmc: round(ffmc),
    dmc: round(dmc),
    dc: round(dc),
    isi: round(isi),
    bui: round(bui),
    fwi: round(fwi),
  };
}
