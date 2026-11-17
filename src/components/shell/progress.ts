// Tables only store how long is left until their next encounter, not how long the wait was, so
// remember the longest each one has counted down from to draw a progress bar against.
const longest = new Map<string, number>()
const last = new Map<string, number>()

/** 0..1 through a table's wait for its next encounter. */
export function useCooldownProgress(id: string, remaining: number): number {
  const prev = last.get(id) ?? 0
  // A new wait starts whenever the time left jumps back up.
  if (remaining > prev || !longest.has(id)) longest.set(id, Math.max(remaining, 1))
  last.set(id, remaining)
  const full = longest.get(id)!
  return Math.max(0, Math.min(1, 1 - remaining / full))
}
