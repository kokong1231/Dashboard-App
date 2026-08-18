import React, { useCallback } from 'react';
import { DimensionValue, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GlowBox from './GlowBox';
import PulseText from './PulseText';
import { useClaudeStore } from '@/store/useClaudeStore';
import { COLORS, FONTS, RADIUS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';

// ── Constants ─────────────────────────────────────────────────────────────────

const CLAUDE_REFRESH_MS = 5 * 60 * 1000; // Notion DB에 5분 간격으로 새 행이 쌓임
const RESET_DROP = -5; // 사용률이 5%p 이상 급락하면 세션 리셋으로 판정
const CHART_H = 44; // 시간대별 그래프 최대 막대 높이

// ── Helpers ───────────────────────────────────────────────────────────────────

function usageColor(pct: number | null): string {
  if (pct == null) return COLORS.textHint;
  if (pct >= 90) return COLORS.error;
  if (pct >= 70) return COLORS.warning;
  return COLORS.success;
}

/** Statuspage indicator/컴포넌트 상태 → 색상 (미지의 상태는 빨강으로 눈에 띄게) */
function serverColor(s: string): string {
  if (s === 'none' || s === 'operational') return COLORS.success;
  if (s === 'minor' || s === 'degraded_performance' || s === 'partial_outage')
    return COLORS.warning;
  if (s === 'maintenance' || s === 'under_maintenance') return COLORS.info;
  return COLORS.error; // major | critical | major_outage | 알 수 없는 상태
}

/** 공지(장애/점검) → 색상 */
function noticeColor(kind: string, impact: string): string {
  if (kind === 'maintenance' || impact === 'maintenance') return COLORS.info;
  if (impact === 'critical' || impact === 'major') return COLORS.error;
  return COLORS.warning;
}

/** 공지 진행 단계 → 한글 라벨 */
function noticeStatusLabel(s: string): string {
  const map: Record<string, string> = {
    investigating: '조사 중',
    identified: '원인 파악',
    monitoring: '모니터링 중',
    postmortem: '사후 분석',
    scheduled: '점검 예정',
    in_progress: '점검 중',
    verifying: '검증 중',
  };
  return map[s] ?? s.toUpperCase();
}

/** 리셋까지 남은 시간 */
function untilStr(iso: string | null): string {
  if (!iso) return '--';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return '곧 리셋';
  const totalMin = Math.floor(diff / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}일 ${h}시간 후`;
  if (h > 0) return `${h}시간 ${m}분 후`;
  return `${m}분 후`;
}

function clockStr(iso: string | null): string {
  if (!iso) return '--:--';
  const t = new Date(iso);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** "default_claude_max_5x" → "MAX 5X" */
function tierLabel(raw: string): string {
  return raw
    ? raw
        .replace(/^default_claude_/, '')
        .replace(/_/g, ' ')
        .toUpperCase()
    : '--';
}

/** 컴포넌트 이름 → 짧은 라벨 */
function componentLabel(name: string): string {
  if (name === 'claude.ai') return 'WEB';
  if (name.includes('Console')) return 'CONSOLE';
  if (name.includes('API')) return 'API';
  if (name.includes('Code')) return 'CODE';
  if (name.includes('Cowork')) return 'COWORK';
  if (name.includes('Government')) return 'GOV';
  return name.slice(0, 7).toUpperCase();
}

/** 컴포넌트 상태 → 한글 라벨 */
function componentStatusLabel(s: string): string {
  if (s === 'operational') return '정상';
  if (s === 'degraded_performance') return '저하';
  if (s === 'partial_outage') return '부분 장애';
  if (s === 'major_outage') return '중단';
  if (s === 'under_maintenance') return '점검';
  return '알 수 없음';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{text}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function GaugeRow({
  label,
  pct,
  resetIso,
}: {
  label: string;
  pct: number | null;
  resetIso: string | null;
}) {
  const color = usageColor(pct);
  const width = pct == null ? 0 : Math.min(100, pct);
  return (
    <View style={styles.gaugeBlock}>
      <View style={styles.gaugeTop}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, { color }]}>{pct == null ? '--' : `${pct}%`}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${width}%` as DimensionValue, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.resetText}>{`리셋 ${untilStr(resetIso)} · ${clockStr(resetIso)}`}</Text>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ClaudeMonitorWidget() {
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

  const syncStr = fetchedAt
    ? `${String(fetchedAt.getHours()).padStart(2, '0')}:${String(fetchedAt.getMinutes()).padStart(
        2,
        '0',
      )} 동기화`
    : '';

  if (isLoading && snapshots.length === 0) {
    return (
      <GlowBox title="Claude 모니터" style={styles.box}>
        <PulseText style={styles.loadingText} duration={600}>
          {'Claude 상태 불러오는 중...'}
        </PulseText>
      </GlowBox>
    );
  }
  if (snapshots.length === 0) {
    return (
      <GlowBox title="Claude 모니터" style={styles.box}>
        <Text style={styles.errorText}>
          {hasError ? '사용량 데이터를 가져오지 못했어요' : '오늘 사용량 데이터가 없어요'}
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Text style={styles.refreshIcon}>{'⟳'}</Text>
        </TouchableOpacity>
      </GlowBox>
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

  // 동적 스케일: 가장 많이 쓴 시간대가 그래프 최대 높이가 되도록 정규화
  const maxHourly = Math.max(...hourly);
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
    .map(h => `${String(h).padStart(2, '0')}시`)
    .join(' · ');

  return (
    <GlowBox title="Claude 모니터" titleRight={syncStr} style={styles.box} noPadding>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 구독 정보 ── */}
        <View style={styles.planRow}>
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

        {/* ── 서버 상태 ── */}
        <SectionLabel text="서버 상태" />
        {server ? (
          <>
            <View style={styles.serverOverall}>
              <View
                style={[styles.statusDot, { backgroundColor: serverColor(server.indicator) }]}
              />
              <Text style={[styles.serverOverallText, { color: serverColor(server.indicator) }]}>
                {server.description || '--'}
              </Text>
            </View>
            <View style={styles.compGrid}>
              {server.components.map(c => (
                <View key={c.name} style={styles.compCell}>
                  <View style={[styles.statusDot, { backgroundColor: serverColor(c.status) }]} />
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
                  style={[styles.noticeCard, { borderLeftColor: nColor }]}
                >
                  <Text style={[styles.noticeTitle, { color: nColor }]} numberOfLines={2}>
                    {`${n.kind === 'maintenance' ? '🛠' : '⚠️'} ${n.name}`}
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
          <Text style={styles.dimText}>서버 상태를 불러오지 못했어요</Text>
        )}

        <View style={styles.divider} />

        {/* ── 사용량 게이지 ── */}
        <SectionLabel text="5시간 세션" />
        <GaugeRow label="사용률" pct={latest.fiveHourPct} resetIso={latest.fiveHourReset} />

        <SectionLabel text="7일 누적" />
        <GaugeRow label="사용률" pct={latest.sevenDayPct} resetIso={latest.sevenDayReset} />

        <View style={styles.divider} />

        {/* ── 오늘 시간대별 사용량 ── */}
        <SectionLabel text="오늘 사용량" />
        <View style={styles.chartRow}>
          {hourly.map((v, h) => {
            const ratio = maxHourly > 0 ? v / maxHourly : 0;
            const barH = v > 0 ? Math.max(3, Math.round(ratio * CHART_H)) : 2;
            return (
              <View key={h} style={styles.chartCol}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: barH,
                      backgroundColor:
                        v <= 0
                          ? COLORS.border
                          : h === peakHour
                          ? COLORS.primaryLighter
                          : COLORS.primaryLight,
                    },
                  ]}
                />
                <Text style={[styles.chartMark, resetHours.has(h) && { color: COLORS.info }]}>
                  {resetHours.has(h) ? '▲' : ' '}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.chartAxis}>
          <Text style={styles.axisText}>0시</Text>
          <Text style={styles.axisText}>6시</Text>
          <Text style={styles.axisText}>12시</Text>
          <Text style={styles.axisText}>18시</Text>
          <Text style={styles.axisText}>23시</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.statLabel}>오늘 합계</Text>
          <Text style={[styles.statValue, { color: COLORS.textSecondary }]}>
            {totalToday <= 0 ? '--' : `${totalToday}%p`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.statLabel}>피크</Text>
          <Text style={[styles.statValue, { color: COLORS.primaryLighter }]}>
            {peakHour < 0 ? '--' : `${peakHour}시 · ${Math.round(peakVal)}%p`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.statLabel}>세션 리셋</Text>
          <Text
            style={[
              styles.statValue,
              { color: resetHours.size === 0 ? COLORS.textHint : COLORS.info },
            ]}
          >
            {resetHours.size === 0 ? '없음' : `▲ ${resetListStr}`}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.statLabel}>측정 시각</Text>
          <Text style={[styles.statValue, { color: COLORS.textHint }]}>{latest.measuredAt}</Text>
        </View>

        <View style={{ height: SPACING.md }} />
      </ScrollView>
    </GlowBox>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },

  loadingText: {
    fontFamily: FONTS.sans,
    color: COLORS.warning,
    fontSize: FONTS.sizes.xs,
  },
  errorText: {
    fontFamily: FONTS.sans,
    color: COLORS.error,
    fontSize: FONTS.sizes.xs,
    marginBottom: SPACING.sm,
  },
  dimText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: FONTS.sizes.xs,
    marginBottom: SPACING.xs,
  },

  // ── 구독 정보 ──
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  planBadge: {
    backgroundColor: COLORS.primarySurface,
    borderColor: COLORS.primaryLight,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  planText: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.primaryLighter,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tierText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  refreshBtn: { padding: 2 },
  refreshIcon: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.textHint,
    fontSize: 18,
    fontWeight: '700',
  },
  refreshIconDim: { opacity: 0.3 },

  // ── 섹션 ──
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.sansMedium,
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.sm,
  },

  // ── 서버 상태 ──
  serverOverall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  serverOverallText: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
  },
  compGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.xs,
  },
  compCell: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: SPACING.xs,
    gap: 6,
  },
  compName: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  compStatus: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '600',
  },
  noticeCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  noticeTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    marginBottom: 2,
  },
  noticeStatus: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  noticeBody: {
    fontFamily: FONTS.sans,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },

  // ── 게이지 ──
  gaugeBlock: { marginBottom: SPACING.sm },
  gaugeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: FONTS.sizes.xs,
  },
  statValue: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    textAlign: 'right',
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  resetText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: 11,
    marginTop: 4,
  },

  // ── 시간대별 그래프 ──
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_H + 14,
    gap: 2,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBar: {
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  chartMark: {
    fontFamily: FONTS.sans,
    color: 'transparent',
    fontSize: 8,
    height: 12,
    textAlign: 'center',
  },
  chartAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  axisText: {
    fontFamily: FONTS.sans,
    color: COLORS.textHint,
    fontSize: 10,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
});
