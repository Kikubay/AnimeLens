import type { UserProfile } from '../domain/user-profile';
import {
  clampTasteCardCoverScale,
  type TasteCardPicksLayout,
  type TasteCardPreferences,
} from '../settings/settings-types';

export type { TasteCardPicksLayout };
import type { UserProfileSummary } from './profile-types';
import type { TopPickCandidate } from './top-picks';

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

export const TASTE_CARD_GENRE_LIMIT = 3;

export const TASTE_CARD_PICK_LIMIT = 3;

export interface TasteCardGenre {
  readonly name: string;
  readonly score: number;
}

export interface TasteCardPick {
  readonly title: string;
  readonly score: number;
  /** Remote URL, inlined to a data URL before painting. */
  readonly imageUrl: string | null;
  readonly largeImageUrl: string | null;
}

export interface TasteCardStats {
  readonly analyzedCount: number;
  readonly ratedCount: number;
  readonly averageScore: number | null;
}

// Deliberately aggregate-only: no watch dates, no notes, no list entries — just signals already visible in the profile view, plus the public display name and avatar.
export interface TasteCardModel {
  /** `''` when the profile has no username. */
  readonly displayName: string;
  /** Fallback glyph while the avatar loads or is unavailable. */
  readonly monogram: string;
  readonly providerName: string | null;
  readonly stats: TasteCardStats;
  readonly topGenres: readonly TasteCardGenre[];
  readonly topPicks: readonly TasteCardPick[];
  readonly headline: string | null;
  readonly hasData: boolean;
}

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

// Also gates the tie-breaker prompt, since asking someone to rank anime that won't be drawn is pointless friction.
export function shouldRenderTopPicks(
  model: TasteCardModel,
  options: TasteCardRenderOptions,
): boolean {
  return options.showPicks && model.topPicks.length > 0;
}

// A grid is assembled by hand and never stored, so keeping the mode active would reopen onto an empty collage.
export function layoutAfterCardClose(options: TasteCardRenderOptions): TasteCardPicksLayout {
  return options.picksLayout === 'grid' ? 'list' : options.picksLayout;
}

export function buildTasteCardModel(
  summary: UserProfileSummary,
  profile: UserProfile | null,
  providerName: string | null = null,
  /** Defaults to the plan's own resolution (locked entries plus the most-recently-updated fill). */
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
    // All resolved picks ride along; each layout takes what it needs.
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

export function monogramFor(displayName: string): string {
  const first = displayName.trim().charAt(0);
  return first === '' ? 'A' : first.toLocaleUpperCase();
}

function normalizeDisplayName(username: string | null): string {
  const trimmed = username?.trim() ?? '';
  // Left empty so the painter can substitute a localized name; the monogram is a glyph and must not follow that substitution.
  if (trimmed.length === 0) return '';
  // Keeps the name on one line and inside the card's header.
  return trimmed.length > 24 ? `${trimmed.slice(0, 23)}…` : trimmed;
}

function normalizeProviderName(providerName: string | null): string | null {
  const trimmed = providerName?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
