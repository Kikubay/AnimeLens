import type { Anime, AnimeListEntry, AnimeStatus, AnimeType } from '../../../domain/anime';
import type { StreamingLink } from '../../../domain/streaming';
import type { UserProfile } from '../../../domain/user-profile';
import type { RecommendationPeriod } from '../../../domain/recommendation-period';
import { ApiError } from '../../api-errors';
import type {
  AnimeListFetchOptions,
  AnimeProvider,
  AnimeSearchPage,
  AnimeSearchRequest,
  CandidatePoolConfig,
} from '../../anime-provider';
import { EMPTY_SEARCH_PAGE } from '../../anime-provider';
import {
  animeMatchesTags,
  filterAnimeByFormats,
  normalizeAnimeTag,
} from '../../anime-search-query';
import type { HttpClient } from '../../http-client';
import {
  MAL_API_BASE_URL,
  MAL_FIELDS,
  MAL_LIMITS,
  MAL_LIST_FIELDS,
  MAL_TAG_SEARCH_FIELDS,
} from './mal-config';
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

const MAL_TAG_SEARCH_MAX_PAGES = 4;

const MAL_TAG_SEARCH_FORMAT_MAX_PAGES = 10;

const MAL_POOL_SCAN_PAGES = 3;

export class MalAnimeProvider implements AnimeProvider {
  readonly candidatePoolConfig: CandidatePoolConfig = {
    suggestionLimit: 50,
    rankingLimit: 100,
    rankingOffset: 2000,
    tasteLimit: 100,
    rankingSlices: 3,
    rankingStride: 2000,
  };

  private popularityScan: Promise<readonly Anime[]> | null = null;

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
    period?: RecommendationPeriod,
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
    const ranked = response.data.map((item) => normalizeAnime(item.node));
    return withinPeriod(ranked, period);
  }

  async getAnimeByTags(
    tags: readonly string[],
    limit: number = 50,
    period?: RecommendationPeriod,
  ): Promise<readonly Anime[]> {
    const cleaned = tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
    if (cleaned.length === 0) return [];
    const safeLimit = Math.max(1, Math.floor(limit));
    const catalogue = await this.loadPopularityCatalogue();
    const inPeriod = withinPeriod(catalogue, period);
    const matched = inPeriod.filter((anime) => matchesAnyTag(anime, cleaned));
    return matched.slice(0, safeLimit);
  }

  private loadPopularityCatalogue(): Promise<readonly Anime[]> {
    this.popularityScan ??= this.fetchPopularityCatalogue();
    return this.popularityScan;
  }

  private async fetchPopularityCatalogue(): Promise<readonly Anime[]> {
    const collected: Anime[] = [];
    for (let page = 0; page < MAL_POOL_SCAN_PAGES; page += 1) {
      const offset = page * MAL_LIMITS.animeTagRanking;
      const response = await this.request<MalAnimeListResponse>('/anime/ranking', {
        ranking_type: 'bypopularity',
        fields: MAL_FIELDS,
        limit: String(MAL_LIMITS.animeTagRanking),
        offset: String(offset),
      });
      if (!isMalListResponse(response) || !response.data.every(isMalAnimeNodeDto)) {
        throw invalidResponse('anime ranking');
      }
      collected.push(...response.data.map((item) => normalizeAnime(item.node)));
      if (response.data.length < MAL_LIMITS.animeTagRanking) break;
    }
    return collected;
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

  async getStreamingLinks(id: number): Promise<readonly StreamingLink[]> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError('Anime ID must be a positive integer.', { code: 'bad_request' });
    }
    return fetchMalStreamingPlatforms(id);
  }

  async searchAnime(query: string, request: AnimeSearchRequest = {}): Promise<AnimeSearchPage> {
    const normalizedQuery = query.trim();
    const tags = (request.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
    if (normalizedQuery.length === 0 && tags.length === 0) return EMPTY_SEARCH_PAGE;
    const safeLimit = Math.max(
      1,
      Math.min(Math.floor(request.limit ?? MAL_LIMITS.animeSearch), MAL_LIMITS.animeSearch),
    );
    const safeOffset = Math.max(0, Math.floor(request.offset ?? 0));
    const formats = request.formats ?? [];
    if (tags.length > 0) {
      return this.searchAnimeByTags(tags, safeLimit, safeOffset, formats);
    }
    const response = await this.request<MalAnimeListResponse>('/anime', {
      q: normalizedQuery,
      limit: String(safeLimit),
      fields: MAL_FIELDS,
      ...(safeOffset > 0 ? { offset: String(safeOffset) } : {}),
    });
    if (!isMalListResponse(response) || !response.data.every(isMalAnimeNodeDto)) {
      throw invalidResponse('anime search');
    }
    const matches = response.data.map((item) => normalizeAnime(item.node));
    const results = filterAnimeByFormats(matches, formats);
    const hasMore =
      response.paging?.next !== undefined
        ? response.paging.next !== null
        : results.length >= safeLimit;
    return { results, hasMore };
  }

  private async searchAnimeByTags(
    tags: readonly string[],
    limit: number,
    offset: number,
    formats: readonly AnimeType[],
  ): Promise<AnimeSearchPage> {
    const target = offset + limit;
    const maxPages =
      formats.length === 0 ? MAL_TAG_SEARCH_MAX_PAGES : MAL_TAG_SEARCH_FORMAT_MAX_PAGES;
    const collected: Anime[] = [];
    for (let page = 0; page < maxPages && collected.length < target; page += 1) {
      const pageOffset = page * MAL_LIMITS.animeTagRanking;
      const response = await this.request<MalAnimeListResponse>('/anime/ranking', {
        ranking_type: 'bypopularity',
        limit: String(MAL_LIMITS.animeTagRanking),
        offset: String(pageOffset),
        fields: MAL_TAG_SEARCH_FIELDS,
      });
      if (!isMalListResponse(response) || !response.data.every(isMalAnimeNodeDto)) {
        throw invalidResponse('anime search');
      }
      for (const item of response.data) {
        const anime = normalizeAnime(item.node);
        if (!animeMatchesTags(anime, tags)) continue;
        if (formats.length > 0 && !formats.includes(anime.type)) continue;
        collected.push(anime);
      }
      if (response.data.length < MAL_LIMITS.animeTagRanking) break;
    }
    return { results: collected.slice(offset, target), hasMore: collected.length > target };
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

function withinPeriod(anime: readonly Anime[], period: RecommendationPeriod | undefined): Anime[] {
  if (period === undefined) return [...anime];
  return anime.filter((item) => {
    if (item.year === null) return true;
    return item.year >= period.startYear && item.year <= period.endYear;
  });
}

function matchesAnyTag(anime: Anime, tags: readonly string[]): boolean {
  const names = new Set(
    [...anime.genres, ...anime.themes].map((entry) => normalizeAnimeTag(entry.name)),
  );
  return tags.some((tag) => names.has(normalizeAnimeTag(tag)));
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
