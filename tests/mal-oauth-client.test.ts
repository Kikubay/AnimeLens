import { describe, expect, it } from 'vitest';
import type { HttpClient, HttpResponse } from '../src/api/http-client';
import { FetchMalOAuthClient } from '../src/auth/mal-oauth-client';

class StubHttpClient implements HttpClient {
  request: { readonly url: string; readonly options?: RequestInit } | null = null;

  async get<T>(_url: string, _options?: RequestInit): Promise<HttpResponse<T>> {
    throw new Error('GET is not used by this test.');
  }

  async patch<T>(_url: string, _options?: RequestInit): Promise<HttpResponse<T>> {
    throw new Error('PATCH is not used by this test.');
  }

  async post<T>(url: string, options?: RequestInit): Promise<HttpResponse<T>> {
    this.request = { url, options };
    return {
      status: 200,
      headers: new Headers(),
      data: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      } as T,
    };
  }
}

describe('FetchMalOAuthClient', () => {
  it('sends the verifier in the authorization-code token request', async () => {
    const httpClient = new StubHttpClient();
    const client = new FetchMalOAuthClient(httpClient, 'https://mal.test/token');
    const codeVerifier = 'a'.repeat(64);

    await client.exchangeCode({
      clientId: 'public-client-id',
      code: 'authorization-code',
      redirectUri: 'https://extension.test.chromiumapp.org/',
      codeVerifier,
    });

    const body = new URLSearchParams(String(httpClient.request?.options?.body));
    expect(body.get('code_verifier')).toBe(codeVerifier);
  });

  it('uses the public-client form scheme without an Authorization header', async () => {
    const httpClient = new StubHttpClient();
    const client = new FetchMalOAuthClient(httpClient, 'https://mal.test/token');

    await client.exchangeCode({
      clientId: 'public-client-id',
      code: 'authorization-code',
      redirectUri: 'https://extension.test.chromiumapp.org/',
      codeVerifier: 'a'.repeat(64),
    });

    expect(httpClient.request?.options?.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  });

  it('includes client_id in authorization-code requests without a client secret', async () => {
    const httpClient = new StubHttpClient();
    const client = new FetchMalOAuthClient(httpClient, 'https://mal.test/token');

    await client.exchangeCode({
      clientId: 'public-client-id',
      code: 'authorization-code',
      redirectUri: 'https://extension.test.chromiumapp.org/',
      codeVerifier: 'a'.repeat(64),
    });

    const body = new URLSearchParams(String(httpClient.request?.options?.body));
    expect(body.get('client_id')).toBe('public-client-id');
    expect(body.get('client_secret')).toBeNull();
    expect(body.get('grant_type')).toBe('authorization_code');
  });

  it('includes client_id when refreshing a token', async () => {
    const httpClient = new StubHttpClient();
    const client = new FetchMalOAuthClient(httpClient, 'https://mal.test/token');

    await client.refreshToken({ clientId: 'public-client-id', refreshToken: 'refresh-token' });

    const body = new URLSearchParams(String(httpClient.request?.options?.body));
    expect(body.get('client_id')).toBe('public-client-id');
    expect(body.get('client_secret')).toBeNull();
    expect(body.get('grant_type')).toBe('refresh_token');
  });
});
