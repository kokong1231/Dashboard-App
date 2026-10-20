// ── Generic ────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

// ── Geo / Weather ──────────────────────────────────────────────────────────
export interface GeoLocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  timezone: string;
}

export interface WeatherCurrent {
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  weather_code: number;
  uv_index: number;
}

export interface WeatherHourly {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
}

export interface WeatherDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
  precipitation_probability_max: number[];
}

export interface WeatherData {
  current: WeatherCurrent;
  hourly: WeatherHourly;
  daily: WeatherDaily;
  location: GeoLocation;
}

// ── News ───────────────────────────────────────────────────────────────────
export interface HackerNewsHit {
  objectID: string;
  title: string;
  url: string | null;
  author: string;
  points: number;
  num_comments: number;
  created_at: string;
  story_text: string | null;
  /** Optional thumbnail image URL (Korean RSS items) */
  thumbnail?: string;
  /** News source label */
  source?: string;
  /** Category tag: AI / 기술 / 연예 / 정치 / 경제 / 사회 / 국제 */
  category?: string;
}

// ── Notion blocks ──────────────────────────────────────────────────────────
export interface NotionRichText {
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    code: boolean;
    color: string;
  };
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  to_do?: { rich_text: NotionRichText[]; checked: boolean };
  toggle?: { rich_text: NotionRichText[] };
  code?: { rich_text: NotionRichText[]; language: string };
  quote?: { rich_text: NotionRichText[] };
  callout?: { rich_text: NotionRichText[]; icon?: { type: string; emoji?: string } };
  divider?: Record<string, never>;
  image?: {
    type: 'external' | 'file';
    external?: { url: string };
    file?: { url: string };
    caption?: NotionRichText[];
  };
  bookmark?: { url: string; caption: NotionRichText[] };
  child_page?: { title: string };
  child_database?: { title: string };
  link_preview?: { url: string };
  embed?: { url: string };
  /** Table block metadata */
  table?: {
    table_width: number;
    has_column_header: boolean;
    has_row_header: boolean;
  };
  /** Table row cells (each cell is an array of rich-text spans) */
  table_row?: {
    cells: NotionRichText[][];
  };
  /** Pre-fetched table_row children (populated by fetchPageBlocks) */
  table_children?: NotionBlock[];
}

// ── Notion pages ───────────────────────────────────────────────────────────
export interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
  icon?: { type: string; emoji?: string };
  parent?: { type: string; database_id?: string };
}

export interface NotionDatabase {
  id: string;
  title: Array<{ plain_text: string }>;
  properties: Record<string, unknown>;
  url: string;
  icon?: { type: string; emoji?: string };
}

export interface NotionPageListItem {
  id: string;
  url: string;
  title: string;
  lastEdited: string;
  emoji?: string;
  databaseId?: string;
  /** 'workspace' | 'page_id' | 'database_id' | 'block_id' */
  parentType?: string;
  /** Parent page ID (when parentType === 'page_id') */
  parentPageId?: string;
  /** Extracted database property values for list display */
  dateStart?: string;
  dateEnd?: string;
  status?: string;
  statusColor?: string;
  select?: string;
  selectColor?: string;
  tags?: string[];
  checked?: boolean;
  priority?: string;
}

export interface NotionDatabaseListItem {
  id: string;
  title: string;
  url: string;
  emoji?: string;
}

// ── Claude Usage Monitor ────────────────────────────────────────────────────
export interface ClaudeUsageSnapshot {
  id: string;
  /** '측정 시각' title, e.g. "2026-08-18 09:51" */
  measuredAt: string;
  /** '타임스탬프' ISO datetime */
  timestamp: string | null;
  /** 5시간 세션 사용률 0–100 (%) */
  fiveHourPct: number | null;
  /** 7일 사용률 0–100 (%) */
  sevenDayPct: number | null;
  fiveHourReset: string | null;
  sevenDayReset: string | null;
  /** '구독' select, e.g. "max" */
  plan: string;
  /** 'Rate Tier' select, e.g. "default_claude_max_5x" */
  rateTier: string;
}

// ── Claude Server Status (status.claude.com) ────────────────────────────────
export interface ClaudeServerComponent {
  name: string;
  /** operational | degraded_performance | partial_outage | major_outage | under_maintenance */
  status: string;
}

/** 진행 중 장애 또는 예정·진행 중 점검 안내 */
export interface ClaudeServerNotice {
  name: string;
  /** none | minor | major | critical | maintenance */
  impact: string;
  /** investigating | identified | monitoring | scheduled | in_progress | verifying … */
  status: string;
  /** 최신 업데이트 본문 (특별 안내 내용) */
  body: string | null;
  kind: 'incident' | 'maintenance';
}

export interface ClaudeServerStatus {
  /** none | minor | major | critical | maintenance */
  indicator: string;
  /** e.g. "All Systems Operational" */
  description: string;
  components: ClaudeServerComponent[];
  notices: ClaudeServerNotice[];
}

// ── Tech Brief (Claude 매시간 요약) ───────────────────────────────────────────
export type TechBriefCategory = 'AI' | 'DEV' | 'IT' | 'SECURITY' | 'URGENT';
export type TechBriefUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface TechBriefSource {
  title: string;
  url: string;
}

export interface TechBriefItem {
  category: TechBriefCategory;
  urgency: TechBriefUrgency;
  title: string;
  summary: string;
  points: string[];
  sources: TechBriefSource[];
  /** 요약 내용을 시각화하는 자체 완결형 HTML 조각 (<style>/<svg>/<script>) */
  animation: string;
}

export interface TechBrief {
  /** 로컬 시각 기준 정각 슬롯, e.g. "2026-10-20 13:00" */
  slotKey: string;
  slotStart: string;
  headline: string;
  items: TechBriefItem[];
  model: string;
  createdAt: string;
  notionPageId?: string;
}

/** Notion 목록용 경량 메타 (본문 JSON은 상세 진입 시 로드) */
export interface TechBriefMeta {
  pageId: string;
  slotKey: string;
  slotStart: string;
  headline: string;
  itemCount: number;
  urgent: boolean;
}

// ── Claude API 사용량 ─────────────────────────────────────────────────────────
export interface ClaudeApiRateLimit {
  tokensRemaining: number | null;
  tokensLimit: number | null;
  requestsRemaining: number | null;
  requestsLimit: number | null;
  reset: string | null;
}

export interface ClaudeApiUsageRecord {
  at: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  rateLimit: ClaudeApiRateLimit;
}

export interface ClaudeApiUsageSummary {
  today: { calls: number; tokens: number; costUsd: number };
  week: { calls: number; tokens: number; costUsd: number };
  month: { calls: number; tokens: number; costUsd: number };
  last: ClaudeApiUsageRecord | null;
}
