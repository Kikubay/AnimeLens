/** AniList hands back the token in a URL fragment the extension can't intercept, and the popup closes the moment you click that tab — so the background has to catch it. */
export const ANILIST_PIN_URL_PREFIX = 'https://anilist.co/api/v2/oauth/pin#access_token=';

/** Session-scoped rather than local, since the token is single-use and must not outlive the browser session. */
export const ANILIST_PIN_TOKEN_KEY = 'anilistPinToken';
export const ANILIST_PIN_TAB_KEY = 'anilistPinTab';

/** Where the pin tab is sent once its token has been spent, so the URL stops holding it. */
export const ANILIST_HOME_URL = 'https://anilist.co/';

export type AnilistPinFlowState = 'idle' | 'awaiting' | 'closed';

export interface AnilistPinTokenRecord {
  readonly token: string;
  readonly tabId: number;
}

/**
 * The tab the extension opened, and whether it is still there. A token is only ever read from the
 * tab this record names, so a pin page the user happened to open never binds the extension to an
 * account somebody else chose.
 */
export interface AnilistPinTabRecord {
  readonly tabId: number;
  readonly closed: boolean;
}

/** Storage is user-writable and outlives schema changes, so the shape is re-checked on read. */
export function readAnilistPinTokenRecord(value: unknown): AnilistPinTokenRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { token?: unknown; tabId?: unknown };
  if (typeof candidate.token !== 'string' || candidate.token.length === 0) return null;
  if (typeof candidate.tabId !== 'number' || !Number.isInteger(candidate.tabId)) return null;
  return { token: candidate.token, tabId: candidate.tabId };
}

export function readAnilistPinTabRecord(value: unknown): AnilistPinTabRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { tabId?: unknown; closed?: unknown };
  if (typeof candidate.tabId !== 'number' || !Number.isInteger(candidate.tabId)) return null;
  return { tabId: candidate.tabId, closed: candidate.closed === true };
}

/** Non-matching and malformed URLs are the normal case here, not errors, so nothing throws. */
export function extractAnilistPinToken(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || !url.startsWith(ANILIST_PIN_URL_PREFIX)) return null;
  try {
    const token = new URLSearchParams(url.slice(url.indexOf('#') + 1)).get('access_token');
    return token !== null && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}
