import { CLAUDE_NOTION_API_KEY } from '@env';
import { createApiClient } from './client';
import { ClaudeUsageSnapshot } from '@/types';

// Claude 사용량 DB는 별도 워크스페이스에 있어 전용 키(CLAUDE_NOTION_API_KEY)를 사용
const claudeNotionClient = createApiClient('https://api.notion.com/v1', {
  'Notion-Version': '2022-06-28',
});
claudeNotionClient.defaults.headers.common['Authorization'] = `Bearer ${CLAUDE_NOTION_API_KEY}`;

const CLAUDE_USAGE_DB_ID = '3520bc2a2f868104ade8c73dde81460a';

/** DB stores rates as 0–1 fractions; normalize to whole percent either way. */
function toPct(n: number | null): number | null {
  if (n == null) return null;
  return Math.round(n <= 1 ? n * 100 : n);
}

/** 오늘 0시 이후의 측정값 전체(5분 간격, 최대 ~288행)를 최신순으로 반환 */
export async function fetchClaudeUsage(): Promise<ClaudeUsageSnapshot[]> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const results: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  do {
    const res = await claudeNotionClient.post(`/databases/${CLAUDE_USAGE_DB_ID}/query`, {
      page_size: 100,
      sorts: [{ property: '타임스탬프', direction: 'descending' }],
      filter: { property: '타임스탬프', date: { on_or_after: dayStart.toISOString() } },
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    results.push(...(res.data.results as Record<string, unknown>[]));
    cursor = res.data.has_more ? (res.data.next_cursor as string) : undefined;
  } while (cursor);

  // 자정 직후 등 오늘 데이터가 아직 없으면 최신 스냅샷 하나로 폴백
  if (results.length === 0) {
    const res = await claudeNotionClient.post(`/databases/${CLAUDE_USAGE_DB_ID}/query`, {
      page_size: 1,
      sorts: [{ property: '타임스탬프', direction: 'descending' }],
    });
    results.push(...(res.data.results as Record<string, unknown>[]));
  }

  return results.map(page => {
    const props = page.properties as Record<string, Record<string, unknown>>;
    const titleArr = (props['측정 시각']?.title as Array<{ plain_text: string }>) ?? [];

    return {
      id: page.id as string,
      measuredAt: titleArr.map(t => t.plain_text).join('') || '--',
      timestamp: (props['타임스탬프']?.date as { start: string } | null)?.start ?? null,
      fiveHourPct: toPct((props['5시간 사용률']?.number as number | null) ?? null),
      sevenDayPct: toPct((props['7일 사용률']?.number as number | null) ?? null),
      fiveHourReset: (props['5시간 리셋']?.date as { start: string } | null)?.start ?? null,
      sevenDayReset: (props['7일 리셋']?.date as { start: string } | null)?.start ?? null,
      plan: (props['구독']?.select as { name: string } | null)?.name ?? '',
      rateTier: (props['Rate Tier']?.select as { name: string } | null)?.name ?? '',
    };
  });
}
