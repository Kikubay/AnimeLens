import { promises as fs } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export interface StorageAreaShim {
  get(keys?: string | readonly string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface SecretCodec {
  encrypt(plain: string): string;
  decrypt(payload: string): string;
}

const SECRET_KEYS: readonly string[] = ['authSession', 'anilistPinToken'];
const SECRET_KEY_PREFIXES: readonly string[] = ['authSession:'];
const SECRET_FILE_NAME = 'animelens-credentials.json';
const SECRET_FILE_VERSION = 1;
const FILE_MODE = 0o600;

interface SecretEntry {
  readonly encrypted: boolean;
  readonly payload: string;
}

function isSecretKey(key: string): boolean {
  if (SECRET_KEYS.includes(key)) return true;
  return SECRET_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function normalizeKeys(
  keys: string | readonly string[] | null | undefined,
): readonly string[] | null {
  if (keys === undefined || keys === null) return null;
  return typeof keys === 'string' ? [keys] : keys;
}

export class FileStorageArea implements StorageAreaShim {
  private cache: Record<string, unknown> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  /** Shared so concurrent first-reads hit the disk once. */
  private loading: Promise<Record<string, unknown>> | null = null;
  private preservedSecrets: Record<string, SecretEntry> = {};
  private resolvedCodec: SecretCodec | null | undefined;
  private writtenStore: string | null = null;
  private writtenSecrets: string | null = null;
  private readonly secretFilePath: string;

  constructor(
    private readonly filePath: string,
    private readonly codecFactory: (() => SecretCodec | null) | null = null,
    secretFilePath?: string,
  ) {
    this.secretFilePath = secretFilePath ?? join(dirname(filePath), SECRET_FILE_NAME);
  }

  private codec(): SecretCodec | null {
    if (this.resolvedCodec === undefined) {
      this.resolvedCodec = this.codecFactory?.() ?? null;
    }
    return this.resolvedCodec;
  }

  private load(): Promise<Record<string, unknown>> {
    if (this.cache !== null) return Promise.resolve(this.cache);
    this.loading ??= this.loadFromDisk();
    return this.loading;
  }

  private async loadFromDisk(): Promise<Record<string, unknown>> {
    const store = await readJsonObject(this.filePath);
    const secretEntries = await readSecretEntries(this.secretFilePath);
    const secrets: Record<string, unknown> = {};
    const preserved: Record<string, SecretEntry> = {};
    for (const [key, entry] of Object.entries(secretEntries)) {
      const decoded = this.decodeSecret(entry);
      if (decoded === undefined) {
        preserved[key] = entry;
        continue;
      }
      secrets[key] = decoded;
    }
    let migrated = false;
    for (const key of Object.keys(store)) {
      if (!isSecretKey(key)) continue;
      if (!Object.hasOwn(secrets, key)) secrets[key] = store[key];
      migrated = true;
    }
    this.preservedSecrets = preserved;
    this.cache = { ...store, ...secrets };
    if (migrated) await this.persist(this.cache);
    await applyFileMode(this.filePath);
    await applyFileMode(this.secretFilePath);
    return this.cache;
  }

  private decodeSecret(entry: SecretEntry): unknown {
    try {
      if (!entry.encrypted) {
        return JSON.parse(Buffer.from(entry.payload, 'base64').toString('utf8'));
      }
      const codec = this.codec();
      if (codec === null) return undefined;
      return JSON.parse(codec.decrypt(entry.payload));
    } catch {
      return undefined;
    }
  }

  private encodeSecret(value: unknown): SecretEntry | undefined {
    const plain = JSON.stringify(value);
    if (plain === undefined) return undefined;
    const plainEntry = (): SecretEntry => ({
      encrypted: false,
      payload: Buffer.from(plain, 'utf8').toString('base64'),
    });
    const codec = this.codec();
    if (codec === null) return plainEntry();
    try {
      return { encrypted: true, payload: codec.encrypt(plain) };
    } catch {
      return plainEntry();
    }
  }

  private async persist(view: Record<string, unknown>): Promise<void> {
    const store: Record<string, unknown> = {};
    const secretEntries: Record<string, SecretEntry> = { ...this.preservedSecrets };
    for (const [key, value] of Object.entries(view)) {
      if (!isSecretKey(key)) {
        store[key] = value;
        continue;
      }
      const encoded = this.encodeSecret(value);
      if (encoded !== undefined) secretEntries[key] = encoded;
    }
    this.cache = view;
    const storeJson = JSON.stringify(store);
    if (storeJson !== this.writtenStore) {
      await writeJsonFile(this.filePath, store);
      this.writtenStore = storeJson;
    }
    const secretFile = { version: SECRET_FILE_VERSION, entries: secretEntries };
    const secretJson = JSON.stringify(secretFile);
    if (secretJson !== this.writtenSecrets) {
      await writeJsonFile(this.secretFilePath, secretFile);
      this.writtenSecrets = secretJson;
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    // Keep the chain alive even when a write rejects.
    this.queue = run.catch(() => undefined);
    return run;
  }

  async get(keys?: string | readonly string[] | null): Promise<Record<string, unknown>> {
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
      await this.persist(store);
    });
  }

  async remove(keys: string | readonly string[]): Promise<void> {
    await this.enqueue(async () => {
      const store = { ...(await this.load()) };
      for (const key of normalizeKeys(keys) ?? []) {
        delete store[key];
        delete this.preservedSecrets[key];
      }
      await this.persist(store);
    });
  }

  async clear(): Promise<void> {
    await this.enqueue(async () => {
      this.preservedSecrets = {};
      await this.persist({});
    });
  }
}

export class MemoryStorageArea implements StorageAreaShim {
  private store: Record<string, unknown> = {};

  async get(keys?: string | readonly string[] | null): Promise<Record<string, unknown>> {
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

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    // A hand-edited or truncated file must not brick the app; start clean.
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function readSecretEntries(path: string): Promise<Record<string, SecretEntry>> {
  const parsed = await readJsonObject(path);
  if (parsed.version !== SECRET_FILE_VERSION) return {};
  const entries = parsed.entries;
  if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) return {};
  const result: Record<string, SecretEntry> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (!isSecretEntry(value)) continue;
    result[key] = value;
  }
  return result;
}

function isSecretEntry(value: unknown): value is SecretEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.encrypted === 'boolean' &&
    typeof candidate.payload === 'string' &&
    candidate.payload.length > 0
  );
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const directory = dirname(path);
  await fs.mkdir(directory, { recursive: true });
  const temporary = join(directory, `.${basename(path)}.${process.pid}.tmp`);
  await fs.writeFile(temporary, JSON.stringify(data), { encoding: 'utf8', mode: FILE_MODE });
  await applyFileMode(temporary);
  try {
    await fs.rename(temporary, path);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
  await applyFileMode(path);
}

async function applyFileMode(path: string): Promise<void> {
  try {
    await fs.chmod(path, FILE_MODE);
  } catch {
    return;
  }
}
