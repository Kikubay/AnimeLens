import type { RecommendationFeedback } from '../domain/feedback';
import { isProviderId } from '../providers/provider-registry';
import type { StoredProfileHistory } from '../storage/storage-types';
import { normalizeUserPreferences, type UserPreferences } from './settings-types';

export const DATA_EXPORT_APP = 'animelens';
export const DATA_EXPORT_VERSION = 1;

/**
 * Allow-list, never a denylist: `animeData*`, `profile`, `session` and the OAuth client ids are
 * MyAnimeList/AniList content or credentials, so a new key added elsewhere cannot leak into an export
 * unless it is deliberately added here as well.
 */
export const EXPORTED_STORAGE_KEYS = [
  'feedback',
  'preferences',
  'activeProvider',
  'manual_top_3_ranking',
  'manual_top_3_pool_signature',
  'profileHistory',
] as const;

export type ExportedStorageKey = (typeof EXPORTED_STORAGE_KEYS)[number];

export const EXCLUDED_STORAGE_KEYS = [
  'animeData',
  'animeData:mal',
  'animeData:anilist',
  'profile',
  'session',
  'malClientId',
  'anilistClientId',
  'updateCheck',
] as const;

export interface DataExportPayload {
  readonly feedback: readonly RecommendationFeedback[];
  readonly preferences: UserPreferences;
  readonly activeProvider: string | null;
  readonly manualTop3Ranking: readonly number[] | null;
  readonly manualTop3PoolSignature: string | null;
  readonly profileHistory: Readonly<Record<string, StoredProfileHistory>>;
}

export interface DataExport {
  readonly app: typeof DATA_EXPORT_APP;
  readonly version: number;
  readonly exportedAt: string;
  readonly data: DataExportPayload;
}

export type DataExportSummary = {
  readonly feedback: number;
  readonly profileSnapshots: number;
  readonly hasPreferences: boolean;
};

export function buildDataExport(stored: DataExportSource, exportedAt: string): DataExport {
  return {
    app: DATA_EXPORT_APP,
    version: DATA_EXPORT_VERSION,
    exportedAt,
    data: {
      feedback: readFeedback(stored.feedback),
      preferences: normalizeUserPreferences(stored.preferences),
      activeProvider: readProvider(stored.activeProvider),
      manualTop3Ranking: readRanking(stored.manual_top_3_ranking),
      manualTop3PoolSignature: readSignature(stored.manual_top_3_pool_signature),
      profileHistory: readProfileHistory(stored.profileHistory) ?? {},
    },
  };
}

export function summarizeDataExport(payload: DataExportPayload): DataExportSummary {
  return {
    feedback: payload.feedback.length,
    profileSnapshots: Object.values(payload.profileHistory).reduce(
      (total, history) => total + history.snapshots.length,
      0,
    ),
    hasPreferences: true,
  };
}

export function parseDataExport(value: unknown): DataExport | null {
  if (!isRecord(value)) return null;
  if (value.app !== DATA_EXPORT_APP) return null;
  if (value.version !== DATA_EXPORT_VERSION) return null;
  if (typeof value.exportedAt !== 'string') return null;
  if (!isRecord(value.data)) return null;

  const data = value.data;
  if (!Array.isArray(data.feedback) || !data.feedback.every(isRecommendationFeedback)) return null;
  if (!isRecord(data.profileHistory)) return null;

  const profileHistory = readProfileHistory(data.profileHistory);
  if (profileHistory === null) return null;

  const provider = data.activeProvider;
  if (provider !== null && !isProviderId(provider)) return null;
  if (data.manualTop3Ranking !== null && !isRanking(data.manualTop3Ranking)) return null;
  if (data.manualTop3PoolSignature !== null && !isSignature(data.manualTop3PoolSignature))
    return null;

  return {
    app: DATA_EXPORT_APP,
    version: DATA_EXPORT_VERSION,
    exportedAt: value.exportedAt,
    data: {
      feedback: data.feedback,
      preferences: normalizeUserPreferences(data.preferences),
      activeProvider: provider ?? null,
      manualTop3Ranking: data.manualTop3Ranking ?? null,
      manualTop3PoolSignature: data.manualTop3PoolSignature ?? null,
      profileHistory,
    },
  };
}

export interface ImportedStorageValues {
  readonly feedback: readonly RecommendationFeedback[];
  readonly preferences: UserPreferences;
  readonly profileHistory: Readonly<Record<string, StoredProfileHistory>>;
  readonly activeProvider: string | null;
  readonly manualTop3Ranking: readonly number[] | null;
  readonly manualTop3PoolSignature: string | null;
}

export function storedValuesFromExport(exported: DataExport): ImportedStorageValues {
  return {
    feedback: [...exported.data.feedback],
    preferences: exported.data.preferences,
    profileHistory: exported.data.profileHistory,
    activeProvider: exported.data.activeProvider,
    manualTop3Ranking:
      exported.data.manualTop3Ranking === null ? null : [...exported.data.manualTop3Ranking],
    manualTop3PoolSignature: exported.data.manualTop3PoolSignature,
  };
}

export function serializeDataExport(exported: DataExport): string {
  return JSON.stringify(exported, null, 2);
}

export interface DataExportSource {
  feedback?: unknown;
  preferences?: unknown;
  activeProvider?: unknown;
  manual_top_3_ranking?: unknown;
  manual_top_3_pool_signature?: unknown;
  profileHistory?: unknown;
}

const FEEDBACK_VALUES = ['like', 'dislike', 'seen', 'not_now'] as const;

function isRecommendationFeedback(value: unknown): value is RecommendationFeedback {
  if (!isRecord(value)) return false;
  return (
    typeof value.recommendationId === 'string' &&
    value.recommendationId.length > 0 &&
    isCount(value.animeMalId) &&
    typeof value.value === 'string' &&
    FEEDBACK_VALUES.includes(value.value as (typeof FEEDBACK_VALUES)[number]) &&
    typeof value.createdAt === 'string' &&
    (value.expiresAt === undefined ||
      value.expiresAt === null ||
      typeof value.expiresAt === 'string')
  );
}

function readFeedback(value: unknown): readonly RecommendationFeedback[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecommendationFeedback);
}

function readProvider(value: unknown): string | null {
  return isProviderId(value) ? value : null;
}

function readRanking(value: unknown): readonly number[] | null {
  return isRanking(value) ? [...value] : null;
}

function readSignature(value: unknown): string | null {
  return isSignature(value) ? value : null;
}

function readProfileHistory(value: unknown): Record<string, StoredProfileHistory> | null {
  if (!isRecord(value)) return null;
  const history: Record<string, StoredProfileHistory> = {};
  for (const [providerId, entry] of Object.entries(value)) {
    if (!isProviderId(providerId)) continue;
    if (!isRecord(entry) || !Array.isArray(entry.snapshots)) return null;
    if (!entry.snapshots.every(isSnapshot)) return null;
    history[providerId] = { snapshots: entry.snapshots };
  }
  return history;
}

function isSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isCount(value.version) &&
    typeof value.capturedAt === 'string' &&
    typeof value.providerId === 'string' &&
    isCount(value.analyzedAnimeCount) &&
    isCount(value.ratedAnimeCount) &&
    (value.averageScore === null ||
      (typeof value.averageScore === 'number' && Number.isFinite(value.averageScore))) &&
    isPreferenceList(value.genres) &&
    isPreferenceList(value.themes) &&
    isPreferenceList(value.studios)
  );
}

function isPreferenceList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === 'string' &&
        typeof item.score === 'number' &&
        isCount(item.count),
    )
  );
}

function isRanking(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every((id) => isCount(id) && id > 0);
}

function isSignature(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
