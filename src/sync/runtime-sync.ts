import type { ProviderId } from '../auth/auth-types';
import type { SyncProgress } from '../domain/sync';
import type { ProviderRegistryService } from '../providers/provider-registry';
import { ChromeAnimeCacheStore } from './sync-cache';
import { AnimeListSyncService } from './sync-service';
import type { SyncRunOptions, SyncResult } from './sync-types';
import type { AnimeCacheStore } from './sync-types';
import type { StorageAdapter } from '../storage/storage-adapter';
import type { Language } from '../locales';

// Resolves the active provider per run; each provider has its own cache, so switching restores that list instantly, even offline.
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

  // No argument clears both providers (clear-cache / delete-local-data); a provider id clears just that one, so a disconnect keeps the other's data.
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
