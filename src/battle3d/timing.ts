import type { CombatLogEvent } from '../game/combat/types'

// How long the 3D battle view spends on each log event at 1x speed, in ms. Battles never have
// to be watched to progress, so these are unhurried: every move, swing and heal gets time to
// read. Kept free of three.js so the battle modal can pace itself without loading the 3D code.

const PER_TILE = 420

export function eventDuration3D(event: CombatLogEvent): number {
  switch (event.type) {
    case 'encounter_start':
      return 2200
    case 'move':
      return 400 + Math.max(1, event.path.length) * PER_TILE
    case 'attack':
      return 1300
    case 'heal':
      return 1300
    case 'revive':
      return 1800
    case 'death':
      return 1200
    case 'enrage':
    case 'regen':
      return 900
    case 'finisher':
      return 2600
    case 'encounter_end':
      return 1500
    default:
      return 800
  }
}

/** The pace of the original 2D grid view. */
export const STEP_MS_2D = 700

export { PER_TILE }
