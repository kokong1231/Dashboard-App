import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GlowBox from './GlowBox';
import KeyCombo from './Keycap';
import {
  countShortcuts,
  SHORTCUT_PROGRAMS,
  ShortcutCategory,
  ShortcutProgram,
  TOTAL_SHORTCUT_COUNT,
} from '@/constants/shortcuts';
import { COLORS, FONTS, RADIUS, SPACING } from '@/theme';

// ── 카테고리 한 덩어리 ────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: ShortcutCategory;
  accent: string;
  accentDim: string;
}

function CategoryHeader({ category, accent, accentDim }: CategorySectionProps) {
  return (
    <View style={styles.catHeader}>
      <View style={[styles.catBar, { backgroundColor: accent }]} />
      <Text style={styles.catIcon}>{category.icon}</Text>
      <Text style={styles.catTitle} numberOfLines={1}>
        {category.title}
      </Text>
      <View style={[styles.catCount, { backgroundColor: accentDim, borderColor: accent }]}>
        <Text style={[styles.catCountText, { color: accent }]}>{category.items.length}</Text>
      </View>
    </View>
  );
}

function CategoryBody({ category, accent }: Omit<CategorySectionProps, 'accentDim'>) {
  return (
    <View style={styles.catBody}>
      {category.items.map((item, i) => (
        <View
          key={`${category.id}-${item.keys}-${i}`}
          style={[styles.row, i % 2 === 1 && styles.rowAlt]}
        >
          <View style={styles.rowKeys}>
            <KeyCombo keys={item.keys} accent={accent} />
          </View>
          <Text style={styles.rowDesc} numberOfLines={2}>
            {item.desc}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── 프로그램 한 페이지 (세로 스크롤) ──────────────────────────────────────────

interface ProgramPageProps {
  program: ShortcutProgram;
  width: number;
}

function ProgramPage({ program, width }: ProgramPageProps) {
  // 헤더 / 본문을 번갈아 넣고, 헤더 인덱스만 sticky 로 지정한다.
  const stickyIndices = useMemo(
    () => program.categories.map((_, i) => i * 2),
    [program.categories],
  );

  return (
    <View style={[styles.page, { width }]}>
      <ScrollView
        style={styles.vScroll}
        contentContainerStyle={styles.vScrollContent}
        stickyHeaderIndices={stickyIndices}
        nestedScrollEnabled
        directionalLockEnabled
        showsVerticalScrollIndicator
        overScrollMode="never"
        scrollEventThrottle={16}
      >
        {program.categories.flatMap(category => [
          <CategoryHeader
            key={`${category.id}-h`}
            category={category}
            accent={program.color}
            accentDim={program.colorDim}
          />,
          <CategoryBody key={`${category.id}-b`} category={category} accent={program.color} />,
        ])}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>
            {program.name} · 단축키 {countShortcuts(program)}개
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── 위젯 ──────────────────────────────────────────────────────────────────────

export default function ShortcutWidget() {
  const [pageWidth, setPageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  const onPagerLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setPageWidth(e.nativeEvent.layout.width);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setActiveIndex(prev =>
        next !== prev && next >= 0 && next < SHORTCUT_PROGRAMS.length ? next : prev,
      );
    },
    [pageWidth],
  );

  const goTo = useCallback(
    (index: number) => {
      if (pageWidth <= 0) return;
      pagerRef.current?.scrollTo({ x: index * pageWidth, y: 0, animated: true });
      setActiveIndex(index);
    },
    [pageWidth],
  );

  const active = SHORTCUT_PROGRAMS[activeIndex] ?? SHORTCUT_PROGRAMS[0];

  return (
    <GlowBox title="SHORTCUT KEYS" titleRight={`${TOTAL_SHORTCUT_COUNT} keys`} noPadding>
      {/* 프로그램 탭 */}
      <View style={styles.tabs}>
        {SHORTCUT_PROGRAMS.map((program, i) => {
          const on = i === activeIndex;
          return (
            <TouchableOpacity
              key={program.id}
              style={[
                styles.tab,
                on && { borderColor: program.color, backgroundColor: program.colorDim },
              ]}
              activeOpacity={0.75}
              onPress={() => goTo(i)}
            >
              <View
                style={[
                  styles.tabMark,
                  { borderColor: on ? program.color : COLORS.border },
                  on && { backgroundColor: program.color },
                ]}
              >
                <Text
                  style={[styles.tabMarkText, { color: on ? COLORS.background : COLORS.textHint }]}
                >
                  {program.mark}
                </Text>
              </View>
              <Text
                style={[styles.tabLabel, on && { color: program.color, fontWeight: '700' }]}
                numberOfLines={1}
              >
                {program.shortName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 가로 캐러셀 — 각 페이지 안은 세로 스크롤 */}
      <View style={styles.pager} onLayout={onPagerLayout}>
        {pageWidth > 0 && (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            directionalLockEnabled
            disableIntervalMomentum
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            overScrollMode="never"
            bounces={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            onMomentumScrollEnd={onScroll}
          >
            {SHORTCUT_PROGRAMS.map(program => (
              <ProgramPage key={program.id} program={program} width={pageWidth} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* 하단 인디케이터 */}
      <View style={styles.footer}>
        <Text style={styles.hint}>← 좌우로 밀어 프로그램 전환 · 위아래로 스크롤 ↓</Text>
        <View style={styles.dots}>
          {SHORTCUT_PROGRAMS.map((program, i) => (
            <View
              key={program.id}
              style={[
                styles.dot,
                i === activeIndex && [
                  styles.dotActive,
                  { backgroundColor: active.color, borderColor: active.color },
                ],
              ]}
            />
          ))}
        </View>
      </View>
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  // 탭
  tabs: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: 6,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.backgroundAlt,
  },
  tabMark: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabMarkText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '700',
  },
  tabLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: COLORS.textHint,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // 캐러셀
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  vScroll: {
    flex: 1,
  },
  vScrollContent: {
    paddingBottom: SPACING.sm,
  },

  // 카테고리
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.divider,
  },
  catBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  catIcon: {
    fontSize: 12,
  },
  catTitle: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  catCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  catCountText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  catBody: {
    paddingHorizontal: SPACING.xs,
    paddingTop: 2,
    paddingBottom: SPACING.xs,
  },

  // 단축키 한 줄
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 4,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.sm - 2,
  },
  rowAlt: {
    backgroundColor: COLORS.backgroundAlt,
  },
  rowKeys: {
    flex: 47,
  },
  rowDesc: {
    flex: 53,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },

  pageFooter: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  pageFooterText: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: COLORS.textDisabled,
  },

  // 하단
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.surfaceElevated,
  },
  hint: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: COLORS.textHint,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.divider,
  },
  dotActive: {
    width: 16,
  },
});
