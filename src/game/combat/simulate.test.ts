import { describe, expect, it } from 'vitest'
import { runEncounter } from './simulate'
import { createRng } from '../rng'
import type { CombatUnit, EncounterTemplate } from './types'

function makeUnit(overrides: Partial<CombatUnit>): CombatUnit {
  return {
    id: 'unit',
    name: 'Unit',
    side: 'party',
    role: 'dps',
    level: 1,
    position: { x: 0, y: 0 },
    hp: 20,
    maxHp: 20,
    attackPower: 5,
    defense: 0,
    healPower: 0,
    moveRange: 3,
    attackRange: 1,
    speed: 5,
    alive: true,
    flavor: null,
    ...overrides,
  }
}

const basicTemplate: EncounterTemplate = {
  id: 'test-basic',
  name: 'Test Basic',
  gridWidth: 8,
  gridHeight: 8,
  partyStartPositions: [{ x: 0, y: 0 }],
  enemies: [
    { name: 'Weak Enemy', role: 'dps', position: { x: 1, y: 0 }, hp: 5, attackPower: 1, defense: 0, healPower: 0, moveRange: 1, attackRange: 1, speed: 1 },
  ],
}

describe('runEncounter', () => {
  it('is deterministic given the same seed', () => {
    const party = [makeUnit({ id: 'hero', name: 'Hero' })]
    const a = runEncounter(party, basicTemplate, createRng(42))
    const b = runEncounter(party, basicTemplate, createRng(42))
    expect(a.outcome).toBe(b.outcome)
    expect(a.log).toEqual(b.log)
  })

  it('computes damage as attackPower minus defense, minimum 1', () => {
    const party = [makeUnit({ id: 'hero', name: 'Hero', attackPower: 5 })]
    const result = runEncounter(party, basicTemplate, createRng(1))
    const attackEvents = result.log.filter((e) => e.type === 'attack' && e.attackerId === 'hero' && e.hit)
    expect(attackEvents.length).toBeGreaterThan(0)
    for (const e of attackEvents) {
      if (e.type === 'attack') expect(e.damage).toBe(5) // enemy defense is 0
    }
  })

  it('resolves a clear mismatch as a party victory with enemy deaths logged', () => {
    const party = [makeUnit({ id: 'hero', name: 'Hero', attackPower: 20, hp: 100, maxHp: 100 })]
    const result = runEncounter(party, basicTemplate, createRng(7))
    expect(result.outcome).toBe('victory')
    expect(result.survivorIds).toContain('hero')
    expect(result.log.some((e) => e.type === 'death')).toBe(true)
    expect(result.goldReward).toBeGreaterThan(0)
  })

  it('scales gold/XP reward with enemy power (hp+attack+defense+heal), not just enemy count', () => {
    const party = [makeUnit({ id: 'hero', name: 'Hero', attackPower: 999, hp: 999, maxHp: 999 })]

    const weakTemplate: EncounterTemplate = {
      ...basicTemplate,
      enemies: [{ name: 'Weak', role: 'dps', position: { x: 1, y: 0 }, hp: 10, attackPower: 1, defense: 0, healPower: 0, moveRange: 1, attackRange: 1, speed: 1 }],
    }
    const toughTemplate: EncounterTemplate = {
      ...basicTemplate,
      enemies: [{ name: 'Tough', role: 'dps', position: { x: 1, y: 0 }, hp: 500, attackPower: 30, defense: 15, healPower: 5, moveRange: 1, attackRange: 1, speed: 1 }],
    }

    const weak = runEncounter(party, weakTemplate, createRng(1))
    const tough = runEncounter(party, toughTemplate, createRng(1))

    expect(weak.outcome).toBe('victory')
    expect(tough.outcome).toBe('victory')
    expect(tough.goldReward).toBeGreaterThan(weak.goldReward)
    expect(tough.xpReward).toBeGreaterThan(weak.xpReward)

    // power = hp/10 + attackPower + defense + healPower
    const expectedWeakPower = 10 / 10 + 1 + 0 + 0
    const expectedToughPower = 500 / 10 + 30 + 15 + 5
    expect(weak.goldReward).toBe(Math.round(expectedWeakPower * 2.5))
    expect(weak.xpReward).toBe(Math.round(expectedWeakPower * 1.5))
    expect(tough.goldReward).toBe(Math.round(expectedToughPower * 2.5))
    expect(tough.xpReward).toBe(Math.round(expectedToughPower * 1.5))
  })

  it('resolves an overwhelming enemy as a party defeat', () => {
    const party = [makeUnit({ id: 'hero', name: 'Hero', hp: 5, maxHp: 5, defense: 0 })]
    const brutalTemplate: EncounterTemplate = {
      ...basicTemplate,
      enemies: [
        { name: 'Overwhelming Foe', role: 'dps', position: { x: 1, y: 0 }, hp: 500, attackPower: 999, defense: 0, healPower: 0, moveRange: 5, attackRange: 3, speed: 99 },
      ],
    }
    const result = runEncounter(party, brutalTemplate, createRng(3))
    expect(result.outcome).toBe('defeat')
    expect(result.survivorIds).toEqual([])
    expect(result.goldReward).toBe(0)
  })

  it('ramps an enraging boss enemy until it eventually wins a fight that would otherwise stalemate', () => {
    const enrageTemplate: EncounterTemplate = {
      id: 'enrage-test',
      name: 'Enrage Test',
      gridWidth: 8,
      gridHeight: 8,
      partyStartPositions: [{ x: 0, y: 0 }],
      enemies: [
        {
          name: 'Boss',
          role: 'dps',
          position: { x: 1, y: 0 },
          hp: 50000,
          attackPower: 5,
          defense: 1000,
          healPower: 0,
          moveRange: 1,
          attackRange: 1,
          speed: 1,
          attackPowerRampPerRound: 40,
        },
      ],
    }
    const party = [makeUnit({ id: 'hero', name: 'Hero', hp: 500, maxHp: 500, defense: 0, attackPower: 10, attackRange: 1 })]

    for (const seed of [1, 2, 3, 4, 5]) {
      const result = runEncounter(party, enrageTemplate, createRng(seed))
      expect(result.outcome).toBe('defeat')
      expect(result.log.some((e) => e.type === 'enrage')).toBe(true)
    }
  })

  it('without a ramp, the same overmatched-on-defense boss just stalemates instead', () => {
    const noRampTemplate: EncounterTemplate = {
      id: 'no-ramp-test',
      name: 'No Ramp Test',
      gridWidth: 8,
      gridHeight: 8,
      partyStartPositions: [{ x: 0, y: 0 }],
      enemies: [
        { name: 'Boss', role: 'dps', position: { x: 1, y: 0 }, hp: 50000, attackPower: 5, defense: 1000, healPower: 0, moveRange: 1, attackRange: 1, speed: 1 },
      ],
    }
    const party = [makeUnit({ id: 'hero', name: 'Hero', hp: 500, maxHp: 500, defense: 0, attackPower: 10, attackRange: 1 })]
    const result = runEncounter(party, noRampTemplate, createRng(1))
    expect(result.outcome).toBe('stalemate')
    // A stalemate still teaches the party something even without a kill, but
    // grinding an unwinnable fight forever must never pay out loot.
    expect(result.xpReward).toBeGreaterThan(0)
    expect(result.goldReward).toBe(0)
  })

  it('calls a stalemate when neither side can reach or hit the other', () => {
    const frozenTemplate: EncounterTemplate = {
      id: 'frozen',
      name: 'Frozen',
      gridWidth: 8,
      gridHeight: 8,
      partyStartPositions: [{ x: 0, y: 0 }],
      enemies: [
        { name: 'Distant Foe', role: 'dps', position: { x: 7, y: 7 }, hp: 10, attackPower: 5, defense: 0, healPower: 0, moveRange: 0, attackRange: 0, speed: 1 },
      ],
    }
    const party = [makeUnit({ id: 'hero', name: 'Hero', moveRange: 0, attackRange: 0 })]
    const result = runEncounter(party, frozenTemplate, createRng(9))
    expect(result.outcome).toBe('stalemate')
    expect(result.xpReward).toBeGreaterThan(0)
    expect(result.goldReward).toBe(0)
  })
})
