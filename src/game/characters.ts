import type { RngFn } from './rng'
import type { CombatUnit, Role } from './combat/types'
import { getClassTier, rollClassName, rollRole, type ClassTierDef } from './data/classes'
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

export interface StatBlock {
  maxHp: number
  attackPower: number
  defense: number
  healPower: number
}

/**
 * Per-level growth is a fixed PERCENTAGE of a character's own base stats,
 * baked in once at creation — not a flat, tier-independent amount. A flat
 * rate meant a tier or Veteran Tier investment only bought a head start
 * that any real amount of leveling eventually swamped (a level-100 tier-1
 * Acolyte and a level-100 tier-10 Hand of the Divine end up nearly
 * identical). Scaling growth off the base instead means a higher base
 * (from tier OR Veteran Tier) also grows faster in absolute terms, so the
 * advantage holds proportionally at level 1 and at level 1000.
 *
 * Rates are chosen to exactly reproduce each role's old flat tier-1 growth
 * (e.g. tank's 6/26 reproduces the old flat +6/level on a tier-1 base of
 * 26), so a tier-1 character's leveling feels identical to before — every
 * tier above that now grows proportionally faster instead of flatlining.
 */
const ROLE_GROWTH_RATE: Record<Role, StatBlock> = {
  tank: { maxHp: 6 / 26, attackPower: 1 / 4, defense: 1 / 3, healPower: 0 },
  dps: { maxHp: 3 / 16, attackPower: 2 / 6, defense: 0, healPower: 0 },
  healer: { maxHp: 4 / 18, attackPower: 1 / 3, defense: 0, healPower: 1 / 5 },
}

export function growthRateFor(role: Role): StatBlock {
  return ROLE_GROWTH_RATE[role]
}

/** The fixed per-level stat increments for a character with these base stats — computed once at creation and never recomputed, so leveling stays simple addition. */
export function computeGrowthPerLevel(role: Role, base: StatBlock): StatBlock {
  const rate = ROLE_GROWTH_RATE[role]
  return {
    maxHp: Math.round(base.maxHp * rate.maxHp),
    attackPower: Math.round(base.attackPower * rate.attackPower),
    defense: Math.round(base.defense * rate.defense),
    healPower: Math.round(base.healPower * rate.healPower),
  }
}

/** Old flat, tier-independent per-level growth — kept only so existing saved characters (predating proportional growth) keep leveling the way they always have until they die and reroll. */
export const LEGACY_FLAT_GROWTH: Record<Role, StatBlock> = {
  tank: { maxHp: 6, attackPower: 1, defense: 1, healPower: 0 },
  dps: { maxHp: 3, attackPower: 2, defense: 0, healPower: 0 },
  healer: { maxHp: 4, attackPower: 1, defense: 0, healPower: 1 },
}

/**
 * `bonusLevels` (from the DM's trophy collection) skips the character
 * straight past its first few levels, so rebuilding a party after a wipe
 * doesn't mean re-grinding the earliest modules from scratch every time.
 */
export function createCharacterForPlayer(player: Player, rng: RngFn, forcedRole?: Role, bonusLevels = 0): Character {
  const role: Role = forcedRole ?? rollRole(rng, player.roleTiers)
  const tierDef = getClassTier(role, player.roleTiers[role])
  // Applies regardless of role — a player's accumulated legacy tier makes
  // every future life stronger, not just the role they happened to roll.
  const legacyMultiplier = legacyStatMultiplier(player.legacyTier)
  const base: StatBlock = {
    maxHp: Math.round(tierDef.baseMaxHp * legacyMultiplier),
    attackPower: Math.round(tierDef.baseAttackPower * legacyMultiplier),
    defense: Math.round(tierDef.baseDefense * legacyMultiplier),
    healPower: Math.round(tierDef.baseHealPower * legacyMultiplier),
  }
  const character: Character = {
    id: generateId('char'),
    // Fantasy name, distinct from the player's own — recycling names across
    // characters/lives is fine (that's how real tables work too).
    name: rollName(rng),
    race: rollRace(rng),
    className: rollClassName(tierDef.names, rng),
    role,
    level: 1,
    xp: 0,
    ...base,
    moveRange: tierDef.moveRange,
    attackRange: tierDef.attackRange,
    speed: tierDef.speed,
    growthPerLevel: computeGrowthPerLevel(role, base),
  }
  for (let i = 0; i < bonusLevels; i++) {
    character.level += 1
    applyLevelUpStats(character)
  }
  return character
}

export function xpToNextLevel(level: number): number {
  return 20 + (level - 1) * 15
}

function applyLevelUpStats(character: Character): void {
  character.maxHp += character.growthPerLevel.maxHp
  character.attackPower += character.growthPerLevel.attackPower
  character.defense += character.growthPerLevel.defense
  character.healPower += character.growthPerLevel.healPower
}

export interface LevelStatsProjection {
  maxHp: number
  attackPower: number
  defense: number
  healPower: number
}

/**
 * Projects a class tier's stats at a given level without needing a live
 * Character — reuses the exact same per-level growth as real play
 * (applyLevelUpStats), so the class reference screen can never drift from
 * what a character actually gets when it levels up for real. Doesn't factor
 * in any player's Veteran Tier, since this is a generic tier-only view.
 */
export function projectStatsAtLevel(role: Role, tierDef: ClassTierDef, level: number): LevelStatsProjection {
  const base: StatBlock = {
    maxHp: tierDef.baseMaxHp,
    attackPower: tierDef.baseAttackPower,
    defense: tierDef.baseDefense,
    healPower: tierDef.baseHealPower,
  }
  const character: Character = {
    id: '',
    name: '',
    race: '',
    className: '',
    role,
    level: 1,
    xp: 0,
    ...base,
    moveRange: tierDef.moveRange,
    attackRange: tierDef.attackRange,
    speed: tierDef.speed,
    growthPerLevel: computeGrowthPerLevel(role, base),
  }
  for (let i = 1; i < level; i++) applyLevelUpStats(character)
  return { maxHp: character.maxHp, attackPower: character.attackPower, defense: character.defense, healPower: character.healPower }
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

/** Sailing artifact bonuses, derived once per encounter from the DM's discoveredArtifactIds (see engine.ts computeArtifactBonuses) and baked onto each CombatUnit at build time — keeps combat/simulate.ts free of any dependency on DM/store types. */
export interface ArtifactBonuses {
  tankExtraTurn: boolean
  healerRevive: boolean
  healerReviveHpFraction: number
  dpsExtraRangeBonus: number
  /** Sum of every discovered tankDamageReduction artifact's value, clamped so damage can never go negative. */
  tankDamageReductionPercent: number
  /** Sum of every discovered dpsDefensePierce artifact's value, clamped below 100%. */
  dpsDefensePiercePercent: number
  /** Sum of every discovered healerHealPowerBonus artifact's value — a multiplicative bonus on the healer's own healPower. */
  healerHealPowerBonusPercent: number
}

export const DEFAULT_ARTIFACT_BONUSES: ArtifactBonuses = {
  tankExtraTurn: false,
  healerRevive: false,
  healerReviveHpFraction: 0.5,
  dpsExtraRangeBonus: 0,
  tankDamageReductionPercent: 0,
  dpsDefensePiercePercent: 0,
  healerHealPowerBonusPercent: 0,
}

export function toCombatUnit(
  character: Character,
  flavor: DominantTrait | null,
  artifactBonuses: ArtifactBonuses = DEFAULT_ARTIFACT_BONUSES,
): CombatUnit {
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
    healPower:
      character.role === 'healer'
        ? Math.round(character.healPower * (1 + artifactBonuses.healerHealPowerBonusPercent))
        : character.healPower,
    moveRange: character.moveRange,
    attackRange: character.attackRange + (character.role === 'dps' ? artifactBonuses.dpsExtraRangeBonus : 0),
    speed: character.speed,
    alive: true,
    flavor,
    extraTurnAtStart: character.role === 'tank' && artifactBonuses.tankExtraTurn ? true : undefined,
    reviveAvailable: character.role === 'healer' && artifactBonuses.healerRevive ? true : undefined,
    reviveHpFraction: character.role === 'healer' && artifactBonuses.healerRevive ? artifactBonuses.healerReviveHpFraction : undefined,
    damageReductionPercent: character.role === 'tank' ? artifactBonuses.tankDamageReductionPercent : undefined,
    defensePiercePercent: character.role === 'dps' ? artifactBonuses.dpsDefensePiercePercent : undefined,
  }
}

export function generateTableId(): string {
  return generateId('table')
}

export function generateShipId(): string {
  return generateId('ship')
}
