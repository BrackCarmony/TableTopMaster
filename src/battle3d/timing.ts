import type { CombatLogEvent } from '../game/combat/types'

// How long the 3D battle view spends on each log event at 1x speed, in ms. Battles never have
// to be watched to progress, so these are unhurried: every move, swing and heal gets time to
// read. Kept free of three.js so the battle modal can pace itself without loading the 3D code.

const PER_TILE = 420

/** Bosses with their own signature attack (see signatures.ts) get longer to play it. */
export const SIGNATURE_BOSSES = [
  'Goblin Boss',
  'Bandit Captain',
  'Lich',
  'Elder Wyrm',
  'Demon Prince',
  'Frost Giant',
  'Iron Golem',
  'Void Horror',
  'Fire Titan',
  'The Undying King',
  'The Fallen Archon',
  'The World-Eater',
  'Whatever Sits the Throne',
  'Tarrasque',
  'The Kraken',
]
export const BOSS_ATTACK_MS = 2200

/** `units` (the battle's starting units) lets a boss's signature attack take its longer time. */
export function eventDuration3D(event: CombatLogEvent, units?: { id: string; name: string }[]): number {
  switch (event.type) {
    case 'encounter_start':
      return 2200
    case 'move':
      return 400 + Math.max(1, event.path.length) * PER_TILE
    case 'attack': {
      const attacker = units?.find((u) => u.id === event.attackerId)
      return attacker && SIGNATURE_BOSSES.includes(attacker.name) ? BOSS_ATTACK_MS : 1300
    }
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
