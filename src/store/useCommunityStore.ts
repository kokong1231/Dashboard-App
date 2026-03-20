import { create } from 'zustand';
import { CommunityFeedItem } from '@/types';
import { fetchCommunityFeedItems } from '@/api/notionApi';

interface CommunityState {
  items: CommunityFeedItem[];
  isLoading: boolean;
  hasError: boolean;
  fetchedAt: Date | null;
  fetch: () => Promise<void>;
}

export const useCommunityStore = create<CommunityState>(set => ({
  items: [],
  isLoading: false,
  hasError: false,
  fetchedAt: null,
  fetch: async () => {
    set({ isLoading: true, hasError: false });
    try {
      const items = await fetchCommunityFeedItems();
      set({ items, isLoading: false, fetchedAt: new Date() });
    } catch {
      set({ isLoading: false, hasError: true });
    }
  },
}));
