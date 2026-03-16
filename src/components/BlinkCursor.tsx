import React from 'react';
import * as Animatable from 'react-native-animatable';
import { TextStyle } from 'react-native';
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
  const style: TextStyle = {
    fontFamily: FONTS.mono,
    color,
    fontSize: size,
    lineHeight: size * 1.2,
  };

  return (
    <Animatable.Text
      animation="flash"
      iterationCount="infinite"
      duration={900}
      useNativeDriver
      style={style}>
      {char}
    </Animatable.Text>
  );
}
