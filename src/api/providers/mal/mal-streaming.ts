import type { StreamingLink } from '../../../domain/streaming';
import { normalizeStreamingSites } from '../../../domain/streaming';

// MAL's API has no streaming-links field and rejects unknown ones with 400, so we scrape the website instead — the section is found by its heading text (class names are obfuscated) and picked apart by `broadcast-item`. MV3 workers have no DOMParser, hence the tag scanner rather than a parser. When MAL redesigns this breaks by rendering no card, never by throwing.

// Already covered by the `myanimelist.net` host permission.
export const MAL_WEB_ANIME_URL = 'https://myanimelist.net/anime';

// Anime pages are ~200KB and we only ever need the section itself.
const SECTION_WINDOW_CHARS = 12_000;

const REQUEST_TIMEOUT_MS = 8_000;

const HEADING = /<h[1-6][^>]*>([\s\S]{0,300}?)<\/h[1-6]>/gi;
const STREAMING_HEADING = /streaming\s*platform/i;
const ANCHOR = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const CAPTION = /<div[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i;

// No section means unstreamed or a layout change — either way the caller renders no card.
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
  return decodeEntities(
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
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

// No cookies and no Authorization header on purpose: it's the public website, and the user's MAL token has no business going there.
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
