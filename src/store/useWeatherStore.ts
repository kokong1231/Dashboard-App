import { create } from 'zustand';
import { fetchWeather } from '@/api/weatherApi';
import { WeatherData } from '@/types';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface WeatherStore {
  data: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetch: () => Promise<void>;
}

export const useWeatherStore = create<WeatherStore>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  fetch: async () => {
    const { isLoading, lastFetched } = get();
    if (isLoading) return;
    if (lastFetched && Date.now() - lastFetched < REFRESH_INTERVAL) return;

    set({ isLoading: true, error: null });
    try {
      const data = await fetchWeather();
      set({ data, isLoading: false, lastFetched: Date.now() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'FETCH ERROR';
      set({ isLoading: false, error: msg.toUpperCase() });
    }
  },
}));
