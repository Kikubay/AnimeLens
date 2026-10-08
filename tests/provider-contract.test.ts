import { describe, expect, it } from 'vitest';
import type { AnimeProvider } from '../src/api/anime-provider';
import { MockAnimeProvider } from '../src/api/providers/mock/mock-provider';
import { MalAnimeProvider } from '../src/api/providers/mal/mal-provider';
import { AniListProvider } from '../src/api/providers/anilist/anilist-provider';
import type { HttpClient, HttpResponse } from '../src/api/http-client';

const refusingClient: HttpClient = {
  async get<T>(): Promise<HttpResponse<T>> {
    throw new Error('This test must not reach the network.');
  },
  async post<T>(): Promise<HttpResponse<T>> {
    throw new Error('This test must not reach the network.');
  },
  async patch<T>(): Promise<HttpResponse<T>> {
    throw new Error('This test must not reach the network.');
  },
};

const providers: readonly { readonly name: string; readonly provider: AnimeProvider }[] = [
  { name: 'mock', provider: new MockAnimeProvider() },
  { name: 'mal', provider: new MalAnimeProvider(refusingClient, 'token') },
  { name: 'anilist', provider: new AniListProvider(refusingClient, 'token') },
];

describe('AnimeProvider contract', () => {
  it('every provider answers the whole required surface', () => {
    for (const { name, provider } of providers) {
      for (const method of [
        'getCurrentUser',
        'getUserAnimeList',
        'getAnime',
        'searchAnime',
        'addToList',
      ] as const) {
        expect(typeof provider[method], `${name}.${method}`).toBe('function');
      }
    }
  });

  it('every provider can widen the candidate pool, so the engine is never left with plan-to-watch alone', () => {
    for (const { name, provider } of providers) {
      expect(typeof provider.getAnimeSuggestions, `${name}.getAnimeSuggestions`).toBe('function');
      expect(typeof provider.getAnimeRanking, `${name}.getAnimeRanking`).toBe('function');
    }
  });

  it('every provider declares where to sample discovery, since the numbers are catalogue-specific', () => {
    for (const { name, provider } of providers) {
      const config = provider.candidatePoolConfig;
      expect(config, `${name}.candidatePoolConfig`).toBeDefined();
      expect(config?.suggestionLimit ?? 0).toBeGreaterThan(0);
      expect(config?.rankingLimit ?? 0).toBeGreaterThan(0);
      expect(config?.rankingOffset ?? -1).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps the two providers on separate catalogue slices instead of one shared offset', () => {
    const mal = new MalAnimeProvider(refusingClient, 'token').candidatePoolConfig;
    const anilist = new AniListProvider(refusingClient, 'token').candidatePoolConfig;

    expect(mal?.rankingOffset).not.toBe(anilist?.rankingOffset);
  });

  it('serves a fully usable mock provider for offline work', async () => {
    const provider = new MockAnimeProvider();

    const [user, list, search] = await Promise.all([
      provider.getCurrentUser(),
      provider.getUserAnimeList(),
      provider.searchAnime('frieren'),
    ]);

    expect(user.username).toBe('alex.mori');
    expect(list.length).toBeGreaterThan(0);
    expect(search[0]?.title.default).toContain('Frieren');
  });
});
