import type { Anime, AnimeListEntry, AnimeSeason, AnimeType } from '../domain/anime';
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationReason,
  RecommendationReasonKind,
} from '../domain/recommendation';
import type { UserTasteProfile } from '../domain/user-profile';
import {
  currentCalendarYear,
  normalizeRecommendationPeriod,
} from '../domain/recommendation-period';
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
  type RecommendationAttribution,
  type RecommendationDiscoveryPreferences,
  type RecommendationGenerationOptions,
  type RecommendationInput,
  type RecommendationProfile,
  type RecommendationScore,
  type RecommendationWeights,
  type ScoredCandidate,
  type SectionedCandidate,
} from './recommendation-types';
import {
  fitRatingModel,
  predictUserRating,
  type RatingModel,
  type RatingSample,
} from './rating-model';
import { tasteRecencyWeight } from './taste-decay';

const MAX_SCORE = 100;
// The midpoint of every 0..1 preference score: no evidence either way.
const NEUTRAL_FEATURE_SCORE = 0.5;
const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z';
const MIN_VALID_ID = 1;
const MAX_REASON_COUNT = 3;
const HIGHLY_COMPATIBLE_MIN_SCORE = 70;
const BECAUSE_YOU_LIKED_MIN_SCORE = 50;
const HIDDEN_GEM_MIN_SCORE = 30;
const HIDDEN_GEM_MIN_RATING = 7;
const HIDDEN_GEM_MAX_MEMBERS = 150_000;
const HIDDEN_GEM_MIN_POPULARITY_RANK = 400;
const BECAUSE_YOU_LIKED_MIN_RATING = 7;
const BECAUSE_YOU_LIKED_MIN_SIMILARITY = 0.5;
const BECAUSE_YOU_LIKED_MIN_LIFT = 0.06;
const BECAUSE_YOU_LIKED_MIN_COHORT_FOR_LIFT = 3;
const SIMILARITY_DIMENSIONS = [
  { key: 'genres', weight: 0.45 },
  { key: 'themes', weight: 0.3 },
  { key: 'studios', weight: 0.15 },
  { key: 'staff', weight: 0.1 },
] as const;
const DISCOVERY_PREFERENCE_WEIGHT = 0.12;
const SHORT_SERIES_MAX_EPISODES = 13;
const CATEGORY_DISPERSION_PENALTY = 0.35;
const GENRE_DISPERSION_PENALTY = 0.25;
const STUDIO_DISPERSION_PENALTY = 0.1;
const COLD_START_EXPLORE_BONUS = 0.02;
const COLD_START_EXPLORE_TITLES = 4;
const SECTION_BASE_TITLES = 6;
const SECTION_TITLES_PER_LIBRARY_ENTRY = 0.12;
export const MAX_SECTION_TITLES = 24;

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
  const ratingSamples: RatingSample[] = [];

  for (const entry of entries) {
    if (!isValidAnime(entry.anime)) continue;
    sourceAnimeCount += 1;
    const signal = scoreSignal(entry.userScore ?? entry.anime.userScore, entry.status);
    if (signal === null) continue;
    const entryScore = entry.userScore ?? entry.anime.userScore;
    if (entryScore !== null) {
      scoreTotal += entryScore;
      ratedAnimeCount += 1;
      const communityScore = validScore(entry.anime.score);
      if (communityScore !== null) ratingSamples.push({ communityScore, userScore: entryScore });
    }
    const features = extractFeatures(entry.anime);
    const weight = tasteRecencyWeight(entry.updatedAt, now);
    addSignals(genres, features.genres, signal, weight);
    addSignals(themes, features.themes, signal, weight);
    addSignals(studios, features.studios, signal, weight);
    addSignals(staff, features.staff, signal, weight);
    addSignal(types, features.type, signal, weight);
    if (features.season !== null) addSignal(seasons, features.season, signal, weight);
    if (features.year !== null) addSignal(years, features.year, signal, weight);
  }

  for (const item of feedback) {
    if (item.features === undefined || !isActiveFeedback(item, now)) continue;
    const signal = feedbackSignal(item.value);
    if (signal === null) continue;
    feedbackCount += 1;
    const weight = tasteRecencyWeight(item.createdAt, now);
    if (item.value === 'dislike' && item.reasons !== undefined && item.reasons.length > 0) {
      addReasonedFeedbackSignals(
        item.reasons,
        signal,
        {
          genres,
          themes,
          studios,
          staff,
          types,
          seasons,
          years,
        },
        weight,
      );
      continue;
    }
    addFeedbackSignals(genres, item.features, signal, (features) => features.genres, weight);
    addFeedbackSignals(themes, item.features, signal, (features) => features.themes, weight);
    addFeedbackSignals(studios, item.features, signal, (features) => features.studios, weight);
    addFeedbackSignals(staff, item.features, signal, (features) => features.staff, weight);
    addSignal(types, item.features.type, signal, weight);
    if (item.features.season !== null) addSignal(seasons, item.features.season, signal, weight);
    if (item.features.year !== null) addSignal(years, item.features.year, signal, weight);
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
    ratingModel: fitRatingModel(ratingSamples),
    ratedAnimeCount,
    sourceAnimeCount,
    feedbackCount,
  };
}

export function scoreRecommendation(
  anime: Anime,
  profile: RecommendationProfile | UserTasteProfile,
  options: Pick<
    RecommendationGenerationOptions,
    'weights' | 'nowYear' | 'language' | 'discovery' | 'attribution'
  > = {},
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
    quality: scoreQuality(features.score, normalizedProfile.ratingModel),
    popularity: scorePopularity(features.popularity, anime.memberCount),
  };

  let weightedTotal = 0;
  let totalWeight = 0;
  const addTerm = (value: number, weight: number): void => {
    weightedTotal += value * weight;
    totalWeight += weight;
  };
  addTerm(featureScores.genres ?? 0, weights.genres);
  addTerm(featureScores.themes ?? 0, weights.themes);
  addTerm(featureScores.studios ?? 0, weights.studios);
  addTerm(featureScores.staff ?? 0, weights.staff);
  addTerm(featureScores.type ?? 0, weights.type);
  addTerm(featureScores.season ?? 0, weights.season);
  addTerm(featureScores.year ?? 0, weights.year);
  addTerm(featureScores.quality ?? 0, weights.quality);
  addTerm(featureScores.popularity ?? 0, weights.popularity);

  const statedPreference = statedPreferenceTerm(options.discovery);
  if (statedPreference !== null) {
    featureScores.discovery = scoreStatedPreference(anime, statedPreference);
    addTerm(featureScores.discovery, DISCOVERY_PREFERENCE_WEIGHT);
  }

  const rawValue = totalWeight === 0 ? 0.5 : clamp(weightedTotal / totalWeight, 0, 1);
  const confidence = calculateConfidence(normalizedProfile, features);
  const normalized = Math.round(clamp(rawValue * MAX_SCORE, 0, MAX_SCORE));

  return {
    value: rawValue,
    normalized,
    confidence,
    featureScores,
    reasons: createReasons(
      anime,
      features,
      normalizedProfile,
      featureScores,
      options.language,
      options.attribution ?? null,
    ),
  };
}

function statedPreferenceTerm(
  preferences: Partial<RecommendationDiscoveryPreferences> | undefined,
): StatedPreference | null {
  const genres = preferences?.preferredGenres ?? [];
  const formats = preferences?.preferredFormats ?? [];
  const seasons = preferences?.preferredSeasons ?? [];
  const shortSeries = preferences?.includeShortSeries ?? false;
  if (genres.length === 0 && formats.length === 0 && seasons.length === 0 && !shortSeries) {
    return null;
  }
  return {
    genres: new Set(genres.map(normalizeName)),
    formats,
    seasons,
    shortSeries,
  };
}

function scoreStatedPreference(anime: Anime, term: StatedPreference): number {
  const dimensions: number[] = [];
  if (term.genres.size > 0) {
    const matched = anime.genres.filter((genre) =>
      term.genres.has(normalizeName(genre.name)),
    ).length;
    dimensions.push(clamp(matched / term.genres.size, 0, 1));
  }
  if (term.formats.length > 0) {
    dimensions.push(term.formats.includes(anime.type) ? 1 : 0);
  }
  if (term.seasons.length > 0) {
    dimensions.push(anime.season !== null && term.seasons.includes(anime.season) ? 1 : 0);
  }
  if (term.shortSeries) {
    dimensions.push(shortSeriesAffinity(anime));
  }
  if (dimensions.length === 0) return 0.5;
  return dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length;
}

function shortSeriesAffinity(anime: Anime): number {
  if (anime.episodeCount === null) return NEUTRAL_FEATURE_SCORE;
  return anime.episodeCount <= SHORT_SERIES_MAX_EPISODES ? 1 : 0;
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
  const discovery = normalizeDiscoveryPreferences(options.discovery, options.nowYear);
  const likedAffinity = buildLikedAffinity(input.watched);
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
    .filter(
      (anime) =>
        anime.year === null ||
        (anime.year >= discovery.startYear && anime.year <= discovery.endYear),
    )
    .filter((anime) =>
      discovery.contentRating === 'explicit'
        ? true
        : discovery.contentRating === 'questionable'
          ? anime.contentRating !== 'explicit'
          : anime.contentRating === undefined || anime.contentRating === 'safe',
    )
    .map((anime) => {
      const provenance = attributeProvenance(anime, likedAffinity);
      const score = scoreRecommendation(anime, profile, {
        ...options,
        weights: effectiveWeights(options.weights, discovery),
        attribution:
          provenance === null
            ? null
            : {
                title: provenance.entry.anime.title.default,
                strength: provenance.strength,
              },
      });
      const scored: ScoredCandidate = {
        anime,
        score,
        provenanceKnown: provenance !== null,
        provenanceStrength: provenance?.strength ?? 0,
      };
      return { ...scored, category: categorize(anime, score, provenance) };
    })
    .filter((candidate) => candidate.score.normalized >= discovery.minimumCompatibilityScore)
    .sort(compareCandidates);

  return toRecommendations(
    ensureSectionMinimums(
      diversify(ensureDiscoveryVariety(candidates), options.limit ?? 20),
      input.watched.length,
    ),
    options.generatedAt ?? DEFAULT_GENERATED_AT,
  );
}

function toRecommendations(
  candidates: readonly SectionedCandidate[],
  generatedAt: string,
): Recommendation[] {
  return candidates.map((candidate) => ({
    id: `local-${candidate.anime.id}`,
    anime: candidate.anime,
    category: candidate.category,
    compatibilityScore: candidate.score.normalized,
    reasons: candidate.score.reasons.slice(0, MAX_REASON_COUNT),
    generatedAt,
  }));
}

const SECTION_MEMBERSHIP: readonly {
  readonly key: string;
  readonly categories: readonly RecommendationCategory[];
}[] = [
  { key: 'highly-compatible', categories: ['highly-compatible'] },
  { key: 'because-you-liked', categories: ['because-you-liked'] },
  { key: 'hidden-gem', categories: ['hidden-gem'] },
  { key: 'explore', categories: ['explore', 'genre-discovery'] },
];

function minimumSectionTitles(analyzedCount: number, supply: number): number {
  const desired = clamp(
    Math.round(SECTION_BASE_TITLES + (analyzedCount - 10) * SECTION_TITLES_PER_LIBRARY_ENTRY),
    SECTION_BASE_TITLES,
    MAX_SECTION_TITLES,
  );
  return Math.min(desired, Math.floor(supply / SECTION_MEMBERSHIP.length));
}

function sectionKeyOf(category: RecommendationCategory): string {
  return (
    SECTION_MEMBERSHIP.find((section) => section.categories.includes(category))?.key ?? 'explore'
  );
}

function ensureSectionMinimums(
  candidates: readonly SectionedCandidate[],
  analyzedCount: number,
): readonly SectionedCandidate[] {
  const minimum = minimumSectionTitles(analyzedCount, candidates.length);
  const result = candidates.map((item) => ({ ...item }));
  const sectionCount = (key: string): number =>
    result.filter((item) => sectionKeyOf(item.category) === key).length;
  const bestMatch = (
    donorKey: string,
    targetCategory: RecommendationCategory,
  ): number | undefined => {
    return result
      .map((item, index) => ({ item, index }))
      .filter((entry) => sectionKeyOf(entry.item.category) === donorKey)
      .filter((entry) => admitsToSection(targetCategory, entry.item))
      .sort(
        (left, right) =>
          sectionPreference(targetCategory, right.item) -
            sectionPreference(targetCategory, left.item) ||
          left.item.anime.id - right.item.anime.id,
      )[0]?.index;
  };
  const relocate = (index: number, targetCategory: RecommendationCategory): void => {
    result[index] = { ...result[index], category: targetCategory };
  };

  for (const target of SECTION_MEMBERSHIP) {
    const targetCategory = target.categories[0];
    if (targetCategory === undefined) continue;
    while (sectionCount(target.key) < minimum) {
      let relocated = false;
      for (const donor of SECTION_MEMBERSHIP.filter(
        (section) => section.key !== target.key && sectionCount(section.key) > minimum,
      ).sort((left, right) => sectionCount(right.key) - sectionCount(left.key))) {
        const index = bestMatch(donor.key, targetCategory);
        if (index === undefined) continue;
        relocate(index, targetCategory);
        relocated = true;
        break;
      }
      // A section with nothing that legitimately belongs in it stays empty rather than being filled
      // with a mislabelled title, so the claim the UI prints under it is never false.
      if (!relocated) break;
    }
  }

  for (const source of SECTION_MEMBERSHIP) {
    while (sectionCount(source.key) > MAX_SECTION_TITLES) {
      let relocated = false;
      for (const target of SECTION_MEMBERSHIP.filter(
        (section) => section.key !== source.key && sectionCount(section.key) < MAX_SECTION_TITLES,
      )) {
        const targetCategory = target.categories[0];
        if (targetCategory === undefined) continue;
        const index = bestMatch(source.key, targetCategory);
        if (index === undefined) continue;
        relocate(index, targetCategory);
        relocated = true;
        break;
      }
      if (!relocated) break;
    }
  }

  return result;
}

// Every invariant `categorize` enforces, replayed for a title arriving from a donor section. Without
// the full set, an "Because You Liked" row could show a title with no liked entry behind it and a
// "Hidden Gem" could show something the community scored 3/10.
function admitsToSection(category: RecommendationCategory, candidate: ScoredCandidate): boolean {
  const score = candidate.score.normalized;
  if (category === 'highly-compatible') return score >= HIGHLY_COMPATIBLE_MIN_SCORE;
  if (category === 'because-you-liked') {
    return score >= BECAUSE_YOU_LIKED_MIN_SCORE && candidate.provenanceKnown;
  }
  if (category === 'hidden-gem') return hasCommunityAcclaim(candidate.anime);
  return true;
}

// What makes a title a good representative of the section it is being moved into, which is not the
// same question as which title scores best.
function sectionPreference(
  category: RecommendationCategory,
  candidate: SectionedCandidate,
): number {
  if (category === 'because-you-liked') return candidate.provenanceStrength;
  if (category === 'hidden-gem') return isObscure(candidate.anime) ? 1 : 0;
  if (category === 'explore') return -candidate.score.normalized;
  return candidate.score.normalized;
}

function ensureDiscoveryVariety(candidates: readonly SectionedCandidate[]): SectionedCandidate[] {
  if (candidates.length < 12) return [...candidates];

  const result = [...candidates];
  const count = (category: RecommendationCategory) =>
    result.filter((candidate) => candidate.category === category).length;
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

  if (count('explore') === 0) reclassifyDiscovery('explore');
  return result;
}

function diversify(
  candidates: readonly SectionedCandidate[],
  limit: number,
): readonly SectionedCandidate[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  const remaining = [...candidates];
  const selected: SectionedCandidate[] = [];
  const categoryCounts = new Map<RecommendationCategory, number>();
  const genreCounts = new Map<string, number>();
  const studioCounts = new Map<string, number>();

  while (remaining.length > 0 && selected.length < safeLimit) {
    let bestIndex = 0;
    let bestUtility = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const utility = diversityUtility(
        candidate,
        categoryCounts,
        genreCounts,
        studioCounts,
        selected.length,
      );
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
    for (const studio of candidate.anime.studios)
      increment(studioCounts, normalizeName(studio.name));
  }

  return selected;
}

type MutablePreference = { positive: number; negative: number; count: number };

/** A swipe is a deliberate call-out while most cards look likeable, so dislike outweighs like; both stay below a rating. */
function feedbackSignal(value: FeedbackValue): number | null {
  if (value === 'like') return 0.3;
  if (value === 'dislike') return -0.5;
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
  weight: number,
): void {
  for (const reason of reasons) {
    if (reason.kind === 'genre' && reason.name !== undefined) {
      addSignal(maps.genres, reason.name, signal, weight);
    } else if (reason.kind === 'theme' && reason.name !== undefined) {
      addSignal(maps.themes, reason.name, signal, weight);
    }
  }
}

function addFeedbackSignals(
  map: Map<string, MutablePreference>,
  features: FeedbackFeatureSnapshot,
  signal: number,
  select: (features: FeedbackFeatureSnapshot) => readonly string[],
  weight: number,
): void {
  for (const value of select(features)) addSignal(map, value, signal, weight);
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
  weight: number,
): void {
  for (const value of values) addSignal(map, value, signal, weight);
}

/** Scaling count alongside the evidence keeps `positive / count` stable, which the profile UI renders as percentages. */
function addSignal<T>(
  map: Map<T, MutablePreference>,
  key: T,
  signal: number,
  weight: number,
): void {
  const normalizedKey = typeof key === 'string' ? (normalizeName(key) as T) : key;
  const current = map.get(normalizedKey) ?? { positive: 0, negative: 0, count: 0 };
  if (signal > 0) current.positive += signal * weight;
  if (signal < 0) current.negative += Math.abs(signal) * weight;
  current.count += weight;
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
    ratingModel: null,
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

function normalizeDiscoveryPreferences(
  preferences: RecommendationGenerationOptions['discovery'],
  nowYear: number = currentCalendarYear(),
): {
  readonly recommendationMode: 'personalized' | 'exploratory';
  readonly includeHiddenGems: boolean;
  readonly includeMovies: boolean;
  readonly includeShortSeries: boolean;
  readonly startYear: number;
  readonly endYear: number;
  readonly preferredGenres: ReadonlySet<string>;
  readonly preferredFormats: readonly AnimeType[];
  readonly preferredSeasons: readonly AnimeSeason[];
  readonly contentRating: 'safe' | 'questionable' | 'explicit';
  readonly showCompletedAnime: boolean;
  readonly minimumCompatibilityScore: number;
  readonly excludedGenres: readonly string[];
  readonly excludedThemes: readonly string[];
} {
  const period = normalizeRecommendationPeriod(
    preferences?.startYear,
    preferences?.endYear,
    nowYear,
  );
  return {
    recommendationMode: preferences?.recommendationMode ?? 'personalized',
    includeHiddenGems: preferences?.includeHiddenGems ?? true,
    includeMovies: preferences?.includeMovies ?? true,
    includeShortSeries: preferences?.includeShortSeries ?? true,
    startYear: period.startYear,
    endYear: period.endYear,
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

function scoreNamedFeatures(values: readonly string[], preferences: FeaturePreferenceMap): number {
  if (preferences.size === 0) return NEUTRAL_FEATURE_SCORE;
  if (values.length === 0) return NEUTRAL_FEATURE_SCORE;
  const total = values.reduce(
    (sum, value) => sum + featurePreferenceScore(preferences.get(normalizeName(value))),
    0,
  );
  return clamp(total / values.length, 0, 1);
}

function scorePreference<T>(value: T, preferences: ReadonlyMap<T, FeaturePreference>): number {
  if (preferences.size === 0) return 0.5;
  return featurePreferenceScore(preferences.get(value));
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
    best = Math.max(best, proximity * featurePreferenceScore(preference));
  }
  return best;
}

function scoreQuality(score: number | null, model: RatingModel | null): number {
  if (score === null) return 0.5;
  return clamp(predictUserRating(model, score) / 10, 0, 1);
}

function scorePopularity(popularityRank: number | null, memberCount: number | null): number {
  if (memberCount !== null) return clamp(Math.log10(memberCount + 1) / 7, 0, 1);
  if (popularityRank !== null && popularityRank > 0) {
    return clamp(1 - Math.log10(popularityRank) / 4, 0, 1);
  }
  return 0.5;
}

/**
 * Returns 0..1 for one feature, where 0.5 means the evidence so far points neither way.
 *
 * An absent key is neutral rather than negative: once a profile has any entry on a dimension, scoring
 * everything it has never seen as 0 would rank a TV-only library above every film and quietly end
 * discovery. Only a key the user has actually pushed down scores below the midpoint.
 */
export function featurePreferenceScore(preference: FeaturePreference | undefined): number {
  if (preference === undefined) return NEUTRAL_FEATURE_SCORE;
  if (preference.count === 0) return 0;
  return clamp(NEUTRAL_FEATURE_SCORE + featurePreferenceStrength(preference) / 2, 0, 1);
}

/** Unbounded, because the score saturates at 1 for anything liked and ranking by it would only alphabetise a profile. */
export function featurePreferenceStrength(preference: FeaturePreference | undefined): number {
  if (preference === undefined || preference.count === 0) return 0;
  return (preference.positive - preference.negative) / Math.max(1, Math.sqrt(preference.count));
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
  attribution: RecommendationAttribution | null = null,
): RecommendationReason[] {
  const copy = getCopy(language);
  const reasons: RecommendationReason[] = [];
  const add = (reason: RecommendationReason) => {
    if (reasons.length < MAX_REASON_COUNT) reasons.push(reason);
  };

  if (attribution !== null) {
    add({
      kind: 'similarity',
      label: copy.reasonSimilarTo,
      detail: attribution.title,
      weight: clamp(attribution.strength, 0, 1),
    });
  }

  for (const genre of features.genres) {
    const score = featurePreferenceScore(profile.genres.get(normalizeName(genre)));
    if (score > 0.65) {
      add(reason('genre', copy.reasonGenre(genre), score));
      break;
    }
  }
  for (const theme of features.themes) {
    const score = featurePreferenceScore(profile.themes.get(normalizeName(theme)));
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
  // A community score and a mean user rating are different scales, so the model has to bridge them before comparing.
  if (
    profile.averageScore !== null &&
    anime.score !== null &&
    predictUserRating(profile.ratingModel, anime.score) >= profile.averageScore
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
  provenance: Provenance | null,
): RecommendationCategory {
  const compatibility = score.normalized;
  if (compatibility >= HIGHLY_COMPATIBLE_MIN_SCORE) return 'highly-compatible';
  if (
    compatibility >= BECAUSE_YOU_LIKED_MIN_SCORE &&
    compatibility < HIGHLY_COMPATIBLE_MIN_SCORE &&
    provenance !== null
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

interface LikedAffinity {
  readonly entry: AnimeListEntry;
  readonly features: FeatureVector;
  readonly weight: number;
}

interface Provenance {
  readonly entry: AnimeListEntry;
  readonly strength: number;
  readonly similarity: number;
}

interface StatedPreference {
  readonly genres: ReadonlySet<string>;
  readonly formats: readonly AnimeType[];
  readonly seasons: readonly AnimeSeason[];
  readonly shortSeries: boolean;
}

function buildLikedAffinity(watched: readonly AnimeListEntry[]): readonly LikedAffinity[] {
  const result: LikedAffinity[] = [];
  for (const entry of watched) {
    if (!isValidAnime(entry.anime)) continue;
    const rating = entry.userScore ?? entry.anime.userScore;
    if (rating === null || rating < BECAUSE_YOU_LIKED_MIN_RATING) continue;
    result.push({
      entry,
      features: extractFeatures(entry.anime),
      weight: 0.5 + 0.5 * clamp((rating - BECAUSE_YOU_LIKED_MIN_RATING) / 3, 0, 1),
    });
  }
  return result;
}

function attributeProvenance(
  anime: Anime,
  likedAffinity: readonly LikedAffinity[],
): Provenance | null {
  if (likedAffinity.length === 0) return null;
  const features = extractFeatures(anime);
  let best: Provenance | null = null;
  let strengthTotal = 0;
  for (const liked of likedAffinity) {
    const strength = featureSimilarity(features, liked.features) * liked.weight;
    strengthTotal += strength;
    if (best !== null && strength <= best.strength) continue;
    best = {
      entry: liked.entry,
      strength,
      similarity: featureSimilarity(features, liked.features),
    };
  }
  if (best === null || best.similarity < BECAUSE_YOU_LIKED_MIN_SIMILARITY) return null;
  if (likedAffinity.length < BECAUSE_YOU_LIKED_MIN_COHORT_FOR_LIFT) return best;
  const lift = best.strength - strengthTotal / likedAffinity.length;
  return lift >= BECAUSE_YOU_LIKED_MIN_LIFT ? best : null;
}

function featureSimilarity(left: FeatureVector, right: FeatureVector): number {
  return SIMILARITY_DIMENSIONS.reduce(
    (sum, dimension) =>
      sum + dimension.weight * overlapCoefficient(left[dimension.key], right[dimension.key]),
    0,
  );
}

function overlapCoefficient(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const rightNames = new Set(right.map(normalizeName));
  let shared = 0;
  for (const value of left) {
    if (rightNames.has(normalizeName(value))) shared += 1;
  }
  return shared === 0 ? 0 : shared / Math.sqrt(left.length * right.length);
}

function isObscure(anime: Anime): boolean {
  if (anime.memberCount !== null) return anime.memberCount < HIDDEN_GEM_MAX_MEMBERS;
  return anime.popularity !== null && anime.popularity > HIDDEN_GEM_MIN_POPULARITY_RANK;
}

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

function compareCandidates(left: SectionedCandidate, right: SectionedCandidate): number {
  return right.score.normalized - left.score.normalized || left.anime.id - right.anime.id;
}

function diversityUtility(
  candidate: SectionedCandidate,
  categoryCounts: ReadonlyMap<RecommendationCategory, number>,
  genreCounts: ReadonlyMap<string, number>,
  studioCounts: ReadonlyMap<string, number>,
  selectedCount: number,
): number {
  const denominator = Math.max(1, selectedCount);
  const categoryShare = (categoryCounts.get(candidate.category) ?? 0) / denominator;
  const genreShare = repeatedShare(candidate.anime.genres, genreCounts, denominator);
  const studioShare = repeatedShare(candidate.anime.studios, studioCounts, denominator);
  const coldStartBonus =
    selectedCount < COLD_START_EXPLORE_TITLES && candidate.category === 'explore'
      ? COLD_START_EXPLORE_BONUS
      : 0;
  return (
    candidate.score.normalized / MAX_SCORE -
    CATEGORY_DISPERSION_PENALTY * categoryShare -
    GENRE_DISPERSION_PENALTY * genreShare -
    STUDIO_DISPERSION_PENALTY * studioShare +
    coldStartBonus
  );
}

function repeatedShare(
  values: readonly { readonly name: string }[],
  counts: ReadonlyMap<string, number>,
  denominator: number,
): number {
  let share = 0;
  for (const value of values) {
    share = Math.max(share, (counts.get(normalizeName(value.name)) ?? 0) / denominator);
  }
  return share;
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
