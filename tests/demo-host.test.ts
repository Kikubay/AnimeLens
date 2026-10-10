import { beforeEach, describe, expect, it } from 'vitest';

// The demo host reads its seed and active provider from `sessionStorage` when the module is
// first imported, and the suite runs in a plain Node environment, so both globals are stubbed
// before the module under test is pulled in.
const sessionStorage = {
  store: new Map<string, string>(),
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  },
  removeItem(key: string): void {
    this.store.delete(key);
  },
};

Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorage, configurable: true });
Object.defineProperty(globalThis, 'window', {
  value: { sessionStorage },
  configurable: true,
  writable: true,
});

const { dispatchDemoMessage } = await import('../src/demo/dispatch');

async function send(
  message: unknown,
): Promise<{ readonly ok?: boolean; readonly message?: string }> {
  return (await dispatchDemoMessage(message)) as { ok?: boolean; message?: string };
}

describe('demo host', () => {
  beforeEach(() => {
    sessionStorage.store.clear();
  });

  it.each([
    { type: 'auth.connect', providerId: 'mal' },
    { type: 'auth.connect', providerId: 'anilist' },
    { type: 'auth.disconnect', providerId: 'mal' },
    { type: 'auth.complete_pin_connect', providerId: 'anilist', token: 'anything' },
    { type: 'auth.get_pin_token' },
    { type: 'settings.update_mal_client_id', clientId: 'abc' },
    { type: 'settings.update_anilist_client_id', clientId: 'abc' },
    { type: 'settings.clear_cache' },
    { type: 'settings.delete_local_data' },
    { type: 'settings.disconnect_mal' },
    { type: 'mal.list.add', animeId: 1, status: 'plan_to_watch' },
  ])('refuses $type so no account can be reached', async (message) => {
    const response = await send(message);
    // `auth.get_pin_token` only reports whether a tab is open, which is always false here.
    if (message.type === 'auth.get_pin_token') {
      expect(response).toMatchObject({ ok: true, pinToken: null });
      return;
    }
    expect(response.ok).toBe(false);
    expect(response.message).toMatch(/demo/i);
  });

  it('answers with an authenticated snapshot but no real credentials', async () => {
    const response = (await dispatchDemoMessage({ type: 'auth.get_snapshot' })) as {
      readonly ok: boolean;
      readonly snapshot: {
        readonly status: string;
        readonly profile: { readonly username: string };
      };
    };

    expect(response.ok).toBe(true);
    expect(response.snapshot.status).toBe('authenticated');
    expect(response.snapshot.profile.username).toBe('demo_viewer');
  });

  it('marks both providers as available so Settings can switch between them', async () => {
    const response = (await dispatchDemoMessage({ type: 'auth.get_providers' })) as {
      readonly providers: readonly {
        readonly id: string;
        readonly signedIn: boolean;
        readonly active: boolean;
      }[];
    };

    expect(response.providers.map((provider) => provider.id)).toEqual(['mal', 'anilist']);
    expect(response.providers.every((provider) => provider.signedIn)).toBe(true);
    expect(response.providers.filter((provider) => provider.active)).toHaveLength(1);
  });

  it('generates a populated dashboard whose recommendations belong to the active provider', async () => {
    const first = (await dispatchDemoMessage({
      type: 'recommendations.get_dashboard',
    })) as {
      readonly snapshot: {
        readonly status: string;
        readonly analyzedCount: number;
        readonly sections: readonly {
          readonly id: string;
          readonly recommendations: readonly { readonly anime: { readonly provider: string } }[];
        }[];
      };
    };

    expect(first.snapshot.status).toBe('ready');
    expect(first.snapshot.analyzedCount).toBeGreaterThan(10);
    const recommendations = first.snapshot.sections.flatMap((section) => section.recommendations);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((item) => item.anime.provider === 'mal')).toBe(true);

    await dispatchDemoMessage({ type: 'auth.set_active_provider', providerId: 'anilist' });
    const second = (await dispatchDemoMessage({
      type: 'recommendations.get_dashboard',
    })) as typeof first;
    const switched = second.snapshot.sections
      .flatMap((section) => section.recommendations)
      .map((item) => item.anime.provider);
    expect(switched.length).toBeGreaterThan(0);
    expect(new Set(switched)).toEqual(new Set(['anilist']));
  });

  it('ignores messages it does not implement, like an unclaimed runtime channel', async () => {
    expect(await dispatchDemoMessage({ type: 'nothing.like.this' })).toBeUndefined();
    expect(await dispatchDemoMessage('not an object')).toBeUndefined();
  });

  // The popup polls `sync.get_snapshot` every 750ms and reloads the dashboard whenever
  // `lastSyncedAt` moves, so a timestamp that ticked on every poll made Discover flicker.
  it('keeps the sync snapshot identical across polls until a sync is asked for', async () => {
    const poll = async () =>
      (
        (await dispatchDemoMessage({ type: 'sync.get_snapshot' })) as {
          readonly snapshot: { readonly metadata: { readonly lastSyncedAt: string } };
        }
      ).snapshot;

    const first = await poll();
    const second = await poll();
    expect(second.metadata.lastSyncedAt).toBe(first.metadata.lastSyncedAt);

    const synced = await (
      (await dispatchDemoMessage({ type: 'sync.start' })) as {
        readonly snapshot: { readonly metadata: { readonly lastSyncedAt: string } };
      }
    ).snapshot;
    expect(synced.metadata.lastSyncedAt).not.toBe(first.metadata.lastSyncedAt);
  });
});
