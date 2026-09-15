import type { DominantTrait } from '../personality'

/** Templates use {name} for the acting unit and {target} for the unit they're acting on (when applicable). */
export const ATTACK_FLAVOR: Record<DominantTrait, string[]> = {
  whimsy: [
    '{name} conjures a burst of glittering light at {target}',
    '{name} twirls dramatically before striking {target}',
    '{name} lobs something sparkly at {target}',
  ],
  tactical: [
    "{name} exploits an opening and strikes {target}'s flank",
    '{name} calculates the perfect angle into {target}',
    '{name} times a precise strike against {target}',
  ],
  aggression: [
    '{name} snarls and slams into {target}',
    '{name} charges recklessly at {target}',
    '{name} barrels into {target} with brute force',
  ],
  stoic: [
    '{name} delivers a measured blow to {target}',
    '{name} strikes {target} without a word',
    '{name} calmly closes with {target}',
  ],
}

export const MOVE_FLAVOR: Record<DominantTrait, string[]> = {
  whimsy: [
    '{name} cartwheels into position',
    '{name} skips forward, humming to themselves',
    '{name} dances toward the fray',
  ],
  tactical: [
    '{name} repositions to flank the enemy line',
    '{name} moves to a tactically sound position',
    '{name} advances along a calculated route',
  ],
  aggression: [
    '{name} storms forward',
    '{name} charges ahead, itching for a fight',
    '{name} shoulders through to the front',
  ],
  stoic: [
    '{name} advances calmly',
    '{name} steps into position without hesitation',
    '{name} moves forward, unbothered',
  ],
}

export const HEAL_FLAVOR: Record<DominantTrait, string[]> = {
  whimsy: [
    '{name} showers {target} with sparkling motes of light',
    '{name} hums a cheerful tune, mending {target}',
    '{name} waves a hand and {target}\'s wounds shimmer shut',
  ],
  tactical: [
    '{name} efficiently patches up {target}',
    "{name} assesses {target}'s wounds and treats them precisely",
    '{name} stabilizes {target} with practiced economy',
  ],
  aggression: [
    '{name} gruffly shoves a potion at {target}',
    '{name} barks at {target} to hold still while they patch them up',
    '{name} roughly but effectively tends to {target}',
  ],
  stoic: [
    "{name} calmly tends to {target}'s wounds",
    '{name} mends {target} without a word',
    '{name} quietly restores {target}',
  ],
}

/** Deterministic string hash so the same event always picks the same flavor variant. */
function stableHash(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function pickFlavorLine(pool: string[], seed: string): string {
  if (pool.length === 0) return ''
  return pool[stableHash(seed) % pool.length]
}

export function renderFlavorTemplate(template: string, name: string, target?: string): string {
  return template.replace('{name}', name).replace('{target}', target ?? '')
}
