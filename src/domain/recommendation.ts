import type { Anime } from './anime';

export type RecommendationCategory =
  | 'top-match'
  | 'highly-compatible'
  | 'because-you-liked'
  | 'genre-discovery'
  | 'hidden-gem'
  | 'explore'
  | 'continue-watching';

export type RecommendationReasonKind =
  'genre' | 'theme' | 'format' | 'rating' | 'similarity' | 'discovery';

export interface RecommendationReason {
  readonly kind: RecommendationReasonKind;
  readonly label: string;
  readonly detail?: string | null;
  readonly weight: number;
}

export interface Recommendation {
  readonly id: string;
  readonly anime: Anime;
  readonly category: RecommendationCategory;
  readonly compatibilityScore: number;
  readonly reasons: readonly RecommendationReason[];
  readonly generatedAt: string;
}
