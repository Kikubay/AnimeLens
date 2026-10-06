import type { AnimeListEntry } from '../domain/anime';

export interface MalPaging {
  readonly previous?: string;
  readonly next?: string;
}

export interface MalListResponse<T> {
  readonly data: readonly T[];
  readonly paging?: MalPaging;
}

export interface MalPictureDto {
  readonly medium?: string;
  readonly large?: string;
}

export interface MalNamedResourceDto {
  readonly id: number;
  readonly name: string;
}

export interface MalStaffDto {
  readonly person: {
    readonly id: number;
    readonly name: string;
    readonly images?: { readonly jpg?: { readonly image_url?: string } };
  };
  readonly positions?: readonly string[];
}

export interface MalAnimeDto {
  readonly id: number;
  readonly title: string;
  readonly main_picture?: MalPictureDto;
  readonly alternative_titles?: {
    readonly synonyms?: readonly string[];
    readonly en?: string;
    readonly ja?: string;
  };
  readonly synopsis?: string;
  readonly mean?: number;
  readonly rank?: number;
  readonly popularity?: number;
  readonly num_list_users?: number;
  readonly num_episodes?: number;
  readonly start_date?: string;
  readonly start_season?: { readonly year?: number; readonly season?: string };
  readonly media_type?: string;
  readonly status?: string;
  readonly rating?: string;
  // Genres, themes and demographics all arrive mixed together; the normalizer splits them apart.
  readonly genres?: readonly MalNamedResourceDto[];
  readonly studios?: readonly MalNamedResourceDto[];
  readonly staff?: readonly MalStaffDto[];
}

export interface MalListStatusDto {
  readonly status?: string;
  readonly score?: number;
  readonly num_episodes_watched?: number;
  readonly priority?: number;
  readonly is_rewatching?: boolean;
  readonly updated_at?: string;
  readonly comments?: string;
}

export interface MalAnimeNodeDto {
  readonly node: MalAnimeDto;
  readonly list_status?: MalListStatusDto;
}

export interface MalUserDto {
  readonly id: number;
  readonly name: string;
  readonly picture?: string;
  readonly joined_at?: string;
  readonly location?: string;
  readonly time_zone?: string;
}

export type MalAnimeListResponse = MalListResponse<MalAnimeNodeDto>;
export type MalAnimeDetailsResponse = MalAnimeDto;
export type MalUserResponse = MalUserDto;

export type AnimeListMapper = (entry: MalAnimeNodeDto) => AnimeListEntry;
