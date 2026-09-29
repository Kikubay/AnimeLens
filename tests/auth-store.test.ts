import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChromeAuthSessionStore } from '../src/auth/auth-store';
import type { AuthSession, OAuthTransaction } from '../src/auth/auth-types';
import type { UserProfile } from '../src/domain/user-profile';

const profile: UserProfile = {
  id: 7,
  username: 'mori',
  avatarUrl: null,
  joinedAt: null,
  location: null,
  timeZone: null,
};

function createStorageArea() {
  const values = new Map<string, unknown>();
  return {
    values,
    async get(key: string) {
      return { [key]: values.get(key) };
    },
    async set(entries: Record<string, unknown>) {
      for (const [key, value] of Object.entries(entries)) values.set(key, value);
    },
    async remove(key: string) {
      values.delete(key);
    },
  };
}

describe('ChromeAuthSessionStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores the MAL session locally so it survives browser restarts', async () => {
    const local = createStorageArea();
    const session = createStorageArea();
    vi.stubGlobal('chrome', { storage: { local, session } });
    const store = new ChromeAuthSessionStore('mal');
    const authSession: AuthSession = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000,
      profile,
    };

    await store.setSession(authSession);

    expect(local.values.get('authSession:mal')).toEqual(authSession);
    expect(session.values.has('authSession:mal')).toBe(false);
    await expect(store.getSession()).resolves.toEqual(authSession);
  });

  it('migrates a legacy single-key session into the MAL namespace', async () => {
    const local = createStorageArea();
    const session = createStorageArea();
    vi.stubGlobal('chrome', { storage: { local, session } });
    const store = new ChromeAuthSessionStore('mal');
    const authSession: AuthSession = {
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: Date.now() + 3600000,
      profile,
    };
    await local.set({ authSession });

    await expect(store.getSession()).resolves.toEqual(authSession);
    expect(local.values.get('authSession:mal')).toEqual(authSession);
    expect(local.values.has('authSession')).toBe(false);
  });

  it('migrates an existing temporary session into persistent storage', async () => {
    const local = createStorageArea();
    const session = createStorageArea();
    vi.stubGlobal('chrome', { storage: { local, session } });
    const store = new ChromeAuthSessionStore('mal');
    const authSession: AuthSession = {
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: Date.now() + 3600000,
      profile,
    };
    await session.set({ authSession });

    await expect(store.getSession()).resolves.toEqual(authSession);
    expect(local.values.get('authSession:mal')).toEqual(authSession);
    expect(session.values.has('authSession')).toBe(false);
  });

  it('does not inherit a legacy MAL session for AniList', async () => {
    const local = createStorageArea();
    const session = createStorageArea();
    vi.stubGlobal('chrome', { storage: { local, session } });
    const store = new ChromeAuthSessionStore('anilist');
    const authSession: AuthSession = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000,
      profile,
    };
    await local.set({ authSession });

    await expect(store.getSession()).resolves.toBeNull();
    expect(local.values.has('authSession')).toBe(true);
  });

  it('keeps provider sessions isolated', async () => {
    const local = createStorageArea();
    const session = createStorageArea();
    vi.stubGlobal('chrome', { storage: { local, session } });
    const malStore = new ChromeAuthSessionStore('mal');
    const anilistStore = new ChromeAuthSessionStore('anilist');
    const malSession: AuthSession = {
      accessToken: 'mal-token',
      refreshToken: 'mal-refresh',
      expiresAt: Date.now() + 3600000,
      profile,
    };
    const anilistSession: AuthSession = {
      accessToken: 'anilist-token',
      refreshToken: '',
      expiresAt: Date.now() + 3600000,
      profile,
    };

    await malStore.setSession(malSession);
    await anilistStore.setSession(anilistSession);

    await expect(malStore.getSession()).resolves.toMatchObject({ accessToken: 'mal-token' });
    await expect(anilistStore.getSession()).resolves.toMatchObject({
      accessToken: 'anilist-token',
    });
  });

  it('keeps OAuth transactions temporary and clears both session locations', async () => {
    const local = createStorageArea();
    const session = createStorageArea();
    vi.stubGlobal('chrome', { storage: { local, session } });
    const store = new ChromeAuthSessionStore('mal');
    const transaction: OAuthTransaction = {
      state: 'state',
      codeVerifier: 'verifier',
      codeChallenge: 'challenge',
      redirectUri: 'https://extension.test.chromiumapp.org/',
      createdAt: Date.now(),
    };

    await store.setTransaction(transaction);
    expect(session.values.get('oauthTransaction:mal')).toEqual(transaction);
    expect(local.values.has('oauthTransaction:mal')).toBe(false);

    const authSession: AuthSession = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000,
      profile,
    };
    await store.setSession(authSession);
    await store.clearSession();
    expect(local.values.has('authSession:mal')).toBe(false);
    expect(session.values.has('authSession:mal')).toBe(false);
  });
});
