import type { CombatLogEvent, EncounterTemplate, Role } from './combat/types'
import type { PersonalityTraits } from './personality'

export type { Role } from './combat/types'

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
  /** 1-based unlocked tier per role, independent of which role their current character happens to be. */
  roleTiers: Record<Role, number>
  personality: PersonalityTraits
  /** Table this player is currently seated at, or null if benched. */
  tableId: string | null
  /** Null while benched (between lives). */
  character: Character | null
  /** Infamy-funded permanent stat tier — survives every death and reroll, unlike roleTiers' gold-funded per-role unlocks. Never caps. */
  legacyTier: number
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
  /** For execution modules: the pool of trophy "parts" a win can drop. Falls back to a generic pool if omitted. */
  trophyParts?: string[]
}

export interface BattleRewards {
  outcome: 'victory' | 'defeat' | 'stalemate'
  xp: number
  gold: number
  infamy: number
}

export interface Table {
  id: string
  name: string
  assignedModuleId: string | null
  encounterIndex: number
  cooldownRemaining: number
  lifetimeGold: number
  lastBattleLog: CombatLogEvent[] | null
  lastBattleModuleName: string | null
  lastBattleRewards: BattleRewards | null
}

export type UpgradeCurrency = 'gold' | 'infamy'

export type UpgradeEffect =
  | { kind: 'goldMultiplier'; value: number }
  | { kind: 'xpMultiplier'; value: number }
  | { kind: 'cooldownMultiplier'; value: number }
  | { kind: 'infamyMultiplier'; value: number }
  | { kind: 'tableCapacityBonus'; value: number }
  | { kind: 'tableSlotBonus'; value: number }
  | { kind: 'unlockRoleSelection' }

export interface Upgrade {
  id: string
  name: string
  description: string
  currency: UpgradeCurrency
  cost: number
  effect: UpgradeEffect
}

export interface Trophy {
  id: string
  moduleId: string
  /** Which body part dropped, e.g. "Fang" — drawn from the module's trophyParts pool. */
  part: string
  /** Quality name derived from tierDefeated, e.g. "Superior" — see data/trophies.ts. */
  quality: string
  /** The tier that was actually overcome to earn this (0 = the module's base difficulty). */
  tierDefeated: number
  earnedAt: number
}

export interface DMState {
  name: string
  level: number
  gold: number
  infamy: number
  unlockedModuleIds: string[]
  purchasedUpgradeIds: string[]
  tableSlots: number
  /** How many times each execution module has been DEFEATED, keyed by module id — each win escalates that module further. Never rises from losing or from leaving it alone. */
  executionTier: Record<string, number>
  trophies: Trophy[]
}

export interface GameState {
  dm: DMState
  players: Player[]
  tables: Table[]
  lastTickAt: number
}
