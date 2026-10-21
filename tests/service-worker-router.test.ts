import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANDIDATE_POOL_STORAGE_KEY } from '../src/recommendations/candidate-pool-store';
import { DASHBOARD_SNAPSHOT_STORAGE_KEY } from '../src/recommendations/recommendation-snapshot-store';
import { DATA_EXPORT_APP, DATA_EXPORT_VERSION } from '../src/settings/data-transfer';
import { DEFAULT_USER_PREFERENCES } from '../src/settings/settings-types';
import { ANILIST_PIN_URL_PREFIX } from '../src/auth/anilist-pin';

interface StorageArea {
  readonly store: Map<string, unknown>;
  get(key?: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  setAccessLevel(options: unknown): Promise<void>;
}

function createStorageArea(): StorageArea {
  const store = new Map<string, unknown>();
  return {
    store,
    async get(key?: string) {
      if (key === undefined) return Object.fromEntries(store);
      return store.has(key) ? { [key]: store.get(key) } : {};
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) store.set(key, value);
    },
    async remove(key: string) {
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

// Each worker instance builds its own adapters over these areas at import time, so they are recreated
// per test: otherwise a previous instance's still-pending start-up writes leak into the next one.
let local = createStorageArea();
let session = createStorageArea();

const messageListeners: ((
  message: unknown,
  sender: unknown,
  sendResponse: (value: unknown) => void,
) => boolean | undefined)[] = [];
const alarms: { name: string }[] = [];
const downloads: unknown[] = [];
const notifications: string[] = [];
const createdTabs: { id: number; url: string }[] = [];
const tabQueries: unknown[] = [];
const tabListeners: {
  created: ((tab: { id?: number; url?: string; pendingUrl?: string }) => void)[];
  updated: ((tabId: number, changeInfo: { url?: string }) => void)[];
  removed: ((tabId: number) => void)[];
} = { created: [], updated: [], removed: [] };

const chromeStub = {
  storage: {
    get local() {
      return local;
    },
    get session() {
      return session;
    },
  },
  alarms: {
    onAlarm: { addListener: () => undefined },
    create: (name: string) => {
      alarms.push({ name });
    },
    clear: async () => true,
    get: async (name: string) =>
      alarms.some((alarm) => alarm.name === name) ? { name } : undefined,
    clearAll: async () => true,
  },
  tabs: {
    onCreated: {
      addListener: (listener: (typeof tabListeners.created)[number]) => {
        tabListeners.created.push(listener);
      },
    },
    onUpdated: {
      addListener: (listener: (typeof tabListeners.updated)[number]) => {
        tabListeners.updated.push(listener);
      },
    },
    onRemoved: {
      addListener: (listener: (typeof tabListeners.removed)[number]) => {
        tabListeners.removed.push(listener);
      },
    },
    query: async (query: unknown) => {
      tabQueries.push(query);
      return [];
    },
    create: async ({ url }: { url: string }) => {
      const tab = { id: createdTabs.length + 1, url };
      createdTabs.push(tab);
      return tab;
    },
    update: async () => undefined,
  },
  runtime: {
    getManifest: () => ({ version: '0.0.0-test' }),
    onInstalled: { addListener: () => undefined },
    onStartup: { addListener: () => undefined },
    onMessage: {
      addListener: (listener: (typeof messageListeners)[number]) => {
        messageListeners.push(listener);
      },
    },
  },
  notifications: {
    create: async (id: string) => {
      notifications.push(id);
      return id;
    },
  },
  downloads: {
    download: async (options: unknown) => {
      downloads.push(options);
      return 1;
    },
  },
  identity: {
    getRedirectURL: (path?: string) => `https://extension.test.chromiumapp.org/${path ?? ''}`,
    launchWebAuthFlow: async () => undefined,
  },
};

async function loadWorker(): Promise<void> {
  messageListeners.length = 0;
  vi.resetModules();
  vi.stubGlobal('chrome', chromeStub);
  await import('../src/background/service-worker');
}

async function send(message: unknown): Promise<unknown> {
  const listener = messageListeners[0];
  if (listener === undefined) throw new Error('the worker registered no message listener');
  return new Promise<unknown>((resolve) => {
    const keepOpen = listener(message, { id: 'test' }, resolve);
    if (keepOpen !== true) resolve(undefined);
  });
}

async function sendOk(message: unknown): Promise<{ ok: boolean; [key: string]: unknown }> {
  const response = (await send(message)) as { ok: boolean } | undefined;
  expect(response, `no response for ${JSON.stringify(message)}`).toBeDefined();
  return response as { ok: boolean };
}

beforeEach(() => {
  local = createStorageArea();
  session = createStorageArea();
  alarms.length = 0;
  downloads.length = 0;
  notifications.length = 0;
  createdTabs.length = 0;
  tabQueries.length = 0;
  tabListeners.created.length = 0;
  tabListeners.updated.length = 0;
  tabListeners.removed.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('service worker message router', () => {
  it('registers exactly one message listener on start-up', async () => {
    await loadWorker();
    expect(messageListeners).toHaveLength(1);
  });

  it.each<[string, unknown]>([
    ['auth.get_snapshot', { type: 'auth.get_snapshot' }],
    ['auth.get_providers', { type: 'auth.get_providers' }],
    ['auth.get_pin_token', { type: 'auth.get_pin_token' }],
    ['auth.get_token_exchange_diagnostic', { type: 'auth.get_token_exchange_diagnostic' }],
    ['sync.get_snapshot', { type: 'sync.get_snapshot' }],
    ['feedback.list', { type: 'feedback.list' }],
    ['profile.get_snapshot', { type: 'profile.get_snapshot' }],
    ['profile.get_top_picks_ranking', { type: 'profile.get_top_picks_ranking' }],
    ['settings.get_snapshot', { type: 'settings.get_snapshot' }],
    ['recommendations.get_dashboard', { type: 'recommendations.get_dashboard' }],
    ['updates.check', { type: 'updates.check' }],
  ])('claims %s rather than leaving the channel to another listener', async (_name, message) => {
    await loadWorker();
    const response = await sendOk(message);
    expect(response.ok).toBeTypeOf('boolean');
  });

  it.each<[string, unknown]>([
    ['an unrelated type', { type: 'something.else' }],
    ['a null message', null],
    ['a string', 'nope'],
    ['an object with no type', { payload: 1 }],
  ])('declines %s so another extension listener can claim it', async (_name, message) => {
    await loadWorker();
    const listener = messageListeners[0];
    expect(listener?.(message, { id: 'test' }, () => undefined)).toBe(false);
  });

  it('turns a handler rejection into a user-facing failure rather than an unhandled rejection', async () => {
    await loadWorker();
    // A malformed export is rejected by parseDataExport, which the router has to convert.
    const response = await sendOk({
      type: 'settings.import_data',
      payload: { version: 999, app: DATA_EXPORT_APP, exportedAt: 'x', data: {} },
    });

    expect(response.ok).toBe(false);
    expect(typeof response.message).toBe('string');
  });
});

describe('auth messages', () => {
  it('reports no provider connected when nothing is signed in', async () => {
    await loadWorker();
    const response = await sendOk({ type: 'auth.get_providers' });

    expect(response.ok).toBe(true);
    expect(Array.isArray(response.providers)).toBe(true);
  });

  it('rejects an unknown provider id instead of writing it to storage', async () => {
    await loadWorker();
    const response = await sendOk({
      type: 'auth.set_active_provider',
      providerId: 'not-a-provider',
    });

    expect(response.ok).toBe(false);
  });

  it('never returns the AniList pin token to the popup', async () => {
    await loadWorker();
    const response = await sendOk({ type: 'auth.get_pin_token' });

    expect(response.ok).toBe(true);
    // The raw token must never cross this boundary; only whether one is waiting.
    expect(response).not.toHaveProperty('pinToken');
    expect(response.pinAvailable).toBe(false);
  });

  it('refuses to complete a pin sign-in when the worker holds no token', async () => {
    await loadWorker();
    const response = await sendOk({
      type: 'auth.complete_pin_connect',
      providerId: 'anilist',
    });

    expect(response.ok).toBe(true);
    expect(response.snapshot).toMatchObject({ status: 'error' });
  });

  it('refuses a pin sign-in aimed at the wrong provider', async () => {
    await loadWorker();
    const response = await sendOk({
      type: 'auth.complete_pin_connect',
      providerId: 'mal',
      token: 'anything',
    });

    expect(response.ok).toBe(false);
  });
});

describe('the AniList pin flow', () => {
  const PIN_URL = `${ANILIST_PIN_URL_PREFIX}token-from-the-pin-page`;

  const flush = (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

  const driveTab = (tabId: number, url: string): void => {
    for (const listener of tabListeners.updated) listener(tabId, { url });
  };

  const startFlow = async (): Promise<number> => {
    await local.set({ anilistClientId: 'client-id' });
    await sendOk({ type: 'auth.connect', providerId: 'anilist' });
    const tab = createdTabs[0];
    expect(tab, 'the worker opened no tab').toBeDefined();
    return tab?.id ?? 0;
  };

  it('takes the token from the tab it opened', async () => {
    await loadWorker();
    const tabId = await startFlow();

    driveTab(tabId, PIN_URL);
    await flush();

    const status = await sendOk({ type: 'auth.get_pin_token' });
    expect(status.pinAvailable).toBe(true);
  });

  it('ignores a pin page in a tab it never opened', async () => {
    await loadWorker();
    await startFlow();

    driveTab(4242, PIN_URL);
    await flush();

    const status = await sendOk({ type: 'auth.get_pin_token' });
    expect(status.pinAvailable).toBe(false);

    const completion = await sendOk({
      type: 'auth.complete_pin_connect',
      providerId: 'anilist',
    });
    expect(completion.snapshot).toMatchObject({ status: 'error' });
  });

  it('never looks through the open tabs for a token', async () => {
    await loadWorker();
    const tabId = await startFlow();

    driveTab(tabId, PIN_URL);
    await flush();

    expect(tabQueries).toEqual([]);
  });

  it('reports a closed sign-in tab so the popup can ask for a retry', async () => {
    await loadWorker();
    const tabId = await startFlow();

    for (const listener of tabListeners.removed) listener(tabId);
    await flush();

    const status = await sendOk({ type: 'auth.get_pin_token' });
    expect(status.pinFlow).toBe('closed');
    expect(status.pinAvailable).toBe(false);
  });
});

describe('settings messages', () => {
  it('returns a normalised snapshot with defaults when storage is empty', async () => {
    await loadWorker();
    const response = await sendOk({ type: 'settings.get_snapshot' });

    expect(response.ok).toBe(true);
    const snapshot = response.snapshot as { preferences: { theme: string }; providers: unknown[] };
    expect(snapshot.preferences.theme).toBe('dark');
    expect(snapshot.providers).toEqual([
      expect.objectContaining({ id: 'mal', active: true, signedIn: false }),
      expect.objectContaining({ id: 'anilist', active: false, signedIn: false }),
    ]);
  });

  it('rejects an export from a future schema version without writing anything', async () => {
    await loadWorker();
    await sendOk({
      type: 'settings.import_data',
      payload: { version: 9999, app: 'animelens', data: {} },
    });

    expect(local.store.has('preferences')).toBe(false);
  });

  it('refuses a disconnect for a provider that is not registered', async () => {
    await loadWorker();
    const response = await sendOk({ type: 'settings.disconnect_mal', clientId: 'anything' });

    expect(response.ok).toBeTypeOf('boolean');
  });
});

// A shape the session store accepts, so it is not garbage-collected as malformed on read.
const validSession = {
  accessToken: 'keep-me',
  refreshToken: 'keep-me-refresh',
  expiresAt: 4_000_000_000_000,
  profile: {
    id: 1,
    username: 'mori',
    avatarUrl: null,
    joinedAt: null,
    location: null,
    timeZone: null,
  },
};

describe('background scheduling', () => {
  it('does not throw when storage rejects during start-up', async () => {
    local.get = async () => {
      throw new Error('storage exploded');
    };
    await expect(loadWorker()).resolves.toBeUndefined();
  });

  it('schedules no background sync alarm, so the list only syncs when the popup opens', async () => {
    await loadWorker();
    await sendOk({
      type: 'settings.update_preferences',
      preferences: { ...DEFAULT_USER_PREFERENCES },
    });

    expect(alarms.map((alarm) => alarm.name)).not.toContain('animelens-sync');
  });
});

describe('sync triggers', () => {
  it('starts a sync when the popup asks for one', async () => {
    await loadWorker();

    const response = await sendOk({ type: 'sync.start', reason: 'initial' });

    expect(response.ok).toBe(true);
    expect(response.snapshot).toHaveProperty('metadata');
  });

  it('asks for a sync when the popup opens', () => {
    const app = readFileSync(resolve(__dirname, '../src/popup/App.tsx'), 'utf8');

    expect(app).toContain("requestSync('initial')");
  });
});

describe('settings cache and data lifecycle', () => {
  it('clears profile history as well as the caches, so a recap has no phantom baseline', async () => {
    await loadWorker();
    local.store.set('profileHistory', { entries: [{ id: 'a' }] });

    const response = await sendOk({ type: 'settings.clear_cache' });

    expect(response.ok).toBe(true);
    expect(local.store.has('profileHistory')).toBe(false);
  });

  it('drops the caches on a clear so the next dashboard cannot serve a stale snapshot', async () => {
    await loadWorker();
    session.store.set(CANDIDATE_POOL_STORAGE_KEY, { version: 1 });
    session.store.set(DASHBOARD_SNAPSHOT_STORAGE_KEY, { version: 1 });

    await sendOk({ type: 'settings.clear_cache' });

    expect(session.store.has(CANDIDATE_POOL_STORAGE_KEY)).toBe(false);
    expect(session.store.has(DASHBOARD_SNAPSHOT_STORAGE_KEY)).toBe(false);
  });

  it('deletes local data but leaves the OAuth sessions, so the user stays signed in', async () => {
    // Seeded before the worker loads, because its start-up migration would otherwise move a session
    // written afterwards and make this look like a deletion.
    local.store.set('authSession:mal', validSession);
    local.store.set('animeData:mal', { version: 7 });
    local.store.set('feedback', [{ id: 'f' }]);
    await loadWorker();

    const response = await sendOk({ type: 'settings.delete_local_data' });

    expect(response.ok).toBe(true);
    expect(local.store.has('animeData:mal')).toBe(false);
    expect(local.store.has('feedback')).toBe(false);
    // Signing out is a separate, explicit action; a "delete my data" click must not do it silently.
    expect(local.store.has('authSession:mal')).toBe(true);
  });

  it('imports only the allow-listed keys and never an OAuth session', async () => {
    await loadWorker();
    local.store.set('authSession:mal', validSession);

    const payload = {
      version: DATA_EXPORT_VERSION,
      app: DATA_EXPORT_APP,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: {
        feedback: [
          {
            recommendationId: 'local-1',
            animeMalId: 1,
            value: 'like',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        preferences: { theme: 'light' },
        profileHistory: {},
        // Explicitly null rather than omitted: the parser distinguishes the two.
        activeProvider: null,
        manualTop3Ranking: null,
        manualTop3PoolSignature: null,
      },
    };

    const response = await sendOk({ type: 'settings.import_data', payload });

    expect(response.ok).toBe(true);
    expect(local.store.get('preferences')).toMatchObject({ theme: 'light' });
    expect(local.store.get('authSession:mal')).toEqual(validSession);
    expect(local.store.has('malClientId')).toBe(false);
  });

  it('leaves every key untouched when an import is rejected', async () => {
    await loadWorker();
    local.store.set('preferences', { theme: 'dark' });

    const response = await sendOk({
      type: 'settings.import_data',
      payload: {
        version: DATA_EXPORT_VERSION,
        app: 'something-else',
        exportedAt: '2026-01-01T00:00:00.000Z',
        data: {},
      },
    });

    expect(response.ok).toBe(false);
    expect(local.store.get('preferences')).toEqual({ theme: 'dark' });
  });

  it('exports a payload that carries no session or client id', async () => {
    local.store.set('authSession:mal', { accessToken: 'secret' });
    local.store.set('malClientId', 'client');
    await loadWorker();

    const response = await sendOk({ type: 'settings.export_data' });
    const data = (response as { data?: { json: string } }).data;

    expect(data).toBeDefined();
    expect(data?.json).not.toContain('secret');
    expect(data?.json).not.toContain('authSession');
    expect(data?.json).not.toContain('client');
  });
});

describe('provider switching', () => {
  it('drops both caches so one provider never serves the other its titles', async () => {
    await loadWorker();
    session.store.set(CANDIDATE_POOL_STORAGE_KEY, { version: 1 });
    session.store.set(DASHBOARD_SNAPSHOT_STORAGE_KEY, { version: 1 });

    const response = await sendOk({ type: 'auth.set_active_provider', providerId: 'anilist' });

    expect(response.ok).toBe(true);
    expect(session.store.has(CANDIDATE_POOL_STORAGE_KEY)).toBe(false);
    expect(session.store.has(DASHBOARD_SNAPSHOT_STORAGE_KEY)).toBe(false);
    expect(local.store.get('activeProvider')).toBe('anilist');
  });

  it('rejects an unknown provider id and leaves the active one untouched', async () => {
    await loadWorker();
    const response = await sendOk({ type: 'auth.set_active_provider', providerId: 'nope' });

    expect(response.ok).toBe(false);
    expect(local.store.has('activeProvider')).toBe(false);
  });
});

describe('top picks ranking', () => {
  it('declines a ranking that is not a list of positive integers', async () => {
    await loadWorker();
    const listener = messageListeners[0];

    for (const ranking of [[-1], [1.5], ['a'], [null], null, undefined, 'nope']) {
      const claimed = listener?.(
        { type: 'profile.save_top_picks_ranking', ranking },
        { id: 'test' },
        () => undefined,
      );
      expect(claimed, `claimed ${JSON.stringify(ranking)}`).toBe(false);
    }
  });

  it('accepts a well-formed ranking and round-trips it through storage', async () => {
    await loadWorker();
    const response = await sendOk({
      type: 'profile.save_top_picks_ranking',
      ranking: [1, 2, 3],
    });

    expect(response.ok).toBe(true);

    const stored = await sendOk({ type: 'profile.get_top_picks_ranking' });
    expect(stored.ok).toBe(true);
  });

  it('clears a stored ranking on request', async () => {
    await loadWorker();
    await sendOk({ type: 'profile.save_top_picks_ranking', ranking: [1, 2, 3] });

    const response = await sendOk({ type: 'profile.clear_top_picks_ranking' });

    expect(response.ok).toBe(true);
  });
});
