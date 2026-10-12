import { describe, expect, it } from 'vitest';
import type { Anime } from '../src/domain/anime';
import {
  ANIME_SEARCH_MAX_LENGTH,
  ANIME_SEARCH_MIN_LENGTH,
  isAnimeSearchMessage,
} from '../src/api/anime-search-messages';
import {
  animeMatchesTag,
  filterAnimeByFormats,
  matchesAnimeSearchQuery,
  normalizeAnimeTag,
  parseAnimeSearchQuery,
} from '../src/api/anime-search-query';
import { defaultMockAnime } from '../src/api/mocks/mock-fixtures';
import { MockAnimeProvider } from '../src/api/providers/mock/mock-provider';
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_FORMAT_FILTERS,
  isSearchActive,
  searchFormatTypes,
  toggleSearchFormat,
} from '../src/popup/search-state';

describe('anime search message', () => {
  it('accepts a trimmed query of at least the minimum length', () => {
    expect(isAnimeSearchMessage({ type: 'anime.search', query: 'naruto' })).toBe(true);
    expect(isAnimeSearchMessage({ type: 'anime.search', query: '  cowboy  ' })).toBe(true);
    expect(isAnimeSearchMessage({ type: 'anime.search', query: 'ab' })).toBe(true);
    expect(isAnimeSearchMessage({ type: 'anime.search', query: '#isekai' })).toBe(true);
    expect(isAnimeSearchMessage({ type: 'anime.search', query: 'naruto', offset: 24 })).toBe(true);
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
      { type: 'anime.search', query: 'naruto', offset: -1 },
      { type: 'anime.search', query: 'naruto', offset: 1.5 },
      { type: 'anime.search', query: 'naruto', offset: '24' },
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

describe('search query parsing', () => {
  it('reads a leading # as a tag search rather than a title search', () => {
    expect(parseAnimeSearchQuery('#isekai')).toEqual({ kind: 'tag', value: 'isekai' });
    expect(parseAnimeSearchQuery('  #Slice of Life  ')).toEqual({
      kind: 'tag',
      value: 'Slice of Life',
    });
    expect(parseAnimeSearchQuery('#')).toBeNull();
    expect(parseAnimeSearchQuery('#a')).toBeNull();
  });

  it('treats anything without the # prefix as a title search', () => {
    expect(parseAnimeSearchQuery('cowboy bebop')).toEqual({
      kind: 'title',
      value: 'cowboy bebop',
    });
    expect(parseAnimeSearchQuery('a')).toBeNull();
    expect(parseAnimeSearchQuery('  ')).toBeNull();
  });

  it('folds punctuation and spacing together so one tag name has one spelling', () => {
    expect(normalizeAnimeTag('Slice of Life')).toBe('sliceoflife');
    expect(normalizeAnimeTag('slice-of-life')).toBe('sliceoflife');
    expect(normalizeAnimeTag('SLICE_OF_LIFE')).toBe('sliceoflife');
  });
});

describe('tag matching', () => {
  const anime = defaultMockAnime[0];

  it('matches a theme or genre regardless of how the tag was typed', () => {
    expect(anime).toBeDefined();
    const names = [...anime.genres, ...anime.themes].map((entry) => entry.name);
    for (const name of names) {
      expect(animeMatchesTag(anime, name), name).toBe(true);
      expect(animeMatchesTag(anime, name.toLowerCase()), name).toBe(true);
      expect(animeMatchesTag(anime, name.replace(/ /g, '-')), name).toBe(true);
    }
    expect(animeMatchesTag(anime, 'not-a-real-tag')).toBe(false);
    expect(animeMatchesTag(anime, '   ')).toBe(false);
  });

  it('keeps a tag search off titles that merely mention the word', () => {
    const tagged = defaultMockAnime.filter((item) => animeMatchesTag(item, 'fantasy'));
    expect(tagged.length).toBeGreaterThan(0);
    for (const item of tagged) {
      expect(
        matchesAnimeSearchQuery(item, { kind: 'tag', value: 'fantasy' }),
        item.title.default,
      ).toBe(true);
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

  it('counts a tag by the text after the #, so a bare # stays inactive', () => {
    expect(isSearchActive('#')).toBe(false);
    expect(isSearchActive('#a')).toBe(false);
    expect(isSearchActive('#is')).toBe(true);
    expect(isSearchActive('  #isekai  ')).toBe(true);
  });

  it('debounces long enough to survive a burst of keystrokes', () => {
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(200);
    expect(ANIME_SEARCH_MIN_LENGTH).toBe(2);
  });
});

describe('paged search', () => {
  const catalogue: readonly Anime[] = [
    ...defaultMockAnime,
    ...[1, 2, 3].map((index) => ({
      ...defaultMockAnime[0],
      id: 1000 + index,
      title: {
        default: `Isekai Tale ${index}`,
        english: null,
        japanese: null,
        synonyms: [],
      },
      genres: [{ id: 2, name: 'Adventure' }],
      themes: [{ id: 62, name: 'Isekai' }],
    })),
  ];
  const provider = new MockAnimeProvider(catalogue);
  const isekai = catalogue.filter((item) => animeMatchesTag(item, 'isekai'));

  it('walks a tag result set one page at a time and reports when it is exhausted', async () => {
    expect(isekai.length).toBeGreaterThan(1);

    const first = await provider.searchAnime('isekai', { tag: 'isekai', limit: 2, offset: 0 });
    expect(first.results).toHaveLength(2);
    expect(first.hasMore).toBe(true);

    const second = await provider.searchAnime('isekai', { tag: 'isekai', limit: 2, offset: 2 });
    expect(second.results).toHaveLength(isekai.length - 2);
    expect(second.hasMore).toBe(false);

    const seen = [...first.results, ...second.results].map((item) => item.id);
    expect(new Set(seen).size).toBe(isekai.length);
  });

  it('never reports more pages once the last row has been handed out', async () => {
    const page = await provider.searchAnime('isekai', { tag: 'isekai', limit: 50, offset: 0 });

    expect(page.results).toHaveLength(isekai.length);
    expect(page.hasMore).toBe(false);
  });

  it('answers a title search with titles only, tag or no tag', async () => {
    const page = await provider.searchAnime('frieren', { limit: 24, offset: 0 });

    expect(page.results.length).toBeGreaterThan(0);
    for (const item of page.results) {
      expect(item.title.default.toLowerCase()).toContain('frieren');
    }
  });

  it('returns an empty terminal page for an unknown tag', async () => {
    const page = await provider.searchAnime('nonexistenttag', {
      tag: 'nonexistenttag',
      limit: 24,
      offset: 0,
    });

    expect(page).toEqual({ results: [], hasMore: false });
  });
});

describe('search format filter', () => {
  const byType = (type: Anime['type'], id: number): Anime => ({
    ...defaultMockAnime[0],
    id,
    type,
    title: { default: `${type} ${id}`, english: null, japanese: null, synonyms: [] },
  });

  const results: readonly Anime[] = [
    byType('tv', 1),
    byType('movie', 2),
    byType('ova', 3),
    byType('ona', 4),
    byType('special', 5),
    byType('music', 6),
    byType('unknown', 7),
  ];

  it('returns the results untouched while no format is selected', () => {
    expect(filterAnimeByFormats(results, [])).toBe(results);
  });

  it('keeps only the selected format', () => {
    expect(filterAnimeByFormats(results, ['movie']).map((item) => item.id)).toEqual([2]);
  });

  it('keeps the union of several selected formats', () => {
    expect(filterAnimeByFormats(results, ['ova', 'ona']).map((item) => item.id)).toEqual([3, 4]);
  });

  it('offers five chips, with Specials standing in for music and unknown', () => {
    expect(SEARCH_FORMAT_FILTERS.map((filter) => filter.key)).toEqual([
      'tv',
      'movie',
      'ova',
      'ona',
      'special',
    ]);
    const specials = SEARCH_FORMAT_FILTERS.find((filter) => filter.key === 'special');
    expect(specials?.types).toEqual(['special', 'music', 'unknown']);
  });

  it('lets the Specials chip reach music and unknown rows that no other chip covers', () => {
    const specials = searchFormatTypes(['special']);
    expect(filterAnimeByFormats(results, specials).map((item) => item.id)).toEqual([5, 6, 7]);
  });

  it('maps selected chips to the underlying types a provider should accept', () => {
    expect(searchFormatTypes(['tv', 'ona'])).toEqual(['tv', 'ona']);
    expect(searchFormatTypes([])).toEqual([]);
  });

  it('adds and removes a chip without disturbing the others', () => {
    let selected: readonly string[] = [];
    selected = toggleSearchFormat(selected, 'movie');
    selected = toggleSearchFormat(selected, 'ova');
    expect(selected).toEqual(['movie', 'ova']);
    selected = toggleSearchFormat(selected, 'movie');
    expect(selected).toEqual(['ova']);
    selected = toggleSearchFormat(selected, 'movie');
    expect(selected).toEqual(['ova', 'movie']);
  });

  it('ignores chip keys that no longer exist', () => {
    expect(searchFormatTypes(['music'])).toEqual([]);
  });

  it('narrows a paginated provider search when formats are supplied', async () => {
    const paginated = new MockAnimeProvider([
      ...defaultMockAnime,
      ...[1, 2, 3].map((index) => ({
        ...defaultMockAnime[0],
        id: 2000 + index,
        type: 'ova' as const,
        title: {
          default: `Ova ${index}`,
          english: null,
          japanese: null,
          synonyms: [],
        },
        themes: [{ id: 62, name: 'Isekai' }],
      })),
    ]);
    const page = await paginated.searchAnime('isekai', {
      tag: 'isekai',
      limit: 24,
      offset: 0,
      formats: ['ova'],
    });
    expect(page.results.length).toBeGreaterThan(0);
    for (const item of page.results) {
      expect(item.type).toBe('ova');
    }
  });
});
