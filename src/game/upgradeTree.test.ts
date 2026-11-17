import { describe, expect, it } from 'vitest'
import { createCharacterForPlayer, createPlayer } from './characters'
import type { CombatLogEvent } from './combat/types'
import { ISLANDS } from './data/islands'
import { BRANCHES, TREE, canBuyUpgrade, getNode, missingRequirements, nodeOfUpgrade } from './data/upgradeTree'
import { UPGRADES } from './data/upgrades'
import {
  AUTO_ADVANCE_CHECK_INTERVAL_MS,
  GOLD_PER_MS,
  MAX_OFFLINE_MS,
  computeUpgradeBonuses,
  maxOfflineMs,
  offlineProgressDurationMs,
  resolveEncounter,
  roleTierUnlockCost,
  startingLevelBonus,
  tickShips,
  veteranTierCost,
} from './engine'
import { legacyTierCost } from './data/legacy'
import { createRng } from './rng'
import type { DMState, Player, Ship, Table } from './types'

function makeDm(overrides: Partial<DMState> = {}): DMState {
  return {
    name: 'DM',
    level: 1,
    gold: 0,
    infamy: 0,
    unlockedModuleIds: ['goblin-ambush', 'tarrasque-execution'],
    purchasedUpgradeIds: [],
    tableSlots: 1,
    executionTier: {},
    trophies: [],
    discoveredArtifactIds: [],
    unlockedIslandIds: ['sunken-reef'],
    ...overrides,
  }
}

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: 't1',
    name: 'Table 1',
    assignedModuleId: 'goblin-ambush',
    encounterIndex: 0,
    cooldownRemaining: 0,
    lifetimeGold: 0,
    lastBattleLog: null,
    lastBattleModuleName: null,
    lastBattleRewards: null,
    lastWipeRoster: null,
    autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
    ...overrides,
  }
}

function party(seed: number, n = 4): Player[] {
  const rng = createRng(seed)
  return Array.from({ length: n }, () => {
    const p = createPlayer(rng)
    return { ...p, tableId: 't1', character: createCharacterForPlayer(p, rng) }
  })
}

const startOf = (log: CombatLogEvent[] | null) => {
  const e = log?.[0]
  if (!e || e.type !== 'encounter_start') throw new Error('no encounter_start')
  return e
}

describe('the upgrade tree', () => {
  it('holds every upgrade in exactly one node', () => {
    const seen = TREE.flatMap((n) => n.ranks)
    expect(new Set(seen).size).toBe(seen.length)
    expect([...seen].sort()).toEqual(UPGRADES.map((u) => u.id).sort())
  })

  it('only requires nodes that exist, at ranks they have, without loops', () => {
    for (const n of TREE)
      for (const r of n.requires ?? []) {
        const other = getNode(r.node)
        expect(other, `${n.id} requires ${r.node}`).toBeDefined()
        expect(r.rank).toBeGreaterThanOrEqual(1)
        expect(r.rank).toBeLessThanOrEqual(other!.ranks.length)
      }
    // Every node is reachable from the roots by buying things in order.
    const done = new Set<string>()
    let progress = true
    while (progress) {
      progress = false
      for (const n of TREE)
        if (!done.has(n.id) && (n.requires ?? []).every((r) => done.has(r.node))) {
          done.add(n.id)
          progress = true
        }
    }
    expect(done.size).toBe(TREE.length)
  })

  it('lays every node out in a known branch, one node per spot, with a root in each', () => {
    const spots = new Set<string>()
    for (const n of TREE) {
      expect(BRANCHES.some((b) => b.id === n.branch)).toBe(true)
      const key = `${n.branch}:${n.at[0]}:${n.at[1]}`
      expect(spots.has(key), key).toBe(false)
      spots.add(key)
    }
    for (const b of BRANCHES) expect(TREE.some((n) => n.branch === b.id && !n.requires?.length)).toBe(true)
  })

  it('sells ranks in order, and only once a node is open', () => {
    const fresh = makeDm()
    expect(canBuyUpgrade(fresh, 'faster-sessions-1')).toBe(true)
    expect(canBuyUpgrade(fresh, 'faster-sessions-2')).toBe(false) // rank 1 first
    expect(canBuyUpgrade(fresh, 'extra-table-1')).toBe(false) // needs Faster Sessions
    expect(missingRequirements(fresh, nodeOfUpgrade('extra-table-1')!).map((r) => r.node.id)).toEqual(['sessions'])

    const after = makeDm({ purchasedUpgradeIds: ['faster-sessions-1'] })
    expect(canBuyUpgrade(after, 'faster-sessions-1')).toBe(false) // owned
    expect(canBuyUpgrade(after, 'faster-sessions-2')).toBe(true)
    expect(canBuyUpgrade(after, 'extra-table-1')).toBe(true)
    expect(canBuyUpgrade(after, 'not-an-upgrade')).toBe(false)
  })
})

describe('the newer upgrade effects', () => {
  it('caps Plot Armor, Salvage Rights and Dread Reputation short of breaking the game', () => {
    const all = makeDm({ purchasedUpgradeIds: UPGRADES.map((u) => u.id) })
    const b = computeUpgradeBonuses(all)
    expect(b.cheatDeath).toBeLessThanOrEqual(0.6)
    expect(b.defeatGold).toBeLessThan(1)
    expect(b.enemyHp).toBeGreaterThanOrEqual(0.5)
  })

  it('makes every character at the table fight with the party upgrades', () => {
    const players = party(7)
    const plain = resolveEncounter(makeTable(), players, makeDm(), createRng(1))
    const kitted = resolveEncounter(
      makeTable(),
      players,
      makeDm({ purchasedUpgradeIds: ['whetstones-1', 'hearty-rations-1', 'shield-drills-1', 'camp-cook-1'] }),
      createRng(1),
    )
    const a = startOf(plain.table.lastBattleLog).units.filter((u) => u.side === 'party')
    const b = startOf(kitted.table.lastBattleLog).units.filter((u) => u.side === 'party')
    a.forEach((u, i) => {
      const v = b.find((x) => x.id === u.id)!
      expect(v.attackPower, `${i}`).toBe(Math.round(u.attackPower * 1.1))
      expect(v.maxHp).toBe(Math.round(u.maxHp * 1.1))
      expect(v.defense).toBe(Math.round(u.defense * 1.15))
      expect(v.selfRegenPercent ?? 0).toBeCloseTo((u.selfRegenPercent ?? 0) + 0.02)
    })
  })

  it('sends enemies in weakened by Dread Reputation, without cutting what they pay', () => {
    const players = party(3)
    const plain = resolveEncounter(makeTable(), players, makeDm(), createRng(2))
    const dread = resolveEncounter(makeTable(), players, makeDm({ purchasedUpgradeIds: ['dread-reputation-1'] }), createRng(2))
    const a = startOf(plain.table.lastBattleLog).units.filter((u) => u.side === 'enemy')
    const b = startOf(dread.table.lastBattleLog).units.filter((u) => u.side === 'enemy')
    a.forEach((u, i) => expect(b[i].maxHp).toBe(Math.max(1, Math.round(u.maxHp * 0.92))))
    if (plain.table.lastBattleRewards?.outcome === 'victory' && dread.table.lastBattleRewards?.outcome === 'victory')
      expect(dread.table.lastBattleRewards.gold).toBe(plain.table.lastBattleRewards.gold)
  })

  it('pays Salvage Rights gold when a party is wiped', () => {
    // A fresh party against the Tarrasque doesn't come back.
    const table = makeTable({ assignedModuleId: 'tarrasque-execution' })
    const wiped = resolveEncounter(table, party(4), makeDm(), createRng(3))
    expect(wiped.table.lastBattleRewards?.outcome).toBe('defeat')
    expect(wiped.dm.gold).toBe(0)
    const salvaged = resolveEncounter(table, party(4), makeDm({ purchasedUpgradeIds: ['salvage-rights-1'] }), createRng(3))
    expect(salvaged.table.lastBattleRewards?.gold).toBeGreaterThan(0)
    expect(salvaged.dm.gold).toBe(salvaged.table.lastBattleRewards!.gold)
  })

  it('spares some of the fallen with Plot Armor, who keep their seats', () => {
    const table = makeTable({ assignedModuleId: 'tarrasque-execution' })
    const dm = makeDm({ purchasedUpgradeIds: ['plot-armor-1', 'plot-armor-2', 'plot-armor-3'] })
    let spared = 0
    for (let seed = 1; seed <= 30; seed++) {
      const r = resolveEncounter(table, party(4), dm, createRng(seed))
      const n = r.table.lastBattleRewards?.spared ?? 0
      spared += n
      expect(r.players.filter((p) => p.tableId === 't1').length).toBe(n)
    }
    expect(spared).toBeGreaterThan(0)
  })

  it('discounts tiers, veterans and recruits, and adds starting levels', () => {
    const dm = makeDm({
      purchasedUpgradeIds: ['class-mentors-1', 'hall-of-heroes-1', 'notice-board-1', 'session-zero-1', 'session-zero-2'],
    })
    expect(roleTierUnlockCost(dm, 1000)).toBe(850)
    expect(roleTierUnlockCost(dm, 0)).toBe(0)
    expect(veteranTierCost(dm, 2)).toBe(Math.round(legacyTierCost(2) * 0.85))
    expect(startingLevelBonus(dm)).toBe(6)
    expect(computeUpgradeBonuses(dm).recruitCost).toBeCloseTo(0.6)
  })

  it('stretches Skip Time and the offline catch-up window', () => {
    const dm = makeDm({ purchasedUpgradeIds: ['session-recaps-1', 'long-weekends-1'] })
    expect(offlineProgressDurationMs(GOLD_PER_MS * 1000, dm)).toBe(1250)
    expect(offlineProgressDurationMs(GOLD_PER_MS * 1000)).toBe(1000)
    expect(maxOfflineMs(dm)).toBe(MAX_OFFLINE_MS + 8 * 60 * 60 * 1000)
  })

  it('fills the holds: more gold per voyage with Deep Holds', () => {
    const island = ISLANDS[0]
    const ship: Ship = { id: 's1', name: 'Ship', assignedIslandId: island.id, voyageRemaining: 1, lifetimeGold: 0 }
    const everything = { discoveredArtifactIds: island.artifactPool } // no artifact rolls in the way
    const plain = tickShips([ship], makeDm(everything), 2, createRng(1))
    const holds = tickShips([ship], makeDm({ ...everything, purchasedUpgradeIds: ['deep-holds-1'] }), 2, createRng(1))
    expect(plain.dm.gold).toBeGreaterThan(0)
    expect(holds.dm.gold).toBe(Math.round(plain.dm.gold * 1.5))
  })
})
