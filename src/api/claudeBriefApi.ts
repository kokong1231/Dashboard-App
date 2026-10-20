import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_API_KEY } from '@env';
import { SourceHeadline } from './techSourcesApi';
import { ClaudeApiRateLimit, ClaudeApiUsageRecord, TechBriefItem } from '@/types';

export const BRIEF_MODEL = 'claude-opus-5-5';

// RN fetch에는 ReadableStream이 없어 스트리밍 불가 → 비스트리밍 + 넉넉한 타임아웃
// (timeout을 명시해야 SDK의 큰 max_tokens 비스트리밍 차단 검사를 건너뜀)
const client = new Anthropic({
  apiKey: CLAUDE_API_KEY,
  timeout: 9 * 60 * 1000,
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

각 항목 — 화면에서 천천히 읽는 카드이므로 충분히 자세하게 쓴다
- title: 28자 이내 한국어 제목.
- summary: 3~4문장. 무슨 일이 있었는지(누가/무엇을/언제)를 구체적으로.
- context: 2~3문장. 배경 — 왜 이런 일이 생겼는지, 이전 흐름이나 관련 기술 맥락.
- impact: 2~3문장. 개발자·서비스·업계에 미치는 영향. 누가 영향을 받는지 명확히.
- action: 1~2문장. 개발자가 지금 확인하거나 해볼 만한 일 (패치, 버전 확인, 마이그레이션, 지켜볼 지점 등). 해당 없으면 "당장 조치할 사항은 없다. ~를 지켜보자." 식으로.
- points: 핵심 포인트 3~5개, 각 60자 이내. 숫자·버전·이름 같은 구체 정보 우선.
- sources: 근거가 된 헤드라인의 title/url을 입력 목록에서 그대로 복사 (1~3개).
- urgency: low | medium | high | critical.
- animation: 이 항목을 처음 보는 사람도 원리를 이해할 수 있게 만드는 "애니메이션 가이드" HTML 조각.
- 문장은 평이한 한국어로, 전문 용어는 처음 나올 때 괄호로 짧게 풀어쓴다.

animation 작성 규칙
- <div id="stage"> 안에 그대로 삽입되는 조각이다. <html>, <head>, <body> 태그를 쓰지 않는다.
- 사용 가능: <style>, 인라인 <svg>, 바닐라 <script>. 외부 리소스(폰트, 이미지, CDN, fetch)는 CSP로 차단되므로 금지.
- 루트 SVG는 viewBox="0 0 480 200", width="100%" height="100%". 무대 크기는 가변이라 비율 유지로 맞춰진다.
- 배경은 검정(#000). 색상은 터미널 톤만 사용: #00ff41(기본), #39ff14(강조), #00aa2b(보조), #003b0e(희미), #ffb000(경고), #ff3333(위험), #00ffff(정보). 폰트는 monospace, 글자 크기 9~13.
- 화면 구성(권장 레이아웃):
  · 상단 띠(y 0~22): 단계 표시기 "① 원인 ─ ② 전개 ─ ③ 영향 ─ ④ 대응" 처럼 3~5단계. 현재 단계만 밝게 강조.
  · 중앙(y 24~172): 개념 도식. 구성요소(서버, 사용자, 모델, 공격자, 패키지, 데이터 등) 4개 이상을 상자/원/간단한 아이콘형 도형으로 그리고 각각 한국어 라벨(2~8자)을 붙인다. 연결선과 화살표로 관계를 보여준다.
  · 하단 띠(y 176~200): 캡션 바. 현재 단계를 설명하는 한국어 문장(12~26자)이 단계마다 바뀐다.
- 단계 시나리오: 단계마다 도식의 다른 부분이 활성화되며 이야기가 진행되어야 한다 (예: ① 요청 흐름 정상 → ② 취약 지점 강조 → ③ 공격 패킷이 우회 → ④ 패치 후 차단). 마지막 단계 뒤 잠시 멈췄다가 처음부터 반복. 전체 주기 10~16초.
- 단계 전환은 바닐라 <script>의 setInterval로 현재 단계 번호를 바꾸고 클래스/속성을 토글하는 방식을 권장. 실제로 움직이는 요소 3종 이상: 경로를 따라 이동하는 패킷/점(animateMotion 또는 offset-path), 채워지는 진행 바나 게이지, 맥동하는 경고 링, 점선 흐름(stroke-dashoffset), 증가하는 카운터 등.
- 수치(%, 배, ms, 버전)는 헤드라인에 근거가 있을 때만 쓰고, 없으면 "↑ 증가"처럼 정성적으로 표현한다.
- 디테일: 구성요소는 단순 사각형 대신 의미가 드러나는 도형으로 그린다 (서버=줄무늬 랙, DB=원통, 사용자=머리+몸, 칩=핀 달린 사각형, 패키지=상자, 문서=접힌 모서리, 자물쇠/방패 등). 단계마다 해당 지점 옆에 작은 주석 말풍선이나 태그(9~10px, 4~12자)를 띄우고, 흐름 화살표에는 무엇이 오가는지 라벨(예: "요청", "토큰", "패치")을 붙인다.
- 요소들이 서로 겹치거나 글자가 잘리지 않게 좌표를 계산해서 배치한다.
- 전체 길이 3500~7000자. 너무 단순하게 끝내지 않는다. CSS 선택자와 JS 변수는 다른 항목과 충돌하지 않게 고유 접두사(예: .a1-, a1Step)를 붙이고, script는 즉시실행함수로 감싼다.

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
        required: [
          'category',
          'urgency',
          'title',
          'summary',
          'context',
          'impact',
          'action',
          'points',
          'sources',
          'animation',
        ],
        properties: {
          category: { type: 'string', enum: ['AI', 'DEV', 'IT', 'SECURITY', 'URGENT'] },
          urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          title: { type: 'string' },
          summary: { type: 'string' },
          context: { type: 'string' },
          impact: { type: 'string' },
          action: { type: 'string' },
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
      max_tokens: 40000,
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
