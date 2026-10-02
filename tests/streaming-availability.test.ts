import { describe, expect, it } from 'vitest';
import {
  normalizeStreamingSites,
  resolveStreamingServiceId,
  STREAMING_SERVICE_IDS,
} from '../src/domain/streaming';
import { ANIME_MEDIA_FRAGMENT } from '../src/api/providers/anilist/anilist-queries';
import {
  normalizeAnime as normalizeAniListAnime,
} from '../src/api/providers/anilist/anilist-normalizer';
import type { AniListMediaDto } from '../src/api/providers/anilist/anilist-normalizer';
import { isStreamingLinksMessage } from '../src/api/streaming-links-messages';
import { parseMalStreamingPlatforms } from '../src/api/providers/mal/mal-streaming';
import { MAL_FIELDS } from '../src/api/providers/mal/mal-config';
import { createAnimeCache, isAnimeCache } from '../src/sync/sync-cache';
import type { Anime } from '../src/domain/anime';

const crunchyroll = {
  serviceId: 'crunchyroll',
  serviceName: 'Crunchyroll',
  url: null,
};

describe('resolveStreamingServiceId', () => {
  it('resolves free-text brand names to one stable id', () => {
    expect(resolveStreamingServiceId('Crunchyroll')).toBe('crunchyroll');
    expect(resolveStreamingServiceId('Netflix')).toBe('netflix');
    expect(resolveStreamingServiceId('Amazon Prime Video')).toBe('amazon-prime-video');
    expect(resolveStreamingServiceId('AMAZON PRIME')).toBe('amazon-prime-video');
    expect(resolveStreamingServiceId('DISNEY PLUS')).toBe('disney-plus');
    expect(resolveStreamingServiceId('HBO Max')).toBe('max');
    expect(resolveStreamingServiceId('HIDIVE')).toBe('hidive');
    expect(resolveStreamingServiceId('Bilibili TV')).toBe('bilibili');
  });

  it('rejects anything that is not a streaming platform', () => {
    for (const value of ['MAL', 'AniList', 'Official Site', 'Wikipedia', 'Twitter', '!!!', '']) {
      expect(resolveStreamingServiceId(value), value).toBeNull();
    }
    expect(resolveStreamingServiceId(null)).toBeNull();
    expect(resolveStreamingServiceId(undefined)).toBeNull();
  });

  it('resolves every catalogue id by its own slug', () => {
    expect(STREAMING_SERVICE_IDS.every((id) => resolveStreamingServiceId(id) === id)).toBe(true);
  });
});

describe('normalizeStreamingSites', () => {
  it('keeps only STREAMING entries and drops info and social links', () => {
    expect(
      normalizeStreamingSites([
        { site: 'Netflix', url: 'https://www.netflix.com/title/2', type: 'STREAMING' },
        { site: 'HIDIVE', url: null, type: 'STREAMING' },
        { site: 'MAL', url: 'https://myanimelist.net/anime/2', type: 'INFO' },
        { site: 'Official Site', url: 'https://official.example/', type: 'INFO' },
        { site: 'Twitter', url: 'https://twitter.com/anime', type: 'SOCIAL' },
        { site: null, url: 'https://example.test/', type: 'STREAMING' },
      ]),
    ).toEqual([
      { serviceId: 'netflix', serviceName: 'Netflix', url: 'https://www.netflix.com/title/2' },
      { serviceId: 'hidive', serviceName: 'HIDIVE', url: null },
    ]);
  });

  it('keeps a streaming platform the catalogue does not know', () => {
    expect(
      normalizeStreamingSites([
        { site: 'Adult Swim', url: 'https://www.adultswim.com/videos/x', type: 'STREAMING' },
      ]),
    ).toEqual([
      {
        serviceId: 'adultswim',
        serviceName: 'Adult Swim',
        url: 'https://www.adultswim.com/videos/x',
      },
    ]);
  });

  it('accepts an untyped link only when it names a known platform', () => {
    expect(normalizeStreamingSites([{ site: 'Crunchyroll', url: null }])).toEqual([crunchyroll]);
    expect(normalizeStreamingSites([{ site: 'Adult Swim', url: null }])).toEqual([]);
  });

  it('prefers a title deep link over a bare service page', () => {
    expect(
      normalizeStreamingSites([
        { site: 'Crunchyroll', url: null, type: 'STREAMING' },
        { site: 'Crunchyroll', url: 'https://www.crunchyroll.com/watch/1', type: 'STREAMING' },
      ]),
    ).toEqual([
      {
        serviceId: 'crunchyroll',
        serviceName: 'Crunchyroll',
        url: 'https://www.crunchyroll.com/watch/1',
      },
    ]);
  });

  it('never renders an unusable url', () => {
    expect(
      normalizeStreamingSites([
        { site: 'Crunchyroll', url: 'javascript:alert(1)', type: 'STREAMING' },
        { site: 'Netflix', url: '   ', type: 'STREAMING' },
      ]),
    ).toEqual([
      { serviceId: 'crunchyroll', serviceName: 'Crunchyroll', url: null },
      { serviceId: 'netflix', serviceName: 'Netflix', url: null },
    ]);
  });

  it('never throws on a malformed payload', () => {
    expect(normalizeStreamingSites(null)).toEqual([]);
    expect(normalizeStreamingSites(undefined)).toEqual([]);
    expect(normalizeStreamingSites([null as never, 3 as never])).toEqual([]);
  });
});

describe('AniList integration', () => {
  it('requests externalLinks, the spelling the API accepts', () => {
    // Wrong spelling 400s every query this fragment is embedded in.
    expect(ANIME_MEDIA_FRAGMENT).toContain('externalLinks { site url type }');
    expect(ANIME_MEDIA_FRAGMENT).not.toContain('externalSites');
  });

  it('requests no MAL field that does not exist', () => {
    expect(MAL_FIELDS.split(',')).not.toContain('external');
  });

  it('normalizes a detail payload into streaming sites', () => {
    const anime = normalizeAniListAnime({
      id: 16498,
      title: { romaji: 'Shingeki no Kyojin' },
      externalLinks: [
        { site: 'Crunchyroll', url: 'http://www.crunchyroll.com/attack-on-titan', type: 'STREAMING' },
        { site: 'Official Site', url: 'http://shingeki.tv/', type: 'INFO' },
        { site: 'Adult Swim', url: 'https://www.adultswim.com/videos/aot', type: 'STREAMING' },
      ],
    } satisfies AniListMediaDto);

    expect(anime.streamingSites).toEqual([
      {
        serviceId: 'crunchyroll',
        serviceName: 'Crunchyroll',
        url: 'http://www.crunchyroll.com/attack-on-titan',
      },
      {
        serviceId: 'adultswim',
        serviceName: 'Adult Swim',
        url: 'https://www.adultswim.com/videos/aot',
      },
    ]);
  });

  it('reports no streaming sites when AniList omits externalLinks', () => {
    expect(
      normalizeAniListAnime({ id: 3, title: { romaji: 'No sites' } } satisfies AniListMediaDto)
        .streamingSites,
    ).toEqual([]);
  });
});

describe('MAL streaming platforms', () => {
  // Trimmed from myanimelist.net/anime/52991. The Resources section and the
  // trailing heading are both there to prove neither leaks into the card.
  const MAL_PAGE = `<!DOCTYPE html><html><body>
<div class="js-scrollfix-bottom-rel">
  <h2>Resources</h2>
  <div class="flr-sns">
    <a href="https://en.wikipedia.org/wiki/Frieren" target="_blank" class="link ga-click"
       data-ga-click-type="external-links-anime-pc-wikipedia">
      <img src="/img/common/external_links/71.png" class="link_icon" alt="icon">
      <div class="caption">Wikipedia</div>
    </a>
    <a href="https://cal.syoboi.jp/tid/6776" target="_blank" class="link ga-click">
      <div class="caption">Syoboi</div>
    </a>
  </div>
</div>
<br />
<h2>Streaming Platforms</h2>
<div class="pb16 broadcasts">
  <div class="broadcast">
    <a href="http://www.crunchyroll.com/series-283731" target="_blank" title="Crunchyroll"
       class="broadcast-item available ga-click" data-available="1"
       data-ga-click-type="broadcast-title-streaming-platforms"
       data-ga-click-param="aid:52991">
      <i class="spicon spicon-crunchyroll"></i><div class="caption">Crunchyroll</div>
    </a>
    <a href="https://www.netflix.com/title/81560201" target="_blank" title="Netflix"
       class="broadcast-item available ga-click" data-available="1">
      <i class="spicon spicon-netflix"></i><div class="caption">Netflix</div>
    </a>
    <a href="https://www.amazon.com/gp/video/detail/B0BCR7QFXH" target="_blank" title="Amazon Prime Video"
       class="broadcast-item unavailable ga-click" data-available="0">
      <i class="spicon spicon-amazon"></i><div class="caption">Amazon Prime Video</div>
    </a>
    <a href="https://example.test/muse" target="_blank" title="Muse Asia"
       class="broadcast-item available ga-click" data-available="1">
      <div class="caption">Muse Asia</div>
    </a>
  </div>
</div>
<h2>More</h2>
<a href="https://example.test/not-a-platform" class="broadcast-item available" data-available="1"
   title="Should Not Appear">x</a>
</body></html>`;

  it('reads the platforms out of the streaming section only', () => {
    expect(parseMalStreamingPlatforms(MAL_PAGE)).toEqual([
      {
        serviceId: 'crunchyroll',
        serviceName: 'Crunchyroll',
        url: 'http://www.crunchyroll.com/series-283731',
      },
      {
        serviceId: 'netflix',
        serviceName: 'Netflix',
        url: 'https://www.netflix.com/title/81560201',
      },
      { serviceId: 'museasia', serviceName: 'Muse Asia', url: 'https://example.test/muse' },
    ]);
  });

  it('skips platforms MAL marks as unavailable', () => {
    const names = parseMalStreamingPlatforms(MAL_PAGE).map((link) => link.serviceName);
    expect(names).not.toContain('Amazon Prime Video');
  });

  it('never leaks the Resources section into the card', () => {
    const names = parseMalStreamingPlatforms(MAL_PAGE).map((link) => link.serviceName);
    expect(names).not.toContain('Wikipedia');
    expect(names).not.toContain('Syoboi');
    expect(names).not.toContain('Should Not Appear');
  });

  it('falls back to the visible caption when title is missing', () => {
    expect(
      parseMalStreamingPlatforms(
        '<h2>Streaming Platforms</h2><a href="https://x.test/1" class="broadcast-item available">' +
          '<div class="caption">HIDIVE</div></a>',
      ),
    ).toEqual([{ serviceId: 'hidive', serviceName: 'HIDIVE', url: 'https://x.test/1' }]);
  });

  it('returns nothing when the page has no streaming section', () => {
    expect(parseMalStreamingPlatforms('<html><body><h2>Synopsis</h2></body></html>')).toEqual([]);
    expect(parseMalStreamingPlatforms('')).toEqual([]);
  });

  it('never throws on malformed markup', () => {
    expect(parseMalStreamingPlatforms('<h2>Streaming Platforms</h2><a href=')).toEqual([]);
  });
});

describe('streaming links message', () => {
  it('accepts only a positive integer anime id', () => {
    expect(isStreamingLinksMessage({ type: 'anime.get_streaming_links', animeId: 16498 })).toBe(
      true,
    );
    for (const invalid of [
      { type: 'anime.get_streaming_links', animeId: 0 },
      { type: 'anime.get_streaming_links', animeId: -1 },
      { type: 'anime.get_streaming_links', animeId: 1.5 },
      { type: 'anime.get_streaming_links', animeId: '16498' },
      { type: 'anime.get_streaming_links' },
      { type: 'mal.list.add', animeId: 1 },
      null,
      undefined,
      'anime.get_streaming_links',
    ]) {
      expect(isStreamingLinksMessage(invalid), JSON.stringify(invalid ?? null)).toBe(false);
    }
  });
});

describe('cache round-trip', () => {
  const base: Anime = {
    id: 1,
    title: { default: 'Cached', english: null, japanese: null, synonyms: [] },
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
  };

  function cacheOf(anime: Anime): unknown {
    return createAnimeCache([
      {
        anime,
        status: 'completed',
        userScore: 8,
        episodesWatched: 12,
        priority: null,
        isRewatching: false,
        updatedAt: null,
        notes: null,
      },
    ]);
  }

  it('accepts an entry with streaming links', () => {
    expect(isAnimeCache(cacheOf({ ...base, streamingSites: [crunchyroll] }))).toBe(true);
  });

  it('still accepts an entry cached before the field existed', () => {
    expect(isAnimeCache(cacheOf(base))).toBe(true);
    expect(isAnimeCache(cacheOf({ ...base, streamingSites: [] }))).toBe(true);
  });

  it('rejects malformed streaming links', () => {
    expect(
      isAnimeCache(cacheOf({ ...base, streamingSites: [{ serviceName: 'Netflix' }] as never })),
    ).toBe(false);
  });
});