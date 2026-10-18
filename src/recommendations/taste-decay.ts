/** Three years is a few anime eras: old enough to count, short enough to stop outvoting what someone watches now. */
export const TASTE_DECAY_HALF_LIFE_MS = 3 * 365 * 24 * 60 * 60 * 1000;

/** An absent or unreadable timestamp means the age is unknown rather than ancient, so it keeps full weight. */
export function tasteRecencyWeight(timestamp: string | null, now: string): number {
  if (timestamp === null) return 1;
  const observedAt = Date.parse(timestamp);
  const currentTime = Date.parse(now);
  if (!Number.isFinite(observedAt) || !Number.isFinite(currentTime)) return 1;
  const age = currentTime - observedAt;
  if (age <= 0) return 1;
  return 2 ** (-age / TASTE_DECAY_HALF_LIFE_MS);
}
