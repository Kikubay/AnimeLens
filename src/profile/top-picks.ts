import type { AnimeListEntry } from '../domain/anime';

// Display-safe fields only: no notes, watch progress or list status. `updatedAt` drives the default tie-break order and is never painted.
export interface TopPickCandidate {
  readonly id: number;
  readonly title: string;
  readonly score: number;
  readonly imageUrl: string | null;
  readonly largeImageUrl: string | null;
  /** ISO-8601 UTC, or `null` when the provider omitted it. */
  readonly updatedAt: string | null;
}

// `picks` is always a complete, renderable Top 3 (locked plus default fill), so the card never waits on user interaction.
export interface TopPickPlan {
  readonly limit: number;
  readonly locked: readonly TopPickCandidate[];
  readonly candidates: readonly TopPickCandidate[];
  /** Locked entries followed by the default fill, at most `limit` long. */
  readonly picks: readonly TopPickCandidate[];
  readonly boundaryScore: number | null;
  readonly openSlots: number;
  /** Only true when the tied group outnumbers the slots it competes for. */
  readonly needsChoice: boolean;
  readonly signature: string;
  readonly providerId: string;
  /** Caps at MAX_GRID_CANDIDATES; backs the 3x3 grid and is never persisted. */
  readonly ranked: readonly TopPickCandidate[];
}

// Bounds the grid pool so a huge list can't bloat the profile snapshot that ships it.
export const MAX_GRID_CANDIDATES = 120;

export const GRID_SLOT_COUNT = 9;

export const DEFAULT_TOP_PICK_LIMIT = 3;

interface RankedEntry {
  readonly candidate: TopPickCandidate;
  readonly communityScore: number;
}

export interface PlanTopPicksOptions {
  readonly limit?: number;
  /** Prefixed onto the signature, so a MAL ranking can't validate against an AniList pool whose ids overlap. */
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

// Ordering is score desc → updatedAt desc → community score desc → title. Because the timestamp is the secondary key, the default fill is just the head of the tied group, which *is* the "most recently updated" fallback with no second code path to keep in sync.
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

  // Everything fits, so there's nothing to choose even if scores repeat; the signature is still emitted so a stale ranking clears itself.
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
  // The third-highest entry is always a boundary candidate, so `openSlots > 0` alone would prompt on a clean 10/9/8.
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

// Re-validated against the current plan rather than trusted, so a stale, truncated or tampered value degrades to the default fill.
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

// `null` means the pick isn't allowed (already taken, slots full, or not in the tied pool), which is how the picker advances one slot per click.
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

export function isTopPickComplete(chosen: readonly number[], plan: TopPickPlan): boolean {
  return plan.needsChoice && chosen.length >= plan.openSlots;
}

// Deliberately ignores entries outside the pool, so rating an anime below the boundary score leaves a saved ranking intact.
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
      // Both resolutions ride along so the UI can pick one to match the requested thumbnail size.
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
