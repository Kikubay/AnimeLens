import type { Anime, AnimeListEntry, AnimeSeason, AnimeType } from '../domain/anime';
import type { RecommendationFeedback } from '../domain/feedback';
import type { RecommendationCategory, RecommendationReason } from '../domain/recommendation';
import type { Language } from '../i18n';

export interface FeatureVector {
  readonly genres: readonly string[];
  readonly themes: readonly string[];
  readonly studios: readonly string[];
  readonly staff: readonly string[];
  readonly type: AnimeType;
  readonly year: number | null;
  readonly season: AnimeSeason | null;
  readonly popularity: number | null;
  readonly score: number | null;
}

export interface FeaturePreference {
  readonly positive: number;
  readonly negative: number;
  readonly count: number;
}

export type FeaturePreferenceMap = ReadonlyMap<string, FeaturePreference>;

export interface RecommendationProfile {
  readonly genres: FeaturePreferenceMap;
  readonly themes: FeaturePreferenceMap;
  readonly studios: FeaturePreferenceMap;
  readonly staff: FeaturePreferenceMap;
  readonly types: ReadonlyMap<AnimeType, FeaturePreference>;
  readonly seasons: ReadonlyMap<AnimeSeason, FeaturePreference>;
  readonly years: ReadonlyMap<number, FeaturePreference>;
  readonly averageScore: number | null;
  readonly ratedAnimeCount: number;
  readonly sourceAnimeCount: number;
  readonly feedbackCount: number;
}

export interface RecommendationWeights {
  readonly genres: number;
  readonly themes: number;
  readonly studios: number;
  readonly staff: number;
  readonly type: number;
  readonly season: number;
  readonly year: number;
  readonly quality: number;
  readonly popularity: number;
}

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  genres: 0.28,
  themes: 0.16,
  studios: 0.1,
  staff: 0.1,
  type: 0.08,
  season: 0.04,
  year: 0.05,
  quality: 0.12,
  popularity: 0.07,
};

export interface RecommendationScore {
  readonly value: number;
  readonly normalized: number;
  readonly confidence: number;
  readonly featureScores: Readonly<Record<string, number>>;
  readonly reasons: readonly RecommendationReason[];
}

export interface RecommendationDiscoveryPreferences {
  readonly recommendationMode: 'personalized' | 'exploratory';
  readonly includeHiddenGems: boolean;
  readonly includeOlderAnime: boolean;
  readonly includeMovies: boolean;
  readonly includeShortSeries: boolean;
  readonly preferredGenres: readonly string[];
  readonly excludedGenres: readonly string[];
  readonly excludedThemes: readonly string[];
  readonly preferredFormats: readonly AnimeType[];
  readonly preferredSeasons: readonly AnimeSeason[];
  readonly contentRating: 'safe' | 'questionable' | 'explicit';
  readonly showCompletedAnime: boolean;
  readonly minimumCompatibilityScore: number;
}

export interface RecommendationGenerationOptions {
  readonly limit?: number;
  readonly weights?: Partial<RecommendationWeights>;
  readonly discovery?: Partial<RecommendationDiscoveryPreferences>;
  readonly nowYear?: number;
  readonly rejectedGenres?: readonly string[];
  readonly rejectedAnimeIds?: readonly number[];
  readonly excludedAnimeIds?: readonly number[];
  readonly generatedAt?: string;
  readonly now?: string;
  /** Language used for user-facing reason labels. Defaults to English. */
  readonly language?: Language;
}

export interface RecommendationInput {
  readonly watched: readonly AnimeListEntry[];
  readonly candidates: readonly Anime[];
  readonly rejectedAnimeIds?: readonly number[];
  readonly rejectedGenres?: readonly string[];
  readonly feedback?: readonly RecommendationFeedback[];
}

export interface ScoredCandidate {
  readonly anime: Anime;
  readonly score: RecommendationScore;
  readonly category: RecommendationCategory;
}
