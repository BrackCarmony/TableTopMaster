import type { Role } from '../combat/types'

export interface ClassArchetype {
  className: string
  role: Role
  baseMaxHp: number
  baseAttackPower: number
  baseDefense: number
  baseHealPower: number
  moveRange: number
  attackRange: number
  speed: number
}

export const CLASS_ARCHETYPES: ClassArchetype[] = [
  {
    className: 'Fighter',
    role: 'tank',
    baseMaxHp: 32,
    baseAttackPower: 5,
    baseDefense: 5,
    baseHealPower: 0,
    moveRange: 3,
    attackRange: 1,
    speed: 8,
  },
  {
    className: 'Paladin',
    role: 'tank',
    baseMaxHp: 30,
    baseAttackPower: 6,
    baseDefense: 4,
    baseHealPower: 0,
    moveRange: 3,
    attackRange: 1,
    speed: 7,
  },
  {
    className: 'Rogue',
    role: 'dps',
    baseMaxHp: 18,
    baseAttackPower: 9,
    baseDefense: 1,
    baseHealPower: 0,
    moveRange: 4,
    attackRange: 1,
    speed: 12,
  },
  {
    className: 'Ranger',
    role: 'dps',
    baseMaxHp: 20,
    baseAttackPower: 8,
    baseDefense: 2,
    baseHealPower: 0,
    moveRange: 3,
    attackRange: 3,
    speed: 10,
  },
  {
    className: 'Wizard',
    role: 'dps',
    baseMaxHp: 14,
    baseAttackPower: 10,
    baseDefense: 0,
    baseHealPower: 0,
    moveRange: 3,
    attackRange: 3,
    speed: 9,
  },
  {
    className: 'Cleric',
    role: 'healer',
    baseMaxHp: 20,
    baseAttackPower: 3,
    baseDefense: 2,
    baseHealPower: 7,
    moveRange: 3,
    attackRange: 2,
    speed: 8,
  },
  {
    className: 'Druid',
    role: 'healer',
    baseMaxHp: 22,
    baseAttackPower: 4,
    baseDefense: 2,
    baseHealPower: 6,
    moveRange: 3,
    attackRange: 2,
    speed: 9,
  },
]

export function rollClass(rng: () => number): ClassArchetype {
  const index = Math.floor(rng() * CLASS_ARCHETYPES.length)
  return CLASS_ARCHETYPES[index]
}
