import { describe, expect, it } from 'vitest'
import { livingOccupiedTiles, occupiedTiles } from './grid'
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

describe('occupiedTiles', () => {
  it('still counts a dead unit’s tile as occupied, so movers cannot step onto (and visually hide) a corpse', () => {
    const corpse = makeUnit({ id: 'fallen', position: { x: 2, y: 2 }, alive: false })
    const mover = makeUnit({ id: 'mover', position: { x: 0, y: 0 } })
    const occupied = occupiedTiles([corpse, mover], 'mover')
    expect(occupied.has('2,2')).toBe(true)
  })

  it('excludes the given unit itself', () => {
    const mover = makeUnit({ id: 'mover', position: { x: 3, y: 3 } })
    const occupied = occupiedTiles([mover], 'mover')
    expect(occupied.has('3,3')).toBe(false)
  })
})

describe('livingOccupiedTiles', () => {
  it('excludes dead units — corpses cannot permanently wall off a tile', () => {
    const corpse = makeUnit({ id: 'fallen', position: { x: 2, y: 2 }, alive: false })
    const mover = makeUnit({ id: 'mover', position: { x: 0, y: 0 } })
    const blocked = livingOccupiedTiles([corpse, mover], 'mover')
    expect(blocked.has('2,2')).toBe(false)
  })

  it('still blocks a living unit’s tile', () => {
    const living = makeUnit({ id: 'living', position: { x: 4, y: 4 } })
    const mover = makeUnit({ id: 'mover', position: { x: 0, y: 0 } })
    const blocked = livingOccupiedTiles([living, mover], 'mover')
    expect(blocked.has('4,4')).toBe(true)
  })
})
