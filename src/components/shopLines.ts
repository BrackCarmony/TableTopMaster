import { UPGRADES } from '../game/data/upgrades'
import { hasSailingUnlock } from '../game/engine'
import type { DMState, Upgrade, UpgradeEffect } from '../game/types'

// The shop groups its upgrades into lines (Faster Sessions I-IV, the three bigger tables...),
// so it can show just the next one in each instead of a wall of every tier at once.

/** Ship slots, sail speed and artifact finds are no use before Sailing itself is unlocked. */
const SAILING_KINDS: UpgradeEffect['kind'][] = ['shipSlotBonus', 'sailSpeedMultiplier', 'artifactFindChanceBonus']

export interface ShopLine {
  key: string
  currency: Upgrade['currency']
  items: Upgrade[]
  owned: number
  /** The first one not yet bought (null once the line is complete). */
  next: Upgrade | null
}

export function shopLines(dm: DMState): ShopLine[] {
  const sailing = hasSailingUnlock(dm)
  const lines = new Map<string, ShopLine>()
  for (const u of UPGRADES) {
    if (!sailing && SAILING_KINDS.includes(u.effect.kind)) continue
    const key = `${u.currency}:${u.effect.kind}`
    let line = lines.get(key)
    if (!line) {
      line = { key, currency: u.currency, items: [], owned: 0, next: null }
      lines.set(key, line)
    }
    line.items.push(u)
    if (dm.purchasedUpgradeIds.includes(u.id)) line.owned++
    else if (!line.next) line.next = u
  }
  return [...lines.values()]
}
