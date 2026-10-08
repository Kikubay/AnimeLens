export interface SessionStorageArea {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createSessionStorageArea(): SessionStorageArea {
  return {
    async get(key) {
      const values = await chrome.storage.session.get(key);
      return values[key];
    },
    async set(key, value) {
      await chrome.storage.session.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.session.remove(key);
    },
  };
}
