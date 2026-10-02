/**
 * Streaming availability, normalized from AniList's `externalLinks`.
 *
 * AniList is the only provider that publishes this, and it's what makes the
 * feature possible at all: every link carries a `type`, so `STREAMING` is
 * distinguishable from the `INFO`/`SOCIAL` noise in the same array. MAL has no
 * equivalent field anywhere in its API (see `mal-streaming.ts`).
 *
 * A service in the catalogue keeps a stable id and canonical spelling, so the
 * same brand always renders the same way. One AniList calls streaming but we
 * don't know keeps its own name — dropping it would report a watchable title as
 * unwatched.
 */

// These ids end up in stored preferences and in link comparisons, so renaming
// one silently drops whatever the user had selected.
export const STREAMING_SERVICE_IDS = [
  'crunchyroll',
  'netflix',
  'hulu',
  'amazon-prime-video',
  'disney-plus',
  'max',
  'hidive',
  'funimation',
  'vrv',
  'youtube',
  'bilibili',
] as const;

export type StreamingServiceId = (typeof STREAMING_SERVICE_IDS)[number];

const STREAMING_SERVICE_NAMES: Readonly<Record<StreamingServiceId, string>> = {
  crunchyroll: 'Crunchyroll',
  netflix: 'Netflix',
  hulu: 'Hulu',
  'amazon-prime-video': 'Amazon Prime Video',
  'disney-plus': 'Disney+',
  max: 'Max',
  hidive: 'HIDIVE',
  funimation: 'Funimation',
  vrv: 'VRV',
  youtube: 'YouTube',
  bilibili: 'Bilibili',
};

// Keys are folded by `normalizeServiceKey` before lookup, so write them the way
// `normalizeServiceKey` would — no spaces, no punctuation.
const SERVICE_ALIASES: Readonly<Record<StreamingServiceId, readonly string[]>> = {
  crunchyroll: ['crunchyroll'],
  netflix: ['netflix'],
  hulu: ['hulu'],
  'amazon-prime-video': ['amazonprimevideo', 'amazonprime', 'primevideo'],
  'disney-plus': ['disneyplus', 'disney'],
  max: ['max', 'hbomax'],
  hidive: ['hidive'],
  funimation: ['funimation', 'crunchyrollfunimation'],
  vrv: ['vrv'],
  youtube: ['youtube'],
  bilibili: ['bilibili', 'bilibilitv'],
};

const ALIAS_INDEX: ReadonlyMap<string, StreamingServiceId> = buildAliasIndex();

export interface StreamingLink {
  /** Catalogue id, or a slug derived from AniList's own service name. */
  readonly serviceId: string;
  readonly serviceName: string;
  readonly url: string | null;
}

export interface AniListExternalLinkDto {
  readonly site?: string | null;
  readonly url?: string | null;
  readonly type?: string | null;
}

export function resolveStreamingServiceId(value: string | null | undefined): StreamingServiceId | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return ALIAS_INDEX.get(normalizeServiceKey(trimmed)) ?? null;
}

// `type` is what makes this trustworthy, so when it's missing we only accept
// platforms we'd recognise anyway. http(s) only, so a smuggled `javascript:`
// payload can never reach an anchor we render.
export function normalizeStreamingSites(
  links: readonly AniListExternalLinkDto[] | null | undefined,
): readonly StreamingLink[] {
  if (!Array.isArray(links)) return [];
  const byId = new Map<string, StreamingLink>();
  for (const entry of links) {
    if (!isRecord(entry)) continue;
    const site = optionalString(entry.site);
    if (site === null || site.trim().length === 0) continue;
    const type = optionalString(entry.type);
    if (type !== null && type.trim().length > 0) {
      if (type.trim().toUpperCase() !== 'STREAMING') continue;
    } else if (resolveStreamingServiceId(site) === null) {
      // No type, unknown name — can't tell a platform from an official site.
      continue;
    }
    const known = resolveStreamingServiceId(site);
    const serviceId = known ?? slugify(site);
    if (serviceId.length === 0) continue;
    const url = normalizeWatchUrl(optionalString(entry.url));
    const existing = byId.get(serviceId);
    if (existing === undefined) {
      byId.set(serviceId, {
        serviceId,
        serviceName: known !== null ? STREAMING_SERVICE_NAMES[known] : site.trim(),
        url,
      });
    } else if (existing.url === null && url !== null) {
      byId.set(serviceId, { ...existing, url });
    }
  }
  return [...byId.values()];
}

function slugify(value: string): string {
  return normalizeServiceKey(value).replace(/^-+|-+$/g, '').slice(0, 40);
}

function normalizeWatchUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return isSafeWatchUrl(trimmed) ? trimmed : null;
}

function isSafeWatchUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeServiceKey(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Anything non-string in the payload is treated as absent rather than coerced.
function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function buildAliasIndex(): ReadonlyMap<string, StreamingServiceId> {
  const index = new Map<string, StreamingServiceId>();
  for (const id of STREAMING_SERVICE_IDS) {
    index.set(normalizeServiceKey(STREAMING_SERVICE_NAMES[id]), id);
    index.set(normalizeServiceKey(id), id);
  }
  for (const [id, aliases] of Object.entries(SERVICE_ALIASES) as readonly [
    StreamingServiceId,
    readonly string[],
  ][]) {
    for (const alias of aliases) index.set(normalizeServiceKey(alias), id);
  }
  return index;
}