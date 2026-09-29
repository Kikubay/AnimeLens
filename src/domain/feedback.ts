import type { Anime, AnimeId, AnimeSeason, AnimeType } from './anime';

export type FeedbackValue = 'like' | 'dislike' | 'seen' | 'not_now';

export type RecommendationFeedbackAction = FeedbackValue;

export type DislikeReasonKind = 'genre' | 'theme' | 'general';

export interface DislikeReason {
  readonly kind: DislikeReasonKind;
  readonly name?: string;
}

export interface FeedbackFeatureSnapshot {
  readonly genres: readonly string[];
  readonly themes: readonly string[];
  readonly studios: readonly string[];
  readonly staff: readonly string[];
  readonly type: AnimeType;
  readonly season: AnimeSeason | null;
  readonly year: number | null;
}

export interface RecommendationFeedback {
  readonly recommendationId: string;
  /** Stored as `animeMalId` for storage-compatibility with existing data. */
  readonly animeMalId: AnimeId;
  readonly value: FeedbackValue;
  readonly createdAt: string;
  readonly features?: FeedbackFeatureSnapshot;
  readonly reasons?: readonly DislikeReason[];
  readonly expiresAt?: string | null;
}

export function createFeedback(
  recommendationId: string,
  anime: Anime,
  value: FeedbackValue,
  createdAt: string,
  options: {
    readonly expiresAt?: string | null;
    readonly reasons?: readonly DislikeReason[];
  } = {},
): RecommendationFeedback {
  return {
    recommendationId,
    animeMalId: anime.id,
    value,
    createdAt,
    expiresAt: options.expiresAt ?? null,
    reasons: options.reasons,
    features: {
      genres: anime.genres.map((item) => item.name),
      themes: anime.themes.map((item) => item.name),
      studios: anime.studios.map((item) => item.name),
      staff: anime.staff.map((item) => item.name),
      type: anime.type,
      season: anime.season,
      year: anime.year,
    },
  };
}

/** Backwards-compatible alias for the original storage contract. */
export type AnimeFeedback = RecommendationFeedback;
