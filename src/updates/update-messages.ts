import type { UpdateSnapshot } from './update-checker';

export type UpdateMessage =
  | { readonly type: 'updates.check' }
  | { readonly type: 'updates.download' }
  | { readonly type: 'updates.openRelease' };

export type UpdateResponse =
  | { readonly ok: true; readonly snapshot: UpdateSnapshot }
  | { readonly ok: false; readonly message: string };

async function sendUpdateMessage(message: UpdateMessage): Promise<UpdateSnapshot> {
  const response = (await chrome.runtime.sendMessage(message)) as UpdateResponse | undefined | null;
  if (response === undefined || response === null) throw new Error('Updates are unavailable.');
  if (!response.ok) throw new Error(response.message);
  return response.snapshot;
}

export function requestUpdateCheck(): Promise<UpdateSnapshot> {
  return sendUpdateMessage({ type: 'updates.check' });
}

export function requestUpdateDownload(): Promise<UpdateSnapshot> {
  return sendUpdateMessage({ type: 'updates.download' });
}

export function requestUpdateReleasePage(): Promise<UpdateSnapshot> {
  return sendUpdateMessage({ type: 'updates.openRelease' });
}

export function isUpdateMessage(value: unknown): value is UpdateMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return (
    value.type === 'updates.check' ||
    value.type === 'updates.download' ||
    value.type === 'updates.openRelease'
  );
}
