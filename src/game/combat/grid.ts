import type { CombatUnit, GridCoord } from './types'

export function manhattanDistance(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function inRange(a: GridCoord, b: GridCoord, range: number): boolean {
  return manhattanDistance(a, b) <= range
}

export function coordKey(c: GridCoord): string {
  return `${c.x},${c.y}`
}

export function isInBounds(c: GridCoord, width: number, height: number): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < width && c.y < height
}

/**
 * Tiles no unit should land on — including dead units' tiles. Corpses stay
 * put as no-land markers; otherwise a mover can step exactly onto a fallen
 * unit's cell and silently hide it behind their own token in the grid view
 * (the board only renders one unit per cell). Pass to `findPathToward`'s
 * `noLand` param, not its `blocked` param — a corpse should stop a unit from
 * stopping there, not wall off everything past it (see `livingOccupiedTiles`).
 */
export function occupiedTiles(units: CombatUnit[], excludeId?: string): Set<string> {
  const set = new Set<string>()
  for (const u of units) {
    if (u.id === excludeId) continue
    set.add(coordKey(u.position))
  }
  return set
}

/**
 * Tiles that actually block movement — only living units. Used as
 * `findPathToward`'s `blocked` param so a pile of corpses (which can never
 * move once they fall) doesn't permanently wall off part of the grid and
 * strand everyone in an unresolvable stalemate.
 */
export function livingOccupiedTiles(units: CombatUnit[], excludeId?: string): Set<string> {
  const set = new Set<string>()
  for (const u of units) {
    if (u.id === excludeId || !u.alive) continue
    set.add(coordKey(u.position))
  }
  return set
}

export function nearestLivingEnemy(unit: CombatUnit, units: CombatUnit[]): CombatUnit | null {
  let best: CombatUnit | null = null
  let bestDist = Infinity
  for (const other of units) {
    if (!other.alive || other.side === unit.side) continue
    const d = manhattanDistance(unit.position, other.position)
    if (d < bestDist) {
      bestDist = d
      best = other
    }
  }
  return best
}

/** How far (Manhattan tiles) a party tank's taunt reaches: any enemy within this of a living tank is pulled onto it. 10 covers the whole battlefield on the largest grids — at 6, enemies still reached the dps and healer before closing to taunt range. */
export const TAUNT_RANGE = 3

/**
 * Who a unit decides to go after. Enemies are taunted: if any living party
 * tank is within TAUNT_RANGE, they go for the nearest such tank instead of
 * whoever happens to be closest overall — otherwise they walk past the tank
 * and tear into the dps and healer, whose defense doesn't scale with level,
 * leaving the tank (and so the healer's job) pointless. Everyone else, and
 * enemies with no tank in reach, use plain nearest-target selection.
 */
export function chooseTarget(unit: CombatUnit, units: CombatUnit[]): CombatUnit | null {
  if (unit.side === 'enemy') {
    let taunter: CombatUnit | null = null
    let taunterDist = Infinity
    for (const other of units) {
      if (!other.alive || other.side === unit.side || other.role !== 'tank') continue
      const d = manhattanDistance(unit.position, other.position)
      if (d <= (other.tauntRange ?? TAUNT_RANGE) && d < taunterDist) {
        taunterDist = d
        taunter = other
      }
    }
    if (taunter) return taunter
  }
  return nearestLivingEnemy(unit, units)
}

export function mostWoundedAllyInRange(unit: CombatUnit, units: CombatUnit[], range: number, threshold = 0.7): CombatUnit | null {
  let best: CombatUnit | null = null
  let bestRatio = threshold
  for (const other of units) {
    if (!other.alive || other.side !== unit.side) continue
    const ratio = other.hp / other.maxHp
    if (ratio >= threshold) continue
    if (!inRange(unit.position, other.position, range)) continue
    if (ratio < bestRatio || best === null) {
      bestRatio = ratio
      best = other
    }
  }
  return best
}
