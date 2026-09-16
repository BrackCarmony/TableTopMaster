import { describe, expect, it } from 'vitest'
import { planTurn } from './ai'
import type { CombatUnit } from './types'

function makeUnit(overrides: Partial<CombatUnit>): CombatUnit {
  return {
    id: 'unit',
    name: 'Unit',
    side: 'party',
    role: 'dps',
    level: 1,
    position: { x: 0, y: 0 },
    hp: 20,
    maxHp: 20,
    attackPower: 5,
    defense: 0,
    healPower: 0,
    moveRange: 3,
    attackRange: 1,
    speed: 5,
    alive: true,
    flavor: null,
    ...overrides,
  }
}

describe('planTurn', () => {
  it('has a healer heal a wounded ally in range instead of attacking', () => {
    const healer = makeUnit({ id: 'healer', name: 'Healer', role: 'healer', position: { x: 0, y: 0 }, attackRange: 2, healPower: 8 })
    const woundedTank = makeUnit({ id: 'tank', name: 'Tank', role: 'tank', position: { x: 1, y: 0 }, hp: 5, maxHp: 30 })
    const enemy = makeUnit({ id: 'enemy', name: 'Enemy', side: 'enemy', position: { x: 1, y: 1 } })

    const action = planTurn(healer, [healer, woundedTank, enemy], 8, 8)
    expect(action.kind).toBe('heal')
    if (action.kind === 'heal') expect(action.targetId).toBe('tank')
  })

  it('has a healer attack when no ally needs healing', () => {
    const healer = makeUnit({ id: 'healer', name: 'Healer', role: 'healer', position: { x: 0, y: 0 }, attackRange: 2, healPower: 8 })
    const healthyTank = makeUnit({ id: 'tank', name: 'Tank', role: 'tank', position: { x: 1, y: 0 } })
    const enemy = makeUnit({ id: 'enemy', name: 'Enemy', side: 'enemy', position: { x: 0, y: 1 } })

    const action = planTurn(healer, [healer, healthyTank, enemy], 8, 8)
    expect(action.kind).toBe('attack')
    if (action.kind === 'attack') expect(action.targetId).toBe('enemy')
  })

  it('ignores a wounded ally outside heal range and attacks the enemy path instead', () => {
    const healer = makeUnit({ id: 'healer', name: 'Healer', role: 'healer', position: { x: 0, y: 0 }, attackRange: 1, moveRange: 0 })
    const distantWoundedAlly = makeUnit({ id: 'ally', name: 'Ally', position: { x: 6, y: 6 }, hp: 2, maxHp: 20 })
    const enemy = makeUnit({ id: 'enemy', name: 'Enemy', side: 'enemy', position: { x: 6, y: 6 } })

    const action = planTurn(healer, [healer, distantWoundedAlly, enemy], 8, 8)
    expect(action.kind).not.toBe('heal')
  })

  it('moves toward the nearest enemy when out of attack range', () => {
    const attacker = makeUnit({ id: 'a', name: 'A', position: { x: 0, y: 0 }, attackRange: 1, moveRange: 3 })
    const enemy = makeUnit({ id: 'e', name: 'E', side: 'enemy', position: { x: 5, y: 0 } })

    const action = planTurn(attacker, [attacker, enemy], 8, 8)
    expect(action.kind).toBe('move')
    if (action.kind === 'move') expect(action.targetId).toBe('e')
  })

  it('holds position instead of advancing when under-leveled next to its allies', () => {
    const rookie = makeUnit({ id: 'rookie', name: 'Rookie', level: 1, position: { x: 0, y: 0 }, attackRange: 1, moveRange: 3 })
    const veteran = makeUnit({ id: 'veteran', name: 'Veteran', level: 40, position: { x: 0, y: 1 } })
    const enemy = makeUnit({ id: 'e', name: 'E', side: 'enemy', position: { x: 5, y: 0 } })

    const action = planTurn(rookie, [rookie, veteran, enemy], 8, 8)
    expect(action.kind).toBe('idle')
  })

  it('still attacks when an under-leveled unit already has a target in range without moving', () => {
    const rookie = makeUnit({ id: 'rookie', name: 'Rookie', level: 1, position: { x: 0, y: 0 }, attackRange: 1, moveRange: 3 })
    const veteran = makeUnit({ id: 'veteran', name: 'Veteran', level: 40, position: { x: 0, y: 1 } })
    const enemy = makeUnit({ id: 'e', name: 'E', side: 'enemy', position: { x: 1, y: 0 } })

    const action = planTurn(rookie, [rookie, veteran, enemy], 8, 8)
    expect(action.kind).toBe('attack')
  })

  it('advances normally when everyone in the party is the same level', () => {
    const a = makeUnit({ id: 'a', name: 'A', level: 5, position: { x: 0, y: 0 }, attackRange: 1, moveRange: 3 })
    const b = makeUnit({ id: 'b', name: 'B', level: 5, position: { x: 0, y: 1 } })
    const enemy = makeUnit({ id: 'e', name: 'E', side: 'enemy', position: { x: 5, y: 0 } })

    const action = planTurn(a, [a, b, enemy], 8, 8)
    expect(action.kind).toBe('move')
  })

  it('still advances when only a small gap separates it from a couple of higher-level allies', () => {
    // Regression case: 5 dps at level 1450 next to a tank and healer at 1560
    // each — the old average-based rule flagged every 1450 as "the weak
    // link" (1450 < ~1487 average) even though the gap is under 3%.
    const dps = makeUnit({ id: 'dps', name: 'DPS', level: 1450, position: { x: 0, y: 0 }, attackRange: 1, moveRange: 3 })
    const dps2 = makeUnit({ id: 'dps2', name: 'DPS2', level: 1450, position: { x: 0, y: 1 } })
    const dps3 = makeUnit({ id: 'dps3', name: 'DPS3', level: 1450, position: { x: 0, y: 2 } })
    const dps4 = makeUnit({ id: 'dps4', name: 'DPS4', level: 1450, position: { x: 0, y: 3 } })
    const tank = makeUnit({ id: 'tank', name: 'Tank', role: 'tank', level: 1560, position: { x: 0, y: 4 } })
    const healer = makeUnit({ id: 'healer', name: 'Healer', role: 'healer', level: 1560, position: { x: 0, y: 5 } })
    const enemy = makeUnit({ id: 'e', name: 'E', side: 'enemy', position: { x: 5, y: 0 } })

    const action = planTurn(dps, [dps, dps2, dps3, dps4, tank, healer, enemy], 10, 10)
    expect(action.kind).toBe('move')
  })
})
