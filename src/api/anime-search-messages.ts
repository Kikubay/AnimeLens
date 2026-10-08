import type { Anime } from '../domain/anime';

export const ANIME_SEARCH_MIN_LENGTH = 2;
export const ANIME_SEARCH_MAX_LENGTH = 120;

export type AnimeSearchMessage = {
  readonly type: 'anime.search';
  readonly query: string;
};

export type AnimeSearchResponse =
  | { readonly ok: true; readonly results: readonly Anime[] }
  | { readonly ok: false; readonly message: string };

export async function requestAnimeSearch(query: string): Promise<readonly Anime[]> {
  const response = (await chrome.runtime.sendMessage({
    type: 'anime.search',
    query,
  })) as AnimeSearchResponse | undefined;
  if (response === undefined || response === null) throw new Error('Search is unavailable.');
  if (!response.ok) throw new Error(response.message);
  return Array.isArray(response.results) ? response.results : [];
}

export function isAnimeSearchMessage(value: unknown): value is AnimeSearchMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  if (value.type !== 'anime.search') return false;
  if (!('query' in value) || typeof value.query !== 'string') return false;
  const query = value.query.trim();
  return query.length >= ANIME_SEARCH_MIN_LENGTH && query.length <= ANIME_SEARCH_MAX_LENGTH;
}
