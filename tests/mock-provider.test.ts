import { describe, expect, it } from 'vitest';
import { isApiError } from '../src/api/api-errors';
import { MockAnimeProvider } from '../src/api/providers/mock/mock-provider';
import { defaultMockAnime } from '../src/api/mocks/mock-fixtures';

describe('MockAnimeProvider', () => {
  it('supports the complete provider contract without a network', async () => {
    const provider = new MockAnimeProvider();

    await expect(provider.getCurrentUser()).resolves.toMatchObject({ username: 'alex.mori' });
    await expect(provider.getUserAnimeList()).resolves.toHaveLength(defaultMockAnime.length);
    await expect(provider.getAnime(defaultMockAnime[0].id)).resolves.toEqual(defaultMockAnime[0]);
    await expect(provider.searchAnime('frieren')).resolves.toHaveLength(1);
  });

  it('returns an explicit not-found error for unknown anime', async () => {
    await expect(new MockAnimeProvider().getAnime(999999)).rejects.toSatisfy((error: unknown) => {
      return isApiError(error) && error.code === 'not_found';
    });
  });
});
