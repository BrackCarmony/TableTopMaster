import type { CombatUnit, GridCoord } from './types'
import { inRange, mostWoundedAllyInRange, nearestLivingEnemy, occupiedTiles } from './grid'
import { findPathToward } from './pathfinding'

export type TurnAction =
  | { kind: 'idle' }
  | { kind: 'heal'; targetId: string }
  | { kind: 'attack'; targetId: string }
  | { kind: 'move'; path: GridCoord[]; targetId: string }

// A unit must be below HALF its strongest living ally's level to count as
// "the weak link" — a fresh level-1 rookie next to a level-60 veteran
// should hold back, but two characters a tier or two apart (say level 1450
// vs. 1560) are both plenty combat-ready and shouldn't trigger this at all.
const UNDERLEVELED_THRESHOLD = 0.5

/** True if this unit is dramatically behind its own living allies' best — the weak link who should hold position instead of wading in. */
function isUnderleveled(unit: CombatUnit, units: CombatUnit[]): boolean {
  const allies = units.filter((u) => u.alive && u.side === unit.side && u.id !== unit.id)
  if (allies.length === 0) return false
  const maxAllyLevel = Math.max(...allies.map((u) => u.level))
  return unit.level < maxAllyLevel * UNDERLEVELED_THRESHOLD
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
