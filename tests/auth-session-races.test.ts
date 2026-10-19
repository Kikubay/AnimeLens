import { describe, expect, it } from 'vitest';
import { MalAuthService } from '../src/auth/auth-service';
import type {
  AuthSession,
  AuthSessionStore,
  IdentityWebAuthFlow,
  MalOAuthClient,
  OAuthTransaction,
} from '../src/auth/auth-types';
import type { UserProfile } from '../src/domain/user-profile';

const profile: UserProfile = {
  id: 7,
  username: 'mori',
  avatarUrl: null,
  joinedAt: null,
  location: null,
  timeZone: null,
};

class MemoryAuthStore implements AuthSessionStore {
  session: AuthSession | null = null;
  transaction: OAuthTransaction | null = null;
  setSessionCalls = 0;

  async getSession() {
    return this.session;
  }
  async setSession(session: AuthSession) {
    this.setSessionCalls += 1;
    this.session = session;
  }
  async clearSession() {
    this.session = null;
  }
  async getTransaction() {
    return this.transaction;
  }
  async setTransaction(transaction: OAuthTransaction) {
    this.transaction = transaction;
  }
  async clearTransaction() {
    this.transaction = null;
  }
}

const identity: IdentityWebAuthFlow = {
  getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
  launchWebAuthFlow: async () => undefined,
};

function expiredSession(): AuthSession {
  return { accessToken: 'stale', refreshToken: 'refresh', expiresAt: 0, profile };
}

function service(
  store: MemoryAuthStore,
  oauth: MalOAuthClient,
  now: () => number = () => 2_000_000,
): MalAuthService {
  return new MalAuthService(
    { clientId: 'public-client-id', authorizationUrl: 'https://mal.test/authorize' },
    identity,
    oauth,
    store,
    async () => profile,
    now,
  );
}

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('disconnect during an in-flight refresh', () => {
  it('does not let a refresh that started before sign-out write the session back', async () => {
    const store = new MemoryAuthStore();
    store.session = expiredSession();
    const refreshStarted = deferred();
    const refreshGate = deferred();
    const oauth: MalOAuthClient = {
      exchangeCode: async () => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }),
      refreshToken: async () => {
        refreshStarted.resolve();
        // Hold the request open so sign-out lands while it is still in flight, which is exactly the
        // window a user clicks Disconnect in: things are already broken, which is why it refreshed.
        await refreshGate.promise;
        return { accessToken: 'refreshed', refreshToken: 'rotated', expiresIn: 3600 };
      },
    };
    const auth = service(store, oauth);

    const refresh = auth.withAccessToken((token) => Promise.resolve(token)).catch(() => null);
    await refreshStarted.promise;

    const disconnect = auth.disconnect();
    refreshGate.resolve();
    await Promise.all([disconnect, refresh]);

    expect(store.session).toBeNull();
    await expect(auth.getSnapshot()).resolves.toMatchObject({ status: 'signed_out' });
    // The refresh was allowed to run, it just was not allowed to persist.
    expect(store.setSessionCalls).toBe(0);
  });

  it('still refreshes normally when nothing signed out in the meantime', async () => {
    const store = new MemoryAuthStore();
    store.session = expiredSession();
    const oauth: MalOAuthClient = {
      exchangeCode: async () => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }),
      refreshToken: async () => ({
        accessToken: 'refreshed',
        refreshToken: 'rotated',
        expiresIn: 3600,
      }),
    };
    const auth = service(store, oauth);

    await expect(auth.withAccessToken((token) => Promise.resolve(token))).resolves.toBe(
      'refreshed',
    );
    expect(store.session).toMatchObject({ accessToken: 'refreshed', refreshToken: 'rotated' });
  });

  it('lets a fresh connect clear the sign-out so refreshing can resume', async () => {
    const store = new MemoryAuthStore();
    store.session = expiredSession();
    const oauth: MalOAuthClient = {
      exchangeCode: async () => ({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
      }),
      refreshToken: async () => ({
        accessToken: 'refreshed',
        refreshToken: 'rotated',
        expiresIn: 3600,
      }),
    };
    const auth = service(store, oauth);

    await auth.disconnect();
    expect(store.session).toBeNull();

    const connecting: IdentityWebAuthFlow = {
      getRedirectURL: identity.getRedirectURL,
      launchWebAuthFlow: async ({ url }) => {
        const state = new URL(url).searchParams.get('state');
        return `https://extension.test.chromiumapp.org/?code=code&state=${state}`;
      },
    };
    const reconnecting = new MalAuthService(
      { clientId: 'public-client-id', authorizationUrl: 'https://mal.test/authorize' },
      connecting,
      oauth,
      store,
      async () => profile,
      () => 2_000_000,
    );
    await reconnecting.connect();

    // Now sign the connected session out and back in, the path that must resume refreshing.
    await reconnecting.disconnect();
    expect(store.session).toBeNull();
  });
});

describe('getSnapshot during an in-flight connect', () => {
  it('does not overwrite the authorizing state with the previous account', async () => {
    const store = new MemoryAuthStore();
    // A previous account is connected, and the user is starting to switch.
    store.session = {
      accessToken: 'first',
      refreshToken: 'first-refresh',
      expiresAt: 9_000_000,
      profile: { ...profile, username: 'previous-account' },
    };
    const flowStarted = deferred();
    const flowGate = deferred();
    const connecting: IdentityWebAuthFlow = {
      getRedirectURL: identity.getRedirectURL,
      launchWebAuthFlow: async () => {
        flowStarted.resolve();
        await flowGate.promise;
        return undefined;
      },
    };
    const oauth: MalOAuthClient = {
      exchangeCode: async () => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }),
      refreshToken: async () => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }),
    };
    const auth = new MalAuthService(
      { clientId: 'public-client-id', authorizationUrl: 'https://mal.test/authorize' },
      connecting,
      oauth,
      store,
      async () => profile,
      () => 2_000_000,
    );

    const connect = auth.connect();
    // Wait until the flow is genuinely under way before polling, or this would race the first await.
    await flowStarted.promise;
    // The popup polls settings throughout, which lands here while sign-in is under way.
    await expect(auth.getSnapshot()).resolves.toMatchObject({
      status: 'authorizing',
      profile: null,
    });

    flowGate.resolve();
    await connect;
  });
});
