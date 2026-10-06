import type { StoredPreferenceItem, StoredProfileSnapshot } from '../storage/storage-types';
import type { UserProfileSummary } from './profile-types';

export const PROFILE_HISTORY_VERSION = 1;

export const PROFILE_HISTORY_CAPACITY = 4;

// A score is `positive / count`, so an item backed by one or two entries swings 30-50 points on a single addition — that's arithmetic, not taste.
export const MIN_SAMPLE_COUNT = 3;

export const MIN_SCORE_DELTA = 5;

export const MAX_CHANGES = 4;

export const MIN_AVERAGE_DELTA = 0.3;

export type ProfileAxis = 'genres' | 'themes' | 'studios';

export type ProfileChangeKind =
  'entered' | 'left' | 'rank_up' | 'rank_down' | 'score_up' | 'score_down';

export interface ProfileChange {
  readonly kind: ProfileChangeKind;
  readonly axis: ProfileAxis;
  readonly name: string;
  /** Zero-based position in the top five, or null when the item was absent. */
  readonly from: number | null;
  readonly to: number | null;
  readonly fromScore: number | null;
  readonly toScore: number | null;
}

export interface ProfileAverageChange {
  readonly from: number;
  readonly to: number;
  readonly direction: 'up' | 'down';
}

// 'baseline' = nothing to compare against, 'ready' = something crossed a threshold, 'stable' = nothing meaningful moved, 'unavailable' = the stored history is another shape or provider.
export type ProfileDeltaStatus = 'baseline' | 'ready' | 'stable' | 'unavailable';

export interface ProfileDelta {
  readonly status: ProfileDeltaStatus;
  readonly previousAt: string | null;
  readonly changes: readonly ProfileChange[];
  readonly averageChange: ProfileAverageChange | null;
}

const AXES: readonly ProfileAxis[] = ['genres', 'themes', 'studios'];

// Most newsworthy first: joining the top five beats a rank move beats a nudge.
const SIGNIFICANCE: Readonly<Record<ProfileChangeKind, number>> = {
  entered: 0,
  left: 1,
  rank_up: 2,
  rank_down: 3,
  score_up: 4,
  score_down: 5,
};

export function toStoredProfileSnapshot(
  summary: UserProfileSummary,
  providerId: string,
  capturedAt: string,
): StoredProfileSnapshot {
  return {
    version: PROFILE_HISTORY_VERSION,
    capturedAt,
    providerId,
    analyzedAnimeCount: summary.analyzedAnimeCount,
    ratedAnimeCount: summary.ratedAnimeCount,
    averageScore: summary.averageScore,
    genres: toItems(summary.favoriteGenres),
    themes: toItems(summary.favoriteThemes),
    studios: toItems(summary.favoriteStudios),
  };
}

function toItems(
  items: readonly { readonly name: string; readonly score: number; readonly count: number }[],
): readonly StoredPreferenceItem[] {
  return items.map((item) => ({ name: item.name, score: item.score, count: item.count }));
}

// Pure, because the store advances the baseline and only when the list or feedback really changed — otherwise the first popup to open would eat the delta.
export function diffProfileSnapshots(
  previous: StoredProfileSnapshot | null,
  current: StoredProfileSnapshot,
): ProfileDelta {
  if (previous === null) return baselineDelta();
  if (previous.version !== current.version || previous.providerId !== current.providerId) {
    return { status: 'unavailable', previousAt: null, changes: [], averageChange: null };
  }
  // Same counts means nothing derived moved, e.g. an entry only shifted from "plan to watch" to "watching".
  if (
    previous.analyzedAnimeCount === current.analyzedAnimeCount &&
    previous.ratedAnimeCount === current.ratedAnimeCount
  ) {
    return { status: 'stable', previousAt: previous.capturedAt, changes: [], averageChange: null };
  }

  const changes = AXES.flatMap((axis) => diffAxis(axis, previous[axis], current[axis]));
  changes.sort(compareChanges);
  const averageChange = diffAverage(previous.averageScore, current.averageScore);
  return {
    status: changes.length > 0 || averageChange !== null ? 'ready' : 'stable',
    previousAt: previous.capturedAt,
    changes: changes.slice(0, MAX_CHANGES),
    averageChange,
  };
}

function baselineDelta(): ProfileDelta {
  return { status: 'baseline', previousAt: null, changes: [], averageChange: null };
}

export function baselineProfileDelta(): ProfileDelta {
  return baselineDelta();
}

interface PositionedItem {
  readonly index: number;
  readonly item: StoredPreferenceItem;
}

function diffAxis(
  axis: ProfileAxis,
  previous: readonly StoredPreferenceItem[],
  current: readonly StoredPreferenceItem[],
): ProfileChange[] {
  const before = new Map<string, PositionedItem>(
    previous.map((item, index) => [item.name, { index, item }]),
  );
  const after = new Map<string, PositionedItem>(
    current.map((item, index) => [item.name, { index, item }]),
  );
  const changes: ProfileChange[] = [];

  for (const [name, { index, item }] of after) {
    const was = before.get(name);
    if (was === undefined) {
      changes.push({
        kind: 'entered',
        axis,
        name,
        from: null,
        to: index,
        fromScore: null,
        toScore: item.score,
      });
      continue;
    }
    // A rank move already says what the score change did, so it isn't paired with a score line.
    if (was.index !== index) {
      changes.push({
        kind: was.index > index ? 'rank_up' : 'rank_down',
        axis,
        name,
        from: was.index,
        to: index,
        fromScore: was.item.score,
        toScore: item.score,
      });
      continue;
    }
    if (was.item.count < MIN_SAMPLE_COUNT || item.count < MIN_SAMPLE_COUNT) continue;
    const delta = item.score - was.item.score;
    if (Math.abs(delta) < MIN_SCORE_DELTA) continue;
    changes.push({
      kind: delta > 0 ? 'score_up' : 'score_down',
      axis,
      name,
      from: index,
      to: index,
      fromScore: was.item.score,
      toScore: item.score,
    });
  }

  for (const [name, { index, item }] of before) {
    if (after.has(name)) continue;
    changes.push({
      kind: 'left',
      axis,
      name,
      from: index,
      to: null,
      fromScore: item.score,
      toScore: null,
    });
  }

  return changes;
}

function diffAverage(from: number | null, to: number | null): ProfileAverageChange | null {
  if (from === null || to === null) return null;
  const delta = to - from;
  if (Math.abs(delta) < MIN_AVERAGE_DELTA) return null;
  return { from, to, direction: delta > 0 ? 'up' : 'down' };
}

function compareChanges(left: ProfileChange, right: ProfileChange): number {
  const bySignificance = SIGNIFICANCE[left.kind] - SIGNIFICANCE[right.kind];
  if (bySignificance !== 0) return bySignificance;
  const byMagnitude = scoreSwing(right) - scoreSwing(left);
  if (byMagnitude !== 0) return byMagnitude;
  // Ties still need a stable order, or the same profile renders differently on every open.
  return left.name.localeCompare(right.name) || left.axis.localeCompare(right.axis);
}

function scoreSwing(change: ProfileChange): number {
  if (change.fromScore === null || change.toScore === null) return 0;
  return Math.abs(change.toScore - change.fromScore);
}

export function sameProfileMeasurement(
  left: StoredProfileSnapshot,
  right: StoredProfileSnapshot,
): boolean {
  return (
    left.analyzedAnimeCount === right.analyzedAnimeCount &&
    left.ratedAnimeCount === right.ratedAnimeCount &&
    left.averageScore === right.averageScore &&
    AXES.every((axis) => sameAxis(left[axis], right[axis]))
  );
}

function sameAxis(
  left: readonly StoredPreferenceItem[],
  right: readonly StoredPreferenceItem[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.name === right[index]?.name &&
        item.score === right[index]?.score &&
        item.count === right[index]?.count,
    )
  );
}
