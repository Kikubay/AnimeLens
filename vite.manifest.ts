import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export type ExtensionTarget = 'chromium' | 'gecko';

/** Fixed forever once AMO assigns it, since Firefox hashes this value into the OAuth redirect host. */
export const DEFAULT_GECKO_ID = 'animelens@kikubay.github.io';

/** 128 is the floor: 127 and older reject the manifest outright once `data_collection_permissions` is present. */
export const DEFAULT_STRICT_MIN_VERSION = '128.0';

interface GeckoSettings {
  readonly id: string;
  readonly strictMinVersion: string;
}

const DEFAULT_GECKO: GeckoSettings = {
  id: DEFAULT_GECKO_ID,
  strictMinVersion: DEFAULT_STRICT_MIN_VERSION,
};

/** The popup window is sized from its content, so a fixed-width body can never fit a Firefox scrollbar that reserves space — hiding it is the only way out. */
const GECKO_SCROLLBAR_HIDING_CSS = `
/*
 * Injected by \`geckoScrollbarPlugin\` for the Gecko build only.
 *
 * Firefox's scrollbar takes width out of the viewport, while the popup window is sized to the
 * content that has to live inside it. Hiding the scrollbar is what lets the layout keep its
 * full width instead of spilling a horizontal scrollbar.
 */
html {
  scrollbar-width: none;
}
html::-webkit-scrollbar {
  display: none;
}
`;

/** Pure, and appended last so it wins on source order alone rather than needing `!important`. */
export function applyGeckoScrollbarHiding(css: string): string {
  return `${css}\n${GECKO_SCROLLBAR_HIDING_CSS}`;
}

/** Lets the Firefox popup window hold its own layout width instead of spilling a horizontal scrollbar. */
export function geckoScrollbarPlugin(): Plugin {
  return {
    name: 'animelens:gecko-scrollbar',
    transform(code, id) {
      // Windows separators would otherwise defeat the suffix match below.
      if (!id.replace(/\\/g, '/').endsWith('src/popup/styles.css')) return null;
      return { code: applyGeckoScrollbarHiding(code), map: null };
    },
  };
}

/** Firefox has no `background.service_worker`, so the same bundle runs there as an event page; everything else here is standard MV3 both accept. */
export function applyTargetManifest(
  manifest: Record<string, unknown>,
  target: ExtensionTarget,
  gecko: GeckoSettings = DEFAULT_GECKO,
): Record<string, unknown> {
  if (target === 'chromium') return manifest;

  const background = manifest.background as { readonly service_worker?: string } | undefined;
  const serviceWorker = background?.service_worker;
  if (background === undefined || serviceWorker === undefined) {
    throw new Error('Cannot target Gecko: manifest.background.service_worker is missing.');
  }

  return {
    ...manifest,
    background: {
      // Same file, loaded as a module event page — the bundle is already an ES module for the Chromium service worker.
      scripts: [serviceWorker],
      type: 'module',
    },
    browser_specific_settings: {
      gecko: {
        id: gecko.id,
        strict_min_version: gecko.strictMinVersion,
        // Mandatory for AMO submissions since 3 Nov 2025. Nothing leaves the device: tokens are the user's own and every request goes straight to MAL, AniList or GitHub.
        data_collection_permissions: { required: ['none'] },
      },
    },
  };
}

/** Vite treats `public/` as opaque passthrough, so the emitted file is the only place this can happen. */
export function extensionManifestPlugin(
  target: ExtensionTarget,
  gecko: GeckoSettings = DEFAULT_GECKO,
): Plugin {
  let outDir = '';
  return {
    name: 'animelens:extension-manifest',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      const manifestPath = resolve(outDir, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      const patched = applyTargetManifest(manifest, target, gecko);
      writeFileSync(manifestPath, `${JSON.stringify(patched, null, 2)}\n`);
    },
  };
}
