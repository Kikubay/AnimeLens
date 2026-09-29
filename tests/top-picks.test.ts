import { describe, expect, it } from 'vitest';
import type { Anime, AnimeListEntry } from '../src/domain/anime';
import {
  addTopPickChoice,
  applyManualRanking,
  emptyTopPickPlan,
  isTopPickComplete,
  planTopPicks,
  topPickPoolSignature,
  type TopPickCandidate,
} from '../src/profile/top-picks';

function anime(id: number, community = 8): Anime {
  return {
    id,
    title: { default: `Anime ${id}`, english: null, japanese: null, synonyms: [] },
    synopsis: null,
    image: { medium: `https://cdn.test/${id}.jpg`, large: null },
    score: community,
    userScore: null,
    genres: [],
    themes: [],
    studios: [],
    staff: [],
    episodeCount: 12,
    year: 2024,
    season: 'spring',
    status: 'finished_airing',
    type: 'tv',
    popularity: 1000,
    memberCount: 1000,
  };
}

interface EntryOptions {
  readonly score?: number | null;
  readonly updatedAt?: string | null;
  readonly community?: number;
  readonly notes?: string;
}

function entry(id: number, options: EntryOptions = {}): AnimeListEntry {
  const { score = 8, updatedAt = null, community = 8, notes = null } = options;
  const base = anime(id, community);
  return {
    anime: { ...base, userScore: score },
    status: 'completed',
    userScore: score,
    episodesWatched: 12,
    priority: null,
    isRewatching: false,
    updatedAt,
    notes,
  };
}

const ids = (picks: readonly TopPickCandidate[]): number[] => picks.map((pick) => pick.id);

describe('planTopPicks', () => {
  it('fills the three slots automatically when there is no contest', () => {
    const plan = planTopPicks(
      [
        entry(1, { score: 10 }),
        entry(2, { score: 9 }),
        entry(3, { score: 8 }),
        entry(4, { score: 7 }),
      ],
      { providerId: 'mal' },
    );

    // The third-highest entry is always a boundary candidate, but with distinct
    // scores there is nothing to decide, so the user is never prompted.
    expect(plan.openSlots).toBe(1);
    expect(plan.needsChoice).toBe(false);
    expect(plan.candidates).toHaveLength(1);
    expect(ids(plan.picks)).toEqual([1, 2, 3]);
  });

  it('never prompts when the whole list is only three entries', () => {
    const plan = planTopPicks(
      [entry(1, { score: 10 }), entry(2, { score: 10 }), entry(3, { score: 10 })],
      { providerId: 'mal' },
    );

    // Repeating scores are fine when every entry still fits.
    expect(plan.openSlots).toBe(0);
    expect(plan.needsChoice).toBe(false);
    expect(ids(plan.picks)).toEqual([1, 2, 3]);
  });

  it('locks the slots held by strictly higher scores', () => {
    const entries = [
      entry(1, { score: 10 }),
      entry(2, { score: 10 }),
      entry(3, { score: 9 }),
      entry(4, { score: 9 }),
      entry(5, { score: 9 }),
      entry(6, { score: 9 }),
      entry(7, { score: 9 }),
    ];
    const plan = planTopPicks(entries, { providerId: 'mal' });

    expect(plan.boundaryScore).toBe(9);
    expect(ids(plan.locked)).toEqual([1, 2]);
    expect(plan.openSlots).toBe(1);
    expect(plan.needsChoice).toBe(true);
    expect(plan.candidates).toHaveLength(5);
    // The default fill takes the first tied candidate.
    expect(ids(plan.picks)).toEqual([1, 2, 3]);
  });

  it('leaves every slot open when no score is strictly above the boundary', () => {
    const plan = planTopPicks(
      [
        entry(1, { score: 10 }),
        entry(2, { score: 10 }),
        entry(3, { score: 10 }),
        entry(4, { score: 10 }),
      ],
      { providerId: 'mal' },
    );

    expect(plan.locked).toHaveLength(0);
    expect(plan.openSlots).toBe(3);
    expect(plan.needsChoice).toBe(true);
    expect(plan.candidates).toHaveLength(4);
  });

  it('stops at three picks and never surfaces the rest of the pool', () => {
    const entries = Array.from({ length: 12 }, (_, index) =>
      entry(index + 1, { score: 10, updatedAt: null }),
    );
    const plan = planTopPicks(entries, { providerId: 'mal' });

    expect(plan.picks).toHaveLength(3);
    expect(plan.candidates).toHaveLength(12);
  });

  it('breaks the tie by most recently updated', () => {
    const entries = [
      entry(1, { score: 10 }),
      entry(2, { score: 10 }),
      entry(3, { score: 9, updatedAt: '2024-01-01T00:00:00.000Z' }),
      entry(4, { score: 9, updatedAt: '2026-05-05T00:00:00.000Z' }),
      entry(5, { score: 9, updatedAt: '2025-03-03T00:00:00.000Z' }),
    ];
    const plan = planTopPicks(entries, { providerId: 'mal' });

    expect(ids(plan.picks)).toEqual([1, 2, 4]);
    expect(plan.candidates.map((pick) => pick.id)).toEqual([4, 5, 3]);
  });

  it('sorts entries with a missing timestamp last instead of failing', () => {
    const entries = [
      entry(1, { score: 10 }),
      entry(2, { score: 10 }),
      entry(3, { score: 9, updatedAt: null }),
      entry(4, { score: 9, updatedAt: '2020-01-01T00:00:00.000Z' }),
    ];
    const plan = planTopPicks(entries, { providerId: 'mal' });

    // Dated entry wins the open slot; the undated one is not dropped.
    expect(ids(plan.picks)).toEqual([1, 2, 4]);
    expect(plan.candidates).toHaveLength(2);
  });

  it('falls back to the community score when no timestamp is available', () => {
    const entries = [
      entry(1, { score: 10 }),
      entry(2, { score: 10 }),
      entry(3, { score: 9, community: 7 }),
      entry(4, { score: 9, community: 9 }),
    ];
    const plan = planTopPicks(entries, { providerId: 'mal' });

    expect(ids(plan.picks)).toEqual([1, 2, 4]);
  });

  it('ignores unrated and malformed entries', () => {
    const unrated: AnimeListEntry = {
      ...entry(1, { score: 9 }),
      userScore: null,
      anime: { ...anime(1), userScore: null },
    };
    const plan = planTopPicks(
      [unrated, entry(2, { score: 9 }), entry(3, { score: 8 }), entry(4, { score: 7 })],
      { providerId: 'mal' },
    );

    expect(ids(plan.picks)).toEqual([2, 3, 4]);
    expect(planTopPicks([], { providerId: 'mal' }).picks).toEqual([]);
  });

  it('is deterministic regardless of the incoming list order', () => {
    const entries = [
      entry(1, { score: 10, community: 9 }),
      entry(2, { score: 10, community: 7 }),
      entry(3, { score: 9 }),
      entry(4, { score: 9 }),
      entry(5, { score: 9 }),
    ];
    const forward = planTopPicks(entries, { providerId: 'mal' });
    const reversed = planTopPicks([...entries].reverse(), { providerId: 'mal' });

    expect(ids(reversed.picks)).toEqual(ids(forward.picks));
    expect(reversed.signature).toBe(forward.signature);
  });

  it('exposes only display-safe fields on a candidate', () => {
    const plan = planTopPicks([entry(1, { score: 10, notes: 'private thoughts' })], {
      providerId: 'mal',
    });

    expect(Object.keys(plan.picks[0] ?? {}).sort()).toEqual([
      'id',
      'imageUrl',
      'largeImageUrl',
      'score',
      'title',
      'updatedAt',
    ]);
    expect(JSON.stringify(plan)).not.toContain('private thoughts');
  });

  it('exposes both cover resolutions, preferring the smaller one by default', () => {
    const rated = entry(1, { score: 10 });
    const withBoth: AnimeListEntry = {
      ...rated,
      anime: {
        ...rated.anime,
        image: {
          medium: 'https://cdn.myanimelist.net/medium.jpg',
          large: 'https://cdn.myanimelist.net/large.jpg',
        },
      },
    };
    const largeOnly: AnimeListEntry = {
      ...rated,
      anime: {
        ...rated.anime,
        image: { medium: null, large: 'https://cdn.myanimelist.net/large.jpg' },
      },
    };
    const pick = (value: AnimeListEntry) => planTopPicks([value], { providerId: 'mal' }).picks[0];

    const both = pick(withBoth);
    // The small variant is the default so three covers stay cheap...
    expect(both?.imageUrl).toBe('https://cdn.myanimelist.net/medium.jpg');
    // ...and the full-size one is available for enlarged thumbnails.
    expect(both?.largeImageUrl).toBe('https://cdn.myanimelist.net/large.jpg');
    // With only one variant, both fields point at it.
    const onlyLarge = pick(largeOnly);
    expect(onlyLarge?.imageUrl).toBe('https://cdn.myanimelist.net/large.jpg');
    expect(onlyLarge?.largeImageUrl).toBe('https://cdn.myanimelist.net/large.jpg');
    // The helper's fixture only has a medium image, so both fields fall back to it.
    expect(pick(rated)?.imageUrl).toBe('https://cdn.test/1.jpg');
    expect(pick(rated)?.largeImageUrl).toBe('https://cdn.test/1.jpg');
  });

  it('reports no cover when the provider returned none', () => {
    const noArt: AnimeListEntry = {
      ...entry(1, { score: 10 }),
      anime: { ...entry(1, { score: 10 }).anime, image: null },
    };

    const pick = planTopPicks([noArt], { providerId: 'mal' }).picks[0];
    expect(pick?.imageUrl).toBeNull();
    expect(pick?.largeImageUrl).toBeNull();
  });
});

describe('topPickPoolSignature', () => {
  const candidates: TopPickCandidate[] = [
    { id: 2, title: 'B', score: 9, imageUrl: null, largeImageUrl: null, updatedAt: null },
    { id: 1, title: 'A', score: 10, imageUrl: null, largeImageUrl: null, updatedAt: null },
  ];

  it('is sorted by id so list order cannot change it', () => {
    expect(topPickPoolSignature(candidates, 'mal')).toBe(
      topPickPoolSignature([...candidates].reverse(), 'mal'),
    );
  });

  it('is prefixed with the provider so MAL and AniList cannot cross-validate', () => {
    const mal = topPickPoolSignature(candidates, 'mal');
    const anilist = topPickPoolSignature(candidates, 'anilist');

    // MAL id 1 and AniList id 1 would otherwise produce identical payloads.
    expect(mal).not.toBe(anilist);
    expect(mal.startsWith('mal_')).toBe(true);
    expect(anilist.startsWith('anilist_')).toBe(true);
  });

  it('falls back to a safe marker for missing or unsafe provider ids', () => {
    expect(topPickPoolSignature(candidates, null).startsWith('unknown_')).toBe(true);
    expect(topPickPoolSignature(candidates, '../../etc').startsWith('unknown_')).toBe(true);
  });

  it('changes when a pooled score changes but not when the pool is untouched', () => {
    const before = planTopPicks(
      [
        entry(1, { score: 10 }),
        entry(2, { score: 10 }),
        entry(3, { score: 9 }),
        entry(4, { score: 9 }),
      ],
      { providerId: 'mal' },
    );
    const rescored = planTopPicks(
      [
        entry(1, { score: 10 }),
        entry(2, { score: 10 }),
        entry(3, { score: 8 }),
        entry(4, { score: 9 }),
      ],
      { providerId: 'mal' },
    );

    expect(rescored.signature).not.toBe(before.signature);
  });

  it('survives an unrelated edit below the boundary score', () => {
    const base = [
      entry(1, { score: 10 }),
      entry(2, { score: 10 }),
      entry(3, { score: 9 }),
      entry(4, { score: 9 }),
    ];
    const before = planTopPicks(base, { providerId: 'mal' });
    // Rating a brand new anime well below the boundary.
    const after = planTopPicks([...base, entry(5, { score: 3 })], { providerId: 'mal' });

    expect(after.signature).toBe(before.signature);
    expect(after.openSlots).toBe(before.openSlots);
  });
});

describe('applyManualRanking', () => {
  const plan = planTopPicks(
    [
      entry(1, { score: 10 }),
      entry(2, { score: 10 }),
      entry(3, { score: 9 }),
      entry(4, { score: 9 }),
      entry(5, { score: 9 }),
    ],
    { providerId: 'mal' },
  );

  it('places the chosen anime in the open slot after the locked ones', () => {
    expect(ids(applyManualRanking(plan, [5]))).toEqual([1, 2, 5]);
  });

  it('rejects a ranking whose length does not match the open slots', () => {
    expect(ids(applyManualRanking(plan, []))).toEqual(ids(plan.picks));
    expect(ids(applyManualRanking(plan, [3, 4]))).toEqual(ids(plan.picks));
  });

  it('rejects duplicates and ids outside the candidate pool', () => {
    expect(ids(applyManualRanking(plan, [3, 3]))).toEqual(ids(plan.picks));
    // id 1 is locked, not a candidate, so it cannot be chosen again.
    expect(ids(applyManualRanking(plan, [1]))).toEqual(ids(plan.picks));
    expect(ids(applyManualRanking(plan, [999]))).toEqual(ids(plan.picks));
  });

  it('falls back to the default fill when no ranking exists', () => {
    expect(ids(applyManualRanking(plan, null))).toEqual(ids(plan.picks));
    expect(ids(applyManualRanking(plan, undefined))).toEqual(ids(plan.picks));
  });

  it('ignores a ranking when there is nothing to choose', () => {
    const untied = planTopPicks(
      [entry(1, { score: 10 }), entry(2, { score: 9 }), entry(3, { score: 8 })],
      { providerId: 'mal' },
    );

    expect(untied.openSlots).toBe(0);
    expect(untied.needsChoice).toBe(false);
    expect(ids(applyManualRanking(untied, [1]))).toEqual([1, 2, 3]);
  });

  it('produces a full Top 3 when several slots are open', () => {
    const allTied = planTopPicks(
      [
        entry(1, { score: 10 }),
        entry(2, { score: 10 }),
        entry(3, { score: 10 }),
        entry(4, { score: 10 }),
      ],
      { providerId: 'mal' },
    );

    expect(ids(applyManualRanking(allTied, [4, 3, 2]))).toEqual([4, 3, 2]);
  });
});

describe('addTopPickChoice', () => {
  // Slots 1 and 2 are locked by score; five 9/10s contest slot 3.
  const singleSlot = () =>
    planTopPicks(
      [
        entry(1, { score: 10 }),
        entry(2, { score: 10 }),
        entry(3, { score: 9 }),
        entry(4, { score: 9 }),
        entry(5, { score: 9 }),
      ],
      { providerId: 'mal' },
    );

  // Four 10/10s contest all three slots.
  const threeSlots = () =>
    planTopPicks(
      [
        entry(1, { score: 10 }),
        entry(2, { score: 10 }),
        entry(3, { score: 10 }),
        entry(4, { score: 10 }),
      ],
      { providerId: 'mal' },
    );

  it('fills one slot per click and completes at the limit', () => {
    const plan = threeSlots();
    const first = addTopPickChoice([], 4, plan);
    expect(first).toEqual([4]);
    expect(isTopPickComplete(first ?? [], plan)).toBe(false);

    const second = addTopPickChoice(first ?? [], 3, plan);
    const third = addTopPickChoice(second ?? [], 1, plan);

    expect(third).toEqual([4, 3, 1]);
    expect(isTopPickComplete(third ?? [], plan)).toBe(true);
  });

  it('refuses to rank past the open slots', () => {
    const plan = threeSlots();
    const full = [4, 3, 1];

    expect(addTopPickChoice(full, 2, plan)).toBeNull();
  });

  it('refuses a candidate that is already taken', () => {
    const plan = threeSlots();

    expect(addTopPickChoice([4], 4, plan)).toBeNull();
  });

  it('refuses an anime outside the tied pool', () => {
    const plan = threeSlots();

    // Not a candidate, and a locked id can never be re-picked.
    expect(addTopPickChoice([], 999, plan)).toBeNull();
    expect(addTopPickChoice([], 1, plan)).toEqual([1]);
  });

  it('refuses any pick when there is no contest to break', () => {
    const untied = planTopPicks(
      [entry(1, { score: 10 }), entry(2, { score: 9 }), entry(3, { score: 8 })],
      { providerId: 'mal' },
    );

    expect(addTopPickChoice([], 1, untied)).toBeNull();
    expect(isTopPickComplete([], untied)).toBe(false);
  });

  it('accepts a single pick for the one-slot case', () => {
    const plan = singleSlot();
    const picked = addTopPickChoice([], 5, plan);

    expect(picked).toEqual([5]);
    expect(isTopPickComplete(picked ?? [], plan)).toBe(true);
  });
});

describe('emptyTopPickPlan', () => {
  it('never asks the user to choose and still carries a signature', () => {
    const plan = emptyTopPickPlan('anilist');

    expect(plan.openSlots).toBe(0);
    expect(plan.picks).toEqual([]);
    expect(plan.needsChoice).toBe(false);
    expect(plan.boundaryScore).toBeNull();
    expect(plan.signature).toBe(topPickPoolSignature([], 'anilist'));
  });
});
