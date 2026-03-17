import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '@/theme';

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
          <View style={styles.titleAccent} />
          <Text style={styles.titleText} numberOfLines={1}>
            {title ?? ''}
          </Text>
          {titleRight ? (
            <View style={styles.titleRightBadge}>
              <Text style={styles.titleRight} numberOfLines={1}>
                {titleRight}
              </Text>
            </View>
          ) : null}
        </View>
      )}
      <View style={[styles.content, noPadding && styles.noPadding, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  containerDim: {
    borderColor: COLORS.divider,
    opacity: 0.7,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceElevated,
    gap: SPACING.sm,
  },
  titleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: COLORS.primaryLight,
  },
  titleText: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
    flex: 1,
    letterSpacing: 0.3,
  },
  titleRightBadge: {
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  titleRight: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: COLORS.primaryLighter,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  content: {
    padding: SPACING.md,
    flex: 1,
  },
  noPadding: {
    padding: 0,
  },
});
