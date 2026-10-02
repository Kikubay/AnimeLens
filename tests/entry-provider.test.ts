import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENTRY_PROVIDER,
  entryProviderDisplayName,
  entryProviderId,
  entryProviderUrl,
  isAniListEntry,
} from '../src/domain/entry-provider';
import { normalizeAnime as normalizeMalAnime } from '../src/api/mal-normalizer';
import { normalizeAnime as normalizeAniListAnime } from '../src/api/providers/anilist/anilist-normalizer';
import type { Anime } from '../src/domain/anime';

function record(overrides: Partial<Anime> = {}): Anime {
  return {
    id: 1,
    title: { default: 'Title', english: null, japanese: null, synonyms: [] },
    synopsis: null,
    image: null,
    score: 8,
    userScore: null,
    genres: [],
    themes: [],
    studios: [],
    staff: [],
    episodeCount: 12,
    year: 2024,
    season: 'spring',
    status: 'finished_airing',
    type: 'tv',
    popularity: 1,
    memberCount: 100,
    ...overrides,
  };
}

describe('entry provider', () => {
  it('resolves a MAL record to MAL', () => {
    const anime = record({ id: 52991, provider: 'mal' });

    expect(entryProviderId(anime)).toBe('mal');
    expect(isAniListEntry(anime)).toBe(false);
    expect(entryProviderDisplayName(anime)).toBe('MyAnimeList');
    expect(entryProviderUrl(anime)).toBe('https://myanimelist.net/anime/52991');
  });

  it('resolves an AniList record to AniList', () => {
    const anime = record({ id: 154587, provider: 'anilist' });

    expect(entryProviderId(anime)).toBe('anilist');
    expect(isAniListEntry(anime)).toBe(true);
    expect(entryProviderDisplayName(anime)).toBe('AniList');
    expect(entryProviderUrl(anime)).toBe('https://anilist.co/anime/154587');
  });

  it('keeps each provider on its own URL host, so IDs never cross over', () => {
    const sharedId = 52991;
    expect(entryProviderUrl(record({ id: sharedId, provider: 'mal' }))).toContain(
      'myanimelist.net',
    );
    expect(entryProviderUrl(record({ id: sharedId, provider: 'anilist' }))).toContain('anilist.co');
  });

  it('falls back to MAL for a record cached before the field existed', () => {
    const legacy = record({ id: 21 });
    expect(legacy.provider).toBeUndefined();
    expect(DEFAULT_ENTRY_PROVIDER).toBe('mal');
    expect(entryProviderId(legacy)).toBe('mal');
    expect(entryProviderUrl(legacy)).toBe('https://myanimelist.net/anime/21');
  });

  it('ignores an unrecognised provider value', () => {
    expect(entryProviderId(record({ provider: 'kitsu' as never }))).toBe('mal');
  });
});

describe('provider switching, end to end', () => {
  it('labels and links each normalizer output on its own provider', () => {
    const mal = normalizeMalAnime({ id: 52991, title: 'Sousou no Frieren' });
    const anilist = normalizeAniListAnime({ id: 154587, title: { romaji: 'Sousou no Frieren' } });

    expect(entryProviderDisplayName(mal)).toBe('MyAnimeList');
    expect(entryProviderUrl(mal)).toBe('https://myanimelist.net/anime/52991');
    expect(entryProviderDisplayName(anilist)).toBe('AniList');
    expect(entryProviderUrl(anilist)).toBe('https://anilist.co/anime/154587');
  });

  it('keeps the two providers distinct even for the same title', () => {
    const mal = normalizeMalAnime({ id: 5114, title: 'Hagane no Renkinjutsushi' });
    const anilist = normalizeAniListAnime({ id: 16498, title: { romaji: 'Shingeki no Kyojin' } });

    expect(entryProviderUrl(mal)).toBe('https://myanimelist.net/anime/5114');
    expect(entryProviderUrl(anilist)).toBe('https://anilist.co/anime/16498');
  });
});
