import { ApiError } from '../api/api-errors';
import type { HttpClient } from '../api/http-client';
import type { MalOAuthClient, OAuthTokenResponse } from './auth-types';

export const MAL_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';

export class FetchMalOAuthClient implements MalOAuthClient {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly tokenUrl: string = MAL_TOKEN_URL,
  ) {}

  async exchangeCode(input: {
    readonly clientId: string;
    readonly code: string;
    readonly redirectUri: string;
    readonly codeVerifier: string;
  }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: input.clientId,
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    });
    return this.requestToken(body);
  }

  async refreshToken(input: {
    readonly clientId: string;
    readonly refreshToken: string;
  }): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: input.clientId,
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
    });
    return this.requestToken(body);
  }

  private async requestToken(body: URLSearchParams): Promise<OAuthTokenResponse> {
    const response = await this.httpClient.post<unknown>(this.tokenUrl, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!isTokenResponse(response.data)) {
      throw new ApiError('MAL returned an invalid OAuth token response.', {
        code: 'invalid_response',
        status: response.status,
      });
    }
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }
}

function isTokenResponse(value: unknown): value is {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
} {
  if (typeof value !== 'object' || value === null) return false;
  if (!('access_token' in value) || !('refresh_token' in value) || !('expires_in' in value)) {
    return false;
  }
  return (
    typeof value.access_token === 'string' &&
    value.access_token.length > 0 &&
    typeof value.refresh_token === 'string' &&
    value.refresh_token.length > 0 &&
    typeof value.expires_in === 'number' &&
    Number.isFinite(value.expires_in) &&
    value.expires_in > 0
  );
}
