import type { RngFn } from './rng'
import { applyXp, toCombatUnit } from './characters'
import { runEncounter } from './combat/simulate'
import type { EncounterTemplate, EnemySpawn } from './combat/types'
import { getModuleById } from './data/modules'
import { DEFAULT_TROPHY_PARTS, getTrophyQuality } from './data/trophies'
import { getUpgradeById } from './data/upgrades'
import { dominantTrait } from './personality'
import type { DMState, Player, Table, Trophy } from './types'

export const BASE_COOLDOWN_MS = 5000
export const MIN_COOLDOWN_MS = 1000
export const BASE_TABLE_CAPACITY = 4
export const BASE_TABLE_SLOTS = 1
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000
const MAX_OFFLINE_ENCOUNTERS_PER_TABLE = 2000

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

export function effectiveTableCapacity(dm: DMState): number {
  return BASE_TABLE_CAPACITY + tableCapacityBonus(dm)
}

export function effectiveTableSlots(dm: DMState): number {
  return BASE_TABLE_SLOTS + tableSlotBonus(dm)
}

export function computeInfamyReward(lifetimeGold: number, partyCount: number, multipliers: Multipliers): number {
  const base = Math.floor(Math.sqrt(lifetimeGold / 10))
  const minFromParty = Math.max(1, partyCount)
  const amount = Math.max(base, minFromParty)
  return Math.max(1, Math.round(amount * multipliers.infamy))
}

function freshCooldown(multipliers: Multipliers): number {
  return Math.max(MIN_COOLDOWN_MS, Math.round(BASE_COOLDOWN_MS * multipliers.cooldown))
}

/**
 * Each time an execution module is actually WON, it comes back 40% deadlier
 * next time — never from merely attempting or losing. That keeps "just
 * don't fight it until you're ready" from being a viable way to dodge the
 * escalation: leaving it alone keeps it exactly as dangerous as it is now.
 */
const EXECUTION_GROWTH_RATE = 1.4
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
    attackPowerRampPerRound:
      spawn.attackPowerRampPerRound !== undefined ? Math.round(spawn.attackPowerRampPerRound * multiplier) : undefined,
  }
}

function scaleEncounterForTier(template: EncounterTemplate, tier: number): EncounterTemplate {
  const multiplier = EXECUTION_GROWTH_RATE ** tier
  if (multiplier === 1) return template
  return { ...template, enemies: template.enemies.map((spawn) => scaleEnemySpawn(spawn, multiplier)) }
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
  const executionTier = isExecution ? (dm.executionTier[moduleDef.id] ?? 0) : 0
  const encounterTemplate = isExecution
    ? scaleEncounterForTier(moduleDef.encounters[table.encounterIndex % moduleDef.encounters.length], executionTier)
    : moduleDef.encounters[table.encounterIndex % moduleDef.encounters.length]

  const partyUnits = seatedPlayers.map((p) => toCombatUnit(p.character!, dominantTrait(p.personality)))
  const result = runEncounter(partyUnits, encounterTemplate, rng)
  const multipliers = computeMultipliers(dm)
  const survivorCharIds = new Set(result.survivorIds)

  const updatedPlayers = seatedPlayers.map((p) => {
    if (!p.character) return p
    if (!survivorCharIds.has(p.character.id)) {
      return { ...p, character: null, tableId: null }
    }
    if (result.outcome === 'victory') {
      const xpGain = Math.round(result.xpReward * multipliers.xp)
      return { ...p, character: applyXp(p.character, xpGain) }
    }
    return p
  })

  const stillSeatedCount = updatedPlayers.filter((p) => p.tableId === table.id).length

  if (stillSeatedCount === 0) {
    const infamyGain = computeInfamyReward(table.lifetimeGold, seatedPlayers.length, multipliers)
    const nextDm: DMState = { ...dm, infamy: dm.infamy + infamyGain }
    const nextTable: Table = {
      ...table,
      assignedModuleId: null,
      encounterIndex: 0,
      cooldownRemaining: freshCooldown(multipliers),
      lifetimeGold: 0,
      lastBattleLog: result.log,
      lastBattleModuleName: moduleDef.name,
      lastBattleRewards: { outcome: result.outcome, xp: 0, gold: 0, infamy: infamyGain },
    }
    return { table: nextTable, players: updatedPlayers, dm: nextDm }
  }

  let nextDm = dm
  let nextEncounterIndex = table.encounterIndex
  let nextLifetimeGold = table.lifetimeGold
  let xpGain = 0
  let goldGain = 0
  let infamyBonus = 0

  if (result.outcome === 'victory') {
    xpGain = Math.round(result.xpReward * multipliers.xp)
    goldGain = Math.round(result.goldReward * multipliers.gold)
    nextDm = { ...dm, gold: dm.gold + goldGain }
    nextLifetimeGold += goldGain
    nextEncounterIndex = (table.encounterIndex + 1) % moduleDef.encounters.length

    if (isExecution) {
      const parts = moduleDef.trophyParts ?? DEFAULT_TROPHY_PARTS
      const trophy: Trophy = {
        id: generateTrophyId(),
        moduleId: moduleDef.id,
        part: parts[Math.floor(rng() * parts.length)],
        quality: getTrophyQuality(executionTier),
        tierDefeated: executionTier,
        earnedAt: Date.now(),
      }
      infamyBonus = TROPHY_BASE_INFAMY + executionTier * TROPHY_INFAMY_PER_TIER
      nextDm = {
        ...nextDm,
        infamy: nextDm.infamy + infamyBonus,
        executionTier: { ...nextDm.executionTier, [moduleDef.id]: executionTier + 1 },
        trophies: [...nextDm.trophies, trophy],
      }
    }
  }

  const nextTable: Table = {
    ...table,
    encounterIndex: nextEncounterIndex,
    lifetimeGold: nextLifetimeGold,
    cooldownRemaining: freshCooldown(multipliers),
    lastBattleLog: result.log,
    lastBattleModuleName: moduleDef.name,
    lastBattleRewards: { outcome: result.outcome, xp: xpGain, gold: goldGain, infamy: infamyBonus },
  }
  return { table: nextTable, players: updatedPlayers, dm: nextDm }
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

  while (remaining > 0 && t.assignedModuleId && iterations < MAX_OFFLINE_ENCOUNTERS_PER_TABLE) {
    if (t.cooldownRemaining > remaining) {
      t = { ...t, cooldownRemaining: t.cooldownRemaining - remaining }
      remaining = 0
      break
    }
    remaining -= t.cooldownRemaining

    const seated = allPlayers.filter((p) => p.tableId === t.id)
    const resolved = resolveEncounter(t, seated, d, rng)
    t = resolved.table
    d = resolved.dm
    const updatedById = new Map(resolved.players.map((p) => [p.id, p]))
    allPlayers = allPlayers.map((p) => updatedById.get(p.id) ?? p)
    iterations++
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
    const result = tickTable(table, allPlayers, d, dtMs, rng)
    d = result.dm
    allPlayers = result.players
    return result.table
  })
  return { tables: nextTables, players: allPlayers, dm: d }
}
