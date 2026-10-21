export interface PageLockStyleTarget {
  readonly style: { overflow: string };
}

export interface PageLockInertTarget {
  inert: boolean;
}

export interface PageLockEventTarget {
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: { readonly passive?: boolean },
  ): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

export interface PageLockTargets {
  readonly body: PageLockStyleTarget;
  readonly html: PageLockStyleTarget;
  readonly root: PageLockInertTarget | null;
  readonly events: PageLockEventTarget;
}

export interface PageLockDialog {
  contains(node: Node | null): boolean;
}

export interface PageLock {
  engage(dialog: PageLockDialog | null): void;
  release(dialog: PageLockDialog | null): void;
}

/**
 * Keeps the page behind a dialog from scrolling and from taking the pointer.
 *
 * The count is what makes nested dialogs work: the grid picker opens on top of the taste card
 * dialog, and the page may only be released once the last dialog closes. The targets are resolved
 * lazily so that importing the module never touches the document.
 *
 * Two mechanisms carry the lock, because one of them is not enough on its own. The overflow lock
 * keeps the page still, but it only reaches the viewport, so a scroll that lands on any other
 * element still moves. The gesture guard cancels the scroll itself unless it happens inside the
 * dialog on top, which is the one that owns the screen while it is open.
 */
export function createPageLock(resolveTargets: () => PageLockTargets): PageLock {
  const dialogs: PageLockDialog[] = [];
  let restore: (() => void) | null = null;

  const topDialog = (): PageLockDialog | null => dialogs[dialogs.length - 1] ?? null;

  const cancelScroll = (event: Event): void => {
    const dialog = topDialog();
    if (dialog === null) return;
    const target = event.target;
    if (target !== null && dialog.contains(target as Node)) return;
    event.preventDefault();
  };

  const onWheel = (event: Event): void => cancelScroll(event);
  const onTouchMove = (event: Event): void => cancelScroll(event);

  const engage = (dialog: PageLockDialog | null): void => {
    // A dialog that could not be read cancels nothing, rather than cancelling everything.
    dialogs.push(dialog ?? { contains: () => true });
    if (dialogs.length > 1) return;
    const targets = resolveTargets();
    const previousBodyOverflow = targets.body.style.overflow;
    const previousHtmlOverflow = targets.html.style.overflow;
    const previousInert = targets.root?.inert ?? false;
    targets.body.style.overflow = 'hidden';
    targets.html.style.overflow = 'hidden';
    if (targets.root !== null) targets.root.inert = true;
    targets.events.addEventListener('wheel', onWheel, { passive: false });
    targets.events.addEventListener('touchmove', onTouchMove, { passive: false });
    restore = () => {
      targets.body.style.overflow = previousBodyOverflow;
      targets.html.style.overflow = previousHtmlOverflow;
      if (targets.root !== null) targets.root.inert = previousInert;
      targets.events.removeEventListener('wheel', onWheel);
      targets.events.removeEventListener('touchmove', onTouchMove);
      restore = null;
    };
  };

  const release = (dialog: PageLockDialog | null): void => {
    const index = dialog === null ? -1 : dialogs.lastIndexOf(dialog);
    if (index >= 0) {
      dialogs.splice(index, 1);
    } else if (dialogs.length > 0) {
      dialogs.pop();
    }
    if (dialogs.length > 0) return;
    restore?.();
  };

  return { engage, release };
}
