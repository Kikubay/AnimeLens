import { DEMO_BANNER_TEXT, DEMO_VERSION } from './messages';
import { reshuffleDemoSeed } from './session';

const EXTENSION_URL = 'https://github.com/Kikubay/AnimeLens/releases/latest';

/**
 * The banner is the demo's own chrome, not app UI: it states plainly that no account is
 * connected, and offers the two actions a visitor actually wants — a different sample
 * library, or the real thing. Switching provider stays in Settings, where the app puts it.
 */
export function mountDemoBanner(): void {
  if (document.querySelector('.demo-banner') !== null) return;

  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.innerHTML = `
    <div class="demo-banner-copy">
      <strong>AnimeLens demo</strong>
      <span>${DEMO_BANNER_TEXT}</span>
    </div>
    <div class="demo-banner-actions">
      <button class="demo-button" type="button" data-action="shuffle">Shuffle library</button>
      <a class="demo-button is-primary" href="${EXTENSION_URL}" target="_blank" rel="noreferrer">Get the extension</a>
      <button class="demo-banner-close" type="button" aria-label="Hide">&times;</button>
    </div>
    <span class="demo-banner-version">v${DEMO_VERSION}</span>
  `;

  banner.querySelector('[data-action="shuffle"]')?.addEventListener('click', () => {
    reshuffleDemoSeed();
    window.location.reload();
  });
  banner.querySelector('.demo-banner-close')?.addEventListener('click', () => {
    banner.remove();
    document.body.classList.remove('has-demo-banner');
  });

  document.body.prepend(banner);
  document.body.classList.add('has-demo-banner');
}
