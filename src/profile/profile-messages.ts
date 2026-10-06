import type { ProfileSnapshot } from './profile-types';

export type ProfileMessage =
  { readonly type: 'profile.get_snapshot' } | { readonly type: 'profile.clear_history' };

export type ProfileMessageResponse =
  { readonly ok: true; snapshot: ProfileSnapshot } | { readonly ok: false; message: string };

export async function requestProfileSnapshot(): Promise<ProfileSnapshot> {
  return (await send({ type: 'profile.get_snapshot' })).snapshot;
}

export async function clearProfileHistory(): Promise<ProfileSnapshot> {
  return (await send({ type: 'profile.clear_history' })).snapshot;
}

async function send(message: ProfileMessage): Promise<{ readonly snapshot: ProfileSnapshot }> {
  const response = (await chrome.runtime.sendMessage(message)) as ProfileMessageResponse;
  if (!response.ok) throw new Error(response.message);
  return { snapshot: response.snapshot };
}

export function isProfileMessage(value: unknown): value is ProfileMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return value.type === 'profile.get_snapshot' || value.type === 'profile.clear_history';
}
