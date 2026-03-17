import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { useNotionStore } from '@/store/useNotionStore';
import { fetchPageBlocks, queryDatabasePages, richTextToPlain } from '@/api/notionApi';
import { NotionBlock, NotionPageListItem, NotionRichText } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';
import GlowBox from './GlowBox';
import { useInterval } from '@/hooks/useInterval';
import { COLORS, FONTS, RADIUS, SPACING } from '@/theme';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const PAGE_POLL_INTERVAL = 30 * 1000;
const DB_POLL_INTERVAL = 30 * 1000;

type NotionView =
  | { kind: 'home' }
  | { kind: 'database'; id: string; title: string }
  | { kind: 'page'; id: string; title: string; url: string };

function notionColor(c: string | undefined): string {
  if (!c) return COLORS.textPrimary;
  switch (c) {
    case 'red':
    case 'red_background':
      return COLORS.error;
    case 'yellow':
    case 'yellow_background':
      return COLORS.warning;
    case 'blue':
    case 'blue_background':
      return COLORS.info;
    case 'green':
    case 'green_background':
      return COLORS.success;
    case 'purple':
    case 'purple_background':
      return COLORS.primaryLighter;
    case 'gray':
    case 'grey':
      return COLORS.textHint;
    default:
      return COLORS.textPrimary;
  }
}

// ── Rich text renderer ────────────────────────────────────────────────────────

interface RichTextProps {
  richText: NotionRichText[];
  style?: StyleProp<TextStyle>;
  onLinkPress?: (url: string) => void;
}

function RichTextView({ richText, style, onLinkPress }: RichTextProps) {
  if (!richText || richText.length === 0) {
    return <Text style={[styles.baseText, style]}>{'\u200b'}</Text>;
  }
  return (
    <Text style={[styles.baseText, style]}>
      {richText.map((rt, i) => {
        const isLink = !!rt.href && !!onLinkPress;
        const c = notionColor(
          rt.annotations.color !== 'default' ? rt.annotations.color : undefined,
        );
        return (
          <Text
            key={i}
            style={
              [
                rt.annotations.bold && annotStyles.bold,
                rt.annotations.italic && annotStyles.italic,
                rt.annotations.strikethrough && annotStyles.strike,
                rt.annotations.code && annotStyles.code,
                rt.annotations.color !== 'default' && { color: c },
                isLink && styles.link,
              ] as StyleProp<TextStyle>
            }
            onPress={isLink ? () => onLinkPress!(rt.href!) : undefined}
          >
            {rt.plain_text}
          </Text>
        );
      })}
    </Text>
  );
}

// ── Table block ───────────────────────────────────────────────────────────────

function TableBlock({
  block,
  onLinkPress,
}: {
  block: NotionBlock;
  onLinkPress: (url: string) => void;
}) {
  const rows = block.table_children ?? [];
  const hasColHeader = block.table?.has_column_header ?? false;
  const hasRowHeader = block.table?.has_row_header ?? false;
  const colCount = block.table?.table_width ?? rows[0]?.table_row?.cells.length ?? 0;
  if (rows.length === 0) return null;
  return (
    <View style={styles.tableContainer}>
      {rows.map((row, rowIdx) => {
        const cells = row.table_row?.cells ?? [];
        const isColHeader = hasColHeader && rowIdx === 0;
        return (
          <View
            key={row.id}
            style={[
              styles.tableRow,
              isColHeader && styles.tableHeaderRow,
              rowIdx > 0 && rowIdx % 2 === 0 && styles.tableRowAlt,
            ]}
          >
            {cells.map((cell, cellIdx) => {
              const isRowHeader = hasRowHeader && cellIdx === 0;
              return (
                <View
                  key={cellIdx}
                  style={[
                    styles.tableCell,
                    cellIdx < colCount - 1 && styles.tableCellBorder,
                    isRowHeader && styles.tableRowHeaderCell,
                  ]}
                >
                  <RichTextView
                    richText={cell}
                    style={
                      isColHeader || isRowHeader ? styles.tableHeaderText : styles.tableCellText
                    }
                    onLinkPress={onLinkPress}
                  />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ── Block renderer ────────────────────────────────────────────────────────────

interface BlockViewProps {
  block: NotionBlock;
  numberedIdx: number;
  onNavigatePage: (id: string, title: string, url: string) => void;
  onNavigateDb: (id: string, title: string) => void;
  onOpenUrl: (url: string, title?: string) => void;
}

function BlockView({
  block,
  numberedIdx,
  onNavigatePage,
  onNavigateDb,
  onOpenUrl,
}: BlockViewProps) {
  const linkPress = (url: string) => onOpenUrl(url);

  switch (block.type) {
    case 'paragraph':
      return (
        <View style={styles.blockParagraph}>
          <RichTextView richText={block.paragraph!.rich_text} onLinkPress={linkPress} />
        </View>
      );

    case 'heading_1':
      return (
        <View style={styles.blockH1}>
          <View style={styles.h1Line} />
          <RichTextView
            richText={block.heading_1!.rich_text}
            style={styles.h1Text}
            onLinkPress={linkPress}
          />
        </View>
      );

    case 'heading_2':
      return (
        <View style={styles.blockH2}>
          <RichTextView
            richText={block.heading_2!.rich_text}
            style={styles.h2Text}
            onLinkPress={linkPress}
          />
        </View>
      );

    case 'heading_3':
      return (
        <View style={styles.blockH3}>
          <RichTextView
            richText={block.heading_3!.rich_text}
            style={styles.h3Text}
            onLinkPress={linkPress}
          />
        </View>
      );

    case 'bulleted_list_item':
      return (
        <View style={styles.listRow}>
          <View style={styles.bulletDot} />
          <RichTextView
            richText={block.bulleted_list_item!.rich_text}
            style={styles.listText}
            onLinkPress={linkPress}
          />
        </View>
      );

    case 'numbered_list_item':
      return (
        <View style={styles.listRow}>
          <Text style={styles.numberedBullet}>{numberedIdx}.</Text>
          <RichTextView
            richText={block.numbered_list_item!.rich_text}
            style={styles.listText}
            onLinkPress={linkPress}
          />
        </View>
      );

    case 'to_do': {
      const checked = block.to_do!.checked;
      return (
        <View style={styles.listRow}>
          <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
            {checked && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <RichTextView
            richText={block.to_do!.rich_text}
            style={[styles.listText, checked && styles.checkedText]}
            onLinkPress={linkPress}
          />
        </View>
      );
    }

    case 'toggle':
      return (
        <View style={styles.listRow}>
          <Text style={styles.toggleIcon}>▶ </Text>
          <RichTextView
            richText={block.toggle!.rich_text}
            style={styles.listText}
            onLinkPress={linkPress}
          />
        </View>
      );

    case 'code': {
      const code = richTextToPlain(block.code!.rich_text);
      const lang = block.code!.language || '';
      return (
        <View style={styles.codeBlock}>
          {lang ? <Text style={styles.codeLang}>{lang}</Text> : null}
          <Text style={styles.codeText}>{code}</Text>
        </View>
      );
    }

    case 'quote':
      return (
        <View style={styles.quoteBlock}>
          <View style={styles.quoteBorder} />
          <RichTextView
            richText={block.quote!.rich_text}
            style={styles.quoteText}
            onLinkPress={linkPress}
          />
        </View>
      );

    case 'callout': {
      const icon = block.callout?.icon?.emoji ?? '💡';
      return (
        <View style={styles.calloutBlock}>
          <Text style={styles.calloutIcon}>{icon}</Text>
          <RichTextView
            richText={block.callout!.rich_text}
            style={styles.calloutText}
            onLinkPress={linkPress}
          />
        </View>
      );
    }

    case 'divider':
      return <View style={styles.dividerBlock} />;

    case 'table':
      return (
        <View style={styles.tableWrapper}>
          <TableBlock block={block} onLinkPress={linkPress} />
        </View>
      );

    case 'image': {
      const imgUrl =
        block.image?.type === 'external' ? block.image.external?.url : block.image?.file?.url;
      if (!imgUrl) return null;
      const caption = block.image?.caption?.length ? richTextToPlain(block.image.caption) : null;
      return (
        <View style={styles.imageBlock}>
          <Image source={{ uri: imgUrl }} style={styles.image} resizeMode="contain" />
          {caption ? <Text style={styles.imageCaption}>{caption}</Text> : null}
        </View>
      );
    }

    case 'bookmark': {
      const url = block.bookmark!.url;
      const cap = block.bookmark?.caption?.length ? richTextToPlain(block.bookmark.caption) : url;
      return (
        <TouchableOpacity style={styles.bookmarkBlock} onPress={() => onOpenUrl(url, cap)}>
          <Text style={styles.bookmarkIcon}>🔗</Text>
          <Text style={styles.bookmarkUrl} numberOfLines={1}>
            {cap}
          </Text>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      );
    }

    case 'link_preview': {
      const url = block.link_preview!.url;
      return (
        <TouchableOpacity style={styles.bookmarkBlock} onPress={() => onOpenUrl(url)}>
          <Text style={styles.bookmarkIcon}>🌐</Text>
          <Text style={styles.bookmarkUrl} numberOfLines={1}>
            {url}
          </Text>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      );
    }

    case 'embed': {
      const url = block.embed!.url;
      return (
        <TouchableOpacity style={styles.bookmarkBlock} onPress={() => onOpenUrl(url)}>
          <Text style={styles.bookmarkIcon}>⊞</Text>
          <Text style={styles.bookmarkUrl} numberOfLines={1}>
            {url}
          </Text>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      );
    }

    case 'child_page': {
      const title = block.child_page!.title || '(페이지)';
      return (
        <TouchableOpacity
          style={styles.childRow}
          onPress={() => onNavigatePage(block.id, title, '')}
        >
          <Text style={styles.childIcon}>📄</Text>
          <Text style={styles.childTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      );
    }

    case 'child_database': {
      const title = block.child_database!.title || '(데이터베이스)';
      return (
        <TouchableOpacity style={styles.childRow} onPress={() => onNavigateDb(block.id, title)}>
          <Text style={styles.childIcon}>🗄️</Text>
          <Text style={styles.childTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      );
    }

    default:
      return null;
  }
}

// ── Page tree ─────────────────────────────────────────────────────────────────

interface PageTreeItem {
  page: NotionPageListItem;
  depth: number;
  hasChildren: boolean;
}

function buildPageTree(pages: NotionPageListItem[]): PageTreeItem[] {
  const nonDb = pages.filter(p => p.parentType !== 'database_id');
  const allIds = new Set(nonDb.map(p => p.id));
  const childMap = new Map<string, NotionPageListItem[]>();
  nonDb.forEach(p => {
    if (p.parentPageId && allIds.has(p.parentPageId)) {
      const arr = childMap.get(p.parentPageId) ?? [];
      arr.push(p);
      childMap.set(p.parentPageId, arr);
    }
  });
  const roots = nonDb.filter(
    p => p.parentType === 'workspace' || !p.parentPageId || !allIds.has(p.parentPageId),
  );
  roots.sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime());
  const result: PageTreeItem[] = [];
  function dfs(p: NotionPageListItem, depth: number) {
    const children = (childMap.get(p.id) ?? []).sort(
      (a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime(),
    );
    result.push({ page: p, depth, hasChildren: children.length > 0 });
    children.forEach(c => dfs(c, depth + 1));
  }
  roots.forEach(p => dfs(p, 0));
  return result;
}

// ── Property chips ────────────────────────────────────────────────────────────

function PropChips({ page }: { page: NotionPageListItem }) {
  const chips: { label: string; color: string; bg: string }[] = [];

  if (page.dateStart) {
    const d = new Date(page.dateStart);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isPast = d < now && !isToday;
    const color = isPast ? COLORS.error : isToday ? COLORS.warning : COLORS.info;
    chips.push({
      label: isToday
        ? '오늘'
        : `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
      color,
      bg: isPast ? COLORS.errorDim : isToday ? COLORS.warningDim : COLORS.infoDim,
    });
  }
  if (page.status) {
    const c = notionColor(page.statusColor);
    chips.push({ label: page.status, color: c, bg: 'rgba(255,255,255,0.05)' });
  }
  if (page.priority || page.select) {
    const label = (page.priority ?? page.select ?? '').toString();
    const c = notionColor(page.selectColor);
    chips.push({ label, color: c, bg: 'rgba(255,255,255,0.05)' });
  }
  if (page.checked !== undefined) {
    chips.push({
      label: page.checked ? '✓ 완료' : '미완료',
      color: page.checked ? COLORS.success : COLORS.textHint,
      bg: page.checked ? COLORS.successDim : 'rgba(255,255,255,0.04)',
    });
  }
  if (page.tags?.length) {
    page.tags
      .slice(0, 2)
      .forEach(t => chips.push({ label: t, color: COLORS.accent, bg: COLORS.accentDim }));
  }
  if (chips.length === 0) return null;
  return (
    <View style={styles.chipsRow}>
      {chips.map((c, i) => (
        <View key={i} style={[styles.chip, { backgroundColor: c.bg }]}>
          <Text style={[styles.chipText, { color: c.color }]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Home view ─────────────────────────────────────────────────────────────────

function HomeView({
  onNavigatePage,
  onNavigateDb,
}: {
  onNavigatePage: (id: string, title: string, url: string) => void;
  onNavigateDb: (id: string, title: string) => void;
}) {
  const { databases, pages, isLoading, error, fetch, forceRefresh } = useNotionStore();
  const lastFetched = useNotionStore(s => s.lastFetched);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (isLoading && databases.length === 0 && pages.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primaryLight} />
        <Text style={styles.loadingText}>Notion 연결 중...</Text>
      </View>
    );
  }

  if (error && databases.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={forceRefresh} style={styles.retryBtn}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const treeItems = buildPageTree(pages);
  const syncStr = lastFetched
    ? new Date(lastFetched).toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Databases */}
      {databases.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionHeader}>데이터베이스</Text>
            <View style={styles.sectionLine} />
          </View>
          {databases.map(db => (
            <TouchableOpacity
              key={db.id}
              onPress={() => onNavigateDb(db.id, db.title)}
              activeOpacity={0.75}
              style={styles.dbRow}
            >
              <Text style={styles.rowIcon}>{db.emoji ?? '🗄️'}</Text>
              <Text style={styles.dbTitle} numberOfLines={1}>
                {db.title}
              </Text>
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Pages */}
      {treeItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionHeader}>페이지</Text>
            <View style={styles.sectionLine} />
          </View>
          {treeItems.map(({ page, depth, hasChildren }) => {
            const indent = depth * 14;
            const prefix = depth === 0 ? page.emoji ?? '📄' : hasChildren ? '├─' : '└─';
            return (
              <TouchableOpacity
                key={page.id}
                onPress={() => onNavigatePage(page.id, page.title, page.url)}
                activeOpacity={0.75}
                style={[styles.pageRow, { paddingLeft: SPACING.sm + indent }]}
              >
                <Text style={[styles.rowIcon, depth > 0 && styles.treePrefix]}>{prefix}</Text>
                <Text style={styles.pageTitle} numberOfLines={1}>
                  {page.title}
                </Text>
                <Text style={styles.pageTime}>{formatRelativeTime(page.lastEdited)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {databases.length === 0 && treeItems.length === 0 && (
        <Text style={styles.noData}>데이터 없음 — 통합 권한을 확인해주세요</Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.syncText}>{syncStr ? `업데이트 ${syncStr}` : '동기화 안됨'}</Text>
        <TouchableOpacity onPress={forceRefresh}>
          <Text style={styles.refreshBtn}>{isLoading ? '업데이트 중...' : '↻ 새로고침'}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: SPACING.lg }} />
    </ScrollView>
  );
}

// ── Database view ─────────────────────────────────────────────────────────────

function DatabaseView({
  id,
  onNavigatePage,
}: {
  id: string;
  onNavigatePage: (id: string, title: string, url: string) => void;
}) {
  const [pages, setPages] = useState<NotionPageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const doFetch = useCallback(() => {
    queryDatabasePages(id)
      .then(p => {
        setPages(p);
        setLastSync(new Date());
        setError(null);
      })
      .catch(e => setError(e instanceof Error ? e.message : '오류'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    doFetch();
  }, [doFetch]);
  useInterval(doFetch, DB_POLL_INTERVAL);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primaryLight} />
        <Text style={styles.loadingText}>데이터베이스 조회 중...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (pages.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noData}>항목 없음</Text>
      </View>
    );
  }

  const syncStr = lastSync
    ? lastSync.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.dbViewHeader}>
        <Text style={styles.sectionHeader}>{pages.length}개 항목</Text>
        {syncStr && <Text style={styles.syncText}>업데이트 {syncStr}</Text>}
      </View>
      {pages.map((page, idx) => (
        <TouchableOpacity
          key={page.id}
          onPress={() => onNavigatePage(page.id, page.title, page.url)}
          activeOpacity={0.75}
          style={[styles.dbEntryRow, idx % 2 === 1 && styles.dbEntryRowAlt]}
        >
          <Text style={styles.dbEntryIdx}>{String(idx + 1).padStart(2, '0')}</Text>
          <View style={styles.dbEntryContent}>
            <View style={styles.dbEntryTitleRow}>
              {page.emoji ? <Text style={styles.dbEntryEmoji}>{page.emoji}</Text> : null}
              <Text style={styles.dbEntryTitle} numberOfLines={1}>
                {page.title}
              </Text>
              <Text style={styles.pageTime}>{formatRelativeTime(page.lastEdited)}</Text>
            </View>
            <PropChips page={page} />
          </View>
        </TouchableOpacity>
      ))}
      <View style={{ height: SPACING.lg }} />
    </ScrollView>
  );
}

// ── Page view ─────────────────────────────────────────────────────────────────

function PageView({
  id,
  url: pageUrl,
  onNavigatePage,
  onNavigateDb,
  onOpenUrl,
}: {
  id: string;
  url: string;
  onNavigatePage: (id: string, title: string, url: string) => void;
  onNavigateDb: (id: string, title: string) => void;
  onOpenUrl: (url: string, title?: string) => void;
}) {
  const [blocks, setBlocks] = useState<NotionBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const doFetch = useCallback(() => {
    fetchPageBlocks(id)
      .then(b => {
        setBlocks(b);
        setLastSync(new Date());
        setError(null);
      })
      .catch(e => setError(e instanceof Error ? e.message : '오류'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    doFetch();
  }, [doFetch]);
  useInterval(doFetch, PAGE_POLL_INTERVAL);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primaryLight} />
        <Text style={styles.loadingText}>페이지 불러오는 중...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        {pageUrl ? (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => onOpenUrl(pageUrl, 'Notion 페이지')}
          >
            <Text style={styles.retryText}>브라우저에서 열기</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const numberedIndices = blocks.map((b, i) => {
    if (b.type !== 'numbered_list_item') return 0;
    let idx = 1;
    for (let j = i - 1; j >= 0; j--) {
      if (blocks[j].type === 'numbered_list_item') idx++;
      else break;
    }
    return idx;
  });

  const syncStr = lastSync
    ? lastSync.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {syncStr && (
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBannerText}>실시간 · {syncStr}</Text>
        </View>
      )}
      {blocks.map((block, i) => (
        <BlockView
          key={block.id}
          block={block}
          numberedIdx={numberedIndices[i]}
          onNavigatePage={onNavigatePage}
          onNavigateDb={onNavigateDb}
          onOpenUrl={onOpenUrl}
        />
      ))}
      {blocks.length === 0 && <Text style={styles.noData}>빈 페이지</Text>}
      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

// ── Root widget ───────────────────────────────────────────────────────────────

export default function NotionWidget() {
  const nav = useNavigation<NavProp>();
  const [viewStack, setViewStack] = useState<NotionView[]>([{ kind: 'home' }]);
  const currentView = viewStack[viewStack.length - 1];

  const pushView = useCallback((view: NotionView) => {
    setViewStack(prev => [...prev, view]);
  }, []);

  const popView = () => {
    setViewStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const onNavigatePage = useCallback(
    (id: string, title: string, url: string) => {
      pushView({ kind: 'page', id, title, url });
    },
    [pushView],
  );

  const onNavigateDb = useCallback(
    (id: string, title: string) => {
      pushView({ kind: 'database', id, title });
    },
    [pushView],
  );

  const onOpenUrl = useCallback(
    (url: string, title?: string) => {
      if (!url) return;
      nav.navigate('WebView', { url, title: title ?? url });
    },
    [nav],
  );

  const titleRight =
    currentView.kind === 'home' ? undefined : currentView.kind === 'database' ? 'DB' : 'PAGE';

  const breadLabel = viewStack
    .slice(1)
    .map(v => (v.kind === 'home' ? '' : v.title))
    .join(' › ');

  return (
    <GlowBox title="Notion" titleRight={titleRight} style={styles.box} noPadding>
      {viewStack.length > 1 && (
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={popView} style={styles.backBtn}>
            <Text style={styles.backText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.breadLabel} numberOfLines={1}>
            {breadLabel}
          </Text>
        </View>
      )}
      {currentView.kind === 'home' && (
        <HomeView onNavigatePage={onNavigatePage} onNavigateDb={onNavigateDb} />
      )}
      {currentView.kind === 'database' && (
        <DatabaseView id={currentView.id} onNavigatePage={onNavigatePage} />
      )}
      {currentView.kind === 'page' && (
        <PageView
          id={currentView.id}
          url={currentView.url}
          onNavigatePage={onNavigatePage}
          onNavigateDb={onNavigateDb}
          onOpenUrl={onOpenUrl}
        />
      )}
    </GlowBox>
  );
}

// ── Annotation styles ─────────────────────────────────────────────────────────

const annotStyles = {
  bold: { fontWeight: '700' } as TextStyle,
  italic: { fontStyle: 'italic' } as TextStyle,
  strike: { textDecorationLine: 'line-through' } as TextStyle,
  code: {
    backgroundColor: COLORS.primarySurface,
    color: COLORS.primaryLighter,
    fontFamily: FONTS.mono,
  } as TextStyle,
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.md },
  centered: { flex: 1, padding: SPACING.lg, justifyContent: 'center', alignItems: 'center' },

  loadingText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.sm,
  },
  errorText: {
    fontFamily: FONTS.sans,
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  noData: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  retryText: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.primaryLighter,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },

  // Section header
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primaryLight },
  sectionHeader: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.divider },
  section: { marginBottom: SPACING.md },

  // Breadcrumb
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceElevated,
    gap: SPACING.sm,
  },
  backBtn: {
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  backText: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.primaryLighter,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  breadLabel: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
    flex: 1,
  },

  // Database list
  dbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  dbTitle: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    flex: 1,
    fontWeight: '500',
  },

  // Page tree
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: SPACING.sm,
    marginBottom: 2,
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
  },
  pageTitle: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
    flex: 1,
  },
  pageTime: { fontFamily: FONTS.sans, color: COLORS.textHint, fontSize: 11 },
  rowIcon: { fontSize: 14, width: 22, textAlign: 'center' },
  treePrefix: { fontFamily: FONTS.mono, color: COLORS.textHint, fontSize: 11, width: 22 },
  arrowText: { fontFamily: FONTS.sans, color: COLORS.textHint, fontSize: FONTS.sizes.md },

  // Database entry
  dbViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom: SPACING.sm,
  },
  dbEntryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.sm,
  },
  dbEntryRowAlt: { backgroundColor: COLORS.surfaceElevated },
  dbEntryIdx: {
    fontFamily: FONTS.mono,
    color: COLORS.textHint,
    fontSize: 11,
    width: 22,
    marginTop: 2,
  },
  dbEntryContent: { flex: 1 },
  dbEntryTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 },
  dbEntryEmoji: { fontSize: 13 },
  dbEntryTitle: {
    fontFamily: FONTS.sans,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    flex: 1,
    fontWeight: '500',
  },

  // Property chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 10, fontWeight: '600' },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  syncText: { fontFamily: FONTS.sans, color: COLORS.textHint, fontSize: 11 },
  refreshBtn: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.primaryLighter,
    fontSize: 12,
    fontWeight: '600',
  },

  // Live banner
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.xs,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  liveBannerText: { fontFamily: FONTS.sans, color: COLORS.textHint, fontSize: 11 },

  // Block: base text
  baseText: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 22,
  },
  link: { color: COLORS.primaryLighter, textDecorationLine: 'underline' },

  blockParagraph: { marginBottom: SPACING.sm },

  blockH1: { marginBottom: SPACING.md, marginTop: SPACING.sm },
  h1Line: { height: 2, backgroundColor: COLORS.primary, marginBottom: SPACING.xs, borderRadius: 1 },
  h1Text: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  blockH2: { marginBottom: SPACING.sm, marginTop: SPACING.sm },
  h2Text: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  blockH3: { marginBottom: SPACING.xs },
  h3Text: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },

  listRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: SPACING.xs,
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primaryLight,
    marginTop: 8,
    flexShrink: 0,
  },
  numberedBullet: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.sm,
    minWidth: 20,
    fontWeight: '600',
  },
  toggleIcon: { fontFamily: FONTS.sans, color: COLORS.textHint, fontSize: FONTS.sizes.sm },
  listText: {},
  checkBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginTop: 3,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkMark: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  checkedText: { textDecorationLine: 'line-through', color: COLORS.textHint },

  codeBlock: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryLight,
  },
  codeLang: {
    fontFamily: FONTS.mono,
    color: COLORS.accent,
    fontSize: 10,
    marginBottom: SPACING.xs,
    letterSpacing: 0.5,
  },
  codeText: {
    fontFamily: FONTS.mono,
    color: COLORS.primaryLighter,
    fontSize: FONTS.sizes.xs,
    lineHeight: 18,
  },

  quoteBlock: { flexDirection: 'row', marginBottom: SPACING.sm, marginLeft: 4 },
  quoteBorder: {
    width: 3,
    backgroundColor: COLORS.primary,
    marginRight: SPACING.sm,
    borderRadius: 2,
  },
  quoteText: { color: COLORS.textSecondary, fontStyle: 'italic', flex: 1 },

  calloutBlock: {
    flexDirection: 'row',
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  calloutIcon: { fontSize: 16 },
  calloutText: { flex: 1 },

  dividerBlock: { height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.md },

  tableWrapper: { marginBottom: SPACING.md },
  tableContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  tableHeaderRow: { backgroundColor: COLORS.primarySurface },
  tableRowAlt: { backgroundColor: COLORS.surfaceElevated },
  tableCell: { flex: 1, padding: 6, justifyContent: 'center' },
  tableCellBorder: { borderRightWidth: 1, borderRightColor: COLORS.divider },
  tableRowHeaderCell: { backgroundColor: COLORS.surfaceElevated },
  tableCellText: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
    lineHeight: 18,
  },
  tableHeaderText: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },

  imageBlock: { marginBottom: SPACING.md },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
  },
  imageCaption: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },

  bookmarkBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  bookmarkIcon: { fontSize: 14 },
  bookmarkUrl: {
    flex: 1,
    fontFamily: FONTS.sans,
    color: COLORS.primaryLighter,
    fontSize: FONTS.sizes.xs,
  },

  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  childIcon: { fontSize: 14 },
  childTitle: {
    flex: 1,
    fontFamily: FONTS.sans,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
  },
});
