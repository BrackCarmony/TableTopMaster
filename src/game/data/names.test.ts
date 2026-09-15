import { describe, expect, it } from 'vitest'
import { rollPlayerName, STANDARD_NAMES } from './names'
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
