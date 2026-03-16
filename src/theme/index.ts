import { Platform } from 'react-native';

export const COLORS = {
  background: '#000000',
  backgroundAlt: '#050505',
  green: '#00ff41',
  greenBright: '#39ff14',
  greenDim: '#00aa2b',
  greenFaint: '#003b0e',
  greenGlow: 'rgba(0, 255, 65, 0.15)',
  borderDim: 'rgba(0, 255, 65, 0.25)',
  border: 'rgba(0, 255, 65, 0.5)',
  borderBright: 'rgba(0, 255, 65, 0.8)',
  amber: '#ffb000',
  amberDim: '#cc8800',
  red: '#ff3333',
  cyan: '#00ffff',
  white: '#ccffcc',
  scanline: 'rgba(0, 0, 0, 0.15)',
};

export const FONTS = {
  mono: Platform.select({ android: 'monospace', ios: 'Courier New', default: 'monospace' }),
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 25,
    xxl: 34,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const GLOW = {
  shadowColor: '#00ff41',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.6,
  shadowRadius: 8,
  elevation: 8,
};

export const GLOW_DIM = {
  shadowColor: '#00ff41',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 4,
};
