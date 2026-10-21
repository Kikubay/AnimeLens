import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANIME_CACHE_VERSION, type SyncMetadata } from '../src/domain/sync';

interface StorageArea {
  readonly store: Map<string, unknown>;
  get(key?: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  setAccessLevel(options: unknown): Promise<void>;
}

let storageDelayMs = 0;

function createStorageArea(): StorageArea {
  const store = new Map<string, unknown>();
  const wait = async (): Promise<void> => {
    if (storageDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, storageDelayMs));
  };
  return {
    store,
    async get(key?: string) {
      await wait();
      if (key === undefined) return Object.fromEntries(store);
      return store.has(key) ? { [key]: store.get(key) } : {};
    },
    async set(items) {
      await wait();
      for (const [key, value] of Object.entries(items)) store.set(key, value);
    },
    async remove(key: string) {
      await wait();
      store.delete(key);
    },
    async clear() {
      store.clear();
    },
    async setAccessLevel() {
      return undefined;
    },
  };
}

let local = createStorageArea();
let session = createStorageArea();
const messageListeners: ((
  message: unknown,
  sender: unknown,
  sendResponse: (value: unknown) => void,
) => boolean | undefined)[] = [];

const chromeStub = {
  storage: {
    get local() {
      return local;
    },
    get session() {
      return session;
    },
  },
  runtime: {
    onMessage: {
      addListener: (
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (value: unknown) => void,
        ) => boolean | undefined,
      ) => messageListeners.push(listener),
    },
    onStartup: { addListener: () => undefined },
    onInstalled: { addListener: () => undefined },
    sendMessage: async () => ({ ok: true }),
    getManifest: () => ({ version: '0.2.5' }),
    getURL: (path: string) => `chrome-extension://test/${path}`,
  },
  alarms: {
    onAlarm: { addListener: () => undefined },
    create: () => undefined,
    clear: async () => true,
    get: async () => undefined,
    clearAll: async () => true,
  },
  notifications: { create: async () => 'id' },
  tabs: {
    onUpdated: { addListener: () => undefined },
    query: async () => [],
    create: async () => ({ id: 1 }),
  },
  identity: {
    getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
    launchWebAuthFlow: async () => undefined,
  },
};

const CACHED_SYNC: SyncMetadata = {
  status: 'success',
  phase: 'complete',
  progress: null,
  lastSyncedAt: '2026-01-01T00:00:00.000Z',
  itemCount: 0,
  nextPageUrl: null,
  errorCode: null,
  errorMessage: null,
  fromCache: false,
};

const CACHE = {
  version: ANIME_CACHE_VERSION,
  cachedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2027-01-01T00:00:00.000Z',
  entries: [],
  sync: CACHED_SYNC,
};

async function startWorker(): Promise<void> {
  messageListeners.length = 0;
  vi.resetModules();
  vi.stubGlobal('chrome', chromeStub);
  await import('../src/background/service-worker');
}

async function readSyncSnapshot(): Promise<SyncMetadata> {
  const listener = messageListeners[0];
  if (listener === undefined) throw new Error('the worker registered no message listener');
  const response = (await new Promise<unknown>((resolve) => {
    const keepOpen = listener({ type: 'sync.get_snapshot' }, { id: 'test' }, resolve);
    if (keepOpen !== true) resolve(undefined);
  })) as { snapshot: { metadata: SyncMetadata } };
  return response.snapshot.metadata;
}

async function settleHydration(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 60));
}

beforeEach(() => {
  local = createStorageArea();
  session = createStorageArea();
  storageDelayMs = 5;
  local.store.set('animeData:mal', CACHE);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sync snapshot after a worker restart', () => {
  it('reports the cached list to a popup that asks before the cache has been read', async () => {
    await startWorker();

    const metadata = await readSyncSnapshot();

    expect(metadata.status).toBe('success');
    expect(metadata.lastSyncedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('never reports the list as unsynced while the cache is being read', async () => {
    await startWorker();

    const readings = await Promise.all([
      readSyncSnapshot(),
      readSyncSnapshot(),
      readSyncSnapshot(),
    ]);

    for (const metadata of readings) {
      expect(metadata.status).not.toBe('idle');
      expect(metadata.lastSyncedAt).not.toBeNull();
    }
  });

  it('keeps reporting the same list on every later poll', async () => {
    await startWorker();

    const first = await readSyncSnapshot();
    await new Promise((resolve) => setTimeout(resolve, 60));
    const second = await readSyncSnapshot();

    expect(first.status).toBe(second.status);
    expect(first.lastSyncedAt).toBe(second.lastSyncedAt);
  });

  it('still reports an unsynced list when there is no cache to read', async () => {
    local.store.clear();
    await startWorker();

    const metadata = await readSyncSnapshot();

    expect(metadata.status).toBe('idle');
    expect(metadata.lastSyncedAt).toBeNull();
  });

  it('leaves the state a popup polls for untouched when the worker restarts', async () => {
    await startWorker();
    await settleHydration();
    const before = await readSyncSnapshot();

    await startWorker();
    const after = await readSyncSnapshot();

    expect(before.status).toBe('success');
    expect(after.status).toBe(before.status);
    expect(after.lastSyncedAt).toBe(before.lastSyncedAt);
    expect(after.itemCount).toBe(before.itemCount);
    // The dashboard reloads on these two fields alone, so an unchanged pair means no reload.
    expect([after.status, after.lastSyncedAt]).toEqual([before.status, before.lastSyncedAt]);
  });
});
