import { create } from 'zustand';
import { fetchNotionDatabases, fetchNotionPages } from '@/api/notionApi';
import { NotionDatabaseListItem, NotionPageListItem } from '@/types';

const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes

interface NotionStore {
  databases: NotionDatabaseListItem[];
  pages: NotionPageListItem[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetch: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

export const useNotionStore = create<NotionStore>((set, get) => ({
  databases: [],
  pages: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetch: async () => {
    const { isLoading, lastFetched } = get();
    if (isLoading) return;
    if (lastFetched && Date.now() - lastFetched < REFRESH_INTERVAL) return;

    set({ isLoading: true, error: null });
    try {
      const [databases, pages] = await Promise.all([
        fetchNotionDatabases(),
        fetchNotionPages(),
      ]);
      set({ databases, pages, isLoading: false, lastFetched: Date.now() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'FETCH ERROR';
      set({ isLoading: false, error: msg.toUpperCase() });
    }
  },

  forceRefresh: async () => {
    set({ lastFetched: null });
    await get().fetch();
  },
}));
