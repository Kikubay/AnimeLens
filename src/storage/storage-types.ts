import type { RecommendationFeedback } from '../domain/feedback';
import type { UserProfile } from '../domain/user-profile';
import type { UserPreferences } from '../domain/preferences';
import type { AnimeCache } from '../domain/sync';

export interface StoredSession {
  readonly accessToken: string;
  readonly expiresAt: number | null;
}

export type StoredAnimeData = AnimeCache;

export interface AnimeLensStorage {
  session?: StoredSession;
  profile?: UserProfile;
  /** Legacy pre-multi-provider cache key (MAL data only). */
  animeData?: StoredAnimeData;
  /** Per-provider cache keys (`animeData:mal`, `animeData:anilist`). */
  'animeData:mal'?: StoredAnimeData;
  'animeData:anilist'?: StoredAnimeData;
  feedback?: readonly RecommendationFeedback[];
  preferences?: UserPreferences;
  malClientId?: string;
  anilistClientId?: string;
  /** Which provider receives sync/recommendation traffic ('mal'|'anilist'). */
  activeProvider?: string;
  /**
   * Anime ids the user hand-picked to break a tie in the taste card Top 3.
   * Only meaningful together with `manual_top_3_pool_signature`; a mismatch
   * means the list moved on and the ranking is discarded.
   */
  manual_top_3_ranking?: readonly number[];
  manual_top_3_pool_signature?: string;
  updateCheck?: unknown;
}

export type StorageKey = keyof AnimeLensStorage;
