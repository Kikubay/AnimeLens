import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    publicDir: false,
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV ?? mode),
      __UPDATE_TARGET__: JSON.stringify('desktop'),
    },

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
