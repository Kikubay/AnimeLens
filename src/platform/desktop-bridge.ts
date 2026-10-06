// The preload's bridge shape. It lives under `window.__animelens` rather than
// `window.chrome` because Chromium already owns that name and `contextBridge`
// silently refuses to overwrite it.
interface DesktopBridge {
  readonly runtime: {
    sendMessage(message: unknown): Promise<unknown>;
    getURL(path: string): string;
  };
  readonly tabs: {
    query(): Promise<readonly never[]>;
  };
}

declare global {
  interface Window {
    readonly __animelens?: DesktopBridge;
  }
}

// Reading the preload's presence beats caching a flag, so this is right whenever a component asks.
export function isDesktopHost(): boolean {
  return typeof window !== 'undefined' && window.__animelens !== undefined;
}

// Called once from `popup/main.tsx` before React renders, so nothing ever sees a half-installed bridge.
export function installDesktopBridge(): void {
  // The extension has a real background to talk to; leave it untouched.
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
    return;
  }

  const bridge = window.__animelens;
  if (bridge === undefined) {
    // Only reachable when the preload failed to load, so fail loudly here instead of much later as "sign-in failed".
    throw new Error('AnimeLens could not reach its background process.');
  }

  (globalThis as { chrome?: unknown }).chrome = bridge;
}