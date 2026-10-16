/**
 * A streak is what the user earns for showing up, so it is deliberately hard to farm: a day counts
 * only after real visible time in the popup, the first day of a streak is worth nothing, and a gap of
 * more than 24 hours starts the count again. It is accumulated state rather than a derived signal,
 * because the taste level is recomputed from scratch on every read and would otherwise re-award it.
 */

export const STREAK_QUALIFYING_MS = 2 * 60 * 1000;

export const STREAK_XP_PER_DAY = 50;

export const STREAK_RESET_MS = 24 * 60 * 60 * 1000;

export const EMPTY_USAGE_STREAK: UsageStreak = {
  trackedDay: null,
  visibleMs: 0,
  lastSeenAt: null,
  lastQualifyingDay: null,
  streakDays: 0,
  xp: 0,
};

export interface UsageStreak {
  /** Local calendar day the accumulated visible time belongs to. */
  readonly trackedDay: string | null;
  readonly visibleMs: number;
  /** Any open at all, qualifying or not. */
  readonly lastSeenAt: number | null;
  readonly lastQualifyingDay: string | null;
  readonly streakDays: number;
  readonly xp: number;
}

export interface UsageEvent {
  readonly streak: UsageStreak;
  readonly xpAwarded: number;
  /** True when this call is the one that counted the day. */
  readonly countedDay: boolean;
}

export function localDayKey(now: number): string {
  const date = new Date(now);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Folds one observation into the streak. `visibleMs` is the total visible popup time on the current
 * local day, not an increment, so a popup that is closed and reopened cannot lose or double count.
 */
export function recordUsage(streak: UsageStreak, now: number, visibleMs: number): UsageEvent {
  // A clock set backwards would otherwise reopen a spent day or resurrect a broken streak.
  const at = Math.max(now, streak.lastSeenAt ?? Number.NEGATIVE_INFINITY);
  const day = localDayKey(at);
  const withinWindow = streak.lastSeenAt !== null && at - streak.lastSeenAt <= STREAK_RESET_MS;
  const base: UsageStreak = {
    trackedDay: day,
    visibleMs: Math.max(0, visibleMs),
    lastSeenAt: at,
    lastQualifyingDay: streak.lastQualifyingDay,
    streakDays: streak.streakDays,
    xp: streak.xp,
  };

  // Any use keeps the streak alive; only the threshold decides whether the day counts.
  if (base.visibleMs < STREAK_QUALIFYING_MS) {
    return { streak: base, xpAwarded: 0, countedDay: false };
  }
  // One award per local calendar day, however many times the popup is opened.
  if (streak.lastQualifyingDay === day) {
    return { streak: base, xpAwarded: 0, countedDay: false };
  }
  if (!withinWindow) {
    return {
      streak: { ...base, streakDays: 1, lastQualifyingDay: day },
      xpAwarded: 0,
      countedDay: true,
    };
  }
  return {
    streak: {
      ...base,
      streakDays: streak.streakDays + 1,
      lastQualifyingDay: day,
      xp: streak.xp + STREAK_XP_PER_DAY,
    },
    xpAwarded: STREAK_XP_PER_DAY,
    countedDay: true,
  };
}

export function normalizeUsageStreak(value: unknown): UsageStreak {
  if (!isRecord(value)) return EMPTY_USAGE_STREAK;
  return {
    trackedDay: isDayKey(value.trackedDay) ? value.trackedDay : null,
    visibleMs: isDuration(value.visibleMs) ? Math.round(value.visibleMs) : 0,
    lastSeenAt: isTimestamp(value.lastSeenAt) ? value.lastSeenAt : null,
    lastQualifyingDay: isDayKey(value.lastQualifyingDay) ? value.lastQualifyingDay : null,
    streakDays: isCount(value.streakDays) ? value.streakDays : 0,
    xp: isCount(value.xp) ? value.xp : 0,
  };
}

/** A day only counts as seen once it can no longer change, so idle time is never claimed as usage. */
export function settledUsageStreak(streak: UsageStreak, now: number): UsageStreak {
  const day = localDayKey(now);
  if (streak.trackedDay === null || streak.trackedDay === day) return streak;
  return { ...streak, trackedDay: day, visibleMs: 0 };
}

/**
 * True while today's visible time could still change what the day is worth, which is the only
 * reason to write on a tick instead of waiting for the day to be counted.
 */
export function isUsagePending(streak: UsageStreak, now: number): boolean {
  return (
    streak.trackedDay === localDayKey(now) &&
    streak.lastQualifyingDay !== streak.trackedDay &&
    streak.visibleMs < STREAK_QUALIFYING_MS
  );
}

export function isUsageStreak(value: unknown): value is UsageStreak {
  return (
    isRecord(value) &&
    (value.trackedDay === null || isDayKey(value.trackedDay)) &&
    isDuration(value.visibleMs) &&
    (value.lastSeenAt === null || isTimestamp(value.lastSeenAt)) &&
    (value.lastQualifyingDay === null || isDayKey(value.lastQualifyingDay)) &&
    isCount(value.streakDays) &&
    isCount(value.xp)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
