import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOOPBACK_PORT, IdentityShim } from '../electron/shim/identity';

const openExternal = vi.fn(async (_url: string) => undefined);

vi.mock('electron', () => ({
  shell: {
    openExternal: (url: string) => openExternal(url),
  },
  app: {
    getVersion: () => '0.0.0-test',
  },
}));

const shims: IdentityShim[] = [];

function newShim(): IdentityShim {
  const shim = new IdentityShim();
  shims.push(shim);
  return shim;
}

afterEach(() => {
  while (shims.length > 0) shims.pop()?.dispose();
  openExternal.mockClear();
  vi.restoreAllMocks();
});

describe('IdentityShim', () => {
  it('reports the registered port before anything is listening', () => {
    expect(newShim().getRedirectURL()).toBe(`http://127.0.0.1:${DEFAULT_LOOPBACK_PORT}/`);
    expect(newShim().getRedirectURL('')).toBe(`http://127.0.0.1:${DEFAULT_LOOPBACK_PORT}/`);
  });

  it('reflects the real port once the listener is up', async () => {
    const shim = newShim();
    const port = await shim.start();

    expect(port).toBeGreaterThan(0);
    expect(shim.getRedirectURL()).toBe(`http://127.0.0.1:${port}/`);
    expect(shim.getRedirectURL('oauth2callback')).toBe(`http://127.0.0.1:${port}/oauth2callback`);
  });

  it('starts the listener once however many callers race it', async () => {
    const shim = newShim();
    const [first, second] = await Promise.all([shim.start(), shim.start()]);
    expect(first).toBe(second);
  });

  it('falls back to a random port when the registered one is taken', async () => {
    const blocker = newShim();
    await blocker.start();

    const fallback = newShim();
    const port = await fallback.start();
    expect(port).not.toBe(DEFAULT_LOOPBACK_PORT);
    expect(fallback.getRedirectURL()).toBe(`http://127.0.0.1:${port}/`);
  });

  it('resolves the flow with the redirect URL the browser actually hit', async () => {
    const shim = newShim();
    const port = await shim.start();
    const flow = shim.launchWebAuthFlow({
      url: `https://myanimelist.net/v1/oauth2/authorize?state=abc123&response_type=code`,
      interactive: true,
    });

    const response = await fetch(
      `http://127.0.0.1:${port}/oauth2callback?code=the-code&state=abc123`,
    );
    expect(response.status).toBe(200);
    await expect(flow).resolves.toBe(
      `http://127.0.0.1:${port}/oauth2callback?code=the-code&state=abc123`,
    );
    expect(openExternal).toHaveBeenCalledWith(
      `https://myanimelist.net/v1/oauth2/authorize?state=abc123&response_type=code`,
    );
  });

  it('leaves a mismatched state pending, since MAL rejecting the code must not end the flow', async () => {
    const shim = newShim();
    const port = await shim.start();
    const flow = shim.launchWebAuthFlow({
      url: `https://myanimelist.net/v1/oauth2/authorize?state=expected`,
      interactive: true,
    });
    let settled = false;
    void flow.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    const response = await fetch(`http://127.0.0.1:${port}/callback?code=c&state=attacker`);
    expect(await response.text()).toContain('not an AnimeLens sign-in callback');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
  });

  it('accepts a callback with no state when the authorize URL had none', async () => {
    const shim = newShim();
    const port = await shim.start();
    const flow = shim.launchWebAuthFlow({
      url: 'https://myanimelist.net/v1/oauth2/authorize?response_type=code',
      interactive: true,
    });

    await fetch(`http://127.0.0.1:${port}/callback?code=c`);
    await expect(flow).resolves.toContain('code=c');
  });

  it('rejects an in-flight flow instead of hanging when the app shuts down', async () => {
    const shim = newShim();
    const flow = shim.launchWebAuthFlow({
      url: 'https://myanimelist.net/v1/oauth2/authorize?state=s',
      interactive: true,
    });

    shim.dispose();
    await expect(flow).rejects.toThrow(/shutting down/i);
  });

  it('can sign in again after a dispose', async () => {
    const shim = newShim();
    shim.dispose();
    await expect(shim.start()).resolves.toBeGreaterThan(0);
  });
});
