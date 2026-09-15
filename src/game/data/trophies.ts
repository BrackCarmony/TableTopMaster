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
