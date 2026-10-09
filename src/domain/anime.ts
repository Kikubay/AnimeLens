import type { StreamingLink } from './streaming';

export type AnimeId = number;

export type AnimeProviderId = 'mal' | 'anilist';

export type AnimeContentRating = 'safe' | 'questionable' | 'explicit';

export type AnimeStatus =
  'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch' | 'rewatching';

export type AnimeAiringStatus =
  'currently_airing' | 'finished_airing' | 'not_yet_aired' | 'unknown';

export type AnimeType = 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'music' | 'unknown';
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

// An `id` only means anything inside its own provider, so these are never compared across providers.
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
  /** ID within its originating provider (used to be `malId`). */
  readonly id: AnimeId;
  /** Absent in records cached before the multi-provider split. */
  readonly provider?: AnimeProviderId;
  readonly title: AnimeTitleSet;
  readonly synopsis: string | null;
  readonly image: AnimeImageSet | null;
  /** Community score (used to be `malScore`). */
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
  /** Rank position where 1 is the most popular title, not a count. MAL exposes this; AniList has no rank. */
  readonly popularity: number | null;
  readonly memberCount: number | null;
  readonly contentRating?: AnimeContentRating;
  // `undefined` = never asked (older cache entries lack the key); `[]` = the provider answered with nothing.
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
