import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchSentryData, SentryData } from '@/api/sentryApi';
import PulseText from './PulseText';
import { COLORS, FONTS, SPACING } from '@/theme';
import { useInterval } from '@/hooks/useInterval';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  if (!iso) return '?';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function sentryIcon(level: string): [string, string] {
  switch (level) {
    case 'fatal':   return ['☠', COLORS.red];
    case 'error':   return ['✗', COLORS.red];
    case 'warning': return ['!', COLORS.amber];
    default:        return ['i', COLORS.greenDim];
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SentrySection({ title }: { title: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function SentryDivider() {
  return <View style={styles.divider} />;
}

function IssueItem({ item }: { item: SentryData['issues'][0] }) {
  const [icon, iconColor] = sentryIcon(item.level);
  const age   = relTime(item.lastSeen);
  const title = item.title.length > 34 ? `${item.title.slice(0, 33)}…` : item.title;
  const proj  = item.project.length > 14 ? `${item.project.slice(0, 13)}…` : item.project;
  return (
    <View style={styles.issueItem}>
      <View style={styles.issueHeader}>
        <Text style={[styles.issueIcon, { color: iconColor }]}>{icon}</Text>
        <Text style={styles.issueProject}>{`[${proj}]`}</Text>
        <Text style={styles.issueAge}>{age}</Text>
      </View>
      <Text style={[styles.issueTitle, { color: iconColor }]} numberOfLines={1}>{title}</Text>
      <Text style={styles.issueMeta}>{`${item.eventCount} events · ${item.userCount} users`}</Text>
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SentryPage({ width, height }: { width: number; height: number }) {
  const [sentryData,    setSentryData]    = useState<SentryData | null>(null);
  const [sentryLoading, setSentryLoading] = useState(true);
  const [sentryError,   setSentryError]   = useState(false);
  const fetchedRef = useRef(0);

  async function loadData() {
    try {
      setSentryLoading(true);
      setSentryError(false);
      const data = await fetchSentryData();
      setSentryData(data);
    } catch {
      setSentryError(true);
    } finally {
      setSentryLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // Refresh every 60s
  useInterval(() => {
    fetchedRef.current += 1;
    if (fetchedRef.current >= 60) {
      fetchedRef.current = 0;
      loadData();
    }
  }, 1000);

  const fetchedStr = sentryData
    ? `SYNC ${String(sentryData.fetchedAt.getHours()).padStart(2, '0')}:${String(sentryData.fetchedAt.getMinutes()).padStart(2, '0')}`
    : 'SYNCING…';

  if (sentryLoading && !sentryData) {
    return (
      <View style={{ width, height, padding: SPACING.sm }}>
        <PulseText style={styles.loadingText} duration={600}>{'> SCANNING SENTRY...'}</PulseText>
      </View>
    );
  }
  if (sentryError && !sentryData) {
    return (
      <View style={{ width, height, padding: SPACING.sm }}>
        <Text style={styles.errorText}>{'> ERR: SENTRY UNREACHABLE'}</Text>
      </View>
    );
  }
  if (!sentryData) return null;

  return (
    <View style={{ width, height }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>

        {/* ── Stats ── */}
        <SentrySection title="STATS" />
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>UNRESOLVED</Text>
            <Text style={[styles.statValue, { color: sentryData.stats.unresolvedCount > 0 ? COLORS.red : COLORS.green }]}>
              {String(sentryData.stats.unresolvedCount)}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>PROJECTS</Text>
            <Text style={[styles.statValue, { color: COLORS.cyan }]}>
              {String(sentryData.stats.projectCount)}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>TOTAL</Text>
            <Text style={[styles.statValue, { color: COLORS.greenDim }]}>
              {String(sentryData.issues.length)}
            </Text>
          </View>
        </View>

        <SentryDivider />

        {/* ── Issues ── */}
        <SentrySection title="OPEN ISSUES" />
        {sentryData.issues.length === 0 ? (
          <Text style={styles.emptyText}>✓ NO OPEN ISSUES</Text>
        ) : (
          sentryData.issues.map(issue => <IssueItem key={issue.id} item={issue} />)
        )}

        <SentryDivider />
        <Text style={styles.syncText}>{`${fetchedStr} [60s]`}</Text>
        <View style={{ height: SPACING.lg }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingText: { fontFamily: FONTS.mono, color: COLORS.amber, fontSize: FONTS.sizes.sm },
  errorText:   { fontFamily: FONTS.mono, color: COLORS.red, fontSize: FONTS.sizes.sm },

  content: { paddingHorizontal: SPACING.sm, paddingTop: SPACING.xs },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4 },
  sectionTitle: { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 9, letterSpacing: 2, marginRight: 6 },
  sectionLine:  { flex: 1, height: 1, backgroundColor: COLORS.greenFaint, opacity: 0.4 },
  divider:      { height: 1, backgroundColor: COLORS.greenFaint, marginVertical: 4, opacity: 0.3 },

  statsRow: { flexDirection: 'row', marginBottom: 4 },
  statCell: {
    flex: 1, alignItems: 'center', paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.greenFaint, marginHorizontal: 2,
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  statLabel: { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 8, letterSpacing: 1, marginBottom: 2 },
  statValue: { fontFamily: FONTS.mono, fontSize: 16, fontWeight: '700', letterSpacing: 1 },

  issueItem:    { marginBottom: 6 },
  issueHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
  issueIcon:    { fontFamily: FONTS.mono, fontSize: 11, width: 16, fontWeight: '700' },
  issueProject: { fontFamily: FONTS.mono, color: COLORS.cyan, fontSize: 9, letterSpacing: 0.5, flex: 1 },
  issueAge:     { fontFamily: FONTS.mono, color: COLORS.greenDim, fontSize: 9, marginLeft: 4 },
  issueTitle:   { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.3, paddingLeft: 16, marginBottom: 1 },
  issueMeta:    { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 9, paddingLeft: 16, letterSpacing: 0.3 },

  emptyText: { fontFamily: FONTS.mono, color: COLORS.green, fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  syncText:  { fontFamily: FONTS.mono, color: COLORS.greenFaint, fontSize: 9, letterSpacing: 1, marginTop: SPACING.xs },
});
