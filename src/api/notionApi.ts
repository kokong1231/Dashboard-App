import { NOTION_API_KEY } from '@env';
import { notionClient } from './client';
import {
  ClaudeApiUsageRecord,
  ClaudeApiUsageSummary,
  ClaudeUsageSnapshot,
  NotionBlock,
  NotionBoard,
  NotionBoardCard,
  NotionBoardColumn,
  NotionDatabaseListItem,
  NotionPageListItem,
  NotionRichText,
  TechBrief,
  TechBriefMeta,
} from '@/types';

notionClient.defaults.headers.common['Authorization'] = `Bearer ${NOTION_API_KEY}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTitle(properties: Record<string, unknown>): string {
  for (const key of Object.keys(properties)) {
    const prop = properties[key] as Record<string, unknown>;
    if (prop?.type === 'title') {
      const titleArr = prop.title as Array<{ plain_text: string }>;
      if (Array.isArray(titleArr) && titleArr.length > 0) {
        return titleArr[0].plain_text || '(UNTITLED)';
      }
    }
  }
  return '(UNTITLED)';
}

function extractEmoji(icon: unknown): string | undefined {
  const ic = icon as Record<string, unknown> | null | undefined;
  if (ic?.type === 'emoji') return ic.emoji as string;
  return undefined;
}

/** Pull date / status / select / tags / checkbox from a database page's properties */
function extractDbProps(properties: Record<string, unknown>): Partial<NotionPageListItem> {
  let dateStart: string | undefined;
  let dateEnd: string | undefined;
  let status: string | undefined;
  let statusColor: string | undefined;
  let select: string | undefined;
  let selectColor: string | undefined;
  const tags: string[] = [];
  let checked: boolean | undefined;
  let priority: string | undefined;

  for (const val of Object.values(properties)) {
    const prop = val as Record<string, unknown>;
    switch (prop.type) {
      case 'date': {
        const d = prop.date as Record<string, string> | null;
        if (d?.start) { dateStart = d.start; dateEnd = d.end ?? undefined; }
        break;
      }
      case 'status': {
        const s = prop.status as Record<string, string> | null;
        if (s?.name) { status = s.name; statusColor = s.color; }
        break;
      }
      case 'select': {
        const s = prop.select as Record<string, string> | null;
        if (s?.name) {
          // Treat a property named "Priority" specially
          const key = Object.keys(properties).find(k =>
            (properties[k] as Record<string, unknown>)?.type === 'select' &&
            ((properties[k] as Record<string, unknown>)?.select as Record<string, string>)?.name === s.name
          );
          if (key?.toLowerCase().includes('priority')) {
            priority = s.name;
          } else {
            select = s.name; selectColor = s.color;
          }
        }
        break;
      }
      case 'multi_select': {
        const ms = prop.multi_select as Array<{ name: string }> | null;
        if (ms) tags.push(...ms.map(t => t.name));
        break;
      }
      case 'checkbox': {
        checked = prop.checkbox as boolean;
        break;
      }
    }
  }

  return { dateStart, dateEnd, status, statusColor, select, selectColor, tags: tags.length ? tags : undefined, checked, priority };
}

// ── Search endpoints ──────────────────────────────────────────────────────────

export async function fetchNotionDatabases(): Promise<NotionDatabaseListItem[]> {
  const results: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  do {
    const res = await notionClient.post('/search', {
      filter: { value: 'database', property: 'object' },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    results.push(...(res.data.results as Record<string, unknown>[]));
    cursor = res.data.has_more ? (res.data.next_cursor as string) : undefined;
  } while (cursor);

  return results.map(db => {
    const titleArr = db.title as Array<{ plain_text: string }>;
    const title =
      Array.isArray(titleArr) && titleArr.length > 0
        ? titleArr[0].plain_text.toUpperCase()
        : '(UNTITLED DB)';
    return {
      id: db.id as string,
      title,
      url: db.url as string,
      emoji: extractEmoji(db.icon),
    };
  });
}

export async function fetchNotionPages(): Promise<NotionPageListItem[]> {
  const results: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  do {
    const res = await notionClient.post('/search', {
      filter: { value: 'page', property: 'object' },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    results.push(...(res.data.results as Record<string, unknown>[]));
    cursor = res.data.has_more ? (res.data.next_cursor as string) : undefined;
  } while (cursor);

  return results.map(page => {
    const props  = page.properties as Record<string, unknown>;
    const parent = page.parent as Record<string, unknown> | undefined;
    const parentType = parent?.type as string ?? 'workspace';
    return {
      id:           page.id as string,
      url:          page.url as string,
      title:        extractTitle(props),
      lastEdited:   page.last_edited_time as string,
      emoji:        extractEmoji(page.icon),
      databaseId:   parent?.database_id as string | undefined,
      parentType,
      parentPageId: parent?.page_id as string | undefined,
    };
  });
}

// ── Database query ────────────────────────────────────────────────────────────

export async function queryDatabasePages(databaseId: string): Promise<NotionPageListItem[]> {
  const res = await notionClient.post(`/databases/${databaseId}/query`, {
    page_size: 50,
    sorts: [{ direction: 'descending', timestamp: 'last_edited_time' }],
  });

  return (res.data.results as Record<string, unknown>[]).map(page => {
    const props = page.properties as Record<string, unknown>;
    return {
      id:         page.id as string,
      url:        page.url as string,
      title:      extractTitle(props),
      lastEdited: page.last_edited_time as string,
      emoji:      extractEmoji(page.icon),
      databaseId,
      parentType: 'database_id',
      ...extractDbProps(props),
    };
  });
}

// ── Kanban board (TODO DB) ────────────────────────────────────────────────────

export const BOARD_DB_ID = 'ae9b5e11a97c4879afa2a398c7e7378d';

function plainOf(arr: unknown): string {
  return Array.isArray(arr) ? (arr as Array<{ plain_text: string }>).map(t => t.plain_text).join('') : '';
}

export async function fetchBoard(): Promise<NotionBoard> {
  const dbRes = await notionClient.get(`/databases/${BOARD_DB_ID}`);
  const db = dbRes.data as Record<string, unknown>;
  const schema = db.properties as Record<string, Record<string, unknown>>;

  let statusProp = '';
  let columns: NotionBoardColumn[] = [];
  for (const [name, def] of Object.entries(schema)) {
    if (def.type === 'status') {
      statusProp = name;
      const opts = (def.status as { options: Array<{ name: string; color: string }> }).options;
      columns = opts.map(o => ({ name: o.name, color: o.color }));
      // Board display order: '보류' first, then '할 일'
      const hold = columns.findIndex(c => c.name === '보류');
      const todo = columns.findIndex(c => c.name === '할 일');
      if (hold > -1 && todo > -1 && hold > todo) {
        [columns[hold], columns[todo]] = [columns[todo], columns[hold]];
      }
      break;
    }
  }

  const rows = await queryAll(BOARD_DB_ID, {});
  const cards: NotionBoardCard[] = rows.map(page => {
    const props = page.properties as Record<string, Record<string, unknown>>;
    const card: NotionBoardCard = {
      id: page.id as string,
      url: page.url as string,
      title: '(UNTITLED)',
      status: columns[0]?.name ?? '',
      emoji: extractEmoji(page.icon),
      createdTime: page.created_time as string,
    };
    for (const [name, prop] of Object.entries(props)) {
      switch (prop.type) {
        case 'title':
          card.title = plainOf(prop.title) || '(UNTITLED)';
          break;
        case 'status': {
          const st = prop.status as { name: string } | null;
          if (name === statusProp && st?.name) card.status = st.name;
          break;
        }
        case 'select': {
          const sel = prop.select as { name: string; color: string } | null;
          if (sel?.name && !card.project) { card.project = sel.name; card.projectColor = sel.color; }
          break;
        }
        case 'date': {
          const d = prop.date as { start: string } | null;
          if (d?.start && !card.due) card.due = d.start;
          break;
        }
        case 'rich_text': {
          const txt = plainOf(prop.rich_text).trim();
          if (txt && !card.memo) card.memo = txt;
          break;
        }
      }
    }
    return card;
  });

  // Due date ascending (no date last), then newest first
  cards.sort((a, b) => {
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return b.createdTime.localeCompare(a.createdTime);
  });

  const titleArr = db.title as Array<{ plain_text: string }>;
  return { title: plainOf(titleArr) || 'BOARD', statusProp, columns, cards };
}

export async function updateCardStatus(pageId: string, statusProp: string, status: string): Promise<void> {
  await notionClient.patch(`/pages/${pageId}`, {
    properties: { [statusProp]: { status: { name: status } } },
  });
}

// ── Page blocks ───────────────────────────────────────────────────────────────

export async function fetchPageBlocks(pageId: string): Promise<NotionBlock[]> {
  const res = await notionClient.get(`/blocks/${pageId}/children`, {
    params: { page_size: 100 },
  });
  const blocks = res.data.results as NotionBlock[];

  // Eagerly fetch children of table blocks so the renderer has all rows
  const tableBlocks = blocks.filter(b => b.type === 'table' && b.has_children);
  if (tableBlocks.length > 0) {
    await Promise.all(
      tableBlocks.map(async tb => {
        try {
          const rowRes = await notionClient.get(`/blocks/${tb.id}/children`, {
            params: { page_size: 50 },
          });
          tb.table_children = rowRes.data.results as NotionBlock[];
        } catch {
          tb.table_children = [];
        }
      }),
    );
  }

  return blocks;
}

// ── Page info ─────────────────────────────────────────────────────────────────

export async function fetchPageInfo(
  pageId: string,
): Promise<{ title: string; emoji?: string; url: string }> {
  const res = await notionClient.get(`/pages/${pageId}`);
  const page = res.data as Record<string, unknown>;
  const props = page.properties as Record<string, unknown>;
  return {
    title: extractTitle(props),
    emoji: extractEmoji(page.icon),
    url: page.url as string,
  };
}

// ── Rich text helper ──────────────────────────────────────────────────────────

export function richTextToPlain(richText: NotionRichText[]): string {
  return richText.map(rt => rt.plain_text).join('');
}

// ── Claude usage monitor ──────────────────────────────────────────────────────

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
    const res = await notionClient.post(`/databases/${CLAUDE_USAGE_DB_ID}/query`, {
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
    const res = await notionClient.post(`/databases/${CLAUDE_USAGE_DB_ID}/query`, {
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

// ── Tech Brief (매시간 Claude 요약) ───────────────────────────────────────────

const TECH_BRIEF_DB_ID = '3ff0bc2a2f868146bfd0e02f2d8ca9ff';
const CLAUDE_API_LOG_DB_ID = '3ff0bc2a2f868120a55cc968fc16badd';
const BRIEF_RETENTION_DAYS = 7;
const PAYLOAD_CAPTION = 'TECH_BRIEF_PAYLOAD';
const RICH_TEXT_CHUNK = 1900; // Notion rich_text 요소당 최대 2000자

function text(content: string) {
  return { type: 'text', text: { content: content.slice(0, RICH_TEXT_CHUNK) } };
}

function chunkedRichText(content: string) {
  const out = [];
  for (let i = 0; i < content.length; i += RICH_TEXT_CHUNK) {
    out.push({ type: 'text', text: { content: content.slice(i, i + RICH_TEXT_CHUNK) } });
  }
  return out;
}

function retentionCutoff(): string {
  return new Date(Date.now() - BRIEF_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function queryAll(dbId: string, body: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  do {
    const res = await notionClient.post(`/databases/${dbId}/query`, {
      page_size: 100,
      ...body,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    results.push(...(res.data.results as Record<string, unknown>[]));
    cursor = res.data.has_more ? (res.data.next_cursor as string) : undefined;
  } while (cursor);
  return results;
}

function toBriefMeta(page: Record<string, unknown>): TechBriefMeta {
  const props = page.properties as Record<string, Record<string, unknown>>;
  const plain = (arr: unknown) => ((arr as Array<{ plain_text: string }>) ?? []).map(t => t.plain_text).join('');
  return {
    pageId: page.id as string,
    headline: plain(props['제목']?.title) || '(UNTITLED)',
    slotKey: plain(props['슬롯키']?.rich_text),
    slotStart: (props['슬롯']?.date as { start: string } | null)?.start ?? '',
    itemCount: (props['항목수']?.number as number | null) ?? 0,
    urgent: (props['긴급']?.checkbox as boolean) ?? false,
  };
}

/** 최근 7일 브리프 목록 (최신순) */
export async function fetchTechBriefList(): Promise<TechBriefMeta[]> {
  const pages = await queryAll(TECH_BRIEF_DB_ID, {
    sorts: [{ property: '슬롯', direction: 'descending' }],
    filter: { property: '슬롯', date: { on_or_after: retentionCutoff() } },
  });
  return pages.map(toBriefMeta);
}

/** 같은 슬롯이 이미 저장됐는지 — 재시작/중복 생성 방지 */
export async function techBriefExists(slotKey: string): Promise<boolean> {
  const res = await notionClient.post(`/databases/${TECH_BRIEF_DB_ID}/query`, {
    page_size: 1,
    filter: { property: '슬롯키', rich_text: { equals: slotKey } },
  });
  return (res.data.results as unknown[]).length > 0;
}

/** 페이지 본문의 payload 코드 블록(JSON)을 복원 */
export async function fetchTechBrief(pageId: string): Promise<TechBrief> {
  const res = await notionClient.get(`/blocks/${pageId}/children`, { params: { page_size: 100 } });
  const blocks = res.data.results as NotionBlock[];
  const payload = [...blocks].reverse().find(b => {
    if (b.type !== 'code') return false;
    const code = (b as unknown as { code: { caption: NotionRichText[] } }).code;
    return richTextToPlain(code.caption ?? []) === PAYLOAD_CAPTION;
  });
  if (!payload) throw new Error('PAYLOAD NOT FOUND');
  const code = (payload as unknown as { code: { rich_text: NotionRichText[] } }).code;
  const brief = JSON.parse(richTextToPlain(code.rich_text)) as TechBrief;
  return { ...brief, notionPageId: pageId };
}

export async function saveTechBrief(brief: TechBrief): Promise<string> {
  const urgent = brief.items.some(
    i => i.category === 'URGENT' || i.urgency === 'critical' || i.urgency === 'high',
  );

  // 사람이 Notion에서 읽을 요약 블록 + 앱이 복원할 JSON payload 블록
  const readable = brief.items.flatMap((item, idx) => [
    {
      object: 'block',
      type: 'heading_3',
      heading_3: { rich_text: [text(`${String(idx + 1).padStart(2, '0')} [${item.category}] ${item.title}`)] },
    },
    { object: 'block', type: 'paragraph', paragraph: { rich_text: [text(item.summary)] } },
    ...(
      [
        ['배경', item.context],
        ['영향', item.impact],
        ['대응', item.action],
      ] as const
    )
      .filter(([, body]) => !!body)
      .map(([label, body]) => ({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `${label}  ` }, annotations: { bold: true, color: 'green' } },
            text(body as string),
          ],
        },
      })),
    ...item.points.slice(0, 5).map(pt => ({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: { rich_text: [text(pt)] },
    })),
    ...item.sources.slice(0, 3).map(src => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: `↗ ${src.title}`.slice(0, RICH_TEXT_CHUNK), link: /^https?:\/\//.test(src.url) ? { url: src.url } : null },
            annotations: { color: 'gray' },
          },
        ],
      },
    })),
  ]);

  const res = await notionClient.post('/pages', {
    parent: { database_id: TECH_BRIEF_DB_ID },
    icon: { type: 'emoji', emoji: urgent ? '🚨' : '📡' },
    properties: {
      '제목': { title: [text(brief.headline)] },
      '슬롯': { date: { start: brief.slotStart } },
      '슬롯키': { rich_text: [text(brief.slotKey)] },
      '항목수': { number: brief.items.length },
      '긴급': { checkbox: urgent },
      '모델': { select: { name: brief.model } },
    },
    children: [
      { object: 'block', type: 'callout', callout: { icon: { type: 'emoji', emoji: '📡' }, rich_text: [text(brief.headline)] } },
      ...readable,
      { object: 'block', type: 'divider', divider: {} },
      {
        object: 'block',
        type: 'code',
        code: {
          language: 'json',
          caption: [text(PAYLOAD_CAPTION)],
          rich_text: chunkedRichText(JSON.stringify(brief)),
        },
      },
    ],
  }, { timeout: 30000 });
  return res.data.id as string;
}

/** 보관 기간(7일)이 지난 브리프를 보관 처리(삭제) */
export async function purgeOldTechBriefs(): Promise<number> {
  const old = await queryAll(TECH_BRIEF_DB_ID, {
    filter: { property: '슬롯', date: { before: retentionCutoff() } },
  });
  for (const page of old) {
    await notionClient.patch(`/pages/${page.id as string}`, { archived: true });
  }
  return old.length;
}

// ── Claude API 사용 로그 ──────────────────────────────────────────────────────

export async function logClaudeApiUsage(rec: ClaudeApiUsageRecord, label: string): Promise<void> {
  const rl = rec.rateLimit;
  await notionClient.post('/pages', {
    parent: { database_id: CLAUDE_API_LOG_DB_ID },
    properties: {
      '제목': { title: [text(label)] },
      '시각': { date: { start: rec.at } },
      '모델': { select: { name: rec.model } },
      '입력토큰': { number: rec.inputTokens },
      '출력토큰': { number: rec.outputTokens },
      '캐시읽기': { number: rec.cacheReadTokens },
      '비용USD': { number: Math.round(rec.costUsd * 10000) / 10000 },
      '토큰잔여': { number: rl.tokensRemaining },
      '토큰한도': { number: rl.tokensLimit },
      '요청잔여': { number: rl.requestsRemaining },
      '요청한도': { number: rl.requestsLimit },
      '한도리셋': rl.reset ? { date: { start: rl.reset } } : { date: null },
    },
  });
}

/** 이번 달 1일 이후 사용 로그 → 오늘/7일/이번 달 합계 + 마지막 호출 */
export async function fetchClaudeApiUsageSummary(): Promise<ClaudeApiUsageSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  // 7일 창이 지난달에 걸칠 수 있으므로 더 이른 쪽부터 조회
  const from = weekStart < monthStart ? weekStart : monthStart;

  const pages = await queryAll(CLAUDE_API_LOG_DB_ID, {
    sorts: [{ property: '시각', direction: 'descending' }],
    filter: { property: '시각', date: { on_or_after: from.toISOString() } },
  });

  const records: ClaudeApiUsageRecord[] = pages.map(page => {
    const p = page.properties as Record<string, Record<string, unknown>>;
    const n = (k: string) => (p[k]?.number as number | null) ?? null;
    return {
      at: (p['시각']?.date as { start: string } | null)?.start ?? '',
      model: (p['모델']?.select as { name: string } | null)?.name ?? '',
      inputTokens: n('입력토큰') ?? 0,
      outputTokens: n('출력토큰') ?? 0,
      cacheReadTokens: n('캐시읽기') ?? 0,
      costUsd: n('비용USD') ?? 0,
      rateLimit: {
        tokensRemaining: n('토큰잔여'),
        tokensLimit: n('토큰한도'),
        requestsRemaining: n('요청잔여'),
        requestsLimit: n('요청한도'),
        reset: (p['한도리셋']?.date as { start: string } | null)?.start ?? null,
      },
    };
  });

  const sum = (since: Date) => {
    const rs = records.filter(r => new Date(r.at) >= since);
    return {
      calls: rs.length,
      tokens: rs.reduce((a, r) => a + r.inputTokens + r.outputTokens + r.cacheReadTokens, 0),
      costUsd: rs.reduce((a, r) => a + r.costUsd, 0),
    };
  };

  return {
    today: sum(dayStart),
    week: sum(weekStart),
    month: sum(monthStart),
    last: records[0] ?? null,
  };
}
