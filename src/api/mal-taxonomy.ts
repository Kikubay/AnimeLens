// MAL's API has no `themes` field — it folds everything into `genres` — so we split by ID against the taxonomy on its browse page (extracted September 2026). Taste scoring and recommendation reasons both depend on that distinction.

// Browse-page "Themes" IDs; core genres, demographics and explicit genres all stay in `genres`.
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

// Unrecognised IDs (themes MAL adds later) land in `genres` so we never silently drop a signal.
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
