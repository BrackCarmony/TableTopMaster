import { describe, expect, it } from 'vitest'
import { getTrophyQuality, TROPHY_QUALITY_NAMES } from './trophies'

describe('getTrophyQuality', () => {
  it('maps tier 0 to the first named quality', () => {
    expect(getTrophyQuality(0)).toBe(TROPHY_QUALITY_NAMES[0])
  })

  it('maps each in-range tier to its own named quality', () => {
    TROPHY_QUALITY_NAMES.forEach((name, tier) => {
      expect(getTrophyQuality(tier)).toBe(name)
    })
  })

  it('falls back to a "+N" suffix past the named list instead of throwing or repeating', () => {
    const overflowTier = TROPHY_QUALITY_NAMES.length + 2
    const quality = getTrophyQuality(overflowTier)
    expect(quality).toContain(TROPHY_QUALITY_NAMES[TROPHY_QUALITY_NAMES.length - 1])
    expect(quality).not.toBe(TROPHY_QUALITY_NAMES[TROPHY_QUALITY_NAMES.length - 1])
  })
})
