import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS } from '@/theme';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Petal config ──────────────────────────────────────────────────────────────

const PETAL_COLORS = [
  '#FFB7C5', '#FF85A1', '#F4A7D3', '#E87FBF',
  '#C77DFF', '#B17CEB', '#9D4EDD', '#D4A0FF',
  '#FFC0D8', '#FF99BB', '#DDA0FF', '#F0B8FF',
];

interface PetalConfig {
  id: number;
  startX: number;       // initial X position
  size: number;         // petal width
  height: number;       // petal height
  color: string;
  delay: number;        // ms before animation starts
  duration: number;     // fall duration ms
  driftAmp: number;     // horizontal drift amplitude
  driftFreq: number;    // drift frequency multiplier
  startRotation: number;
  borderTL: number;
  borderTR: number;
  borderBL: number;
  borderBR: number;
}

function makePetals(count: number): PetalConfig[] {
  return Array.from({ length: count }, (_, i) => {
    const size = 8 + Math.random() * 12;
    return {
      id: i,
      startX: Math.random() * SW,
      size,
      height: size * (1.4 + Math.random() * 0.8),
      color: PETAL_COLORS[i % PETAL_COLORS.length],
      delay: Math.random() * 3000,
      duration: 3500 + Math.random() * 2500,
      driftAmp: 30 + Math.random() * 50,
      driftFreq: 0.5 + Math.random() * 1.5,
      startRotation: Math.random() * 360,
      // organic petal shape via uneven border radii
      borderTL: 2 + Math.random() * 8,
      borderTR: 8 + Math.random() * 14,
      borderBL: 8 + Math.random() * 14,
      borderBR: 2 + Math.random() * 8,
    };
  });
}

const PETALS = makePetals(22);

// ── Single petal ──────────────────────────────────────────────────────────────

function Petal({ cfg, screenFade }: { cfg: PetalConfig; screenFade: SharedValue<number> }) {
  const fall = useSharedValue(0);

  useEffect(() => {
    fall.value = withDelay(
      cfg.delay,
      withTiming(1, { duration: cfg.duration, easing: Easing.linear }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const t = fall.value;
    const ty = interpolate(t, [0, 1], [-30, SH + 30]);
    // sinusoidal horizontal drift
    const tx = cfg.driftAmp * Math.sin(t * Math.PI * cfg.driftFreq * 2);
    const rotate = interpolate(t, [0, 1], [cfg.startRotation, cfg.startRotation + 540]);
    const opacity = interpolate(
      t,
      [0, 0.05, 0.85, 1],
      [0, 0.9, 0.9, 0],
    ) * (1 - screenFade.value);

    return {
      transform: [
        { translateY: ty },
        { translateX: tx },
        { rotate: `${rotate}deg` },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.petal,
        {
          left: cfg.startX,
          width: cfg.size,
          height: cfg.height,
          backgroundColor: cfg.color,
          borderTopLeftRadius: cfg.borderTL,
          borderTopRightRadius: cfg.borderTR,
          borderBottomLeftRadius: cfg.borderBL,
          borderBottomRightRadius: cfg.borderBR,
        },
        style,
      ]}
    />
  );
}

// ── Splash screen ─────────────────────────────────────────────────────────────

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const screenOpacity = useSharedValue(1);
  const screenFade = useSharedValue(0);   // 0 = visible, 1 = faded (for petals)
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.85);

  useEffect(() => {
    // Title fade in
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
    titleScale.value = withDelay(400, withTiming(1, { duration: 800, easing: Easing.out(Easing.back(1.2)) }));

    // Fade out entire splash after 4.2s
    screenOpacity.value = withDelay(
      4200,
      withTiming(0, { duration: 700, easing: Easing.in(Easing.cubic) }, finished => {
        if (finished) runOnJS(onDone)();
      }),
    );
    // Start fading petals a bit before screen
    screenFade.value = withDelay(
      4000,
      withTiming(1, { duration: 900, easing: Easing.in(Easing.cubic) }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  // Shimmer line under title
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withDelay(
      1000,
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 400 }),
        withTiming(1, { duration: 400 }),
        withTiming(0.6, { duration: 400 }),
        withTiming(1, { duration: 400 }),
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
    transform: [{ scaleX: shimmer.value }],
  }));

  return (
    <Animated.View style={[styles.container, screenStyle]} pointerEvents="none">
      {/* Background glow orbs */}
      <View style={[styles.glowOrb, styles.glowOrbLeft]} />
      <View style={[styles.glowOrb, styles.glowOrbRight]} />
      <View style={[styles.glowOrb, styles.glowOrbTop]} />

      {/* Petals */}
      {PETALS.map(cfg => (
        <Petal key={cfg.id} cfg={cfg} screenFade={screenFade} />
      ))}

      {/* Center content */}
      <Animated.View style={[styles.center, titleStyle]}>
        <Text style={styles.subtitle}>{'✦  for you  ✦'}</Text>
        <Text style={styles.title}>{'♡'}</Text>
        <Animated.View style={[styles.shimmerLine, shimmerStyle]} />
        <Text style={styles.tagline}>{'always here'}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 999,
    overflow: 'hidden',
  },

  // Background glow orbs for depth
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowOrbLeft: {
    width: SW * 0.7,
    height: SW * 0.7,
    left: -SW * 0.2,
    top: SH * 0.2,
    backgroundColor: 'rgba(123,47,190,0.12)',
  },
  glowOrbRight: {
    width: SW * 0.6,
    height: SW * 0.6,
    right: -SW * 0.15,
    top: SH * 0.4,
    backgroundColor: 'rgba(177,124,235,0.08)',
  },
  glowOrbTop: {
    width: SW * 0.5,
    height: SW * 0.5,
    left: SW * 0.25,
    top: -SW * 0.1,
    backgroundColor: 'rgba(199,125,255,0.1)',
  },

  petal: {
    position: 'absolute',
    top: 0,
  },

  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: COLORS.accent,
    letterSpacing: 4,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  title: {
    fontSize: 72,
    color: COLORS.primaryLighter,
    textShadowColor: 'rgba(199,125,255,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
    marginVertical: 4,
  },
  shimmerLine: {
    width: 80,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: COLORS.primaryLight,
    marginVertical: 4,
  },
  tagline: {
    fontFamily: FONTS.sansLight,
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 5,
    textTransform: 'lowercase',
    opacity: 0.7,
  },
});
