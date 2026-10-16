import { getCopy, type AppCopy, type Language } from '../locales';
import type { UserProfileSummary } from './profile-types';

export const MAX_TASTE_LEVEL = 20;

const FIRST_LEVEL_XP = 180;
const LEVEL_XP_GROWTH = 1.32;

// Fifteen dimensions is the ceiling (five per axis), so a single source can never out-earn a level on its own.
const XP_PER_ANALYZED = 2;
const XP_PER_RATED = 3;
const XP_PER_FEEDBACK = 6;
const XP_PER_DETECTED_PREFERENCE = 30;
const XP_PER_FAVORITE_DIMENSION = 6;

type TasteTitleKey = {
  [K in keyof AppCopy]: AppCopy[K] extends string ? K : never;
}[keyof AppCopy];

interface TasteTitleTier {
  readonly level: number;
  readonly key: TasteTitleKey;
}

const TITLE_TIERS: readonly TasteTitleTier[] = [
  { level: 1, key: 'tasteLevelTitleCuriousNewcomer' },
  { level: 2, key: 'tasteLevelTitleGenreScout' },
  { level: 3, key: 'tasteLevelTitleListKeeper' },
  { level: 5, key: 'tasteLevelTitleTasteAnalyst' },
  { level: 7, key: 'tasteLevelTitleDeepDiver' },
  { level: 9, key: 'tasteLevelTitleMarathonWatcher' },
  { level: 11, key: 'tasteLevelTitleSeasonedFan' },
  { level: 13, key: 'tasteLevelTitleConnoisseur' },
  { level: 15, key: 'tasteLevelTitleCurator' },
  { level: 17, key: 'tasteLevelTitleAesthete' },
  { level: 19, key: 'tasteLevelTitleTasteAuthority' },
  { level: MAX_TASTE_LEVEL, key: 'tasteLevelTitleLegend' },
];

export type TasteSourceKey = 'analyzed' | 'rated' | 'feedback' | 'preferences' | 'dimensions';

export interface TasteSource {
  readonly key: TasteSourceKey;
  readonly label: string;
  readonly xp: number;
}

export interface TasteLevel {
  readonly level: number;
  readonly maxLevel: number;
  readonly xp: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly progress: number;
  readonly title: string;
  readonly nextTitle: string | null;
  readonly nextTitleLevel: number | null;
  readonly isMaxLevel: boolean;
  readonly sources: readonly TasteSource[];
}

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(FIRST_LEVEL_XP * Math.pow(level - 1, LEVEL_XP_GROWTH));
}

export function tasteLevelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_TASTE_LEVEL && xp >= xpRequiredForLevel(level + 1)) level += 1;
  return level;
}

export function computeTasteLevel(
  summary: UserProfileSummary,
  language: Language = 'en',
): TasteLevel {
  const copy = getCopy(language);
  const dimensions =
    summary.favoriteGenres.length + summary.favoriteThemes.length + summary.favoriteStudios.length;

  const sources: readonly TasteSource[] = [
    {
      key: 'analyzed',
      label: copy.tasteLevelSourceAnalyzed,
      xp: summary.analyzedAnimeCount * XP_PER_ANALYZED,
    },
    { key: 'rated', label: copy.tasteLevelSourceRated, xp: summary.ratedAnimeCount * XP_PER_RATED },
    {
      key: 'feedback',
      label: copy.tasteLevelSourceFeedback,
      xp: summary.feedbackCount * XP_PER_FEEDBACK,
    },
    {
      key: 'preferences',
      label: copy.tasteLevelSourcePreferences,
      xp: summary.detectedPreferences.length * XP_PER_DETECTED_PREFERENCE,
    },
    {
      key: 'dimensions',
      label: copy.tasteLevelSourceDimensions,
      xp: dimensions * XP_PER_FAVORITE_DIMENSION,
    },
  ];

  const xp = sources.reduce((total, source) => total + source.xp, 0);
  const earnedSources = sources.filter((source) => source.xp > 0);
  const level = tasteLevelFromXp(xp);
  const isMaxLevel = level >= MAX_TASTE_LEVEL;
  const floor = xpRequiredForLevel(level);
  const currentTier = titleTierFor(level);
  const nextTier = isMaxLevel ? null : nextTitleTier(currentTier);
  const xpForNextLevel = isMaxLevel ? 0 : xpRequiredForLevel(level + 1) - floor;
  const xpIntoLevel = isMaxLevel ? 0 : xp - floor;

  return {
    level,
    maxLevel: MAX_TASTE_LEVEL,
    xp,
    xpIntoLevel,
    xpForNextLevel,
    progress: isMaxLevel ? 100 : clampPercent((xpIntoLevel / Math.max(1, xpForNextLevel)) * 100),
    title: copy[currentTier.key],
    nextTitle: nextTier === null ? null : copy[nextTier.key],
    nextTitleLevel: nextTier?.level ?? null,
    isMaxLevel,
    sources: earnedSources,
  };
}

function titleTierFor(level: number): TasteTitleTier {
  let tier: TasteTitleTier = TITLE_TIERS[0];
  for (const candidate of TITLE_TIERS) {
    if (candidate.level > level) break;
    tier = candidate;
  }
  return tier;
}

function nextTitleTier(current: TasteTitleTier): TasteTitleTier | null {
  const index = TITLE_TIERS.findIndex((tier) => tier.level === current.level);
  return index < 0 ? null : (TITLE_TIERS[index + 1] ?? null);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
