import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChromeStorageAdapter,
  StorageQuotaError,
  isStorageQuotaFailure,
} from '../src/storage/storage-adapter';
import { toSyncErrorCode } from '../src/sync/sync-service';
import { createAnimeCache } from '../src/sync/sync-cache';
import { ApiError } from '../src/api/api-errors';
import type { Anime } from '../src/domain/anime';

const anime: Anime = {
  id: 1,
  provider: 'mal',
  title: { default: 'Cached', english: null, japanese: null, synonyms: [] },
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
  memberCount: 1000,
};

const entry = {
  anime,
  status: 'completed' as const,
  userScore: 8,
  episodesWatched: 12,
  priority: null,
  isRewatching: false,
  updatedAt: null,
  notes: null,
};

function withChromeStorage(): { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> } {
  const get = vi.fn(async () => ({}));
  const set = vi.fn(async () => undefined);
  vi.stubGlobal('chrome', { storage: { local: { get, set, remove: vi.fn() } } });
  return { get, set };
}

describe('storage quota', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('recognises the quota markers Chrome rejects a write with', () => {
    expect(isStorageQuotaFailure(new Error('QUOTA_BYTES quota exceeded'))).toBe(true);
    expect(isStorageQuotaFailure(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'))).toBe(true);
    expect(isStorageQuotaFailure(new Error('The quota has been exceeded.'))).toBe(true);
    expect(isStorageQuotaFailure(new Error('disk offline'))).toBe(false);
    expect(isStorageQuotaFailure('quota')).toBe(false);
    expect(isStorageQuotaFailure(null)).toBe(false);
  });

  it('raises a typed error instead of letting a failed cache write look like a success', async () => {
    const { set } = withChromeStorage();
    set.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    const adapter = new ChromeStorageAdapter();

    await expect(adapter.set('animeData:mal', createAnimeCache([entry]))).rejects.toBeInstanceOf(
      StorageQuotaError,
    );
  });

  it('passes a write through untouched when the failure is not the quota', async () => {
    const { set } = withChromeStorage();
    set.mockRejectedValue(new Error('The storage area is unavailable.'));
    const adapter = new ChromeStorageAdapter();

    await expect(adapter.set('animeData:mal', createAnimeCache([entry]))).rejects.toThrow(
      'The storage area is unavailable.',
    );
    await expect(
      adapter.set('animeData:mal', createAnimeCache([entry])),
    ).rejects.not.toBeInstanceOf(StorageQuotaError);
  });

  it('writes through when the browser accepts the payload', async () => {
    const { set } = withChromeStorage();
    const adapter = new ChromeStorageAdapter();
    const cache = createAnimeCache([entry]);

    await adapter.set('animeData:mal', cache);
    expect(set).toHaveBeenCalledWith({ 'animeData:mal': cache });
  });

  it('reports a full disk as its own sync error code rather than an unknown failure', () => {
    expect(toSyncErrorCode(new StorageQuotaError(new Error('QUOTA_BYTES')))).toBe('storage_full');
    expect(toSyncErrorCode(new ApiError('boom', { code: 'network_error' }))).toBe('network_error');
    expect(toSyncErrorCode(new ApiError('boom', { code: 'unauthorized' }))).toBe('unauthorized');
    expect(toSyncErrorCode(new Error('unknown'))).toBe('unknown');
  });
});

describe('stored cache metadata', () => {
  it('stores no progress sentence, since every reader replaces it with its own language', () => {
    expect(createAnimeCache([entry]).sync.progress).toBeNull();
  });
});
