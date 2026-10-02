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
  /**
   * Where the title can be watched, for the detail page's "Where to watch" card.
   *
   * Optional because not every provider has a source for it: MyAnimeList's API
   * publishes no streaming-links field, so its implementation reads the anime
   * page instead. Returns an empty list when nothing is known, and must never
   * throw — the card is an enhancement, not a hard dependency.
   */
  getStreamingLinks?(id: number): Promise<readonly StreamingLink[]>;
}

/** Domain-level alias kept for integrations that call a profile a user. */
export type User = UserProfile;
