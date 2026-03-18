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
  eventId: string;
  repo: string;
  branch: string;
  message: string;
  author: string;
  timestamp: string;
  commitCount: number;
}

export interface GitAction {
  repo: string;
  workflow: string;
  status: string;
  conclusion: string | null;
  branch: string;
  timestamp: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** One-time call to resolve the authenticated username. */
export async function fetchGitUsername(): Promise<string> {
  const res = await gh.get('/user');
  return res.data.login as string;
}

/**
 * Fetch push events for the user.
 * Passes `If-None-Match` when an ETag is available — GitHub returns 304
 * with no body (and without consuming a rate-limit slot) when nothing changed.
 * Returns `null` on 304.
 */
export async function fetchGitEvents(
  username: string,
  etag: string | null,
): Promise<{ commits: GitCommit[]; etag: string } | null> {
  const res = await gh.get(`/users/${username}/events`, {
    params: { per_page: 50 },
    headers: etag ? { 'If-None-Match': etag } : {},
    // accept 304 without throwing
    validateStatus: s => (s >= 200 && s < 300) || s === 304,
  });

  if (res.status === 304) return null;

  const newEtag: string = (res.headers['etag'] as string) ?? etag ?? '';

  const commits: GitCommit[] = [];
  for (const event of res.data as any[]) {
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

  return { commits, etag: newEtag };
}

/**
 * Fetch the latest workflow run per repo.
 * Called infrequently (every 5 min) — per_page reduced to 5 repos.
 */
export async function fetchGitActions(username: string): Promise<GitAction[]> {
  const reposRes = await gh.get('/user/repos', {
    params: {
      affiliation: 'owner,collaborator,organization_member',
      sort: 'pushed',
      per_page: 5,
    },
  });

  const settled = await Promise.allSettled(
    (reposRes.data as any[]).map(async (repo: any) => {
      const runsRes = await gh.get(
        `/repos/${repo.full_name}/actions/runs`,
        { params: { per_page: 1 } },
      );
      const run = runsRes.data.workflow_runs?.[0];
      if (!run) return null;
      return {
        repo:       repo.full_name as string,
        workflow:   (run.name ?? run.display_title ?? '') as string,
        status:     run.status as string,
        conclusion: run.conclusion as string | null,
        branch:     (run.head_branch as string) ?? '',
        timestamp:  (run.updated_at as string) ?? '',
      } satisfies GitAction;
    }),
  );

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<GitAction> =>
        r.status === 'fulfilled' && r.value !== null,
    )
    .map(r => r.value)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
