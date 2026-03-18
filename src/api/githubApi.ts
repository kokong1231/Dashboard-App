import axios from 'axios';
import { GITHUB_TOKEN } from '@env';

// ── Config ────────────────────────────────────────────────────────────────────
const GH_TOKEN = GITHUB_TOKEN ?? '';

const gh = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 12000,
  headers: {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitCommit {
  eventId: string;   // GitHub event ID — used for new-push detection
  repo: string;
  branch: string;
  message: string;
  author: string;
  timestamp: string;
  commitCount: number; // total commits in this push event
}

export interface GitAction {
  repo: string;
  workflow: string;
  status: string;        // 'queued' | 'in_progress' | 'completed'
  conclusion: string | null; // 'success' | 'failure' | 'cancelled' | null
  branch: string;
  timestamp: string;
}

export interface GitData {
  username: string;
  commits: GitCommit[];
  actions: GitAction[];
  fetchedAt: Date;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchGitData(): Promise<GitData> {
  // 1. get authenticated user
  const userRes = await gh.get('/user');
  const username = userRes.data.login as string;

  // 2. events (commits) + repos in parallel
  const [eventsRes, reposRes] = await Promise.all([
    gh.get(`/users/${username}/events`, { params: { per_page: 50 } }),
    gh.get('/user/repos', {
      params: {
        affiliation: 'owner,collaborator,organization_member',
        sort: 'pushed',
        per_page: 12,
      },
    }),
  ]);

  // 3. parse push events → one entry per push event
  const commits: GitCommit[] = [];
  for (const event of eventsRes.data as any[]) {
    if (event.type !== 'PushEvent') continue;
    const branch     = (event.payload?.ref as string)?.replace('refs/heads/', '') ?? '';
    const allCommits = (event.payload?.commits ?? []) as any[];
    const first      = allCommits[0];
    if (!first) continue;
    commits.push({
      eventId:     String(event.id),
      repo:        event.repo.name as string,
      branch,
      message:     (first.message as string)?.split('\n')[0] ?? '',
      author:      (first.author?.name as string) ?? username,
      timestamp:   event.created_at as string,
      commitCount: allCommits.length,
    });
    if (commits.length >= 15) break;
  }

  // 4. latest workflow run per repo (parallel, ignore repos without actions)
  const settled = await Promise.allSettled(
    (reposRes.data as any[]).map(async (repo: any) => {
      const runsRes = await gh.get(
        `/repos/${repo.full_name}/actions/runs`,
        { params: { per_page: 1 } },
      );
      const run = runsRes.data.workflow_runs?.[0];
      if (!run) return null;
      return {
        repo: repo.full_name as string,
        workflow: (run.name ?? run.display_title ?? '') as string,
        status: run.status as string,
        conclusion: (run.conclusion as string | null),
        branch: (run.head_branch as string) ?? '',
        timestamp: (run.updated_at as string) ?? '',
      } satisfies GitAction;
    }),
  );

  const actions: GitAction[] = settled
    .filter(
      (r): r is PromiseFulfilledResult<GitAction> =>
        r.status === 'fulfilled' && r.value !== null,
    )
    .map(r => r.value)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { username, commits, actions, fetchedAt: new Date() };
}
