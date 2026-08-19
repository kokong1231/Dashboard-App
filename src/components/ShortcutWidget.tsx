import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import ShortcutSearchModal from './ShortcutSearchModal';
import {
  countShortcuts,
  getShortcutId,
  SHORTCUT_INDEX,
  SHORTCUT_INDEX_BY_ID,
  SHORTCUT_PROGRAMS,
  ShortcutProgram,
  TOTAL_SHORTCUT_COUNT,
} from '@/constants/shortcuts';
import { useShortcutStore } from '@/store/useShortcutStore';
import { COLORS, FONTS, RADIUS, SPACING } from '@/theme';

const FAVORITES_CATEGORY_ID = 'favorites';

// ── 렌더링용 단축키 · 카테고리 (즐겨찾기 카테고리를 동일한 모양으로 합성하기 위함) ──────

interface RenderableShortcut {
  id: string;
  keys: string;
  desc: string;
}

interface RenderCategory {
  id: string;
  title: string;
  icon: string;
  items: RenderableShortcut[];
}

// ── 카테고리 한 덩어리 ────────────────────────────────────────────────────────

interface CategoryHeaderProps {
  category: RenderCategory;
  accent: string;
  accentDim: string;
  registerRef: (node: View | null) => void;
}

function CategoryHeader({ category, accent, accentDim, registerRef }: CategoryHeaderProps) {
  return (
    <View ref={registerRef} testID={`shortcut-category-${category.id}`} style={styles.catHeader}>
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

interface CategoryBodyProps {
  category: RenderCategory;
  accent: string;
  favorites: string[];
  highlightedId: string | null;
  onToggleFavorite: (id: string) => void;
  registerItemRef: (id: string, node: View | null) => void;
}

function CategoryBody({
  category,
  accent,
  favorites,
  highlightedId,
  onToggleFavorite,
  registerItemRef,
}: CategoryBodyProps) {
  return (
    <View style={styles.catBody}>
      {category.items.map((item, i) => {
        const isFavorite = favorites.includes(item.id);
        const isHighlighted = item.id === highlightedId;
        return (
          <View
            key={item.id}
            ref={node => registerItemRef(item.id, node)}
            style={[
              styles.row,
              i % 2 === 1 && styles.rowAlt,
              isHighlighted && styles.rowHighlighted,
            ]}
          >
            <View style={styles.rowKeys}>
              <KeyCombo keys={item.keys} accent={accent} />
            </View>
            <Text style={styles.rowDesc} numberOfLines={2}>
              {item.desc}
            </Text>
            <TouchableOpacity
              testID={`shortcut-star-${item.id}`}
              onPress={() => onToggleFavorite(item.id)}
              hitSlop={8}
              style={styles.starButton}
              accessibilityLabel={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              <Text style={[styles.starIcon, isFavorite && styles.starIconActive]}>
                {isFavorite ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

// ── 프로그램 한 페이지 (세로 스크롤) ──────────────────────────────────────────

export interface ProgramPageHandle {
  scrollToTop: () => void;
  scrollToCategory: (categoryId: string) => void;
  scrollToItem: (id: string) => void;
}

interface ProgramPageProps {
  program: ShortcutProgram;
  width: number;
  favorites: string[];
  highlightedId: string | null;
  onToggleFavorite: (id: string) => void;
}

const ProgramPage = forwardRef<ProgramPageHandle, ProgramPageProps>(function ProgramPage(
  { program, width, favorites, highlightedId, onToggleFavorite },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);
  const categoryRefs = useRef<Map<string, View | null>>(new Map());
  const itemRefs = useRef<Map<string, View | null>>(new Map());

  const categories = useMemo<RenderCategory[]>(() => {
    const real: RenderCategory[] = program.categories.map(category => ({
      id: category.id,
      title: category.title,
      icon: category.icon,
      items: category.items.map((item, index) => ({
        id: getShortcutId(program.id, category.id, index),
        keys: item.keys,
        desc: item.desc,
      })),
    }));

    const favoriteItems = SHORTCUT_INDEX.filter(
      entry => entry.programId === program.id && favorites.includes(entry.id),
    );
    if (favoriteItems.length === 0) return real;

    return [
      {
        id: FAVORITES_CATEGORY_ID,
        title: '즐겨찾기',
        icon: '⭐',
        items: favoriteItems.map(entry => ({ id: entry.id, keys: entry.keys, desc: entry.desc })),
      },
      ...real,
    ];
  }, [program, favorites]);

  // 헤더 / 본문을 번갈아 넣고, 헤더 인덱스만 sticky 로 지정한다.
  const stickyIndices = useMemo(() => categories.map((_, i) => i * 2), [categories]);

  const scrollToNode = useCallback((node: View | null) => {
    if (!node || !scrollRef.current) return;
    const target = scrollRef.current.getNativeScrollRef();
    if (!target) return;
    node.measureLayout(
      target,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(y - SPACING.sm, 0), animated: true }),
      () => {},
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
      scrollToCategory: categoryId => scrollToNode(categoryRefs.current.get(categoryId) ?? null),
      scrollToItem: id => scrollToNode(itemRefs.current.get(id) ?? null),
    }),
    [scrollToNode],
  );

  return (
    <View style={[styles.page, { width }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.vScroll}
        contentContainerStyle={styles.vScrollContent}
        stickyHeaderIndices={stickyIndices}
        nestedScrollEnabled
        directionalLockEnabled
        showsVerticalScrollIndicator
        overScrollMode="never"
        scrollEventThrottle={16}
      >
        {categories.flatMap(category => [
          <CategoryHeader
            key={`${category.id}-h`}
            category={category}
            accent={program.color}
            accentDim={program.colorDim}
            registerRef={node => {
              if (node) categoryRefs.current.set(category.id, node);
              else categoryRefs.current.delete(category.id);
            }}
          />,
          <CategoryBody
            key={`${category.id}-b`}
            category={category}
            accent={program.color}
            favorites={favorites}
            highlightedId={highlightedId}
            onToggleFavorite={onToggleFavorite}
            registerItemRef={(id, node) => {
              if (node) itemRefs.current.set(id, node);
              else itemRefs.current.delete(id);
            }}
          />,
        ])}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>
            {program.name} · 단축키 {countShortcuts(program)}개
          </Text>
        </View>
      </ScrollView>
    </View>
  );
});

// ── 위젯 ──────────────────────────────────────────────────────────────────────

export default function ShortcutWidget() {
  const [pageWidth, setPageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const pagerRef = useRef<ScrollView>(null);
  const programRefs = useRef<Array<ProgramPageHandle | null>>([]);

  const favorites = useShortcutStore(s => s.favorites);
  const recentSearches = useShortcutStore(s => s.recentSearches);
  const toggleFavorite = useShortcutStore(s => s.toggleFavorite);
  const addRecentSearch = useShortcutStore(s => s.addRecentSearch);

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

  const activeCategories = useMemo(() => {
    const real = active.categories.map(c => ({ id: c.id, title: c.title, icon: c.icon }));
    const hasFavorites = SHORTCUT_INDEX.some(
      entry => entry.programId === active.id && favorites.includes(entry.id),
    );
    return hasFavorites
      ? [{ id: FAVORITES_CATEGORY_ID, title: '즐겨찾기', icon: '⭐' }, ...real]
      : real;
  }, [active, favorites]);

  const handleOpenSearch = useCallback(() => {
    setHighlightedId(null);
    setSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => setSearchOpen(false), []);

  const handleScrollToTop = useCallback(() => {
    programRefs.current[activeIndex]?.scrollToTop();
  }, [activeIndex]);

  const handleSelectCategory = useCallback(
    (categoryId: string) => {
      setSearchOpen(false);
      programRefs.current[activeIndex]?.scrollToCategory(categoryId);
    },
    [activeIndex],
  );

  const handleSelectShortcut = useCallback(
    (id: string) => {
      const entry = SHORTCUT_INDEX_BY_ID[id];
      if (!entry) return;

      setSearchOpen(false);
      addRecentSearch(id);
      setHighlightedId(id);

      if (entry.programIndex !== activeIndex) {
        goTo(entry.programIndex);
      }
      requestAnimationFrame(() => {
        programRefs.current[entry.programIndex]?.scrollToItem(id);
      });
    },
    [activeIndex, goTo, addRecentSearch],
  );

  const headerExtra = (
    <View style={styles.headerButtons}>
      <TouchableOpacity
        testID="shortcut-search-button"
        onPress={handleOpenSearch}
        style={styles.headerIconButton}
        hitSlop={6}
        accessibilityLabel="단축키 검색"
      >
        <Text style={styles.headerIconText}>🔍</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="shortcut-scrolltop-button"
        onPress={handleScrollToTop}
        style={styles.headerIconButton}
        hitSlop={6}
        accessibilityLabel="맨 위로 이동"
      >
        <Text style={styles.headerIconText}>▲</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <GlowBox
      title="SHORTCUT KEYS"
      titleRight={`${TOTAL_SHORTCUT_COUNT} keys`}
      headerExtra={headerExtra}
      style={styles.box}
      noPadding
    >
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
      <View style={styles.pager} onLayout={onPagerLayout} testID="shortcut-pager">
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
            {SHORTCUT_PROGRAMS.map((program, i) => (
              <ProgramPage
                key={program.id}
                ref={node => {
                  programRefs.current[i] = node;
                }}
                program={program}
                width={pageWidth}
                favorites={favorites}
                highlightedId={highlightedId}
                onToggleFavorite={toggleFavorite}
              />
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

      <ShortcutSearchModal
        visible={searchOpen}
        onClose={handleCloseSearch}
        programId={active.id}
        programName={active.name}
        accent={active.color}
        categories={activeCategories}
        recentIds={recentSearches}
        onSelectCategory={handleSelectCategory}
        onSelectShortcut={handleSelectShortcut}
      />
    </GlowBox>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },

  // 헤더 버튼 (검색 / 맨 위로)
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginRight: SPACING.xs,
  },
  headerIconButton: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },

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
  rowHighlighted: {
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.primarySurface,
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
  starButton: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: {
    fontSize: 14,
    color: COLORS.textHint,
  },
  starIconActive: {
    color: COLORS.primaryLighter,
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
