import type { Anime, AnimeProviderId } from './anime';

// Labels and links follow the record's own provider, never the active one: MAL 52991 and AniList 52991 are different titles.

export const DEFAULT_ENTRY_PROVIDER: AnimeProviderId = 'mal';

export function entryProviderId(anime: Pick<Anime, 'provider'>): AnimeProviderId {
  // Pre-split records only ever land in the MAL cache, so MAL is the honest default.
  return anime.provider === 'anilist' ? 'anilist' : DEFAULT_ENTRY_PROVIDER;
}

export function isAniListEntry(anime: Pick<Anime, 'provider'>): boolean {
  return entryProviderId(anime) === 'anilist';
}

export function entryProviderDisplayName(anime: Pick<Anime, 'provider'>): string {
  return entryProviderId(anime) === 'anilist' ? 'AniList' : 'MyAnimeList';
}

export function entryProviderUrl(anime: Pick<Anime, 'id' | 'provider'>): string {
  return entryProviderId(anime) === 'anilist'
    ? `https://anilist.co/anime/${anime.id}`
    : `https://myanimelist.net/anime/${anime.id}`;
}