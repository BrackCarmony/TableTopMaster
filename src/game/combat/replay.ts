import { ATTACK_FLAVOR, HEAL_FLAVOR, MOVE_FLAVOR, pickFlavorLine, renderFlavorTemplate } from '../data/flavorText'
import type { DominantTrait } from '../personality'
import type { CombatLogEvent, CombatUnit } from './types'

/** Reconstructs unit positions/hp/alive state as of a given step index into the log. */
export function computeBoardStateAtStep(log: CombatLogEvent[], stepIndex: number): CombatUnit[] {
  const start = log[0]
  if (!start || start.type !== 'encounter_start') return []

  const units = start.units.map((u) => ({ ...u, position: { ...u.position } }))
  const byId = new Map(units.map((u) => [u.id, u]))

  const lastIndex = Math.min(stepIndex, log.length - 1)
  for (let i = 1; i <= lastIndex; i++) {
    const event = log[i]
    switch (event.type) {
      case 'move': {
        const unit = byId.get(event.unitId)
        if (unit && event.path.length > 0) unit.position = { ...event.path[event.path.length - 1] }
        break
      }
      case 'attack': {
        const target = byId.get(event.targetId)
        if (target) target.hp = event.targetHpAfter
        break
      }
      case 'heal': {
        const target = byId.get(event.targetId)
        if (target) target.hp = event.targetHpAfter
        break
      }
      case 'death': {
        const unit = byId.get(event.unitId)
        if (unit) unit.alive = false
        break
      }
      default:
        break
    }
  }

  return units
}

export function getEncounterGridSize(log: CombatLogEvent[]): { width: number; height: number } {
  const start = log[0]
  if (!start || start.type !== 'encounter_start') return { width: 8, height: 8 }
  return { width: start.gridWidth, height: start.gridHeight }
}

export interface UnitInfo {
  name: string
  flavor: DominantTrait | null
}

export function describeEvent(event: CombatLogEvent, unitsById: Map<string, UnitInfo>, eventIndex: number): string {
  const infoOf = (id: string): UnitInfo => unitsById.get(id) ?? { name: id, flavor: null }
  const nameOf = (id: string) => infoOf(id).name
  const seed = (suffix: string) => `${eventIndex}:${suffix}`

  switch (event.type) {
    case 'encounter_start':
      return `The battle begins: ${event.units.map((u) => u.name).join(', ')}.`
    case 'move': {
      const info = infoOf(event.unitId)
      if (info.flavor) {
        const template = pickFlavorLine(MOVE_FLAVOR[info.flavor], seed(event.unitId))
        return `${renderFlavorTemplate(template, info.name)}.`
      }
      return `${info.name} moves in.`
    }
    case 'attack': {
      const attacker = infoOf(event.attackerId)
      const targetName = nameOf(event.targetId)
      if (attacker.flavor) {
        const template = pickFlavorLine(ATTACK_FLAVOR[attacker.flavor], seed(`${event.attackerId}:${event.targetId}`))
        const line = renderFlavorTemplate(template, attacker.name, targetName)
        return event.hit
          ? `${line} for ${event.damage} damage (${event.targetHpAfter} HP left).`
          : `${line}, but misses.`
      }
      return event.hit
        ? `${attacker.name} hits ${targetName} for ${event.damage} damage (${event.targetHpAfter} HP left).`
        : `${attacker.name} attacks ${targetName} and misses.`
    }
    case 'heal': {
      const healer = infoOf(event.healerId)
      const targetName = nameOf(event.targetId)
      if (healer.flavor) {
        const template = pickFlavorLine(HEAL_FLAVOR[healer.flavor], seed(`${event.healerId}:${event.targetId}`))
        const line = renderFlavorTemplate(template, healer.name, targetName)
        return `${line} for ${event.amount} (${event.targetHpAfter} HP).`
      }
      return `${healer.name} heals ${targetName} for ${event.amount} (${event.targetHpAfter} HP).`
    }
    case 'death':
      return `${nameOf(event.unitId)} falls.`
    case 'enrage':
      return `${nameOf(event.unitId)} grows more ferocious!`
    case 'encounter_end':
      if (event.outcome === 'victory') return 'Victory! The party stands over the fallen.'
      if (event.outcome === 'defeat') return 'Total party kill. Nothing survived.'
      return 'The battle drags on with no resolution — both sides withdraw.'
    default:
      return ''
  }
}

export function buildUnitLookup(log: CombatLogEvent[]): Map<string, UnitInfo> {
  const start = log[0]
  const map = new Map<string, UnitInfo>()
  if (start && start.type === 'encounter_start') {
    for (const u of start.units) map.set(u.id, { name: u.name, flavor: u.flavor })
  }
  return map
}
