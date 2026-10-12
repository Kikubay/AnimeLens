import { describe, expect, it } from 'vitest';
import {
  MAL_GENRE_NAMES,
  MAL_THEME_NAMES,
  findMalGenreId,
  splitMalGenreArray,
} from '../src/api/mal-taxonomy';

describe('mal-taxonomy', () => {
  it('resolves a genre and a theme to their real MAL ids', () => {
    expect(findMalGenreId('Action')).toBe(1);
    expect(findMalGenreId('Isekai')).toBe(62);
    expect(findMalGenreId('Sci-Fi')).toBe(24);
    expect(findMalGenreId('Slice of Life')).toBe(36);
  });

  it('resolves case and punctuation the same way a typed #tag does', () => {
    expect(findMalGenreId('slice-of-life')).toBe(findMalGenreId('Slice of Life'));
    expect(findMalGenreId('SLICE OF LIFE')).toBe(36);
    expect(findMalGenreId('  isekai ')).toBe(62);
  });

  it('returns null for anything MAL does not define', () => {
    expect(findMalGenreId('Thriller')).toBeNull();
    expect(findMalGenreId('')).toBeNull();
    expect(findMalGenreId('male protagonist')).toBeNull();
  });

  it('exposes every resolved entry in the suggestion lists', () => {
    expect(MAL_GENRE_NAMES).toContain('Action');
    expect(MAL_GENRE_NAMES).toContain('Slice of Life');
    expect(MAL_THEME_NAMES).toContain('Isekai');
    for (const name of [...MAL_GENRE_NAMES, ...MAL_THEME_NAMES]) {
      expect(findMalGenreId(name)).toBeTypeOf('number');
    }
  });

  it('splits ids into genres and themes, keeping unknown ids as genres', () => {
    const split = splitMalGenreArray([{ id: 1 }, { id: 62 }, { id: 9999 }]);
    expect(split.genres.map((entry) => entry.id)).toEqual([1, 9999]);
    expect(split.themes.map((entry) => entry.id)).toEqual([62]);
  });
});
