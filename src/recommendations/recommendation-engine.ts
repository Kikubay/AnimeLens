import type { Anime, AnimeListEntry, AnimeSeason, AnimeType } from '../domain/anime';
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationReason,
  RecommendationReasonKind,
} from '../domain/recommendation';
import type { UserTasteProfile } from '../domain/user-profile';
import { getCopy, type Language } from '../locales';
import type {
  FeedbackFeatureSnapshot,
  FeedbackValue,
  RecommendationFeedback,
  DislikeReason,
} from '../domain/feedback';
import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  type FeaturePreference,
  type FeaturePreferenceMap,
  type FeatureVector,
  type RecommendationGenerationOptions,
  type RecommendationInput,
  type RecommendationProfile,
  type RecommendationScore,
  type RecommendationWeights,
  type ScoredCandidate,
} from './recommendation-types';

const MAX_SCORE = 100;
const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z';
const MIN_VALID_ID = 1;
const MAX_REASON_COUNT = 3;
// Half-open bands, walked top-down, so a title qualifying for a higher tier never falls into a
// lower one however well it matches that tier's qualitative condition.
const HIGHLY_COMPATIBLE_MIN_SCORE = 70;
const BECAUSE_YOU_LIKED_MIN_SCORE = 50;
const HIDDEN_GEM_MIN_SCORE = 30;
// "Demonstrably high community rating": the provider mean, on a 0-10 scale.
const HIDDEN_GEM_MIN_RATING = 7;
const HIDDEN_GEM_MAX_MEMBERS = 150_000;
const HIDDEN_GEM_MIN_POPULARITY_RANK = 400;
const BECAUSE_YOU_LIKED_MIN_RATING = 7;
const BECAUSE_YOU_LIKED_MIN_SHARED_FEATURES = 2;
// Below this many liked entries, any overlap is inherently specific — a tiny cohort can't saturate the feature space.
const BECAUSE_YOU_LIKED_SMALL_COHORT = 3;
// Past this cohort size two shared features is the base rate, so a deeper match is the only
// attribution that still means anything.
const BECAUSE_YOU_LIKED_SHALLOW_COHORT_LIMIT = 12;
const BECAUSE_YOU_LIKED_MIN_DEEP_SHARED_FEATURES = 3;
const BECAUSE_YOU_LIKED_MAX_SIMILAR_SHARE = 0.4;

export function extractFeatures(anime: Anime): FeatureVector {
  return {
    genres: uniqueNames(anime.genres.map((item) => item.name)),
    themes: uniqueNames(anime.themes.map((item) => item.name)),
    studios: uniqueNames(anime.studios.map((item) => item.name)),
    staff: uniqueNames(anime.staff.map((item) => item.name)),
    type: anime.type,
    year: validYear(anime.year),
    season: anime.season,
    popularity: validPositiveNumber(anime.popularity),
    score: validScore(anime.score),
  };
}

export function buildUserPreferenceProfile(
  entries: readonly AnimeListEntry[],
  feedback: readonly RecommendationFeedback[] = [],
  now: string = new Date().toISOString(),
): RecommendationProfile {
  const genres = new Map<string, MutablePreference>();
  const themes = new Map<string, MutablePreference>();
  const studios = new Map<string, MutablePreference>();
  const staff = new Map<string, MutablePreference>();
  const types = new Map<AnimeType, MutablePreference>();
  const seasons = new Map<AnimeSeason, MutablePreference>();
  const years = new Map<number, MutablePreference>();
  let scoreTotal = 0;
  let ratedAnimeCount = 0;
  let sourceAnimeCount = 0;
  let feedbackCount = 0;

  for (const entry of entries) {
    if (!isValidAnime(entry.anime)) continue;
    sourceAnimeCount += 1;
    const signal = scoreSignal(entry.userScore ?? entry.anime.userScore, entry.status);
    if (signal === null) continue;
    if (entry.userScore !== null || entry.anime.userScore !== null) {
      scoreTotal += entry.userScore ?? entry.anime.userScore ?? 0;
      ratedAnimeCount += 1;
    }
    const features = extractFeatures(entry.anime);
    addSignals(genres, features.genres, signal);
    addSignals(themes, features.themes, signal);
    addSignals(studios, features.studios, signal);
    addSignals(staff, features.staff, signal);
    addSignal(types, features.type, signal);
    if (features.season !== null) addSignal(seasons, features.season, signal);
    if (features.year !== null) addSignal(years, features.year, signal);
  }

  for (const item of feedback) {
    if (item.features === undefined || !isActiveFeedback(item, now)) continue;
    const signal = feedbackSignal(item.value);
    if (signal === null) continue;
    feedbackCount += 1;
    if (item.value === 'dislike' && item.reasons !== undefined && item.reasons.length > 0) {
      addReasonedFeedbackSignals(item.features, item.reasons, signal, {
        genres,
        themes,
        studios,
        staff,
        types,
        seasons,
        years,
      });
      continue;
    }
    addFeedbackSignals(genres, item.features, signal, (features) => features.genres);
    addFeedbackSignals(themes, item.features, signal, (features) => features.themes);
    addFeedbackSignals(studios, item.features, signal, (features) => features.studios);
    addFeedbackSignals(staff, item.features, signal, (features) => features.staff);
    addSignal(types, item.features.type, signal);
    if (item.features.season !== null) addSignal(seasons, item.features.season, signal);
    if (item.features.year !== null) addSignal(years, item.features.year, signal);
  }

  return {
    genres: freezeMap(genres),
    themes: freezeMap(themes),
    studios: freezeMap(studios),
    staff: freezeMap(staff),
    types: freezeMap(types),
    seasons: freezeMap(seasons),
    years: freezeMap(years),
    averageScore: ratedAnimeCount === 0 ? null : scoreTotal / ratedAnimeCount,
    ratedAnimeCount,
    sourceAnimeCount,
    feedbackCount,
  };
}

export function scoreRecommendation(
  anime: Anime,
  profile: RecommendationProfile | UserTasteProfile,
  options: Pick<RecommendationGenerationOptions, 'weights' | 'nowYear' | 'language'> = {},
): RecommendationScore {
  const normalizedProfile = isRecommendationProfile(profile) ? profile : fromLegacyProfile(profile);
  const weights = mergeWeights(options.weights);
  const features = extractFeatures(anime);
  const featureScores: Record<string, number> = {
    genres: scoreNamedFeatures(features.genres, normalizedProfile.genres),
    themes: scoreNamedFeatures(features.themes, normalizedProfile.themes),
    studios: scoreNamedFeatures(features.studios, normalizedProfile.studios),
    staff: scoreNamedFeatures(features.staff, normalizedProfile.staff),
    type: scorePreference(features.type, normalizedProfile.types),
    season: scoreNullablePreference(features.season, normalizedProfile.seasons),
    year: scoreYear(features.year, normalizedProfile.years),
    quality: scoreQuality(features.score),
    popularity: scorePopularity(features.popularity, anime.memberCount),
  };

  const weightedTotal =
    featureScores.genres * weights.genres +
    featureScores.themes * weights.themes +
    featureScores.studios * weights.studios +
    featureScores.staff * weights.staff +
    featureScores.type * weights.type +
    featureScores.season * weights.season +
    featureScores.year * weights.year +
    featureScores.quality * weights.quality +
    featureScores.popularity * weights.popularity;
  const totalWeight = sumWeights(weights);
  const rawValue = totalWeight === 0 ? 0.5 : clamp(weightedTotal / totalWeight, 0, 1);
  const confidence = calculateConfidence(normalizedProfile, features);
  const normalized = Math.round(clamp(rawValue * MAX_SCORE, 0, MAX_SCORE));

  return {
    value: rawValue,
    normalized,
    confidence,
    featureScores,
    reasons: createReasons(anime, features, normalizedProfile, featureScores, options.language),
  };
}

export function generateRecommendations(
  input: RecommendationInput,
  options: RecommendationGenerationOptions = {},
): Recommendation[] {
  const feedback = input.feedback ?? [];
  const profile = buildUserPreferenceProfile(input.watched, feedback, options.now);
  const watchedIds = new Set(
    input.watched.filter((entry) => isValidAnime(entry.anime)).map((entry) => entry.anime.id),
  );
  const feedbackExcludedIds = feedback
    .filter(
      (item) =>
        item.value !== 'like' && isActiveFeedback(item, options.now ?? new Date().toISOString()),
    )
    .map((item) => item.animeMalId);
  const excludedIds = new Set([
    ...watchedIds,
    ...feedbackExcludedIds,
    ...(input.rejectedAnimeIds ?? []),
    ...(options.rejectedAnimeIds ?? []),
    ...(options.excludedAnimeIds ?? []),
  ]);
  const discovery = normalizeDiscoveryPreferences(options.discovery);
  const rejectedGenres = new Set(
    [
      ...(input.rejectedGenres ?? []),
      ...(options.rejectedGenres ?? []),
      ...discovery.excludedGenres,
    ].map(normalizeName),
  );
  const rejectedThemes = new Set(discovery.excludedThemes.map(normalizeName));
  const candidates = deduplicateCandidates(input.candidates.filter(isValidAnime))
    .filter((anime) => !excludedIds.has(anime.id))
    .filter((anime) => discovery.includeHiddenGems || !isObscure(anime))
    .filter((anime) => discovery.showCompletedAnime || anime.status !== 'finished_airing')
    .filter((anime) => !anime.genres.some((genre) => rejectedGenres.has(normalizeName(genre.name))))
    .filter((anime) => !anime.themes.some((theme) => rejectedThemes.has(normalizeName(theme.name))))
    .filter((anime) => discovery.includeMovies || anime.type !== 'movie')
    .filter((anime) => discovery.includeOlderAnime || anime.year === null || anime.year >= 2010)
    .filter(
      (anime) =>
        discovery.includeShortSeries ||
        anime.episodeCount === null ||
        anime.episodeCount > 13 ||
        anime.type === 'movie',
    )
    .filter((anime) =>
      discovery.contentRating === 'explicit'
        ? true
        : discovery.contentRating === 'questionable'
          ? anime.contentRating !== 'explicit'
          : anime.contentRating === undefined || anime.contentRating === 'safe',
    )
    .map((anime) => {
      // Kept free of bonuses so the categorisation bands are judged on the same number the card shows.
      const score = scoreRecommendation(anime, profile, {
        ...options,
        weights: effectiveWeights(options.weights, discovery),
      });
      return {
        anime,
        score,
        category: categorize(anime, score, input.watched),
      };
    })
    .filter((candidate) => candidate.score.normalized >= discovery.minimumCompatibilityScore)
    .sort(compareCandidates);

  return ensureSectionMinimums(
    diversify(
      ensureDiscoveryVariety(candidates),
      options.limit ?? 20,
      options.generatedAt ?? DEFAULT_GENERATED_AT,
    ),
    input.watched.length,
  );
}

/** Mirrors the dashboard's section split, so shortfalls are measured against what the user sees. */
const SECTION_MEMBERSHIP: readonly {
  readonly key: string;
  readonly categories: readonly RecommendationCategory[];
}[] = [
  { key: 'highly-compatible', categories: ['highly-compatible'] },
  { key: 'because-you-liked', categories: ['because-you-liked'] },
  { key: 'hidden-gem', categories: ['hidden-gem'] },
  { key: 'explore', categories: ['explore', 'genre-discovery'] },
];

/**
 * A longer library has earned more shelf space in every section, so the floor rises with it. Capped
 * well under the per-section display cap so a pool smaller than four times the floor still works.
 */
function minimumSectionTitles(analyzedCount: number): number {
  return clamp(Math.round(5 + (analyzedCount - 10) * 0.08), 5, 16);
}

function sectionKeyOf(category: RecommendationCategory): string {
  return (
    SECTION_MEMBERSHIP.find((section) => section.categories.includes(category))?.key ?? 'explore'
  );
}

/**
 * The bands alone leave sections empty on a short library, because every candidate scores into the
 * same band. Titles are moved rather than copied, so none can appear twice, and a donor section is
 * never taken below its own floor; a moved title keeps its score, which is what makes its band bend.
 */
function ensureSectionMinimums(
  recommendations: readonly Recommendation[],
  analyzedCount: number,
): Recommendation[] {
  const minimum = minimumSectionTitles(analyzedCount);
  const result = recommendations.map((item) => ({ ...item }));
  const sectionCount = (key: string): number =>
    result.filter((item) => sectionKeyOf(item.category) === key).length;

  for (const target of SECTION_MEMBERSHIP) {
    const targetCategory = target.categories[0];
    if (targetCategory === undefined) continue;
    while (sectionCount(target.key) < minimum) {
      const donorKey = SECTION_MEMBERSHIP.filter(
        (section) => section.key !== target.key && sectionCount(section.key) > minimum,
      ).sort((left, right) => sectionCount(right.key) - sectionCount(left.key))[0]?.key;
      if (donorKey === undefined) break;
      const donorIndex = result
        .map((item, index) => ({ item, index }))
        .filter((entry) => sectionKeyOf(entry.item.category) === donorKey)
        .sort(
          (left, right) => right.item.compatibilityScore - left.item.compatibilityScore,
        )[0]?.index;
      if (donorIndex === undefined) break;
      result[donorIndex] = { ...result[donorIndex], category: targetCategory };
    }
  }
  return result;
}

function ensureDiscoveryVariety(candidates: readonly ScoredCandidate[]): ScoredCandidate[] {
  if (candidates.length < 12) return [...candidates];

  const result = [...candidates];
  const count = (category: RecommendationCategory) =>
    result.filter((candidate) => candidate.category === category).length;
  // Genre-discovery is the only donor, since moving a title out of a banded section would break the
  // rule that an 85% match stays Highly Compatible.
  const reclassifyDiscovery = (replacement: RecommendationCategory): void => {
    if (count('genre-discovery') < 2) return;
    const index = [...result]
      .reverse()
      .findIndex((candidate) => candidate.category === 'genre-discovery');
    if (index < 0) return;
    const actualIndex = result.length - 1 - index;
    const candidate = result[actualIndex];
    if (candidate !== undefined) result[actualIndex] = { ...candidate, category: replacement };
  };

  // Explore is the only section that can be topped up this way; a starved genre-discovery is left as
  // the engine scored it rather than taking from a banded section.
  if (count('explore') === 0) reclassifyDiscovery('explore');
  return result;
}

function diversify(
  candidates: readonly ScoredCandidate[],
  limit: number,
  generatedAt: string,
): Recommendation[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  const remaining = [...candidates];
  const selected: ScoredCandidate[] = [];
  const categoryCounts = new Map<RecommendationCategory, number>();
  const genreCounts = new Map<string, number>();

  while (remaining.length > 0 && selected.length < safeLimit) {
    let bestIndex = 0;
    let bestUtility = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const utility = diversityUtility(candidate, categoryCounts, genreCounts, selected.length);
      if (utility > bestUtility) {
        bestUtility = utility;
        bestIndex = index;
      }
    }
    const [candidate] = remaining.splice(bestIndex, 1);
    if (candidate === undefined) break;
    selected.push(candidate);
    increment(categoryCounts, candidate.category);
    for (const genre of candidate.anime.genres) increment(genreCounts, normalizeName(genre.name));
  }

  return selected.map((candidate) => ({
    id: `local-${candidate.anime.id}`,
    anime: candidate.anime,
    category: candidate.category,
    compatibilityScore: candidate.score.normalized,
    reasons: candidate.score.reasons.slice(0, MAX_REASON_COUNT),
    generatedAt,
  }));
}

type MutablePreference = { positive: number; negative: number; count: number };

function feedbackSignal(value: FeedbackValue): number | null {
  if (value === 'like') return 0.3;
  if (value === 'dislike') return -0.25;
  return null;
}

function isActiveFeedback(feedback: RecommendationFeedback, now: string): boolean {
  if (feedback.value !== 'not_now') return true;
  if (feedback.expiresAt === undefined || feedback.expiresAt === null) return true;
  const expiresAt = Date.parse(feedback.expiresAt);
  const currentTime = Date.parse(now);
  return Number.isFinite(expiresAt) && Number.isFinite(currentTime) && expiresAt > currentTime;
}

function addReasonedFeedbackSignals(
  features: FeedbackFeatureSnapshot,
  reasons: readonly DislikeReason[],
  signal: number,
  maps: {
    readonly genres: Map<string, MutablePreference>;
    readonly themes: Map<string, MutablePreference>;
    readonly studios: Map<string, MutablePreference>;
    readonly staff: Map<string, MutablePreference>;
    readonly types: Map<AnimeType, MutablePreference>;
    readonly seasons: Map<AnimeSeason, MutablePreference>;
    readonly years: Map<number, MutablePreference>;
  },
): void {
  for (const reason of reasons) {
    if (reason.kind === 'genre' && reason.name !== undefined) {
      addSignal(maps.genres, reason.name, signal);
    } else if (reason.kind === 'theme' && reason.name !== undefined) {
      addSignal(maps.themes, reason.name, signal);
    }
  }
}

function addFeedbackSignals(
  map: Map<string, MutablePreference>,
  features: FeedbackFeatureSnapshot,
  signal: number,
  select: (features: FeedbackFeatureSnapshot) => readonly string[],
): void {
  for (const value of select(features)) addSignal(map, value, signal);
}

function scoreSignal(value: number | null, status: AnimeListEntry['status']): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 10) {
    if (value >= 10) return 1;
    if (value >= 9) return 0.8;
    if (value >= 8) return 0.6;
    if (value >= 7) return 0.25;
    if (value >= 5) return 0;
    if (value >= 3) return -0.35;
    return -0.8;
  }
  if (status === 'completed') return 0.2;
  if (status === 'dropped') return -0.35;
  if (status === 'watching' || status === 'rewatching') return 0.1;
  return null;
}

function addSignals(
  map: Map<string, MutablePreference>,
  values: readonly string[],
  signal: number,
): void {
  for (const value of values) addSignal(map, value, signal);
}

function addSignal<T>(map: Map<T, MutablePreference>, key: T, signal: number): void {
  const normalizedKey = typeof key === 'string' ? (normalizeName(key) as T) : key;
  const current = map.get(normalizedKey) ?? { positive: 0, negative: 0, count: 0 };
  if (signal > 0) current.positive += signal;
  if (signal < 0) current.negative += Math.abs(signal);
  current.count += 1;
  map.set(normalizedKey, current);
}

function freezeMap<T>(map: Map<T, MutablePreference>): ReadonlyMap<T, FeaturePreference> {
  return new Map([...map.entries()].map(([key, value]) => [key, { ...value }] as const));
}

function fromLegacyProfile(profile: UserTasteProfile): RecommendationProfile {
  const genres = new Map<string, FeaturePreference>();
  for (const [name, value] of profile.preferredGenres) {
    genres.set(normalizeName(name), {
      positive: Math.max(0, value),
      negative: Math.max(0, -value),
      count: 1,
    });
  }
  const types = new Map<AnimeType, FeaturePreference>();
  for (const [type, value] of profile.preferredFormats) {
    types.set(type, { positive: Math.max(0, value), negative: Math.max(0, -value), count: 1 });
  }
  return {
    genres,
    themes: normalizeFeaturePreferenceMap(profile.preferredThemes),
    studios: normalizeFeaturePreferenceMap(profile.preferredStudios),
    staff: normalizeFeaturePreferenceMap(profile.preferredStaff),
    types: profile.preferredTypes ?? types,
    seasons: profile.preferredSeasons ?? new Map(),
    years: new Map(),
    averageScore: Number.isFinite(profile.averageScore) ? profile.averageScore : null,
    ratedAnimeCount: profile.ratedAnimeCount,
    sourceAnimeCount: profile.sourceAnimeCount ?? profile.ratedAnimeCount,
    feedbackCount: 0,
  };
}

function normalizeFeaturePreferenceMap(
  values: ReadonlyMap<string, FeaturePreference> | undefined,
): FeaturePreferenceMap {
  if (values === undefined) return new Map();
  return new Map([...values.entries()].map(([key, value]) => [normalizeName(key), value] as const));
}

function mergeWeights(overrides?: Partial<RecommendationWeights>): RecommendationWeights {
  return { ...DEFAULT_RECOMMENDATION_WEIGHTS, ...overrides };
}

function normalizeDiscoveryPreferences(preferences: RecommendationGenerationOptions['discovery']): {
  readonly recommendationMode: 'personalized' | 'exploratory';
  readonly includeHiddenGems: boolean;
  readonly includeOlderAnime: boolean;
  readonly includeMovies: boolean;
  readonly includeShortSeries: boolean;
  readonly preferredGenres: ReadonlySet<string>;
  readonly preferredFormats: readonly AnimeType[];
  readonly preferredSeasons: readonly AnimeSeason[];
  readonly contentRating: 'safe' | 'questionable' | 'explicit';
  readonly showCompletedAnime: boolean;
  readonly minimumCompatibilityScore: number;
  readonly excludedGenres: readonly string[];
  readonly excludedThemes: readonly string[];
} {
  return {
    recommendationMode: preferences?.recommendationMode ?? 'personalized',
    includeHiddenGems: preferences?.includeHiddenGems ?? true,
    includeOlderAnime: preferences?.includeOlderAnime ?? true,
    includeMovies: preferences?.includeMovies ?? true,
    includeShortSeries: preferences?.includeShortSeries ?? true,
    preferredGenres: new Set((preferences?.preferredGenres ?? []).map(normalizeName)),
    preferredFormats: preferences?.preferredFormats ?? [],
    preferredSeasons: preferences?.preferredSeasons ?? [],
    contentRating: preferences?.contentRating ?? 'safe',
    showCompletedAnime: preferences?.showCompletedAnime ?? true,
    minimumCompatibilityScore: clamp(preferences?.minimumCompatibilityScore ?? 0, 0, 100),
    excludedGenres: preferences?.excludedGenres ?? [],
    excludedThemes: preferences?.excludedThemes ?? [],
  };
}

function effectiveWeights(
  weights: Partial<RecommendationWeights> | undefined,
  discovery: ReturnType<typeof normalizeDiscoveryPreferences>,
): Partial<RecommendationWeights> {
  if (discovery.recommendationMode === 'exploratory') {
    return {
      ...weights,
      genres: Math.min(weights?.genres ?? DEFAULT_RECOMMENDATION_WEIGHTS.genres, 0.2),
      popularity: Math.max(weights?.popularity ?? DEFAULT_RECOMMENDATION_WEIGHTS.popularity, 0.16),
      quality: Math.max(weights?.quality ?? DEFAULT_RECOMMENDATION_WEIGHTS.quality, 0.16),
    };
  }
  return weights ?? {};
}

function sumWeights(weights: RecommendationWeights): number {
  return Object.values(weights).reduce((total, value) => total + Math.max(0, value), 0);
}

// An unseen feature scores 0, not a neutral 0.5: scoring it as average fit gave every unknown
// title 40+ free points, which floored the composite and emptied the lower bands for large
// libraries. An empty profile still scores 0.5, because then there is no signal either way.
function scoreNamedFeatures(values: readonly string[], preferences: FeaturePreferenceMap): number {
  if (preferences.size === 0) return 0.5;
  if (values.length === 0) return 0;
  const total = values.reduce(
    (sum, value) => sum + preferenceToScore(preferences.get(normalizeName(value))),
    0,
  );
  return clamp(total / values.length, 0, 1);
}

function scorePreference<T>(value: T, preferences: ReadonlyMap<T, FeaturePreference>): number {
  if (preferences.size === 0) return 0.5;
  return preferenceToScore(preferences.get(value));
}

function scoreNullablePreference<T>(
  value: T | null,
  preferences: ReadonlyMap<T, FeaturePreference>,
): number {
  return value === null ? 0.5 : scorePreference(value, preferences);
}

function scoreYear(
  year: number | null,
  preferences: ReadonlyMap<number, FeaturePreference>,
): number {
  if (year === null || preferences.size === 0) return 0.5;
  let best = 0;
  for (const [preferredYear, preference] of preferences) {
    const distance = Math.abs(year - preferredYear);
    const proximity = Math.max(0, 1 - distance / 10);
    best = Math.max(best, proximity * preferenceToScore(preference));
  }
  return best;
}

function scoreQuality(score: number | null): number {
  return score === null ? 0.5 : clamp(score / 10, 0, 1);
}

function scorePopularity(popularityRank: number | null, memberCount: number | null): number {
  if (memberCount !== null) return clamp(Math.log10(memberCount + 1) / 7, 0, 1);
  if (popularityRank !== null && popularityRank > 0) {
    return clamp(1 - Math.log10(popularityRank) / 4, 0, 1);
  }
  return 0.5;
}

function preferenceToScore(preference: FeaturePreference | undefined): number {
  if (preference === undefined || preference.count === 0) return 0;
  const signed =
    (preference.positive - preference.negative) / Math.max(1, Math.sqrt(preference.count));
  return clamp(0.5 + signed / 2, 0, 1);
}

function calculateConfidence(profile: RecommendationProfile, features: FeatureVector): number {
  if (profile.sourceAnimeCount === 0) return 0;
  const evidence = [
    features.genres.some((item) => profile.genres.has(normalizeName(item))),
    features.themes.some((item) => profile.themes.has(normalizeName(item))),
    features.studios.some((item) => profile.studios.has(normalizeName(item))),
    features.staff.some((item) => profile.staff.has(normalizeName(item))),
    profile.types.has(features.type),
  ].filter(Boolean).length;
  return clamp((Math.min(profile.sourceAnimeCount, 10) / 10) * (0.5 + evidence / 10), 0, 1);
}

function createReasons(
  anime: Anime,
  features: FeatureVector,
  profile: RecommendationProfile,
  scores: Readonly<Record<string, number>>,
  language: Language = 'en',
): RecommendationReason[] {
  const copy = getCopy(language);
  const reasons: RecommendationReason[] = [];
  const add = (reason: RecommendationReason) => {
    if (reasons.length < MAX_REASON_COUNT) reasons.push(reason);
  };

  for (const genre of features.genres) {
    const score = preferenceToScore(profile.genres.get(normalizeName(genre)));
    if (score > 0.65) {
      add(reason('genre', copy.reasonGenre(genre), score));
      break;
    }
  }
  for (const theme of features.themes) {
    const score = preferenceToScore(profile.themes.get(normalizeName(theme)));
    if (score > 0.65) {
      add(reason('theme', copy.reasonTheme(theme), score));
      break;
    }
  }
  if (scores.studios > 0.65 && features.studios[0] !== undefined) {
    add(reason('similarity', copy.reasonStudio(features.studios[0]), scores.studios));
  }
  if (scores.staff > 0.65 && features.staff[0] !== undefined) {
    add(reason('similarity', copy.reasonStaff, scores.staff));
  }
  if (
    profile.averageScore !== null &&
    anime.score !== null &&
    anime.score >= profile.averageScore
  ) {
    add(reason('rating', copy.reasonRating, scores.quality));
  }
  if (reasons.length === 0 && scores.popularity >= 0.7) {
    add(reason('discovery', copy.reasonSafePick, scores.popularity));
  }
  if (reasons.length === 0) {
    add(reason('discovery', copy.reasonProfileFit, 0.5));
  }
  return reasons.slice(0, MAX_REASON_COUNT);
}

function reason(
  kind: RecommendationReasonKind,
  label: string,
  weight: number,
): RecommendationReason {
  return { kind, label, weight: clamp(weight, 0, 1) };
}

function categorize(
  anime: Anime,
  score: RecommendationScore,
  watched: readonly AnimeListEntry[],
): RecommendationCategory {
  const compatibility = score.normalized;
  if (compatibility >= HIGHLY_COMPATIBLE_MIN_SCORE) return 'highly-compatible';
  if (
    compatibility >= BECAUSE_YOU_LIKED_MIN_SCORE &&
    compatibility < HIGHLY_COMPATIBLE_MIN_SCORE &&
    becauseYouLikedSource(anime, watched) !== undefined
  ) {
    return 'because-you-liked';
  }
  if (
    compatibility >= HIDDEN_GEM_MIN_SCORE &&
    compatibility < BECAUSE_YOU_LIKED_MIN_SCORE &&
    hasCommunityAcclaim(anime)
  ) {
    return 'hidden-gem';
  }
  if (compatibility >= 60 && anime.genres.length > 0) return 'genre-discovery';
  return 'explore';
}

// Provenance only has to clear a distinctiveness bar once the cohort is big enough for the bar to
// mean anything. On a short list every candidate overlaps several liked entries simply because the
// list spans few genres, so applying it there emptied this section for exactly the users with the
// smallest libraries.
function becauseYouLikedSource(
  anime: Anime,
  watched: readonly AnimeListEntry[],
): AnimeListEntry | undefined {
  let best: { readonly entry: AnimeListEntry; readonly shared: number } | null = null;
  let likedCount = 0;
  let similarCount = 0;
  for (const entry of watched) {
    if ((entry.userScore ?? 0) < BECAUSE_YOU_LIKED_MIN_RATING) continue;
    likedCount += 1;
    const shared = sharedFeatureCount(anime, entry.anime);
    if (shared < BECAUSE_YOU_LIKED_MIN_SHARED_FEATURES) continue;
    similarCount += 1;
    if (best === null || shared > best.shared) best = { entry, shared };
  }
  if (best === null) return undefined;
  if (likedCount <= BECAUSE_YOU_LIKED_SMALL_COHORT) return best.entry;
  if (likedCount > BECAUSE_YOU_LIKED_SHALLOW_COHORT_LIMIT) {
    if (best.shared < BECAUSE_YOU_LIKED_MIN_DEEP_SHARED_FEATURES) return undefined;
    const similarShare = similarCount / likedCount;
    if (similarShare >= BECAUSE_YOU_LIKED_MAX_SIMILAR_SHARE) return undefined;
  }
  return best.entry;
}

function sharedFeatureCount(left: Anime, right: Anime): number {
  const leftGenres = new Set(left.genres.map((item) => normalizeName(item.name)));
  const sharedGenres = right.genres.filter((item) =>
    leftGenres.has(normalizeName(item.name)),
  ).length;
  const leftThemes = new Set(left.themes.map((item) => normalizeName(item.name)));
  const sharedThemes = right.themes.filter((item) =>
    leftThemes.has(normalizeName(item.name)),
  ).length;
  return sharedGenres + sharedThemes;
}

// Obscurity no longer defines the category; this only backs the `includeHiddenGems` pool
// preference, which is about how mainstream a title is.
function isObscure(anime: Anime): boolean {
  if (anime.memberCount !== null) return anime.memberCount < HIDDEN_GEM_MAX_MEMBERS;
  return anime.popularity !== null && anime.popularity > HIDDEN_GEM_MIN_POPULARITY_RANK;
}

// Acclaim rather than obscurity: the section exists to surface quality the baseline underestimates,
// and an obscurity-only test rated a 1.0 title with a few thousand members as a Hidden Gem.
function hasCommunityAcclaim(anime: Anime): boolean {
  return anime.score !== null && anime.score >= HIDDEN_GEM_MIN_RATING;
}

function deduplicateCandidates(candidates: readonly Anime[]): Anime[] {
  const seen = new Set<number>();
  const result: Anime[] = [];
  for (const anime of candidates) {
    if (seen.has(anime.id)) continue;
    seen.add(anime.id);
    result.push(anime);
  }
  return result;
}

function compareCandidates(left: ScoredCandidate, right: ScoredCandidate): number {
  return right.score.normalized - left.score.normalized || left.anime.id - right.anime.id;
}

function diversityUtility(
  candidate: ScoredCandidate,
  categoryCounts: ReadonlyMap<RecommendationCategory, number>,
  genreCounts: ReadonlyMap<string, number>,
  selectedCount: number,
): number {
  const categoryPenalty = (categoryCounts.get(candidate.category) ?? 0) * 0.08;
  const genrePenalty =
    candidate.anime.genres.reduce(
      (sum, genre) => sum + (genreCounts.get(normalizeName(genre.name)) ?? 0),
      0,
    ) * 0.025;
  const coldStartBonus = selectedCount < 4 && candidate.category === 'explore' ? 0.02 : 0;
  return candidate.score.normalized / MAX_SCORE - categoryPenalty - genrePenalty + coldStartBonus;
}

function increment<T>(map: Map<T, number>, key: T): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function isRecommendationProfile(
  profile: RecommendationProfile | UserTasteProfile,
): profile is RecommendationProfile {
  return 'genres' in profile && 'themes' in profile && 'years' in profile;
}

function isValidAnime(anime: Anime): boolean {
  if (typeof anime !== 'object' || anime === null) return false;
  const candidate = anime as unknown as Record<string, unknown>;
  const title = candidate.title;
  return (
    Number.isInteger(candidate.id) &&
    (candidate.id as number) >= MIN_VALID_ID &&
    typeof title === 'object' &&
    title !== null &&
    'default' in title &&
    typeof title.default === 'string' &&
    title.default.trim().length > 0 &&
    Array.isArray(candidate.genres) &&
    Array.isArray(candidate.themes) &&
    Array.isArray(candidate.studios) &&
    Array.isArray(candidate.staff)
  );
}

function validScore(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
    ? value
    : null;
}

function validPositiveNumber(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function validYear(value: number | null): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 ? value : null;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueNames(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeName(value);
    if (normalized.length === 0 || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
