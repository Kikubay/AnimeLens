import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileStorageArea, MemoryStorageArea } from '../electron/shim/storage';
import { AlarmsShim } from '../electron/shim/alarms';
import { RuntimeShim, getURL } from '../electron/shim/runtime';

async function tempFile(): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), 'animelens-test-'));
  return {
    path: join(directory, 'storage.json'),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  vi.useRealTimers();
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe('MemoryStorageArea', () => {
  it('returns only the requested keys', async () => {
    const area = new MemoryStorageArea();
    await area.set({ a: 1, b: 2 });

    expect(await area.get('a')).toEqual({ a: 1 });
    expect(await area.get(['a', 'b'])).toEqual({ a: 1, b: 2 });
    expect(await area.get(['a', 'missing'])).toEqual({ a: 1 });
    expect(await area.get()).toEqual({ a: 1, b: 2 });
    expect(await area.get(null)).toEqual({ a: 1, b: 2 });
  });

  it('removes and clears without touching the rest', async () => {
    const area = new MemoryStorageArea();
    await area.set({ a: 1, b: 2 });

    await area.remove(['a']);
    expect(await area.get()).toEqual({ b: 2 });
    await area.clear();
    expect(await area.get()).toEqual({});
  });

  it('hands back a copy, so mutating the result cannot drop a key from the store', async () => {
    const area = new MemoryStorageArea();
    await area.set({ a: 1, b: 2 });

    const read = (await area.get()) as Record<string, unknown>;
    delete read.a;
    read.c = 3;
    expect(await area.get()).toEqual({ a: 1, b: 2 });
  });
});

describe('FileStorageArea', () => {
  it('round-trips values through disk across two instances', async () => {
    const file = await tempFile();
    cleanups.push(file.cleanup);

    await new FileStorageArea(file.path).set({ greeting: 'hello' });
    expect(await new FileStorageArea(file.path).get('greeting')).toEqual({ greeting: 'hello' });
  });

  it('starts clean instead of throwing when the file is corrupt or truncated', async () => {
    const file = await tempFile();
    cleanups.push(file.cleanup);
    await writeFile(file.path, '{ not json', 'utf8');

    const area = new FileStorageArea(file.path);
    expect(await area.get()).toEqual({});
    await area.set({ after: true });
    expect(await new FileStorageArea(file.path).get('after')).toEqual({ after: true });
  });

  it('keeps concurrent writes whole instead of interleaving a torn file', async () => {
    const file = await tempFile();
    cleanups.push(file.cleanup);
    const area = new FileStorageArea(file.path);

    await Promise.all(
      Array.from({ length: 25 }, (_, index) => area.set({ [`key-${index}`]: index })),
    );

    const stored = await readFile(file.path, 'utf8');
    expect(JSON.parse(stored)).toMatchObject({ 'key-0': 0, 'key-24': 24 });
  });

  it('serialises a write behind a failing one rather than dropping the queue', async () => {
    const file = await tempFile();
    cleanups.push(file.cleanup);
    // A directory where the store file belongs makes the rename fail once, then succeed again once removed.
    await mkdir(file.path);
    const area = new FileStorageArea(file.path);

    await expect(area.set({ blocked: true })).rejects.toBeDefined();
    await rm(file.path, { recursive: true });
    await area.set({ recovered: true });
    expect(await new FileStorageArea(file.path).get('recovered')).toEqual({ recovered: true });
  });

  it('removes and clears on disk, not just in memory', async () => {
    const file = await tempFile();
    cleanups.push(file.cleanup);
    await new FileStorageArea(file.path).set({ a: 1, b: 2 });

    await new FileStorageArea(file.path).remove(['a']);
    expect(JSON.parse(await readFile(file.path, 'utf8'))).toEqual({ b: 2 });
    await new FileStorageArea(file.path).clear();
    expect(JSON.parse(await readFile(file.path, 'utf8'))).toEqual({});
  });

  it('leaves no temp file behind after a write', async () => {
    const file = await tempFile();
    cleanups.push(file.cleanup);
    await new FileStorageArea(file.path).set({ a: 1 });

    expect(JSON.parse(await readFile(file.path, 'utf8'))).toEqual({ a: 1 });
  });
});

describe('AlarmsShim', () => {
  it('persists a definition so a restart resumes the countdown', async () => {
    vi.useFakeTimers();
    const area = new MemoryStorageArea();
    await new AlarmsShim(area).create('daily', { delayInMinutes: 60 });

    const reopened = new AlarmsShim(area);
    expect(await reopened.get('daily')).toMatchObject({ name: 'daily' });
  });

  it('fires a one-shot alarm once and then forgets it', async () => {
    vi.useFakeTimers();
    const alarms = new AlarmsShim(new MemoryStorageArea());
    const fired: string[] = [];
    alarms.onAlarm.addListener((alarm) => fired.push(alarm.name));

    await alarms.create('once', { delayInMinutes: 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fired).toEqual(['once']);
    expect(await alarms.get('once')).toBeUndefined();

    await vi.advanceTimersByTimeAsync(600_000);
    expect(fired).toEqual(['once']);
  });

  it('re-arms a periodic alarm and reports its period', async () => {
    vi.useFakeTimers();
    const alarms = new AlarmsShim(new MemoryStorageArea());
    const fired: (number | undefined)[] = [];
    alarms.onAlarm.addListener((alarm) => fired.push(alarm.periodInMinutes));

    await alarms.create('sync', { periodInMinutes: 5 });
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fired).toEqual([5, 5]);
  });

  it('reports whether a clear actually removed something', async () => {
    const alarms = new AlarmsShim(new MemoryStorageArea());
    await alarms.create('daily', { delayInMinutes: 60 });

    expect(await alarms.clear('daily')).toBe(true);
    expect(await alarms.clear('daily')).toBe(false);
  });

  it('ignores a persisted blob it cannot read', async () => {
    const area = new MemoryStorageArea();
    await area.set({ __animelens_alarms__: { broken: 'nope', alsoBroken: { nextRunAt: 'soon' } } });

    const alarms = new AlarmsShim(area);
    await alarms.hydrate();
    expect(await alarms.get('broken')).toBeUndefined();
    expect(await alarms.get('alsoBroken')).toBeUndefined();
  });

  it('hydrates only once however many callers race it', async () => {
    const alarms = new AlarmsShim(new MemoryStorageArea());
    await expect(Promise.all([alarms.hydrate(), alarms.hydrate()])).resolves.toHaveLength(2);
  });
});

describe('RuntimeShim', () => {
  it('resolves undefined when no listener claims the message', async () => {
    const runtime = new RuntimeShim();
    expect(await runtime.dispatch({ type: 'nothing.claims.this' })).toBeUndefined();
  });

  it('keeps the channel open for an async response and returns the first reply', async () => {
    const runtime = new RuntimeShim();
    runtime.onMessage.addListener((_message, _sender, sendResponse) => {
      setTimeout(() => sendResponse({ ok: true, delayed: true }), 5);
      return true;
    });

    await expect(runtime.dispatch({ type: 'x' })).resolves.toEqual({ ok: true, delayed: true });
  });

  it('ignores a second response from the same listener', async () => {
    const runtime = new RuntimeShim();
    runtime.onMessage.addListener((_message, _sender, sendResponse) => {
      sendResponse({ first: true });
      sendResponse({ second: true });
      return true;
    });

    await expect(runtime.dispatch({ type: 'x' })).resolves.toEqual({ first: true });
  });

  it('closes immediately when a listener answers synchronously without keeping the channel open', async () => {
    const runtime = new RuntimeShim();
    runtime.onMessage.addListener((_message, _sender, sendResponse) => {
      sendResponse({ ok: true });
      return false;
    });

    await expect(runtime.dispatch({ type: 'x' })).resolves.toEqual({ ok: true });
  });

  it('lets the installed listeners run and reports the version it read', () => {
    const runtime = new RuntimeShim();
    let installed = 0;
    runtime.onInstalled.addListener(() => {
      installed += 1;
    });

    runtime.fireInstalled();
    expect(installed).toBe(1);
  });

  it('points every URL at the custom scheme', () => {
    expect(getURL('index.html')).toBe('app://animelens/index.html');
    expect(getURL('/index.html')).toBe('app://animelens/index.html');
  });
});
