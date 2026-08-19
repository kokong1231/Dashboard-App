import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_RECENT_SEARCHES = 6;

interface ShortcutState {
  favorites: string[];
  recentSearches: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  addRecentSearch: (id: string) => void;
}

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      favorites: [],
      recentSearches: [],
      isFavorite: id => get().favorites.includes(id),
      toggleFavorite: id =>
        set(state => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter(f => f !== id)
            : [...state.favorites, id],
        })),
      addRecentSearch: id =>
        set(state => ({
          recentSearches: [id, ...state.recentSearches.filter(r => r !== id)].slice(
            0,
            MAX_RECENT_SEARCHES,
          ),
        })),
    }),
    {
      name: 'shortcut-widget-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ favorites: state.favorites, recentSearches: state.recentSearches }),
    },
  ),
);
