import type { CombatUnit, GridCoord } from './types'
import { inRange, mostWoundedAllyInRange, nearestLivingEnemy, occupiedTiles } from './grid'
import { findPathToward } from './pathfinding'

export type TurnAction =
  | { kind: 'idle' }
  | { kind: 'heal'; targetId: string }
  | { kind: 'attack'; targetId: string }
  | { kind: 'move'; path: GridCoord[]; targetId: string }

/**
 * Decides what a unit does on its turn. Healers prioritize topping off a
 * wounded ally within range; everyone else (and healers with nothing to
 * heal) chases the nearest living enemy and attacks once in range,
 * pathfinding toward them otherwise.
 */
export function planTurn(unit: CombatUnit, units: CombatUnit[], gridWidth: number, gridHeight: number): TurnAction {
  if (unit.role === 'healer') {
    const healTarget = mostWoundedAllyInRange(unit, units, unit.attackRange)
    if (healTarget) {
      return { kind: 'heal', targetId: healTarget.id }
    }
  }

  const target = nearestLivingEnemy(unit, units)
  if (!target) return { kind: 'idle' }

  if (inRange(unit.position, target.position, unit.attackRange)) {
    return { kind: 'attack', targetId: target.id }
  }

  const occupied = occupiedTiles(units, unit.id)
  const path = findPathToward(unit.position, target.position, unit.moveRange, gridWidth, gridHeight, occupied)
  if (path.length === 0) return { kind: 'idle' }
  return { kind: 'move', path, targetId: target.id }
}
