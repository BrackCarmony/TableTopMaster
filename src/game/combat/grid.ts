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
 * Tiles no unit should path onto — including dead units' tiles. Corpses stay
 * put as obstacles; otherwise a mover can step exactly onto a fallen unit's
 * cell and silently hide it behind their own token in the grid view (the
 * board only renders one unit per cell).
 */
export function occupiedTiles(units: CombatUnit[], excludeId?: string): Set<string> {
  const set = new Set<string>()
  for (const u of units) {
    if (u.id === excludeId) continue
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
