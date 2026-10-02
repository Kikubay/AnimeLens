export const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
export const ANILIST_AUTHORIZATION_URL = 'https://anilist.co/api/v2/oauth/authorize';

/**
 * Auth Pin redirect URL. `launchWebAuthFlow` cannot complete AniList's
 * implicit flow (the fragment redirect fails with "Authorization page could
 * not be loaded"), so connect opens the authorize page in a normal tab with
 * this redirect: AniList then displays the access token for manual paste.
 * This exact URL must be registered as the app's Redirect URL.
 */
export const ANILIST_PIN_REDIRECT_URL = 'https://anilist.co/api/v2/oauth/pin';

export function buildAnilistPinAuthorizeUrl(clientId: string): string {
  const url = new URL(ANILIST_AUTHORIZATION_URL);
  // AniList's implicit-grant contract: the authorize request carries ONLY
  // `client_id` and `response_type=token`. The redirect target is always the
  // URL registered in the application settings (the pin page) — sending a
  // `redirect_uri` query param makes the server reject the request with
  // `unsupported_grant_type`.
  url.search = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
  }).toString();
  return url.toString();
}

/** Prefix of the pin-page redirect URL carrying the token in its fragment. */
const ANILIST_PIN_TAB_URL_PREFIX = 'https://anilist.co/api/v2/oauth/pin#access_token=';

/**
 * True when a tab URL is the pin-page redirect holding a fresh access token
 * (`https://anilist.co/api/v2/oauth/pin#access_token=…`). Chrome match
 * patterns ignore fragments, so detection must inspect the full URL.
 */
export function isAniListPinTabUrl(url: string): boolean {
  return (
    url.startsWith(ANILIST_PIN_TAB_URL_PREFIX) && url.length > ANILIST_PIN_TAB_URL_PREFIX.length
  );
}

/**
 * Extracts the bearer token from user input: either the raw token itself or
 * a full pin-page URL containing an `access_token` fragment parameter (what
 * users typically copy straight from the address bar).
 */
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

/** Shared fragment for a lean anime node (list/suggestion/ranking queries).
 *
 * `externalLinks`, not `externalSites` — the API rejects the latter outright, and
 * since this fragment is spread across every anime query, getting it wrong 400s
 * the whole integration. `type` is what separates real platforms from the
 * official-site and social links in the same array.
 */
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
}
`;

/** Detail fragment adds tags (themes), staff and the user's own list entry. */
export const ANIME_MEDIA_DETAIL_FRAGMENT = `
fragment AnimeMediaDetail on Media {
  ...AnimeMedia
  tags { id name rank }
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
