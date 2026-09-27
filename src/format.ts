/** Formats a number with American-style thousands separators, e.g. 1234567 -> "1,234,567". */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

const COMPACT_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

/**
 * Formats a number with a single letter/short-scale suffix instead of full
 * digits, e.g. 30923 -> "30.9K", 720731 -> "720.7K", 999950 -> "1M" (rounds
 * up into the next suffix rather than printing "1000.0K"). Used for tight
 * spaces like a battle-grid unit token, where a full "1,234,567" would
 * overflow long before "1.2M" does. Falls back to plain digits below 1000,
 * and to the largest known suffix (undecillion) for anything beyond that
 * rather than growing unbounded.
 */
export function formatCompact(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs < 1000) return sign + Math.round(abs).toString()

  let tier = Math.min(COMPACT_SUFFIXES.length - 1, Math.floor(Math.log10(abs) / 3))
  let scaled = abs / 1000 ** tier
  let rounded = Math.round(scaled * 10) / 10
  if (rounded >= 1000 && tier < COMPACT_SUFFIXES.length - 1) {
    tier += 1
    scaled = abs / 1000 ** tier
    rounded = Math.round(scaled * 10) / 10
  }
  const text = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1)
  return sign + text + COMPACT_SUFFIXES[tier]
}

/** Formats a millisecond duration as the two most relevant units, e.g. "2d 4h", "3h 12m", "5m 30s", "12s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
