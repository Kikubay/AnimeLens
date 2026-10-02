import type { StreamingLink } from '../domain/streaming';

export type StreamingLinksMessage = {
  readonly type: 'anime.get_streaming_links';
  readonly animeId: number;
};

export type StreamingLinksResponse =
  | { readonly ok: true; readonly links: readonly StreamingLink[] }
  | { readonly ok: false; readonly message: string };

/**
 * Asked on open only when the record we already hold carries no links — the
 * list, suggestions and ranking endpoints aren't required to include them, so
 * relying on the record alone left the card silently empty.
 *
 * Never rejects: no connection, an expired token or a provider with nothing to
 * say all resolve to no links, which renders as no card.
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