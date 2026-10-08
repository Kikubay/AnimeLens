import type { Anime, AnimeListEntry, AnimeStatus } from '../../../domain/anime';
import type { UserProfile } from '../../../domain/user-profile';
import type { AnimeProvider, CandidatePoolConfig } from '../../anime-provider';
import { ApiError } from '../../api-errors';
import { defaultMockAnime, defaultMockProfile } from '../../mocks/mock-fixtures';

export class MockAnimeProvider implements AnimeProvider {
  readonly candidatePoolConfig: CandidatePoolConfig = {
    suggestionLimit: 50,
    rankingLimit: 100,
    rankingOffset: 0,
  };

  constructor(
    private readonly anime: readonly Anime[] = defaultMockAnime,
    private readonly user: UserProfile = defaultMockProfile,
  ) {}

  async getCurrentUser(): Promise<UserProfile> {
    return this.user;
  }

  async getUserAnimeList(): Promise<AnimeListEntry[]> {
    return this.anime.map((anime, index) => ({
      anime,
      status: index === 0 ? 'completed' : 'plan_to_watch',
      userScore: anime.userScore,
      episodesWatched: index === 0 ? (anime.episodeCount ?? 0) : 0,
      priority: null,
      isRewatching: false,
      updatedAt: null,
      notes: null,
    }));
  }

  async getAnimeSuggestions(limit?: number): Promise<Anime[]> {
    const safeLimit = Math.max(0, limit ?? this.anime.length);
    return this.anime.slice(0, safeLimit);
  }

  async getAnimeRanking(limit?: number, offset?: number): Promise<Anime[]> {
    const safeLimit = Math.max(0, limit ?? this.anime.length);
    const safeOffset = Math.max(0, offset ?? 0);
    return this.anime.slice(safeOffset, safeOffset + safeLimit);
  }

  async getAnime(id: number): Promise<Anime> {
    const anime = this.anime.find((item) => item.id === id);
    if (anime === undefined) {
      throw new ApiError(`Mock anime ${id} was not found.`, {
        code: 'not_found',
        status: 404,
      });
    }
    return anime;
  }

  async addToList(id: number, _status: AnimeStatus = 'plan_to_watch'): Promise<void> {
    if (!this.anime.some((item) => item.id === id)) {
      throw new ApiError(`Mock anime ${id} was not found.`, {
        code: 'not_found',
        status: 404,
      });
    }
  }

  async searchAnime(query: string): Promise<Anime[]> {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery.length === 0) return [];
    return this.anime.filter((anime) =>
      anime.title.default.toLocaleLowerCase().includes(normalizedQuery),
    );
  }
}
