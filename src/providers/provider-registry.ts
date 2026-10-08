import type { HttpClient } from '../api/http-client';
import type { AnimeProvider } from '../api/anime-provider';
import { ApiError } from '../api/api-errors';
import type { AuthSnapshot } from '../auth/auth-types';
import { AniListProvider } from '../api/providers/anilist/anilist-provider';
import { MalAnimeProvider } from '../api/providers/mal/mal-provider';
import { ChromeAuthSessionStore } from '../auth/auth-store';
import { MalAuthService } from '../auth/auth-service';
import type { IdentityWebAuthFlow, OAuthClient, ProviderId } from '../auth/auth-types';
import {
  ANILIST_AUTHORIZATION_URL,
  buildAnilistPinAuthorizeUrl,
  extractAccessToken,
} from '../api/providers/anilist/anilist-queries';
import { MAL_AUTHORIZATION_URL } from '../auth/runtime-auth';

const PIN_TOKEN_FALLBACK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// An undecodable payload falls back to a long window: AniList tokens live about a year, and an early expiry only forces a needless re-sign-in.
export function decodeAniListTokenExpiry(accessToken: string, now: number = Date.now()): number {
  try {
    const payloadPart = accessToken.split('.')[1];
    if (payloadPart !== undefined && payloadPart.length > 0) {
      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const payload = JSON.parse(atob(padded)) as { exp?: unknown };
      if (typeof payload.exp === 'number' && Number.isFinite(payload.exp) && payload.exp > 0) {
        return payload.exp * 1000;
      }
    }
  } catch {
    // Unreadable JWT, so the conservative default applies.
  }
  return now + PIN_TOKEN_FALLBACK_TTL_MS;
}

export type { ProviderId };

export const ALL_PROVIDER_IDS: readonly ProviderId[] = ['mal', 'anilist'];

export function isProviderId(value: unknown): value is ProviderId {
  return value === 'mal' || value === 'anilist';
}

export const ACTIVE_PROVIDER_STORAGE_KEY = 'activeProvider';
const LEGACY_AUTH_SESSION_KEY = 'authSession';

export interface ProviderStatus {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly signedIn: boolean;
  readonly active: boolean;
}

export class ProviderRegistry {
  private cachedActive: ProviderId | null = null;

  constructor(private readonly storage: StorageAdapterShape) {}

  async getActiveProvider(): Promise<ProviderId> {
    if (this.cachedActive !== null) return this.cachedActive;
    const stored = await this.storage.get(ACTIVE_PROVIDER_STORAGE_KEY);
    const value = stored[ACTIVE_PROVIDER_STORAGE_KEY];
    const active = isProviderId(value) ? value : 'mal';
    this.cachedActive = active;
    return active;
  }

  async setActiveProvider(providerId: ProviderId): Promise<void> {
    await this.storage.set({ [ACTIVE_PROVIDER_STORAGE_KEY]: providerId });
    this.cachedActive = providerId;
  }

  invalidateCache(): void {
    this.cachedActive = null;
  }
}

export interface StorageAdapterShape {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export class ProviderRegistryService {
  private readonly authServices: Readonly<Record<ProviderId, MalAuthService>>;
  private readonly sessionStores: Readonly<Record<ProviderId, ChromeAuthSessionStore>>;
  private readonly clientIds: Readonly<Record<ProviderId, () => Promise<string>>>;

  constructor(
    readonly registry: ProviderRegistry,
    private readonly identity: IdentityWebAuthFlow,
    oauthClient: OAuthClient,
    private readonly httpClient: HttpClient,
    dependencies: {
      malClientId: string;
      anilistClientId: string;
      getClientId(providerId: ProviderId): Promise<string>;
    },
  ) {
    const sessionStores: Record<ProviderId, ChromeAuthSessionStore> = {
      mal: new ChromeAuthSessionStore('mal'),
      anilist: new ChromeAuthSessionStore('anilist'),
    };
    this.sessionStores = sessionStores;
    this.clientIds = {
      mal: () => dependencies.getClientId('mal'),
      anilist: () => dependencies.getClientId('anilist'),
    };

    const createAuthService = (
      providerId: ProviderId,
      authorizationUrl: string,
      fallbackClientId: string,
    ): MalAuthService =>
      new MalAuthService(
        {
          clientId: fallbackClientId,
          authorizationUrl,
          providerId,
          tokenStrategy: providerId === 'anilist' ? 'implicit' : 'code_exchange',
        },
        identity,
        oauthClient,
        sessionStores[providerId],
        async (accessToken) => this.createProvider(providerId, accessToken).getCurrentUser(),
        undefined,
        undefined,
        () => dependencies.getClientId(providerId),
      );

    this.authServices = {
      mal: createAuthService('mal', MAL_AUTHORIZATION_URL, dependencies.malClientId),
      anilist: createAuthService(
        'anilist',
        ANILIST_AUTHORIZATION_URL,
        dependencies.anilistClientId,
      ),
    };
  }

  // Bypasses launchWebAuthFlow, which can't complete AniList's implicit flow, but reuses the standard session store and profile fetch.
  async completeAnilistPinSignIn(rawInput: string): Promise<AuthSnapshot> {
    // Either the bare token or the whole pin URL copied from the address bar.
    const accessToken = extractAccessToken(rawInput.trim());
    if (accessToken.length === 0) {
      return {
        status: 'error',
        profile: null,
        errorCode: 'invalid_callback',
        errorMessage: 'Paste the access token shown by AniList to continue.',
      };
    }

    const authService = this.authServices.anilist;
    try {
      // Resolve the user before persisting anything.
      const profile = await this.createProvider('anilist', accessToken).getCurrentUser();

      const expiresAt = decodeAniListTokenExpiry(accessToken);
      await this.sessionStores.anilist.setSession({
        accessToken,
        refreshToken: '',
        expiresAt,
        profile,
      });
      return await authService.getSnapshot();
    } catch (error) {
      const message =
        error instanceof ApiError && error.code === 'unauthorized'
          ? 'AniList rejected this token. Copy a fresh one from the pin page and try again.'
          : error instanceof Error
            ? error.message
            : 'The AniList token could not be verified. Please try again.';
      return {
        status: 'error',
        profile: null,
        errorCode: 'token_exchange',
        errorMessage: message,
      };
    }
  }

  async getAniListPinAuthorizeUrl(): Promise<string> {
    const clientId = await this.clientIds.anilist();
    if (clientId.length === 0) {
      throw new Error('AniList client ID is not configured. Save it in Settings first.');
    }
    return buildAnilistPinAuthorizeUrl(clientId);
  }

  async migrateLegacySessions(): Promise<void> {
    if (typeof chrome === 'undefined' || chrome.storage === undefined) return;
    try {
      const local = chrome.storage.local;
      const legacy = (await local.get(LEGACY_AUTH_SESSION_KEY)) as Record<string, unknown>;
      const legacySession = legacy[LEGACY_AUTH_SESSION_KEY];
      if (legacySession === undefined || legacySession === null) return;
      const scoped = (await local.get('authSession:mal')) as Record<string, unknown>;
      if (scoped['authSession:mal'] === undefined) {
        await local.set({ 'authSession:mal': legacySession });
      }
      await local.remove(LEGACY_AUTH_SESSION_KEY);
    } catch {
      // Unavailable storage must not block startup.
    }
  }

  getAuthService(providerId: ProviderId): MalAuthService {
    return this.authServices[providerId];
  }

  async getActiveAuthService(): Promise<MalAuthService> {
    return this.getAuthService(await this.registry.getActiveProvider());
  }

  createProvider(providerId: ProviderId, accessToken: string): AnimeProvider {
    if (providerId === 'anilist') return new AniListProvider(this.httpClient, accessToken);
    return new MalAnimeProvider(this.httpClient, accessToken);
  }

  async createActiveProvider(accessToken: string): Promise<AnimeProvider> {
    return this.createProvider(await this.registry.getActiveProvider(), accessToken);
  }

  isProviderSignedIn(providerId: ProviderId): Promise<boolean> {
    return this.authServices[providerId]
      .getSnapshot()
      .then((snapshot) => snapshot.status === 'authenticated')
      .catch(() => false);
  }

  async listProviderStatuses(): Promise<ProviderStatus[]> {
    const active = await this.registry.getActiveProvider();
    return Promise.all(
      ALL_PROVIDER_IDS.map(async (providerId) => ({
        id: providerId,
        displayName: providerId === 'mal' ? 'MyAnimeList' : 'AniList',
        active: providerId === active,
        signedIn: await this.isProviderSignedIn(providerId),
      })),
    );
  }

  getClientIdFor(providerId: ProviderId): Promise<string> {
    return this.clientIds[providerId]();
  }

  getSessionStore(providerId: ProviderId): ChromeAuthSessionStore {
    return this.sessionStores[providerId];
  }
}

export { MAL_AUTHORIZATION_URL };
