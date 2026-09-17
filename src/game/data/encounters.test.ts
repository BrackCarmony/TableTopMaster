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

      it(`${encounter.id} has in-bounds, non-colliding enemy positions`, () => {
        const seen = new Set<string>()
        for (const enemy of encounter.enemies) {
          expect(enemy.position.x).toBeGreaterThanOrEqual(0)
          expect(enemy.position.x).toBeLessThan(encounter.gridWidth)
          expect(enemy.position.y).toBeGreaterThanOrEqual(0)
          expect(enemy.position.y).toBeLessThan(encounter.gridHeight)

          const key = `${enemy.position.x},${enemy.position.y}`
          expect(seen.has(key)).toBe(false)
          seen.add(key)
        }
      })
    }
  }
})

describe('encounter enemy headcount grows with tier', () => {
  it('later campaign tiers field more enemies than early ones, up to a full 7-seat table', () => {
    const campaignModules = MODULES.filter((m) => m.kind === 'campaign').sort((a, b) => a.tier - b.tier)
    expect(campaignModules.length).toBeGreaterThan(1) // otherwise this test proves nothing

    const maxEnemyCount = (m: (typeof campaignModules)[number]) => Math.max(...m.encounters.map((e) => e.enemies.length))

    const earliestCount = maxEnemyCount(campaignModules[0])
    const finalCount = maxEnemyCount(campaignModules[campaignModules.length - 1])
    expect(finalCount).toBeGreaterThan(earliestCount)
    expect(finalCount).toBe(7) // the final tier fields a full table's worth
  })
})
