import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

// Only the members AnimeLens actually calls exist, so an unported call site fails loudly instead of silently getting `undefined`.
export interface StorageAreaShim {
  get(
    keys?: string | readonly string[] | null,
  ): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

function normalizeKeys(
  keys: string | readonly string[] | null | undefined,
): readonly string[] | null {
  if (keys === undefined || keys === null) return null;
  return typeof keys === 'string' ? [keys] : keys;
}

// Writes are chained through one promise and land via temp-file rename: the popup and the sync service write concurrently, and a torn file would lose the whole list.
export class FileStorageArea implements StorageAreaShim {
  private cache: Record<string, unknown> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  /** Shared so concurrent first-reads hit the disk once. */
  private loading: Promise<Record<string, unknown>> | null = null;

  constructor(private readonly filePath: string) {}

  private load(): Promise<Record<string, unknown>> {
    if (this.cache !== null) return Promise.resolve(this.cache);
    this.loading ??= (async () => {
      try {
        const raw = await fs.readFile(this.filePath, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        // A hand-edited or truncated file must not brick the app; start clean.
        this.cache =
          typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
      } catch {
        this.cache = {};
      }
      return this.cache;
    })();
    return this.loading;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    // Keep the chain alive even when a write rejects.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async flush(next: Record<string, unknown>): Promise<void> {
    this.cache = next;
    const directory = dirname(this.filePath);
    const temporary = join(directory, `.animelens-${process.pid}.tmp`);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(temporary, JSON.stringify(next), 'utf8');
    await fs.rename(temporary, this.filePath);
  }

  async get(
    keys?: string | readonly string[] | null,
  ): Promise<Record<string, unknown>> {
    const store = { ...(await this.load()) };
    const requested = normalizeKeys(keys);
    if (requested === null) return store;
    const result: Record<string, unknown> = {};
    for (const key of requested) {
      if (Object.hasOwn(store, key)) result[key] = store[key];
    }
    return result;
  }

  async set(items: Record<string, unknown>): Promise<void> {
    await this.enqueue(async () => {
      const store = { ...(await this.load()), ...items };
      await this.flush(store);
    });
  }

  async remove(keys: string | readonly string[]): Promise<void> {
    await this.enqueue(async () => {
      const store = { ...(await this.load()) };
      for (const key of normalizeKeys(keys) ?? []) delete store[key];
      await this.flush(store);
    });
  }

  async clear(): Promise<void> {
    await this.enqueue(async () => {
      await this.flush({});
    });
  }
}

// Session storage dies with the process here too, matching the extension: the OAuth transactions parked in it are short-lived by design.
export class MemoryStorageArea implements StorageAreaShim {
  private store: Record<string, unknown> = {};

  async get(
    keys?: string | readonly string[] | null,
  ): Promise<Record<string, unknown>> {
    const requested = normalizeKeys(keys);
    if (requested === null) return { ...this.store };
    const result: Record<string, unknown> = {};
    for (const key of requested) {
      if (Object.hasOwn(this.store, key)) result[key] = this.store[key];
    }
    return result;
  }

  async set(items: Record<string, unknown>): Promise<void> {
    this.store = { ...this.store, ...items };
  }

  async remove(keys: string | readonly string[]): Promise<void> {
    const next = { ...this.store };
    for (const key of normalizeKeys(keys) ?? []) delete next[key];
    this.store = next;
  }

  async clear(): Promise<void> {
    this.store = {};
  }

  // The extension hardens session storage this way; nothing to harden here since this process renders no untrusted content.
  async setAccessLevel(): Promise<void> {}
}