import { create } from 'zustand';
import { fetchAINews } from '@/api/newsApi';
import { HackerNewsHit } from '@/types';

const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes

interface NewsStore {
  items: HackerNewsHit[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetch: () => Promise<void>;
}

export const useNewsStore = create<NewsStore>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetch: async () => {
    const { isLoading, lastFetched } = get();
    if (isLoading) return;
    if (lastFetched && Date.now() - lastFetched < REFRESH_INTERVAL) return;

    set({ isLoading: true, error: null });
    try {
      const items = await fetchAINews();
      set({ items, isLoading: false, lastFetched: Date.now() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'FETCH ERROR';
      set({ isLoading: false, error: msg.toUpperCase() });
    }
  },
}));
