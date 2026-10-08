import { describe, expect, it } from 'vitest'
import {
  computeGrowthPerLevel,
  createCharacterForPlayer,
  CROSS_TRAIN_ATTACK_BONUS_PER_TIER,
  CROSS_TRAIN_HP_BONUS_PER_TIER,
  CROSS_TRAIN_REGEN_PER_TIER,
  DEFAULT_ARTIFACT_BONUSES,
  projectStatsAtLevel,
  toCombatUnit,
} from './characters'
import { TAUNT_RANGE } from './combat/grid'
import { getClassTier } from './data/classes'
import { legacyStatMultiplier } from './data/legacy'
import { createRng } from './rng'
import type { Character, Player } from './types'

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
  it('always uses the stat block for the rolled role at that role’s currently unlocked tier, cross-trained by tank/dps tier', () => {
    const player = makePlayer({ roleTiers: { tank: 2, dps: 3, healer: 1 } })
    const tankHpBonus = 1 + CROSS_TRAIN_HP_BONUS_PER_TIER * (player.roleTiers.tank - 1)
    const dpsAttackBonus = 1 + CROSS_TRAIN_ATTACK_BONUS_PER_TIER * (player.roleTiers.dps - 1)
    for (let seed = 0; seed < 30; seed++) {
      const character = createCharacterForPlayer(player, createRng(seed))
      const tierDef = getClassTier(character.role, player.roleTiers[character.role])
      expect(character.maxHp).toBe(Math.round(tierDef.baseMaxHp * tankHpBonus))
      expect(character.attackPower).toBe(Math.round(tierDef.baseAttackPower * dpsAttackBonus))
      expect(character.defense).toBe(tierDef.baseDefense)
      expect(character.healPower).toBe(tierDef.baseHealPower)
      expect(tierDef.names).toContain(character.className)
    }
  })

  it('applies the player\'s legacy tier bonus and tank-tier cross-training on top of the role/class tier stats', () => {
    const veteran = makePlayer({ roleTiers: { tank: 2, dps: 1, healer: 1 }, legacyTier: 3 })
    const character = createCharacterForPlayer(veteran, createRng(1), 'tank')
    const tierDef = getClassTier('tank', veteran.roleTiers.tank)
    const multiplier = legacyStatMultiplier(veteran.legacyTier)
    const tankHpBonus = 1 + CROSS_TRAIN_HP_BONUS_PER_TIER * (veteran.roleTiers.tank - 1)

    expect(multiplier).toBeGreaterThan(1)
    expect(character.maxHp).toBe(Math.round(tierDef.baseMaxHp * multiplier * tankHpBonus))
    expect(character.attackPower).toBe(Math.round(tierDef.baseAttackPower * multiplier))
    expect(character.defense).toBe(Math.round(tierDef.baseDefense * multiplier))
  })

  it('gives every character selfRegenPercent from the owning player\'s healer tier, regardless of rolled role', () => {
    const player = makePlayer({ roleTiers: { tank: 1, dps: 1, healer: 6 } })
    for (const role of ['tank', 'dps', 'healer'] as const) {
      const character = createCharacterForPlayer(player, createRng(1), role)
      expect(character.selfRegenPercent).toBeCloseTo(CROSS_TRAIN_REGEN_PER_TIER * (6 - 1))
    }
  })

  it('gives no selfRegenPercent at the free starting healer tier', () => {
    const player = makePlayer({ roleTiers: { tank: 1, dps: 1, healer: 1 } })
    const character = createCharacterForPlayer(player, createRng(1), 'dps')
    expect(character.selfRegenPercent).toBe(0)
  })

  it('starts bonusLevels higher and grows stats for every skipped level, same as normal leveling', () => {
    const player = makePlayer({ roleTiers: { tank: 1, dps: 1, healer: 1 } })
    const tierDef = getClassTier('tank', 1)
    const character = createCharacterForPlayer(player, createRng(1), 'tank', 5)

    expect(character.level).toBe(6) // started at 1, skipped 5 levels
    // tank grows +6 maxHp / +1 attackPower / +0.25 defense per level (defense is deliberately a quarter of what it once was)
    expect(character.maxHp).toBe(tierDef.baseMaxHp + 6 * 5)
    expect(character.attackPower).toBe(tierDef.baseAttackPower + 1 * 5)
    expect(character.defense).toBeCloseTo(tierDef.baseDefense + 0.25 * 5)
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

  it('a higher class tier stays proportionally stronger at high level instead of diluting away', () => {
    // This is the exact scenario that motivated proportional growth: a
    // level-1 tier-1 Acolyte vs. a level-1 tier-10 Hand of the Divine used
    // to differ hugely, but by level 100 the old flat +4/level growth
    // swamped that gap almost entirely. Growth scaling with each tier's own
    // base now keeps the tier-10 advantage intact at any level.
    const rookiePlayer = makePlayer({ roleTiers: { tank: 1, dps: 1, healer: 1 } })
    const veteranPlayer = makePlayer({ roleTiers: { tank: 10, dps: 10, healer: 10 } })

    const level1Rookie = createCharacterForPlayer(rookiePlayer, createRng(1), 'healer')
    const level1Veteran = createCharacterForPlayer(veteranPlayer, createRng(1), 'healer')
    const level1Ratio = level1Veteran.maxHp / level1Rookie.maxHp

    const level100Rookie = createCharacterForPlayer(rookiePlayer, createRng(1), 'healer', 99)
    const level100Veteran = createCharacterForPlayer(veteranPlayer, createRng(1), 'healer', 99)
    const level100Ratio = level100Veteran.maxHp / level100Rookie.maxHp

    expect(level1Ratio).toBeGreaterThan(2) // tier 10 starts substantially ahead
    // The old flat-growth formula let this ratio collapse toward 1 at high
    // level; it should now stay close to the level-1 ratio instead.
    expect(level100Ratio).toBeGreaterThan(level1Ratio * 0.8)
  })

  it('a higher Veteran (legacy) Tier also grows faster per level, not just a bigger starting base', () => {
    const rookie = makePlayer({ roleTiers: { tank: 5, dps: 5, healer: 5 }, legacyTier: 0 })
    const veteran = makePlayer({ roleTiers: { tank: 5, dps: 5, healer: 5 }, legacyTier: 10 })

    const rookieChar = createCharacterForPlayer(rookie, createRng(1), 'tank')
    const veteranChar = createCharacterForPlayer(veteran, createRng(1), 'tank')

    expect(veteranChar.maxHp).toBeGreaterThan(rookieChar.maxHp) // bigger base, as before
    // The fix: growthPerLevel itself should also be bigger, not identical.
    expect(veteranChar.growthPerLevel.maxHp).toBeGreaterThan(rookieChar.growthPerLevel.maxHp)
  })
})

describe('computeGrowthPerLevel', () => {
  it('reproduces the old flat per-level growth at tier 1 for every role, except tank defense which is deliberately a quarter of it', () => {
    const oldFlatGrowth: Record<string, { maxHp: number; attackPower: number; defense: number; healPower: number }> = {
      tank: { maxHp: 6, attackPower: 1, defense: 0.25, healPower: 0 },
      dps: { maxHp: 3, attackPower: 2, defense: 0, healPower: 0 },
      healer: { maxHp: 4, attackPower: 1, defense: 0, healPower: 1 },
    }
    for (const role of ['tank', 'dps', 'healer'] as const) {
      const tierDef = getClassTier(role, 1)
      const growth = computeGrowthPerLevel(role, {
        maxHp: tierDef.baseMaxHp,
        attackPower: tierDef.baseAttackPower,
        defense: tierDef.baseDefense,
        healPower: tierDef.baseHealPower,
      })
      expect(growth).toEqual(oldFlatGrowth[role])
    }
  })

  it('scales up proportionally for a higher tier instead of staying flat', () => {
    const tier1 = getClassTier('dps', 1)
    const tier10 = getClassTier('dps', 10)
    const growth1 = computeGrowthPerLevel('dps', {
      maxHp: tier1.baseMaxHp,
      attackPower: tier1.baseAttackPower,
      defense: tier1.baseDefense,
      healPower: tier1.baseHealPower,
    })
    const growth10 = computeGrowthPerLevel('dps', {
      maxHp: tier10.baseMaxHp,
      attackPower: tier10.baseAttackPower,
      defense: tier10.baseDefense,
      healPower: tier10.baseHealPower,
    })
    expect(growth10.maxHp).toBeGreaterThan(growth1.maxHp)
    expect(growth10.attackPower).toBeGreaterThan(growth1.attackPower)
  })
})

function makeCharacter(overrides: Partial<Character>): Character {
  return {
    id: 'char',
    name: 'Char',
    race: 'Human',
    className: 'Test',
    role: 'tank',
    level: 1,
    xp: 0,
    maxHp: 20,
    attackPower: 5,
    defense: 2,
    healPower: 0,
    moveRange: 3,
    attackRange: 1,
    speed: 8,
    growthPerLevel: { maxHp: 1, attackPower: 1, defense: 1, healPower: 0 },
    selfRegenPercent: 0,
    ...overrides,
  }
}

describe('toCombatUnit', () => {
  it('applies no Sailing bonuses by default', () => {
    const tank = toCombatUnit(makeCharacter({ role: 'tank', attackRange: 1 }), null)
    expect(tank.tauntRange).toBe(TAUNT_RANGE)
    expect(tank.reviveAvailable).toBeUndefined()
    expect(tank.attackRange).toBe(1)
  })

  it('gives only tanks a taunt range, widened by the Commanding Presence bonus', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, tankTauntRangeBonus: 4 }
    expect(toCombatUnit(makeCharacter({ role: 'tank' }), null, bonuses).tauntRange).toBe(TAUNT_RANGE + 4)
    expect(toCombatUnit(makeCharacter({ role: 'dps' }), null, bonuses).tauntRange).toBeUndefined()
    expect(toCombatUnit(makeCharacter({ role: 'healer' }), null, bonuses).tauntRange).toBeUndefined()
  })

  it('only gives Revivify to healers, carrying the configured hpFraction, only when discovered', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, healerRevive: true, healerReviveHpFraction: 0.5 }
    const healerUnit = toCombatUnit(makeCharacter({ role: 'healer' }), null, bonuses)
    expect(healerUnit.reviveAvailable).toBe(true)
    expect(healerUnit.reviveHpFraction).toBe(0.5)
    expect(toCombatUnit(makeCharacter({ role: 'tank' }), null, bonuses).reviveAvailable).toBeUndefined()
  })

  it('only adds Extra Range to dps attackRange, only when discovered', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, dpsExtraRangeBonus: 1 }
    expect(toCombatUnit(makeCharacter({ role: 'dps', attackRange: 3 }), null, bonuses).attackRange).toBe(4)
    expect(toCombatUnit(makeCharacter({ role: 'tank', attackRange: 1 }), null, bonuses).attackRange).toBe(1)
  })

  it('only gives Stoneskin-style damage reduction to tanks', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, tankDamageReductionPercent: 0.4 }
    expect(toCombatUnit(makeCharacter({ role: 'tank' }), null, bonuses).damageReductionPercent).toBe(0.4)
    expect(toCombatUnit(makeCharacter({ role: 'dps' }), null, bonuses).damageReductionPercent).toBeUndefined()
  })

  it('only gives Armor Piercer-style defense pierce to dps', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, dpsDefensePiercePercent: 0.8 }
    expect(toCombatUnit(makeCharacter({ role: 'dps' }), null, bonuses).defensePiercePercent).toBe(0.8)
    expect(toCombatUnit(makeCharacter({ role: 'tank' }), null, bonuses).defensePiercePercent).toBeUndefined()
  })

  it('carries selfRegenPercent through regardless of role, since it is cross-training, not an artifact', () => {
    expect(toCombatUnit(makeCharacter({ role: 'tank', selfRegenPercent: 0.06 }), null).selfRegenPercent).toBe(0.06)
    expect(toCombatUnit(makeCharacter({ role: 'dps', selfRegenPercent: 0.06 }), null).selfRegenPercent).toBe(0.06)
    expect(toCombatUnit(makeCharacter({ role: 'healer', selfRegenPercent: 0.06 }), null).selfRegenPercent).toBe(0.06)
    expect(toCombatUnit(makeCharacter({ role: 'tank', selfRegenPercent: 0 }), null).selfRegenPercent).toBeUndefined()
  })

  it('only boosts healPower for healers, and only healers, by the configured percentage', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, healerHealPowerBonusPercent: 0.5 }
    expect(toCombatUnit(makeCharacter({ role: 'healer', healPower: 10 }), null, bonuses).healPower).toBe(15)
    expect(toCombatUnit(makeCharacter({ role: 'tank', healPower: 10 }), null, bonuses).healPower).toBe(10)
  })

  it('only gives Cleave to tanks, drawn from the tank-specific bonus fields', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, tankBonusTargetsOnHit: 2, tankBonusTargetDamagePercent: 0.75, dpsBonusTargetsOnHit: 5 }
    const tank = toCombatUnit(makeCharacter({ role: 'tank' }), null, bonuses)
    expect(tank.bonusTargetsOnHit).toBe(2)
    expect(tank.bonusTargetDamagePercent).toBe(0.75)
    const dps = toCombatUnit(makeCharacter({ role: 'dps' }), null, bonuses)
    expect(dps.bonusTargetsOnHit).toBe(5) // dps draws from its own field, not the tank's
    const healer = toCombatUnit(makeCharacter({ role: 'healer' }), null, bonuses)
    expect(healer.bonusTargetsOnHit).toBeUndefined()
  })

  it('only gives Ricochet to dps, drawn from the dps-specific bonus fields', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, dpsBonusTargetsOnHit: 1, dpsBonusTargetDamagePercent: 0.5 }
    const dps = toCombatUnit(makeCharacter({ role: 'dps' }), null, bonuses)
    expect(dps.bonusTargetsOnHit).toBe(1)
    expect(dps.bonusTargetDamagePercent).toBe(0.5)
    // A tank draws from its OWN (unset, defaulting to 0) field — never undefined for its own role, same as damageReductionPercent/defensePiercePercent.
    expect(toCombatUnit(makeCharacter({ role: 'tank' }), null, bonuses).bonusTargetsOnHit).toBe(0)
  })

  it('only gives Chain Mending to healers', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, healerBonusTargetsOnHeal: 1, healerBonusHealPercent: 0.5 }
    const healer = toCombatUnit(makeCharacter({ role: 'healer' }), null, bonuses)
    expect(healer.bonusTargetsOnHeal).toBe(1)
    expect(healer.bonusHealPercent).toBe(0.5)
    expect(toCombatUnit(makeCharacter({ role: 'tank' }), null, bonuses).bonusTargetsOnHeal).toBeUndefined()
  })

  it('only gives Grim Endurance-style damageReductionRampPercent to tanks', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, tankDamageReductionRampPercent: 0.05 }
    expect(toCombatUnit(makeCharacter({ role: 'tank' }), null, bonuses).damageReductionRampPercent).toBe(0.05)
    expect(toCombatUnit(makeCharacter({ role: 'dps' }), null, bonuses).damageReductionRampPercent).toBeUndefined()
  })

  it('only gives Rising Fury-style attackPowerRampPercent to dps', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, dpsAttackPowerRampPercent: 0.08 }
    expect(toCombatUnit(makeCharacter({ role: 'dps' }), null, bonuses).attackPowerRampPercent).toBe(0.08)
    expect(toCombatUnit(makeCharacter({ role: 'tank' }), null, bonuses).attackPowerRampPercent).toBeUndefined()
  })

  it('only gives Enduring Grace-style healPowerRampPercent to healers', () => {
    const bonuses = { ...DEFAULT_ARTIFACT_BONUSES, healerHealPowerRampPercent: 0.08 }
    expect(toCombatUnit(makeCharacter({ role: 'healer' }), null, bonuses).healPowerRampPercent).toBe(0.08)
    expect(toCombatUnit(makeCharacter({ role: 'dps' }), null, bonuses).healPowerRampPercent).toBeUndefined()
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

  it('matches createCharacterForPlayer + repeated leveling for an arbitrary level, for every role, once cross-training is factored in', () => {
    for (const role of ['tank', 'dps', 'healer'] as const) {
      const tierDef = getClassTier(role, 4)
      const player = makePlayer({ roleTiers: { tank: 4, dps: 4, healer: 4 } })
      const tankHpBonus = 1 + CROSS_TRAIN_HP_BONUS_PER_TIER * (player.roleTiers.tank - 1)
      const dpsAttackBonus = 1 + CROSS_TRAIN_ATTACK_BONUS_PER_TIER * (player.roleTiers.dps - 1)
      // projectStatsAtLevel deliberately excludes cross-training (same as
      // Veteran Tier) since it's a generic tier-only view — feed it a
      // tierDef pre-boosted the exact same way createCharacterForPlayer
      // boosts its own base stats, so the two are directly comparable.
      const boostedTierDef = {
        ...tierDef,
        baseMaxHp: Math.round(tierDef.baseMaxHp * tankHpBonus),
        baseAttackPower: Math.round(tierDef.baseAttackPower * dpsAttackBonus),
      }
      const projected = projectStatsAtLevel(role, boostedTierDef, 12)
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

describe('tank defense growth', () => {
  it('keeps fractional growth at low tiers instead of rounding to zero, so every tier still gains defense with level', () => {
    for (let tier = 1; tier <= 10; tier++) {
      const tierDef = getClassTier('tank', tier)
      const growth = computeGrowthPerLevel('tank', {
        maxHp: tierDef.baseMaxHp,
        attackPower: tierDef.baseAttackPower,
        defense: tierDef.baseDefense,
        healPower: tierDef.baseHealPower,
      })
      expect(growth.defense).toBeGreaterThan(0)
      expect(growth.defense).toBeCloseTo(tierDef.baseDefense / 12, 1)
    }
  })
})
