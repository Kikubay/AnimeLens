import type { SyncSnapshot } from './sync-messages';

// The worker rebuilds the snapshot on every `sync.get_snapshot`, so reference equality would re-render the
// whole popup on each poll even when nothing changed. Compare the fields the UI actually reads instead.
export function syncSnapshotsMatch(left: SyncSnapshot, right: SyncSnapshot): boolean {
  if (left === right) return true;

  const before = left.metadata;
  const after = right.metadata;
  if (
    before.status !== after.status ||
    before.phase !== after.phase ||
    before.lastSyncedAt !== after.lastSyncedAt ||
    before.itemCount !== after.itemCount ||
    before.nextPageUrl !== after.nextPageUrl ||
    before.errorCode !== after.errorCode ||
    before.errorMessage !== after.errorMessage ||
    before.fromCache !== after.fromCache
  ) {
    return false;
  }

  if (left.progress === right.progress) return true;
  if (left.progress === null || right.progress === null) return false;
  return (
    left.progress.phase === right.progress.phase &&
    left.progress.current === right.progress.current &&
    left.progress.total === right.progress.total &&
    left.progress.message === right.progress.message
  );
}
