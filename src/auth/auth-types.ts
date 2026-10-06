import type { UserProfile } from '../domain/user-profile';

export type ProviderId = 'mal' | 'anilist';

export type OAuthTokenStrategy =
  /** Authorization code + PKCE, refresh token rotates (MAL). */
  | 'code_exchange'
  /** Token in the redirect fragment, nothing to refresh (AniList). */
  | 'implicit';

export type AuthStatus =
  'signed_out' | 'authorizing' | 'exchanging' | 'syncing' | 'authenticated' | 'expired' | 'error';

export type AuthErrorCode =
  | 'configuration'
  | 'cancelled'
  | 'invalid_callback'
  | 'state_mismatch'
  | 'token_exchange'
  | 'profile_fetch'
  | 'token_expired'
  | 'network_error'
  | 'session_expired'
  | 'invalid_redirect_uri'
  | 'mal_configuration'
  | 'provider_configuration'
  /** AniList: the authorize tab is open and we're waiting on the pasted token. */
  | 'pin_flow_started'
  | 'unknown';

export interface AuthSnapshot {
  readonly status: AuthStatus;
  readonly profile: UserProfile | null;
  readonly errorCode: AuthErrorCode | null;
  readonly errorMessage: string | null;
  readonly phase?: 'token_exchange' | 'profile_fetch';
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly profile: UserProfile;
}

export interface OAuthTransaction {
  readonly state: string;
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly redirectUri: string;
  readonly createdAt: number;
}

export interface AuthSessionStore {
  getSession(): Promise<AuthSession | null>;
  setSession(session: AuthSession): Promise<void>;
  clearSession(): Promise<void>;
  getTransaction(): Promise<OAuthTransaction | null>;
  setTransaction(transaction: OAuthTransaction): Promise<void>;
  clearTransaction(): Promise<void>;
}

export interface IdentityWebAuthFlow {
  getRedirectURL(path?: string): string;
  launchWebAuthFlow(details: {
    readonly url: string;
    readonly interactive: boolean;
  }): Promise<string | undefined>;
}

export interface OAuthClient {
  exchangeCode(input: {
    readonly clientId: string;
    readonly code: string;
    readonly redirectUri: string;
    readonly codeVerifier: string;
  }): Promise<OAuthTokenResponse>;
  refreshToken(input: {
    readonly clientId: string;
    readonly refreshToken: string;
  }): Promise<OAuthTokenResponse>;
}

/** Kept for the old MAL-specific name; prefer `OAuthClient`. */
export type MalOAuthClient = OAuthClient;

export interface OAuthTokenResponse {
  readonly accessToken: string;
  /** Blank for implicit-grant providers, which issue none. */
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export type CurrentUserFetcher = (accessToken: string) => Promise<UserProfile>;
export type AuthDataSynchronizer = (accessToken: string) => Promise<void>;

// Surfaced to the popup via 'auth.get_token_exchange_diagnostic' so it can explain what the provider actually complained about.
export type TokenExchangeErrorCode =
  | 'network_error'
  | 'token_expired'
  | 'token_exchange'
  | 'invalid_redirect_uri'
  | 'invalid_callback'
  | 'mal_configuration'
  | 'provider_configuration';

export interface TokenExchangeDiagnostic {
  readonly error: TokenExchangeErrorCode;
  readonly message: string;
  readonly phase: 'token_exchange' | 'profile_fetch';
}

// Older builds reported an unregistered redirect URI as 'invalid_redirect_uri'; MAL calls that a configuration problem.
export function normalizeTokenExchangeDiagnostic(
  diagnostic: TokenExchangeDiagnostic,
): TokenExchangeDiagnostic {
  return {
    ...diagnostic,
    error: diagnostic.error === 'invalid_redirect_uri' ? 'mal_configuration' : diagnostic.error,
  };
}

export function isTokenExchangeDiagnostic(value: unknown): value is TokenExchangeDiagnostic {
  if (typeof value !== 'object' || value === null) return false;
  if (!('error' in value) || !('message' in value) || !('phase' in value)) return false;
  const typed = value as TokenExchangeDiagnostic;
  return (
    typeof typed.error === 'string' &&
    typeof typed.message === 'string' &&
    typeof typed.phase === 'string' &&
    (typed.phase === 'token_exchange' || typed.phase === 'profile_fetch')
  );
}

// chrome.storage can hand back stale or half-written data after a schema change, and everything downstream trusts this shape.
export function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === 'string' &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.expiresAt === 'number' &&
    Number.isFinite(candidate.expiresAt) &&
    typeof candidate.profile === 'object' &&
    candidate.profile !== null
  );
}

export function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'NetworkError') return true;
  if (error instanceof TypeError) {
    // Being offline shows up as TypeError("Failed to fetch"), which says nothing about the token.
    return /fetch|network|failed/i.test(error.message);
  }
  return false;
}
