import type { Anime, AnimeListEntry, AnimeStatus, AnimeType } from '../domain/anime';
import type { StreamingLink } from '../domain/streaming';
import type { UserProfile } from '../domain/user-profile';

export interface AnimeListFetchProgress {
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

  getAnimeRanking?(limit?: number, offset?: number): Promise<Anime[]>;
  readonly candidatePoolConfig?: CandidatePoolConfig;
  searchAnime(query: string, request?: AnimeSearchRequest): Promise<AnimeSearchPage>;
  addToList(id: number, status?: AnimeStatus): Promise<void>;

  getStreamingLinks?(id: number): Promise<readonly StreamingLink[]>;
}

export const EMPTY_SEARCH_PAGE: AnimeSearchPage = { results: [], hasMore: false };

export type User = UserProfile;
