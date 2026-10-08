import { describe, expect, it } from 'vitest'
import { createCharacterForPlayer, createPlayer } from './characters'
import type { CombatLogEvent } from './combat/types'
import { ISLANDS } from './data/islands'
import { getModuleById } from './data/modules'
import { getTrophyQuality } from './data/trophies'
import { UPGRADES } from './data/upgrades'
import {
  AUTO_ADVANCE_CHECK_INTERVAL_MS,
  BASE_ARTIFACT_FIND_CHANCE,
  BASE_COOLDOWN_MS,
  EXECUTION_GROWTH_RATE,
  EXECUTION_STARTING_TIER,
  GOLD_PER_MS,
  MAX_COOLDOWN_SCALE,
  MIN_COOLDOWN_MS,
  OFFLINE_PROGRESS_GOLD_FRACTION,
  REPEAT_FIND_GOLD_FRACTION,
  computeArtifactBonuses,
  computeInfamyReward,
  CAMPAIGN_HARDENING_PER_TIER,
  campaignDifficultyMultiplier,
  computeMultipliers,
  hasAutoAdvanceUnlock,
  hasQuickRefillUnlock,
  hasRoleSelectionUnlock,
  hasSailingUnlock,
  offlineProgressDurationMs,
  resolveEncounter,
  tickShips,
  tickTable,
  tickTables,
} from './engine'
import { createRng } from './rng'
import type { Character, DMState, Player, Ship, Table } from './types'

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
    discoveredArtifactIds: [],
    unlockedIslandIds: ['sunken-reef'],
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
    lastWipeRoster: null,
    autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
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
    selfRegenPercent: 0,
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

function enemyHealPowerFromLog(log: CombatLogEvent[] | null): number {
  const start = log?.find((e) => e.type === 'encounter_start')
  if (!start || start.type !== 'encounter_start') throw new Error('no encounter_start in log')
  const enemy = start.units.find((u) => u.side === 'enemy')
  if (!enemy) throw new Error('no enemy in log')
  return enemy.healPower
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

  it('records lastWipeRoster (player id + role) on a full wipe, for Quick Refill', () => {
    const rng = createRng(1)
    const table = makeTable()
    const seated = makeSeatedPlayer(table.id, rng)
    const result = resolveEncounter(table, [seated], makeDm(), rng)

    expect(result.table.lastWipeRoster).toEqual([{ playerId: seated.id, role: seated.character!.role }])
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
    // The FIGHT starts elevated (see the difficulty-scaling test below), but
    // the very first real win still earns a first-rung reward — tier 0
    // quality/infamy, not tier EXECUTION_STARTING_TIER's. Difficulty and
    // reward are deliberately different numbers now.
    expect(result.dm.executionTier['tarrasque-execution']).toBe(1)
    expect(result.dm.trophies).toHaveLength(1)
    expect(result.dm.trophies[0].moduleId).toBe('tarrasque-execution')
    expect(result.dm.trophies[0].tierDefeated).toBe(0)
    expect(result.dm.infamy).toBeGreaterThan(dm.infamy)

    const tarrasque = getModuleById('tarrasque-execution')!
    expect(tarrasque.trophyParts).toContain(result.dm.trophies[0].part)
    expect(result.dm.trophies[0].quality).toBe(getTrophyQuality(0))
  })

  it('starts a never-yet-won module at EXECUTION_STARTING_TIER worth of difficulty, but not reward', () => {
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

  it('scales a second execution module\'s healPower along with its other stats, so a sustain boss stays sustaining at higher tiers', () => {
    const table = makeTable({ assignedModuleId: 'kraken-execution' })
    const seated = makeSeatedPlayer(table.id, createRng(8))
    const result = resolveEncounter(table, [seated], makeDm({ unlockedModuleIds: ['kraken-execution'] }), createRng(9))

    const freshHealPower = enemyHealPowerFromLog(result.table.lastBattleLog)
    const baseHealPower = getModuleById('kraken-execution')!.encounters[0].enemies[0].healPower
    expect(freshHealPower).toBe(Math.round(baseHealPower * EXECUTION_GROWTH_RATE ** EXECUTION_STARTING_TIER))
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
      selfRegenPercent: 0,
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
      selfRegenPercent: 0,
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
      selfRegenPercent: 0,
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
      selfRegenPercent: 0,
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

  it('adds a partial casualty to lastWipeRoster too, so Quick Refill can bring them back without a full wipe', () => {
    const rng = createRng(4)
    // A pre-existing, unrelated stale entry (from some earlier full wipe at
    // this table) that should survive untouched — pruning only removes
    // entries for players who are part of THIS fight.
    const staleEntry = { playerId: 'someone-else', role: 'healer' as const }
    const table = makeTable({ assignedModuleId: 'goblin-ambush', lastWipeRoster: [staleEntry] })
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
      selfRegenPercent: 0,
    }
    const fragilePlayer: Player = { ...createPlayer(rng), tableId: table.id, character: fragileTank }
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
      selfRegenPercent: 0,
    }
    const unstoppable: Player = { ...createPlayer(rng), tableId: table.id, character: unstoppableChar }
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })

    const result = resolveEncounter(table, [fragilePlayer, unstoppable], dm, rng)

    // The unrelated stale entry survives, and the fragile tank who just died
    // this fight (a partial casualty, not a full wipe) gets added — the
    // survivor never appears, since it never needed refilling.
    expect(result.table.lastWipeRoster).toEqual([staleEntry, { playerId: fragilePlayer.id, role: 'tank' }])
  })

  it('drops a table\'s stale lastWipeRoster entry once that player is back and fighting again, even if nobody dies this time', () => {
    const rng = createRng(4)
    const table = makeTable({
      assignedModuleId: 'goblin-ambush',
      lastWipeRoster: [{ playerId: 'reseated-player', role: 'tank' as const }],
    })
    const unstoppableChar: Character = {
      id: 'unstoppable-char-3',
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
      selfRegenPercent: 0,
    }
    // Same player id as the stale entry — they were quick-refilled (or
    // reseated by hand) and are now back in the fight, alive and well.
    const reseatedPlayer: Player = { ...createPlayer(rng), id: 'reseated-player', tableId: table.id, character: unstoppableChar }
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })

    const result = resolveEncounter(table, [reseatedPlayer], dm, rng)

    expect(result.table.lastWipeRoster).toBeNull()
  })

  it('leaves lastWipeRoster untouched when the table does not fully wipe', () => {
    const rng = createRng(4)
    const priorWipeRoster = [{ playerId: 'someone-else', role: 'healer' as const }]
    const table = makeTable({ assignedModuleId: 'goblin-ambush', lastWipeRoster: priorWipeRoster })
    const unstoppableChar: Character = {
      id: 'unstoppable-char-2',
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
      selfRegenPercent: 0,
    }
    const unstoppable: Player = { ...createPlayer(rng), tableId: table.id, character: unstoppableChar }
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })

    const result = resolveEncounter(table, [unstoppable], dm, rng)

    expect(result.table.lastWipeRoster).toEqual(priorWipeRoster)
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

describe('hasQuickRefillUnlock', () => {
  it('is false until the upgrade is purchased', () => {
    expect(hasQuickRefillUnlock(makeDm())).toBe(false)
  })

  it('is true once quick-refill-1 is purchased', () => {
    expect(hasQuickRefillUnlock(makeDm({ purchasedUpgradeIds: ['quick-refill-1'] }))).toBe(true)
  })
})

describe('hasSailingUnlock', () => {
  it('is false until sailing-unlock is purchased', () => {
    expect(hasSailingUnlock(makeDm())).toBe(false)
  })

  it('is true once sailing-unlock is purchased', () => {
    expect(hasSailingUnlock(makeDm({ purchasedUpgradeIds: ['sailing-unlock'] }))).toBe(true)
  })
})

describe('hasAutoAdvanceUnlock', () => {
  it('is false until auto-advance-1 is purchased', () => {
    expect(hasAutoAdvanceUnlock(makeDm())).toBe(false)
  })

  it('is true once auto-advance-1 is purchased', () => {
    expect(hasAutoAdvanceUnlock(makeDm({ purchasedUpgradeIds: ['auto-advance-1'] }))).toBe(true)
  })
})

describe('tickTable Auto-Advance periodic check', () => {
  // A huge cooldownRemaining keeps tickTable's own encounter loop from
  // running at all, so only the periodic Auto-Advance check is exercised —
  // the table's lastBattleRewards/lastBattleModuleName stay exactly what the
  // test set them to.
  const NO_ENCOUNTER_COOLDOWN = 999_999_999

  function makeAutoAdvanceDm(): DMState {
    return makeDm({
      purchasedUpgradeIds: ['auto-advance-1'],
      unlockedModuleIds: ['titans-forge', 'undying-court', 'shattered-heavens'],
    })
  }

  it('does nothing before the interval elapses, just counts the interval down', () => {
    const table = makeTable({
      assignedModuleId: 'undying-court',
      cooldownRemaining: NO_ENCOUNTER_COOLDOWN,
      lastBattleModuleName: 'The Court of the Undying King',
      lastBattleRewards: { outcome: 'victory', xp: 100, gold: 100, infamy: 0 },
      autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
    })
    const result = tickTable(table, [], makeAutoAdvanceDm(), 1000, createRng(1))

    expect(result.table.assignedModuleId).toBe('undying-court')
    expect(result.table.autoAdvanceCheckRemaining).toBe(AUTO_ADVANCE_CHECK_INTERVAL_MS - 1000)
  })

  it('climbs to the next unlocked tier once the interval elapses on a flawless victory', () => {
    const table = makeTable({
      assignedModuleId: 'undying-court',
      cooldownRemaining: NO_ENCOUNTER_COOLDOWN,
      lastBattleModuleName: 'The Court of the Undying King',
      lastBattleRewards: { outcome: 'victory', xp: 100, gold: 100, infamy: 0 },
      autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
    })
    const result = tickTable(table, [], makeAutoAdvanceDm(), AUTO_ADVANCE_CHECK_INTERVAL_MS, createRng(1))

    expect(result.table.assignedModuleId).toBe('shattered-heavens')
    expect(result.table.encounterIndex).toBe(0)
    expect(result.table.autoAdvanceCheckRemaining).toBe(AUTO_ADVANCE_CHECK_INTERVAL_MS)
  })

  it('retreats to the previous tier once the interval elapses after any casualty', () => {
    const table = makeTable({
      assignedModuleId: 'undying-court',
      cooldownRemaining: NO_ENCOUNTER_COOLDOWN,
      lastBattleModuleName: 'The Court of the Undying King',
      lastBattleRewards: { outcome: 'victory', xp: 100, gold: 100, infamy: 5 },
      autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
    })
    const result = tickTable(table, [], makeAutoAdvanceDm(), AUTO_ADVANCE_CHECK_INTERVAL_MS, createRng(1))

    expect(result.table.assignedModuleId).toBe('titans-forge')
    expect(result.table.encounterIndex).toBe(0)
  })

  it('retreats to the previous tier after an outright defeat too', () => {
    const table = makeTable({
      assignedModuleId: 'undying-court',
      cooldownRemaining: NO_ENCOUNTER_COOLDOWN,
      lastBattleModuleName: 'The Court of the Undying King',
      lastBattleRewards: { outcome: 'defeat', xp: 0, gold: 0, infamy: 0 },
      autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
    })
    const result = tickTable(table, [], makeAutoAdvanceDm(), AUTO_ADVANCE_CHECK_INTERVAL_MS, createRng(1))

    expect(result.table.assignedModuleId).toBe('titans-forge')
  })

  it('ignores a recorded result left over from a since-reassigned module', () => {
    const table = makeTable({
      assignedModuleId: 'undying-court',
      cooldownRemaining: NO_ENCOUNTER_COOLDOWN,
      // Stale: this result was recorded against a different module than the
      // one currently assigned (e.g. from right before a reassignment).
      lastBattleModuleName: "The Titan's Forge",
      lastBattleRewards: { outcome: 'victory', xp: 100, gold: 100, infamy: 0 },
      autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
    })
    const result = tickTable(table, [], makeAutoAdvanceDm(), AUTO_ADVANCE_CHECK_INTERVAL_MS, createRng(1))

    expect(result.table.assignedModuleId).toBe('undying-court')
    // The check still fired and reset its own countdown, even though it made
    // no adjustment.
    expect(result.table.autoAdvanceCheckRemaining).toBe(AUTO_ADVANCE_CHECK_INTERVAL_MS)
  })

  it('makes at most one adjustment per call, even when dtMs spans many intervals at once', () => {
    const table = makeTable({
      assignedModuleId: 'undying-court',
      cooldownRemaining: NO_ENCOUNTER_COOLDOWN,
      lastBattleModuleName: 'The Court of the Undying King',
      lastBattleRewards: { outcome: 'victory', xp: 100, gold: 100, infamy: 0 },
      autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
    })
    const result = tickTable(table, [], makeAutoAdvanceDm(), AUTO_ADVANCE_CHECK_INTERVAL_MS * 10, createRng(1))

    // Not 'the-last-throne' or any tier beyond the immediate next one — a
    // single stale sample only ever earns one nudge, however large the gap.
    expect(result.table.assignedModuleId).toBe('shattered-heavens')
  })

  it('does nothing once already at the highest unlocked tier on a flawless victory', () => {
    const table = makeTable({
      assignedModuleId: 'shattered-heavens',
      cooldownRemaining: NO_ENCOUNTER_COOLDOWN,
      lastBattleModuleName: 'The Shattered Heavens',
      lastBattleRewards: { outcome: 'victory', xp: 100, gold: 100, infamy: 0 },
      autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
    })
    const result = tickTable(table, [], makeAutoAdvanceDm(), AUTO_ADVANCE_CHECK_INTERVAL_MS, createRng(1))

    expect(result.table.assignedModuleId).toBe('shattered-heavens')
  })

  it('is a no-op entirely when the perk has not been purchased', () => {
    const table = makeTable({
      assignedModuleId: 'undying-court',
      cooldownRemaining: NO_ENCOUNTER_COOLDOWN,
      lastBattleModuleName: 'The Court of the Undying King',
      lastBattleRewards: { outcome: 'victory', xp: 100, gold: 100, infamy: 0 },
      autoAdvanceCheckRemaining: AUTO_ADVANCE_CHECK_INTERVAL_MS,
    })
    const result = tickTable(table, [], makeDm(), AUTO_ADVANCE_CHECK_INTERVAL_MS, createRng(1))

    expect(result.table.assignedModuleId).toBe('undying-court')
    expect(result.table.autoAdvanceCheckRemaining).toBe(AUTO_ADVANCE_CHECK_INTERVAL_MS)
  })
})

describe('campaign difficulty hardening', () => {
  it('leaves the first three tiers untouched and compounds per tier after that', () => {
    expect(campaignDifficultyMultiplier(1)).toBe(1)
    expect(campaignDifficultyMultiplier(3)).toBe(1)
    expect(campaignDifficultyMultiplier(4)).toBeCloseTo(CAMPAIGN_HARDENING_PER_TIER)
    expect(campaignDifficultyMultiplier(6)).toBeCloseTo(CAMPAIGN_HARDENING_PER_TIER ** 3)
  })

  it('makes tier 4+ enemies tougher in the fight without raising the gold/XP reward', () => {
    const hardModule = getModuleById('dragons-peak')! // tier 4
    const easyModule = getModuleById('sunken-crypt')! // tier 3
    expect(campaignDifficultyMultiplier(hardModule.tier)).toBeGreaterThan(1)
    expect(campaignDifficultyMultiplier(easyModule.tier)).toBe(1)

    const dm = makeDm({ unlockedModuleIds: [hardModule.id, easyModule.id] })

    const hardTable = makeTable({ assignedModuleId: hardModule.id })
    const hard = resolveEncounter(hardTable, [makeUnstoppableSeatedPlayer(hardTable.id, createRng(2))], dm, createRng(3))
    const baseHp = hardModule.encounters[0].enemies[0].hp
    expect(enemyMaxHpFromLog(hard.table.lastBattleLog)).toBe(Math.round(baseHp * campaignDifficultyMultiplier(hardModule.tier)))

    // Same payout as the authored (unhardened) encounter would give.
    const rawPower = hardModule.encounters[0].enemies.reduce((sum, e) => sum + e.hp / 10 + e.attackPower + e.defense + e.healPower, 0)
    expect(hard.table.lastBattleRewards!.gold).toBe(Math.round(rawPower * 2.5))

    const easyTable = makeTable({ assignedModuleId: easyModule.id })
    const easy = resolveEncounter(easyTable, [makeUnstoppableSeatedPlayer(easyTable.id, createRng(2))], dm, createRng(3))
    expect(enemyMaxHpFromLog(easy.table.lastBattleLog)).toBe(easyModule.encounters[0].enemies[0].hp)
  })
})

describe('tickTable campaign fast-forward', () => {
  it('never fast-forwards execution modules — each attempt is still simulated for real, so escalating difficulty eventually catches up', () => {
    const table = makeTable({ assignedModuleId: 'tarrasque-execution', cooldownRemaining: 0 })
    const rng = createRng(1)
    const unstoppable = makeUnstoppableSeatedPlayer(table.id, rng)
    const dm = makeDm({ unlockedModuleIds: ['tarrasque-execution'] })
    // Comfortably long enough for tarrasque's 2x-per-win escalation to catch
    // up with even a fixed "unstoppable" character (roughly a dozen wins).
    const elapsed = 5000 * 500

    const { tables, dm: nextDm } = tickTables([table], [unstoppable], dm, elapsed, rng)

    const winCount = nextDm.executionTier['tarrasque-execution'] ?? 0
    expect(winCount).toBeGreaterThan(0)
    // If this had been (incorrectly) fast-forwarded the way a campaign
    // module is, the escalating difficulty would never have caught up, and
    // the table would still show as assigned mid-streak instead of having
    // wiped and cleared its module.
    expect(tables[0].assignedModuleId).toBeNull()
  })

  it('breaks the fast-forward streak on a partial casualty instead of skipping past a real death', () => {
    const rng = createRng(4)
    const table = makeTable({ assignedModuleId: 'goblin-ambush', cooldownRemaining: 0 })
    // A one-hp tank that's guaranteed to die to any landed hit, so every
    // "win" here is a partial casualty, never flawless — the module should
    // never accumulate a confirmed lap.
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
      selfRegenPercent: 0,
    }
    const unstoppableChar: Character = {
      id: 'unstoppable-char-4',
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
      selfRegenPercent: 0,
    }
    const fragilePlayer: Player = { ...createPlayer(rng), tableId: table.id, character: fragileTank }
    const unstoppable: Player = { ...createPlayer(rng), tableId: table.id, character: unstoppableChar }
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })

    const result = tickTable(table, [fragilePlayer, unstoppable], dm, 5000 * 50, rng)

    // The fragile tank is benched (dead), never re-seated by anything in
    // this test — a fast-forward bug would apply the SAME lump reward to
    // every originally-seated player regardless, which this can't produce
    // since the tank never got a fresh character back.
    const tankAfter = result.players.find((p) => p.id === fragilePlayer.id)
    expect(tankAfter?.tableId).toBeNull()
    expect(tankAfter?.character).toBeNull()
  })

  it('still levels up characters correctly across a fast-forwarded run', () => {
    const table = makeTable({ assignedModuleId: 'goblin-ambush', cooldownRemaining: 0 })
    const rng = createRng(9)
    // Overwhelming enough to guarantee flawless wins (so fast-forward
    // engages), but with a real, nonzero growthPerLevel so leveling is
    // actually observable — unlike the "unstoppable" fixture elsewhere in
    // this file, which starts at level 99 with zero growth.
    const strongChar: Character = {
      id: 'strong-char',
      name: 'Strong',
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
      growthPerLevel: { maxHp: 10, attackPower: 5, defense: 5, healPower: 0 },
      selfRegenPercent: 0,
    }
    const player = createPlayer(rng)
    const seated: Player = { ...player, tableId: table.id, character: strongChar }
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })
    // Long enough to blow well past the old 2000-encounter-per-tick cap.
    const elapsed = 5000 * 2 * 5000

    const { players } = tickTable(table, [seated], dm, elapsed, rng)

    const after = players.find((p) => p.id === seated.id)
    expect(after?.character?.level ?? 1).toBeGreaterThan(1)
  })
})

describe('computeArtifactBonuses', () => {
  it('grants nothing with no artifacts discovered', () => {
    const bonuses = computeArtifactBonuses(makeDm())
    expect(bonuses.tankExtraTurn).toBe(false)
    expect(bonuses.healerRevive).toBe(false)
    expect(bonuses.dpsExtraRangeBonus).toBe(0)
  })

  it('maps each discovered artifact to its own bonus', () => {
    const bonuses = computeArtifactBonuses(
      makeDm({ discoveredArtifactIds: ['defensive-rush', 'revivify', 'extra-range'] }),
    )
    expect(bonuses.tankExtraTurn).toBe(true)
    expect(bonuses.healerRevive).toBe(true)
    expect(bonuses.healerReviveHpFraction).toBe(0.5)
    expect(bonuses.dpsExtraRangeBonus).toBe(1)
  })

  it('ignores an unknown artifact id instead of throwing', () => {
    expect(() => computeArtifactBonuses(makeDm({ discoveredArtifactIds: ['not-a-real-artifact'] }))).not.toThrow()
  })

  it('sums stacking percentage artifacts (Stoneskin + Juggernaut\'s Hide, Armor Piercer + Ruinous Edge, Overflowing Font + Wellspring)', () => {
    const bonuses = computeArtifactBonuses(
      makeDm({ discoveredArtifactIds: ['stoneskin', 'juggernauts-hide', 'armor-piercer', 'ruinous-edge', 'overflowing-font', 'wellspring-of-life'] }),
    )
    expect(bonuses.tankDamageReductionPercent).toBeCloseTo(0.15 + 0.25)
    expect(bonuses.dpsDefensePiercePercent).toBeCloseTo(0.3 + 0.5)
    expect(bonuses.healerHealPowerBonusPercent).toBeCloseTo(0.3 + 0.5)
  })

  it('sums Cleave/Ricochet/Chain Mending target counts and damage/heal percents across both tiers', () => {
    const bonuses = computeArtifactBonuses(
      makeDm({
        discoveredArtifactIds: [
          'cleaving-strikes', 'whirling-cleave',
          'ricochet-shot', 'ricochet-barrage',
          'chain-mending', 'cascading-mending',
        ],
      }),
    )
    expect(bonuses.tankBonusTargetsOnHit).toBe(2)
    expect(bonuses.tankBonusTargetDamagePercent).toBeCloseTo(0.5 + 0.75)
    expect(bonuses.dpsBonusTargetsOnHit).toBe(2)
    expect(bonuses.dpsBonusTargetDamagePercent).toBeCloseTo(0.5 + 0.75)
    expect(bonuses.healerBonusTargetsOnHeal).toBe(2)
    expect(bonuses.healerBonusHealPercent).toBeCloseTo(0.5 + 0.75)
  })

  it('sums Grim Endurance/Rising Fury/Enduring Grace per-round ramps across both tiers', () => {
    const bonuses = computeArtifactBonuses(
      makeDm({
        discoveredArtifactIds: [
          'grim-endurance', 'unyielding-resolve',
          'rising-fury', 'relentless-fury',
          'enduring-grace', 'boundless-grace',
        ],
      }),
    )
    expect(bonuses.tankDamageReductionRampPercent).toBeCloseTo(0.02 + 0.03)
    expect(bonuses.dpsAttackPowerRampPercent).toBeCloseTo(0.03 + 0.05)
    expect(bonuses.healerHealPowerRampPercent).toBeCloseTo(0.03 + 0.05)
  })
})

function makeShip(overrides: Partial<Ship> = {}): Ship {
  return { id: 'ship-1', name: 'Ship 1', assignedIslandId: null, voyageRemaining: 0, lifetimeGold: 0, ...overrides }
}

describe('tickShips', () => {
  const island = ISLANDS[0]

  it('leaves an unassigned ship untouched', () => {
    const dm = makeDm()
    const { ships, dm: nextDm } = tickShips([makeShip()], dm, 999_999, createRng(1))
    expect(ships[0]).toEqual(makeShip())
    expect(nextDm).toEqual(dm)
  })

  it('counts down voyageRemaining without resolving early', () => {
    const ship = makeShip({ assignedIslandId: island.id, voyageRemaining: island.baseVoyageDurationMs })
    const { ships, dm } = tickShips([ship], makeDm(), 1000, createRng(1))
    expect(ships[0].voyageRemaining).toBe(island.baseVoyageDurationMs - 1000)
    expect(dm.gold).toBe(0) // voyage hasn't completed yet
  })

  it('pays out gold and resets the voyage (auto-repeat) when it completes', () => {
    const ship = makeShip({ assignedIslandId: island.id, voyageRemaining: 100 })
    // Seed picked to roll above the base find chance, so this run is a pure gold-only voyage.
    const dm = makeDm({ discoveredArtifactIds: [] })
    const { ships, dm: nextDm } = tickShips([ship], dm, 100, createRng(999))
    expect(nextDm.gold).toBe(island.baseGoldReward)
    expect(ships[0].voyageRemaining).toBe(island.baseVoyageDurationMs) // auto-repeats
    expect(ships[0].lifetimeGold).toBe(island.baseGoldReward)
  })

  it('resolves multiple completed voyages within one large tick (offline catch-up)', () => {
    const ship = makeShip({ assignedIslandId: island.id, voyageRemaining: island.baseVoyageDurationMs })
    const dm = makeDm()
    const elapsed = island.baseVoyageDurationMs * 3 + 500
    const { ships, dm: nextDm } = tickShips([ship], dm, elapsed, createRng(1))
    expect(ships[0].lifetimeGold).toBeGreaterThanOrEqual(island.baseGoldReward * 3)
    expect(nextDm.gold).toBeGreaterThanOrEqual(island.baseGoldReward * 3)
  })

  it('never adds a duplicate artifact id across many completed voyages, and always pays out at least base gold per voyage', () => {
    const ship = makeShip({ assignedIslandId: island.id, voyageRemaining: island.baseVoyageDurationMs })
    const numVoyages = 30
    const elapsed = island.baseVoyageDurationMs * numVoyages
    const { dm } = tickShips([ship], makeDm(), elapsed, createRng(42))

    expect(dm.gold).toBeGreaterThanOrEqual(island.baseGoldReward * numVoyages)
    expect(new Set(dm.discoveredArtifactIds).size).toBe(dm.discoveredArtifactIds.length)
    expect(dm.discoveredArtifactIds.length).toBeLessThanOrEqual(island.artifactPool.length)
    // ~15% base find chance over 30 voyages makes it overwhelmingly likely
    // the discovery path actually ran at least once — a hard guarantee would
    // need to stub the RNG, which isn't worth it here.
    expect(dm.discoveredArtifactIds.length).toBeGreaterThan(0)
  })

  it('applies the artifactFindChanceBonus and sailSpeedMultiplier upgrades', () => {
    const boostedDm = makeDm({ purchasedUpgradeIds: ['keen-eyed-lookout-1', 'faster-sailing-1'] })
    const ship = makeShip({ assignedIslandId: island.id, voyageRemaining: island.baseVoyageDurationMs })
    const { ships } = tickShips([ship], boostedDm, island.baseVoyageDurationMs, createRng(1))
    // faster-sailing-1 is a 0.85x multiplier, so the repeated voyage should be shorter than base.
    expect(ships[0].voyageRemaining).toBeLessThan(island.baseVoyageDurationMs)
  })

  describe('fast path once every artifact is already discovered', () => {
    it('matches the expected-value gold total for a huge number of voyages, computed instantly instead of looped one at a time', () => {
      const ship = makeShip({ assignedIslandId: island.id, voyageRemaining: island.baseVoyageDurationMs })
      const dm = makeDm({ discoveredArtifactIds: [...island.artifactPool] })
      const numVoyages = 500_000 // far beyond MAX_OFFLINE_VOYAGES_PER_SHIP taken one at a time
      const elapsed = island.baseVoyageDurationMs * numVoyages

      const start = Date.now()
      const { ships, dm: nextDm } = tickShips([ship], dm, elapsed, createRng(7))
      expect(Date.now() - start).toBeLessThan(200) // would take ages if it were still looping per voyage

      // The very first (in-flight) voyage still rolls for real, so it's
      // either base gold or base+consolation — every voyage after that uses
      // the fixed expected value, so the total is tightly bounded either way.
      const consolation = Math.round(island.baseGoldReward * REPEAT_FIND_GOLD_FRACTION)
      const expectedPerVoyage = island.baseGoldReward + island.baseGoldReward * BASE_ARTIFACT_FIND_CHANCE * REPEAT_FIND_GOLD_FRACTION
      const minTotal = island.baseGoldReward + Math.round((numVoyages - 1) * expectedPerVoyage)
      const maxTotal = island.baseGoldReward + consolation + Math.round((numVoyages - 1) * expectedPerVoyage)

      expect(nextDm.gold).toBeGreaterThanOrEqual(minTotal)
      expect(nextDm.gold).toBeLessThanOrEqual(maxTotal)
      expect(ships[0].lifetimeGold).toBe(nextDm.gold)
      // No new artifacts to find — the discovered set never changes.
      expect(nextDm.discoveredArtifactIds.sort()).toEqual([...island.artifactPool].sort())
    })

    it('still discovers artifacts for real while any remain, only switching to the fast path once the pool is exhausted', () => {
      const ship = makeShip({ assignedIslandId: island.id, voyageRemaining: island.baseVoyageDurationMs })
      // Start one artifact short of a full pool.
      const dm = makeDm({ discoveredArtifactIds: island.artifactPool.slice(0, island.artifactPool.length - 1) })
      const elapsed = island.baseVoyageDurationMs * 2000

      const { dm: nextDm } = tickShips([ship], dm, elapsed, createRng(3))

      expect(nextDm.discoveredArtifactIds.sort()).toEqual([...island.artifactPool].sort())
    })

    it('leaves voyageRemaining counting down correctly when the fast path only partially consumes the tick', () => {
      const ship = makeShip({ assignedIslandId: island.id, voyageRemaining: island.baseVoyageDurationMs })
      const dm = makeDm({ discoveredArtifactIds: [...island.artifactPool] })
      // Less than one full voyage's worth of time.
      const elapsed = island.baseVoyageDurationMs - 1000

      const { ships, dm: nextDm } = tickShips([ship], dm, elapsed, createRng(1))

      expect(ships[0].voyageRemaining).toBe(1000)
      expect(nextDm.gold).toBe(0)
    })
  })
})

describe('offlineProgressDurationMs', () => {
  it('scales linearly with gold spent', () => {
    expect(offlineProgressDurationMs(GOLD_PER_MS * 1000)).toBe(1000)
    expect(offlineProgressDurationMs(GOLD_PER_MS * 2000)).toBe(2000)
  })

  it('rounds down rather than ever overcrediting time for a given spend', () => {
    expect(offlineProgressDurationMs(GOLD_PER_MS + 1)).toBe(1)
  })

  it('roughly matches the "~1 trillion gold buys ~2 days" calibration target', () => {
    const cost = Math.round(1_000_000_000_000 * OFFLINE_PROGRESS_GOLD_FRACTION * 10) // several 10%-of-current purchases in a row, approximated as spending the whole balance
    const days = offlineProgressDurationMs(cost) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThan(1)
    expect(days).toBeLessThan(4)
  })
})

describe('tickTables offline-catch-up iteration cap', () => {
  it('can resolve well more than the old 2000-encounter-per-tick cap when given enough simulated time', () => {
    const OLD_CAP = 2000
    const table = makeTable({ assignedModuleId: 'goblin-ambush', cooldownRemaining: 0 })
    const rng = createRng(1)
    const unstoppable = makeUnstoppableSeatedPlayer(table.id, rng)
    const dm = makeDm({ unlockedModuleIds: ['goblin-ambush'] })

    // goldReward for a clean win is a pure function of the (fixed) module
    // encounter, not of RNG — deterministic regardless of seed.
    const singleWin = resolveEncounter(table, [unstoppable], dm, createRng(1))
    const goldPerWin = singleWin.table.lastBattleRewards!.gold
    expect(goldPerWin).toBeGreaterThan(0)

    // A generous, worst-case-cooldown-per-win estimate for well over 2000
    // wins — the exact resulting win count isn't the point, only that it
    // clears the old cap by a wide margin, proving the raised limit is what
    // actually let this many resolve in one call instead of the elapsed
    // time simply running out first.
    const worstCaseCooldownPerWin = BASE_COOLDOWN_MS * MAX_COOLDOWN_SCALE
    const elapsed = worstCaseCooldownPerWin * (OLD_CAP + 2000)
    const { tables } = tickTables([table], [unstoppable], dm, elapsed, rng)

    expect(tables[0].lifetimeGold).toBeGreaterThanOrEqual(goldPerWin * (OLD_CAP + 1))
  })
})
