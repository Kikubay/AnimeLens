import type { UpdateSnapshot } from './update-checker';

export type UpdateMessage = { readonly type: 'updates.check' };

export type UpdateResponse =
  | { readonly ok: true; readonly snapshot: UpdateSnapshot }
  | { readonly ok: false; readonly message: string };

export async function requestUpdateCheck(): Promise<UpdateSnapshot> {
  const response = (await chrome.runtime.sendMessage({ type: 'updates.check' })) as UpdateResponse;
  if (!response.ok) throw new Error(response.message);
  return response.snapshot;
}

export function isUpdateMessage(value: unknown): value is UpdateMessage {
  return (
    typeof value === 'object' && value !== null && 'type' in value && value.type === 'updates.check'
  );
}
