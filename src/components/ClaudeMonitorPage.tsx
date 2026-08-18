import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PulseText from './PulseText';
import { useClaudeStore } from '@/store/useClaudeStore';
import { COLORS, FONTS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';

// ── Constants ─────────────────────────────────────────────────────────────────

const CLAUDE_REFRESH_MS = 5 * 60 * 1000; // Notion DB에 5분 간격으로 새 행이 쌓임
const BAR_CELLS = 14;
const LABEL_W = 32;
const BAR_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const RESET_DROP = -5; // 사용률이 5%p 이상 급락하면 세션 리셋으로 판정
const HOUR_AXIS = '00    06    12    18  23'; // 24칸 고정폭 축 라벨

// ── Helpers ───────────────────────────────────────────────────────────────────

function usageColor(pct: number | null): string {
  if (pct == null) return COLORS.greenDim;
  if (pct >= 90) return COLORS.red;
  if (pct >= 70) return COLORS.amber;
  return COLORS.green;
}

/** 리셋까지 남은 시간: "1h 48m" / "4d 8h" / "NOW" */
function untilStr(iso: string | null): string {
  if (!iso) return '--';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'NOW';
  const totalMin = Math.floor(diff / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function clockStr(iso: string | null): string {
  if (!iso) return '--:--';
  const t = new Date(iso);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** "default_claude_max_5x" → "MAX_5X" */
function tierLabel(raw: string): string {
  return raw ? raw.replace(/^default_claude_/, '').toUpperCase() : '--';
}

/** Statuspage indicator/컴포넌트 상태 → 색상 (미지의 상태는 빨강으로 눈에 띄게) */
function serverColor(s: string): string {
  if (s === 'none' || s === 'operational') return COLORS.green;
  if (s === 'minor' || s === 'degraded_performance' || s === 'partial_outage') return COLORS.amber;
  if (s === 'maintenance' || s === 'under_maintenance') return COLORS.cyan;
  return COLORS.red; // major | critical | major_outage | 알 수 없는 상태
}

/** 공지(장애/점검) → 색상 */
function noticeColor(kind: string, impact: string): string {
  if (kind === 'maintenance' || impact === 'maintenance') return COLORS.cyan;
  if (impact === 'critical' || impact === 'major') return COLORS.red;
  return COLORS.amber;
}

/** 공지 진행 단계 → 라벨 */
function noticeStatusLabel(s: string): string {
  const map: Record<string, string> = {
    investigating: 'INVESTIGATING',
    identified: 'IDENTIFIED',
    monitoring: 'MONITORING',
    postmortem: 'POSTMORTEM',
    scheduled: 'SCHEDULED',
    in_progress: 'IN PROGRESS',
    verifying: 'VERIFYING',
  };
  return map[s] ?? s.toUpperCase();
}

/** 컴포넌트 이름 → 짧은 라벨 */
function componentLabel(name: string): string {
  if (name === 'claude.ai') return 'WEB';
  if (name.includes('Console')) return 'CONS';
  if (name.includes('API')) return 'API';
  if (name.includes('Code')) return 'CODE';
  if (name.includes('Cowork')) return 'CWRK';
  if (name.includes('Government')) return 'GOV';
  return name.slice(0, 4).toUpperCase();
}

/** 컴포넌트 상태 → 짧은 라벨 */
function componentStatusLabel(s: string): string {
  if (s === 'operational') return 'OK';
  if (s === 'degraded_performance') return 'DEG';
  if (s === 'partial_outage') return 'PART';
  if (s === 'major_outage') return 'DOWN';
  if (s === 'under_maintenance') return 'MNT';
  return '?';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}
function Divider() {
  return <View style={styles.dividerLine} />;
}
function UsageBar({ label, pct }: { label: string; pct: number | null }) {
  const color = usageColor(pct);
  const filled = pct == null ? 0 : Math.round((Math.min(pct, 100) / 100) * BAR_CELLS);
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled);
  const pctStr = pct == null ? ' --%' : `${String(pct).padStart(3, ' ')}%`;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowBar, { color }]}>{bar}</Text>
      <Text style={[styles.rowValue, { color }]}>{pctStr}</Text>
    </View>
  );
}
function KVRow({
  label,
  value,
  color = COLORS.green,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, styles.rowValueFull, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClaudeMonitorPage({ width, height }: { width: number; height: number }) {
  const snapshots = useClaudeStore(s => s.snapshots);
  const server = useClaudeStore(s => s.server);
  const isLoading = useClaudeStore(s => s.isLoading);
  const hasError = useClaudeStore(s => s.hasError);
  const fetchedAt = useClaudeStore(s => s.fetchedAt);
  const fetch = useClaudeStore(s => s.fetch);

  const handleRefresh = useCallback(() => {
    fetch();
  }, [fetch]);

  useInterval(fetch, CLAUDE_REFRESH_MS);

  if (isLoading && snapshots.length === 0) {
    return (
      <View style={[{ width, height }, styles.centerPad]}>
        <PulseText style={styles.loadingText} duration={600}>
          {'> SCANNING CLAUDE...'}
        </PulseText>
      </View>
    );
  }
  if (hasError && snapshots.length === 0) {
    return (
      <View style={[{ width, height }, styles.centerPad]}>
        <Text style={styles.errorText}>{'> ERR: NOTION UNREACHABLE'}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Text style={styles.refreshIcon}>{'⟳'}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (snapshots.length === 0) {
    return (
      <View style={[{ width, height }, styles.centerPad]}>
        <Text style={styles.errorText}>{'> NO USAGE DATA'}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Text style={styles.refreshIcon}>{'⟳'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const latest = snapshots[0];

  // 오늘 시간대별 사용량: 5시간 사용률의 증가분을 시간대(0~23시)별로 합산.
  // 급락(RESET_DROP 이하)은 사용이 아니라 세션 리셋이므로 리셋 시각으로 기록.
  const asc = [...snapshots].reverse();
  const hourly: number[] = new Array(24).fill(0);
  const resetHours = new Set<number>();
  for (let i = 1; i < asc.length; i++) {
    const prevPct = asc[i - 1].fiveHourPct;
    const curPct = asc[i].fiveHourPct;
    const ts = asc[i].timestamp;
    if (prevPct == null || curPct == null || !ts) continue;
    const hour = new Date(ts).getHours();
    const delta = curPct - prevPct;
    if (delta <= RESET_DROP) resetHours.add(hour);
    else if (delta > 0) hourly[hour] += delta;
  }

  // 동적 스케일: 가장 많이 쓴 시간대가 만점(█)이 되도록 정규화
  const maxHourly = Math.max(...hourly);
  const hourBars = hourly
    .map(v => {
      if (v <= 0 || maxHourly <= 0) return '▁';
      const idx = Math.max(1, Math.round((v / maxHourly) * (BAR_GLYPHS.length - 1)));
      return BAR_GLYPHS[idx];
    })
    .join('');
  const resetRow = Array.from({ length: 24 }, (_, h) => (resetHours.has(h) ? '▲' : ' ')).join('');
  const totalToday = Math.round(hourly.reduce((a, b) => a + b, 0));
  let peakHour = -1;
  let peakVal = 0;
  hourly.forEach((v, h) => {
    if (v > peakVal) {
      peakVal = v;
      peakHour = h;
    }
  });
  const resetListStr = [...resetHours]
    .sort((a, b) => a - b)
    .map(h => `${String(h).padStart(2, '0')}H`)
    .join(' · ');

  const syncStr = fetchedAt
    ? `${String(fetchedAt.getHours()).padStart(2, '0')}:${String(fetchedAt.getMinutes()).padStart(
        2,
        '0',
      )} [5m]`
    : '--:-- [5m]';

  return (
    <View style={{ width, height }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header: 구독 / 티어 / 새로고침 ── */}
        <View style={styles.header}>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>{latest.plan ? latest.plan.toUpperCase() : '?'}</Text>
          </View>
          <Text style={styles.tierText}>{tierLabel(latest.rateTier)}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={isLoading}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.refreshIcon, isLoading && styles.refreshIconDim]}>{'⟳'}</Text>
          </TouchableOpacity>
        </View>
        <Divider />

        <Section title="SERVER::STATUS" />
        {server ? (
          <>
            <KVRow
              label="STAT"
              value={server.description.toUpperCase()}
              color={serverColor(server.indicator)}
            />
            <View style={styles.compGrid}>
              {server.components.map(c => (
                <View key={c.name} style={styles.compCell}>
                  <Text style={[styles.compDot, { color: serverColor(c.status) }]}>{'●'}</Text>
                  <Text style={styles.compName}>{componentLabel(c.name)}</Text>
                  <Text style={[styles.compStatus, { color: serverColor(c.status) }]}>
                    {componentStatusLabel(c.status)}
                  </Text>
                </View>
              ))}
            </View>
            {server.notices.map(n => {
              const nColor = noticeColor(n.kind, n.impact);
              return (
                <View
                  key={`${n.kind}-${n.name}`}
                  style={[styles.noticeCard, { borderColor: nColor }]}
                >
                  <Text style={[styles.noticeTitle, { color: nColor }]} numberOfLines={2}>
                    {`${n.kind === 'maintenance' ? '🛠' : '⚠'} ${n.name}`}
                  </Text>
                  <Text style={[styles.noticeStatus, { color: nColor }]}>
                    {noticeStatusLabel(n.status)}
                  </Text>
                  {n.body ? (
                    <Text style={styles.noticeBody} numberOfLines={3}>
                      {n.body}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : (
          <KVRow label="STAT" value="--" color={COLORS.greenDim} />
        )}
        <Divider />

        <Section title="SESSION::5H" />
        <UsageBar label="USE " pct={latest.fiveHourPct} />
        <KVRow
          label="RST "
          value={`${untilStr(latest.fiveHourReset)} · ${clockStr(latest.fiveHourReset)}`}
          color={COLORS.cyan}
        />
        <Divider />

        <Section title="WEEK::7D" />
        <UsageBar label="USE " pct={latest.sevenDayPct} />
        <KVRow
          label="RST "
          value={`${untilStr(latest.sevenDayReset)} · ${clockStr(latest.sevenDayReset)}`}
          color={COLORS.cyan}
        />
        <Divider />

        <Section title="USAGE::TODAY" />
        <Text style={[styles.hourBars, { color: COLORS.green }]}>{hourBars}</Text>
        {resetHours.size > 0 && (
          <Text style={[styles.hourBars, { color: COLORS.cyan }]}>{resetRow}</Text>
        )}
        <Text style={styles.hourAxis}>{HOUR_AXIS}</Text>
        <KVRow label="TDAY" value={totalToday <= 0 ? '--' : `${totalToday}%p USED`} />
        <KVRow
          label="PEAK"
          value={
            peakHour < 0 ? '--' : `${String(peakHour).padStart(2, '0')}H · ${Math.round(peakVal)}%p`
          }
        />
        <KVRow
          label="RST "
          value={resetHours.size === 0 ? 'NONE' : `▲ ${resetListStr}`}
          color={resetHours.size === 0 ? COLORS.greenDim : COLORS.cyan}
        />
        <Divider />

        <View style={styles.footer}>
          <Text style={styles.footerText}>{`LAST ${latest.measuredAt}`}</Text>
          <Text style={styles.footerText}>{`SYNC ${syncStr}`}</Text>
        </View>

        <View style={{ height: SPACING.md }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centerPad: { flex: 1, padding: SPACING.sm },
  loadingText: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.sm },
  errorText: { fontFamily: FONTS.mono, color: COLORS.red, fontSize: FONTS.sizes.sm },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.sm, paddingTop: SPACING.xs },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  planBadge: {
    borderWidth: 1,
    borderColor: COLORS.amber,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  planText: {
    fontFamily: FONTS.mono,
    color: COLORS.amber,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  tierText: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 9, letterSpacing: 0.5 },

  refreshBtn: { padding: 2 },
  refreshIcon: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 16, fontWeight: '700' },
  refreshIconDim: { opacity: 0.3 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4 },
  sectionTitle: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 9,
    letterSpacing: 2,
    marginRight: 6,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.greenFaint, opacity: 0.4 },
  dividerLine: { height: 1, backgroundColor: COLORS.greenFaint, marginVertical: 4, opacity: 0.3 },

  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  rowLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 10,
    letterSpacing: 1,
    width: LABEL_W,
  },
  rowBar: { fontFamily: FONTS.mono, fontSize: 10, flex: 1, letterSpacing: -0.5 },
  rowValue: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    width: 40,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  rowValueFull: { flex: 1, width: undefined },

  hourBars: { fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 0, marginBottom: 1 },
  hourAxis: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 12,
    letterSpacing: 0,
    marginBottom: 3,
  },

  compGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 },
  compCell: { flexDirection: 'row', alignItems: 'center', width: '33.3%', marginBottom: 3, gap: 4 },
  compDot: { fontFamily: FONTS.mono, fontSize: 8 },
  compName: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 9, letterSpacing: 0.5 },
  compStatus: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.5 },

  // ── 서버 공지 카드 (장애/점검 특별 안내) ──
  noticeCard: {
    borderLeftWidth: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 2,
    marginBottom: 3,
    backgroundColor: 'rgba(255, 176, 0, 0.05)',
  },
  noticeTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.3,
    fontWeight: '700',
    marginBottom: 2,
  },
  noticeStatus: { fontFamily: FONTS.mono, fontSize: 8, letterSpacing: 1.5, marginBottom: 2 },
  noticeBody: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.2,
  },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 9, letterSpacing: 0.3 },
});
