/** Formats a number with American-style thousands separators, e.g. 1234567 -> "1,234,567". */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
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
