import type { RngFn } from './rng'
import type { CombatUnit } from './combat/types'
import { rollClass } from './data/classes'
import { rollName, rollRace } from './data/names'
import type { Character } from './types'

let nextCharacterId = 1
function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextCharacterId++).toString(36)}`
}

export function createCharacter(rng: RngFn): Character {
  const cls = rollClass(rng)
  return {
    id: generateId('char'),
    name: rollName(rng),
    race: rollRace(rng),
    className: cls.className,
    role: cls.role,
    level: 1,
    xp: 0,
    maxHp: cls.baseMaxHp,
    attackPower: cls.baseAttackPower,
    defense: cls.baseDefense,
    healPower: cls.baseHealPower,
    moveRange: cls.moveRange,
    attackRange: cls.attackRange,
    speed: cls.speed,
  }
}

export function xpToNextLevel(level: number): number {
  return 20 + (level - 1) * 15
}

function applyLevelUpStats(character: Character): void {
  switch (character.role) {
    case 'tank':
      character.maxHp += 6
      character.attackPower += 1
      character.defense += 1
      break
    case 'dps':
      character.maxHp += 3
      character.attackPower += 2
      break
    case 'healer':
      character.maxHp += 4
      character.attackPower += 1
      character.healPower += 1
      break
  }
}

/** Mutates a clone of the character, applying XP and any resulting level-ups. */
export function applyXp(character: Character, xp: number): Character {
  const next = { ...character }
  next.xp += xp
  while (next.xp >= xpToNextLevel(next.level)) {
    next.xp -= xpToNextLevel(next.level)
    next.level += 1
    applyLevelUpStats(next)
  }
  return next
}

export function toCombatUnit(character: Character): CombatUnit {
  return {
    id: character.id,
    name: character.name,
    side: 'party',
    role: character.role,
    level: character.level,
    position: { x: 0, y: 0 },
    hp: character.maxHp,
    maxHp: character.maxHp,
    attackPower: character.attackPower,
    defense: character.defense,
    healPower: character.healPower,
    moveRange: character.moveRange,
    attackRange: character.attackRange,
    speed: character.speed,
    alive: true,
  }
}

export function generateTableId(): string {
  return generateId('table')
}

export function generatePlayerId(): string {
  return generateId('player')
}
