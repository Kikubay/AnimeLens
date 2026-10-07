import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GECKO_ID,
  applyGeckoScrollbarHiding,
  applyTargetManifest,
  geckoScrollbarPlugin,
  type ExtensionTarget,
} from '../vite.manifest';

const baseManifest = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'public', 'manifest.json'), 'utf8'),
) as Record<string, unknown>;

const popupCss = readFileSync(resolve(__dirname, '..', 'src', 'popup', 'styles.css'), 'utf8');

function forTarget(target: ExtensionTarget): Record<string, never> {
  return applyTargetManifest(baseManifest, target) as Record<string, never>;
}

describe('applyTargetManifest', () => {
  it('leaves the Chromium manifest exactly as authored', () => {
    expect(forTarget('chromium')).toEqual(baseManifest);
  });

  it('does not let the transform mutate the shared source manifest', () => {
    const before = JSON.stringify(baseManifest);
    applyTargetManifest(baseManifest, 'gecko');
    expect(JSON.stringify(baseManifest)).toBe(before);
  });

  it('swaps the background to an event page for Firefox', () => {
// Leaving it in place would ship Firefox an extension with no background script.
    const { background } = forTarget('gecko') as unknown as {
      background: Record<string, unknown>;
    };
    expect(background).toEqual({ scripts: ['assets/background.js'], type: 'module' });
    expect(background).not.toHaveProperty('service_worker');
  });

  it('pins a stable Gecko ID, since AMO will not assign one for MV3', () => {
    const manifest = forTarget('gecko') as unknown as {
      browser_specific_settings: { gecko: Record<string, unknown> };
    };
    expect(manifest.browser_specific_settings.gecko.id).toBe(DEFAULT_GECKO_ID);
    expect(manifest.browser_specific_settings.gecko.id).toMatch(/^[^@\s]+@[^@\s]+$/);
  });

  it('declares no data collection, which AMO requires for new submissions', () => {
    const manifest = forTarget('gecko') as unknown as {
      browser_specific_settings: {
        gecko: { data_collection_permissions: { required: readonly string[] } };
      };
    };
    expect(manifest.browser_specific_settings.gecko.data_collection_permissions.required).toEqual([
      'none',
    ]);
  });

  it('sets a strict_min_version that clears the manifest validator', () => {
    // Firefox 127 and older reject the whole manifest once data_collection_permissions is set.
    const manifest = forTarget('gecko') as unknown as {
      browser_specific_settings: { gecko: { strict_min_version: string } };
    };
    const [major] = manifest.browser_specific_settings.gecko.strict_min_version.split('.');
    expect(Number(major)).toBeGreaterThanOrEqual(128);
  });

  it('leaves Chromium builds free of Gecko-only keys', () => {
// Chrome ignores the key outright, but shipping it anyway makes a Firefox-only requirement look satisfied on a store that never enforced it.
    expect(forTarget('chromium')).not.toHaveProperty('browser_specific_settings');
  });

  it('keeps every non-background key identical between targets', () => {
    const chromium = forTarget('chromium') as Record<string, unknown>;
    const gecko = forTarget('gecko') as Record<string, unknown>;
    expect(gecko.manifest_version).toBe(chromium.manifest_version);
    expect(gecko.permissions).toEqual(chromium.permissions);
    expect(gecko.host_permissions).toEqual(chromium.host_permissions);
    expect(gecko.action).toEqual(chromium.action);
    expect(gecko.content_security_policy).toEqual(chromium.content_security_policy);
  });

  it('fails loudly rather than shipping a Firefox build with no background', () => {
    const broken = { ...baseManifest, background: { type: 'module' } };
    expect(() => applyTargetManifest(broken, 'gecko')).toThrow(/service_worker/);
  });
});

describe('popup scrollbar gutter', () => {
  it('leaves the scrollbar alone for every non-Firefox target', () => {
    expect(popupCss).not.toMatch(/^\s*html\s*\{[^}]*scrollbar-width/m);
  });

  it('still pins the popup body to the design width in the shared stylesheet', () => {
// Widening this can't fix Firefox: the window grows by exactly what you add, leaving the scrollbar just as unaccounted for.
    expect(popupCss).toMatch(/body\s*\{[^}]*min-width:\s*var\(--popup-content-width\)/);
  });

  it('keeps the app shell at the design width rather than stretching with the window', () => {
    expect(popupCss).toMatch(/\.app-shell\s*\{[^}]*max-width:\s*var\(--popup-content-width\)/);
  });

  it('hides the scrollbar on the scrolling element, not on a child', () => {
    const patched = applyGeckoScrollbarHiding(popupCss);
    // `body` is not the viewport scroller here; styling it would hide nothing.
    expect(patched).toMatch(/html\s*\{\s*scrollbar-width:\s*none;/);
    expect(patched).toMatch(/html::-webkit-scrollbar\s*\{\s*display:\s*none;/);
  });

  it('keeps the page scrollable rather than clipping it', () => {
    const injected = applyGeckoScrollbarHiding(popupCss).slice(popupCss.length);
    expect(injected).not.toContain('overflow: hidden');
    expect(injected).not.toContain('!important');
  });

  it('appends the override last so it wins on source order alone', () => {
    const patched = applyGeckoScrollbarHiding(popupCss);
    expect(patched.startsWith(popupCss)).toBe(true);
    expect(patched.lastIndexOf('scrollbar-width: none')).toBeGreaterThan(
      popupCss.lastIndexOf('scrollbar-width'),
    );
  });

  it('keeps the popup inside the 800px width browsers cap popups at', () => {
    const designWidth = Number(/--popup-content-width:\s*(\d+)px/.exec(popupCss)?.[1]);
    expect(designWidth).toBeLessThanOrEqual(800);
  });

  it('only touches the popup stylesheet', () => {
    const transform = geckoScrollbarPlugin().transform as (
      code: string,
      id: string,
    ) => { code: string } | null;
    expect(transform(popupCss, '/repo/src/popup/styles.css')).not.toBeNull();
    expect(transform(popupCss, '/repo/src/other/styles.css')).toBeNull();
    expect(transform(popupCss, '/repo/src/popup/pages.tsx')).toBeNull();
    // Vite hands out Windows paths on Windows, which a bare suffix match would miss.
    expect(transform(popupCss, 'C:\\repo\\src\\popup\\styles.css')).not.toBeNull();
  });
});
