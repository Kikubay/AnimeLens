import { describe, expect, it } from 'vitest';
import type { Anime } from '../src/domain/anime';
import type { Recommendation } from '../src/domain/recommendation';
import { defaultMockAnime } from '../src/api/mocks/mock-fixtures';
import {
  DAILY_DROP_GRACE_DAYS,
  DAILY_DROP_SIZE,
  buildDailyDropView,
  createStoredDailyDrop,
  dayDistance,
  dropCandidateRank,
  isStoredDailyDrop,
  isWithinGrace,
  selectDailyDropAnimeIds,
  seenDropIds,
} from '../src/recommendations/daily-drop';
import { DAILY_DROP_KEY, createDailyDropStore } from '../src/recommendations/daily-drop-store';
import type { StorageAdapter } from '../src/storage/storage-adapter';
import type { StorageKey } from '../src/storage/storage-types';

const TEMPLATE = defaultMockAnime[0];

function anime(id: number): Anime {
  return { ...TEMPLATE, id, title: { ...TEMPLATE.title, default: `Anime ${id}` } };
}

function recommendation(id: number): Recommendation {
  return {
    id: `rec-${id}`,
    anime: anime(id),
    category: 'highly-compatible',
    compatibilityScore: 90,
    reasons: [
      { kind: 'genre', label: 'Because you liked', detail: 'Sousou no Frieren', weight: 0.8 },
    ],
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function rank(size: number): readonly Recommendation[] {
  return Array.from({ length: size }, (_unused, index) => recommendation(index + 1));
}

function memoryStorage(seed: Partial<Record<StorageKey, unknown>> = {}) {
  const data = new Map<string, unknown>(Object.entries(seed));
  const storage: StorageAdapter & { readonly data: Map<string, unknown> } = {
    data,
    async get(key) {
      return data.get(key) as never;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
  };
  return storage;
}

describe('day arithmetic', () => {
  it('measures whole local days between keys, in both directions', () => {
    expect(dayDistance('2026-01-01', '2026-01-04')).toBe(3);
    expect(dayDistance('2026-01-04', '2026-01-01')).toBe(-3);
    expect(dayDistance('2026-02-28', '2026-03-01')).toBe(1);
    expect(dayDistance('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('treats only recent past days as within grace', () => {
    expect(isWithinGrace('2026-01-01', '2026-01-01')).toBe(false);
    expect(isWithinGrace('2026-01-03', '2026-01-01')).toBe(false);
    expect(isWithinGrace('2025-12-31', '2026-01-01')).toBe(true);
    expect(isWithinGrace(`2025-12-${32 - DAILY_DROP_GRACE_DAYS}`, '2026-01-01')).toBe(true);
    expect(isWithinGrace(`2025-12-${31 - DAILY_DROP_GRACE_DAYS}`, '2026-01-01')).toBe(false);
  });
});

describe('selectDailyDropAnimeIds', () => {
  it('picks the requested number of distinct ids', () => {
    const ids = selectDailyDropAnimeIds(rank(40), '2026-01-01', new Set());
    expect(ids).toHaveLength(DAILY_DROP_SIZE);
    expect(new Set(ids).size).toBe(DAILY_DROP_SIZE);
  });

  it('is stable within a day and varies across days', () => {
    const candidates = rank(40);
    expect(selectDailyDropAnimeIds(candidates, '2026-01-01', new Set())).toEqual(
      selectDailyDropAnimeIds(candidates, '2026-01-01', new Set()),
    );
    const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'];
    const selections = days.map((day) =>
      selectDailyDropAnimeIds(candidates, day, new Set()).join(),
    );
    expect(new Set(selections).size).toBe(days.length);
  });

  it('prefers titles that have not already been dropped', () => {
    const first = selectDailyDropAnimeIds(rank(40), '2026-01-01', new Set());
    const second = selectDailyDropAnimeIds(rank(40), '2026-01-02', new Set(first));
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });

  it('falls back to already-seen titles rather than returning an empty drop', () => {
    const candidates = rank(5);
    const ids = selectDailyDropAnimeIds(
      candidates,
      '2026-01-01',
      new Set(candidates.map((item) => item.anime.id)),
    );
    expect(ids.length).toBeGreaterThan(0);
  });

  it('returns nothing for an empty rank or a non-positive size', () => {
    expect(selectDailyDropAnimeIds([], '2026-01-01', new Set())).toEqual([]);
    expect(selectDailyDropAnimeIds(rank(10), '2026-01-01', new Set(), 0)).toEqual([]);
  });
});

describe('dropCandidateRank', () => {
  it('flattens the daily pick and every section without duplicating ids', () => {
    const [first, second, third] = rank(3);
    const flat = dropCandidateRank(first, [
      { id: 'highly-compatible', title: 'Highly Compatible', recommendations: [second] },
      { id: 'explore', title: 'Explore', recommendations: [third, second] },
    ]);

    expect(flat.map((item) => item.anime.id)).toEqual([1, 2, 3]);
  });

  it('handles a missing daily pick', () => {
    const [only] = rank(1);
    expect(
      dropCandidateRank(null, [{ id: 'explore', title: 'Explore', recommendations: [only] }]),
    ).toHaveLength(1);
  });
});

describe('buildDailyDropView', () => {
  const candidates = rank(40);
  const today = '2026-01-05';

  it('resolves stored ids against the current rank and marks claimed ones', () => {
    const ids = selectDailyDropAnimeIds(candidates, today, new Set());
    const drop = createStoredDailyDrop('mal', today, ids, [ids[0]]);
    const view = buildDailyDropView(drop, [], candidates, today);

    expect(view.items).toHaveLength(ids.length);
    expect(view.items.map((item) => item.recommendation.anime.id)).toEqual([...ids]);
    expect(view.items.map((item) => item.state)).toEqual(['claimed', 'unclaimed', 'unclaimed']);
    expect(view.unclaimedCount).toBe(2);
  });

  it('drops ids the current rank can no longer resolve', () => {
    const drop = createStoredDailyDrop('mal', today, [999, candidates[0].anime.id], []);
    const view = buildDailyDropView(drop, [], candidates, today);

    expect(view.items).toHaveLength(1);
    expect(view.items[0].recommendation.anime.id).toBe(candidates[0].anime.id);
  });

  it('surfaces unclaimed titles from recent past days as missed', () => {
    const missed = createStoredDailyDrop('mal', '2026-01-04', [candidates[10].anime.id], []);
    const claimed = createStoredDailyDrop(
      'mal',
      '2026-01-03',
      [candidates[11].anime.id],
      [candidates[11].anime.id],
    );
    const stale = createStoredDailyDrop('mal', '2026-01-01', [candidates[12].anime.id], []);
    const current = createStoredDailyDrop(today, today, [candidates[0].anime.id], []);

    const view = buildDailyDropView(current, [missed, claimed, stale], candidates, '2026-01-05');

    expect(view.missed.map((item) => item.recommendation.anime.id)).toEqual([
      candidates[10].anime.id,
    ]);
  });

  it('never counts an expired item in the remaining count', () => {
    const current = createStoredDailyDrop(
      'mal',
      today,
      [candidates[0].anime.id],
      [candidates[0].anime.id],
    );
    const view = buildDailyDropView(
      current,
      [createStoredDailyDrop('mal', '2026-01-04', [candidates[10].anime.id], [])],
      candidates,
      today,
    );

    expect(view.unclaimedCount).toBe(0);
    expect(view.missed).toHaveLength(1);
  });

  it('returns an empty view when there is no stored drop', () => {
    expect(buildDailyDropView(null, [], candidates, today)).toEqual({
      day: today,
      items: [],
      missed: [],
      unclaimedCount: 0,
    });
  });
});

describe('isStoredDailyDrop', () => {
  it('accepts a well-formed drop', () => {
    expect(isStoredDailyDrop(createStoredDailyDrop('mal', '2026-01-01', [1, 2], [1]))).toBe(true);
  });

  it('rejects a malformed day, an empty id list and a claim outside the drop', () => {
    expect(
      isStoredDailyDrop({
        version: 1,
        day: '01-01-2026',
        providerId: 'mal',
        animeIds: [1],
        claimedIds: [],
      }),
    ).toBe(false);
    expect(
      isStoredDailyDrop({
        version: 1,
        day: '2026-01-01',
        providerId: 'mal',
        animeIds: [],
        claimedIds: [],
      }),
    ).toBe(false);
    expect(
      isStoredDailyDrop({
        version: 1,
        day: '2026-01-01',
        providerId: 'mal',
        animeIds: [1],
        claimedIds: [2],
      }),
    ).toBe(false);
    expect(
      isStoredDailyDrop({
        version: 2,
        day: '2026-01-01',
        providerId: 'mal',
        animeIds: [1],
        claimedIds: [],
      }),
    ).toBe(false);
    expect(isStoredDailyDrop(null)).toBe(false);
  });
});

describe('daily drop store', () => {
  it('round-trips a recorded drop, newest first', async () => {
    const store = createDailyDropStore(memoryStorage());
    await store.record(createStoredDailyDrop('mal', '2026-01-02', [1, 2, 3]));
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [4, 5, 6]));

    expect((await store.list('mal')).map((drop) => drop.day)).toEqual(['2026-01-02', '2026-01-01']);
  });

  it('replaces a drop recorded twice for the same day rather than duplicating it', async () => {
    const store = createDailyDropStore(memoryStorage());
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [1, 2, 3]));
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [4, 5, 6], [4]));

    const history = await store.list('mal');
    expect(history).toHaveLength(1);
    expect(history[0].animeIds).toEqual([4, 5, 6]);
    expect(history[0].claimedIds).toEqual([4]);
  });

  it('claims across every day the anime appears in', async () => {
    const store = createDailyDropStore(memoryStorage());
    await store.record(createStoredDailyDrop('mal', '2026-01-02', [1, 2, 3]));
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [1, 4, 5]));

    await store.claim('mal', 1);

    expect((await store.list('mal')).map((drop) => drop.claimedIds)).toEqual([[1], [1]]);
  });

  it('is idempotent for a title that is already claimed', async () => {
    const storage = memoryStorage();
    const store = createDailyDropStore(storage);
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [1, 2, 3], [1]));

    expect(await store.claim('mal', 1)).toBeNull();
    expect((await store.list('mal'))[0].claimedIds).toEqual([1]);
  });

  it('returns null when the anime is not part of any drop', async () => {
    const store = createDailyDropStore(memoryStorage());
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [1, 2, 3]));
    expect(await store.claim('mal', 99)).toBeNull();
  });

  it('keeps providers apart', async () => {
    const store = createDailyDropStore(memoryStorage());
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [1, 2, 3]));
    await store.record(createStoredDailyDrop('anilist', '2026-01-01', [4, 5, 6]));

    expect((await store.list('anilist'))[0].animeIds).toEqual([4, 5, 6]);
    expect((await store.list('mal'))[0].animeIds).toEqual([1, 2, 3]);
  });

  it('clears one provider or all of them', async () => {
    const storage = memoryStorage();
    const store = createDailyDropStore(storage);
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [1, 2, 3]));
    await store.record(createStoredDailyDrop('anilist', '2026-01-01', [4, 5, 6]));

    await store.clear('mal');
    expect(await store.list('mal')).toEqual([]);
    expect(await store.list('anilist')).toHaveLength(1);

    await store.clear();
    expect(storage.data.has(DAILY_DROP_KEY)).toBe(false);
  });

  it('ignores a corrupted record instead of failing the read', async () => {
    const storage = memoryStorage({
      [DAILY_DROP_KEY]: {
        mal: [{ version: 1, day: 'nope', providerId: 'mal', animeIds: [], claimedIds: [] }],
      },
    });

    expect(await createDailyDropStore(storage).list('mal')).toEqual([]);
  });

  it('serializes concurrent claims so none is lost', async () => {
    const store = createDailyDropStore(memoryStorage());
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [1, 2, 3]));

    await Promise.all([store.claim('mal', 1), store.claim('mal', 2), store.claim('mal', 3)]);

    expect([...(await store.list('mal'))[0].claimedIds].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('feeds the ids a later day excludes', async () => {
    const store = createDailyDropStore(memoryStorage());
    await store.record(createStoredDailyDrop('mal', '2026-01-01', [1, 2, 3]));
    expect([...seenDropIds(await store.list('mal'))].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });
});
