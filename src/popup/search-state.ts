import { parseAnimeSearchQuery } from '../api/anime-search-query';
import type { AnimeType } from '../domain/anime';
import type { AppCopy } from '../locales';

export const SEARCH_DEBOUNCE_MS = 300;

export function isSearchActive(query: string): boolean {
  return parseAnimeSearchQuery(query) !== null;
}

export interface SearchFormatFilter {
  readonly key: string;
  readonly label: (copy: AppCopy) => string;
  readonly types: readonly AnimeType[];
}

export const SEARCH_FORMAT_FILTERS: readonly SearchFormatFilter[] = [
  { key: 'tv', label: (copy) => copy.searchFormatTv, types: ['tv'] },
  { key: 'movie', label: (copy) => copy.searchFormatMovie, types: ['movie'] },
  { key: 'ova', label: (copy) => copy.searchFormatOva, types: ['ova'] },
  { key: 'ona', label: (copy) => copy.searchFormatOna, types: ['ona'] },
  {
    key: 'special',
    label: (copy) => copy.searchFormatSpecial,
    types: ['special', 'music', 'unknown'],
  },
];

export function toggleSearchFormat(selected: readonly string[], key: string): readonly string[] {
  return selected.includes(key) ? selected.filter((entry) => entry !== key) : [...selected, key];
}

export function searchFormatKeys(selected: readonly string[]): readonly string[] {
  return SEARCH_FORMAT_FILTERS.filter((filter) => selected.includes(filter.key)).map(
    (filter) => filter.key,
  );
}

export function searchFormatTypes(selected: readonly string[]): readonly AnimeType[] {
  return SEARCH_FORMAT_FILTERS.filter((filter) => selected.includes(filter.key)).flatMap(
    (filter) => filter.types,
  );
}
