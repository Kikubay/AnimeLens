import type { AnimeListEntry } from '../domain/anime';
import type { AnimeCache, SyncMetadata, SyncProgress } from '../domain/sync';
import type { Language } from '../locales';

export type SyncReason = 'initial' | 'manual' | 'reconnect';

export interface SyncRunOptions {
  readonly reason?: SyncReason;
  readonly force?: boolean;
  readonly maxRetries?: number;
  readonly onProgress?: (progress: SyncProgress) => void;
  /** Defaults to English. */
  readonly language?: Language;
}

export interface SyncResult {
  readonly entries: readonly AnimeListEntry[];
  readonly metadata: SyncMetadata;
  readonly fromCache: boolean;
}

export interface AnimeCacheStore {
  get(): Promise<unknown>;
  set(cache: AnimeCache): Promise<void>;
  clear(): Promise<void>;
}
