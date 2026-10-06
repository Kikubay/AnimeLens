import { describe, expect, it } from 'vitest';
import type { Anime, AnimeListEntry } from '../src/domain/anime';
import {
  buildDashboardRecommendationSnapshot,
  createEmptyDashboardRecommendationSnapshot,
} from '../src/recommendations/recommendation-dashboard';
import type { SyncMetadata } from '../src/domain/sync';

function anime(id: number, genres: readonly string[], memberCount = 50_000): Anime {
  return {
    id: id,
    title: { default: `Anime ${id}`, english: null, japanese: null, synonyms: [] },
    synopsis: `Synopsis ${id}`,
    image: {
      medium: `https://cdn.test/${id}-medium.jpg`,
      large: `https://cdn.test/${id}-large.jpg`,
    },
    score: 8,
    userScore: null,
    genres: genres.map((name, index) => ({ id: index + 1, name })),
    themes: [{ id: 100 + id, name: 'Adventure' }],
    studios: [{ id: 200 + id, name: 'Studio Test' }],
    staff: [],
    episodeCount: 12,
    year: 2024,
    season: 'spring',
    status: 'finished_airing',
    type: 'tv',
    popularity: 100,
    memberCount,
  };
}

function entry(
  id: number,
  status: AnimeListEntry['status'],
  score: number | null,
  genres: readonly string[],
): AnimeListEntry {
  return {
    anime: { ...anime(id, genres), userScore: score },
    status,
    userScore: score,
    episodesWatched: score === null ? 0 : 12,
    priority: null,
    isRewatching: false,
    updatedAt: null,
    notes: null,
  };
}

const sync: SyncMetadata = {
  status: 'success',
  phase: 'complete',
  progress: null,
  lastSyncedAt: '2026-01-01T00:00:00.000Z',
  itemCount: 4,
  nextPageUrl: null,
  errorCode: null,
  errorMessage: null,
  fromCache: false,
};

describe('dashboard recommendation snapshot', () => {
  it('uses the engine output and groups recommendations into product sections', async () => {
    const snapshot = await buildDashboardRecommendationSnapshot(
      [
        entry(1, 'completed', 10, ['Fantasy', 'Adventure']),
        entry(2, 'completed', 9, ['Drama', 'Mystery']),
        entry(3, 'completed', 8, ['Sci-Fi', 'Space']),
        entry(10, 'plan_to_watch', null, ['Fantasy', 'Adventure']),
      ],
      sync,
      undefined,
      [],
      '2026-01-02T00:00:00.000Z',
    );

    expect(snapshot.status).toBe('ready');
    expect(snapshot.daily?.anime.id).toBe(10);
    expect(snapshot.analyzedCount).toBe(4);
    expect(snapshot.sections).toHaveLength(4);
    const sectionItems = snapshot.sections.flatMap((section) => section.recommendations);
    expect(sectionItems).toHaveLength(1);
    expect(sectionItems[0]?.anime.id).toBe(10);
    expect(snapshot.daily?.anime.image?.large).toContain('10-large');
  });

  it('returns an explicit empty state when the cache has no candidates', async () => {
    const snapshot = await buildDashboardRecommendationSnapshot(
      [],
      sync,
      undefined,
      [],
      '2026-01-02T00:00:00.000Z',
    );

    expect(snapshot.status).toBe('empty');
    expect(snapshot.daily).toBeNull();
    expect(snapshot.sections.every((section) => section.recommendations.length === 0)).toBe(true);
  });

  it('preserves offline status while keeping local recommendations available', async () => {
    const snapshot = await buildDashboardRecommendationSnapshot(
      [entry(20, 'plan_to_watch', null, ['Fantasy'])],
      { ...sync, status: 'offline', fromCache: true },
      undefined,
      [],
      '2026-01-02T00:00:00.000Z',
    );

    expect(snapshot.status).toBe('offline');
    expect(snapshot.daily?.anime.id).toBe(20);
    expect(snapshot.sync?.fromCache).toBe(true);
  });

  it('enriches plan-to-watch candidates with provider suggestions', async () => {
    // A realistic small list: one plan-to-watch candidate, so suggestions are what give the sections anything to show.
    const fetchSuggestions = async () => [
      anime(50, ['Fantasy', 'Adventure']),
      anime(51, ['Drama', 'Mystery']),
      anime(52, ['Sci-Fi']),
      anime(53, ['Comedy']),
      anime(54, ['Fantasy', 'Drama']),
      anime(55, ['Adventure', 'Sci-Fi']),
    ];
    const snapshot = await buildDashboardRecommendationSnapshot(
      [
        entry(1, 'completed', 10, ['Fantasy', 'Adventure']),
        entry(2, 'completed', 9, ['Drama', 'Mystery']),
        entry(3, 'completed', 8, ['Sci-Fi', 'Space']),
        entry(10, 'plan_to_watch', null, ['Fantasy', 'Adventure']),
      ],
      sync,
      undefined,
      [],
      '2026-01-02T00:00:00.000Z',
      fetchSuggestions,
    );

    const ids = snapshot.sections.flatMap((section) =>
      section.recommendations.map((item) => item.anime.id),
    );
    expect(ids).toContain(50);
    expect(ids).toContain(51);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(3);
  });

  it('falls back to plan-to-watch-only candidates when suggestion fetching fails', async () => {
    const snapshot = await buildDashboardRecommendationSnapshot(
      [entry(1, 'completed', 10, ['Fantasy']), entry(10, 'plan_to_watch', null, ['Fantasy'])],
      sync,
      undefined,
      [],
      '2026-01-02T00:00:00.000Z',
      async () => {
        throw new Error('MAL is unreachable');
      },
    );

    expect(snapshot.status).toBe('ready');
    expect(snapshot.daily?.anime.id).toBe(10);
  });

  it('creates a safe empty snapshot without inventing an anime', () => {
    const snapshot = createEmptyDashboardRecommendationSnapshot();

    expect(snapshot.status).toBe('empty');
    expect(snapshot.daily).toBeNull();
    expect(snapshot.analyzedCount).toBe(0);
  });

  it('partitions recommendations into exclusive sections instead of duplicating high scores', async () => {
    const watched = [
      entry(1, 'completed', 10, ['Fantasy']),
      entry(2, 'completed', 9, ['Drama']),
      entry(3, 'completed', 8, ['Sci-Fi']),
    ];
    const candidates = Array.from({ length: 8 }, (_, index) =>
      entry(100 + index, 'plan_to_watch', null, ['Comedy']),
    ).map((candidate, index) => ({
      ...candidate,
      anime: {
        ...candidate.anime,
        themes: [],
        studios: [],
        score: index < 4 ? 8 : 5,
      },
    }));
    const snapshot = await buildDashboardRecommendationSnapshot(
      [...watched, ...candidates],
      sync,
      undefined,
      [],
      '2026-01-02T00:00:00.000Z',
    );

    const highlyCompatible = snapshot.sections.find(
      (section) => section.id === 'highly-compatible',
    );
    expect(highlyCompatible?.recommendations).toHaveLength(0);
    const sectionItems = snapshot.sections.flatMap((section) => section.recommendations);
    expect(new Set(sectionItems.map((item) => item.anime.id)).size).toBe(sectionItems.length);
    expect(sectionItems.map((item) => item.anime.id)).toEqual(
      expect.arrayContaining(candidates.map((item) => item.anime.id)),
    );
    expect(sectionItems.every((item) => item.category !== 'highly-compatible')).toBe(true);
  });

  it('leaves curated sections untouched when every category is already filled', async () => {
    const snapshot = await buildDashboardRecommendationSnapshot(
      [
        ...Array.from({ length: 4 }, (_, index) =>
          entry(
            10 + index,
            'plan_to_watch',
            null,
            index % 2 === 0 ? ['Fantasy', 'Adventure'] : ['Drama', 'Mystery'],
          ),
        ),
      ],
      sync,
      undefined,
      [],
      '2026-01-02T00:00:00.000Z',
    );

    const highlyCompatible = snapshot.sections.find(
      (section) => section.id === 'highly-compatible',
    );
    expect(highlyCompatible?.recommendations).toHaveLength(0);
    // Everything lands somewhere, and no title shows up twice, even when every source candidate is highly compatible.
    const sectionItems = snapshot.sections.flatMap((section) => section.recommendations);
    expect(sectionItems.length).toBeGreaterThan(0);
    expect(new Set(sectionItems.map((item) => item.anime.id)).size).toBe(sectionItems.length);
  });
});
