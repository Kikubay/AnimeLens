import type { PkceChallengeMethod } from './auth-types';

const PKCE_MIN_LENGTH = 43;
const PKCE_MAX_LENGTH = 128;
const PKCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
// Bytes at or above 198 (66 * 3) are dropped, otherwise `% 66` skews the distribution.
const ALPHABET_MULTIPLE = PKCE_ALPHABET.length * Math.floor(256 / PKCE_ALPHABET.length);

export function createRandomString(length = 64): string {
  const bytes = new Uint8Array(length);
  let filled = 0;
  while (filled < length) {
    const chunk = new Uint8Array(length - filled);
    crypto.getRandomValues(chunk);
    for (const byte of chunk) {
      if (byte >= ALPHABET_MULTIPLE) continue;
      bytes[filled] = byte % PKCE_ALPHABET.length;
      filled += 1;
      if (filled === length) break;
    }
  }
  return Array.from(bytes, (index) => PKCE_ALPHABET[index]).join('');
}

export async function createPkceTransaction(method: PkceChallengeMethod = 'S256'): Promise<{
  readonly state: string;
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: PkceChallengeMethod;
}> {
  const codeVerifier = createRandomString(64);
  if (codeVerifier.length < PKCE_MIN_LENGTH || codeVerifier.length > PKCE_MAX_LENGTH) {
    throw new Error('Generated PKCE verifier is outside the OAuth allowed length.');
  }
  // `plain` ships the verifier in the clear, so it is only ever chosen for a provider that cannot do
  // S256; anything else binds the authorization code to this client through a one-way digest.
  const codeChallenge = method === 'S256' ? await deriveS256Challenge(codeVerifier) : codeVerifier;
  return {
    state: createRandomString(32),
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: method,
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function deriveS256Challenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
}
