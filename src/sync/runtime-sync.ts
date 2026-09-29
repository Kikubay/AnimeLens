import type { ProviderId } from '../auth/auth-types';
import type { SyncProgress } from '../domain/sync';
import type { ProviderRegistryService } from '../providers/provider-registry';
import { ChromeAnimeCacheStore } from './sync-cache';
import { AnimeListSyncService } from './sync-service';
import type { SyncRunOptions, SyncResult } from './sync-types';
import type { AnimeCacheStore } from './sync-types';
import type { StorageAdapter } from '../storage/storage-adapter';
import type { Language } from '../i18n';

/**
 * Sync facade that resolves the **active** provider for every run. Each
 * provider keeps its own cache (`animeData:<providerId>`), so switching the
 * active provider restores its cached list instantly and offline.
 */
export class AuthenticatedAnimeListSyncService {
  constructor(
    private readonly registryService: ProviderRegistryService,
    private readonly storage: StorageAdapter,
  ) {}

  private async cacheStoreFor(providerId: ProviderId): Promise<AnimeCacheStore> {
    return new ChromeAnimeCacheStore(this.storage, providerId);
  }

  async sync(options: SyncRunOptions = {}): Promise<SyncResult> {
    const providerId = await this.registryService.registry.getActiveProvider();
    const authService = this.registryService.getAuthService(providerId);
    return authService.withAccessToken(async (accessToken) => {
      const provider = this.registryService.createProvider(providerId, accessToken);
      const service = new AnimeListSyncService(provider, await this.cacheStoreFor(providerId));
      return service.sync(options);
    });
  }

  async getCachedResult(language: Language = 'en'): Promise<SyncResult | null> {
    const providerId = await this.registryService.registry.getActiveProvider();
    const service = new AnimeListSyncService(
      {
        getCurrentUser: async () => {
          throw new Error('Cache-only operation.');
        },
        getUserAnimeList: async () => [],
        getAnime: async () => {
          throw new Error('Cache-only operation.');
        },
        searchAnime: async () => [],
        addToList: async () => undefined,
      },
      await this.cacheStoreFor(providerId),
    );
    return service.getCachedResult(language);
  }

  /**
   * Clears cached list data. Without an argument both providers are cleared
   * (delete-local-data / clear-cache); with a provider id only that
   * provider's cache is dropped (disconnect keeps the other provider's data).
   */
  async invalidate(providerId?: ProviderId): Promise<void> {
    if (providerId === undefined) {
      await Promise.all([
        (await this.cacheStoreFor('mal')).clear(),
        (await this.cacheStoreFor('anilist')).clear(),
      ]);
      return;
    }
    await (await this.cacheStoreFor(providerId)).clear();
  }
}

export function toSyncProgress(progress: SyncProgress): SyncProgress {
  return progress;
}
