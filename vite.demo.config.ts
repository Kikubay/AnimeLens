import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const ROOT = __dirname;
const OUT_DIR = resolve(ROOT, 'dist/demo');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { version: string };

/**
 * `public/` doubles as the extension's packaging source, so Vite copies its manifest and
 * `_locales` directory into every build. They mean nothing on a web page, and shipping a
 * stale `manifest.json` next to the real one is just confusing. Public files are copied
 * straight to disk rather than travelling through the Rollup bundle, so they can only be
 * removed once the bundle is written.
 */
function stripExtensionAssets(): Plugin {
  return {
    name: 'animelens:demo-strip-extension-assets',
    apply: 'build',
    closeBundle() {
      for (const entry of ['manifest.json', '_locales']) {
        rmSync(resolve(OUT_DIR, entry), { recursive: true, force: true });
      }
    },
  };
}

/**
 * Builds the popup as a static site for GitHub Pages. There is no background service worker:
 * the demo answers `chrome.runtime.sendMessage` from the page instead, so nothing in this
 * build can reach a provider API or an account.
 */
export default defineConfig({
  // GitHub Pages serves a project site from a subpath, so every asset URL has to be relative.
  base: './',
  root: resolve(ROOT, 'demo'),
  publicDir: resolve(ROOT, 'public'),
  plugins: [react(), stripExtensionAssets()],
  define: {
    __APP_ENV__: JSON.stringify('demo'),
    __DEMO_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: resolve(ROOT, 'dist/demo'),
    emptyOutDir: true,
    target: 'es2022',
  },
});
