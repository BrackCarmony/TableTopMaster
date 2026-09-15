import { describe, expect, it } from 'vitest'
import { computeInfamyReward } from './engine'

describe('computeInfamyReward', () => {
  it('scales with the square root of lifetime gold', () => {
    const amount = computeInfamyReward(1000, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBe(Math.floor(Math.sqrt(100)))
  })

  it('grants at least 1 infamy per character even with low lifetime gold', () => {
    const amount = computeInfamyReward(0, 2, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBe(2)
  })

  it('applies the infamy multiplier and rounds', () => {
    const base = computeInfamyReward(1000, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    const boosted = computeInfamyReward(1000, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1.25 })
    expect(boosted).toBe(Math.max(1, Math.round(base * 1.25)))
  })

  it('never returns less than 1', () => {
    const amount = computeInfamyReward(0, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBeGreaterThanOrEqual(1)
  })
})
