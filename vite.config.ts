import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { extensionManifestPlugin } from './vite.manifest';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: './',

    plugins: [react(), extensionManifestPlugin('chromium')],
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV ?? mode),
      __UPDATE_TARGET__: JSON.stringify('chromium'),
    },
    test: {
      include: ['tests/**/*.test.{ts,tsx}'],
    },
    build: {
      outDir: 'dist/chromium',
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
