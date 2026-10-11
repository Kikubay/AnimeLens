import { describe, expect, it } from 'vitest';
import type { Anime, AnimeListEntry } from '../src/domain/anime';
import { normalizeAnime as normalizeAniList } from '../src/api/providers/anilist/anilist-normalizer';
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

// Mirrors the dashboard's sections, so section-level assertions test what the user sees.
const SECTION_MEMBERS: readonly {
  readonly key: string;
  readonly categories: readonly string[];
}[] = [
  { key: 'highly-compatible', categories: ['highly-compatible'] },
  { key: 'because-you-liked', categories: ['because-you-liked'] },
  { key: 'hidden-gem', categories: ['hidden-gem'] },
  { key: 'explore', categories: ['explore', 'genre-discovery'] },
];

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

  it('keeps a near-clone of a favourite in the top band rather than claiming provenance', () => {
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

    // Traces back to a 10/10 favourite, but at 70%+ the top band wins over provenance.
    expect(result).toHaveLength(1);
    expect(result[0]?.compatibilityScore).toBeGreaterThanOrEqual(70);
    expect(result[0]?.category).toBe('highly-compatible');
  });

  it('attributes a two-feature overlap on a moderate liked cohort, which used to fall through', () => {
    // Past the tiny-cohort exemption but under the shallow limit, so two shared features still count.
    const watched = Array.from({ length: 8 }, (_, index) =>
      entry(index + 1, 9, {
        genres: [{ id: index, name: `Genre ${index}` }],
        themes: [{ id: 100 + index, name: `Theme ${index}` }],
        studios: [],
      }),
    );
    // Tuned to land inside the 50-69 band; at 70 or above the top band claims it regardless of provenance.
    const sibling = anime(500, {
      genres: [
        { id: 3, name: 'Genre 3' },
        { id: 99, name: 'Sci-Fi' },
      ],
      themes: [
        { id: 103, name: 'Theme 3' },
        { id: 120, name: 'Ensemble' },
      ],
      score: 6,
      memberCount: 5_000,
    });
    const result = generateRecommendations(
      { watched, candidates: [sibling] },
      { limit: 5, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.compatibilityScore).toBeGreaterThanOrEqual(50);
    expect(result[0]?.compatibilityScore).toBeLessThan(70);
    expect(result[0]?.category).toBe('because-you-liked');
  });

  it('still demands a deeper overlap on a large liked cohort, where two is the base rate', () => {
    const watched = Array.from({ length: 20 }, (_, index) =>
      entry(index + 1, 9, {
        genres: [{ id: index, name: `Genre ${index}` }],
        themes: [{ id: 100 + index, name: `Theme ${index}` }],
        studios: [],
      }),
    );
    const shallowOverlap = anime(501, {
      genres: [
        { id: 3, name: 'Genre 3' },
        { id: 99, name: 'Sci-Fi' },
      ],
      themes: [
        { id: 103, name: 'Theme 3' },
        { id: 120, name: 'Ensemble' },
      ],
      score: 7,
      memberCount: 400_000,
    });
    const result = generateRecommendations(
      { watched, candidates: [shallowOverlap] },
      { limit: 5, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    expect(result[0]?.category).not.toBe('because-you-liked');
  });

  it('keeps provenance attributed to a single source instead of the whole cohort', () => {
    // Every liked entry shares the same pair, so nothing is distinctive enough to claim provenance.
    const watched = Array.from({ length: 8 }, (_, index) =>
      entry(index + 1, 9, {
        genres: [
          { id: 1, name: 'Action' },
          { id: 2, name: 'Drama' },
        ],
        themes: [{ id: 10, name: 'Super Power' }],
        studios: [],
      }),
    );
    const clone = anime(502, {
      genres: [
        { id: 1, name: 'Action' },
        { id: 2, name: 'Drama' },
      ],
      themes: [{ id: 10, name: 'Super Power' }],
      score: 7,
      memberCount: 400_000,
    });
    const result = generateRecommendations(
      { watched, candidates: [clone] },
      { limit: 5, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    expect(result[0]?.category).not.toBe('because-you-liked');
  });

  it('categorizes strong broad-affinity matches as highly-compatible', () => {
    // Overlaps each rated entry on at most one feature, so only broad affinity can place it.
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

  it('categorizes a mid-band candidate with a strong community rating as hidden-gem', () => {
    // The disliked overlap is what drops the composite into the 30-49 band.
    const watched = [
      entry(1, 10, { genres: [{ id: 1, name: 'Loved' }], themes: [], studios: [] }),
      entry(2, 1, { genres: [{ id: 2, name: 'Disliked' }], themes: [], studios: [] }),
      entry(3, 10, { genres: [{ id: 5, name: 'Loved2' }], themes: [], studios: [] }),
    ];
    const makeGem = (rating: number) =>
      anime(30, {
        genres: [{ id: 2, name: 'Disliked' }],
        themes: [
          { id: 22, name: 'DislikedT' },
          { id: 23, name: 'Unseen' },
        ],
        studios: [],
        score: rating,
        memberCount: 100,
      });

    const acclaimed = generateRecommendations(
      { watched, candidates: [makeGem(8)] },
      { limit: 5, generatedAt: '2026-01-01T00:00:00.000Z' },
    );
    expect(acclaimed).toHaveLength(1);
    expect(acclaimed[0]?.compatibilityScore).toBeGreaterThanOrEqual(30);
    expect(acclaimed[0]?.compatibilityScore).toBeLessThan(50);
    expect(acclaimed[0]?.category).toBe('hidden-gem');

    // Only the rating differs, so this isolates the acclaim condition from obscurity.
    const unacclaimed = generateRecommendations(
      { watched, candidates: [makeGem(6.5)] },
      { limit: 5, generatedAt: '2026-01-01T00:00:00.000Z' },
    );
    expect(unacclaimed[0]?.category).not.toBe('hidden-gem');
  });

  it('never puts one anime in more than one section', () => {
    const watched = Array.from({ length: 12 }, (_, index) =>
      entry(index + 1, index % 2 === 0 ? 9 : 4, {
        genres: [{ id: index, name: `Genre ${index}` }],
        themes: [{ id: 100 + index, name: `Theme ${index}` }],
        studios: [],
      }),
    );
    const candidates = Array.from({ length: 60 }, (_, index) =>
      anime(2000 + index, {
        genres: [{ id: index % 12, name: `Genre ${index % 12}` }],
        themes: [{ id: 100 + (index % 12), name: `Theme ${index % 12}` }],
        studios: [],
        score: 5 + (index % 5),
        memberCount: 100 + index * 4_000,
      }),
    );
    const result = generateRecommendations(
      { watched, candidates },
      { limit: candidates.length, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    const ids = result.map((item) => item.anime.id);
    expect(new Set(ids).size, 'an anime must not be duplicated across sections').toBe(ids.length);
    for (const item of result) {
      expect(SECTION_MEMBERS.map((section) => section.categories).flat()).toContain(item.category);
    }
  });

  it.each([10, 100])('scales every section floor with the library size (%i entries)', (size) => {
    const liked = ['Action', 'Adventure', 'Comedy', 'Drama'];
    const watched = Array.from({ length: size }, (_, index) =>
      entry(index + 1, 7 + (index % 3), {
        genres: [{ id: index % 4, name: liked[index % 4] }],
        themes: [{ id: 100 + (index % 3), name: `Theme ${index % 3}` }],
        studios: [],
        year: 2015 + (index % 8),
      }),
    );
    const candidates = Array.from({ length: 250 }, (_, index) =>
      anime(2000 + index, {
        genres: [{ id: 900 + index, name: liked[index % 4] }],
        themes: [{ id: 950 + index, name: `Theme ${index % 3}` }],
        studios: [],
        score: 5.5 + (index % 8) * 0.4,
        memberCount: 3_000 + index * 3_000,
        year: 1995 + (index % 25),
      }),
    );
    const result = generateRecommendations(
      { watched, candidates },
      { limit: 100, generatedAt: '2026-01-01T00:00:00.000Z' },
    );

    // Five at ten entries, growing past ten by a hundred, so the floor rewards a richer profile.
    const minimum = size >= 100 ? 11 : 5;
    for (const section of SECTION_MEMBERS) {
      const titles = result.filter((item) => section.categories.includes(item.category));
      expect(titles.length, `${section.key} at ${size} entries`).toBeGreaterThanOrEqual(minimum);
    }
    const ids = result.map((item) => item.anime.id);
    expect(new Set(ids).size, 'filling a section must not duplicate an anime').toBe(ids.length);
  });

  // Regression: scoring unseen features as neutral 0.5 floored the composite near 51, leaving the
  // 30-49 band unreachable for exactly the users with the largest libraries.
  it('lets a large library reach the lower compatibility bands', () => {
    const genres = [
      'Action',
      'Adventure',
      'Comedy',
      'Drama',
      'Fantasy',
      'Sci-Fi',
      'Horror',
      'Romance',
    ];
    const themes = ['School', 'Isekai', 'Space', 'Mecha', 'Time Travel', 'Psychological'];
    const watched = Array.from({ length: 159 }, (_, index) =>
      entry(index + 1, index % 3 === 0 ? 9 : 6, {
        genres: [{ id: index % 8, name: genres[index % 8] }],
        themes: [{ id: 100 + (index % 6), name: themes[index % 6] }],
        studios: [],
        type: 'tv',
        season: 'spring',
        year: 2015 + (index % 9),
      }),
    );

    // The case that used to bottom out near 51.
    const stranger = scoreRecommendation(
      anime(9000, {
        genres: [{ id: 77, name: 'Totally Unrelated' }],
        themes: [{ id: 78, name: 'Never Seen' }],
        studios: [{ id: 79, name: 'Unknown Studio' }],
        type: 'ona',
        season: 'winter',
        year: 1987,
        score: 8,
        memberCount: 20_000,
      }),
      buildUserPreferenceProfile(watched),
    );
    expect(stranger.normalized, 'a zero-overlap title must fall below the 50% band').toBeLessThan(
      50,
    );
    expect(stranger.featureScores.genres, 'an unseen feature is not neutral').toBe(0);

    // The top band must still be reachable, or the fix just flattened everything.
    const favourite = scoreRecommendation(
      anime(9001, {
        genres: [{ id: 1, name: 'Action' }],
        themes: [{ id: 100, name: 'School' }],
        studios: [],
        type: 'tv',
        season: 'spring',
        year: 2020,
        score: 9,
        memberCount: 300_000,
      }),
      buildUserPreferenceProfile(watched),
    );
    expect(favourite.normalized).toBeGreaterThanOrEqual(70);
  });

  it('scores a popularity rank so a higher rank means a more popular title', () => {
    const weights = {
      genres: 0,
      themes: 0,
      studios: 0,
      staff: 0,
      type: 0,
      season: 0,
      year: 0,
      quality: 0,
      popularity: 1,
    };
    const rankScore = (rank: number) =>
      scoreRecommendation(
        anime(1, { genres: [], themes: [], studios: [], memberCount: null, popularity: rank }),
        emptyProfile(),
        { weights },
      ).featureScores.popularity;
    const memberScore = (memberCount: number) =>
      scoreRecommendation(
        anime(1, { genres: [], themes: [], studios: [], memberCount, popularity: null }),
        emptyProfile(),
        { weights },
      ).featureScores.popularity;

    expect(rankScore(1)).toBeGreaterThan(rankScore(100));
    expect(rankScore(100)).toBeGreaterThan(rankScore(5_000));
    expect(rankScore(5_000)).toBeGreaterThan(rankScore(50_000));
    expect(rankScore(1) - rankScore(10)).toBeCloseTo(rankScore(10) - rankScore(100), 5);
    expect(rankScore(10) - rankScore(100)).toBeCloseTo(rankScore(100) - rankScore(1_000), 5);
    expect(rankScore(0)).toBe(0.5);
    expect(memberScore(1_000_000)).toBeGreaterThan(memberScore(1_000));
  });

  it('keeps discovery sections populated on a large list', () => {
    // Candidates overlap liked entries constantly and land in the 60-85 band, which used to collapse everything into one category.
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
    // Most of the list clusters on the user's favourites, which is what makes provenance fire everywhere.
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
    const watched = [
      ...Array.from({ length: 130 }, (_, index) => {
        const roll = random();
        const score =
          roll < 0.55
            ? 7 + Math.floor(random() * 4)
            : roll < 0.9
              ? 5 + Math.floor(random() * 3)
              : 3 + Math.floor(random() * 2);
        return entry(index + 1, score, tasteFeatures());
      }),
      // Rated badly, to give the hidden-gem candidates below a negative signal.
      ...Array.from({ length: 8 }, (_, index) =>
        entry(500 + index, 2, {
          genres: [{ id: 700 + index, name: `Dud ${index}` }],
          themes: [{ id: 800 + index, name: `DudTheme ${index}` }],
          studios: [],
        }),
      ),
    ];
    // Mirrors the pool the background worker builds: suggestions plus a deep-ranking page.
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
      // Off-taste but well reviewed, which is what Hidden Gems is for; the "Dud" overlap with the
      // low-rated entries above is what pushes them into the 30-49 band.
      ...Array.from({ length: 20 }, (_, index) =>
        anime(4000 + index, {
          genres: [
            { id: 700 + index, name: `Dud ${index}` },
            { id: 900 + index, name: `Offtaste ${index}` },
          ],
          themes: [{ id: 800 + index, name: `DudTheme ${index}` }],
          studios: [],
          memberCount: 200 + index * 900,
          year: 1985 + (index % 10),
          score: 7.2 + random() * 0.8,
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

  // Regression: AniList's `popularity` is a member count, not the rank the domain documents; reading it as a rank left Highly Compatible permanently empty.
  describe('anilist popularity semantics', () => {
    const buildProfile = (): RecommendationProfile => {
      const watched = Array.from({ length: 60 }, (_, index) =>
        entry(index + 1, 8 + (index % 3), {
          genres: [
            { id: 1, name: 'Action' },
            { id: 2, name: 'Adventure' },
          ],
          themes: [{ id: 3, name: 'School Life' }],
          studios: [],
        }),
      );
      return buildUserPreferenceProfile(watched);
    };

    it('normalizes AniList list-member counts into memberCount, not popularity', () => {
      const anime = normalizeAniList({
        id: 1,
        title: { romaji: 'Re:Zero kara Hajimeru Isekai Seikatsu' },
        averageScore: 88,
        genres: ['Action', 'Adventure'],
        popularity: 244_175,
      });

      expect(anime.memberCount).toBe(244_175);
      expect(anime.popularity).toBeNull();
    });

    it('scores AniList popularity on the same scale as an MAL member count', () => {
      const weights = {
        genres: 0,
        themes: 0,
        studios: 0,
        staff: 0,
        type: 0,
        season: 0,
        year: 0,
        quality: 0,
        popularity: 1,
      };
      const anilist = normalizeAniList({
        id: 1,
        title: { romaji: 'Sousou no Frieren' },
        averageScore: 91,
        genres: ['Adventure'],
        popularity: 488_052,
      });
      const mal = anime(1, {
        genres: [],
        themes: [],
        studios: [],
        memberCount: 488_052,
        popularity: null,
      });

      const anilistPopularity = scoreRecommendation(anilist, buildProfile(), { weights })
        .featureScores.popularity;
      const malPopularity = scoreRecommendation(mal, buildProfile(), { weights }).featureScores
        .popularity;

      expect(anilistPopularity).toBe(malPopularity);
      expect(anilistPopularity).toBeGreaterThan(0);
    });

    it('still fills Highly Compatible from a mainstream AniList candidate pool', () => {
      const watched = Array.from({ length: 60 }, (_, index) =>
        entry(index + 1, 8 + (index % 3), {
          genres: [
            { id: 1, name: 'Action' },
            { id: 2, name: 'Adventure' },
          ],
          themes: [{ id: 3, name: 'School Life' }],
          studios: [],
        }),
      );
      // Trending titles carry mainstream list-member counts, which must not read as obscure.
      const candidates = Array.from({ length: 30 }, (_, index) =>
        normalizeAniList({
          id: 50_000 + index,
          title: { romaji: `Candidate ${index}` },
          averageScore: 84,
          genres: ['Action', 'Adventure'],
          format: 'TV',
          episodes: 12,
          seasonYear: 2024,
          season: 'SPRING',
          status: 'FINISHED',
          popularity: 20_000 + index * 30_000,
          tags: [{ id: 1, name: 'School Life', rank: 90 }],
        }),
      );

      const result = generateRecommendations(
        { watched, candidates },
        { limit: candidates.length, generatedAt: '2026-01-01T00:00:00.000Z' },
      );

      expect(result.filter((item) => item.category === 'highly-compatible').length).toBeGreaterThan(
        0,
      );
    });
  });
});
