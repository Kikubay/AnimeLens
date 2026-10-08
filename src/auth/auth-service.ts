import { ApiError } from '../api/api-errors';
import type {
  AuthErrorCode,
  AuthSession,
  AuthSessionStore,
  AuthSnapshot,
  AuthDataSynchronizer,
  CurrentUserFetcher,
  IdentityWebAuthFlow,
  OAuthClient,
  OAuthTokenResponse,
  OAuthTokenStrategy,
  OAuthTransaction,
  ProviderId,
  TokenExchangeDiagnostic,
  TokenExchangeErrorCode,
} from './auth-types';
import { isTransientNetworkError } from './auth-types';
import { createPkceTransaction } from './pkce';

const TRANSACTION_MAX_AGE_MS = 10 * 60 * 1000;
const EXPIRY_SKEW_MS = 30 * 1000;

export interface MalAuthConfig {
  readonly clientId: string;
  readonly authorizationUrl: string;
  /** Defaults to `'mal'`. */
  readonly providerId?: ProviderId;
  /** Defaults to `'code_exchange'` (MAL). */
  readonly tokenStrategy?: OAuthTokenStrategy;
}

export class MalAuthService {
  private snapshot: AuthSnapshot = {
    status: 'signed_out',
    profile: null,
    errorCode: null,
    errorMessage: null,
  };

  // Single-flight: a double-click (or a second connect message while the auth tab is open) must not start two OAuth flows.
  private connectInFlight: Promise<AuthSnapshot> | null = null;

  // Also single-flight, and more urgently: MAL rotates refresh tokens, so two concurrent refreshes would invalidate each other.
  private refreshInFlight: Promise<AuthSession | null> | null = null;

  // Cleared on the next successful connect.
  private lastTokenExchangeDiagnostic: TokenExchangeDiagnostic | null = null;

  private readonly providerId: ProviderId;
  private readonly tokenStrategy: OAuthTokenStrategy;

  constructor(
    private readonly config: MalAuthConfig,
    private readonly identity: IdentityWebAuthFlow,
    private readonly oauthClient: OAuthClient,
    private readonly sessionStore: AuthSessionStore,
    private readonly getCurrentUser: CurrentUserFetcher,
    private readonly now: () => number = Date.now,
    private readonly synchronizeData: AuthDataSynchronizer = async () => undefined,
    private readonly getClientId: () => Promise<string> = async () => config.clientId,
  ) {
    this.providerId = config.providerId ?? 'mal';
    this.tokenStrategy = config.tokenStrategy ?? 'code_exchange';
  }

  async getSnapshot(): Promise<AuthSnapshot> {
    let session: AuthSession | null;
    try {
      session = await this.getValidSession();
    } catch (error) {
      // Refresh blips become an 'error' snapshot rather than propagating into the UI layer.
      if (error instanceof ApiError) {
        return this.fail(error.code as AuthErrorCode, error.message);
      }
      if (isTransientNetworkError(error)) {
        return this.fail('network_error', 'The network is unavailable. Please try again.');
      }
      throw error;
    }
    if (session === null) {
      if (this.snapshot.status === 'authenticated') {
        this.snapshot = this.createSnapshot('signed_out');
      }
      return this.snapshot;
    }
    this.snapshot = this.createSnapshot('authenticated', session.profile);
    return this.snapshot;
  }

  connect(): Promise<AuthSnapshot> {
    if (this.connectInFlight !== null) return this.connectInFlight;
    this.connectInFlight = this.performConnect().finally(() => {
      this.connectInFlight = null;
    });
    return this.connectInFlight;
  }

  private async performConnect(): Promise<AuthSnapshot> {
    const providerLabel = this.providerId === 'mal' ? 'MAL' : 'AniList';
    const clientId = (await this.getClientId()).trim();
    if (clientId.length === 0) {
      return this.fail('configuration', `${providerLabel} client ID is not configured.`);
    }

    let transaction: OAuthTransaction;
    try {
      this.snapshot = this.createSnapshot('authorizing');
      // The MAL app registers the extension origin root, so adding a callback path makes MAL reject the request.
      const redirectUri = this.identity.getRedirectURL();

      // MV3 resilience: the worker can be killed while the user sits on the consent page, so a fresh stored transaction is reused. On the implicit strategy it carries no PKCE state and exists only to bound callback age.
      const stored = await this.sessionStore.getTransaction();
      if (
        stored !== null &&
        stored.redirectUri === redirectUri &&
        this.now() - stored.createdAt <= TRANSACTION_MAX_AGE_MS
      ) {
        transaction = stored;
      } else {
        const pkce = await createPkceTransaction();
        transaction = { ...pkce, redirectUri, createdAt: this.now() };
        await this.sessionStore.setTransaction(transaction);
      }

      const authorizationUrl = new URL(this.config.authorizationUrl);
      authorizationUrl.search = new URLSearchParams(
        this.tokenStrategy === 'implicit'
          ? {
              response_type: 'token',
              client_id: clientId,
              redirect_uri: transaction.redirectUri,
            }
          : {
              response_type: 'code',
              client_id: clientId,
              state: transaction.state,
              redirect_uri: transaction.redirectUri,
              code_challenge: transaction.codeChallenge,
              code_challenge_method: 'plain',
              scope: 'write:users',
            },
      ).toString();

      let callbackUrl: string | undefined;
      try {
        callbackUrl = await this.identity.launchWebAuthFlow({
          url: authorizationUrl.toString(),
          interactive: true,
        });
      } catch (error) {
        // Chrome's raw rejection text is the only diagnostic here, so classify it while the redirect URI is still in scope.
        throw toAuthWindowError(error, providerLabel, transaction.redirectUri);
      }
      if (callbackUrl === undefined)
        throw new AuthFlowError('cancelled', 'Authentication was cancelled.');

      this.snapshot = this.createSnapshot('exchanging');
      const tokenResponse =
        this.tokenStrategy === 'implicit'
          ? this.parseImplicitCallback(callbackUrl, transaction)
          : await (async () => {
              const callback = this.parseCallback(callbackUrl, transaction);
              return this.oauthClient.exchangeCode({
                clientId,
                code: callback.code,
                redirectUri: transaction.redirectUri,
                codeVerifier: transaction.codeVerifier,
              });
            })();

      const localExpiry = this.now() + Math.max(1, tokenResponse.expiresIn) * 1000 - EXPIRY_SKEW_MS;
      if (localExpiry <= this.now()) {
        throw new AuthPhaseError(
          'token_exchange',
          new ApiError(`${providerLabel} issued an expired token.`, {
            code: 'token_expired',
            status: null,
          }),
        );
      }

      let profile: Awaited<ReturnType<CurrentUserFetcher>>;
      try {
        profile = await this.getCurrentUser(tokenResponse.accessToken);
      } catch (error) {
        throw new AuthPhaseError('profile_fetch', error);
      }
      const session: AuthSession = {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken ?? '',
        expiresAt: localExpiry,
        profile,
      };
      await this.sessionStore.setSession(session);
      this.snapshot = this.createSnapshot('syncing', profile);
      try {
        await this.synchronizeData(tokenResponse.accessToken);
      } catch {
        // Sync retries on its own, so a failure here must not fail the sign-in.
      }
      this.lastTokenExchangeDiagnostic = null;
      this.snapshot = this.createSnapshot('authenticated', profile);
      return this.snapshot;
    } catch (error) {
      if (error instanceof AuthPhaseError) {
        const [code, message] = toPhaseFailure(error, providerLabel);
        this.lastTokenExchangeDiagnostic = {
          error: toTokenExchangeErrorCode(code),
          message,
          phase: error.phase,
        };
        this.snapshot = authSnapshotFromPhaseError(error, providerLabel);
        return this.snapshot;
      }
      return this.fail(...toAuthFailure(error, providerLabel));
    } finally {
      await this.sessionStore.clearTransaction();
    }
  }

  getTokenExchangeDiagnostic(): TokenExchangeDiagnostic | null {
    return this.lastTokenExchangeDiagnostic;
  }

  async withAccessToken<T>(operation: (accessToken: string) => Promise<T>): Promise<T> {
    const session = await this.getValidSession();
    if (session === null) {
      throw new AuthServiceError('session_expired', 'A valid MAL session is required.');
    }
    return operation(session.accessToken);
  }

  async disconnect(): Promise<AuthSnapshot> {
    // Let an in-flight connect settle, otherwise its finally-block resurrects state we just cleared.
    if (this.connectInFlight !== null) {
      await this.connectInFlight.catch(() => undefined);
    }
    await Promise.all([this.sessionStore.clearSession(), this.sessionStore.clearTransaction()]);
    this.snapshot = this.createSnapshot('signed_out');
    return this.snapshot;
  }

  private async getValidSession(): Promise<AuthSession | null> {
    const session = await this.sessionStore.getSession();
    if (session === null) return null;
    if (session.expiresAt > this.now()) return session;
    // No refresh token to fall back on, so the user has to authorize again.
    if (
      this.tokenStrategy === 'implicit' ||
      session.accessToken.length === 0 ||
      session.refreshToken.length === 0
    ) {
      await this.sessionStore.clearSession();
      this.snapshot = this.createSnapshot(
        'expired',
        session.profile,
        'session_expired',
        this.providerId === 'mal'
          ? 'Your MAL session expired.'
          : 'Your AniList session expired. Please sign in again.',
      );
      return null;
    }

    if (this.refreshInFlight === null) {
      this.refreshInFlight = this.refreshSession(session).finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async refreshSession(session: AuthSession): Promise<AuthSession | null> {
    try {
      const refreshed = await this.oauthClient.refreshToken({
        clientId: await this.getClientId(),
        refreshToken: session.refreshToken,
      });
      const refreshedExpiry = this.now() + Math.max(1, refreshed.expiresIn) * 1000 - EXPIRY_SKEW_MS;
      if (refreshedExpiry <= this.now()) {
        throw new ApiError('MAL returned an already-expired refreshed token.', {
          code: 'token_expired',
          status: null,
        });
      }
      const refreshedSession: AuthSession = {
        ...session,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshedExpiry,
      };
      await this.sessionStore.setSession(refreshedSession);
      return refreshedSession;
    } catch (error) {
      // Being offline or rate-limited isn't the session's fault, so keep the refresh token for a later retry.
      if (
        error instanceof ApiError &&
        (error.code === 'network_error' || error.code === 'rate_limited')
      ) {
        throw error;
      }
      if (isTransientNetworkError(error)) {
        throw new ApiError('The network is unavailable.', {
          code: 'network_error',
          status: null,
        });
      }
      await this.sessionStore.clearSession();
      this.snapshot = this.createSnapshot(
        'expired',
        session.profile,
        'session_expired',
        'Your MAL session expired.',
      );
      return null;
    }
  }

  private parseCallback(
    callbackUrl: string,
    transaction: OAuthTransaction,
  ): { readonly code: string } {
    if (this.now() - transaction.createdAt > TRANSACTION_MAX_AGE_MS) {
      throw new AuthFlowError('invalid_callback', 'The authentication request expired.');
    }
    let url: URL;
    try {
      url = new URL(callbackUrl);
    } catch (error) {
      throw new AuthFlowError('invalid_callback', 'MAL returned an invalid callback URL.', error);
    }
    const expected = new URL(transaction.redirectUri);
    if (url.origin !== expected.origin || url.pathname !== expected.pathname) {
      throw new AuthFlowError('invalid_callback', 'The callback URL was not issued for AnimeLens.');
    }
    if (url.searchParams.get('state') !== transaction.state) {
      throw new AuthFlowError('state_mismatch', 'The OAuth state could not be verified.');
    }
    const providerError = url.searchParams.get('error');
    if (providerError !== null) {
      throw new AuthFlowError('invalid_callback', `MAL declined authorization: ${providerError}.`);
    }
    const code = url.searchParams.get('code');
    if (code === null || code.length === 0) {
      throw new AuthFlowError('invalid_callback', 'MAL did not return an authorization code.');
    }
    return { code };
  }

  private createSnapshot(
    status: AuthSnapshot['status'],
    profile: AuthSnapshot['profile'] = null,
    errorCode: AuthErrorCode | null = null,
    errorMessage: string | null = null,
    phase?: AuthSnapshot['phase'],
  ): AuthSnapshot {
    return { status, profile, errorCode, errorMessage, phase };
  }

  // The token rides in the fragment and AniList echoes no `state`, so the redirect origin plus the freshness window are all we have to validate against.
  private parseImplicitCallback(
    callbackUrl: string,
    transaction: OAuthTransaction,
  ): OAuthTokenResponse {
    if (this.now() - transaction.createdAt > TRANSACTION_MAX_AGE_MS) {
      throw new AuthFlowError('invalid_callback', 'The authentication request expired.');
    }
    let url: URL;
    try {
      url = new URL(callbackUrl);
    } catch (error) {
      throw new AuthFlowError(
        'invalid_callback',
        'AniList returned an invalid callback URL.',
        error,
      );
    }
    const expected = new URL(transaction.redirectUri);
    if (url.origin !== expected.origin || url.pathname !== expected.pathname) {
      throw new AuthFlowError('invalid_callback', 'The callback URL was not issued for AnimeLens.');
    }
    const params = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    const providerError = params.get('error');
    if (providerError !== null) {
      throw new AuthFlowError(
        'invalid_callback',
        `AniList declined authorization: ${providerError}.`,
      );
    }
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    if (accessToken === null || accessToken.length === 0 || expiresIn === null) {
      throw new AuthFlowError('invalid_callback', 'AniList did not return an access token.');
    }
    const expiresInSeconds = Number(expiresIn);
    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new AuthFlowError('invalid_callback', 'AniList returned an invalid token lifetime.');
    }
    return { accessToken, refreshToken: '', expiresIn: expiresInSeconds };
  }

  private fail(code: AuthErrorCode, message: string): AuthSnapshot {
    this.snapshot = this.createSnapshot('error', null, code, message);
    return this.snapshot;
  }
}

export class AuthServiceError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

class AuthFlowError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'AuthFlowError';
  }
}

class AuthPhaseError extends Error {
  constructor(
    readonly phase: 'token_exchange' | 'profile_fetch',
    readonly cause: unknown,
  ) {
    super(`MAL ${phase} failed.`, { cause });
    this.name = 'AuthPhaseError';
  }
}

function toAuthFailure(error: unknown, providerLabel: string): [AuthErrorCode, string] {
  if (error instanceof AuthFlowError) return [error.code, error.message];
  if (error instanceof AuthPhaseError) return toPhaseFailure(error, providerLabel);
  if (error instanceof ApiError && error.code === 'network_error') {
    return ['network_error', 'The network is unavailable. Please try again.'];
  }
  if (error instanceof ApiError && error.code === 'rate_limited') {
    return [
      'network_error',
      `${providerLabel} is rate limiting requests. Please try again shortly.`,
    ];
  }
  if (error instanceof ApiError) {
    return [
      'token_exchange',
      `${providerLabel} could not complete authentication. Please try again.`,
    ];
  }
  if (isCancellationError(error)) return ['cancelled', 'Authentication was cancelled.'];
  if (isTransientNetworkError(error)) {
    return ['network_error', 'The network is unavailable. Please try again.'];
  }
  return ['unknown', `AnimeLens could not complete the ${providerLabel} sign-in.`];
}

// Chrome's only clue about an auth-window failure is the rejection message, so match the known ones here.
function toAuthWindowError(
  error: unknown,
  providerLabel: string,
  redirectUri: string,
): AuthFlowError {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (isCancellationError(error)) {
    return new AuthFlowError('cancelled', 'Authentication was cancelled.', error);
  }
  if (/denied|dismissed|closed/i.test(raw)) {
    return new AuthFlowError(
      'cancelled',
      `${providerLabel} sign-in was dismissed before it could finish.`,
      error,
    );
  }
  if (/could not be loaded|failed to load|navigation|ERR_/i.test(raw)) {
    return new AuthFlowError(
      'invalid_redirect_uri',
      `${providerLabel} could not load the sign-in page. Verify the redirect URL (${redirectUri}) is registered exactly in the ${providerLabel} developer settings, then try again. (Chrome: ${raw})`,
      error,
    );
  }
  return new AuthFlowError('unknown', `${providerLabel} sign-in failed: ${raw}`, error);
}

function authSnapshotFromPhaseError(error: AuthPhaseError, providerLabel: string): AuthSnapshot {
  const [code, message] = toPhaseFailure(error, providerLabel);
  return {
    status: 'error',
    profile: null,
    errorCode: code,
    errorMessage: message,
    phase: error.phase,
  };
}

function toPhaseFailure(error: AuthPhaseError, providerLabel: string): [AuthErrorCode, string] {
  if (error.cause instanceof ApiError && error.cause.code === 'network_error') {
    return error.phase === 'token_exchange'
      ? ['network_error', `${providerLabel} token exchange is unreachable from the extension.`]
      : ['network_error', `${providerLabel} profile API is unreachable from the extension.`];
  }
  if (error.cause instanceof ApiError) {
    const status = error.cause.status === null ? '' : ` (HTTP ${error.cause.status})`;
    const providerMessage = error.cause.message.trim();
    if (error.cause.code === 'token_expired') {
      return [
        'session_expired',
        `${providerLabel} returned an expired token immediately after authorization. Please sign in again.`,
      ];
    }
    return error.phase === 'token_exchange'
      ? [
          'token_exchange',
          `${providerLabel} rejected the OAuth token exchange${status}: ${providerMessage}`,
        ]
      : [
          'profile_fetch',
          `${providerLabel} authentication succeeded, but the profile request failed${status}: ${providerMessage}`,
        ];
  }
  if (isTransientNetworkError(error.cause)) {
    return error.phase === 'token_exchange'
      ? ['network_error', `${providerLabel} token exchange is unreachable from the extension.`]
      : ['network_error', `${providerLabel} profile API is unreachable from the extension.`];
  }
  return ['unknown', `AnimeLens could not complete the ${providerLabel} sign-in.`];
}

function isCancellationError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && /cancel|abort/i.test(error.message);
}

function toTokenExchangeErrorCode(code: AuthErrorCode): TokenExchangeErrorCode {
  switch (code) {
    case 'network_error':
      return 'network_error';
    case 'token_expired':
    case 'session_expired':
      return 'token_expired';
    case 'invalid_callback':
    case 'state_mismatch':
      return 'invalid_callback';
    case 'configuration':
    case 'invalid_redirect_uri':
    case 'mal_configuration':
      return 'mal_configuration';
    default:
      return 'token_exchange';
  }
}
