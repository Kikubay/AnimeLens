import type { PageId } from './pages';

export type TransitionDirection = 'forward' | 'backward';

type PageTransitionPhase = 'exit' | 'enter';

export interface PageTransition {
  readonly direction: TransitionDirection;
  readonly phase: PageTransitionPhase;
  readonly to: PageId;
}

// Kept in step with `--page-exit-duration` and `--page-enter-duration` in styles.css.
export const PAGE_EXIT_MS = 120;
export const PAGE_ENTER_MS = 200;

export function transitionDirection(
  from: PageId,
  to: PageId,
  order: readonly PageId[],
): TransitionDirection {
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return to === 'detail' ? 'forward' : 'backward';
  return toIndex > fromIndex ? 'forward' : 'backward';
}
