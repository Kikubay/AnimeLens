import type { StorageAdapter } from '../storage/storage-adapter';
import type {
  StoredPreferenceItem,
  StoredProfileHistory,
  StoredProfileSnapshot,
} from '../storage/storage-types';
import {
  PROFILE_HISTORY_CAPACITY,
  PROFILE_HISTORY_VERSION,
  sameProfileMeasurement,
  toStoredProfileSnapshot,
} from './profile-delta';
import type { UserProfileSummary } from './profile-types';

export const PROFILE_HISTORY_KEY = 'profileHistory';

export interface ProfileHistoryStore {
  /** `null` when there's no history for this provider, or it's another shape or provider. */
  load(providerId: string): Promise<StoredProfileSnapshot | null>;
  /** An unchanged summary is skipped, so a quiet sync can't push a real snapshot out. */
  record(providerId: string, summary: UserProfileSummary, capturedAt?: string): Promise<void>;
  clear(providerId?: string): Promise<void>;
}

export function createProfileHistoryStore(storage: StorageAdapter): ProfileHistoryStore {
  // A sync completion and a rating can land together, and `record` is a read-modify-write, so writes are serialized like the feedback store's.
  let writeQueue: Promise<void> = Promise.resolve();

  return {
    async load(providerId) {
      const history = readEntry(await readHistory(storage), providerId);
      const newest = history.snapshots[0];
      if (newest === undefined) return null;
      if (newest.version !== PROFILE_HISTORY_VERSION || newest.providerId !== providerId)
        return null;
      return newest;
    },

    record(providerId, summary, capturedAt) {
      return enqueue(async () => {
        const all = await readHistory(storage);
        const history = readEntry(all, providerId);
        const snapshot = toStoredProfileSnapshot(
          summary,
          providerId,
          capturedAt ?? new Date().toISOString(),
        );
        const newest = history.snapshots[0];
        if (newest !== undefined && sameProfileMeasurement(newest, snapshot)) return;
        await storage.set(PROFILE_HISTORY_KEY, {
          ...all,
          [providerId]: {
            snapshots: [snapshot, ...history.snapshots].slice(0, PROFILE_HISTORY_CAPACITY),
          },
        });
      });
    },

    clear(providerId) {
      return enqueue(async () => {
        if (providerId === undefined) {
          await storage.remove(PROFILE_HISTORY_KEY);
          return;
        }
        const all = await readHistory(storage);
        if (!Object.prototype.hasOwnProperty.call(all, providerId)) return;
        const rest: Record<string, StoredProfileHistory> = { ...all };
        delete rest[providerId];
        if (Object.keys(rest).length === 0) await storage.remove(PROFILE_HISTORY_KEY);
        else await storage.set(PROFILE_HISTORY_KEY, rest);
      });
    },
  };

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const next = writeQueue.then(operation);
    writeQueue = next.catch(() => undefined);
    return next;
  }
}

function readEntry(
  all: Readonly<Record<string, StoredProfileHistory>>,
  providerId: string,
): StoredProfileHistory {
  const history = Object.prototype.hasOwnProperty.call(all, providerId)
    ? all[providerId]
    : undefined;
  return history ?? { snapshots: [] };
}

async function readHistory(
  storage: StorageAdapter,
): Promise<Readonly<Record<string, StoredProfileHistory>>> {
  const raw = await storage.get(PROFILE_HISTORY_KEY);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const entries: Record<string, StoredProfileHistory> = {};
  for (const [providerId, value] of Object.entries(raw)) {
    const snapshots = isStoredProfileHistory(value) ? value.snapshots : null;
    if (snapshots !== null) entries[providerId] = { snapshots };
  }
  return entries;
}

function isStoredProfileHistory(value: unknown): value is StoredProfileHistory {
  return (
    typeof value === 'object' &&
    value !== null &&
    'snapshots' in value &&
    Array.isArray((value as { snapshots: unknown }).snapshots) &&
    (value as { snapshots: unknown[] }).snapshots.every(isStoredProfileSnapshot)
  );
}

function isStoredProfileSnapshot(value: unknown): value is StoredProfileSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === 'number' &&
    Number.isInteger(candidate.version) &&
    typeof candidate.capturedAt === 'string' &&
    typeof candidate.providerId === 'string' &&
    isCount(candidate.analyzedAnimeCount) &&
    isCount(candidate.ratedAnimeCount) &&
    (candidate.averageScore === null ||
      (typeof candidate.averageScore === 'number' && Number.isFinite(candidate.averageScore))) &&
    isStoredPreferenceList(candidate.genres) &&
    isStoredPreferenceList(candidate.themes) &&
    isStoredPreferenceList(candidate.studios)
  );
}

function isStoredPreferenceList(value: unknown): value is readonly StoredPreferenceItem[] {
  return Array.isArray(value) && value.every(isStoredPreferenceItem);
}

function isStoredPreferenceItem(value: unknown): value is StoredPreferenceItem {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    typeof candidate.score === 'number' &&
    Number.isFinite(candidate.score) &&
    isCount(candidate.count)
  );
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
