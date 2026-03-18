import React, { useEffect, useState } from 'react';
import { Dimensions, StatusBar, StyleSheet, Text, View } from 'react-native';
import * as Animatable from 'react-native-animatable';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MatrixBackground from '@/components/MatrixBackground';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { COLORS, FONTS, SPACING } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const { width: SW, height: SH } = Dimensions.get('window');

// ── Boot log content ──────────────────────────────────────────────────────────

type LineType = 'ok' | 'header' | 'module' | 'blank' | 'highlight' | 'nominal';

const BOOT_LOG: Array<{ text: string; type: LineType }> = [
  { text: 'BIOS v2.1.4  ................................. [ OK ]', type: 'ok' },
  { text: 'CPU CORES: 8   FREQ: 2.84GHz ................ [ OK ]', type: 'ok' },
  { text: 'RAM: 8192MB    INTEGRITY CHECK .............. [ OK ]', type: 'ok' },
  { text: 'STORAGE: 256GB SECTOR VERIFY ............... [ OK ]', type: 'ok' },
  { text: 'DISPLAY: 1920x1080 @ 60Hz .................. [ OK ]', type: 'ok' },
  { text: 'NETWORK ADAPTER: ETH0 ...................... [ OK ]', type: 'ok' },
  { text: '', type: 'blank' },
  { text: 'LOADING OHS DASHBOARD MODULES:', type: 'header' },
  { text: '  [ WEATHER  ]  API ENDPOINT ............... [ OK ]', type: 'module' },
  { text: '  [ CALENDAR ]  DEVICE SYNC ................ [ OK ]', type: 'module' },
  { text: '  [ GITHUB   ]  EVENTS STREAM .............. [ OK ]', type: 'module' },
  { text: '  [ NEWS     ]  FEED PARSER ................ [ OK ]', type: 'module' },
  { text: '  [ NOTION   ]  WORKSPACE .................. [ OK ]', type: 'module' },
  { text: '', type: 'blank' },
  { text: 'ALL SYSTEMS NOMINAL', type: 'nominal' },
  { text: '>>> INITIALIZING OHS DASHBOARD <<<', type: 'highlight' },
];

// ── Timing constants (ms) ─────────────────────────────────────────────────────

const LINE_MS   = 90;
const LOG_DONE  = BOOT_LOG.length * LINE_MS; // 1440ms
const TITLE_AT  = LOG_DONE + 160;            // 1600ms
const PROG_AT   = TITLE_AT + 600;            // 2200ms
const PROG_DUR  = 1200;
const NAV_AT    = PROG_AT + PROG_DUR + 600;  // 4000ms

// ── CRT flicker-on animation ──────────────────────────────────────────────────

const FLICKER_IN: Animatable.CustomAnimation = {
  0:    { opacity: 0,   scaleY: 1.04 },
  0.07: { opacity: 0.9, scaleY: 1.00 },
  0.12: { opacity: 0,   scaleY: 1.00 },
  0.20: { opacity: 1,   scaleY: 1.00 },
  0.27: { opacity: 0.2, scaleY: 1.00 },
  0.38: { opacity: 1,   scaleY: 1.00 },
  0.48: { opacity: 0.6, scaleY: 1.00 },
  0.60: { opacity: 1,   scaleY: 1.00 },
  1:    { opacity: 1,   scaleY: 1.00 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function lineColor(type: LineType): string {
  switch (type) {
    case 'ok':        return COLORS.green;
    case 'module':    return COLORS.greenDim;
    case 'header':    return COLORS.greenBright;
    case 'nominal':   return COLORS.cyan;
    case 'highlight': return COLORS.amber;
    default:          return COLORS.greenFaint;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SplashScreen({ navigation }: Props) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showTitle,    setShowTitle]    = useState(false);
  const [pct,          setPct]          = useState(0);
  const [status,       setStatus]       = useState('INITIALIZING...');
  const [cursor,       setCursor]       = useState(true);

  const progressW   = useSharedValue(0);
  const rootOpacity = useSharedValue(1);

  useEffect(() => {
    const timers:    ReturnType<typeof setTimeout>[]  = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    const after = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.push(id);
    };
    const every = (fn: () => void, ms: number) => {
      const id = setInterval(fn, ms);
      intervals.push(id);
      return id;
    };

    // Blinking cursor while log is typing
    every(() => setCursor(p => !p), 450);

    // Reveal boot log lines
    let line = 0;
    const lineId = every(() => {
      line += 1;
      setVisibleLines(line);
      if (line >= BOOT_LOG.length) clearInterval(lineId);
    }, LINE_MS);

    // Title card
    after(() => setShowTitle(true), TITLE_AT);

    // Progress bar + percentage counter
    after(() => {
      progressW.value = withTiming(SW, {
        duration: PROG_DUR,
        easing: Easing.out(Easing.cubic),
      });
      const t0 = Date.now();
      const pctId = every(() => {
        const p = Math.min(100, Math.round(((Date.now() - t0) / PROG_DUR) * 100));
        setPct(p);
        if (p >= 100) clearInterval(pctId);
      }, 40);
    }, PROG_AT);

    after(() => setStatus('ONLINE'), PROG_AT + PROG_DUR + 100);

    // Fade out → navigate
    after(() => {
      rootOpacity.value = withTiming(0, { duration: 400 });
    }, NAV_AT - 400);
    after(() => navigation.replace('Home'), NAV_AT);

    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barStyle  = useAnimatedStyle(() => ({ width: progressW.value }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <StatusBar hidden />

      {/* Full-screen matrix rain */}
      <MatrixBackground />

      {/* Dark vignette so text stays readable */}
      <View style={styles.overlay} pointerEvents="none" />

      {/* ── Boot log terminal ── */}
      <View style={styles.logBox}>
        <Text style={styles.logHeader}>{'> SYSTEM BOOT SEQUENCE'}</Text>
        <View style={styles.logDivider} />
        {BOOT_LOG.slice(0, visibleLines).map((l, i) => (
          <Text key={i} style={[styles.logLine, { color: lineColor(l.type) }]}>
            {l.text || ' '}
          </Text>
        ))}
        {visibleLines < BOOT_LOG.length && (
          <Text style={styles.cursorChar}>{cursor ? '█' : ' '}</Text>
        )}
      </View>

      {/* ── Center title ── */}
      {showTitle && (
        <Animatable.View
          animation={FLICKER_IN}
          duration={800}
          style={styles.titleWrapper}>

          {/* Corner glow lines */}
          <Text style={styles.titleCorner}>
            {'╔══════════════════════════════════════╗'}
          </Text>

          <View style={styles.titleInner}>
            <Text style={styles.titleEyebrow}>{'[ OHS TACTICAL MONITOR ]'}</Text>

            <Animatable.Text
              animation="pulse"
              iterationCount="infinite"
              duration={2400}
              style={styles.titleMain}>
              {'OHS DASHBOARD'}
            </Animatable.Text>

            <Text style={styles.titleSub}>{'MATRIX TERMINAL  ──  v1.0.0'}</Text>

            <View style={styles.statusRow}>
              <Animatable.View
                animation="flash"
                iterationCount="infinite"
                duration={1200}
                style={styles.statusDot}
              />
              <Text style={styles.statusIndicator}>{'SYSTEM ACTIVE'}</Text>
            </View>
          </View>

          <Text style={styles.titleCorner}>
            {'╚══════════════════════════════════════╝'}
          </Text>
        </Animatable.View>
      )}

      {/* ── Progress bar ── */}
      <View style={styles.progressSection}>
        <View style={styles.progressMeta}>
          <Text style={[styles.statusLabel, status === 'ONLINE' && styles.statusOnline]}>
            {status}
          </Text>
          <Text style={styles.pctLabel}>{`${pct.toString().padStart(3, ' ')}%`}</Text>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, barStyle]} />
          {/* Scanline shimmer overlay */}
          <View style={styles.progressShimmer} pointerEvents="none" />
        </View>

        <Text style={styles.progressCaption}>
          {'OHS DASHBOARD  //  SECURE BOOT  //  ENCRYPTED'}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const LOG_TOP    = SH * 0.06;
const LOG_HEIGHT = SH * 0.46;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // ── Boot log ──
  logBox: {
    position: 'absolute',
    top: LOG_TOP,
    left: SW * 0.06,
    right: SW * 0.06,
    maxHeight: LOG_HEIGHT,
    backgroundColor: 'rgba(0, 8, 2, 0.94)',
    borderWidth: 1,
    borderColor: COLORS.borderDim,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  logHeader: {
    fontFamily: FONTS.mono,
    color: COLORS.cyan,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  logDivider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
    marginBottom: SPACING.xs,
  },
  logLine: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  cursorChar: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.greenBright,
  },

  // ── Title ──
  titleWrapper: {
    position: 'absolute',
    bottom: SH * 0.14,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  titleCorner: {
    fontFamily: FONTS.mono,
    color: COLORS.amber,
    fontSize: 11,
    letterSpacing: 1,
    opacity: 0.7,
  },
  titleInner: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl * 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.amber,
    backgroundColor: 'rgba(0,0,0,0.9)',
    shadowColor: COLORS.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
    width: '100%',
  },
  titleEyebrow: {
    fontFamily: FONTS.mono,
    color: COLORS.amberDim,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: SPACING.sm,
  },
  titleMain: {
    fontFamily: FONTS.mono,
    color: COLORS.amber,
    fontSize: FONTS.sizes.xxl,
    fontWeight: '900',
    letterSpacing: 8,
    shadowColor: COLORS.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 0,
  },
  titleSub: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 11,
    letterSpacing: 3,
    marginTop: SPACING.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 6,
  },
  statusIndicator: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 10,
    letterSpacing: 2,
  },

  // ── Progress bar ──
  progressSection: {
    position: 'absolute',
    bottom: SH * 0.05,
    left: SW * 0.06,
    right: SW * 0.06,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 11,
    letterSpacing: 2,
  },
  statusOnline: {
    color: COLORS.cyan,
    shadowColor: COLORS.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  pctLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 11,
    letterSpacing: 1,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.greenFaint,
    borderWidth: 1,
    borderColor: COLORS.greenFaint,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.green,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  progressShimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressCaption: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 9,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 6,
  },
});
