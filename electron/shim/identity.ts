import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { shell } from 'electron';

// MAL matches the redirect URI character for character and only accepts a localhost one, so the port can't be ephemeral.
export const DEFAULT_LOOPBACK_PORT = 8976;
const FALLBACK_PORTS = [0];
/** Long enough for a consent screen, short enough that a hung flow self-heals. */
const FLOW_TIMEOUT_MS = 10 * 60 * 1000;

export interface WebAuthFlowDetails {
  readonly url: string;
  readonly interactive: boolean;
}

interface PendingFlow {
  readonly state: string | null;
  readonly resolve: (url: string) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

function readState(authorizeUrl: string): string | null {
  try {
    return new URL(authorizeUrl).searchParams.get('state');
  } catch {
    return null;
  }
}

// Electron has no equivalent of `chrome.identity.launchWebAuthFlow` — the OAuth hop has to happen in the user's real browser — so we open the system browser and resolve from a throwaway loopback server. Only MAL's code flow lands here; AniList uses the pin flow because its implicit redirect hides the token in a fragment no server ever sees.
export class IdentityShim {
  private server: Server | null = null;
  private starting: Promise<number> | null = null;
  private disposed = false;
  private readonly pending = new Set<PendingFlow>();

  private listen(port: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const server = createServer((request, response) => {
        this.handleRequest(request, response);
      });
      const onBindFailed = (error: Error) => reject(error);
      const onClosedEarly = () =>
        reject(new Error('AnimeLens sign-in listener closed before it started.'));
      // A stale OAuth tab from a previous run can leave a socket in TIME_WAIT.
      server.on('error', onBindFailed);
      // Closing before the bind completes never emits `listening` or `error`, so the promise would otherwise stay pending for good.
      server.on('close', onClosedEarly);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', onBindFailed);
        server.removeListener('close', onClosedEarly);
        server.on('error', () => undefined);
        resolve((server.address() as { port: number }).port);
      });
      this.server = server;
    });
  }

  async start(): Promise<number> {
    this.disposed = false;
    this.starting ??= (async () => {
      for (const port of [DEFAULT_LOOPBACK_PORT, ...FALLBACK_PORTS]) {
        try {
          return await this.listen(port);
        } catch (error) {
          if (port === DEFAULT_LOOPBACK_PORT) {
            const reason = (error as NodeJS.ErrnoException).code ?? 'unknown';
            console.warn(
              `[AnimeLens] Port ${DEFAULT_LOOPBACK_PORT} is busy (${reason}); sign-in ` +
                'will use a random port and MAL must be configured to match it.',
            );
          }
        }
      }
      throw new Error('AnimeLens could not start the local sign-in listener.');
    })();
    return this.starting;
  }

  // Chrome returns the registered origin root when given no path, and MAL rejects a redirect URI carrying an extra one.
  getRedirectURL(path?: string): string {
    const port = this.starting === null ? DEFAULT_LOOPBACK_PORT : this.actualPort();
    const origin = `http://127.0.0.1:${port}`;
    return path === undefined || path.length === 0 ? `${origin}/` : `${origin}/${path}`;
  }

  private actualPort(): number {
    const address = this.server?.address();
    return typeof address === 'object' && address !== null ? address.port : DEFAULT_LOOPBACK_PORT;
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse): void {
    const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${this.actualPort()}`);
    const state = requestUrl.searchParams.get('state');
    const matched = [...this.pending].find((flow) => flow.state === null || flow.state === state);

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(
      matched === undefined
        ? '<!doctype html><meta charset="utf-8"><title>AnimeLens</title>' +
            '<body style="font:16px system-ui;padding:2rem">This page is not an AnimeLens sign-in callback. You can close it.</body>'
        : '<!doctype html><meta charset="utf-8"><title>AnimeLens</title>' +
            '<body style="font:16px system-ui;padding:2rem">Signed in. Return to AnimeLens to finish.</body>',
    );

    if (matched === undefined) return;
    const callback = `http://127.0.0.1:${this.actualPort()}${requestUrl.pathname}${requestUrl.search}`;
    this.settle(matched, () => matched.resolve(callback));
  }

  private settle(flow: PendingFlow, action: () => void): void {
    clearTimeout(flow.timer);
    this.pending.delete(flow);
    action();
  }

  async launchWebAuthFlow(details: WebAuthFlowDetails): Promise<string | undefined> {
    // Checked on both sides of `start()`: a dispose landing while the listener is still coming up would otherwise register the flow after the pending set was already drained, and it would wait out the full timeout.
    if (this.disposed) throw new Error('AnimeLens is shutting down.');
    await this.start();
    if (this.disposed) throw new Error('AnimeLens is shutting down.');
    const expectedState = readState(details.url);

    const callback = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(flow);
        reject(new Error('AnimeLens sign-in timed out.'));
      }, FLOW_TIMEOUT_MS);
      timer.unref?.();
      const flow: PendingFlow = {
        state: expectedState,
        resolve: (url) => this.settle(flow, () => resolve(url)),
        reject: (error) => this.settle(flow, () => reject(error)),
        timer,
      };
      this.pending.add(flow);
    });

    await shell.openExternal(details.url);
    return callback;
  }

  dispose(): void {
    for (const flow of [...this.pending]) {
      this.settle(flow, () => flow.reject(new Error('AnimeLens is shutting down.')));
    }
    this.disposed = true;
    this.server?.close();
    this.server = null;
    this.starting = null;
  }
}
