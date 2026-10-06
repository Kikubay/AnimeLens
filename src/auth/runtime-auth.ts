import { FetchHttpClient } from '../api/http-client';
import type { HttpClient } from '../api/http-client';
import type { MalAuthService } from './auth-service';
import type { IdentityWebAuthFlow, MalOAuthClient, ProviderId } from './auth-types';
import { FetchMalOAuthClient } from './mal-oauth-client';
import { ProviderRegistry, ProviderRegistryService } from '../providers/provider-registry';

export const MAL_AUTHORIZATION_URL = 'https://myanimelist.net/v1/oauth2/authorize';
export const MAL_CLIENT_ID_STORAGE_KEY = 'malClientId';
export const ANILIST_CLIENT_ID_STORAGE_KEY = 'anilistClientId';

export async function getConfiguredClientId(fallback: string): Promise<string> {
  return getProviderClientId('mal', fallback);
}

export async function getProviderClientId(
  providerId: ProviderId,
  fallback: string,
): Promise<string> {
  const key = providerId === 'anilist' ? ANILIST_CLIENT_ID_STORAGE_KEY : MAL_CLIENT_ID_STORAGE_KEY;
  const result = await chrome.storage.local.get(key);
  const configured = result[key];
  return typeof configured === 'string' && configured.trim().length > 0
    ? configured.trim()
    : fallback;
}

export interface RuntimeAuthDependencies {
  readonly httpClient: HttpClient;
}

export function createRuntimeAuthDependencies(): RuntimeAuthDependencies {
  return {
    httpClient: new FetchHttpClient(),
  };
}

export function createRuntimeProviderRegistryService(
  dependencies: RuntimeAuthDependencies = createRuntimeAuthDependencies(),
): ProviderRegistryService {
  const identity: IdentityWebAuthFlow = {
    getRedirectURL: (path) => chrome.identity.getRedirectURL(path),
    launchWebAuthFlow: (details) => chrome.identity.launchWebAuthFlow(details),
  };
  const oauthClient: MalOAuthClient = new FetchMalOAuthClient(dependencies.httpClient);
  const registry = new ProviderRegistry({
    get: async (keys) => chrome.storage.local.get(keys),
    set: async (items) => {
      await chrome.storage.local.set(items);
    },
  });
  const malFallbackClientId = import.meta.env.VITE_MAL_CLIENT_ID ?? '';
  const anilistFallbackClientId = import.meta.env.VITE_ANILIST_CLIENT_ID ?? '';

  return new ProviderRegistryService(registry, identity, oauthClient, dependencies.httpClient, {
    malClientId: malFallbackClientId,
    anilistClientId: anilistFallbackClientId,
    getClientId: (providerId) =>
      getProviderClientId(
        providerId,
        providerId === 'anilist' ? anilistFallbackClientId : malFallbackClientId,
      ),
  });
}

export function createRuntimeAuthService(
  dependencies: RuntimeAuthDependencies = createRuntimeAuthDependencies(),
): MalAuthService {
  return createRuntimeProviderRegistryService(dependencies).getAuthService('mal');
}

export { ProviderRegistry, ProviderRegistryService } from '../providers/provider-registry';
export type { ProviderId } from './auth-types';
