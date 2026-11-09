import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  LayoutAnimation,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useNotionStore } from '@/store/useNotionStore';
import { NotionBoardCard, NotionBoardColumn } from '@/types';
import PulseText from './PulseText';
import { COLORS, FONTS, SPACING } from '@/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Colors ───────────────────────────────────────────────────────────────────

export function boardColor(c: string | undefined): string {
  switch (c) {
    case 'gray':   return '#9aa59c';
    case 'brown':  return '#c8a165';
    case 'orange': return COLORS.amber;
    case 'yellow': return '#ffe14d';
    case 'green':  return COLORS.greenBright;
    case 'blue':   return COLORS.cyan;
    case 'purple': return '#b388ff';
    case 'pink':   return '#ff6ec7';
    case 'red':    return COLORS.red;
    default:       return COLORS.greenDim;
  }
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Due date label ───────────────────────────────────────────────────────────

function dueInfo(due: string, done: boolean): { label: string; color: string } {
  const hasTime = due.includes('T');
  const d = new Date(hasTime ? due : `${due}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);

  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const time = hasTime
    ? ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '';
  const dday = diff === 0 ? 'D-DAY' : diff > 0 ? `D-${diff}` : `D+${-diff}`;

  let color: string = COLORS.cyan;
  if (done) color = COLORS.greenDim;
  else if (diff < 0) color = COLORS.red;
  else if (diff <= 2) color = COLORS.amber;

  return { label: `${dday} · ${mmdd}${time}`, color };
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface Rect { x: number; y: number; w: number; h: number }

interface CardProps {
  card: NotionBoardCard;
  done: boolean;
  isDragSource: boolean;
  boardRef: React.RefObject<View | null>;
  onOpen: (card: NotionBoardCard) => void;
  onStartDrag: (card: NotionBoardCard, rect: Rect, pageX: number, pageY: number) => void;
  onPressOut: () => void;
}

const BoardCard = memo(function BoardCard({
  card, done, isDragSource, boardRef, onOpen, onStartDrag, onPressOut,
}: CardProps) {
  const ref = useRef<View>(null);

  const handleLongPress = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const board = boardRef.current;
    if (!ref.current || !board) return;
    ref.current.measureLayout(
      board,
      (x, y, w, h) => onStartDrag(card, { x, y, w, h }, pageX, pageY),
      () => {},
    );
  };

  return (
    <View ref={ref} collapsable={false} style={isDragSource && styles.cardSource}>
      <CardBody
        card={card}
        done={done}
        onPress={() => onOpen(card)}
        onLongPress={handleLongPress}
        onPressOut={onPressOut}
      />
    </View>
  );
});

interface CardBodyProps {
  card: NotionBoardCard;
  done: boolean;
  floating?: boolean;
  onPress?: () => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  onPressOut?: () => void;
}

function CardBody({ card, done, floating, onPress, onLongPress, onPressOut }: CardBodyProps) {
  const accent = card.project ? boardColor(card.projectColor) : COLORS.greenFaint;
  const due = card.due ? dueInfo(card.due, done) : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
      delayLongPress={280}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: accent },
        done && styles.cardDone,
        pressed && !floating && styles.cardPressed,
        floating && styles.cardFloating,
      ]}>
      <Text
        style={[styles.cardTitle, done && styles.cardTitleDone]}
        numberOfLines={3}>
        {card.emoji ? `${card.emoji} ` : ''}{card.title}
      </Text>

      {(card.project || due) && (
        <View style={styles.cardMeta}>
          {card.project ? (
            <View style={[styles.projChip, { backgroundColor: withAlpha(accent, 0.14), borderColor: withAlpha(accent, 0.6) }]}>
              <Text style={[styles.projText, { color: accent }]} numberOfLines={1}>{card.project}</Text>
            </View>
          ) : null}
          {due ? (
            <Text style={[styles.dueText, { color: due.color }]} numberOfLines={1}>{`◷ ${due.label}`}</Text>
          ) : null}
        </View>
      )}

      {card.memo ? (
        <Text style={styles.memoText} numberOfLines={2}>{card.memo}</Text>
      ) : null}
    </Pressable>
  );
}

// ── Column ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  column: NotionBoardColumn;
  cards: NotionBoardCard[];
  done: boolean;
  isHover: boolean;
  isDragging: boolean;
  dragId: string | null;
  boardRef: React.RefObject<View | null>;
  onLayout: (name: string, e: LayoutChangeEvent) => void;
  onOpen: (card: NotionBoardCard) => void;
  onStartDrag: CardProps['onStartDrag'];
  onPressOut: () => void;
}

function BoardColumn({
  column, cards, done, isHover, isDragging, dragId, boardRef, onLayout, onOpen, onStartDrag, onPressOut,
}: ColumnProps) {
  const color = boardColor(column.color);
  return (
    <View
      onLayout={e => onLayout(column.name, e)}
      style={[
        styles.column,
        { borderTopColor: color },
        isHover && { borderColor: color, backgroundColor: withAlpha(color, 0.08) },
      ]}>
      <View style={styles.colHeader}>
        <View style={[styles.colDot, { backgroundColor: color }]} />
        <Text style={[styles.colTitle, { color }]} numberOfLines={1}>{column.name}</Text>
        <View style={[styles.colCount, { borderColor: withAlpha(color, 0.5) }]}>
          <Text style={[styles.colCountText, { color }]}>{cards.length}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.colScroll}
        contentContainerStyle={styles.colScrollContent}
        scrollEnabled={!isDragging}
        showsVerticalScrollIndicator={false}>
        {isHover && (
          <View style={[styles.dropSlot, { borderColor: color }]}>
            <Text style={[styles.dropSlotText, { color }]}>{'▼ DROP'}</Text>
          </View>
        )}
        {cards.map(card => (
          <BoardCard
            key={card.id}
            card={card}
            done={done}
            isDragSource={card.id === dragId}
            boardRef={boardRef}
            onOpen={onOpen}
            onStartDrag={onStartDrag}
            onPressOut={onPressOut}
          />
        ))}
        {cards.length === 0 && !isHover && (
          <Text style={styles.emptyCol}>{'— EMPTY —'}</Text>
        )}
      </ScrollView>
    </View>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────

interface DragState {
  card: NotionBoardCard;
  rect: Rect;
  startX: number;
  startY: number;
  granted: boolean;
}

interface BoardProps {
  onOpenCard: (card: NotionBoardCard) => void;
}

export default function NotionBoard({ onOpenCard }: BoardProps) {
  const {
    title, columns, cards, pending, isLoading, error, moveError, lastFetched,
    fetch, forceRefresh, moveCard,
  } = useNotionStore();

  useEffect(() => { fetch(); }, [fetch]);

  const boardRef = useRef<View>(null);
  const colRects = useRef<Record<string, { x: number; w: number }>>({});
  const dragRef = useRef<DragState | null>(null);
  const hoverRef = useRef<string | null>(null);
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lift = useRef(new Animated.Value(0)).current;

  const [drag, setDrag] = useState<{ card: NotionBoardCard; w: number } | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!moveError) return;
    setToast(moveError);
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [moveError]);

  const byColumn = useMemo(() => {
    const map: Record<string, NotionBoardCard[]> = {};
    columns.forEach(c => { map[c.name] = []; });
    cards.forEach(card => {
      (map[card.status] ?? (map[card.status] = [])).push(card);
    });
    return map;
  }, [columns, cards]);

  const onColLayout = useCallback((name: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    colRects.current[name] = { x, w: width };
  }, []);

  const hitColumn = (cx: number): string | null => {
    for (const [name, r] of Object.entries(colRects.current)) {
      if (cx >= r.x && cx < r.x + r.w) return name;
    }
    return null;
  };

  const hoverVisRef = useRef<string | null>(null);
  const setHoverVisible = (name: string | null) => {
    if (hoverVisRef.current === name) return;
    hoverVisRef.current = name;
    setHoverCol(name);
  };

  const endDrag = useCallback((commit: boolean) => {
    const d = dragRef.current;
    if (!d) return;
    const target = hoverRef.current;
    dragRef.current = null;
    hoverRef.current = null;
    hoverVisRef.current = null;
    lift.setValue(0);
    if (commit && target && target !== d.card.status) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      moveCard(d.card.id, target);
    }
    setHoverCol(null);
    setDrag(null);
  }, [lift, moveCard]);

  const onStartDrag = useCallback((card: NotionBoardCard, rect: Rect, pageX: number, pageY: number) => {
    dragRef.current = { card, rect, startX: pageX, startY: pageY, granted: false };
    pos.setValue({ x: rect.x, y: rect.y });
    hoverRef.current = card.status;
    hoverVisRef.current = null;
    setHoverCol(null);
    setDrag({ card, w: rect.w });
    Animated.spring(lift, { toValue: 1, useNativeDriver: false, friction: 6 }).start();
  }, [lift, pos]);

  // Long-press released without moving → board never became responder
  const onCardPressOut = useCallback(() => {
    setTimeout(() => {
      if (dragRef.current && !dragRef.current.granted) endDrag(false);
    }, 0);
  }, [endDrag]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => !!dragRef.current,
    onMoveShouldSetPanResponderCapture: () => !!dragRef.current,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => {
      if (dragRef.current) dragRef.current.granted = true;
    },
    onPanResponderMove: e => {
      const d = dragRef.current;
      if (!d) return;
      const { pageX, pageY } = e.nativeEvent;
      const x = d.rect.x + (pageX - d.startX);
      const y = d.rect.y + (pageY - d.startY);
      pos.setValue({ x, y });
      const col = hitColumn(x + d.rect.w / 2);
      hoverRef.current = col;
      // own column isn't highlighted — dropping there is a no-op
      setHoverVisible(col === d.card.status ? null : col);
    },
    onPanResponderRelease: () => endDrag(true),
    onPanResponderTerminate: () => endDrag(false),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [endDrag, pos]);

  // ── States ──
  if (isLoading && columns.length === 0) {
    return (
      <View style={styles.centered}>
        <PulseText style={styles.loadingText} duration={600}>{'> CONNECTING TO NOTION...'}</PulseText>
      </View>
    );
  }

  if (error && columns.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{`> ERR: ${error}`}</Text>
        <TouchableOpacity onPress={forceRefresh} style={styles.retryBtn}>
          <Text style={styles.retryText}>{'[ RETRY ]'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const syncStr = lastFetched
    ? new Date(lastFetched).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';
  const pendingCount = Object.keys(pending).length;
  const ghostScale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <View style={styles.root}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.boardTitle} numberOfLines={1}>{`📃 ${title}`}</Text>
        <Text style={styles.toolbarInfo} numberOfLines={1}>
          {pendingCount > 0 ? `⇅ SAVING ${pendingCount}…` : `${cards.length} CARDS · ${syncStr}`}
        </Text>
        <TouchableOpacity onPress={forceRefresh} hitSlop={8}>
          <Text style={styles.refreshBtn}>{isLoading ? '…' : '↻'}</Text>
        </TouchableOpacity>
      </View>

      {/* Columns + drag layer */}
      <View ref={boardRef} collapsable={false} style={styles.board} {...panResponder.panHandlers}>
        <View style={styles.columns}>
          {columns.map(col => (
            <BoardColumn
              key={col.name}
              column={col}
              cards={byColumn[col.name] ?? []}
              done={col.color === 'green'}
              isHover={hoverCol === col.name}
              isDragging={!!drag}
              dragId={drag?.card.id ?? null}
              boardRef={boardRef}
              onLayout={onColLayout}
              onOpen={onOpenCard}
              onStartDrag={onStartDrag}
              onPressOut={onCardPressOut}
            />
          ))}
        </View>

        {drag && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ghost,
              {
                width: drag.w,
                transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale: ghostScale }],
              },
            ]}>
            <CardBody card={drag.card} done={false} floating />
          </Animated.View>
        )}
      </View>

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText} numberOfLines={2}>{`> ${toast}`}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, padding: SPACING.md, justifyContent: 'center' },
  loadingText: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.sm },
  errorText: { fontFamily: FONTS.mono, color: COLORS.red, fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm },
  retryBtn: { borderWidth: 1, borderColor: COLORS.amber, paddingHorizontal: SPACING.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  retryText: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.xs },

  // Toolbar
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.greenFaint,
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  boardTitle: { flex: 1, fontFamily: FONTS.mono, color: COLORS.greenBright, fontSize: FONTS.sizes.xs, fontWeight: '700', letterSpacing: 0.5 },
  toolbarInfo: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 10, letterSpacing: 0.5, marginRight: SPACING.sm },
  refreshBtn: { fontFamily: FONTS.mono, color: COLORS.green, fontSize: FONTS.sizes.sm },

  // Board
  board: { flex: 1 },
  columns: { flex: 1, flexDirection: 'row', padding: 4, gap: 4 },

  column: {
    flex: 1,
    borderWidth: 1, borderColor: 'rgba(0,255,65,0.12)',
    borderTopWidth: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(0,255,65,0.02)',
    overflow: 'hidden',
  },
  colHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.1)',
  },
  colDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  colTitle: { flex: 1, fontFamily: FONTS.mono, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  colCount: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' },
  colCountText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: '700' },
  colScroll: { flex: 1 },
  colScrollContent: { padding: 4, gap: 4, paddingBottom: SPACING.lg },
  emptyCol: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 10, textAlign: 'center', marginTop: SPACING.md, letterSpacing: 1 },

  dropSlot: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 3,
    paddingVertical: 8, alignItems: 'center',
  },
  dropSlotText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },

  // Card
  card: {
    backgroundColor: '#04110a',
    borderWidth: 1, borderColor: 'rgba(0,255,65,0.18)',
    borderLeftWidth: 3,
    borderRadius: 3,
    paddingHorizontal: 6, paddingVertical: 5,
  },
  cardPressed: { backgroundColor: '#072014', borderColor: 'rgba(0,255,65,0.4)' },
  cardDone: { opacity: 0.55 },
  cardSource: { opacity: 0.25 },
  cardFloating: {
    backgroundColor: '#0a2a18',
    borderColor: COLORS.green,
    shadowColor: COLORS.green, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  cardTitle: { fontFamily: FONTS.mono, color: COLORS.white, fontSize: 12, lineHeight: 16 },
  cardTitleDone: { textDecorationLine: 'line-through', color: COLORS.greenDim },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  projChip: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1, maxWidth: '100%' },
  projText: { fontFamily: FONTS.mono, fontSize: 9, fontWeight: '700' },
  dueText: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.3 },
  memoText: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 10, lineHeight: 13, marginTop: 4 },

  ghost: { position: 'absolute', left: 0, top: 0, zIndex: 100 },

  toast: {
    position: 'absolute', left: SPACING.sm, right: SPACING.sm, bottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.red, backgroundColor: 'rgba(40,0,0,0.92)',
    paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: 2,
  },
  toastText: { fontFamily: FONTS.mono, color: COLORS.red, fontSize: 11 },
});
