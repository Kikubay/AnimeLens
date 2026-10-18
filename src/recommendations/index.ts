export {
  buildUserPreferenceProfile,
  extractFeatures,
  featurePreferenceScore,
  generateRecommendations,
  scoreRecommendation,
} from './recommendation-engine';
export { buildTasteClusters, TASTE_MIN_FEATURE_SCORE } from './taste-clusters';
export type { TasteClusters } from './taste-clusters';
export {
  fitRatingModel,
  predictUserRating,
  RATING_MODEL_MAX_SLOPE,
  RATING_MODEL_MIN_SAMPLES,
  RATING_MODEL_MIN_SLOPE,
  RATING_SCALE_MAX,
  RATING_SCALE_MIN,
} from './rating-model';
export type { RatingModel, RatingSample } from './rating-model';
export { tasteRecencyWeight, TASTE_DECAY_HALF_LIFE_MS } from './taste-decay';
export type {
  DashboardRecommendationSnapshot,
  RecommendationMessage,
  RecommendationMessageResponse,
  RecommendationSection,
  RecommendationSectionId,
} from './recommendation-messages';
export {
  isRecommendationMessage,
  requestDashboardRecommendations,
} from './recommendation-messages';
export type {
  FeaturePreference,
  FeaturePreferenceMap,
  FeatureVector,
  RecommendationDiscoveryPreferences,
  RecommendationGenerationOptions,
  RecommendationInput,
  RecommendationProfile,
  RecommendationScore,
  RecommendationWeights,
} from './recommendation-types';
