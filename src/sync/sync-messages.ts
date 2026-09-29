import type { SyncMetadata, SyncProgress } from '../domain/sync';
import type { SyncReason } from './sync-types';

export type SyncMessageType = 'sync.get_snapshot' | 'sync.start' | 'sync.invalidate';

export interface SyncMessage {
  readonly type: SyncMessageType;
  readonly reason?: SyncReason;
}

export interface SyncSnapshot {
  readonly metadata: SyncMetadata;
  readonly progress: SyncProgress | null;
}

export type SyncMessageResponse =
  | { readonly ok: true; readonly snapshot: SyncSnapshot }
  | { readonly ok: false; readonly message: string };

export async function requestSyncSnapshot(): Promise<SyncSnapshot> {
  const response = (await chrome.runtime.sendMessage({
    type: 'sync.get_snapshot',
  })) as SyncMessageResponse;
  if (!response.ok) throw new Error(response.message);
  return response.snapshot;
}

export async function requestSync(reason: SyncReason = 'manual'): Promise<SyncSnapshot> {
  const response = (await chrome.runtime.sendMessage({
    type: 'sync.start',
    reason,
  })) as SyncMessageResponse;
  if (!response.ok) throw new Error(response.message);
  return response.snapshot;
}

export function isSyncMessage(value: unknown): value is SyncMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return (
    value.type === 'sync.get_snapshot' ||
    value.type === 'sync.start' ||
    value.type === 'sync.invalidate'
  );
}
