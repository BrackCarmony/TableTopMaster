import { describe, expect, it } from 'vitest'
import { legacyStatMultiplier, legacyTierCost, LEGACY_TIER_BASE_COST, LEGACY_TIER_GROWTH } from './legacy'

describe('legacyTierCost', () => {
  it('starts at the base cost for tier 0', () => {
    expect(legacyTierCost(0)).toBe(LEGACY_TIER_BASE_COST)
  })

  it('grows without a cap as tiers stack', () => {
    const t0 = legacyTierCost(0)
    const t1 = legacyTierCost(1)
    const t2 = legacyTierCost(2)
    const t10 = legacyTierCost(10)
    expect(t1).toBeGreaterThan(t0)
    expect(t2).toBeGreaterThan(t1)
    expect(t10).toBeGreaterThan(t2)
    expect(t1).toBe(Math.round(LEGACY_TIER_BASE_COST * LEGACY_TIER_GROWTH))
  })
})

describe('legacyStatMultiplier', () => {
  it('is 1 (no bonus) at tier 0', () => {
    expect(legacyStatMultiplier(0)).toBe(1)
  })

  it('compounds with each tier rather than staying flat', () => {
    const m1 = legacyStatMultiplier(1)
    const m2 = legacyStatMultiplier(2)
    expect(m1).toBeGreaterThan(1)
    expect(m2).toBeGreaterThan(m1)
  })
})
