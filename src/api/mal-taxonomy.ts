/**
 * MyAnimeList folds genres, themes, demographics and explicit genres into the
 * single `genres` array of its API responses — there is no `themes` field
 * (requests for it are silently ignored). The website, however, maintains
 * separate taxonomies under the shared `/anime/genre/{id}` ID namespace.
 *
 * These ID sets were extracted from the official browse page
 * (myanimelist.net/anime.php, section filters "Genres", "Explicit Genres",
 * "Themes", "Demographics") in September 2026. Splitting by ID restores the
 * real distinction, which the profile ("Thèmes favoris"), the taste scoring
 * and the recommendation reasons all rely on.
 */

/** Themes ("Themes" filter on the browse page) — returned by the API inside `genres`. All other IDs (core genres, demographics Kids/Shoujo/Shounen/Seinen/Josei, explicit genres) stay in `genres`. */
const THEME_IDS: ReadonlySet<number> = new Set([
  3, // Racing
  6, // Mythology
  11, // Strategy Game
  13, // Historical
  17, // Martial Arts
  18, // Mecha
  19, // Music
  20, // Parody
  21, // Samurai
  23, // School
  29, // Space
  31, // Super Power
  32, // Vampire
  35, // Harem
  38, // Military
  39, // Detective
  40, // Psychological
  50, // Adult Cast
  51, // Anthropomorphic
  52, // CGDCT
  53, // Childcare
  54, // Combat Sports
  55, // Delinquents
  56, // Educational
  57, // Gag Humor
  58, // Gore
  59, // High Stakes Game
  60, // Idols (Female)
  61, // Idols (Male)
  62, // Isekai
  63, // Iyashikei
  64, // Love Polygon
  65, // Magical Sex Shift
  66, // Mahou Shoujo
  67, // Medical
  68, // Organized Crime
  69, // Otaku Culture
  70, // Performing Arts
  71, // Pets
  72, // Reincarnation
  73, // Reverse Harem
  74, // Love Status Quo
  75, // Showbiz
  76, // Survival
  77, // Team Sports
  78, // Time Travel
  79, // Video Game
  80, // Visual Arts
  81, // Crossdressing
  82, // Urban Fantasy
  83, // Villainess
]);

export const MAL_GENRE_NAMES: readonly string[] = [
  'Action',
  'Adventure',
  'Avant Garde',
  'Award Winning',
  'Boys Love',
  'Comedy',
  'Drama',
  'Ecchi',
  'Erotica',
  'Fantasy',
  'Girls Love',
  'Gourmet',
  'Hentai',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Sports',
  'Supernatural',
  'Suspense',
  'Thriller',
];

export const MAL_THEME_NAMES: readonly string[] = [
  'Adult Cast',
  'Anthropomorphic',
  'CGDCT',
  'Childcare',
  'Combat Sports',
  'Crossdressing',
  'Delinquents',
  'Detective',
  'Educational',
  'Gag Humor',
  'Gore',
  'Harem',
  'High Stakes Game',
  'Historical',
  'Idols (Female)',
  'Idols (Male)',
  'Isekai',
  'Iyashikei',
  'Love Polygon',
  'Love Status Quo',
  'Magical Sex Shift',
  'Mahou Shoujo',
  'Martial Arts',
  'Medical',
  'Mecha',
  'Military',
  'Music',
  'Mythology',
  'Organized Crime',
  'Otaku Culture',
  'Parody',
  'Performing Arts',
  'Pets',
  'Psychological',
  'Racing',
  'Reincarnation',
  'Reverse Harem',
  'Samurai',
  'School',
  'Showbiz',
  'Space',
  'Strategy Game',
  'Super Power',
  'Survival',
  'Team Sports',
  'Time Travel',
  'Urban Fantasy',
  'Vampire',
  'Video Game',
  'Villainess',
  'Visual Arts',
];

export interface MalGenreSplit<T> {
  readonly genres: readonly T[];
  readonly themes: readonly T[];
}

/**
 * Partitions a flat MAL `genres` array into true genres and themes. Items with
 * unknown IDs (future additions) are conservatively kept as genres so no
 * signal is ever dropped. The result preserves input order within each bucket.
 */
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
