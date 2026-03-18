import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  useBatteryLevel,
  usePowerState,
  getDeviceNameSync,
  getSystemVersion,
  getTotalMemorySync,
} from 'react-native-device-info';
import GlowBox from './GlowBox';
import { COLORS, FONTS, SPACING } from '@/theme';
import { GitAction, GitCommit } from '@/api/githubApi';
import { useGitStore } from '@/store/useGitStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const QUOTES = [
  { text: 'The best code is no code at all.', src: 'JEFF ATWOOD' },
  { text: 'First solve the problem, then write the code.', src: 'J. JOHNSON' },
  { text: 'Simplicity is the soul of efficiency.', src: 'A. FREEMAN' },
  { text: 'Make it work, make it right, make it fast.', src: 'KENT BECK' },
  { text: 'Any fool can write code a computer understands.', src: 'M. FOWLER' },
  { text: 'Programs must be written for people to read.', src: 'H. ABELSON' },
  { text: 'Code is like humor. When you have to explain it, its bad.', src: 'C. HOUSE' },
  { text: '"Weve always done it this way" is the most dangerous phrase.', src: 'G. HOPPER' },
  { text: 'Fix the cause, not the symptom.', src: 'S. MAGUIRE' },
  { text: 'Premature optimization is the root of all evil.', src: 'D. KNUTH' },
  { text: 'Talk is cheap. Show me the code.', src: 'L. TORVALDS' },
  { text: 'In theory and practice, they are the same. In practice, they are not.', src: 'Y. BERRA' },
];

const STATS_EVERY  = 3;
const QUOTE_EVERY  = 15;
const GIT_REFRESH  = 60; // seconds between GitHub polls
// Uniform column widths
const LABEL_W  = 32;  // left label
const VALUE_W  = 40;  // right value / percentage
const BAR_BARS = 9;   // number of block chars in bar

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
function fluctuate(current: number, min: number, max: number, delta: number): number {
  return clamp(Math.round(current + (Math.random() - 0.5) * delta * 2), min, max);
}

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
  if (status === 'in_progress') return ['●', COLORS.amber];
  if (status === 'queued')      return ['◎', COLORS.greenDim];
  if (conclusion === 'success') return ['✓', COLORS.green];
  if (conclusion === 'failure') return ['✗', COLORS.red];
  if (conclusion === 'cancelled') return ['∅', COLORS.greenFaint];
  return ['?', COLORS.greenDim];
}

interface Stats {
  cpu: number; mem: number; gpu: number; disk: number;
  temp: number; netUp: number; netDown: number; netPing: number;
  processes: number; threads: number; swapUsed: number; cacheUsed: number;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Section separator with title */
function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

/** Horizontal divider */
function Divider() {
  return <View style={styles.divider} />;
}

/** Label + bar + value, all fixed-width for perfect column alignment */
function BarRow({
  label, value, max, color,
}: {
  label: string; value: number; max: number; color: string;
}) {
  const filled = Math.round((value / max) * BAR_BARS);
  const empty = BAR_BARS - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = `${String(value).padStart(3, ' ')}%`;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowBar, { color }]}>{bar}</Text>
      <Text style={[styles.rowValue, { color }]}>{pct}</Text>
    </View>
  );
}

/** Label + plain value, right-aligned */
function KVRow({
  label, value, color = COLORS.green,
}: {
  label: string; value: string; color?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, styles.rowValueFull, { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/** Two KV pairs side-by-side in one row */
function KVDualRow({
  labelA, valueA, colorA,
  labelB, valueB, colorB,
}: {
  labelA: string; valueA: string; colorA?: string;
  labelB: string; valueB: string; colorB?: string;
}) {
  return (
    <View style={styles.dualRow}>
      <View style={styles.dualCell}>
        <Text style={styles.rowLabel}>{labelA}</Text>
        <Text style={[styles.dualValue, { color: colorA ?? COLORS.green }]}>{valueA}</Text>
      </View>
      <View style={styles.dualCell}>
        <Text style={styles.rowLabel}>{labelB}</Text>
        <Text style={[styles.dualValue, { color: colorB ?? COLORS.green }]}>{valueB}</Text>
      </View>
    </View>
  );
}

/** Battery block bar */
function BattBar({ pct, color }: { pct: number; color: string }) {
  const filled = Math.round((pct / 100) * BAR_BARS);
  const empty = BAR_BARS - filled;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>BAT</Text>
      <Text style={[styles.rowBar, { color }]}>{'█'.repeat(filled) + '░'.repeat(empty)}</Text>
      <Text style={[styles.rowValue, { color }]}>{`${pct}%`}</Text>
    </View>
  );
}

/** Single commit row */
function CommitItem({ item }: { item: GitCommit }) {
  const repo = shortRepo(item.repo);
  const age  = relTime(item.timestamp);
  const msg  = item.message.length > 36 ? `${item.message.slice(0, 35)}…` : item.message;
  return (
    <View style={styles.gitItem}>
      <View style={styles.gitItemHeader}>
        <Text style={styles.gitRepo} numberOfLines={1}>{repo}</Text>
        <Text style={styles.gitAge}>{age}</Text>
      </View>
      <Text style={styles.gitMsg} numberOfLines={1}>{msg}</Text>
    </View>
  );
}

/** Single action run row */
function ActionItem({ item }: { item: GitAction }) {
  const [icon, iconColor] = actionIcon(item.status, item.conclusion);
  const repo     = shortRepo(item.repo);
  const age      = relTime(item.timestamp);
  const wf       = item.workflow.length > 18 ? `${item.workflow.slice(0, 17)}…` : item.workflow;
  const branch   = item.branch.length > 12 ? `${item.branch.slice(0, 11)}…` : item.branch;
  return (
    <View style={styles.gitItem}>
      <View style={styles.gitItemHeader}>
        <Text style={[styles.gitActionIcon, { color: iconColor }]}>{icon}</Text>
        <Text style={styles.gitRepo} numberOfLines={1}>{repo}</Text>
        <Text style={styles.gitAge}>{age}</Text>
      </View>
      <Text style={styles.gitMsg} numberOfLines={1}>{`${wf} · ${branch}`}</Text>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SysMonitorWidget() {
  const batteryLevel = useBatteryLevel();
  const powerState   = usePowerState();

  // ── SYS state ──
  const [stats, setStats] = useState<Stats>({
    cpu: 38, mem: 61, gpu: 22, disk: 74,
    temp: 44, netUp: 12, netDown: 48, netPing: 18,
    processes: 218, threads: 1042, swapUsed: 28, cacheUsed: 15,
  });
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [uptime, setUptime]     = useState(0);
  const [deviceName, setDeviceName] = useState('ANDROID');
  const [osVersion, setOsVersion]   = useState('--');
  const [totalMemGB, setTotalMemGB] = useState('--');
  const tickRef = useRef(0);

  // ── GIT state (Zustand store) ──
  const gitCommits  = useGitStore(s => s.commits);
  const gitActions  = useGitStore(s => s.actions);
  const gitUser     = useGitStore(s => s.username);
  const gitFetched  = useGitStore(s => s.fetchedAt);
  const gitError    = useGitStore(s => s.hasError);
  const gitLoading  = useGitStore(s => s.isLoading);
  const loadGit     = useGitStore(s => s.load);
  const gitTickRef = useRef(0);

  // ── Paging state ──
  const [page, setPage]           = useState(0);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  const hScrollRef = useRef<ScrollView>(null);

  // ── Device info ──
  useEffect(() => {
    try { setDeviceName(getDeviceNameSync().toUpperCase()); } catch {}
    try { setOsVersion(`ANDROID ${getSystemVersion()}`); } catch {}
    try { setTotalMemGB(`${(getTotalMemorySync() / 1073741824).toFixed(1)} GB`); } catch {}
  }, []);

  // ── SYS ticker ──
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;
      setUptime(tick);

      if (tick % STATS_EVERY === 0) {
        setStats(prev => {
          const cpu = fluctuate(prev.cpu, 8, 92, 10);
          return {
            cpu,
            mem:       fluctuate(prev.mem,       40,  85,  4),
            gpu:       fluctuate(prev.gpu,         5,  75, 12),
            disk:      fluctuate(prev.disk,       60,  95,  1),
            temp:      clamp(Math.round(35 + cpu * 0.45 + (Math.random() - 0.5) * 4), 30, 88),
            netUp:     fluctuate(prev.netUp,       1, 150, 18),
            netDown:   fluctuate(prev.netDown,     1, 280, 28),
            netPing:   fluctuate(prev.netPing,     5, 120, 12),
            processes: fluctuate(prev.processes, 180, 310,  8),
            threads:   fluctuate(prev.threads,   900, 1400, 30),
            swapUsed:  fluctuate(prev.swapUsed,   10,  55,  3),
            cacheUsed: fluctuate(prev.cacheUsed,   8,  35,  2),
          };
        });
      }

      if (tick % QUOTE_EVERY === 0) {
        setQuoteIdx(i => (i + 1) % QUOTES.length);
      }

      // GitHub poll every GIT_REFRESH seconds
      gitTickRef.current += 1;
      if (gitTickRef.current % GIT_REFRESH === 0) {
        loadGit();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initial GitHub fetch ──
  useEffect(() => {
    loadGit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived SYS values ──
  const hh = Math.floor(uptime / 3600);
  const mm = Math.floor((uptime % 3600) / 60);
  const ss = uptime % 60;
  const uptimeStr = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;

  const cpuColor  = stats.cpu  > 80 ? COLORS.red : stats.cpu  > 60 ? COLORS.amber : COLORS.green;
  const memColor  = stats.mem  > 80 ? COLORS.red : stats.mem  > 65 ? COLORS.amber : COLORS.green;
  const gpuColor  = stats.gpu  > 70 ? COLORS.amber : COLORS.green;
  const diskColor = stats.disk > 90 ? COLORS.red  : stats.disk > 75 ? COLORS.amber : COLORS.green;
  const tempColor = stats.temp > 75 ? COLORS.red  : stats.temp > 60 ? COLORS.amber : COLORS.cyan;
  const pingColor = stats.netPing > 80 ? COLORS.red : stats.netPing > 40 ? COLORS.amber : COLORS.green;

  const battPct = batteryLevel != null && batteryLevel >= 0
    ? Math.round((batteryLevel as number) * 100) : null;
  const isCharging = powerState.batteryState === 'charging' || powerState.batteryState === 'full';
  const battColor = battPct == null ? COLORS.greenDim
    : battPct >= 60 ? COLORS.green : battPct >= 25 ? COLORS.amber : COLORS.red;

  const quote = QUOTES[quoteIdx];

  const pageIndicator = page === 0 ? '● ○' : '○ ●';
  const pageTitle     = page === 0 ? '◈ SYS::MONITOR' : '◈ GIT::INTEL';

  const fetchedStr = gitError
    ? 'ERROR'
    : gitLoading
      ? 'SYNCING…'
      : gitFetched
        ? `SYNC ${String(gitFetched.getHours()).padStart(2,'0')}:${String(gitFetched.getMinutes()).padStart(2,'0')}`
        : 'SYNCING…';

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

            {/* ══════════════ PAGE 0 · SYS::MONITOR ══════════════ */}
            <View style={{ width: panelSize.width, height: panelSize.height }}>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>

                {/* ── DEVICE ── */}
                <Section title="DEVICE" />
                <KVRow label="NODE" value={deviceName} color={COLORS.greenBright} />
                <KVRow label="OS  " value={osVersion} />
                <KVRow label="RAM " value={totalMemGB} />
                <KVRow label="UP  " value={uptimeStr} color={COLORS.cyan} />

                <Divider />

                {/* ── COMPUTE ── */}
                <Section title="COMPUTE" />
                <BarRow label="CPU " value={stats.cpu} max={100} color={cpuColor} />
                <BarRow label="GPU " value={stats.gpu} max={100} color={gpuColor} />
                <KVRow  label="TEMP" value={`${stats.temp} °C`} color={tempColor} />

                <Divider />

                {/* ── MEMORY ── */}
                <Section title="MEMORY" />
                <BarRow label="MEM " value={stats.mem}      max={100} color={memColor} />
                <BarRow label="SWAP" value={stats.swapUsed} max={100} color={COLORS.greenDim} />
                <BarRow label="CCHE" value={stats.cacheUsed} max={100} color={COLORS.greenFaint} />

                <Divider />

                {/* ── STORAGE ── */}
                <Section title="STORAGE" />
                <BarRow label="DISK" value={stats.disk} max={100} color={diskColor} />

                <Divider />

                {/* ── NETWORK ── */}
                <Section title="NETWORK" />
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{'UP  '}</Text>
                  <Text style={[styles.rowBar, { color: COLORS.green }]}>{`↑ ${String(stats.netUp).padStart(4,' ')} KB/s`}</Text>
                  <Text style={[styles.rowValue, { color: COLORS.green }]}> </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{'DOWN'}</Text>
                  <Text style={[styles.rowBar, { color: COLORS.amber }]}>{`↓ ${String(stats.netDown).padStart(4,' ')} KB/s`}</Text>
                  <Text style={[styles.rowValue, { color: COLORS.amber }]}> </Text>
                </View>
                <KVRow label="PING" value={`${stats.netPing} ms`} color={pingColor} />

                <Divider />

                {/* ── PROCESSES ── */}
                <Section title="PROCESSES" />
                <KVDualRow
                  labelA="PROC" valueA={String(stats.processes)} colorA={COLORS.green}
                  labelB="THRD" valueB={String(stats.threads)}   colorB={COLORS.greenDim}
                />

                {/* ── POWER ── */}
                {battPct != null && (
                  <>
                    <Divider />
                    <Section title="POWER" />
                    <BattBar pct={battPct} color={battColor} />
                    <KVRow
                      label="STAT"
                      value={isCharging ? '⚡ CHARGING' : 'DISCHARGING'}
                      color={isCharging ? COLORS.amber : battColor}
                    />
                  </>
                )}

                <Divider />

                {/* ── THOUGHT STREAM ── */}
                <Section title="THOUGHT STREAM" />
                <Animated.View key={quoteIdx} entering={FadeIn.duration(800)}>
                  <Text style={styles.quoteText}>{`"${quote.text}"`}</Text>
                  <Text style={styles.quoteSrc}>{`  — ${quote.src}`}</Text>
                </Animated.View>

                <View style={{ height: SPACING.md }} />
              </ScrollView>
            </View>

            {/* ══════════════ PAGE 1 · GIT::INTEL ══════════════ */}
            <View style={{ width: panelSize.width, height: panelSize.height }}>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>

                {/* ── IDENTITY ── */}
                <View style={styles.gitHeader}>
                  <Text style={styles.gitUser}>{gitUser ? `@${gitUser}` : '...'}</Text>
                  <Text style={styles.gitSync}>{fetchedStr}</Text>
                </View>

                <Divider />

                {/* ── RECENT COMMITS ── */}
                <Section title="ACTIVITY" />

                {gitError && (
                  <Text style={styles.gitErrorText}>⚠ CONNECTION FAILED</Text>
                )}

                {gitLoading && gitCommits.length === 0 && (
                  <Text style={styles.gitDimText}>FETCHING…</Text>
                )}

                {!gitLoading && !gitError && gitCommits.length === 0 && (
                  <Text style={styles.gitDimText}>NO ACTIVITY</Text>
                )}

                {gitCommits.map((item, idx) => (
                  <CommitItem key={`c${idx}`} item={item} />
                ))}

                <Divider />

                {/* ── ACTIONS ── */}
                <Section title="ACTIONS" />

                {gitLoading && gitActions.length === 0 && (
                  <Text style={styles.gitDimText}>FETCHING…</Text>
                )}

                {!gitLoading && !gitError && gitActions.length === 0 && (
                  <Text style={styles.gitDimText}>NO ACTIONS</Text>
                )}

                {gitActions.map((item, idx) => (
                  <ActionItem key={`a${idx}`} item={item} />
                ))}

                <View style={{ height: SPACING.md }} />
              </ScrollView>
            </View>

          </ScrollView>
        )}
      </View>
    </GlowBox>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.sm, paddingTop: SPACING.xs },

  // Section header
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 9,
    letterSpacing: 2,
    marginRight: 6,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.greenFaint,
    opacity: 0.4,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.greenFaint,
    marginVertical: 4,
    opacity: 0.3,
  },

  // Universal row: [label | content | value]
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  rowLabel: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 10,
    letterSpacing: 1,
    width: LABEL_W,
  },
  rowBar: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    flex: 1,
    letterSpacing: -0.5,
  },
  rowValue: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    width: VALUE_W,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  rowValueFull: {
    flex: 1,
    width: undefined,
  },

  // Dual KV row (two columns)
  dualRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  dualCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dualValue: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'right',
    paddingRight: 4,
  },

  // Quote
  quoteText: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 10,
    lineHeight: 16,
    fontStyle: 'italic',
    marginBottom: 3,
  },
  quoteSrc: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // ── Git panel ──────────────────────────────────────────────────────────────
  gitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  gitUser: {
    fontFamily: FONTS.mono,
    color: COLORS.greenBright,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  gitSync: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 9,
    letterSpacing: 0.5,
  },

  gitItem: {
    marginBottom: 5,
  },
  gitItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  gitActionIcon: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    width: 14,
  },
  gitRepo: {
    fontFamily: FONTS.mono,
    color: COLORS.cyan,
    fontSize: 9,
    letterSpacing: 0.5,
    flex: 1,
  },
  gitAge: {
    fontFamily: FONTS.mono,
    color: COLORS.greenDim,
    fontSize: 9,
    marginLeft: 4,
  },
  gitMsg: {
    fontFamily: FONTS.mono,
    color: COLORS.green,
    fontSize: 9,
    letterSpacing: 0.3,
    paddingLeft: 2,
  },

  gitErrorText: {
    fontFamily: FONTS.mono,
    color: COLORS.red,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  gitDimText: {
    fontFamily: FONTS.mono,
    color: COLORS.greenFaint,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
});
