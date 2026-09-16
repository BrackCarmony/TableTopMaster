import type { RngFn } from './rng'
import type { CombatUnit, Role } from './combat/types'
import { getClassTier, rollClassName, rollRole } from './data/classes'
import { legacyStatMultiplier } from './data/legacy'
import { rollName, rollPlayerName, rollRace } from './data/names'
import { rollPersonality, type DominantTrait } from './personality'
import type { Character, Player } from './types'

let nextCharacterId = 1
function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextCharacterId++).toString(36)}`
}

/** `existingNames` are the current roster's names, so a new player doesn't collide with an active one. */
export function createPlayer(rng: RngFn, existingNames: string[] = []): Player {
  return {
    id: generateId('player'),
    name: rollPlayerName(rng, existingNames),
    recruitedAt: Date.now(),
    roleTiers: { tank: 1, dps: 1, healer: 1 },
    personality: rollPersonality(rng),
    tableId: null,
    character: null,
    legacyTier: 0,
  }
}

export function createCharacterForPlayer(player: Player, rng: RngFn, forcedRole?: Role): Character {
  const role: Role = forcedRole ?? rollRole(rng, player.roleTiers)
  const tierDef = getClassTier(role, player.roleTiers[role])
  // Applies regardless of role — a player's accumulated legacy tier makes
  // every future life stronger, not just the role they happened to roll.
  const legacyMultiplier = legacyStatMultiplier(player.legacyTier)
  return {
    id: generateId('char'),
    // Fantasy name, distinct from the player's own — recycling names across
    // characters/lives is fine (that's how real tables work too).
    name: rollName(rng),
    race: rollRace(rng),
    className: rollClassName(tierDef.names, rng),
    role,
    level: 1,
    xp: 0,
    maxHp: Math.round(tierDef.baseMaxHp * legacyMultiplier),
    attackPower: Math.round(tierDef.baseAttackPower * legacyMultiplier),
    defense: Math.round(tierDef.baseDefense * legacyMultiplier),
    healPower: Math.round(tierDef.baseHealPower * legacyMultiplier),
    moveRange: tierDef.moveRange,
    attackRange: tierDef.attackRange,
    speed: tierDef.speed,
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

export function toCombatUnit(character: Character, flavor: DominantTrait | null): CombatUnit {
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
    flavor,
  }
}

export function generateTableId(): string {
  return generateId('table')
}
