import type { StreamingLink } from '../domain/streaming';

export type StreamingLinksMessage = {
  readonly type: 'anime.get_streaming_links';
  readonly animeId: number;
};

export type StreamingLinksResponse =
  | { readonly ok: true; readonly links: readonly StreamingLink[] }
  | { readonly ok: false; readonly message: string };

/**
 * Asks the background worker where a single title can be watched.
 *
 * The detail page calls this whenever the record it already holds carries no
 * links, so the card does not depend on which endpoint the record came from or
 * on how old the local cache is. Never throws: a provider that cannot answer
 * (or is not connected) resolves to an empty list, which simply renders no card.
 */
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