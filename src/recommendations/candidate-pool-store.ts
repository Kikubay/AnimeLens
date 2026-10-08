import type { Anime } from '../domain/anime';
import type { SessionStorageArea } from '../storage/session-area';

// Session storage rather than a module variable, so an MV3 worker that was evicted between two popup opens doesn't pay the two provider calls again.
export const CANDIDATE_POOL_STORAGE_KEY = 'candidatePool';
// The pool depends only on the account, so a short TTL kills the amplification without making recommendations feel stale.
export const CANDIDATE_POOL_TTL_MS = 10 * 60 * 1000;

interface StoredCandidatePool {
  readonly providerId: string;
  readonly fetchedAt: number;
  readonly pool: readonly Anime[];
}

export interface CandidatePoolStore {
  /** `null` means "fetch it", which covers a miss, an expiry and a rejected blob alike. */
  load(providerId: string, now: number): Promise<readonly Anime[] | null>;
  save(providerId: string, pool: readonly Anime[], now: number): Promise<void>;
  clear(): Promise<void>;
}

export function createCandidatePoolStore(area: SessionStorageArea): CandidatePoolStore {
  return {
    async load(providerId, now) {
      const stored = await area.get(CANDIDATE_POOL_STORAGE_KEY);
      if (!isStoredCandidatePool(stored)) return null;
      if (stored.providerId !== providerId) return null;
      return now - stored.fetchedAt < CANDIDATE_POOL_TTL_MS ? stored.pool : null;
    },

    async save(providerId, pool, now) {
      const record: StoredCandidatePool = { providerId, fetchedAt: now, pool };
      await area.set(CANDIDATE_POOL_STORAGE_KEY, record);
    },

    async clear() {
      await area.remove(CANDIDATE_POOL_STORAGE_KEY);
    },
  };
}

function isStoredCandidatePool(value: unknown): value is StoredCandidatePool {
  if (!isRecord(value)) return false;
  if (typeof value.providerId !== 'string' || value.providerId.length === 0) return false;
  if (typeof value.fetchedAt !== 'number' || !Number.isFinite(value.fetchedAt)) return false;
  return Array.isArray(value.pool) && value.pool.every(isPoolEntry);
}

function isPoolEntry(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'number' && Number.isInteger(value.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
