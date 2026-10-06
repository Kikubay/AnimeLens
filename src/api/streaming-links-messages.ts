import type { StreamingLink } from '../domain/streaming';

export type StreamingLinksMessage = {
  readonly type: 'anime.get_streaming_links';
  readonly animeId: number;
};

export type StreamingLinksResponse =
  | { readonly ok: true; readonly links: readonly StreamingLink[] }
  | { readonly ok: false; readonly message: string };

// Only asked when the record we hold has no links, since list/suggestion/ranking endpoints needn't include them. Never rejects: offline, expired token or nothing to say all render as no card.
export async function requestStreamingLinks(
  animeId: number,
): Promise<readonly StreamingLink[]> {
  const response = (await chrome.runtime.sendMessage({
    type: 'anime.get_streaming_links',
    animeId,
  })) as StreamingLinksResponse | undefined;
  if (response === undefined || response === null) return [];
  if (!response.ok) return [];
  return Array.isArray(response.links) ? response.links : [];
}

export function isStreamingLinksMessage(value: unknown): value is StreamingLinksMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  if (value.type !== 'anime.get_streaming_links') return false;
  return (
    'animeId' in value &&
    typeof value.animeId === 'number' &&
    Number.isInteger(value.animeId) &&
    value.animeId > 0
  );
}