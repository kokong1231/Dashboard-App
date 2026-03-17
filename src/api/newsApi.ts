import axios from 'axios';
import { HackerNewsHit } from '@/types';

// ── Hacker News AI filter ─────────────────────────────────────────────────────

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'gemini', 'llama', 'openai', 'anthropic', 'deepmind',
  'machine learning', 'deep learning', 'neural', 'transformer', 'diffusion',
  'artificial intelligence', 'chatgpt', 'mistral', 'copilot', 'sora', 'stable diffusion',
];

const SOCIAL_KEYWORDS = [
  'climate', 'economy', 'inflation', 'recession', 'war', 'security', 'privacy',
  'health', 'science', 'space', 'nasa', 'crypto', 'bitcoin', 'election', 'government',
  'energy', 'nuclear', 'china', 'russia', 'ukraine', 'pandemic', 'policy', 'regulation',
  'lawsuit', 'arrest', 'senate', 'congress', 'white house', 'supreme court', 'tariff',
  'stock', 'market', 'gdp', 'unemployment', 'hack', 'breach', 'cyberattack',
];

function isAIRelated(title: string): boolean {
  const lower = title.toLowerCase();
  return AI_KEYWORDS.some(kw => lower.includes(kw));
}

function isSocialRelated(title: string): boolean {
  const lower = title.toLowerCase();
  return SOCIAL_KEYWORDS.some(kw => lower.includes(kw));
}

async function fetchHNStories(query: string, hitsPerPage: number): Promise<HackerNewsHit[]> {
  const res = await axios.get('https://hn.algolia.com/api/v1/search', {
    params: {
      query,
      tags: 'story',
      hitsPerPage,
      numericFilters: 'points>5',
    },
    timeout: 10000,
  });
  return res.data.hits as HackerNewsHit[];
}

// ── Korean RSS fetcher ────────────────────────────────────────────────────────

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  thumbnail: string | undefined;
  sourceName: string;
}

function extractBetween(text: string, open: string, close: string): string | null {
  const s = text.indexOf(open);
  if (s === -1) return null;
  const e = text.indexOf(close, s + open.length);
  if (e === -1) return null;
  return text.slice(s + open.length, e);
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function extractThumbnail(description: string): string | undefined {
  // Try <media:content url="..." /> first
  const mediaMatch = description.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch) return mediaMatch[1];
  // Try first <img src="..."> in description HTML
  const imgMatch = description.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  return undefined;
}

function parseRSSItems(xml: string, sourceName: string): RSSItem[] {
  const items: RSSItem[] = [];
  // Split on <item> boundaries
  const parts = xml.split('<item>');
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const rawTitle = extractBetween(chunk, '<title>', '</title>') ?? '';
    const rawLink = extractBetween(chunk, '<link>', '</link>') ??
      extractBetween(chunk, '<link/>', '</link>') ??
      extractBetween(chunk, '<link ', '>') ?? '';
    const rawPubDate = extractBetween(chunk, '<pubDate>', '</pubDate>') ?? new Date().toISOString();
    const rawDesc = extractBetween(chunk, '<description>', '</description>') ?? '';

    const title = stripCdata(rawTitle).replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const link = stripCdata(rawLink).trim();
    const description = stripCdata(rawDesc);
    const thumbnail = extractThumbnail(description) ?? extractThumbnail(chunk);

    if (title && link) {
      items.push({ title, link, pubDate: rawPubDate, description, thumbnail, sourceName });
    }
  }
  return items;
}

interface KoreanFeedConfig {
  url: string;
  category: string;
  source: string;
}

const KOREAN_FEEDS: KoreanFeedConfig[] = [
  { url: 'https://news.google.com/rss/search?q=한국+AI+인공지능+기술+스타트업&hl=ko&gl=KR&ceid=KR:ko', category: '기술', source: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=K팝+아이돌+드라마+영화+연예&hl=ko&gl=KR&ceid=KR:ko', category: '연예', source: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=한국+정치+국회+대통령+여야&hl=ko&gl=KR&ceid=KR:ko', category: '정치', source: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=한국+경제+주가+증시+금리+부동산&hl=ko&gl=KR&ceid=KR:ko', category: '경제', source: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=한국+사회+사건+사고+이슈&hl=ko&gl=KR&ceid=KR:ko', category: '사회', source: 'Google News' },
];

async function fetchKoreanFeed(feed: KoreanFeedConfig): Promise<HackerNewsHit[]> {
  const res = await axios.get(feed.url, {
    timeout: 10000,
    headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
  });
  const items = parseRSSItems(res.data as string, feed.source);
  return items.slice(0, 6).map((item, idx) => ({
    objectID: `kr_${feed.category}_${idx}_${Date.now()}`,
    title: item.title,
    url: item.link,
    author: feed.source,
    points: 0,
    num_comments: 0,
    created_at: item.pubDate,
    story_text: null,
    thumbnail: item.thumbnail,
    source: feed.source,
    category: feed.category,
  }));
}

// ── Combined export ───────────────────────────────────────────────────────────

export async function fetchAINews(): Promise<HackerNewsHit[]> {
  const results = await Promise.allSettled([
    // English HN (AI + social)
    fetchHNStories('AI artificial intelligence LLM machine learning neural', 25)
      .then(h => h.filter(i => i.title && isAIRelated(i.title)).slice(0, 8).map(i => ({ ...i, category: 'AI', source: 'HN' }))),
    fetchHNStories('climate economy security health science space government policy hack', 20)
      .then(h => h.filter(i => i.title && isSocialRelated(i.title)).slice(0, 6).map(i => ({ ...i, category: '국제', source: 'HN' }))),
    // Korean RSS
    ...KOREAN_FEEDS.map(fetchKoreanFeed),
  ]);

  const all: HackerNewsHit[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const item of r.value) {
        const key = item.url ?? item.title;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(item);
        }
      }
    }
  }

  return all.slice(0, 30);
}
