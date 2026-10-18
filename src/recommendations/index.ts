export {
  buildUserPreferenceProfile,
  extractFeatures,
  featurePreferenceScore,
  generateRecommendations,
  scoreRecommendation,
} from './recommendation-engine';
export { buildTasteClusters, TASTE_MIN_FEATURE_SCORE } from './taste-clusters';
export type { TasteClusters } from './taste-clusters';
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
