// AniList is the only provider publishing this, and every link carries a `type`, which is how `STREAMING` separates from the `INFO`/`SOCIAL` noise (MAL has no equivalent field). Catalogue ids stay stable because they end up in stored preferences and link comparisons — renaming one silently drops the user's selection.

// An unknown streaming service keeps its own name rather than being dropped, otherwise a watchable title reads as unwatched.
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

// Already folded to what `normalizeServiceKey` produces: no spaces, no punctuation.
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
  /** Catalogue id, or a slug of AniList's own name for an unknown service. */
  readonly serviceId: string;
  readonly serviceName: string;
  readonly url: string | null;
}

export interface AniListExternalLinkDto {
  readonly site?: string | null;
  readonly url?: string | null;
  readonly type?: string | null;
}

export function resolveStreamingServiceId(
  value: string | null | undefined,
): StreamingServiceId | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return ALIAS_INDEX.get(normalizeServiceKey(trimmed)) ?? null;
}

// Without a `type` we only trust names we'd recognise anyway, and only http(s) URLs get through, so a `javascript:` payload can't reach an anchor.
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
      // Untyped and unrecognised: can't tell a platform from an official site.
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
  return normalizeServiceKey(value)
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
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
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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
