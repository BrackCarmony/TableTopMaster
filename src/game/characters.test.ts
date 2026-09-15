import { describe, expect, it } from 'vitest'
import { createCharacterForPlayer } from './characters'
import { getClassTier } from './data/classes'
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
})
