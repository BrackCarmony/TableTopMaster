import type { CombatUnit, GridCoord } from './types'
import { inRange, mostWoundedAllyInRange, nearestLivingEnemy, occupiedTiles } from './grid'
import { findPathToward } from './pathfinding'

export type TurnAction =
  | { kind: 'idle' }
  | { kind: 'heal'; targetId: string }
  | { kind: 'attack'; targetId: string }
  | { kind: 'move'; path: GridCoord[]; targetId: string }

/** True if this unit is under-leveled compared to its own living allies — the weak link who should hold position instead of wading in. */
function isUnderleveled(unit: CombatUnit, units: CombatUnit[]): boolean {
  const allies = units.filter((u) => u.alive && u.side === unit.side && u.id !== unit.id)
  if (allies.length === 0) return false
  const avgAllyLevel = allies.reduce((sum, u) => sum + u.level, 0) / allies.length
  return unit.level < avgAllyLevel
}

/**
 * Decides what a unit does on its turn. Healers prioritize topping off a
 * wounded ally within range; everyone else (and healers with nothing to
 * heal) chases the nearest living enemy and attacks once in range,
 * pathfinding toward them otherwise — unless they're under-leveled next to
 * their allies, in which case they hold their ground rather than advance
 * into a fight the rest of the party is better suited for. They'll still
 * fight back if an enemy is already in range without moving.
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

  if (isUnderleveled(unit, units)) return { kind: 'idle' }

  const occupied = occupiedTiles(units, unit.id)
  const path = findPathToward(unit.position, target.position, unit.moveRange, gridWidth, gridHeight, occupied)
  if (path.length === 0) return { kind: 'idle' }
  return { kind: 'move', path, targetId: target.id }
}
