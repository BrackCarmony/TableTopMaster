import type { DominantTrait } from '../personality'

export type Role = 'tank' | 'dps' | 'healer'

export interface GridCoord {
  x: number
  y: number
}

export interface CombatUnit {
  id: string
  name: string
  side: 'party' | 'enemy'
  role: Role
  level: number
  position: GridCoord
  hp: number
  maxHp: number
  attackPower: number
  defense: number
  healPower: number
  moveRange: number
  attackRange: number
  speed: number
  alive: boolean
  /** The seated player's dominant personality trait, for flavor-texting their log lines. Null for enemies. */
  flavor: DominantTrait | null
  /** If set, this unit's attackPower grows by this much at the end of every round — a boss "enrage" so a long fight can't out-sustain it forever. */
  attackPowerRampPerRound?: number
  /** Defensive Rush artifact — this unit acts once in a pre-round pass before round 0 begins. Never reset; only ever consulted once per encounter. */
  extraTurnAtStart?: boolean
  /** Revivify artifact — true until this healer has used their once-per-battle revive, then set false. */
  reviveAvailable?: boolean
  /** Fraction of maxHp a Revivify revive restores. Only meaningful alongside reviveAvailable. */
  reviveHpFraction?: number
  /** Fraction of incoming damage this unit shrugs off (e.g. Stoneskin), applied after defense and before the always-at-least-1 floor. */
  damageReductionPercent?: number
  /** Fraction of a target's defense this unit's attacks ignore (e.g. Armor Piercer). */
  defensePiercePercent?: number
  /** Cleave/Ricochet artifacts — on a landed hit, also hit this many additional enemies within attackRange. */
  bonusTargetsOnHit?: number
  /** Fraction of normal damage each bonus-hit target takes. Only meaningful alongside bonusTargetsOnHit. */
  bonusTargetDamagePercent?: number
  /** Chain Mending artifacts — on a heal, also heal this many additional wounded allies within attackRange. */
  bonusTargetsOnHeal?: number
  /** Fraction of the primary heal amount each bonus-heal target receives. Only meaningful alongside bonusTargetsOnHeal. */
  bonusHealPercent?: number
  /** Grim Endurance-style artifacts — damageReductionPercent grows by this much at the end of every round, same timing as attackPowerRampPerRound. Runs against a boss's own enrage instead of just eating it. */
  damageReductionRampPercent?: number
  /** Rising Fury-style artifacts — attackPower is multiplied by (1 + this) at the end of every round, compounding. */
  attackPowerRampPercent?: number
  /** Enduring Grace-style artifacts — healPower is multiplied by (1 + this) at the end of every round, compounding. */
  healPowerRampPercent?: number
  /** Cross-training from the owning player's Healer tier (see Character.selfRegenPercent) — this fraction of maxHp is restored at the end of every round, regardless of this unit's own role. Never set on enemies. */
  selfRegenPercent?: number
}

export type CombatLogEvent =
  | { type: 'encounter_start'; units: CombatUnit[]; gridWidth: number; gridHeight: number }
  | { type: 'move'; unitId: string; path: GridCoord[] }
  | { type: 'attack'; attackerId: string; targetId: string; hit: boolean; damage: number; targetHpAfter: number }
  | { type: 'heal'; healerId: string; targetId: string; amount: number; targetHpAfter: number }
  | { type: 'revive'; healerId: string; targetId: string; targetHpAfter: number }
  | { type: 'death'; unitId: string }
  /** One combined line per side per round, not one per ramped unit — watching a battle with several sustain artifacts active would otherwise spam a line per unit every single round. */
  | { type: 'enrage'; side: 'party' | 'enemy' }
  /** Same one-line-per-side-per-round shape as 'enrage', for Healer-tier self-regen ticks. Only fires when at least one unit on that side actually recovered HP (i.e. wasn't already full). */
  | { type: 'regen'; side: 'party' | 'enemy' }
  /** An encounter's stalemateFinisher firing — see EncounterTemplate.stalemateFinisher. */
  | { type: 'finisher'; description: string }
  | { type: 'encounter_end'; outcome: 'victory' | 'defeat' | 'stalemate'; survivorIds: string[] }

export interface EnemySpawn {
  name: string
  role: Role
  position: GridCoord
  hp: number
  attackPower: number
  defense: number
  healPower: number
  moveRange: number
  attackRange: number
  speed: number
  attackPowerRampPerRound?: number
}

export interface EncounterTemplate {
  id: string
  name: string
  gridWidth: number
  gridHeight: number
  partyStartPositions: GridCoord[]
  enemies: EnemySpawn[]
  /**
   * If the fight would otherwise end in a stalemate (MAX_ROUNDS reached with
   * both sides still standing), the party is wiped instead — outcome becomes
   * 'defeat', not 'stalemate' — narrated with this flavor line. For an
   * execution encounter designed to be a pure DPS-race sustain check (e.g.
   * the Kraken out-healing a party that can't out-damage it), a stalemate
   * would otherwise leave the table stuck refighting the same fully-healed
   * boss forever instead of ever actually resolving into the "guaranteed
   * TPK" every execution module already advertises. Leave unset for
   * encounters where a stalemate is a legitimate, harmless outcome.
   */
  stalemateFinisher?: string
  /**
   * Multiplies every enemy's hp/attack/defense/heal (and enrage ramp) for the
   * fight itself, but NOT the gold/XP reward — that's still computed from the
   * template's own unscaled enemy stats. This is what lets a module be made
   * harder without paying out more for it. Unset means 1x.
   */
  difficultyMultiplier?: number
}

export interface EncounterResult {
  log: CombatLogEvent[]
  outcome: 'victory' | 'defeat' | 'stalemate'
  survivorIds: string[]
  goldReward: number
  xpReward: number
  /** How many rounds the fight actually took (1-based) — a stalemate always maxes this out at MAX_ROUNDS. */
  roundsElapsed: number
}
