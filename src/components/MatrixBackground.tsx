/* eslint-disable react/display-name */
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
const { width } = Dimensions.get('window');

const NUM_STREAMS = 32;
const CHAR_H = 16;
const CHAR_W = Math.floor(width / NUM_STREAMS);

// Single interval tick: ~240ms — one random char mutated per tick across all streams
const TICK_MS = 240;

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface StreamConfig {
  x: number;
  length: number;
  duration: number;
  delay: number;
}

// Computed once at module load — stable across re-renders (no ROWS dependency)
const STREAM_CONFIGS: StreamConfig[] = Array.from({ length: NUM_STREAMS }, (_, i) => {
  const length = 7 + Math.floor(Math.random() * 14);
  const duration = 1800 + Math.floor(Math.random() * 3200);
  const delay = Math.floor(Math.random() * duration);
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
  chars: string[];
  rows: number;
}

const StreamColumn = memo(({ config, chars, rows }: StreamColumnProps) => {
  const headY = useSharedValue(-config.length);

  useEffect(() => {
    headY.value = -config.length;
    headY.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(rows + config.length, {
          duration: config.duration,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.stream, { left: config.x }]}>
      {chars.map((ch, ri) => (
        <MatrixChar key={ri} char={ch} rowIndex={ri} headY={headY} streamLength={config.length} />
      ))}
    </View>
  );
});

// ── Root — owns all chars state, single interval ──────────────────────────────

interface MatrixBackgroundProps {
  /** Restrict rendering to this height only (reduces animated chars significantly) */
  containerHeight?: number;
}

const MatrixBackground = memo(({ containerHeight }: MatrixBackgroundProps) => {
  const { height } = Dimensions.get('window');
  const effectiveHeight = containerHeight ?? height;
  const rows = Math.ceil(effectiveHeight / CHAR_H) + 2;

  const [allChars, setAllChars] = useState<string[][]>(() =>
    Array.from({ length: NUM_STREAMS }, () => Array.from({ length: rows }, randomChar)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const si = Math.floor(Math.random() * NUM_STREAMS);
      const ri = Math.floor(Math.random() * rows);
      setAllChars(prev => {
        const next = [...prev];
        const col = [...next[si]];
        col[ri] = randomChar();
        next[si] = col;
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STREAM_CONFIGS.map((config, i) => (
        <StreamColumn key={i} config={config} chars={allChars[i]} rows={rows} />
      ))}
    </View>
  );
});

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
