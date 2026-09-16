import { describe, expect, it } from 'vitest'
import { BASE_TABLE_CAPACITY } from '../engine'
import { MODULES } from './modules'
import { UPGRADES } from './upgrades'

function maxObtainableTableCapacity(): number {
  const bonus = UPGRADES.filter((u) => u.effect.kind === 'tableCapacityBonus').reduce(
    (sum, u) => sum + (u.effect.kind === 'tableCapacityBonus' ? u.effect.value : 0),
    0,
  )
  return BASE_TABLE_CAPACITY + bonus
}

describe('encounter party start positions', () => {
  const maxCapacity = maxObtainableTableCapacity()

  it('has more than one capacity upgrade to actually test against (sanity check)', () => {
    // If this ever fails, maxObtainableTableCapacity() collapsed to just the
    // base and the test below would pass trivially without exercising the
    // wrap-around bug this file guards against.
    expect(maxCapacity).toBeGreaterThan(BASE_TABLE_CAPACITY)
  })

  for (const moduleDef of MODULES) {
    for (const encounter of moduleDef.encounters) {
      it(`${encounter.id} has enough distinct in-bounds party start positions for a full ${maxCapacity}-seat table`, () => {
        expect(encounter.partyStartPositions.length).toBeGreaterThanOrEqual(maxCapacity)

        const seen = new Set<string>()
        for (const pos of encounter.partyStartPositions) {
          expect(pos.x).toBeGreaterThanOrEqual(0)
          expect(pos.x).toBeLessThan(encounter.gridWidth)
          expect(pos.y).toBeGreaterThanOrEqual(0)
          expect(pos.y).toBeLessThan(encounter.gridHeight)

          const key = `${pos.x},${pos.y}`
          expect(seen.has(key)).toBe(false)
          seen.add(key)
        }
      })
    }
  }
})
