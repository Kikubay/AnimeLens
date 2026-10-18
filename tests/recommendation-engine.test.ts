import { describe, expect, it } from 'vitest';
import {
  buildUserPreferenceProfile,
  scoreRecommendation,
} from '../src/recommendations/recommendation-engine';
import type { Anime, AnimeListEntry } from '../src/domain/anime';
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

const QUALITY_ONLY_WEIGHTS = {
  genres: 0,
  themes: 0,
  studios: 0,
  staff: 0,
  type: 0,
  season: 0,
  year: 0,
  quality: 1,
  popularity: 0,
} as const;

function entry(id: number, communityScore: number, userScore: number): AnimeListEntry {
  return {
    anime: {
      ...anime,
      id,
      score: communityScore,
      title: { ...anime.title, default: `Seen ${id}` },
    },
    status: 'completed',
    userScore,
    episodesWatched: 12,
    priority: null,
    isRewatching: false,
    updatedAt: null,
    notes: null,
  };
}

/** Models a rater who consistently scores a fixed amount above or below the community. */
function raterLibrary(
  offset: number,
  communities: readonly number[] = RATED_COMMUNITY_TIERS,
): readonly AnimeListEntry[] {
  return communities.map((communityScore, index) =>
    entry(index + 1, communityScore, communityScore + offset),
  );
}

const RATED_COMMUNITY_TIERS: readonly number[] = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];

describe('quality calibration against the user rating scale', () => {
  it('scores the same title differently for a generous and a harsh rater', () => {
    const candidate = { ...anime, score: 8.1 };
    const generous = scoreRecommendation(candidate, buildUserPreferenceProfile(raterLibrary(1.5)), {
      weights: QUALITY_ONLY_WEIGHTS,
    });
    const harsh = scoreRecommendation(candidate, buildUserPreferenceProfile(raterLibrary(-1.5)), {
      weights: QUALITY_ONLY_WEIGHTS,
    });

    expect(generous.featureScores.quality).toBeCloseTo(0.96, 5);
    expect(harsh.featureScores.quality).toBeCloseTo(0.66, 5);
    expect(generous.normalized).toBeGreaterThan(harsh.normalized);
  });

  it('leaves an identity-rating library on the raw community scale', () => {
    const candidate = { ...anime, score: 8.1 };
    const average = scoreRecommendation(candidate, buildUserPreferenceProfile(raterLibrary(0)), {
      weights: QUALITY_ONLY_WEIGHTS,
    });

    expect(average.featureScores.quality).toBeCloseTo(0.81, 5);
  });

  it('falls back to the raw community score when there are too few ratings to learn a scale', () => {
    const thin = buildUserPreferenceProfile(raterLibrary(1.5).slice(0, 3));
    expect(thin.ratingModel).toBeNull();

    const candidate = { ...anime, score: 7.6 };
    const score = scoreRecommendation(candidate, thin, { weights: QUALITY_ONLY_WEIGHTS });

    expect(score.featureScores.quality).toBeCloseTo(0.76, 5);
  });

  it('measures the rating bar against the community tier the user actually rates, not their mean rating', () => {
    const candidate = { ...anime, score: 8.1 };
    const generous = scoreRecommendation(candidate, buildUserPreferenceProfile(raterLibrary(1.5)));
    const selective = scoreRecommendation(
      candidate,
      buildUserPreferenceProfile(raterLibrary(-1, [8.5, 8.7, 8.9, 9.1, 9.3, 9.5, 9.7, 9.9])),
    );

    // Both rate the same spread of titles; only the community tier underneath it differs.
    expect(generous.reasons.some((reason) => reason.kind === 'rating')).toBe(true);
    expect(selective.reasons.some((reason) => reason.kind === 'rating')).toBe(false);
  });
});
