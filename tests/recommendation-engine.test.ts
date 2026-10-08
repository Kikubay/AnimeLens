import { describe, expect, it } from 'vitest';
import { scoreRecommendation } from '../src/recommendations/recommendation-engine';
import type { Anime } from '../src/domain/anime';
import type { UserTasteProfile } from '../src/domain/user-profile';

const anime: Anime = {
  id: 1,
  title: {
    default: 'Signal Horizon',
    english: null,
    japanese: null,
    synonyms: [],
  },
  synopsis: null,
  image: null,
  score: 8,
  userScore: null,
  genres: [{ id: 1, name: 'Sci-Fi' }],
  themes: [],
  studios: [],
  staff: [],
  episodeCount: 12,
  year: 2025,
  season: 'spring',
  status: 'finished_airing',
  type: 'tv',
  popularity: null,
  memberCount: null,
};

const profile: UserTasteProfile = {
  preferredGenres: new Map([['Sci-Fi', 1]]),
  preferredFormats: new Map([['tv', 1]]),
  averageScore: 8,
  ratedAnimeCount: 4,
};

describe('scoreRecommendation', () => {
  it('returns a bounded compatibility score with explanations', () => {
    const score = scoreRecommendation(anime, profile);

    expect(score.normalized).toBeGreaterThanOrEqual(0);
    expect(score.normalized).toBeLessThanOrEqual(100);
    expect(score.reasons.length).toBeGreaterThan(0);
  });

  it('still scores a legacy taste profile, which the old adapter maps onto the current shape', () => {
    const score = scoreRecommendation(anime, profile, {
      weights: {
        genres: 1,
        themes: 0,
        studios: 0,
        staff: 0,
        type: 0,
        season: 0,
        year: 0,
        quality: 0,
        popularity: 0,
      },
    });

    expect(score.featureScores.genres).toBeGreaterThan(0.5);
    expect(score.confidence).toBeGreaterThan(0);
  });
});
