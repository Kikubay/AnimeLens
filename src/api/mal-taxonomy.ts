import { normalizeAnimeTag } from './anime-search-query';

interface MalTaxonomyEntry {
  readonly id: number;
  readonly name: string;
}

const MAL_GENRE_TAXONOMY: readonly MalTaxonomyEntry[] = [
  { id: 1, name: 'Action' },
  { id: 2, name: 'Adventure' },
  { id: 4, name: 'Comedy' },
  { id: 5, name: 'Avant Garde' },
  { id: 7, name: 'Mystery' },
  { id: 8, name: 'Drama' },
  { id: 9, name: 'Ecchi' },
  { id: 10, name: 'Fantasy' },
  { id: 12, name: 'Hentai' },
  { id: 14, name: 'Horror' },
  { id: 15, name: 'Kids' },
  { id: 22, name: 'Romance' },
  { id: 24, name: 'Sci-Fi' },
  { id: 25, name: 'Shoujo' },
  { id: 26, name: 'Girls Love' },
  { id: 27, name: 'Shounen' },
  { id: 28, name: 'Boys Love' },
  { id: 30, name: 'Sports' },
  { id: 36, name: 'Slice of Life' },
  { id: 37, name: 'Supernatural' },
  { id: 41, name: 'Suspense' },
  { id: 42, name: 'Seinen' },
  { id: 43, name: 'Josei' },
  { id: 46, name: 'Award Winning' },
  { id: 47, name: 'Gourmet' },
  { id: 48, name: 'Workplace' },
  { id: 49, name: 'Erotica' },
];

const MAL_THEME_TAXONOMY: readonly MalTaxonomyEntry[] = [
  { id: 3, name: 'Racing' },
  { id: 6, name: 'Mythology' },
  { id: 11, name: 'Strategy Game' },
  { id: 13, name: 'Historical' },
  { id: 17, name: 'Martial Arts' },
  { id: 18, name: 'Mecha' },
  { id: 19, name: 'Music' },
  { id: 20, name: 'Parody' },
  { id: 21, name: 'Samurai' },
  { id: 23, name: 'School' },
  { id: 29, name: 'Space' },
  { id: 31, name: 'Super Power' },
  { id: 32, name: 'Vampire' },
  { id: 35, name: 'Harem' },
  { id: 38, name: 'Military' },
  { id: 39, name: 'Detective' },
  { id: 40, name: 'Psychological' },
  { id: 50, name: 'Adult Cast' },
  { id: 51, name: 'Anthropomorphic' },
  { id: 52, name: 'CGDCT' },
  { id: 53, name: 'Childcare' },
  { id: 54, name: 'Combat Sports' },
  { id: 55, name: 'Delinquents' },
  { id: 56, name: 'Educational' },
  { id: 57, name: 'Gag Humor' },
  { id: 58, name: 'Gore' },
  { id: 59, name: 'High Stakes Game' },
  { id: 60, name: 'Idols (Female)' },
  { id: 61, name: 'Idols (Male)' },
  { id: 62, name: 'Isekai' },
  { id: 63, name: 'Iyashikei' },
  { id: 64, name: 'Love Polygon' },
  { id: 65, name: 'Magical Sex Shift' },
  { id: 66, name: 'Mahou Shoujo' },
  { id: 67, name: 'Medical' },
  { id: 68, name: 'Organized Crime' },
  { id: 69, name: 'Otaku Culture' },
  { id: 70, name: 'Performing Arts' },
  { id: 71, name: 'Pets' },
  { id: 72, name: 'Reincarnation' },
  { id: 73, name: 'Reverse Harem' },
  { id: 74, name: 'Love Status Quo' },
  { id: 75, name: 'Showbiz' },
  { id: 76, name: 'Survival' },
  { id: 77, name: 'Team Sports' },
  { id: 78, name: 'Time Travel' },
  { id: 79, name: 'Video Game' },
  { id: 80, name: 'Visual Arts' },
  { id: 81, name: 'Crossdressing' },
  { id: 82, name: 'Urban Fantasy' },
  { id: 83, name: 'Villainess' },
];

const THEME_IDS: ReadonlySet<number> = new Set(MAL_THEME_TAXONOMY.map((entry) => entry.id));

function namesAlphabetically(entries: readonly MalTaxonomyEntry[]): readonly string[] {
  return [...entries].map((entry) => entry.name).sort((left, right) => left.localeCompare(right));
}

export const MAL_GENRE_NAMES: readonly string[] = namesAlphabetically(MAL_GENRE_TAXONOMY);
export const MAL_THEME_NAMES: readonly string[] = namesAlphabetically(MAL_THEME_TAXONOMY);

const MAL_TAXONOMY_IDS: ReadonlyMap<string, number> = new Map(
  [...MAL_GENRE_TAXONOMY, ...MAL_THEME_TAXONOMY].map((entry) => [
    normalizeAnimeTag(entry.name),
    entry.id,
  ]),
);

export function findMalGenreId(tag: string): number | null {
  return MAL_TAXONOMY_IDS.get(normalizeAnimeTag(tag)) ?? null;
}

export interface MalGenreSplit<T> {
  readonly genres: readonly T[];
  readonly themes: readonly T[];
}

export function splitMalGenreArray<T extends { readonly id: number }>(
  values: readonly T[] | undefined,
): MalGenreSplit<T> {
  const genres: T[] = [];
  const themes: T[] = [];
  for (const value of values ?? []) {
    if (THEME_IDS.has(value.id)) themes.push(value);
    else genres.push(value);
  }
  return { genres, themes };
}
