import type { Anime, AnimeProviderId } from './anime';

/**
 * Which provider a record came from, and the links that follow from it.
 *
 * Labels and deep links come from the record's own `provider`, never from the
 * active provider: MAL 52991 and AniList 52991 are different titles, so an ID
 * only means anything inside its own provider. The active provider decides
 * which records exist and where an action is sent; the record decides how it is
 * labelled and linked.
 */

export const DEFAULT_ENTRY_PROVIDER: AnimeProviderId = 'mal';

export function entryProviderId(anime: Pick<Anime, 'provider'>): AnimeProviderId {
  // Records cached before the multi-provider split have no `provider`. Those only
  // ever land in the MAL cache — the legacy key they were migrated from belonged
  // to MAL — so defaulting to MAL keeps their original meaning instead of
  // guessing.
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