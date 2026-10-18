export interface RatingSample {
  readonly communityScore: number;
  readonly userScore: number;
}

export interface RatingModel {
  readonly intercept: number;
  readonly slope: number;
  readonly sampleCount: number;
}

/** Below this the fit is dominated by a couple of entries, so the model claims more confidence than the data. */
export const RATING_MODEL_MIN_SAMPLES = 8;
/** A slope outside this range describes a rater who ignores the community score or overreacts to it. */
export const RATING_MODEL_MIN_SLOPE = 0.5;
export const RATING_MODEL_MAX_SLOPE = 2;
export const RATING_SCALE_MIN = 1;
export const RATING_SCALE_MAX = 10;

const VARIANCE_FLOOR = 0.25;

/**
 * Least-squares fit of `userScore ≈ intercept + slope * communityScore`, where the intercept carries rating generosity
 * and the slope carries discrimination. `null` means no usable evidence, never an assumed average user.
 */
export function fitRatingModel(samples: readonly RatingSample[]): RatingModel | null {
  if (samples.length < RATING_MODEL_MIN_SAMPLES) return null;

  const meanCommunity = mean(samples.map((sample) => sample.communityScore));
  const meanUser = mean(samples.map((sample) => sample.userScore));

  let variance = 0;
  let covariance = 0;
  for (const sample of samples) {
    const communityDelta = sample.communityScore - meanCommunity;
    variance += communityDelta * communityDelta;
    covariance += communityDelta * (sample.userScore - meanUser);
  }
  if (variance < VARIANCE_FLOOR) return null;

  const slope = clamp(covariance / variance, RATING_MODEL_MIN_SLOPE, RATING_MODEL_MAX_SLOPE);
  return {
    slope,
    intercept: meanUser - slope * meanCommunity,
    sampleCount: samples.length,
  };
}

/** How this user is expected to rate a title the community scored `communityScore`, on their own 1-10 scale. */
export function predictUserRating(model: RatingModel | null, communityScore: number): number {
  if (model === null) return clamp(communityScore, RATING_SCALE_MIN, RATING_SCALE_MAX);
  return clamp(model.intercept + model.slope * communityScore, RATING_SCALE_MIN, RATING_SCALE_MAX);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
