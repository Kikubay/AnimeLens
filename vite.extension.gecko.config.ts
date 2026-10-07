import { defineConfig, mergeConfig } from 'vite';
import type { ConfigEnv, UserConfig } from 'vite';

import base from './vite.config';
import { extensionManifestPlugin, geckoScrollbarPlugin } from './vite.manifest';

/** The Chromium build is `vite.config.ts` itself, so the two only diverge on the background declaration and the Gecko keys. */
export default defineConfig(async (env: ConfigEnv) => {
  const parent: UserConfig = typeof base === 'function' ? await base(env) : base;

  return mergeConfig(parent, {
    build: {
      outDir: 'dist/gecko',
    },
    plugins: [extensionManifestPlugin('gecko'), geckoScrollbarPlugin()],
  });
});
