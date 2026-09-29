import type { RecommendationFeedback } from '../domain/feedback';
import type { AnimeListEntry } from '../domain/anime';
import type { Recommendation } from '../domain/recommendation';
import type { UserProfile } from '../domain/user-profile';
import type { SyncStatus } from '../domain/sync';

export interface AppState {
  readonly profile?: UserProfile;
  readonly animeList: readonly AnimeListEntry[];
  readonly recommendations: readonly Recommendation[];
  readonly feedback: readonly RecommendationFeedback[];
  readonly syncStatus: SyncStatus;
  readonly errorMessage?: string;
  readonly isOnline: boolean;
}
