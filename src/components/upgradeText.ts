import type { Upgrade, UpgradeEffect } from '../game/types'

// What a set of bought ranks adds up to, in a few words ("+56% gold", "-20% voyage time"), for
// the skill tree's "now / after the next rank" line.

type Kind = UpgradeEffect['kind']

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Multipliers that are better when bigger, and what they boost. */
const UP: Partial<Record<Kind, string>> = {
  goldMultiplier: 'gold from victories',
  xpMultiplier: 'XP',
  infamyMultiplier: 'infamy',
  partyAttackMultiplier: 'attack',
  partyDefenseMultiplier: 'defense',
  partyHpMultiplier: 'max HP',
  partyHealMultiplier: 'healing',
  executionInfamyMultiplier: 'execution infamy',
  offlineTimeMultiplier: 'time per Skip Time gold',
  voyageGoldMultiplier: 'voyage gold',
}
/** Multipliers that are better when smaller. */
const DOWN: Partial<Record<Kind, string>> = {
  cooldownMultiplier: 'encounter cooldown',
  sailSpeedMultiplier: 'voyage time',
  roleTierCostMultiplier: 'role tier costs',
  recruitCostMultiplier: 'recruit cost',
  veteranCostMultiplier: 'veteran tier costs',
  enemyHpMultiplier: 'enemy HP',
}

export function describeTotal(owned: Upgrade[]): string {
  if (owned.length === 0) return 'Nothing yet'
  const kind = owned[0].effect.kind
  const values = owned.map((u) => ('value' in u.effect ? u.effect.value : 0))
  const product = values.reduce((a, b) => a * b, 1)
  const sum = values.reduce((a, b) => a + b, 0)
  if (UP[kind]) return `+${pct(product - 1)} ${UP[kind]}`
  if (DOWN[kind]) return `−${pct(1 - product)} ${DOWN[kind]}`
  switch (kind) {
    case 'tableSlotBonus':
      return `+${sum} table${sum === 1 ? '' : 's'}`
    case 'tableCapacityBonus':
      return `+${sum} seat${sum === 1 ? '' : 's'} per table`
    case 'shipSlotBonus':
      return `+${sum} ship slot${sum === 1 ? '' : 's'}`
    case 'artifactFindChanceBonus':
      return `+${pct(sum)} artifact chance`
    case 'partyRegenPercent':
      return `${pct(sum)} max HP regained per round`
    case 'cheatDeathChance':
      return `${pct(Math.min(0.6, sum))} chance to spare the fallen`
    case 'defeatGoldFraction':
      return `${pct(Math.min(0.75, sum))} of a lost fight's gold`
    case 'startingLevelBonus':
      return `+${sum} starting levels`
    case 'offlineCapHours':
      return `+${sum}h of time away caught up`
    default:
      return 'Unlocked'
  }
}
