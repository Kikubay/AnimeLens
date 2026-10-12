import { defineConfig, mergeConfig } from 'vite';
import type { ConfigEnv, UserConfig } from 'vite';

import base from './vite.config';
import { extensionManifestPlugin, geckoScrollbarPlugin } from './vite.manifest';

export default defineConfig(async (env: ConfigEnv) => {
  const parent: UserConfig = typeof base === 'function' ? await base(env) : base;

  return mergeConfig(parent, {
    build: {
      outDir: 'dist/gecko',
    },
    define: {
      __UPDATE_TARGET__: JSON.stringify('gecko'),
    },
    plugins: [extensionManifestPlugin('gecko'), geckoScrollbarPlugin()],
  });
});
