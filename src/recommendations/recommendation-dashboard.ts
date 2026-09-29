import type { Anime, AnimeListEntry } from '../domain/anime';
import type { Recommendation, RecommendationCategory } from '../domain/recommendation';
import type { RecommendationFeedback } from '../domain/feedback';
import type { SyncMetadata } from '../domain/sync';
import {
  normalizeUserPreferences,
  toRecommendationDiscoveryPreferences,
} from '../settings/settings-types';
import { generateRecommendations } from './recommendation-engine';
import type {
  DashboardRecommendationSnapshot,
  RecommendationSection,
  RecommendationSectionId,
} from './recommendation-messages';

const SECTION_DEFINITIONS: readonly {
  readonly id: RecommendationSectionId;
  readonly categories: readonly RecommendationCategory[];
  readonly title: string;
}[] = [
  {
    id: 'highly-compatible',
    categories: ['highly-compatible'],
    title: 'Highly Compatible',
  },
  {
    id: 'because-you-liked',
    categories: ['because-you-liked'],
    title: 'Because You Liked...',
  },
  {
    id: 'hidden-gem',
    categories: ['hidden-gem'],
    title: 'Hidden Gems',
  },
  {
    id: 'explore',
    categories: ['explore', 'genre-discovery'],
    title: 'Explore',
  },
];

export type ExtraCandidatesFetcher = () => Promise<readonly Anime[]>;

export async function buildDashboardRecommendationSnapshot(
  entries: readonly AnimeListEntry[],
  sync: SyncMetadata,
  persistedPreferences: unknown,
  feedback: readonly RecommendationFeedback[],
  generatedAt: string,
  fetchExtraCandidates?: ExtraCandidatesFetcher,
): Promise<DashboardRecommendationSnapshot> {
  const preferences = normalizeUserPreferences(persistedPreferences);
  const watched = entries.filter((entry) => entry.status !== 'plan_to_watch');
  const planToWatch = entries
    .filter((entry) => entry.status === 'plan_to_watch')
    .map((entry) => entry.anime);
  // The user's plan-to-watch list alone is usually tiny (it *is* the list of
  // things they already queued), which starves every recommendation section.
  // MAL's personalized suggestions widen the pool with titles the user has
  // not listed yet; failures degrade gracefully to plan-to-watch only.
  let candidates = planToWatch;
  try {
    const suggestions = (await fetchExtraCandidates?.()) ?? [];
    if (suggestions.length > 0) {
      const knownIds = new Set([
        ...watched.map((entry) => entry.anime.id),
        ...planToWatch.map((anime) => anime.id),
      ]);
      candidates = [...planToWatch, ...suggestions.filter((anime) => !knownIds.has(anime.id))];
    }
  } catch {
    // Suggestions are an enhancement, never a hard dependency.
  }
  const recommendations = generateRecommendations(
    { watched, candidates, feedback },
    {
      // Keep every eligible candidate so Highly Compatible can expose every
      // unseen title scoring above its section threshold.
      limit: candidates.length,
      discovery: toRecommendationDiscoveryPreferences(preferences),
      generatedAt,
      language: preferences.language,
    },
  );
  const sections = createSections(recommendations);
  const daily = recommendations[0] ?? null;
  const hasNoData = entries.length === 0;
  const status =
    sync.status === 'offline'
      ? 'offline'
      : hasNoData || recommendations.length === 0
        ? 'empty'
        : 'ready';

  return {
    status,
    daily,
    sections,
    analyzedCount: entries.length,
    generatedAt: daily?.generatedAt ?? null,
    sync,
    errorMessage: null,
  };
}

export function createEmptyDashboardRecommendationSnapshot(
  sync: SyncMetadata | null = null,
): DashboardRecommendationSnapshot {
  return {
    status: sync?.status === 'offline' ? 'offline' : 'empty',
    daily: null,
    sections: createSections([]),
    analyzedCount: 0,
    generatedAt: null,
    sync,
    errorMessage: null,
  };
}

function createSections(recommendations: readonly Recommendation[]): RecommendationSection[] {
  return SECTION_DEFINITIONS.map((definition) => ({
    id: definition.id,
    title: definition.title,
    recommendations: recommendations.filter((item) =>
      definition.categories.includes(item.category),
    ),
  }));
}
