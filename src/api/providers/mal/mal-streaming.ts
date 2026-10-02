import type { StreamingLink } from '../../../domain/streaming';
import { normalizeStreamingSites } from '../../../domain/streaming';

/**
 * Where-to-watch data for MyAnimeList.
 *
 * The API can't help us here. Its documented anime fields are `id, title,
 * main_picture, …, related_anime, related_manga, recommendations, studios,
 * statistics` — no streaming links, and it answers `400 Invalid Parameters` for
 * fields it doesn't know, so inventing one breaks sync. The website does render
 * the data though, under a "Streaming Platforms" heading:
 *
 * ```html
 * <h2>Streaming Platforms</h2>
 * <a href="http://www.crunchyroll.com/series-283731" title="Crunchyroll"
 *    class="broadcast-item available" data-available="1" …>
 * ```
 *
 * So we read the page. Two things make that workable:
 *
 * - MAL obfuscates its CSS classes, so we find the section by its heading *text*
 *   and pick entries out by `broadcast-item`, which is stable and semantic.
 * - MV3 service workers have no `DOMParser`, so it's a tag scanner, not a parser.
 *
 * It's a scrape, so treat it as the fragile part of this feature: when MAL
 * redesigns, it breaks by rendering no card, never by throwing.
 */

// Already covered by the `myanimelist.net` host permission.
export const MAL_WEB_ANIME_URL = 'https://myanimelist.net/anime';

// Anime pages are ~200KB; we only ever need the section itself.
const SECTION_WINDOW_CHARS = 12_000;

const REQUEST_TIMEOUT_MS = 8_000;

const HEADING = /<h[1-6][^>]*>([\s\S]{0,300}?)<\/h[1-6]>/gi;
const STREAMING_HEADING = /streaming\s*platform/i;
const ANCHOR = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const CAPTION = /<div[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i;

// No section means an unstreamed title or a layout change. Either way the caller
// renders no card, which is the honest outcome.
export function parseMalStreamingPlatforms(html: string): readonly StreamingLink[] {
  const section = streamingSection(html);
  if (section === null) return [];

  const entries: { readonly site: string; readonly url: string; readonly type: 'STREAMING' }[] = [];
  for (const anchor of section.matchAll(ANCHOR)) {
    const attributes = anchor[1] ?? '';
    if (!/\bbroadcast-item\b/.test(attributes)) continue;
    // Listed but not actually serving the title right now.
    if (/\bdata-available="0"/i.test(attributes)) continue;
    const url = readAttribute(attributes, 'href');
    if (url === null) continue;
    const site = readAttribute(attributes, 'title') ?? captionOf(anchor[2] ?? '');
    if (site === null || site.length === 0) continue;
    entries.push({ site, url, type: 'STREAMING' });
  }
  return normalizeStreamingSites(entries);
}

function streamingSection(html: string): string | null {
  for (const heading of html.matchAll(HEADING)) {
    if (!STREAMING_HEADING.test(stripTags(heading[1] ?? ''))) continue;
    const start = (heading.index ?? 0) + heading[0].length;
    const window = html.slice(start, start + SECTION_WINDOW_CHARS);
    const next = window.search(HEADING);
    return next >= 0 ? window.slice(0, next) : window;
  }
  return null;
}

function captionOf(innerHtml: string): string | null {
  const caption = CAPTION.exec(innerHtml);
  const text = stripTags(caption?.[1] ?? innerHtml);
  return text.length === 0 ? null : text;
}

function readAttribute(tagAttributes: string, name: string): string | null {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const match = pattern.exec(tagAttributes);
  const value = match?.[2] ?? match?.[3];
  return value === undefined ? null : decodeEntities(value.trim());
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

/**
 * No cookies and no Authorization header, on purpose: that's the public website
 * and the user's MAL API token has no business being handed to it.
 */
export async function fetchMalStreamingPlatforms(
  animeId: number,
): Promise<readonly StreamingLink[]> {
  if (!Number.isInteger(animeId) || animeId <= 0) return [];
  try {
    const response = await fetch(`${MAL_WEB_ANIME_URL}/${animeId}`, {
      credentials: 'omit',
      redirect: 'follow',
      signal: timeoutSignal(),
    });
    if (!response.ok) return [];
    return parseMalStreamingPlatforms(await response.text());
  } catch {
    return [];
  }
}

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined;
}