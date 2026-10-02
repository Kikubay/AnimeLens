import type { StreamingLink } from './streaming';

export type AnimeId = number;

/** Provider an anime record originated from (for deep links and labels). */
export type AnimeProviderId = 'mal' | 'anilist';

export type AnimeContentRating = 'safe' | 'questionable' | 'explicit';

export type AnimeStatus =
  'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch' | 'rewatching';

export type AnimeAiringStatus =
  'currently_airing' | 'finished_airing' | 'not_yet_aired' | 'unknown';

export type AnimeType = 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'music' | 'unknown';
/** Backwards-compatible alias for consumers that used the earlier name. */
export type AnimeFormat = AnimeType;

export type AnimeSeason = 'winter' | 'spring' | 'summer' | 'fall';

export interface AnimeTitleSet {
  readonly default: string;
  readonly english: string | null;
  readonly japanese: string | null;
  readonly synonyms: readonly string[];
}

export interface AnimeImageSet {
  readonly medium: string | null;
  readonly large: string | null;
}

/**
 * Provider-neutral identifiers: `id` is the anime's ID within the provider the
 * entry came from (MyAnimeList, AniList, ...). IDs are never compared across
 * providers — the active provider scopes every lookup.
 */
export interface Genre {
  readonly id: number;
  readonly name: string;
}

export interface Theme {
  readonly id: number;
  readonly name: string;
}

export interface Studio {
  readonly id: number;
  readonly name: string;
}

export interface StaffMember {
  readonly id: number;
  readonly name: string;
  readonly positions: readonly string[];
  readonly imageUrl: string | null;
}

export interface Anime {
  /** The anime's ID within its originating provider (formerly `malId`). */
  readonly id: AnimeId;
  /** Which provider this record came from; absent in legacy cached data. */
  readonly provider?: AnimeProviderId;
  readonly title: AnimeTitleSet;
  readonly synopsis: string | null;
  readonly image: AnimeImageSet | null;
  /** The provider's community score (formerly `malScore`). */
  readonly score: number | null;
  readonly userScore: number | null;
  readonly genres: readonly Genre[];
  readonly themes: readonly Theme[];
  readonly studios: readonly Studio[];
  readonly staff: readonly StaffMember[];
  readonly episodeCount: number | null;
  readonly year: number | null;
  readonly season: AnimeSeason | null;
  readonly status: AnimeAiringStatus;
  readonly type: AnimeType;
  readonly popularity: number | null;
  readonly memberCount: number | null;
  readonly contentRating?: AnimeContentRating;
  /**
   * `undefined` means nobody asked yet — cached entries from older builds have no
   * such key. An empty array means the provider answered and found nothing, which
   * is a different answer.
   */
  readonly streamingSites?: readonly StreamingLink[];
}

export interface AnimeListEntry {
  readonly anime: Anime;
  readonly status: AnimeStatus;
  readonly userScore: number | null;
  readonly episodesWatched: number;
  readonly priority: number | null;
  readonly isRewatching: boolean;
  readonly updatedAt: string | null;
  readonly notes: string | null;
}
