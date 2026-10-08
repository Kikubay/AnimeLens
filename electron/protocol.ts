import { protocol, net } from 'electron';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_ORIGIN, APP_SCHEME } from './shim/runtime';

// Must run before `app.whenReady()`: `standard` gives the renderer a real origin and `supportFetchAPI` is what lets the taste card fetch its brand icon.
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

// Served over a custom scheme rather than `file://`, which blocks fetch and would leave `getURL` unusable for the taste card's brand icon.
export function registerAppProtocol(rootDirectory: string): void {
  const root = resolve(rootDirectory);

  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const decoded = decodeURIComponent(requested);
    const target = resolve(join(root, normalize(decoded)));

    // `resolve` collapses `..` but can't undo a URL-encoded traversal, so re-check the result is really inside the bundle.
    const relation = relative(root, target);
    if (relation.startsWith('..') || isAbsolute(relation) || relation.split(sep).includes('..')) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(target).toString());
  });
}

export function rendererEntryUrl(): string {
  return `${APP_ORIGIN}/index.html`;
}
