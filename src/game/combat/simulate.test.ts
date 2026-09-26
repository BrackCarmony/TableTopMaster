import { describe, expect, it } from 'vitest'
import { MAX_ROUNDS, runEncounter } from './simulate'
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

  it('reports roundsElapsed maxed out for a stalemate but low for a quick, overwhelming win', () => {
    const noRampTemplate: EncounterTemplate = {
      id: 'no-ramp-test-2',
      name: 'No Ramp Test 2',
      gridWidth: 8,
      gridHeight: 8,
      partyStartPositions: [{ x: 0, y: 0 }],
      enemies: [
        { name: 'Boss', role: 'dps', position: { x: 1, y: 0 }, hp: 50000, attackPower: 5, defense: 1000, healPower: 0, moveRange: 1, attackRange: 1, speed: 1 },
      ],
    }
    const stalematingParty = [makeUnit({ id: 'hero', name: 'Hero', hp: 500, maxHp: 500, defense: 0, attackPower: 10, attackRange: 1 })]
    const stalemate = runEncounter(stalematingParty, noRampTemplate, createRng(1))
    expect(stalemate.outcome).toBe('stalemate')
    expect(stalemate.roundsElapsed).toBe(MAX_ROUNDS)

    const overwhelmingParty = [makeUnit({ id: 'hero', name: 'Hero', attackPower: 999, hp: 999, maxHp: 999 })]
    const quickWin = runEncounter(overwhelmingParty, basicTemplate, createRng(7))
    expect(quickWin.outcome).toBe('victory')
    expect(quickWin.roundsElapsed).toBeLessThan(MAX_ROUNDS / 5)
  })

  it('places tanks closest to the enemies and healers farthest back, regardless of seating order', () => {
    const positionTemplate: EncounterTemplate = {
      id: 'position-test',
      name: 'Position Test',
      gridWidth: 10,
      gridHeight: 10,
      partyStartPositions: [
        { x: 1, y: 0 }, // distance 10 from the enemy — farthest
        { x: 1, y: 3 }, // distance 7 — closest
        { x: 1, y: 7 }, // distance 11 — farthest
      ],
      enemies: [
        { name: 'Target', role: 'dps', position: { x: 8, y: 3 }, hp: 999, attackPower: 1, defense: 0, healPower: 0, moveRange: 0, attackRange: 0, speed: 1 },
      ],
    }
    // Deliberately seated in the "wrong" order — healer first, tank last —
    // to prove placement is role-driven, not just seating order.
    const party = [
      makeUnit({ id: 'healer', role: 'healer' }),
      makeUnit({ id: 'dps', role: 'dps' }),
      makeUnit({ id: 'tank', role: 'tank' }),
    ]
    const result = runEncounter(party, positionTemplate, createRng(1))
    const start = result.log[0]
    if (start.type !== 'encounter_start') throw new Error('expected encounter_start')
    const posById = new Map(start.units.filter((u) => u.side === 'party').map((u) => [u.id, u.position]))

    // Row: tank claims the row nearest the enemies (y=3), dps the next
    // row (y=0, the first "farthest" entry), healer the last (y=7).
    // Column: on top of that, the tank steps one column toward the
    // enemies and the healer one column away — an actual front/back line
    // instead of everyone sharing column x=1.
    expect(posById.get('tank')).toEqual({ x: 2, y: 3 })
    expect(posById.get('dps')).toEqual({ x: 1, y: 0 })
    expect(posById.get('healer')).toEqual({ x: 0, y: 7 })
  })

  it('lets a tank with Defensive Rush act before round 0, ahead of any faster unit', () => {
    const rushTemplate: EncounterTemplate = {
      id: 'rush-test',
      name: 'Rush Test',
      gridWidth: 10,
      gridHeight: 10,
      partyStartPositions: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      enemies: [
        { name: 'Target', role: 'dps', position: { x: 9, y: 0 }, hp: 999, attackPower: 1, defense: 0, healPower: 0, moveRange: 0, attackRange: 0, speed: 1 },
      ],
    }
    // The rush tank has the LOWEST speed in the party — without the
    // pre-round pass it would never act before the much-faster dps. If its
    // action still shows up first in the log, that can only be the
    // pre-round pass firing, not normal initiative order.
    const rushTank = makeUnit({ id: 'rush-tank', role: 'tank', speed: 1, extraTurnAtStart: true })
    const fastDps = makeUnit({ id: 'fast-dps', role: 'dps', speed: 99 })

    const result = runEncounter([rushTank, fastDps], rushTemplate, createRng(1))
    const firstAction = result.log.find((e) => e.type === 'move' || e.type === 'attack')
    expect(firstAction).toBeDefined()
    if (firstAction?.type === 'move') expect(firstAction.unitId).toBe('rush-tank')
    if (firstAction?.type === 'attack') expect(firstAction.attackerId).toBe('rush-tank')
  })

  it('never gives a tank without Defensive Rush a pre-round action', () => {
    const rushTemplate: EncounterTemplate = {
      id: 'no-rush-test',
      name: 'No Rush Test',
      gridWidth: 10,
      gridHeight: 10,
      partyStartPositions: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      enemies: [
        { name: 'Target', role: 'dps', position: { x: 9, y: 0 }, hp: 999, attackPower: 1, defense: 0, healPower: 0, moveRange: 0, attackRange: 0, speed: 1 },
      ],
    }
    const slowTank = makeUnit({ id: 'slow-tank', role: 'tank', speed: 1 })
    const fastDps = makeUnit({ id: 'fast-dps', role: 'dps', speed: 99 })

    const result = runEncounter([slowTank, fastDps], rushTemplate, createRng(1))
    const firstAction = result.log.find((e) => e.type === 'move' || e.type === 'attack')
    expect(firstAction).toBeDefined()
    if (firstAction?.type === 'move') expect(firstAction.unitId).toBe('fast-dps')
    if (firstAction?.type === 'attack') expect(firstAction.attackerId).toBe('fast-dps')
  })

  it('lets a healer with Revivify bring a fallen ally back before the encounter ends', () => {
    const reviveTemplate: EncounterTemplate = {
      id: 'revive-test',
      name: 'Revive Test',
      gridWidth: 8,
      gridHeight: 8,
      partyStartPositions: [{ x: 0, y: 0 }, { x: 0, y: 3 }],
      // A 1-hp enemy adjacent to the tank: the enemy's own attack kills the
      // fragile tank first (it acts first, highest speed), the healer then
      // revives (no wounded-but-alive ally to heal instead), and the
      // revived tank — acting last in initiative, after the healer — gets
      // its own turn this same round and finishes the 1-hp enemy off before
      // it can ever attack again.
      enemies: [
        { name: 'Weakling', role: 'dps', position: { x: 2, y: 0 }, hp: 1, attackPower: 20, defense: 0, healPower: 0, moveRange: 0, attackRange: 1, speed: 99 },
      ],
    }
    const fragileTank = makeUnit({ id: 'tank', role: 'tank', hp: 1, maxHp: 1, attackPower: 5, defense: 0, attackRange: 1, speed: 1 })
    const healer = makeUnit({ id: 'healer', role: 'healer', attackRange: 5, healPower: 0, speed: 50, reviveAvailable: true, reviveHpFraction: 0.5 })

    let result = runEncounter([fragileTank, healer], reviveTemplate, createRng(1))
    // Both the enemy's killing hit and the revived tank's finishing hit are
    // 85% each — retry a couple of seeds on the rare miss instead of
    // asserting on a single roll of the dice.
    for (let seed = 2; !result.survivorIds.includes('tank') && seed < 15; seed++) {
      result = runEncounter([fragileTank, healer], reviveTemplate, createRng(seed))
    }

    const reviveEvent = result.log.find((e) => e.type === 'revive')
    expect(reviveEvent).toBeDefined()
    if (reviveEvent?.type === 'revive') {
      expect(reviveEvent.healerId).toBe('healer')
      expect(reviveEvent.targetId).toBe('tank')
    }
    expect(result.survivorIds).toContain('tank')
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
