import type { Anime, AnimeListEntry, AnimeStatus } from '../../../domain/anime';
import type { StreamingLink } from '../../../domain/streaming';
import type { UserProfile } from '../../../domain/user-profile';
import type { HttpClient } from '../../http-client';
import { ApiError } from '../../api-errors';
import { parseRetryAfterSeconds } from '../../retry-after';
import type { AnimeProvider } from '../../anime-provider';
import {
  ANILIST_GRAPHQL_URL,
  ANIME_DETAIL_QUERY,
  RANKING_ANIME_QUERY,
  SAVE_LIST_ENTRY_MUTATION,
  SEARCH_ANIME_QUERY,
  USER_LIST_QUERY,
  VIEWER_QUERY,
} from './anilist-queries';
import {
  isAniListListResponse,
  isAniListMedia,
  isAniListPageResponse,
  isAniListViewerResponse,
  normalizeAnime,
  normalizeAnimeListEntry,
  normalizeUserProfile,
  toMediaListStatus,
} from './anilist-normalizer';

/** GraphQL envelope: HTTP 200 can still carry a top-level `errors` array. */
interface GraphQLResponse<T> {
  readonly data?: T;
  readonly errors?: readonly {
    readonly message?: string;
    readonly status?: number;
  }[];
}

export class AniListGraphQLClient {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly url: string = ANILIST_GRAPHQL_URL,
  ) {}

  async request<T>(
    query: string,
    variables: Readonly<Record<string, unknown>> = {},
    accessToken: string | null = null,
  ): Promise<T> {
    const response = await this.httpClient.post<GraphQLResponse<T>>(this.url, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(accessToken !== null ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = response.data;
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      throw toApiError(payload.errors, response.headers);
    }
    if (payload?.data === undefined || payload.data === null) {
      throw new ApiError('The AniList response is missing data.', {
        code: 'invalid_response',
        status: response.status,
      });
    }
    return payload.data;
  }
}

/** Maps AniList's GraphQL `errors[]` onto the shared ApiError codes. */
function toApiError(
  errors: readonly { readonly message?: string; readonly status?: number }[],
  headers: Headers,
): ApiError {
  const message =
    errors.map((error) => error.message ?? 'Unknown GraphQL error.').join('; ') ||
    'The AniList request failed.';
  const status = errors.find((error) => typeof error.status === 'number')?.status ?? null;
  const code =
    status === 400
      ? 'bad_request'
      : status === 401
        ? 'unauthorized'
        : status === 403
          ? 'forbidden'
          : status === 404
            ? 'not_found'
            : status === 429
              ? 'rate_limited'
              : 'invalid_response';
  return new ApiError(`AniList: ${message}`, {
    code,
    status,
    // AniList signals its limit with `errors[].status === 429` inside an HTTP
    // 200 body, so this mapper — not the HTTP status — is the real 429 path.
    // It still has to honour the HTTP-date form of Retry-After.
    retryAfterSeconds: parseRetryAfterSeconds(headers.get('Retry-After')),
  });
}

/**
 * AniList provider implementing the provider-neutral `AnimeProvider`
 * contract against the GraphQL API (https://graphql.anilist.co).
 */
export class AniListProvider implements AnimeProvider {
  private readonly graphql: AniListGraphQLClient;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly accessToken: string,
    private readonly userId: number | null = null,
    graphqlClient?: AniListGraphQLClient,
  ) {
    this.graphql = graphqlClient ?? new AniListGraphQLClient(httpClient);
  }

  async getCurrentUser(): Promise<UserProfile> {
    const data = await this.graphql.request<{ readonly Viewer: unknown }>(
      VIEWER_QUERY,
      {},
      this.accessToken,
    );
    if (!isAniListViewerResponse(data)) throw invalidResponse('user');
    return normalizeUserProfile(data.Viewer);
  }

  async getUserAnimeList(): Promise<AnimeListEntry[]> {
    const userId = await this.resolveUserId();
    const data = await this.graphql.request<unknown>(USER_LIST_QUERY, { userId }, this.accessToken);
    if (!isAniListListResponse(data)) throw invalidResponse('anime list');
    return data.MediaListCollection.lists.flatMap((list) =>
      list.entries.filter((entry) => isAniListMedia(entry.media)).map(normalizeAnimeListEntry),
    );
  }

  async getAnime(id: number): Promise<Anime> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError('Anime ID must be a positive integer.', { code: 'bad_request' });
    }
    const data = await this.graphql.request<{ readonly Media: unknown }>(
      ANIME_DETAIL_QUERY,
      { id },
      this.accessToken,
    );
    if (!isAniListMedia(data.Media)) throw invalidResponse('anime');
    return normalizeAnime(data.Media);
  }

  /**
   * AniList has no server-side suggestion endpoint. Returning an empty list
   * is the documented degradation: the recommendation engine falls back to
   * the user's plan-to-watch entries plus the ranking pool.
   */
  async getAnimeSuggestions(): Promise<Anime[]> {
    return [];
  }

  /**
   * Top-scored anime. `offset` (an MAL-style item offset) is converted to the
   * AniList page number so deep discovery keeps working across providers.
   */
  async getAnimeRanking(limit: number = 50, offset: number = 0): Promise<Anime[]> {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 50));
    const safeOffset = Math.max(0, Math.floor(offset));
    const page = Math.floor(safeOffset / safeLimit) + 1;
    const data = await this.graphql.request<unknown>(
      RANKING_ANIME_QUERY,
      { page, perPage: safeLimit },
      this.accessToken,
    );
    if (!isAniListPageResponse(data)) throw invalidResponse('anime ranking');
    return data.Page.media.filter(isAniListMedia).map(normalizeAnime);
  }

  async getStreamingLinks(id: number): Promise<readonly StreamingLink[]> {
    return (await this.getAnime(id)).streamingSites ?? [];
  }

  async searchAnime(query: string): Promise<Anime[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) return [];
    const data = await this.graphql.request<unknown>(
      SEARCH_ANIME_QUERY,
      { search: normalizedQuery },
      this.accessToken,
    );
    if (!isAniListPageResponse(data)) throw invalidResponse('anime search');
    return data.Page.media.filter(isAniListMedia).map(normalizeAnime);
  }

  async addToList(id: number, status: AnimeStatus = 'plan_to_watch'): Promise<void> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError('Anime ID must be a positive integer.', { code: 'bad_request' });
    }
    const mediaStatus = toMediaListStatus(status);
    if (mediaStatus === null) {
      throw new ApiError('Anime list status is invalid.', { code: 'bad_request' });
    }
    await this.graphql.request(
      SAVE_LIST_ENTRY_MUTATION,
      { mediaId: id, status: mediaStatus },
      this.accessToken,
    );
  }

  /** `Viewer` id captured at profile fetch; falls back to a live lookup. */
  private async resolveUserId(): Promise<number> {
    if (this.userId !== null) return this.userId;
    const data = await this.graphql.request<{ readonly Viewer: unknown }>(
      VIEWER_QUERY,
      {},
      this.accessToken,
    );
    if (!isAniListViewerResponse(data)) throw invalidResponse('user');
    return data.Viewer.id;
  }
}

function invalidResponse(resource: string): ApiError {
  return new ApiError(`The AniList ${resource} response is incomplete or invalid.`, {
    code: 'invalid_response',
  });
}
