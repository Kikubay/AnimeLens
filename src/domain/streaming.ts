/**
 * Streaming availability, normalized from AniList's `externalLinks`.
 *
 * Only AniList exposes this: its entries carry a `type`, so `STREAMING` can be
 * told apart from `INFO`/`SOCIAL`/`MANGA` noise in the same array. MyAnimeList
 * publishes **no** streaming-links field — its documented anime fields stop at
 * `related_anime, related_manga, recommendations, studios, statistics` — so
 * nothing here is fetched for MAL and its records simply carry no
 * `streamingSites`.
 *
 * A platform in the catalogue below keeps a stable id and its canonical brand
 * spelling, so the same brand always renders identically. One AniList reports
 * as `STREAMING` but the catalogue does not know keeps the provider's own name
 * and a slug derived from it, because hiding a platform AniList explicitly
 * labelled as streaming would misreport availability.
 */

/** Known service ids, kept stable so the same brand is always the same value. */
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

/** Canonical brand spelling for each catalogue service. */
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

/**
 * Aliases seen in AniList `site` values, keyed by service id. Keys are compared
 * after {@link normalizeServiceKey}, so they are stored in that folded form.
 */
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

/** folded name -> service id, for O(1) resolution of an alias. */
const ALIAS_INDEX: ReadonlyMap<string, StreamingServiceId> = buildAliasIndex();

/** Where a title can be watched, as shown to the user. */
export interface StreamingLink {
  /** Catalogue id, or a slug derived from AniList's own service name. */
  readonly serviceId: string;
  readonly serviceName: string;
  /** Deep link to the title on that service, when AniList supplied one. */
  readonly url: string | null;
}

/** AniList `externalLinks` entry. */
export interface AniListExternalLinkDto {
  readonly site?: string | null;
  readonly url?: string | null;
  readonly type?: string | null;
}

/**
 * Folds a provider's service name into the catalogue. Returns `null` for
 * anything the catalogue does not know.
 */
export function resolveStreamingServiceId(value: string | null | undefined): StreamingServiceId | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return ALIAS_INDEX.get(normalizeServiceKey(trimmed)) ?? null;
}

/**
 * Normalizes AniList `externalLinks` into one entry per service.
 *
 * `type === STREAMING` is trusted, so official sites, MAL/AniList links and
 * social accounts are dropped and platforms outside the catalogue are kept. A
 * title deep link always wins over a bare service home page, and only absolute
 * http(s) links survive so the popup can never render a `javascript:` payload.
 */
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
      // Untyped and unknown: no way to tell a platform from an official site.
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

/** Provider payloads are untrusted: a non-string field is treated as absent. */
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