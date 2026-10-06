export const MAL_API_BASE_URL = 'https://api.myanimelist.net/v2';
export const MAL_USER_SCOPE = 'write:users';

export const MAL_LIMITS = {
  animeSearch: 100,
  animeRanking: 100,
  userAnimeList: 1000,
} as const;

// No `themes` or `staff`: MAL's API silently ignores both, so themes come back via the ID split in mal-taxonomy.ts.
export const MAL_ANIME_FIELDS = [
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

// Must stay `list_status`: that's the user animelist's name for the user's own state. `my_list_status` is the details/patch field, and asking for it here silently returns nodes with no status or score, which cold-starts the profile.
export const MAL_LIST_STATUS_FIELDS = [
  'status',
  'score',
  'num_episodes_watched',
  'priority',
  'is_rewatching',
  'updated_at',
];

export const MAL_FIELDS = MAL_ANIME_FIELDS.join(',');
export const MAL_LIST_FIELDS = `${MAL_FIELDS},list_status{${MAL_LIST_STATUS_FIELDS.join(',')}}`;
