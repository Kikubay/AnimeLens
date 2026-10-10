/**
 * Regenerates `src/demo/data/demo-anime.json` from AniList's public GraphQL API.
 *
 * AniList is the source because it needs no client id, unlike MAL's v2 API. It also
 * publishes `idMal`, so the demo can offer a MyAnimeList view built from genuine MAL ids
 * rather than invented ones. The output is committed, so neither CI nor the deployed site
 * ever calls this script.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, 'src', 'demo', 'data', 'demo-anime.json');
const ENDPOINT = 'https://graphql.anilist.co';
const PAGE_SIZE = 50;
const MAX_ATTEMPTS = 4;
const DESCRIPTION_LIMIT = 300;
// Mirrors `TAG_MIN_RANK` in the AniList normalizer, and keeps the committed fixture small.
const TAG_MIN_RANK = 20;
const MAX_TAGS = 8;

// `sort` alone over-weights one end of the catalogue, so the pool is assembled from several
// orderings plus a genre sweep to keep genres, decades and formats represented.
const QUERIES = [
  ...[1, 2, 3].map((page) => ({ page, sort: 'SCORE_DESC' })),
  ...[1, 2, 3].map((page) => ({ page, sort: 'POPULARITY_DESC' })),
  { page: 1, sort: 'TRENDING_DESC' },
  ...[
    'Action',
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Horror',
    'Romance',
    'Sci-Fi',
    'Slice of Life',
    'Supernatural',
  ].map((genre) => ({ page: 1, sort: 'POPULARITY_DESC', genre })),
];

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  description(asHtml: false)
  coverImage { medium large }
  averageScore
  meanScore
  popularity
  genres
  format
  episodes
  season
  seasonYear
  status
  isAdult
  tags { id name rank }
  studios(isMain: true) { nodes { id name } }
  externalLinks { site url type }
`;

const PAGE_QUERY = `
query ($page: Int, $perPage: Int, $genre: [String]) {
  Page(page: $page, perPage: $perPage) {
    media(
      type: ANIME
      sort: $sort
      genre_in: $genre
      isAdult: false
      format_not: MUSIC
    ) {
      ${MEDIA_FIELDS}
    }
  }
}
`;

async function fetchPageOnce(query) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: PAGE_QUERY.replace('$sort', query.sort),
      variables: {
        page: query.page,
        perPage: PAGE_SIZE,
        genre: query.genre === undefined ? null : [query.genre],
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AniList responded ${response.status}: ${detail.slice(0, 400)}`);
  }
  const payload = await response.json();
  if (payload.errors?.length > 0) {
    throw new Error(
      `${payload.errors[0].message ?? 'AniList error'}: ${JSON.stringify(payload.errors[0].extensions ?? {})}`,
    );
  }
  return payload.data.Page.media ?? [];
}

/**
 * AniList answers a throttled request with a short page rather than an error, which would
 * quietly shrink the fixture, so an incomplete page is retried before it is accepted.
 */
async function fetchPage(query) {
  let media = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      media = await fetchPageOnce(query);
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await sleep(attempt * 2000);
      continue;
    }
    if (media.length >= PAGE_SIZE) return media;
    await sleep(attempt * 2000);
  }
  console.warn(
    `  short page (${media.length}/${PAGE_SIZE}) for ${query.sort} ${query.genre ?? 'all'} p${query.page}`,
  );
  return media;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function keep(media) {
  // The demo refuses to connect an account, so a list entry can only be as real as the
  // record behind it: a title, a cover and an id in the provider the view is labelled with.
  if (typeof media.id !== 'number' || typeof media.idMal !== 'number') return false;
  const title = media.title?.romaji ?? media.title?.english ?? media.title?.native;
  if (typeof title !== 'string' || title.length === 0) return false;
  return typeof media.coverImage?.large === 'string' && media.coverImage.large.length > 0;
}

function trim(media) {
  // Line breaks are collapsed here so the committed fixture doesn't carry markup the
  // normalizers would only have to strip again at runtime.
  const description =
    media.description
      ?.replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? '';
  return {
    id: media.id,
    malId: media.idMal,
    title: {
      default: media.title?.romaji ?? media.title?.english ?? media.title?.native,
      english: media.title?.english ?? null,
      japanese: media.title?.native ?? null,
    },
    synopsis: description.length > 0 ? description.slice(0, DESCRIPTION_LIMIT) : null,
    image: { medium: media.coverImage?.medium ?? null, large: media.coverImage.large },
    averageScore: media.averageScore ?? null,
    meanScore: media.meanScore ?? null,
    listMembers: media.popularity ?? null,
    genres: media.genres ?? [],
    tags: (media.tags ?? [])
      .filter((tag) => (tag.rank ?? 100) >= TAG_MIN_RANK)
      .slice(0, MAX_TAGS)
      .map((tag) => ({ id: tag.id, name: tag.name })),
    format: media.format ?? null,
    episodes: media.episodes ?? null,
    season: media.season ?? null,
    seasonYear: media.seasonYear ?? null,
    status: media.status ?? null,
    isAdult: media.isAdult === true,
    studios: (media.studios?.nodes ?? []).map((node) => ({ id: node.id, name: node.name })),
    externalLinks: (media.externalLinks ?? [])
      .filter((link) => typeof link.url === 'string' && link.url.startsWith('https://'))
      .map((link) => ({ site: link.site ?? '', url: link.url, type: link.type ?? '' })),
  };
}

const byId = new Map();
for (const query of QUERIES) {
  const media = await fetchPage(query);
  for (const item of media) {
    if (keep(item) && !byId.has(item.id)) byId.set(item.id, trim(item));
  }
  console.log(
    `${query.sort}${query.genre ? ` (${query.genre})` : ''} page ${query.page}: ${byId.size} unique`,
  );
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 650));
}

const anime = [...byId.values()].sort(
  (left, right) => (right.listMembers ?? 0) - (left.listMembers ?? 0),
);
if (anime.length < 150)
  throw new Error(`Only collected ${anime.length} titles; expected at least 150.`);

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'https://anilist.co',
  anime,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(payload)}\n`);
console.log(`\nWrote ${anime.length} titles to ${OUTPUT}`);
