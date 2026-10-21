import type { DashboardRecommendationSnapshot } from '../recommendations/recommendation-messages';

export type DashboardRefreshPhase = 'start' | 'loaded' | 'failed';

export interface DashboardRefreshDecision {
  /** `loading` shows the skeleton, `unchanged` keeps what is on screen, `replace` swaps in the new snapshot. */
  readonly outcome: 'loading' | 'unchanged' | 'replace';
  /** Whether the failure is worth telling the reader about. */
  readonly notify: boolean;
}

export function hasDashboard(status: DashboardRecommendationSnapshot['status']): boolean {
  return status === 'ready' || status === 'offline';
}

export function acceptsDashboardResponse(
  disposed: boolean,
  sequence: number,
  currentSequence: number,
): boolean {
  return !disposed && sequence === currentSequence;
}

export function decideDashboardRefresh(
  phase: DashboardRefreshPhase,
  dashboardVisible: boolean,
): DashboardRefreshDecision {
  if (phase === 'start') {
    return { outcome: dashboardVisible ? 'unchanged' : 'loading', notify: false };
  }
  if (phase === 'loaded') {
    return { outcome: 'replace', notify: false };
  }
  return { outcome: dashboardVisible ? 'unchanged' : 'replace', notify: dashboardVisible };
}
