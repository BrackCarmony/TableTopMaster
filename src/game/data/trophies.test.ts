import { describe, expect, it } from 'vitest'
import { getTrophyQuality, TROPHY_QUALITY_NAMES, TROPHY_STARTING_LEVEL_BONUS, trophyStartingLevelBonus } from './trophies'

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

describe('trophyStartingLevelBonus', () => {
  it('is 0 with no trophies', () => {
    expect(trophyStartingLevelBonus(0)).toBe(0)
  })

  it('grows linearly with the trophy count, uncapped', () => {
    expect(trophyStartingLevelBonus(1)).toBe(TROPHY_STARTING_LEVEL_BONUS)
    expect(trophyStartingLevelBonus(4)).toBe(TROPHY_STARTING_LEVEL_BONUS * 4)
    expect(trophyStartingLevelBonus(100)).toBe(TROPHY_STARTING_LEVEL_BONUS * 100)
  })
})
