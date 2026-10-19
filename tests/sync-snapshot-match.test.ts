import { describe, expect, it } from 'vitest';
import type { SyncSnapshot } from '../src/sync/sync-messages';
import { syncSnapshotsMatch } from '../src/sync/sync-snapshot-match';
import type { SyncMetadata, SyncProgress } from '../src/domain/sync';

const metadata = (overrides: Partial<SyncMetadata> = {}): SyncMetadata => ({
  status: 'success',
  phase: null,
  progress: null,
  lastSyncedAt: '2026-07-14T03:22:00.000Z',
  itemCount: 420,
  nextPageUrl: null,
  errorCode: null,
  errorMessage: null,
  fromCache: false,
  ...overrides,
});

const snapshot = (
  metadataOverrides: Partial<SyncMetadata> = {},
  progress: SyncProgress | null = null,
): SyncSnapshot => ({ metadata: metadata(metadataOverrides), progress });

const progress = (overrides: Partial<SyncProgress> = {}): SyncProgress => ({
  phase: 'fetching',
  current: 40,
  total: 200,
  message: 'Syncing your list',
  ...overrides,
});

describe('syncSnapshotsMatch', () => {
  it('treats two independently built identical snapshots as equal', () => {
    expect(syncSnapshotsMatch(snapshot(), snapshot())).toBe(true);
  });

  it('treats the same reference as equal', () => {
    const current = snapshot();
    expect(syncSnapshotsMatch(current, current)).toBe(true);
  });

  it.each<[string, Partial<SyncMetadata>]>([
    ['status', { status: 'syncing' }],
    ['phase', { phase: 'analyzing' }],
    ['lastSyncedAt', { lastSyncedAt: '2026-07-15T00:00:00.000Z' }],
    ['itemCount', { itemCount: 421 }],
    ['nextPageUrl', { nextPageUrl: 'https://example.test/next' }],
    ['errorCode', { errorCode: 'network_error' }],
    ['errorMessage', { errorMessage: 'boom' }],
    ['fromCache', { fromCache: true }],
  ])('reports a difference in %s', (_field, overrides) => {
    expect(syncSnapshotsMatch(snapshot(), snapshot(overrides))).toBe(false);
  });

  it('reports a difference when only the progress payload changes', () => {
    expect(
      syncSnapshotsMatch(snapshot({}, progress()), snapshot({}, progress({ current: 41 }))),
    ).toBe(false);
  });

  it('reports a difference when progress appears or disappears', () => {
    expect(syncSnapshotsMatch(snapshot(), snapshot({}, progress()))).toBe(false);
    expect(syncSnapshotsMatch(snapshot({}, progress()), snapshot())).toBe(false);
  });

  it('matches two progress payloads that are equal but not identical', () => {
    expect(syncSnapshotsMatch(snapshot({}, progress()), snapshot({}, progress()))).toBe(true);
  });
});
