import { create } from 'zustand';
import RNCalendarEvents, { CalendarEventReadable } from 'react-native-calendar-events';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns every date key an event covers, clamped to [rangeStart, rangeEnd].
 *
 * All-day event semantics on Android/iOS: `endDate` is the exclusive midnight
 * of the day *after* the last day. Timed events ending exactly at midnight are
 * treated as ending the previous day (avoids bleeding into the next day).
 */
function getEventDayKeys(
  ev: CalendarEventReadable,
  rangeStart: Date,
  rangeEnd: Date,
): string[] {
  if (!ev.endDate) return [toDateKey(ev.startDate)];

  // Use calendar-day arithmetic (not millisecond arithmetic) so that the result
  // is timezone-agnostic regardless of whether endDate is stored as UTC midnight
  // or local midnight by the device / Google Calendar.
  const endDay = new Date(ev.endDate);
  if (ev.allDay) {
    // all-day endDate is always exclusive (the day AFTER the last day)
    endDay.setDate(endDay.getDate() - 1);
  } else if (
    endDay.getHours() === 0 &&
    endDay.getMinutes() === 0 &&
    endDay.getSeconds() === 0 &&
    endDay.getMilliseconds() === 0
  ) {
    // timed event ending at exactly local midnight = ends the previous day
    endDay.setDate(endDay.getDate() - 1);
  }
  endDay.setHours(0, 0, 0, 0);

  const startDay = new Date(ev.startDate);
  startDay.setHours(0, 0, 0, 0);

  // single-day event (or degenerate end-before-start)
  if (endDay.getTime() <= startDay.getTime()) return [toDateKey(ev.startDate)];

  // clamp iteration to the loaded range
  const iterStart = new Date(Math.max(startDay.getTime(), rangeStart.getTime()));
  iterStart.setHours(0, 0, 0, 0);
  const rangeEndDay = new Date(rangeEnd);
  rangeEndDay.setHours(0, 0, 0, 0);
  const iterEnd = new Date(Math.min(endDay.getTime(), rangeEndDay.getTime()));

  const keys: string[] = [];
  const cur = new Date(iterStart);
  while (cur <= iterEnd) {
    keys.push(toDateKey(cur.toISOString()));
    cur.setDate(cur.getDate() + 1);
    if (keys.length > 60) break; // safety: never loop forever
  }

  return keys.length > 0 ? keys : [toDateKey(ev.startDate)];
}

// ── Store ─────────────────────────────────────────────────────────────────────

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
      const status  = await RNCalendarEvents.requestPermissions();
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
    if (get().isLoading) return;
    set({ isLoading: true, hasError: false });
    try {
      const rangeStart = new Date(year, month, 1);
      const rangeEnd   = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const rawEvents  = await RNCalendarEvents.fetchAllEvents(
        rangeStart.toISOString(),
        rangeEnd.toISOString(),
      );

      const grouped: Record<string, CalendarEventReadable[]> = {};

      for (const ev of rawEvents) {
        // Spread multi-day events across every date they cover
        const dayKeys = getEventDayKeys(ev, rangeStart, rangeEnd);
        for (const key of dayKeys) {
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(ev);
        }
      }

      // Sort each day: multi-day (longer) first, then by start time
      for (const key of Object.keys(grouped)) {
        grouped[key].sort((a, b) => {
          const spanA = a.endDate
            ? new Date(a.endDate).getTime() - new Date(a.startDate).getTime()
            : 0;
          const spanB = b.endDate
            ? new Date(b.endDate).getTime() - new Date(b.startDate).getTime()
            : 0;
          if (spanB !== spanA) return spanB - spanA; // longer span first
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
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
