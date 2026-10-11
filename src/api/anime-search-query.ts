import type { Anime } from '../domain/anime';

export const ANIME_SEARCH_MIN_LENGTH = 2;
export const ANIME_SEARCH_MAX_LENGTH = 120;
export const ANIME_TAG_PREFIX = '#';

export type AnimeSearchQuery =
  | { readonly kind: 'title'; readonly value: string }
  | { readonly kind: 'tag'; readonly value: string };

/** Folds a genre or theme name and a typed `#tag` onto the same key, so `Slice of Life`, `slice-of-life` and `sliceoflife` all meet. */
export function normalizeAnimeTag(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function parseAnimeSearchQuery(raw: string): AnimeSearchQuery | null {
  const trimmed = raw.trim().slice(0, ANIME_SEARCH_MAX_LENGTH);
  if (trimmed.startsWith(ANIME_TAG_PREFIX)) {
    const tag = trimmed.slice(ANIME_TAG_PREFIX.length).trim();
    if (tag.length < ANIME_SEARCH_MIN_LENGTH) return null;
    return { kind: 'tag', value: tag };
  }
  if (trimmed.length < ANIME_SEARCH_MIN_LENGTH) return null;
  return { kind: 'title', value: trimmed };
}

export function animeMatchesTag(anime: Anime, tag: string): boolean {
  const needle = normalizeAnimeTag(tag);
  if (needle.length === 0) return false;
  return [...anime.genres, ...anime.themes].some(
    (entry) => normalizeAnimeTag(entry.name) === needle,
  );
}

export function matchesAnimeSearchQuery(anime: Anime, query: AnimeSearchQuery): boolean {
  if (query.kind === 'tag') return animeMatchesTag(anime, query.value);
  const needle = query.value.toLowerCase();
  return [anime.title.default, anime.title.english, anime.title.japanese, ...anime.title.synonyms]
    .filter((title): title is string => typeof title === 'string')
    .some((title) => title.toLowerCase().includes(needle));
}
