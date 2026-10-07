import { describe, expect, it } from 'vitest';
import {
  ANILIST_PIN_URL_MATCH,
  ANILIST_PIN_URL_PREFIX,
  extractAnilistPinToken,
  readAnilistPinTokenRecord,
} from '../src/auth/anilist-pin';

describe('extractAnilistPinToken', () => {
  it('reads the token off a completed pin redirect', () => {
    expect(extractAnilistPinToken(`${ANILIST_PIN_URL_PREFIX}abc.def.ghi`)).toBe('abc.def.ghi');
  });

  it('keeps only the token when AniList appends more fragment parameters', () => {
    const url = `${ANILIST_PIN_URL_PREFIX}abc.def&token_type=Bearer&expires_in=31536000`;
    expect(extractAnilistPinToken(url)).toBe('abc.def');
  });

  it('ignores the pin page before authorization completes', () => {
    expect(extractAnilistPinToken('https://anilist.co/api/v2/oauth/pin')).toBeNull();
  });

  it('ignores an error redirect that carries no access token', () => {
    expect(
      extractAnilistPinToken('https://anilist.co/api/v2/oauth/pin#error=invalid_grant'),
    ).toBeNull();
  });

  it('ignores an empty access token', () => {
    expect(extractAnilistPinToken(ANILIST_PIN_URL_PREFIX)).toBeNull();
  });

  // A host permission check happens upstream, but a tab can still be anything the user has open.
  it('ignores URLs from unrelated sites', () => {
    expect(extractAnilistPinToken('https://evil.example/#access_token=stolen')).toBeNull();
  });

  it('tolerates missing input rather than throwing', () => {
    expect(extractAnilistPinToken(undefined)).toBeNull();
    expect(extractAnilistPinToken(null)).toBeNull();
    expect(extractAnilistPinToken('')).toBeNull();
  });
});

describe('readAnilistPinTokenRecord', () => {
  it('accepts a record carrying the originating tab', () => {
    expect(readAnilistPinTokenRecord({ token: 'abc', tabId: 7 })).toEqual({
      token: 'abc',
      tabId: 7,
    });
  });

  it('accepts a record without a tab', () => {
    expect(readAnilistPinTokenRecord({ token: 'abc' })).toEqual({ token: 'abc' });
  });

  it('rejects a non-string or empty token', () => {
    expect(readAnilistPinTokenRecord({ token: 42 })).toBeNull();
    expect(readAnilistPinTokenRecord({ token: '' })).toBeNull();
    expect(readAnilistPinTokenRecord(null)).toBeNull();
    expect(readAnilistPinTokenRecord('abc')).toBeNull();
  });

// Rejected outright rather than half-read, since the record feeds `tabs.update` and the caller's tab scan re-derives the token safely anyway.
  it('rejects the whole record when the tab id is not a number', () => {
    expect(readAnilistPinTokenRecord({ token: 'abc', tabId: '7' })).toBeNull();
    expect(readAnilistPinTokenRecord({ token: 'abc', tabId: null })).toBeNull();
  });
});

describe('pin url constants', () => {
  it('keeps the match pattern aligned with the prefix it filters on', () => {
    expect(ANILIST_PIN_URL_MATCH).toBe('https://anilist.co/api/v2/oauth/pin*');
    expect(ANILIST_PIN_URL_PREFIX.startsWith('https://anilist.co/api/v2/oauth/pin')).toBe(true);
  });
});
