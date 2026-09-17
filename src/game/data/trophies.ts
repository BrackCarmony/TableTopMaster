/** Quality name per execution-module tier defeated (index 0 = tier 0, the module's base difficulty). */
export const TROPHY_QUALITY_NAMES = [
  'Crude',
  'Common',
  'Fine',
  'Superior',
  'Exquisite',
  'Flawless',
  'Perfect',
  'Mythic',
  'Legendary',
  'Godly',
]

export function getTrophyQuality(tier: number): string {
  if (tier < TROPHY_QUALITY_NAMES.length) return TROPHY_QUALITY_NAMES[tier]
  const top = TROPHY_QUALITY_NAMES[TROPHY_QUALITY_NAMES.length - 1]
  return `${top} +${tier - TROPHY_QUALITY_NAMES.length + 1}`
}

/** Used for any execution module that doesn't define its own `trophyParts`. */
export const DEFAULT_TROPHY_PARTS = ['Scale', 'Fang', 'Claw', 'Horn', 'Hide']

/** Bonus starting level every freshly-rolled character gets from the DM's trophy collection so far — makes rebuilding a party after a wipe/reroll skip some of the early grind. Never caps. */
export const TROPHY_STARTING_LEVEL_BONUS = 5

export function trophyStartingLevelBonus(trophyCount: number): number {
  return trophyCount * TROPHY_STARTING_LEVEL_BONUS
}
