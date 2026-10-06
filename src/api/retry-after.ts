// RFC 9110 allows delta-seconds or an HTTP-date, and MAL/GitHub send the date form too — ignoring it leaves us backing off sub-second against a window measured in tens of seconds.

/** Returns whole seconds for either RFC 9110 form, or `null` if unusable. */
export function parseRetryAfterSeconds(
  value: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // All digits only, so "30, then" or "1e3" can't become a plausible-looking but wrong delay.
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }

  // Every legal date form carries HH:MM:SS, and requiring it stops Date.parse reading stray numerics like "-5" as a year.
  if (!/\d{2}:\d{2}/.test(trimmed)) return null;

  // Clamped at zero so a date already in the past means "retry now", not a negative wait.
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.round((timestamp - now) / 1000));
}

/** True for statuses where sending the same request again could succeed. */
export function isRetryableStatus(status: number | null | undefined): boolean {
  if (status === null || status === undefined) return false;
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}