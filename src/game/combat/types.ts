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
}

export type CombatLogEvent =
  | { type: 'encounter_start'; units: CombatUnit[]; gridWidth: number; gridHeight: number }
  | { type: 'move'; unitId: string; path: GridCoord[] }
  | { type: 'attack'; attackerId: string; targetId: string; hit: boolean; damage: number; targetHpAfter: number }
  | { type: 'heal'; healerId: string; targetId: string; amount: number; targetHpAfter: number }
  | { type: 'death'; unitId: string }
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
}
