const LOCALE = 'en-GB';
const TIME_ZONE = 'Europe/London';

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

/** "31 October 2025", in London time. */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** Parse "2126", "35:26" or "00:35:26(.000)" into whole seconds. Returns null if unparseable. */
export function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed));
  const match = trimmed.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.\d+)?$/);
  if (!match) return null;
  const [, h = '0', m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** 2126 -> "35 min" (rounded; never "0 min"). */
export function formatDuration(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

/** ISO 8601 duration for <time datetime>, e.g. "PT35M26S". */
export function isoDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s || (!h && !m) ? `${s}S` : ''}`;
}

/** 142 -> "2:22"; 3725 -> "1:02:05". */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Initials for a text avatar: "Rachel Acham Seagroatt" -> "RS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}
