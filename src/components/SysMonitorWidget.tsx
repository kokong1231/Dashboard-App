import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  useBatteryLevel,
  usePowerState,
  getDeviceNameSync,
  getSystemVersion,
  getTotalMemorySync,
} from 'react-native-device-info';
import GlowBox from './GlowBox';
import { COLORS, FONTS, RADIUS, SPACING } from '@/theme';

const QUOTES = [
  { text: 'The best code is no code at all.', src: 'Jeff Atwood' },
  { text: 'First solve the problem, then write the code.', src: 'J. Johnson' },
  { text: 'Simplicity is the soul of efficiency.', src: 'A. Freeman' },
  { text: 'Make it work, make it right, make it fast.', src: 'Kent Beck' },
  { text: 'Any fool can write code a computer understands.', src: 'M. Fowler' },
  { text: 'Programs must be written for people to read.', src: 'H. Abelson' },
  { text: 'Talk is cheap. Show me the code.', src: 'L. Torvalds' },
  { text: 'Fix the cause, not the symptom.', src: 'S. Maguire' },
  { text: 'Premature optimization is the root of all evil.', src: 'D. Knuth' },
];

const STATS_EVERY = 3;
const QUOTE_EVERY = 15;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
function fluctuate(current: number, min: number, max: number, delta: number): number {
  return clamp(Math.round(current + (Math.random() - 0.5) * delta * 2), min, max);
}

interface Stats {
  cpu: number;
  mem: number;
  gpu: number;
  disk: number;
  temp: number;
  netUp: number;
  netDown: number;
  netPing: number;
  processes: number;
  threads: number;
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{text}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <View style={styles.progressTrack}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function StatRow({
  label,
  value,
  showBar,
  barMax = 100,
  color,
}: {
  label: string;
  value: string | number;
  showBar?: boolean;
  barMax?: number;
  color?: string;
}) {
  const displayColor = color ?? COLORS.primaryLight;
  const numVal = typeof value === 'number' ? value : parseInt(String(value), 10);
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRight}>
        {showBar && !isNaN(numVal) && (
          <ProgressBar value={numVal} max={barMax} color={displayColor} />
        )}
        <Text style={[styles.statValue, { color: displayColor }]}>
          {typeof value === 'number' ? `${value}%` : value}
        </Text>
      </View>
    </View>
  );
}

export default function SysMonitorWidget() {
  const batteryLevel = useBatteryLevel();
  const powerState = usePowerState();

  const [stats, setStats] = useState<Stats>({
    cpu: 38,
    mem: 61,
    gpu: 22,
    disk: 74,
    temp: 44,
    netUp: 12,
    netDown: 48,
    netPing: 18,
    processes: 218,
    threads: 1042,
  });
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [uptime, setUptime] = useState(0);
  const [deviceName] = useState(() => {
    try {
      return getDeviceNameSync();
    } catch {
      return 'Android';
    }
  });
  const [osVersion] = useState(() => {
    try {
      return `Android ${getSystemVersion()}`;
    } catch {
      return '--';
    }
  });
  const [totalMemGB] = useState(() => {
    try {
      return `${(getTotalMemorySync() / 1073741824).toFixed(1)} GB`;
    } catch {
      return '--';
    }
  });
  const tickRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;
      setUptime(tick);
      if (tick % STATS_EVERY === 0) {
        setStats(prev => {
          const cpu = fluctuate(prev.cpu, 8, 92, 10);
          return {
            cpu,
            mem: fluctuate(prev.mem, 40, 85, 4),
            gpu: fluctuate(prev.gpu, 5, 75, 12),
            disk: fluctuate(prev.disk, 60, 95, 1),
            temp: clamp(Math.round(35 + cpu * 0.45 + (Math.random() - 0.5) * 4), 30, 88),
            netUp: fluctuate(prev.netUp, 1, 150, 18),
            netDown: fluctuate(prev.netDown, 1, 280, 28),
            netPing: fluctuate(prev.netPing, 5, 120, 12),
            processes: fluctuate(prev.processes, 180, 310, 8),
            threads: fluctuate(prev.threads, 900, 1400, 30),
          };
        });
      }
      if (tick % QUOTE_EVERY === 0) {
        setQuoteIdx(i => (i + 1) % QUOTES.length);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const hh = Math.floor(uptime / 3600);
  const mm = Math.floor((uptime % 3600) / 60);
  const ss = uptime % 60;
  const uptimeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(
    ss,
  ).padStart(2, '0')}`;

  const cpuColor = stats.cpu > 80 ? COLORS.error : stats.cpu > 60 ? COLORS.warning : COLORS.success;
  const memColor =
    stats.mem > 80 ? COLORS.error : stats.mem > 65 ? COLORS.warning : COLORS.primaryLight;
  const gpuColor = stats.gpu > 70 ? COLORS.warning : COLORS.primaryLighter;
  const diskColor = stats.disk > 90 ? COLORS.error : stats.disk > 75 ? COLORS.warning : COLORS.info;
  const tempColor =
    stats.temp > 75 ? COLORS.error : stats.temp > 60 ? COLORS.warning : COLORS.success;
  const pingColor =
    stats.netPing > 80 ? COLORS.error : stats.netPing > 40 ? COLORS.warning : COLORS.success;

  const battPct =
    batteryLevel != null && batteryLevel >= 0 ? Math.round((batteryLevel as number) * 100) : null;
  const isCharging = powerState.batteryState === 'charging' || powerState.batteryState === 'full';
  const battColor =
    battPct == null
      ? COLORS.textHint
      : battPct >= 60
      ? COLORS.success
      : battPct >= 25
      ? COLORS.warning
      : COLORS.error;

  const quote = QUOTES[quoteIdx];

  return (
    <GlowBox title="시스템" style={styles.box} noPadding>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Device */}
        <SectionLabel text="기기" />
        <StatRow label="기기명" value={deviceName} color={COLORS.textPrimary} />
        <StatRow label="OS" value={osVersion} color={COLORS.textSecondary} />
        <StatRow label="메모리" value={totalMemGB} color={COLORS.textSecondary} />
        <StatRow label="가동 시간" value={uptimeStr} color={COLORS.accent} />

        <View style={styles.divider} />

        {/* Compute */}
        <SectionLabel text="컴퓨팅" />
        <StatRow label="CPU" value={stats.cpu} showBar color={cpuColor} />
        <StatRow label="GPU" value={stats.gpu} showBar color={gpuColor} />
        <StatRow label="온도" value={`${stats.temp} °C`} color={tempColor} />

        <View style={styles.divider} />

        {/* Memory */}
        <SectionLabel text="메모리" />
        <StatRow label="RAM" value={stats.mem} showBar color={memColor} />

        <View style={styles.divider} />

        {/* Storage */}
        <SectionLabel text="스토리지" />
        <StatRow label="디스크" value={stats.disk} showBar color={diskColor} />

        <View style={styles.divider} />

        {/* Network */}
        <SectionLabel text="네트워크" />
        <StatRow label="업로드" value={`↑ ${stats.netUp} KB/s`} color={COLORS.success} />
        <StatRow label="다운로드" value={`↓ ${stats.netDown} KB/s`} color={COLORS.primaryLight} />
        <StatRow label="핑" value={`${stats.netPing} ms`} color={pingColor} />

        {/* Power */}
        {battPct != null && (
          <>
            <View style={styles.divider} />
            <SectionLabel text="배터리" />
            <StatRow label="충전량" value={battPct} showBar color={battColor} />
            <StatRow
              label="상태"
              value={isCharging ? '⚡ 충전 중' : '사용 중'}
              color={isCharging ? COLORS.warning : battColor}
            />
          </>
        )}

        <View style={styles.divider} />

        {/* Quote */}
        <SectionLabel text="오늘의 한 마디" />
        <Animated.View key={quoteIdx} entering={FadeIn.duration(800)}>
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>{`"${quote.text}"`}</Text>
            <Text style={styles.quoteSrc}>— {quote.src}</Text>
          </View>
        </Animated.View>

        <View style={{ height: SPACING.md }} />
      </ScrollView>
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.sm,
  },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statLabel: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: FONTS.sizes.xs,
    width: 60,
  },
  statRight: {
    flex: 1,
    gap: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  statValue: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    textAlign: 'right',
  },

  quoteCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quoteText: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: SPACING.xs,
  },
  quoteSrc: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '600',
  },
});
