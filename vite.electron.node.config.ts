import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vite';

/**
 * Electron main/preload/worker bundle.
 *
 * `background.mjs` is the extension's MV3 service worker, compiled here as an
 * ES module for Node so the Electron main process can import it and become the
 * background. It is emitted as its own entry rather than being required by
 * `main.mjs`, because `main.ts` loads it with a dynamic import of a
 * filesystem path — that import has to land on a real file on disk.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    // `manifest.json` and `_locales` are extension packaging; shipping them
    // inside a desktop app would be dead weight in the asar.
    publicDir: false,
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV ?? mode),
    },
    // `electron` and Node builtins are provided by the runtime, never bundled.
    // This has to be `build.ssr`, not just `ssr.external`: without it Vite
    // resolves dependencies with browser conditions and tries to follow
    // `electron`'s CommonJS index into `fs`.
    ssr: {
      target: 'node',
      external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
    },
    build: {
      ssr: true,
      target: 'node22',
      outDir: 'dist/electron/app',
      emptyOutDir: true,
      minify: false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'electron/main.ts'),
          preload: resolve(__dirname, 'electron/preload.ts'),
          background: resolve(__dirname, 'src/background/service-worker.ts'),
        },
        output: {
          format: 'es',
          entryFileNames: '[name].mjs',
          chunkFileNames: 'chunks/[name]-[hash].mjs',
        },
      },
    },
  };
});