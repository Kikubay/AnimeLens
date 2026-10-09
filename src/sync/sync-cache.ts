import type { AnimeListEntry } from '../domain/anime';
import {
  ANIME_CACHE_TTL_MS,
  ANIME_CACHE_VERSION,
  type AnimeCache,
  type SyncMetadata,
} from '../domain/sync';
import type { StorageAdapter } from '../storage/storage-adapter';
import type { StorageKey } from '../storage/storage-types';
import type { AnimeCacheStore } from './sync-types';

// Always MAL; `ChromeAnimeCacheStore` migrates it into the MAL-scoped key on first read.
const LEGACY_STORAGE_KEY = 'animeData';

export function animeCacheStorageKey(providerId: 'mal' | 'anilist'): StorageKey {
  return `animeData:${providerId}`;
}

// v5 renamed malId/malScore to id/score and v7 re-mapped AniList's `popularity` into `memberCount` (its "rank" is really a member count). Both are re-mapped on read so existing users keep their list.
const LEGACY_CACHE_VERSIONS = [1, 2, 3, 4, 5, 6];

interface LegacyAnimeCache {
  readonly version: number;
  readonly cachedAt: string;
  readonly expiresAt: string;
  readonly entries: readonly unknown[];
  readonly sync: SyncMetadata;
}

function isLegacyCacheVersion(value: unknown): value is number {
  return typeof value === 'number' && LEGACY_CACHE_VERSIONS.includes(value);
}

function migrateLegacyEntry(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const anime = isRecord(value.anime) ? { ...value.anime } : value.anime;
  if (isRecord(anime)) {
    if (anime.id === undefined && anime.malId !== undefined) anime.id = anime.malId;
    if (anime.score === undefined && anime.malScore !== undefined) anime.score = anime.malScore;
    // Older caches parked AniList's member count in `popularity`; move it so cached lists score like freshly synced ones.
    if (anime.provider === 'anilist') {
      if (anime.memberCount === null || anime.memberCount === undefined) {
        anime.memberCount = typeof anime.popularity === 'number' ? anime.popularity : null;
      }
      anime.popularity = null;
    }
    if (Array.isArray(anime.genres)) {
      anime.genres = anime.genres.map((item: unknown) => renameLegacyResource(item));
    }
    if (Array.isArray(anime.themes)) {
      anime.themes = anime.themes.map((item: unknown) => renameLegacyResource(item));
    }
    if (Array.isArray(anime.studios)) {
      anime.studios = anime.studios.map((item: unknown) => renameLegacyResource(item));
    }
    if (Array.isArray(anime.staff)) {
      anime.staff = anime.staff.map((item: unknown) => renameLegacyResource(item));
    }
  }
  return { ...value, anime };
}

function renameLegacyResource(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.id === undefined && value.malId !== undefined) {
    return { ...value, id: value.malId };
  }
  return value;
}

export class ChromeAnimeCacheStore implements AnimeCacheStore {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly providerId: 'mal' | 'anilist' = 'mal',
  ) {}

  private get storageKey(): StorageKey {
    return animeCacheStorageKey(this.providerId);
  }

  async get(): Promise<unknown> {
    const raw = await this.storage.get(this.storageKey);
    if (raw !== undefined && raw !== null) return migrateLegacyCache(raw);
    // Only the MAL store inherits the pre-multi-provider cache.
    if (this.providerId !== 'mal') return undefined;
    const legacy = await this.storage.get(LEGACY_STORAGE_KEY);
    if (legacy === undefined || legacy === null) return undefined;
    await this.storage.set(this.storageKey, legacy as AnimeCache);
    await this.storage.remove(LEGACY_STORAGE_KEY);
    return migrateLegacyCache(legacy);
  }

  async set(cache: AnimeCache): Promise<void> {
    await this.storage.set(this.storageKey, cache);
  }

  async clear(): Promise<void> {
    await this.storage.remove(this.storageKey);
  }
}

export function createAnimeCache(
  entries: readonly AnimeListEntry[],
  now: Date = new Date(),
  ttlMs: number = ANIME_CACHE_TTL_MS,
): AnimeCache {
  const cachedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  // No progress here on purpose: it would have to be a localized sentence baked into storage, and every reader replaces it with its own copy anyway.
  const sync: SyncMetadata = {
    status: 'success',
    phase: 'complete',
    progress: null,
    lastSyncedAt: cachedAt,
    itemCount: entries.length,
    nextPageUrl: null,
    errorCode: null,
    errorMessage: null,
    fromCache: false,
  };
  return { version: ANIME_CACHE_VERSION, cachedAt, expiresAt, entries, sync };
}

export function isAnimeCache(value: unknown): value is AnimeCache {
  if (!isRecord(value)) return false;
  if (value.version !== ANIME_CACHE_VERSION) return false;
  if (!isIsoDate(value.cachedAt) || !isIsoDate(value.expiresAt)) return false;
  if (!Array.isArray(value.entries) || !isSyncMetadata(value.sync)) return false;
  if (value.sync.itemCount !== value.entries.length) return false;
  return value.entries.every(isAnimeListEntry);
}

// Anything that isn't a legacy cache passes through untouched; `isAnimeCache` rejects invalid data downstream.
export function migrateLegacyCache(value: unknown): unknown {
  if (!isRecord(value) || !isLegacyCacheVersion(value.version)) return value;
  const legacy = value as unknown as LegacyAnimeCache;
  if (!Array.isArray(legacy.entries)) return value;
  return {
    ...legacy,
    version: ANIME_CACHE_VERSION,
    entries: legacy.entries.map(migrateLegacyEntry),
  };
}

export function isFreshAnimeCache(cache: AnimeCache, now: Date = new Date()): boolean {
  return new Date(cache.expiresAt).getTime() > now.getTime();
}

function isSyncMetadata(value: unknown): value is SyncMetadata {
  if (!isRecord(value)) return false;
  return (
    isSyncStatus(value.status) &&
    (value.phase === null || isSyncPhase(value.phase)) &&
    (value.progress === null || isSyncProgress(value.progress)) &&
    (value.lastSyncedAt === null || isIsoDate(value.lastSyncedAt)) &&
    isNonNegativeInteger(value.itemCount) &&
    (value.nextPageUrl === null || typeof value.nextPageUrl === 'string') &&
    (value.errorCode === null || typeof value.errorCode === 'string') &&
    (value.errorMessage === null || typeof value.errorMessage === 'string') &&
    typeof value.fromCache === 'boolean'
  );
}

function isSyncProgress(value: unknown): value is NonNullable<SyncMetadata['progress']> {
  return (
    isRecord(value) &&
    isSyncPhase(value.phase) &&
    isNonNegativeInteger(value.current) &&
    (value.total === null || isNonNegativeInteger(value.total)) &&
    typeof value.message === 'string'
  );
}

function isAnimeListEntry(value: unknown): value is AnimeListEntry {
  if (!isRecord(value)) return false;
  return (
    isAnime(value.anime) &&
    isListStatus(value.status) &&
    isNonNegativeInteger(value.episodesWatched) &&
    (value.userScore === null || isScore(value.userScore)) &&
    (value.priority === null || isNonNegativeInteger(value.priority)) &&
    typeof value.isRewatching === 'boolean' &&
    (value.updatedAt === null || typeof value.updatedAt === 'string') &&
    (value.notes === null || typeof value.notes === 'string')
  );
}

function isAnime(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.title)) return false;
  const title = value.title;
  return (
    isPositiveInteger(value.id) &&
    typeof title.default === 'string' &&
    title.default.trim().length > 0 &&
    (title.english === null || typeof title.english === 'string') &&
    (title.japanese === null || typeof title.japanese === 'string') &&
    Array.isArray(title.synonyms) &&
    title.synonyms.every((item) => typeof item === 'string') &&
    (value.synopsis === null || typeof value.synopsis === 'string') &&
    isImage(value.image) &&
    (value.score === null || isScore(value.score)) &&
    (value.userScore === null || isScore(value.userScore)) &&
    Array.isArray(value.genres) &&
    value.genres.every(isNamedResource) &&
    Array.isArray(value.themes) &&
    value.themes.every(isNamedResource) &&
    Array.isArray(value.studios) &&
    value.studios.every(isNamedResource) &&
    Array.isArray(value.staff) &&
    value.staff.every(isStaffMember) &&
    (value.episodeCount === null || isNonNegativeInteger(value.episodeCount)) &&
    (value.year === null ||
      (typeof value.year === 'number' && Number.isInteger(value.year) && value.year >= 1900)) &&
    (value.season === null || isSeason(value.season)) &&
    isAiringStatus(value.status) &&
    isAnimeType(value.type) &&
    (value.popularity === null || isNonNegativeInteger(value.popularity)) &&
    (value.memberCount === null || isNonNegativeInteger(value.memberCount)) &&
    isStreamingSites(value.streamingSites)
  );
}

// Absent in older caches, which must keep validating or every returning user loses their whole list.
function isStreamingSites(value: unknown): boolean {
  if (value === undefined) return true;
  return (
    Array.isArray(value) &&
    value.every(
      (link) =>
        isRecord(link) &&
        typeof link.serviceId === 'string' &&
        typeof link.serviceName === 'string' &&
        (link.url === null || typeof link.url === 'string'),
    )
  );
}

function isImage(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      (value.medium === null || typeof value.medium === 'string') &&
      (value.large === null || typeof value.large === 'string'))
  );
}

function isNamedResource(value: unknown): boolean {
  return isRecord(value) && isPositiveInteger(value.id) && typeof value.name === 'string';
}

function isStaffMember(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    typeof value.name === 'string' &&
    Array.isArray(value.positions) &&
    value.positions.every((position) => typeof position === 'string') &&
    (value.imageUrl === null || typeof value.imageUrl === 'string')
  );
}

function isSeason(value: unknown): boolean {
  return value === 'winter' || value === 'spring' || value === 'summer' || value === 'fall';
}

function isAiringStatus(value: unknown): boolean {
  return (
    value === 'currently_airing' ||
    value === 'finished_airing' ||
    value === 'not_yet_aired' ||
    value === 'unknown'
  );
}

function isAnimeType(value: unknown): boolean {
  return (
    value === 'tv' ||
    value === 'movie' ||
    value === 'ova' ||
    value === 'ona' ||
    value === 'special' ||
    value === 'music' ||
    value === 'unknown'
  );
}

function isListStatus(value: unknown): boolean {
  return (
    value === 'watching' ||
    value === 'completed' ||
    value === 'on_hold' ||
    value === 'dropped' ||
    value === 'plan_to_watch' ||
    value === 'rewatching'
  );
}

function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;
}

function isSyncStatus(value: unknown): value is SyncMetadata['status'] {
  return (
    value === 'idle' ||
    value === 'syncing' ||
    value === 'success' ||
    value === 'error' ||
    value === 'offline'
  );
}

function isSyncPhase(value: unknown): value is NonNullable<SyncMetadata['phase']> {
  return (
    value === 'fetching' ||
    value === 'analyzing' ||
    value === 'calculating' ||
    value === 'complete' ||
    value === 'cache'
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
