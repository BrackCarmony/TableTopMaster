/** Formats a number with American-style thousands separators, e.g. 1234567 -> "1,234,567". */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}
