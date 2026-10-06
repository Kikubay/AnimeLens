import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Extension build. `base: './'` matters for both targets: Chrome resolves
 * extension pages against the package root, and the Electron renderer is served
 * from `app://animelens/index.html`, where a leading slash would escape the
 * bundle and 404 every asset.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: './',
    plugins: [react()],
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV ?? mode),
    },
    test: {
      include: ['tests/**/*.test.{ts,tsx}'],
    },
    build: {
      outDir: 'dist/extension',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'index.html'),
          background: resolve(__dirname, 'src/background/service-worker.ts'),
        },
        output: {
          format: 'es',
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});