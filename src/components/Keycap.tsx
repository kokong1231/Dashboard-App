import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, FONTS, RADIUS } from '@/theme';

// ── 조합 문자열 파서 ──────────────────────────────────────────────────────────
//   "Ctrl+Shift+P"   → [Ctrl] + [Shift] + [P]
//   "Ctrl+N , T"     → [Ctrl] + [N] › [T]        (차례대로 누르기)
//   "Ctrl+] / ["     → [Ctrl] + []] / [[]        (둘 중 하나)
//   "Space (누른 채)" → [Space] 누른 채

type Token =
  | { type: 'key'; label: string }
  | { type: 'plus' }
  | { type: 'slash' }
  | { type: 'then' }
  | { type: 'note'; text: string };

const MODIFIERS = new Set(['ctrl', 'shift', 'alt', 'cmd', 'win', 'fn', 'option', 'command']);

function isModifier(label: string): boolean {
  return MODIFIERS.has(label.trim().toLowerCase());
}

export function parseCombo(keys: string): Token[] {
  const out: Token[] = [];
  const steps = keys.split(',');

  steps.forEach((rawStep, stepIndex) => {
    if (stepIndex > 0) out.push({ type: 'then' });

    let step = rawStep.trim();
    let note: string | null = null;

    const noteMatch = step.match(/\(([^)]*)\)\s*$/);
    if (noteMatch && noteMatch.index !== undefined) {
      note = noteMatch[1].trim();
      step = step.slice(0, noteMatch.index).trim();
    }

    step
      .split('+')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .forEach((part, partIndex) => {
        if (partIndex > 0) out.push({ type: 'plus' });

        // "/" 자체가 키인 경우와 "A / B" 대체 표기를 구분
        if (part === '/' || !part.includes('/')) {
          out.push({ type: 'key', label: part });
          return;
        }

        part
          .split('/')
          .map(a => a.trim())
          .filter(a => a.length > 0)
          .forEach((alt, altIndex) => {
            if (altIndex > 0) out.push({ type: 'slash' });
            out.push({ type: 'key', label: alt });
          });
      });

    if (note) out.push({ type: 'note', text: note });
  });

  return out;
}

// ── 개별 키캡 ─────────────────────────────────────────────────────────────────

interface KeycapProps {
  label: string;
  accent?: string;
  compact?: boolean;
}

export function Keycap({ label, accent, compact = false }: KeycapProps) {
  const modifier = isModifier(label);
  const tint = accent ?? COLORS.primaryLighter;

  return (
    <View
      style={[
        styles.cap,
        compact && styles.capCompact,
        modifier
          ? styles.capModifier
          : { borderColor: tint, backgroundColor: COLORS.surfaceHighlight },
      ]}
    >
      <Text
        style={[
          styles.capText,
          compact && styles.capTextCompact,
          modifier ? styles.capTextModifier : { color: tint },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// ── 조합 전체 ─────────────────────────────────────────────────────────────────

interface KeyComboProps {
  keys: string;
  accent?: string;
  compact?: boolean;
  style?: ViewStyle;
}

export default function KeyCombo({ keys, accent, compact = false, style }: KeyComboProps) {
  const tokens = useMemo(() => parseCombo(keys), [keys]);

  return (
    <View style={[styles.combo, style]}>
      {tokens.map((token, i) => {
        switch (token.type) {
          case 'key':
            return <Keycap key={`k-${i}`} label={token.label} accent={accent} compact={compact} />;
          case 'plus':
            return (
              <Text key={`p-${i}`} style={[styles.sep, compact && styles.sepCompact]}>
                +
              </Text>
            );
          case 'slash':
            return (
              <Text key={`s-${i}`} style={[styles.sepAlt, compact && styles.sepCompact]}>
                또는
              </Text>
            );
          case 'then':
            return (
              <Text
                key={`t-${i}`}
                style={[styles.sepThen, compact && styles.sepCompact, { color: accent }]}
              >
                ▸
              </Text>
            );
          case 'note':
            return (
              <Text key={`n-${i}`} style={styles.note}>
                {token.text}
              </Text>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  combo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 3,
  },
  cap: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.sm - 2,
    borderWidth: 1,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    borderColor: COLORS.borderLight,
  },
  capCompact: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderBottomWidth: 2,
  },
  capModifier: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.border,
  },
  capText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: COLORS.textPrimary,
  },
  capTextCompact: {
    fontSize: 11,
  },
  capTextModifier: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sep: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: COLORS.textHint,
    marginHorizontal: 1,
  },
  sepAlt: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: COLORS.textDisabled,
    marginHorizontal: 2,
  },
  sepThen: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    marginHorizontal: 2,
  },
  sepCompact: {
    fontSize: 10,
  },
  note: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: COLORS.textHint,
    marginLeft: 2,
  },
});
