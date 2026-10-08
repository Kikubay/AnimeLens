import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vite';

/** `background.mjs` is its own entry so `main.ts` can dynamically import a real path on disk and take over the extension's service worker. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    // Extension packaging only, and dead weight inside the asar.
    publicDir: false,
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV ?? mode),
    },
    // Must be `build.ssr`, not just `ssr.external`: otherwise Vite resolves with browser conditions and follows `electron`'s CommonJS index into `fs`.
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
