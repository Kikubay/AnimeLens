import { contextBridge, ipcRenderer } from 'electron';

// The popup is shared verbatim with the extension, so it still speaks `chrome.*`; these three are the only ones it calls. Storage, identity and alarms stay out because every popup feature already goes through the background, and a second divergent implementation of them would be worse than none.
const bridge = {
  runtime: {
    sendMessage: (message: unknown): Promise<unknown> =>
      ipcRenderer.invoke('animelens:message', message),
    getURL: (path: string): string => `app://animelens/${path.replace(/^\/+/, '')}`,
  },
  tabs: {
    // Always empty: the AniList consent page lives in the user's own browser, so the popup gets no token to auto-detect here.
    query: (): Promise<readonly never[]> => Promise.resolve([]),
  },
};

// A private name, because Chromium owns `window.chrome` and `contextBridge` will not overwrite it; `src/platform/desktop-bridge.ts` installs the alias.
contextBridge.exposeInMainWorld('__animelens', bridge);
