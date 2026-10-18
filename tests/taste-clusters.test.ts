import { describe, expect, it } from 'vitest';
import { buildTasteClusters, TASTE_MIN_FEATURE_SCORE } from '../src/recommendations/taste-clusters';
import type {
  FeaturePreferenceMap,
  RecommendationProfile,
} from '../src/recommendations/recommendation-types';

function preference(
  positive: number,
  negative: number,
  count: number,
): { positive: number; negative: number; count: number } {
  return { positive, negative, count };
}

function profile(
  genres: FeaturePreferenceMap,
  themes: FeaturePreferenceMap = new Map(),
): RecommendationProfile {
  return {
    genres,
    themes,
    studios: new Map(),
    staff: new Map(),
    types: new Map(),
    seasons: new Map(),
    years: new Map(),
    averageScore: null,
    ratedAnimeCount: 0,
    sourceAnimeCount: 0,
    feedbackCount: 0,
  };
}

describe('buildTasteClusters', () => {
  it('groups the strongest genres into tag clusters instead of listing them singly', () => {
    const clusters = buildTasteClusters(
      profile(
        new Map([
          ['sci-fi', preference(12, 0, 6)],
          ['action', preference(9, 0, 5)],
          ['mystery', preference(6, 0, 3)],
          ['comedy', preference(3, 0, 2)],
        ]),
      ),
    );

    expect(clusters.clusters[0]).toEqual(['sci-fi', 'action', 'mystery']);
    expect(clusters.seed).toBe('sci-fi,action,mystery|comedy');
  });

  it('falls back to a single cluster when nothing is above the neutrality floor', () => {
    const clusters = buildTasteClusters(
      profile(
        new Map([
          ['comedy', preference(1, 1, 2)],
          ['horror', preference(0, 9, 3)],
        ]),
      ),
    );

    expect(clusters.clusters).toEqual([]);
    expect(clusters.seed).toBe('');
  });

  it('ranks by evidence strength, not by a score that saturates at 1 for every liked feature', () => {
    const clusters = buildTasteClusters(
      profile(
        new Map([
          ['mystery', preference(8, 0, 2)],
          ['action', preference(40, 0, 40)],
          ['sci-fi', preference(16, 0, 4)],
        ]),
      ),
    );

    expect(clusters.clusters[0]).toEqual(['sci-fi', 'action', 'mystery']);
  });

  it('only offers the same feature once, so a genre never wastes a whole request', () => {
    const clusters = buildTasteClusters(
      profile(
        new Map([
          ['a', preference(20, 0, 10)],
          ['b', preference(18, 0, 9)],
          ['c', preference(16, 0, 8)],
          ['d', preference(14, 0, 7)],
        ]),
        new Map([['a', preference(20, 0, 10)]]),
      ),
    );

    const flattened = clusters.clusters.flat();
    expect(new Set(flattened).size).toBe(flattened.length);
  });

  it('produces a stable seed for the same profile and a different one when the taste changes', () => {
    const genres = new Map([
      ['sci-fi', preference(12, 0, 6)],
      ['action', preference(9, 0, 5)],
    ]);
    const shifted = new Map(genres);
    shifted.set('fantasy', preference(30, 0, 15));

    expect(buildTasteClusters(profile(genres)).seed).toBe(buildTasteClusters(profile(genres)).seed);
    expect(buildTasteClusters(profile(shifted)).seed).not.toBe(
      buildTasteClusters(profile(genres)).seed,
    );
  });

  it('keeps the floor above the neutral score so a passive profile costs nothing', () => {
    expect(TASTE_MIN_FEATURE_SCORE).toBeGreaterThan(0.5);
    const clusters = buildTasteClusters(profile(new Map([['neutral', preference(4, 4, 8)]])));
    expect(clusters.clusters).toEqual([]);
  });
});
