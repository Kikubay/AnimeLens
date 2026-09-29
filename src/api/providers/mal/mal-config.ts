export const MAL_API_BASE_URL = 'https://api.myanimelist.net/v2';
export const MAL_USER_SCOPE = 'write:users';

/** Limits documented by the current local MAL API reference. */
export const MAL_LIMITS = {
  animeSearch: 100,
  animeRanking: 100,
  userAnimeList: 1000,
} as const;

/**
 * Detail-level fields for a single anime node.
 *
 * `themes` and `staff` are intentionally absent: MAL's API silently ignores
 * both (verified against the live API — responses contain `genres` and
 * `studios` but never a `themes`/`staff` key). Themes are recovered from the
 * `genres` array via the official ID taxonomy (see mal-taxonomy.ts).
 */
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

/**
 * List status subfields for the **user animelist** endpoint. That endpoint
 * exposes the user's list state under `list_status` (per MAL's own request
 * sample: `fields=list_status&limit=4`) and supports nested selection
 * (`list_status{...}`). `my_list_status` is the details/patch endpoint's
 * name — requesting it on the list endpoint silently returns nodes without
 * any status/score, which cold-starts the profile (0 rated anime, no
 * favorites, average "—").
 */
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
