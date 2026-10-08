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

const MAX_DASHBOARD_RECOMMENDATIONS = 100;
const MAX_SECTION_RECOMMENDATIONS = 24;

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
  // Plan-to-watch alone is usually tiny (it *is* the list of things already queued), which starves every section; suggestions widen the pool with unlisted titles.
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
    // Never a hard dependency.
  }
  const recommendations = generateRecommendations(
    { watched, candidates, feedback },
    {
      // Every section is capped below anyway, so asking the engine for one full candidate list per section is what keeps the payload and the diversification pass bounded.
      limit: MAX_DASHBOARD_RECOMMENDATIONS,
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

export function withCurrentSync(
  snapshot: DashboardRecommendationSnapshot,
  sync: SyncMetadata,
): DashboardRecommendationSnapshot {
  const status =
    sync.status === 'offline'
      ? 'offline'
      : snapshot.status === 'offline'
        ? 'ready'
        : snapshot.status;
  return { ...snapshot, status, sync };
}

function createSections(recommendations: readonly Recommendation[]): RecommendationSection[] {
  return SECTION_DEFINITIONS.map((definition) => ({
    id: definition.id,
    title: definition.title,
    recommendations: recommendations
      .filter((item) => definition.categories.includes(item.category))
      .slice(0, MAX_SECTION_RECOMMENDATIONS),
  }));
}
