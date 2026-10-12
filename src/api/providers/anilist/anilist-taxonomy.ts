import type { AnimeType } from '../../../domain/anime';
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

const ANILIST_FORMATS: Readonly<Partial<Record<AnimeType, string>>> = {
  tv: 'TV',
  movie: 'MOVIE',
  ova: 'OVA',
  ona: 'ONA',
  special: 'SPECIAL',
  music: 'MUSIC',
};

export function toAniListFormats(types: readonly AnimeType[]): readonly string[] | null {
  const unique = [...new Set(types.map((type) => ANILIST_FORMATS[type]).filter(isPresent))];
  return unique.length === 0 ? null : unique;
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined;
}
