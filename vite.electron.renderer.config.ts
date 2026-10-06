import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Electron renderer. Identical entry point to the extension popup, but served
 * over `app://animelens/` instead of `chrome-extension://`, and packaged under
 * the app directory rather than shipped as an extension.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: './',
    plugins: [react()],
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV ?? mode),
    },
    build: {
      outDir: 'dist/electron/app/renderer',
      // The shell build owns `dist/electron/app`; this must not wipe it.
      emptyOutDir: false,
      rollupOptions: {
        input: { popup: resolve(__dirname, 'index.html') },
        output: {
          // The popup reaches `chrome.runtime.sendMessage` through the preload
          // bridge, which needs a real module graph to code-split against.
          format: 'es',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});