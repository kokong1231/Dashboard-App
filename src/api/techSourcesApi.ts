import axios from 'axios';
import { parseRSSItems } from './newsApi';

// Claude에게 넘길 원천 헤드라인 수집 — 무료 공개 피드만 사용해 토큰/검색 비용을 최소화

export interface SourceHeadline {
  feed: string;
  title: string;
  url: string;
  publishedAt: string;
  points?: number;
}

interface RSSFeed {
  feed: string;
  url: string;
  limit: number;
}

const gnews = (q: string, lang: 'ko' | 'en') =>
  lang === 'ko'
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:1d&hl=ko&gl=KR&ceid=KR:ko`
    : `https://news.google.com/rss/search?q=${encodeURIComponent(
        q,
      )}+when:1d&hl=en-US&gl=US&ceid=US:en`;

const RSS_FEEDS: RSSFeed[] = [
  { feed: 'GN-KR-AI', url: gnews('AI 인공지능 LLM', 'ko'), limit: 8 },
  { feed: 'GN-KR-DEV', url: gnews('개발자 프레임워크 오픈소스 클라우드', 'ko'), limit: 6 },
  { feed: 'GN-KR-IT', url: gnews('IT 테크 빅테크 반도체', 'ko'), limit: 6 },
  {
    feed: 'GN-KR-URGENT',
    url: gnews('보안 취약점 해킹 서비스 장애 개인정보 유출', 'ko'),
    limit: 6,
  },
  { feed: 'GN-EN-AI', url: gnews('AI model release OpenAI Anthropic Google', 'en'), limit: 8 },
  { feed: 'GN-EN-DEV', url: gnews('developer framework release open source', 'en'), limit: 6 },
  { feed: 'GN-EN-SEC', url: gnews('zero-day vulnerability outage breach CVE', 'en'), limit: 6 },
];

async function fetchRSS(f: RSSFeed): Promise<SourceHeadline[]> {
  const res = await axios.get(f.url, {
    timeout: 10000,
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
  });
  return parseRSSItems(res.data as string, f.feed)
    .slice(0, f.limit)
    .map(i => ({ feed: f.feed, title: i.title, url: i.link, publishedAt: i.pubDate }));
}

async function fetchHNFrontPage(): Promise<SourceHeadline[]> {
  const res = await axios.get('https://hn.algolia.com/api/v1/search', {
    params: { tags: 'front_page', hitsPerPage: 20 },
    timeout: 10000,
  });
  const hits = res.data.hits as Array<{
    objectID: string;
    title: string;
    url: string | null;
    created_at: string;
    points: number;
  }>;
  return hits
    .filter(h => h.title)
    .map(h => ({
      feed: 'HN',
      title: h.title,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      publishedAt: h.created_at,
      points: h.points,
    }));
}

/** 모든 피드를 병렬 수집 — 일부 실패는 무시, 제목 기준 중복 제거 */
export async function collectTechHeadlines(): Promise<SourceHeadline[]> {
  const results = await Promise.allSettled([fetchHNFrontPage(), ...RSS_FEEDS.map(fetchRSS)]);
  const seen = new Set<string>();
  const all: SourceHeadline[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const h of r.value) {
      const key = h.title.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(h);
    }
  }
  return all;
}
