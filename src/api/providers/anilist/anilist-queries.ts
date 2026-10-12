export const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
export const ANILIST_AUTHORIZATION_URL = 'https://anilist.co/api/v2/oauth/authorize';

export const ANILIST_PIN_REDIRECT_URL = 'https://anilist.co/api/v2/oauth/pin';

export function buildAnilistPinAuthorizeUrl(clientId: string): string {
  const url = new URL(ANILIST_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
  }).toString();
  return url.toString();
}

const ANILIST_PIN_TAB_URL_PREFIX = 'https://anilist.co/api/v2/oauth/pin#access_token=';

export function isAniListPinTabUrl(url: string): boolean {
  return (
    url.startsWith(ANILIST_PIN_TAB_URL_PREFIX) && url.length > ANILIST_PIN_TAB_URL_PREFIX.length
  );
}

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

export const ANILIST_PAGE_SIZE = 50;
export const ANILIST_SEARCH_PAGE_SIZE = 50;

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
query ($search: String, $formatIn: [MediaFormat], $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage currentPage }
    media(search: $search, type: ANIME, sort: SEARCH_MATCH, format_in: $formatIn) { ...AnimeMedia }
  }
}
`;

export const SEARCH_ANIME_BY_TAG_QUERY = `
${ANIME_MEDIA_FRAGMENT}
query ($genreIn: [String], $tagIn: [String], $formatIn: [MediaFormat], $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage currentPage }
    media(type: ANIME, sort: POPULARITY_DESC, genre_in: $genreIn, tag_in: $tagIn, format_in: $formatIn) { ...AnimeMedia }
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

export const TRENDING_ANIME_QUERY = `
${ANIME_MEDIA_FRAGMENT}
query ($perPage: Int) {
  Page(perPage: $perPage) {
    media(type: ANIME, sort: TRENDING_DESC) { ...AnimeMedia }
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
