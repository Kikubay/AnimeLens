import { ANIME_SEARCH_MIN_LENGTH } from '../api/anime-search-messages';

export const SEARCH_DEBOUNCE_MS = 300;

export function isSearchActive(query: string): boolean {
  return query.trim().length >= ANIME_SEARCH_MIN_LENGTH;
}
