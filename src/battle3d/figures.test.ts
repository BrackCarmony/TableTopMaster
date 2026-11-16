import { describe, expect, it } from 'vitest'
import type { CombatUnit, Role } from '../game/combat/types'
import { CLASS_TIERS } from '../game/data/classes'
import * as ENCOUNTER_EXPORTS from '../game/data/encounters'
import type { EncounterTemplate } from '../game/combat/types'
import { RACES } from '../game/data/names'
import { buildFigure, hasClassStyle, hasCustomLook } from './figures'
import { SETTINGS, settingFor } from './settings'

const ENCOUNTERS = Object.values(ENCOUNTER_EXPORTS).filter(
  (v): v is EncounterTemplate => typeof v === 'object' && v !== null && 'enemies' in v && 'id' in v,
)

function unit(over: Partial<CombatUnit>): CombatUnit {
  return {
    id: 'u1',
    name: 'Test',
    side: 'party',
    role: 'tank',
    level: 1,
    position: { x: 0, y: 0 },
    hp: 10,
    maxHp: 10,
    attackPower: 1,
    defense: 1,
    healPower: 0,
    moveRange: 3,
    attackRange: 1,
    speed: 5,
    alive: true,
    flavor: null,
    ...over,
  }
}

describe('3D battle figures', () => {
  it('builds every class of every tier for every race', () => {
    for (const role of Object.keys(CLASS_TIERS) as Role[])
      for (const t of CLASS_TIERS[role])
        for (const className of t.names)
          for (const race of RACES) {
            const f = buildFigure(unit({ id: `${className}-${race}`, role, className, race, attackRange: t.attackRange }))
            expect(f.height).toBeGreaterThan(0.3)
            expect(f.legs.length).toBeGreaterThan(0)
          }
  })

  it('gives every class name its own style', () => {
    for (const role of Object.keys(CLASS_TIERS) as Role[])
      for (const t of CLASS_TIERS[role]) for (const n of t.names) expect(hasClassStyle(n), n).toBe(true)
  })

  it('gives every enemy in every encounter its own hand-made look', () => {
    for (const enc of ENCOUNTERS)
      for (const e of enc.enemies) {
        expect(hasCustomLook(e.name), `${e.name} (${enc.id})`).toBe(true)
        const f = buildFigure(unit({ id: e.name, name: e.name, side: 'enemy', role: e.role, attackRange: e.attackRange }))
        expect(f.height).toBeGreaterThan(0.3)
      }
  })

  it('still builds an enemy nobody has drawn yet', () => {
    expect(buildFigure(unit({ name: 'Some Future Monster', side: 'enemy' })).height).toBeGreaterThan(0.3)
  })

  it('finds the encounters to check', () => {
    expect(ENCOUNTERS.length).toBeGreaterThan(20)
  })

  it('has a setting for every encounter', () => {
    for (const enc of ENCOUNTERS) {
      const s = settingFor(enc.id)
      const expected = enc.id.startsWith('kraken') ? 'kraken' : enc.id.startsWith('tarrasque') ? 'tarrasque' : enc.id.replace(/-\d+$/, '')
      expect(s.id, enc.id).toBe(expected)
      expect(SETTINGS[s.id]).toBeDefined()
    }
  })
})
