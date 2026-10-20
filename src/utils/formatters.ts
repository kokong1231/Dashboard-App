// ── Temperature ────────────────────────────────────────────────────────────
export function formatTemp(celsius: number): string {
  return `${celsius.toFixed(1)}°C`;
}

// ── Wind ───────────────────────────────────────────────────────────────────
export function formatWind(kmh: number): string {
  return `${kmh.toFixed(1)} KM/H`;
}

export function windDegToDir(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ── Datetime ───────────────────────────────────────────────────────────────
export function formatTimeHHMM(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  const days = Math.floor(hrs / 24);
  return `${days}D AGO`;
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// ── Weather codes (WMO) ────────────────────────────────────────────────────
export function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'CLEAR SKY';
  if (code <= 3) return 'PARTLY CLOUDY';
  if (code <= 48) return 'FOG';
  if (code <= 57) return 'DRIZZLE';
  if (code <= 67) return 'RAIN';
  if (code <= 77) return 'SNOW';
  if (code <= 82) return 'SHOWERS';
  if (code <= 86) return 'SNOW SHOWERS';
  if (code <= 99) return 'THUNDERSTORM';
  return 'UNKNOWN';
}

export function weatherCodeToEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 1) return '🌤️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '❄️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

export function weatherCodeToAscii(code: number): string {
  if (code === 0) return ' \\|/ \n  *  \n /|\\ ';
  if (code <= 3) return '  _  \n (   )\n  ---';
  if (code <= 48) return ' === \n === \n === ';
  if (code <= 67) return '  _  \n(   )\n/////';
  if (code <= 77) return '  _  \n(   )\n* * *';
  if (code <= 99) return '  _  \n(!!!)\n /!\\ ';
  return ' ??? \n ??? \n ??? ';
}

export function uvIndexLabel(uv: number): string {
  if (uv < 3) return 'LOW';
  if (uv < 6) return 'MODERATE';
  if (uv < 8) return 'HIGH';
  if (uv < 11) return 'VERY HIGH';
  return 'EXTREME';
}

// ── String padding ─────────────────────────────────────────────────────────
export function padEnd(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

// ── Hourly slot (Tech Brief) ───────────────────────────────────────────────
/** 해당 시각이 속한 정각 슬롯 시작 시각 */
export function hourSlotStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

/** "2026-10-20 13:00" (로컬 시각) */
export function hourSlotKey(date: Date = new Date()): string {
  const d = hourSlotStart(date);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return `${y}-${mo}-${day} ${hh}:00`;
}

/** 토큰 수 축약: 1234 → "1.2K", 2400000 → "2.4M" */
export function formatTokens(n: number | null): string {
  if (n == null) return '--';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatUsd(n: number): string {
  return n >= 100 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
}
