import { describe, expect, it } from 'vitest'
import { chooseTarget, livingOccupiedTiles, occupiedTiles, TAUNT_RANGE } from './grid'
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

describe('chooseTarget (taunt)', () => {
  const enemy = (overrides: Partial<CombatUnit> = {}) => makeUnit({ id: 'e', side: 'enemy', position: { x: 8, y: 0 }, ...overrides })

  it('sends an enemy after a tank within taunt range instead of a nearer squishy ally', () => {
    const tank = makeUnit({ id: 'tank', role: 'tank', position: { x: 5, y: 0 } })
    const dps = makeUnit({ id: 'dps', role: 'dps', position: { x: 7, y: 0 } }) // nearer than the tank
    expect(chooseTarget(enemy(), [enemy(), tank, dps])?.id).toBe('tank')
  })

  it("uses each tank's own taunt range, so a wider-reaching tank pulls enemies a plain one cannot", () => {
    const plain = makeUnit({ id: 'plain', role: 'tank', position: { x: 8 - TAUNT_RANGE - 2, y: 0 } })
    const wide = makeUnit({ id: 'wide', role: 'tank', tauntRange: TAUNT_RANGE + 4, position: { x: 8 - TAUNT_RANGE - 3, y: 0 } })
    const dps = makeUnit({ id: 'dps', role: 'dps', position: { x: 7, y: 1 } }) // nearer than either tank
    expect(chooseTarget(enemy(), [enemy(), plain, dps])?.id).toBe('dps')
    expect(chooseTarget(enemy(), [enemy(), plain, wide, dps])?.id).toBe('wide')
  })

  it('picks the nearest tank when several are in range', () => {
    const near = makeUnit({ id: 'near', role: 'tank', position: { x: 6, y: 0 } })
    const far = makeUnit({ id: 'far', role: 'tank', position: { x: 4, y: 0 } })
    expect(chooseTarget(enemy(), [enemy(), far, near])?.id).toBe('near')
  })

  it('ignores a tank beyond taunt range and falls back to the nearest unit', () => {
    const tank = makeUnit({ id: 'tank', role: 'tank', position: { x: 8 - TAUNT_RANGE - 1, y: 0 } })
    const dps = makeUnit({ id: 'dps', role: 'dps', position: { x: 7, y: 1 } }) // nearer than the out-of-range tank
    expect(chooseTarget(enemy(), [enemy(), tank, dps])?.id).toBe('dps')
  })

  it('ignores a dead tank', () => {
    const tank = makeUnit({ id: 'tank', role: 'tank', position: { x: 6, y: 0 }, alive: false })
    const dps = makeUnit({ id: 'dps', role: 'dps', position: { x: 7, y: 3 } })
    expect(chooseTarget(enemy(), [enemy(), tank, dps])?.id).toBe('dps')
  })

  it('does not taunt party units: they still just go for the nearest enemy', () => {
    const hero = makeUnit({ id: 'hero', side: 'party', position: { x: 0, y: 0 } })
    const enemyTank = enemy({ id: 'etank', role: 'tank', position: { x: 5, y: 0 } })
    const enemyDps = enemy({ id: 'edps', role: 'dps', position: { x: 2, y: 0 } })
    expect(chooseTarget(hero, [hero, enemyTank, enemyDps])?.id).toBe('edps')
  })
})
