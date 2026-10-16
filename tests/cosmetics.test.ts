import { describe, expect, it } from 'vitest';
import { emptyProfileSummary } from '../src/profile/profile-types';
import { computeTasteLevel, tasteLevelFromXp } from '../src/profile/taste-level';
import { getCopy } from '../src/locales';
import {
  COSMETIC_CATALOG,
  cosmeticById,
  cosmeticRequirementLabel,
  cosmeticRequirementProgress,
  cosmeticUnlockContextFrom,
  cosmeticsForSlot,
  DEFAULT_COSMETICS,
  FRAME_COSMETICS,
  isCosmeticUnlocked,
  normalizeCosmetics,
  PALETTE_COSMETICS,
  resolveCosmetics,
  unlockedCosmetics,
  type CosmeticUnlockContext,
} from '../src/profile/cosmetics';

const copy = getCopy('en');

function context(overrides: Partial<CosmeticUnlockContext> = {}): CosmeticUnlockContext {
  return { level: 1, ratedCount: 0, feedbackCount: 0, ...overrides };
}

describe('cosmetic catalog', () => {
  it('gives every item a unique id and one slot', () => {
    const ids = COSMETIC_CATALOG.map((cosmetic) => cosmetic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const cosmetic of COSMETIC_CATALOG) {
      expect(cosmetic.id.startsWith(`${cosmetic.slot}-`)).toBe(true);
    }
  });

  it('offers exactly one default per slot, so an unreachable selection always has a fallback', () => {
    for (const slot of ['frame', 'palette'] as const) {
      const defaults = cosmeticsForSlot(slot).filter(
        (cosmetic) => cosmetic.requirement.kind === 'default',
      );
      expect(defaults).toHaveLength(1);
      expect(DEFAULT_COSMETICS[slot]).toBe(defaults[0]?.id);
    }
  });

  it('labels every item in every language', () => {
    for (const language of ['en', 'fr'] as const) {
      const localized = getCopy(language);
      for (const cosmetic of COSMETIC_CATALOG) {
        expect(cosmetic.label(localized).length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the ids the painter and the picker both depend on', () => {
    expect(FRAME_COSMETICS.map((cosmetic) => cosmetic.id)).toEqual([
      'frame-classic',
      'frame-hairline',
      'frame-double',
      'frame-orbit',
      'frame-prism',
    ]);
    expect(PALETTE_COSMETICS.map((cosmetic) => cosmetic.id)).toEqual([
      'palette-aurora',
      'palette-tide',
      'palette-ember',
      'palette-mono',
    ]);
  });
});

describe('cosmetic unlocks', () => {
  it('opens only the defaults for a brand new profile', () => {
    expect([...unlockedCosmetics(context())].sort()).toEqual(['frame-classic', 'palette-aurora']);
  });

  it('opens each level gate exactly at its taste level', () => {
    for (const cosmetic of COSMETIC_CATALOG) {
      const requirement = cosmetic.requirement;
      if (requirement.kind !== 'tasteLevel') continue;
      expect(isCosmeticUnlocked(requirement, context({ level: requirement.level - 1 }))).toBe(
        false,
      );
      expect(isCosmeticUnlocked(requirement, context({ level: requirement.level }))).toBe(true);
    }
  });

  it('opens each count gate at its count, and never counts past the target', () => {
    const double = cosmeticById('frame-double');
    const tide = cosmeticById('palette-tide');
    expect(double?.requirement).toEqual({ kind: 'ratedCount', count: 25 });
    expect(tide?.requirement).toEqual({ kind: 'feedbackCount', count: 5 });

    expect(isCosmeticUnlocked({ kind: 'ratedCount', count: 25 }, context({ ratedCount: 24 }))).toBe(
      false,
    );
    expect(isCosmeticUnlocked({ kind: 'ratedCount', count: 25 }, context({ ratedCount: 25 }))).toBe(
      true,
    );
    expect(cosmeticRequirementProgress(double!, context({ ratedCount: 40 }))).toEqual({
      current: 25,
      target: 25,
    });
  });

  it('never takes an unlock away as the profile grows', () => {
    let previous = unlockedCosmetics(context());
    for (let level = 2; level <= 20; level += 1) {
      const next = unlockedCosmetics(context({ level }));
      for (const id of previous) expect(next.has(id)).toBe(true);
      previous = next;
    }
  });

  it('is reachable from the taste level the XP sources actually produce', () => {
    // A long-running heavy user, not a theoretical maximum: every gate has to fall inside it or the item is decoration.
    const summary = {
      ...emptyProfileSummary(),
      analyzedAnimeCount: 800,
      ratedAnimeCount: 400,
      feedbackCount: 50,
    };
    const level = computeTasteLevel(summary, 'en');
    expect(level.level).toBeGreaterThanOrEqual(9);
    expect(unlockedCosmetics(cosmeticUnlockContextFrom(summary, level)).size).toBe(
      COSMETIC_CATALOG.length,
    );
  });

  it('reads its context from the profile summary and taste level', () => {
    const summary = { ...emptyProfileSummary(), ratedAnimeCount: 12, feedbackCount: 3 };
    expect(cosmeticUnlockContextFrom(summary, computeTasteLevel(summary, 'en'))).toEqual({
      level: tasteLevelFromXp(0),
      ratedCount: 12,
      feedbackCount: 3,
    });
  });

  it('reports no progress for a level gate, which the taste level card already shows', () => {
    expect(
      cosmeticRequirementProgress(cosmeticById('frame-orbit')!, context({ level: 3 })),
    ).toBeNull();
    expect(cosmeticRequirementLabel(cosmeticById('frame-orbit')!, copy)).toBe(
      'Reach taste level 6',
    );
  });
});

describe('cosmetic selection', () => {
  it('falls back to the defaults for missing or unknown values', () => {
    expect(normalizeCosmetics(undefined)).toEqual(DEFAULT_COSMETICS);
    expect(normalizeCosmetics({ frame: 'frame-prism' })).toEqual({
      ...DEFAULT_COSMETICS,
      frame: 'frame-prism',
    });
    expect(normalizeCosmetics({ frame: 'frame-gold', palette: 42 })).toEqual(DEFAULT_COSMETICS);
  });

  it('refuses an id from the other slot, so a selection cannot cross over', () => {
    expect(normalizeCosmetics({ frame: 'palette-tide' }).frame).toBe(DEFAULT_COSMETICS.frame);
  });

  it('keeps a stored selection the user has earned', () => {
    const unlocked = unlockedCosmetics(context({ level: 11, ratedCount: 60, feedbackCount: 5 }));
    const equipped = { frame: 'frame-prism', palette: 'palette-mono' } as const;
    expect(resolveCosmetics(equipped, unlocked)).toEqual(equipped);
  });

  it('drops a stored selection that is no longer unlocked', () => {
    const selection = { frame: 'frame-prism', palette: 'palette-ember' } as const;
    const unlocked = unlockedCosmetics(context({ level: 7, ratedCount: 30, feedbackCount: 5 }));
    expect(resolveCosmetics(selection, unlocked)).toEqual({
      frame: 'frame-classic',
      palette: 'palette-ember',
    });
  });
});
