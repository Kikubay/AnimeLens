import { describe, expect, it } from 'vitest';
import type { StorageAdapter } from '../src/storage/storage-adapter';
import type { StorageKey } from '../src/storage/storage-types';
import { emptyProfileSummary } from '../src/profile/profile-types';
import type { UserProfileSummary } from '../src/profile/profile-types';
import { PROFILE_HISTORY_CAPACITY } from '../src/profile/profile-delta';
import {
  PROFILE_HISTORY_KEY,
  createProfileHistoryStore,
} from '../src/profile/profile-history-store';

function summary(overrides: Partial<UserProfileSummary> = {}): UserProfileSummary {
  return {
    ...emptyProfileSummary(),
    analyzedAnimeCount: 100,
    ratedAnimeCount: 80,
    averageScore: 8.1,
    hasData: true,
    favoriteGenres: [{ name: 'Action', score: 90, positive: 9, negative: 0, count: 10 }],
    ...overrides,
  };
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

/** The raw snapshot ring, to assert on what actually reached storage. */
function readSnapshots(storage: ReturnType<typeof memoryStorage>, providerId = 'mal'): unknown[] {
  const all = storage.data.get(PROFILE_HISTORY_KEY) as
    Record<string, { snapshots: unknown[] }> | undefined;
  return all?.[providerId]?.snapshots ?? [];
}

describe('profile history store', () => {
  it('returns null when nothing has been recorded', async () => {
    expect(await createProfileHistoryStore(memoryStorage()).load('mal')).toBeNull();
  });

  it('round-trips a recorded profile', async () => {
    const store = createProfileHistoryStore(memoryStorage());

    await store.record('mal', summary(), '2026-01-01T00:00:00.000Z');

    const loaded = await store.load('mal');
    expect(loaded?.analyzedAnimeCount).toBe(100);
    expect(loaded?.providerId).toBe('mal');
    expect(loaded?.capturedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(loaded?.genres).toEqual([{ name: 'Action', score: 90, count: 10 }]);
  });

  it('persists only the measured half of the summary', async () => {
    const storage = memoryStorage();
    const store = createProfileHistoryStore(storage);

    await store.record(
      'mal',
      summary({
        detectedPreferences: [{ label: 'Detected rich worlds', detail: 'Action', score: 90 }],
      }),
    );

    const raw = JSON.stringify(storage.data.get(PROFILE_HISTORY_KEY));

    expect(raw).not.toContain('positive');
    expect(raw).not.toContain('Detected rich worlds');
    expect(raw).toContain('Action');
  });

  it('never lets one provider read another provider history', async () => {
    const store = createProfileHistoryStore(memoryStorage());
    await store.record('mal', summary({ analyzedAnimeCount: 100 }));

    expect(await store.load('anilist')).toBeNull();
  });

  it('keeps the two providers side by side', async () => {
    const store = createProfileHistoryStore(memoryStorage());

    await store.record('mal', summary({ analyzedAnimeCount: 100 }));
    await store.record('anilist', summary({ analyzedAnimeCount: 250 }));

    expect((await store.load('mal'))?.analyzedAnimeCount).toBe(100);
    expect((await store.load('anilist'))?.analyzedAnimeCount).toBe(250);
  });

  it('returns the newest snapshot', async () => {
    const store = createProfileHistoryStore(memoryStorage());

    await store.record('mal', summary({ analyzedAnimeCount: 100 }), '2026-01-01T00:00:00.000Z');
    await store.record('mal', summary({ analyzedAnimeCount: 120 }), '2026-02-01T00:00:00.000Z');

    expect((await store.load('mal'))?.analyzedAnimeCount).toBe(120);
  });

  it('caps the ring', async () => {
    const storage = memoryStorage();
    const store = createProfileHistoryStore(storage);

    for (let index = 1; index <= PROFILE_HISTORY_CAPACITY + 3; index += 1) {
      await store.record('mal', summary({ analyzedAnimeCount: index * 10 }));
    }

    const history = storage.data.get(PROFILE_HISTORY_KEY) as {
      mal: { snapshots: { analyzedAnimeCount: number }[] };
    };
    expect(history.mal.snapshots).toHaveLength(PROFILE_HISTORY_CAPACITY);

    expect(history.mal.snapshots[0]?.analyzedAnimeCount).toBe((PROFILE_HISTORY_CAPACITY + 3) * 10);
  });

  it('does not record a profile identical to the current one', async () => {
    const storage = memoryStorage();
    const store = createProfileHistoryStore(storage);
    await store.record('mal', summary(), '2026-01-01T00:00:00.000Z');

    await store.record('mal', summary(), '2026-02-01T00:00:00.000Z');

    expect(readSnapshots(storage)).toHaveLength(1);
  });

  it('records again once the profile actually moves', async () => {
    const storage = memoryStorage();
    const store = createProfileHistoryStore(storage);
    await store.record('mal', summary());

    await store.record('mal', summary({ analyzedAnimeCount: 101 }));

    expect(readSnapshots(storage)).toHaveLength(2);
  });

  it('serializes concurrent records instead of losing one', async () => {
    const storage = memoryStorage();
    const store = createProfileHistoryStore(storage);

    await Promise.all([
      store.record('mal', summary({ analyzedAnimeCount: 100 })),
      store.record('mal', summary({ analyzedAnimeCount: 120 })),
      store.record('mal', summary({ analyzedAnimeCount: 140 })),
    ]);

    expect(readSnapshots(storage)).toHaveLength(3);
  });

  it('ignores a snapshot recorded under a different shape version', async () => {
    const storage = memoryStorage({
      [PROFILE_HISTORY_KEY]: {
        mal: {
          snapshots: [
            {
              version: 99,
              capturedAt: '2026-01-01T00:00:00.000Z',
              providerId: 'mal',
              analyzedAnimeCount: 10,
              ratedAnimeCount: 5,
              averageScore: 7,
              genres: [],
              themes: [],
              studios: [],
            },
          ],
        },
      },
    });

    expect(await createProfileHistoryStore(storage).load('mal')).toBeNull();
  });

  it('rejects corrupted storage instead of trusting it', async () => {
    const valid = {
      version: 1,
      capturedAt: '2026-01-01T00:00:00.000Z',
      providerId: 'mal',
      analyzedAnimeCount: 10,
      ratedAnimeCount: 5,
      averageScore: 7,
      genres: [],
      themes: [],
      studios: [],
    };
    const corrupt: unknown[] = [
      'nope',
      42,
      [],
      { mal: 'nope' },
      { mal: {} },
      { mal: { snapshots: 'nope' } },
      { mal: { snapshots: [null] } },
      { mal: { snapshots: [{ ...valid, version: 1.5 }] } },
      { mal: { snapshots: [{ ...valid, analyzedAnimeCount: -1 }] } },
      { mal: { snapshots: [{ ...valid, analyzedAnimeCount: 1.5 }] } },
      { mal: { snapshots: [{ ...valid, averageScore: 'high' }] } },
      { mal: { snapshots: [{ ...valid, providerId: 7 }] } },
      { mal: { snapshots: [{ ...valid, genres: [{ name: 'Action' }] }] } },
      { mal: { snapshots: [{ ...valid, genres: [{ name: '', score: 1, count: 1 }] }] } },
      { mal: { snapshots: [{ ...valid, genres: [{ name: 'A', score: 'high', count: 1 }] }] } },
      { mal: { snapshots: [{ ...valid, studios: [{ name: 'A', score: 1, count: -3 }] }] } },
    ];

    for (const value of corrupt) {
      const storage = memoryStorage({ [PROFILE_HISTORY_KEY]: value });
      expect(
        await createProfileHistoryStore(storage).load('mal'),
        JSON.stringify(value),
      ).toBeNull();
    }
  });

  it('keeps the valid providers out of a partly corrupted map', async () => {
    const storage = memoryStorage({
      [PROFILE_HISTORY_KEY]: { mal: 'nope', anilist: { snapshots: [] } },
    });
    const store = createProfileHistoryStore(storage);

    await store.record('mal', summary());

    expect((await store.load('mal'))?.analyzedAnimeCount).toBe(100);
  });

  it('clears one provider without touching the other', async () => {
    const storage = memoryStorage();
    const store = createProfileHistoryStore(storage);
    await store.record('mal', summary({ analyzedAnimeCount: 100 }));
    await store.record('anilist', summary({ analyzedAnimeCount: 250 }));

    await store.clear('mal');

    expect(await store.load('mal')).toBeNull();
    expect((await store.load('anilist'))?.analyzedAnimeCount).toBe(250);
  });

  it('drops the key entirely once the last provider is cleared', async () => {
    const storage = memoryStorage();
    const store = createProfileHistoryStore(storage);
    await store.record('mal', summary());

    await store.clear('mal');

    expect(storage.data.has(PROFILE_HISTORY_KEY)).toBe(false);
  });

  it('clears every provider at once', async () => {
    const storage = memoryStorage();
    const store = createProfileHistoryStore(storage);
    await store.record('mal', summary());
    await store.record('anilist', summary());

    await store.clear();

    expect(storage.data.has(PROFILE_HISTORY_KEY)).toBe(false);
  });

  it('does not write when clearing a provider that was never recorded', async () => {
    const storage = memoryStorage();
    const writes: string[] = [];
    const spy: StorageAdapter = {
      ...storage,
      async set(key, value) {
        writes.push(key);
        await storage.set(key, value);
      },
    };

    await createProfileHistoryStore(spy).clear('mal');

    expect(writes).toEqual([]);
  });
});
