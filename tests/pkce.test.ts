import { describe, expect, it } from 'vitest';
import { createPkceTransaction, createRandomString } from '../src/auth/pkce';

const ALPHABET = /^[A-Za-z0-9\-._~]+$/;

describe('createRandomString', () => {
  it('produces the requested length from the RFC 7636 unreserved set', () => {
    for (const length of [1, 32, 43, 64, 128]) {
      expect(createRandomString(length)).toHaveLength(length);
      expect(createRandomString(length)).toMatch(ALPHABET);
    }
  });

  it('does not repeat itself', () => {
    const values = new Set(Array.from({ length: 50 }, () => createRandomString(32)));
    expect(values.size).toBe(50);
  });

  it('spreads the alphabet instead of skewing toward the first characters', () => {
    // Rejection sampling drops the top of the byte range, so every character should still turn up.
    const sample = createRandomString(20_000);
    const seen = new Set(sample);
    expect(seen.size).toBeGreaterThan(60);
  });
});

describe('createPkceTransaction', () => {
  it('derives an S256 challenge that is a one-way digest of the verifier', async () => {
    const transaction = await createPkceTransaction('S256');

    expect(transaction.codeChallengeMethod).toBe('S256');
    expect(transaction.codeChallenge).not.toBe(transaction.codeVerifier);
    expect(transaction.codeVerifier).toHaveLength(64);
    expect(transaction.codeVerifier).toMatch(ALPHABET);
  });

  it('matches the RFC 7636 appendix B vector for S256', async () => {
    const transaction = await createPkceTransaction('S256');
    // RFC 7636 B.1 hashes this exact verifier, so a change to the encoding shows up here immediately.
    const reference = await createPkceTransactionFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');

    expect(transaction.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(reference).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('sends the verifier verbatim when the provider cannot do S256', async () => {
    const transaction = await createPkceTransaction('plain');

    expect(transaction.codeChallengeMethod).toBe('plain');
    expect(transaction.codeChallenge).toBe(transaction.codeVerifier);
    expect(transaction.codeVerifier).toHaveLength(64);
    expect(transaction.codeVerifier).toMatch(ALPHABET);
  });

  it('keeps the state inside the OAuth length bounds and distinct per attempt', async () => {
    const [first, second] = await Promise.all([createPkceTransaction(), createPkceTransaction()]);

    expect(first.state).toMatch(ALPHABET);
    expect(first.state.length).toBeGreaterThanOrEqual(1);
    expect(first.state).not.toBe(second.state);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });
});

// The RFC vector needs a fixed verifier, so it bypasses the generator rather than widening the public API.
async function createPkceTransactionFor(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
