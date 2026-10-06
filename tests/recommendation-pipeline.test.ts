import { describe, expect, it } from 'vitest';
import type { Anime, AnimeListEntry } from '../src/domain/anime';
import {
  buildUserPreferenceProfile,
  extractFeatures,
  generateRecommendations,
  scoreRecommendation,
} from '../src/recommendations/recommendation-engine';
import type { RecommendationProfile } from '../src/recommendations/recommendation-types';

function anime(id: number, overrides: Partial<Anime> = {}): Anime {
  return {
    id: id,
    title: {
      default: `Anime ${id}`,
      english: null,
      japanese: null,
      synonyms: [],
    },
    synopsis: null,
    image: null,
    score: 7,
    userScore: null,
    genres: [{ id: 1, name: 'Fantasy' }],
    themes: [{ id: 2, name: 'Adventure' }],
    studios: [{ id: 3, name: 'Studio North' }],
    staff: [],
    episodeCount: 12,
    year: 2024,
    season: 'spring',
    status: 'finished_airing',
    type: 'tv',
    popularity: 100,
    memberCount: 50000,
    ...overrides,
  };
}

function entry(id: number, score: number | null, overrides: Partial<Anime> = {}): AnimeListEntry {
  return {
    anime: anime(id, { ...overrides, userScore: score }),
    status: score !== null && score >= 8 ? 'completed' : 'plan_to_watch',
    userScore: score,
    episodesWatched: score === null ? 0 : 12,
    priority: null,
    isRewatching: false,
    updatedAt: null,
    notes: null,
  };
}

function emptyProfile(): RecommendationProfile {
  return buildUserPreferenceProfile([]);
}

describe('recommendation pipeline', () => {
  it.each([0, 1, 5, 10, 100, 1000])('handles %i watched anime deterministically', (count) => {
    const watched = Array.from({ length: count }, (_, index) =>
      entry(index + 1, index % 3 === 0 ? 8 : null),
    );
    const candidates = Array.from({ length: 25 }, (_, index) => anime(10_000 + index));
    const first = generateRecommendations({ watched, candidates }, { limit: 20 });
    const second = generateRecommendations({ watched, candidates }, { limit: 20 });

    expect(first).toEqual(second);
    expect(first).toHaveLength(Math.min(20, candidates.length));
    expect(first.every((item) => item.reasons.length <= 3)).toBe(true);
    expect(
      first.every((item) => item.compatibilityScore >= 0 && item.compatibilityScore <= 100),
    ).toBe(true);
  });

  it('learns the requested positive, neutral, and negative signal strengths', () => {
    const profile = buildUserPreferenceProfile([
      entry(1, 10, { genres: [{ id: 1, name: 'Loved' }] }),
      entry(2, 9, { genres: [{ id: 2, name: 'Strong' }] }),
      entry(3, 8, { genres: [{ id: 3, name: 'Positive' }] }),
      entry(4, 7, { genres: [{ id: 4, name: 'Slight' }] }),
      entry(5, 6, { genres: [{ id: 5, name: 'Neutral' }] }),
      entry(6, 4, { genres: [{ id: 6, name: 'Negative' }] }),
      entry(7, 2, { genres: [{ id: 7, name: 'Rejected' }] }),
    ]);

    expect(profile.genres.get('loved')?.positive).toBe(1);
    expect(profile.genres.get('strong')?.positive).toBe(0.8);
    expect(profile.genres.get('positive')?.positive).toBe(0.6);
    expect(profile.genres.get('slight')?.positive).toBe(0.25);
    expect(profile.genres.get('neutral')).toMatchObject({ positive: 0, negative: 0 });
    expect(profile.genres.get('negative')?.negative).toBeCloseTo(0.35);
    expect(profile.genres.get('rejected')?.negative).toBeCloseTo(0.8);
  });

  it('uses status signals when an entry has no score', () => {
    const profile = buildUserPreferenceProfile([
      {
        ...entry(1, null, { genres: [{ id: 1, name: 'CompletedGenre' }] }),
        status: 'completed',
      },
      {
        ...entry(2, null, { genres: [{ id: 2, name: 'DroppedGenre' }] }),
        status: 'dropped',
      },
    ]);

    expect(profile.ratedAnimeCount).toBe(0);
    expect(profile.sourceAnimeCount).toBe(2);
    expect(profile.genres.get('completedgenre')?.positive).toBe(0.2);
    expect(profile.genres.get('droppedgenre')?.negative).toBeCloseTo(0.35);
  });

  it('supports a cold start using quality and popularity without watched data', () => {
    const result = generateRecommendations({
      watched: [],
      candidates: [
        anime(1, { score: null, memberCount: null, popularity: null, genres: [] }),
        anime(2, { score: 9.5, memberCount: 900000, popularity: 1 }),
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.anime.id).toBe(2);
    expect(result[0]?.category).toBe('explore');
  });

  it('normalizes missing data and applies configurable weights', () => {
    const candidate = anime(1, {
      genres: [],
      themes: [],
      studios: [],
      staff: [],
      year: null,
      season: null,
      score: null,
      popularity: null,
      memberCount: null,
    });
    const profile = emptyProfile();
    const score = scoreRecommendation(candidate, profile, {
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

    expect(extractFeatures(candidate)).toMatchObject({
      genres: [],
      themes: [],
      studios: [],
      year: null,
      score: null,
    });
    expect(score.normalized).toBe(50);
    expect(score.value).toBe(0.5);
  });

  it('filters invalid, watched, completed-by-user, rejected, and duplicate candidates', () => {
    const watched = [entry(1, 10)];
    const invalid = { ...anime(99), title: { ...anime(99).title, default: '' } };
    const result = generateRecommendations(
      {
        watched,
        candidates: [
          anime(1),
          anime(2),
          anime(2),
          anime(3, { genres: [{ id: 5, name: 'Horror' }] }),
          invalid,
        ],
        rejectedAnimeIds: [4],
        rejectedGenres: ['HORROR'],
      },
      { excludedAnimeIds: [5] },
    );

    expect(result.map((item) => item.anime.id)).toEqual([2]);
  });

  it('creates recommendation categories, limits explanations, and diversifies genres', () => {
    const watched = [
      entry(1, 10, {
        genres: [{ id: 1, name: 'Fantasy' }],
        themes: [{ id: 2, name: 'Adventure' }],
      }),
      entry(2, 9, {
        genres: [{ id: 3, name: 'Drama' }],
        themes: [{ id: 4, name: 'Mystery' }],
      }),
      entry(3, 8, {
        genres: [{ id: 5, name: 'Sci-Fi' }],
        themes: [{ id: 6, name: 'Space' }],
      }),
    ];
    const candidates = [
      anime(10, {
        genres: [{ id: 1, name: 'Fantasy' }],
        themes: [{ id: 2, name: 'Adventure' }],
        memberCount: 500000,
      }),
      anime(11, {
        genres: [{ id: 3, name: 'Drama' }],
        themes: [{ id: 4, name: 'Mystery' }],
        memberCount: 50000,
      }),
      anime(12, {
        genres: [{ id: 5, name: 'Sci-Fi' }],
        themes: [{ id: 6, name: 'Space' }],
        memberCount: 10000,
      }),
      anime(13, {
        genres: [{ id: 7, name: 'Comedy' }],
        themes: [],
        memberCount: 1000,
        score: 6,
      }),
    ];
    const result = generateRecommendations(
      { watched, candidates },
      { limit: 4, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    expect(new Set(result.map((item) => item.category)).size).toBeGreaterThan(1);
    expect(result.every((item) => item.reasons.length <= 3)).toBe(true);
    expect(result.every((item) => item.generatedAt === '2026-01-01T00:00:00.000Z')).toBe(true);
    expect(result.map((item) => item.anime.id)).toEqual([10, 11, 12, 13]);
  });

  it('applies persisted discovery preferences before returning recommendations', () => {
    const result = generateRecommendations(
      {
        watched: [],
        candidates: [
          anime(20, { type: 'movie', year: 2024, memberCount: 1_000_000 }),
          anime(21, { type: 'tv', year: 2008, memberCount: 1_000_000 }),
          anime(22, { type: 'tv', year: 2024, episodeCount: 12, memberCount: 20_000 }),
          anime(23, { type: 'tv', year: 2024, episodeCount: 24, memberCount: 1_000_000 }),
        ],
      },
      {
        discovery: {
          includeMovies: false,
          includeOlderAnime: false,
          includeShortSeries: false,
          includeHiddenGems: false,
        },
      },
    );

    expect(result.map((item) => item.anime.id)).toEqual([23]);
  });

  it('applies hidden-gem, completed-title, and minimum-score preferences', () => {
    const result = generateRecommendations(
      {
        watched: [],
        candidates: [
          anime(40, { memberCount: 10_000, status: 'finished_airing' }),
          anime(41, { memberCount: 1_000_000, status: 'currently_airing', score: 10 }),
          anime(42, { memberCount: 1_000_000, status: 'currently_airing', score: 6 }),
        ],
      },
      {
        discovery: {
          includeHiddenGems: false,
          showCompletedAnime: false,
          minimumCompatibilityScore: 57,
        },
      },
    );

    expect(result.map((item) => item.anime.id)).toEqual([41]);
  });

  it('hard-excludes persisted blacklisted genres and themes', () => {
    const result = generateRecommendations(
      {
        watched: [],
        candidates: [
          anime(50, { genres: [{ id: 1, name: 'Romance' }] }),
          anime(51, { themes: [{ id: 77, name: 'Team Sports' }] }),
          anime(52, {
            genres: [{ id: 2, name: 'Fantasy' }],
            themes: [{ id: 78, name: 'School' }],
          }),
        ],
      },
      {
        discovery: {
          excludedGenres: ['romance'],
          excludedThemes: ['team sports'],
        },
      },
    );

    expect(result.map((item) => item.anime.id)).toEqual([52]);
  });

  it('supports exploratory mode, preferred genres, and a minimum score', () => {
    const result = generateRecommendations(
      {
        watched: [],
        candidates: [
          anime(30, {
            genres: [{ id: 1, name: 'Fantasy' }],
            score: 5,
            memberCount: 1_000,
          }),
          anime(31, {
            genres: [{ id: 2, name: 'Drama' }],
            score: 9,
            memberCount: 1_000_000,
          }),
        ],
      },
      {
        discovery: {
          recommendationMode: 'exploratory',
          preferredGenres: ['Fantasy'],
          minimumCompatibilityScore: 55,
        },
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.anime.id).toBe(31);
  });

  it('keeps a rejected genre below the candidate set even when its score is high', () => {
    const result = generateRecommendations({
      watched: [entry(1, 10, { genres: [{ id: 1, name: 'Fantasy' }] })],
      candidates: [anime(2, { genres: [{ id: 1, name: 'Fantasy' }] })],
      rejectedGenres: ['fantasy'],
    });

    expect(result).toEqual([]);
  });

  it('routes candidates sharing features with a highly rated entry to because-you-liked', () => {
    const watched = [
      entry(1, 10, {
        genres: [
          { id: 1, name: 'Action' },
          { id: 2, name: 'Drama' },
        ],
        themes: [{ id: 10, name: 'Super Power' }],
      }),
      entry(2, 9, { genres: [{ id: 3, name: 'Comedy' }] }),
      entry(3, 8, { genres: [{ id: 4, name: 'Romance' }] }),
    ];
    // Near-clone of the 10/10 favorite: clears the >=80 band too, but the specific provenance signal has to win.
    const clone = anime(10, {
      genres: [
        { id: 1, name: 'Action' },
        { id: 2, name: 'Drama' },
      ],
      themes: [{ id: 10, name: 'Super Power' }],
      score: 9,
      memberCount: 900_000,
    });
    const result = generateRecommendations(
      { watched, candidates: [clone] },
      { limit: 5, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('because-you-liked');
  });

  it('categorizes strong broad-affinity matches as highly-compatible', () => {
    // Shares at most one feature with each rated entry, so there's no because-you-liked source, but broad genre and theme affinity is strong.
    const watched = [
      entry(1, 10, {
        genres: [{ id: 1, name: 'Action' }],
        themes: [{ id: 10, name: 'Super Power' }],
        studios: [],
      }),
      entry(2, 10, {
        genres: [{ id: 2, name: 'Drama' }],
        themes: [{ id: 11, name: 'Isekai' }],
        studios: [],
      }),
      entry(3, 10, {
        genres: [{ id: 3, name: 'Sci-Fi' }],
        themes: [{ id: 12, name: 'Mecha' }],
        studios: [],
      }),
      entry(4, 10, {
        genres: [{ id: 4, name: 'Thriller' }],
        themes: [{ id: 13, name: 'Time Travel' }],
        studios: [],
      }),
    ];
    const broadMatch = anime(20, {
      genres: [
        { id: 1, name: 'Action' },
        { id: 2, name: 'Drama' },
        { id: 3, name: 'Sci-Fi' },
      ],
      themes: [{ id: 13, name: 'Time Travel' }],
      studios: [],
      score: 10,
      memberCount: 1_000_000,
    });
    const result = generateRecommendations(
      { watched, candidates: [broadMatch] },
      { limit: 5, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('highly-compatible');
    expect(result[0]?.compatibilityScore).toBeGreaterThanOrEqual(80);
  });

  it('categorizes low-popularity quality candidates as hidden-gem', () => {
    const watched = [
      entry(1, 10, {
        genres: [{ id: 1, name: 'Action' }],
        themes: [],
        studios: [],
      }),
      entry(2, 9, {
        genres: [{ id: 2, name: 'Drama' }],
        themes: [],
        studios: [],
      }),
    ];
    const gem = anime(30, {
      genres: [{ id: 1, name: 'Action' }],
      themes: [],
      studios: [],
      score: 8,
      memberCount: 40_000,
    });
    const result = generateRecommendations(
      { watched, candidates: [gem] },
      { limit: 5, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('hidden-gem');
  });

  it('keeps discovery sections populated on a large list', () => {
    // Nearly every candidate here overlaps some liked entry and lands in the 60-85 band; collapsing to one dominant category used to leave Hidden Gems and Explore empty.
    const genres = [
      'Action',
      'Adventure',
      'Comedy',
      'Drama',
      'Fantasy',
      'Sci-Fi',
      'Mystery',
      'Romance',
      'Sports',
      'Slice of Life',
    ];
    const themes = [
      'School',
      'Military',
      'Space',
      'Mecha',
      'Isekai',
      'Time Travel',
      'Music',
      'Psychological',
      'Supernatural',
      'Historical',
    ];
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const randomFeatures = () => {
      const genreNames = [
        ...new Set([
          genres[Math.floor(random() * genres.length)],
          genres[Math.floor(random() * genres.length)],
        ]),
      ];
      if (random() < 0.3)
        return {
          genres: genreNames.map((name) => ({ id: genres.indexOf(name) + 1, name })),
          themes: [],
          studios: [
            { id: Math.floor(random() * 40) + 1, name: 'Studio ' + Math.floor(random() * 40) },
          ],
        };
      const themeName = themes[Math.floor(random() * themes.length)];
      return {
        genres: genreNames.map((name) => ({ id: genres.indexOf(name) + 1, name })),
        themes: [{ id: themes.indexOf(themeName) + 100, name: themeName }],
        studios: [
          { id: Math.floor(random() * 40) + 1, name: 'Studio ' + Math.floor(random() * 40) },
        ],
      };
    };
    // 70% cluster around the user's favourite genres and themes.
    const tasteFeatures = () => {
      const features = randomFeatures();
      return random() < 0.7
        ? {
            ...features,
            genres: features.genres.map((g) => ({
              ...g,
              name: genres[genres.indexOf(g.name) % 5],
            })),
            themes: features.themes.map((t) => ({
              ...t,
              name: themes[themes.indexOf(t.name) % 5],
            })),
          }
        : features;
    };
    const watched = Array.from({ length: 130 }, (_, index) => {
      const roll = random();
      const score =
        roll < 0.55
          ? 7 + Math.floor(random() * 4)
          : roll < 0.9
            ? 5 + Math.floor(random() * 3)
            : 3 + Math.floor(random() * 2);
      return entry(index + 1, score, tasteFeatures());
    });
    // Popular candidates plus a deep-ranking page of obscure quality titles, the pool the background worker assembles.
    const candidates = [
      ...Array.from({ length: 40 }, (_, index) =>
        anime(2000 + index, {
          ...tasteFeatures(),
          memberCount: 400_000 + index * 10_000,
          score: 6 + random() * 3,
        }),
      ),
      ...Array.from({ length: 40 }, (_, index) =>
        anime(3000 + index, {
          ...(index % 2 === 1 ? randomFeatures() : tasteFeatures()),
          memberCount: index % 2 === 1 ? 20_000 + index * 3_000 : 400_000 + index * 10_000,
          score: 6 + random() * 3,
        }),
      ),
    ];
    const result = generateRecommendations(
      { watched, candidates },
      { limit: candidates.length, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    const byCategory = new Map<string, number>();
    for (const item of result)
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
    expect(result).toHaveLength(candidates.length);
    expect(byCategory.get('hidden-gem') ?? 0).toBeGreaterThan(0);
    expect(
      (byCategory.get('genre-discovery') ?? 0) + (byCategory.get('explore') ?? 0),
    ).toBeGreaterThan(0);
    expect(byCategory.get('because-you-liked') ?? 0).toBeLessThan(result.length);
  });
});
