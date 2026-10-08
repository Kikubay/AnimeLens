import type { StorageAreaShim } from './storage';

/** Mirrors the `chrome.alarms.Alarm` fields the worker reads back. */
export interface AlarmInfo {
  readonly name: string;
  readonly scheduledTime?: number;
  readonly periodInMinutes?: number;
}

export interface AlarmCreateInfo {
  readonly delayInMinutes?: number;
  readonly periodInMinutes?: number;
}

interface StoredAlarm {
  readonly periodInMinutes?: number;
  /** Epoch ms, so a restart resumes the countdown instead of restarting it. */
  readonly nextRunAt: number;
}

const ALARM_STORAGE_KEY = '__animelens_alarms__';
const MAX_TIMEOUT_MS = 2_147_483_647;

interface AlarmListener {
  (alarm: AlarmInfo): void;
}

// Definitions persist through the worker's own storage: `service-worker.ts` deliberately reconciles alarms rather than recreating them, so dropping `nextRunAt` would push the daily and sync timers forward on every cold start.
export class AlarmsShim {
  private readonly listeners: AlarmListener[] = [];
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly definitions = new Map<string, StoredAlarm>();
  private hydrated: Promise<void> | null = null;

  constructor(private readonly storage: StorageAreaShim) {}

  /** Re-arms anything that came due while the app was closed. */
  hydrate(): Promise<void> {
    this.hydrated ??= (async () => {
      const stored = await this.storage.get(ALARM_STORAGE_KEY);
      const raw = stored[ALARM_STORAGE_KEY];
      if (typeof raw !== 'object' || raw === null) return;
      for (const [name, definition] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof definition !== 'object' || definition === null) continue;
        const candidate = definition as StoredAlarm;
        if (typeof candidate.nextRunAt !== 'number') continue;
        this.definitions.set(name, candidate);
        this.schedule(name, candidate);
      }
    })();
    return this.hydrated;
  }

  private async persist(): Promise<void> {
    await this.storage.set({
      [ALARM_STORAGE_KEY]: Object.fromEntries(this.definitions),
    });
  }

  private schedule(name: string, definition: StoredAlarm): void {
    const existing = this.timers.get(name);
    if (existing !== undefined) clearTimeout(existing);

    const remaining = definition.nextRunAt - Date.now();
    if (remaining > MAX_TIMEOUT_MS) {
      // Long delays need a chained timer; setTimeout overflows silently otherwise.
      this.timers.set(
        name,
        setTimeout(() => {
          this.schedule(name, definition);
        }, MAX_TIMEOUT_MS),
      );
      return;
    }

    const timer = setTimeout(
      () => {
        void this.fire(name);
      },
      Math.max(0, remaining),
    );
    // An alarm must not be the reason the app refuses to quit.
    timer.unref?.();
    this.timers.set(name, timer);
  }

  private async fire(name: string): Promise<void> {
    const definition = this.definitions.get(name);
    if (definition === undefined) return;

    let next: StoredAlarm;
    if (definition.periodInMinutes === undefined) {
      // One-shot alarms are consumed, exactly like Chrome's.
      this.definitions.delete(name);
      this.timers.delete(name);
      next = definition;
    } else {
      next = {
        periodInMinutes: definition.periodInMinutes,
        nextRunAt: Date.now() + definition.periodInMinutes * 60_000,
      };
      this.definitions.set(name, next);
      this.schedule(name, next);
    }
    await this.persist();

    const info: AlarmInfo = { name, scheduledTime: Date.now() };
    if (definition.periodInMinutes !== undefined) {
      Object.assign(info, { periodInMinutes: definition.periodInMinutes });
    }
    for (const listener of this.listeners) listener(info);
  }

  async get(name: string): Promise<AlarmInfo | undefined> {
    await this.hydrate();
    const definition = this.definitions.get(name);
    if (definition === undefined) return undefined;
    const info: AlarmInfo = { name, scheduledTime: definition.nextRunAt };
    if (definition.periodInMinutes !== undefined) {
      Object.assign(info, { periodInMinutes: definition.periodInMinutes });
    }
    return info;
  }

  async create(name: string, info: AlarmCreateInfo): Promise<void> {
    await this.hydrate();
    const delayInMinutes = info.delayInMinutes ?? info.periodInMinutes ?? 0;
    const definition: StoredAlarm = {
      nextRunAt: Date.now() + delayInMinutes * 60_000,
      ...(info.periodInMinutes === undefined ? {} : { periodInMinutes: info.periodInMinutes }),
    };
    this.definitions.set(name, definition);
    this.schedule(name, definition);
    await this.persist();
  }

  async clear(name: string): Promise<boolean> {
    await this.hydrate();
    const timer = this.timers.get(name);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(name);
    const existed = this.definitions.delete(name);
    await this.persist();
    return existed;
  }

  onAlarm: { addListener(listener: AlarmListener): void } = {
    addListener: (listener) => {
      this.listeners.push(listener);
    },
  };
}
