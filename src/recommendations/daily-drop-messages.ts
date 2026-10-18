import type { DailyDropSnapshot } from './daily-drop';

export type DailyDropMessage =
  | { readonly type: 'daily_drop.get' }
  | { readonly type: 'daily_drop.claim'; readonly animeId: number };

export type DailyDropMessageResponse =
  | { readonly ok: true; readonly snapshot: DailyDropSnapshot }
  | { readonly ok: false; readonly message: string };

export async function requestDailyDrop(): Promise<DailyDropSnapshot> {
  return send({ type: 'daily_drop.get' });
}

export async function claimDailyDrop(animeId: number): Promise<DailyDropSnapshot> {
  return send({ type: 'daily_drop.claim', animeId });
}

export function isDailyDropMessage(value: unknown): value is DailyDropMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  if (value.type === 'daily_drop.get') return true;
  if (value.type !== 'daily_drop.claim') return false;
  return (
    'animeId' in value &&
    typeof (value as { animeId: unknown }).animeId === 'number' &&
    Number.isInteger((value as { animeId: unknown }).animeId) &&
    ((value as { animeId: unknown }).animeId as number) > 0
  );
}

async function send(message: DailyDropMessage): Promise<DailyDropSnapshot> {
  const response = (await chrome.runtime.sendMessage(message)) as DailyDropMessageResponse;
  if (!response.ok) throw new Error(response.message);
  return response.snapshot;
}
