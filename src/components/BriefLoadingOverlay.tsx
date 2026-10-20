import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import PulseText from './PulseText';
import { BriefPhase } from '@/store/useTechBriefStore';
import { useInterval } from '@/hooks/useInterval';
import { COLORS, FONTS, SPACING } from '@/theme';

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const STEPS: { phase: BriefPhase; label: string; detail: string }[] = [
  { phase: 'collecting', label: 'COLLECT', detail: 'FETCHING HN / NEWS FEEDS' },
  { phase: 'synthesizing', label: 'SYNTH', detail: 'CLAUDE SYNTHESIZING BRIEF + ANIM' },
  { phase: 'saving', label: 'ARCHIVE', detail: 'WRITING TO NOTION' },
];
const BAR_W = 0.28; // 인디케이터 블록 폭 (트랙 대비)

interface Props {
  phase: BriefPhase;
  startedAt: number | null;
  /** 기존 브리프가 없으면 불투명, 있으면 반투명으로 덮음 */
  solid: boolean;
}

export default function BriefLoadingOverlay({ phase, startedAt, solid }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);
  const scan = useSharedValue(0);
  const sweep = useSharedValue(0);

  useInterval(() => setTick(t => t + 1), 120);

  useEffect(() => {
    scan.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
    sweep.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(scan);
      cancelAnimation(sweep);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * size.h }],
  }));
  const trackW = Math.max(0, size.w - SPACING.md * 2);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * trackW * (1 - BAR_W) }],
  }));

  const stepIdx = STEPS.findIndex(s => s.phase === phase);
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const elapsedStr = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(
    elapsed % 60,
  ).padStart(2, '0')}`;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root, solid && styles.rootSolid]}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {/* 위→아래로 흐르는 스캔 라인 */}
      <Animated.View style={[styles.scanLine, scanStyle]} pointerEvents="none" />

      <View style={styles.center}>
        <Text style={styles.spinner}>{`${SPINNER[tick % SPINNER.length]} TECH::BRIEF`}</Text>
        <PulseText style={styles.title} duration={700}>
          {`> ${STEPS[Math.max(0, stepIdx)].detail}...`}
        </PulseText>

        <View style={styles.steps}>
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <Text
                key={s.phase}
                style={[styles.step, done && styles.stepDone, active && styles.stepActive]}
              >
                {`${done ? '■' : active ? '▣' : '□'} ${s.label}`}
              </Text>
            );
          })}
        </View>

        <View style={[styles.track, { width: trackW }]}>
          <Animated.View style={[styles.sweep, { width: trackW * BAR_W }, sweepStyle]} />
        </View>

        <Text style={styles.elapsed}>{`T+${elapsedStr}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'rgba(0,0,0,0.78)', overflow: 'hidden', zIndex: 10 },
  rootSolid: { backgroundColor: COLORS.background },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: COLORS.green,
    opacity: 0.35,
    shadowColor: COLORS.green,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.md, gap: 8 },
  spinner: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: FONTS.sizes.sm,
    letterSpacing: 2,
    fontWeight: '700',
  },
  title: {
    fontFamily: FONTS.mono,
    color: COLORS.amber,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1,
  },
  steps: { flexDirection: 'row', gap: SPACING.md },
  step: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 11, letterSpacing: 1 },
  stepDone: { color: COLORS.greenDim },
  stepActive: { color: COLORS.greenBright, fontWeight: '700' },
  track: {
    height: 6,
    borderWidth: 1,
    borderColor: COLORS.borderDim,
    overflow: 'hidden',
  },
  sweep: { height: '100%', backgroundColor: COLORS.green, opacity: 0.7 },
  elapsed: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 10, letterSpacing: 1 },
});
