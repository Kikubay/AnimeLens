import { describe, expect, it } from 'vitest';
import {
  ProviderRegistry,
  isProviderId,
  type StorageAdapterShape,
} from '../src/providers/provider-registry';

function memoryStorage(): StorageAdapterShape & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    async get(keys: string | string[]) {
      const out: Record<string, unknown> = {};
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (map.has(key)) out[key] = map.get(key);
      }
      return out;
    },
    async set(items: Record<string, unknown>) {
      for (const [key, value] of Object.entries(items)) map.set(key, value);
    },
  };
}

describe('ProviderRegistry', () => {
  it('defaults to MAL when nothing is stored', async () => {
    const registry = new ProviderRegistry(memoryStorage());
    await expect(registry.getActiveProvider()).resolves.toBe('mal');
  });

  it('persists and re-reads the active provider', async () => {
    const storage = memoryStorage();
    const registry = new ProviderRegistry(storage);
    await registry.setActiveProvider('anilist');
    expect(storage.map.get('activeProvider')).toBe('anilist');
    await expect(new ProviderRegistry(storage).getActiveProvider()).resolves.toBe('anilist');
  });

  it('falls back to MAL for corrupt stored values', async () => {
    const storage = memoryStorage();
    storage.map.set('activeProvider', 'kitsu');
    const registry = new ProviderRegistry(storage);
    await expect(registry.getActiveProvider()).resolves.toBe('mal');
  });

  it('validates provider ids', () => {
    expect(isProviderId('mal')).toBe(true);
    expect(isProviderId('anilist')).toBe(true);
    expect(isProviderId('kitsu')).toBe(false);
    expect(isProviderId(null)).toBe(false);
  });
});
