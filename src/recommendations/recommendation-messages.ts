import type { Recommendation } from '../domain/recommendation';
import type { SyncMetadata } from '../domain/sync';

export type RecommendationSectionId =
  'highly-compatible' | 'because-you-liked' | 'hidden-gem' | 'explore';

export interface RecommendationSection {
  readonly id: RecommendationSectionId;
  readonly title: string;
  readonly recommendations: readonly Recommendation[];
}

export interface DashboardRecommendationSnapshot {
  readonly status: 'loading' | 'ready' | 'empty' | 'error' | 'offline';
  readonly daily: Recommendation | null;
  readonly sections: readonly RecommendationSection[];
  readonly analyzedCount: number;
  readonly generatedAt: string | null;
  readonly sync: SyncMetadata | null;
  readonly errorMessage: string | null;
}

export type RecommendationMessage = { readonly type: 'recommendations.get_dashboard' };

export type RecommendationMessageResponse =
  | { readonly ok: true; readonly snapshot: DashboardRecommendationSnapshot }
  | { readonly ok: false; readonly message: string };

export async function requestDashboardRecommendations(): Promise<DashboardRecommendationSnapshot> {
  const response = (await chrome.runtime.sendMessage({
    type: 'recommendations.get_dashboard',
  })) as RecommendationMessageResponse;
  if (!response.ok) throw new Error(response.message);
  return response.snapshot;
}

export function isRecommendationMessage(value: unknown): value is RecommendationMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'recommendations.get_dashboard'
  );
}
