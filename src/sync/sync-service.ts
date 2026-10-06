import { ApiError } from '../api/api-errors';
import type { AnimeListFetchOptions, AnimeProvider } from '../api/anime-provider';
import type { AnimeListEntry } from '../domain/anime';
import {
  type AnimeCache,
  type SyncErrorCode,
  type SyncMetadata,
  type SyncProgress,
} from '../domain/sync';
import { createAnimeCache, isAnimeCache, isFreshAnimeCache } from './sync-cache';
import type { AnimeCacheStore, SyncRunOptions, SyncResult } from './sync-types';
import { getCopy, type Language } from '../locales';

const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 30_000;
const BASE_RETRY_DELAY_MS = 250;
// +/-25% of the fallback delay, applied only when the server gave no usable Retry-After: clients without guidance compute the same backoff and retry in lockstep, and a spread that small barely changes the wait.
const RETRY_JITTER_RATIO = 0.25;

export class AnimeListSyncService {
  constructor(
    private readonly provider: AnimeProvider,
    private readonly cacheStore: AnimeCacheStore,
    private readonly now: () => Date = () => new Date(),
    private readonly sleep: (milliseconds: number) => Promise<void> = delay,
  ) {}

  async sync(options: SyncRunOptions = {}): Promise<SyncResult> {
    const copy = getCopy(options.language ?? 'en');
    const cache = await this.readCache();
    if (cache !== null && !options.force && isFreshAnimeCache(cache, this.now())) {
      return this.cacheResult(cache, copy.syncCacheHit);
    }

    this.report(options, {
      phase: 'fetching',
      current: 0,
      total: null,
      message: copy.syncProgressFetching,
    });

    try {
      const entries = await this.fetchWithRetry(options, (progress) => {
        this.report(options, {
          phase: 'fetching',
          current: progress.itemsFetched,
          total: null,
          message: copy.syncProgressFetchingCount(progress.itemsFetched),
        });
      });
      return await this.persist(entries, options, copy);
    } catch (error) {
      if (cache !== null) return this.offlineCacheResult(cache, error, copy);
      throw error;
    }
  }

  async invalidate(): Promise<void> {
    await this.cacheStore.clear();
  }

  async getCachedResult(language: Language = 'en'): Promise<SyncResult | null> {
    const cache = await this.readCache();
    return cache === null ? null : this.cacheResult(cache, getCopy(language).syncCacheHit);
  }

  private async fetchWithRetry(
    options: SyncRunOptions,
    onProgress: NonNullable<AnimeListFetchOptions['onProgress']>,
  ): Promise<AnimeListEntry[]> {
    const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? DEFAULT_MAX_RETRIES));
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.provider.getUserAnimeList({ onProgress });
      } catch (error) {
        if (!isRetryable(error) || attempt >= maxRetries) throw error;
        const retryAfterSeconds = error instanceof ApiError ? error.retryAfterSeconds : null;
        if (retryAfterSeconds !== null) {
          // A server-directed delay is honoured exactly; shortening it would retry inside a window the server hasn't reopened yet.
          await this.sleep(Math.min(retryAfterSeconds * 1000, MAX_RETRY_DELAY_MS));
          continue;
        }
        await this.sleep(withJitter(BASE_RETRY_DELAY_MS * 2 ** attempt));
      }
    }
  }

  private async persist(
    entries: readonly AnimeListEntry[],
    options: SyncRunOptions,
    copy: ReturnType<typeof getCopy>,
  ): Promise<SyncResult> {
    this.report(options, {
      phase: 'analyzing',
      current: entries.length,
      total: entries.length,
      message: copy.syncProgressFetched(entries.length),
    });
    this.report(options, {
      phase: 'analyzing',
      current: entries.length,
      total: entries.length,
      message: copy.syncProgressGenres,
    });
    this.report(options, {
      phase: 'calculating',
      current: 1,
      total: 1,
      message: copy.syncProgressPreferences,
    });

    const cache = createAnimeCache(entries, this.now());
    await this.cacheStore.set(cache);
    const metadata: SyncMetadata = {
      ...cache.sync,
      progress: {
        phase: 'complete',
        current: entries.length,
        total: entries.length,
        message: copy.syncProgressComplete,
      },
    };
    this.report(options, metadata.progress!);
    return { entries, metadata, fromCache: false };
  }

  private async readCache(): Promise<AnimeCache | null> {
    const raw = await this.cacheStore.get();
    if (raw === undefined || raw === null) return null;
    if (isAnimeCache(raw)) return raw;
    await this.cacheStore.clear();
    return null;
  }

  private cacheResult(cache: AnimeCache, message: string): SyncResult {
    const metadata = this.cacheMetadata(cache, 'success', message);
    return { entries: cache.entries, metadata, fromCache: true };
  }

  private offlineCacheResult(
    cache: AnimeCache,
    error: unknown,
    copy: ReturnType<typeof getCopy>,
  ): SyncResult {
    const errorCode = toSyncErrorCode(error);
    const metadata = this.cacheMetadata(
      cache,
      'offline',
      copy.syncOfflineFallback,
      errorCode,
      error instanceof Error ? error.message : copy.syncErrorMessage,
    );
    return { entries: cache.entries, metadata, fromCache: true };
  }

  private cacheMetadata(
    cache: AnimeCache,
    status: SyncMetadata['status'],
    message: string,
    errorCode: SyncErrorCode | null = null,
    errorMessage: string | null = null,
  ): SyncMetadata {
    return {
      ...cache.sync,
      status,
      phase: 'cache',
      progress: {
        phase: 'cache',
        current: cache.entries.length,
        total: cache.entries.length,
        message,
      },
      errorCode,
      errorMessage,
      fromCache: true,
    };
  }

  private report(options: SyncRunOptions, progress: SyncProgress): void {
    options.onProgress?.(progress);
  }
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    // `network_error` also covers 5xx and 408, so transient server failures retry instead of surfacing as an opaque `unknown`.
    (error.code === 'network_error' || error.code === 'rate_limited')
  );
}

function withJitter(milliseconds: number): number {
  const spread = milliseconds * RETRY_JITTER_RATIO;
  return Math.max(0, Math.round(milliseconds - spread + Math.random() * spread * 2));
}

function toSyncErrorCode(error: unknown): SyncErrorCode {
  if (error instanceof ApiError) {
    if (error.code === 'network_error') return 'network_error';
    if (error.code === 'rate_limited') return 'rate_limited';
    if (error.code === 'unauthorized') return 'unauthorized';
    if (error.code === 'invalid_response') return 'invalid_response';
  }
  return 'unknown';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
