/**
 * Shared demo copy. These deliberately sit outside `src/locales`, which the extension
 * validates for placeholder parity and would otherwise treat as shipped product strings.
 */

/** Injected by the demo Vite config so the banner can name the build it is showing. */
declare const __DEMO_VERSION__: string;

export const DEMO_VERSION: string = typeof __DEMO_VERSION__ === 'string' ? __DEMO_VERSION__ : 'dev';

export const DEMO_DISABLED_MESSAGE =
  'This is a read-only demo. Connect AnimeLens to your MyAnimeList or AniList account in the extension.';

export const DEMO_BANNER_TEXT =
  'Interactive demo — a sample library is generated in your browser. No account is connected and nothing you do here is saved.';
