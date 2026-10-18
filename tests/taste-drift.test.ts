import { describe, expect, it } from 'vitest';
import {
  buildUserPreferenceProfile,
  scoreRecommendation,
} from '../src/recommendations/recommendation-engine';
import { TASTE_DECAY_HALF_LIFE_MS } from '../src/recommendations/taste-decay';
import { createFeedback, type RecommendationFeedback } from '../src/domain/feedback';
import type { Anime, AnimeListEntry } from '../src/domain/anime';

const NOW = '2026-10-01T00:00:00.000Z';
const HALF_LIFE_AGO = new Date(Date.parse(NOW) - TASTE_DECAY_HALF_LIFE_MS).toISOString();
/** Old enough that five decayed entries stop saturating the feature score. */
const LONG_AGO = '2018-10-01T00:00:00.000Z';
const DECAYED_WEIGHT = 0.5;

function anime(id: number, genre: string, score: number): Anime {
  return {
    id,
    title: { default: `Title ${id}`, english: null, japanese: null, synonyms: [] },
    synopsis: null,
    image: null,
    score,
    userScore: null,
    genres: [{ id, name: genre }],
    themes: [],
    studios: [],
    staff: [],
    episodeCount: 12,
    year: 2024,
    season: 'spring',
    status: 'finished_airing',
    type: 'tv',
    popularity: null,
    memberCount: null,
  };
}

function entry(
  id: number,
  genre: string,
  updatedAt: string | null,
  userScore = 10,
): AnimeListEntry {
  return {
    anime: anime(id, genre, 8),
    status: 'completed',
    userScore,
    episodesWatched: 12,
    priority: null,
    isRewatching: false,
    updatedAt,
    notes: null,
  };
}

function genreScore(profile: ReturnType<typeof buildUserPreferenceProfile>, genre: string): number {
  return scoreRecommendation(anime(900, genre, 8), profile).featureScores.genres ?? 0;
}

describe('taste drift', () => {
  it('lets a recent taste outrank an older taste that had more evidence behind it', () => {
    const profile = buildUserPreferenceProfile(
      [
        ...Array.from({ length: 5 }, (_, index) => entry(index + 1, 'Shounen', LONG_AGO)),
        ...Array.from({ length: 2 }, (_, index) => entry(index + 50, 'Cyberpunk', NOW)),
      ],
      [],
      NOW,
    );

    expect(genreScore(profile, 'Cyberpunk')).toBeGreaterThan(genreScore(profile, 'Shounen'));
  });

  it('leaves an unranked, undated library untouched rather than hollowing it out', () => {
    const profile = buildUserPreferenceProfile(
      [
        ...Array.from({ length: 5 }, (_, index) => entry(index + 1, 'Shounen', HALF_LIFE_AGO)),
        ...Array.from({ length: 5 }, (_, index) => entry(index + 20, 'Action', null)),
      ],
      [],
      NOW,
    );

    expect(profile.genres.get('action')?.count).toBe(5);
  });

  it('scales evidence and observation count together, so displayed shares do not shift', () => {
    const fresh = buildUserPreferenceProfile([entry(1, 'Fantasy', NOW)], [], NOW);
    const stale = buildUserPreferenceProfile([entry(1, 'Fantasy', HALF_LIFE_AGO)], [], NOW);

    const share = (profile: ReturnType<typeof buildUserPreferenceProfile>): number =>
      (profile.genres.get('fantasy')?.positive ?? 0) / (profile.genres.get('fantasy')?.count ?? 1);

    expect(share(stale)).toBeCloseTo(share(fresh), 6);
    expect(stale.genres.get('fantasy')?.count).toBeCloseTo(DECAYED_WEIGHT, 6);
  });

  it('lets a fresh dislike suppress a genre more than an ancient one', () => {
    const recent = buildUserPreferenceProfile([], [dislike('Fantasy', NOW)], NOW);
    const old = buildUserPreferenceProfile([], [dislike('Fantasy', HALF_LIFE_AGO)], NOW);

    expect(recent.genres.get('fantasy')?.negative).toBeCloseTo(0.5, 6);
    expect(old.genres.get('fantasy')?.negative).toBeCloseTo(0.25, 6);
    expect(genreScore(recent, 'Fantasy')).toBeLessThan(genreScore(old, 'Fantasy'));
  });

  it('keeps a deliberate dislike ahead of an abandoned show', () => {
    const disliked = buildUserPreferenceProfile([], [dislike('Fantasy', NOW)], NOW);
    const dropped = buildUserPreferenceProfile([], [], NOW);

    const abandoned = buildUserPreferenceProfile(
      [{ ...entry(1, 'Fantasy', NOW), status: 'dropped', userScore: null }],
      [],
      NOW,
    );

    expect(disliked.genres.get('fantasy')?.negative ?? 0).toBeGreaterThan(
      abandoned.genres.get('fantasy')?.negative ?? 0,
    );
    expect(genreScore(disliked, 'Fantasy')).toBeLessThan(genreScore(dropped, 'Fantasy'));
  });

  it('still lets a low rating outweigh a swipe', () => {
    const disliked = buildUserPreferenceProfile([], [dislike('Fantasy', NOW)], NOW);
    const rated = buildUserPreferenceProfile([entry(1, 'Fantasy', NOW, 2)], [], NOW);

    expect(rated.genres.get('fantasy')?.negative ?? 0).toBeGreaterThan(
      disliked.genres.get('fantasy')?.negative ?? 0,
    );
  });
});

function dislike(genre: string, createdAt: string): RecommendationFeedback {
  return createFeedback('r-1', anime(1, genre, 8), 'dislike', createdAt);
}
