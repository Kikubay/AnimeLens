import type { Anime, AnimeProviderId } from './anime';

/**
 * Which provider a record came from, and the links that follow from it.
 *
 * Every deep link and provider-specific label is derived from the *record's* own
 * `provider` field rather than from the active provider, because an anime ID is
 * only meaningful within its own provider: MAL 52991 and AniList 52991 are
 * different titles. The active provider decides which records exist and which
 * provider an action targets; the record decides how it is labelled and linked.
 */

/** Provider assumed for a record with no `provider` field. */
export const DEFAULT_ENTRY_PROVIDER: AnimeProviderId = 'mal';

/**
 * A record's originating provider.
 *
 * `provider` is optional because data cached by a build predating the
 * multi-provider split has no such field. Those records only ever live in the
 * MAL cache (the legacy key it was migrated from belonged to MAL), so defaulting
 * to MAL reproduces their original meaning instead of guessing AniList.
 */
export function entryProviderId(anime: Pick<Anime, 'provider'>): AnimeProviderId {
  return anime.provider === 'anilist' ? 'anilist' : DEFAULT_ENTRY_PROVIDER;
}

export function isAniListEntry(anime: Pick<Anime, 'provider'>): boolean {
  return entryProviderId(anime) === 'anilist';
}

/** Brand name, for sentences such as "Added to your MAL list". */
export function entryProviderDisplayName(anime: Pick<Anime, 'provider'>): string {
  return entryProviderId(anime) === 'anilist' ? 'AniList' : 'MyAnimeList';
}

/** Public page for the title on its own provider. */
export function entryProviderUrl(anime: Pick<Anime, 'id' | 'provider'>): string {
  return entryProviderId(anime) === 'anilist'
    ? `https://anilist.co/anime/${anime.id}`
    : `https://myanimelist.net/anime/${anime.id}`;
}
