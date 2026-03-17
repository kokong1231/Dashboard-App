import { Platform } from 'react-native';

// ── BTS Purple Material Dark Theme ───────────────────────────────────────────

export const COLORS = {
  // Backgrounds
  background: '#080B14',
  backgroundAlt: '#0C0F1A',
  surface: '#0F1221',
  surfaceElevated: '#161B30',
  surfaceHighlight: '#1E2440',

  // BTS Purple — primary
  primary: '#7B2FBE',
  primaryLight: '#9D4EDD',
  primaryLighter: '#C77DFF',
  primaryDark: '#4A1580',
  primaryGlow: 'rgba(123, 47, 190, 0.25)',
  primarySurface: 'rgba(123, 47, 190, 0.12)',

  // Accent / highlight
  accent: '#B17CEB',
  accentDim: 'rgba(177, 124, 235, 0.18)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B8BDD6',
  textHint: '#6A6F8A',
  textDisabled: '#3D4260',
  textOnPrimary: '#FFFFFF',

  // Borders
  divider: '#1A1F38',
  border: '#252A45',
  borderLight: '#343A60',

  // Status
  success: '#4CAF50',
  successDim: 'rgba(76, 175, 80, 0.15)',
  warning: '#FF9800',
  warningDim: 'rgba(255, 152, 0, 0.15)',
  error: '#EF5350',
  errorDim: 'rgba(239, 83, 80, 0.15)',
  info: '#42A5F5',
  infoDim: 'rgba(66, 165, 245, 0.15)',

  // Legacy compat (avoid using in new code)
  white: '#FFFFFF',
  black: '#000000',

  // Legacy aliases — kept for TypeScript compat with old unused components
  green: '#9D4EDD',
  greenBright: '#C77DFF',
  greenDim: '#7B2FBE',
  greenFaint: 'rgba(123, 47, 190, 0.3)',
  greenGlow: 'rgba(123, 47, 190, 0.15)',
  borderDim: 'rgba(37, 42, 69, 0.5)',
  borderBright: '#3D4473',
  amber: '#FF9800',
  red: '#EF5350',
  cyan: '#42A5F5',
  scanline: 'rgba(0, 0, 0, 0.04)',
};

export const FONTS = {
  sans: Platform.select({ android: 'sans-serif', ios: 'System', default: 'System' }),
  sansMedium: Platform.select({ android: 'sans-serif-medium', ios: 'System', default: 'System' }),
  sansLight: Platform.select({ android: 'sans-serif-light', ios: 'System', default: 'System' }),
  // keep mono for Notion code blocks
  mono: Platform.select({ android: 'monospace', ios: 'Courier New', default: 'monospace' }),
  sizes: {
    xs: 13,
    sm: 15,
    md: 18,
    lg: 22,
    xl: 28,
    xxl: 36,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const SHADOWS = {
  card: {
    shadowColor: '#7B2FBE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#7B2FBE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
};

// Legacy exports (used by old components during transition)
export const GLOW = SHADOWS.elevated;
export const GLOW_DIM = SHADOWS.card;
