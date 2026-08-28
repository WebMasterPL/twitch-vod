export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatViewers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)} mln`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)} tys.`;
  return String(count);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function formatRelativeDate(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';
  const diffSeconds = (timestamp - Date.now()) / 1000;
  const formatter = new Intl.RelativeTimeFormat('pl', { numeric: 'auto' });

  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return formatter.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }
  return formatter.format(Math.round(diffSeconds), 'second');
}

export function formatDate(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';
  return new Date(timestamp).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Ile trwa transmisja, na podstawie started_at. */
export function formatUptime(startedAt: string): string {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return '';
  return formatDuration((Date.now() - start) / 1000);
}
