import { describe, expect, it } from 'vitest';
import {
  fitRatingModel,
  predictUserRating,
  RATING_MODEL_MAX_SLOPE,
  RATING_MODEL_MIN_SAMPLES,
  RATING_MODEL_MIN_SLOPE,
  RATING_SCALE_MAX,
  RATING_SCALE_MIN,
  type RatingSample,
} from '../src/recommendations/rating-model';

function samples(pairs: readonly (readonly [number, number])[]): RatingSample[] {
  return pairs.map(([communityScore, userScore]) => ({ communityScore, userScore }));
}

const TRENDING_LINE: readonly (readonly [number, number])[] = [
  [6.0, 6.0],
  [6.5, 6.5],
  [7.0, 7.0],
  [7.5, 7.5],
  [8.0, 8.0],
  [8.5, 8.5],
  [9.0, 9.0],
  [9.5, 9.5],
];

describe('fitRatingModel', () => {
  it('learns an identity rescaling, so quality scores are unchanged for an average rater', () => {
    const model = fitRatingModel(samples(TRENDING_LINE));

    expect(model).not.toBeNull();
    expect(model?.slope).toBeCloseTo(1, 5);
    expect(model?.intercept).toBeCloseTo(0, 5);
    expect(model?.sampleCount).toBe(RATING_MODEL_MIN_SAMPLES);
  });

  it('learns a generous rater, so a 7.6 community title is not treated as a 7.6 experience', () => {
    const generous = fitRatingModel(samples(TRENDING_LINE.map(([c]) => [c, c + 1.5])));

    expect(generous?.slope).toBeCloseTo(1, 5);
    expect(generous?.intercept).toBeCloseTo(1.5, 5);
    expect(predictUserRating(generous, 7.6)).toBeCloseTo(9.1, 5);
  });

  it('learns a harsh rater, so an 8.1 community title does not clear a high bar by itself', () => {
    const harsh = fitRatingModel(samples(TRENDING_LINE.map(([c]) => [c, c - 2])));

    expect(harsh?.intercept).toBeCloseTo(-2, 5);
    expect(predictUserRating(harsh, 8.1)).toBeCloseTo(6.1, 5);
  });

  it('learns a flat rater as shallow rather than flat, so quality still separates candidates', () => {
    const flat = fitRatingModel(samples(TRENDING_LINE.map(([c]) => [c, 8])));

    expect(flat?.slope).toBe(RATING_MODEL_MIN_SLOPE);
    expect(predictUserRating(flat, 9)).toBeGreaterThan(predictUserRating(flat, 7));
  });

  it('refuses to model too little evidence rather than trusting two entries', () => {
    expect(
      fitRatingModel(samples(TRENDING_LINE.slice(0, RATING_MODEL_MIN_SAMPLES - 1))),
    ).toBeNull();
  });

  it('refuses to model a rater whose titles all share one community score', () => {
    expect(
      fitRatingModel(
        samples([
          [7, 6],
          [7, 7],
          [7, 8],
          [7, 9],
          [7, 10],
          [7, 5],
          [7, 8],
          [7, 9],
        ]),
      ),
    ).toBeNull();
  });

  it('pins an implausible slope instead of extrapolating it', () => {
    const volatile = fitRatingModel(
      samples(TRENDING_LINE.map(([c], index) => [c, index < 4 ? 1 : 10])),
    );

    expect(volatile?.slope).toBe(RATING_MODEL_MAX_SLOPE);
  });

  it('keeps every prediction on the 1-10 scale', () => {
    const generous = fitRatingModel(samples(TRENDING_LINE.map(([c]) => [c, c + 4])));
    const harsh = fitRatingModel(samples(TRENDING_LINE.map(([c]) => [c, c - 4])));

    for (const model of [generous, harsh]) {
      for (const communityScore of [0, 5, 10]) {
        const predicted = predictUserRating(model, communityScore);
        expect(predicted).toBeGreaterThanOrEqual(RATING_SCALE_MIN);
        expect(predicted).toBeLessThanOrEqual(RATING_SCALE_MAX);
      }
    }
  });

  it('falls back to the community score itself when there is no model', () => {
    expect(predictUserRating(null, 7.4)).toBeCloseTo(7.4, 5);
    expect(predictUserRating(null, 12)).toBe(RATING_SCALE_MAX);
  });
});
