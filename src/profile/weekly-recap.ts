import type { StoredProfileSnapshot } from '../storage/storage-types';
import { diffProfileSnapshots, type ProfileAxis, type ProfileChangeKind } from './profile-delta';

export const RECAP_MIN_WINDOW_DAYS = 5;
export const RECAP_TARGET_WINDOW_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface WeeklyRecapShift {
  readonly kind: ProfileChangeKind;
  readonly axis: ProfileAxis;
  readonly name: string;
  readonly direction: 'up' | 'down' | 'in' | 'out';
}

export interface WeeklyRecap {
  readonly windowDays: number;
  readonly windowStart: string;
  readonly entriesAdded: number;
  readonly entriesRated: number;
  readonly averageBefore: number | null;
  readonly averageAfter: number | null;
  readonly averageDelta: number | null;
  readonly shifts: readonly WeeklyRecapShift[];
  readonly weekNumber: number;
}

export function computeWeeklyRecap(
  snapshots: readonly StoredProfileSnapshot[],
): WeeklyRecap | null {
  const window = findWindow(snapshots);
  if (window === null) return null;
  const { previous, current, days } = window;
  const delta = diffProfileSnapshots(previous, current);

  return {
    windowDays: days,
    windowStart: previous.capturedAt,
    entriesAdded: Math.max(0, current.analyzedAnimeCount - previous.analyzedAnimeCount),
    entriesRated: Math.max(0, current.ratedAnimeCount - previous.ratedAnimeCount),
    averageBefore: previous.averageScore,
    averageAfter: current.averageScore,
    averageDelta:
      delta.averageChange === null ? null : delta.averageChange.to - delta.averageChange.from,
    shifts: delta.changes.map((change) => ({
      kind: change.kind,
      axis: change.axis,
      name: change.name,
      direction: shiftDirection(change.kind),
    })),
    weekNumber: countCompletedWindows(snapshots),
  };
}

export function hasEnoughHistoryForRecap(snapshots: readonly StoredProfileSnapshot[]): boolean {
  return findWindow(snapshots) !== null;
}

function findWindow(snapshots: readonly StoredProfileSnapshot[]): {
  readonly previous: StoredProfileSnapshot;
  readonly current: StoredProfileSnapshot;
  readonly days: number;
} | null {
  for (let index = 0; index < snapshots.length - 1; index += 1) {
    const current = snapshots[index];
    const previous = snapshots[index + 1];
    const days = windowDays(previous, current);
    if (days !== null && days >= RECAP_MIN_WINDOW_DAYS) return { previous, current, days };
  }
  return null;
}

function windowDays(
  previous: StoredProfileSnapshot,
  current: StoredProfileSnapshot,
): number | null {
  if (previous.version !== current.version || previous.providerId !== current.providerId) {
    return null;
  }
  const from = Date.parse(previous.capturedAt);
  const to = Date.parse(current.capturedAt);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (to <= from) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

function countCompletedWindows(snapshots: readonly StoredProfileSnapshot[]): number {
  let weeks = 0;
  for (let index = 0; index < snapshots.length - 1; index += 1) {
    const days = windowDays(snapshots[index + 1], snapshots[index]);
    if (days !== null && days >= RECAP_TARGET_WINDOW_DAYS) weeks += 1;
  }
  return Math.max(1, weeks);
}

function shiftDirection(kind: ProfileChangeKind): WeeklyRecapShift['direction'] {
  if (kind === 'entered') return 'in';
  if (kind === 'left') return 'out';
  if (kind === 'rank_up' || kind === 'score_up') return 'up';
  return 'down';
}
