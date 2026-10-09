export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export type SyncPhase = 'fetching' | 'analyzing' | 'calculating' | 'complete' | 'cache';

export type SyncErrorCode =
  | 'network_error'
  | 'rate_limited'
  | 'unauthorized'
  | 'invalid_response'
  | 'cache_corrupted'
  | 'storage_full'
  | 'unknown';

export interface SyncProgress {
  readonly phase: SyncPhase;
  readonly current: number;
  readonly total: number | null;
  readonly message: string;
}

export interface SyncMetadata {
  readonly status: SyncStatus;
  readonly phase: SyncPhase | null;
  readonly progress: SyncProgress | null;
  readonly lastSyncedAt: string | null;
  readonly itemCount: number;
  readonly nextPageUrl: string | null;
  readonly errorCode: SyncErrorCode | null;
  readonly errorMessage: string | null;
  readonly fromCache: boolean;
}

export const ANIME_CACHE_VERSION = 7;
export const ANIME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

import type { AnimeListEntry } from './anime';

export interface AnimeCache {
  readonly version: number;
  readonly cachedAt: string;
  readonly expiresAt: string;
  readonly entries: readonly AnimeListEntry[];
  readonly sync: SyncMetadata;
}
