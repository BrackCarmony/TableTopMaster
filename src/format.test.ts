import { describe, expect, it } from 'vitest'
import { formatCompact } from './format'

describe('formatCompact', () => {
  it('shows plain digits below 1000', () => {
    expect(formatCompact(0)).toBe('0')
    expect(formatCompact(42)).toBe('42')
    expect(formatCompact(999)).toBe('999')
  })

  it('uses a K suffix in the thousands, dropping a trailing .0', () => {
    expect(formatCompact(1000)).toBe('1K')
    expect(formatCompact(30923)).toBe('30.9K')
    expect(formatCompact(720731)).toBe('720.7K')
  })

  it('rolls over into the next suffix instead of printing "1000.0K"', () => {
    expect(formatCompact(999950)).toBe('1M')
  })

  it('uses M/B/T suffixes at the expected magnitudes', () => {
    expect(formatCompact(2_500_000)).toBe('2.5M')
    expect(formatCompact(1_000_000_000)).toBe('1B')
    expect(formatCompact(3_140_000_000_000)).toBe('3.1T') // single decimal place only
  })

  it('preserves the sign for negative values', () => {
    expect(formatCompact(-30923)).toBe('-30.9K')
  })

  it('never grows an unbounded suffix past the largest known one', () => {
    expect(formatCompact(1e40)).toMatch(/Dc$/)
  })
})
