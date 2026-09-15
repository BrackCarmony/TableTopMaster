import type { GridCoord } from './types'
import { coordKey, isInBounds, manhattanDistance } from './grid'

const DIRECTIONS: GridCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

/**
 * BFS out from `start` up to `moveRange` steps, avoiding `occupied` tiles.
 * Among reachable tiles, picks the one that gets closest to `target` and
 * returns the step-by-step path to it (excluding the starting tile).
 * Returns an empty array if no movement improves position (already best tile).
 */
interface VisitedEntry {
  coord: GridCoord
  dist: number
  prev: string | null
}

export function findPathToward(
  start: GridCoord,
  target: GridCoord,
  moveRange: number,
  gridWidth: number,
  gridHeight: number,
  occupied: Set<string>,
): GridCoord[] {
  const visited = new Map<string, VisitedEntry>()
  const startKey = coordKey(start)
  visited.set(startKey, { coord: start, dist: 0, prev: null })

  const queue: GridCoord[] = [start]
  let head = 0
  while (head < queue.length) {
    const current = queue[head++]
    const currentEntry = visited.get(coordKey(current))!
    if (currentEntry.dist >= moveRange) continue

    for (const dir of DIRECTIONS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y }
      if (!isInBounds(next, gridWidth, gridHeight)) continue
      const key = coordKey(next)
      if (visited.has(key)) continue
      if (occupied.has(key)) continue
      visited.set(key, { coord: next, dist: currentEntry.dist + 1, prev: coordKey(current) })
      queue.push(next)
    }
  }

  let bestKey = startKey
  let bestDistToTarget = manhattanDistance(start, target)
  for (const [key, entry] of visited) {
    const distToTarget = manhattanDistance(entry.coord, target)
    if (distToTarget < bestDistToTarget) {
      bestDistToTarget = distToTarget
      bestKey = key
    }
  }

  if (bestKey === startKey) return []

  const path: GridCoord[] = []
  let cursor: string | null = bestKey
  while (cursor !== null && cursor !== startKey) {
    const entry: VisitedEntry = visited.get(cursor)!
    path.unshift(entry.coord)
    cursor = entry.prev
  }
  return path
}
