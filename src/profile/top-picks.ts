import type { AnimeListEntry } from '../domain/anime';

/**
 * A list entry competing for one of the card's Top 3 slots.
 *
 * Only display-safe fields are exposed: no notes, watch progress, or list
 * status. `updatedAt` is the provider's own "last touched" timestamp, used for
 * the default tie-break order; it is never painted on the card.
 */
export interface TopPickCandidate {
  readonly id: number;
  readonly title: string;
  readonly score: number;
  /** Smaller cover, used at the default thumbnail size. */
  readonly imageUrl: string | null;
  /** Full-size cover, used when the user enlarges the thumbnails. */
  readonly largeImageUrl: string | null;
  /** ISO-8601 UTC, or `null` when the provider omitted it. */
  readonly updatedAt: string | null;
}

/**
 * The resolved Top 3 plan for the current list.
 *
 * `locked` are the slots no choice is needed for, because their score is
 * strictly above the boundary. `candidates` is the group tied at the boundary
 * that the user picks from. `picks` is always a usable, fully populated Top 3:
 * the locked entries plus the default fill, so the card can render without
 * waiting on any user interaction.
 */
export interface TopPickPlan {
  readonly limit: number;
  readonly locked: readonly TopPickCandidate[];
  readonly candidates: readonly TopPickCandidate[];
  /** Locked entries followed by the default fill. At most `limit` long. */
  readonly picks: readonly TopPickCandidate[];
  /** Score of the `limit`-th highest rated entry; the tie sits at this value. */
  readonly boundaryScore: number | null;
  /** Slots left to fill at the boundary score. */
  readonly openSlots: number;
  /**
   * Whether the user actually has to choose. The third-highest entry is always
   * a boundary candidate, so `openSlots > 0` alone would prompt even for a
   * clean 10 / 9 / 8 ranking. A prompt is only warranted when the tied group is
   * larger than the number of slots it competes for.
   */
  readonly needsChoice: boolean;
  /** Provider-prefixed fingerprint of the tied pool. */
  readonly signature: string;
  readonly providerId: string;
  /**
   * Every rated entry in rank order, capped at {@link MAX_GRID_CANDIDATES}.
   * Backs the 3x3 grid layout, where the user assembles their own nine
   * instead of ranking a single Top 3. This is never persisted: it is a
   * starting point for a per-session choice, not a saved result.
   */
  readonly ranked: readonly TopPickCandidate[];
}

/**
 * Upper bound on the grid candidate pool, so a very large list cannot bloat the
 * profile snapshot that ships it.
 */
export const MAX_GRID_CANDIDATES = 120;

/** The 3x3 collage holds nine hand-picked entries. */
export const GRID_SLOT_COUNT = 9;

export const DEFAULT_TOP_PICK_LIMIT = 3;

interface RankedEntry {
  readonly candidate: TopPickCandidate;
  readonly communityScore: number;
}

export interface PlanTopPicksOptions {
  readonly limit?: number;
  /**
   * Provider the entries came from. Prefixed onto the signature so a MAL
   * ranking can never validate against an AniList pool, whose numeric ids
   * overlap.
   */
  readonly providerId?: string | null;
}

export function emptyTopPickPlan(
  providerId: string | null = null,
  limit: number = DEFAULT_TOP_PICK_LIMIT,
): TopPickPlan {
  return {
    limit,
    locked: [],
    candidates: [],
    picks: [],
    boundaryScore: null,
    openSlots: 0,
    needsChoice: false,
    signature: topPickPoolSignature([], providerId),
    providerId: normalizeProviderId(providerId),
    ranked: [],
  };
}

/**
 * Resolves the Top 3 and detects whether the user has to break a tie.
 *
 * Ordering is `score desc → updatedAt desc → community score desc → title`.
 * Because the timestamp is the secondary key, the default fill is simply the
 * first entries of the tied group — that *is* the "most recently updated"
 * fallback, with no second code path to keep in sync. A missing timestamp sorts
 * last and falls through to the community score and then the title, i.e. the
 * provider's own default order.
 */
export function planTopPicks(
  entries: readonly AnimeListEntry[],
  options: PlanTopPicksOptions = {},
): TopPickPlan {
  const limit = options.limit ?? DEFAULT_TOP_PICK_LIMIT;
  const provider = normalizeProviderId(options.providerId);
  if (limit <= 0) return emptyTopPickPlan(provider, limit);

  const ranked = entries
    .map(toRankedEntry)
    .filter((value): value is RankedEntry => value !== null)
    .sort(compareRanked);

  if (ranked.length === 0) return emptyTopPickPlan(provider, limit);

  // The whole list fits, so there is nothing to choose between even if scores
  // repeat. A signature is still produced so a stale ranking clears itself.
  if (ranked.length <= limit) {
    return {
      limit,
      locked: [],
      candidates: [],
      picks: ranked.slice(0, limit).map((value) => value.candidate),
      boundaryScore: ranked[ranked.length - 1]?.candidate.score ?? null,
      openSlots: 0,
      needsChoice: false,
      signature: topPickPoolSignature(
        ranked.map((value) => value.candidate),
        provider,
      ),
      providerId: provider,
      ranked: galleryFrom(ranked),
    };
  }

  const boundary = ranked[limit - 1]?.candidate.score ?? 0;
  const pool = ranked.filter((value) => value.candidate.score >= boundary);
  const locked = pool
    .filter((value) => value.candidate.score > boundary)
    .map((value) => value.candidate);
  const candidates = pool
    .filter((value) => value.candidate.score === boundary)
    .map((value) => value.candidate);
  const openSlots = Math.max(0, limit - locked.length);
  // The third-highest entry is always a boundary candidate, so a prompt is
  // only warranted when the tied group outnumbers the slots it competes for.
  const needsChoice = candidates.length > openSlots;

  return {
    limit,
    locked,
    candidates,
    picks: [...locked, ...candidates.slice(0, openSlots)],
    boundaryScore: boundary,
    openSlots,
    needsChoice,
    signature: topPickPoolSignature(
      pool.map((value) => value.candidate),
      provider,
    ),
    providerId: provider,
    ranked: galleryFrom(ranked),
  };
}

function galleryFrom(ranked: readonly RankedEntry[]): readonly TopPickCandidate[] {
  return ranked.slice(0, MAX_GRID_CANDIDATES).map((value) => value.candidate);
}

/**
 * Applies a stored ranking on top of the plan's locked entries.
 *
 * The ranking is re-validated against the current plan rather than trusted: a
 * stale, truncated, or tampered value degrades to the default fill instead of
 * producing a card with missing or duplicated entries.
 */
export function applyManualRanking(
  plan: TopPickPlan,
  ranking: readonly number[] | null | undefined,
): readonly TopPickCandidate[] {
  if (ranking === null || ranking === undefined) return plan.picks;
  if (!plan.needsChoice) return plan.picks;
  if (ranking.length !== plan.openSlots) return plan.picks;

  const byId = new Map(plan.candidates.map((candidate) => [candidate.id, candidate] as const));
  if (new Set(ranking).size !== ranking.length) return plan.picks;
  const chosen: TopPickCandidate[] = [];
  for (const id of ranking) {
    const candidate = byId.get(id);
    if (candidate === undefined) return plan.picks;
    chosen.push(candidate);
  }
  return [...plan.locked, ...chosen];
}

/**
 * Appends a candidate to an in-progress ranking, filling the current open slot.
 *
 * Returns `null` when the pick is not allowed: the candidate is already taken,
 * the slots are full, or the id is not part of the tied pool. The picker uses
 * this to advance one slot per click and stop at the limit.
 */
export function addTopPickChoice(
  chosen: readonly number[],
  id: number,
  plan: TopPickPlan,
): readonly number[] | null {
  if (!plan.needsChoice) return null;
  if (chosen.length >= plan.openSlots) return null;
  if (chosen.includes(id)) return null;
  if (!plan.candidates.some((candidate) => candidate.id === id)) return null;
  return [...chosen, id];
}

/** True once every open slot has been filled. */
export function isTopPickComplete(chosen: readonly number[], plan: TopPickPlan): boolean {
  return plan.needsChoice && chosen.length >= plan.openSlots;
}

/**
 * Fingerprint of the tied pool: the provider id plus the pool's ids and scores,
 * sorted by id so the value is stable regardless of list ordering.
 *
 * It deliberately ignores entries outside the pool, so rating an anime below the
 * boundary score leaves a saved ranking intact. Adding, removing, or re-scoring
 * a pooled entry changes it and invalidates the ranking.
 */
export function topPickPoolSignature(
  pool: readonly TopPickCandidate[],
  providerId: string | null = null,
): string {
  const pairs = pool
    .map((candidate) => [candidate.id, candidate.score] as const)
    .sort((left, right) => left[0] - right[0]);
  return `${normalizeProviderId(providerId)}_${JSON.stringify(pairs)}`;
}

function toRankedEntry(entry: AnimeListEntry): RankedEntry | null {
  const anime = entry?.anime;
  if (anime === null || anime === undefined) return null;
  const score = entry.userScore ?? anime.userScore;
  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) return null;
  const title = anime.title?.default;
  if (typeof title !== 'string' || title.trim().length === 0) return null;
  const community =
    typeof anime.score === 'number' && Number.isFinite(anime.score) ? anime.score : 0;
  return {
    candidate: {
      id: anime.id,
      title: title.trim(),
      score,
      // Both variants are carried so the UI can pick the resolution that suits
      // the thumbnail size the user actually asked for.
      imageUrl: anime.image?.medium ?? anime.image?.large ?? null,
      largeImageUrl: anime.image?.large ?? anime.image?.medium ?? null,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : null,
    },
    communityScore: community,
  };
}

function compareRanked(left: RankedEntry, right: RankedEntry): number {
  return (
    right.candidate.score - left.candidate.score ||
    compareUpdatedAt(left.candidate.updatedAt, right.candidate.updatedAt) ||
    right.communityScore - left.communityScore ||
    left.candidate.title.localeCompare(right.candidate.title)
  );
}

/** Descending by recency; `null` (provider omitted it) always sorts last. */
function compareUpdatedAt(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;
  return rightTime - leftTime;
}

function normalizeProviderId(providerId: string | null | undefined): string {
  const trimmed = providerId?.trim() ?? '';
  if (trimmed.length === 0) return 'unknown';
  return /^[a-z0-9_-]+$/i.test(trimmed) ? trimmed : 'unknown';
}
