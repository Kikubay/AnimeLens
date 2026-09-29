import type { AnimeStatus } from '../domain/anime';

export type MalListMessage = {
  readonly type: 'mal.list.add';
  readonly animeId: number;
  readonly status?: AnimeStatus;
};

export type MalListMessageResponse =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

export async function addAnimeToMalList(
  animeId: number,
  status: AnimeStatus = 'plan_to_watch',
): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: 'mal.list.add',
    animeId,
    status,
  })) as MalListMessageResponse;
  if (!response.ok) throw new Error(response.message);
}

export function isMalListMessage(value: unknown): value is MalListMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  if (value.type !== 'mal.list.add') return false;
  return (
    'animeId' in value &&
    typeof value.animeId === 'number' &&
    Number.isInteger(value.animeId) &&
    value.animeId > 0 &&
    (!('status' in value) || value.status === undefined || isAnimeStatus(value.status))
  );
}

function isAnimeStatus(value: unknown): value is AnimeStatus {
  return (
    value === 'watching' ||
    value === 'completed' ||
    value === 'on_hold' ||
    value === 'dropped' ||
    value === 'plan_to_watch' ||
    value === 'rewatching'
  );
}
