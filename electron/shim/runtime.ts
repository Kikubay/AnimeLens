import { app, shell } from 'electron';

export const APP_SCHEME = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://animelens`;

// The worker only reads `version` to spot newer GitHub releases, and `app.getVersion()` tracks package.json whether packaged or not.
export function readManifest(): { readonly version: string } {
  return { version: app.getVersion() };
}

export function getURL(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  return `${APP_ORIGIN}/${normalized}`;
}

type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | undefined | void;

interface EventSource<Listener> {
  addListener(listener: Listener): void;
}

// The worker owns every feature and the popup only messages it, which is exactly the shape of a main process plus `ipcMain.handle` — so we capture the listener it registers at import time instead of forking it.
export class RuntimeShim {
  private readonly messageListeners: MessageListener[] = [];
  private readonly installedListeners: (() => void)[] = [];

  readonly lastError = { message: '' };

  readonly onMessage: EventSource<MessageListener> = {
    addListener: (listener) => {
      this.messageListeners.push(listener);
    },
  };

  readonly onInstalled: EventSource<() => void> = {
    addListener: (listener) => {
      this.installedListeners.push(listener);
    },
  };

  // Stands in for the `onInstalled` Chrome fires once per install.
  fireInstalled(): void {
    for (const listener of this.installedListeners) listener();
  }

  // Honours the `return true` convention that keeps the channel open for an async `sendResponse`, and resolves `undefined` when nothing claims the message.
  async dispatch(message: unknown): Promise<unknown> {
    if (this.messageListeners.length === 0) return undefined;

    return new Promise<unknown>((resolve) => {
      let settled = false;
      let awaiting = false;

      const sendResponse = (response: unknown): void => {
        if (settled) return;
        settled = true;
        resolve(response);
      };

      const chromeSender = { id: APP_ORIGIN, url: getURL('index.html') };
      for (const listener of this.messageListeners) {
        const keepOpen = listener(message, chromeSender, sendResponse);
        if (keepOpen === true) awaiting = true;
      }

      // No listener claimed the message, so the channel closes immediately and
      // the caller sees `undefined`.
      if (!awaiting && !settled) resolve(undefined);
    });
  }
}

// An Electron window is not a tab and there is no tab bar, so the only meaningful verb is handing a URL to the browser.
export class TabsShim {
  async create(properties: { readonly url?: string }): Promise<{ readonly id?: number }> {
    if (typeof properties.url === 'string' && properties.url.length > 0) {
      await shell.openExternal(properties.url);
    }
    return {};
  }

  // The AniList consent page opens in the user's own browser, which this process cannot read, so the popup has no token to auto-detect and always gets pasted one.
  async query(): Promise<readonly never[]> {
    return [];
  }
}

export interface NotificationOptions {
  readonly title: string;
  readonly message: string;
  /** Extension-relative path, e.g. `icons/icon128.png`. */
  readonly iconUrl?: string;
}

// `chrome.notifications`, backed by the OS notification centre.
export class NotificationsShim {
  constructor(private readonly resolveAsset: (relativePath: string) => string) {}

  async create(id: string, options: NotificationOptions): Promise<string> {
    const { Notification } = await import('electron');
    const notification = new Notification({
      title: options.title,
      body: options.message,
      ...(options.iconUrl === undefined
        ? {}
        : { icon: this.resolveAsset(options.iconUrl) }),
    });
    notification.on('click', () => {
      notification.close();
      void app.focus({ steal: true });
    });
    notification.show();
    return id;
  }
}