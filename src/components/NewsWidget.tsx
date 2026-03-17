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
import PulseText from './PulseText';
import { COLORS, FONTS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Category color map
const CAT_COLORS: Record<string, string> = {
  'AI':   COLORS.cyan,
  '기술': COLORS.greenBright,
  '연예': '#ff69b4',
  '정치': COLORS.amber,
  '경제': '#ffd700',
  '사회': '#ff6b35',
  '국제': COLORS.greenDim,
};

function CategoryBadge({ cat }: { cat?: string }) {
  if (!cat) return null;
  const color = CAT_COLORS[cat] ?? COLORS.greenDim;
  return (
    <View style={[styles.catBadge, { borderColor: color }]}>
      <Text style={[styles.catText, { color }]}>{cat}</Text>
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

  // Auto-scroll every 5 seconds
  useInterval(() => {
    if (!autoScroll || userScrolling.current || items.length === 0) return;
    scrollYRef.current += 88;
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
    ? new Date(lastFetched).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  if (isLoading && items.length === 0) {
    return (
      <GlowBox title="◈ AI//NEWS_FEED" style={styles.box}>
        <PulseText style={styles.loading} duration={600}>
          {'> SCANNING FEEDS...'}
        </PulseText>
      </GlowBox>
    );
  }

  if (error && items.length === 0) {
    return (
      <GlowBox title="◈ AI//NEWS_FEED" style={styles.box}>
        <Text style={styles.error}>{`> ERR: ${error}`}</Text>
      </GlowBox>
    );
  }

  return (
    <GlowBox title="◈ AI//NEWS_FEED" titleRight={`${items.length} ITEMS`} style={styles.box}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
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
                {/* Thumbnail */}
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
                  {/* Category + meta row */}
                  <View style={styles.metaTop}>
                    <CategoryBadge cat={item.category} />
                    {item.source && item.source !== 'HN' && (
                      <Text style={styles.sourceText}>{item.source}</Text>
                    )}
                    <Text style={styles.metaTime}>{formatRelativeTime(item.created_at)}</Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

                  {/* Points & comments (HN only) */}
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
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  loading: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.sm },
  error: { fontFamily: FONTS.mono, color: COLORS.red, fontSize: FONTS.sizes.sm },

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
});
