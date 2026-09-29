import type { AnimeFormat, AnimeSeason } from '../domain/anime';
import type { AuthSnapshot, ProviderId } from '../auth/auth-types';
import type { RecommendationDiscoveryPreferences } from '../recommendations/recommendation-types';
import { normalizeLanguage, type Language } from '../locales';

export type RecommendationMode = 'personalized' | 'exploratory';

/** Sign-in/activation state of one provider, shown in the providers panel. */
export interface ProviderStatusView {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly signedIn: boolean;
  readonly active: boolean;
}

/** How the Top Rated entries are arranged on the card. */
export type TasteCardPicksLayout = 'list' | 'triangle' | 'grid';

/**
 * The subset that may be stored.
 *
 * A grid is nine entries the user assembles by hand for a single card, and it
 * is deliberately never persisted — so keeping the *mode* in storage would only
 * restore an empty collage on the next visit.
 */
export type PersistedTasteCardPicksLayout = 'list' | 'triangle';

/** Maps a live layout choice onto the value that is safe to store. */
export function persistableTasteCardPicksLayout(
  layout: TasteCardPicksLayout,
): PersistedTasteCardPicksLayout {
  return layout === 'triangle' ? 'triangle' : 'list';
}

/** Which blocks of the shareable taste card are rendered. */
export interface TasteCardPreferences {
  readonly showGenres: boolean;
  readonly showPicks: boolean;
  /**
   * Multiplier on the anime cover thumbnails. Bounded by
   * `TASTE_CARD_COVER_SCALE_RANGE`, whose maximum is proven by a layout test to
   * still fit every export format.
   */
  readonly coverScale: number;
  readonly picksLayout: PersistedTasteCardPicksLayout;
}

export interface UserPreferences {
  readonly theme: ThemePreference;
  readonly language: Language;
  readonly contentRating: ContentRatingPreference;
  readonly syncFrequency: SyncFrequency;
  readonly recommendationMode: RecommendationMode;
  readonly includeHiddenGems: boolean;
  readonly includeOlderAnime: boolean;
  readonly includeMovies: boolean;
  readonly includeShortSeries: boolean;
  readonly dailyRecommendationsEnabled: boolean;
  readonly preferredGenres: readonly string[];
  readonly excludedGenres: readonly string[];
  readonly excludedThemes: readonly string[];
  readonly preferredFormats: readonly AnimeFormat[];
  readonly preferredSeasons: readonly AnimeSeason[];
  readonly minimumCompatibilityScore: number;
  readonly showCompletedAnime: boolean;
  readonly tasteCard: TasteCardPreferences;
}

export type ThemePreference = 'dark' | 'light' | 'system';
export type ContentRatingPreference = 'safe' | 'questionable' | 'explicit';
export type SyncFrequency = 'manual' | 'daily' | 'weekly';

export interface SettingsSnapshot {
  readonly preferences: UserPreferences;
  /** Snapshot of the ACTIVE provider's auth state. */
  readonly auth: AuthSnapshot;
  readonly providers: readonly ProviderStatusView[];
  readonly malClientId: string;
  readonly anilistClientId: string;
  readonly malRedirectUri: string;
  readonly anilistRedirectUri: string;
}

export type SettingsMessageAction =
  | { readonly type: 'settings.get_snapshot' }
  | { readonly type: 'settings.update_preferences'; readonly preferences: UserPreferences }
  | { readonly type: 'settings.update_mal_client_id'; readonly clientId: string }
  | { readonly type: 'settings.update_anilist_client_id'; readonly clientId: string }
  | { readonly type: 'settings.clear_cache' }
  | { readonly type: 'settings.delete_local_data' }
  | { readonly type: 'settings.disconnect_mal' };

/** @deprecated Use `SettingsMessageAction` (kept for message naming symmetry). */
export type SettingsAction =
  | { readonly type: 'settings.get_snapshot' }
  | { readonly type: 'settings.update_preferences'; readonly preferences: UserPreferences }
  | { readonly type: 'settings.update_mal_client_id'; readonly clientId: string }
  | { readonly type: 'settings.clear_cache' }
  | { readonly type: 'settings.delete_local_data' }
  | { readonly type: 'settings.disconnect_mal' };

export type SettingsResponse =
  | { readonly ok: true; readonly snapshot: SettingsSnapshot }
  | { readonly ok: false; readonly message: string };

/**
 * Bounds for the cover-size preference.
 *
 * The minimum is the current design size, so the slider only ever grows the
 * artwork. The maximum is the absolute ceiling: how much of it is reachable
 * depends on what else the card is showing, so the effective limit is computed
 * per configuration by `maxFittingCoverScale` rather than assumed here. Three
 * 5x covers alone would be taller than the whole card.
 */
export const TASTE_CARD_COVER_SCALE_RANGE: { readonly min: number; readonly max: number } = {
  min: 1,
  max: 5,
};
export const DEFAULT_TASTE_CARD_COVER_SCALE = 1;

export const DEFAULT_TASTE_CARD_PREFERENCES: TasteCardPreferences = {
  showGenres: true,
  showPicks: true,
  coverScale: DEFAULT_TASTE_CARD_COVER_SCALE,
  picksLayout: 'list',
};

export function clampTasteCardCoverScale(value: unknown): number {
  const { min, max } = TASTE_CARD_COVER_SCALE_RANGE;
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TASTE_CARD_COVER_SCALE;
  // Rounded to 2dp so dragging the slider cannot accumulate float noise in
  // storage, and so equal-looking positions compare equal.
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

export function normalizeTasteCardPreferences(value: unknown): TasteCardPreferences {
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
  };
}

function isPersistedTasteCardPicksLayout(value: unknown): value is PersistedTasteCardPicksLayout {
  return value === 'list' || value === 'triangle';
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'dark',
  language: 'en',
  contentRating: 'safe',
  syncFrequency: 'manual',
  recommendationMode: 'personalized',
  includeHiddenGems: true,
  includeOlderAnime: true,
  includeMovies: true,
  includeShortSeries: true,
  dailyRecommendationsEnabled: false,
  preferredGenres: [],
  excludedGenres: [],
  excludedThemes: [],
  preferredFormats: [],
  preferredSeasons: [],
  minimumCompatibilityScore: 0,
  showCompletedAnime: true,
  tasteCard: DEFAULT_TASTE_CARD_PREFERENCES,
};

export function toRecommendationDiscoveryPreferences(
  preferences: UserPreferences,
): RecommendationDiscoveryPreferences {
  return {
    recommendationMode: preferences.recommendationMode,
    includeHiddenGems: preferences.includeHiddenGems,
    includeOlderAnime: preferences.includeOlderAnime,
    includeMovies: preferences.includeMovies,
    includeShortSeries: preferences.includeShortSeries,
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
  return {
    ...DEFAULT_USER_PREFERENCES,
    theme: isTheme(value.theme) ? value.theme : DEFAULT_USER_PREFERENCES.theme,
    language: normalizeLanguage(value.language),
    contentRating: isContentRating(value.contentRating)
      ? value.contentRating
      : DEFAULT_USER_PREFERENCES.contentRating,
    syncFrequency: isSyncFrequency(value.syncFrequency)
      ? value.syncFrequency
      : DEFAULT_USER_PREFERENCES.syncFrequency,
    recommendationMode: isRecommendationMode(value.recommendationMode)
      ? value.recommendationMode
      : DEFAULT_USER_PREFERENCES.recommendationMode,
    includeHiddenGems:
      typeof value.includeHiddenGems === 'boolean'
        ? value.includeHiddenGems
        : DEFAULT_USER_PREFERENCES.includeHiddenGems,
    includeOlderAnime:
      typeof value.includeOlderAnime === 'boolean'
        ? value.includeOlderAnime
        : DEFAULT_USER_PREFERENCES.includeOlderAnime,
    includeMovies:
      typeof value.includeMovies === 'boolean'
        ? value.includeMovies
        : DEFAULT_USER_PREFERENCES.includeMovies,
    includeShortSeries:
      typeof value.includeShortSeries === 'boolean'
        ? value.includeShortSeries
        : DEFAULT_USER_PREFERENCES.includeShortSeries,
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
function isContentRating(value: unknown): value is ContentRatingPreference {
  return value === 'safe' || value === 'questionable' || value === 'explicit';
}
function isSyncFrequency(value: unknown): value is SyncFrequency {
  return value === 'manual' || value === 'daily' || value === 'weekly';
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
