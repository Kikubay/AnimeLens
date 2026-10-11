import type { Anime } from '../domain/anime';
import {
  ANIME_SEARCH_MAX_LENGTH,
  ANIME_SEARCH_MIN_LENGTH,
  parseAnimeSearchQuery,
} from './anime-search-query';

export { ANIME_SEARCH_MAX_LENGTH, ANIME_SEARCH_MIN_LENGTH };

export const ANIME_SEARCH_PAGE_SIZE = 24;

export type AnimeSearchMessage = {
  readonly type: 'anime.search';
  readonly query: string;
  readonly offset?: number;
};

export type AnimeSearchResponse =
  | {
      readonly ok: true;
      readonly results: readonly Anime[];
      readonly hasMore: boolean;
      /** Offset to pass back for the next page, counted in provider items rather than returned rows. */
      readonly nextOffset: number;
    }
  | { readonly ok: false; readonly message: string };

export interface AnimeSearchResultPage {
  readonly results: readonly Anime[];
  readonly hasMore: boolean;
  readonly nextOffset: number;
}

export async function requestAnimeSearch(
  query: string,
  offset: number = 0,
): Promise<AnimeSearchResultPage> {
  const response = (await chrome.runtime.sendMessage({
    type: 'anime.search',
    query,
    offset,
  })) as AnimeSearchResponse | undefined;
  if (response === undefined || response === null) throw new Error('Search is unavailable.');
  if (!response.ok) throw new Error(response.message);
  return {
    results: Array.isArray(response.results) ? response.results : [],
    hasMore: response.hasMore === true,
    nextOffset: typeof response.nextOffset === 'number' ? response.nextOffset : offset,
  };
}

export function isAnimeSearchMessage(value: unknown): value is AnimeSearchMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  if (value.type !== 'anime.search') return false;
  if (!('query' in value) || typeof value.query !== 'string') return false;
  const query = value.query.trim();
  if (query.length < ANIME_SEARCH_MIN_LENGTH || query.length > ANIME_SEARCH_MAX_LENGTH) {
    return false;
  }
  if ('offset' in value && value.offset !== undefined) {
    if (typeof value.offset !== 'number' || !Number.isInteger(value.offset) || value.offset < 0) {
      return false;
    }
  }
  return true;
}

export function isSearchableQuery(query: string): boolean {
  return parseAnimeSearchQuery(query) !== null;
}
