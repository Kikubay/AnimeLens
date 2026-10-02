import type { SettingsSnapshot, UserPreferences } from './settings-types';

export type { SettingsSnapshot } from './settings-types';

export type SettingsMessage =
  | { readonly type: 'settings.get_snapshot' }
  | { readonly type: 'settings.update_preferences'; readonly preferences: UserPreferences }
  | { readonly type: 'settings.update_mal_client_id'; readonly clientId: string }
  | { readonly type: 'settings.update_anilist_client_id'; readonly clientId: string }
  | { readonly type: 'settings.clear_cache' }
  | { readonly type: 'settings.delete_local_data' }
  | { readonly type: 'settings.disconnect_mal' };

export type SettingsResponse =
  | { readonly ok: true; readonly snapshot: SettingsSnapshot }
  | { readonly ok: false; readonly message: string };

export async function requestSettingsSnapshot(): Promise<SettingsSnapshot> {
  return requestSettings({ type: 'settings.get_snapshot' });
}

export async function updateSettings(preferences: UserPreferences): Promise<SettingsSnapshot> {
  return requestSettings({ type: 'settings.update_preferences', preferences });
}

export async function updateMalClientId(clientId: string): Promise<SettingsSnapshot> {
  return requestSettings({ type: 'settings.update_mal_client_id', clientId });
}

export async function updateAnilistClientId(clientId: string): Promise<SettingsSnapshot> {
  return requestSettings({ type: 'settings.update_anilist_client_id', clientId });
}

export async function clearLocalCache(): Promise<SettingsSnapshot> {
  return requestSettings({ type: 'settings.clear_cache' });
}

export async function deleteLocalData(): Promise<SettingsSnapshot> {
  return requestSettings({ type: 'settings.delete_local_data' });
}

export async function disconnectMal(): Promise<SettingsSnapshot> {
  return requestSettings({ type: 'settings.disconnect_mal' });
}

export function isSettingsMessage(value: unknown): value is SettingsMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return (
    value.type === 'settings.get_snapshot' ||
    value.type === 'settings.update_preferences' ||
    value.type === 'settings.update_mal_client_id' ||
    value.type === 'settings.update_anilist_client_id' ||
    value.type === 'settings.clear_cache' ||
    value.type === 'settings.delete_local_data' ||
    value.type === 'settings.disconnect_mal'
  );
}

async function requestSettings(message: SettingsMessage): Promise<SettingsSnapshot> {
  const response = (await chrome.runtime.sendMessage(message)) as SettingsResponse;
  if (!response.ok) throw new Error(response.message);
  return response.snapshot;
}
