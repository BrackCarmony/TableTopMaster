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

export function describeEvent(event: CombatLogEvent, nameById: Map<string, string>): string {
  const nameOf = (id: string) => nameById.get(id) ?? id
  switch (event.type) {
    case 'encounter_start':
      return `The battle begins: ${event.units.map((u) => u.name).join(', ')}.`
    case 'move':
      return `${nameOf(event.unitId)} moves in.`
    case 'attack':
      return event.hit
        ? `${nameOf(event.attackerId)} hits ${nameOf(event.targetId)} for ${event.damage} damage (${event.targetHpAfter} HP left).`
        : `${nameOf(event.attackerId)} attacks ${nameOf(event.targetId)} and misses.`
    case 'heal':
      return `${nameOf(event.healerId)} heals ${nameOf(event.targetId)} for ${event.amount} (${event.targetHpAfter} HP).`
    case 'death':
      return `${nameOf(event.unitId)} falls.`
    case 'encounter_end':
      if (event.outcome === 'victory') return 'Victory! The party stands over the fallen.'
      if (event.outcome === 'defeat') return 'Total party kill. Nothing survived.'
      return 'The battle drags on with no resolution — both sides withdraw.'
    default:
      return ''
  }
}

export function buildNameLookup(log: CombatLogEvent[]): Map<string, string> {
  const start = log[0]
  const map = new Map<string, string>()
  if (start && start.type === 'encounter_start') {
    for (const u of start.units) map.set(u.id, u.name)
  }
  return map
}
