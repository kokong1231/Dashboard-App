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
import { fetchPageBlocks, richTextToPlain } from '@/api/notionApi';
import { NotionBlock, NotionBoardCard, NotionRichText } from '@/types';
import GlowBox from './GlowBox';
import NotionBoard from './NotionBoard';
import { useInterval } from '@/hooks/useInterval';
import { COLORS, FONTS, SPACING } from '@/theme';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const PAGE_POLL_INTERVAL = 30 * 1000;

// ── View stack ────────────────────────────────────────────────────────────────

type NotionView =
  | { kind: 'board' }
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
  const [viewStack, setViewStack] = useState<NotionView[]>([{ kind: 'board' }]);
  const currentView = viewStack[viewStack.length - 1];
  const cardCount = useNotionStore(s => s.cards.length);

  const popView = () => {
    setViewStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const onNavigatePage = useCallback((id: string, title: string, url: string) => {
    setViewStack(prev => [...prev, { kind: 'page', id, title, url }]);
  }, []);

  const onOpenCard = useCallback((card: NotionBoardCard) => {
    onNavigatePage(card.id, card.title, card.url);
  }, [onNavigatePage]);

  const onOpenUrl = useCallback((url: string, title?: string) => {
    if (!url) return;
    nav.navigate('WebView', { url, title: title ?? url });
  }, [nav]);

  // Child databases are out of scope for the board — open them in Notion instead
  const onNavigateDb = useCallback((id: string, title: string) => {
    onOpenUrl(`https://www.notion.so/${id.replace(/-/g, '')}`, title);
  }, [onOpenUrl]);

  const breadLabel = viewStack
    .slice(1)
    .map(v => (v.kind === 'page' ? v.title.toUpperCase() : ''))
    .join(' › ');

  const titleRight = currentView.kind === 'board' ? `BOARD · ${cardCount}` : 'PAGE';

  return (
    <GlowBox title="◈ NOTION::SYNC" titleRight={titleRight} style={styles.box} noPadding>
      {viewStack.length > 1 && (
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={popView} style={styles.backBtn}>
            <Text style={styles.backText}>{'← BOARD'}</Text>
          </TouchableOpacity>
          <Text style={styles.breadLabel} numberOfLines={1}>{breadLabel}</Text>
          {currentView.kind === 'page' && currentView.url ? (
            <TouchableOpacity onPress={() => onOpenUrl(currentView.url, currentView.title)}>
              <Text style={styles.backText}>{'OPEN ↗'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {currentView.kind === 'board' && <NotionBoard onOpenCard={onOpenCard} />}
      {currentView.kind === 'page' && (
        <PageView
          key={currentView.id}
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
