import { useEffect, useRef } from 'react';
import {
  recordUsage,
  settledUsageStreak,
  type UsageEvent,
  type UsageStreak,
} from '../profile/usage-streak';

// Frequent enough that closing the popup loses at most one tick, cheap enough that a long session does not thrash storage.
const TICK_MS = 15_000;
// A popup open for a day is not plausible; without this, a suspended laptop would bank idle time.
const MAX_TICK_MS = 60 * 60 * 1000;

export interface UsageSessionInput {
  readonly streak: UsageStreak;
  /** Held back until the stored streak has been read, so the first write cannot overwrite it. */
  readonly enabled: boolean;
  readonly onEvent: (event: UsageEvent) => void;
}

/**
 * Folds visible popup time into the streak. A Chrome popup is destroyed the moment it closes, so the
 * accumulated time is stored rather than held in memory across sessions.
 */
export function useUsageSession({ streak, enabled, onEvent }: UsageSessionInput): void {
  const streakRef = useRef(streak);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return undefined;
    let visibleMs = settledUsageStreak(streakRef.current, Date.now()).visibleMs;
    let lastTickAt = Date.now();

    const observe = () => {
      const now = Date.now();
      const elapsed = Math.min(now - lastTickAt, MAX_TICK_MS);
      lastTickAt = now;
      if (document.visibilityState === 'visible') visibleMs += elapsed;

      const event = recordUsage(streakRef.current, now, visibleMs);
      streakRef.current = event.streak;
      onEventRef.current(event);
    };

    observe();
    const timer = window.setInterval(observe, TICK_MS);
    document.addEventListener('visibilitychange', observe);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', observe);
    };
  }, [enabled]);
}
