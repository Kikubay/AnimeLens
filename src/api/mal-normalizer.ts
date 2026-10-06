import type {
  Anime,
  AnimeAiringStatus,
  AnimeListEntry,
  AnimeSeason,
  AnimeStatus,
  AnimeType,
  Genre,
  StaffMember,
  Studio,
  Theme,
} from '../domain/anime';
import type { UserProfile } from '../domain/user-profile';
import type {
  MalAnimeDto,
  MalAnimeNodeDto,
  MalNamedResourceDto,
  MalStaffDto,
  MalUserDto,
} from './mal-types';
import { splitMalGenreArray } from './mal-taxonomy';

const ANIME_TYPES: readonly AnimeType[] = [
  'tv',
  'movie',
  'ova',
  'ona',
  'special',
  'music',
  'unknown',
];
const ANIME_SEASONS: readonly AnimeSeason[] = ['winter', 'spring', 'summer', 'fall'];
const AIRING_STATUSES: readonly AnimeAiringStatus[] = [
  'currently_airing',
  'finished_airing',
  'not_yet_aired',
  'unknown',
];
const LIST_STATUSES: readonly AnimeStatus[] = [
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'plan_to_watch',
  'rewatching',
];

export function isMalAnimeDto(value: unknown): value is MalAnimeDto {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'number' &&
    Number.isInteger(value.id) &&
    value.id > 0 &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0
  );
}

export function isMalAnimeNodeDto(value: unknown): value is MalAnimeNodeDto {
  return isRecord(value) && isMalAnimeDto(value.node);
}

export function isMalUserDto(value: unknown): value is MalUserDto {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'number' &&
    Number.isInteger(value.id) &&
    value.id > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0
  );
}

export function normalizeAnime(input: MalAnimeDto, userScore: number | null = null): Anime {
  // Splitting `genres` back apart is what lets themes feed their own profile signals.
  const genreSplit = splitMalGenreArray(input.genres);
  return {
    id: input.id,
    provider: 'mal',
    title: {
      default: input.title,
      english: input.alternative_titles?.en ?? null,
      japanese: input.alternative_titles?.ja ?? null,
      synonyms: input.alternative_titles?.synonyms ?? [],
    },
    synopsis: input.synopsis?.trim() || null,
    image: input.main_picture
      ? { medium: input.main_picture.medium ?? null, large: input.main_picture.large ?? null }
      : null,
    score: normalizeScore(input.mean),
    userScore: normalizeUserScore(userScore),
    genres: normalizeResources(genreSplit.genres),
    themes: normalizeResources(genreSplit.themes),
    studios: normalizeResources(input.studios),
    staff: normalizeStaff(input.staff),
    episodeCount: normalizeNonNegativeInteger(input.num_episodes),
    year: normalizeYear(input.start_season?.year ?? parseYear(input.start_date)),
    season: normalizeSeason(input.start_season?.season),
    status: normalizeAiringStatus(input.status),
    type: normalizeAnimeType(input.media_type),
    popularity: normalizeNonNegativeInteger(input.popularity),
    memberCount: normalizeNonNegativeInteger(input.num_list_users),
    contentRating: normalizeContentRating(input.rating),
  };
}

export function normalizeAnimeListEntry(input: MalAnimeNodeDto): AnimeListEntry {
  const listStatus = input.list_status;
  return {
    anime: normalizeAnime(input.node, listStatus?.score ?? null),
    status: normalizeListStatus(listStatus?.status),
    userScore: normalizeUserScore(listStatus?.score),
    episodesWatched: normalizeNonNegativeInteger(listStatus?.num_episodes_watched) ?? 0,
    priority: normalizeNonNegativeInteger(listStatus?.priority),
    isRewatching: listStatus?.is_rewatching ?? false,
    updatedAt: listStatus?.updated_at ?? null,
    notes: listStatus?.comments?.trim() || null,
  };
}

export function normalizeUserProfile(input: MalUserDto): UserProfile {
  return {
    id: input.id,
    username: input.name,
    avatarUrl: input.picture ?? null,
    joinedAt: input.joined_at ?? null,
    location: input.location ?? null,
    timeZone: input.time_zone ?? null,
  };
}

function normalizeResources(
  resources: readonly MalNamedResourceDto[] | undefined,
): readonly (Genre | Theme | Studio)[] {
  return (resources ?? []).map((resource) => ({ id: resource.id, name: resource.name }));
}

function normalizeStaff(resources: readonly MalStaffDto[] | undefined): readonly StaffMember[] {
  return (resources ?? []).map((resource) => ({
    id: resource.person.id,
    name: resource.person.name,
    positions: resource.positions ?? [],
    imageUrl: resource.person.images?.jpg?.image_url ?? null,
  }));
}

function normalizeContentRating(value: string | undefined): Anime['contentRating'] {
  if (value === 'rx') return 'explicit';
  if (value === 'r' || value === 'pg-13') return 'questionable';
  return 'safe';
}

function normalizeScore(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
    ? value
    : null;
}

// MAL sends `score: 0` to mean "not rated", and only 1-10 counts as a real rating.
function normalizeUserScore(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && value >= 1 ? normalizeScore(value) : null;
}

function normalizeNonNegativeInteger(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeYear(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 ? value : null;
}

function parseYear(value: string | undefined): number | undefined {
  const year = value?.slice(0, 4);
  return year !== undefined && /^\d{4}$/.test(year) ? Number(year) : undefined;
}

function normalizeSeason(value: string | undefined): AnimeSeason | null {
  return isOneOf(ANIME_SEASONS, value) ? value : null;
}

function normalizeAnimeType(value: string | undefined): AnimeType {
  return isOneOf(ANIME_TYPES, value) ? value : 'unknown';
}

function normalizeAiringStatus(value: string | undefined): AnimeAiringStatus {
  return isOneOf(AIRING_STATUSES, value) ? value : 'unknown';
}

function normalizeListStatus(value: string | undefined): AnimeStatus {
  return isOneOf(LIST_STATUSES, value) ? value : 'plan_to_watch';
}

function isOneOf<const T extends readonly string[]>(
  values: T,
  value: string | undefined,
): value is T[number] {
  return value !== undefined && values.includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
