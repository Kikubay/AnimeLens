import { dispatchDemoMessage } from './dispatch';

/**
 * Installs the slice of `chrome.*` the popup actually touches. It has to run before
 * `src/popup/main.tsx`, because `installDesktopBridge` decides which host it is running under
 * by looking for `chrome.runtime.sendMessage` and throws when it finds neither.
 */
export function installDemoChromeShim(): void {
  const existing = (globalThis as { chrome?: unknown }).chrome as
    { runtime?: Record<string, unknown> } | undefined;

  // A Chromium browser page already exposes `chrome` for its own extensions API; extending it
  // is safer than replacing it, which would drop the object other code may be reading.
  const chromeObject = (existing ?? {}) as Record<string, unknown>;
  const runtime = (chromeObject.runtime ?? {}) as Record<string, unknown>;

  runtime.sendMessage = (message: unknown) => dispatchDemoMessage(message);
  // Extension asset paths resolve against the extension root; on a hosted page the same
  // relative URL already points at the copied assets.
  runtime.getURL = (path: string) => String(path).replace(/^\/+/, '');
  runtime.id = 'animelens-demo';
  runtime.lastError = undefined;

  chromeObject.runtime = runtime;
  (globalThis as { chrome?: unknown }).chrome = chromeObject;
}
