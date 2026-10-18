import type { Recommendation } from '../domain/recommendation';
import type { RecommendationProfile } from './recommendation-types';
import type { RecommendationSection } from './recommendation-messages';
import { localDayKey } from '../profile/usage-streak';
import type { StoredDailyDrop } from '../storage/storage-types';

export const DAILY_DROP_SIZE = 6;
export const DAILY_DROP_GRACE_DAYS = 3;
export const DAILY_DROP_HISTORY = 10;
export const DAILY_DROP_VERSION = 1;
export const DAILY_DROP_MIN_COMPATIBILITY = 75;
export const DAILY_DROP_TASTE_GENRE_LIMIT = 6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DailyDropTaste {
  /** Lower-cased genre names, strongest net sentiment first. Empty means "no genre signal yet". */
  readonly genres: readonly string[];
}

export type DailyDropItemState = 'unclaimed' | 'claimed';

export interface DailyDropItem {
  readonly recommendation: Recommendation;
  readonly state: DailyDropItemState;
}

export interface DailyDropView {
  readonly day: string;
  readonly items: readonly DailyDropItem[];
  readonly missed: readonly DailyDropItem[];
  readonly unclaimedCount: number;
}

export interface DailyDropSnapshot {
  readonly status: 'empty' | 'ready';
  readonly view: DailyDropView;
}

export function dayKeyOf(now: number): string {
  return localDayKey(now);
}

export function dayDistance(from: string, to: string): number {
  const start = localMidnight(from);
  const end = localMidnight(to);
  return Math.round((end - start) / MS_PER_DAY);
}

export function dropCandidateRank(
  daily: Recommendation | null,
  sections: readonly RecommendationSection[],
): readonly Recommendation[] {
  const rank: Recommendation[] = [];
  const seen = new Set<number>();
  for (const recommendation of [daily, ...sections.flatMap((section) => section.recommendations)]) {
    if (recommendation === null || seen.has(recommendation.anime.id)) continue;
    seen.add(recommendation.anime.id);
    rank.push(recommendation);
  }
  return rank;
}

export function dailyDropTaste(
  profile: RecommendationProfile,
  limit: number = DAILY_DROP_TASTE_GENRE_LIMIT,
): DailyDropTaste {
  return {
    genres: [...profile.genres.entries()]
      .filter(([, value]) => value.positive > value.negative)
      .map(([name, value]) => ({
        name: normalizeGenre(name),
        score: value.positive - value.negative,
      }))
      .filter((entry) => entry.name.length > 0)
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
      .slice(0, limit)
      .map((entry) => entry.name),
  };
}

/**
 * The strict rule, one candidate at a time: over the compatibility floor and, when a taste
 * exists, sharing at least one of its genres. `filterDailyDropCandidates` relaxes the genre half
 * when an entire pool fails it, so passing here is necessary but not always sufficient to appear
 * in a drop.
 */
export function qualifiesForDailyDrop(
  recommendation: Recommendation,
  taste: DailyDropTaste,
  minimumCompatibility: number = DAILY_DROP_MIN_COMPATIBILITY,
): boolean {
  if (recommendation.compatibilityScore < minimumCompatibility) return false;
  if (taste.genres.length === 0) return true;
  return matchesTaste(recommendation, new Set(taste.genres));
}

export function filterDailyDropCandidates(
  rank: readonly Recommendation[],
  taste: DailyDropTaste,
  minimumCompatibility: number = DAILY_DROP_MIN_COMPATIBILITY,
): readonly Recommendation[] {
  const compatible = rank.filter((item) => item.compatibilityScore >= minimumCompatibility);
  if (taste.genres.length === 0) return compatible;
  const onTaste = compatible.filter((item) => matchesTaste(item, new Set(taste.genres)));
  // A narrow taste can leave nothing at all, and an empty drop is a worse answer than a
  // well-matched one: the compatibility floor still holds, only the genre rule is dropped.
  return onTaste.length > 0 ? onTaste : compatible;
}

export function selectDailyDropAnimeIds(
  rank: readonly Recommendation[],
  day: string,
  seenIds: ReadonlySet<number>,
  size: number = DAILY_DROP_SIZE,
): readonly number[] {
  if (rank.length === 0 || size <= 0) return [];
  const fresh = rank.filter((item) => !seenIds.has(item.anime.id));
  const pool = fresh.length >= size ? fresh : rank;
  const offset = daySeed(day) % pool.length;
  const selected: number[] = [];
  const taken = new Set<number>();
  for (let step = 0; step < pool.length && selected.length < size; step += 1) {
    const id = pool[(offset + step) % pool.length].anime.id;
    if (taken.has(id)) continue;
    taken.add(id);
    selected.push(id);
  }
  return selected;
}

export function buildDailyDropView(
  current: StoredDailyDrop | null,
  history: readonly StoredDailyDrop[],
  rank: readonly Recommendation[],
  today: string,
): DailyDropView {
  const byId = new Map(rank.map((item) => [item.anime.id, item]));
  const currentItems = current === null ? [] : resolveItems(current, byId);
  const missedItems = history
    .filter((drop) => drop.day !== today && isWithinGrace(drop.day, today))
    .flatMap((drop) => resolveItems(drop, byId))
    .filter((item) => item.state === 'unclaimed');

  return {
    day: today,
    items: currentItems,
    missed: missedItems,
    unclaimedCount: currentItems.filter((item) => item.state === 'unclaimed').length,
  };
}

export function isWithinGrace(day: string, today: string): boolean {
  const distance = dayDistance(day, today);
  return distance > 0 && distance <= DAILY_DROP_GRACE_DAYS;
}

export function seenDropIds(history: readonly StoredDailyDrop[]): ReadonlySet<number> {
  return new Set(history.flatMap((drop) => drop.animeIds));
}

export function createStoredDailyDrop(
  providerId: string,
  day: string,
  animeIds: readonly number[],
  claimedIds: readonly number[] = [],
): StoredDailyDrop {
  return { version: DAILY_DROP_VERSION, day, providerId, animeIds, claimedIds };
}

export function isStoredDailyDrop(value: unknown): value is StoredDailyDrop {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === DAILY_DROP_VERSION &&
    isDayKey(candidate.day) &&
    typeof candidate.providerId === 'string' &&
    candidate.providerId.length > 0 &&
    isIdList(candidate.animeIds) &&
    candidate.animeIds.length > 0 &&
    isIdList(candidate.claimedIds) &&
    candidate.claimedIds.every((id) => (candidate.animeIds as readonly number[]).includes(id))
  );
}

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function matchesTaste(recommendation: Recommendation, wanted: ReadonlySet<string>): boolean {
  return recommendation.anime.genres.some((genre) => wanted.has(normalizeGenre(genre.name)));
}

function normalizeGenre(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveItems(
  drop: StoredDailyDrop,
  byId: ReadonlyMap<number, Recommendation>,
): readonly DailyDropItem[] {
  const claimed = new Set(drop.claimedIds);
  return drop.animeIds.flatMap((id) => {
    const recommendation = byId.get(id);
    if (recommendation === undefined) return [];
    return [
      { recommendation, state: claimed.has(id) ? ('claimed' as const) : ('unclaimed' as const) },
    ];
  });
}

function daySeed(day: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < day.length; index += 1) {
    hash ^= day.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash);
}

function localMidnight(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1).getTime();
}

function isIdList(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)
  );
}
