import type { Anime, AnimeListEntry, AnimeStatus, AnimeType } from '../domain/anime';
import type { StreamingLink } from '../domain/streaming';
import type { UserProfile } from '../domain/user-profile';
import type { RecommendationPeriod } from '../domain/recommendation-period';

interface AnimeListFetchProgress {
  readonly page: number;
  readonly itemsFetched: number;
  readonly nextPageUrl: string | null;
}

export interface AnimeListFetchOptions {
  readonly onProgress?: (progress: AnimeListFetchProgress) => void;
}

export interface CandidatePoolConfig {
  readonly suggestionLimit: number;
  readonly rankingLimit: number;
  readonly rankingOffset: number;
  /** Omit to skip the taste-derived slice entirely. */
  readonly tasteLimit?: number;
  /** How many ranking slices to walk. */
  readonly rankingSlices?: number;
  /** How far apart two ranking slices sit in the provider's own ranking. */
  readonly rankingStride?: number;
}

export interface AnimeSearchRequest {
  readonly limit?: number;
  readonly offset?: number;

  readonly tags?: readonly string[] | null;

  readonly formats?: readonly AnimeType[];
}

export interface AnimeSearchPage {
  readonly results: readonly Anime[];
  readonly hasMore: boolean;
}

export interface AnimeProvider {
  getCurrentUser(): Promise<UserProfile>;
  getUserAnimeList(options?: AnimeListFetchOptions): Promise<AnimeListEntry[]>;
  getAnime(id: number): Promise<Anime>;

  getAnimeSuggestions?(limit?: number): Promise<Anime[]>;

  /**
   * The period is the user's recommendation window. A provider that can filter on it must, so the
   * pool holds titles the window still allows instead of titles the engine has to throw away.
   */
  getAnimeRanking?(
    limit?: number,
    offset?: number,
    period?: RecommendationPeriod,
  ): Promise<Anime[]>;

  /**
   * Catalogue-native tag filter, the only way to reach candidates the global ranking slice never will. A provider
   * without one must omit this: emulating it by paging the same global list would defeat the point.
   */
  getAnimeByTags?(
    tags: readonly string[],
    limit?: number,
    period?: RecommendationPeriod,
  ): Promise<readonly Anime[]>;

  readonly candidatePoolConfig?: CandidatePoolConfig;
  searchAnime(query: string, request?: AnimeSearchRequest): Promise<AnimeSearchPage>;
  addToList(id: number, status?: AnimeStatus): Promise<void>;

  getStreamingLinks?(id: number): Promise<readonly StreamingLink[]>;
}

export const EMPTY_SEARCH_PAGE: AnimeSearchPage = { results: [], hasMore: false };
