import type { StreamingLink } from '../../../domain/streaming';
import { normalizeStreamingSites } from '../../../domain/streaming';

/**
 * Where-to-watch data for MyAnimeList.
 *
 * MAL's **API** publishes no streaming-links field (its documented anime fields
 * stop at `related_anime, related_manga, recommendations, studios, statistics`,
 * and the word "streaming" appears nowhere in the API reference), so the card
 * cannot be fed from `/anime/{id}`. The website does render the data, under a
 * "Streaming Platforms" heading:
 *
 * ```html
 * <h2>Streaming Platforms</h2>
 * <div class="pb16 broadcasts"><div class="broadcast">
 *   <a href="http://www.crunchyroll.com/series-283731" title="Crunchyroll"
 *      class="broadcast-item available" data-available="1" ...>
 *     <i class="spicon spicon-crunchyroll"></i><div class="caption">Crunchyroll</div>
 * ```
 *
 * So the page is read instead. Two consequences worth keeping in mind:
 *
 * - This is a scrape, and MAL obfuscates its CSS class names, so nothing keys
 *   off a generated class. The heading *text* locates the section and
 *   `broadcast-item` (a stable, semantic class) identifies the entries.
 * - MV3 service workers have no `DOMParser`, so the markup is scanned with a
 *   tag scanner rather than parsed into a DOM.
 */

/** Anime pages are the same origin the extension already declares access to. */
export const MAL_WEB_ANIME_URL = 'https://myanimelist.net/anime';

/** Bound on the slice scanned after the heading, so a huge page cannot stall. */
const SECTION_WINDOW_CHARS = 12_000;

const REQUEST_TIMEOUT_MS = 8_000;

const HEADING = /<h[1-6][^>]*>([\s\S]{0,300}?)<\/h[1-6]>/gi;
const STREAMING_HEADING = /streaming\s*platform/i;
const ANCHOR = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const CAPTION = /<div[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i;

/**
 * Extracts the streaming platforms of one MAL anime page.
 *
 * Returns an empty list for a page without the section (an unstreamed title, or
 * a layout change), which the caller renders as "no card" rather than an error.
 */
export function parseMalStreamingPlatforms(html: string): readonly StreamingLink[] {
  const section = streamingSection(html);
  if (section === null) return [];

  const entries: { readonly site: string; readonly url: string; readonly type: 'STREAMING' }[] = [];
  for (const anchor of section.matchAll(ANCHOR)) {
    const attributes = anchor[1] ?? '';
    if (!/\bbroadcast-item\b/.test(attributes)) continue;
    // MAL marks a platform that is not currently serving the title.
    if (/\bdata-available="0"/i.test(attributes)) continue;
    const url = readAttribute(attributes, 'href');
    if (url === null) continue;
    const site = readAttribute(attributes, 'title') ?? captionOf(anchor[2] ?? '');
    if (site === null || site.length === 0) continue;
    entries.push({ site, url, type: 'STREAMING' });
  }
  return normalizeStreamingSites(entries);
}

/**
 * The markup of the "Streaming Platforms" section, from just after its heading
 * to the next heading, or `null` when the page has no such section.
 */
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

/**
 * Reads the platform name from the `title` attribute, falling back to the
 * visible caption inside the anchor.
 */
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
 * Fetches and parses one MAL anime page.
 *
 * Sent without cookies or an `Authorization` header: this is the public
 * website, and the user's MAL API token must never be handed to it. Never
 * throws — the card is an enhancement, so a network or layout failure resolves
 * to no card.
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