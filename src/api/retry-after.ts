/**
 * `Retry-After` parsing, shared by every error mapper that honours it.
 *
 * RFC 9110 permits two forms, and providers use both: a delta in seconds
 * (`Retry-After: 30`) and an HTTP-date (`Retry-After: Wed, 21 Oct 2026
 * 07:28:00 GMT`). MyAnimeList and GitHub may send the date form, so a
 * numeric-only parser silently drops the one hint that tells a client how long
 * to actually wait — which then falls back to a sub-second backoff against a
 * rate-limit window measured in tens of seconds.
 */

/** Parses either RFC 9110 form into whole seconds, or `null` if unusable. */
export function parseRetryAfterSeconds(
  value: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Delta-seconds form. Must be all digits: a partial match would turn
  // "30, then" or "1e3" into a plausible-looking but wrong delay.
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }

  // HTTP-date form. Every IMF-fixdate and RFC 850 form carries an explicit
  // HH:MM:SS time, so requiring a clock component keeps `Date.parse` from
  // accepting stray numerics (it happily reads "-5" as a year).
  if (!/\d{2}:\d{2}/.test(trimmed)) return null;

  // Converted to a delay relative to `now`, clamped at zero so a date already
  // in the past yields "retry now" rather than a negative wait.
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.round((timestamp - now) / 1000));
}

/** True for statuses where the same request is worth sending again. */
export function isRetryableStatus(status: number | null | undefined): boolean {
  if (status === null || status === undefined) return false;
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}