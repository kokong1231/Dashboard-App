import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import GlowBox from './GlowBox';
import { COLORS, FONTS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';

const QUOTES = [
  { text: 'The best code is no code at all.', src: 'JEFF ATWOOD' },
  { text: 'First solve the problem, then write the code.', src: 'J. JOHNSON' },
  { text: 'Simplicity is the soul of efficiency.', src: 'A. FREEMAN' },
  { text: 'Make it work, make it right, make it fast.', src: 'KENT BECK' },
  { text: 'Any fool can write code a computer understands. Good programmers write code humans understand.', src: 'M. FOWLER' },
  { text: 'Programs must be written for people to read.', src: 'H. ABELSON' },
  { text: 'Code is like humor. When you have to explain it, it\'s bad.', src: 'C. HOUSE' },
  { text: 'The most dangerous phrase: "We\'ve always done it this way."', src: 'G. HOPPER' },
  { text: 'Fix the cause, not the symptom.', src: 'S. MAGUIRE' },
  { text: 'Premature optimization is the root of all evil.', src: 'D. KNUTH' },
  { text: 'Talk is cheap. Show me the code.', src: 'L. TORVALDS' },
  { text: 'In theory there is no difference between theory and practice, but in practice there is.', src: 'Y. BERRA' },
];

// Stats update every ~3s (3 ticks of 1s interval)
const STATS_EVERY = 3;
// Quote rotates every 12 ticks
const QUOTE_EVERY = 12;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function fluctuate(current: number, min: number, max: number, delta: number): number {
  const next = current + (Math.random() - 0.5) * delta * 2;
  return clamp(Math.round(next), min, max);
}

interface Stats {
  cpu: number;
  mem: number;
  netUp: number;
  netDown: number;
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const filled = Math.round((value / max) * 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = `${String(value).padStart(3, ' ')}%`;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <Text style={[styles.barGraph, { color }]}>{bar}</Text>
      <Text style={[styles.barPct, { color }]}>{pct}</Text>
    </View>
  );
}

export default function SysMonitorWidget() {
  const [stats, setStats] = useState<Stats>({ cpu: 38, mem: 61, netUp: 12, netDown: 48 });
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [uptime, setUptime] = useState(0);

  // Single 1s interval drives uptime, stats (every STATS_EVERY ticks), and quotes (every QUOTE_EVERY ticks)
  const tickRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;

      setUptime(tick);

      if (tick % STATS_EVERY === 0) {
        setStats(prev => ({
          cpu: fluctuate(prev.cpu, 8, 92, 10),
          mem: fluctuate(prev.mem, 40, 85, 5),
          netUp: fluctuate(prev.netUp, 1, 120, 15),
          netDown: fluctuate(prev.netDown, 1, 240, 25),
        }));
      }

      if (tick % QUOTE_EVERY === 0) {
        setQuoteIdx(i => (i + 1) % QUOTES.length);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = uptime % 60;
  const uptimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const cpuColor = stats.cpu > 80 ? COLORS.red : stats.cpu > 60 ? COLORS.amber : COLORS.green;
  const memColor = stats.mem > 80 ? COLORS.red : stats.mem > 65 ? COLORS.amber : COLORS.green;

  const quote = QUOTES[quoteIdx];

  return (
    <GlowBox title="◈ SYS::MONITOR" style={styles.box}>
      {/* Uptime */}
      <View style={styles.uptimeRow}>
        <Text style={styles.dimLabel}>UPTIME</Text>
        <Text style={styles.uptimeVal}>{uptimeStr}</Text>
      </View>

      <View style={styles.divider} />

      {/* Stats bars */}
      <BarRow label="CPU" value={stats.cpu} max={100} color={cpuColor} />
      <BarRow label="MEM" value={stats.mem} max={100} color={memColor} />

      {/* Network */}
      <View style={styles.barRow}>
        <Text style={styles.barLabel}>NET</Text>
        <Text style={styles.netVal}>
          <Text style={styles.netUp}>{`↑${stats.netUp}K `}</Text>
          <Text style={styles.netDown}>{`↓${stats.netDown}K`}</Text>
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Quote — key change triggers FadeIn entering animation */}
      <Text style={styles.quoteHeader}>{'> THOUGHT STREAM'}</Text>
      <Animated.View key={quoteIdx} entering={FadeIn.duration(800)}>
        <Text style={styles.quoteText}>{`"${quote.text}"`}</Text>
        <Text style={styles.quoteSrc}>{`  — ${quote.src}`}</Text>
      </Animated.View>
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  uptimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  dimLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1,
  },
  uptimeVal: {
    fontFamily: FONTS.mono,
    color: COLORS.cyan,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
    marginVertical: SPACING.xs,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  barLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 10,
    width: 28,
    letterSpacing: 1,
  },
  barGraph: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    flex: 1,
    letterSpacing: -0.5,
  },
  barPct: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    width: 32,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  netVal: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  netUp: {
    color: COLORS.green,
  },
  netDown: {
    color: COLORS.amber,
  },
  quoteHeader: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  quoteText: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 10,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  quoteSrc: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 3,
  },
});
