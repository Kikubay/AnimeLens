import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_POOL_TTL_MS,
  createCandidatePoolStore,
} from '../src/recommendations/candidate-pool-store';
import {
  createDashboardSnapshotStore,
  dashboardSignature,
  type DashboardSignatureInput,
} from '../src/recommendations/recommendation-snapshot-store';
import type { SessionStorageArea } from '../src/storage/session-area';
import type { Anime } from '../src/domain/anime';
import type { RecommendationFeedback } from '../src/domain/feedback';
import { DEFAULT_USER_PREFERENCES } from '../src/settings/settings-types';
import type { DashboardRecommendationSnapshot } from '../src/recommendations/recommendation-messages';

class MemorySessionArea implements SessionStorageArea {
  readonly values = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function anime(id: number): Anime {
  return {
    id,
    title: { default: `Anime ${id}`, english: null, japanese: null, synonyms: [] },
    synopsis: null,
    image: null,
    score: 7,
    userScore: null,
    genres: [],
    themes: [],
    studios: [],
    staff: [],
    episodeCount: 12,
    year: 2024,
    season: 'spring',
    status: 'finished_airing',
    type: 'tv',
    popularity: 10,
    memberCount: null,
  };
}

function feedback(animeMalId: number, value: RecommendationFeedback['value'] = 'like') {
  return {
    recommendationId: `local-${animeMalId}`,
    animeMalId,
    value,
    createdAt: '2026-01-01T00:00:00.000Z',
  } as RecommendationFeedback;
}

function snapshot(analyzedCount = 3): DashboardRecommendationSnapshot {
  return {
    status: 'ready',
    daily: null,
    sections: [
      {
        id: 'highly-compatible',
        title: 'Highly Compatible',
        recommendations: [],
      },
    ],
    analyzedCount,
    generatedAt: '2026-01-01T00:00:00.000Z',
    sync: null,
    errorMessage: null,
  };
}

describe('candidate pool store', () => {
  it('serves a stored pool inside the TTL and refetches once it expires', async () => {
    const area = new MemorySessionArea();
    const store = createCandidatePoolStore(area);

    expect(await store.load('mal', 0)).toBeNull();
    await store.save('mal', [anime(1), anime(2)], 1_000);
    expect(await store.load('mal', 1_000 + CANDIDATE_POOL_TTL_MS - 1)).toHaveLength(2);
    expect(await store.load('mal', 1_000 + CANDIDATE_POOL_TTL_MS)).toBeNull();
  });

  it('never serves the previous account pool', async () => {
    const area = new MemorySessionArea();
    const store = createCandidatePoolStore(area);
    await store.save('mal', [anime(1)], 1_000);

    expect(await store.load('anilist', 1_100)).toBeNull();
    expect(await store.load('mal', 1_100)).toHaveLength(1);
  });

  it('treats a rejected blob as a miss instead of throwing', async () => {
    const area = new MemorySessionArea();
    const store = createCandidatePoolStore(area);
    for (const junk of [
      null,
      'pool',
      42,
      { providerId: 'mal' },
      { providerId: 'mal', fetchedAt: 'now', pool: [] },
    ]) {
      area.values.set('candidatePool', junk);
      expect(await store.load('mal', 1_000)).toBeNull();
    }
  });

  it('drops the stored pool on clear', async () => {
    const area = new MemorySessionArea();
    const store = createCandidatePoolStore(area);
    await store.save('mal', [anime(1)], 1_000);
    await store.clear();
    expect(await store.load('mal', 1_100)).toBeNull();
  });
});

describe('dashboard signature', () => {
  const base = {
    providerId: 'mal',
    cacheVersion: 6,
    cachedAt: '2026-01-01T00:00:00.000Z',
    pool: [anime(1), anime(2)],
    preferences: DEFAULT_USER_PREFERENCES,
    feedback: [] as readonly RecommendationFeedback[],
  };

  it('is stable for identical inputs', () => {
    expect(dashboardSignature(base)).toBe(dashboardSignature({ ...base }));
  });

  it('changes when any input that feeds the build changes', () => {
    const signature = dashboardSignature(base);
    const variants: DashboardSignatureInput[] = [
      { ...base, providerId: 'anilist' },
      { ...base, cacheVersion: 5 },
      { ...base, cachedAt: '2026-01-02T00:00:00.000Z' },
      { ...base, pool: [anime(1)] },
      { ...base, pool: [anime(2), anime(1)] },
      { ...base, preferences: { ...DEFAULT_USER_PREFERENCES, includeMovies: false } },
      { ...base, preferences: { ...DEFAULT_USER_PREFERENCES, language: 'fr' } },
      { ...base, feedback: [feedback(1)] },
      { ...base, feedback: [feedback(2)] },
      { ...base, feedback: [feedback(1, 'dislike')] },
    ];
    for (const variant of variants) {
      expect(
        dashboardSignature(variant),
        JSON.stringify(variant.pool.map((item) => item.id)),
      ).not.toBe(signature);
    }
  });

  it('does not confuse two different pools', () => {
    expect(dashboardSignature({ ...base, pool: [anime(1), anime(23)] })).not.toBe(
      dashboardSignature({ ...base, pool: [anime(12), anime(3)] }),
    );
  });
});

describe('dashboard snapshot store', () => {
  it('serves a snapshot for a matching signature inside the TTL', async () => {
    const area = new MemorySessionArea();
    const store = createDashboardSnapshotStore(area);

    expect(await store.load('abc', 1_000)).toBeNull();
    await store.save('abc', snapshot(), 1_000);
    expect((await store.load('abc', 1_100))?.analyzedCount).toBe(3);
    expect(await store.load('other', 1_100)).toBeNull();
  });

  it('refetches once the TTL has passed', async () => {
    const area = new MemorySessionArea();
    const store = createDashboardSnapshotStore(area);
    await store.save('abc', snapshot(), 0);
    expect(await store.load('abc', Number.MAX_SAFE_INTEGER)).toBeNull();
  });

  it('treats a rejected blob as a miss', async () => {
    const area = new MemorySessionArea();
    const store = createDashboardSnapshotStore(area);
    for (const junk of [
      null,
      7,
      { signature: 'abc' },
      { signature: 'abc', storedAt: 1 },
      { signature: 'abc', storedAt: 1, snapshot: { status: 'nope' } },
    ]) {
      area.values.set('dashboardSnapshot', junk);
      expect(await store.load('abc', 1_000)).toBeNull();
    }
  });
});
