import type { RecommendationFeedback } from '../domain/feedback';
import type { UserProfile } from '../domain/user-profile';
import type { UserPreferences } from '../domain/preferences';
import type { AnimeCache } from '../domain/sync';

export interface StoredSession {
  readonly accessToken: string;
  readonly expiresAt: number | null;
}

export type StoredAnimeData = AnimeCache;

/**
 * The measured half of a preference axis, as persisted between syncs.
 *
 * `positive` and `negative` only exist to rank the live list, so they are
 * dropped rather than stored on every snapshot.
 */
export interface StoredPreferenceItem {
  readonly name: string;
  readonly score: number;
  /** Entries backing this item. A score over one entry is not comparable. */
  readonly count: number;
}

/**
 * What the derived profile looked like at one point in time.
 *
 * `detectedPreferences` is deliberately absent: those sentences are already
 * localized, so storing them would make a language switch register as a change
 * in the user's taste.
 */
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
  /** Newest first. */
  readonly snapshots: readonly StoredProfileSnapshot[];
}

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
  /**
   * A short ring of derived-profile snapshots per provider, showing what moved
   * since the last sync. Keyed by provider so switching MAL <-> AniList cannot
   * diff two different lists against each other.
   */
  profileHistory?: Readonly<Record<string, StoredProfileHistory>>;
  updateCheck?: unknown;
}

export type StorageKey = keyof AnimeLensStorage;
