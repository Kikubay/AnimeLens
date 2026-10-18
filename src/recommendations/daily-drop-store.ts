import type { StorageAdapter } from '../storage/storage-adapter';
import type { StoredDailyDrop } from '../storage/storage-types';
import { DAILY_DROP_HISTORY, isStoredDailyDrop } from './daily-drop';

export const DAILY_DROP_KEY = 'dailyDrops';

export interface DailyDropStore {
  list(providerId: string): Promise<readonly StoredDailyDrop[]>;
  record(drop: StoredDailyDrop): Promise<void>;
  claim(providerId: string, animeId: number): Promise<StoredDailyDrop | null>;
  clear(providerId?: string): Promise<void>;
}

export function createDailyDropStore(storage: StorageAdapter): DailyDropStore {
  let writeQueue: Promise<void> = Promise.resolve();

  return {
    async list(providerId) {
      return readProvider(await readAll(storage), providerId);
    },

    record(drop) {
      return enqueue(async () => {
        const all = await readAll(storage);
        const history = readProvider(all, drop.providerId);
        const next = [drop, ...history.filter((entry) => entry.day !== drop.day)]
          .sort((left, right) => right.day.localeCompare(left.day))
          .slice(0, DAILY_DROP_HISTORY);
        await storage.set(DAILY_DROP_KEY, { ...all, [drop.providerId]: next });
      });
    },

    claim(providerId, animeId) {
      return enqueue(async () => {
        const all = await readAll(storage);
        const history = readProvider(all, providerId);
        const next = history.map((drop) =>
          drop.animeIds.includes(animeId) && !drop.claimedIds.includes(animeId)
            ? { ...drop, claimedIds: [...drop.claimedIds, animeId] }
            : drop,
        );
        if (next.every((drop, index) => drop === history[index])) return null;
        await storage.set(DAILY_DROP_KEY, { ...all, [providerId]: next });
        return (
          next.find(
            (drop) => drop.animeIds.includes(animeId) && drop.claimedIds.includes(animeId),
          ) ?? null
        );
      });
    },

    clear(providerId) {
      return enqueue(async () => {
        const all = await readAll(storage);
        if (providerId === undefined) {
          await storage.remove(DAILY_DROP_KEY);
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(all, providerId)) return;
        const rest = { ...all };
        delete rest[providerId];
        if (Object.keys(rest).length === 0) await storage.remove(DAILY_DROP_KEY);
        else await storage.set(DAILY_DROP_KEY, rest);
      });
    },
  };

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = writeQueue.then(operation);
    writeQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

async function readAll(
  storage: StorageAdapter,
): Promise<Readonly<Record<string, readonly StoredDailyDrop[]>>> {
  const raw = await storage.get(DAILY_DROP_KEY);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const entries: Record<string, readonly StoredDailyDrop[]> = {};
  for (const [providerId, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    const drops = value.filter(isStoredDailyDrop);
    if (drops.length > 0) entries[providerId] = drops;
  }
  return entries;
}

function readProvider(
  all: Readonly<Record<string, readonly StoredDailyDrop[]>>,
  providerId: string,
): readonly StoredDailyDrop[] {
  return all[providerId] ?? [];
}
