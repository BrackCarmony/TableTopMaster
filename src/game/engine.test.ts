import { describe, expect, it } from 'vitest'
import { computeInfamyReward } from './engine'
import type { Table } from './types'

function makeTable(overrides: Partial<Table>): Table {
  return {
    id: 't1',
    name: 'Table 1',
    capacity: 0,
    players: [],
    assignedModuleId: null,
    encounterIndex: 0,
    cooldownRemaining: 0,
    lifetimeGold: 0,
    lastBattleLog: null,
    lastBattleModuleName: null,
    ...overrides,
  }
}

describe('computeInfamyReward', () => {
  it('scales with the square root of lifetime gold', () => {
    const table = makeTable({ lifetimeGold: 1000, players: [] })
    const amount = computeInfamyReward(table, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBe(Math.floor(Math.sqrt(100)))
  })

  it('grants at least 1 infamy per character even with low lifetime gold', () => {
    const table = makeTable({
      lifetimeGold: 0,
      players: [{ id: 'p1', name: 'A', recruitedAt: 0, character: {} as never }, { id: 'p2', name: 'B', recruitedAt: 0, character: {} as never }],
    })
    const amount = computeInfamyReward(table, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBe(2)
  })

  it('applies the infamy multiplier and rounds', () => {
    const table = makeTable({ lifetimeGold: 1000, players: [] })
    const base = computeInfamyReward(table, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    const boosted = computeInfamyReward(table, { gold: 1, xp: 1, cooldown: 1, infamy: 1.25 })
    expect(boosted).toBe(Math.max(1, Math.round(base * 1.25)))
  })

  it('never returns less than 1', () => {
    const table = makeTable({ lifetimeGold: 0, players: [] })
    const amount = computeInfamyReward(table, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBeGreaterThanOrEqual(1)
  })
})
