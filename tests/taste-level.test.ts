import { describe, expect, it } from 'vitest';
import {
  MAX_TASTE_LEVEL,
  computeTasteLevel,
  tasteLevelFromXp,
  xpRequiredForLevel,
} from '../src/profile/taste-level';
import { emptyProfileSummary } from '../src/profile/profile-types';
import type { UserProfileSummary } from '../src/profile/profile-types';

function summary(overrides: Partial<UserProfileSummary> = {}): UserProfileSummary {
  return { ...emptyProfileSummary(), ...overrides };
}

function preference(name: string) {
  return { name, score: 80, positive: 8, negative: 0, count: 8 };
}

function detected(label: string) {
  return { key: 'richWorlds' as const, label, detail: 'detail', score: 80 };
}

describe('xpRequiredForLevel', () => {
  it('starts at zero and steepens at every level', () => {
    const required = [2, 3, 4, 5].map((level) => xpRequiredForLevel(level));

    expect(xpRequiredForLevel(1)).toBe(0);
    expect(required).toEqual([...required].sort((left, right) => left - right));
    expect(new Set(required).size).toBe(required.length);
  });

  it('never goes below zero for a level at or under the first', () => {
    expect(xpRequiredForLevel(0)).toBe(0);
    expect(xpRequiredForLevel(-5)).toBe(0);
  });
});

describe('tasteLevelFromXp', () => {
  it('puts zero xp on the first level', () => {
    expect(tasteLevelFromXp(0)).toBe(1);
    expect(tasteLevelFromXp(xpRequiredForLevel(2) - 1)).toBe(1);
  });

  it('promotes exactly on the threshold', () => {
    for (let level = 2; level <= MAX_TASTE_LEVEL; level += 1) {
      const threshold = xpRequiredForLevel(level);
      expect(tasteLevelFromXp(threshold - 1)).toBe(level - 1);
      expect(tasteLevelFromXp(threshold)).toBe(level);
    }
  });

  it('never exceeds the maximum level', () => {
    expect(tasteLevelFromXp(1_000_000)).toBe(MAX_TASTE_LEVEL);
    expect(MAX_TASTE_LEVEL).toBeGreaterThan(1);
  });
});

describe('computeTasteLevel', () => {
  it('reports a first level with no xp and no progress for an empty profile', () => {
    const level = computeTasteLevel(emptyProfileSummary());

    expect(level.level).toBe(1);
    expect(level.xp).toBe(0);
    expect(level.xpIntoLevel).toBe(0);
    expect(level.progress).toBe(0);
    expect(level.isMaxLevel).toBe(false);
    expect(level.sources).toEqual([]);
    expect(level.title).toBe('Curious Newcomer');
  });

  it('awards xp for every signal the profile already measures', () => {
    const level = computeTasteLevel(
      summary({
        analyzedAnimeCount: 10,
        ratedAnimeCount: 6,
        feedbackCount: 4,
        detectedPreferences: [detected('a'), detected('b')],
        favoriteGenres: [preference('Fantasy')],
      }),
    );

    const byKey = Object.fromEntries(level.sources.map((source) => [source.key, source.xp]));
    expect(byKey.analyzed).toBe(20);
    expect(byKey.rated).toBe(18);
    expect(byKey.feedback).toBe(24);
    expect(byKey.preferences).toBe(60);
    expect(byKey.dimensions).toBe(6);
    expect(level.xp).toBe(128);
    expect(level.level).toBe(1);
    expect(level.xpIntoLevel).toBe(128);
    expect(level.xpForNextLevel).toBe(xpRequiredForLevel(2));
  });

  it('omits sources that contributed nothing', () => {
    const level = computeTasteLevel(summary({ analyzedAnimeCount: 5 }));

    expect(level.sources.map((source) => source.key)).toEqual(['analyzed']);
  });

  it('counts the accumulated streak xp as a source of its own', () => {
    const profile = summary({ analyzedAnimeCount: 10 });
    const level = computeTasteLevel(profile, 'en', 150);

    expect(level.sources.find((source) => source.key === 'streak')?.xp).toBe(150);
    expect(level.xp).toBe(20 + 150);
    // A corrupt counter can never subtract from the level.
    expect(computeTasteLevel(profile, 'en', -500).xp).toBe(20);
    expect(computeTasteLevel(profile, 'en').sources.map((source) => source.key)).not.toContain(
      'streak',
    );
  });

  it('never lets one source out-earn the first level on its own', () => {
    const widestDimensions = computeTasteLevel(
      summary({
        favoriteGenres: [
          preference('a'),
          preference('b'),
          preference('c'),
          preference('d'),
          preference('e'),
        ],
        favoriteThemes: [
          preference('a'),
          preference('b'),
          preference('c'),
          preference('d'),
          preference('e'),
        ],
        favoriteStudios: [
          preference('a'),
          preference('b'),
          preference('c'),
          preference('d'),
          preference('e'),
        ],
      }),
    );

    expect(widestDimensions.xp).toBeLessThan(xpRequiredForLevel(2));
    expect(widestDimensions.level).toBe(1);
  });

  it('always reports progress inside the current level', () => {
    for (let analyzed = 0; analyzed <= 400; analyzed += 7) {
      const level = computeTasteLevel(summary({ analyzedAnimeCount: analyzed }));
      expect(level.progress, `analyzed=${analyzed}`).toBeGreaterThanOrEqual(0);
      expect(level.progress, `analyzed=${analyzed}`).toBeLessThanOrEqual(100);
      expect(level.xpIntoLevel).toBeLessThanOrEqual(level.xpForNextLevel);
    }
  });

  it('caps progress and stops asking for the next level at the maximum', () => {
    const level = computeTasteLevel(summary({ analyzedAnimeCount: 100_000 }));

    expect(level.level).toBe(MAX_TASTE_LEVEL);
    expect(level.isMaxLevel).toBe(true);
    expect(level.progress).toBe(100);
    expect(level.xpForNextLevel).toBe(0);
    expect(level.nextTitle).toBeNull();
    expect(level.nextTitleLevel).toBeNull();
  });

  it('only advances the title once the level is reached', () => {
    const ladder = [50, 51, 120, 121].map(
      (analyzed) => computeTasteLevel(summary({ analyzedAnimeCount: analyzed })).title,
    );

    expect(ladder[0]).toBe(ladder[1]);
    expect(ladder[2]).toBe(ladder[3]);
    expect(ladder[0]).not.toBe(ladder[2]);
  });

  it('points at a title the user does not hold yet', () => {
    for (let analyzed = 0; analyzed <= 400; analyzed += 3) {
      const level = computeTasteLevel(summary({ analyzedAnimeCount: analyzed }));
      if (level.isMaxLevel) continue;
      expect(level.nextTitle, `analyzed=${analyzed}`).not.toBeNull();
      expect(level.nextTitle, `analyzed=${analyzed}`).not.toBe(level.title);
      expect(level.nextTitleLevel, `analyzed=${analyzed}`).toBeGreaterThan(level.level);
    }
  });

  it('never claims xp it did not award', () => {
    const level = computeTasteLevel(
      summary({
        analyzedAnimeCount: 37,
        ratedAnimeCount: 21,
        feedbackCount: 9,
        detectedPreferences: [detected('a'), detected('b'), detected('c')],
        favoriteGenres: [preference('Fantasy'), preference('Drama')],
        favoriteThemes: [preference('Worldbuilding')],
        favoriteStudios: [preference('Studio North')],
      }),
    );

    expect(level.xp).toBe(level.sources.reduce((total, source) => total + source.xp, 0));
  });

  it('localizes the title it hands back', () => {
    const profile = summary({ analyzedAnimeCount: 200 });
    const french = computeTasteLevel(profile, 'fr');
    const english = computeTasteLevel(profile, 'en');

    expect(english.title).not.toBe(french.title);
    expect(english.nextTitle).not.toBe(french.nextTitle);
    expect(french.sources.map((source) => source.label)).not.toEqual(
      english.sources.map((source) => source.label),
    );
  });

  it('labels every source it reports in the requested language', () => {
    const profile = summary({ analyzedAnimeCount: 10, ratedAnimeCount: 10 });
    expect(computeTasteLevel(profile, 'en').sources[0]?.label).toBe('Anime analyzed');
    expect(computeTasteLevel(profile, 'fr').sources[0]?.label).toBe('Anime analysés');
  });
});
