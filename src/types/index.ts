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
