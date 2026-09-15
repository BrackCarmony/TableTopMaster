import { describe, expect, it } from 'vitest'
import { dominantTrait, rollPersonality } from './personality'
import { createRng } from './rng'

describe('dominantTrait', () => {
  it('picks the trait with the highest value', () => {
    expect(dominantTrait({ whimsy: 10, tactical: 90, aggression: 5, stoic: 20 })).toBe('tactical')
  })

  it('breaks ties in favor of the first trait, deterministically', () => {
    expect(dominantTrait({ whimsy: 50, tactical: 50, aggression: 50, stoic: 50 })).toBe('whimsy')
  })
})

describe('rollPersonality', () => {
  it('rolls every trait within 0-100', () => {
    const traits = rollPersonality(createRng(123))
    for (const value of Object.values(traits)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })
})
