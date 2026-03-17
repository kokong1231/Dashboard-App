import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS } from '@/theme';

interface BlinkCursorProps {
  color?: string;
  size?: number;
  char?: string;
}

export default function BlinkCursor({
  color = COLORS.green,
  size = FONTS.sizes.md,
  char = '_',
}: BlinkCursorProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0, { duration: 450 }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text
      style={[
        {
          fontFamily: FONTS.mono,
          color,
          fontSize: size,
          lineHeight: size * 1.2,
        },
        animStyle,
      ]}
    >
      {char}
    </Animated.Text>
  );
}
