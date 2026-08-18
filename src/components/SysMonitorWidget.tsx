import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Animatable from 'react-native-animatable';
import GlowBox from './GlowBox';
import ClaudeMonitorPage from './ClaudeMonitorPage';
import CommunityPage from './CommunityPage';
import SentryPage from './SentryPage';
import { COLORS, FONTS, SPACING } from '@/theme';
import { GitAction } from '@/api/githubApi';
import { useGitStore } from '@/store/useGitStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function shortRepo(full: string): string {
  if (full.length <= 22) return full;
  const [owner, repo] = full.split('/');
  if (!repo) return full.slice(0, 22);
  const ownerShort = owner.length > 6 ? `${owner.slice(0, 5)}…` : owner;
  const candidate = `${ownerShort}/${repo}`;
  return candidate.length <= 22 ? candidate : candidate.slice(0, 22);
}

function actionIcon(status: string, conclusion: string | null): [string, string] {
  if (status === 'in_progress') return ['▶', COLORS.amber];
  if (status === 'queued')      return ['◎', COLORS.greenDim];
  if (conclusion === 'success') return ['✓', COLORS.green];
  if (conclusion === 'failure') return ['✗', COLORS.red];
  if (conclusion === 'cancelled') return ['∅', COLORS.greenFaint];
  return ['?', COLORS.greenDim];
}

// Animated progress bar: cycles fill for in_progress, fixed for others
function progressFill(status: string, conclusion: string | null, tick: number): string {
  if (status === 'in_progress') {
    // Animate: fill sweeps 0→12→0 on a 12-step cycle
    const pos = tick % 24;
    const filled = pos <= 12 ? pos : 24 - pos;
    return '█'.repeat(filled) + '░'.repeat(12 - filled);
  }
  const fill =
    conclusion === 'success'   ? 12 :
    status     === 'queued'    ? 2  :
    conclusion === 'failure'   ? 12 : 3;
  return '█'.repeat(fill) + '░'.repeat(12 - fill);
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
  return <View style={styles.divider} />;
}

// ── Action card (large/prominent) ─────────────────────────────────────────────

function ActionItem({ item, tick }: { item: GitAction; tick: number }) {
  const [icon, iconColor] = actionIcon(item.status, item.conclusion);

  const conclusionLabel =
    item.status === 'in_progress' ? 'IN PROGRESS' :
    item.status === 'queued'      ? 'QUEUED'       :
    item.conclusion === 'success' ? 'SUCCESS'      :
    item.conclusion === 'failure' ? 'FAILED'       :
    item.conclusion === 'cancelled' ? 'CANCELLED'  : 'UNKNOWN';

  const bar = progressFill(item.status, item.conclusion, tick);
  const wf  = item.workflow.length > 22 ? `${item.workflow.slice(0, 21)}…` : item.workflow;
  const br  = item.branch.length > 16   ? `${item.branch.slice(0, 15)}…`  : item.branch;
  const age = relTime(item.timestamp);
  const isRunning = item.status === 'in_progress';
  const isQueued  = item.status === 'queued';
  const isFailed  = item.conclusion === 'failure';

  return (
    <View style={[
      styles.actionCard,
      { borderLeftColor: iconColor },
      isRunning && styles.actionCardRunning,
      isFailed  && styles.actionCardFailed,
    ]}>
      {/* Row 1: icon + repo + age */}
      <View style={styles.actionTop}>
        {isRunning ? (
          <Animatable.Text
            animation="flash"
            iterationCount="infinite"
            duration={700}
            style={[styles.actionIcon, { color: iconColor }]}>
            {icon}
          </Animatable.Text>
        ) : (
          <Text style={[styles.actionIcon, { color: iconColor }]}>{icon}</Text>
        )}
        <Text style={styles.actionRepo} numberOfLines={1}>{shortRepo(item.repo)}</Text>
        <Text style={styles.actionAge}>{age}</Text>
      </View>

      {/* Row 2: workflow · branch */}
      <Text style={styles.actionWf} numberOfLines={1}>{`${wf}  ·  ${br}`}</Text>

      {/* Row 3: animated bar + status label */}
      <View style={styles.actionBarRow}>
        {isRunning ? (
          <Animatable.Text
            animation="flash"
            iterationCount="infinite"
            duration={1200}
            style={[styles.actionBar, { color: iconColor }]}>
            {bar}
          </Animatable.Text>
        ) : (
          <Text style={[styles.actionBar, { color: iconColor }]}>{bar}</Text>
        )}
        <View style={[styles.actionConclusionBadge, { borderColor: iconColor }]}>
          {(isRunning || isQueued) ? (
            <Animatable.Text
              animation={isRunning ? 'flash' : undefined}
              iterationCount="infinite"
              duration={900}
              style={[styles.actionConclusionText, { color: iconColor }]}>
              {conclusionLabel}
            </Animatable.Text>
          ) : (
            <Text style={[styles.actionConclusionText, { color: iconColor }]}>{conclusionLabel}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SysMonitorWidget() {
  const [animTick, setAnimTick] = useState(0);
  const tickRef = useRef(0);

  const gitActions  = useGitStore(s => s.actions);
  const gitUser     = useGitStore(s => s.username);
  const gitFetched  = useGitStore(s => s.fetchedAt);
  const gitError    = useGitStore(s => s.hasError);
  const gitLoading  = useGitStore(s => s.isLoading);

  const [page,       setPage]       = useState(0);
  const [panelSize,  setPanelSize]  = useState({ width: 0, height: 0 });
  const hScrollRef = useRef<ScrollView>(null);

  // 1s tick drives the in-progress action bar animation
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      setAnimTick(tickRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const PAGE_DOTS   = ['● ○ ○ ○', '○ ● ○ ○', '○ ○ ● ○', '○ ○ ○ ●'];
  const PAGE_TITLES = ['◈ CLAUDE::MONITOR', '◈ GIT::ACTIONS', '◈ COMMUNITY::FEED', '◈ SENTRY::ERR_LOG'];
  const pageIndicator = PAGE_DOTS[page]   ?? PAGE_DOTS[0];
  const pageTitle     = PAGE_TITLES[page] ?? PAGE_TITLES[0];

  const fetchedStr = gitError   ? 'ERROR'
    : gitLoading                ? 'SYNCING…'
    : gitFetched
      ? `SYNC ${String(gitFetched.getHours()).padStart(2,'0')}:${String(gitFetched.getMinutes()).padStart(2,'0')}`
      : 'SYNCING…';

  // Action status counts
  const runningCount = gitActions.filter(a => a.status === 'in_progress').length;
  const queuedCount  = gitActions.filter(a => a.status === 'queued').length;
  const failedCount  = gitActions.filter(a => a.conclusion === 'failure').length;
  const successCount = gitActions.filter(a => a.conclusion === 'success').length;

  return (
    <GlowBox title={pageTitle} titleRight={pageIndicator} style={styles.box} noPadding>
      <View
        style={{ flex: 1 }}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setPanelSize({ width, height });
        }}>

        {panelSize.width > 0 && (
          <ScrollView
            ref={hScrollRef}
            horizontal
            pagingEnabled
            scrollEventThrottle={200}
            onMomentumScrollEnd={e => {
              const p = Math.round(e.nativeEvent.contentOffset.x / panelSize.width);
              setPage(p);
            }}
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}>

            {/* ══════════════ PAGE 0 · CLAUDE::MONITOR ══════════════ */}
            <ClaudeMonitorPage width={panelSize.width} height={panelSize.height} />

            {/* ══════════════ PAGE 1 · GIT::ACTIONS ══════════════ */}
            <View style={{ width: panelSize.width, height: panelSize.height }}>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>

                {/* ── Header ── */}
                <View style={styles.gitHeader}>
                  <Text style={styles.gitUser}>{gitUser ? `@${gitUser}` : '...'}</Text>
                  <Text style={[styles.gitSync, gitError && { color: COLORS.red }]}>{fetchedStr}</Text>
                </View>

                <Divider />

                {/* ── Summary dashboard ── */}
                {gitActions.length > 0 && (
                  <View style={styles.summaryGrid}>
                    <View style={[styles.summaryCell, { borderColor: COLORS.amber }]}>
                      <Text style={[styles.summaryNum, { color: runningCount > 0 ? COLORS.amber : COLORS.greenFaint }]}>
                        {runningCount > 0 ? (
                          <Animatable.Text animation="flash" iterationCount="infinite" duration={700}
                            style={[styles.summaryNum, { color: COLORS.amber }]}>
                            {String(runningCount)}
                          </Animatable.Text>
                        ) : '0'}
                      </Text>
                      <Text style={styles.summaryLabel}>RUNNING</Text>
                    </View>
                    <View style={[styles.summaryCell, { borderColor: COLORS.greenDim }]}>
                      <Text style={[styles.summaryNum, { color: queuedCount > 0 ? COLORS.greenDim : COLORS.greenFaint }]}>
                        {String(queuedCount)}
                      </Text>
                      <Text style={styles.summaryLabel}>QUEUED</Text>
                    </View>
                    <View style={[styles.summaryCell, { borderColor: COLORS.green }]}>
                      <Text style={[styles.summaryNum, { color: successCount > 0 ? COLORS.green : COLORS.greenFaint }]}>
                        {String(successCount)}
                      </Text>
                      <Text style={styles.summaryLabel}>SUCCESS</Text>
                    </View>
                    <View style={[styles.summaryCell, { borderColor: COLORS.red }]}>
                      <Text style={[styles.summaryNum, { color: failedCount > 0 ? COLORS.red : COLORS.greenFaint }]}>
                        {String(failedCount)}
                      </Text>
                      <Text style={styles.summaryLabel}>FAILED</Text>
                    </View>
                  </View>
                )}

                <Divider />

                {/* ── Section title ── */}
                <Section title="WORKFLOW RUNS" />

                {gitError && (
                  <Text style={styles.gitErrorText}>⚠ CONNECTION FAILED</Text>
                )}
                {gitLoading && gitActions.length === 0 && (
                  <Animatable.Text animation="flash" iterationCount="infinite" duration={800}
                    style={styles.gitDimText}>
                    {'FETCHING ACTIONS…'}
                  </Animatable.Text>
                )}
                {!gitLoading && !gitError && gitActions.length === 0 && (
                  <Text style={styles.gitDimText}>NO WORKFLOW RUNS</Text>
                )}

                {gitActions.map((item, idx) => (
                  <ActionItem key={`a${idx}`} item={item} tick={animTick} />
                ))}

                <View style={{ height: SPACING.md }} />
              </ScrollView>
            </View>

            {/* ══════════════ PAGE 2 · COMMUNITY::FEED ══════════════ */}
            <CommunityPage width={panelSize.width} height={panelSize.height} />

            {/* ══════════════ PAGE 3 · SENTRY::ERR_LOG ══════════════ */}
            <SentryPage width={panelSize.width} height={panelSize.height} />

          </ScrollView>
        )}
      </View>
    </GlowBox>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box:           { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.sm, paddingTop: SPACING.xs },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4 },
  sectionTitle:{ fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 9, letterSpacing: 2, marginRight: 6 },
  sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.greenFaint, opacity: 0.4 },
  divider:     { height: 1, backgroundColor: COLORS.greenFaint, marginVertical: 4, opacity: 0.3 },

  // ── Git header ──
  gitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  gitUser:   { fontFamily: FONTS.mono, color: COLORS.greenBright, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  gitSync:   { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 9, letterSpacing: 0.5 },

  // ── Summary grid ──
  summaryGrid: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: SPACING.xs,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  summaryNum: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  summaryLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 7,
    letterSpacing: 1.5,
    marginTop: 2,
  },

  // ── Action card (large/prominent) ──
  actionCard: {
    borderLeftWidth: 4,
    paddingLeft: SPACING.sm,
    paddingVertical: 8,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(0, 255, 65, 0.03)',
    borderRadius: 1,
  },
  actionCardRunning: {
    backgroundColor: 'rgba(255, 176, 0, 0.06)',
  },
  actionCardFailed: {
    backgroundColor: 'rgba(255, 51, 51, 0.06)',
  },
  actionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionIcon: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    width: 22,
    fontWeight: '700',
  },
  actionRepo: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: 12,
    letterSpacing: 0.5,
    flex: 1,
    fontWeight: '700',
  },
  actionAge: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 10,
  },
  actionWf: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 10,
    letterSpacing: 0.3,
    marginBottom: 5,
    paddingLeft: 22,
  },
  actionBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 22,
    gap: 8,
  },
  actionBar: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: -0.5,
    flex: 1,
  },
  actionConclusionBadge: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  actionConclusionText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
  },

  gitErrorText: { fontFamily: FONTS.mono, color: COLORS.red, fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  gitDimText:   { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 10, letterSpacing: 1, marginBottom: 4 },
});
