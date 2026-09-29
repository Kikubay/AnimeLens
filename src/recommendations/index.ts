export {
  buildUserPreferenceProfile,
  extractFeatures,
  generateRecommendations,
  learnUserPreferences,
  scoreAnime,
  scoreRecommendation,
} from './recommendation-engine';
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
