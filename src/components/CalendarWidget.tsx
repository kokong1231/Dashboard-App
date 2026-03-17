import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GlowBox from './GlowBox';
import { COLORS, FONTS, RADIUS, SPACING } from '@/theme';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

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
      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.7}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.monthTitleWrap}>
          <Text style={styles.monthLabel}>{MONTH_NAMES[month]}</Text>
          <Text style={styles.yearLabel}>{String(year)}</Text>
        </View>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.7}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.dowRow}>
        {DAY_LABELS.map((d, i) => (
          <Text key={i} style={[styles.dowLabel, (i === 0 || i === 6) && styles.dowWeekend]}>
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
              const isToday = isCurrentMonth && day === today.getDate();
              const isWeekend = di === 0 || di === 6;
              return (
                <View key={di} style={[styles.cell, isToday && styles.todayCell]}>
                  {day != null && (
                    <Text
                      style={[
                        styles.dayNum,
                        isToday && styles.todayNum,
                        isWeekend && !isToday && styles.weekendNum,
                      ]}
                    >
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

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceElevated,
  },
  navBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  navArrow: {
    fontFamily: FONTS.sans,
    color: COLORS.primaryLighter,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    lineHeight: FONTS.sizes.lg + 4,
  },
  monthTitleWrap: { alignItems: 'center' },
  monthLabel: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  yearLabel: {
    fontFamily: FONTS.sans,
    color: COLORS.accent,
    fontSize: 11,
    marginTop: 1,
  },

  dowRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  dowLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.sansMedium,
    color: COLORS.textHint,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dowWeekend: {
    color: COLORS.accent,
    opacity: 0.8,
  },
  headerDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: SPACING.sm,
  },

  grid: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
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
    borderRadius: RADIUS.sm,
    marginHorizontal: 1,
    marginVertical: 1,
  },
  todayCell: {
    backgroundColor: COLORS.primary,
  },
  dayNum: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    fontWeight: '400',
  },
  todayNum: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
    fontSize: FONTS.sizes.md,
  },
  weekendNum: {
    color: COLORS.accent,
    opacity: 0.9,
  },
});
