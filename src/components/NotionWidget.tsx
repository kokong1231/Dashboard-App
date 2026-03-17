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
import PulseText from './PulseText';
import { useInterval } from '@/hooks/useInterval';
import { COLORS, FONTS, SPACING } from '@/theme';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const PAGE_POLL_INTERVAL = 30 * 1000;
const DB_POLL_INTERVAL   = 30 * 1000;

// ── View stack ────────────────────────────────────────────────────────────────

type NotionView =
  | { kind: 'home' }
  | { kind: 'database'; id: string; title: string }
  | { kind: 'page'; id: string; title: string; url: string };

// ── Notion color → app color ─────────────────────────────────────────────────

function notionColor(c: string | undefined): string {
  if (!c) return COLORS.green;
  switch (c) {
    case 'red':    case 'red_background':    return COLORS.red;
    case 'yellow': case 'yellow_background': return COLORS.amber;
    case 'blue':   case 'blue_background':   return COLORS.cyan;
    case 'green':  case 'green_background':  return COLORS.greenBright;
    case 'gray':   case 'grey':              return COLORS.greenDim;
    default: return COLORS.green;
  }
}

// ── Rich text inline renderer ─────────────────────────────────────────────────

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
        const c = notionColor(rt.annotations.color !== 'default' ? rt.annotations.color : undefined);
        return (
          <Text
            key={i}
            style={[
              rt.annotations.bold          && annotStyles.bold,
              rt.annotations.italic        && annotStyles.italic,
              rt.annotations.strikethrough && annotStyles.strike,
              rt.annotations.code          && annotStyles.code,
              rt.annotations.color !== 'default' && { color: c },
              isLink && styles.link,
            ] as StyleProp<TextStyle>}
            onPress={isLink ? () => onLinkPress!(rt.href!) : undefined}>
            {rt.plain_text}
          </Text>
        );
      })}
    </Text>
  );
}

// ── Table renderer ────────────────────────────────────────────────────────────

function TableBlock({
  block, onLinkPress,
}: {
  block: NotionBlock;
  onLinkPress: (url: string) => void;
}) {
  const rows = block.table_children ?? [];
  const hasColHeader = block.table?.has_column_header ?? false;
  const hasRowHeader = block.table?.has_row_header ?? false;
  const colCount = block.table?.table_width ?? (rows[0]?.table_row?.cells.length ?? 0);

  if (rows.length === 0) return null;

  return (
    <View style={styles.tableContainer}>
      {rows.map((row, rowIdx) => {
        const cells = row.table_row?.cells ?? [];
        const isColHeader = hasColHeader && rowIdx === 0;
        const rowStyle = [
          styles.tableRow,
          isColHeader && styles.tableHeaderRow,
          rowIdx > 0 && rowIdx % 2 === 0 && styles.tableRowAlt,
        ];
        return (
          <View key={row.id} style={rowStyle}>
            {cells.map((cell, cellIdx) => {
              const isRowHeader = hasRowHeader && cellIdx === 0;
              const cellStyle = [
                styles.tableCell,
                cellIdx < colCount - 1 && styles.tableCellBorder,
                isRowHeader && styles.tableRowHeaderCell,
              ];
              const textStyle: StyleProp<TextStyle> = isColHeader || isRowHeader
                ? styles.tableHeaderText
                : styles.tableCellText;
              return (
                <View key={cellIdx} style={cellStyle}>
                  <RichTextView richText={cell} style={textStyle} onLinkPress={onLinkPress} />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ── Single block renderer ─────────────────────────────────────────────────────

interface BlockViewProps {
  block: NotionBlock;
  numberedIdx: number;
  onNavigatePage: (id: string, title: string, url: string) => void;
  onNavigateDb: (id: string, title: string) => void;
  onOpenUrl: (url: string, title?: string) => void;
}

function BlockView({ block, numberedIdx, onNavigatePage, onNavigateDb, onOpenUrl }: BlockViewProps) {
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
          <View style={styles.headingLine} />
          <RichTextView richText={block.heading_1!.rich_text} style={styles.h1Text} onLinkPress={linkPress} />
        </View>
      );

    case 'heading_2':
      return (
        <View style={styles.blockH2}>
          <RichTextView richText={block.heading_2!.rich_text} style={styles.h2Text} onLinkPress={linkPress} />
        </View>
      );

    case 'heading_3':
      return (
        <View style={styles.blockH3}>
          <RichTextView richText={block.heading_3!.rich_text} style={styles.h3Text} onLinkPress={linkPress} />
        </View>
      );

    case 'bulleted_list_item':
      return (
        <View style={styles.listRow}>
          <Text style={styles.bullet}>{'▸ '}</Text>
          <RichTextView richText={block.bulleted_list_item!.rich_text} style={styles.listText} onLinkPress={linkPress} />
        </View>
      );

    case 'numbered_list_item':
      return (
        <View style={styles.listRow}>
          <Text style={styles.bullet}>{`${numberedIdx}. `}</Text>
          <RichTextView richText={block.numbered_list_item!.rich_text} style={styles.listText} onLinkPress={linkPress} />
        </View>
      );

    case 'to_do': {
      const checked = block.to_do!.checked;
      return (
        <View style={styles.listRow}>
          <Text style={[styles.bullet, checked && styles.checkedBullet]}>
            {checked ? '[✓] ' : '[ ] '}
          </Text>
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
          <Text style={styles.bullet}>{'▶ '}</Text>
          <RichTextView richText={block.toggle!.rich_text} style={styles.listText} onLinkPress={linkPress} />
        </View>
      );

    case 'code': {
      const code = richTextToPlain(block.code!.rich_text);
      const lang = block.code!.language || '';
      return (
        <View style={styles.codeBlock}>
          {lang ? <Text style={styles.codeLang}>{lang.toUpperCase()}</Text> : null}
          <Text style={styles.codeText}>{code}</Text>
        </View>
      );
    }

    case 'quote':
      return (
        <View style={styles.quoteBlock}>
          <View style={styles.quoteBorder} />
          <RichTextView richText={block.quote!.rich_text} style={styles.quoteText} onLinkPress={linkPress} />
        </View>
      );

    case 'callout': {
      const icon = block.callout?.icon?.emoji ?? '💡';
      return (
        <View style={styles.calloutBlock}>
          <Text style={styles.calloutIcon}>{icon}</Text>
          <RichTextView richText={block.callout!.rich_text} style={styles.calloutText} onLinkPress={linkPress} />
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
        block.image?.type === 'external'
          ? block.image.external?.url
          : block.image?.file?.url;
      if (!imgUrl) return null;
      const caption =
        block.image?.caption?.length
          ? richTextToPlain(block.image.caption)
          : null;
      return (
        <View style={styles.imageBlock}>
          <Image source={{ uri: imgUrl }} style={styles.image} resizeMode="contain" />
          {caption ? <Text style={styles.imageCaption}>{caption}</Text> : null}
        </View>
      );
    }

    case 'bookmark': {
      const url = block.bookmark!.url;
      const cap = block.bookmark?.caption?.length
        ? richTextToPlain(block.bookmark.caption)
        : url;
      return (
        <TouchableOpacity style={styles.bookmarkBlock} onPress={() => onOpenUrl(url, cap)}>
          <Text style={styles.bookmarkIcon}>{'🔗'}</Text>
          <Text style={styles.bookmarkUrl} numberOfLines={1}>{cap}</Text>
          <Text style={styles.arrowText}>{' ›'}</Text>
        </TouchableOpacity>
      );
    }

    case 'link_preview': {
      const url = block.link_preview!.url;
      return (
        <TouchableOpacity style={styles.bookmarkBlock} onPress={() => onOpenUrl(url)}>
          <Text style={styles.bookmarkIcon}>{'🌐'}</Text>
          <Text style={styles.bookmarkUrl} numberOfLines={1}>{url}</Text>
          <Text style={styles.arrowText}>{' ›'}</Text>
        </TouchableOpacity>
      );
    }

    case 'embed': {
      const url = block.embed!.url;
      return (
        <TouchableOpacity style={styles.bookmarkBlock} onPress={() => onOpenUrl(url)}>
          <Text style={styles.bookmarkIcon}>{'⊞'}</Text>
          <Text style={styles.bookmarkUrl} numberOfLines={1}>{url}</Text>
          <Text style={styles.arrowText}>{' ›'}</Text>
        </TouchableOpacity>
      );
    }

    case 'child_page': {
      const title = block.child_page!.title || '(PAGE)';
      return (
        <TouchableOpacity
          style={styles.childPageRow}
          onPress={() => onNavigatePage(block.id, title, '')}>
          <Text style={styles.childIcon}>{'📄'}</Text>
          <Text style={styles.childTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.arrowText}>{' ›'}</Text>
        </TouchableOpacity>
      );
    }

    case 'child_database': {
      const title = block.child_database!.title || '(DATABASE)';
      return (
        <TouchableOpacity
          style={styles.childPageRow}
          onPress={() => onNavigateDb(block.id, title)}>
          <Text style={styles.childIcon}>{'🗄️'}</Text>
          <Text style={styles.childTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.arrowText}>{' ›'}</Text>
        </TouchableOpacity>
      );
    }

    default:
      return null;
  }
}

// ── Page tree helpers ─────────────────────────────────────────────────────────

interface PageTreeItem {
  page: NotionPageListItem;
  depth: number;
  hasChildren: boolean;
}

function buildPageTree(pages: NotionPageListItem[]): PageTreeItem[] {
  // Only non-DB pages for the tree
  const nonDb = pages.filter(p => p.parentType !== 'database_id');
  const allIds = new Set(nonDb.map(p => p.id));

  // Build child map
  const childMap = new Map<string, NotionPageListItem[]>();
  nonDb.forEach(p => {
    if (p.parentPageId && allIds.has(p.parentPageId)) {
      const arr = childMap.get(p.parentPageId) ?? [];
      arr.push(p);
      childMap.set(p.parentPageId, arr);
    }
  });

  // Root = workspace-level or parent not in our list
  // Keep API return order (matches Notion's natural order) — no extra sort
  const roots = nonDb.filter(
    p => p.parentType === 'workspace' || !p.parentPageId || !allIds.has(p.parentPageId),
  );

  const result: PageTreeItem[] = [];

  function dfs(p: NotionPageListItem, depth: number) {
    // Keep children in API return order as well
    const children = childMap.get(p.id) ?? [];
    result.push({ page: p, depth, hasChildren: children.length > 0 });
    children.forEach(c => dfs(c, depth + 1));
  }

  roots.forEach(p => dfs(p, 0));
  return result;
}

// ── DB property chips ─────────────────────────────────────────────────────────

function PropChips({ page }: { page: NotionPageListItem }) {
  const chips: { label: string; color: string }[] = [];

  if (page.dateStart) {
    const d = new Date(page.dateStart);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isPast  = d < now && !isToday;
    chips.push({
      label: isToday ? 'TODAY' : `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`,
      color: isPast ? COLORS.red : isToday ? COLORS.amber : COLORS.cyan,
    });
    if (page.dateEnd) {
      const e = new Date(page.dateEnd);
      chips.push({
        label: `→ ${String(e.getMonth()+1).padStart(2,'0')}.${String(e.getDate()).padStart(2,'0')}`,
        color: COLORS.greenDim,
      });
    }
  }

  if (page.status) {
    chips.push({ label: page.status.toUpperCase(), color: notionColor(page.statusColor) });
  }
  if (page.priority) {
    chips.push({ label: page.priority.toUpperCase(), color: notionColor(page.selectColor) });
  } else if (page.select) {
    chips.push({ label: page.select.toUpperCase(), color: notionColor(page.selectColor) });
  }
  if (page.checked !== undefined) {
    chips.push({ label: page.checked ? '[✓]' : '[ ]', color: page.checked ? COLORS.greenBright : COLORS.greenDim });
  }
  if (page.tags?.length) {
    page.tags.slice(0, 2).forEach(t => chips.push({ label: t.toUpperCase(), color: COLORS.greenDim }));
  }

  if (chips.length === 0) return null;
  return (
    <View style={styles.chipsRow}>
      {chips.map((c, i) => (
        <View key={i} style={[styles.chip, { borderColor: c.color }]}>
          <Text style={[styles.chipText, { color: c.color }]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Home view ─────────────────────────────────────────────────────────────────

interface HomeViewProps {
  onNavigatePage: (id: string, title: string, url: string) => void;
  onNavigateDb: (id: string, title: string) => void;
}

function HomeView({ onNavigatePage, onNavigateDb }: HomeViewProps) {
  const { databases, pages, isLoading, error, fetch, forceRefresh } = useNotionStore();
  const lastFetched = useNotionStore(s => s.lastFetched);

  useEffect(() => { fetch(); }, [fetch]);

  const syncStr = lastFetched
    ? new Date(lastFetched).toLocaleTimeString('en-GB', { hour12: false })
    : null;

  if (isLoading && databases.length === 0 && pages.length === 0) {
    return (
      <View style={styles.centered}>
        <PulseText style={styles.loadingText} duration={600}>
          {'> CONNECTING TO NOTION...'}
        </PulseText>
      </View>
    );
  }

  if (error && databases.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{`> ERR: ${error}`}</Text>
        <TouchableOpacity onPress={forceRefresh} style={styles.retryBtn}>
          <Text style={styles.retryText}>{'[ RETRY ]'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const treeItems = buildPageTree(pages);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

      {/* ── Databases ── */}
      {databases.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionHeader}>DATABASES</Text>
            <View style={styles.sectionLine} />
          </View>
          {databases.map(db => (
            <TouchableOpacity
              key={db.id}
              onPress={() => onNavigateDb(db.id, db.title)}
              activeOpacity={0.7}
              style={styles.dbRow}>
              <Text style={styles.rowIcon}>{db.emoji ?? '▪'}</Text>
              <Text style={styles.dbTitle} numberOfLines={1}>{db.title}</Text>
              <Text style={styles.arrowText}>{' ›'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Page tree ── */}
      {treeItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionHeader}>PAGES</Text>
            <View style={styles.sectionLine} />
          </View>
          {treeItems.map(({ page, depth, hasChildren }) => {
            const indent = depth * 14;
            const prefix = depth === 0 ? (page.emoji ?? '📄') : (hasChildren ? '├─ ' : '└─ ');
            return (
              <TouchableOpacity
                key={page.id}
                onPress={() => onNavigatePage(page.id, page.title, page.url)}
                activeOpacity={0.7}
                style={[styles.pageRow, { paddingLeft: SPACING.xs + indent }]}>
                <Text style={[styles.rowIcon, depth > 0 && styles.treePrefix]}>{prefix}</Text>
                <View style={styles.pageTitleCol}>
                  <Text style={styles.pageTitle} numberOfLines={1}>{page.title}</Text>
                </View>
                <Text style={styles.pageTime}>{formatRelativeTime(page.lastEdited)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {databases.length === 0 && treeItems.length === 0 && (
        <Text style={styles.noData}>{'> NO DATA\n> CHECK INTEGRATION PERMISSIONS'}</Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.syncText}>{syncStr ? `SYNC: ${syncStr}` : 'NOT SYNCED'}</Text>
        <TouchableOpacity onPress={forceRefresh}>
          <Text style={styles.refreshBtn}>{isLoading ? 'REFRESHING...' : '[↻ REFRESH]'}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: SPACING.lg }} />
    </ScrollView>
  );
}

// ── Database view ─────────────────────────────────────────────────────────────

interface DatabaseViewProps {
  id: string;
  onNavigatePage: (id: string, title: string, url: string) => void;
}

function DatabaseView({ id, onNavigatePage }: DatabaseViewProps) {
  const [pages, setPages]       = useState<NotionPageListItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const doFetch = useCallback(() => {
    queryDatabasePages(id)
      .then(p => { setPages(p); setLastSync(new Date()); setError(null); })
      .catch(e => setError(e instanceof Error ? e.message : 'FETCH ERROR'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { setLoading(true); doFetch(); }, [doFetch]);
  useInterval(doFetch, DB_POLL_INTERVAL);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.green} />
        <Text style={styles.loadingText}>{'> QUERYING DATABASE...'}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{`> ERR: ${error.toUpperCase()}`}</Text>
      </View>
    );
  }

  if (pages.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noData}>{'> NO ENTRIES FOUND'}</Text>
      </View>
    );
  }

  const syncStr = lastSync ? lastSync.toLocaleTimeString('en-GB', { hour12: false }) : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.dbViewHeader}>
        <Text style={styles.sectionHeader}>{`${pages.length} ENTRIES`}</Text>
        {syncStr && <Text style={styles.syncText}>{`SYNC: ${syncStr}`}</Text>}
      </View>
      {pages.map((page, idx) => (
        <TouchableOpacity
          key={page.id}
          onPress={() => onNavigatePage(page.id, page.title, page.url)}
          activeOpacity={0.7}
          style={[styles.dbEntryRow, idx % 2 === 1 && styles.dbEntryRowAlt]}>
          {/* Index + emoji/icon */}
          <Text style={styles.dbEntryIdx}>{String(idx + 1).padStart(2, '0')}</Text>
          <View style={styles.dbEntryContent}>
            <View style={styles.dbEntryTitleRow}>
              {page.emoji ? <Text style={styles.dbEntryEmoji}>{page.emoji}</Text> : null}
              <Text style={styles.dbEntryTitle} numberOfLines={1}>{page.title}</Text>
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

interface PageViewProps {
  id: string;
  url: string;
  onNavigatePage: (id: string, title: string, url: string) => void;
  onNavigateDb: (id: string, title: string) => void;
  onOpenUrl: (url: string, title?: string) => void;
}

function PageView({ id, url: pageUrl, onNavigatePage, onNavigateDb, onOpenUrl }: PageViewProps) {
  const [blocks, setBlocks]     = useState<NotionBlock[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const doFetch = useCallback(() => {
    fetchPageBlocks(id)
      .then(b => { setBlocks(b); setLastSync(new Date()); setError(null); })
      .catch(e => setError(e instanceof Error ? e.message : 'FETCH ERROR'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { setLoading(true); doFetch(); }, [doFetch]);
  useInterval(doFetch, PAGE_POLL_INTERVAL);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.green} />
        <Text style={styles.loadingText}>{'> LOADING PAGE...'}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{`> ERR: ${error.toUpperCase()}`}</Text>
        {pageUrl ? (
          <TouchableOpacity style={styles.retryBtn} onPress={() => onOpenUrl(pageUrl, 'NOTION PAGE')}>
            <Text style={styles.retryText}>{'[ OPEN IN BROWSER ]'}</Text>
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

  const syncStr = lastSync ? lastSync.toLocaleTimeString('en-GB', { hour12: false }) : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {syncStr && (
        <Text style={styles.pageSyncText}>{`◎ LIVE · SYNC: ${syncStr}`}</Text>
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
      {blocks.length === 0 && (
        <Text style={styles.noData}>{'> EMPTY PAGE'}</Text>
      )}
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

  const onNavigatePage = useCallback((id: string, title: string, url: string) => {
    pushView({ kind: 'page', id, title, url });
  }, [pushView]);

  const onNavigateDb = useCallback((id: string, title: string) => {
    pushView({ kind: 'database', id, title });
  }, [pushView]);

  const onOpenUrl = useCallback((url: string, title?: string) => {
    if (!url) return;
    nav.navigate('WebView', { url, title: title ?? url });
  }, [nav]);

  const breadLabel = viewStack
    .slice(1)
    .map(v => (v.kind === 'home' ? '' : v.title.toUpperCase()))
    .join(' › ');

  const titleRight =
    currentView.kind === 'home' ? undefined :
    currentView.kind === 'database' ? 'DB' : 'PAGE';

  return (
    <GlowBox title="◈ NOTION::SYNC" titleRight={titleRight} style={styles.box} noPadding>
      {viewStack.length > 1 && (
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={popView} style={styles.backBtn}>
            <Text style={styles.backText}>{'← BACK'}</Text>
          </TouchableOpacity>
          <Text style={styles.breadLabel} numberOfLines={1}>{breadLabel}</Text>
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
  bold:   { fontWeight: '700' } as TextStyle,
  italic: { fontStyle: 'italic' } as TextStyle,
  strike: { textDecorationLine: 'line-through' } as TextStyle,
  code:   { backgroundColor: 'rgba(0,255,65,0.12)', color: COLORS.cyan } as TextStyle,
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  box: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.sm },
  centered: { flex: 1, padding: SPACING.md, justifyContent: 'center' },

  // Section head
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  sectionHeader: {
    fontFamily: FONTS.mono, color: COLORS.greenFaint,
    fontSize: FONTS.sizes.xs, letterSpacing: 2, marginRight: 6,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.greenFaint, opacity: 0.35 },

  section: { marginBottom: SPACING.sm },

  // Breadcrumb
  breadcrumb: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: COLORS.greenFaint,
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  backBtn:   { marginRight: SPACING.sm },
  backText:  { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.xs, letterSpacing: 1 },
  breadLabel:{ fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: FONTS.sizes.xs, flex: 1, letterSpacing: 0.5 },

  // Feedback states
  loadingText: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.sm, marginTop: 8 },
  errorText:   { fontFamily: FONTS.mono, color: COLORS.red, fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm },
  noData:      { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: FONTS.sizes.xs, lineHeight: 20 },
  retryBtn:    { borderWidth: 1, borderColor: COLORS.amber, paddingHorizontal: SPACING.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  retryText:   { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.xs },

  // Database list rows
  dbRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 4,
    borderLeftWidth: 2, borderLeftColor: COLORS.greenFaint,
    marginBottom: 3,
  },
  dbTitle: { fontFamily: FONTS.mono, color: COLORS.greenBright, fontSize: FONTS.sizes.sm, flex: 1, letterSpacing: 0.5 },

  // Page tree rows
  pageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 4, marginBottom: 2 },
  pageTitleCol: { flex: 1 },
  pageTitle:    { fontFamily: FONTS.mono, color: COLORS.green, fontSize: FONTS.sizes.xs, letterSpacing: 0.5 },
  pageTime:     { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: FONTS.sizes.xs, letterSpacing: 0.5, marginLeft: 4 },
  rowIcon:      { fontSize: 14, marginRight: 6, width: 22 },
  treePrefix:   { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: FONTS.sizes.xs, width: 22 },
  arrowText:    { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: FONTS.sizes.md },

  // Database entry rows
  dbViewHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.greenFaint, paddingBottom: 4,
  },
  dbEntryRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 5, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.08)',
  },
  dbEntryRowAlt: { backgroundColor: 'rgba(0,255,65,0.03)' },
  dbEntryIdx:   { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 10, width: 20, marginTop: 2 },
  dbEntryContent: { flex: 1 },
  dbEntryTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  dbEntryEmoji: { fontSize: 12, marginRight: 4 },
  dbEntryTitle: { fontFamily: FONTS.mono, color: COLORS.green, fontSize: FONTS.sizes.xs, flex: 1, letterSpacing: 0.5 },

  // Property chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: { borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2 },
  chipText: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.5 },

  // Footer
  footer:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm, paddingTop: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.greenFaint },
  syncText:   { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: FONTS.sizes.xs, letterSpacing: 1 },
  refreshBtn: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: FONTS.sizes.xs, letterSpacing: 1 },

  // Page sync indicator
  pageSyncText: {
    fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: FONTS.sizes.xs,
    letterSpacing: 1, marginBottom: SPACING.xs,
    borderBottomWidth: 1, borderBottomColor: COLORS.greenFaint, paddingBottom: 4,
  },

  // Block: base text
  baseText: { fontFamily: FONTS.mono, color: COLORS.green, fontSize: FONTS.sizes.xs, lineHeight: 20 },
  link:     { color: COLORS.cyan, textDecorationLine: 'underline' },

  blockParagraph: { marginBottom: SPACING.xs },

  blockH1: { marginBottom: SPACING.sm, marginTop: SPACING.xs },
  headingLine: { height: 1, backgroundColor: COLORS.greenFaint, marginBottom: 4 },
  h1Text: { color: COLORS.greenBright, fontSize: FONTS.sizes.md, fontWeight: 'bold', letterSpacing: 1 },
  blockH2: { marginBottom: SPACING.xs, marginTop: SPACING.xs },
  h2Text: { color: COLORS.greenBright, fontSize: FONTS.sizes.sm, fontWeight: 'bold', letterSpacing: 0.5 },
  blockH3: { marginBottom: SPACING.xs },
  h3Text: { color: COLORS.green, fontSize: FONTS.sizes.sm, fontWeight: '600' },

  listRow:       { flexDirection: 'row', marginBottom: 3, paddingLeft: 4 },
  bullet:        { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: FONTS.sizes.xs, minWidth: 20 },
  listText:      {},
  checkedBullet: { color: COLORS.greenFaint },
  checkedText:   { textDecorationLine: 'line-through', color: COLORS.greenFaint },

  codeBlock: { backgroundColor: 'rgba(0,255,65,0.06)', borderWidth: 1, borderColor: COLORS.greenFaint, padding: SPACING.xs, marginBottom: SPACING.xs, borderRadius: 2 },
  codeLang:  { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: FONTS.sizes.xs, letterSpacing: 1, marginBottom: 2 },
  codeText:  { fontFamily: FONTS.mono, color: COLORS.cyan, fontSize: FONTS.sizes.xs, lineHeight: 18 },

  quoteBlock:  { flexDirection: 'row', marginBottom: SPACING.xs, marginLeft: 4 },
  quoteBorder: { width: 2, backgroundColor: COLORS.greenDim, marginRight: SPACING.xs },
  quoteText:   { color: COLORS.greenDim, fontStyle: 'italic', flex: 1 },

  calloutBlock: { flexDirection: 'row', backgroundColor: 'rgba(0,255,65,0.06)', borderWidth: 1, borderColor: COLORS.greenFaint, padding: SPACING.xs, marginBottom: SPACING.xs, borderRadius: 2 },
  calloutIcon:  { fontSize: 16, marginRight: SPACING.xs },
  calloutText:  { flex: 1 },

  dividerBlock: { height: 1, backgroundColor: COLORS.greenFaint, marginVertical: SPACING.sm, opacity: 0.5 },

  // Table
  tableWrapper:   { marginBottom: SPACING.sm },
  tableContainer: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  tableRow:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.15)' },
  tableHeaderRow:  { backgroundColor: 'rgba(0,255,65,0.10)' },
  tableRowAlt:     { backgroundColor: 'rgba(0,255,65,0.03)' },
  tableCell:       { flex: 1, padding: 5, justifyContent: 'center' },
  tableCellBorder: { borderRightWidth: 1, borderRightColor: 'rgba(0,255,65,0.15)' },
  tableRowHeaderCell: { backgroundColor: 'rgba(0,255,65,0.07)' },
  tableCellText:   { fontFamily: FONTS.mono, color: COLORS.green, fontSize: FONTS.sizes.xs, lineHeight: 18 },
  tableHeaderText: { fontFamily: FONTS.mono, color: COLORS.greenBright, fontSize: FONTS.sizes.xs, fontWeight: '700', letterSpacing: 0.5 },

  imageBlock:   { marginBottom: SPACING.sm },
  image:        { width: '100%', height: 120, backgroundColor: 'rgba(0,255,65,0.04)' },
  imageCaption: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: FONTS.sizes.xs, textAlign: 'center', marginTop: 3 },

  bookmarkBlock: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.greenFaint, padding: SPACING.xs, marginBottom: SPACING.xs, borderRadius: 2 },
  bookmarkIcon:  { fontSize: 14, marginRight: SPACING.xs },
  bookmarkUrl:   { flex: 1, fontFamily: FONTS.mono, color: COLORS.cyan, fontSize: FONTS.sizes.xs, letterSpacing: 0.3 },

  childPageRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 4, borderLeftWidth: 2, borderLeftColor: COLORS.green, marginBottom: 3 },
  childIcon:     { fontSize: 14, marginRight: 6 },
  childTitle:    { flex: 1, fontFamily: FONTS.mono, color: COLORS.greenBright, fontSize: FONTS.sizes.xs },
});
