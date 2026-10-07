import type { AuthSnapshot, ProviderId, TokenExchangeDiagnostic } from './auth-types';
import { isTokenExchangeDiagnostic } from './auth-types';
import type { ProviderStatusView } from '../settings/settings-types';

export type AuthMessageType = 'auth.get_snapshot' | 'auth.connect' | 'auth.disconnect';

export interface AuthMessageResponse {
  readonly ok: boolean;
  readonly snapshot?: AuthSnapshot | null;
  readonly message?: string;
}

// No message of its own, so the popup maps this to a translated string instead of leaking raw English.
export class AuthServiceUnavailableError extends Error {
  constructor() {
    super('auth-service-unavailable');
    this.name = 'AuthServiceUnavailableError';
  }
}

export function isAuthServiceUnavailableError(
  value: unknown,
): value is AuthServiceUnavailableError {
  return value instanceof Error && value.name === 'AuthServiceUnavailableError';
}

function isAuthSnapshot(value: unknown): value is AuthSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === 'string' &&
    'profile' in candidate &&
    'errorCode' in candidate &&
    'errorMessage' in candidate
  );
}

export async function requestAuthSnapshot(type: AuthMessageType): Promise<AuthSnapshot> {
  const response = (await chrome.runtime.sendMessage({ type })) as AuthMessageResponse | undefined;
  if (response === undefined || typeof response !== 'object') {
    throw new AuthServiceUnavailableError();
  }

  if (response.ok && isAuthSnapshot(response.snapshot)) {
    return response.snapshot;
  }

  const message = response.message;
  // No reason at all means the service never answered, not that it refused.
  if (message === undefined) throw new AuthServiceUnavailableError();
  // A non-ok response can name the phase that failed; that is more useful than the bare message.
  const snapshot = response.snapshot;
  if (isAuthSnapshot(snapshot) && snapshot.phase !== undefined) {
    throw new AuthPhaseFailureError(snapshot.phase, message);
  }
  throw new Error(message);
}

export async function requestProviderList(): Promise<readonly ProviderStatusView[]> {
  const response = (await chrome.runtime.sendMessage({
    type: 'auth.get_providers',
  })) as
    | {
        readonly ok: boolean;
        readonly providers?: readonly ProviderStatusView[];
        readonly message?: string;
      }
    | undefined;
  if (response === undefined || !response.ok || response.providers === undefined) {
    throw new AuthServiceUnavailableError();
  }
  return response.providers;
}

export async function connectProvider(providerId: ProviderId): Promise<AuthSnapshot> {
  return requestAuthMessage({ type: 'auth.connect', providerId });
}

export async function disconnectProvider(providerId: ProviderId): Promise<AuthSnapshot> {
  return requestAuthMessage({ type: 'auth.disconnect', providerId });
}

export async function setActiveProvider(providerId: ProviderId): Promise<AuthSnapshot> {
  return requestAuthMessage({ type: 'auth.set_active_provider', providerId });
}

// AniList hands the user a token to paste, so sign-in completes in two messages.
export async function completeAniListPinSignIn(token: string): Promise<AuthSnapshot> {
  const response = (await chrome.runtime.sendMessage({
    type: 'auth.complete_pin_connect',
    providerId: 'anilist' as const,
    token,
  })) as AuthMessageResponse | undefined;
  if (response === undefined || typeof response !== 'object') {
    throw new AuthServiceUnavailableError();
  }
  if (response.ok && isAuthSnapshot(response.snapshot)) {
    return response.snapshot;
  }
  if (response.message === undefined) throw new AuthServiceUnavailableError();
  throw new Error(response.message);
}

/** Null whenever no pin tab is open, which is the normal state outside an in-flight AniList sign-in. */
export async function requestAnilistPinToken(): Promise<string | null> {
  const response = (await chrome.runtime.sendMessage({ type: 'auth.get_pin_token' })) as
    | { readonly ok: boolean; readonly pinToken?: unknown }
    | undefined;
  if (response === undefined || !response.ok) return null;
  return typeof response.pinToken === 'string' && response.pinToken.length > 0
    ? response.pinToken
    : null;
}

async function requestAuthMessage(message: {
  readonly type: 'auth.connect' | 'auth.disconnect' | 'auth.set_active_provider';
  readonly providerId?: ProviderId;
}): Promise<AuthSnapshot> {
  const response = (await chrome.runtime.sendMessage(message)) as AuthMessageResponse | undefined;
  if (response === undefined || typeof response !== 'object') {
    throw new AuthServiceUnavailableError();
  }
  if (response.ok && isAuthSnapshot(response.snapshot)) {
    return response.snapshot;
  }
  const errorMessage = response.message;
  if (errorMessage === undefined) throw new AuthServiceUnavailableError();
  const snapshot = response.snapshot;
  if (isAuthSnapshot(snapshot) && snapshot.phase !== undefined) {
    throw new AuthPhaseFailureError(snapshot.phase, errorMessage);
  }
  throw new Error(errorMessage);
}

export async function requestTokenExchangeDiagnostic(): Promise<TokenExchangeDiagnostic | null> {
  const response = (await chrome.runtime.sendMessage({
    type: 'auth.get_token_exchange_diagnostic',
  })) as
    { readonly ok: boolean; readonly diagnostic?: unknown; readonly message?: string } | undefined;
  if (response === undefined || typeof response !== 'object' || !response.ok) {
    return null;
  }
  return isTokenExchangeDiagnostic(response.diagnostic) ? response.diagnostic : null;
}

export class AuthPhaseFailureError extends Error {
  readonly phase: AuthSnapshot['phase'];
  constructor(phase: AuthSnapshot['phase'], message: string) {
    super(message);
    this.name = 'AuthPhaseFailureError';
    this.phase = phase;
  }
}

export function isAuthPhaseFailureError(value: unknown): value is AuthPhaseFailureError {
  if (value instanceof AuthPhaseFailureError) return true;
  if (
    value instanceof Error &&
    'phase' in value &&
    typeof (value as AuthPhaseFailureError).phase === 'string'
  ) {
    return (value as AuthPhaseFailureError).name === 'AuthPhaseFailureError';
  }
  return false;
}
