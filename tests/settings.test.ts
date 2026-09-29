import { describe, expect, it } from 'vitest';
import {
  DEFAULT_USER_PREFERENCES,
  normalizeSettingsText,
  normalizeUserPreferences,
  persistableTasteCardPicksLayout,
  TASTE_CARD_COVER_SCALE_RANGE,
} from '../src/settings/settings-types';

describe('settings preferences', () => {
  it('defaults recommendations and daily notifications to safe values', () => {
    expect(DEFAULT_USER_PREFERENCES.language).toBe('en');
    expect(DEFAULT_USER_PREFERENCES.recommendationMode).toBe('personalized');
    expect(DEFAULT_USER_PREFERENCES.dailyRecommendationsEnabled).toBe(false);
    expect(DEFAULT_USER_PREFERENCES.excludedGenres).toEqual([]);
    expect(DEFAULT_USER_PREFERENCES.excludedThemes).toEqual([]);
  });

  it('normalizes missing settings text without throwing', () => {
    expect(normalizeSettingsText(undefined)).toBe('');
    expect(normalizeSettingsText(null)).toBe('');
    expect(normalizeSettingsText('https://extension.test/')).toBe('https://extension.test/');
  });

  it('normalizes partial or invalid persisted preferences without throwing', () => {
    expect(
      normalizeUserPreferences({
        language: undefined,
        theme: 'invalid',
        recommendationMode: 'exploratory',
        includeMovies: false,
        minimumCompatibilityScore: 150,
        preferredGenres: ['Fantasy', 42],
        excludedGenres: ['Romance', 7],
        excludedThemes: ['Team Sports', null],
      }),
    ).toMatchObject({
      language: 'en',
      theme: 'dark',
      recommendationMode: 'exploratory',
      includeMovies: false,
      minimumCompatibilityScore: 100,
      preferredGenres: ['Fantasy'],
      excludedGenres: ['Romance'],
      excludedThemes: ['Team Sports'],
    });
  });

  it('shows every taste card section by default', () => {
    expect(DEFAULT_USER_PREFERENCES.tasteCard).toEqual({
      showGenres: true,
      showPicks: true,
      coverScale: 1,
      picksLayout: 'list',
    });
  });

  it('only ever persists List or Triangle, never the grid', () => {
    // The grid depends on nine hand-picked entries that are deliberately not
    // stored, so persisting the mode would restore an empty collage.
    for (const layout of ['list', 'triangle'] as const) {
      expect(
        normalizeUserPreferences({ tasteCard: { picksLayout: layout } }).tasteCard.picksLayout,
      ).toBe(layout);
      expect(persistableTasteCardPicksLayout(layout)).toBe(layout);
    }
    expect(persistableTasteCardPicksLayout('grid')).toBe('list');
    // A value written by an older build is repaired on read.
    expect(
      normalizeUserPreferences({ tasteCard: { picksLayout: 'grid' } }).tasteCard.picksLayout,
    ).toBe('list');
  });

  it('rejects an unknown picks layout', () => {
    for (const invalid of ['masonry', '', 42, null]) {
      expect(
        normalizeUserPreferences({ tasteCard: { picksLayout: invalid } }).tasteCard.picksLayout,
      ).toBe('list');
    }
  });

  it('normalizes and clamps the taste card cover slider', () => {
    const { min, max } = TASTE_CARD_COVER_SCALE_RANGE;
    const normalized = normalizeUserPreferences({
      tasteCard: { showGenres: false, showPicks: true, coverScale: 99 },
    });

    expect(normalized.tasteCard).toEqual({
      showGenres: false,
      showPicks: true,
      coverScale: max,
      picksLayout: 'list',
    });
    expect(normalizeUserPreferences({ tasteCard: { coverScale: -5 } }).tasteCard.coverScale).toBe(
      min,
    );
    // Rounded so dragging the slider cannot accumulate float noise.
    expect(
      normalizeUserPreferences({ tasteCard: { coverScale: 1.23456 } }).tasteCard.coverScale,
    ).toBe(1.23);
  });

  it('falls back to visible sections when the stored taste card block is corrupt', () => {
    for (const corrupt of [undefined, null, 'nope', 42, { showGenres: 'yes' }]) {
      expect(normalizeUserPreferences({ tasteCard: corrupt }).tasteCard).toEqual({
        showGenres: true,
        showPicks: true,
        coverScale: 1,
        picksLayout: 'list',
      });
    }
  });

  it('keeps taste card preferences when unrelated fields are normalized', () => {
    const normalized = normalizeUserPreferences({
      theme: 'nope',
      minimumCompatibilityScore: 'x',
      tasteCard: { showGenres: false, showPicks: false, coverScale: 1.1 },
    });

    expect(normalized.theme).toBe('dark');
    expect(normalized.minimumCompatibilityScore).toBe(0);
    expect(normalized.tasteCard).toEqual({
      showGenres: false,
      showPicks: false,
      coverScale: 1.1,
      picksLayout: 'list',
    });
  });
});
