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
  /** Fixed per-level stat increments, baked in at creation from this character's tier+Veteran-Tier-adjusted base stats — see characters.ts computeGrowthPerLevel. */
  growthPerLevel: { maxHp: number; attackPower: number; defense: number; healPower: number }
  /** Cross-training from the owning player's Healer tier — this fraction of maxHp is restored at the end of every combat round, regardless of this character's actual rolled role. Baked in at creation, same as every other tier-derived stat. */
  selfRegenPercent: number
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

/** One seat of a table's roster right before its most recent full wipe — see Table.lastWipeRoster. */
export interface WipeRosterEntry {
  playerId: string
  role: Role
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
  /** Who was seated here, in what roles, right before the most recent full wipe — null until the table has ever wiped. Powers Quick Refill; overwritten by each new wipe, never cleared by a refill itself. */
  lastWipeRoster: WipeRosterEntry[] | null
  /** Ms until Auto-Advance's next periodic check (see engine.ts AUTO_ADVANCE_CHECK_INTERVAL_MS) — irrelevant unless that perk is unlocked. */
  autoAdvanceCheckRemaining: number
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
  | { kind: 'unlockQuickRefill' }
  | { kind: 'unlockAutoAdvance' }
  | { kind: 'unlockSailing' }
  | { kind: 'shipSlotBonus'; value: number }
  | { kind: 'sailSpeedMultiplier'; value: number }
  | { kind: 'artifactFindChanceBonus'; value: number }

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

export interface Ship {
  id: string
  name: string
  /** Destination island, or null when idle at dock. */
  assignedIslandId: string | null
  /** Ms remaining until the current voyage resolves; 0 while idle. */
  voyageRemaining: number
  lifetimeGold: number
}

export interface Island {
  id: string
  name: string
  description: string
  /** Gold cost to unlock this island. 0 means already unlocked (see store.ts createInitialDm). */
  unlockCost: number
  baseGoldReward: number
  baseVoyageDurationMs: number
  /** Artifact ids this island can roll on a successful find. */
  artifactPool: string[]
}

export type ArtifactEffect =
  | { kind: 'tankExtraTurnAtStart' }
  | { kind: 'healerReviveOnce'; hpFraction: number }
  | { kind: 'dpsExtraRange'; value: number }
  | { kind: 'tankDamageReduction'; value: number }
  | { kind: 'dpsDefensePierce'; value: number }
  | { kind: 'healerHealPowerBonus'; value: number }
  | { kind: 'tankCleave'; targets: number; damagePercent: number }
  | { kind: 'dpsRicochet'; targets: number; damagePercent: number }
  | { kind: 'healerChainHeal'; targets: number; healPercent: number }
  | { kind: 'tankDamageReductionRamp'; percentPerRound: number }
  | { kind: 'dpsAttackPowerRamp'; percentPerRound: number }
  | { kind: 'healerHealPowerRamp'; percentPerRound: number }

export interface Artifact {
  id: string
  name: string
  description: string
  role: Role
  effect: ArtifactEffect
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
  /** Sailing artifact ids found so far — permanent, role-wide passives once discovered. */
  discoveredArtifactIds: string[]
  /** Island ids unlocked so far — an island with unlockCost 0 doesn't need to appear here to count as available. */
  unlockedIslandIds: string[]
}

export interface GameState {
  dm: DMState
  players: Player[]
  tables: Table[]
  ships: Ship[]
  lastTickAt: number
}
