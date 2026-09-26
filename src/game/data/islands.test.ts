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
})

describe('getIslandById', () => {
  it('returns undefined for an unknown id', () => {
    expect(getIslandById('not-real')).toBeUndefined()
  })
})
