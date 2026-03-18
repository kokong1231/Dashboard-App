import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useGitStore, GitPushNotification } from '@/store/useGitStore';
import { COLORS, FONTS, SPACING } from '@/theme';

const DISPLAY_MS = 4500;
const ANIM_OUT_MS = 400;

function shortRepo(full: string): string {
  if (full.length <= 24) return full;
  const [owner, repo] = full.split('/');
  if (!repo) return full.slice(0, 24);
  const ownerShort = owner.length > 7 ? `${owner.slice(0, 6)}…` : owner;
  return `${ownerShort}/${repo}`;
}

function ToastCard({ item }: { item: GitPushNotification }) {
  const dismiss  = useGitStore(s => s.dismissNotification);
  const viewRef  = useRef<Animatable.View & View>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      await viewRef.current?.animate?.('slideOutUp', ANIM_OUT_MS);
      dismiss(item.id);
    }, DISPLAY_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const msg    = item.message.length > 42 ? `${item.message.slice(0, 41)}…` : item.message;
  const repo   = shortRepo(item.repo);
  const extra  = item.commitCount > 1 ? ` (+${item.commitCount - 1})` : '';

  return (
    <Animatable.View
      ref={viewRef}
      animation="slideInDown"
      duration={350}
      style={styles.card}>

      {/* Top bar */}
      <View style={styles.topRow}>
        <Text style={styles.pushIcon}>⬆</Text>
        <Text style={styles.pushLabel}>GIT PUSH</Text>
        <View style={styles.topSpacer} />
        <Text style={styles.repoText}>{repo}</Text>
      </View>

      {/* Branch */}
      <View style={styles.branchRow}>
        <Text style={styles.branchIcon}>⎇</Text>
        <Text style={styles.branchText}>{item.branch}</Text>
        {item.commitCount > 1 && (
          <Text style={styles.commitCountText}>{extra} commits</Text>
        )}
      </View>

      {/* Commit message */}
      <Text style={styles.msgText} numberOfLines={1}>{msg}</Text>

      {/* Author */}
      <Text style={styles.authorText}>{`by ${item.author}`}</Text>

      {/* Progress bar */}
      <ToastProgress durationMs={DISPLAY_MS} />
    </Animatable.View>
  );
}

/** Shrinking progress bar at the bottom of the toast */
function ToastProgress({ durationMs }: { durationMs: number }) {
  const barRef = useRef<Animatable.View & View>(null);

  useEffect(() => {
    // Animate width from 100% → 0% over durationMs
    // react-native-animatable doesn't support width%, so use scaleX on a full-width view
    barRef.current?.animate?.(
      {
        0:   { scaleX: 1 },
        1:   { scaleX: 0 },
      },
      durationMs,
    );
  }, [durationMs]);

  return (
    <View style={styles.progressTrack}>
      <Animatable.View
        ref={barRef}
        style={styles.progressBar}
        useNativeDriver
      />
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function GitPushToast() {
  const notifications = useGitStore(s => s.notifications);

  // Show only the first pending notification
  const current = notifications[0];
  if (!current) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <ToastCard key={current.id} item={current} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 12,
    zIndex: 999,
  },

  card: {
    width: 320,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 12,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs + 2,
    paddingBottom: 0,
    overflow: 'hidden',
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pushIcon: {
    fontFamily: FONTS.mono,
    color: COLORS.amber,
    fontSize: 11,
    marginRight: 5,
  },
  pushLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.amber,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },
  topSpacer: { flex: 1 },
  repoText: {
    fontFamily: FONTS.mono,
    color: COLORS.cyan,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  branchIcon: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 11,
    marginRight: 4,
  },
  branchText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: 10,
    letterSpacing: 0.5,
    marginRight: 6,
  },
  commitCountText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 9,
    letterSpacing: 0.5,
  },

  msgText: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  authorText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },

  progressTrack: {
    height: 2,
    backgroundColor: COLORS.greenFaint,
    marginHorizontal: -SPACING.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: 2,
    backgroundColor: COLORS.green,
    width: '100%',
    transformOrigin: 'left',
  },
});
