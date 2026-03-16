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

export interface WeatherData {
  current: WeatherCurrent;
  hourly: WeatherHourly;
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
}

export interface NotionDatabaseListItem {
  id: string;
  title: string;
  url: string;
  emoji?: string;
}
