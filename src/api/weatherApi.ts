import axios from 'axios';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { GeoLocation, WeatherCurrent, WeatherData, WeatherDaily, WeatherHourly } from '@/types';

const DEFAULT_LOCATION: GeoLocation = {
  latitude: 37.5665,
  longitude: 126.978,
  city: 'SEOUL',
  country: 'KR',
  timezone: 'Asia/Seoul',
};

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function fetchLocationByGPS(): Promise<GeoLocation> {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) throw new Error('Location permission denied');

  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10`,
            {
              timeout: 8000,
              headers: {
                'User-Agent': 'OhsDashboard/1.0',
                'Accept-Language': 'ko,en',
              },
            },
          );
          const addr = res.data.address;
          const raw =
            addr.city ??
            addr.town ??
            addr.village ??
            addr.city_district ??
            addr.borough ??
            addr.suburb ??
            addr.municipality ??
            addr.state ??
            addr.county;
          if (raw) {
            const country = ((addr.country_code as string) ?? '??').toUpperCase();
            resolve({ latitude, longitude, city: raw as string, country, timezone: 'auto' });
          } else {
            // Nominatim returned no recognisable field — fall back to IP for city name
            const ip = await fetchLocationByIP();
            resolve({ latitude, longitude, city: ip.city, country: ip.country, timezone: 'auto' });
          }
        } catch {
          // Nominatim request failed — use GPS coords but get city name via IP
          try {
            const ip = await fetchLocationByIP();
            resolve({ latitude, longitude, city: ip.city, country: ip.country, timezone: 'auto' });
          } catch {
            resolve({ latitude, longitude, city: DEFAULT_LOCATION.city, country: DEFAULT_LOCATION.country, timezone: 'auto' });
          }
        }
      },
      error => reject(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

async function fetchLocationByIP(): Promise<GeoLocation> {
  const res = await axios.get('https://ipapi.co/json/', { timeout: 5000 });
  const d = res.data;
  return {
    latitude: d.latitude,
    longitude: d.longitude,
    city: (d.city as string)?.toUpperCase() ?? 'UNKNOWN',
    country: (d.country_code as string)?.toUpperCase() ?? '??',
    timezone: d.timezone ?? 'UTC',
  };
}

async function fetchLocation(): Promise<GeoLocation> {
  try {
    return await fetchLocationByGPS();
  } catch {
    try {
      return await fetchLocationByIP();
    } catch {
      return DEFAULT_LOCATION;
    }
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
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
    ].join(','),
    forecast_days: '7',
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

  const daily: WeatherDaily = {
    time: raw.daily.time,
    temperature_2m_max: raw.daily.temperature_2m_max,
    temperature_2m_min: raw.daily.temperature_2m_min,
    weather_code: raw.daily.weather_code,
    precipitation_probability_max: raw.daily.precipitation_probability_max,
  };

  // If timezone was 'auto', update from Open-Meteo response
  const resolvedLocation: GeoLocation = {
    ...location,
    timezone: raw.timezone ?? location.timezone,
  };

  return { current, hourly, daily, location: resolvedLocation };
}
