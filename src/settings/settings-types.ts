import type { AnimeFormat, AnimeSeason } from '../domain/anime';
import type { AuthSnapshot, ProviderId } from '../auth/auth-types';
import type { RecommendationDiscoveryPreferences } from '../recommendations/recommendation-types';
import {
  DEFAULT_COSMETICS,
  normalizeCosmetics,
  type TasteCardCosmetics,
} from '../profile/cosmetics';
import {
  EMPTY_USAGE_STREAK,
  normalizeUsageStreak,
  type UsageStreak,
} from '../profile/usage-streak';
import { normalizeLanguage, type Language } from '../locales';
import {
  currentCalendarYear,
  normalizeRecommendationPeriod,
  RECOMMENDATION_YEAR_DEFAULT_START,
} from '../domain/recommendation-period';

export type RecommendationMode = 'personalized' | 'exploratory';

export interface ProviderStatusView {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly signedIn: boolean;
  readonly active: boolean;
}

export type TasteCardPicksLayout = 'list' | 'triangle' | 'grid';

// A grid is assembled by hand and never persisted, so storing the *mode* would only restore an empty collage next visit.
export type PersistedTasteCardPicksLayout = 'list' | 'triangle';

export function persistableTasteCardPicksLayout(
  layout: TasteCardPicksLayout,
): PersistedTasteCardPicksLayout {
  return layout === 'triangle' ? 'triangle' : 'list';
}

export interface TasteCardPreferences {
  readonly showGenres: boolean;
  readonly showPicks: boolean;
  /** Bounded by TASTE_CARD_COVER_SCALE_RANGE, whose max a layout test proves still fits every format. */
  readonly coverScale: number;
  readonly picksLayout: PersistedTasteCardPicksLayout;
  /** Stored as chosen; an item the user no longer qualifies for is dropped when the card is rendered. */
  readonly cosmetics: TasteCardCosmetics;
  readonly exportFormat: TasteCardExportFormat;
}

export interface UserPreferences {
  readonly theme: ThemePreference;
  readonly accentTheme: AccentTheme;
  readonly language: Language;
  readonly contentRating: ContentRatingPreference;
  readonly recommendationMode: RecommendationMode;
  readonly includeHiddenGems: boolean;
  readonly includeMovies: boolean;
  readonly includeShortSeries: boolean;
  readonly recommendationStartYear: number;
  readonly recommendationEndYear: number;
  readonly dailyRecommendationsEnabled: boolean;
  readonly preferredGenres: readonly string[];
  readonly excludedGenres: readonly string[];
  readonly excludedThemes: readonly string[];
  readonly preferredFormats: readonly AnimeFormat[];
  readonly preferredSeasons: readonly AnimeSeason[];
  readonly minimumCompatibilityScore: number;
  readonly showCompletedAnime: boolean;
  readonly tasteCard: TasteCardPreferences;
  /** Accumulated, never derived: the taste level is recomputed on every read. */
  readonly usageStreak: UsageStreak;
}

export type ThemePreference = 'dark' | 'light' | 'system';
export type AccentTheme = 'purple' | 'red' | 'blue' | 'green';
export type ContentRatingPreference = 'safe' | 'questionable' | 'explicit';

export interface SettingsSnapshot {
  readonly preferences: UserPreferences;
  readonly auth: AuthSnapshot;
  readonly providers: readonly ProviderStatusView[];
  readonly malClientId: string;
  readonly anilistClientId: string;
  readonly malRedirectUri: string;
  readonly anilistRedirectUri: string;
}

// The max is an absolute ceiling (three 5x covers alone are taller than the card); how much of it is reachable depends on what else is shown, so the effective limit comes from `maxFittingCoverScale`.
export const TASTE_CARD_COVER_SCALE_RANGE: { readonly min: number; readonly max: number } = {
  min: 1,
  max: 5,
};
export type TasteCardExportFormat = 'png' | 'gif';

export const DEFAULT_TASTE_CARD_COVER_SCALE = 1;

const DEFAULT_TASTE_CARD_PREFERENCES: TasteCardPreferences = {
  showGenres: true,
  showPicks: true,
  coverScale: DEFAULT_TASTE_CARD_COVER_SCALE,
  picksLayout: 'list',
  cosmetics: DEFAULT_COSMETICS,
  exportFormat: 'png',
};

export function clampTasteCardCoverScale(value: unknown): number {
  const { min, max } = TASTE_CARD_COVER_SCALE_RANGE;
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TASTE_CARD_COVER_SCALE;
  // Rounded so dragging the slider can't accumulate float noise in storage.
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

function normalizeTasteCardPreferences(value: unknown): TasteCardPreferences {
  if (!isRecord(value)) return DEFAULT_TASTE_CARD_PREFERENCES;
  return {
    showGenres:
      typeof value.showGenres === 'boolean'
        ? value.showGenres
        : DEFAULT_TASTE_CARD_PREFERENCES.showGenres,
    showPicks:
      typeof value.showPicks === 'boolean'
        ? value.showPicks
        : DEFAULT_TASTE_CARD_PREFERENCES.showPicks,
    coverScale: clampTasteCardCoverScale(value.coverScale),
    picksLayout: isPersistedTasteCardPicksLayout(value.picksLayout)
      ? value.picksLayout
      : DEFAULT_TASTE_CARD_PREFERENCES.picksLayout,
    cosmetics: normalizeCosmetics(value.cosmetics),
    exportFormat: value.exportFormat === 'gif' ? 'gif' : 'png',
  };
}

function isPersistedTasteCardPicksLayout(value: unknown): value is PersistedTasteCardPicksLayout {
  return value === 'list' || value === 'triangle';
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'dark',
  accentTheme: 'purple',
  language: 'en',
  contentRating: 'safe',
  recommendationMode: 'personalized',
  includeHiddenGems: true,
  includeMovies: true,
  includeShortSeries: true,
  recommendationStartYear: RECOMMENDATION_YEAR_DEFAULT_START,
  recommendationEndYear: currentCalendarYear(),
  dailyRecommendationsEnabled: false,
  preferredGenres: [],
  excludedGenres: [],
  excludedThemes: [],
  preferredFormats: [],
  preferredSeasons: [],
  minimumCompatibilityScore: 0,
  showCompletedAnime: true,
  tasteCard: DEFAULT_TASTE_CARD_PREFERENCES,
  usageStreak: EMPTY_USAGE_STREAK,
};

export function toRecommendationDiscoveryPreferences(
  preferences: UserPreferences,
): RecommendationDiscoveryPreferences {
  return {
    recommendationMode: preferences.recommendationMode,
    includeHiddenGems: preferences.includeHiddenGems,
    includeMovies: preferences.includeMovies,
    includeShortSeries: preferences.includeShortSeries,
    startYear: preferences.recommendationStartYear,
    endYear: preferences.recommendationEndYear,
    preferredGenres: preferences.preferredGenres,
    excludedGenres: preferences.excludedGenres,
    excludedThemes: preferences.excludedThemes,
    preferredFormats: preferences.preferredFormats,
    preferredSeasons: preferences.preferredSeasons,
    contentRating: preferences.contentRating,
    showCompletedAnime: preferences.showCompletedAnime,
    minimumCompatibilityScore: preferences.minimumCompatibilityScore,
  };
}

export function normalizeSettingsText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeUserPreferences(value: unknown): UserPreferences {
  if (!isRecord(value)) return DEFAULT_USER_PREFERENCES;
  const period = normalizeRecommendationPeriod(
    value.recommendationStartYear,
    value.recommendationEndYear,
    currentCalendarYear(),
  );
  return {
    ...DEFAULT_USER_PREFERENCES,
    theme: isTheme(value.theme) ? value.theme : DEFAULT_USER_PREFERENCES.theme,
    accentTheme: isAccentTheme(value.accentTheme)
      ? value.accentTheme
      : DEFAULT_USER_PREFERENCES.accentTheme,
    language: normalizeLanguage(value.language),
    contentRating: isContentRating(value.contentRating)
      ? value.contentRating
      : DEFAULT_USER_PREFERENCES.contentRating,
    recommendationMode: isRecommendationMode(value.recommendationMode)
      ? value.recommendationMode
      : DEFAULT_USER_PREFERENCES.recommendationMode,
    includeHiddenGems:
      typeof value.includeHiddenGems === 'boolean'
        ? value.includeHiddenGems
        : DEFAULT_USER_PREFERENCES.includeHiddenGems,
    includeMovies:
      typeof value.includeMovies === 'boolean'
        ? value.includeMovies
        : DEFAULT_USER_PREFERENCES.includeMovies,
    includeShortSeries:
      typeof value.includeShortSeries === 'boolean'
        ? value.includeShortSeries
        : DEFAULT_USER_PREFERENCES.includeShortSeries,
    recommendationStartYear: period.startYear,
    recommendationEndYear: period.endYear,
    dailyRecommendationsEnabled:
      typeof value.dailyRecommendationsEnabled === 'boolean'
        ? value.dailyRecommendationsEnabled
        : DEFAULT_USER_PREFERENCES.dailyRecommendationsEnabled,
    preferredGenres: stringArray(value.preferredGenres),
    excludedGenres: stringArray(value.excludedGenres),
    excludedThemes: stringArray(value.excludedThemes),
    preferredFormats: animeFormatArray(value.preferredFormats),
    preferredSeasons: animeSeasonArray(value.preferredSeasons),
    minimumCompatibilityScore:
      typeof value.minimumCompatibilityScore === 'number' &&
      Number.isFinite(value.minimumCompatibilityScore)
        ? Math.min(100, Math.max(0, value.minimumCompatibilityScore))
        : 0,
    showCompletedAnime:
      typeof value.showCompletedAnime === 'boolean'
        ? value.showCompletedAnime
        : DEFAULT_USER_PREFERENCES.showCompletedAnime,
    tasteCard: normalizeTasteCardPreferences(value.tasteCard),
    usageStreak: normalizeUsageStreak(value.usageStreak),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
function isTheme(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}
function isAccentTheme(value: unknown): value is AccentTheme {
  return value === 'purple' || value === 'red' || value === 'blue' || value === 'green';
}
function isContentRating(value: unknown): value is ContentRatingPreference {
  return value === 'safe' || value === 'questionable' || value === 'explicit';
}
function animeFormatArray(value: unknown): readonly AnimeFormat[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is AnimeFormat =>
          item === 'tv' ||
          item === 'movie' ||
          item === 'ova' ||
          item === 'ona' ||
          item === 'special' ||
          item === 'music' ||
          item === 'unknown',
      )
    : [];
}

function animeSeasonArray(value: unknown): readonly AnimeSeason[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is AnimeSeason =>
          item === 'winter' || item === 'spring' || item === 'summer' || item === 'fall',
      )
    : [];
}

function isRecommendationMode(value: unknown): value is RecommendationMode {
  return value === 'personalized' || value === 'exploratory';
}
