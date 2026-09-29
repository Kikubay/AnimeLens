import type { AnimeFormat, AnimeSeason, AnimeType } from './anime';

export interface UserProfile {
  /** The user's ID within their provider (formerly `malId`). */
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

export interface UserTasteProfileModel extends UserTasteProfile {
  readonly genreSignals: ReadonlyMap<string, PreferenceSignal>;
  readonly themeSignals: ReadonlyMap<string, PreferenceSignal>;
  readonly studioSignals: ReadonlyMap<string, PreferenceSignal>;
  readonly staffSignals: ReadonlyMap<string, PreferenceSignal>;
}
