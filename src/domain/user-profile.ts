import type { AnimeFormat, AnimeSeason, AnimeType } from './anime';

export interface UserProfile {
  /** ID within their provider (used to be `malId`). */
  readonly id: number;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly joinedAt: string | null;
  readonly location: string | null;
  readonly timeZone: string | null;
}

export interface PreferenceSignal {
  readonly positive: number;
  readonly negative: number;
  readonly count: number;
}

export interface UserTasteProfile {
  readonly preferredGenres: ReadonlyMap<string, number>;
  readonly preferredFormats: ReadonlyMap<AnimeFormat, number>;
  readonly preferredThemes?: ReadonlyMap<string, PreferenceSignal>;
  readonly preferredStudios?: ReadonlyMap<string, PreferenceSignal>;
  readonly preferredStaff?: ReadonlyMap<string, PreferenceSignal>;
  readonly preferredTypes?: ReadonlyMap<AnimeType, PreferenceSignal>;
  readonly preferredSeasons?: ReadonlyMap<AnimeSeason, PreferenceSignal>;
  readonly averageScore: number;
  readonly ratedAnimeCount: number;
  readonly sourceAnimeCount?: number;
}
