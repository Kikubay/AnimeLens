import type { Anime, AnimeProviderId } from '../domain/anime';
import { MAL_GENRE_NAMES, MAL_THEME_NAMES } from '../api/mal-taxonomy';
import { normalizeAnime as normalizeAniList } from '../api/providers/anilist/anilist-normalizer';

/** Shape of the committed JSON produced by `scripts/fetch-demo-data.mjs`. */
export interface DemoAnimeFixture {
  readonly id: number;
  readonly malId: number;
  readonly title: {
    readonly default: string;
    readonly english: string | null;
    readonly japanese: string | null;
  };
  readonly synopsis: string | null;
  readonly image: { readonly medium: string | null; readonly large: string | null };
  readonly averageScore: number | null;
  readonly meanScore: number | null;
  readonly listMembers: number | null;
  readonly genres: readonly string[];
  readonly tags: readonly { readonly id: number; readonly name: string }[];
  readonly format: string | null;
  readonly episodes: number | null;
  readonly season: string | null;
  readonly seasonYear: number | null;
  readonly status: string | null;
  readonly isAdult: boolean;
  readonly studios: readonly { readonly id: number; readonly name: string }[];
  readonly externalLinks: readonly {
    readonly site: string;
    readonly url: string;
    readonly type: string;
  }[];
}

export interface DemoFixture {
  readonly generatedAt: string;
  readonly source: string;
  readonly anime: readonly DemoAnimeFixture[];
}

/**
 * Ids only have to be stable and unique within a provider; every taste signal in the engine
 * keys on names. Deriving them from the exported MAL vocabulary keeps the MyAnimeList view
 * consistent without inventing ids that would look authoritative but be wrong.
 */
function genreId(name: string): number {
  const index = MAL_GENRE_NAMES.findIndex(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  return index >= 0 ? index + 1 : MAL_GENRE_NAMES.length + 1;
}

function themeId(name: string): number {
  const index = MAL_THEME_NAMES.findIndex(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  return index >= 0 ? index + 1000 : 9000;
}

/**
 * AniList tags and MAL themes describe the same ideas under different labels, so the MAL
 * view re-labels the ones it recognises. Every target is a real entry of `MAL_THEME_NAMES`;
 * a tag with no equivalent is simply dropped, which is exactly how MAL treats its own themes.
 */
const MAL_THEME_ALIASES: Readonly<Record<string, string>> = {
  'school life': 'School',
  superpowers: 'Super Power',
  'mahou shoujo': 'Mahou Shoujo',
  'boku no hero': 'Super Power',
  'non bipedal': 'Anthropomorphic',
};

/** The AniList view runs the real normalizer, so it stays honest to what the extension does. */
export function toAniListRecord(fixture: DemoAnimeFixture): Anime {
  return normalizeAniList({
    id: fixture.id,
    title: {
      romaji: fixture.title.default,
      english: fixture.title.english,
      native: fixture.title.japanese,
    },
    description: fixture.synopsis,
    coverImage: fixture.image,
    averageScore: fixture.averageScore,
    genres: [...fixture.genres],
    tags: fixture.tags.map((tag) => ({ id: tag.id, name: tag.name, rank: 100 })),
    format: fixture.format,
    episodes: fixture.episodes,
    season: fixture.season,
    seasonYear: fixture.seasonYear,
    status: fixture.status,
    popularity: fixture.listMembers,
    isAdult: fixture.isAdult,
    externalLinks: fixture.externalLinks.map((link) => ({
      site: link.site,
      url: link.url,
      type: link.type,
    })),
    studios: { nodes: [...fixture.studios] },
  });
}

/**
 * The MyAnimeList view is assembled from the same real titles, but with MAL's own id and its
 * genre/theme split so the dashboard exercises the same code path it does in the extension.
 */
export function toMalRecord(fixture: DemoAnimeFixture): Anime {
  const genres = fixture.genres.map((name) => ({ id: genreId(name), name }));
  const seenThemes = new Set<string>();
  const themes: { id: number; name: string }[] = [];
  for (const tag of fixture.tags) {
    const mapped =
      MAL_THEME_ALIASES[tag.name.toLowerCase()] ??
      MAL_THEME_NAMES.find((name) => name.toLowerCase() === tag.name.toLowerCase());
    if (mapped === undefined || seenThemes.has(mapped)) continue;
    seenThemes.add(mapped);
    themes.push({ id: themeId(mapped), name: mapped });
  }
  const mean =
    fixture.meanScore ?? (fixture.averageScore === null ? null : fixture.averageScore / 10);

  return {
    id: fixture.malId,
    provider: 'mal',
    title: {
      default: fixture.title.english ?? fixture.title.default,
      english: fixture.title.english,
      japanese: fixture.title.japanese,
      synonyms: [],
    },
    synopsis: fixture.synopsis,
    image: fixture.image,
    score: mean === null || mean < 0 || mean > 10 ? null : Math.round(mean * 100) / 100,
    userScore: null,
    genres,
    themes,
    studios: [...fixture.studios],
    staff: [],
    episodeCount: fixture.episodes,
    year: fixture.seasonYear,
    season: normalizeSeason(fixture.season),
    status: normalizeStatus(fixture.status),
    type: normalizeType(fixture.format),
    // MAL's rank is not published by AniList, and `memberCount` is what both consumers
    // prefer anyway, so the rank stays null rather than carrying a fabricated position.
    popularity: null,
    memberCount: fixture.listMembers,
    contentRating: fixture.isAdult ? 'explicit' : 'safe',
  };
}

function normalizeSeason(value: string | null): Anime['season'] {
  const seasons: Readonly<Record<string, Anime['season']>> = {
    WINTER: 'winter',
    SPRING: 'spring',
    SUMMER: 'summer',
    FALL: 'fall',
  };
  return value !== null && value in seasons ? seasons[value] : null;
}

function normalizeStatus(value: string | null): Anime['status'] {
  const statuses: Readonly<Record<string, Anime['status']>> = {
    RELEASING: 'currently_airing',
    FINISHED: 'finished_airing',
    NOT_YET_RELEASED: 'not_yet_aired',
    CANCELLED: 'unknown',
    HIATUS: 'unknown',
  };
  return value !== null && value in statuses ? statuses[value] : 'unknown';
}

function normalizeType(value: string | null): Anime['type'] {
  const types: Readonly<Record<string, Anime['type']>> = {
    TV: 'tv',
    MOVIE: 'movie',
    SPECIAL: 'special',
    OVA: 'ova',
    ONA: 'ona',
    MUSIC: 'music',
  };
  return value !== null && value in types ? types[value] : 'unknown';
}

export function buildRecord(fixture: DemoAnimeFixture, provider: AnimeProviderId): Anime {
  return provider === 'anilist' ? toAniListRecord(fixture) : toMalRecord(fixture);
}
