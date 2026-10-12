import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const ROOT = __dirname;
const OUT_DIR = resolve(ROOT, 'dist/demo');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { version: string };

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

export default defineConfig({
  base: './',
  root: resolve(ROOT, 'demo'),
  publicDir: resolve(ROOT, 'public'),
  plugins: [react(), stripExtensionAssets()],
  define: {
    __APP_ENV__: JSON.stringify('demo'),
    __UPDATE_TARGET__: JSON.stringify('demo'),
    __DEMO_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: resolve(ROOT, 'dist/demo'),
    emptyOutDir: true,
    target: 'es2022',
  },
});
