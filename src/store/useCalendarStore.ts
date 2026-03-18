import { create } from 'zustand';
import RNCalendarEvents, { CalendarEventReadable } from 'react-native-calendar-events';

// Groups an ISO date string into a 'YYYY-MM-DD' key using local time
function toDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CalendarStore {
  events: Record<string, CalendarEventReadable[]>; // keyed by 'YYYY-MM-DD'
  isLoading: boolean;
  hasError: boolean;
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  loadMonth: (year: number, month: number) => Promise<void>;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: {},
  isLoading: false,
  hasError: false,
  permissionGranted: false,

  requestPermission: async () => {
    try {
      const status = await RNCalendarEvents.requestPermissions();
      const granted = status === 'authorized';
      set({ permissionGranted: granted });
      return granted;
    } catch {
      set({ permissionGranted: false });
      return false;
    }
  },

  loadMonth: async (year, month) => {
    if (!get().permissionGranted) return;
    set({ isLoading: true, hasError: false });
    try {
      const start = new Date(year, month, 1).toISOString();
      const end   = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
      const rawEvents = await RNCalendarEvents.fetchAllEvents(start, end);

      // Group by local date key
      const grouped: Record<string, CalendarEventReadable[]> = {};
      for (const ev of rawEvents) {
        const key = toDateKey(ev.startDate);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(ev);
      }
      // Sort each day's events by start time
      for (const key of Object.keys(grouped)) {
        grouped[key].sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
        );
      }

      set(prev => ({
        events: { ...prev.events, ...grouped },
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false, hasError: true });
    }
  },
}));
