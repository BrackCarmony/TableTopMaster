import { describe, expect, it } from 'vitest'
import { createCharacterForPlayer, createPlayer } from './characters'
import type { CombatLogEvent } from './combat/types'
import { getModuleById } from './data/modules'
import { getTrophyQuality } from './data/trophies'
import { UPGRADES } from './data/upgrades'
import {
  BASE_COOLDOWN_MS,
  EXECUTION_GROWTH_RATE,
  EXECUTION_STARTING_TIER,
  MAX_COOLDOWN_SCALE,
  MIN_COOLDOWN_MS,
  computeInfamyReward,
  computeMultipliers,
  hasRoleSelectionUnlock,
  resolveEncounter,
} from './engine'
import { createRng } from './rng'
import type { Character, DMState, Player, Table } from './types'

describe('computeInfamyReward', () => {
  it('scales with the square root of lifetime gold', () => {
    const amount = computeInfamyReward(1000, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBe(Math.floor(Math.sqrt(100)))
  })

  it('grants at least 1 infamy per character even with low lifetime gold', () => {
    const amount = computeInfamyReward(0, 2, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBe(2)
  })

  it('applies the infamy multiplier and rounds', () => {
    const base = computeInfamyReward(1000, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    const boosted = computeInfamyReward(1000, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1.25 })
    expect(boosted).toBe(Math.max(1, Math.round(base * 1.25)))
  })

  it('never returns less than 1', () => {
    const amount = computeInfamyReward(0, 0, { gold: 1, xp: 1, cooldown: 1, infamy: 1 })
    expect(amount).toBeGreaterThanOrEqual(1)
  })
})

describe('cooldownMultiplier stacking', () => {
  it('every purchasable Faster Sessions tier still meaningfully reduces cooldown, not silently swallowed by the floor', () => {
    const cooldownUpgradeIds = UPGRADES.filter((u) => u.effect.kind === 'cooldownMultiplier').map((u) => u.id)
    expect(cooldownUpgradeIds.length).toBeGreaterThan(1) // otherwise this test proves nothing about stacking

    const dm = makeDm({ purchasedUpgradeIds: cooldownUpgradeIds })
    const multipliers = computeMultipliers(dm)
    const stackedCooldown = Math.max(MIN_COOLDOWN_MS, Math.round(BASE_COOLDOWN_MS * multipliers.cooldown))

    // Meaningfully above the floor, not just barely clipped to it — if a
    // future tier pushes this to (or near) MIN_COOLDOWN_MS, that tier is a
    // silent no-op and should be dropped or rebalanced instead of added.
    expect(stackedCooldown).toBeGreaterThan(MIN_COOLDOWN_MS * 1.5)
  })
})

function makeDm(overrides: Partial<DMState> = {}): DMState {
  return {
    name: 'DM',
    level: 1,
    gold: 0,
    infamy: 0,
    unlockedModuleIds: ['tarrasque-execution'],
    purchasedUpgradeIds: [],
    tableSlots: 1,
    executionTier: {},
    trophies: [],
    ...overrides,
  }
}

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: 't1',
    name: 'Table 1',
    assignedModuleId: 'tarrasque-execution',
    encounterIndex: 0,
    cooldownRemaining: 0,
    lifetimeGold: 0,
    lastBattleLog: null,
    lastBattleModuleName: null,
    lastBattleRewards: null,
    ...overrides,
  }
}

function makeSeatedPlayer(tableId: string, rng: ReturnType<typeof createRng>): Player {
  const player = createPlayer(rng)
  return { ...player, tableId, character: createCharacterForPlayer(player, rng) }
}

/** A character strong enough to one-shot the Tarrasque at any realistic tier, so victory tests are deterministic. */
function makeUnstoppableSeatedPlayer(tableId: string, rng: ReturnType<typeof createRng>): Player {
  const player = createPlayer(rng)
  const character: Character = {
    id: 'unstoppable-char',
    name: player.name,
    race: 'Human',
    className: 'Godslayer',
    role: 'dps',
    level: 99,
    xp: 0,
    maxHp: 999_999,
    attackPower: 999_999,
    defense: 999_999,
    healPower: 0,
    moveRange: 5,
    attackRange: 5,
    speed: 99,
    growthPerLevel: { maxHp: 0, attackPower: 0, defense: 0, healPower: 0 },
  }
  return { ...player, tableId, character }
}

function enemyMaxHpFromLog(log: CombatLogEvent[] | null): number {
  const start = log?.find((e) => e.type === 'encounter_start')
  if (!start || start.type !== 'encounter_start') throw new Error('no encounter_start in log')
  const enemy = start.units.find((u) => u.side === 'enemy')
  if (!enemy) throw new Error('no enemy in log')
  return enemy.maxHp
}

describe('resolveEncounter execution-module tier scaling', () => {
  it('does NOT raise the tier or grant a trophy when the party loses', () => {
    const rng = createRng(1)
    const table = makeTable()
    const seated = makeSeatedPlayer(table.id, rng)
    const result = resolveEncounter(table, [seated], makeDm(), rng)

    const start = result.table.lastBattleLog?.find((e) => e.type === 'encounter_end')
    expect(start && start.type === 'encounter_end' && start.outcome).toBe('defeat')
    expect(result.dm.executionTier['tarrasque-execution'] ?? 0).toBe(0)
    expect(result.dm.trophies).toHaveLength(0)
  })

  it('losing repeatedly never escalates it — only a win does', () => {
    const rng = createRng(1)
    const table = makeTable()
    let dm = makeDm()
    for (let i = 0; i < 3; i++) {
      const seated = makeSeatedPlayer(table.id, rng)
      const result = resolveEncounter({ ...table, assignedModuleId: 'tarrasque-execution' }, [seated], dm, rng)
      dm = result.dm
    }
    expect(dm.executionTier['tarrasque-execution'] ?? 0).toBe(0)
  })

  it('raises the tier and grants a trophy + Infamy bonus on a win', () => {
    const table = makeTable()
    const unstoppable = makeUnstoppableSeatedPlayer(table.id, createRng(2))
    const dm = makeDm({ infamy: 100 })
    const result = resolveEncounter(table, [unstoppable], dm, createRng(3))

    const end = result.table.lastBattleLog?.find((e) => e.type === 'encounter_end')
    expect(end && end.type === 'encounter_end' && end.outcome).toBe('victory')
    // A never-yet-won execution module starts at EXECUTION_STARTING_TIER,
    // not 0 — a fresh party can't just walk in and start racking up wins.
    expect(result.dm.executionTier['tarrasque-execution']).toBe(EXECUTION_STARTING_TIER + 1)
    expect(result.dm.trophies).toHaveLength(1)
    expect(result.dm.trophies[0].moduleId).toBe('tarrasque-execution')
    expect(result.dm.trophies[0].tierDefeated).toBe(EXECUTION_STARTING_TIER)
    expect(result.dm.infamy).toBeGreaterThan(dm.infamy)

    const tarrasque = getModuleById('tarrasque-execution')!
    expect(tarrasque.trophyParts).toContain(result.dm.trophies[0].part)
    expect(result.dm.trophies[0].quality).toBe(getTrophyQuality(EXECUTION_STARTING_TIER))
  })

  it('starts a never-yet-won module at EXECUTION_STARTING_TIER instead of tier 0', () => {
    const table = makeTable()
    const seated = makeSeatedPlayer(table.id, createRng(6))
    // makeDm() defaults to an empty executionTier map — i.e. never won yet.
    const result = resolveEncounter(table, [seated], makeDm(), createRng(7))

    const freshEnemyHp = enemyMaxHpFromLog(result.table.lastBattleLog)
    const baseHp = getModuleById('tarrasque-execution')!.encounters[0].enemies[0].hp
    expect(freshEnemyHp).toBe(Math.round(baseHp * EXECUTION_GROWTH_RATE ** EXECUTION_STARTING_TIER))
  })

  it('scales the next fight up based on the tier just won, not merely attempted', () => {
    const table = makeTable()
    const unstoppable = makeUnstoppableSeatedPlayer(table.id, createRng(4))

    const freshResult = resolveEncounter(table, [unstoppable], makeDm(), createRng(5))
    const freshEnemyHp = enemyMaxHpFromLog(freshResult.table.lastBattleLog)

    const rematch = resolveEncounter(
      { ...freshResult.table, assignedModuleId: 'tarrasque-execution' },
      [unstoppable],
      freshResult.dm,
      createRng(6),
    )
    expect(enemyMaxHpFromLog(rematch.table.lastBattleLog)).toBeGreaterThan(freshEnemyHp)
  })

  it('does not scale, tier-track, or grant trophies for campaign modules', () => {
    const table = makeTable({ assignedModuleId: 'goblin-ambush' })
    const seated = makeSeatedPlayer(table.id, createRng(7))
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })
    const result = resolveEncounter(table, [seated], dm, createRng(8))
    expect(result.dm.executionTier).toEqual({})
    expect(result.dm.trophies).toEqual([])
  })
})

describe('resolveEncounter stalemates', () => {
  it('grants XP but no gold when a fight stalls out at the round cap', () => {
    const table = makeTable({ assignedModuleId: 'goblin-ambush' })
    const rng = createRng(1)
    const player = createPlayer(rng)
    // Unreachable (range 0) so it can never land or take a killing blow —
    // guarantees neither side is ever wiped out, forcing a stalemate.
    const unreachableCharacter: Character = {
      id: 'unreachable-char',
      name: player.name,
      race: 'Human',
      className: 'Statue',
      role: 'tank',
      level: 1,
      xp: 0,
      maxHp: 999_999,
      attackPower: 0,
      defense: 999_999,
      healPower: 0,
      moveRange: 0,
      attackRange: 0,
      speed: 1,
      growthPerLevel: { maxHp: 0, attackPower: 0, defense: 0, healPower: 0 },
    }
    const seated: Player = { ...player, tableId: table.id, character: unreachableCharacter }
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })

    const result = resolveEncounter(table, [seated], dm, createRng(2))

    const end = result.table.lastBattleLog?.find((e) => e.type === 'encounter_end')
    expect(end && end.type === 'encounter_end' && end.outcome).toBe('stalemate')
    expect(result.table.lastBattleRewards).toEqual({ outcome: 'stalemate', xp: expect.any(Number), gold: 0, infamy: 0 })
    expect(result.table.lastBattleRewards!.xp).toBeGreaterThan(0)
    expect(result.dm.gold).toBe(dm.gold)

    const updatedPlayer = result.players.find((p) => p.id === seated.id)
    expect(updatedPlayer?.character?.xp).toBeGreaterThan(0)
  })
})

describe('resolveEncounter cooldown scales with fight length', () => {
  it('gives a fast, overwhelming win a discount below the base cooldown', () => {
    const table = makeTable({ assignedModuleId: 'goblin-ambush' })
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })
    const unstoppable = makeUnstoppableSeatedPlayer(table.id, createRng(1))

    const result = resolveEncounter(table, [unstoppable], dm, createRng(2))

    expect(result.table.lastBattleRewards?.outcome).toBe('victory')
    // A quick clear (well under PAR_ROUNDS) should cost noticeably less
    // than the old flat cooldown, but not necessarily hit the exact floor —
    // that depends on exactly how many rounds it took.
    expect(result.table.cooldownRemaining).toBeGreaterThanOrEqual(MIN_COOLDOWN_MS)
    expect(result.table.cooldownRemaining).toBeLessThan(BASE_COOLDOWN_MS)
  })

  it('gives a fight that drags out to the round cap the capped maximum cooldown', () => {
    const table = makeTable({ assignedModuleId: 'goblin-ambush' })
    const rng = createRng(1)
    const player = createPlayer(rng)
    // Unreachable (range 0) so the fight always runs the full round cap —
    // see the stalemate test above for why this guarantees that outcome.
    const unreachableCharacter: Character = {
      id: 'unreachable-char-2',
      name: player.name,
      race: 'Human',
      className: 'Statue',
      role: 'tank',
      level: 1,
      xp: 0,
      maxHp: 999_999,
      attackPower: 0,
      defense: 999_999,
      healPower: 0,
      moveRange: 0,
      attackRange: 0,
      speed: 1,
      growthPerLevel: { maxHp: 0, attackPower: 0, defense: 0, healPower: 0 },
    }
    const seated: Player = { ...player, tableId: table.id, character: unreachableCharacter }
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })

    const result = resolveEncounter(table, [seated], dm, createRng(2))

    expect(result.table.lastBattleRewards?.outcome).toBe('stalemate')
    // A stalemate always maxes out roundsElapsed, which is far beyond
    // PAR_ROUNDS — cooldown should hit the cap, not just the old flat value.
    expect(result.table.cooldownRemaining).toBe(BASE_COOLDOWN_MS * MAX_COOLDOWN_SCALE)
  })
})

describe('resolveEncounter partial casualties', () => {
  it('grants Infamy for a character who dies even when the table does not wipe', () => {
    const rng = createRng(4)
    const table = makeTable({ assignedModuleId: 'goblin-ambush' })
    // A one-hp tank (guaranteed to die to any landed hit, and placed in
    // front by role-aware positioning so it's the one goblins actually
    // reach) alongside an unkillable ally who single-handedly clears the
    // encounter — guarantees the table survives without an outright wipe.
    const fragileTank: Character = {
      id: 'fragile-tank-char',
      name: 'Fragile Tank',
      race: 'Human',
      className: 'Cannon Fodder',
      role: 'tank',
      level: 1,
      xp: 0,
      maxHp: 1,
      attackPower: 1,
      defense: 0,
      healPower: 0,
      moveRange: 3,
      attackRange: 1,
      speed: 5,
      growthPerLevel: { maxHp: 0, attackPower: 0, defense: 0, healPower: 0 },
    }
    const fragilePlayer: Player = { ...createPlayer(rng), tableId: table.id, character: fragileTank }
    // Same level as the fragile tank (even though wildly stronger in raw
    // stats) so the under-leveled-holds-back AI rule doesn't kick in and
    // change this ally's behavior — it needs to actively advance and clear
    // the encounter, not sit back.
    const unstoppableChar: Character = {
      id: 'unstoppable-char',
      name: 'Unstoppable',
      race: 'Human',
      className: 'Godslayer',
      role: 'dps',
      level: 1,
      xp: 0,
      maxHp: 999_999,
      attackPower: 999_999,
      defense: 999_999,
      healPower: 0,
      moveRange: 5,
      attackRange: 5,
      speed: 99,
      growthPerLevel: { maxHp: 0, attackPower: 0, defense: 0, healPower: 0 },
    }
    const unstoppable: Player = { ...createPlayer(rng), tableId: table.id, character: unstoppableChar }
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })

    const result = resolveEncounter(table, [fragilePlayer, unstoppable], dm, rng)

    const stillSeated = result.players.filter((p) => p.tableId === table.id)
    expect(stillSeated.length).toBe(1) // the fragile tank died, the unstoppable ally didn't
    expect(stillSeated[0].character?.id).toBe('unstoppable-char')

    expect(result.dm.infamy).toBeGreaterThan(dm.infamy)
    expect(result.table.lastBattleRewards!.infamy).toBe(result.dm.infamy - dm.infamy)
  })
})

describe('hasRoleSelectionUnlock', () => {
  it('is false until the upgrade is purchased', () => {
    expect(hasRoleSelectionUnlock(makeDm())).toBe(false)
  })

  it('is true once handpick-cast-1 is purchased', () => {
    expect(hasRoleSelectionUnlock(makeDm({ purchasedUpgradeIds: ['handpick-cast-1'] }))).toBe(true)
  })
})
