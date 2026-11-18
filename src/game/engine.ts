import type { RngFn } from './rng'
import { applyXp, type ArtifactBonuses, DEFAULT_ARTIFACT_BONUSES, toCombatUnit } from './characters'
import { runEncounter } from './combat/simulate'
import type { CombatUnit, EncounterTemplate, EnemySpawn } from './combat/types'
import { getArtifactById } from './data/artifacts'
import { getIslandById } from './data/islands'
import { getModuleById, getNextUnlockedCampaignModule, getPreviousUnlockedCampaignModule } from './data/modules'
import { DEFAULT_TROPHY_PARTS, getTrophyQuality, trophyStartingLevelBonus } from './data/trophies'
import { legacyTierCost } from './data/legacy'
import { getUpgradeById } from './data/upgrades'
import { dominantTrait } from './personality'
import { MAX_DELVE_DEPTH, RELICS, bandForDepth, getRelicById } from './data/relics'
import type { DelveCrew, DMState, Island, Player, Ship, Table, Trophy, UpgradeEffect, WipeRosterEntry } from './types'

export const BASE_COOLDOWN_MS = 5000
export const MIN_COOLDOWN_MS = 1000
export const BASE_TABLE_CAPACITY = 4
export const BASE_TABLE_SLOTS = 1
export const BASE_SHIP_SLOTS = 1
export const MIN_VOYAGE_MS = 5000
export const BASE_ARTIFACT_FIND_CHANCE = 0.15
// Repeat find of an already-discovered artifact isn't a dead roll — it pays
// out a slice of that voyage's gold on top of the normal reward instead.
export const REPEAT_FIND_GOLD_FRACTION = 0.5
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000
// High enough that a fast, high-level table (resolving an encounter roughly
// once a second) can actually consume a multi-day Buy Offline Progress
// purchase instead of quietly discarding whatever time the per-tick
// iteration cap couldn't get through — that cap exists to bound a single
// synchronous tick's work, not to limit how much time a purchase is worth.
const MAX_OFFLINE_ENCOUNTERS_PER_TABLE = 200_000
const MAX_OFFLINE_VOYAGES_PER_SHIP = 200_000
// Auto-Advance samples a table's most recent result rather than reacting to
// every encounter — at high level a table can resolve a fight roughly once a
// second, so checking after every single one would be both pointless
// (nothing meaningfully changes fight to fight) and expensive at scale.
export const AUTO_ADVANCE_CHECK_INTERVAL_MS = 3 * 60 * 1000
// Climbing takes a proven streak, not one lucky sample: a party that only just scrapes through
// will lose someone sooner or later, and one death snowballs (short-handed, the next fight is
// harder) into a wipe. At least this many flawless wins in a row, and three full laps of the
// module, before it moves up.
export const AUTO_ADVANCE_MIN_STREAK = 10
export const AUTO_ADVANCE_STREAK_LAPS = 3

export function autoAdvanceStreakNeeded(lapLength: number): number {
  return Math.max(AUTO_ADVANCE_MIN_STREAK, AUTO_ADVANCE_STREAK_LAPS * lapLength)
}

/** The table's flawless streak in the module it's on now. */
export function flawlessStreak(table: Table): number {
  return table.flawless && table.flawless.moduleId === table.assignedModuleId ? table.flawless.count : 0
}

/** Did the last fight go badly: a death (even one Plot Armor undid), a loss or a stalemate? */
function struggled(r: NonNullable<Table['lastBattleRewards']>): boolean {
  return r.outcome !== 'victory' || r.infamy > 0 || (r.spared ?? 0) > 0
}

/** Delegate the Table falling back a tier: straight after a bad fight, not at the next check. */
function retreat(table: Table, dm: DMState): Pick<Table, 'assignedModuleId' | 'encounterIndex' | 'cooldownRemaining'> | null {
  if (!table.assignedModuleId) return null
  const moduleDef = getModuleById(table.assignedModuleId)
  if (!moduleDef || moduleDef.kind !== 'campaign') return null
  const previous = getPreviousUnlockedCampaignModule(moduleDef.id, dm.unlockedModuleIds)
  return previous ? { assignedModuleId: previous.id, encounterIndex: 0, cooldownRemaining: 500 } : null
}

// Buy Offline Progress: spends a fraction of CURRENT gold (not a fixed or
// escalating amount) to instantly simulate that much wall-clock time via the
// same tickTables/tickShips path real offline catch-up already uses. Always
// costing a percentage of your current balance is what keeps it relevant at
// any scale — 10% of 60 gold and 10% of a trillion are both a real choice,
// and repeated purchases keep buying more absolute time as the balance
// (partly refilled by the simulated time itself) grows.
export const OFFLINE_PROGRESS_GOLD_FRACTION = 0.1
// First-pass calibration: spending roughly a trillion gold this way (e.g.
// several 10%-of-current purchases in a row) should buy somewhere around a
// couple of days — ~518,400,000,000 gold per simulated day.
export const GOLD_PER_MS = 6000

/** How much time Skip Time buys for this much gold (Session Recaps stretch it: pass the DM). */
export function offlineProgressDurationMs(costGold: number, dm?: DMState): number {
  return Math.floor((costGold / GOLD_PER_MS) * (dm ? computeUpgradeBonuses(dm).offlineTime : 1))
}

/** How much time away the game catches up on when you come back (Long Weekends add to it). */
export function maxOfflineMs(dm: DMState): number {
  return MAX_OFFLINE_MS + computeUpgradeBonuses(dm).offlineCapHours * 60 * 60 * 1000
}

export interface Multipliers {
  gold: number
  xp: number
  cooldown: number
  infamy: number
}

/** Every effect in play: bought upgrades, plus relics found delving (which use the same kinds). */
function activeEffects(dm: DMState): UpgradeEffect[] {
  const out: UpgradeEffect[] = []
  for (const id of dm.purchasedUpgradeIds) {
    const u = getUpgradeById(id)
    if (u) out.push(u.effect)
  }
  for (const id of dm.discoveredRelicIds ?? []) {
    const r = getRelicById(id)
    if (r) out.push(r.effect)
  }
  return out
}

/**
 * Remembers a total per (upgrades, relics) pair. Both lists are only ever replaced, never
 * changed in place, so the same two arrays always give the same answer: this keeps hot loops
 * (thousands of delve trips in an offline catch-up, every render) from re-adding everything.
 */
function memoByEffects<T>(compute: (dm: DMState) => T): (dm: DMState) => T {
  let lastUpgrades: string[] | null = null
  let lastRelics: string[] | undefined | null = null
  let last: T
  return (dm) => {
    if (dm.purchasedUpgradeIds !== lastUpgrades || dm.discoveredRelicIds !== lastRelics) {
      last = compute(dm)
      lastUpgrades = dm.purchasedUpgradeIds
      lastRelics = dm.discoveredRelicIds
    }
    return last
  }
}

export const computeMultipliers = memoByEffects(computeMultipliersUncached)

function computeMultipliersUncached(dm: DMState): Multipliers {
  const m: Multipliers = { gold: 1, xp: 1, cooldown: 1, infamy: 1 }
  for (const effect of activeEffects(dm)) {
    switch (effect.kind) {
      case 'goldMultiplier':
        m.gold *= effect.value
        break
      case 'xpMultiplier':
        m.xp *= effect.value
        break
      case 'cooldownMultiplier':
        m.cooldown *= effect.value
        break
      case 'infamyMultiplier':
        m.infamy *= effect.value
        break
    }
  }
  return m
}

/** Everything the newer upgrade kinds add up to (multipliers multiply, everything else sums). */
export interface UpgradeBonuses {
  partyAttack: number
  partyDefense: number
  partyHp: number
  partyHeal: number
  partyRegen: number
  cheatDeath: number
  enemyHp: number
  startingLevels: number
  roleTierCost: number
  recruitCost: number
  veteranCost: number
  executionInfamy: number
  defeatGold: number
  offlineTime: number
  offlineCapHours: number
  voyageGold: number
  crewSlots: number
  delveSpeed: number
  caveIn: number
  relicFind: number
  delveGold: number
}

export const computeUpgradeBonuses = memoByEffects(computeUpgradeBonusesUncached)

function computeUpgradeBonusesUncached(dm: DMState): UpgradeBonuses {
  const b: UpgradeBonuses = {
    partyAttack: 1,
    partyDefense: 1,
    partyHp: 1,
    partyHeal: 1,
    partyRegen: 0,
    cheatDeath: 0,
    enemyHp: 1,
    startingLevels: 0,
    roleTierCost: 1,
    recruitCost: 1,
    veteranCost: 1,
    executionInfamy: 1,
    defeatGold: 0,
    offlineTime: 1,
    offlineCapHours: 0,
    voyageGold: 1,
    crewSlots: 0,
    delveSpeed: 1,
    caveIn: 1,
    relicFind: 0,
    delveGold: 1,
  }
  for (const e of activeEffects(dm)) {
    switch (e.kind) {
      case 'partyAttackMultiplier':
        b.partyAttack *= e.value
        break
      case 'partyDefenseMultiplier':
        b.partyDefense *= e.value
        break
      case 'partyHpMultiplier':
        b.partyHp *= e.value
        break
      case 'partyHealMultiplier':
        b.partyHeal *= e.value
        break
      case 'partyRegenPercent':
        b.partyRegen += e.value
        break
      case 'cheatDeathChance':
        b.cheatDeath += e.value
        break
      case 'enemyHpMultiplier':
        b.enemyHp *= e.value
        break
      case 'startingLevelBonus':
        b.startingLevels += e.value
        break
      case 'roleTierCostMultiplier':
        b.roleTierCost *= e.value
        break
      case 'recruitCostMultiplier':
        b.recruitCost *= e.value
        break
      case 'veteranCostMultiplier':
        b.veteranCost *= e.value
        break
      case 'executionInfamyMultiplier':
        b.executionInfamy *= e.value
        break
      case 'defeatGoldFraction':
        b.defeatGold += e.value
        break
      case 'offlineTimeMultiplier':
        b.offlineTime *= e.value
        break
      case 'offlineCapHours':
        b.offlineCapHours += e.value
        break
      case 'voyageGoldMultiplier':
        b.voyageGold *= e.value
        break
      case 'crewSlotBonus':
        b.crewSlots += e.value
        break
      case 'delveSpeedMultiplier':
        b.delveSpeed *= e.value
        break
      case 'caveInMultiplier':
        b.caveIn *= e.value
        break
      case 'relicFindChanceBonus':
        b.relicFind += e.value
        break
      case 'delveGoldMultiplier':
        b.delveGold *= e.value
        break
    }
  }
  // Death must stay a real risk, a lost fight must never pay like a won one, and enemies keep
  // at least half their health however feared you are.
  b.cheatDeath = Math.min(0.6, b.cheatDeath)
  b.defeatGold = Math.min(0.75, b.defeatGold)
  b.enemyHp = Math.max(0.5, b.enemyHp)
  return b
}

/** Gold to unlock a role's tier for a player (Class Mentors discount it). */
export function roleTierUnlockCost(dm: DMState, baseCost: number): number {
  return baseCost <= 0 ? 0 : Math.max(1, Math.round(baseCost * computeUpgradeBonuses(dm).roleTierCost))
}

/** Infamy to raise a player's veteran tier (Hall of Heroes discounts it). */
export function veteranTierCost(dm: DMState, currentTier: number): number {
  return Math.max(1, Math.round(legacyTierCost(currentTier) * computeUpgradeBonuses(dm).veteranCost))
}

/** Levels every newly rolled character starts with above level 1: trophies plus Session Zero. */
export function startingLevelBonus(dm: DMState): number {
  return trophyStartingLevelBonus(dm.trophies.length) + computeUpgradeBonuses(dm).startingLevels
}

/** The party's upgrades applied to one of its combat units. */
function applyPartyBonuses(unit: CombatUnit, b: UpgradeBonuses): CombatUnit {
  const hp = Math.max(1, Math.round(unit.maxHp * b.partyHp))
  return {
    ...unit,
    hp,
    maxHp: hp,
    attackPower: Math.round(unit.attackPower * b.partyAttack),
    defense: Math.round(unit.defense * b.partyDefense),
    healPower: Math.round(unit.healPower * b.partyHeal),
    selfRegenPercent: (unit.selfRegenPercent ?? 0) + b.partyRegen || undefined,
  }
}

export function tableCapacityBonus(dm: DMState): number {
  let bonus = 0
  for (const id of dm.purchasedUpgradeIds) {
    const upgrade = getUpgradeById(id)
    if (upgrade?.effect.kind === 'tableCapacityBonus') bonus += upgrade.effect.value
  }
  return bonus
}

export function tableSlotBonus(dm: DMState): number {
  let bonus = 0
  for (const id of dm.purchasedUpgradeIds) {
    const upgrade = getUpgradeById(id)
    if (upgrade?.effect.kind === 'tableSlotBonus') bonus += upgrade.effect.value
  }
  return bonus
}

export function hasRoleSelectionUnlock(dm: DMState): boolean {
  return dm.purchasedUpgradeIds.some((id) => getUpgradeById(id)?.effect.kind === 'unlockRoleSelection')
}

export function hasQuickRefillUnlock(dm: DMState): boolean {
  return dm.purchasedUpgradeIds.some((id) => getUpgradeById(id)?.effect.kind === 'unlockQuickRefill')
}

export function hasAutoAdvanceUnlock(dm: DMState): boolean {
  return dm.purchasedUpgradeIds.some((id) => getUpgradeById(id)?.effect.kind === 'unlockAutoAdvance')
}

export function effectiveTableCapacity(dm: DMState): number {
  return BASE_TABLE_CAPACITY + tableCapacityBonus(dm)
}

export function effectiveTableSlots(dm: DMState): number {
  return BASE_TABLE_SLOTS + tableSlotBonus(dm)
}

export function hasSailingUnlock(dm: DMState): boolean {
  return dm.purchasedUpgradeIds.some((id) => getUpgradeById(id)?.effect.kind === 'unlockSailing')
}

export function shipSlotBonus(dm: DMState): number {
  let bonus = 0
  for (const id of dm.purchasedUpgradeIds) {
    const upgrade = getUpgradeById(id)
    if (upgrade?.effect.kind === 'shipSlotBonus') bonus += upgrade.effect.value
  }
  return bonus
}

export function effectiveShipSlots(dm: DMState): number {
  return BASE_SHIP_SLOTS + shipSlotBonus(dm)
}

export function sailSpeedMultiplier(dm: DMState): number {
  let multiplier = 1
  for (const id of dm.purchasedUpgradeIds) {
    const upgrade = getUpgradeById(id)
    if (upgrade?.effect.kind === 'sailSpeedMultiplier') multiplier *= upgrade.effect.value
  }
  return multiplier
}

export function artifactFindChanceBonus(dm: DMState): number {
  let bonus = 0
  for (const id of dm.purchasedUpgradeIds) {
    const upgrade = getUpgradeById(id)
    if (upgrade?.effect.kind === 'artifactFindChanceBonus') bonus += upgrade.effect.value
  }
  return bonus
}

export function voyageDuration(island: { baseVoyageDurationMs: number }, dm: DMState): number {
  return Math.max(MIN_VOYAGE_MS, Math.round(island.baseVoyageDurationMs * sailSpeedMultiplier(dm)))
}

/** Derives each role's Sailing artifact bonuses from the DM's discovered artifacts — computed once per encounter and baked onto every CombatUnit built for it (see characters.ts toCombatUnit), so combat/simulate.ts never needs to know about DM state. */
export function computeArtifactBonuses(dm: DMState): ArtifactBonuses {
  const bonuses: ArtifactBonuses = { ...DEFAULT_ARTIFACT_BONUSES }
  for (const id of dm.discoveredArtifactIds) {
    const artifact = getArtifactById(id)
    if (!artifact) continue
    switch (artifact.effect.kind) {
      case 'tankTauntRange':
        bonuses.tankTauntRangeBonus += artifact.effect.value
        break
      case 'healerReviveOnce':
        bonuses.healerRevive = true
        bonuses.healerReviveHpFraction = artifact.effect.hpFraction
        break
      case 'dpsExtraRange':
        bonuses.dpsExtraRangeBonus += artifact.effect.value
        break
      case 'tankDamageReduction':
        bonuses.tankDamageReductionPercent += artifact.effect.value
        break
      case 'dpsDefensePierce':
        bonuses.dpsDefensePiercePercent += artifact.effect.value
        break
      case 'healerHealPowerBonus':
        bonuses.healerHealPowerBonusPercent += artifact.effect.value
        break
      case 'dpsRicochet':
        bonuses.dpsBonusTargetsOnHit += artifact.effect.targets
        bonuses.dpsBonusTargetDamagePercent += artifact.effect.damagePercent
        break
      case 'healerChainHeal':
        bonuses.healerBonusTargetsOnHeal += artifact.effect.targets
        bonuses.healerBonusHealPercent += artifact.effect.healPercent
        break
      case 'tankDamageReductionRamp':
        bonuses.tankDamageReductionRampPercent += artifact.effect.percentPerRound
        break
      case 'dpsAttackPowerRamp':
        bonuses.dpsAttackPowerRampPercent += artifact.effect.percentPerRound
        break
      case 'healerHealPowerRamp':
        bonuses.healerHealPowerRampPercent += artifact.effect.percentPerRound
        break
    }
  }
  // Stacking multiple islands' artifacts is the point, but 100% reduction or
  // pierce would mean "never take damage" / "defense does nothing at all" —
  // clamp well short of that so defense/mitigation always still matters.
  bonuses.tankDamageReductionPercent = Math.min(0.75, bonuses.tankDamageReductionPercent)
  bonuses.dpsDefensePiercePercent = Math.min(0.9, bonuses.dpsDefensePiercePercent)
  return bonuses
}

export function computeInfamyReward(lifetimeGold: number, partyCount: number, multipliers: Multipliers): number {
  const base = Math.floor(Math.sqrt(lifetimeGold / 10))
  const minFromParty = Math.max(1, partyCount)
  const amount = Math.max(base, minFromParty)
  return Math.max(1, Math.round(amount * multipliers.infamy))
}

// A "par" clear (roughly what a competent-but-not-trivial fight should take)
// lands right at the old flat cooldown. Faster than that earns a discount;
// slower than that costs extra, capped at 2x so a truly ugly stalemate
// doesn't spiral into an absurd wait. Tuned as a starting point — adjust
// PAR_ROUNDS if the game ends up feeling too fast/slow in practice.
export const PAR_ROUNDS = 7
export const MAX_COOLDOWN_SCALE = 2

/**
 * Cooldown scales with how long the fight actually took relative to a par
 * clear — a quick, clean win gets back to the next encounter faster than
 * before, while a fight that drags on costs more than before. This is what
 * actually rewards a well-prepared party instead of every table grinding at
 * the exact same pace regardless of how well it's doing.
 */
function freshCooldown(multipliers: Multipliers, roundsElapsed: number): number {
  const paceScale = Math.min(MAX_COOLDOWN_SCALE, roundsElapsed / PAR_ROUNDS)
  return Math.max(MIN_COOLDOWN_MS, Math.round(BASE_COOLDOWN_MS * multipliers.cooldown * paceScale))
}

/**
 * Each time an execution module is actually WON, it comes back TWICE as
 * deadly next time — never from merely attempting or losing. That keeps
 * "just don't fight it until you're ready" from being a viable way to dodge
 * the escalation: leaving it alone keeps it exactly as dangerous as it is
 * now. Bumped up from 1.4x: at that rate, a party strong enough to win once
 * was usually strong enough to win several tiers in a row before the curve
 * caught up — beating it needs to feel like winning one specific fight, not
 * unlocking a short run of free wins.
 */
export const EXECUTION_GROWTH_RATE = 2
// A never-yet-won execution module doesn't start at the very bottom of that
// curve — it's already as tough as tier 3 would be, so a fresh party can't
// just walk in and rack up several wins before it has a chance to escalate
// on its own. Every further win still climbs by 1 tier from here, same as
// always; this only raises the floor a first attempt starts from.
export const EXECUTION_STARTING_TIER = 3
const TROPHY_BASE_INFAMY = 25
const TROPHY_INFAMY_PER_TIER = 15

let nextTrophyId = 1
function generateTrophyId(): string {
  return `trophy-${Date.now().toString(36)}-${(nextTrophyId++).toString(36)}`
}

function scaleEnemySpawn(spawn: EnemySpawn, multiplier: number): EnemySpawn {
  if (multiplier === 1) return spawn
  return {
    ...spawn,
    hp: Math.round(spawn.hp * multiplier),
    attackPower: Math.round(spawn.attackPower * multiplier),
    defense: Math.round(spawn.defense * multiplier),
    // Matters for a self-sustaining boss like the Kraken — without scaling
    // healPower too, its self-heal would stay flat while its maxHp balloons,
    // making the sustain gimmick trivial to out-damage past the first win.
    healPower: Math.round(spawn.healPower * multiplier),
    attackPowerRampPerRound:
      spawn.attackPowerRampPerRound !== undefined ? Math.round(spawn.attackPowerRampPerRound * multiplier) : undefined,
  }
}

function scaleEncounterForTier(template: EncounterTemplate, tier: number): EncounterTemplate {
  const multiplier = EXECUTION_GROWTH_RATE ** tier
  if (multiplier === 1) return template
  return { ...template, enemies: template.enemies.map((spawn) => scaleEnemySpawn(spawn, multiplier)) }
}

// The first three campaign tiers are the learning curve and stay exactly as
// authored. From tier 4 on, enemies fight with extra stats on top of their
// authored ones — but the gold/XP a win pays out is still based on the
// authored stats (see EncounterTemplate.difficultyMultiplier), so climbing
// gets slower without getting any more lucrative.
//
// The extra stats compound tier over tier, and the per-tier RATE itself
// climbs: a gentle 1.25x step at tier 4 growing to 2.75x per step by tier 10,
// so the gap widens faster the higher you go and a party can't just
// out-level its way up the ladder — it needs the higher-tiered units to keep
// pace. Past tier 10 the ramp stops: tiers 11-13 are already authored at 2.2x
// per tier (vs 1.6x before them), so continuing to ramp on top of that walled
// the late game off. The step instead drops to a gentle 1.25x at tier 11 and
// tapers to 1.0x (no extra hardening, only the authored growth) by tier 13.
// First-pass numbers: retune if progression still feels too fast (or too
// walled).
export const CAMPAIGN_HARDENING_START_TIER = 4
export const CAMPAIGN_HARDENING_PEAK_TIER = 10
export const CAMPAIGN_HARDENING_START_RATE = 1.25
export const CAMPAIGN_HARDENING_PEAK_RATE = 2.75
export const CAMPAIGN_HARDENING_LATE_START_TIER = 11
export const CAMPAIGN_HARDENING_LATE_END_TIER = 13
export const CAMPAIGN_HARDENING_LATE_START_RATE = 1.25
export const CAMPAIGN_HARDENING_LATE_END_RATE = 1.0

/** The extra-stats step a single campaign tier adds on top of the one below it — linear from START_RATE at the first hardened tier up to PEAK_RATE at the peak tier, then a lower LATE_START_RATE that tapers linearly to LATE_END_RATE by the last tier (flat beyond). */
export function campaignHardeningRate(tier: number): number {
  if (tier > CAMPAIGN_HARDENING_PEAK_TIER) {
    const span = CAMPAIGN_HARDENING_LATE_END_TIER - CAMPAIGN_HARDENING_LATE_START_TIER
    const progress = Math.min(1, Math.max(0, (tier - CAMPAIGN_HARDENING_LATE_START_TIER) / span))
    return CAMPAIGN_HARDENING_LATE_START_RATE + (CAMPAIGN_HARDENING_LATE_END_RATE - CAMPAIGN_HARDENING_LATE_START_RATE) * progress
  }
  const span = CAMPAIGN_HARDENING_PEAK_TIER - CAMPAIGN_HARDENING_START_TIER
  const progress = Math.min(1, Math.max(0, (tier - CAMPAIGN_HARDENING_START_TIER) / span))
  return CAMPAIGN_HARDENING_START_RATE + (CAMPAIGN_HARDENING_PEAK_RATE - CAMPAIGN_HARDENING_START_RATE) * progress
}

export function campaignDifficultyMultiplier(tier: number): number {
  let multiplier = 1
  for (let t = CAMPAIGN_HARDENING_START_TIER; t <= tier; t++) multiplier *= campaignHardeningRate(t)
  return multiplier
}

function hardenCampaignEncounter(template: EncounterTemplate, tier: number): EncounterTemplate {
  const multiplier = campaignDifficultyMultiplier(tier)
  if (multiplier === 1) return template
  return { ...template, difficultyMultiplier: multiplier }
}

/**
 * Resolves the table's currently-assigned encounter exactly once against its
 * seated players. Any player whose character isn't among the survivors is
 * benched (character cleared, tableId cleared) — they aren't deleted, just
 * pulled off this table until reseated. If that leaves nobody seated, it's a
 * full-party wipe: Infamy is granted and the table resets — whether that
 * wipe came from an execution module or bad luck on a winnable one.
 */
export function resolveEncounter(
  table: Table,
  seatedPlayers: Player[],
  initialDm: DMState,
  rng: RngFn,
): { table: Table; players: Player[]; dm: DMState } {
  const moduleDef = table.assignedModuleId ? getModuleById(table.assignedModuleId) : undefined
  if (!moduleDef) return { table, players: seatedPlayers, dm: initialDm }

  const dm = initialDm
  const isExecution = moduleDef.kind === 'execution'
  // winCount is the honest "how many times has this actually been beaten"
  // number — it drives trophy quality, the infamy bonus, and the "Defeated N
  // times" display, and always starts at 0. difficultyTier is a SEPARATE,
  // offset value used only to scale the fight itself: a fresh, never-won
  // attempt is already as tough as EXECUTION_STARTING_TIER would imply, but
  // that's purely about making the fight hard, not about pretending you've
  // already earned tier-3 rewards for a win you haven't gotten yet.
  const winCount = isExecution ? (dm.executionTier[moduleDef.id] ?? 0) : 0
  const difficultyTier = isExecution ? winCount + EXECUTION_STARTING_TIER : 0
  const upgrades = computeUpgradeBonuses(dm)
  const baseTemplate = isExecution
    ? scaleEncounterForTier(moduleDef.encounters[table.encounterIndex % moduleDef.encounters.length], difficultyTier)
    : hardenCampaignEncounter(moduleDef.encounters[table.encounterIndex % moduleDef.encounters.length], moduleDef.tier)
  // Dread Reputation: enemies come in weakened (the fight's rewards don't change).
  const encounterTemplate = upgrades.enemyHp < 1 ? { ...baseTemplate, enemyHpMultiplier: upgrades.enemyHp } : baseTemplate

  const artifactBonuses = computeArtifactBonuses(dm)
  const partyUnits = seatedPlayers.map((p) =>
    applyPartyBonuses(toCombatUnit(p.character!, dominantTrait(p.personality), artifactBonuses), upgrades),
  )
  const result = runEncounter(partyUnits, encounterTemplate, rng)
  const multipliers = computeMultipliers(dm)
  const survivorCharIds = new Set(result.survivorIds)
  // Plot Armor: each character who fell may be spared anyway, keeping their seat and levels.
  // Never against an execution: those are meant to end in a wipe (the table resets and the
  // wipe pays its infamy), and a spared survivor would keep the table refighting the boss.
  let spared = 0
  if (upgrades.cheatDeath > 0 && !isExecution)
    for (const p of seatedPlayers)
      if (p.character && !survivorCharIds.has(p.character.id) && rng() < upgrades.cheatDeath) {
        survivorCharIds.add(p.character.id)
        spared++
      }
  // A stalemate still teaches the party something even without a kill, so it
  // grants XP same as a win — but never gold, or grinding an unwinnable fight
  // forever would be a free loot pump. runEncounter already zeroes xpReward
  // for an outright defeat.
  const xpGain = Math.round(result.xpReward * multipliers.xp)

  const updatedPlayers = seatedPlayers.map((p) => {
    if (!p.character) return p
    if (!survivorCharIds.has(p.character.id)) {
      return { ...p, character: null, tableId: null }
    }
    if (xpGain > 0) {
      return { ...p, character: applyXp(p.character, xpGain) }
    }
    return p
  })

  const stillSeatedCount = updatedPlayers.filter((p) => p.tableId === table.id).length

  // Quick Refill's memory of "who sat here and in what role:" drop anyone
  // who's still actively fighting at this table (they don't need refilling,
  // and if they die later they'll be re-added fresh then), then add whoever
  // JUST died this fight — whether that's the whole table (a full wipe) or
  // only some of it (a partial casualty). Previously this only ever got
  // written on a full wipe, so a partial casualty's dead player(s) were
  // silently invisible to Quick Refill until the table wiped completely.
  const currentlyFightingIds = new Set(seatedPlayers.filter((p) => p.character).map((p) => p.id))
  const justDiedEntries: WipeRosterEntry[] = seatedPlayers
    .filter((p) => p.character && !survivorCharIds.has(p.character.id))
    .map((p) => ({ playerId: p.id, role: p.character!.role }))
  const prunedWipeRoster = (table.lastWipeRoster ?? []).filter((entry) => !currentlyFightingIds.has(entry.playerId))
  const nextWipeRosterEntries = [...prunedWipeRoster, ...justDiedEntries]
  const nextWipeRoster = nextWipeRosterEntries.length > 0 ? nextWipeRosterEntries : null

  // Salvage Rights: a lost fight still pays a share of what it was worth. Campaign fights only:
  // an execution's boss doubles in power with every win, so its loot value balloons, and
  // losing to it on purpose would be a gold farm.
  const salvageGold =
    result.outcome === 'defeat' && upgrades.defeatGold > 0 && !isExecution
      ? Math.round(result.lootValue * upgrades.defeatGold * multipliers.gold)
      : 0

  if (stillSeatedCount === 0) {
    const infamyGain = computeInfamyReward(table.lifetimeGold, seatedPlayers.length, multipliers)
    const nextDm: DMState = { ...dm, infamy: dm.infamy + infamyGain, gold: dm.gold + salvageGold }
    const nextTable: Table = {
      ...table,
      assignedModuleId: null,
      encounterIndex: 0,
      cooldownRemaining: freshCooldown(multipliers, result.roundsElapsed),
      lifetimeGold: 0,
      lastBattleLog: result.log,
      lastBattleModuleName: moduleDef.name,
      lastBattleRewards: { outcome: result.outcome, xp: 0, gold: salvageGold, infamy: infamyGain, ...(spared ? { spared } : {}) },
      lastWipeRoster: nextWipeRoster,
    }
    return { table: nextTable, players: updatedPlayers, dm: nextDm }
  }

  let nextDm = dm
  let nextEncounterIndex = table.encounterIndex
  let nextLifetimeGold = table.lifetimeGold
  let goldGain = 0
  let infamyBonus = 0

  // A character who dies still earns Infamy even when the rest of the table
  // lives on — death is what Infamy is for, not just a full-party wipe.
  const casualtyCount = seatedPlayers.reduce(
    (n, p) => n + (p.character && !survivorCharIds.has(p.character.id) ? 1 : 0),
    0,
  )
  if (casualtyCount > 0) {
    infamyBonus += computeInfamyReward(table.lifetimeGold, casualtyCount, multipliers)
    nextDm = { ...nextDm, infamy: nextDm.infamy + infamyBonus }
  }

  if (salvageGold > 0) {
    goldGain = salvageGold
    nextDm = { ...nextDm, gold: nextDm.gold + goldGain }
    nextLifetimeGold += goldGain
  }

  if (result.outcome === 'victory') {
    goldGain = Math.round(result.goldReward * multipliers.gold)
    nextDm = { ...nextDm, gold: nextDm.gold + goldGain }
    nextLifetimeGold += goldGain
    nextEncounterIndex = (table.encounterIndex + 1) % moduleDef.encounters.length

    if (isExecution) {
      const parts = moduleDef.trophyParts ?? DEFAULT_TROPHY_PARTS
      const trophy: Trophy = {
        id: generateTrophyId(),
        moduleId: moduleDef.id,
        part: parts[Math.floor(rng() * parts.length)],
        quality: getTrophyQuality(winCount),
        tierDefeated: winCount,
        earnedAt: Date.now(),
      }
      const trophyInfamy = Math.round((TROPHY_BASE_INFAMY + winCount * TROPHY_INFAMY_PER_TIER) * upgrades.executionInfamy)
      infamyBonus += trophyInfamy
      nextDm = {
        ...nextDm,
        infamy: nextDm.infamy + trophyInfamy,
        executionTier: { ...nextDm.executionTier, [moduleDef.id]: winCount + 1 },
        trophies: [...nextDm.trophies, trophy],
      }
    }
  }

  const nextTable: Table = {
    ...table,
    encounterIndex: nextEncounterIndex,
    lifetimeGold: nextLifetimeGold,
    cooldownRemaining: freshCooldown(multipliers, result.roundsElapsed),
    lastBattleLog: result.log,
    lastBattleModuleName: moduleDef.name,
    lastBattleRewards: { outcome: result.outcome, xp: xpGain, gold: goldGain, infamy: infamyBonus, ...(spared ? { spared } : {}) },
    lastWipeRoster: nextWipeRoster,
  }
  return { table: nextTable, players: updatedPlayers, dm: nextDm }
}

/**
 * Auto-Advance: judges the table's most recently recorded battle result — a
 * flawless victory (zero casualties) climbs to the next-higher unlocked
 * campaign module, any casualty drops back to the next-lower one. Sampled
 * periodically by tickTable (AUTO_ADVANCE_CHECK_INTERVAL_MS), not reacted to
 * per encounter. Only trusts the recorded result if it actually came from
 * the currently-assigned module — otherwise it's stale evidence left over
 * from before the last reassignment.
 */
function evaluateAutoAdvance(table: Table, dm: DMState): Pick<Table, 'assignedModuleId' | 'encounterIndex' | 'cooldownRemaining'> | null {
  if (!table.assignedModuleId || !table.lastBattleRewards) return null
  const moduleDef = getModuleById(table.assignedModuleId)
  if (!moduleDef || moduleDef.kind !== 'campaign') return null
  if (table.lastBattleModuleName !== moduleDef.name) return null

  if (struggled(table.lastBattleRewards)) return retreat(table, dm)
  // Up a tier only on a proven streak here (see AUTO_ADVANCE_MIN_STREAK).
  if (flawlessStreak(table) < autoAdvanceStreakNeeded(moduleDef.encounters.length)) return null
  const next = getNextUnlockedCampaignModule(moduleDef.id, dm.unlockedModuleIds)
  return next ? { assignedModuleId: next.id, encounterIndex: 0, cooldownRemaining: 500 } : null
}

/** One encounterIndex's worth of empirically-observed reward/pacing, gathered from a real simulation, reused by fastForwardCampaignGrind instead of re-simulating combat for every repeat. */
interface CampaignLapSample {
  cooldownMs: number
  gold: number
  xp: number
}

/**
 * Closed-form fast path for tickTable once every encounter in the current
 * campaign module has been confirmed (via a real simulation, this call) to
 * be a flawless win: campaign difficulty never escalates on repeat — unlike
 * execution modules, which explicitly get harder every win — and a leveling
 * party only gets safer, never riskier. So every remaining repeat of this
 * exact lap can be resolved with plain arithmetic (reusing the gold/xp/pacing
 * already observed for each encounterIndex) instead of re-running full
 * combat. Whole laps are skipped in one multiplication rather than looped
 * one at a time, so this stays instant no matter how much time is left —
 * that's what keeps a huge Buy Offline Progress purchase, or a long real gap
 * since the last session, fast instead of grinding through what could be
 * hundreds of thousands of individual fights.
 */
function fastForwardCampaignGrind(
  table: Table,
  lapSamples: Map<number, CampaignLapSample>,
  lapLength: number,
  remaining: number,
): { table: Table; remaining: number; iterations: number; totalGoldGain: number; totalXpGain: number } {
  let cooldownRemaining = table.cooldownRemaining
  let encounterIndex = table.encounterIndex
  let rem = remaining
  let iterations = 0
  let totalGoldGain = 0
  let totalXpGain = 0

  // Phase 1 and phase 3 below are each naturally bounded to under lapLength
  // steps — phase 1 by encounterIndex cycling back to 0, phase 3 by rem
  // already being less than one full lap's cooldown by the time it runs —
  // so neither needs its own iteration cap; only phase 2's closed-form skip
  // has unbounded magnitude, and it's O(1) regardless of size.
  const stepOne = (): boolean => {
    if (rem <= 0) return false
    const sample = lapSamples.get(encounterIndex)
    if (!sample) return false // shouldn't happen once a full lap is confirmed, but never fast-forward off incomplete data
    if (cooldownRemaining > rem) {
      cooldownRemaining -= rem
      rem = 0
      return false
    }
    rem -= cooldownRemaining
    totalGoldGain += sample.gold
    totalXpGain += sample.xp
    cooldownRemaining = sample.cooldownMs
    encounterIndex = (encounterIndex + 1) % lapLength
    iterations++
    return true
  }

  // Phase 1: finish out whatever's left of the current partial lap (at most
  // lapLength - 1 fights) so the closed-form skip below always starts
  // cleanly aligned at encounterIndex 0.
  while (encounterIndex !== 0 && stepOne()) {
    /* stepping */
  }

  // Phase 2: skip as many WHOLE laps as fit in one shot, instead of looping
  // fight by fight. Deliberately NOT bounded by maxIterations — that cap
  // exists to bound a single synchronous tick's EXPENSIVE work (real combat
  // simulation), which this closed-form multiplication isn't, so it stays
  // instant no matter how many laps a purchase's remaining time is worth.
  if (encounterIndex === 0 && rem > 0) {
    let lapTotalCooldown = 0
    let lapTotalGold = 0
    let lapTotalXp = 0
    for (let i = 0; i < lapLength; i++) {
      const sample = lapSamples.get(i)
      if (!sample) {
        lapTotalCooldown = 0
        break
      }
      lapTotalCooldown += sample.cooldownMs
      lapTotalGold += sample.gold
      lapTotalXp += sample.xp
    }
    if (lapTotalCooldown > 0) {
      const fullLaps = Math.floor(rem / lapTotalCooldown)
      if (fullLaps > 0) {
        rem -= fullLaps * lapTotalCooldown
        totalGoldGain += fullLaps * lapTotalGold
        totalXpGain += fullLaps * lapTotalXp
        iterations += fullLaps * lapLength
      }
    }
  }

  // Phase 3: finish any remaining partial lap the normal, one-step way.
  while (stepOne()) {
    /* stepping */
  }

  return {
    table: { ...table, cooldownRemaining, encounterIndex, lifetimeGold: table.lifetimeGold + totalGoldGain },
    remaining: rem,
    iterations,
    totalGoldGain,
    totalXpGain,
  }
}

/**
 * Advances a single table by `dtMs` of wall-clock time, resolving as many
 * encounters as fit (used for both live ticks and offline catch-up). Reads
 * and writes back into the full player roster since table membership is
 * derived (players whose `tableId` matches), not owned by the table.
 */
export function tickTable(
  table: Table,
  players: Player[],
  dm: DMState,
  dtMs: number,
  rng: RngFn,
): { table: Table; players: Player[]; dm: DMState } {
  let t = table
  let allPlayers = players
  let d = dm
  let remaining = dtMs
  let iterations = 0

  // Tracks, for the table's CURRENT campaign module, which encounterIndex
  // values have been confirmed (via a real simulation this call) as a
  // flawless win — once every index is confirmed, fastForwardCampaignGrind
  // takes over for the rest of this module's fights. Reset whenever the
  // module changes or the streak breaks (any casualty), since either one
  // means the confirmed data no longer describes what's actually happening.
  let lapModuleId: string | null = null
  let lapSamples = new Map<number, CampaignLapSample>()

  while (remaining > 0 && t.assignedModuleId && iterations < MAX_OFFLINE_ENCOUNTERS_PER_TABLE) {
    if (t.assignedModuleId !== lapModuleId) {
      lapModuleId = t.assignedModuleId
      lapSamples = new Map()
    }

    const moduleDef = getModuleById(t.assignedModuleId)
    const lapLength = moduleDef?.encounters.length ?? 0
    const isCampaign = moduleDef?.kind === 'campaign'

    if (isCampaign && lapLength > 0 && lapSamples.size >= lapLength) {
      const fast = fastForwardCampaignGrind(t, lapSamples, lapLength, remaining)
      t = fast.table
      remaining = fast.remaining
      iterations += fast.iterations
      // Every skipped fight was a flawless win (that's what made skipping safe).
      t = { ...t, flawless: { moduleId: t.assignedModuleId!, count: flawlessStreak(t) + fast.iterations } }
      if (fast.totalGoldGain > 0) d = { ...d, gold: d.gold + fast.totalGoldGain }
      if (fast.totalXpGain > 0) {
        const seated = allPlayers.filter((p) => p.tableId === t.id)
        const updatedById = new Map(seated.map((p) => [p.id, { ...p, character: applyXp(p.character!, fast.totalXpGain) }]))
        allPlayers = allPlayers.map((p) => updatedById.get(p.id) ?? p)
      }
      continue
    }

    if (t.cooldownRemaining > remaining) {
      t = { ...t, cooldownRemaining: t.cooldownRemaining - remaining }
      remaining = 0
      break
    }
    remaining -= t.cooldownRemaining

    const encounterIndexBefore = t.encounterIndex
    const seated = allPlayers.filter((p) => p.tableId === t.id)
    const resolved = resolveEncounter(t, seated, d, rng)
    t = resolved.table
    d = resolved.dm
    const updatedById = new Map(resolved.players.map((p) => [p.id, p]))
    allPlayers = allPlayers.map((p) => updatedById.get(p.id) ?? p)
    iterations++

    const flawless = !!t.lastBattleRewards && !struggled(t.lastBattleRewards)
    const foughtIn = moduleDef?.id ?? null
    if (foughtIn) t = { ...t, flawless: { moduleId: foughtIn, count: flawless ? (t.flawless?.moduleId === foughtIn ? t.flawless.count : 0) + 1 : 0 } }
    // Delegate the Table steps back straight away after a bad fight, before a short-handed party
    // has to face the same thing again.
    if (!flawless && isCampaign && t.assignedModuleId === foughtIn && hasAutoAdvanceUnlock(d)) {
      const back = retreat(t, d)
      if (back) t = { ...t, ...back }
    }
    if (isCampaign && flawless) {
      lapSamples.set(encounterIndexBefore, {
        cooldownMs: t.cooldownRemaining,
        gold: t.lastBattleRewards!.gold,
        xp: t.lastBattleRewards!.xp,
      })
    } else {
      // A casualty (or a non-campaign fight) breaks the streak — any
      // earlier confirmation is no longer trustworthy, since the seated
      // roster may have just changed (a death benches that player), so the
      // module has to re-earn a full lap of confirmations before
      // fast-forwarding is allowed again.
      lapSamples = new Map()
    }
  }

  if (hasAutoAdvanceUnlock(d)) {
    const autoAdvanceRemaining = t.autoAdvanceCheckRemaining - dtMs
    // At most one adjustment per tickTable call even if dtMs spans several
    // intervals (e.g. a large Buy Offline Progress purchase) — a single
    // nudge per call is enough, and avoids leapfrogging several tiers off
    // one sampled battle's stale evidence.
    if (autoAdvanceRemaining <= 0) {
      const adjustment = evaluateAutoAdvance(t, d)
      t = { ...t, ...adjustment, autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS }
    } else {
      t = { ...t, autoAdvanceCheckRemaining: autoAdvanceRemaining }
    }
  }

  return { table: t, players: allPlayers, dm: d }
}

export function tickTables(
  tables: Table[],
  players: Player[],
  dm: DMState,
  dtMs: number,
  rng: RngFn,
): { tables: Table[]; players: Player[]; dm: DMState } {
  let d = dm
  let allPlayers = players
  const nextTables = tables.map((table) => {
    // One table's data throwing (a bad encounter, a corrupted character,
    // anything) must never freeze every other table too — this used to be a
    // single .map() with no isolation, so one bad table blocked the whole
    // batch update forever, every tick, on every table, permanently.
    try {
      const result = tickTable(table, allPlayers, d, dtMs, rng)
      d = result.dm
      allPlayers = result.players
      return result.table
    } catch (err) {
      console.error(`Table "${table.name}" (${table.id}) failed to tick — leaving it paused this tick:`, err)
      return table
    }
  })
  return { tables: nextTables, players: allPlayers, dm: d }
}

/**
 * Closed-form fast path for tickShip once every artifact this island can
 * roll has already been discovered: gold per voyage and voyage length are
 * both fixed for the rest of this call (they only depend on purchased
 * upgrades, which can't change mid-tick), so every remaining voyage is
 * resolved via simple arithmetic instead of an actual per-voyage loop — the
 * in-flight voyage still rolls for real (it's just the one, so there's no
 * cost to being exact), but every voyage after that uses the EXPECTED
 * consolation-gold payout in place of a real per-voyage roll, which is
 * exact on average and is what keeps a huge purchase, or a long real gap
 * since the last session, instant instead of grinding through what could be
 * hundreds of thousands of individual voyages.
 */
function fastForwardShip(
  ship: Ship,
  dm: DMState,
  island: Island,
  remaining: number,
  rng: RngFn,
): { ship: Ship; dm: DMState; remaining: number; iterations: number } {
  const multipliers = computeMultipliers(dm)
  const goldPerVoyage = Math.round(island.baseGoldReward * multipliers.gold * computeUpgradeBonuses(dm).voyageGold)
  const findChance = BASE_ARTIFACT_FIND_CHANCE + artifactFindChanceBonus(dm)
  const voyageMs = voyageDuration(island, dm)

  let voyageRemaining = ship.voyageRemaining
  let rem = remaining

  if (voyageRemaining > rem) {
    return { ship: { ...ship, voyageRemaining: voyageRemaining - rem }, dm, remaining: 0, iterations: 0 }
  }

  // The in-flight voyage is cheap to resolve exactly — every artifact is
  // already discovered, so this can only ever roll a consolation bonus,
  // never a new find.
  rem -= voyageRemaining
  let totalGold = goldPerVoyage
  if (island.artifactPool.length > 0 && rng() < findChance) {
    totalGold += Math.round(goldPerVoyage * REPEAT_FIND_GOLD_FRACTION)
  }
  let iterations = 1
  voyageRemaining = voyageMs

  // Every voyage after this one is identical, so batch them all at once via
  // the expected consolation bonus rather than rolling each one for real.
  // Deliberately NOT bounded by MAX_OFFLINE_VOYAGES_PER_SHIP — that cap
  // exists to bound a single synchronous tick's per-voyage looping, which
  // this closed-form multiplication isn't, so it stays instant no matter
  // how many voyages a purchase's remaining time is worth.
  const fullVoyages = Math.floor(rem / voyageMs)
  if (fullVoyages > 0) {
    const expectedGoldPerVoyage = goldPerVoyage + goldPerVoyage * findChance * REPEAT_FIND_GOLD_FRACTION
    rem -= fullVoyages * voyageMs
    totalGold += fullVoyages * expectedGoldPerVoyage
    iterations += fullVoyages
  }

  const goldGain = Math.round(totalGold)
  return {
    ship: { ...ship, voyageRemaining, lifetimeGold: ship.lifetimeGold + goldGain },
    dm: { ...dm, gold: dm.gold + goldGain },
    remaining: rem,
    iterations,
  }
}

/**
 * Advances a single ship's voyage by `dtMs` of wall-clock time, resolving as
 * many round trips as fit (live ticks and offline catch-up alike). Each
 * completed voyage pays out gold and rolls for an artifact, then the ship
 * auto-repeats to the same island — same "assign once, keeps going" shape as
 * a table's assigned module.
 */
function tickShip(ship: Ship, dm: DMState, dtMs: number, rng: RngFn): { ship: Ship; dm: DMState } {
  let s = ship
  let d = dm
  let remaining = dtMs
  let iterations = 0

  while (remaining > 0 && s.assignedIslandId && iterations < MAX_OFFLINE_VOYAGES_PER_SHIP) {
    const island = getIslandById(s.assignedIslandId)
    if (!island) break

    const allDiscovered = island.artifactPool.length === 0 || island.artifactPool.every((id) => d.discoveredArtifactIds.includes(id))
    if (allDiscovered) {
      const fast = fastForwardShip(s, d, island, remaining, rng)
      s = fast.ship
      d = fast.dm
      remaining = fast.remaining
      iterations += fast.iterations
      continue
    }

    if (s.voyageRemaining > remaining) {
      s = { ...s, voyageRemaining: s.voyageRemaining - remaining }
      remaining = 0
      break
    }
    remaining -= s.voyageRemaining

    const multipliers = computeMultipliers(d)
    const goldGain = Math.round(island.baseGoldReward * multipliers.gold * computeUpgradeBonuses(d).voyageGold)
    d = { ...d, gold: d.gold + goldGain }

    const findChance = BASE_ARTIFACT_FIND_CHANCE + artifactFindChanceBonus(d)
    if (island.artifactPool.length > 0 && rng() < findChance) {
      const artifactId = island.artifactPool[Math.floor(rng() * island.artifactPool.length)]
      if (d.discoveredArtifactIds.includes(artifactId)) {
        // Already have it — a smaller consolation payout so a repeat roll
        // isn't a dead click.
        d = { ...d, gold: d.gold + Math.round(goldGain * REPEAT_FIND_GOLD_FRACTION) }
      } else {
        d = { ...d, discoveredArtifactIds: [...d.discoveredArtifactIds, artifactId] }
      }
    }

    s = { ...s, voyageRemaining: voyageDuration(island, d), lifetimeGold: s.lifetimeGold + goldGain }
    iterations++
  }

  return { ship: s, dm: d }
}

export function tickShips(ships: Ship[], dm: DMState, dtMs: number, rng: RngFn): { ships: Ship[]; dm: DMState } {
  let d = dm
  const nextShips = ships.map((ship) => {
    // Same fault-isolation reasoning as tickTables — one bad ship must never
    // freeze the whole fleet's tick.
    try {
      const result = tickShip(ship, d, dtMs, rng)
      d = result.dm
      return result.ship
    } catch (err) {
      console.error(`Ship "${ship.name}" (${ship.id}) failed to tick — leaving it paused this tick:`, err)
      return ship
    }
  })
  return { ships: nextShips, dm: d }
}

// ---------- Delving ----------
//
// Crews dig one level deeper every trip they survive, up to the level they're told to turn back
// at, and keep delving there. Every trip deeper takes a little longer and pays a lot more, but
// the chance of a cave-in climbs with depth: one sends the crew back to the surface (level 1),
// losing that trip's haul. That's the choice: how deep is worth the risk. First-pass numbers.

export const BASE_CREW_SLOTS = 1
export const BASE_RELIC_FIND_CHANCE = 0.12
export const MIN_DELVE_MS = 8000
const DELVE_BASE_MS = 45_000
const DELVE_TIME_GROWTH = 1.08
const DELVE_BASE_GOLD = 40_000
const DELVE_GOLD_GROWTH = 1.3
const CAVE_IN_PER_LEVEL = 0.025
const MAX_CAVE_IN = 0.75
const MAX_OFFLINE_DELVES_PER_CREW = 200_000

export function hasDelvingUnlock(dm: DMState): boolean {
  return dm.purchasedUpgradeIds.some((id) => getUpgradeById(id)?.effect.kind === 'unlockDelving')
}

export function effectiveCrewSlots(dm: DMState): number {
  return BASE_CREW_SLOTS + computeUpgradeBonuses(dm).crewSlots
}

export function delveDuration(depth: number, dm: DMState): number {
  return Math.max(MIN_DELVE_MS, Math.round(DELVE_BASE_MS * DELVE_TIME_GROWTH ** (depth - 1) * computeUpgradeBonuses(dm).delveSpeed))
}

/** Gold a trip at this level brings back if it doesn't cave in. */
export function delveGold(depth: number, dm: DMState): number {
  return Math.round(DELVE_BASE_GOLD * DELVE_GOLD_GROWTH ** (depth - 1) * computeMultipliers(dm).gold * computeUpgradeBonuses(dm).delveGold)
}

/** Chance a trip at this level caves in (none on the first level). */
export function caveInChance(depth: number, dm: DMState): number {
  return Math.min(MAX_CAVE_IN, CAVE_IN_PER_LEVEL * (depth - 1)) * computeUpgradeBonuses(dm).caveIn
}

export function relicFindChance(dm: DMState): number {
  return BASE_RELIC_FIND_CHANCE + computeUpgradeBonuses(dm).relicFind
}

function tickCrew(crew: DelveCrew, dm: DMState, dtMs: number, rng: RngFn): { crew: DelveCrew; dm: DMState } {
  let c = crew
  let d = dm
  let remaining = dtMs
  let iterations = 0
  while (remaining > 0 && iterations < MAX_OFFLINE_DELVES_PER_CREW) {
    if (c.delveRemaining > remaining) {
      c = { ...c, delveRemaining: c.delveRemaining - remaining }
      break
    }
    remaining -= c.delveRemaining
    iterations++
    const depth = c.depth
    if (rng() < caveInChance(depth, d)) {
      c = { ...c, depth: 1, last: { kind: 'collapse', depth, gold: 0 } }
    } else {
      let gold = delveGold(depth, d)
      let relicId: string | undefined
      if (rng() < relicFindChance(d)) {
        const pool = RELICS.filter((r) => r.band === bandForDepth(depth))
        const found = pool[Math.floor(rng() * pool.length)]
        if (found && !d.discoveredRelicIds.includes(found.id)) {
          relicId = found.id
          d = { ...d, discoveredRelicIds: [...d.discoveredRelicIds, found.id] }
        } else gold += Math.round(gold * REPEAT_FIND_GOLD_FRACTION) // one they already have: sold on
      }
      d = { ...d, gold: d.gold + gold }
      c = {
        ...c,
        depth: Math.min(depth + 1, c.turnBackAt, MAX_DELVE_DEPTH),
        deepest: Math.max(c.deepest, depth),
        lifetimeGold: c.lifetimeGold + gold,
        last: { kind: relicId ? 'relic' : 'haul', depth, gold, relicId },
      }
    }
    c = { ...c, delveRemaining: delveDuration(c.depth, d) }
  }
  return { crew: c, dm: d }
}

export function tickCrews(crews: DelveCrew[], dm: DMState, dtMs: number, rng: RngFn): { crews: DelveCrew[]; dm: DMState } {
  if (!crews.length) return { crews, dm }
  let d = dm
  const next = crews.map((crew) => {
    try {
      const r = tickCrew(crew, d, dtMs, rng)
      d = r.dm
      return r.crew
    } catch (err) {
      console.error(`Crew "${crew.name}" (${crew.id}) failed to tick — leaving it paused this tick:`, err)
      return crew
    }
  })
  return { crews: next, dm: d }
}
