import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Animatable from 'react-native-animatable';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { useNewsStore } from '@/store/useNewsStore';
import { useCommunityStore } from '@/store/useCommunityStore';
import { formatRelativeTime } from '@/utils/formatters';
import GlowBox from './GlowBox';
import PulseText from './PulseText';
import { COLORS, FONTS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';
import { fetchSentryData, SentryData } from '@/api/sentryApi';
import { CommunityFeedItem } from '@/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  if (!iso) return '?';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function sentryIcon(level: string): [string, string] {
  switch (level) {
    case 'fatal':   return ['☠', COLORS.red];
    case 'error':   return ['✗', COLORS.red];
    case 'warning': return ['!', COLORS.amber];
    default:        return ['i', COLORS.greenDim];
  }
}

// ── Category color map ────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  'AI':   COLORS.cyan,
  '기술': COLORS.greenBright,
  '연예': '#ff69b4',
  '정치': COLORS.amber,
  '경제': '#ffd700',
  '사회': '#ff6b35',
  '국제': COLORS.greenDim,
  // Community categories
  '회사생활': COLORS.greenBright,
  '개발':     COLORS.cyan,
  '연봉':     '#ffd700',
  '이직':     COLORS.amber,
  '스타트업': '#ff6b35',
  '취업':     '#b39ddb',
  '기술면접': COLORS.green,
  '연애/결혼': '#ff69b4',
};

const SOURCE_COLORS: Record<string, string> = {
  BLIND:    '#ff6b35',
  REMEMBER: '#4fc3f7',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryBadge({ cat }: { cat?: string }) {
  if (!cat) return null;
  const color = CAT_COLORS[cat] ?? COLORS.greenDim;
  return (
    <View style={[styles.catBadge, { borderColor: color }]}>
      <Text style={[styles.catText, { color }]}>{cat}</Text>
    </View>
  );
}

function SentrySection({ title }: { title: string }) {
  return (
    <View style={styles.sentrySectionRow}>
      <Text style={styles.sentrySectionTitle}>{title}</Text>
      <View style={styles.sentrySectionLine} />
    </View>
  );
}

function SentryDivider() {
  return <View style={styles.sentryDivider} />;
}

function SentryIssueItem({ item }: { item: SentryData['issues'][0] }) {
  const [icon, iconColor] = sentryIcon(item.level);
  const age   = relTime(item.lastSeen);
  const title = item.title.length > 34 ? `${item.title.slice(0, 33)}…` : item.title;
  const proj  = item.project.length > 14 ? `${item.project.slice(0, 13)}…` : item.project;
  return (
    <View style={styles.sentryItem}>
      <View style={styles.sentryItemHeader}>
        <Text style={[styles.sentryIcon, { color: iconColor }]}>{icon}</Text>
        <Text style={styles.sentryProject}>{`[${proj}]`}</Text>
        <Text style={styles.sentryAge}>{age}</Text>
      </View>
      <Text style={[styles.sentryTitle, { color: iconColor }]} numberOfLines={1}>{title}</Text>
      <Text style={styles.sentryMeta}>{`${item.eventCount} events · ${item.userCount} users`}</Text>
    </View>
  );
}

// ── Community Feed Page ───────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  '리멤버': '#4fc3f7',
  '블라인드': '#ff6b35',
  '네이트판': COLORS.amber,
};

const COMMUNITY_REFRESH_MS = 15 * 60 * 1000; // 15 minutes

function CommunityFeedPage({ width, height }: { width: number; height: number }) {
  const posts     = useCommunityStore(s => s.items);
  const isLoading = useCommunityStore(s => s.isLoading);
  const hasError  = useCommunityStore(s => s.hasError);
  const fetchedAt = useCommunityStore(s => s.fetchedAt);
  const fetch     = useCommunityStore(s => s.fetch);

  const [index, setIndex] = useState(0);
  // Tracks last user interaction (touch/swipe) time — resets 15-min auto-refresh clock
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
        if (g.dy < -40)      goNextRef.current();
        else if (g.dy > 40)  goPrevRef.current();
      },
    }),
  ).current;

  // Auto-refresh: check every 30 s — if no interaction for 15 min, fetch new data
  useInterval(() => {
    if (Date.now() - lastInteractionRef.current >= COMMUNITY_REFRESH_MS) {
      lastInteractionRef.current = Date.now(); // reset so we don't re-trigger immediately
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
      {/* ── Header bar ── */}
      <View style={styles.commHeader}>
        <View style={styles.commHeaderLeft}>
          <View style={[styles.sourceBadge, { borderColor: platformColor }]}>
            <Text style={[styles.sourceText2, { color: platformColor }]}>{post.platform || '?'}</Text>
          </View>
          {post.category ? (
            <View style={[styles.catBadge, { borderColor: catColor }]}>
              <Text style={[styles.catText, { color: catColor }]}>{post.category}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.commHeaderRight}>
          {dateStr && <Text style={styles.commPos}>{dateStr}</Text>}
          <Text style={styles.commPos}>{posStr}</Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={isLoading}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[styles.refreshIcon, isLoading && styles.refreshIconDim]}>{'⟳'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={styles.commDivider} />

      {/* ── Post content ── */}
      <View style={styles.commBodyWrapper}>
        <Animated.View key={`post-${clampedIndex}`} entering={FadeInDown.duration(300)} style={styles.commBody}>
          <Text style={styles.commTitle}>{post.title}</Text>
          <View style={styles.commBodyDivider} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.commScroll}
            nestedScrollEnabled
            onTouchStart={resetInteraction}>
            <Text style={styles.commContent}>{post.summary || '(내용 없음)'}</Text>
          </ScrollView>
        </Animated.View>
      </View>

      {/* ── Stats bar ── */}
      <View style={styles.commDivider} />
      <View style={styles.commStats}>
        <Text style={styles.commStat}>{`◎ ${post.views.toLocaleString()}`}</Text>
        <Text style={styles.commStatSep}> · </Text>
        <Text style={styles.commStat}>{`▸ ${post.comments.toLocaleString()}`}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.commTime}>{`SYNC ${syncStr}`}</Text>
      </View>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NewsWidget() {
  const nav = useNavigation<NavProp>();
  const { items, isLoading, error, fetch, lastFetched } = useNewsStore();

  // ── News scroll state ──
  const scrollRef    = useRef<ScrollView>(null);
  const scrollYRef   = useRef(0);
  const userScrolling = useRef(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // ── Sentry state ──
  const [sentryData,    setSentryData]    = useState<SentryData | null>(null);
  const [sentryLoading, setSentryLoading] = useState(true);
  const [sentryError,   setSentryError]   = useState(false);
  const sentryFetchedRef = useRef(0);

  // ── Paging state (now 3 pages: 0=News, 1=Community, 2=Sentry) ──
  const [page, setPage]           = useState(0);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  const hScrollRef = useRef<ScrollView>(null);

  // ── Initial fetches ──
  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { loadSentryData(); }, []);

  async function loadSentryData() {
    try {
      setSentryLoading(true);
      setSentryError(false);
      const data = await fetchSentryData();
      setSentryData(data);
    } catch {
      setSentryError(true);
    } finally {
      setSentryLoading(false);
    }
  }

  // ── Auto-scroll news every 5 s ──
  useInterval(() => {
    if (!autoScroll || userScrolling.current || items.length === 0 || page !== 0) return;
    scrollYRef.current += 88;
    scrollRef.current?.scrollTo({ y: scrollYRef.current, animated: true });
  }, 5000);

  // ── Sentry refresh every 60 s ──
  useInterval(() => {
    sentryFetchedRef.current += 1;
    if (sentryFetchedRef.current >= 60) {
      sentryFetchedRef.current = 0;
      loadSentryData();
    }
  }, 1000);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const contentH = e.nativeEvent.contentSize.height;
    const layoutH  = e.nativeEvent.layoutMeasurement.height;
    if (y + layoutH >= contentH - 10) {
      scrollYRef.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } else {
      scrollYRef.current = y;
    }
  };

  const openUrl = (url: string | null, objectID: string, title: string) => {
    const target = url ?? `https://news.ycombinator.com/item?id=${objectID}`;
    nav.navigate('WebView', { url: target, title });
  };

  // ── Derived values ──
  const lastSyncStr = lastFetched
    ? new Date(lastFetched).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  const sentryFetchedStr = sentryData
    ? `SYNC ${String(sentryData.fetchedAt.getHours()).padStart(2,'0')}:${String(sentryData.fetchedAt.getMinutes()).padStart(2,'0')}`
    : 'SYNCING…';

  const PAGE_TITLES = ['◈ AI//NEWS_FEED', '◈ COMMUNITY::FEED', '◈ SENTRY::ERR_LOG'];
  const pageTitle   = PAGE_TITLES[page] ?? PAGE_TITLES[0];

  return (
    <GlowBox title={pageTitle} style={styles.box} noPadding>
      <View
        style={{ flex: 1 }}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setPanelSize({ width, height });
        }}>

        {panelSize.width > 0 && (
          <ScrollView
            ref={hScrollRef}
            horizontal
            pagingEnabled
            scrollEventThrottle={200}
            onMomentumScrollEnd={e => {
              const p = Math.round(e.nativeEvent.contentOffset.x / panelSize.width);
              setPage(p);
            }}
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}>

            {/* ══════════════ PAGE 0 · AI//NEWS_FEED ══════════════ */}
            <View style={{ width: panelSize.width, height: panelSize.height }}>
              {isLoading && items.length === 0 ? (
                <View style={styles.centerPad}>
                  <PulseText style={styles.loadingText} duration={600}>
                    {'> SCANNING FEEDS...'}
                  </PulseText>
                </View>
              ) : error && items.length === 0 ? (
                <View style={styles.centerPad}>
                  <Text style={styles.errorText}>{`> ERR: ${error}`}</Text>
                </View>
              ) : (
                <ScrollView
                  ref={scrollRef}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.newsContent}
                  onScrollEndDrag={() => { userScrolling.current = false; }}
                  onScrollBeginDrag={() => { userScrolling.current = true; setAutoScroll(false); }}
                  onMomentumScrollEnd={handleScrollEnd}>

                  {items.map((item, idx) => (
                    <TouchableOpacity
                      key={item.objectID}
                      onPress={() => openUrl(item.url, item.objectID, item.title)}
                      activeOpacity={0.7}>
                      <View style={styles.itemContainer}>
                        <View style={styles.itemRow}>
                          {item.thumbnail ? (
                            <Image
                              source={{ uri: item.thumbnail }}
                              style={styles.thumbnail}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.thumbnailPlaceholder}>
                              <Text style={styles.thumbIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                            </View>
                          )}
                          <View style={styles.itemContent}>
                            <View style={styles.metaTop}>
                              <CategoryBadge cat={item.category} />
                              {item.source && item.source !== 'HN' && (
                                <Text style={styles.sourceText}>{item.source}</Text>
                              )}
                              <Text style={styles.metaTime}>{formatRelativeTime(item.created_at)}</Text>
                            </View>
                            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                            {item.points > 0 && (
                              <View style={styles.metaBottom}>
                                <Text style={styles.metaText}>{`▲ ${item.points}`}</Text>
                                <Text style={styles.metaSep}> · </Text>
                                <Text style={styles.metaText}>{`${item.num_comments} CMT`}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.divider} />
                      </View>
                    </TouchableOpacity>
                  ))}

                  <Text style={styles.sync}>{`SYNC: ${lastSyncStr} [AUTO-REFRESH]`}</Text>
                  <View style={{ height: SPACING.lg }} />
                </ScrollView>
              )}
            </View>

            {/* ══════════════ PAGE 1 · COMMUNITY::FEED ══════════════ */}
            <CommunityFeedPage width={panelSize.width} height={panelSize.height} />

            {/* ══════════════ PAGE 2 · SENTRY::ERR_LOG ══════════════ */}
            <View style={{ width: panelSize.width, height: panelSize.height }}>
              {sentryLoading && !sentryData ? (
                <View style={styles.centerPad}>
                  <PulseText style={styles.loadingText} duration={600}>
                    {'> SCANNING SENTRY...'}
                  </PulseText>
                </View>
              ) : sentryError && !sentryData ? (
                <View style={styles.centerPad}>
                  <Text style={styles.errorText}>{'> ERR: SENTRY UNREACHABLE'}</Text>
                </View>
              ) : sentryData ? (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.sentryContent}>

                  {/* ── STATS ── */}
                  <SentrySection title="STATS" />
                  <View style={styles.sentryStatsRow}>
                    <View style={styles.sentryStatCell}>
                      <Text style={styles.sentryStatLabel}>UNRESOLVED</Text>
                      <Text style={[
                        styles.sentryStatValue,
                        { color: sentryData.stats.unresolvedCount > 0 ? COLORS.red : COLORS.green },
                      ]}>
                        {String(sentryData.stats.unresolvedCount)}
                      </Text>
                    </View>
                    <View style={styles.sentryStatCell}>
                      <Text style={styles.sentryStatLabel}>PROJECTS</Text>
                      <Text style={[styles.sentryStatValue, { color: COLORS.cyan }]}>
                        {String(sentryData.stats.projectCount)}
                      </Text>
                    </View>
                    <View style={styles.sentryStatCell}>
                      <Text style={styles.sentryStatLabel}>TOTAL</Text>
                      <Text style={[styles.sentryStatValue, { color: COLORS.greenDim }]}>
                        {String(sentryData.issues.length)}
                      </Text>
                    </View>
                  </View>

                  <SentryDivider />

                  {/* ── ISSUES ── */}
                  <SentrySection title="OPEN ISSUES" />

                  {sentryData.issues.length === 0 ? (
                    <Text style={styles.sentryEmptyText}>✓ NO OPEN ISSUES</Text>
                  ) : (
                    sentryData.issues.map(issue => (
                      <SentryIssueItem key={issue.id} item={issue} />
                    ))
                  )}

                  <SentryDivider />

                  {/* ── FOOTER ── */}
                  <Text style={styles.sentrySync}>{sentryFetchedStr} [60s]</Text>
                  <View style={{ height: SPACING.lg }} />
                </ScrollView>
              ) : null}
            </View>

          </ScrollView>
        )}
      </View>
    </GlowBox>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box: { flex: 1 },

  centerPad: {
    flex: 1,
    padding: SPACING.sm,
  },
  loadingText: {
    fontFamily: FONTS.mono,
    color: COLORS.amber,
    fontSize: FONTS.sizes.sm,
  },
  errorText: {
    fontFamily: FONTS.mono,
    color: COLORS.red,
    fontSize: FONTS.sizes.sm,
  },

  // ── News page ──────────────────────────────────────────────────────────────
  newsContent: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
  },

  itemContainer: { marginBottom: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },

  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.greenFaint,
    marginRight: SPACING.xs,
    flexShrink: 0,
  },
  thumbnailPlaceholder: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.greenFaint,
    marginRight: SPACING.xs,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,255,65,0.04)',
  },
  thumbIdx: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: FONTS.sizes.xs,
  },

  itemContent: { flex: 1 },

  metaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: 4,
  },
  catBadge: {
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  catText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  sourceText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 10,
    flex: 1,
  },
  metaTime: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 10,
    marginLeft: 'auto',
  },

  title: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: FONTS.sizes.xs,
    lineHeight: 18,
    marginBottom: 2,
  },

  metaBottom: {
    flexDirection: 'row',
    marginTop: 2,
  },
  metaText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  metaSep: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 10,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
    marginVertical: SPACING.xs,
    opacity: 0.4,
  },
  sync: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1,
    marginTop: SPACING.xs,
  },

  // ── Community Feed page ────────────────────────────────────────────────────
  commHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  commHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  commHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceBadge: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  sourceText2: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  commPos: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  refreshBtn: {
    padding: 2,
  },
  refreshIcon: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 16,
    fontWeight: '700',
  },
  refreshIconDim: {
    opacity: 0.3,
  },

  commDivider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
    opacity: 0.4,
    marginHorizontal: SPACING.sm,
  },

  commBodyWrapper: {
    flex: 1,
  },
  commBody: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  commTitle: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: SPACING.xs,
  },
  commBodyDivider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
    opacity: 0.3,
    marginBottom: SPACING.sm,
  },
  commScroll: {
    flex: 1,
  },
  commContent: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  commStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  commStat: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  commStatSep: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 10,
    marginHorizontal: 2,
  },
  commTime: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 9,
    letterSpacing: 0.3,
  },

  // ── Sentry page ────────────────────────────────────────────────────────────
  sentryContent: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
  },

  sentrySectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  sentrySectionTitle: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 9,
    letterSpacing: 2,
    marginRight: 6,
  },
  sentrySectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.greenFaint,
    opacity: 0.4,
  },
  sentryDivider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
    marginVertical: 4,
    opacity: 0.3,
  },

  sentryStatsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  sentryStatCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.greenFaint,
    marginHorizontal: 2,
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  sentryStatLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 2,
  },
  sentryStatValue: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  sentryItem: {
    marginBottom: 6,
  },
  sentryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  sentryIcon: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    width: 16,
    fontWeight: '700',
  },
  sentryProject: {
    fontFamily: FONTS.mono,
    color: COLORS.cyan,
    fontSize: 9,
    letterSpacing: 0.5,
    flex: 1,
  },
  sentryAge: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 9,
    marginLeft: 4,
  },
  sentryTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.3,
    paddingLeft: 16,
    marginBottom: 1,
  },
  sentryMeta: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 9,
    paddingLeft: 16,
    letterSpacing: 0.3,
  },

  sentryEmptyText: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  sentrySync: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: SPACING.xs,
  },
});
