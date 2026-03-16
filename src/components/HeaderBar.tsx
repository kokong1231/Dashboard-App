import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useBatteryLevel, usePowerState } from 'react-native-device-info';
import { useClock } from '@/hooks/useClock';
import { useWeatherStore } from '@/store/useWeatherStore';
import { useNewsStore } from '@/store/useNewsStore';
import { useNotionStore } from '@/store/useNotionStore';
import BlinkCursor from './BlinkCursor';
import { COLORS, FONTS, SPACING } from '@/theme';

function BatteryIndicator() {
  const level = useBatteryLevel(); // 0.0 – 1.0, or -1 if unknown
  const powerState = usePowerState();

  if (level == null || level < 0) return null;

  const pct = Math.round((level as number) * 100);
  const isCharging = powerState.batteryState === 'charging' || powerState.batteryState === 'full';

  // 4-block bar
  const filled = Math.round((pct / 100) * 4);
  const bar = '█'.repeat(filled) + '░'.repeat(4 - filled);

  const color =
    pct >= 60 ? COLORS.green :
    pct >= 25 ? COLORS.amber :
    COLORS.red;

  return (
    <View style={styles.battery}>
      <Text style={[styles.batteryBar, { color }]}>{bar}</Text>
      <Text style={[styles.batteryPct, { color }]}>
        {isCharging ? '⚡' : ''}{pct}%
      </Text>
    </View>
  );
}

export default function HeaderBar() {
  const { timeString, dateString, dayString } = useClock();
  const weatherLoading = useWeatherStore(s => s.isLoading);
  const newsLoading = useNewsStore(s => s.isLoading);
  const notionLoading = useNotionStore(s => s.isLoading);
  const notionConnected = useNotionStore(s => s.lastFetched !== null || s.isLoading);

  const dot = (active: boolean, loading: boolean) => ({
    color: loading ? COLORS.amber : active ? COLORS.greenBright : COLORS.greenDim,
  });

  return (
    <View style={styles.container}>
      {/* Left: title */}
      <View style={styles.section}>
        <Text style={styles.prefix}>&gt;&gt; </Text>
        <Text style={styles.title}>OHS_DASHBOARD</Text>
        <Text style={styles.version}> v1.0</Text>
      </View>

      {/* Center: status indicators */}
      <View style={styles.sectionCenter}>
        <Text style={[styles.dot, dot(true, weatherLoading)]}>●</Text>
        <Text style={styles.label}> WX </Text>
        <Text style={[styles.dot, dot(notionConnected, notionLoading)]}>●</Text>
        <Text style={styles.label}> NTN </Text>
        <Text style={[styles.dot, dot(true, newsLoading)]}>●</Text>
        <Text style={styles.label}> NEWS </Text>
      </View>

      {/* Right: datetime + battery */}
      <View style={styles.sectionRight}>
        <BatteryIndicator />
        <View style={styles.separator} />
        <Text style={styles.datetime}>{dayString} {dateString}</Text>
        <Text style={styles.timeSep}>  </Text>
        <Text style={styles.time}>{timeString}</Text>
        <BlinkCursor char="_" size={FONTS.sizes.sm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'rgba(0, 255, 65, 0.03)',
  },
  section: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sectionCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  prefix: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.sm,
    color: COLORS.greenDim,
  },
  title: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.md,
    color: COLORS.greenBright,
    fontWeight: '700',
    letterSpacing: 2,
  },
  version: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.greenDim,
    letterSpacing: 1,
  },
  dot: {
    fontSize: FONTS.sizes.sm,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.greenDim,
    letterSpacing: 1,
  },
  datetime: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.sm,
    color: COLORS.greenDim,
    letterSpacing: 1,
  },
  timeSep: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.sm,
    color: COLORS.greenDim,
  },
  time: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.sm,
    color: COLORS.green,
    letterSpacing: 2,
  },
  battery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  batteryBar: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    letterSpacing: -1,
  },
  batteryPct: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 0.5,
  },
  separator: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.greenFaint,
    marginHorizontal: SPACING.sm,
  },
});
