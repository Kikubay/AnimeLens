import { describe, expect, it } from 'vitest';
import {
  RECAP_MIN_WINDOW_DAYS,
  computeWeeklyRecap,
  hasEnoughHistoryForRecap,
} from '../src/profile/weekly-recap';
import type { StoredPreferenceItem, StoredProfileSnapshot } from '../src/storage/storage-types';
import { PROFILE_HISTORY_VERSION } from '../src/profile/profile-delta';

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse('2026-01-01T00:00:00.000Z');

function item(name: string, score = 80, count = 8): StoredPreferenceItem {
  return { name, score, count };
}

function snapshot(
  daysAgo: number,
  overrides: Partial<StoredProfileSnapshot> = {},
): StoredProfileSnapshot {
  return {
    version: PROFILE_HISTORY_VERSION,
    capturedAt: new Date(BASE - daysAgo * DAY).toISOString(),
    providerId: 'mal',
    analyzedAnimeCount: 100,
    ratedAnimeCount: 80,
    averageScore: 7.5,
    genres: [],
    themes: [],
    studios: [],
    ...overrides,
  };
}

describe('computeWeeklyRecap', () => {
  it('returns null without a second snapshot to compare against', () => {
    expect(computeWeeklyRecap([])).toBeNull();
    expect(computeWeeklyRecap([snapshot(0)])).toBeNull();
    expect(hasEnoughHistoryForRecap([snapshot(0)])).toBe(false);
  });

  it('returns null when the newest pair is too close together to be a week', () => {
    const recent = computeWeeklyRecap([snapshot(0), snapshot(RECAP_MIN_WINDOW_DAYS - 2)]);

    expect(recent).toBeNull();
    expect(hasEnoughHistoryForRecap([snapshot(0), snapshot(1)])).toBe(false);
  });

  it('reports the window length and the activity inside it', () => {
    const recap = computeWeeklyRecap([
      snapshot(0, { analyzedAnimeCount: 118, ratedAnimeCount: 92, averageScore: 7.9 }),
      snapshot(7, { analyzedAnimeCount: 100, ratedAnimeCount: 80, averageScore: 7.4 }),
    ]);

    expect(recap).not.toBeNull();
    expect(recap?.windowDays).toBe(7);
    expect(recap?.entriesAdded).toBe(18);
    expect(recap?.entriesRated).toBe(12);
    expect(recap?.averageBefore).toBe(7.4);
    expect(recap?.averageAfter).toBe(7.9);
    expect(recap?.averageDelta).toBeCloseTo(0.5, 5);
  });

  it('never reports a negative count when a list shrinks', () => {
    const recap = computeWeeklyRecap([
      snapshot(0, { analyzedAnimeCount: 80, ratedAnimeCount: 60 }),
      snapshot(7, { analyzedAnimeCount: 100, ratedAnimeCount: 80 }),
    ]);

    expect(recap?.entriesAdded).toBe(0);
    expect(recap?.entriesRated).toBe(0);
  });

  it('reports week one for the first qualifying window and counts further weeks', () => {
    const first = computeWeeklyRecap([snapshot(0), snapshot(7)]);
    const second = computeWeeklyRecap([snapshot(0), snapshot(7), snapshot(14)]);
    const third = computeWeeklyRecap([snapshot(0), snapshot(7), snapshot(14), snapshot(21)]);

    expect(first?.weekNumber).toBe(1);
    expect(second?.weekNumber).toBe(2);
    expect(third?.weekNumber).toBe(3);
  });

  it('does not count a short gap toward the week total', () => {
    const recap = computeWeeklyRecap([snapshot(0), snapshot(3), snapshot(14)]);

    expect(recap?.weekNumber).toBe(1);
  });

  it('picks the newest qualifying window rather than the oldest', () => {
    const recap = computeWeeklyRecap([
      snapshot(0, { analyzedAnimeCount: 140 }),
      snapshot(7, { analyzedAnimeCount: 130 }),
      snapshot(14, { analyzedAnimeCount: 100 }),
    ]);

    expect(recap?.entriesAdded).toBe(10);
    expect(recap?.windowStart).toBe(snapshot(7).capturedAt);
  });

  it('surfaces the taste shifts that crossed the noise floor', () => {
    const recap = computeWeeklyRecap([
      snapshot(0, {
        analyzedAnimeCount: 108,
        ratedAnimeCount: 84,
        genres: [item('Action', 92), item('Drama', 74)],
      }),
      snapshot(7, {
        analyzedAnimeCount: 100,
        ratedAnimeCount: 80,
        genres: [item('Action', 80)],
      }),
    ]);

    expect(recap?.shifts[0]).toMatchObject({ name: 'Drama', axis: 'genres', direction: 'in' });
    expect(recap?.shifts.map((shift) => shift.name)).toEqual(['Drama', 'Action']);
  });

  it('refuses to compare snapshots from another provider or version', () => {
    const otherProvider = computeWeeklyRecap([snapshot(0), snapshot(7, { providerId: 'anilist' })]);
    const otherVersion = computeWeeklyRecap([
      snapshot(0),
      snapshot(7, { version: PROFILE_HISTORY_VERSION + 1 }),
    ]);

    expect(otherProvider).toBeNull();
    expect(otherVersion).toBeNull();
  });

  it('refuses to compare snapshots whose timestamps run backwards', () => {
    const recap = computeWeeklyRecap([snapshot(7), snapshot(0)]);

    expect(recap).toBeNull();
  });

  it('refuses to compare snapshots with unparseable timestamps', () => {
    const recap = computeWeeklyRecap([snapshot(0), snapshot(7, { capturedAt: 'not-a-date' })]);

    expect(recap).toBeNull();
  });

  it('leaves the average null when either side never had one', () => {
    const recap = computeWeeklyRecap([
      snapshot(0, { averageScore: null }),
      snapshot(7, { averageScore: 8 }),
    ]);

    expect(recap?.averageBefore).toBe(8);
    expect(recap?.averageAfter).toBeNull();
    expect(recap?.averageDelta).toBeNull();
  });

  it('survives a full-capacity history without drifting', () => {
    const history = Array.from({ length: 8 }, (_unused, index) =>
      snapshot(index * 7, { analyzedAnimeCount: 100 + (7 - index) * 10 }),
    );

    const recap = computeWeeklyRecap(history);

    expect(recap?.weekNumber).toBe(7);
    expect(recap?.windowDays).toBe(7);
    expect(recap?.entriesAdded).toBe(10);
  });
});
