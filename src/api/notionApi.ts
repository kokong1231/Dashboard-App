import { NOTION_API_KEY } from '@env';
import { notionClient } from './client';
import {
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

// ── Search endpoints ──────────────────────────────────────────────────────────

export async function fetchNotionDatabases(): Promise<NotionDatabaseListItem[]> {
  const res = await notionClient.post('/search', {
    filter: { value: 'database', property: 'object' },
    page_size: 20,
  });

  return (res.data.results as Record<string, unknown>[]).map(db => {
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
  const res = await notionClient.post('/search', {
    filter: { value: 'page', property: 'object' },
    sort: { direction: 'descending', timestamp: 'last_edited_time' },
    page_size: 30,
  });

  return (res.data.results as Record<string, unknown>[])
    .map(page => {
      const props = page.properties as Record<string, unknown>;
      const parent = page.parent as Record<string, unknown> | undefined;
      return {
        id: page.id as string,
        url: page.url as string,
        title: extractTitle(props),
        lastEdited: page.last_edited_time as string,
        emoji: extractEmoji(page.icon),
        databaseId: parent?.database_id as string | undefined,
      };
    })
    .filter(p => p.title !== '(UNTITLED)' || p.emoji);
}

// ── Database query ────────────────────────────────────────────────────────────

export async function queryDatabasePages(databaseId: string): Promise<NotionPageListItem[]> {
  const res = await notionClient.post(`/databases/${databaseId}/query`, {
    page_size: 50,
    sorts: [{ direction: 'descending', timestamp: 'last_edited_time' }],
  });

  return (res.data.results as Record<string, unknown>[])
    .map(page => {
      const props = page.properties as Record<string, unknown>;
      return {
        id: page.id as string,
        url: page.url as string,
        title: extractTitle(props),
        lastEdited: page.last_edited_time as string,
        emoji: extractEmoji(page.icon),
        databaseId,
      };
    });
}

// ── Page blocks ───────────────────────────────────────────────────────────────

export async function fetchPageBlocks(pageId: string): Promise<NotionBlock[]> {
  const res = await notionClient.get(`/blocks/${pageId}/children`, {
    params: { page_size: 100 },
  });
  return res.data.results as NotionBlock[];
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
