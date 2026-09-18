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

  it('passes through a noLand tile to reach what is beyond it, instead of treating it as a wall', () => {
    const start = { x: 0, y: 0 }
    const target = { x: 4, y: 0 }
    // A corpse sitting at (2,0) — the only route — must not block reaching (3,0) and beyond.
    const noLand = new Set(['2,0'])
    const path = findPathToward(start, target, 5, 8, 8, new Set(), noLand)
    expect(path.length).toBeGreaterThan(0)
    const end = path[path.length - 1]
    expect(noLand.has(`${end.x},${end.y}`)).toBe(false)
    expect(manhattanDistance(end, target)).toBeLessThan(manhattanDistance(start, target))
  })

  it('never lands on a noLand tile even when it is the closest reachable one', () => {
    const start = { x: 0, y: 0 }
    const target = { x: 2, y: 0 }
    const noLand = new Set(['2,0'])
    const path = findPathToward(start, target, 5, 8, 8, new Set(), noLand)
    const end = path[path.length - 1]
    expect(noLand.has(`${end.x},${end.y}`)).toBe(false)
  })
})
