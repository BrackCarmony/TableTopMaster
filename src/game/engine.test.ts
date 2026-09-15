import { describe, expect, it } from 'vitest'
import { createCharacterForPlayer, createPlayer } from './characters'
import type { CombatLogEvent } from './combat/types'
import { computeInfamyReward, resolveEncounter } from './engine'
import { createRng } from './rng'
import type { DMState, Player, Table } from './types'

describe('computeInfamyReward', () => {
  it('scales with the square root of lifetime gold', () => {
    const amount = computeInfamyReward(1000, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBe(Math.floor(Math.sqrt(100)))
  })

  it('grants at least 1 infamy per character even with low lifetime gold', () => {
    const amount = computeInfamyReward(0, 2, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBe(2)
  })

  it('applies the infamy multiplier and rounds', () => {
    const base = computeInfamyReward(1000, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    const boosted = computeInfamyReward(1000, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1.25 })
    expect(boosted).toBe(Math.max(1, Math.round(base * 1.25)))
  })

  it('never returns less than 1', () => {
    const amount = computeInfamyReward(0, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBeGreaterThanOrEqual(1)
  })
})

function makeDm(overrides: Partial<DMState> = {}): DMState {
  return {
    name: 'DM',
    level: 1,
    gold: 0,
    infamy: 0,
    unlockedModuleIds: ['tarrasque-execution'],
    purchasedUpgradeIds: [],
    tableSlots: 1,
    executionAttempts: {},
    ...overrides,
  }
}

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: 't1',
    name: 'Table 1',
    assignedModuleId: 'tarrasque-execution',
    encounterIndex: 0,
    cooldownRemaining: 0,
    lifetimeGold: 0,
    lastBattleLog: null,
    lastBattleModuleName: null,
    ...overrides,
  }
}

function makeSeatedPlayer(tableId: string, rng: ReturnType<typeof createRng>): Player {
  const player = createPlayer(rng)
  return { ...player, tableId, character: createCharacterForPlayer(player, rng) }
}

function enemyMaxHpFromLog(log: CombatLogEvent[] | null): number {
  const start = log?.find((e) => e.type === 'encounter_start')
  if (!start || start.type !== 'encounter_start') throw new Error('no encounter_start in log')
  const enemy = start.units.find((u) => u.side === 'enemy')
  if (!enemy) throw new Error('no enemy in log')
  return enemy.maxHp
}

describe('resolveEncounter execution-module scaling', () => {
  it('increments the per-module attempt counter every time it resolves', () => {
    const rng = createRng(1)
    const table = makeTable()
    const seated = makeSeatedPlayer(table.id, rng)
    const result = resolveEncounter(table, [seated], makeDm(), rng)
    expect(result.dm.executionAttempts['tarrasque-execution']).toBe(1)

    // The party was wiped (it's the Tarrasque), so a second attempt means
    // re-preparing the table the same way executeModuleNow does — the
    // assignment itself is what resets on a wipe, not the module lookup.
    const reprepared = { ...result.table, assignedModuleId: 'tarrasque-execution' }
    const again = resolveEncounter(reprepared, [seated], result.dm, rng)
    expect(again.dm.executionAttempts['tarrasque-execution']).toBe(2)
  })

  it('makes the enemy tougher on a later attempt than on the first', () => {
    const table = makeTable()
    const seated = makeSeatedPlayer(table.id, createRng(5))

    const fresh = resolveEncounter(table, [seated], makeDm(), createRng(6))
    const veteran = resolveEncounter(
      table,
      [seated],
      makeDm({ executionAttempts: { 'tarrasque-execution': 5 } }),
      createRng(6),
    )

    expect(enemyMaxHpFromLog(veteran.table.lastBattleLog)).toBeGreaterThan(enemyMaxHpFromLog(fresh.table.lastBattleLog))
  })

  it('does not scale campaign modules', () => {
    const table = makeTable({ assignedModuleId: 'goblin-ambush' })
    const seated = makeSeatedPlayer(table.id, createRng(7))
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })
    const result = resolveEncounter(table, [seated], dm, createRng(8))
    expect(result.dm.executionAttempts).toEqual({})
  })
})
