import type {
  Anime,
  AnimeAiringStatus,
  AnimeListEntry,
  AnimeSeason,
  AnimeStatus,
  AnimeType,
  StaffMember,
} from '../../../domain/anime';
import type { UserProfile } from '../../../domain/user-profile';
import { normalizeStreamingSites } from '../../../domain/streaming';

// The DTOs are trimmed to what we consume, and normalization degrades a malformed field to `null` rather than failing a whole sync.

export interface AniListTitleDto {
  readonly romaji?: string | null;
  readonly english?: string | null;
  readonly native?: string | null;
}

export interface AniListStudioNodeDto {
  readonly id: number;
  readonly name: string;
}

export interface AniListTagDto {
  readonly id: number;
  readonly name: string;
  readonly rank?: number | null;
}

export interface AniListStaffEdgeDto {
  readonly role?: string | null;
  readonly node?: {
    readonly id: number;
    readonly name?: { readonly full?: string | null } | null;
    readonly image?: { readonly large?: string | null } | null;
  } | null;
}

// Trust `type`, not `site`: only `STREAMING` is watchable, and `site` is a display name rather than an enum.
export interface AniListExternalLinkDto {
  readonly site?: string | null;
  readonly url?: string | null;
  readonly type?: string | null;
}

export interface AniListMediaDto {
  readonly id: number;
  readonly title?: AniListTitleDto | null;
  readonly description?: string | null;
  readonly coverImage?: { readonly medium?: string | null; readonly large?: string | null } | null;
  readonly averageScore?: number | null;
  readonly genres?: readonly string[] | null;
  readonly tags?: readonly AniListTagDto[] | null;
  readonly format?: string | null;
  readonly episodes?: number | null;
  readonly season?: string | null;
  readonly seasonYear?: number | null;
  readonly status?: string | null;
  /** A list-member count despite the name, matching MAL's `num_list_users`. */
  readonly popularity?: number | null;
  readonly isAdult?: boolean | null;
  readonly externalLinks?: readonly AniListExternalLinkDto[] | null;
  readonly studios?: { readonly nodes?: readonly AniListStudioNodeDto[] | null } | null;
  readonly staff?: { readonly edges?: readonly AniListStaffEdgeDto[] | null } | null;
}

export interface AniListListEntryDto {
  readonly id: number;
  readonly status?: string | null;
  readonly score?: number | null;
  readonly progress?: number | null;
  readonly priority?: number | null;
  readonly repeat?: number | null;
  readonly updatedAt?: number | null;
  readonly notes?: string | null;
  readonly media?: AniListMediaDto | null;
}

export interface AniListViewerDto {
  readonly id: number;
  readonly name: string;
  readonly avatar?: { readonly large?: string | null } | null;
  readonly createdAt?: number | null;
}

const FORMAT_MAP: Readonly<Record<string, AnimeType>> = {
  TV: 'tv',
  TV_SHORT: 'tv',
  MOVIE: 'movie',
  SPECIAL: 'special',
  OVA: 'ova',
  ONA: 'ona',
  MUSIC: 'music',
};

const SEASON_MAP: Readonly<Record<string, AnimeSeason>> = {
  WINTER: 'winter',
  SPRING: 'spring',
  SUMMER: 'summer',
  FALL: 'fall',
};

const AIRING_STATUS_MAP: Readonly<Record<string, AnimeAiringStatus>> = {
  RELEASING: 'currently_airing',
  FINISHED: 'finished_airing',
  NOT_YET_RELEASED: 'not_yet_aired',
  CANCELLED: 'unknown',
  HIATUS: 'unknown',
};

const LIST_STATUS_MAP: Readonly<Record<string, AnimeStatus>> = {
  CURRENT: 'watching',
  PLANNING: 'plan_to_watch',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  PAUSED: 'on_hold',
  REPEATING: 'rewatching',
};

export function toMediaListStatus(status: AnimeStatus): string | null {
  switch (status) {
    case 'watching':
      return 'CURRENT';
    case 'completed':
      return 'COMPLETED';
    case 'on_hold':
      return 'PAUSED';
    case 'dropped':
      return 'DROPPED';
    case 'plan_to_watch':
      return 'PLANNING';
    case 'rewatching':
      return 'REPEATING';
    default:
      return null;
  }
}

// Lower-ranked tags are noise for a taste profile.
const TAG_MIN_RANK = 20;

export function normalizeAnime(input: AniListMediaDto): Anime {
  const title = input.title ?? {};
  return {
    id: input.id,
    provider: 'anilist',
    title: {
      // AniList has no canonical title, so fall back romaji → english → native.
      default: title.romaji ?? title.english ?? title.native ?? `Anime ${input.id}`,
      english: title.english ?? null,
      japanese: title.native ?? null,
      synonyms: [],
    },
    synopsis: stripHtml(input.description),
    image: input.coverImage
      ? { medium: input.coverImage.medium ?? null, large: input.coverImage.large ?? null }
      : null,
    score: normalizeScore(input.averageScore),
    userScore: null,
    genres: (input.genres ?? []).map((name) => ({ id: genreId(name), name })),
    themes: (input.tags ?? [])
      .filter((tag) => (tag.rank ?? 100) >= TAG_MIN_RANK)
      .map((tag) => ({ id: tag.id, name: tag.name })),
    studios: (input.studios?.nodes ?? []).map((studio) => ({ id: studio.id, name: studio.name })),
    staff: normalizeStaff(input.staff?.edges),
    episodeCount: normalizeNonNegativeInteger(input.episodes),
    year: normalizeYear(input.seasonYear),
    season: normalizeSeason(input.season),
    status: normalizeAiringStatus(input.status),
    type: normalizeAnimeType(input.format),
    // AniList publishes no popularity rank — the field it calls `popularity` is really a list-member count like MAL's `num_list_users`, so it has to land in `memberCount`; reading it as a rank zeroed the popularity score and flagged nearly the whole catalogue as obscure, which emptied Highly Compatible.
    memberCount: normalizeNonNegativeInteger(input.popularity),
    popularity: null,
    contentRating: input.isAdult === true ? 'explicit' : 'safe',
    streamingSites: normalizeStreamingSites(input.externalLinks),
  };
}

export function normalizeAnimeListEntry(input: AniListListEntryDto): AnimeListEntry {
  const status = normalizeListStatus(input.status);
  return {
    anime: normalizeAnime(input.media ?? { id: input.id }),
    status,
    userScore: normalizeUserScore(input.score),
    episodesWatched: normalizeNonNegativeInteger(input.progress) ?? 0,
    priority: normalizeNonNegativeInteger(input.priority),
    isRewatching: status === 'rewatching' || (input.repeat ?? 0) > 0,
    updatedAt: toIsoTimestamp(input.updatedAt),
    notes: input.notes?.trim() || null,
  };
}

export function normalizeUserProfile(input: AniListViewerDto): UserProfile {
  return {
    id: input.id,
    username: input.name,
    avatarUrl: input.avatar?.large ?? null,
    joinedAt: toIsoTimestamp(input.createdAt),
    location: null,
    timeZone: null,
  };
}

function normalizeStaff(edges: readonly AniListStaffEdgeDto[] | null | undefined): StaffMember[] {
  return (edges ?? [])
    .filter(
      (edge): edge is AniListStaffEdgeDto & { node: NonNullable<AniListStaffEdgeDto['node']> } =>
        Boolean(edge?.node),
    )
    .map((edge) => ({
      id: edge.node.id,
      name: edge.node.name?.full ?? `Staff ${edge.node.id}`,
      positions: edge.role !== null && edge.role !== undefined ? [edge.role] : [],
      imageUrl: edge.node.image?.large ?? null,
    }));
}

function stripHtml(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;/g, "'")
    .trim();
  return text.length > 0 ? text : null;
}

// Genre names carry no stable ID, so a hash satisfies the domain's numeric `id` without a cross-provider mapping table.
export function genreId(name: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const positive = hash >>> 0;
  return positive === 0 ? 1 : positive;
}

function normalizeScore(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  // AniList reports 0-100, the domain works in 0-10.
  const scaled = Math.round(value) / 10;
  return scaled >= 0 && scaled <= 10 ? scaled : null;
}

function normalizeUserScore(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  // POINT_100, where 0 means the user never rated it.
  const scaled = value / 10;
  return scaled >= 0 && scaled <= 10 ? scaled : null;
}

function normalizeNonNegativeInteger(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeYear(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 ? value : null;
}

function normalizeSeason(value: string | null | undefined): AnimeSeason | null {
  return value !== undefined && value !== null && value in SEASON_MAP ? SEASON_MAP[value] : null;
}

function normalizeAnimeType(value: string | null | undefined): AnimeType {
  return value !== undefined && value !== null && value in FORMAT_MAP
    ? FORMAT_MAP[value]
    : 'unknown';
}

function normalizeAiringStatus(value: string | null | undefined): AnimeAiringStatus {
  return value !== undefined && value !== null && value in AIRING_STATUS_MAP
    ? AIRING_STATUS_MAP[value]
    : 'unknown';
}

function normalizeListStatus(value: string | null | undefined): AnimeStatus {
  return value !== undefined && value !== null && value in LIST_STATUS_MAP
    ? LIST_STATUS_MAP[value]
    : 'plan_to_watch';
}

function toIsoTimestamp(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  // AniList timestamps are in seconds.
  return new Date(value * 1000).toISOString();
}

// Runtime guards for untrusted payloads.

export function isAniListMedia(value: unknown): value is AniListMediaDto {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'number' &&
    Number.isInteger(candidate.id) &&
    candidate.id > 0 &&
    (candidate.title === undefined ||
      candidate.title === null ||
      (typeof candidate.title === 'object' && candidate.title !== null))
  );
}

export function isAniListViewerResponse(
  value: unknown,
): value is { readonly Viewer: AniListViewerDto } {
  if (typeof value !== 'object' || value === null) return false;
  const viewer = (value as Record<string, unknown>).Viewer;
  if (typeof viewer !== 'object' || viewer === null) return false;
  const candidate = viewer as Record<string, unknown>;
  return (
    typeof candidate.id === 'number' &&
    Number.isInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.name === 'string' &&
    candidate.name.length > 0
  );
}

export function isAniListListResponse(value: unknown): value is {
  readonly MediaListCollection: {
    readonly lists: readonly {
      readonly entries: readonly AniListListEntryDto[];
    }[];
  };
} {
  if (typeof value !== 'object' || value === null) return false;
  const collection = (value as Record<string, unknown>).MediaListCollection;
  if (typeof collection !== 'object' || collection === null) return false;
  const lists = (collection as Record<string, unknown>).lists;
  return Array.isArray(lists);
}

export function isAniListPageResponse(
  value: unknown,
): value is { readonly Page: { readonly media: readonly unknown[] } } {
  if (typeof value !== 'object' || value === null) return false;
  const page = (value as Record<string, unknown>).Page;
  if (typeof page !== 'object' || page === null) return false;
  return Array.isArray((page as Record<string, unknown>).media);
}
