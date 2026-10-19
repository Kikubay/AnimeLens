import { describe, expect, it } from 'vitest';
import type { Anime, AnimeListEntry } from '../src/domain/anime';
import {
  buildUserPreferenceProfile,
  featurePreferenceScore,
  generateRecommendations,
} from '../src/recommendations/recommendation-engine';

function anime(id: number, overrides: Partial<Anime> = {}): Anime {
  return {
    id,
    title: { default: `Anime ${id}`, english: null, japanese: null, synonyms: [] },
    synopsis: '',
    image: {
      medium: `https://cdn.test/${id}-medium.jpg`,
      large: `https://cdn.test/${id}-large.jpg`,
    },
    score: 8,
    userScore: null,
    genres: [{ id: 1, name: 'Action' }],
    themes: [],
    studios: [],
    staff: [],
    episodeCount: 12,
    year: 2024,
    season: 'spring',
    status: 'finished_airing',
    type: 'tv',
    popularity: 100,
    memberCount: 50_000,
    ...overrides,
  };
}

function entry(id: number, score: number, overrides: Partial<Anime> = {}): AnimeListEntry {
  const withScore = { ...anime(id, overrides), userScore: score };
  return {
    anime: withScore,
    status: 'completed',
    userScore: score,
    episodesWatched: 12,
    priority: null,
    isRewatching: false,
    updatedAt: null,
    notes: null,
  };
}

describe('featurePreferenceScore', () => {
  it('treats a feature the profile has never seen as neutral', () => {
    expect(featurePreferenceScore(undefined)).toBe(0.5);
  });

  it('still scores a feature the user pushed down below the midpoint', () => {
    // strength is -1/sqrt(4) = -0.5, so the score lands at 0.25 rather than the 0 an unseen key takes.
    const disliked = { positive: 0, negative: 1, count: 4 };

    expect(featurePreferenceScore(disliked)).toBeCloseTo(0.25, 10);
    expect(featurePreferenceScore(disliked)).toBeLessThan(featurePreferenceScore(undefined));
  });

  it('scores a feature the user pushed up above the midpoint', () => {
    const liked = { positive: 6, negative: 0, count: 6 };

    expect(featurePreferenceScore(liked)).toBeGreaterThan(0.5);
  });

  it('keeps an unknown format neutral so a TV-only library can still surface films', () => {
    // A profile built only from TV series has no entry for 'movie', and absence is not a verdict on it.
    const profile = buildUserPreferenceProfile(
      [entry(1, 9), entry(2, 9), entry(3, 8)],
      [],
      '2026-01-01T00:00:00.000Z',
    );

    expect(profile.types.size).toBe(1);
    expect(featurePreferenceScore(profile.types.get('movie'))).toBe(0.5);
    expect(featurePreferenceScore(profile.types.get('tv'))).toBeGreaterThan(0.5);
  });
});

describe('section minimums', () => {
  // A library the candidate pool cannot satisfy, so every section is short and has to be backfilled.
  const watched = Array.from({ length: 20 }, (_, index) => entry(index + 1, 9));
  const candidates = Array.from({ length: 60 }, (_, index) =>
    anime(1000 + index, {
      // Community-scored 3/10, so nothing here can honestly be called a hidden gem.
      score: 3,
      genres: [{ id: 900 + index, name: `Unrelated ${index}` }],
      memberCount: 8_000,
    }),
  );

  const result = generateRecommendations(
    { watched, candidates },
    { limit: 40, generatedAt: '2026-01-01T00:00:00.000Z' },
  );

  it('produces recommendations to assert against', () => {
    expect(result.length).toBeGreaterThan(0);
  });

  it('never labels a title the community scored below 7 a hidden gem', () => {
    const gems = result.filter((item) => item.category === 'hidden-gem');

    for (const gem of gems) {
      expect(gem.anime.score ?? 0).toBeGreaterThanOrEqual(7);
    }
  });

  it('never presents a title in the attributed band without a similarity reason', () => {
    const attributed = result.filter((item) => item.category === 'because-you-liked');

    for (const item of attributed) {
      expect(item.reasons.some((reason) => reason.kind === 'similarity')).toBe(true);
      expect(item.compatibilityScore).toBeGreaterThanOrEqual(50);
    }
  });

  it('never presents a title below the band floor as highly compatible', () => {
    for (const item of result.filter((entry) => entry.category === 'highly-compatible')) {
      expect(item.compatibilityScore).toBeGreaterThanOrEqual(70);
    }
  });

  it('leaves a section empty rather than filling it with an ineligible title', () => {
    // With every candidate community-scored 3, "hidden-gem" cannot be filled honestly at all.
    expect(result.some((item) => item.category === 'hidden-gem')).toBe(false);
  });
});
