import type { Anime } from '../domain/anime';
import type { AppCopy } from '../locales';

export type SearchSortKey = 'relevance' | 'score' | 'popularity' | 'newest' | 'title';

type SearchSortDirection = 'desc' | 'asc';

export interface SearchSort {
  readonly key: SearchSortKey;
  readonly direction: SearchSortDirection;
}

export interface SearchSortOption {
  readonly key: SearchSortKey;
  readonly defaultDirection: SearchSortDirection;
  readonly label: (copy: AppCopy) => string;
  readonly compare: (left: Anime, right: Anime, direction: SearchSortDirection) => number;
}

function displayTitle(anime: Anime): string {
  return anime.title.english ?? anime.title.default;
}

// A provider rank of 1 is the most popular title, so negating it lands a rank and a member count on the same "higher means more prominent" scale.
function prominence(anime: Anime): number | null {
  if (anime.popularity !== null) return -anime.popularity;
  return anime.memberCount;
}

// Missing data always trails, whichever direction is active: an unrated title is never "the highest rated".
function compareValues(
  left: number | null,
  right: number | null,
  direction: SearchSortDirection,
): number {
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null ? 1 : -1;
  }
  return direction === 'asc' ? left - right : right - left;
}

export const SEARCH_SORT_OPTIONS: readonly SearchSortOption[] = [
  {
    key: 'relevance',
    defaultDirection: 'desc',
    label: (copy) => copy.searchSortRelevance,
    compare: () => 0,
  },
  {
    key: 'score',
    defaultDirection: 'desc',
    label: (copy) => copy.searchSortScore,
    compare: (left, right, direction) => compareValues(left.score, right.score, direction),
  },
  {
    key: 'popularity',
    defaultDirection: 'desc',
    label: (copy) => copy.searchSortPopularity,
    compare: (left, right, direction) =>
      compareValues(prominence(left), prominence(right), direction),
  },
  {
    key: 'newest',
    defaultDirection: 'desc',
    label: (copy) => copy.searchSortNewest,
    compare: (left, right, direction) => compareValues(left.year, right.year, direction),
  },
  {
    key: 'title',
    defaultDirection: 'asc',
    label: (copy) => copy.searchSortTitle,
    compare: (left, right, direction) => {
      const order = displayTitle(left).localeCompare(displayTitle(right));
      return direction === 'asc' ? order : -order;
    },
  },
];

export const DEFAULT_SEARCH_SORT: SearchSort = { key: 'relevance', direction: 'desc' };

function searchSortOption(key: SearchSortKey): SearchSortOption {
  return SEARCH_SORT_OPTIONS.find((option) => option.key === key) ?? SEARCH_SORT_OPTIONS[0];
}

export function searchSortLabel(key: SearchSortKey, copy: AppCopy): string {
  return searchSortOption(key).label(copy);
}

// Picking a criterion starts it on the direction that criterion reads best; picking it again flips it.
export function toggleSearchSort(current: SearchSort, key: SearchSortKey): SearchSort {
  if (current.key !== key) return { key, direction: searchSortOption(key).defaultDirection };
  return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
}

export function flipSearchSortDirection(sort: SearchSort): SearchSort {
  return { key: sort.key, direction: sort.direction === 'desc' ? 'asc' : 'desc' };
}

export function sortAnimeResults(results: readonly Anime[], sort: SearchSort): readonly Anime[] {
  if (sort.key === 'relevance') return results;
  const { compare } = searchSortOption(sort.key);
  const direction = sort.direction;
  return [...results].sort((left, right) => compare(left, right, direction));
}
