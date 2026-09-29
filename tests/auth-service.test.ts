import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/api-errors';
import { MalAuthService } from '../src/auth/auth-service';
import type {
  AuthSession,
  AuthSessionStore,
  IdentityWebAuthFlow,
  MalOAuthClient,
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
  transaction: AuthSessionStore['getTransaction'] extends () => Promise<infer T> ? T : never = null;

  async getSession() {
    return this.session;
  }
  async setSession(session: AuthSession) {
    this.session = session;
  }
  async clearSession() {
    this.session = null;
  }
  async getTransaction() {
    return this.transaction;
  }
  async setTransaction(transaction: NonNullable<typeof this.transaction>) {
    this.transaction = transaction;
  }
  async clearTransaction() {
    this.transaction = null;
  }
}

class StubOAuthClient implements MalOAuthClient {
  exchanged?: Parameters<MalOAuthClient['exchangeCode']>[0];
  refreshCalls = 0;
  async exchangeCode(input: Parameters<MalOAuthClient['exchangeCode']>[0]) {
    this.exchanged = input;
    return { accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 };
  }
  async refreshToken() {
    this.refreshCalls += 1;
    return { accessToken: 'refreshed', refreshToken: 'new-refresh', expiresIn: 3600 };
  }
}

describe('MalAuthService', () => {
  it('completes the official authorization-code PKCE flow and stores only the session', async () => {
    const store = new MemoryAuthStore();
    const oauth = new StubOAuthClient();
    let authorizationUrl = '';
    const identity: IdentityWebAuthFlow = {
      getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
      launchWebAuthFlow: async ({ url }) => {
        authorizationUrl = url;
        const state = new URL(url).searchParams.get('state');
        return `https://extension.test.chromiumapp.org/?code=auth-code&state=${state}`;
      },
    };
    let now = 1_000_000;
    const service = new MalAuthService(
      { clientId: 'public-client-id', authorizationUrl: 'https://mal.test/authorize' },
      identity,
      oauth,
      store,
      async (accessToken) => {
        expect(accessToken).toBe('access');
        return profile;
      },
      () => now,
    );

    const result = await service.connect();
    const params = new URL(authorizationUrl).searchParams;

    expect(result).toMatchObject({ status: 'authenticated', profile });
    expect(params.get('response_type')).toBe('code');
    expect(params.get('code_challenge_method')).toBe('plain');
    expect(params.get('code_challenge')).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
    expect(params.get('code_challenge')).toBe(oauth.exchanged?.codeVerifier);
    expect(store.transaction).toBeNull();
    expect(store.session).toMatchObject({ accessToken: 'access', refreshToken: 'refresh' });

    now += 100;
    await expect(service.getSnapshot()).resolves.toMatchObject({ status: 'authenticated' });
  });

  it('rejects a callback with a mismatched state and cleans up the transaction', async () => {
    const store = new MemoryAuthStore();
    const identity: IdentityWebAuthFlow = {
      getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
      launchWebAuthFlow: async () =>
        'https://extension.test.chromiumapp.org/?code=code&state=attacker-state',
    };
    const service = new MalAuthService(
      { clientId: 'client', authorizationUrl: 'https://mal.test/authorize' },
      identity,
      new StubOAuthClient(),
      store,
      async () => profile,
    );

    await expect(service.connect()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'state_mismatch',
    });
    expect(store.transaction).toBeNull();
    expect(store.session).toBeNull();
  });

  it('maps an omitted callback URL to a cancelled authentication', async () => {
    const service = new MalAuthService(
      { clientId: 'client', authorizationUrl: 'https://mal.test/authorize' },
      {
        getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
        launchWebAuthFlow: async () => undefined,
      },
      new StubOAuthClient(),
      new MemoryAuthStore(),
      async () => profile,
    );

    await expect(service.connect()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'cancelled',
    });
  });

  it('refreshes an expired session and clears it when refresh fails', async () => {
    const store = new MemoryAuthStore();
    store.session = {
      accessToken: 'old',
      refreshToken: 'refresh',
      expiresAt: 100,
      profile,
    };
    const oauth = new StubOAuthClient();
    const service = new MalAuthService(
      { clientId: 'client', authorizationUrl: 'https://mal.test/authorize' },
      {} as IdentityWebAuthFlow,
      oauth,
      store,
      async () => profile,
      () => 200,
    );

    await expect(service.getSnapshot()).resolves.toMatchObject({ status: 'authenticated' });
    expect(oauth.refreshCalls).toBe(1);
    expect(store.session?.accessToken).toBe('refreshed');

    const failingOAuth: MalOAuthClient = {
      exchangeCode: async () => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 1 }),
      refreshToken: async () => {
        throw new Error('revoked');
      },
    };
    const expiredStore = new MemoryAuthStore();
    expiredStore.session = { ...store.session!, expiresAt: 100 };
    const expiredService = new MalAuthService(
      { clientId: 'client', authorizationUrl: 'https://mal.test/authorize' },
      {} as IdentityWebAuthFlow,
      failingOAuth,
      expiredStore,
      async () => profile,
      () => 200,
    );

    await expect(expiredService.getSnapshot()).resolves.toMatchObject({
      status: 'expired',
      errorCode: 'session_expired',
    });
    expect(expiredStore.session).toBeNull();
  });

  it('identifies a network failure during token exchange', async () => {
    const store = new MemoryAuthStore();
    const oauth: MalOAuthClient = {
      exchangeCode: async () => {
        throw new ApiError('request failed', { code: 'network_error' });
      },
      refreshToken: async () => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }),
    };
    const service = new MalAuthService(
      { clientId: 'client', authorizationUrl: 'https://mal.test/authorize' },
      {
        getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
        launchWebAuthFlow: async ({ url }) => {
          const state = new URL(url).searchParams.get('state');
          return `https://extension.test.chromiumapp.org/?code=code&state=${state}`;
        },
      },
      oauth,
      store,
      async () => profile,
    );

    await expect(service.connect()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'network_error',
      errorMessage: 'The network is unavailable. Please try again.',
    });
  });

  it('identifies a network failure while loading the MAL profile', async () => {
    const service = new MalAuthService(
      { clientId: 'client', authorizationUrl: 'https://mal.test/authorize' },
      {
        getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
        launchWebAuthFlow: async ({ url }) => {
          const state = new URL(url).searchParams.get('state');
          return `https://extension.test.chromiumapp.org/?code=code&state=${state}`;
        },
      },
      new StubOAuthClient(),
      new MemoryAuthStore(),
      async () => {
        throw new ApiError('request failed', { code: 'network_error' });
      },
    );

    await expect(service.connect()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'network_error',
      errorMessage: 'MAL profile API is unreachable from the extension.',
    });
  });

  it('rejects an OAuth token that MAL marks as already expired', async () => {
    const service = new MalAuthService(
      { clientId: 'client', authorizationUrl: 'https://mal.test/authorize' },
      {
        getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
        launchWebAuthFlow: async ({ url }) => {
          const state = new URL(url).searchParams.get('state');
          return `https://extension.test.chromiumapp.org/?code=code&state=${state}`;
        },
      },
      {
        exchangeCode: async () => ({
          accessToken: 'invalid-expired',
          refreshToken: 'refresh',
          expiresIn: 0,
        }),
        refreshToken: async () => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }),
      },
      new MemoryAuthStore(),
      async () => profile,
    );

    await expect(service.connect()).resolves.toMatchObject({
      status: 'error',
      errorCode: 'session_expired',
      errorMessage:
        'MAL returned an expired token immediately after authorization. Please sign in again.',
    });
  });

  it('uses the current configured client ID for each connection', async () => {
    const store = new MemoryAuthStore();
    const oauth = new StubOAuthClient();
    const service = new MalAuthService(
      { clientId: 'build-time-client', authorizationUrl: 'https://mal.test/authorize' },
      {
        getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
        launchWebAuthFlow: async ({ url }) => {
          const state = new URL(url).searchParams.get('state');
          return `https://extension.test.chromiumapp.org/?code=code&state=${state}`;
        },
      },
      oauth,
      store,
      async () => profile,
      undefined,
      undefined,
      async () => 'user-configured-client',
    );

    await expect(service.connect()).resolves.toMatchObject({ status: 'authenticated' });
    expect(oauth.exchanged?.clientId).toBe('user-configured-client');
  });

  it('disconnects and removes session material', async () => {
    const store = new MemoryAuthStore();
    store.session = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 999999,
      profile,
    };
    const service = new MalAuthService(
      { clientId: 'client', authorizationUrl: 'https://mal.test/authorize' },
      {} as IdentityWebAuthFlow,
      new StubOAuthClient(),
      store,
      async () => profile,
    );

    await expect(service.disconnect()).resolves.toMatchObject({ status: 'signed_out' });
    expect(store.session).toBeNull();
  });

  describe('implicit grant (AniList)', () => {
    it('uses response_type=token and never calls the token exchange endpoint', async () => {
      const store = new MemoryAuthStore();
      const oauth = new StubOAuthClient();
      const identity: IdentityWebAuthFlow = {
        getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
        launchWebAuthFlow: async () =>
          'https://extension.test.chromiumapp.org/#access_token=jwt-token&expires_in=31536000',
      };
      const service = new MalAuthService(
        {
          clientId: 'anilist-client',
          authorizationUrl: 'https://anilist.test/authorize',
          providerId: 'anilist',
          tokenStrategy: 'implicit',
        },
        identity,
        oauth,
        store,
        async () => profile,
      );

      const result = await service.connect();

      expect(result).toMatchObject({ status: 'authenticated', profile });
      expect(oauth.exchanged).toBeUndefined();
      expect(store.session).toMatchObject({
        accessToken: 'jwt-token',
        refreshToken: '',
      });
    });

    it('authorizes with only the implicit parameters and no PKCE scope', async () => {
      const store = new MemoryAuthStore();
      let capturedUrl = '';
      const identity: IdentityWebAuthFlow = {
        getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
        launchWebAuthFlow: async ({ url }) => {
          capturedUrl = url;
          return 'https://extension.test.chromiumapp.org/#access_token=t&expires_in=3600';
        },
      };
      const service = new MalAuthService(
        {
          clientId: 'anilist-client',
          authorizationUrl: 'https://anilist.test/authorize',
          providerId: 'anilist',
          tokenStrategy: 'implicit',
        },
        identity,
        new StubOAuthClient(),
        store,
        async () => profile,
      );

      await service.connect();
      const params = new URL(capturedUrl).searchParams;
      expect(params.get('response_type')).toBe('token');
      expect(params.get('client_id')).toBe('anilist-client');
      expect(params.get('redirect_uri')).toBe('https://extension.test.chromiumapp.org/');
      expect(params.has('code_challenge')).toBe(false);
      expect(params.has('state')).toBe(false);
    });

    it('rejects a callback from a foreign redirect origin', async () => {
      const store = new MemoryAuthStore();
      const identity: IdentityWebAuthFlow = {
        getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
        launchWebAuthFlow: async () =>
          'https://evil.example.com/#access_token=stolen&expires_in=3600',
      };
      const service = new MalAuthService(
        {
          clientId: 'anilist-client',
          authorizationUrl: 'https://anilist.test/authorize',
          providerId: 'anilist',
          tokenStrategy: 'implicit',
        },
        identity,
        new StubOAuthClient(),
        store,
        async () => profile,
      );

      await expect(service.connect()).resolves.toMatchObject({
        status: 'error',
        errorCode: 'invalid_callback',
      });
      expect(store.session).toBeNull();
    });

    it('rejects a fragment without an access token', async () => {
      const store = new MemoryAuthStore();
      const identity: IdentityWebAuthFlow = {
        getRedirectURL: () => 'https://extension.test.chromiumapp.org/',
        launchWebAuthFlow: async () =>
          'https://extension.test.chromiumapp.org/#error=user_cancelled',
      };
      const service = new MalAuthService(
        {
          clientId: 'anilist-client',
          authorizationUrl: 'https://anilist.test/authorize',
          providerId: 'anilist',
          tokenStrategy: 'implicit',
        },
        identity,
        new StubOAuthClient(),
        store,
        async () => profile,
      );

      await expect(service.connect()).resolves.toMatchObject({
        status: 'error',
        errorCode: 'invalid_callback',
      });
    });

    it('expires without attempting refresh when the token is stale', async () => {
      const store = new MemoryAuthStore();
      const oauth = new StubOAuthClient();
      store.session = {
        accessToken: 'stale',
        refreshToken: '',
        expiresAt: 100,
        profile,
      };
      const service = new MalAuthService(
        {
          clientId: 'anilist-client',
          authorizationUrl: 'https://anilist.test/authorize',
          providerId: 'anilist',
          tokenStrategy: 'implicit',
        },
        {} as IdentityWebAuthFlow,
        oauth,
        store,
        async () => profile,
        () => 200,
      );

      await expect(service.getSnapshot()).resolves.toMatchObject({
        status: 'expired',
        errorCode: 'session_expired',
      });
      expect(oauth.refreshCalls).toBe(0);
      expect(store.session).toBeNull();
    });
  });
});
