import type { ProfileSnapshot } from './profile-types';

export type ProfileMessage = { readonly type: 'profile.get_snapshot' };

export type ProfileMessageResponse =
  | { readonly ok: true; readonly snapshot: ProfileSnapshot }
  | { readonly ok: false; readonly message: string };

export async function requestProfileSnapshot(): Promise<ProfileSnapshot> {
  const response = (await chrome.runtime.sendMessage({
    type: 'profile.get_snapshot',
  })) as ProfileMessageResponse;
  if (!response.ok) throw new Error(response.message);
  return response.snapshot;
}

export function isProfileMessage(value: unknown): value is ProfileMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'profile.get_snapshot'
  );
}
