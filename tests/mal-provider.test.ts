import { describe, expect, it } from 'vitest';
import type { HttpClient, HttpResponse } from '../src/api/http-client';
import { MalAnimeProvider } from '../src/api/providers/mal/mal-provider';

const animeDto = (id: number, title: string) => ({
  id,
  title,
  mean: 8.4,
  media_type: 'tv',
  status: 'finished_airing',
  genres: [{ id: 1, name: 'Mystery' }],
});

class StubHttpClient implements HttpClient {
  readonly calls: Array<{ readonly url: string; readonly options?: RequestInit }> = [];

  constructor(private readonly responses: readonly unknown[]) {}

  async get<T>(url: string, options?: RequestInit): Promise<HttpResponse<T>> {
    this.calls.push({ url, options });
    const data = this.responses[this.calls.length - 1];
    if (data instanceof Error) throw data;
    return { status: 200, headers: new Headers(), data: data as T };
  }

  async post<T>(_url: string, _options?: RequestInit): Promise<HttpResponse<T>> {
    throw new Error('POST is not used by the MAL provider tests.');
  }

  async patch<T>(url: string, options?: RequestInit): Promise<HttpResponse<T>> {
    this.calls.push({ url, options });
    return { status: 200, headers: new Headers(), data: undefined as T };
  }
}

describe('MalAnimeProvider', () => {
  it('normalizes anime details and sends the documented Bearer header', async () => {
    const client = new StubHttpClient([animeDto(42, 'A title')]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    const anime = await provider.getAnime(42);
    const request = client.calls[0];

    expect(anime.id).toBe(42);
    expect(anime.title.default).toBe('A title');
    expect(request.url).toContain('/v2/anime/42');
    expect(request.url).toContain('fields=');
    expect(new Headers(request.options?.headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('requests list_status (not my_list_status) on the user animelist endpoint', async () => {
    // `list_status`, not `my_list_status`: asking for the latter here silently yields nodes with no status or score, freezing the profile stats at zero.
    const client = new StubHttpClient([{ data: [] }]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    await provider.getUserAnimeList();

    const fields = new URL(client.calls[0].url).searchParams.get('fields') ?? '';
    expect(fields).toContain('list_status{');
    expect(fields).toContain('list_status{status,score');
    expect(fields).not.toContain('my_list_status');
  });

  it('follows paging.next and combines normalized list entries', async () => {
    const client = new StubHttpClient([
      {
        data: [{ node: animeDto(1, 'First'), list_status: { status: 'completed', score: 9 } }],
        paging: { next: 'https://mal.test/v2/users/@me/animelist?offset=1000' },
      },
      {
        data: [{ node: animeDto(2, 'Second'), list_status: { status: 'watching' } }],
      },
    ]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    const entries = await provider.getUserAnimeList();

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.anime.id)).toEqual([1, 2]);
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1].url).toBe('https://mal.test/v2/users/@me/animelist?offset=1000');
  });

  it('fails on a repeated pagination URL instead of looping forever', async () => {
    const next = 'https://mal.test/v2/users/@me/animelist?offset=1000';
    const client = new StubHttpClient([
      { data: [], paging: { next } },
      { data: [], paging: { next } },
    ]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    await expect(provider.getUserAnimeList()).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('fetches personalized suggestions with the anime detail fields', async () => {
    const client = new StubHttpClient([{ data: [{ node: animeDto(7, 'Suggested') }] }]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    const suggestions = await provider.getAnimeSuggestions(20);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].id).toBe(7);
    expect(suggestions[0].title.default).toBe('Suggested');
    const url = new URL(client.calls[0].url);
    expect(url.pathname).toBe('/v2/anime/suggestions');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('fields')).toContain('genres');
    expect(new Headers(client.calls[0].options?.headers).get('Authorization')).toBe(
      'Bearer test-token',
    );
  });

  it('clamps the suggestions limit to MAL documented bounds', async () => {
    const client = new StubHttpClient([{ data: [] }]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    await provider.getAnimeSuggestions(5000);

    const limit = new URL(client.calls[0].url).searchParams.get('limit');
    expect(Number(limit)).toBeLessThanOrEqual(100);
  });

  it('fetches the public anime ranking with the documented parameters', async () => {
    const client = new StubHttpClient([{ data: [{ node: animeDto(8, 'Ranked') }] }]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    const ranking = await provider.getAnimeRanking(25);

    expect(ranking).toHaveLength(1);
    expect(ranking[0].id).toBe(8);
    const url = new URL(client.calls[0].url);
    expect(url.pathname).toBe('/v2/anime/ranking');
    expect(url.searchParams.get('ranking_type')).toBe('all');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('fields')).toContain('genres');
    expect(new Headers(client.calls[0].options?.headers).get('Authorization')).toBe(
      'Bearer test-token',
    );
  });

  it('clamps the ranking limit to MAL documented bounds', async () => {
    const client = new StubHttpClient([{ data: [] }]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    await provider.getAnimeRanking(5000);

    const limit = new URL(client.calls[0].url).searchParams.get('limit');
    expect(Number(limit)).toBeLessThanOrEqual(100);
  });

  it('adds an anime to the MAL list with the requested status', async () => {
    const client = new StubHttpClient([]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    await provider.addToList(42, 'plan_to_watch');

    const request = client.calls[0];
    expect(request.url).toBe('https://mal.test/v2/anime/42/my_list_status');
    expect(new Headers(request.options?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(request.options?.method).toBe('PATCH');
    expect(new URLSearchParams(String(request.options?.body)).get('status')).toBe('plan_to_watch');
  });

  it('rejects invalid list mutations before making a request', async () => {
    const client = new StubHttpClient([]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    await expect(provider.addToList(0)).rejects.toMatchObject({ code: 'bad_request' });
    expect(client.calls).toHaveLength(0);
  });

  it('rejects incomplete detail responses and invalid IDs', async () => {
    const client = new StubHttpClient([{}]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    await expect(provider.getAnime(0)).rejects.toMatchObject({ code: 'bad_request' });
    await expect(provider.getAnime(7)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('rejects malformed paging payloads', async () => {
    const client = new StubHttpClient([{ data: [], paging: { next: 42 } }]);
    const provider = new MalAnimeProvider(client, 'test-token', 'https://mal.test/v2');

    await expect(provider.getUserAnimeList()).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('ignores blank searches and rejects malformed search payloads', async () => {
    const blankClient = new StubHttpClient([]);
    const provider = new MalAnimeProvider(blankClient, 'test-token', 'https://mal.test/v2');
    await expect(provider.searchAnime('   ')).resolves.toEqual([]);
    expect(blankClient.calls).toHaveLength(0);

    const invalidClient = new StubHttpClient([{ data: {} }]);
    const invalidProvider = new MalAnimeProvider(
      invalidClient,
      'test-token',
      'https://mal.test/v2',
    );
    await expect(invalidProvider.searchAnime('query')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
});
