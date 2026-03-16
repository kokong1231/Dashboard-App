import React, { useEffect } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface PulseTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

/**
 * Reanimated-based pulsing text (replaces Animatable flash on loading states).
 * Runs entirely on the UI thread — no JS-thread animation overhead.
 */
export default function PulseText({ children, style, duration = 600 }: PulseTextProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration }),
        withTiming(1, { duration }),
      ),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.Text style={[style, animStyle]}>{children}</Animated.Text>;
}
