import type { RngFn } from './rng'
import { applyXp, toCombatUnit } from './characters'
import { runEncounter } from './combat/simulate'
import { getModuleById } from './data/modules'
import { getUpgradeById } from './data/upgrades'
import type { DMState, Table } from './types'

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

export function effectiveTableCapacity(dm: DMState): number {
  return BASE_TABLE_CAPACITY + tableCapacityBonus(dm)
}

export function effectiveTableSlots(dm: DMState): number {
  return BASE_TABLE_SLOTS + tableSlotBonus(dm)
}

export function computeInfamyReward(table: Table, multipliers: Multipliers): number {
  const base = Math.floor(Math.sqrt(table.lifetimeGold / 10))
  const minFromParty = Math.max(1, table.players.length)
  const amount = Math.max(base, minFromParty)
  return Math.max(1, Math.round(amount * multipliers.infamy))
}

function freshCooldown(multipliers: Multipliers): number {
  return Math.max(MIN_COOLDOWN_MS, Math.round(BASE_COOLDOWN_MS * multipliers.cooldown))
}

/**
 * Resolves the table's currently-assigned encounter exactly once. Any
 * character not among the survivors is permanently removed. If that leaves
 * the table empty, it's a full-party wipe: Infamy is granted and the table
 * resets — whether that wipe came from an execution module or bad luck on a
 * winnable one.
 */
export function resolveEncounter(table: Table, dm: DMState, rng: RngFn): { table: Table; dm: DMState } {
  const moduleDef = table.assignedModuleId ? getModuleById(table.assignedModuleId) : undefined
  if (!moduleDef) return { table, dm }

  const encounterTemplate = moduleDef.encounters[table.encounterIndex % moduleDef.encounters.length]
  const partyUnits = table.players.map((p) => toCombatUnit(p.character))
  const result = runEncounter(partyUnits, encounterTemplate, rng)
  const multipliers = computeMultipliers(dm)

  const survivors = table.players.filter((p) => result.survivorIds.includes(p.character.id))

  if (survivors.length === 0) {
    const infamyGain = computeInfamyReward(table, multipliers)
    const nextDm: DMState = { ...dm, infamy: dm.infamy + infamyGain }
    const nextTable: Table = {
      ...table,
      players: [],
      assignedModuleId: null,
      encounterIndex: 0,
      cooldownRemaining: freshCooldown(multipliers),
      lifetimeGold: 0,
      lastBattleLog: result.log,
      lastBattleModuleName: moduleDef.name,
    }
    return { table: nextTable, dm: nextDm }
  }

  let nextDm = dm
  let nextPlayers = survivors
  let nextEncounterIndex = table.encounterIndex
  let nextLifetimeGold = table.lifetimeGold

  if (result.outcome === 'victory') {
    const goldGain = Math.round(result.goldReward * multipliers.gold)
    const xpGain = Math.round(result.xpReward * multipliers.xp)
    nextDm = { ...dm, gold: dm.gold + goldGain }
    nextLifetimeGold += goldGain
    nextPlayers = survivors.map((p) => ({ ...p, character: applyXp(p.character, xpGain) }))
    nextEncounterIndex = (table.encounterIndex + 1) % moduleDef.encounters.length
  }

  const nextTable: Table = {
    ...table,
    players: nextPlayers,
    encounterIndex: nextEncounterIndex,
    lifetimeGold: nextLifetimeGold,
    cooldownRemaining: freshCooldown(multipliers),
    lastBattleLog: result.log,
    lastBattleModuleName: moduleDef.name,
  }
  return { table: nextTable, dm: nextDm }
}

/**
 * Advances a single table by `dtMs` of wall-clock time, resolving as many
 * encounters as fit (used for both live ticks and offline catch-up).
 */
export function tickTable(table: Table, dm: DMState, dtMs: number, rng: RngFn): { table: Table; dm: DMState } {
  let t = table
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
    const resolved = resolveEncounter(t, d, rng)
    t = resolved.table
    d = resolved.dm
    iterations++
  }

  return { table: t, dm: d }
}

export function tickTables(tables: Table[], dm: DMState, dtMs: number, rng: RngFn): { tables: Table[]; dm: DMState } {
  let d = dm
  const nextTables = tables.map((table) => {
    const result = tickTable(table, d, dtMs, rng)
    d = result.dm
    return result.table
  })
  return { tables: nextTables, dm: d }
}
