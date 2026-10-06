import { describe, expect, it } from 'vitest';
import type { Anime, AnimeListEntry } from '../src/domain/anime';
import { ApiError } from '../src/api/api-errors';
import type { AnimeProvider, AnimeListFetchOptions } from '../src/api/anime-provider';
import { createAnimeCache } from '../src/sync/sync-cache';
import { AnimeListSyncService } from '../src/sync/sync-service';
import type { AnimeCacheStore } from '../src/sync/sync-types';
import type { UserProfile } from '../src/domain/user-profile';

const anime: Anime = {
  id: 1,
  title: { default: 'Test anime', english: null, japanese: null, synonyms: [] },
  synopsis: null,
  image: null,
  score: 8,
  userScore: null,
  genres: [{ id: 1, name: 'Drama' }],
  themes: [],
  studios: [],
  staff: [],
  episodeCount: 12,
  year: 2024,
  season: 'winter',
  status: 'finished_airing',
  type: 'tv',
  popularity: 1,
  memberCount: 100,
};

function entry(id: number): AnimeListEntry {
  return {
    anime: { ...anime, id: id },
    status: id % 2 === 0 ? 'completed' : 'watching',
    userScore: 8,
    episodesWatched: 12,
    priority: null,
    isRewatching: false,
    updatedAt: null,
    notes: null,
  };
}

class MemoryCache implements AnimeCacheStore {
  value: unknown;
  clearCalls = 0;
  async get() {
    return this.value;
  }
  async set(cache: Parameters<AnimeCacheStore['set']>[0]) {
    this.value = cache;
  }
  async clear() {
    this.clearCalls += 1;
    this.value = undefined;
  }
}

class StubProvider implements AnimeProvider {
  calls = 0;
  constructor(
    private readonly entries: readonly AnimeListEntry[],
    private readonly failure?: ApiError,
  ) {}
  async getCurrentUser(): Promise<UserProfile> {
    throw new Error('Not used in list synchronization.');
  }
  async getUserAnimeList(options?: AnimeListFetchOptions): Promise<AnimeListEntry[]> {
    this.calls += 1;
    if (this.failure !== undefined) throw this.failure;
    options?.onProgress?.({ page: 1, itemsFetched: this.entries.length, nextPageUrl: null });
    return [...this.entries];
  }
  async getAnime(): Promise<Anime> {
    return anime;
  }
  async searchAnime(): Promise<Anime[]> {
    return [];
  }
  async addToList(): Promise<void> {
    return undefined;
  }
}

describe('AnimeListSyncService', () => {
  it('synchronizes an empty list and exposes the expected analysis steps', async () => {
    const provider = new StubProvider([]);
    const cache = new MemoryCache();
    const progress: string[] = [];
    const service = new AnimeListSyncService(provider, cache);

    const result = await service.sync({ onProgress: (item) => progress.push(item.message) });

    expect(result.entries).toEqual([]);
    expect(result.metadata.itemCount).toBe(0);
    expect(progress).toEqual([
      'Analyzing your list…',
      'Analyzing your list… 0 anime fetched',
      '✓ 0 anime fetched',
      '✓ Genres analyzed',
      '✓ Preferences calculated',
      'Synchronization complete',
    ]);
  });

  it('handles a large list and stores a versioned cache', async () => {
    const entries = Array.from({ length: 1200 }, (_, index) => entry(index + 1));
    const provider = new StubProvider(entries);
    const cache = new MemoryCache();
    const service = new AnimeListSyncService(provider, cache);

    const result = await service.sync();

    expect(result.entries).toHaveLength(1200);
    expect(result.metadata.itemCount).toBe(1200);
    expect(cache.value).toMatchObject({ version: 5, entries });
  });

  it('uses a fresh existing cache without making a network request', async () => {
    const provider = new StubProvider([entry(2)]);
    const cache = new MemoryCache();
    cache.value = createAnimeCache([entry(1)], new Date('2026-09-09T10:00:00.000Z'));
    const service = new AnimeListSyncService(
      provider,
      cache,
      () => new Date('2026-09-09T11:00:00.000Z'),
    );

    const result = await service.sync();

    expect(result.fromCache).toBe(true);
    expect(result.entries[0]?.anime.id).toBe(1);
    expect(provider.calls).toBe(0);
  });

  it('invalidates a corrupted cache before fetching fresh data', async () => {
    const provider = new StubProvider([entry(3)]);
    const cache = new MemoryCache();
    cache.value = { version: 999, entries: 'corrupted' };
    const service = new AnimeListSyncService(provider, cache);

    const result = await service.sync();

    expect(result.entries[0]?.anime.id).toBe(3);
    expect(cache.clearCalls).toBe(1);
    expect(provider.calls).toBe(1);
  });

  it('retries a rate-limited request with a controlled delay', async () => {
    let calls = 0;
    const provider: AnimeProvider = {
      getCurrentUser: async () => {
        throw new Error('Not used');
      },
      getUserAnimeList: async () => {
        calls += 1;
        if (calls === 1) {
          throw new ApiError('slow down', { code: 'rate_limited', retryAfterSeconds: 2 });
        }
        return [entry(4)];
      },
      getAnime: async () => anime,
      searchAnime: async () => [],
      addToList: async () => undefined,
    };
    const waits: number[] = [];
    const service = new AnimeListSyncService(provider, new MemoryCache(), undefined, async (ms) => {
      waits.push(ms);
    });

    const result = await service.sync({ maxRetries: 1 });

    expect(result.entries).toHaveLength(1);
    expect(calls).toBe(2);
    expect(waits).toEqual([2000]);
  });

  it('honours a server Retry-After exactly and jitters only the fallback', async () => {
    const jittered: number[] = [];
    const guided: number[] = [];

    // Shortening a guided delay would retry inside a window the provider hasn't reopened yet.
    let guidedCalls = 0;
    const guidedProvider: AnimeProvider = {
      getCurrentUser: async () => {
        throw new Error('Not used');
      },
      getUserAnimeList: async () => {
        guidedCalls += 1;
        if (guidedCalls === 1) {
          throw new ApiError('slow down', { code: 'rate_limited', retryAfterSeconds: 4 });
        }
        return [entry(4)];
      },
      getAnime: async () => anime,
      searchAnime: async () => [],
      addToList: async () => undefined,
    };
    const guidedService = new AnimeListSyncService(
      guidedProvider,
      new MemoryCache(),
      undefined,
      async (ms) => {
        guided.push(ms);
      },
    );
    await guidedService.sync({ maxRetries: 1 });
    expect(guided).toEqual([4000]);

    // The unguided fallback is spread so concurrent clients don't all wake together; each run needs its own provider, or only the first would retry.
    for (let run = 0; run < 12; run += 1) {
      let fallbackCalls = 0;
      const fallbackProvider: AnimeProvider = {
        ...guidedProvider,
        getUserAnimeList: async () => {
          fallbackCalls += 1;
          if (fallbackCalls === 1) {
            throw new ApiError('offline', { code: 'network_error' });
          }
          return [entry(4)];
        },
      };
      const service = new AnimeListSyncService(
        fallbackProvider,
        new MemoryCache(),
        undefined,
        async (ms) => {
          jittered.push(ms);
        },
      );
      await service.sync({ maxRetries: 1 });
    }

    expect(jittered).toHaveLength(12);
    // Nominal 250ms, +/-25%, so 188..313 — never the bare 250.
    for (const wait of jittered) {
      expect(wait).toBeGreaterThanOrEqual(187);
      expect(wait).toBeLessThanOrEqual(313);
    }
    expect(new Set(jittered).size).toBeGreaterThan(1);
  });

  it('retries a transient server failure', async () => {
    let calls = 0;
    const provider: AnimeProvider = {
      getCurrentUser: async () => {
        throw new Error('Not used');
      },
      getUserAnimeList: async () => {
        calls += 1;
        if (calls === 1) throw new ApiError('bad gateway', { code: 'network_error', status: 502 });
        return [entry(4)];
      },
      getAnime: async () => anime,
      searchAnime: async () => [],
      addToList: async () => undefined,
    };
    const service = new AnimeListSyncService(provider, new MemoryCache(), undefined, async () => {
      });

    await expect(service.sync({ maxRetries: 1 })).resolves.toMatchObject({ fromCache: false });
    expect(calls).toBe(2);
  });

  it('falls back to an expired cache when the network is unavailable', async () => {
    const cache = new MemoryCache();
    cache.value = createAnimeCache([entry(5)], new Date('2026-09-01T10:00:00.000Z'));
    const provider = new StubProvider([], new ApiError('offline', { code: 'network_error' }));
    const service = new AnimeListSyncService(
      provider,
      cache,
      () => new Date('2026-09-09T10:00:00.000Z'),
      async () => undefined,
    );

    const result = await service.sync({ maxRetries: 0 });

    expect(result.fromCache).toBe(true);
    expect(result.metadata.status).toBe('offline');
    expect(result.metadata.errorCode).toBe('network_error');
    expect(result.entries[0]?.anime.id).toBe(5);
  });

  it('does not treat an expired access token as a retryable network error', async () => {
    const provider = new StubProvider(
      [],
      new ApiError('expired', { code: 'unauthorized', status: 401 }),
    );
    const service = new AnimeListSyncService(provider, new MemoryCache());

    await expect(service.sync({ maxRetries: 3 })).rejects.toMatchObject({
      code: 'unauthorized',
    });
    expect(provider.calls).toBe(1);
  });
});
