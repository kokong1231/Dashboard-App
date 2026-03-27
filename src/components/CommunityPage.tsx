import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useCommunityStore } from '@/store/useCommunityStore';
import { CommunityFeedItem } from '@/types';
import PulseText from './PulseText';
import { COLORS, FONTS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';

// ── Constants ─────────────────────────────────────────────────────────────────

const COMMUNITY_REFRESH_MS = 15 * 60 * 1000;

const CAT_COLORS: Record<string, string> = {
  '회사생활': COLORS.greenBright,
  '개발':     COLORS.cyan,
  '연봉':     '#ffd700',
  '이직':     COLORS.amber,
  '스타트업': '#ff6b35',
  '취업':     '#b39ddb',
  '기술면접': COLORS.green,
  '연애/결혼': '#ff69b4',
};

const PLATFORM_COLORS: Record<string, string> = {
  '리멤버': '#4fc3f7',
  '블라인드': '#ff6b35',
  '네이트판': COLORS.amber,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommunityPage({ width, height }: { width: number; height: number }) {
  const posts     = useCommunityStore(s => s.items);
  const isLoading = useCommunityStore(s => s.isLoading);
  const hasError  = useCommunityStore(s => s.hasError);
  const fetchedAt = useCommunityStore(s => s.fetchedAt);
  const fetch     = useCommunityStore(s => s.fetch);

  const [index, setIndex] = useState(0);
  const lastInteractionRef = useRef(Date.now());

  const resetInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  const handleRefresh = useCallback(() => {
    resetInteraction();
    fetch();
  }, [fetch, resetInteraction]);

  const goNext = useCallback(() => {
    resetInteraction();
    setIndex(i => (i + 1) % Math.max(posts.length, 1));
  }, [posts.length, resetInteraction]);

  const goPrev = useCallback(() => {
    resetInteraction();
    setIndex(i => (i - 1 + Math.max(posts.length, 1)) % Math.max(posts.length, 1));
  }, [posts.length, resetInteraction]);

  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);
  useEffect(() => { goPrevRef.current = goPrev; }, [goPrev]);

  const swipePanel = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40)     goNextRef.current();
        else if (g.dy > 40) goPrevRef.current();
      },
    }),
  ).current;

  useInterval(() => {
    if (Date.now() - lastInteractionRef.current >= COMMUNITY_REFRESH_MS) {
      lastInteractionRef.current = Date.now();
      fetch();
    }
  }, 30000);

  const syncStr = fetchedAt
    ? `${String(fetchedAt.getHours()).padStart(2, '0')}:${String(fetchedAt.getMinutes()).padStart(2, '0')} [15m]`
    : '--:-- [15m]';

  if (isLoading && posts.length === 0) {
    return (
      <View style={[{ width, height }, styles.centerPad]}>
        <PulseText style={styles.loadingText} duration={600}>{'> LOADING FEED...'}</PulseText>
      </View>
    );
  }
  if (hasError && posts.length === 0) {
    return (
      <View style={[{ width, height }, styles.centerPad]}>
        <Text style={styles.errorText}>{'> ERR: NOTION UNREACHABLE'}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Text style={styles.refreshIcon}>{'⟳'}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (posts.length === 0) {
    return (
      <View style={[{ width, height }, styles.centerPad]}>
        <Text style={styles.errorText}>{'> NO ITEMS'}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Text style={styles.refreshIcon}>{'⟳'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const clampedIndex = Math.min(index, posts.length - 1);
  const post: CommunityFeedItem = posts[clampedIndex];
  const platformColor = PLATFORM_COLORS[post.platform] ?? COLORS.greenDim;
  const catColor      = CAT_COLORS[post.category] ?? COLORS.greenDim;
  const posStr        = `${clampedIndex + 1} / ${posts.length}`;
  const dateStr       = post.writtenAt ? post.writtenAt.slice(0, 10).replace(/-/g, '.') : null;

  return (
    <View style={{ width, height }} {...swipePanel.panHandlers}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.sourceBadge, { borderColor: platformColor }]}>
            <Text style={[styles.sourceText, { color: platformColor }]}>{post.platform || '?'}</Text>
          </View>
          {post.category ? (
            <View style={[styles.catBadge, { borderColor: catColor }]}>
              <Text style={[styles.catText, { color: catColor }]}>{post.category}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          {dateStr && <Text style={styles.pos}>{dateStr}</Text>}
          <Text style={styles.pos}>{posStr}</Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={isLoading}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[styles.refreshIcon, isLoading && styles.refreshIconDim]}>{'⟳'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bodyWrapper}>
        <Animated.View key={`post-${clampedIndex}`} entering={FadeInDown.duration(300)} style={styles.body}>
          <Text style={styles.title}>{post.title}</Text>
          <View style={styles.bodyDivider} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
            nestedScrollEnabled
            onTouchStart={resetInteraction}>
            <Text style={styles.content}>{post.summary || '(내용 없음)'}</Text>
          </ScrollView>
        </Animated.View>
      </View>

      <View style={styles.divider} />
      <View style={styles.stats}>
        <Text style={styles.stat}>{`◎ ${post.views.toLocaleString()}`}</Text>
        <Text style={styles.statSep}> · </Text>
        <Text style={styles.stat}>{`▸ ${post.comments.toLocaleString()}`}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.syncText}>{`SYNC ${syncStr}`}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centerPad: { flex: 1, padding: SPACING.sm },
  loadingText: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.sm },
  errorText:   { fontFamily: FONTS.mono, color: COLORS.red, fontSize: FONTS.sizes.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  sourceBadge: { borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 2 },
  sourceText:  { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1, fontWeight: '700' },

  catBadge: { borderWidth: 1, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 },
  catText:  { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 },

  pos:            { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 9, letterSpacing: 0.5 },
  refreshBtn:     { padding: 2 },
  refreshIcon:    { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 16, fontWeight: '700' },
  refreshIconDim: { opacity: 0.3 },

  divider:     { height: 1, backgroundColor: COLORS.greenFaint, opacity: 0.4, marginHorizontal: SPACING.sm },
  bodyWrapper: { flex: 1 },
  body:        { flex: 1, paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm },

  title: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: SPACING.xs,
  },
  bodyDivider: { height: 1, backgroundColor: COLORS.greenFaint, opacity: 0.3, marginBottom: SPACING.sm },
  scroll:      { flex: 1 },
  content:     { fontFamily: FONTS.mono, color: COLORS.green, fontSize: 12, lineHeight: 20, letterSpacing: 0.2 },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  stat:     { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 10, letterSpacing: 0.5 },
  statSep:  { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 10, marginHorizontal: 2 },
  syncText: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 9, letterSpacing: 0.3 },
});
