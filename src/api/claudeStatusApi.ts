import { createApiClient } from './client';
import { ClaudeServerNotice, ClaudeServerStatus } from '@/types';

// Anthropic 상태 페이지 (Statuspage 공개 API) — 인증 불필요
const statusClient = createApiClient('https://status.claude.com/api/v2');

function toNotice(
  raw: Record<string, unknown>,
  kind: ClaudeServerNotice['kind'],
): ClaudeServerNotice {
  const updates = (raw.incident_updates as Array<Record<string, unknown>>) ?? [];
  const body = (updates[0]?.body as string) ?? null;
  return {
    name: (raw.name as string) ?? '(unnamed)',
    impact: (raw.impact as string) ?? 'none',
    status: (raw.status as string) ?? '',
    body,
    kind,
  };
}

export async function fetchClaudeServerStatus(): Promise<ClaudeServerStatus> {
  const res = await statusClient.get('/summary.json');
  const data = res.data as Record<string, unknown>;

  const status = data.status as { indicator: string; description: string };
  const components = (data.components as Array<Record<string, unknown>>) ?? [];
  const incidents = (data.incidents as Array<Record<string, unknown>>) ?? [];
  const maintenances = (data.scheduled_maintenances as Array<Record<string, unknown>>) ?? [];

  return {
    indicator: status?.indicator ?? 'none',
    description: status?.description ?? '',
    components: components
      .filter(c => !c.group)
      .map(c => ({ name: c.name as string, status: c.status as string })),
    notices: [
      ...incidents.map(i => toNotice(i, 'incident')),
      ...maintenances.map(m => toNotice(m, 'maintenance')),
    ],
  };
}
