import { featurePreferenceStrength } from './recommendation-engine';
import type {
  FeaturePreference,
  FeaturePreferenceMap,
  RecommendationProfile,
} from './recommendation-types';

/** A provider tag filter ORs whatever it is given, so a cluster widens a query rather than narrowing it. */
export const TASTE_CLUSTER_SIZE = 3;
export const TASTE_CLUSTER_LIMIT = 3;
/** Below this the evidence is neutral, so querying it would only dilute the pool. */
export const TASTE_MIN_FEATURE_SCORE = 0.62;
const TASTE_MIN_FEATURE_STRENGTH = (TASTE_MIN_FEATURE_SCORE - 0.5) * 2;

export interface TasteClusters {
  readonly clusters: readonly (readonly string[])[];
  /** Empty when nothing is worth querying for, which leaves the pool on the global popularity slice. */
  readonly seed: string;
}

export function buildTasteClusters(profile: RecommendationProfile): TasteClusters {
  // A MAL theme and an AniList tag are the same label, so one name must not claim two of the limited clusters.
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
