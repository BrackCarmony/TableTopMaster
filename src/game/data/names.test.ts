import { describe, expect, it } from 'vitest'
import { rollPlayerName, shipNameForIndex, SHIP_NAMES, STANDARD_NAMES } from './names'
import { createRng } from '../rng'

describe('rollPlayerName', () => {
  it('never returns a name already in existingNames while alternatives remain', () => {
    const taken = STANDARD_NAMES.slice(0, STANDARD_NAMES.length - 1)
    for (let seed = 0; seed < 20; seed++) {
      const name = rollPlayerName(createRng(seed), taken)
      expect(taken).not.toContain(name)
    }
  })

  it('falls back to the full pool once every name is taken', () => {
    const name = rollPlayerName(createRng(1), [...STANDARD_NAMES])
    expect(STANDARD_NAMES).toContain(name)
  })
})

describe('shipNameForIndex', () => {
  it('gives every fleet slot up to the max ship count its own distinct name', () => {
    // BASE_SHIP_SLOTS (1) + all 6 more-ships upgrade tiers = 7 total slots.
    const names = Array.from({ length: 7 }, (_, i) => shipNameForIndex(i + 1))
    expect(new Set(names).size).toBe(7)
    expect(names).toEqual(SHIP_NAMES)
  })

  it('falls back to a generic name past the named list instead of returning undefined', () => {
    expect(shipNameForIndex(8)).toBe('Ship 8')
  })
})
