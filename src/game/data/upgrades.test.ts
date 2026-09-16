import { describe, expect, it } from 'vitest'
import { UPGRADES } from './upgrades'

describe('UPGRADES', () => {
  it('has no duplicate ids', () => {
    const ids = UPGRADES.map((u) => u.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a positive cost for every upgrade', () => {
    for (const upgrade of UPGRADES) {
      expect(upgrade.cost).toBeGreaterThan(0)
    }
  })
})
