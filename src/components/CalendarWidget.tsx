import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GlowBox from './GlowBox';
import { COLORS, FONTS, SPACING } from '@/theme';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function CalendarWidget() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const { year, month } = viewDate;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  const prevMonth = () => {
    setViewDate(prev =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 },
    );
  };
  const nextMonth = () => {
    setViewDate(prev =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 },
    );
  };

  // Build cell grid
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <GlowBox style={styles.box} noPadding>
      {/* Header: month nav */}
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
          <Text
            key={d}
            style={[
              styles.dowLabel,
              (i === 0 || i === 6) && styles.dowWeekend,
            ]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.headerDivider} />

      {/* Calendar grid — flex: 1 rows fill remaining space */}
      <View style={styles.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.weekRow}>
            {row.map((day, di) => {
              const isToday = isCurrentMonth && day === today.getDate();
              const isWeekend = di === 0 || di === 6;
              const isEmpty = !day;
              return (
                <View
                  key={di}
                  style={[styles.cell, isToday && styles.todayCell]}>
                  {!isEmpty && (
                    <Text
                      style={[
                        styles.dayNum,
                        isToday && styles.todayNum,
                        isWeekend && !isToday && styles.weekendNum,
                      ]}>
                      {String(day)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },

  // Month navigator
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
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.greenFaint,
    borderRadius: 2,
  },
  navArrow: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: FONTS.sizes.lg,
    lineHeight: FONTS.sizes.lg + 4,
  },
  monthTitleWrap: {
    alignItems: 'center',
  },
  monthLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: FONTS.sizes.sm,
    letterSpacing: 2,
    fontWeight: '700',
  },
  yearLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 3,
    marginTop: 1,
  },

  // Day-of-week row
  dowRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xs,
    paddingTop: SPACING.xs,
    paddingBottom: 2,
  },
  dowLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 0.5,
  },
  dowWeekend: {
    color: COLORS.amber,
    opacity: 0.7,
  },
  headerDivider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
    marginHorizontal: SPACING.xs,
    opacity: 0.5,
  },

  // Grid fills remaining space
  grid: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
    justifyContent: 'space-around',
  },
  weekRow: {
    flexDirection: 'row',
    flex: 1,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    marginHorizontal: 1,
    marginVertical: 1,
  },
  todayCell: {
    backgroundColor: COLORS.green,
    borderRadius: 4,
  },
  dayNum: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    fontWeight: '500',
  },
  todayNum: {
    color: COLORS.background,
    fontWeight: '900',
    fontSize: FONTS.sizes.md,
  },
  weekendNum: {
    color: COLORS.amber,
    opacity: 0.8,
  },
});
