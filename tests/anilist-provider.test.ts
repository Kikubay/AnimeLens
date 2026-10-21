import { describe, expect, it } from 'vitest';
import type { Anime } from '../src/domain/anime';
import type { ApiError } from '../src/api/api-errors';
import type { HttpClient, HttpResponse } from '../src/api/http-client';
import { AniListProvider } from '../src/api/providers/anilist/anilist-provider';
import {
  genreId,
  normalizeAnime,
  toMediaListStatus,
} from '../src/api/providers/anilist/anilist-normalizer';

class RecordingHttpClient implements HttpClient {
  readonly requests: { readonly query: string; readonly variables: Record<string, unknown> }[] = [];

  constructor(
    private readonly respond: (query: string, variables: Record<string, unknown>) => unknown,
  ) {}

  async get<T>(url: string, _options?: RequestInit): Promise<HttpResponse<T>> {
    throw new Error(`Unexpected GET to ${url}`);
  }

  async post<T>(_url: string, options: RequestInit = {}): Promise<HttpResponse<T>> {
    const body = JSON.parse(String(options.body ?? '{}')) as {
      query: string;
      variables: Record<string, unknown>;
    };
    this.requests.push({ query: body.query, variables: body.variables });
    const payload = this.respond(body.query, body.variables);
    return { status: 200, headers: new Headers(), data: payload as T };
  }

  async patch<T>(url: string, _options?: RequestInit): Promise<HttpResponse<T>> {
    throw new Error(`Unexpected PATCH to ${url}`);
  }
}

const VIEWER_PAYLOAD = {
  data: {
    Viewer: {
      id: 4321,
      name: 'anilist-fan',
      avatar: { large: 'https://img/anilist.png' },
      createdAt: 1_600_000_000,
    },
  },
};

const MEDIA = {
  id: 154587,
  title: { romaji: 'Jujutsu Kaisen', english: 'Jujutsu Kaisen', native: '呪術廻戦' },
  description: 'A boy swallows a cursed finger. <i>Dark fantasy</i> ensues.<br>',
  coverImage: { medium: 'https://img/s.jpg', large: 'https://img/l.jpg' },
  averageScore: 85,
  genres: ['Action', 'Supernatural'],
  tags: [
    { id: 1, name: 'Contemporary', rank: 90 },
    { id: 2, name: 'School', rank: 85 },
    { id: 3, name: 'Male Protagonist', rank: 5 },
  ],
  format: 'TV',
  episodes: 24,
  season: 'FALL',
  seasonYear: 2020,
  status: 'FINISHED',
  popularity: 500_000,
  isAdult: false,
  studios: { nodes: [{ id: 1121, name: 'MAPPA' }] },
};

const LIST_PAYLOAD = {
  data: {
    MediaListCollection: {
      lists: [
        {
          entries: [
            {
              id: 1,
              status: 'COMPLETED',
              score: 90,
              progress: 24,
              priority: 0,
              repeat: 0,
              updatedAt: 1_700_000_000,
              notes: 'great',
              media: MEDIA,
            },
            {
              id: 2,
              status: 'CURRENT',
              score: 0,
              progress: 3,
              priority: null,
              repeat: 1,
              updatedAt: 1_700_000_100,
              notes: null,
              media: MEDIA,
            },
          ],
        },
        { entries: [] },
      ],
    },
  },
};

function isViewerQuery(query: string): boolean {
  return query.includes('Viewer');
}
function isRankingQuery(query: string): boolean {
  return query.includes('SCORE_DESC');
}

function isTrendingQuery(query: string): boolean {
  return query.includes('TRENDING_DESC');
}

function isSearchQuery(query: string): boolean {
  return query.includes('SEARCH_MATCH') || query.includes('genre_in');
}

describe('AniListProvider', () => {
  it('fetches and normalizes the current user', async () => {
    const http = new RecordingHttpClient(() => VIEWER_PAYLOAD);
    const provider = new AniListProvider(http, 'token');
    const profile = await provider.getCurrentUser();
    expect(profile).toEqual({
      id: 4321,
      username: 'anilist-fan',
      avatarUrl: 'https://img/anilist.png',
      joinedAt: new Date(1_600_000_000 * 1000).toISOString(),
      location: null,
      timeZone: null,
    });
  });

  it('fetches the user list across all list collections and normalizes entries', async () => {
    const http = new RecordingHttpClient((query) =>
      isViewerQuery(query) ? VIEWER_PAYLOAD : LIST_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');
    const entries = await provider.getUserAnimeList();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.anime.id).toBe(154587);
    expect(entries[0]?.status).toBe('completed');
    expect(entries[0]?.userScore).toBe(9);
    expect(entries[0]?.notes).toBe('great');
    expect(entries[1]?.status).toBe('watching');
    expect(entries[1]?.isRewatching).toBe(true);
    expect(entries[1]?.userScore).toBeNull();
  });

  it('requests tags on the list query so list entries carry themes', async () => {
    const http = new RecordingHttpClient((query) =>
      isViewerQuery(query) ? VIEWER_PAYLOAD : LIST_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');
    await provider.getUserAnimeList();

    const listQuery = http.requests.find((request) =>
      request.query.includes('MediaListCollection'),
    );
    expect(listQuery?.query).toContain('tags { id name rank }');

    const entries = await provider.getUserAnimeList();
    expect(entries[0]?.anime.themes.map((theme) => theme.name)).toEqual(['Contemporary', 'School']);
  });

  it('strips HTML from synopses and keeps the 0-10 community scale', () => {
    const anime = normalizeAnime(MEDIA);
    expect(anime.score).toBe(8.5);
    expect(anime.synopsis).toBe('A boy swallows a cursed finger. Dark fantasy ensues.');
    expect(anime.genres.map((genre) => genre.name)).toEqual(['Action', 'Supernatural']);
    expect(anime.type).toBe('tv');
    expect(anime.status).toBe('finished_airing');
    expect(anime.year).toBe(2020);
    expect(anime.season).toBe('fall');
    expect(anime.studios[0]?.name).toBe('MAPPA');
  });

  it('reads AniList popularity as a member count, matching MAL num_list_users', () => {
    const anime = normalizeAnime(MEDIA);
    expect(anime.memberCount).toBe(500_000);
    expect(anime.popularity).toBeNull();
  });

  it('maps AniList tags to themes, dropping tags below the relevance rank', () => {
    const anime = normalizeAnime(MEDIA);
    expect(anime.themes).toEqual([
      { id: 1, name: 'Contemporary' },
      { id: 2, name: 'School' },
    ]);
  });

  it('converts an MAL-style ranking offset into an AniList page', async () => {
    const http = new RecordingHttpClient((query) =>
      isRankingQuery(query) ? { data: { Page: { media: [MEDIA] } } } : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');
    const ranking = await provider.getAnimeRanking(50, 100);
    expect(ranking).toHaveLength(1);
    expect(http.requests[0]?.variables).toEqual({
      page: 3,
      perPage: 50,
      startDateGreater: null,
      startDateLesser: null,
    });
  });

  it('fills the suggestion slot from trending media, since AniList has no suggestions endpoint', async () => {
    const http = new RecordingHttpClient((query) =>
      isTrendingQuery(query) ? { data: { Page: { media: [MEDIA] } } } : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');
    const suggestions = await provider.getAnimeSuggestions(30);
    expect(suggestions).toHaveLength(1);
    expect(http.requests[0]?.query).toContain('TRENDING_DESC');
    expect(http.requests[0]?.variables).toEqual({ perPage: 30 });
  });

  it('converts an item offset into a page number and reports whether more remain', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? { data: { Page: { media: [MEDIA], pageInfo: { hasNextPage: true, currentPage: 2 } } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');
    const page = await provider.searchAnime('jujutsu', { limit: 24, offset: 24 });

    expect(http.requests[0]?.variables).toEqual({
      search: 'jujutsu',
      page: 2,
      perPage: 24,
    });
    expect(page.results).toHaveLength(1);
    expect(page.hasMore).toBe(true);
  });

  it('keeps only records that really carry the searched tag', async () => {
    const untagged = { ...MEDIA, genres: ['Action'], tags: [] };
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? {
            data: {
              Page: {
                media: [MEDIA, untagged],
                pageInfo: { hasNextPage: false, currentPage: 1 },
              },
            },
          }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');
    const page = await provider.searchAnime('school', { limit: 24, offset: 0, tags: ['School'] });

    expect(page.results.map((anime) => anime.id)).toEqual([MEDIA.id]);
    expect(page.hasMore).toBe(false);
  });

  it('sends every tag of a multi-tag search, genres and raw tags apart', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? { data: { Page: { media: [MEDIA], pageInfo: { hasNextPage: false, currentPage: 1 } } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    await provider.searchAnime('action isekai school', {
      limit: 24,
      offset: 0,
      tags: ['Action', 'Isekai', 'School'],
    });

    expect(http.requests[0]?.variables).toMatchObject({
      genreIn: ['Action'],
      tagIn: ['Isekai', 'School'],
    });
  });

  it('filters the candidate pool server-side by the taste cluster, with no client-side tag check', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? { data: { Page: { media: [MEDIA], pageInfo: { hasNextPage: false, currentPage: 1 } } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    const anime = await provider.getAnimeByTags(['Sci-Fi', 'Isekai'], 30);

    expect(anime.map((item) => item.id)).toEqual([MEDIA.id]);
    expect(http.requests[0]?.variables).toEqual({
      genreIn: ['Sci-Fi'],
      tagIn: ['Isekai'],
      formatIn: null,
      page: 1,
      perPage: 30,
      startDateGreater: null,
      startDateLesser: null,
    });
  });

  it('asks for candidates inside the recommendation period, so the window filters server-side', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? { data: { Page: { media: [MEDIA], pageInfo: { hasNextPage: false, currentPage: 1 } } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    await provider.getAnimeByTags(['Sci-Fi'], 30, { startYear: 2010, endYear: 2026 });

    expect(http.requests[0]?.variables).toMatchObject({
      startDateGreater: 20100101,
      startDateLesser: 20261231,
    });
  });

  it('never spends a request on an empty taste cluster', async () => {
    const http = new RecordingHttpClient(() => VIEWER_PAYLOAD);
    const provider = new AniListProvider(http, 'token');

    expect(await provider.getAnimeByTags(['  '], 30)).toEqual([]);
    expect(http.requests).toHaveLength(0);
  });

  it('drops a multi-tag result that carries only some of the tags', async () => {
    const partial = { ...MEDIA, id: 200286, tags: [{ id: 2, name: 'School', rank: 85 }] };
    const isekaiTagged = {
      ...MEDIA,
      id: 200287,
      tags: [{ id: 9, name: 'Isekai', rank: 90 }],
    };
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? {
            data: {
              Page: {
                media: [partial, isekaiTagged],
                pageInfo: { hasNextPage: false, currentPage: 1 },
              },
            },
          }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    const page = await provider.searchAnime('action isekai', {
      limit: 24,
      offset: 0,
      tags: ['Action', 'Isekai'],
    });

    expect(page.results.map((anime) => anime.id)).toEqual([isekaiTagged.id]);
  });

  it('filters a #tag at the API by genre and ranks by popularity', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? { data: { Page: { media: [MEDIA], pageInfo: { hasNextPage: true, currentPage: 1 } } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    await provider.searchAnime('action', { limit: 24, offset: 0, tags: ['Action'] });

    const request = http.requests[0];
    expect(request?.query).toContain('POPULARITY_DESC');
    expect(request?.query).not.toContain('SEARCH_MATCH');
    expect(request?.variables).toEqual({
      genreIn: ['Action'],
      tagIn: null,
      page: 1,
      perPage: 24,
    });
    expect(Object.hasOwn(request?.variables ?? {}, 'formatIn')).toBe(false);
  });

  it('filters by format at the API instead of discarding rows locally', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? { data: { Page: { media: [MEDIA], pageInfo: { hasNextPage: true, currentPage: 1 } } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    await provider.searchAnime('action', {
      limit: 24,
      offset: 0,
      tags: ['Action'],
      formats: ['ova', 'special'],
    });

    expect(http.requests[0]?.variables).toMatchObject({ formatIn: ['OVA', 'SPECIAL'] });
  });

  it('drops the unknown type, which has no MediaFormat, instead of guessing one', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? { data: { Page: { media: [MEDIA], pageInfo: { hasNextPage: false, currentPage: 1 } } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    await provider.searchAnime('action', {
      limit: 24,
      offset: 0,
      tags: ['Action'],
      formats: ['unknown'],
    });

    expect(Object.hasOwn(http.requests[0]?.variables ?? {}, 'formatIn')).toBe(false);
  });

  it('falls back to a tag filter for anything that is not an AniList genre', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? { data: { Page: { media: [MEDIA], pageInfo: { hasNextPage: false, currentPage: 1 } } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    await provider.searchAnime('isekai', { limit: 24, offset: 0, tags: ['Isekai'] });

    expect(http.requests[0]?.variables).toEqual({
      genreIn: null,
      tagIn: ['Isekai'],
      page: 1,
      perPage: 24,
    });
  });

  it('normalizes punctuation and case when resolving a genre', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query)
        ? { data: { Page: { media: [MEDIA], pageInfo: { hasNextPage: false, currentPage: 1 } } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    await provider.searchAnime('slice-of-life', { limit: 24, offset: 0, tags: ['Slice of Life'] });

    expect(http.requests[0]?.variables).toMatchObject({ genreIn: ['Slice of Life'], tagIn: null });
  });

  it('treats a missing pageInfo as the last page rather than a broken payload', async () => {
    const http = new RecordingHttpClient((query) =>
      isSearchQuery(query) ? { data: { Page: { media: [MEDIA] } } } : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');

    await expect(provider.searchAnime('jujutsu')).resolves.toMatchObject({ hasMore: false });
  });

  it('samples the ranking where AniList still has scored titles, not MAL-shaped offsets', () => {
    const provider = new AniListProvider(new RecordingHttpClient(() => VIEWER_PAYLOAD), 'token');
    expect(provider.candidatePoolConfig?.rankingOffset).toBeGreaterThan(0);
    expect(provider.candidatePoolConfig?.rankingOffset).toBeLessThan(2000);
  });

  it('maps GraphQL errors[] to ApiError codes with Retry-After', async () => {
    class RateLimitedClient implements HttpClient {
      async get<T>(url: string): Promise<HttpResponse<T>> {
        throw new Error(`Unexpected GET to ${url}`);
      }
      async post<T>(): Promise<HttpResponse<T>> {
        const headers = new Headers({ 'Retry-After': '30' });
        return {
          status: 200,
          headers,
          data: {
            errors: [{ message: 'Too Many Requests.', status: 429 }],
          } as T,
        };
      }
      async patch<T>(url: string): Promise<HttpResponse<T>> {
        throw new Error(`Unexpected PATCH to ${url}`);
      }
    }
    const provider = new AniListProvider(new RateLimitedClient(), 'token');
    await expect(provider.getCurrentUser()).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 30,
    } satisfies Partial<ApiError>);
  });

  it('saves a list entry with the mapped MediaListStatus', async () => {
    const http = new RecordingHttpClient((query, variables) =>
      query.includes('SaveMediaListEntry')
        ? { data: { SaveMediaListEntry: { id: variables.mediaId } } }
        : VIEWER_PAYLOAD,
    );
    const provider = new AniListProvider(http, 'token');
    await provider.addToList(154587, 'plan_to_watch');
    const mutation = http.requests.find((request) => request.query.includes('SaveMediaListEntry'));
    expect(mutation?.variables).toEqual({ mediaId: 154587, status: 'PLANNING' });
  });

  it('rejects invalid anime ids and statuses locally', async () => {
    const http = new RecordingHttpClient(() => VIEWER_PAYLOAD);
    const provider = new AniListProvider(http, 'token');
    await expect(provider.getAnime(-1)).rejects.toMatchObject({ code: 'bad_request' });
    await expect(
      provider.addToList(1, 'not-a-status' as Parameters<typeof provider.addToList>[1]),
    ).rejects.toMatchObject({ code: 'bad_request' });
  });
});

describe('AniList enum mapping', () => {
  it('maps every domain status to a MediaListStatus', () => {
    expect(toMediaListStatus('watching')).toBe('CURRENT');
    expect(toMediaListStatus('completed')).toBe('COMPLETED');
    expect(toMediaListStatus('on_hold')).toBe('PAUSED');
    expect(toMediaListStatus('dropped')).toBe('DROPPED');
    expect(toMediaListStatus('plan_to_watch')).toBe('PLANNING');
    expect(toMediaListStatus('rewatching')).toBe('REPEATING');
  });

  it('maps formats, seasons and airing statuses with unknown fallbacks', () => {
    expect(normalizeAnime({ id: 1, format: 'TV_SHORT' }).type).toBe('tv');
    expect(normalizeAnime({ id: 1, format: 'MANGA' }).type).toBe('unknown');
    expect(normalizeAnime({ id: 1, season: 'WINTER' }).season).toBe('winter');
    expect(normalizeAnime({ id: 1, status: 'NOT_YET_RELEASED' }).status).toBe('not_yet_aired');
    expect(normalizeAnime({ id: 1, status: 'HIATUS' }).status).toBe('unknown');
    expect(normalizeAnime({ id: 1, isAdult: true }).contentRating).toBe('explicit');
  });

  it('derives stable positive genre ids from names', () => {
    expect(genreId('Action')).toBe(genreId('Action'));
    expect(genreId('Action')).not.toBe(genreId('Drama'));
    expect(genreId('Action')).toBeGreaterThan(0);
  });

  it('treats missing media in a list entry defensively', () => {
    const anime: Anime = normalizeAnime({ id: 7 });
    expect(anime.id).toBe(7);
    expect(anime.title.default).toBe('Anime 7');
    expect(anime.score).toBeNull();
  });

  it('builds the pin authorize URL with only the documented implicit params', async () => {
    const { buildAnilistPinAuthorizeUrl, ANILIST_PIN_REDIRECT_URL } =
      await import('../src/api/providers/anilist/anilist-queries');
    const url = new URL(buildAnilistPinAuthorizeUrl('52110'));
    expect(url.origin).toBe('https://anilist.co');
    expect(url.pathname).toBe('/api/v2/oauth/authorize');
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(url.searchParams.get('client_id')).toBe('52110');
    expect(url.searchParams.has('redirect_uri')).toBe(false);
    expect(ANILIST_PIN_REDIRECT_URL).toBe('https://anilist.co/api/v2/oauth/pin');
  });

  it('decodes the JWT expiry from an AniList-shaped token', async () => {
    const { decodeAniListTokenExpiry } = await import('../src/providers/provider-registry');
    const exp = 1_800_000_000;
    const base64url = btoa(JSON.stringify({ exp }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const token = `eyJhbGciOiJIUzI1NiJ9.${base64url}.sig`;
    expect(decodeAniListTokenExpiry(token)).toBe(exp * 1000);
  });

  it('falls back to a 90-day window for tokens without a decodable exp', async () => {
    const { decodeAniListTokenExpiry } = await import('../src/providers/provider-registry');
    const now = 1_700_000_000_000;
    expect(decodeAniListTokenExpiry('not-a-jwt', now)).toBe(now + 90 * 24 * 60 * 60 * 1000);
  });

  it('extracts the token from a pasted full redirect URL fragment', async () => {
    const { extractAccessToken } = await import('../src/api/providers/anilist/anilist-queries');
    const pasted =
      'https://x.chromiumapp.org/#access_token=abc.def.ghi&token_type=Bearer&expires_in=31536000';
    expect(extractAccessToken(pasted)).toBe('abc.def.ghi');
    expect(extractAccessToken('https://x.test/?access_token=query-token')).toBe('query-token');
    expect(extractAccessToken('  bare-jwt-token  ')).toBe('bare-jwt-token');
    expect(extractAccessToken('https://x.test/#error=denied')).toBe('https://x.test/#error=denied');
  });

  it('detects pin-redirect tab URLs and rejects everything else', async () => {
    const { isAniListPinTabUrl } = await import('../src/api/providers/anilist/anilist-queries');
    expect(
      isAniListPinTabUrl(
        'https://anilist.co/api/v2/oauth/pin#access_token=abc.def.ghi&token_type=Bearer',
      ),
    ).toBe(true);
    expect(isAniListPinTabUrl('https://anilist.co/api/v2/oauth/pin#access_token=')).toBe(false);
    expect(isAniListPinTabUrl('https://anilist.co/api/v2/oauth/pin')).toBe(false);
    expect(isAniListPinTabUrl('https://anilist.co/anime/1')).toBe(false);
    expect(isAniListPinTabUrl('')).toBe(false);
  });
});
