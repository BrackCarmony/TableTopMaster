import type { DMState } from '../types'
import { getUpgradeById } from './upgrades'

// The upgrades laid out as a skill tree. Each node is one ability with one or more ranks (the
// upgrades in `ranks`, bought in order); a node opens once the nodes it `requires` have reached
// the given rank. Branches are lanes read left to right; `at` is a node's [column, row] in its
// lane. Every upgrade in UPGRADES belongs to exactly one node (see upgradeTree.test.ts).

export type BranchId = 'table' | 'training' | 'party' | 'notoriety' | 'treasury' | 'seas' | 'deep'

export interface Branch {
  id: BranchId
  name: string
  icon: string
  /** What the branch is about, one line. */
  blurb: string
}

export const BRANCHES: Branch[] = [
  { id: 'table', name: 'The Table', icon: '🎲', blurb: 'Faster sessions, more rooms, bigger tables' },
  { id: 'party', name: 'The Party', icon: '⚔️', blurb: 'Every character fights harder' },
  { id: 'training', name: 'Training', icon: '🎓', blurb: 'Better recruits, cheaper growth' },
  { id: 'notoriety', name: 'Notoriety', icon: '💀', blurb: 'Infamy, and the fear it spreads' },
  { id: 'treasury', name: 'Treasury', icon: '💰', blurb: 'Gold, and time' },
  { id: 'seas', name: 'The Seas', icon: '⚓', blurb: 'Ships, voyages and artifacts' },
  { id: 'deep', name: 'The Deep', icon: '⛏️', blurb: 'Delving crews, cave-ins and relics' },
]

export interface TreeNode {
  id: string
  name: string
  icon: string
  branch: BranchId
  at: [number, number]
  /** Upgrade ids, rank 1 first. */
  ranks: string[]
  /** Other nodes that must reach a rank before this one opens. */
  requires?: { node: string; rank: number }[]
}

const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`)

export const TREE: TreeNode[] = [
  // The Table
  { id: 'sessions', name: 'Faster Sessions', icon: '⏳', branch: 'table', at: [0, 0], ranks: range('faster-sessions', 4) },
  { id: 'rooms', name: 'More Rooms', icon: '🚪', branch: 'table', at: [1, 0], ranks: range('extra-table', 4), requires: [{ node: 'sessions', rank: 1 }] },
  { id: 'chairs', name: 'More Chairs', icon: '🪑', branch: 'table', at: [2, 0], ranks: range('more-chairs', 3), requires: [{ node: 'rooms', rank: 1 }] },
  { id: 'handpick', name: 'Handpick Cast', icon: '🎭', branch: 'table', at: [1, 1], ranks: ['handpick-cast-1'], requires: [{ node: 'sessions', rank: 1 }] },
  { id: 'refill', name: 'Quick Refill', icon: '♻️', branch: 'table', at: [2, 1], ranks: ['quick-refill-1'], requires: [{ node: 'handpick', rank: 1 }] },
  { id: 'delegate', name: 'Delegate the Table', icon: '🤖', branch: 'table', at: [3, 1], ranks: ['auto-advance-1'], requires: [{ node: 'refill', rank: 1 }] },

  // The Party
  { id: 'whetstones', name: 'Whetstones', icon: '🗡️', branch: 'party', at: [0, 1], ranks: range('whetstones', 3) },
  { id: 'drills', name: 'Shield Drills', icon: '🛡️', branch: 'party', at: [1, 0], ranks: range('shield-drills', 3), requires: [{ node: 'whetstones', rank: 1 }] },
  { id: 'plot-armor', name: 'Plot Armor', icon: '🌟', branch: 'party', at: [2, 0], ranks: range('plot-armor', 3), requires: [{ node: 'drills', rank: 2 }] },
  { id: 'rations', name: 'Hearty Rations', icon: '🍖', branch: 'party', at: [1, 1], ranks: range('hearty-rations', 3), requires: [{ node: 'whetstones', rank: 1 }] },
  { id: 'camp-cook', name: 'Camp Cook', icon: '🍲', branch: 'party', at: [2, 1], ranks: range('camp-cook', 2), requires: [{ node: 'rations', rank: 2 }, { node: 'holy-water', rank: 1 }] },
  { id: 'holy-water', name: 'Holy Water', icon: '💧', branch: 'party', at: [1, 2], ranks: range('holy-water', 2), requires: [{ node: 'whetstones', rank: 1 }] },

  // Training
  { id: 'grimdark', name: 'Grimdark Setting', icon: '🌑', branch: 'training', at: [0, 0], ranks: range('grimdark-setting', 3) },
  { id: 'session-zero', name: 'Session Zero', icon: '📜', branch: 'training', at: [1, 0], ranks: range('session-zero', 3), requires: [{ node: 'grimdark', rank: 1 }] },
  { id: 'mentors', name: 'Class Mentors', icon: '🧑‍🏫', branch: 'training', at: [2, 0], ranks: range('class-mentors', 2), requires: [{ node: 'session-zero', rank: 1 }] },
  { id: 'notice-board', name: 'Notice Board', icon: '📌', branch: 'training', at: [1, 1], ranks: ['notice-board-1'], requires: [{ node: 'grimdark', rank: 1 }] },
  { id: 'hall', name: 'Hall of Heroes', icon: '🏛️', branch: 'training', at: [2, 1], ranks: range('hall-of-heroes', 2), requires: [{ node: 'notice-board', rank: 1 }] },

  // Notoriety
  { id: 'reputation', name: 'Reputation', icon: '🗣️', branch: 'notoriety', at: [0, 0], ranks: range('reputation-killer', 3) },
  { id: 'trophy-hunter', name: 'Trophy Hunter', icon: '🏆', branch: 'notoriety', at: [1, 0], ranks: range('trophy-hunter', 2), requires: [{ node: 'reputation', rank: 1 }] },
  { id: 'dread', name: 'Dread Reputation', icon: '👁️', branch: 'notoriety', at: [1, 1], ranks: range('dread-reputation', 2), requires: [{ node: 'reputation', rank: 2 }] },

  // Treasury
  { id: 'loot', name: 'Bigger Loot', icon: '💰', branch: 'treasury', at: [0, 0], ranks: range('bigger-loot', 4) },
  { id: 'salvage', name: 'Salvage Rights', icon: '🦴', branch: 'treasury', at: [1, 0], ranks: range('salvage-rights', 2), requires: [{ node: 'loot', rank: 1 }] },
  { id: 'recaps', name: 'Session Recaps', icon: '⏩', branch: 'treasury', at: [1, 1], ranks: range('session-recaps', 2), requires: [{ node: 'loot', rank: 2 }] },
  { id: 'weekends', name: 'Long Weekends', icon: '🏖️', branch: 'treasury', at: [2, 1], ranks: range('long-weekends', 2), requires: [{ node: 'recaps', rank: 1 }] },

  // The Seas
  { id: 'sail', name: 'Take to the Seas', icon: '⛵', branch: 'seas', at: [0, 1], ranks: ['sailing-unlock'] },
  { id: 'fleet', name: 'Expand the Fleet', icon: '🚢', branch: 'seas', at: [1, 0], ranks: range('more-ships', 6), requires: [{ node: 'sail', rank: 1 }] },
  { id: 'holds', name: 'Deep Holds', icon: '📦', branch: 'seas', at: [2, 0], ranks: range('deep-holds', 3), requires: [{ node: 'fleet', rank: 1 }] },
  { id: 'sails', name: 'Trim the Sails', icon: '🌬️', branch: 'seas', at: [1, 1], ranks: range('faster-sailing', 6), requires: [{ node: 'sail', rank: 1 }] },
  // The Deep (opens once you've taken to the seas and bought a second ship)
  { id: 'delve', name: 'Into the Underdark', icon: '⛏️', branch: 'deep', at: [0, 1], ranks: ['delving-unlock'], requires: [{ node: 'sail', rank: 1 }, { node: 'fleet', rank: 1 }] },
  { id: 'crews', name: 'Hire Crews', icon: '🪖', branch: 'deep', at: [1, 0], ranks: range('more-crews', 4), requires: [{ node: 'delve', rank: 1 }] },
  { id: 'timbers', name: 'Shoring Timbers', icon: '🪵', branch: 'deep', at: [1, 1], ranks: range('shoring-timbers', 3), requires: [{ node: 'delve', rank: 1 }] },
  { id: 'prospectors', name: 'Prospectors', icon: '💎', branch: 'deep', at: [2, 1], ranks: range('prospectors', 3), requires: [{ node: 'timbers', rank: 1 }] },
  { id: 'carts', name: 'Mine Carts', icon: '🛤️', branch: 'deep', at: [1, 2], ranks: range('mine-carts', 4), requires: [{ node: 'delve', rank: 1 }] },
  { id: 'veins', name: 'Rich Veins', icon: '⛰️', branch: 'deep', at: [2, 2], ranks: range('rich-veins', 3), requires: [{ node: 'carts', rank: 1 }] },
  { id: 'lookout', name: 'Lookouts', icon: '🔭', branch: 'seas', at: [1, 2], ranks: range('keen-eyed-lookout', 6), requires: [{ node: 'sail', rank: 1 }] },
]

const NODE_OF_UPGRADE = new Map<string, TreeNode>()
for (const n of TREE) for (const id of n.ranks) NODE_OF_UPGRADE.set(id, n)
const NODE_BY_ID = new Map(TREE.map((n) => [n.id, n]))

export function getNode(id: string): TreeNode | undefined {
  return NODE_BY_ID.get(id)
}

export function nodeOfUpgrade(upgradeId: string): TreeNode | undefined {
  return NODE_OF_UPGRADE.get(upgradeId)
}

/** How many of a node's ranks are bought. */
export function nodeRank(dm: DMState, node: TreeNode): number {
  return node.ranks.filter((id) => dm.purchasedUpgradeIds.includes(id)).length
}

/** The node's next rank to buy (the first not yet owned), or null when it's maxed. */
export function nextRankId(dm: DMState, node: TreeNode): string | null {
  return node.ranks.find((id) => !dm.purchasedUpgradeIds.includes(id)) ?? null
}

/** Requirements that aren't met yet (empty when the node is open). */
export function missingRequirements(dm: DMState, node: TreeNode): { node: TreeNode; rank: number }[] {
  return (node.requires ?? [])
    .map((r) => ({ node: NODE_BY_ID.get(r.node)!, rank: r.rank }))
    .filter((r) => !r.node || nodeRank(dm, r.node) < r.rank)
}

/**
 * Whether this upgrade can be bought now, gold and infamy aside: not owned, every earlier rank
 * of its node owned, and the node's requirements met.
 */
export function canBuyUpgrade(dm: DMState, upgradeId: string): boolean {
  if (dm.purchasedUpgradeIds.includes(upgradeId) || !getUpgradeById(upgradeId)) return false
  const node = NODE_OF_UPGRADE.get(upgradeId)
  if (!node) return false
  return nextRankId(dm, node) === upgradeId && missingRequirements(dm, node).length === 0
}
