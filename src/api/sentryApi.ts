import axios from 'axios';

// ── Config ────────────────────────────────────────────────────────────────────
const SENTRY_BASE  = process.env.SENTRY_BASE_URL ?? 'https://sentry.lucycare.co.kr';
const SENTRY_TOKEN = process.env.SENTRY_TOKEN ?? '';
const ORG_SLUG     = process.env.SENTRY_ORG_SLUG ?? 'sentry';

const sentry = axios.create({
  baseURL: `${SENTRY_BASE}/api/0`,
  timeout: 12000,
  headers: {
    Authorization: `Bearer ${SENTRY_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SentryIssue {
  id: string;
  title: string;
  project: string;
  level: string;           // 'fatal' | 'error' | 'warning' | 'info'
  status: string;          // 'unresolved' | 'resolved' | 'ignored'
  eventCount: string;
  userCount: number;
  lastSeen: string;
}

export interface SentryProject {
  slug: string;
  name: string;
  platform: string | null;
}

export interface SentryStats {
  unresolvedCount: number;
  projectCount: number;
}

export interface SentryData {
  issues: SentryIssue[];
  projects: SentryProject[];
  stats: SentryStats;
  fetchedAt: Date;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchSentryData(): Promise<SentryData> {
  const [issuesRes, projectsRes] = await Promise.all([
    sentry.get(`/organizations/${ORG_SLUG}/issues/`, {
      params: {
        query: 'is:unresolved',
        sort: 'date',
        limit: 25,
      },
    }),
    sentry.get(`/organizations/${ORG_SLUG}/projects/`),
  ]);

  const issues: SentryIssue[] = (issuesRes.data as any[]).map(i => ({
    id: String(i.id),
    title: (i.title ?? i.culprit ?? 'Unknown error') as string,
    project: (i.project?.slug ?? i.project?.name ?? '') as string,
    level: (i.level ?? 'error') as string,
    status: (i.status ?? 'unresolved') as string,
    eventCount: String(i.count ?? i.times_seen ?? 0),
    userCount: (i.userCount ?? 0) as number,
    lastSeen: (i.lastSeen ?? '') as string,
  }));

  const projects: SentryProject[] = (projectsRes.data as any[]).map(p => ({
    slug: p.slug as string,
    name: p.name as string,
    platform: (p.platform ?? null) as string | null,
  }));

  return {
    issues,
    projects,
    stats: {
      unresolvedCount: issues.filter(i => i.status === 'unresolved').length,
      projectCount: projects.length,
    },
    fetchedAt: new Date(),
  };
}
