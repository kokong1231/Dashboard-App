import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { useTechBriefStore } from '@/store/useTechBriefStore';
import { TechBriefCategory, TechBriefItem, TechBriefMeta, TechBriefUrgency } from '@/types';
import { useInterval } from '@/hooks/useInterval';
import { COLORS, FONTS, SPACING } from '@/theme';
import GlowBox from './GlowBox';
import PulseText from './PulseText';
import BriefAnimationStage from './BriefAnimationStage';
import BriefLoadingOverlay from './BriefLoadingOverlay';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

/** 항목 자동 순환 간격 — 길어진 요약을 읽을 시간 */
const ROTATE_MS = 30 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function categoryColor(c: TechBriefCategory): string {
  switch (c) {
    case 'URGENT':
      return COLORS.red;
    case 'SECURITY':
      return COLORS.amber;
    case 'AI':
      return COLORS.cyan;
    case 'DEV':
      return COLORS.greenBright;
    default:
      return COLORS.green;
  }
}

function urgencyColor(u: TechBriefUrgency): string {
  switch (u) {
    case 'critical':
      return COLORS.red;
    case 'high':
      return COLORS.amber;
    case 'medium':
      return COLORS.green;
    default:
      return COLORS.greenDim;
  }
}

/** "2026-10-20 13:00" → "10-20 13:00" */
function shortSlot(slotKey: string): string {
  return slotKey.slice(5);
}

function minutesToNextHour(): number {
  const now = new Date();
  return 60 - now.getMinutes();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={[styles.toggle, on ? styles.toggleOn : styles.toggleOff]}
    >
      <Text style={[styles.toggleText, { color: on ? COLORS.greenBright : COLORS.greenDim }]}>
        {`${label} ${on ? '■ ON' : '□ OFF'}`}
      </Text>
    </TouchableOpacity>
  );
}

function HeaderToggles() {
  const auto = useTechBriefStore(s => s.autoEnabled);
  const setAuto = useTechBriefStore(s => s.setAutoEnabled);
  const rotate = useTechBriefStore(s => s.rotateEnabled);
  const setRotate = useTechBriefStore(s => s.setRotateEnabled);
  return (
    <View style={styles.toggles}>
      <ToggleChip label="CYCLE" on={rotate} onPress={() => setRotate(!rotate)} />
      <ToggleChip label="AUTO-GEN" on={auto} onPress={() => setAuto(!auto)} />
    </View>
  );
}

/** 다음 항목으로 넘어가기까지 남은 시간 — resetKey가 바뀔 때마다 0부터 다시 채움 */
function RotateProgress({ running, resetKey }: { running: boolean; resetKey: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (running) {
      progress.value = withTiming(1, { duration: ROTATE_MS, easing: Easing.linear });
    }
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, resetKey]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={styles.rotateTrack}>
      {running && <Animated.View style={[styles.rotateFill, fillStyle]} />}
    </View>
  );
}

function DetailSection({ label, color, body }: { label: string; color: string; body?: string }) {
  if (!body) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionLabel, { color }]}>{`// ${label}`}</Text>
        <View style={[styles.sectionRule, { backgroundColor: color }]} />
      </View>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

function ItemDetail({
  item,
  index,
  total,
  onOpenUrl,
  onInteract,
}: {
  item: TechBriefItem;
  index: number;
  total: number;
  onOpenUrl: (url: string, title: string) => void;
  /** 사용자가 읽는 중(스크롤) — 순환 타이머 리셋 */
  onInteract: () => void;
}) {
  const cColor = categoryColor(item.category);
  return (
    <ScrollView
      style={styles.detailScroll}
      contentContainerStyle={styles.detailContent}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={onInteract}
    >
      <View style={styles.detailHead}>
        <Text style={[styles.catBadge, { color: cColor, borderColor: cColor }]}>
          {item.category}
        </Text>
        <Text style={[styles.urgency, { color: urgencyColor(item.urgency) }]}>
          {`▲ ${item.urgency.toUpperCase()}`}
        </Text>
        <View style={styles.flex} />
        <Text style={styles.counter}>{`${String(index + 1).padStart(2, '0')}/${String(
          total,
        ).padStart(2, '0')}`}</Text>
      </View>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text style={styles.summary}>{item.summary}</Text>

      <DetailSection label="배경" color={COLORS.greenDim} body={item.context} />
      <DetailSection label="영향" color={COLORS.amber} body={item.impact} />
      <DetailSection label="대응" color={COLORS.cyan} body={item.action} />

      {item.points.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionLabel, { color: COLORS.greenBright }]}>{'// 핵심'}</Text>
            <View style={[styles.sectionRule, { backgroundColor: COLORS.greenBright }]} />
          </View>
          {item.points.map((pt, i) => (
            <View key={i} style={styles.pointRow}>
              <Text style={styles.pointBullet}>{'›'}</Text>
              <Text style={styles.pointText}>{pt}</Text>
            </View>
          ))}
        </View>
      )}

      {item.sources.length > 0 && (
        <View style={styles.sources}>
          {item.sources.map((src, i) => (
            <TouchableOpacity key={i} onPress={() => onOpenUrl(src.url, src.title)}>
              <Text style={styles.sourceText} numberOfLines={1}>{`↗ ${src.title}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={{ height: SPACING.md }} />
    </ScrollView>
  );
}

function HistoryView({
  list,
  currentPageId,
  onSelect,
}: {
  list: TechBriefMeta[];
  currentPageId?: string;
  onSelect: (pageId: string) => void;
}) {
  // 날짜별 그룹
  const groups = useMemo(() => {
    const map = new Map<string, TechBriefMeta[]>();
    for (const m of list) {
      const day = m.slotKey.slice(0, 10) || '----';
      map.set(day, [...(map.get(day) ?? []), m]);
    }
    return [...map.entries()];
  }, [list]);

  if (list.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.dimText}>{'> NO ARCHIVE (7D RETENTION)'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.historyContent}
      showsVerticalScrollIndicator={false}
    >
      {groups.map(([day, metas]) => (
        <View key={day} style={styles.historyGroup}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{day}</Text>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>{`${metas.length}`}</Text>
          </View>
          {metas.map(m => {
            const active = m.pageId === currentPageId;
            return (
              <TouchableOpacity
                key={m.pageId}
                onPress={() => onSelect(m.pageId)}
                style={[styles.historyRow, active && styles.historyRowActive]}
              >
                <Text style={[styles.historyTime, m.urgent && { color: COLORS.red }]}>
                  {`${m.urgent ? '!' : ' '}${m.slotKey.slice(11, 16)}`}
                </Text>
                <Text style={styles.historyHeadline} numberOfLines={1}>
                  {m.headline}
                </Text>
                <Text style={styles.historyCount}>{`[${m.itemCount}]`}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <View style={{ height: SPACING.md }} />
    </ScrollView>
  );
}

// ── Root widget ───────────────────────────────────────────────────────────────

export default function TechBriefWidget() {
  const nav = useNavigation<NavProp>();
  const phase = useTechBriefStore(s => s.phase);
  const phaseStartedAt = useTechBriefStore(s => s.phaseStartedAt);
  const current = useTechBriefStore(s => s.current);
  const list = useTechBriefStore(s => s.list);
  const isViewingLatest = useTechBriefStore(s => s.isViewingLatest);
  const isOpening = useTechBriefStore(s => s.isOpening);
  const autoEnabled = useTechBriefStore(s => s.autoEnabled);
  const hydrated = useTechBriefStore(s => s.hydrated);
  const error = useTechBriefStore(s => s.error);
  const generate = useTechBriefStore(s => s.generate);
  const openBrief = useTechBriefStore(s => s.openBrief);

  const [mode, setMode] = useState<'brief' | 'history'>('brief');
  // 브리프가 바뀌면 선택 탭을 0으로 — 키가 다르면 저장된 인덱스를 무시
  const briefKey = `${current?.slotKey}|${current?.notionPageId}`;
  const [selState, setSelState] = useState({ key: briefKey, idx: 0 });
  const sel = selState.key === briefKey ? selState.idx : 0;
  const setSel = (idx: number) => setSelState({ key: briefKey, idx });
  // 사용자 조작(탭 선택·스크롤) 시 순환 타이머를 처음부터 다시
  const [touchNonce, setTouchNonce] = useState(0);
  const rotateEnabled = useTechBriefStore(s => s.rotateEnabled);
  const [nextMin, setNextMin] = useState(minutesToNextHour);

  useInterval(() => setNextMin(minutesToNextHour()), 30 * 1000);

  const busy = phase !== 'idle';
  const count = current?.items.length ?? 0;
  const item = current?.items[Math.min(sel, Math.max(0, count - 1))];
  const rotating = rotateEnabled && mode === 'brief' && !busy && !isOpening && count > 1;

  useEffect(() => {
    if (!rotating) return;
    const id = setTimeout(() => {
      setSelState(st => ({
        key: briefKey,
        idx: ((st.key === briefKey ? st.idx : 0) + 1) % count,
      }));
    }, ROTATE_MS);
    return () => clearTimeout(id);
  }, [rotating, sel, briefKey, count, touchNonce]);

  const onInteract = () => setTouchNonce(n => n + 1);

  const onOpenUrl = (url: string, title: string) => {
    if (/^https?:\/\//.test(url)) nav.navigate('WebView', { url, title });
  };

  const onSelectHistory = (pageId: string) => {
    setMode('brief');
    openBrief(pageId);
  };

  const backToLatest = () => {
    if (list[0]) openBrief(list[0].pageId, true);
  };

  return (
    <GlowBox title="◈ TECH::BRIEF" titleRight={<HeaderToggles />} style={styles.box} noPadding>
      {/* Status bar */}
      <View style={styles.statusBar}>
        {current ? (
          isViewingLatest ? (
            <Text style={styles.statusLive}>{`● ${shortSlot(current.slotKey)}`}</Text>
          ) : (
            <TouchableOpacity onPress={backToLatest}>
              <Text style={styles.statusArchive}>{`◷ ${shortSlot(current.slotKey)} ↩`}</Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={styles.statusDim}>{'○ --:--'}</Text>
        )}
        <Text style={styles.statusHeadline} numberOfLines={1}>
          {error ? `ERR: ${error}` : current?.headline ?? ''}
        </Text>
        <Text style={styles.statusDim}>{autoEnabled ? `NEXT ${nextMin}M` : 'MANUAL'}</Text>
        <TouchableOpacity
          onPress={() => setMode(m => (m === 'history' ? 'brief' : 'history'))}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Text
            style={[styles.btn, mode === 'history' && styles.btnActive]}
          >{`[7D:${list.length}]`}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => generate(true)}
          disabled={busy}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Text style={[styles.btn, busy && styles.btnDisabled]}>{'[▶ GEN]'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.flex}>
        {mode === 'history' ? (
          <HistoryView
            list={list}
            currentPageId={current?.notionPageId}
            onSelect={onSelectHistory}
          />
        ) : current && item ? (
          <Animated.View key={current.slotKey} entering={FadeIn.duration(500)} style={styles.flex}>
            {/* Item tabs */}
            <ScrollView
              horizontal
              style={styles.tabs}
              contentContainerStyle={styles.tabsContent}
              showsHorizontalScrollIndicator={false}
            >
              {current.items.map((it, i) => {
                const active = i === sel;
                const c = categoryColor(it.category);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setSel(i);
                      onInteract();
                    }}
                    style={[
                      styles.tab,
                      { borderColor: active ? c : COLORS.greenFaint },
                      active && styles.tabActive,
                    ]}
                  >
                    <Text style={[styles.tabText, { color: active ? c : COLORS.greenDim }]}>
                      {`${String(i + 1).padStart(2, '0')} ${it.category}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <RotateProgress running={rotating} resetKey={`${briefKey}|${sel}|${touchNonce}`} />

            <View style={styles.body}>
              <View style={styles.stageArea}>
                <BriefAnimationStage key={`${current.slotKey}-${sel}`} html={item.animation} />
              </View>
              <View style={styles.detailArea}>
                <ItemDetail
                  item={item}
                  index={sel}
                  total={count}
                  onOpenUrl={onOpenUrl}
                  onInteract={onInteract}
                />
              </View>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.centered}>
            {!hydrated || isOpening ? (
              <PulseText style={styles.loadingText}>{'> LOADING BRIEF...'}</PulseText>
            ) : (
              <>
                <Text style={styles.dimText}>{'> NO BRIEF YET'}</Text>
                <Text style={styles.dimText}>
                  {autoEnabled
                    ? '> AUTO GENERATES EVERY HOUR ON THE HOUR'
                    : '> AUTO OFF — PRESS [▶ GEN]'}
                </Text>
              </>
            )}
          </View>
        )}

        {isOpening && current && (
          <View style={styles.openingBadge} pointerEvents="none">
            <PulseText style={styles.loadingText}>{'> LOADING...'}</PulseText>
          </View>
        )}

        {busy && <BriefLoadingOverlay phase={phase} startedAt={phaseStartedAt} solid={!current} />}
      </View>
    </GlowBox>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, padding: SPACING.md, justifyContent: 'center', gap: 4 },
  dimText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: FONTS.sizes.xs,
    lineHeight: 20,
  },
  loadingText: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.xs },

  // Toggle
  toggles: { flexDirection: 'row', alignItems: 'center' },
  toggle: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
    marginLeft: SPACING.sm,
  },
  toggleOn: { borderColor: COLORS.green, backgroundColor: 'rgba(0,255,65,0.10)' },
  toggleOff: { borderColor: COLORS.greenFaint },
  toggleText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1, fontWeight: '700' },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greenFaint,
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  statusLive: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statusArchive: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: 11, letterSpacing: 0.5 },
  statusDim: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 10, letterSpacing: 0.5 },
  statusHeadline: {
    flex: 1,
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  btn: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 10, letterSpacing: 0.5 },
  btnActive: { color: COLORS.amber },
  btnDisabled: { opacity: 0.3 },

  // Tabs
  tabs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.08)' },
  tabsContent: { paddingHorizontal: SPACING.sm, paddingVertical: 4, gap: 4 },
  tab: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  tabActive: { backgroundColor: 'rgba(0,255,65,0.08)' },
  tabText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 },
  rotateTrack: { height: 1, backgroundColor: 'rgba(0,255,65,0.08)' },
  rotateFill: { height: '100%', backgroundColor: COLORS.green, opacity: 0.6 },

  // Body: 애니메이션 무대(좌) + 요약(우)
  body: { flex: 1, flexDirection: 'row', padding: SPACING.xs, gap: SPACING.xs },
  stageArea: { flex: 11 },
  detailArea: { flex: 9 },

  detailScroll: { flex: 1 },
  detailContent: { paddingHorizontal: 6 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  catBadge: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontWeight: '700',
  },
  urgency: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1 },
  counter: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 9, letterSpacing: 1 },
  itemTitle: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  summary: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 2,
  },
  section: { marginTop: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  sectionLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  sectionRule: { flex: 1, height: 1, marginLeft: 6, opacity: 0.25 },
  sectionBody: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 11,
    lineHeight: 18,
    opacity: 0.9,
  },
  pointRow: { flexDirection: 'row', marginBottom: 3 },
  pointBullet: { fontFamily: FONTS.mono, color: COLORS.greenBright, fontSize: 11, width: 12 },
  pointText: { flex: 1, fontFamily: FONTS.mono, color: COLORS.white, fontSize: 11, lineHeight: 17 },
  sources: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.08)',
    paddingTop: 3,
  },
  sourceText: {
    fontFamily: FONTS.mono,
    color: COLORS.cyan,
    fontSize: 9,
    lineHeight: 14,
    opacity: 0.8,
  },

  // History
  historyContent: { padding: SPACING.sm },
  historyGroup: { marginBottom: SPACING.xs },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  sectionTitle: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 10,
    letterSpacing: 2,
    marginHorizontal: 4,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.greenFaint, opacity: 0.35 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.06)',
  },
  historyRowActive: {
    backgroundColor: 'rgba(0,255,65,0.08)',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.green,
  },
  historyTime: { fontFamily: FONTS.mono, color: COLORS.greenBright, fontSize: 11, width: 50 },
  historyHeadline: { flex: 1, fontFamily: FONTS.mono, color: COLORS.green, fontSize: 11 },
  historyCount: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 10, marginLeft: 4 },

  openingBadge: { position: 'absolute', right: SPACING.sm, bottom: SPACING.xs },
});
