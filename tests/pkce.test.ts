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
  it('sends the verifier verbatim, because MAL only supports the plain method', async () => {
    const transaction = await createPkceTransaction();

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
