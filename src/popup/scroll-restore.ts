/**
 * A restored position can be taller than the page is at that moment, because a tab fills its
 * content after the popup opens. The browser clamps the scroll to what fits, so the position is
 * re-applied while the page is still too short to reach it, and the watcher lets go once the
 * content is tall enough — otherwise it would pull the reader back on every later resize.
 *
 * `isCurrent` tells the watcher that the position it holds no longer belongs to the page on
 * screen, which is what a navigation or a new restore means.
 */
export function restoreScrollPosition(target: number, isCurrent: () => boolean): () => void {
  const apply = (): void => {
    if (window.scrollY !== target) window.scrollTo(0, target);
  };

  apply();
  if (target <= 0) return () => undefined;

  const observer = new ResizeObserver(() => {
    if (!isCurrent()) {
      observer.disconnect();
      return;
    }
    const reachable = document.documentElement.scrollHeight - window.innerHeight;
    if (reachable >= target) {
      apply();
      observer.disconnect();
      return;
    }
    apply();
  });
  observer.observe(document.documentElement);
  return () => observer.disconnect();
}
