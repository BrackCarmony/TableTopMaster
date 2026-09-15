import type { Role } from '../game/combat/types'
import type { DominantTrait } from '../game/personality'

export const ROLE_ICON: Record<Role, string> = { tank: '🛡️', dps: '⚔️', healer: '✚' }

export const TRAIT_ICON: Record<DominantTrait, string> = {
  whimsy: '✨',
  tactical: '♟️',
  aggression: '🔥',
  stoic: '🗿',
}

export const TRAIT_LABEL: Record<DominantTrait, string> = {
  whimsy: 'Whimsical',
  tactical: 'Tactical',
  aggression: 'Aggressive',
  stoic: 'Stoic',
}
