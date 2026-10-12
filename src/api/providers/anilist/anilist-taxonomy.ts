import { normalizeAnimeTag } from '../../anime-search-query';

const ANILIST_GENRES: readonly string[] = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

const ANILIST_GENRES_BY_TAG: ReadonlyMap<string, string> = new Map(
  ANILIST_GENRES.map((genre) => [normalizeAnimeTag(genre), genre]),
);

export function findAniListGenre(tag: string): string | null {
  return ANILIST_GENRES_BY_TAG.get(normalizeAnimeTag(tag)) ?? null;
}
