import type { RngFn } from './rng'

export interface PersonalityTraits {
  whimsy: number
  tactical: number
  aggression: number
  stoic: number
}

export type DominantTrait = keyof PersonalityTraits

const TRAIT_KEYS: DominantTrait[] = ['whimsy', 'tactical', 'aggression', 'stoic']

function roll0to100(rng: RngFn): number {
  return Math.floor(rng() * 101)
}

export function rollPersonality(rng: RngFn): PersonalityTraits {
  return {
    whimsy: roll0to100(rng),
    tactical: roll0to100(rng),
    aggression: roll0to100(rng),
    stoic: roll0to100(rng),
  }
}

export function dominantTrait(traits: PersonalityTraits): DominantTrait {
  let best: DominantTrait = TRAIT_KEYS[0]
  for (const key of TRAIT_KEYS) {
    if (traits[key] > traits[best]) best = key
  }
  return best
}
