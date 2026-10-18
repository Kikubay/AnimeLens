import { describe, expect, it } from 'vitest';
import { tasteRecencyWeight, TASTE_DECAY_HALF_LIFE_MS } from '../src/recommendations/taste-decay';

const NOW = '2026-10-01T00:00:00.000Z';

function yearsAgo(years: number): string {
  return new Date(Date.parse(NOW) - years * 365 * 24 * 60 * 60 * 1000).toISOString();
}

describe('tasteRecencyWeight', () => {
  it('keeps a signal from today at full strength', () => {
    expect(tasteRecencyWeight(NOW, NOW)).toBe(1);
  });

  it('halves the weight once per half-life', () => {
    const oneHalfLife = new Date(Date.parse(NOW) - TASTE_DECAY_HALF_LIFE_MS).toISOString();
    const twoHalfLives = new Date(Date.parse(NOW) - TASTE_DECAY_HALF_LIFE_MS * 2).toISOString();

    expect(tasteRecencyWeight(oneHalfLife, NOW)).toBeCloseTo(0.5, 6);
    expect(tasteRecencyWeight(twoHalfLives, NOW)).toBeCloseTo(0.25, 6);
  });

  it('decays monotonically and never leaves (0, 1]', () => {
    const weights = [0, 1, 3, 6, 10, 20].map((years) => tasteRecencyWeight(yearsAgo(years), NOW));

    for (const [index, weight] of weights.entries()) {
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThanOrEqual(1);
      if (index > 0) expect(weight).toBeLessThan(weights[index - 1] ?? 1);
    }
  });

  it('treats a missing timestamp as unknown age rather than as ancient', () => {
    expect(tasteRecencyWeight(null, NOW)).toBe(1);
  });

  it('refuses to decay what it cannot read', () => {
    expect(tasteRecencyWeight('not-a-date', NOW)).toBe(1);
    expect(tasteRecencyWeight(NOW, 'not-a-date')).toBe(1);
  });

  it('does not punish a timestamp in the future, which is a clock skew and not a taste change', () => {
    expect(tasteRecencyWeight(yearsAgo(-2), NOW)).toBe(1);
  });
});
