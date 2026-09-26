import { describe, expect, it } from 'vitest'
import { ARTIFACTS, getArtifactById } from './artifacts'

describe('ARTIFACTS', () => {
  it('has no duplicate ids', () => {
    const ids = ARTIFACTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has exactly one artifact per role', () => {
    const roles = ARTIFACTS.map((a) => a.role)
    expect(new Set(roles).size).toBe(ARTIFACTS.length)
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
