import { describe, expect, it } from 'vitest';
import {
  ANIME_SEARCH_MAX_LENGTH,
  ANIME_SEARCH_MIN_LENGTH,
  isAnimeSearchMessage,
} from '../src/api/anime-search-messages';
import { isSearchActive, SEARCH_DEBOUNCE_MS } from '../src/popup/search-state';

describe('anime search message', () => {
  it('accepts a trimmed query of at least the minimum length', () => {
    expect(isAnimeSearchMessage({ type: 'anime.search', query: 'naruto' })).toBe(true);
    expect(isAnimeSearchMessage({ type: 'anime.search', query: '  cowboy  ' })).toBe(true);
    expect(isAnimeSearchMessage({ type: 'anime.search', query: 'ab' })).toBe(true);
    expect(
      isAnimeSearchMessage({ type: 'anime.search', query: 'x'.repeat(ANIME_SEARCH_MAX_LENGTH) }),
    ).toBe(true);
  });

  it('rejects anything the provider could not answer', () => {
    for (const invalid of [
      { type: 'anime.search', query: 'a' },
      { type: 'anime.search', query: '   ' },
      { type: 'anime.search', query: '' },
      { type: 'anime.search', query: 'x'.repeat(ANIME_SEARCH_MAX_LENGTH + 1) },
      { type: 'anime.search', query: 12 },
      { type: 'anime.search', query: null },
      { type: 'anime.search' },
      { type: 'anime.get_streaming_links', animeId: 16498 },
      { type: 'mal.list.add', animeId: 1 },
      null,
      undefined,
      'anime.search',
    ]) {
      expect(isAnimeSearchMessage(invalid), JSON.stringify(invalid ?? null)).toBe(false);
    }
  });
});

describe('search activation', () => {
  it('waits for the minimum query length before taking over the dashboard', () => {
    expect(isSearchActive('')).toBe(false);
    expect(isSearchActive(' ')).toBe(false);
    expect(isSearchActive('a')).toBe(false);
    expect(isSearchActive('ab')).toBe(true);
    expect(isSearchActive('  cowboy  ')).toBe(true);
  });

  it('debounces long enough to survive a burst of keystrokes', () => {
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(200);
    expect(ANIME_SEARCH_MIN_LENGTH).toBe(2);
  });
});
