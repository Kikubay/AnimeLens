import type { AuthSnapshot, ProviderId, TokenExchangeDiagnostic } from './auth-types';
import { isTokenExchangeDiagnostic } from './auth-types';
import type { ProviderStatusView } from '../settings/settings-types';

export type AuthMessageType = 'auth.get_snapshot' | 'auth.connect' | 'auth.disconnect';

export interface AuthMessageResponse {
  readonly ok: boolean;
  readonly snapshot?: AuthSnapshot | null;
  readonly message?: string;
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
    throw new Error('Authentication service is unavailable.');
  }

  if (response.ok && isAuthSnapshot(response.snapshot)) {
    return response.snapshot;
  }

  const message = response.message ?? 'Authentication service is unavailable.';
  // The service may attach the failing phase to a non-ok response; surface it.
  const snapshot = response.snapshot;
  if (isAuthSnapshot(snapshot) && snapshot.phase !== undefined) {
    throw new AuthPhaseFailureError(snapshot.phase, message);
  }
  throw new Error(message);
}

/** Sign-in state of every supported provider (signed-in + active flags). */
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
    throw new Error(response?.message ?? 'Authentication service is unavailable.');
  }
  return response.providers;
}

/** Connects a specific provider (defaults to the active one when omitted). */
export async function connectProvider(providerId: ProviderId): Promise<AuthSnapshot> {
  return requestAuthMessage({ type: 'auth.connect', providerId });
}

/** Disconnects a specific provider (defaults to the active one when omitted). */
export async function disconnectProvider(providerId: ProviderId): Promise<AuthSnapshot> {
  return requestAuthMessage({ type: 'auth.disconnect', providerId });
}

/** Flips the active provider and returns the new active auth snapshot. */
export async function setActiveProvider(providerId: ProviderId): Promise<AuthSnapshot> {
  return requestAuthMessage({ type: 'auth.set_active_provider', providerId });
}

/**
 * Completes an AniList **Auth Pin** sign-in with the token the user copied
 * from the AniList pin page. Resolves with the resulting auth snapshot.
 */
export async function completeAniListPinSignIn(token: string): Promise<AuthSnapshot> {
  const response = (await chrome.runtime.sendMessage({
    type: 'auth.complete_pin_connect',
    providerId: 'anilist' as const,
    token,
  })) as AuthMessageResponse | undefined;
  if (response === undefined || typeof response !== 'object') {
    throw new Error('Authentication service is unavailable.');
  }
  if (response.ok && isAuthSnapshot(response.snapshot)) {
    return response.snapshot;
  }
  throw new Error(response.message ?? 'Authentication service is unavailable.');
}

async function requestAuthMessage(message: {
  readonly type: 'auth.connect' | 'auth.disconnect' | 'auth.set_active_provider';
  readonly providerId?: ProviderId;
}): Promise<AuthSnapshot> {
  const response = (await chrome.runtime.sendMessage(message)) as AuthMessageResponse | undefined;
  if (response === undefined || typeof response !== 'object') {
    throw new Error('Authentication service is unavailable.');
  }
  if (response.ok && isAuthSnapshot(response.snapshot)) {
    return response.snapshot;
  }
  const errorMessage = response.message ?? 'Authentication service is unavailable.';
  const snapshot = response.snapshot;
  if (isAuthSnapshot(snapshot) && snapshot.phase !== undefined) {
    throw new AuthPhaseFailureError(snapshot.phase, errorMessage);
  }
  throw new Error(errorMessage);
}

/**
 * Fetches the provider-level diagnostic for the most recent failed OAuth
 * phase. Resolves to null when the last connect attempt succeeded or none
 * has failed yet.
 */
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
