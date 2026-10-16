import type { AppCopy } from '../locales';
import type { UserProfileSummary } from './profile-types';
import type { TasteLevel } from './taste-level';

export type CosmeticSlot = 'frame' | 'palette';

export type FrameId =
  'frame-classic' | 'frame-hairline' | 'frame-double' | 'frame-orbit' | 'frame-prism';

export type PaletteId = 'palette-aurora' | 'palette-tide' | 'palette-ember' | 'palette-mono';

export type CosmeticId = FrameId | PaletteId;

export interface TasteCardCosmetics {
  readonly frame: FrameId;
  readonly palette: PaletteId;
}

export const DEFAULT_COSMETICS: TasteCardCosmetics = {
  frame: 'frame-classic',
  palette: 'palette-aurora',
};

/**
 * A cosmetic opens on a signal the product already rewards (taste level, ratings, feedback) rather
 * than on a purchase or a timer, so the collection fills up as a side effect of using the extension.
 */
export type UnlockRequirement =
  | { readonly kind: 'default' }
  | { readonly kind: 'tasteLevel'; readonly level: number }
  | { readonly kind: 'ratedCount'; readonly count: number }
  | { readonly kind: 'feedbackCount'; readonly count: number };

export interface CosmeticUnlockContext {
  readonly level: number;
  readonly ratedCount: number;
  readonly feedbackCount: number;
}

export interface CosmeticDefinition {
  readonly id: CosmeticId;
  readonly slot: CosmeticSlot;
  readonly requirement: UnlockRequirement;
  readonly label: (copy: AppCopy) => string;
}

export const FRAME_COSMETICS: readonly CosmeticDefinition[] = [
  {
    id: 'frame-classic',
    slot: 'frame',
    requirement: { kind: 'default' },
    label: (copy) => copy.cosmeticFrameClassic,
  },
  {
    id: 'frame-hairline',
    slot: 'frame',
    requirement: { kind: 'tasteLevel', level: 3 },
    label: (copy) => copy.cosmeticFrameHairline,
  },
  {
    id: 'frame-double',
    slot: 'frame',
    requirement: { kind: 'ratedCount', count: 25 },
    label: (copy) => copy.cosmeticFrameDouble,
  },
  {
    id: 'frame-orbit',
    slot: 'frame',
    requirement: { kind: 'tasteLevel', level: 6 },
    label: (copy) => copy.cosmeticFrameOrbit,
  },
  {
    id: 'frame-prism',
    slot: 'frame',
    requirement: { kind: 'tasteLevel', level: 9 },
    label: (copy) => copy.cosmeticFramePrism,
  },
];

export const PALETTE_COSMETICS: readonly CosmeticDefinition[] = [
  {
    id: 'palette-aurora',
    slot: 'palette',
    requirement: { kind: 'default' },
    label: (copy) => copy.cosmeticPaletteAurora,
  },
  {
    id: 'palette-tide',
    slot: 'palette',
    requirement: { kind: 'feedbackCount', count: 5 },
    label: (copy) => copy.cosmeticPaletteTide,
  },
  {
    id: 'palette-ember',
    slot: 'palette',
    requirement: { kind: 'tasteLevel', level: 5 },
    label: (copy) => copy.cosmeticPaletteEmber,
  },
  {
    id: 'palette-mono',
    slot: 'palette',
    requirement: { kind: 'ratedCount', count: 60 },
    label: (copy) => copy.cosmeticPaletteMono,
  },
];

export const COSMETIC_CATALOG: readonly CosmeticDefinition[] = [
  ...FRAME_COSMETICS,
  ...PALETTE_COSMETICS,
];

export function cosmeticsForSlot(slot: CosmeticSlot): readonly CosmeticDefinition[] {
  return COSMETIC_CATALOG.filter((cosmetic) => cosmetic.slot === slot);
}

export function defaultCosmeticForSlot(slot: CosmeticSlot): CosmeticDefinition {
  const base = cosmeticsForSlot(slot).find((cosmetic) => cosmetic.requirement.kind === 'default');
  if (base === undefined) throw new Error(`No default cosmetic for the ${slot} slot.`);
  return base;
}

export function cosmeticById(id: unknown): CosmeticDefinition | null {
  return COSMETIC_CATALOG.find((cosmetic) => cosmetic.id === id) ?? null;
}

export function isFrameId(value: unknown): value is FrameId {
  return cosmeticById(value)?.slot === 'frame';
}

export function isPaletteId(value: unknown): value is PaletteId {
  return cosmeticById(value)?.slot === 'palette';
}

export function normalizeCosmetics(value: unknown): TasteCardCosmetics {
  if (!isRecord(value)) return DEFAULT_COSMETICS;
  return {
    frame: isFrameId(value.frame) ? value.frame : DEFAULT_COSMETICS.frame,
    palette: isPaletteId(value.palette) ? value.palette : DEFAULT_COSMETICS.palette,
  };
}

export function cosmeticUnlockContextFrom(
  summary: UserProfileSummary,
  level: TasteLevel,
): CosmeticUnlockContext {
  return {
    level: level.level,
    ratedCount: summary.ratedAnimeCount,
    feedbackCount: summary.feedbackCount,
  };
}

export function isCosmeticUnlocked(
  requirement: UnlockRequirement,
  context: CosmeticUnlockContext,
): boolean {
  switch (requirement.kind) {
    case 'default':
      return true;
    case 'tasteLevel':
      return context.level >= requirement.level;
    case 'ratedCount':
      return context.ratedCount >= requirement.count;
    case 'feedbackCount':
      return context.feedbackCount >= requirement.count;
  }
}

export function unlockedCosmetics(context: CosmeticUnlockContext): ReadonlySet<CosmeticId> {
  return new Set(
    COSMETIC_CATALOG.filter((cosmetic) => isCosmeticUnlocked(cosmetic.requirement, context)).map(
      (cosmetic) => cosmetic.id,
    ),
  );
}

/**
 * A stored selection can outlive its unlock — an imported export, or a sync that arrives before the
 * list does — so anything no longer earned is dropped here instead of being painted.
 */
export function resolveCosmetics(
  selected: TasteCardCosmetics,
  unlocked: ReadonlySet<CosmeticId>,
): TasteCardCosmetics {
  return {
    frame: unlocked.has(selected.frame) ? selected.frame : DEFAULT_COSMETICS.frame,
    palette: unlocked.has(selected.palette) ? selected.palette : DEFAULT_COSMETICS.palette,
  };
}

export function cosmeticRequirementLabel(cosmetic: CosmeticDefinition, copy: AppCopy): string {
  const { requirement } = cosmetic;
  switch (requirement.kind) {
    case 'default':
      return copy.cosmeticUnlockedFromStart;
    case 'tasteLevel':
      return copy.cosmeticNeedLevel(requirement.level);
    case 'ratedCount':
      return copy.cosmeticNeedRated(requirement.count);
    case 'feedbackCount':
      return copy.cosmeticNeedFeedback(requirement.count);
  }
}

/** Only countable requirements report progress; a level gate defers to the taste level card. */
export function cosmeticRequirementProgress(
  cosmetic: CosmeticDefinition,
  context: CosmeticUnlockContext,
): { readonly current: number; readonly target: number } | null {
  const { requirement } = cosmetic;
  if (requirement.kind === 'ratedCount')
    return { current: Math.min(context.ratedCount, requirement.count), target: requirement.count };
  if (requirement.kind === 'feedbackCount')
    return {
      current: Math.min(context.feedbackCount, requirement.count),
      target: requirement.count,
    };
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
