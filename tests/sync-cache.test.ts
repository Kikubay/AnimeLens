import { describe, expect, it } from 'vitest';
import { createAnimeCache, isAnimeCache, migrateLegacyCache } from '../src/sync/sync-cache';
import type { Anime, AnimeListEntry } from '../src/domain/anime';

const anime: Anime = {
  id: 1,
  title: { default: 'Cache test', english: null, japanese: null, synonyms: [] },
  synopsis: null,
  image: null,
  score: 8,
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
  popularity: 1,
  memberCount: 100,
};

const entry: AnimeListEntry = {
  anime,
  status: 'completed',
  userScore: 8,
  episodesWatched: 12,
  priority: null,
  isRewatching: false,
  updatedAt: null,
  notes: null,
};

describe('anime cache validation', () => {
  it('accepts a complete cache', () => {
    expect(isAnimeCache(createAnimeCache([entry]))).toBe(true);
  });

  it('rejects a cache with malformed nested genre data', () => {
    const cache = createAnimeCache([entry]);
    const corrupted = {
      ...cache,
      entries: [
        {
          ...entry,
          anime: { ...anime, genres: [{ id: 'bad', name: 'Drama' }] },
        },
      ],
    };

    expect(isAnimeCache(corrupted)).toBe(false);
  });

  it('rejects metadata whose count does not match its entries', () => {
    const cache = createAnimeCache([entry]);
    expect(isAnimeCache({ ...cache, sync: { ...cache.sync, itemCount: 2 } })).toBe(false);
  });
});

describe('legacy cache migration (pre-v5 malId/malScore fields)', () => {
  it('re-maps legacy anime and nested resource ids to the current shape', () => {
    const legacy = {
      version: 4,
      cachedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
      sync: createAnimeCache([entry]).sync,
      entries: [
        {
          ...entry,
          anime: {
            ...anime,
            // Pre-v5 shape: legacy field names only — no `id`/`score` present.
            id: undefined,
            score: undefined,
            malId: 42,
            malScore: 7.5,
            genres: [{ malId: 1, name: 'Drama' }],
            themes: [{ malId: 2, name: 'School' }],
            studios: [{ malId: 3, name: 'Studio' }],
            staff: [{ malId: 4, name: 'Person', positions: [], imageUrl: null }],
          },
        },
      ],
    };

    const migrated = migrateLegacyCache(legacy);
    expect(isAnimeCache(migrated)).toBe(true);
    const migratedEntry = (migrated as { entries: AnimeListEntry[] }).entries[0];
    expect(migratedEntry?.anime.id).toBe(42);
    expect(migratedEntry?.anime.score).toBe(7.5);
    expect(migratedEntry?.anime.genres[0]?.id).toBe(1);
    expect(migratedEntry?.anime.themes[0]?.id).toBe(2);
    expect(migratedEntry?.anime.studios[0]?.id).toBe(3);
    expect(migratedEntry?.anime.staff[0]?.id).toBe(4);
  });

  it('leaves current-version caches untouched', () => {
    const cache = createAnimeCache([entry]);
    expect(migrateLegacyCache(cache)).toEqual(cache);
  });

  it('passes through unknown shapes for downstream validation to reject', () => {
    expect(migrateLegacyCache(null)).toBeNull();
    expect(migrateLegacyCache({ version: 99 })).toEqual({ version: 99 });
  });
});
