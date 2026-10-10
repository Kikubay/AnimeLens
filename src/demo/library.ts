import type { Anime, AnimeListEntry, AnimeProviderId, AnimeStatus } from '../domain/anime';
import { buildRecord, type DemoAnimeFixture } from './records';

const LIBRARY_SIZE = 46;
const PLAN_TO_WATCH_SHARE = 0.18;
const WATCHING_SHARE = 0.08;
const DROPPED_SHARE = 0.07;

/**
 * A seeded generator so one visitor sees a stable dashboard while reloading, and the
 * "shuffle" control can hand out a genuinely different library on demand.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

function sample<T>(values: readonly T[], count: number, random: () => number): T[] {
  const pool = [...values];
  const picked: T[] = [];
  const size = Math.min(count, pool.length);
  for (let index = 0; index < size; index += 1) {
    const choice = Math.floor(random() * pool.length);
    picked.push(...pool.splice(choice, 1));
  }
  return picked;
}

/**
 * Tastes are seeded from a genre pair so the library has a recognisable shape. Without that
 * the profile averages out to nothing and every section would render the same neutral pick.
 */
const TASTES: readonly { readonly label: string; readonly genres: readonly string[] }[] = [
  { label: 'Action & Fantasy', genres: ['Action', 'Fantasy', 'Adventure'] },
  { label: 'Sci-Fi & Supernatural', genres: ['Sci-Fi', 'Supernatural', 'Action'] },
  { label: 'Drama & Romance', genres: ['Drama', 'Romance'] },
  { label: 'Comedy & Slice of Life', genres: ['Comedy', 'Slice of Life'] },
  { label: 'Mystery & Thriller', genres: ['Mystery', 'Supernatural', 'Drama'] },
  { label: 'Horror & Supernatural', genres: ['Horror', 'Supernatural'] },
  { label: 'Adventure & Fantasy', genres: ['Adventure', 'Fantasy', 'Drama'] },
];

export function pickTasteLabel(seed: number): string {
  const taste = TASTES[seed % TASTES.length] ?? TASTES[0];
  return taste?.label ?? '';
}

function rankByTaste(
  fixtures: readonly DemoAnimeFixture[],
  taste: readonly string[],
): DemoAnimeFixture[] {
  const wanted = new Set(taste.map((genre) => genre.toLowerCase()));
  const scored = fixtures.map((fixture) => {
    const overlap = fixture.genres.filter((genre) => wanted.has(genre.toLowerCase())).length;
    // Popularity breaks ties so the library still spans the catalogue rather than one corner.
    return { fixture, overlap, popularity: fixture.listMembers ?? 0 };
  });
  scored.sort((left, right) => right.overlap - left.overlap || right.popularity - left.popularity);
  return scored.map((item) => item.fixture);
}

function statusFor(random: () => number): AnimeStatus {
  const roll = random();
  if (roll < PLAN_TO_WATCH_SHARE) return 'plan_to_watch';
  if (roll < PLAN_TO_WATCH_SHARE + WATCHING_SHARE) return 'watching';
  if (roll < PLAN_TO_WATCH_SHARE + WATCHING_SHARE + DROPPED_SHARE) return 'dropped';
  return 'completed';
}

/**
 * Scores track the community score with noise, so a visitor's ratings look like someone who
 * genuinely watches these titles rather than a random permutation of 1-10.
 */
function userScoreFor(fixture: DemoAnimeFixture, random: () => number): number | null {
  // A couple of entries are deliberately unrated, the way a real list always has gaps.
  if (random() < 0.06) return null;
  const community = (fixture.meanScore ?? fixture.averageScore ?? 60) / 10;
  const noise = (random() - 0.45) * 2.4;
  return Math.round(Math.min(10, Math.max(1, community + noise)));
}

export interface DemoLibrary {
  readonly watched: readonly AnimeListEntry[];
  readonly candidates: readonly Anime[];
}

export function buildDemoLibrary(
  fixtures: readonly DemoAnimeFixture[],
  provider: AnimeProviderId,
  seed: number,
): DemoLibrary {
  const random = createRandom(seed);
  const taste = TASTES[seed % TASTES.length]?.genres ?? ['Action', 'Adventure'];
  // Roughly half the library comes from the seeded taste and half is drawn across the whole
  // pool, which is what gives the engine both confident matches and something to discover.
  const preferred = rankByTaste(fixtures, taste).slice(0, Math.round(LIBRARY_SIZE * 0.6));
  const rest = fixtures.filter((fixture) => !preferred.includes(fixture));
  const library = [...preferred, ...sample(rest, LIBRARY_SIZE - preferred.length, random)];

  const watched: AnimeListEntry[] = library.map((fixture) => {
    const status = statusFor(random);
    const userScore =
      status === 'plan_to_watch' || status === 'watching' ? null : userScoreFor(fixture, random);
    return {
      anime: buildRecord(fixture, provider),
      status,
      userScore,
      episodesWatched:
        status === 'completed'
          ? (fixture.episodes ?? 12)
          : status === 'dropped'
            ? Math.max(1, Math.round((fixture.episodes ?? 12) / 3))
            : 0,
      priority: null,
      isRewatching: random() < 0.04,
      updatedAt: null,
      notes: null,
    };
  });

  const watchedIds = new Set(watched.map((entry) => entry.anime.id));
  const candidates = fixtures
    .filter((fixture) => !watchedIds.has(provider === 'anilist' ? fixture.id : fixture.malId))
    .map((fixture) => buildRecord(fixture, provider));

  return { watched, candidates };
}

export const DEMO_TASTES = TASTES;
export const DEMO_TOTAL = LIBRARY_SIZE;
export type { DemoAnimeFixture };
export { createRandom as createDemoRandom };
