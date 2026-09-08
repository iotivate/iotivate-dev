/** Parse an API timestamp. The backend stores/serializes UTC WITHOUT an offset
 *  (e.g. "2026-09-07T12:00:00"); left as-is, `new Date()` would read that as
 *  browser-local time. Treat an offset-less string as UTC. */
export function parseApiDate(iso: string): Date {
  const hasTz = /[zZ]$|[+-]\d\d:?\d\d$/.test(iso);
  return new Date(hasTz ? iso : iso + "Z");
}

/** Relative "time ago" from an API timestamp. Returns `empty` for null/invalid. */
export function timeAgo(iso: string | null, empty = "never"): string {
  if (!iso) return empty;
  const then = parseApiDate(iso).getTime();
  if (Number.isNaN(then)) return empty;
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
