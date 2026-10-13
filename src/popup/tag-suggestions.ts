import {
  ANIME_TAG_PREFIX,
  normalizeAnimeTag,
  parseAnimeSearchQuery,
} from '../api/anime-search-query';
import { MAL_GENRE_NAMES, MAL_THEME_NAMES } from '../api/mal-taxonomy';

export const TAG_SUGGESTION_LIMIT = 8;

export interface TagSuggestion {
  readonly name: string;
  readonly kind: 'genre' | 'theme';
}

const MAL_TAG_KINDS: readonly TagSuggestion[] = [
  ...MAL_GENRE_NAMES.map((name) => ({ name, kind: 'genre' as const })),
  ...MAL_THEME_NAMES.map((name) => ({ name, kind: 'theme' as const })),
];

const ACTIVE_TAG_TOKEN = /(?:^|\s)#([^#]*[^\s#])$/;

function activeTagToken(
  value: string,
): { readonly start: number; readonly fragment: string } | null {
  const match = ACTIVE_TAG_TOKEN.exec(value);
  if (match === null) return null;
  return {
    start: match.index + (match[0].startsWith(ANIME_TAG_PREFIX) ? 0 : 1),
    fragment: match[1].trim(),
  };
}

function byName(left: TagSuggestion, right: TagSuggestion): number {
  return left.name.localeCompare(right.name);
}

function startsWithFragment(suggestion: TagSuggestion, needle: string): boolean {
  return normalizeAnimeTag(suggestion.name).startsWith(needle);
}

export function activeTagFragment(value: string): string {
  return activeTagToken(value)?.fragment ?? '';
}

export function searchTagSuggestions(query: string): readonly TagSuggestion[] {
  const token = activeTagToken(query);
  const needle = normalizeAnimeTag(token?.fragment ?? '');
  if (token === null || needle.length === 0) return [];

  const parsed = parseAnimeSearchQuery(query);
  const selected = new Set(
    parsed?.kind === 'tag' ? parsed.values.map((value) => normalizeAnimeTag(value)) : [],
  );
  const candidates = MAL_TAG_KINDS.filter((suggestion) => {
    const normalized = normalizeAnimeTag(suggestion.name);
    return normalized.includes(needle) && !selected.has(normalized);
  });

  return [
    ...candidates.filter((suggestion) => startsWithFragment(suggestion, needle)).sort(byName),
    ...candidates.filter((suggestion) => !startsWithFragment(suggestion, needle)).sort(byName),
  ].slice(0, TAG_SUGGESTION_LIMIT);
}

export function applyTagSuggestion(query: string, tag: string): string {
  const start = activeTagToken(query)?.start ?? query.length;
  return `${query.slice(0, start)}${ANIME_TAG_PREFIX}${tag} `;
}
