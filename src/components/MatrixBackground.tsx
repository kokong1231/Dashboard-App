import React, { memo, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const CHARS = 'アイウエオカキクケコサシスセソタチツテト01100110ABCDEF#!@%ナニヌネノハヒフヘホ';
const { width, height } = Dimensions.get('window');

const NUM_STREAMS = 32;
const CHAR_H = 16;
const CHAR_W = Math.floor(width / NUM_STREAMS);
const ROWS = Math.ceil(height / CHAR_H) + 2;

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface StreamConfig {
  x: number;
  length: number;
  duration: number;
  delay: number;
}

// Computed once at module load — stable across re-renders
const STREAM_CONFIGS: StreamConfig[] = Array.from({ length: NUM_STREAMS }, (_, i) => {
  const length = 7 + Math.floor(Math.random() * 14);
  const duration = 1800 + Math.floor(Math.random() * 3200);
  const delay = Math.floor(Math.random() * duration); // stagger starts
  return { x: i * CHAR_W, length, duration, delay };
});

// ── Individual character ──────────────────────────────────────────────────────

interface MatrixCharProps {
  char: string;
  rowIndex: number;
  headY: SharedValue<number>;
  streamLength: number;
}

const MatrixChar = memo(({ char, rowIndex, headY, streamLength }: MatrixCharProps) => {
  const animStyle = useAnimatedStyle(() => {
    'worklet';
    const dist = headY.value - rowIndex;
    let opacity = 0;
    let color = '#00ff41';

    if (dist > -0.7 && dist <= 0.7) {
      opacity = 1;
      color = '#e0ffe8';
    } else if (dist > 0.7 && dist <= streamLength) {
      const t = (dist - 0.7) / (streamLength - 0.7);
      opacity = (1 - t) * 0.42;
      color = dist < 3 ? '#00ff41' : '#00cc34';
    }

    return { opacity, color };
  });

  return <Animated.Text style={[styles.char, animStyle]}>{char}</Animated.Text>;
});

// ── Stream column ─────────────────────────────────────────────────────────────

interface StreamColumnProps {
  config: StreamConfig;
}

const StreamColumn = memo(({ config }: StreamColumnProps) => {
  const headY = useSharedValue(-config.length);
  const [chars, setChars] = useState(() => Array.from({ length: ROWS }, randomChar));

  useEffect(() => {
    // headY: -length → ROWS+length, looping smoothly, staggered by delay
    headY.value = -config.length;
    headY.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(ROWS + config.length, {
          duration: config.duration,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );

    // Mutate one random character every ~250ms
    const charInterval = 220 + Math.floor(Math.random() * 120);
    const id = setInterval(() => {
      setChars(prev => {
        const next = [...prev];
        next[Math.floor(Math.random() * ROWS)] = randomChar();
        return next;
      });
    }, charInterval);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.stream, { left: config.x }]}>
      {chars.map((ch, ri) => (
        <MatrixChar
          key={ri}
          char={ch}
          rowIndex={ri}
          headY={headY}
          streamLength={config.length}
        />
      ))}
    </View>
  );
});

// ── Root ──────────────────────────────────────────────────────────────────────

const MatrixBackground = memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {STREAM_CONFIGS.map((config, i) => (
      <StreamColumn key={i} config={config} />
    ))}
  </View>
));

const styles = StyleSheet.create({
  stream: {
    position: 'absolute',
    top: 0,
    width: CHAR_W,
  },
  char: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: CHAR_H,
    width: CHAR_W,
    textAlign: 'center',
  },
});

export default MatrixBackground;
