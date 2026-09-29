const PKCE_MIN_LENGTH = 43;
const PKCE_MAX_LENGTH = 128;
const PKCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
// Largest multiple of alphabet length that fits in a byte: 66 * 3 = 198 <= 255.
// Bytes >= 198 are rejected to eliminate modulo bias.
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

export async function createPkceTransaction(): Promise<{
  readonly state: string;
  readonly codeVerifier: string;
  readonly codeChallenge: string;
}> {
  const codeVerifier = createRandomString(64);
  if (codeVerifier.length < PKCE_MIN_LENGTH || codeVerifier.length > PKCE_MAX_LENGTH) {
    throw new Error('Generated PKCE verifier is outside the OAuth allowed length.');
  }
  // MAL currently supports only the RFC 7636 plain method. The challenge
  // must therefore be the verifier itself, not a SHA-256 digest.
  const codeChallenge = codeVerifier;
  return { state: createRandomString(32), codeVerifier, codeChallenge };
}
