import type { Role } from '../combat/types'
import type { RngFn } from '../rng'

export interface ClassTierDef {
  tier: number
  /** Flavor-name options at this tier; picked randomly for cosmetic variety. */
  names: string[]
  baseMaxHp: number
  baseAttackPower: number
  baseDefense: number
  baseHealPower: number
  moveRange: number
  attackRange: number
  speed: number
  /** Gold cost to unlock this tier for a player. Tier 1 is always free/unlocked. */
  unlockCost: number
}

export const CLASS_TIERS: Record<Role, ClassTierDef[]> = {
  tank: [
    { tier: 1, names: ['Squire'], baseMaxHp: 26, baseAttackPower: 4, baseDefense: 3, baseHealPower: 0, moveRange: 3, attackRange: 1, speed: 8, unlockCost: 0 },
    { tier: 2, names: ['Fighter', 'Knight'], baseMaxHp: 34, baseAttackPower: 6, baseDefense: 5, baseHealPower: 0, moveRange: 3, attackRange: 1, speed: 8, unlockCost: 600 },
    { tier: 3, names: ['Paladin', 'Crusader'], baseMaxHp: 44, baseAttackPower: 8, baseDefense: 7, baseHealPower: 0, moveRange: 3, attackRange: 1, speed: 7, unlockCost: 3000 },
    { tier: 4, names: ['Templar', 'Warlord'], baseMaxHp: 56, baseAttackPower: 10, baseDefense: 9, baseHealPower: 0, moveRange: 3, attackRange: 1, speed: 7, unlockCost: 15000 },
    { tier: 5, names: ['Titan', 'Immortal Guardian'], baseMaxHp: 70, baseAttackPower: 13, baseDefense: 12, baseHealPower: 0, moveRange: 3, attackRange: 1, speed: 6, unlockCost: 75000 },
  ],
  dps: [
    { tier: 1, names: ['Brigand'], baseMaxHp: 16, baseAttackPower: 6, baseDefense: 1, baseHealPower: 0, moveRange: 4, attackRange: 1, speed: 11, unlockCost: 0 },
    { tier: 2, names: ['Rogue', 'Ranger'], baseMaxHp: 19, baseAttackPower: 9, baseDefense: 2, baseHealPower: 0, moveRange: 4, attackRange: 3, speed: 12, unlockCost: 600 },
    { tier: 3, names: ['Assassin', 'Sharpshooter', 'Battlemage'], baseMaxHp: 24, baseAttackPower: 13, baseDefense: 3, baseHealPower: 0, moveRange: 4, attackRange: 3, speed: 13, unlockCost: 3000 },
    { tier: 4, names: ['Blademaster', 'Deadeye'], baseMaxHp: 29, baseAttackPower: 18, baseDefense: 4, baseHealPower: 0, moveRange: 4, attackRange: 3, speed: 14, unlockCost: 15000 },
    { tier: 5, names: ['Shadow Reaper', 'Archfiend Hunter'], baseMaxHp: 35, baseAttackPower: 24, baseDefense: 5, baseHealPower: 0, moveRange: 4, attackRange: 4, speed: 15, unlockCost: 75000 },
  ],
  healer: [
    { tier: 1, names: ['Acolyte'], baseMaxHp: 18, baseAttackPower: 3, baseDefense: 1, baseHealPower: 5, moveRange: 3, attackRange: 2, speed: 8, unlockCost: 0 },
    { tier: 2, names: ['Cleric', 'Druid'], baseMaxHp: 23, baseAttackPower: 4, baseDefense: 2, baseHealPower: 8, moveRange: 3, attackRange: 2, speed: 8, unlockCost: 600 },
    { tier: 3, names: ['High Priest', 'Archdruid'], baseMaxHp: 29, baseAttackPower: 5, baseDefense: 3, baseHealPower: 12, moveRange: 3, attackRange: 2, speed: 9, unlockCost: 3000 },
    { tier: 4, names: ['Bishop', 'Grand Shaman'], baseMaxHp: 35, baseAttackPower: 6, baseDefense: 4, baseHealPower: 17, moveRange: 3, attackRange: 2, speed: 9, unlockCost: 15000 },
    { tier: 5, names: ['Living Saint', "Nature's Avatar"], baseMaxHp: 42, baseAttackPower: 8, baseDefense: 5, baseHealPower: 23, moveRange: 3, attackRange: 2, speed: 10, unlockCost: 75000 },
  ],
}

const ROLES: Role[] = ['tank', 'dps', 'healer']

/**
 * Rolls a role weighted by how far the player has invested in each — a
 * player with Tank tier 3 and the other two still at tier 1 is 3x as likely
 * to roll Tank as either other role, rather than a flat 1/3 each.
 */
export function rollRole(rng: RngFn, roleTiers: Record<Role, number>): Role {
  const totalWeight = ROLES.reduce((sum, r) => sum + roleTiers[r], 0)
  let roll = rng() * totalWeight
  for (const r of ROLES) {
    roll -= roleTiers[r]
    if (roll < 0) return r
  }
  return ROLES[ROLES.length - 1]
}

export function getClassTier(role: Role, tier: number): ClassTierDef {
  const tiers = CLASS_TIERS[role]
  return tiers[Math.min(Math.max(tier, 1), tiers.length) - 1]
}

export function maxTier(role: Role): number {
  return CLASS_TIERS[role].length
}

export function rollClassName(names: string[], rng: RngFn): string {
  return names[Math.floor(rng() * names.length)]
}
