import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_API_KEY } from '@env';
import { SourceHeadline } from './techSourcesApi';
import { ClaudeApiRateLimit, ClaudeApiUsageRecord, TechBriefItem } from '@/types';

export const BRIEF_MODEL = 'claude-opus-5-5';

// RN fetch에는 ReadableStream이 없어 스트리밍 불가 → 비스트리밍 + 넉넉한 타임아웃
const client = new Anthropic({
  apiKey: CLAUDE_API_KEY,
  timeout: 5 * 60 * 1000,
  maxRetries: 1,
});

// ── Pricing ($ / 1M tokens) — 사용량 모니터의 추정 비용 계산용 ─────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-fable-5-1': { input: 10, output: 50 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

function estimateCost(model: string, usage: Anthropic.Beta.BetaUsage): number {
  const p = PRICING[model] ?? PRICING[BRIEF_MODEL];
  const input = usage.input_tokens * p.input;
  const cacheWrite = (usage.cache_creation_input_tokens ?? 0) * p.input * 1.25;
  const cacheRead = (usage.cache_read_input_tokens ?? 0) * p.input * 0.1;
  const output = usage.output_tokens * p.output;
  return (input + cacheWrite + cacheRead + output) / 1_000_000;
}

function readRateLimit(headers: Headers): ClaudeApiRateLimit {
  const num = (k: string) => {
    const v = headers.get(`anthropic-ratelimit-${k}`);
    return v == null ? null : Number(v);
  };
  return {
    tokensRemaining: num('tokens-remaining'),
    tokensLimit: num('tokens-limit'),
    requestsRemaining: num('requests-remaining'),
    requestsLimit: num('requests-limit'),
    reset: headers.get('anthropic-ratelimit-tokens-reset'),
  };
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `너는 개발자 대시보드의 "TECH::BRIEF" 편집자다. 매시간 수집된 헤드라인 목록을 받아, 개발자·IT 종사자에게 지금 가장 중요한 기술/개발/AI/IT/긴급 이슈를 한국어로 종합 요약한다.

선별 기준
- 5~6개 항목을 고른다. 같은 사건을 다룬 여러 헤드라인은 하나로 합친다.
- 보안 취약점, 대규모 서비스 장애, 개인정보 유출처럼 즉시 대응이 필요한 이슈가 있으면 category "URGENT" 또는 "SECURITY"로 맨 앞에 둔다. 없으면 억지로 만들지 않는다.
- 헤드라인에 없는 사실을 지어내지 않는다. 확실하지 않은 내용은 "보도에 따르면"처럼 표현한다.
- 광고성·연예·정치 일반 기사는 제외한다.

각 항목
- title: 28자 이내 한국어 제목.
- summary: 2~3문장. 무슨 일이 있었는지와 개발자에게 왜 중요한지.
- points: 핵심 포인트 2~4개, 각 40자 이내.
- sources: 근거가 된 헤드라인의 title/url을 입력 목록에서 그대로 복사 (1~3개).
- urgency: low | medium | high | critical.
- animation: 이 항목을 한눈에 이해시키는 "애니메이션 가이드" HTML 조각.

animation 작성 규칙
- <div id="stage"> 안에 그대로 삽입되는 조각이다. <html>, <head>, <body> 태그를 쓰지 않는다.
- 사용 가능: <style>, 인라인 <svg>, 바닐라 <script>. 외부 리소스(폰트, 이미지, CDN, fetch)는 CSP로 차단되므로 금지.
- 무대 크기는 가변(대략 가로 360~520px, 세로 170~220px). 루트 SVG는 viewBox="0 0 480 200"과 width="100%" height="100%"를 사용해 비율 유지로 맞춘다.
- 배경은 검정(#000). 색상은 터미널 톤만 사용: #00ff41(기본), #39ff14(강조), #00aa2b(보조), #003b0e(희미), #ffb000(경고), #ff3333(위험), #00ffff(정보). 폰트는 monospace.
- 개념을 설명하는 도식이어야 한다: 데이터/요청 흐름, 공격 경로, 전후 비교, 타임라인, 구성요소 관계 등. 단계별로 순서대로 나타나는 라벨(한국어 2~8자)을 붙인다.
- 애니메이션은 4~8초 주기로 무한 반복. CSS @keyframes 또는 requestAnimationFrame만 사용.
- 단순 페이드인만으로 끝내지 말고 실제로 움직이는 요소를 2개 이상 넣는다: 경로를 따라 이동하는 패킷/점, 채워지는 진행 바, 맥동하는 경고 링, 점선 흐름(stroke-dashoffset) 등.
- 전체 길이 3000자 이내. CSS 선택자는 다른 항목과 충돌하지 않게 고유 접두사(예: .a1-)를 붙인다.

headline: 이번 시간 전체 흐름을 한 줄(40자 이내)로 요약.`;

const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'items'],
  properties: {
    headline: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'urgency', 'title', 'summary', 'points', 'sources', 'animation'],
        properties: {
          category: { type: 'string', enum: ['AI', 'DEV', 'IT', 'SECURITY', 'URGENT'] },
          urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          title: { type: 'string' },
          summary: { type: 'string' },
          points: { type: 'array', items: { type: 'string' } },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'url'],
              properties: { title: { type: 'string' }, url: { type: 'string' } },
            },
          },
          animation: { type: 'string' },
        },
      },
    },
  },
};

function formatHeadlines(headlines: SourceHeadline[]): string {
  return headlines
    .map(
      (h, i) =>
        `${i + 1}. [${h.feed}${h.points ? ` ${h.points}pt` : ''}] ${h.title}\n   ${h.url}\n   ${
          h.publishedAt
        }`,
    )
    .join('\n');
}

// ── Generate ──────────────────────────────────────────────────────────────────

export interface GeneratedBrief {
  headline: string;
  items: TechBriefItem[];
  model: string;
  usage: ClaudeApiUsageRecord;
}

export async function generateTechBrief(
  headlines: SourceHeadline[],
  slotKey: string,
): Promise<GeneratedBrief> {
  if (!CLAUDE_API_KEY) throw new Error('CLAUDE_API_KEY MISSING');

  // 정책 거절 시 서버 측 폴백 모델로 자동 재시도 (fallbacks: 'default')
  const { data, response } = await client.beta.messages
    .create({
      model: BRIEF_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: BRIEF_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `현재 시각 슬롯: ${slotKey} (KST)\n아래는 최근 24시간 헤드라인 ${
            headlines.length
          }건이다.\n\n${formatHeadlines(headlines)}`,
        },
      ],
    })
    .withResponse();

  const usage: ClaudeApiUsageRecord = {
    at: new Date().toISOString(),
    model: data.model,
    inputTokens: data.usage.input_tokens + (data.usage.cache_creation_input_tokens ?? 0),
    outputTokens: data.usage.output_tokens,
    cacheReadTokens: data.usage.cache_read_input_tokens ?? 0,
    costUsd: estimateCost(data.model, data.usage),
    rateLimit: readRateLimit(response.headers),
  };

  if (data.stop_reason === 'refusal') throw Object.assign(new Error('CLAUDE REFUSED'), { usage });
  if (data.stop_reason === 'max_tokens')
    throw Object.assign(new Error('OUTPUT TRUNCATED'), { usage });

  const text = data.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
  const parsed = JSON.parse(text) as { headline: string; items: TechBriefItem[] };

  return { headline: parsed.headline, items: parsed.items, model: data.model, usage };
}
