import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, FONTS, GLOW_DIM, SPACING } from '@/theme';

interface GlowBoxProps {
  children: React.ReactNode;
  title?: string;
  titleRight?: string;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  noPadding?: boolean;
  dim?: boolean;
}

export default function GlowBox({
  children,
  title,
  titleRight,
  style,
  contentStyle,
  noPadding = false,
  dim = false,
}: GlowBoxProps) {
  return (
    <View style={[styles.container, dim && styles.containerDim, style]}>
      {(title || titleRight) && (
        <View style={styles.titleBar}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title ?? ''}
          </Text>
          {titleRight ? (
            <Text style={styles.titleRight} numberOfLines={1}>
              {titleRight}
            </Text>
          ) : null}
        </View>
      )}
      <View style={[styles.content, noPadding && styles.noPadding, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(0,0,0,0.92)',
    ...GLOW_DIM,
  },
  containerDim: {
    borderColor: COLORS.borderDim,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDim,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    backgroundColor: 'rgba(0, 255, 65, 0.04)',
  },
  titleText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.greenBright,
    letterSpacing: 2,
    fontWeight: '700',
    flex: 1,
  },
  titleRight: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.greenDim,
    letterSpacing: 1,
  },
  content: {
    padding: SPACING.sm,
    flex: 1,
  },
  noPadding: {
    padding: 0,
  },
});
