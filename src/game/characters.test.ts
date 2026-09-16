import { describe, expect, it } from 'vitest'
import { createCharacterForPlayer } from './characters'
import { getClassTier } from './data/classes'
import { legacyStatMultiplier } from './data/legacy'
import { createRng } from './rng'
import type { Player } from './types'

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: 'p1',
    name: 'Test Player',
    recruitedAt: 0,
    roleTiers: { tank: 1, dps: 1, healer: 1 },
    personality: { whimsy: 0, tactical: 0, aggression: 0, stoic: 0 },
    tableId: null,
    character: null,
    legacyTier: 0,
    ...overrides,
  }
}

describe('createCharacterForPlayer', () => {
  it('always uses the stat block for the rolled role at that role’s currently unlocked tier', () => {
    const player = makePlayer({ roleTiers: { tank: 2, dps: 3, healer: 1 } })
    for (let seed = 0; seed < 30; seed++) {
      const character = createCharacterForPlayer(player, createRng(seed))
      const tierDef = getClassTier(character.role, player.roleTiers[character.role])
      expect(character.maxHp).toBe(tierDef.baseMaxHp)
      expect(character.attackPower).toBe(tierDef.baseAttackPower)
      expect(character.defense).toBe(tierDef.baseDefense)
      expect(character.healPower).toBe(tierDef.baseHealPower)
      expect(tierDef.names).toContain(character.className)
    }
  })

  it('applies the player\'s legacy tier bonus on top of the role/class tier stats', () => {
    const veteran = makePlayer({ roleTiers: { tank: 2, dps: 1, healer: 1 }, legacyTier: 3 })
    const character = createCharacterForPlayer(veteran, createRng(1), 'tank')
    const tierDef = getClassTier('tank', veteran.roleTiers.tank)
    const multiplier = legacyStatMultiplier(veteran.legacyTier)

    expect(multiplier).toBeGreaterThan(1)
    expect(character.maxHp).toBe(Math.round(tierDef.baseMaxHp * multiplier))
    expect(character.attackPower).toBe(Math.round(tierDef.baseAttackPower * multiplier))
    expect(character.defense).toBe(Math.round(tierDef.baseDefense * multiplier))
  })

  it('honors an explicit forcedRole, bypassing the weighted roll entirely', () => {
    // roleTiers is all-healer weighted, so an unforced roll would almost
    // never land on tank — forcing it should still always land on tank.
    const player = makePlayer({ roleTiers: { tank: 1, dps: 1, healer: 99 } })
    for (let seed = 0; seed < 20; seed++) {
      const character = createCharacterForPlayer(player, createRng(seed), 'tank')
      expect(character.role).toBe('tank')
    }
  })
})
