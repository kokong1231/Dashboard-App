import { NOTION_API_KEY } from '@env';
import { notionClient } from './client';
import {
  CommunityFeedItem,
  NotionBlock,
  NotionDatabaseListItem,
  NotionPageListItem,
  NotionRichText,
} from '@/types';

notionClient.defaults.headers.common['Authorization'] = `${NOTION_API_KEY}`;

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

// ── Community feed ────────────────────────────────────────────────────────────

const COMMUNITY_DB_ID = '7da5192d76f2422293e66e31e4368d8d';

export async function fetchCommunityFeedItems(): Promise<CommunityFeedItem[]> {
  const res = await notionClient.post(`/databases/${COMMUNITY_DB_ID}/query`, {
    page_size: 20,
    sorts: [{ direction: 'descending', timestamp: 'created_time' }],
  });

  return (res.data.results as Record<string, unknown>[]).map(page => {
    const props = page.properties as Record<string, Record<string, unknown>>;

    const titleArr = (props['제목']?.title as Array<{ plain_text: string }>) ?? [];
    const title = titleArr.map(t => t.plain_text).join('') || '(제목 없음)';

    const summaryArr = (props['내용요약']?.rich_text as Array<{ plain_text: string }>) ?? [];
    const summary = summaryArr.map(t => t.plain_text).join('');

    const platform = (props['플랫폼']?.select as { name: string } | null)?.name ?? '';
    const category = (props['카테고리']?.select as { name: string } | null)?.name ?? '';
    const views = (props['조회수']?.number as number) ?? 0;
    const comments = (props['댓글수']?.number as number) ?? 0;
    const writtenAt = (props['작성일']?.date as { start: string } | null)?.start ?? null;
    const url = (props['원문링크']?.url as string) ?? null;

    return {
      id: page.id as string,
      title,
      summary,
      platform,
      category,
      views,
      comments,
      writtenAt,
      url,
    };
  });
}
