import { describe, expect, it } from 'vitest';
import type { Anime } from '../src/domain/anime';
import { createFeedback, type RecommendationFeedback } from '../src/domain/feedback';
import { RecommendationFeedbackService, NOT_NOW_TTL_MS } from '../src/feedback/feedback-service';
import type { FeedbackStore } from '../src/feedback/feedback-store';
import {
  buildUserPreferenceProfile,
  generateRecommendations,
  scoreRecommendation,
} from '../src/recommendations/recommendation-engine';

function anime(id: number, genre = 'Fantasy'): Anime {
  return {
    id: id,
    title: { default: `Anime ${id}`, english: null, japanese: null, synonyms: [] },
    synopsis: null,
    image: null,
    score: 8,
    userScore: null,
    genres: [{ id: id, name: genre }],
    themes: [{ id: id, name: 'Adventure' }],
    studios: [{ id: id, name: 'Studio' }],
    staff: [],
    episodeCount: 12,
    year: 2024,
    season: 'spring',
    status: 'finished_airing',
    type: 'tv',
    popularity: 100,
    memberCount: 10_000,
  };
}

class MemoryFeedbackStore implements FeedbackStore {
  values: RecommendationFeedback[] = [];

  async list(): Promise<readonly RecommendationFeedback[]> {
    return this.values;
  }

  async save(feedback: RecommendationFeedback): Promise<void> {
    this.values = [
      ...this.values.filter((item) => item.recommendationId !== feedback.recommendationId),
      feedback,
    ];
  }

  async remove(recommendationId: string): Promise<void> {
    this.values = this.values.filter((item) => item.recommendationId !== recommendationId);
  }
}

describe('RecommendationFeedbackService', () => {
  it('stores like, dislike, seen, and not-now actions with feature snapshots', async () => {
    const store = new MemoryFeedbackStore();
    const now = new Date('2026-09-09T12:00:00.000Z');
    const service = new RecommendationFeedbackService(store, () => now);
    const values = ['like', 'dislike', 'seen', 'not_now'] as const;

    for (const [index, value] of values.entries()) {
      await service.submit(`recommendation-${index}`, anime(index + 1), value);
    }

    expect(store.values.map((item) => item.value)).toEqual(values);
    expect(store.values[0]?.features?.genres).toEqual(['Fantasy']);
    expect(store.values[3]?.expiresAt).toBe(new Date(now.getTime() + NOT_NOW_TTL_MS).toISOString());
    expect((await service.list()).length).toBe(4);
  });

  it('replaces a previous decision for the same recommendation and can remove it', async () => {
    const store = new MemoryFeedbackStore();
    const service = new RecommendationFeedbackService(
      store,
      () => new Date('2026-09-09T12:00:00.000Z'),
    );

    await service.submit('recommendation-1', anime(1), 'dislike');
    await service.submit('recommendation-1', anime(1), 'like');
    expect(store.values).toHaveLength(1);
    expect(store.values[0]?.value).toBe('like');

    await service.clear('recommendation-1');
    expect(store.values).toEqual([]);
  });

  it('hides an expired not-now action from the active feedback set', async () => {
    const store = new MemoryFeedbackStore();
    let now = new Date('2026-09-09T12:00:00.000Z');
    const service = new RecommendationFeedbackService(store, () => now);
    await service.submit('recommendation-1', anime(1), 'not_now');

    now = new Date(now.getTime() + NOT_NOW_TTL_MS + 1);
    expect(await service.list()).toEqual([]);
  });
});

describe('feedback-aware recommendations', () => {
  it('reduces a shared genre progressively without making one dislike an absolute genre ban', () => {
    const candidate = anime(100, 'Fantasy');
    const oneDislike = createFeedback(
      'r-1',
      anime(1, 'Fantasy'),
      'dislike',
      '2026-09-09T00:00:00.000Z',
    );
    const threeDislikes = [1, 2, 3].map((id) =>
      createFeedback(`r-${id}`, anime(id, 'Fantasy'), 'dislike', '2026-09-09T00:00:00.000Z'),
    );
    const oneProfile = buildUserPreferenceProfile([], [oneDislike]);
    const threeProfile = buildUserPreferenceProfile([], threeDislikes);
    const neutralScore = scoreRecommendation(candidate, buildUserPreferenceProfile([]));
    const oneScore = scoreRecommendation(candidate, oneProfile);
    const threeScore = scoreRecommendation(candidate, threeProfile);

    expect(oneScore.normalized).toBeLessThan(neutralScore.normalized);
    expect(oneScore.normalized).toBeGreaterThan(0);
    expect(threeScore.normalized).toBeLessThan(oneScore.normalized);

    const recommendations = generateRecommendations({
      watched: [],
      candidates: [candidate],
      feedback: [oneDislike],
    });
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.compatibilityScore).toBe(oneScore.normalized);
  });

  it('applies selected dislike reasons only to the selected feature dimensions', () => {
    const reasonedDislike = createFeedback(
      'r-reasoned',
      anime(1, 'Romance'),
      'dislike',
      '2026-09-09T00:00:00.000Z',
      { reasons: [{ kind: 'genre', name: 'Romance' }] },
    );
    const profile = buildUserPreferenceProfile([], [reasonedDislike]);
    const romance = scoreRecommendation(anime(2, 'Romance'), profile);
    const fantasy = scoreRecommendation(anime(3, 'Fantasy'), profile);

    expect(profile.genres.get('romance')?.negative).toBeCloseTo(0.25);
    expect(profile.themes.get('adventure')).toBeUndefined();
    expect(romance.normalized).toBeLessThan(fantasy.normalized);

    const result = generateRecommendations({
      watched: [],
      candidates: [anime(1, 'Romance'), anime(4, 'Fantasy')],
      feedback: [reasonedDislike],
    });
    expect(result.map((item) => item.anime.id)).toEqual([4]);
  });

  it('uses likes as positive signals and excludes seen and active not-now anime', () => {
    const liked = createFeedback('like', anime(1, 'Mystery'), 'like', '2026-09-09T00:00:00.000Z');
    const seen = createFeedback('seen', anime(2, 'Drama'), 'seen', '2026-09-09T00:00:00.000Z');
    const notNow = createFeedback(
      'later',
      anime(3, 'Comedy'),
      'not_now',
      '2026-09-09T00:00:00.000Z',
      { expiresAt: '2026-12-01T00:00:00.000Z' },
    );
    const result = generateRecommendations(
      {
        watched: [],
        candidates: [
          anime(1, 'Mystery'),
          anime(2, 'Drama'),
          anime(3, 'Comedy'),
          anime(4, 'Mystery'),
        ],
        feedback: [liked, seen, notNow],
      },
      { now: '2026-09-09T12:00:00.000Z', generatedAt: '2026-09-09T12:00:00.000Z' },
    );

    expect(result.map((item) => item.anime.id)).toEqual([1, 4]);
  });

  it('does not let expired not-now feedback exclude a candidate', () => {
    const expired = createFeedback('later', anime(1), 'not_now', '2026-01-01T00:00:00.000Z', {
      expiresAt: '2026-02-01T00:00:00.000Z',
    });
    const result = generateRecommendations(
      { watched: [], candidates: [anime(1)], feedback: [expired] },
      { now: '2026-09-09T12:00:00.000Z' },
    );

    expect(result).toHaveLength(1);
  });
});
