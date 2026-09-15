import type { CombatLogEvent, EncounterTemplate, Role } from './combat/types'

export interface Character {
  id: string
  name: string
  race: string
  className: string
  role: Role
  level: number
  xp: number
  maxHp: number
  attackPower: number
  defense: number
  healPower: number
  moveRange: number
  attackRange: number
  speed: number
}

export interface Player {
  id: string
  name: string
  recruitedAt: number
  character: Character
}

export type ModuleKind = 'campaign' | 'execution'

export interface AdventureModule {
  id: string
  name: string
  description: string
  kind: ModuleKind
  tier: number
  unlockCost: number
  encounters: EncounterTemplate[]
}

export interface Table {
  id: string
  name: string
  capacity: number
  players: Player[]
  assignedModuleId: string | null
  encounterIndex: number
  cooldownRemaining: number
  lifetimeGold: number
  lastBattleLog: CombatLogEvent[] | null
  lastBattleModuleName: string | null
}

export type UpgradeCurrency = 'gold' | 'infamy'

export type UpgradeEffect =
  | { kind: 'goldMultiplier'; value: number }
  | { kind: 'xpMultiplier'; value: number }
  | { kind: 'cooldownMultiplier'; value: number }
  | { kind: 'infamyMultiplier'; value: number }
  | { kind: 'tableCapacityBonus'; value: number }
  | { kind: 'tableSlotBonus'; value: number }

export interface Upgrade {
  id: string
  name: string
  description: string
  currency: UpgradeCurrency
  cost: number
  effect: UpgradeEffect
}

export interface DMState {
  name: string
  level: number
  gold: number
  infamy: number
  unlockedModuleIds: string[]
  purchasedUpgradeIds: string[]
  tableSlots: number
}

export interface GameState {
  dm: DMState
  tables: Table[]
  lastTickAt: number
}
