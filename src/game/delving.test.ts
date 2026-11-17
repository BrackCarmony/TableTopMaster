import { describe, expect, it } from 'vitest'
import { RELICS, bandForDepth } from './data/relics'
import { canBuyUpgrade } from './data/upgradeTree'
import {
  BASE_RELIC_FIND_CHANCE,
  REPEAT_FIND_GOLD_FRACTION,
  caveInChance,
  computeMultipliers,
  computeUpgradeBonuses,
  delveDuration,
  delveGold,
  tickCrews,
} from './engine'
import type { DelveCrew, DMState } from './types'


function makeDm(overrides: Partial<DMState> = {}): DMState {
  return {
    name: 'DM',
    level: 1,
    gold: 0,
    infamy: 0,
    unlockedModuleIds: [],
    purchasedUpgradeIds: ['sailing-unlock', 'more-ships-1', 'delving-unlock'],
    tableSlots: 1,
    executionTier: {},
    trophies: [],
    discoveredArtifactIds: [],
    unlockedIslandIds: ['sunken-reef'],
    discoveredRelicIds: [],
    ...overrides,
  }
}

function crew(overrides: Partial<DelveCrew> = {}): DelveCrew {
  return { id: 'c1', name: 'Crew', depth: 1, turnBackAt: 10, delveRemaining: 1, lifetimeGold: 0, deepest: 0, last: null, ...overrides }
}

/** Dice that roll the given values in order (then 0.99 forever: no cave-in, no relic). */
const dice = (...rolls: number[]) => {
  let i = 0
  return () => (i < rolls.length ? rolls[i++] : 0.99)
}

describe('delving', () => {
  it('opens after Sailing and a second ship', () => {
    expect(canBuyUpgrade(makeDm({ purchasedUpgradeIds: ['sailing-unlock'] }), 'delving-unlock')).toBe(false)
    expect(canBuyUpgrade(makeDm({ purchasedUpgradeIds: ['sailing-unlock', 'more-ships-1'] }), 'delving-unlock')).toBe(true)
  })

  it('caves in more the deeper it goes, never on the first level, and less with Shoring Timbers', () => {
    const dm = makeDm()
    expect(caveInChance(1, dm)).toBe(0)
    expect(caveInChance(10, dm)).toBeGreaterThan(caveInChance(5, dm))
    expect(caveInChance(99, dm)).toBeLessThanOrEqual(0.75)
    const shored = makeDm({ purchasedUpgradeIds: [...dm.purchasedUpgradeIds, 'shoring-timbers-1'] })
    expect(caveInChance(10, shored)).toBeCloseTo(caveInChance(10, dm) * 0.8)
  })

  it('pays more and takes longer deeper down', () => {
    const dm = makeDm()
    expect(delveGold(10, dm)).toBeGreaterThan(delveGold(5, dm) * 2)
    expect(delveDuration(10, dm)).toBeGreaterThan(delveDuration(1, dm))
  })

  it('brings a haul back and goes a level deeper', () => {
    const dm = makeDm()
    // Level 2: survives the cave-in roll (0.99), no relic (0.99).
    const r = tickCrews([crew({ depth: 2 })], dm, 5, dice(0.99, 0.99))
    const c = r.crews[0]
    expect(r.dm.gold).toBe(delveGold(2, dm))
    expect(c).toMatchObject({ depth: 3, deepest: 2, lifetimeGold: delveGold(2, dm), last: { kind: 'haul', depth: 2 } })
    expect(c.delveRemaining).toBe(delveDuration(3, dm) - 4)
  })

  it('stops going deeper at the level it turns back at', () => {
    const r = tickCrews([crew({ depth: 4, turnBackAt: 4 })], makeDm(), 2, dice(0.99, 0.99))
    expect(r.crews[0].depth).toBe(4)
  })

  it('caves in: back to the surface with nothing', () => {
    const r = tickCrews([crew({ depth: 9, deepest: 8 })], makeDm(), 2, dice(0))
    expect(r.dm.gold).toBe(0)
    expect(r.crews[0]).toMatchObject({ depth: 1, deepest: 8, last: { kind: 'collapse', depth: 9, gold: 0 } })
  })

  it('finds relics from the band it is digging in, once; a repeat is sold for gold', () => {
    const dm = makeDm()
    // Level 12 (the Drow Cities): no cave-in, a find, the first relic of that band.
    const first = tickCrews([crew({ depth: 12 })], dm, 2, dice(0.99, 0, 0))
    const band = RELICS.filter((r) => r.band === bandForDepth(12))
    expect(first.dm.discoveredRelicIds).toEqual([band[0].id])
    expect(first.crews[0].last).toMatchObject({ kind: 'relic', relicId: band[0].id })
    const again = tickCrews([crew({ depth: 12 })], first.dm, 2, dice(0.99, 0, 0))
    expect(again.dm.discoveredRelicIds).toEqual([band[0].id])
    expect(again.dm.gold - first.dm.gold).toBe(delveGold(12, first.dm) + Math.round(delveGold(12, first.dm) * REPEAT_FIND_GOLD_FRACTION))
    expect(BASE_RELIC_FIND_CHANCE).toBeGreaterThan(0)
  })

  it('makes found relics count like upgrades', () => {
    const dm = makeDm({ discoveredRelicIds: ['cave-pearl', 'drow-silk', 'obsidian-mirror'] })
    expect(computeMultipliers(dm).gold).toBeCloseTo(1.05)
    expect(computeUpgradeBonuses(dm).partyHp).toBeCloseTo(1.08)
    expect(computeUpgradeBonuses(dm).enemyHp).toBeCloseTo(0.96)
  })

  it('has three relics in every band, all with distinct ids', () => {
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(RELICS.length)
    for (let b = 0; b < 5; b++) expect(RELICS.filter((r) => r.band === b)).toHaveLength(3)
  })
})
