import React, { useEffect, useState } from 'react';
import { Text, TextStyle } from 'react-native';
import { COLORS, FONTS } from '@/theme';

interface TerminalTextProps {
  text: string;
  style?: TextStyle;
  speed?: number; // ms per character (0 = instant)
  onComplete?: () => void;
  numberOfLines?: number;
}

export default function TerminalText({
  text,
  style,
  speed = 35,
  onComplete,
  numberOfLines,
}: TerminalTextProps) {
  const [displayed, setDisplayed] = useState(speed === 0 ? text : '');

  useEffect(() => {
    if (speed === 0) {
      setDisplayed(text);
      onComplete?.();
      return;
    }
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);

  return (
    <Text style={[defaultStyle, style]} numberOfLines={numberOfLines}>
      {displayed}
    </Text>
  );
}

const defaultStyle: TextStyle = {
  fontFamily: FONTS.mono,
  color: COLORS.green,
  fontSize: FONTS.sizes.md,
};
