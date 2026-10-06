import { describe, expect, it } from 'vitest';
import { isRetryableStatus, parseRetryAfterSeconds } from '../src/api/retry-after';

const NOW = Date.parse('2026-10-21T07:00:00Z');

describe('parseRetryAfterSeconds', () => {
  it('reads the delta-seconds form', () => {
    expect(parseRetryAfterSeconds('30', NOW)).toBe(30);
    expect(parseRetryAfterSeconds('0', NOW)).toBe(0);
  });

  it('reads the HTTP-date form as a delay relative to now', () => {
    expect(parseRetryAfterSeconds('Wed, 21 Oct 2026 07:00:30 GMT', NOW)).toBe(30);
    expect(parseRetryAfterSeconds('Wed, 21 Oct 2026 07:02:00 GMT', NOW)).toBe(120);
  });

  it('clamps a date already in the past to zero instead of a negative wait', () => {
    expect(parseRetryAfterSeconds('Wed, 21 Oct 2026 06:59:00 GMT', NOW)).toBe(0);
  });

  it('rejects unparseable and partial values rather than guessing', () => {
    expect(parseRetryAfterSeconds(null, NOW)).toBeNull();
    expect(parseRetryAfterSeconds(undefined, NOW)).toBeNull();
    expect(parseRetryAfterSeconds('', NOW)).toBeNull();
    expect(parseRetryAfterSeconds('   ', NOW)).toBeNull();
    expect(parseRetryAfterSeconds('soon', NOW)).toBeNull();
    // A partial numeric match would produce a plausible but wrong delay.
    expect(parseRetryAfterSeconds('30, then', NOW)).toBeNull();
    expect(parseRetryAfterSeconds('1e3', NOW)).toBeNull();
    expect(parseRetryAfterSeconds('-5', NOW)).toBeNull();
  });
});

describe('isRetryableStatus', () => {
  it('accepts 408, 429 and the 5xx range', () => {
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(599)).toBe(true);
  });

  it('rejects client errors and absent statuses', () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);
    expect(isRetryableStatus(600)).toBe(false);
    expect(isRetryableStatus(null)).toBe(false);
    expect(isRetryableStatus(undefined)).toBe(false);
  });
});