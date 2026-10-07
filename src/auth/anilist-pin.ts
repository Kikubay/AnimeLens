/** AniList hands back the token in a URL fragment the extension can't intercept, and the popup closes the moment you click that tab — so the background has to catch it. */
export const ANILIST_PIN_URL_PREFIX = 'https://anilist.co/api/v2/oauth/pin#access_token=';

/** Match pattern form of the same page, for `tabs.query`. */
export const ANILIST_PIN_URL_MATCH = 'https://anilist.co/api/v2/oauth/pin*';

/** Session-scoped rather than local, since the token is single-use and must not outlive the browser session. */
export const ANILIST_PIN_TOKEN_KEY = 'anilistPinToken';

/** Where the pin tab is sent once its token has been spent, so the URL stops holding it. */
export const ANILIST_HOME_URL = 'https://anilist.co/';

export interface AnilistPinTokenRecord {
  readonly token: string;
  /** Absent when the token came from a scan of already-open tabs rather than a live navigation. */
  readonly tabId?: number;
}

/** Storage is user-writable and outlives schema changes, so the shape is re-checked on read. */
export function readAnilistPinTokenRecord(value: unknown): AnilistPinTokenRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { token?: unknown; tabId?: unknown };
  if (typeof candidate.token !== 'string' || candidate.token.length === 0) return null;
  if (candidate.tabId === undefined) return { token: candidate.token };
  return typeof candidate.tabId === 'number'
    ? { token: candidate.token, tabId: candidate.tabId }
    : null;
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
