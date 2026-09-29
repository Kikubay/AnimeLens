import type { AnimeListEntry } from '../domain/anime';
import type { RecommendationProfile } from '../recommendations/recommendation-types';
import { getCopy, type Language } from '../locales';
import { emptyTopPickPlan, planTopPicks, type TopPickPlan } from './top-picks';

export interface ProfilePreferenceItem {
  readonly name: string;
  readonly score: number;
  readonly positive: number;
  readonly negative: number;
  readonly count: number;
}

export interface DetectedPreference {
  readonly label: string;
  readonly detail: string;
  readonly score: number;
}

export interface UserProfileSummary {
  readonly analyzedAnimeCount: number;
  readonly ratedAnimeCount: number;
  readonly averageScore: number | null;
  readonly favoriteGenres: readonly ProfilePreferenceItem[];
  readonly favoriteThemes: readonly ProfilePreferenceItem[];
  readonly favoriteStudios: readonly ProfilePreferenceItem[];
  readonly lessLikedGenres: readonly ProfilePreferenceItem[];
  readonly detectedPreferences: readonly DetectedPreference[];
  /**
   * Top 3 for the taste card, with the tie already resolved by default and the
   * tied pool exposed so the UI can ask the user to choose.
   */
  readonly topPicks: TopPickPlan;
  readonly hasData: boolean;
}

export interface ProfileSnapshot {
  readonly status: 'loading' | 'ready' | 'empty' | 'error';
  readonly summary: UserProfileSummary | null;
  readonly errorMessage: string | null;
}

export function emptyProfileSummary(
  topPicks: TopPickPlan = emptyTopPickPlan(),
): UserProfileSummary {
  return {
    analyzedAnimeCount: 0,
    ratedAnimeCount: 0,
    averageScore: null,
    favoriteGenres: [],
    favoriteThemes: [],
    favoriteStudios: [],
    lessLikedGenres: [],
    detectedPreferences: [],
    topPicks,
    hasData: false,
  };
}

export function profileSummaryFromModel(
  profile: RecommendationProfile,
  language: Language = 'en',
  entries: readonly AnimeListEntry[] = [],
  providerId: string | null = null,
): UserProfileSummary {
  const favoriteGenres = toPreferenceItems(profile.genres, 'positive');
  const favoriteThemes = toPreferenceItems(profile.themes, 'positive');
  const favoriteStudios = toPreferenceItems(profile.studios, 'positive');
  const lessLikedGenres = toLessLikedItems(profile.genres);
  const detectedPreferences = detectPreferences(profile, favoriteGenres, favoriteThemes, language);

  return {
    analyzedAnimeCount: profile.sourceAnimeCount,
    ratedAnimeCount: profile.ratedAnimeCount,
    averageScore: profile.averageScore,
    favoriteGenres,
    favoriteThemes,
    favoriteStudios,
    lessLikedGenres,
    detectedPreferences,
    topPicks: planTopPicks(entries, { providerId }),
    hasData: profile.sourceAnimeCount > 0 || profile.feedbackCount > 0,
  };
}
function toPreferenceItems(
  values: ReadonlyMap<
    string,
    { readonly positive: number; readonly negative: number; readonly count: number }
  >,
  direction: 'positive' | 'negative',
): ProfilePreferenceItem[] {
  return [...values.entries()]
    .map(([name, value]) => {
      const signed = value.positive - value.negative;
      const strength = direction === 'positive' ? value.positive : value.negative;
      return {
        name: titleCase(name),
        score: clamp(Math.round((strength / Math.max(1, value.count)) * 100), 0, 100),
        positive: value.positive,
        negative: value.negative,
        count: value.count,
        signed,
      };
    })
    .filter((item) =>
      direction === 'positive' ? item.positive > item.negative : item.negative > item.positive,
    )
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, 5)
    .map(({ signed: _signed, ...item }) => item);
}

interface LessLikedCandidate {
  readonly name: string;
  readonly net: number;
  readonly negativeShare: number;
  readonly positive: number;
  readonly negative: number;
  readonly count: number;
}

/**
 * "Less liked" is relative, not absolute: most genres accumulate positive
 * signals from completed entries, so requiring `negative > positive` would
 * freeze the section to genres with exclusively negative signals. Instead,
 * genres are ranked by net sentiment per signal and compared against the
 * user's own cross-genre average, so any dislike, drop, or low rating moves
 * the section immediately.
 */
function toLessLikedItems(
  values: ReadonlyMap<
    string,
    { readonly positive: number; readonly negative: number; readonly count: number }
  >,
): ProfilePreferenceItem[] {
  const candidates = [...values.entries()].map(([name, value]): LessLikedCandidate => {
    const net = (value.positive - value.negative) / Math.max(1, value.count);
    const signalWeight = value.positive + value.negative;
    return {
      name: titleCase(name),
      net,
      negativeShare: signalWeight === 0 ? 0 : value.negative / signalWeight,
      positive: value.positive,
      negative: value.negative,
      count: value.count,
    };
  });
  if (candidates.length === 0) return [];
  const averageNet =
    candidates.reduce((sum, item) => sum + item.net, 0) / Math.max(1, candidates.length);
  return candidates
    .filter((item) => item.negative > 0 && item.net <= averageNet)
    .sort((left, right) => left.net - right.net || right.negativeShare - left.negativeShare)
    .slice(0, 5)
    .map((item) => ({
      name: item.name,
      score: clamp(Math.round(item.negativeShare * 100), 0, 100),
      positive: item.positive,
      negative: item.negative,
      count: item.count,
    }));
}

function detectPreferences(
  profile: RecommendationProfile,
  genres: readonly ProfilePreferenceItem[],
  themes: readonly ProfilePreferenceItem[],
  language: Language,
): DetectedPreference[] {
  const copy = getCopy(language);
  const detected: DetectedPreference[] = [];
  if (genres.length >= 2) {
    detected.push({
      label: copy.detectedRichWorlds,
      detail: copy.detectedRichWorldsDetail(genres[0]?.name ?? null),
      score: genres[0]?.score ?? 0,
    });
  }
  if (themes.some((item) => /psych|myst|emotion|drama|character|story/i.test(item.name))) {
    detected.push({
      label: copy.detectedComplexCharacters,
      detail: copy.detectedComplexCharactersDetail,
      score: 78,
    });
  }
  if (profile.ratedAnimeCount > 0 && profile.averageScore !== null && profile.averageScore >= 8) {
    detected.push({
      label: copy.detectedDiscerningTaste,
      detail: copy.detectedDiscerningTasteDetail(profile.averageScore.toFixed(1)),
      score: Math.round(profile.averageScore * 10),
    });
  }
  if (profile.feedbackCount >= 2) {
    detected.push({
      label: copy.detectedRefinedProfile,
      detail: copy.detectedRefinedProfileDetail(profile.feedbackCount),
      score: Math.min(100, 50 + profile.feedbackCount * 10),
    });
  }
  return detected.slice(0, 4);
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
