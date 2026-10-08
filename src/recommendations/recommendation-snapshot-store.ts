import type { Anime } from '../domain/anime';
import type { RecommendationFeedback } from '../domain/feedback';
import type { UserPreferences } from '../settings/settings-types';
import type { SessionStorageArea } from '../storage/session-area';
import type { DashboardRecommendationSnapshot } from './recommendation-messages';

export const DASHBOARD_SNAPSHOT_STORAGE_KEY = 'dashboardSnapshot';
export const DASHBOARD_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export interface DashboardSignatureInput {
  readonly providerId: string;
  readonly cacheVersion: number;
  readonly cachedAt: string;
  readonly pool: readonly Anime[];
  readonly preferences: UserPreferences;
  readonly feedback: readonly RecommendationFeedback[];
}

interface StoredDashboardSnapshot {
  readonly signature: string;
  readonly storedAt: number;
  readonly snapshot: DashboardRecommendationSnapshot;
}

export interface DashboardSnapshotStore {
  load(signature: string, now: number): Promise<DashboardRecommendationSnapshot | null>;
  save(signature: string, snapshot: DashboardRecommendationSnapshot, now: number): Promise<void>;
  clear(): Promise<void>;
}

export function createDashboardSnapshotStore(area: SessionStorageArea): DashboardSnapshotStore {
  return {
    async load(signature, now) {
      const stored = await area.get(DASHBOARD_SNAPSHOT_STORAGE_KEY);
      if (!isStoredDashboardSnapshot(stored)) return null;
      if (stored.signature !== signature) return null;
      return now - stored.storedAt < DASHBOARD_SNAPSHOT_TTL_MS ? stored.snapshot : null;
    },

    async save(signature, snapshot, now) {
      const record: StoredDashboardSnapshot = { signature, storedAt: now, snapshot };
      await area.set(DASHBOARD_SNAPSHOT_STORAGE_KEY, record);
    },

    async clear() {
      await area.remove(DASHBOARD_SNAPSHOT_STORAGE_KEY);
    },
  };
}

export function dashboardSignature(input: DashboardSignatureInput): string {
  let hash = fnv1a(input.providerId);
  hash = mix(hash, `${input.cacheVersion}|${input.cachedAt}|${input.preferences.language}`);
  hash = mix(hash, stableJson(input.preferences));
  for (const anime of input.pool) hash = mix(hash, `|a${anime.id}`);
  for (const item of input.feedback) {
    hash = mix(hash, `|f${item.animeMalId}:${item.value}:${item.createdAt}`);
  }
  return (hash >>> 0).toString(36);
}

function fnv1a(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash;
}

function mix(hash: number, part: string): number {
  let next = hash;
  for (let index = 0; index < part.length; index += 1) {
    next ^= part.charCodeAt(index);
    next = Math.imul(next, 0x01000193);
  }
  return next;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) => {
    if (nested === null || typeof nested !== 'object' || Array.isArray(nested)) return nested;
    return Object.fromEntries(
      Object.entries(nested as Record<string, unknown>).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
  });
}

function isStoredDashboardSnapshot(value: unknown): value is StoredDashboardSnapshot {
  if (!isRecord(value)) return false;
  if (typeof value.signature !== 'string' || value.signature.length === 0) return false;
  if (typeof value.storedAt !== 'number' || !Number.isFinite(value.storedAt)) return false;
  return isDashboardSnapshot(value.snapshot);
}

function isDashboardSnapshot(value: unknown): value is DashboardRecommendationSnapshot {
  if (!isRecord(value)) return false;
  if (!isSnapshotStatus(value.status)) return false;
  if (!Array.isArray(value.sections)) return false;
  return (
    (value.daily === null || isRecord(value.daily)) &&
    typeof value.analyzedCount === 'number' &&
    value.sections.every(
      (section) =>
        isRecord(section) &&
        typeof section.id === 'string' &&
        Array.isArray(section.recommendations),
    )
  );
}

function isSnapshotStatus(value: unknown): boolean {
  return (
    value === 'loading' ||
    value === 'ready' ||
    value === 'empty' ||
    value === 'error' ||
    value === 'offline'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
