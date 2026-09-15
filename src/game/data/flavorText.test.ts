import { describe, expect, it } from 'vitest'
import { ATTACK_FLAVOR, pickFlavorLine, renderFlavorTemplate } from './flavorText'

describe('pickFlavorLine', () => {
  it('is deterministic for a given seed', () => {
    const pool = ATTACK_FLAVOR.whimsy
    const a = pickFlavorLine(pool, 'event-42')
    const b = pickFlavorLine(pool, 'event-42')
    expect(a).toBe(b)
  })

  it('always returns a line from the pool', () => {
    const pool = ATTACK_FLAVOR.tactical
    for (const seed of ['a', 'b', 'c', 'attacker:target', '0:1:2']) {
      expect(pool).toContain(pickFlavorLine(pool, seed))
    }
  })
})

describe('renderFlavorTemplate', () => {
  it('substitutes name and target placeholders', () => {
    const rendered = renderFlavorTemplate('{name} strikes {target}', 'Alice', 'Bob')
    expect(rendered).toBe('Alice strikes Bob')
  })
})
