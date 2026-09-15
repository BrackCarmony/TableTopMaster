import { describe, expect, it } from 'vitest'
import { CLASS_TIERS, maxTier, rollRole } from './classes'
import { createRng } from '../rng'

describe('rollRole', () => {
  it('rolls roughly uniformly when all tiers are equal', () => {
    const counts = { tank: 0, dps: 0, healer: 0 }
    const rng = createRng(7)
    for (let i = 0; i < 3000; i++) {
      counts[rollRole(rng, { tank: 1, dps: 1, healer: 1 })]++
    }
    for (const count of Object.values(counts)) {
      expect(count / 3000).toBeGreaterThan(0.28)
      expect(count / 3000).toBeLessThan(0.38)
    }
  })

  it('strongly favors a role the player has invested far more into', () => {
    const counts = { tank: 0, dps: 0, healer: 0 }
    const rng = createRng(11)
    for (let i = 0; i < 3000; i++) {
      counts[rollRole(rng, { tank: 5, dps: 1, healer: 1 })]++
    }
    // weight 5 of 7 total -> ~71% expected
    expect(counts.tank / 3000).toBeGreaterThan(0.6)
    expect(counts.dps / 3000).toBeLessThan(0.25)
    expect(counts.healer / 3000).toBeLessThan(0.25)
  })

  it('never rolls a role with zero weight', () => {
    const rng = createRng(3)
    for (let i = 0; i < 500; i++) {
      const role = rollRole(rng, { tank: 0, dps: 4, healer: 0 })
      expect(role).toBe('dps')
    }
  })
})

describe('class tiers', () => {
  it('has at least 5 tiers per role, each strictly stronger than the last, with escalating unlock cost', () => {
    for (const role of ['tank', 'dps', 'healer'] as const) {
      const tiers = CLASS_TIERS[role]
      expect(tiers.length).toBeGreaterThanOrEqual(5)
      expect(maxTier(role)).toBe(tiers.length)
      for (let i = 1; i < tiers.length; i++) {
        const prev = tiers[i - 1]
        const cur = tiers[i]
        expect(cur.unlockCost).toBeGreaterThan(prev.unlockCost)
        const prevPower = prev.baseMaxHp + prev.baseAttackPower + prev.baseDefense + prev.baseHealPower
        const curPower = cur.baseMaxHp + cur.baseAttackPower + cur.baseDefense + cur.baseHealPower
        expect(curPower).toBeGreaterThan(prevPower)
      }
    }
  })
})
