import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useBatteryLevel, usePowerState } from 'react-native-device-info';
import { useClock } from '@/hooks/useClock';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '@/theme';

function BatteryIndicator() {
  const level = useBatteryLevel();
  const powerState = usePowerState();

  if (level == null || level < 0) return null;

  const pct = Math.round((level as number) * 100);
  const isCharging = powerState.batteryState === 'charging' || powerState.batteryState === 'full';

  const battColor = pct >= 60 ? COLORS.success : pct >= 25 ? COLORS.warning : COLORS.error;

  return (
    <View style={styles.battery}>
      <Text style={styles.battIcon}>{isCharging ? '⚡' : '🔋'}</Text>
      <View style={styles.battBarWrap}>
        <View
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style={[styles.battBarFill, { width: `${pct}%` as any, backgroundColor: battColor }]}
        />
      </View>
      <Text style={[styles.battPct, { color: battColor }]}>{pct}%</Text>
    </View>
  );
}

// Flower logo — 5-petal cherry blossom in purple
function FlowerLogo() {
  return (
    <View style={styles.flowerWrap}>
      <Text style={styles.flowerIcon}>✿</Text>
    </View>
  );
}

export default function HeaderBar() {
  const { timeString, dateString, dayString } = useClock();

  return (
    <View style={styles.container}>
      {/* Left: logo + title */}
      <View style={styles.section}>
        <FlowerLogo />
        <View style={styles.titleWrap}>
          <Text style={styles.title}>JIN Dashboard</Text>
          <Text style={styles.subtitle}>Personal Space</Text>
        </View>
      </View>

      {/* Right: battery + datetime */}
      <View style={styles.sectionRight}>
        <BatteryIndicator />
        <View style={styles.sep} />
        <View style={styles.datetimeWrap}>
          <Text style={styles.time}>{timeString}</Text>
          <Text style={styles.date}>
            {dayString}, {dateString}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },
  section: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  flowerWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowerIcon: {
    fontSize: 20,
    color: COLORS.primaryLighter,
  },
  titleWrap: {
    gap: 1,
  },
  title: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 0.3,
    opacity: 0.8,
  },
  sectionRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  battery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  battIcon: {
    fontSize: 14,
  },
  battBarWrap: {
    width: 36,
    height: 7,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  battBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  battPct: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
  },
  sep: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
  },
  datetimeWrap: {
    alignItems: 'flex-end',
    gap: 1,
  },
  time: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
    letterSpacing: 1,
  },
  date: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: COLORS.textHint,
    letterSpacing: 0.3,
  },
});
