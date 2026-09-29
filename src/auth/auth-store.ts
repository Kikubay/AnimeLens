import type { ProviderId, AuthSession, AuthSessionStore, OAuthTransaction } from './auth-types';
import { isAuthSession } from './auth-types';

const LEGACY_SESSION_KEY = 'authSession';
// Legacy OAuth transactions were ephemeral (session storage); stale ones are
// simply dropped rather than migrated — a fresh transaction is created on
// the next connect.

/**
 * Per-provider storage keys. Sessions persist in `chrome.storage.local` so
 * they survive browser restarts; OAuth transactions remain in session
 * storage because they are short-lived.
 */
function sessionKey(providerId: ProviderId): string {
  return `authSession:${providerId}`;
}

function transactionKey(providerId: ProviderId): string {
  return `oauthTransaction:${providerId}`;
}

type AuthStorageShape = {
  readonly [key: string]: unknown;
};

function isOAuthTransaction(value: unknown): value is OAuthTransaction {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.state === 'string' &&
    candidate.state.length > 0 &&
    typeof candidate.codeVerifier === 'string' &&
    candidate.codeVerifier.length > 0 &&
    typeof candidate.codeChallenge === 'string' &&
    candidate.codeChallenge.length > 0 &&
    typeof candidate.redirectUri === 'string' &&
    candidate.redirectUri.length > 0 &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt)
  );
}

export class ChromeAuthSessionStore implements AuthSessionStore {
  constructor(private readonly providerId: ProviderId = 'mal') {}

  async getSession(): Promise<AuthSession | null> {
    const key = sessionKey(this.providerId);
    const localResult = (await chrome.storage.local.get(key)) as AuthStorageShape;
    const localValue = localResult[key];
    if (localValue !== undefined && localValue !== null) {
      if (!isAuthSession(localValue)) {
        await chrome.storage.local.remove(key);
        return null;
      }
      return localValue;
    }

    // Migration: sessions written before per-provider namespacing lived under
    // the single `authSession` key and always belonged to MAL. Copy it into
    // the provider-scoped key once, then remove the legacy entry. Other
    // providers must not inherit MAL's session.
    if (this.providerId === 'mal') {
      const legacyResult = (await chrome.storage.local.get(LEGACY_SESSION_KEY)) as AuthStorageShape;
      const legacyValue = legacyResult[LEGACY_SESSION_KEY];
      if (legacyValue !== undefined && legacyValue !== null) {
        if (isAuthSession(legacyValue)) {
          await chrome.storage.local.set({ [key]: legacyValue });
          await chrome.storage.local.remove(LEGACY_SESSION_KEY);
          return legacyValue;
        }
        await chrome.storage.local.remove(LEGACY_SESSION_KEY);
      }

      // Migrate users who were authenticated by a previous build while the
      // temporary session storage entry is still available.
      const sessionResult = (await chrome.storage.session.get(
        LEGACY_SESSION_KEY,
      )) as AuthStorageShape;
      const sessionValue = sessionResult[LEGACY_SESSION_KEY];
      if (sessionValue === undefined || sessionValue === null) return null;
      if (!isAuthSession(sessionValue)) {
        await chrome.storage.session.remove(LEGACY_SESSION_KEY);
        return null;
      }
      await chrome.storage.local.set({ [key]: sessionValue });
      await chrome.storage.session.remove(LEGACY_SESSION_KEY);
      return sessionValue;
    }

    return null;
  }

  async setSession(session: AuthSession): Promise<void> {
    await chrome.storage.local.set({ [sessionKey(this.providerId)]: session });
  }

  async clearSession(): Promise<void> {
    await Promise.all([
      chrome.storage.local.remove(sessionKey(this.providerId)),
      chrome.storage.session.remove(sessionKey(this.providerId)),
    ]);
  }

  async getTransaction(): Promise<OAuthTransaction | null> {
    const key = transactionKey(this.providerId);
    const result = (await chrome.storage.session.get(key)) as AuthStorageShape;
    const value = result[key];
    if (value === undefined || value === null) return null;
    if (!isOAuthTransaction(value)) {
      await chrome.storage.session.remove(key);
      return null;
    }
    return value;
  }

  async setTransaction(transaction: OAuthTransaction): Promise<void> {
    await chrome.storage.session.set({ [transactionKey(this.providerId)]: transaction });
  }

  async clearTransaction(): Promise<void> {
    await chrome.storage.session.remove(transactionKey(this.providerId));
  }
}
