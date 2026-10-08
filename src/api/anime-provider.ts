import type { Anime, AnimeListEntry, AnimeStatus } from '../domain/anime';
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

/** Where a provider's discovery endpoints should be sampled. */
export interface CandidatePoolConfig {
  readonly suggestionLimit: number;
  readonly rankingLimit: number;
  readonly rankingOffset: number;
}

export interface AnimeProvider {
  getCurrentUser(): Promise<UserProfile>;
  getUserAnimeList(options?: AnimeListFetchOptions): Promise<AnimeListEntry[]>;
  getAnime(id: number): Promise<Anime>;
  // Widen the candidate pool when plan-to-watch alone is too small.
  getAnimeSuggestions?(limit?: number): Promise<Anime[]>;
  // Paging deep into the popularity ranking surfaces lesser-known quality titles, which is what feeds Hidden Gems and Explore.
  getAnimeRanking?(limit?: number, offset?: number): Promise<Anime[]>;
  readonly candidatePoolConfig?: CandidatePoolConfig;
  searchAnime(query: string): Promise<Anime[]>;
  addToList(id: number, status?: AnimeStatus): Promise<void>;
  // Returns [] instead of throwing when it can't answer, otherwise a failed card would take the whole detail page down.
  getStreamingLinks?(id: number): Promise<readonly StreamingLink[]>;
}

/** Domain-level alias kept for integrations that call a profile a user. */
export type User = UserProfile;
