import { describe, expect, it } from 'vitest';
import type { StoredPreferenceItem, StoredProfileSnapshot } from '../src/storage/storage-types';
import { emptyProfileSummary, profileSummaryFromModel } from '../src/profile/profile-types';
import type { UserProfileSummary } from '../src/profile/profile-types';
import { buildUserPreferenceProfile } from '../src/recommendations/recommendation-engine';
import {
  MAX_CHANGES,
  MIN_SAMPLE_COUNT,
  MIN_SCORE_DELTA,
  PROFILE_HISTORY_VERSION,
  diffProfileSnapshots,
  sameProfileMeasurement,
  toStoredProfileSnapshot,
} from '../src/profile/profile-delta';
import type { ProfileChange } from '../src/profile/profile-delta';

const AT = '2026-01-01T00:00:00.000Z';

function item(name: string, score: number, count = 10): StoredPreferenceItem {
  return { name, score, count };
}

function base(): StoredProfileSnapshot {
  return {
    version: PROFILE_HISTORY_VERSION,
    capturedAt: AT,
    providerId: 'mal',
    analyzedAnimeCount: 100,
    ratedAnimeCount: 80,
    averageScore: 8.1,
    genres: [],
    themes: [],
    studios: [],
  };
}

/** The earlier profile. Every diff needs the list to have actually moved. */
function before(overrides: Partial<StoredProfileSnapshot> = {}): StoredProfileSnapshot {
  return { ...base(), analyzedAnimeCount: 100, ...overrides };
}

/** The later profile, with entries added. */
function after(overrides: Partial<StoredProfileSnapshot> = {}): StoredProfileSnapshot {
  return { ...base(), analyzedAnimeCount: 120, ...overrides };
}

describe('profile delta', () => {
  describe('status', () => {
    it('reports a baseline when there is nothing recorded yet', () => {
      const delta = diffProfileSnapshots(null, after());

      expect(delta.status).toBe('baseline');
      expect(delta.changes).toEqual([]);
      expect(delta.previousAt).toBeNull();
    });

    it('reports stable when neither the list nor the ratings changed', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Action', 90)] }),
        before({ genres: [item('Action', 90)] }),
      );

      expect(delta.status).toBe('stable');
      expect(delta.changes).toEqual([]);
    });

    it('refuses to compare against another shape of history', () => {
      const delta = diffProfileSnapshots(before({ version: PROFILE_HISTORY_VERSION + 1 }), after());

      expect(delta.status).toBe('unavailable');
      expect(delta.changes).toEqual([]);
    });

    it('refuses to compare two different providers', () => {
      const delta = diffProfileSnapshots(
        before({ providerId: 'mal' }),
        after({ providerId: 'anilist' }),
      );

      expect(delta.status).toBe('unavailable');
    });

    it('diffs normally when only the ratings moved', () => {
      // A user can rate entries already on the list, so the rating count moves
      // on its own and the guard above must not swallow it.
      const delta = diffProfileSnapshots(
        before({ ratedAnimeCount: 80, genres: [item('Action', 50, 20)] }),
        after({ ratedAnimeCount: 84, genres: [item('Action', 90, 20)] }),
      );

      expect(delta.status).toBe('ready');
      expect(delta.changes.map((change) => change.kind)).toEqual(['score_up']);
    });
  });

  describe('change kinds', () => {
    it('reports an item that joined the top five', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Action', 90), item('Comedy', 80)] }),
        after({ genres: [item('Action', 90), item('Comedy', 80), item('Fantasy', 40)] }),
      );

      expect(delta.changes).toEqual([
        {
          kind: 'entered',
          axis: 'genres',
          name: 'Fantasy',
          from: null,
          to: 2,
          fromScore: null,
          toScore: 40,
        },
      ]);
    });

    it('reports an item that fell out of the top five', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Action', 90), item('Comedy', 80), item('Fantasy', 40)] }),
        after({ genres: [item('Action', 90), item('Comedy', 80)] }),
      );

      expect(delta.changes).toEqual([
        {
          kind: 'left',
          axis: 'genres',
          name: 'Fantasy',
          from: 2,
          to: null,
          fromScore: 40,
          toScore: null,
        },
      ]);
    });

    it('reports a climb in rank instead of the score move behind it', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Comedy', 90), item('Action', 80)] }),
        after({ genres: [item('Action', 95), item('Comedy', 90)] }),
      );

      expect(delta.changes).toEqual([
        {
          kind: 'rank_up',
          axis: 'genres',
          name: 'Action',
          from: 1,
          to: 0,
          fromScore: 80,
          toScore: 95,
        },
        {
          kind: 'rank_down',
          axis: 'genres',
          name: 'Comedy',
          from: 0,
          to: 1,
          fromScore: 90,
          toScore: 90,
        },
      ]);
    });

    it('reports a score move in place, above the threshold', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Action', 70, 20)] }),
        after({ genres: [item('Action', 70 + MIN_SCORE_DELTA, 20)] }),
      );

      expect(delta.changes).toEqual([
        {
          kind: 'score_up',
          axis: 'genres',
          name: 'Action',
          from: 0,
          to: 0,
          fromScore: 70,
          toScore: 75,
        },
      ]);
    });

    it('reports a score drop in place', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Action', 80, 20)] }),
        after({ genres: [item('Action', 70, 20)] }),
      );

      expect(delta.changes[0]?.kind).toBe('score_down');
    });

    it('diffs each axis separately and labels it', () => {
      const delta = diffProfileSnapshots(
        before({ themes: [item('School', 90, 20)], studios: [item('Studio A', 90, 20)] }),
        after({
          themes: [item('School', 90, 20), item('Military', 40, 20)],
          studios: [item('Studio A', 90, 20), item('Studio B', 40, 20)],
        }),
      );

      expect(delta.changes.map((change) => [change.axis, change.name])).toEqual([
        ['themes', 'Military'],
        ['studios', 'Studio B'],
      ]);
    });
  });

  describe('noise filtering', () => {
    it('ignores a score move smaller than the threshold', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Action', 70, 20)] }),
        after({ genres: [item('Action', 70 + MIN_SCORE_DELTA - 1, 20)] }),
      );

      expect(delta.status).toBe('stable');
      expect(delta.changes).toEqual([]);
    });

    it('ignores a score move on a thin sample', () => {
      for (const count of [1, MIN_SAMPLE_COUNT - 1]) {
        const delta = diffProfileSnapshots(
          before({ genres: [item('Action', 100, count)] }),
          after({ genres: [item('Action', 0, count)] }),
        );

        expect(delta.changes, `count=${count}`).toEqual([]);
      }
    });

    it('still reports rank moves on a thin sample', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Action', 90, 1)] }),
        after({ genres: [item('Action', 90, 1), item('Fantasy', 50, 1)] }),
      );

      expect(delta.changes.map((change) => change.kind)).toEqual(['entered']);
    });

    it('reports a structural move even when the average sits still', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Action', 90, 10)], averageScore: 8.1 }),
        after({ genres: [item('Action', 90, 10), item('Fantasy', 40, 10)], averageScore: 8.1 }),
      );

      expect(delta.status).toBe('ready');
      expect(delta.averageChange).toBeNull();
    });
  });

  describe('average score', () => {
    it('reports a rise past a tenth of a point', () => {
      const delta = diffProfileSnapshots(
        before({ averageScore: 8.1 }),
        after({ averageScore: 8.4 }),
      );

      expect(delta.averageChange).toEqual({ from: 8.1, to: 8.4, direction: 'up' });
    });

    it('reports a fall', () => {
      const delta = diffProfileSnapshots(
        before({ averageScore: 8.4 }),
        after({ averageScore: 8.1 }),
      );

      expect(delta.averageChange).toEqual({ from: 8.4, to: 8.1, direction: 'down' });
    });

    it('ignores a move inside the noise floor', () => {
      const delta = diffProfileSnapshots(
        before({ averageScore: 8.1 }),
        after({ averageScore: 8.11 }),
      );

      expect(delta.averageChange).toBeNull();
      expect(delta.status).toBe('stable');
    });

    it('ignores a move when either side has no average', () => {
      expect(
        diffProfileSnapshots(before({ averageScore: null }), after({ averageScore: 8.1 }))
          .averageChange,
      ).toBeNull();
      expect(
        diffProfileSnapshots(before({ averageScore: 8.1 }), after({ averageScore: null }))
          .averageChange,
      ).toBeNull();
    });

    it('can be ready on the average alone, with no axis change', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('Action', 90, 10)], averageScore: 7 }),
        after({ genres: [item('Action', 90, 10)], averageScore: 8.9 }),
      );

      expect(delta.status).toBe('ready');
      expect(delta.changes).toEqual([]);
    });
  });

  describe('ordering and the change cap', () => {
    it('caps the list and puts the most newsworthy change first', () => {
      const earlier = before({
        genres: [item('Action', 90, 20), item('Comedy', 85, 20)],
        themes: [item('School', 80, 20), item('Psychological', 75, 20)],
        studios: [item('Studio A', 70, 20), item('Studio B', 65, 20)],
      });

      const later = after({
        genres: [item('Action', 95, 20), item('Comedy', 85, 20), item('Fantasy', 30, 20)],
        themes: [item('School', 80, 20), item('Psychological', 50, 20), item('Military', 20, 20)],
        studios: [item('Studio A', 70, 20), item('Studio B', 30, 20), item('Studio C', 20, 20)],
        averageScore: 8.1,
      });

      const delta = diffProfileSnapshots(earlier, later);

      expect(delta.changes).toHaveLength(MAX_CHANGES);

      expect(delta.changes.slice(0, 3).map((change) => change.kind)).toEqual([
        'entered',
        'entered',
        'entered',
      ]);
      expect(delta.changes[3]?.kind).toBe('score_up');
    });

    it('ranks a change in position above an in-place score move', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('A', 90, 20), item('B', 80, 20), item('C', 50, 20)] }),
        after({ genres: [item('B', 95, 20), item('A', 88, 20), item('C', 60, 20)] }),
      );

      expect(delta.changes.map((change) => [change.kind, change.name])).toEqual([
        ['rank_up', 'B'],
        ['rank_down', 'A'],
        ['score_up', 'C'],
      ]);
    });

    it('breaks ties between equally significant changes by magnitude', () => {
      const delta = diffProfileSnapshots(
        before({ genres: [item('A', 90, 20), item('B', 80, 20), item('C', 70, 20)] }),
        after({ genres: [item('A', 99, 20), item('B', 85, 20), item('C', 72, 20)] }),
      );

      expect(delta.changes.map((change) => [change.kind, change.name])).toEqual([
        ['score_up', 'A'],
        ['score_up', 'B'],
      ]);
    });

    it('orders identically on repeated runs', () => {
      const earlier = before({
        genres: [item('A', 90, 20), item('B', 90, 20), item('C', 90, 20)],
      });
      const later = after({
        genres: [item('A', 90, 20), item('B', 90, 20), item('C', 90, 20), item('D', 10, 20)],
        themes: [item('E', 10, 20)],
      });

      const first = diffProfileSnapshots(earlier, later);
      const second = diffProfileSnapshots(earlier, later);

      expect(first.changes).toEqual(second.changes);
    });
  });

  describe('language independence', () => {
    it('produces the same stored profile whatever the UI language', () => {
      // Persisting the already-localized detected preferences would make an
      // EN -> FR switch look like a change in the user's taste.
      const build = (language: 'en' | 'fr') => {
        const model = buildUserPreferenceProfile([], []);
        return toStoredProfileSnapshot(
          profileSummaryFromModel(model, language, [], 'mal'),
          'mal',
          AT,
        );
      };

      expect(JSON.stringify(build('en'))).toBe(JSON.stringify(build('fr')));
    });
  });

  describe('sameProfileMeasurement', () => {
    const summary = (overrides: Partial<UserProfileSummary> = {}): UserProfileSummary => ({
      ...emptyProfileSummary(),
      analyzedAnimeCount: 100,
      ratedAnimeCount: 80,
      averageScore: 8.1,
      favoriteGenres: [{ name: 'Action', score: 90, positive: 9, negative: 0, count: 10 }],
      ...overrides,
    });

    it('is true for two projections of the same summary', () => {
      const projected = toStoredProfileSnapshot(summary(), 'mal', AT);

      expect(sameProfileMeasurement(projected, toStoredProfileSnapshot(summary(), 'mal', AT))).toBe(
        true,
      );
    });

    it('ignores the capture time', () => {
      const first = toStoredProfileSnapshot(summary(), 'mal', AT);
      const later = toStoredProfileSnapshot(summary(), 'mal', '2026-06-01T00:00:00.000Z');

      expect(sameProfileMeasurement(first, later)).toBe(true);
    });

    it('is false when a score moved', () => {
      const first = toStoredProfileSnapshot(summary(), 'mal', AT);
      const second = toStoredProfileSnapshot(
        summary({
          favoriteGenres: [{ name: 'Action', score: 80, positive: 8, negative: 0, count: 10 }],
        }),
        'mal',
        AT,
      );

      expect(sameProfileMeasurement(first, second)).toBe(false);
    });

    it('is false when an item left the list', () => {
      const first = toStoredProfileSnapshot(summary(), 'mal', AT);
      const second = toStoredProfileSnapshot(summary({ favoriteGenres: [] }), 'mal', AT);

      expect(sameProfileMeasurement(first, second)).toBe(false);
    });
  });

  it('never reports a change for a name the user never had', () => {
    const delta = diffProfileSnapshots(
      before({ genres: [item('Action', 90, 20)] }),
      after({ genres: [item('Action', 90, 20), item('Fantasy', 40, 20)] }),
    );

    const names: ProfileChange['name'][] = delta.changes.map((change) => change.name);
    expect(names).toEqual(['Fantasy']);
  });
});
