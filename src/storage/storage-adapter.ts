import type { AnimeLensStorage, StorageKey } from './storage-types';

export interface StorageAdapter {
  get<K extends StorageKey>(key: K): Promise<AnimeLensStorage[K] | undefined>;
  set<K extends StorageKey>(key: K, value: AnimeLensStorage[K]): Promise<void>;
  remove(key: StorageKey): Promise<void>;
}

export class ChromeStorageAdapter implements StorageAdapter {
  async get<K extends StorageKey>(key: K): Promise<AnimeLensStorage[K] | undefined> {
    const values = await chrome.storage.local.get(key);
    return values[key] as AnimeLensStorage[K] | undefined;
  }

  async set<K extends StorageKey>(key: K, value: AnimeLensStorage[K]): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: StorageKey): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}
