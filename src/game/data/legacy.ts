export const LEGACY_TIER_BASE_COST = 50
export const LEGACY_TIER_GROWTH = 3
export const LEGACY_STAT_BONUS_PER_TIER = 0.05

/**
 * Infamy cost to raise a player from `currentTier` to `currentTier + 1`.
 * Unlike role class tiers (capped, gold-funded), this never caps — it's the
 * long-term Infamy sink: grinding out deaths and rerolling a team keeps
 * paying off no matter how much Infamy has already piled up.
 */
export function legacyTierCost(currentTier: number): number {
  return Math.round(LEGACY_TIER_BASE_COST * LEGACY_TIER_GROWTH ** currentTier)
}

/**
 * Stat multiplier for a freshly-rolled character belonging to a player at
 * this legacy tier. Applies on top of whatever role/class tier they roll
 * into — a permanent mark of experience that survives every death and
 * reroll, distinct from the gold-funded per-role class tiers.
 */
export function legacyStatMultiplier(tier: number): number {
  return (1 + LEGACY_STAT_BONUS_PER_TIER) ** tier
}
