import { app, BrowserWindow, ipcMain, session } from 'electron';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { registerAppProtocol, registerAppScheme, rendererEntryUrl } from './protocol';
import { AlarmsShim } from './shim/alarms';
import { IdentityShim } from './shim/identity';
import { NotificationsShim, RuntimeShim, TabsShim, getURL, readManifest } from './shim/runtime';
import { FileStorageArea, MemoryStorageArea } from './shim/storage';

const here = dirname(fileURLToPath(import.meta.url));
const rendererRoot = join(here, 'renderer');
const workerEntry = join(here, 'background.mjs');

// The renderer loads no remote code, so it gets the same CSP the extension does.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // Avatar and cover art come from provider CDNs; the taste card reads data URLs back.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // MyAnimeList, AniList and the GitHub release feed.
  'connect-src https:',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Deliberately above the popup's own 700x600 CSS minimum: a framed window's content area is smaller than the window, so matching them exactly would leave the page scrolling and reflow the bottom nav.
const WINDOW_MIN_WIDTH = 731;
const WINDOW_MIN_HEIGHT = 716;

registerAppScheme();

const runtime = new RuntimeShim();

// One area for the whole process: two instances over the same file would each keep their own cache and silently drop the other's writes.
const localStorage = new FileStorageArea(join(app.getPath('userData'), 'animelens-storage.json'));
const alarms = new AlarmsShim(localStorage);
const identity = new IdentityShim();

let mainWindow: BrowserWindow | null = null;

// Imported dynamically because the worker registers its message handler the moment it evaluates, so the adapter has to be in place first — and as a `file://` URL, since Node's ESM loader rejects a bare Windows path.
async function startWorker(): Promise<void> {
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: { ...runtime, getManifest: readManifest, getURL },
    storage: { local: localStorage, session: new MemoryStorageArea() },
    alarms,
    notifications: new NotificationsShim((relativePath) =>
      resolve(join(rendererRoot, relativePath)),
    ),
    identity,
    tabs: new TabsShim(),
  };

  await import(pathToFileURL(workerEntry).href);

  ipcMain.handle('animelens:message', (_event, message: unknown) => runtime.dispatch(message));

  // Anything that came due while the app was closed fires on the next launch.
  await alarms.hydrate();
  runtime.fireInstalled();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    // Opens at the minimum rather than trusting Electron to clamp a smaller default up to it.
    width: WINDOW_MIN_WIDTH,
    height: WINDOW_MIN_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    // A normal app window, not a chrome-less popup: the desktop build is the full dashboard.
    title: 'AnimeLens',
    // Windows and macOS take the icon from the packaged executable, but on Linux nothing supplies one unless the window asks for it.
    icon: join(rendererRoot, 'icons/icon32.png'),
    backgroundColor: '#0b0d14',
    show: false,
    webPreferences: {
      preload: join(here, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // ES-module preloads need the sandbox off, but contextIsolation is still on and nodeIntegration off, so the renderer gets no Node access.
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Without this a preload that fails to evaluate just leaves a renderer with no `chrome.*` and no window to click on.
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[AnimeLens] Preload failed (${preloadPath}):`, error);
  });

  // The dashboard is one scrollable surface, so nothing should navigate away or spawn a second window.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  void mainWindow.loadURL(rendererEntryUrl());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow === null) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  void app
    .whenReady()
    .then(async () => {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
          },
        });
      });

      registerAppProtocol(rendererRoot);
      await startWorker();
      createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch((error: unknown) => {
      // Otherwise a rejected promise in `whenReady` is swallowed silently and the process just sits there.
      console.error('[AnimeLens] Startup failed:', error);
      app.quit();
    });

  // macOS apps conventionally stay resident so `activate` can reopen the window; elsewhere closing the last window means the user is done.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => identity.dispose());
}
