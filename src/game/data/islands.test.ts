import { describe, expect, it } from 'vitest'
import { getArtifactById } from './artifacts'
import { getIslandById, ISLANDS } from './islands'

describe('ISLANDS', () => {
  it('has no duplicate ids', () => {
    const ids = ISLANDS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only references real artifact ids in each artifactPool', () => {
    for (const island of ISLANDS) {
      for (const artifactId of island.artifactPool) {
        expect(getArtifactById(artifactId)).toBeDefined()
      }
    }
  })

  it('has a positive gold reward and voyage duration', () => {
    for (const island of ISLANDS) {
      expect(island.baseGoldReward).toBeGreaterThan(0)
      expect(island.baseVoyageDurationMs).toBeGreaterThan(0)
    }
  })

  it('never has a negative unlockCost', () => {
    for (const island of ISLANDS) {
      expect(island.unlockCost).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps the first island (Sunken Reef) free, since it must already be reachable the moment Sailing itself is unlocked', () => {
    expect(ISLANDS[0].unlockCost).toBe(0)
  })

  it('has strictly increasing unlockCost and baseGoldReward after the free first island — each new island should feel like a real step up', () => {
    for (let i = 2; i < ISLANDS.length; i++) {
      expect(ISLANDS[i].unlockCost).toBeGreaterThan(ISLANDS[i - 1].unlockCost)
      expect(ISLANDS[i].baseGoldReward).toBeGreaterThan(ISLANDS[i - 1].baseGoldReward)
    }
  })

  it('gives every island its own distinct set of artifacts, none shared across islands', () => {
    const seen = new Set<string>()
    for (const island of ISLANDS) {
      for (const artifactId of island.artifactPool) {
        expect(seen.has(artifactId)).toBe(false)
        seen.add(artifactId)
      }
    }
  })
})

describe('getIslandById', () => {
  it('returns undefined for an unknown id', () => {
    expect(getIslandById('not-real')).toBeUndefined()
  })
})
