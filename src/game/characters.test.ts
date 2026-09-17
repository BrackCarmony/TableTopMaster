import { describe, expect, it } from 'vitest'
import { createCharacterForPlayer, projectStatsAtLevel } from './characters'
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

  it('starts bonusLevels higher and grows stats for every skipped level, same as normal leveling', () => {
    const player = makePlayer({ roleTiers: { tank: 1, dps: 1, healer: 1 } })
    const tierDef = getClassTier('tank', 1)
    const character = createCharacterForPlayer(player, createRng(1), 'tank', 5)

    expect(character.level).toBe(6) // started at 1, skipped 5 levels
    // tank grows +6 maxHp / +1 attackPower / +1 defense per level
    expect(character.maxHp).toBe(tierDef.baseMaxHp + 6 * 5)
    expect(character.attackPower).toBe(tierDef.baseAttackPower + 1 * 5)
    expect(character.defense).toBe(tierDef.baseDefense + 1 * 5)
  })

  it('defaults to no bonus levels when none are passed', () => {
    const player = makePlayer({ roleTiers: { tank: 1, dps: 1, healer: 1 } })
    const character = createCharacterForPlayer(player, createRng(1), 'tank')
    expect(character.level).toBe(1)
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

describe('projectStatsAtLevel', () => {
  it('matches the tier base stats exactly at level 1', () => {
    const tierDef = getClassTier('healer', 3)
    const projected = projectStatsAtLevel('healer', tierDef, 1)
    expect(projected).toEqual({
      maxHp: tierDef.baseMaxHp,
      attackPower: tierDef.baseAttackPower,
      defense: tierDef.baseDefense,
      healPower: tierDef.baseHealPower,
    })
  })

  it('matches createCharacterForPlayer + repeated leveling for an arbitrary level, for every role', () => {
    for (const role of ['tank', 'dps', 'healer'] as const) {
      const tierDef = getClassTier(role, 4)
      const projected = projectStatsAtLevel(role, tierDef, 12)

      const player = makePlayer({ roleTiers: { tank: 4, dps: 4, healer: 4 } })
      const leveled = createCharacterForPlayer(player, createRng(1), role, 11) // 1 + 11 bonus levels = level 12

      expect(projected).toEqual({
        maxHp: leveled.maxHp,
        attackPower: leveled.attackPower,
        defense: leveled.defense,
        healPower: leveled.healPower,
      })
    }
  })
})
