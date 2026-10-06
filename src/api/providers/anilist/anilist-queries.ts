export const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
export const ANILIST_AUTHORIZATION_URL = 'https://anilist.co/api/v2/oauth/authorize';

// `launchWebAuthFlow` can't finish AniList's implicit flow (the fragment redirect fails), so connect opens the authorize page in a normal tab and the user pastes the token this page shows. Must be registered as the app's Redirect URL.
export const ANILIST_PIN_REDIRECT_URL = 'https://anilist.co/api/v2/oauth/pin';

export function buildAnilistPinAuthorizeUrl(clientId: string): string {
  const url = new URL(ANILIST_AUTHORIZATION_URL);
  // Only these two params — adding `redirect_uri` makes AniList reject the request with `unsupported_grant_type`.
  url.search = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
  }).toString();
  return url.toString();
}

/** Prefix of the pin-page redirect URL carrying the token in its fragment. */
const ANILIST_PIN_TAB_URL_PREFIX = 'https://anilist.co/api/v2/oauth/pin#access_token=';

// Chrome match patterns ignore fragments, so the token in `#access_token=…` can only be spotted by inspecting the full URL.
export function isAniListPinTabUrl(url: string): boolean {
  return (
    url.startsWith(ANILIST_PIN_TAB_URL_PREFIX) && url.length > ANILIST_PIN_TAB_URL_PREFIX.length
  );
}

// Accepts a raw token or the whole pin-page URL, since that's what people copy out of the address bar.
export function extractAccessToken(input: string): string {
  const match = /[#&?]access_token=([^&\s]+)/.exec(input);
  if (match !== null) {
    try {
      return decodeURIComponent(match[1] ?? '').trim();
    } catch {
      return (match[1] ?? '').trim();
    }
  }
  return input.trim();
}

/** AniList caps `Page` queries at 50 results per page. */
export const ANILIST_PAGE_SIZE = 50;
export const ANILIST_SEARCH_PAGE_SIZE = 50;

// `externalLinks` is correct, `externalSites` gets the API to reject the query — and since this fragment is spread across every anime query, that would 400 the whole integration. `type` is what separates real platforms from the official-site and social links in the same array; `tags` is AniList's version of MAL's split themes, see below.
export const ANIME_MEDIA_FRAGMENT = `
fragment AnimeMedia on Media {
  id
  title { romaji english native }
  description(asHtml: false)
  coverImage { medium large }
  averageScore
  genres
  format
  episodes
  season
  seasonYear
  status
  popularity
  isAdult
  externalLinks { site url type }
  studios(isMain: true) { nodes { id name } }
  tags { id name rank }
}
`;

// `tags` is selected on every node (see above), not just the detail one: the engine weights `themes` at 0.16 and wants genre+theme overlap, so leaving it detail-only kept that weight inert on every list and candidate record. `rank` is needed because the normalizer filters on it, which also bounds how many themes reach the cache.
export const ANIME_MEDIA_DETAIL_FRAGMENT = `
fragment AnimeMediaDetail on Media {
  ...AnimeMedia
  staff(perPage: 8) { edges { role node { id name { full } image { large } } } }
}
`;

export const VIEWER_QUERY = `
query {
  Viewer {
    id
    name
    avatar { large }
    createdAt
  }
}
`;

export const USER_LIST_QUERY = `
${ANIME_MEDIA_FRAGMENT}
query ($userId: Int) {
  MediaListCollection(userId: $userId, type: ANIME) {
    lists {
      entries {
        id
        status
        score(format: POINT_100)
        progress
        priority
        repeat
        updatedAt
        notes
        media { ...AnimeMedia }
      }
    }
  }
}
`;

export const ANIME_DETAIL_QUERY = `
${ANIME_MEDIA_FRAGMENT}
${ANIME_MEDIA_DETAIL_FRAGMENT}
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    ...AnimeMediaDetail
  }
}
`;

export const SEARCH_ANIME_QUERY = `
${ANIME_MEDIA_FRAGMENT}
query ($search: String) {
  Page(perPage: ${ANILIST_SEARCH_PAGE_SIZE}) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ...AnimeMedia }
  }
}
`;

export const RANKING_ANIME_QUERY = `
${ANIME_MEDIA_FRAGMENT}
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: SCORE_DESC) { ...AnimeMedia }
  }
}
`;

export const SAVE_LIST_ENTRY_MUTATION = `
mutation ($mediaId: Int, $status: MediaListStatus) {
  SaveMediaListEntry(mediaId: $mediaId, status: $status) {
    id
  }
}
`;
