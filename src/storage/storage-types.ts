import type { RecommendationFeedback } from '../domain/feedback';
import type { UserProfile } from '../domain/user-profile';
import type { UserPreferences } from '../domain/preferences';
import type { AnimeCache } from '../domain/sync';

export interface StoredSession {
  readonly accessToken: string;
  readonly expiresAt: number | null;
}

export type StoredAnimeData = AnimeCache;

// `positive` and `negative` only exist to rank the live list, so they aren't stored on every snapshot.
export interface StoredPreferenceItem {
  readonly name: string;
  readonly score: number;
  /** Entries backing this item. A score over one entry is not comparable. */
  readonly count: number;
}

// `detectedPreferences` is deliberately absent: those sentences are already localized, so storing them would make a language switch look like a change in taste.
export interface StoredProfileSnapshot {
  /** Bumped when this shape changes; a mismatch discards the history. */
  readonly version: number;
  readonly capturedAt: string;
  readonly providerId: string;
  readonly analyzedAnimeCount: number;
  readonly ratedAnimeCount: number;
  readonly averageScore: number | null;
  readonly genres: readonly StoredPreferenceItem[];
  readonly themes: readonly StoredPreferenceItem[];
  readonly studios: readonly StoredPreferenceItem[];
}

export interface StoredProfileHistory {
  readonly snapshots: readonly StoredProfileSnapshot[];
}

export interface AnimeLensStorage {
  session?: StoredSession;
  profile?: UserProfile;
  /** Legacy, always MAL. */
  animeData?: StoredAnimeData;
  'animeData:mal'?: StoredAnimeData;
  'animeData:anilist'?: StoredAnimeData;
  feedback?: readonly RecommendationFeedback[];
  preferences?: UserPreferences;
  malClientId?: string;
  anilistClientId?: string;
  activeProvider?: string;
  /** Only meaningful next to `manual_top_3_pool_signature`; a mismatch discards it. */
  manual_top_3_ranking?: readonly number[];
  manual_top_3_pool_signature?: string;
  /** Keyed by provider so switching MAL <-> AniList can't diff two different lists. */
  profileHistory?: Readonly<Record<string, StoredProfileHistory>>;
  updateCheck?: unknown;
}

export type StorageKey = keyof AnimeLensStorage;
