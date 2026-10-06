import { describe, expect, it } from 'vitest';
import type { AnimeListEntry } from '../src/domain/anime';
import type { StorageAdapter } from '../src/storage/storage-adapter';
import type { StorageKey } from '../src/storage/storage-types';
import { planTopPicks } from '../src/profile/top-picks';
import {
  createTopPicksStore,
  TOP_PICKS_RANKING_KEY,
  TOP_PICKS_SIGNATURE_KEY,
} from '../src/profile/top-picks-store';

function entry(id: number, score: number, updatedAt: string | null = null): AnimeListEntry {
  return {
    anime: {
      id,
      title: { default: `Anime ${id}`, english: null, japanese: null, synonyms: [] },
      synopsis: null,
      image: null,
      score: 8,
      userScore: score,
      genres: [],
      themes: [],
      studios: [],
      staff: [],
      episodeCount: 12,
      year: 2024,
      season: 'spring',
      status: 'finished_airing',
      type: 'tv',
      popularity: 1,
      memberCount: 1,
    },
    status: 'completed',
    userScore: score,
    episodesWatched: 12,
    priority: null,
    isRewatching: false,
    updatedAt,
    notes: null,
  };
}

/** Two 10/10s lock the first two slots; five 9/10s contest the third. */
function contestedPlan(providerId = 'mal') {
  return planTopPicks(
    [
      entry(1, 10),
      entry(2, 10),
      entry(3, 9, '2024-01-01T00:00:00.000Z'),
      entry(4, 9, '2025-01-01T00:00:00.000Z'),
      entry(5, 9, '2026-01-01T00:00:00.000Z'),
    ],
    { providerId },
  );
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

describe('top picks store', () => {
  it('returns null when nothing has been saved', async () => {
    const store = createTopPicksStore(memoryStorage());

    expect(await store.load(contestedPlan())).toBeNull();
  });

  it('round-trips a saved ranking for the same pool', async () => {
    const storage = memoryStorage();
    const store = createTopPicksStore(storage);
    const plan = contestedPlan();

    await store.save(plan, [5]);

    expect(await store.load(contestedPlan())).toEqual([5]);
    expect(storage.data.get(TOP_PICKS_SIGNATURE_KEY)).toBe(plan.signature);
  });

  it('resets when the tied pool gains an entry at the boundary score', async () => {
    const storage = memoryStorage();
    const store = createTopPicksStore(storage);
    await store.save(contestedPlan(), [5]);

    // A sixth 9/10 grows the tie, so the saved answer no longer matches.
    const grown = planTopPicks(
      [entry(1, 10), entry(2, 10), entry(3, 9), entry(4, 9), entry(5, 9), entry(6, 9)],
      { providerId: 'mal' },
    );

    expect(await store.load(grown)).toBeNull();
    expect(storage.data.has(TOP_PICKS_RANKING_KEY)).toBe(false);
    expect(storage.data.has(TOP_PICKS_SIGNATURE_KEY)).toBe(false);
  });

  it('resets when a tied entry is re-scored out of the pool', async () => {
    const storage = memoryStorage();
    const store = createTopPicksStore(storage);
    await store.save(contestedPlan(), [5]);

    const rescored = planTopPicks(
      [entry(1, 10), entry(2, 10), entry(3, 9), entry(4, 9), entry(5, 2)],
      { providerId: 'mal' },
    );

    expect(await store.load(rescored)).toBeNull();
    expect(storage.data.has(TOP_PICKS_RANKING_KEY)).toBe(false);
  });

  it('keeps the ranking when an unrelated anime is rated below the boundary', async () => {
    const storage = memoryStorage();
    const store = createTopPicksStore(storage);
    await store.save(contestedPlan(), [5]);

    const edited = planTopPicks(
      [entry(1, 10), entry(2, 10), entry(3, 9), entry(4, 9), entry(5, 9), entry(99, 2)],
      { providerId: 'mal' },
    );

    expect(await store.load(edited)).toEqual([5]);
    expect(storage.data.has(TOP_PICKS_RANKING_KEY)).toBe(true);
  });

  it('never lets a MAL ranking validate against an AniList pool', async () => {
    const storage = memoryStorage();
    const store = createTopPicksStore(storage);
    await store.save(contestedPlan('mal'), [5]);

    // Same ids, same scores, different provider.
    const anilist = planTopPicks(
      [entry(1, 10), entry(2, 10), entry(3, 9), entry(4, 9), entry(5, 9)],
      { providerId: 'anilist' },
    );

    expect(await store.load(anilist)).toBeNull();
  });

  it('drops a stored ranking once the tie resolves itself', async () => {
    const storage = memoryStorage();
    const store = createTopPicksStore(storage);
    await store.save(contestedPlan(), [5]);

    // Deleting tied entries leaves nothing to choose.
    const resolved = planTopPicks([entry(1, 10), entry(2, 10), entry(3, 9)], {
      providerId: 'mal',
    });

    expect(resolved.needsChoice).toBe(false);
    expect(await store.load(resolved)).toBeNull();
    expect(storage.data.has(TOP_PICKS_RANKING_KEY)).toBe(false);
  });

  it('drops a stored ranking of the wrong length', async () => {
    const storage = memoryStorage();
    const store = createTopPicksStore(storage);
    const plan = contestedPlan();
    await storage.set(TOP_PICKS_RANKING_KEY, [3, 4, 5]);
    await storage.set(TOP_PICKS_SIGNATURE_KEY, plan.signature);

    expect(await store.load(plan)).toBeNull();
  });

  it('rejects corrupted storage values instead of trusting them', async () => {
    const plan = contestedPlan();
    for (const corrupt of [[3, 'four'], 'nope', { ids: [3] }, [3, -1], [3, 1.5]]) {
      const storage = memoryStorage({
        [TOP_PICKS_RANKING_KEY]: corrupt,
        [TOP_PICKS_SIGNATURE_KEY]: plan.signature,
      });

      expect(await createTopPicksStore(storage).load(plan)).toBeNull();
    }
  });

  it('clears both keys together', async () => {
    const storage = memoryStorage();
    const store = createTopPicksStore(storage);
    await store.save(contestedPlan(), [5]);

    await store.clear();

    expect(storage.data.has(TOP_PICKS_RANKING_KEY)).toBe(false);
    expect(storage.data.has(TOP_PICKS_SIGNATURE_KEY)).toBe(false);
  });

  it('does not write when there is nothing stored to invalidate', async () => {
    const storage = memoryStorage();
    const writes: string[] = [];
    const spy = {
      ...storage,
      async remove(key: StorageKey) {
        writes.push(key);
        await storage.remove(key);
      },
    };

    await createTopPicksStore(spy).load(contestedPlan());

    expect(writes).toEqual([]);
  });
});
