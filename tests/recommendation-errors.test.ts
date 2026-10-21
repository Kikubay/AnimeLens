import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/api-errors';
import { recommendationErrorMessage } from '../src/recommendations/recommendation-errors';
import { getCopy } from '../src/locales';

const copy = getCopy('en');

describe('recommendation error message', () => {
  it('names the provider when the provider cannot be reached', () => {
    const outage = new ApiError('Every candidate source failed for the active provider.', {
      code: 'network_error',
    });

    expect(recommendationErrorMessage(outage, 'AniList', copy)).toBe(
      'AniList is temporarily unavailable. Try again in a moment.',
    );
  });

  it('names the provider for a rate limit and for a refusal', () => {
    for (const code of ['rate_limited', 'forbidden'] as const) {
      const error = new ApiError('The provider refused the request.', { code });

      expect(recommendationErrorMessage(error, 'MyAnimeList', copy)).toBe(
        'MyAnimeList is temporarily unavailable. Try again in a moment.',
      );
    }
  });

  it('reports an expired session as such instead of an outage', () => {
    const error = new ApiError('The session expired.', { code: 'unauthorized' });

    expect(recommendationErrorMessage(error, 'AniList', copy)).toBe(
      copy.listSessionExpired('AniList'),
    );
  });

  it('falls back to the generic sentence for a failure it cannot name', () => {
    expect(recommendationErrorMessage(new Error('boom'), 'AniList', copy)).toBe(
      'Recommendations unavailable',
    );
    expect(recommendationErrorMessage(null, 'AniList', copy)).toBe('Recommendations unavailable');
  });

  it('reads the code structurally, so a rebuilt error still lands on the right sentence', () => {
    const rebuilt = { code: 'network_error', message: 'Every candidate source failed.' };

    expect(recommendationErrorMessage(rebuilt, 'AniList', copy)).toBe(
      'AniList is temporarily unavailable. Try again in a moment.',
    );
  });
});
