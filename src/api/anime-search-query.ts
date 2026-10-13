import type { Anime, AnimeType } from '../domain/anime';

export const ANIME_SEARCH_MIN_LENGTH = 2;
export const ANIME_SEARCH_MAX_LENGTH = 120;
export const ANIME_TAG_PREFIX = '#';

export type AnimeSearchQuery =
  | { readonly kind: 'title'; readonly value: string }
  | { readonly kind: 'tag'; readonly values: readonly string[] };

export function normalizeAnimeTag(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function parseAnimeTags(raw: string): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  let current = '';

  const collect = (candidate: string): void => {
    const value = candidate.trim();
    const normalized = normalizeAnimeTag(value);
    if (normalized.length < ANIME_SEARCH_MIN_LENGTH || seen.has(normalized)) return;
    seen.add(normalized);
    tags.push(value);
  };

  for (const word of raw.split(/\s+/)) {
    if (word.length === 0) continue;
    if (word.startsWith(ANIME_TAG_PREFIX)) {
      if (current.length > 0) collect(current);
      current = word.slice(ANIME_TAG_PREFIX.length);
    } else if (current.length > 0) {
      current = `${current} ${word}`;
    }
  }
  if (current.length > 0) collect(current);

  return tags;
}

export function formatAnimeTagQuery(tags: readonly string[]): string {
  return tags.map((tag) => `${ANIME_TAG_PREFIX}${tag}`).join(' ');
}

export function parseAnimeSearchQuery(raw: string): AnimeSearchQuery | null {
  const trimmed = raw.trim().slice(0, ANIME_SEARCH_MAX_LENGTH);
  if (trimmed.startsWith(ANIME_TAG_PREFIX)) {
    const values = parseAnimeTags(trimmed);
    return values.length === 0 ? null : { kind: 'tag', values };
  }
  if (trimmed.length < ANIME_SEARCH_MIN_LENGTH) return null;
  return { kind: 'title', value: trimmed };
}

export function animeMatchesTags(anime: Anime, tags: readonly string[]): boolean {
  if (tags.length === 0) return false;
  const names = new Set(
    [...anime.genres, ...anime.themes].map((entry) => normalizeAnimeTag(entry.name)),
  );
  return tags.every((tag) => names.has(normalizeAnimeTag(tag)));
}

export function matchesAnimeSearchQuery(anime: Anime, query: AnimeSearchQuery): boolean {
  if (query.kind === 'tag') return animeMatchesTags(anime, query.values);
  const needle = query.value.toLowerCase();
  return [anime.title.default, anime.title.english, anime.title.japanese, ...anime.title.synonyms]
    .filter((title): title is string => typeof title === 'string')
    .some((title) => title.toLowerCase().includes(needle));
}

export function filterAnimeByFormats(
  results: readonly Anime[],
  formats: readonly AnimeType[],
): readonly Anime[] {
  if (formats.length === 0) return results;
  return results.filter((anime) => formats.includes(anime.type));
}
