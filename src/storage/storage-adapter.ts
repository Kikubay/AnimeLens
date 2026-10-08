import type { AnimeLensStorage, StorageKey } from './storage-types';

export interface StorageAdapter {
  get<K extends StorageKey>(key: K): Promise<AnimeLensStorage[K] | undefined>;
  set<K extends StorageKey>(key: K, value: AnimeLensStorage[K]): Promise<void>;
  remove(key: StorageKey): Promise<void>;
}

export class StorageQuotaError extends Error {
  constructor(cause: unknown) {
    super('The browser storage quota is exhausted.', { cause });
    this.name = 'StorageQuotaError';
  }
}

/** Chrome only ever reports exhaustion as a rejected promise carrying one of these markers in the message. */
export function isStorageQuotaFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /quota/i.test(error.message);
}

export class ChromeStorageAdapter implements StorageAdapter {
  async get<K extends StorageKey>(key: K): Promise<AnimeLensStorage[K] | undefined> {
    const values = await chrome.storage.local.get(key);
    return values[key] as AnimeLensStorage[K] | undefined;
  }

  async set<K extends StorageKey>(key: K, value: AnimeLensStorage[K]): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      // A silently dropped write is the worst outcome here: the sync reports success and the list is gone on the next read.
      if (isStorageQuotaFailure(error)) throw new StorageQuotaError(error);
      throw error;
    }
  }

  async remove(key: StorageKey): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}
