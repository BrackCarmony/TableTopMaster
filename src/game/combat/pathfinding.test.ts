import { describe, expect, it } from 'vitest'
import { findPathToward } from './pathfinding'
import { manhattanDistance } from './grid'

describe('findPathToward', () => {
  it('moves toward the target, getting closer', () => {
    const start = { x: 0, y: 0 }
    const target = { x: 5, y: 0 }
    const path = findPathToward(start, target, 3, 8, 8, new Set())
    expect(path.length).toBeGreaterThan(0)
    const end = path[path.length - 1]
    expect(manhattanDistance(end, target)).toBeLessThan(manhattanDistance(start, target))
  })

  it('never returns a path longer than moveRange', () => {
    const start = { x: 0, y: 0 }
    const target = { x: 7, y: 7 }
    const path = findPathToward(start, target, 2, 8, 8, new Set())
    expect(path.length).toBeLessThanOrEqual(2)
  })

  it('never steps onto an occupied tile', () => {
    const start = { x: 0, y: 0 }
    const target = { x: 2, y: 0 }
    const occupied = new Set(['1,0'])
    const path = findPathToward(start, target, 3, 8, 8, occupied)
    for (const step of path) {
      expect(occupied.has(`${step.x},${step.y}`)).toBe(false)
    }
  })

  it('returns an empty path when already at the closest reachable tile', () => {
    const start = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    const path = findPathToward(start, target, 3, 8, 8, new Set())
    expect(path).toEqual([])
  })
})
