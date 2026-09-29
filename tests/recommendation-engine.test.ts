import { describe, expect, it } from 'vitest';
import { scoreAnime } from '../src/recommendations/recommendation-engine';
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

describe('scoreAnime', () => {
  it('returns a bounded compatibility score with explanations', () => {
    const recommendation = scoreAnime(anime, profile);

    expect(recommendation.compatibilityScore).toBeGreaterThanOrEqual(0);
    expect(recommendation.compatibilityScore).toBeLessThanOrEqual(100);
    expect(recommendation.reasons.length).toBeGreaterThan(0);
  });
});
