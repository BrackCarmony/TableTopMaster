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
}

export type CombatLogEvent =
  | { type: 'encounter_start'; units: CombatUnit[]; gridWidth: number; gridHeight: number }
  | { type: 'move'; unitId: string; path: GridCoord[] }
  | { type: 'attack'; attackerId: string; targetId: string; hit: boolean; damage: number; targetHpAfter: number }
  | { type: 'heal'; healerId: string; targetId: string; amount: number; targetHpAfter: number }
  | { type: 'death'; unitId: string }
  | { type: 'enrage'; unitId: string; attackPower: number }
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
