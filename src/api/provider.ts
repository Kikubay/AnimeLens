import type { AnimeProvider } from './anime-provider';
import { MockAnimeProvider } from './providers/mock/mock-provider';

export type ProviderMode = 'mock' | 'mal';

export function createAnimeProvider(mode: ProviderMode = 'mock'): AnimeProvider {
  if (mode === 'mock') return new MockAnimeProvider();
  throw new Error('The MAL provider requires manual OAuth configuration and is not enabled yet.');
}
