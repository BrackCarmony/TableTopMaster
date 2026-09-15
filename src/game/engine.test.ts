import { describe, expect, it } from 'vitest'
import { createCharacterForPlayer, createPlayer } from './characters'
import type { CombatLogEvent } from './combat/types'
import { computeInfamyReward, resolveEncounter } from './engine'
import { createRng } from './rng'
import type { Character, DMState, Player, Table } from './types'

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
    executionTier: {},
    trophies: [],
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

/** A character strong enough to one-shot the Tarrasque at any realistic tier, so victory tests are deterministic. */
function makeUnstoppableSeatedPlayer(tableId: string, rng: ReturnType<typeof createRng>): Player {
  const player = createPlayer(rng)
  const character: Character = {
    id: 'unstoppable-char',
    name: player.name,
    race: 'Human',
    className: 'Godslayer',
    role: 'dps',
    level: 99,
    xp: 0,
    maxHp: 999_999,
    attackPower: 999_999,
    defense: 999_999,
    healPower: 0,
    moveRange: 5,
    attackRange: 5,
    speed: 99,
  }
  return { ...player, tableId, character }
}

function enemyMaxHpFromLog(log: CombatLogEvent[] | null): number {
  const start = log?.find((e) => e.type === 'encounter_start')
  if (!start || start.type !== 'encounter_start') throw new Error('no encounter_start in log')
  const enemy = start.units.find((u) => u.side === 'enemy')
  if (!enemy) throw new Error('no enemy in log')
  return enemy.maxHp
}

describe('resolveEncounter execution-module tier scaling', () => {
  it('does NOT raise the tier or grant a trophy when the party loses', () => {
    const rng = createRng(1)
    const table = makeTable()
    const seated = makeSeatedPlayer(table.id, rng)
    const result = resolveEncounter(table, [seated], makeDm(), rng)

    const start = result.table.lastBattleLog?.find((e) => e.type === 'encounter_end')
    expect(start && start.type === 'encounter_end' && start.outcome).toBe('defeat')
    expect(result.dm.executionTier['tarrasque-execution'] ?? 0).toBe(0)
    expect(result.dm.trophies).toHaveLength(0)
  })

  it('losing repeatedly never escalates it — only a win does', () => {
    const rng = createRng(1)
    const table = makeTable()
    let dm = makeDm()
    for (let i = 0; i < 3; i++) {
      const seated = makeSeatedPlayer(table.id, rng)
      const result = resolveEncounter({ ...table, assignedModuleId: 'tarrasque-execution' }, [seated], dm, rng)
      dm = result.dm
    }
    expect(dm.executionTier['tarrasque-execution'] ?? 0).toBe(0)
  })

  it('raises the tier and grants a trophy + Infamy bonus on a win', () => {
    const table = makeTable()
    const unstoppable = makeUnstoppableSeatedPlayer(table.id, createRng(2))
    const dm = makeDm({ infamy: 100 })
    const result = resolveEncounter(table, [unstoppable], dm, createRng(3))

    const end = result.table.lastBattleLog?.find((e) => e.type === 'encounter_end')
    expect(end && end.type === 'encounter_end' && end.outcome).toBe('victory')
    expect(result.dm.executionTier['tarrasque-execution']).toBe(1)
    expect(result.dm.trophies).toHaveLength(1)
    expect(result.dm.trophies[0].moduleId).toBe('tarrasque-execution')
    expect(result.dm.trophies[0].tierDefeated).toBe(0)
    expect(result.dm.infamy).toBeGreaterThan(dm.infamy)
  })

  it('scales the next fight up based on the tier just won, not merely attempted', () => {
    const table = makeTable()
    const unstoppable = makeUnstoppableSeatedPlayer(table.id, createRng(4))

    const freshResult = resolveEncounter(table, [unstoppable], makeDm(), createRng(5))
    const freshEnemyHp = enemyMaxHpFromLog(freshResult.table.lastBattleLog)

    const rematch = resolveEncounter(
      { ...freshResult.table, assignedModuleId: 'tarrasque-execution' },
      [unstoppable],
      freshResult.dm,
      createRng(6),
    )
    expect(enemyMaxHpFromLog(rematch.table.lastBattleLog)).toBeGreaterThan(freshEnemyHp)
  })

  it('does not scale, tier-track, or grant trophies for campaign modules', () => {
    const table = makeTable({ assignedModuleId: 'goblin-ambush' })
    const seated = makeSeatedPlayer(table.id, createRng(7))
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })
    const result = resolveEncounter(table, [seated], dm, createRng(8))
    expect(result.dm.executionTier).toEqual({})
    expect(result.dm.trophies).toEqual([])
  })
})
