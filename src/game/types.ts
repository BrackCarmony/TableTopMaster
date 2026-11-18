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
  /** Characters who fell but were spared by Plot Armor. */
  spared?: number
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
  /** Flawless wins in a row (no deaths, no one saved by Plot Armor) in this module: Delegate the
   * Table only climbs on a proven streak. Tied to the module, so changing it starts over. */
  flawless?: { moduleId: string; count: number }
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
  // Party: every character at every table fights with these (multipliers stack by product).
  | { kind: 'partyAttackMultiplier'; value: number }
  | { kind: 'partyDefenseMultiplier'; value: number }
  | { kind: 'partyHpMultiplier'; value: number }
  | { kind: 'partyHealMultiplier'; value: number }
  /** Extra share of max HP every character regains each round (0.02 = 2%). */
  | { kind: 'partyRegenPercent'; value: number }
  /** Chance each character who falls in a fight is spared anyway (stays seated, keeps their levels). */
  | { kind: 'cheatDeathChance'; value: number }
  /** Enemies fight with this much of their HP (rewards still come from their full stats). */
  | { kind: 'enemyHpMultiplier'; value: number }
  /** Levels every newly rolled character starts with on top of level 1. */
  | { kind: 'startingLevelBonus'; value: number }
  | { kind: 'roleTierCostMultiplier'; value: number }
  | { kind: 'recruitCostMultiplier'; value: number }
  | { kind: 'veteranCostMultiplier'; value: number }
  /** Infamy from winning an execution, multiplied. */
  | { kind: 'executionInfamyMultiplier'; value: number }
  /** Share of an encounter's gold still paid out when the party loses it. */
  | { kind: 'defeatGoldFraction'; value: number }
  /** Skip Time buys this much more time per gold (multiplier). */
  | { kind: 'offlineTimeMultiplier'; value: number }
  /** Hours added to how much time away the game catches up on. */
  | { kind: 'offlineCapHours'; value: number }
  /** Gold from each voyage, multiplied (on top of the general gold multiplier). */
  | { kind: 'voyageGoldMultiplier'; value: number }
  // Delving (see data/relics.ts): the activity after Sailing.
  | { kind: 'unlockDelving' }
  | { kind: 'crewSlotBonus'; value: number }
  /** Delve trip time, multiplied. */
  | { kind: 'delveSpeedMultiplier'; value: number }
  /** Cave-in chance, multiplied. */
  | { kind: 'caveInMultiplier'; value: number }
  | { kind: 'relicFindChanceBonus'; value: number }
  | { kind: 'delveGoldMultiplier'; value: number }

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
  | { kind: 'tankTauntRange'; value: number }
  | { kind: 'healerReviveOnce'; hpFraction: number }
  | { kind: 'dpsExtraRange'; value: number }
  | { kind: 'tankDamageReduction'; value: number }
  | { kind: 'dpsDefensePierce'; value: number }
  | { kind: 'healerHealPowerBonus'; value: number }
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

/** A delving crew: digs one level deeper every trip it survives, until it reaches the depth it's
 * told to turn back at; a cave-in sends it back to the surface (see engine.ts tickCrews). */
export interface DelveCrew {
  id: string
  name: string
  /** The level its current trip is at (1 = just below the surface). */
  depth: number
  /** It won't dig past this level: deeper pays more, but caves in more often. */
  turnBackAt: number
  delveRemaining: number
  lifetimeGold: number
  /** The deepest level it has come back from. */
  deepest: number
  /** How its last trip went. */
  last: { kind: 'haul' | 'relic' | 'collapse'; depth: number; gold: number; relicId?: string } | null
}

/** Effects a relic can have: the same as the upgrades that boost everyone, folded in by the engine. */
export type RelicEffect = Extract<
  UpgradeEffect,
  {
    kind:
      | 'goldMultiplier'
      | 'xpMultiplier'
      | 'cooldownMultiplier'
      | 'partyAttackMultiplier'
      | 'partyDefenseMultiplier'
      | 'partyHpMultiplier'
      | 'partyHealMultiplier'
      | 'partyRegenPercent'
      | 'cheatDeathChance'
      | 'enemyHpMultiplier'
      | 'voyageGoldMultiplier'
      | 'delveGoldMultiplier'
  }
>

export interface Relic {
  id: string
  name: string
  description: string
  /** Which band of depths it's found in (see DELVE_BANDS). */
  band: number
  effect: RelicEffect
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
  /** Delving relic ids found so far — permanent, like artifacts. */
  discoveredRelicIds: string[]
}

export interface GameState {
  dm: DMState
  players: Player[]
  tables: Table[]
  ships: Ship[]
  crews: DelveCrew[]
  lastTickAt: number
}
