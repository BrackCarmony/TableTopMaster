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
})
