import type { RngFn } from './rng'
import { applyXp, type ArtifactBonuses, DEFAULT_ARTIFACT_BONUSES, toCombatUnit } from './characters'
import { runEncounter } from './combat/simulate'
import type { EncounterTemplate, EnemySpawn } from './combat/types'
import { getArtifactById } from './data/artifacts'
import { getIslandById } from './data/islands'
import { getModuleById, getNextUnlockedCampaignModule, getPreviousUnlockedCampaignModule } from './data/modules'
import { DEFAULT_TROPHY_PARTS, getTrophyQuality } from './data/trophies'
import { getUpgradeById } from './data/upgrades'
import { dominantTrait } from './personality'
import type { DMState, Island, Player, Ship, Table, Trophy, WipeRosterEntry } from './types'

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

export function offlineProgressDurationMs(costGold: number): number {
  return Math.floor(costGold / GOLD_PER_MS)
}

export interface Multipliers {
  gold: number
  xp: number
  cooldown: number
  infamy: number
}

export function computeMultipliers(dm: DMState): Multipliers {
  const m: Multipliers = { gold: 1, xp: 1, cooldown: 1, infamy: 1 }
  for (const id of dm.purchasedUpgradeIds) {
    const upgrade = getUpgradeById(id)
    if (!upgrade) continue
    switch (upgrade.effect.kind) {
      case 'goldMultiplier':
        m.gold *= upgrade.effect.value
        break
      case 'xpMultiplier':
        m.xp *= upgrade.effect.value
        break
      case 'cooldownMultiplier':
        m.cooldown *= upgrade.effect.value
        break
      case 'infamyMultiplier':
        m.infamy *= upgrade.effect.value
        break
    }
  }
  return m
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
      case 'tankExtraTurnAtStart':
        bonuses.tankExtraTurn = true
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
      case 'tankCleave':
        bonuses.tankBonusTargetsOnHit += artifact.effect.targets
        bonuses.tankBonusTargetDamagePercent += artifact.effect.damagePercent
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
// authored ones — compounding per tier — but the gold/XP a win pays out is
// still based on the authored stats (see EncounterTemplate.difficultyMultiplier),
// so climbing gets slower without getting any more lucrative. First-pass
// numbers: retune CAMPAIGN_HARDENING_PER_TIER if progression still feels too
// fast (or too walled) after playtesting.
export const CAMPAIGN_UNHARDENED_TIERS = 3
export const CAMPAIGN_HARDENING_PER_TIER = 1.25

export function campaignDifficultyMultiplier(tier: number): number {
  if (tier <= CAMPAIGN_UNHARDENED_TIERS) return 1
  return CAMPAIGN_HARDENING_PER_TIER ** (tier - CAMPAIGN_UNHARDENED_TIERS)
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
  const encounterTemplate = isExecution
    ? scaleEncounterForTier(moduleDef.encounters[table.encounterIndex % moduleDef.encounters.length], difficultyTier)
    : hardenCampaignEncounter(moduleDef.encounters[table.encounterIndex % moduleDef.encounters.length], moduleDef.tier)

  const artifactBonuses = computeArtifactBonuses(dm)
  const partyUnits = seatedPlayers.map((p) => toCombatUnit(p.character!, dominantTrait(p.personality), artifactBonuses))
  const result = runEncounter(partyUnits, encounterTemplate, rng)
  const multipliers = computeMultipliers(dm)
  const survivorCharIds = new Set(result.survivorIds)
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

  if (stillSeatedCount === 0) {
    const infamyGain = computeInfamyReward(table.lifetimeGold, seatedPlayers.length, multipliers)
    const nextDm: DMState = { ...dm, infamy: dm.infamy + infamyGain }
    const nextTable: Table = {
      ...table,
      assignedModuleId: null,
      encounterIndex: 0,
      cooldownRemaining: freshCooldown(multipliers, result.roundsElapsed),
      lifetimeGold: 0,
      lastBattleLog: result.log,
      lastBattleModuleName: moduleDef.name,
      lastBattleRewards: { outcome: result.outcome, xp: 0, gold: 0, infamy: infamyGain },
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
      const trophyInfamy = TROPHY_BASE_INFAMY + winCount * TROPHY_INFAMY_PER_TIER
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
    lastBattleRewards: { outcome: result.outcome, xp: xpGain, gold: goldGain, infamy: infamyBonus },
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

  const { outcome, infamy } = table.lastBattleRewards
  if (outcome === 'victory' && infamy === 0) {
    const next = getNextUnlockedCampaignModule(moduleDef.id, dm.unlockedModuleIds)
    if (next) return { assignedModuleId: next.id, encounterIndex: 0, cooldownRemaining: 500 }
  } else {
    const previous = getPreviousUnlockedCampaignModule(moduleDef.id, dm.unlockedModuleIds)
    if (previous) return { assignedModuleId: previous.id, encounterIndex: 0, cooldownRemaining: 500 }
  }
  return null
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

    const flawless = t.lastBattleRewards?.outcome === 'victory' && t.lastBattleRewards.infamy === 0
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
  const goldPerVoyage = Math.round(island.baseGoldReward * multipliers.gold)
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
    const goldGain = Math.round(island.baseGoldReward * multipliers.gold)
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
