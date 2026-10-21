export type PageId = 'dashboard' | 'detail' | 'profile' | 'settings';

export const PAGE_IDS: readonly PageId[] = ['dashboard', 'detail', 'profile', 'settings'];

export function isPageId(value: unknown): value is PageId {
  return typeof value === 'string' && PAGE_IDS.includes(value as PageId);
}
