import React, { useEffect, useRef, useState } from 'react';
import {
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

  // Auto-scroll every 4 seconds
  useInterval(() => {
    if (!autoScroll || userScrolling.current || items.length === 0) return;
    scrollYRef.current += 72;
    scrollRef.current?.scrollTo({ y: scrollYRef.current, animated: true });
  }, 4000);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const contentH = e.nativeEvent.contentSize.height;
    const layoutH = e.nativeEvent.layoutMeasurement.height;
    if (y + layoutH >= contentH - 10) {
      // Reached bottom - reset
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
              <View style={styles.itemHeader}>
                <Text style={styles.idx}>{String(idx + 1).padStart(2, '0')}.</Text>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{`▲ ${item.points}`}</Text>
                <Text style={styles.metaSep}> · </Text>
                <Text style={styles.metaText}>{formatRelativeTime(item.created_at)}</Text>
                <Text style={styles.metaSep}> · </Text>
                <Text style={styles.metaText}>{`${item.num_comments} CMT`}</Text>
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
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  idx: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    width: 22,
    marginTop: 2,
  },
  title: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: FONTS.sizes.xs,
    flex: 1,
    lineHeight: 16,
  },
  meta: {
    flexDirection: 'row',
    marginLeft: 22,
    marginTop: 2,
  },
  metaText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  metaSep: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 11,
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
