import { parsePopupViewState, type PopupViewState } from './view-state';

export async function requestPopupViewState(): Promise<PopupViewState | null> {
  const response = (await chrome.runtime.sendMessage({ type: 'popup.get_view_state' })) as
    { readonly ok: boolean; readonly state?: unknown } | undefined;
  if (response === undefined || !response.ok) return null;
  return parsePopupViewState(response.state);
}

export async function savePopupViewState(state: PopupViewState): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'popup.save_view_state', state });
}
