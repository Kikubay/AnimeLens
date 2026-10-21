import type { AnimeCardData } from './components/anime';
import { isPageId, type PageId } from './page-id';

export const POPUP_VIEW_STATE_KEY = 'popupViewState';

export interface PopupViewState {
  readonly page: PageId;
  readonly scrollPositions: Readonly<Record<string, number>>;
  readonly selectedAnime: AnimeCardData | null;
}

export function defaultPopupViewState(): PopupViewState {
  return { page: 'dashboard', scrollPositions: {}, selectedAnime: null };
}

/**
 * A stored view is written by the popup but read back after a restart of the worker, so the shape
 * is re-checked rather than trusted. `null` means the stored value is unusable and the popup opens
 * where it would have opened anyway.
 */
export function parsePopupViewState(value: unknown): PopupViewState | null {
  if (!isRecord(value)) return null;
  if (!isPageId(value.page)) return null;
  const scrollPositions = parseScrollPositions(value.scrollPositions);
  if (scrollPositions === null) return null;
  const selectedAnime = readSelectedAnime(value.selectedAnime);
  if (selectedAnime === undefined) return null;
  if (value.page === 'detail' && selectedAnime === null) return null;
  return { page: value.page, scrollPositions, selectedAnime };
}

function parseScrollPositions(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return {};
  const positions: Record<string, number> = {};
  for (const [key, offset] of Object.entries(value)) {
    if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) continue;
    positions[key] = offset;
  }
  return positions;
}

/** `undefined` marks a value that is present but unusable, `null` a value that is simply absent. */
function readSelectedAnime(value: unknown): AnimeCardData | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return undefined;
  if (!isPositiveInteger(value.id)) return undefined;
  if (!isRecord(value.title) || typeof value.title.default !== 'string') return undefined;
  if (!Array.isArray(value.title.synonyms)) return undefined;
  if (typeof value.type !== 'string') return undefined;
  if (value.score !== null && typeof value.score !== 'number') return undefined;
  if (value.year !== null && typeof value.year !== 'number') return undefined;
  if (value.episodeCount !== null && typeof value.episodeCount !== 'number') return undefined;
  if (!Array.isArray(value.genres)) return undefined;
  if (!Array.isArray(value.themes)) return undefined;
  if (!Array.isArray(value.studios)) return undefined;
  if (value.reasons !== undefined && !Array.isArray(value.reasons)) return undefined;
  return value as unknown as AnimeCardData;
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
