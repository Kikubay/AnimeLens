import { describe, expect, it } from 'vitest';
import {
  EMPTY_USAGE_STREAK,
  STREAK_QUALIFYING_MS,
  STREAK_RESET_MS,
  STREAK_XP_PER_DAY,
  isUsagePending,
  localDayKey,
  normalizeUsageStreak,
  recordUsage,
  settledUsageStreak,
  type UsageStreak,
} from '../src/profile/usage-streak';

const OVER_THRESHOLD = STREAK_QUALIFYING_MS + 1000;

/** Local noon, so a day key never shifts while the test walks across midnight. */
const day = (daysFromEpoch: number, hours = 12): number =>
  new Date(2026, 0, 1 + daysFromEpoch, hours, 0, 0, 0).getTime();

function session(streak: UsageStreak, now: number, visibleMs = OVER_THRESHOLD) {
  return recordUsage(streak, now, visibleMs);
}

describe('recordUsage', () => {
  it('starts the streak at day one and awards nothing', () => {
    const event = session(EMPTY_USAGE_STREAK, day(0));

    expect(event.countedDay).toBe(true);
    expect(event.xpAwarded).toBe(0);
    expect(event.streak.streakDays).toBe(1);
    expect(event.streak.xp).toBe(0);
    expect(event.streak.lastSeenAt).toBe(day(0));
  });

  it('follows the worked example: first day 0, then 50 a day, then a reset back to 0', () => {
    let streak = session(EMPTY_USAGE_STREAK, day(0)).streak;
    expect(streak.xp).toBe(0);

    for (let offset = 1; offset <= 3; offset += 1) {
      const event = session(streak, day(offset));
      expect(event.xpAwarded).toBe(STREAK_XP_PER_DAY);
      streak = event.streak;
    }
    expect(streak.streakDays).toBe(4);
    expect(streak.xp).toBe(3 * STREAK_XP_PER_DAY);

    // 24 hours of silence, then a qualifying session: back to a first day.
    const afterGap = session(streak, day(4, 13));
    expect(afterGap.xpAwarded).toBe(0);
    expect(afterGap.streak.streakDays).toBe(1);
    expect(afterGap.streak.xp).toBe(3 * STREAK_XP_PER_DAY);
  });

  it('never counts a day twice, however many times the popup is opened', () => {
    const first = session(EMPTY_USAGE_STREAK, day(0));
    const second = session(first.streak, day(0, 20));
    const third = session(second.streak, day(0, 23));

    expect(second.xpAwarded).toBe(0);
    expect(third.xpAwarded).toBe(0);
    expect(third.streak.streakDays).toBe(1);
    // Only the heartbeat moves; the visible total is whatever the caller reports.
    expect(third.streak.lastSeenAt).toBe(day(0, 23));
  });

  it('keeps the streak alive on a session shorter than the threshold', () => {
    const counted = session(EMPTY_USAGE_STREAK, day(0));
    const peek = session(counted.streak, day(1, 9), 30_000);

    expect(peek.countedDay).toBe(false);
    expect(peek.xpAwarded).toBe(0);
    // The day is not counted yet, but the streak survives, so the evening session still earns.
    expect(peek.streak.streakDays).toBe(1);
    const evening = session(peek.streak, day(1, 21));
    expect(evening.xpAwarded).toBe(STREAK_XP_PER_DAY);
    expect(evening.streak.streakDays).toBe(2);
  });

  it('breaks the streak only once the gap exceeds 24 hours', () => {
    const counted = session(EMPTY_USAGE_STREAK, day(0));

    const withinWindow = session(counted.streak, day(1, 11));
    expect(withinWindow.streak.streakDays).toBe(2);
    expect(withinWindow.xpAwarded).toBe(STREAK_XP_PER_DAY);

    const lastSeenAt = withinWindow.streak.lastSeenAt ?? 0;
    const pastWindow = session(withinWindow.streak, lastSeenAt + STREAK_RESET_MS + 1);
    expect(pastWindow.streak.streakDays).toBe(1);
    expect(pastWindow.xpAwarded).toBe(0);
  });

  it('awards once per local calendar day, so crossing midnight opens the next one', () => {
    const lateNight = session(EMPTY_USAGE_STREAK, new Date(2026, 0, 1, 23, 58).getTime());
    expect(lateNight.xpAwarded).toBe(0);

    const justAfterMidnight = session(lateNight.streak, new Date(2026, 0, 2, 0, 6).getTime());
    expect(justAfterMidnight.xpAwarded).toBe(STREAK_XP_PER_DAY);
    expect(justAfterMidnight.streak.streakDays).toBe(2);

    const laterSameDay = session(justAfterMidnight.streak, new Date(2026, 0, 2, 21).getTime());
    expect(laterSameDay.xpAwarded).toBe(0);
    expect(laterSameDay.streak.streakDays).toBe(2);
  });

  it('cannot be farmed by moving the clock backwards', () => {
    const counted = session(EMPTY_USAGE_STREAK, day(5));
    const rewound = session(counted.streak, day(0));

    expect(rewound.streak.lastSeenAt).toBe(day(5));
    expect(rewound.streak.streakDays).toBe(1);
    expect(rewound.streak.xp).toBe(0);
  });

  it('never lets the accumulated xp go down', () => {
    let streak = EMPTY_USAGE_STREAK;
    for (let offset = 0; offset < 10; offset += 1) {
      const event = session(streak, day(offset));
      expect(event.streak.xp).toBeGreaterThanOrEqual(streak.xp);
      streak = event.streak;
    }
    expect(streak.xp).toBe(9 * STREAK_XP_PER_DAY);
  });
});

describe('usage streak storage helpers', () => {
  it('settles a new day to zero visible time so idle hours are never claimed', () => {
    const counted = session(EMPTY_USAGE_STREAK, day(0)).streak;
    const settled = settledUsageStreak(counted, day(3));

    expect(settled.visibleMs).toBe(0);
    expect(settled.trackedDay).toBe(localDayKey(day(3)));
    expect(settled.streakDays).toBe(counted.streakDays);
    expect(settled.xp).toBe(counted.xp);
  });

  it('leaves today untouched when it settles', () => {
    const counted = session(EMPTY_USAGE_STREAK, day(0)).streak;
    expect(settledUsageStreak(counted, day(0))).toBe(counted);
  });

  it('only asks for a write while the day can still change', () => {
    const warming = recordUsage(EMPTY_USAGE_STREAK, day(0), 30_000).streak;
    expect(isUsagePending(warming, day(0))).toBe(true);

    const counted = session(EMPTY_USAGE_STREAK, day(0)).streak;
    expect(isUsagePending(counted, day(0))).toBe(false);

    // Once counted, the day can no longer change even as more time arrives.
    const later = recordUsage(counted, day(0, 20), OVER_THRESHOLD * 4).streak;
    expect(isUsagePending(later, day(0, 20))).toBe(false);
  });

  it('normalizes anything unreadable back to an empty streak', () => {
    expect(normalizeUsageStreak(undefined)).toEqual(EMPTY_USAGE_STREAK);
    expect(normalizeUsageStreak('nope')).toEqual(EMPTY_USAGE_STREAK);
    expect(
      normalizeUsageStreak({
        trackedDay: 'yesterday',
        visibleMs: -5,
        lastSeenAt: 'now',
        lastQualifyingDay: 20260101,
        streakDays: -1,
        xp: 2.5,
      }),
    ).toEqual(EMPTY_USAGE_STREAK);
  });

  it('rounds a recovered visible total and keeps valid counters', () => {
    expect(
      normalizeUsageStreak({
        trackedDay: '2026-01-02',
        visibleMs: 1500.7,
        lastSeenAt: 1767225600000,
        lastQualifyingDay: '2026-01-02',
        streakDays: 4,
        xp: 150,
      }),
    ).toEqual({
      trackedDay: '2026-01-02',
      visibleMs: 1501,
      lastSeenAt: 1767225600000,
      lastQualifyingDay: '2026-01-02',
      streakDays: 4,
      xp: 150,
    });
  });
});
