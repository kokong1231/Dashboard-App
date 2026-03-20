import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CalendarEventReadable } from 'react-native-calendar-events';
import GlowBox from './GlowBox';
import { EventListModal } from './CalendarEventModal';
import { COLORS, FONTS, SPACING } from '@/theme';
import { useCalendarStore } from '@/store/useCalendarStore';
import { useInterval } from '@/hooks/useInterval';

const DAY_LABELS  = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
/** ISO string → 'YYYY-MM-DD' in local time */
function isoToDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Returns the inclusive end date key of an event (timezone-safe). */
function getEventEndKey(ev: CalendarEventReadable): string {
  if (!ev.endDate) return isoToDateKey(ev.startDate);
  const d = new Date(ev.endDate);
  if (ev.allDay) {
    d.setDate(d.getDate() - 1); // exclusive next-day → inclusive last day
  } else if (
    d.getHours() === 0 && d.getMinutes() === 0 &&
    d.getSeconds() === 0 && d.getMilliseconds() === 0
  ) {
    d.setDate(d.getDate() - 1); // local-midnight end = previous day
  }
  return isoToDateKey(d.toISOString());
}
/** Android returns ARGB int; normalize to CSS hex */
function resolveCalendarColor(ev: CalendarEventReadable): string {
  const c = ev.calendar?.color;
  if (!c) return COLORS.cyan;
  if (typeof c === 'number') {
    return `#${((c >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
  }
  return String(c);
}

// ── EventBar ─────────────────────────────────────────────────────────────────

const MAX_BARS = 2;

interface EventBarProps {
  ev: CalendarEventReadable;
  dateKey: string;
  isToday: boolean;
}

function EventBar({ ev, dateKey, isToday }: EventBarProps) {
  const color    = resolveCalendarColor(ev);
  const startKey = isoToDateKey(ev.startDate);
  const endKey   = getEventEndKey(ev);
  const isStart  = startKey === dateKey;
  const isEnd    = endKey   === dateKey;

  return (
    <View
      style={[
        styles.eventBar,
        {
          backgroundColor:       color,
          marginLeft:            isStart ? 2 : 0,
          marginRight:           isEnd   ? 2 : 0,
          borderTopLeftRadius:   isStart ? 2 : 0,
          borderBottomLeftRadius:isStart ? 2 : 0,
          borderTopRightRadius:  isEnd   ? 2 : 0,
          borderBottomRightRadius:isEnd  ? 2 : 0,
          opacity:               isToday ? 0.75 : 0.85,
        },
      ]}
    />
  );
}

// ── CalendarWidget ────────────────────────────────────────────────────────────

export default function CalendarWidget() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(() => ({
    year:  today.getFullYear(),
    month: today.getMonth(),
  }));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const { year, month } = viewDate;
  const daysInMonth  = getDaysInMonth(year, month);
  const firstDow     = getFirstDayOfWeek(year, month);
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  const { requestPermission, loadMonth, events, permissionGranted } = useCalendarStore();

  useEffect(() => {
    requestPermission().then(granted => {
      if (granted) loadMonth(year, month);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (permissionGranted) loadMonth(year, month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, permissionGranted]);

  useInterval(() => {
    if (permissionGranted) loadMonth(year, month);
  }, 5 * 60 * 1000);

  const prevMonth = () =>
    setViewDate(p => p.month === 0  ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 });
  const nextMonth = () =>
    setViewDate(p => p.month === 11 ? { year: p.year + 1, month: 0  } : { year: p.year, month: p.month + 1 });

  // Build cell grid
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const selectedEvents = selectedDateKey ? (events[selectedDateKey] ?? []) : [];

  return (
    <GlowBox style={styles.box} noPadding>
      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.monthTitleWrap}>
          <Text style={styles.monthLabel}>{MONTH_NAMES[month]}</Text>
          <Text style={styles.yearLabel}>{String(year)}</Text>
        </View>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.dowRow}>
        {DAY_LABELS.map((d, i) => (
          <Text key={d} style={[styles.dowLabel, (i === 0 || i === 6) && styles.dowWeekend]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.headerDivider} />

      {/* Calendar grid */}
      <View style={styles.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.weekRow}>
            {row.map((day, di) => {
              const isToday   = isCurrentMonth && day === today.getDate();
              const isWeekend = di === 0 || di === 6;
              const isEmpty   = !day;
              const dateKey   = day ? toDateKey(year, month, day) : null;

              // Events for this cell — already sorted by store (multi-day first)
              const dayEvents  = dateKey ? (events[dateKey] ?? []) : [];
              const visibleEvs = dayEvents.slice(0, MAX_BARS);
              const extraCount = Math.max(0, dayEvents.length - MAX_BARS);

              return (
                <TouchableOpacity
                  key={di}
                  style={[styles.cell, isToday && styles.todayCell]}
                  onPress={() => dateKey && setSelectedDateKey(dateKey)}
                  activeOpacity={0.65}
                  disabled={isEmpty}>

                  {!isEmpty && (
                    <>
                      {/* Day number */}
                      <Text style={[
                        styles.dayNum,
                        isToday   && styles.todayNum,
                        isWeekend && !isToday && styles.weekendNum,
                      ]}>
                        {String(day)}
                      </Text>

                      {/* Event bars */}
                      <View style={styles.barsContainer}>
                        {visibleEvs.map((ev, ei) => (
                          <EventBar
                            key={ev.id ?? ei}
                            ev={ev}
                            dateKey={dateKey!}
                            isToday={isToday}
                          />
                        ))}
                        {extraCount > 0 && (
                          <Text style={styles.moreText}>{`+${extraCount}`}</Text>
                        )}
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <EventListModal
        dateKey={selectedDateKey}
        events={selectedEvents}
        onClose={() => setSelectedDateKey(null)}
      />
    </GlowBox>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box: { flex: 1 },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greenFaint,
    backgroundColor: 'rgba(0,255,65,0.04)',
  },
  navBtn: {
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.greenFaint, borderRadius: 2,
  },
  navArrow: {
    fontFamily: FONTS.mono, color: COLORS.green,
    fontSize: FONTS.sizes.lg, lineHeight: FONTS.sizes.lg + 4,
  },
  monthTitleWrap: { alignItems: 'center' },
  monthLabel: {
    fontFamily: FONTS.mono, color: COLORS.greenBright,
    fontSize: FONTS.sizes.sm, letterSpacing: 2, fontWeight: '700',
  },
  yearLabel: {
    fontFamily: FONTS.mono, color: COLORS.greenFaint,
    fontSize: FONTS.sizes.xs, letterSpacing: 3, marginTop: 1,
  },

  dowRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xs,
    paddingTop: SPACING.xs,
    paddingBottom: 2,
  },
  dowLabel: {
    flex: 1, textAlign: 'center',
    fontFamily: FONTS.mono, color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs, letterSpacing: 0.5,
  },
  dowWeekend: { color: COLORS.amber, opacity: 0.7 },
  headerDivider: {
    height: 1, backgroundColor: COLORS.greenFaint,
    marginHorizontal: SPACING.xs, opacity: 0.5,
  },

  grid: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
    justifyContent: 'space-around',
  },
  weekRow: { flexDirection: 'row', flex: 1 },

  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 3,
    marginHorizontal: 1,
    marginVertical: 1,
    paddingTop: 2,
    overflow: 'hidden',
  },
  todayCell: {
    backgroundColor: 'rgba(0, 255, 65, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 4,
  },

  dayNum: {
    fontFamily: FONTS.mono, color: COLORS.green,
    fontSize: FONTS.sizes.sm, textAlign: 'center', fontWeight: '500',
  },
  todayNum: {
    color: COLORS.greenBright, fontWeight: '900', fontSize: FONTS.sizes.sm,
  },
  weekendNum: { color: COLORS.amber, opacity: 0.8 },

  // Event bars container — sits directly below day number
  barsContainer: {
    alignSelf: 'stretch',
    marginTop: 2,
  },
  eventBar: {
    height: 3,
    marginBottom: 1,
  },
  moreText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 7,
    lineHeight: 9,
    textAlign: 'center',
  },
});
