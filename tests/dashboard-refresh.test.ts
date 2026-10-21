import { describe, expect, it } from 'vitest';
import {
  acceptsDashboardResponse,
  decideDashboardRefresh,
  hasDashboard,
} from '../src/popup/dashboard-refresh';

describe('dashboard response guard', () => {
  it('accepts the response for the request that is still current', () => {
    expect(acceptsDashboardResponse(false, 2, 2)).toBe(true);
  });

  it('drops a response that a newer request has superseded', () => {
    expect(acceptsDashboardResponse(false, 1, 2)).toBe(false);
  });

  it('drops a response that arrives after the page went away', () => {
    expect(acceptsDashboardResponse(true, 2, 2)).toBe(false);
  });
});

describe('dashboard refresh decision', () => {
  it('shows the skeleton when the first load has nothing to show', () => {
    expect(decideDashboardRefresh('start', false)).toEqual({ outcome: 'loading', notify: false });
  });

  it('keeps the dashboard on screen when a refresh starts behind it', () => {
    expect(decideDashboardRefresh('start', true)).toEqual({ outcome: 'unchanged', notify: false });
  });

  it('swaps in the new snapshot once it arrives', () => {
    expect(decideDashboardRefresh('loaded', true)).toEqual({ outcome: 'replace', notify: false });
    expect(decideDashboardRefresh('loaded', false)).toEqual({ outcome: 'replace', notify: false });
  });

  it('keeps the dashboard and tells the reader when a refresh fails', () => {
    expect(decideDashboardRefresh('failed', true)).toEqual({
      outcome: 'unchanged',
      notify: true,
    });
  });

  it('shows the error state when the first load fails', () => {
    expect(decideDashboardRefresh('failed', false)).toEqual({ outcome: 'replace', notify: false });
  });

  it('treats a ready or offline snapshot as a dashboard', () => {
    expect(hasDashboard('ready')).toBe(true);
    expect(hasDashboard('offline')).toBe(true);
    expect(hasDashboard('empty')).toBe(false);
    expect(hasDashboard('error')).toBe(false);
    expect(hasDashboard('loading')).toBe(false);
  });
});
