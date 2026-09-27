import { describe, expect, it } from 'vitest'
import { MODULES } from '../../game/data/modules'
import { ENEMY_SPRITES } from './sprites'

describe('ENEMY_SPRITES', () => {
  it('has an explicit entry for every enemy name actually used across every module, not just the fallback', () => {
    const usedNames = new Set<string>()
    for (const moduleDef of MODULES) {
      for (const encounter of moduleDef.encounters) {
        for (const enemy of encounter.enemies) usedNames.add(enemy.name)
      }
    }

    const missing = [...usedNames].filter((name) => !(name in ENEMY_SPRITES))
    expect(missing).toEqual([])
  })

  it('has no stale entries for names no encounter actually uses', () => {
    const usedNames = new Set<string>()
    for (const moduleDef of MODULES) {
      for (const encounter of moduleDef.encounters) {
        for (const enemy of encounter.enemies) usedNames.add(enemy.name)
      }
    }

    const stale = Object.keys(ENEMY_SPRITES).filter((name) => !usedNames.has(name))
    expect(stale).toEqual([])
  })
})
