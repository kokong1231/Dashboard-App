import axios from 'axios';
import { GeoLocation, WeatherCurrent, WeatherData, WeatherHourly } from '@/types';

const DEFAULT_LOCATION: GeoLocation = {
  latitude: 37.5665,
  longitude: 126.978,
  city: 'SEOUL',
  country: 'KR',
  timezone: 'Asia/Seoul',
};

async function fetchLocation(): Promise<GeoLocation> {
  try {
    const res = await axios.get('https://ipapi.co/json/', { timeout: 5000 });
    const d = res.data;
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: (d.city as string)?.toUpperCase() ?? 'UNKNOWN',
      country: (d.country_code as string)?.toUpperCase() ?? '??',
      timezone: d.timezone ?? 'UTC',
    };
  } catch {
    return DEFAULT_LOCATION;
  }
}

export async function fetchWeather(): Promise<WeatherData> {
  const location = await fetchLocation();

  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'weather_code',
      'uv_index',
    ].join(','),
    hourly: 'temperature_2m,precipitation_probability',
    forecast_days: '1',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });

  const res = await axios.get(`https://api.open-meteo.com/v1/forecast?${params}`, {
    timeout: 10000,
  });

  const raw = res.data;
  const current: WeatherCurrent = {
    temperature_2m: raw.current.temperature_2m,
    apparent_temperature: raw.current.apparent_temperature,
    relative_humidity_2m: raw.current.relative_humidity_2m,
    wind_speed_10m: raw.current.wind_speed_10m,
    wind_direction_10m: raw.current.wind_direction_10m,
    weather_code: raw.current.weather_code,
    uv_index: raw.current.uv_index ?? 0,
  };

  const hourly: WeatherHourly = {
    time: raw.hourly.time,
    temperature_2m: raw.hourly.temperature_2m,
    precipitation_probability: raw.hourly.precipitation_probability,
  };

  return { current, hourly, location };
}
