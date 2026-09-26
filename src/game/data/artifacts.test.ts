import { describe, expect, it } from 'vitest'
import { ARTIFACTS, getArtifactById } from './artifacts'

describe('ARTIFACTS', () => {
  it('has no duplicate ids', () => {
    const ids = ARTIFACTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('splits evenly across the three roles (one per island per role, as islands are added)', () => {
    const roles = ARTIFACTS.map((a) => a.role)
    const counts = { tank: 0, dps: 0, healer: 0 }
    for (const role of roles) counts[role]++
    expect(counts.tank).toBe(counts.dps)
    expect(counts.dps).toBe(counts.healer)
  })
})

describe('getArtifactById', () => {
  it('finds a known artifact', () => {
    expect(getArtifactById('defensive-rush')?.role).toBe('tank')
  })

  it('returns undefined for an unknown id', () => {
    expect(getArtifactById('not-real')).toBeUndefined()
  })
})
