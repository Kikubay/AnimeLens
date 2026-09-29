import type { UserProfile } from '../domain/user-profile';

/** Identifier of a supported account/data provider. */
export type ProviderId = 'mal' | 'anilist';

/** How the provider's OAuth access token is obtained and maintained. */
export type OAuthTokenStrategy =
  /** Authorization-code exchange with PKCE and refresh-token rotation (MAL). */
  | 'code_exchange'
  /** Implicit grant: token in the redirect fragment, no refresh (AniList). */
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
  | 'provider_configuration' /** AniList pin flow: the authorize tab opened; await the pasted token. */
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

/** Deprecated provider-scoped alias; use `OAuthClient`. */
export type MalOAuthClient = OAuthClient;

export interface OAuthTokenResponse {
  readonly accessToken: string;
  /** Empty for implicit-grant providers that issue no refresh token. */
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export type CurrentUserFetcher = (accessToken: string) => Promise<UserProfile>;
export type AuthDataSynchronizer = (accessToken: string) => Promise<void>;

/**
 * Provider-facing diagnostic for a failed OAuth phase. The service worker
 * exposes the most recent diagnostic via the 'auth.get_token_exchange_diagnostic'
 * message so the popup can show detailed provider errors.
 */
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

/**
 * Canonicalize legacy diagnostic codes: MAL rejects redirect URIs that are not
 * registered on the client, which older builds reported as 'invalid_redirect_uri'.
 */
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

/**
 * Runtime validation for a persisted AuthSession. chrome.storage can hold
 * stale or corrupted data (e.g. after a schema change or a partial write),
 * and downstream code assumes the shape is correct.
 */
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

/**
 * Returns true when a thrown value represents a transient network failure
 * that must NOT destroy the persisted session.
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'NetworkError') return true;
  if (error instanceof TypeError) {
    // fetch() rejects with TypeError("Failed to fetch") / "NetworkError" in
    // extension contexts when the network is down; these are NOT auth failures.
    return /fetch|network|failed/i.test(error.message);
  }
  return false;
}
