import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { useNewsStore } from '@/store/useNewsStore';
import { formatRelativeTime } from '@/utils/formatters';
import GlowBox from './GlowBox';
import { COLORS, FONTS, RADIUS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const CAT_STYLES: Record<string, { bg: string; text: string }> = {
  AI: { bg: COLORS.primarySurface, text: COLORS.primaryLighter },
  기술: { bg: COLORS.infoDim, text: COLORS.info },
  연예: { bg: 'rgba(255,105,180,0.15)', text: '#FF69B4' },
  정치: { bg: COLORS.warningDim, text: COLORS.warning },
  경제: { bg: 'rgba(255,215,0,0.12)', text: '#FFD700' },
  사회: { bg: 'rgba(255,107,53,0.12)', text: '#FF6B35' },
  국제: { bg: COLORS.successDim, text: COLORS.success },
};

function CategoryBadge({ cat }: { cat?: string }) {
  if (!cat) return null;
  const style = CAT_STYLES[cat] ?? { bg: COLORS.accentDim, text: COLORS.accent };
  return (
    <View style={[styles.catBadge, { backgroundColor: style.bg }]}>
      <Text style={[styles.catText, { color: style.text }]}>{cat}</Text>
    </View>
  );
}

export default function NewsWidget() {
  const nav = useNavigation<NavProp>();
  const { items, isLoading, error, fetch, lastFetched } = useNewsStore();
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const userScrolling = useRef(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useInterval(() => {
    if (!autoScroll || userScrolling.current || items.length === 0) return;
    scrollYRef.current += 92;
    scrollRef.current?.scrollTo({ y: scrollYRef.current, animated: true });
  }, 5000);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const contentH = e.nativeEvent.contentSize.height;
    const layoutH = e.nativeEvent.layoutMeasurement.height;
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

  const lastSyncStr = lastFetched
    ? new Date(lastFetched).toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

  if (isLoading && items.length === 0) {
    return (
      <GlowBox title="뉴스 피드" style={styles.box}>
        <Text style={styles.loadingText}>피드 불러오는 중...</Text>
      </GlowBox>
    );
  }

  if (error && items.length === 0) {
    return (
      <GlowBox title="뉴스 피드" style={styles.box}>
        <Text style={styles.errorText}>{error}</Text>
      </GlowBox>
    );
  }

  return (
    <GlowBox title="뉴스 피드" titleRight={`${items.length}개`} style={styles.box}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScrollEndDrag={() => {
          userScrolling.current = false;
        }}
        onScrollBeginDrag={() => {
          userScrolling.current = true;
          setAutoScroll(false);
        }}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {items.map((item, idx) => (
          <TouchableOpacity
            key={item.objectID}
            onPress={() => openUrl(item.url, item.objectID, item.title)}
            activeOpacity={0.75}
          >
            <View style={styles.itemCard}>
              {/* Thumbnail / index */}
              {item.thumbnail ? (
                <Image
                  source={{ uri: item.thumbnail }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Text style={styles.thumbIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                </View>
              )}

              <View style={styles.itemContent}>
                <View style={styles.metaRow}>
                  <CategoryBadge cat={item.category} />
                  {item.source && item.source !== 'HN' && (
                    <Text style={styles.sourceText}>{item.source}</Text>
                  )}
                  <Text style={styles.timeText}>{formatRelativeTime(item.created_at)}</Text>
                </View>

                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>

                {item.points > 0 && (
                  <View style={styles.statsRow}>
                    <Text style={styles.statsText}>▲ {item.points}</Text>
                    <Text style={styles.statsDot}> · </Text>
                    <Text style={styles.statsText}>{item.num_comments} 댓글</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.syncText}>업데이트 {lastSyncStr}</Text>
        <View style={{ height: SPACING.lg }} />
      </ScrollView>
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  loadingText: { fontFamily: FONTS.sans, color: COLORS.textHint, fontSize: FONTS.sizes.sm },
  errorText: { fontFamily: FONTS.sans, color: COLORS.error, fontSize: FONTS.sizes.sm },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.sm,
  },

  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    flexShrink: 0,
    backgroundColor: COLORS.surfaceElevated,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thumbIdx: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.textHint,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },

  itemContent: { flex: 1 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 5,
    flexWrap: 'wrap',
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  catText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sourceText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: 10,
    flex: 1,
  },
  timeText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: 10,
    marginLeft: 'auto',
  },

  title: {
    fontFamily: FONTS.sans,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
    marginBottom: 3,
    fontWeight: '500',
  },

  statsRow: { flexDirection: 'row' },
  statsText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: 11,
  },
  statsDot: {
    fontFamily: FONTS.sans,
    color: COLORS.textDisabled,
    fontSize: 11,
  },

  syncText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: 11,
    textAlign: 'right',
    marginTop: SPACING.sm,
  },
});
