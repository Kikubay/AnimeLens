export const MAL_API_BASE_URL = 'https://api.myanimelist.net/v2';
export const MAL_LIMITS = {
  animeSearch: 100,
  animeRanking: 100,
  animeTagRanking: 500,
  userAnimeList: 1000,
} as const;

const MAL_ANIME_FIELDS = [
  'id',
  'title',
  'main_picture',
  'alternative_titles',
  'synopsis',
  'mean',
  'popularity',
  'num_list_users',
  'num_episodes',
  'start_date',
  'start_season',
  'media_type',
  'status',
  'genres',
  'studios',
];

const MAL_LIST_STATUS_FIELDS = [
  'status',
  'score',
  'num_episodes_watched',
  'priority',
  'is_rewatching',
  'updated_at',
];

export const MAL_FIELDS = MAL_ANIME_FIELDS.join(',');
export const MAL_LIST_FIELDS = `${MAL_FIELDS},list_status{${MAL_LIST_STATUS_FIELDS.join(',')}}`;

export const MAL_TAG_SEARCH_FIELDS = [
  'id',
  'title',
  'main_picture',
  'alternative_titles',
  'mean',
  'num_list_users',
  'num_episodes',
  'start_date',
  'media_type',
  'status',
  'genres',
].join(',');
