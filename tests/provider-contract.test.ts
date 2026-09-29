import { describe, expect, it } from 'vitest';
import type { AnimeProvider } from '../src/api/anime-provider';
import { createAnimeProvider } from '../src/api/provider';

describe('AnimeProvider abstraction', () => {
  it('defaults to a fully usable mock provider', async () => {
    const provider: AnimeProvider = createAnimeProvider();

    const [user, list, search] = await Promise.all([
      provider.getCurrentUser(),
      provider.getUserAnimeList(),
      provider.searchAnime('frieren'),
    ]);

    expect(user.username).toBe('alex.mori');
    expect(list.length).toBeGreaterThan(0);
    expect(search[0]?.title.default).toContain('Frieren');
  });

  it('does not silently enable MAL without manual OAuth configuration', () => {
    expect(() => createAnimeProvider('mal')).toThrow(/manual OAuth configuration/);
  });
});
