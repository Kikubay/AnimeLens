import { featurePreferenceStrength } from './recommendation-engine';
import type {
  FeaturePreference,
  FeaturePreferenceMap,
  RecommendationProfile,
} from './recommendation-types';

/**
 * A provider tag filter is an OR over the tags it is given, so a cluster is a set of sibling tastes to widen a query with,
 * never a set of tags that must all match.
 */
export const TASTE_CLUSTER_SIZE = 3;
export const TASTE_CLUSTER_LIMIT = 3;
/** Below this a feature is treated as neutral, and spending a request on it would only dilute the pool. */
export const TASTE_MIN_FEATURE_SCORE = 0.62;
const TASTE_MIN_FEATURE_STRENGTH = (TASTE_MIN_FEATURE_SCORE - 0.5) * 2;

export interface TasteClusters {
  readonly clusters: readonly (readonly string[])[];
  /** Empty when the profile has no taste strong enough to query, which makes the pool fall back to the global slice. */
  readonly seed: string;
}

/**
 * Turns a taste profile into the tag groups used to widen the candidate pool beyond the global popularity chart.
 */
export function buildTasteClusters(profile: RecommendationProfile): TasteClusters {
  // AniList splits genres from free-form tags, but a MAL theme and an AniList tag are the same kind of label, so one
  // name must not consume two of the limited clusters.
  const claimed = new Set<string>();
  const take = (preferences: FeaturePreferenceMap): readonly string[] =>
    rankByStrength(preferences)
      .filter(([name]) => !claimed.has(name))
      .map(([name]) => {
        claimed.add(name);
        return name;
      });

  const genres = take(profile.genres);
  const themes = take(profile.themes);

  const clusters: string[][] = [];
  for (
    let start = 0;
    start < genres.length && clusters.length < TASTE_CLUSTER_LIMIT;
    start += TASTE_CLUSTER_SIZE
  ) {
    clusters.push(genres.slice(start, start + TASTE_CLUSTER_SIZE));
  }
  if (themes.length > 0 && clusters.length < TASTE_CLUSTER_LIMIT) {
    clusters.push(themes.slice(0, TASTE_CLUSTER_SIZE));
  }

  const filled = clusters.filter((cluster) => cluster.length > 0);
  return { clusters: filled, seed: filled.map((cluster) => cluster.join(',')).join('|') };
}

function rankByStrength(preferences: FeaturePreferenceMap): readonly [string, FeaturePreference][] {
  return [...preferences.entries()]
    .filter(([, preference]) => featurePreferenceStrength(preference) >= TASTE_MIN_FEATURE_STRENGTH)
    .sort(
      ([leftName, left], [rightName, right]) =>
        featurePreferenceStrength(right) - featurePreferenceStrength(left) ||
        compareNames(leftName, rightName),
    );
}

function compareNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
