import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchHttpClient } from '../src/api/http-client';

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('FetchHttpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('binds the native fetch receiver for the default client', async () => {
    const nativeFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(function (
      this: typeof globalThis,
    ) {
      expect(this).toBe(globalThis);
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    const client = new FetchHttpClient();

    await expect(client.get('/resource')).resolves.toMatchObject({
      status: 200,
      data: { ok: true },
    });
    expect(nativeFetch).toHaveBeenCalledWith('/resource', { method: 'GET' });
  });

  it('returns parsed JSON for successful responses', async () => {
    const client = new FetchHttpClient(async () => jsonResponse({ ok: true }));

    await expect(client.get('/resource')).resolves.toMatchObject({
      status: 200,
      data: { ok: true },
    });
  });

  it('maps network failures to a provider-neutral ApiError', async () => {
    const client = new FetchHttpClient(async () => {
      throw new Error('offline');
    });

    await expect(client.get('/resource')).rejects.toMatchObject({
      code: 'network_error',
      status: null,
    });
  });

  it('preserves 429 and Retry-After for callers to handle', async () => {
    const client = new FetchHttpClient(async () =>
      jsonResponse({ error: 'rate_limit', message: 'Slow down' }, 429, { 'Retry-After': '17' }),
    );

    await expect(client.get('/resource')).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
      retryAfterSeconds: 17,
      message: 'Slow down',
    });
  });

  it('parses the HTTP-date form of Retry-After into a relative delay', async () => {
    // Both CDNs send the date form, and a numeric-only parser would fall back to a sub-second backoff against a window measured in tens of seconds.
    const now = Date.parse('2026-10-21T07:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const client = new FetchHttpClient(async () =>
      jsonResponse({ message: 'Slow down' }, 429, {
        'Retry-After': 'Wed, 21 Oct 2026 07:00:30 GMT',
      }),
    );

    await expect(client.get('/resource')).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 30,
    });
  });

  it('maps 5xx to a retryable network_error instead of an opaque unknown', async () => {
    const client = new FetchHttpClient(async () =>
      jsonResponse({ message: 'Bad gateway' }, 502),
    );

    await expect(client.get('/resource')).rejects.toMatchObject({
      code: 'network_error',
      status: 502,
    });
  });

  it('keeps a genuine client error non-retryable', async () => {
    const client = new FetchHttpClient(async () => jsonResponse({ message: 'Nope' }, 404));

    await expect(client.get('/resource')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('unwraps a GraphQL errors[] body so the provider message survives', async () => {
    const client = new FetchHttpClient(async () =>
      jsonResponse({ errors: [{ message: 'Too Many Requests.' }] }, 400),
    );

    await expect(client.get('/resource')).rejects.toMatchObject({
      message: 'Too Many Requests.',
    });
  });

  it('rejects a successful response with invalid JSON', async () => {
    const client = new FetchHttpClient(
      async () =>
        new Response('{not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(client.get('/resource')).rejects.toMatchObject({
      code: 'invalid_response',
      status: 200,
    });
  });
});
