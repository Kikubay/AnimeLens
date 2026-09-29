import type { UserProfile } from '../domain/user-profile';
import {
  clampTasteCardCoverScale,
  type TasteCardPicksLayout,
  type TasteCardPreferences,
} from '../settings/settings-types';

export type { TasteCardPicksLayout };
import type { UserProfileSummary } from './profile-types';
import type { TopPickCandidate } from './top-picks';

/** Output formats offered by the shareable taste card. */
export type TasteCardFormat = 'tall' | 'portrait' | 'square';

export interface TasteCardFormatSpec {
  readonly width: number;
  readonly height: number;
}

export const TASTE_CARD_FORMATS: Readonly<Record<TasteCardFormat, TasteCardFormatSpec>> = {
  tall: { width: 1080, height: 1440 },
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
};

export const TASTE_CARD_FORMAT_ORDER: readonly TasteCardFormat[] = ['tall', 'portrait', 'square'];

/** Number of genre bars shown on the card. */
export const TASTE_CARD_GENRE_LIMIT = 3;

/** Number of highest-rated entries shown on the card. */
export const TASTE_CARD_PICK_LIMIT = 3;

export interface TasteCardGenre {
  readonly name: string;
  readonly score: number;
}

/** A highlighted list entry: title, score, and cover art only. */
export interface TasteCardPick {
  readonly title: string;
  readonly score: number;
  /** Remote cover URL, inlined to a data URL before painting. */
  readonly imageUrl: string | null;
  /** Full-size cover, used when the user enlarges the thumbnails. */
  readonly largeImageUrl: string | null;
}

export interface TasteCardStats {
  readonly analyzedCount: number;
  readonly ratedCount: number;
  readonly averageScore: number | null;
}

/**
 * Everything the card is allowed to render. Deliberately aggregate-only: no
 * watch dates, no private notes, no list entries — just signals the user
 * already sees in the profile view, plus their public display name and avatar.
 */
export interface TasteCardModel {
  readonly displayName: string;
  /** Single fallback glyph used while the avatar is loading or unavailable. */
  readonly monogram: string;
  /** Display name of the provider the stats came from, e.g. "MyAnimeList". */
  readonly providerName: string | null;
  readonly stats: TasteCardStats;
  readonly topGenres: readonly TasteCardGenre[];
  /** The user's highest-rated entries, most liked first. */
  readonly topPicks: readonly TasteCardPick[];
  /** Short label describing the strongest detected preference, if any. */
  readonly headline: string | null;
  readonly hasData: boolean;
}

const FALLBACK_DISPLAY_NAME = 'Anime fan';

/** User-controlled rendering options for the card. */
export interface TasteCardRenderOptions {
  readonly showGenres: boolean;
  readonly showPicks: boolean;
  /** Multiplier on the anime cover thumbnails. */
  readonly coverScale: number;
  readonly picksLayout: TasteCardPicksLayout;
}

export const DEFAULT_TASTE_CARD_RENDER_OPTIONS: TasteCardRenderOptions = {
  showGenres: true,
  showPicks: true,
  coverScale: 1,
  picksLayout: 'list',
};

/** Derives the card's options from the stored preferences. */
export function tasteCardRenderOptions(preferences: TasteCardPreferences): TasteCardRenderOptions {
  return {
    showGenres: preferences.showGenres,
    showPicks: preferences.showPicks,
    coverScale: clampTasteCardCoverScale(preferences.coverScale),
    picksLayout: preferences.picksLayout,
  };
}

/**
 * Whether the card draws the Top Rated block at all. The tie-breaker prompt is
 * driven off this too: asking someone to rank anime that will not be drawn is
 * pointless friction.
 */
export function shouldRenderTopPicks(
  model: TasteCardModel,
  options: TasteCardRenderOptions,
): boolean {
  return options.showPicks && model.topPicks.length > 0;
}

/**
 * The layout to persist once the card modal is dismissed.
 *
 * A grid is assembled by hand and never stored, so leaving the mode active
 * would drop the user back onto an empty collage the next time they open the
 * card. Closing the modal therefore falls back to the list, while the other
 * arrangements are left exactly as the user set them.
 */
export function layoutAfterCardClose(options: TasteCardRenderOptions): TasteCardPicksLayout {
  return options.picksLayout === 'grid' ? 'list' : options.picksLayout;
}

export function buildTasteCardModel(
  summary: UserProfileSummary,
  profile: UserProfile | null,
  providerName: string | null = null,
  /**
   * Top 3 after the user's tie-break choice. Defaults to the plan's own
   * resolution (locked entries plus the most-recently-updated fill).
   */
  picks: readonly TopPickCandidate[] = summary.topPicks.picks,
): TasteCardModel {
  const displayName = normalizeDisplayName(profile?.username ?? null);
  return {
    displayName,
    monogram: monogramFor(displayName),
    providerName: normalizeProviderName(providerName),
    stats: {
      analyzedCount: summary.analyzedAnimeCount,
      ratedCount: summary.ratedAnimeCount,
      averageScore: summary.averageScore,
    },
    topGenres: summary.favoriteGenres
      .slice(0, TASTE_CARD_GENRE_LIMIT)
      .map((genre) => ({ name: genre.name, score: clampPercent(genre.score) })),
    // All resolved picks are carried; each layout takes what it needs (three for
    // the list and podium, nine for the grid).
    topPicks: picks.map((pick) => ({
      title: pick.title,
      score: pick.score,
      imageUrl: pick.imageUrl,
      largeImageUrl: pick.largeImageUrl,
    })),
    headline: summary.detectedPreferences[0]?.label ?? null,
    hasData: summary.hasData,
  };
}

/** First grapheme of the display name, uppercased; 'A' when nothing is usable. */
export function monogramFor(displayName: string): string {
  const first = displayName.trim().charAt(0);
  return first === '' ? 'A' : first.toLocaleUpperCase();
}

function normalizeDisplayName(username: string | null): string {
  const trimmed = username?.trim() ?? '';
  if (trimmed.length === 0) return FALLBACK_DISPLAY_NAME;
  // Keep the name on a single line and well inside the card's header.
  return trimmed.length > 24 ? `${trimmed.slice(0, 23)}…` : trimmed;
}

/** Provider chip label; blank and overlong values are dropped by the painter. */
function normalizeProviderName(providerName: string | null): string | null {
  const trimmed = providerName?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
