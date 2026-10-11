import { parseAnimeSearchQuery } from '../api/anime-search-query';

export const SEARCH_DEBOUNCE_MS = 300;

export function isSearchActive(query: string): boolean {
  return parseAnimeSearchQuery(query) !== null;
}
