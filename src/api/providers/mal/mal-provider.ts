import type { Anime, AnimeListEntry, AnimeStatus } from '../../../domain/anime';
import type { StreamingLink } from '../../../domain/streaming';
import type { UserProfile } from '../../../domain/user-profile';
import { ApiError } from '../../api-errors';
import type { AnimeListFetchOptions, AnimeProvider } from '../../anime-provider';
import type { HttpClient } from '../../http-client';
import { MAL_API_BASE_URL, MAL_FIELDS, MAL_LIMITS, MAL_LIST_FIELDS } from './mal-config';
import {
  isMalAnimeDto,
  isMalAnimeNodeDto,
  isMalUserDto,
  normalizeAnime,
  normalizeAnimeListEntry,
  normalizeUserProfile,
} from '../../mal-normalizer';
import type { MalAnimeDto, MalAnimeListResponse, MalUserDto } from '../../mal-types';
import { fetchMalStreamingPlatforms } from './mal-streaming';

const MAX_PAGES = 100;

export class MalAnimeProvider implements AnimeProvider {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly accessToken: string,
    private readonly baseUrl: string = MAL_API_BASE_URL,
  ) {}

  async getCurrentUser(): Promise<UserProfile> {
    const response = await this.request<MalUserDto>('/users/@me');
    if (!isMalUserDto(response)) throw invalidResponse('user');
    return normalizeUserProfile(response);
  }

  async getUserAnimeList(options: AnimeListFetchOptions = {}): Promise<AnimeListEntry[]> {
    const entries: AnimeListEntry[] = [];
    let nextUrl: string | null = this.buildUrl('/users/@me/animelist', {
      fields: MAL_LIST_FIELDS,
      limit: String(MAL_LIMITS.userAnimeList),
    });
    const visitedUrls = new Set<string>();

    for (let page = 0; nextUrl !== null; page += 1) {
      if (page >= MAX_PAGES || visitedUrls.has(nextUrl)) {
        throw new ApiError('The API pagination sequence is invalid.', { code: 'invalid_response' });
      }
      visitedUrls.add(nextUrl);
      const response: MalAnimeListResponse = await this.request<MalAnimeListResponse>(nextUrl);
      if (!isMalListResponse(response) || !response.data.every(isMalAnimeNodeDto)) {
        throw invalidResponse('anime list');
      }
      entries.push(...response.data.map(normalizeAnimeListEntry));
      nextUrl = response.paging?.next ?? null;
      options.onProgress?.({
        page: page + 1,
        itemsFetched: entries.length,
        nextPageUrl: nextUrl,
      });
    }

    return entries;
  }

  async getAnimeSuggestions(limit: number = 50): Promise<Anime[]> {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), MAL_LIMITS.animeSearch));
    const response = await this.request<MalAnimeListResponse>('/anime/suggestions', {
      fields: MAL_FIELDS,
      limit: String(safeLimit),
    });
    if (!isMalListResponse(response) || !response.data.every(isMalAnimeNodeDto)) {
      throw invalidResponse('anime suggestions');
    }
    return response.data.map((item) => normalizeAnime(item.node));
  }

  async getAnimeRanking(
    limit: number = MAL_LIMITS.animeRanking,
    offset: number = 0,
  ): Promise<Anime[]> {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), MAL_LIMITS.animeRanking));
    const response = await this.request<MalAnimeListResponse>('/anime/ranking', {
      ranking_type: 'all',
      fields: MAL_FIELDS,
      limit: String(safeLimit),
      ...(offset > 0 ? { offset: String(Math.max(0, Math.floor(offset))) } : {}),
    });
    if (!isMalListResponse(response) || !response.data.every(isMalAnimeNodeDto)) {
      throw invalidResponse('anime ranking');
    }
    return response.data.map((item) => normalizeAnime(item.node));
  }

  async getAnime(id: number): Promise<Anime> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError('Anime ID must be a positive integer.', { code: 'bad_request' });
    }
    const response = await this.request<MalAnimeDto>(`/anime/${id}`, { fields: MAL_FIELDS });
    if (!isMalAnimeDto(response)) throw invalidResponse('anime');
    return normalizeAnime(response);
  }

  async addToList(id: number, status: AnimeStatus = 'plan_to_watch'): Promise<void> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError('Anime ID must be a positive integer.', { code: 'bad_request' });
    }
    const allowedStatuses: readonly AnimeStatus[] = [
      'watching',
      'completed',
      'on_hold',
      'dropped',
      'plan_to_watch',
      'rewatching',
    ];
    if (!allowedStatuses.includes(status)) {
      throw new ApiError('Anime list status is invalid.', { code: 'bad_request' });
    }
    await this.requestListStatus(id, status);
  }

  /**
   * Streaming platforms for the "Where to watch" card.
   *
   * MAL's API has no such field, so this reads the anime's web page. It is
   * deliberately the only MAL call that touches the website, and it sends no
   * cookies and no API token.
   */
  async getStreamingLinks(id: number): Promise<readonly StreamingLink[]> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError('Anime ID must be a positive integer.', { code: 'bad_request' });
    }
    return fetchMalStreamingPlatforms(id);
  }

  async searchAnime(query: string): Promise<Anime[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) return [];
    const response = await this.request<{
      readonly data: readonly { readonly node: MalAnimeDto }[];
    }>('/anime', { q: normalizedQuery, limit: String(MAL_LIMITS.animeSearch), fields: MAL_FIELDS });
    if (!isMalListResponse(response) || !response.data.every(isMalAnimeNodeDto)) {
      throw invalidResponse('anime search');
    }
    return response.data.map((item) => normalizeAnime(item.node));
  }

  private async requestListStatus(id: number, status: AnimeStatus): Promise<void> {
    const url = this.buildUrl(`/anime/${id}/my_list_status`);
    await this.httpClient.patch<unknown>(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: new URLSearchParams({ status }).toString(),
    });
  }

  private async request<T>(
    pathOrUrl: string,
    query?: Readonly<Record<string, string>>,
  ): Promise<T> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : this.buildUrl(pathOrUrl, query);
    const response = await this.httpClient.get<T>(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    return response.data;
  }

  private buildUrl(path: string, query?: Readonly<Record<string, string>>): string {
    const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(normalizedPath, baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    return url.toString();
  }
}

function invalidResponse(resource: string): ApiError {
  return new ApiError(`The MAL ${resource} response is incomplete or invalid.`, {
    code: 'invalid_response',
  });
}

function isMalListResponse(value: unknown): value is MalAnimeListResponse {
  if (!isRecord(value) || !Array.isArray(value.data)) return false;
  const paging = value.paging;
  if (paging === undefined) return true;
  if (!isRecord(paging)) return false;
  return ['previous', 'next'].every((key) => {
    const pagingValue = paging[key];
    return pagingValue === undefined || typeof pagingValue === 'string';
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
