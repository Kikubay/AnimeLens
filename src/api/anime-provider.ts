import type { Anime, AnimeListEntry, AnimeStatus } from '../domain/anime';
import type { UserProfile } from '../domain/user-profile';

export interface AnimeListFetchProgress {
  readonly page: number;
  readonly itemsFetched: number;
  readonly nextPageUrl: string | null;
}

export interface AnimeListFetchOptions {
  readonly onProgress?: (progress: AnimeListFetchProgress) => void;
}

/** Provider-neutral contract consumed by application services and UI adapters. */
export interface AnimeProvider {
  getCurrentUser(): Promise<UserProfile>;
  getUserAnimeList(options?: AnimeListFetchOptions): Promise<AnimeListEntry[]>;
  getAnime(id: number): Promise<Anime>;
  /**
   * Provider-personalized suggestions for the authorized user (MAL's
   * `/anime/suggestions`). Used to widen the recommendation candidate pool
   * when the user's plan-to-watch list alone is too small.
   */
  getAnimeSuggestions?(limit?: number): Promise<Anime[]>;
  /**
   * Popular anime used as a non-personalized fallback when MAL has too few
   * personalized suggestions for the user. `offset` pages deep into the
   * ranking: far pages surface quality titles with a small audience, which
   * feed the Hidden Gems and Explore sections.
   */
  getAnimeRanking?(limit?: number, offset?: number): Promise<Anime[]>;
  searchAnime(query: string): Promise<Anime[]>;
  addToList(id: number, status?: AnimeStatus): Promise<void>;
}

/** Domain-level alias kept for integrations that call a profile a user. */
export type User = UserProfile;
