export type TopPicksMessage =
  | { readonly type: 'profile.get_top_picks_ranking' }
  | { readonly type: 'profile.save_top_picks_ranking'; readonly ranking: readonly number[] }
  | { readonly type: 'profile.clear_top_picks_ranking' };

export type TopPicksMessageResponse =
  | { readonly ok: true; readonly ranking: readonly number[] | null }
  | { readonly ok: false; readonly message: string };

// The background clears a stale value before answering, so one read is enough.
export async function requestTopPicksRanking(): Promise<readonly number[] | null> {
  const response = (await chrome.runtime.sendMessage({
    type: 'profile.get_top_picks_ranking',
  })) as TopPicksMessageResponse;
  if (!response.ok) throw new Error(response.message);
  return response.ranking;
}

export async function saveTopPicksRanking(ranking: readonly number[]): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: 'profile.save_top_picks_ranking',
    ranking: [...ranking],
  })) as TopPicksMessageResponse;
  if (!response.ok) throw new Error(response.message);
}

export async function clearTopPicksRanking(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: 'profile.clear_top_picks_ranking',
  })) as TopPicksMessageResponse;
  if (!response.ok) throw new Error(response.message);
}

export function isTopPicksMessage(value: unknown): value is TopPicksMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  const type = (value as { type: unknown }).type;
  if (type === 'profile.get_top_picks_ranking') return true;
  if (type === 'profile.clear_top_picks_ranking') return true;
  if (type !== 'profile.save_top_picks_ranking') return false;
  const ranking = (value as { ranking?: unknown }).ranking;
  return (
    Array.isArray(ranking) &&
    ranking.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)
  );
}
