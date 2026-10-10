import type { AnimeProviderId } from '../domain/anime';

const SEED_KEY = 'animelens:demo:seed';
const PROVIDER_KEY = 'animelens:demo:provider';

/**
 * Demo state lives in `sessionStorage` rather than anywhere persistent: a reload should look
 * identical, a new tab should not inherit a stranger's library, and nothing should outlive
 * the session.
 */
export function readDemoSeed(): number {
  const stored = window.sessionStorage.getItem(SEED_KEY);
  if (stored !== null) {
    const parsed = Number.parseInt(stored, 10);
    if (Number.isFinite(parsed) && parsed !== 0) return parsed >>> 0;
  }
  const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  window.sessionStorage.setItem(SEED_KEY, String(seed));
  return seed;
}

export function reshuffleDemoSeed(): void {
  window.sessionStorage.setItem(SEED_KEY, String((Math.random() * 0xffffffff) >>> 0));
}

export function readDemoProvider(): AnimeProviderId {
  return window.sessionStorage.getItem(PROVIDER_KEY) === 'anilist' ? 'anilist' : 'mal';
}

/** Kept across reloads so a choice made in Settings survives a refresh. */
export function persistDemoProvider(provider: AnimeProviderId): void {
  window.sessionStorage.setItem(PROVIDER_KEY, provider);
}
