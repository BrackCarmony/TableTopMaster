import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createCharacterForPlayer, createPlayer, generateShipId, generateTableId, LEGACY_FLAT_GROWTH } from './characters'
import { getClassTier, maxTier } from './data/classes'
import { getIslandById } from './data/islands'
import { legacyTierCost } from './data/legacy'
import { shipNameForIndex } from './data/names'
import { trophyStartingLevelBonus } from './data/trophies'
import {
  MAX_OFFLINE_MS,
  OFFLINE_PROGRESS_GOLD_FRACTION,
  effectiveShipSlots,
  effectiveTableCapacity,
  effectiveTableSlots,
  hasRoleSelectionUnlock,
  hasSailingUnlock,
  offlineProgressDurationMs,
  resolveEncounter,
  tickShips,
  tickTables,
  voyageDuration,
} from './engine'
import { createRng } from './rng'
import { getModuleById } from './data/modules'
import { getUpgradeById } from './data/upgrades'
import type { Character, DMState, GameState, Player, Role, Ship, Table } from './types'

const rng = createRng(Date.now() ^ 0x9e3779b9)

function createTable(name: string): Table {
  return {
    id: generateTableId(),
    name,
    assignedModuleId: null,
    encounterIndex: 0,
    cooldownRemaining: 0,
    lifetimeGold: 0,
    lastBattleLog: null,
    lastBattleModuleName: null,
    lastBattleRewards: null,
  }
}

function createInitialDm(): DMState {
  return {
    name: 'The Dungeon Master',
    level: 1,
    gold: 60,
    infamy: 0,
    unlockedModuleIds: ['goblin-ambush', 'tarrasque-execution'],
    purchasedUpgradeIds: [],
    tableSlots: 1,
    executionTier: {},
    trophies: [],
    discoveredArtifactIds: [],
    unlockedIslandIds: ['sunken-reef'],
  }
}

function createShip(index: number): Ship {
  return { id: generateShipId(), name: shipNameForIndex(index), assignedIslandId: null, voyageRemaining: 0, lifetimeGold: 0 }
}

// First-pass balance guess, same as every other constant introduced this
// way — expect to retune after playtesting.
const SHIP_BASE_COST = 8000
const SHIP_COST_GROWTH = 1.8

export function shipCost(shipCount: number): number {
  return Math.round(SHIP_BASE_COST * SHIP_COST_GROWTH ** shipCount)
}

function createSeatedStarterPlayer(tableId: string, existingNames: string[]): Player {
  const player = createPlayer(rng, existingNames)
  const character = createCharacterForPlayer(player, rng)
  return { ...player, tableId, character }
}

function ensureTableSlots(tables: Table[], dm: DMState): Table[] {
  const slots = effectiveTableSlots(dm)
  if (tables.length >= slots) return tables
  const additions: Table[] = []
  for (let i = tables.length; i < slots; i++) {
    additions.push(createTable(`Table ${i + 1}`))
  }
  return [...tables, ...additions]
}

// The first two recruits beyond the starting 2 (i.e. filling out a full
// 4-person table) are cheap, so a rough early run of bad party comp / early
// deaths doesn't lock the roster below a playable size. Costs ramp up
// normally once a full first party is within reach.
const EARLY_RECRUIT_COSTS: Record<number, number> = { 2: 1, 3: 4 }

export function newPlayerCost(rosterSize: number): number {
  return EARLY_RECRUIT_COSTS[rosterSize] ?? 8 + rosterSize * 6
}

interface GameStore extends GameState {
  hasHydrated: boolean
  seatPlayer: (playerId: string, tableId: string, forcedRole?: Role) => void
  recruitNewPlayer: () => void
  unlockPlayerTier: (playerId: string, role: Role) => void
  upgradePlayerLegacyTier: (playerId: string) => void
  upgradeCheapestLegacyTier: () => void
  assignModule: (tableId: string, moduleId: string) => void
  executeModuleNow: (tableId: string, moduleId: string) => void
  buyOfflineProgress: () => void
  buyUpgrade: (upgradeId: string) => void
  buyShip: () => void
  assignIsland: (shipId: string, islandId: string) => void
  tick: (dtMs: number) => void
  catchUpOffline: () => void
  resetGame: () => void
}

function freshGameState(): GameState {
  const table = createTable('Table 1')
  const first = createSeatedStarterPlayer(table.id, [])
  const second = createSeatedStarterPlayer(table.id, [first.name])
  return {
    dm: createInitialDm(),
    players: [first, second],
    tables: [table],
    ships: [],
    lastTickAt: Date.now(),
  }
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      ...freshGameState(),
      hasHydrated: false,

      seatPlayer: (playerId, tableId, forcedRole) =>
        set((state) => {
          const player = state.players.find((p) => p.id === playerId)
          const table = state.tables.find((t) => t.id === tableId)
          if (!player || !table || player.tableId !== null) return state
          const seatedCount = state.players.filter((p) => p.tableId === tableId).length
          if (seatedCount >= effectiveTableCapacity(state.dm)) return state

          // Trust the caller's forcedRole only if the unlock is actually
          // purchased — never take a role choice at face value from the UI.
          const allowedForcedRole = forcedRole && hasRoleSelectionUnlock(state.dm) ? forcedRole : undefined
          const bonusLevels = trophyStartingLevelBonus(state.dm.trophies.length)
          const character = createCharacterForPlayer(player, rng, allowedForcedRole, bonusLevels)
          return {
            players: state.players.map((p) => (p.id === playerId ? { ...p, tableId, character } : p)),
          }
        }),

      recruitNewPlayer: () =>
        set((state) => {
          const cost = newPlayerCost(state.players.length)
          if (state.dm.infamy < cost) return state
          const existingNames = state.players.map((p) => p.name)
          return {
            dm: { ...state.dm, infamy: state.dm.infamy - cost },
            players: [...state.players, createPlayer(rng, existingNames)],
          }
        }),

      unlockPlayerTier: (playerId, role) =>
        set((state) => {
          const player = state.players.find((p) => p.id === playerId)
          if (!player) return state
          const currentTier = player.roleTiers[role]
          if (currentTier >= maxTier(role)) return state
          const nextTierDef = getClassTier(role, currentTier + 1)
          if (state.dm.gold < nextTierDef.unlockCost) return state

          return {
            dm: { ...state.dm, gold: state.dm.gold - nextTierDef.unlockCost },
            players: state.players.map((p) =>
              p.id === playerId ? { ...p, roleTiers: { ...p.roleTiers, [role]: currentTier + 1 } } : p,
            ),
          }
        }),

      upgradePlayerLegacyTier: (playerId) =>
        set((state) => {
          const player = state.players.find((p) => p.id === playerId)
          if (!player) return state
          const cost = legacyTierCost(player.legacyTier)
          if (state.dm.infamy < cost) return state

          return {
            dm: { ...state.dm, infamy: state.dm.infamy - cost },
            players: state.players.map((p) => (p.id === playerId ? { ...p, legacyTier: p.legacyTier + 1 } : p)),
          }
        }),

      // QoL: whoever has the lowest legacyTier always has the cheapest next
      // purchase (cost is a pure function of current tier), so this lets the
      // player keep clicking one button instead of hunting through the
      // roster for whichever card currently shows the smallest cost.
      upgradeCheapestLegacyTier: () =>
        set((state) => {
          if (state.players.length === 0) return state
          const cheapest = state.players.reduce((min, p) => (p.legacyTier < min.legacyTier ? p : min))
          const cost = legacyTierCost(cheapest.legacyTier)
          if (state.dm.infamy < cost) return state

          return {
            dm: { ...state.dm, infamy: state.dm.infamy - cost },
            players: state.players.map((p) => (p.id === cheapest.id ? { ...p, legacyTier: p.legacyTier + 1 } : p)),
          }
        }),

      assignModule: (tableId, moduleId) =>
        set((state) => {
          const moduleDef = getModuleById(moduleId)
          const table = state.tables.find((t) => t.id === tableId)
          if (!moduleDef || !table) return state

          let dm = state.dm
          if (!dm.unlockedModuleIds.includes(moduleId)) {
            if (moduleDef.unlockCost > 0 && dm.gold < moduleDef.unlockCost) return state
            dm = {
              ...dm,
              gold: dm.gold - moduleDef.unlockCost,
              unlockedModuleIds: [...dm.unlockedModuleIds, moduleId],
            }
          }

          return {
            dm,
            tables: state.tables.map((t) =>
              t.id === tableId
                ? { ...t, assignedModuleId: moduleId, encounterIndex: 0, cooldownRemaining: 500 }
                : t,
            ),
          }
        }),

      // Execution modules are a deliberate, one-off action — resolve the
      // fight immediately instead of handing it to the normal cooldown-paced
      // background tick loop, so the caller can show it happening right away
      // rather than it silently resolving next time the table ticks.
      executeModuleNow: (tableId, moduleId) =>
        set((state) => {
          const moduleDef = getModuleById(moduleId)
          const table = state.tables.find((t) => t.id === tableId)
          if (!moduleDef || !table) return state
          const seated = state.players.filter((p) => p.tableId === tableId)
          if (seated.length === 0) return state

          let dm = state.dm
          if (!dm.unlockedModuleIds.includes(moduleId)) {
            if (moduleDef.unlockCost > 0 && dm.gold < moduleDef.unlockCost) return state
            dm = {
              ...dm,
              gold: dm.gold - moduleDef.unlockCost,
              unlockedModuleIds: [...dm.unlockedModuleIds, moduleId],
            }
          }

          const preparedTable: Table = { ...table, assignedModuleId: moduleId, encounterIndex: 0, cooldownRemaining: 0 }
          // Same reasoning as tickTables' per-table isolation: a throw here
          // used to abort the whole click with zero feedback — the confirm
          // dialog fires, then apparently nothing happens, because the
          // exception unwound past onExecuted/onClose in the component.
          let resolved
          try {
            resolved = resolveEncounter(preparedTable, seated, dm, rng)
          } catch (err) {
            console.error(`executeModuleNow failed for table "${table.name}" (${tableId}) / module "${moduleId}":`, err)
            return state
          }
          const updatedById = new Map(resolved.players.map((p) => [p.id, p]))

          return {
            dm: resolved.dm,
            tables: state.tables.map((t) => (t.id === tableId ? resolved.table : t)),
            players: state.players.map((p) => updatedById.get(p.id) ?? p),
          }
        }),

      // A gold sink that stays relevant at any balance: always costs a
      // percentage of CURRENT gold (not a fixed or escalating amount), and
      // converts that into simulated wall-clock time via the exact same
      // tickTables/tickShips path real offline catch-up already runs on page
      // load — every table and ship advances exactly as if you'd been away
      // that long.
      buyOfflineProgress: () =>
        set((state) => {
          const cost = Math.round(state.dm.gold * OFFLINE_PROGRESS_GOLD_FRACTION)
          if (cost <= 0) return state
          const durationMs = offlineProgressDurationMs(cost)
          if (durationMs <= 0) return state

          const goldAfterCost = state.dm.gold - cost
          const dmForSimulation = { ...state.dm, gold: goldAfterCost }
          const tabled = tickTables(state.tables, state.players, dmForSimulation, durationMs, rng)
          const { ships, dm: simulatedDm } = tickShips(state.ships, tabled.dm, durationMs, rng)

          // The simulated time shouldn't hand back gold — refunding gold from
          // the very thing gold bought would make this a leaky (or even
          // net-positive) sink instead of a real one. Every OTHER outcome of
          // that time — levels, trophies, Infamy, artifact discoveries,
          // execution-tier progress — still applies in full.
          const dm = { ...simulatedDm, gold: goldAfterCost }

          return { tables: tabled.tables, players: tabled.players, ships, dm }
        }),

      buyUpgrade: (upgradeId) =>
        set((state) => {
          const upgrade = getUpgradeById(upgradeId)
          if (!upgrade) return state
          if (state.dm.purchasedUpgradeIds.includes(upgradeId)) return state
          const balance = upgrade.currency === 'gold' ? state.dm.gold : state.dm.infamy
          if (balance < upgrade.cost) return state

          const nextDm: DMState = {
            ...state.dm,
            gold: upgrade.currency === 'gold' ? state.dm.gold - upgrade.cost : state.dm.gold,
            infamy: upgrade.currency === 'infamy' ? state.dm.infamy - upgrade.cost : state.dm.infamy,
            purchasedUpgradeIds: [...state.dm.purchasedUpgradeIds, upgradeId],
          }

          return { dm: nextDm, tables: ensureTableSlots(state.tables, nextDm) }
        }),

      buyShip: () =>
        set((state) => {
          if (!hasSailingUnlock(state.dm)) return state
          if (state.ships.length >= effectiveShipSlots(state.dm)) return state
          const cost = shipCost(state.ships.length)
          if (state.dm.gold < cost) return state
          return {
            dm: { ...state.dm, gold: state.dm.gold - cost },
            ships: [...state.ships, createShip(state.ships.length + 1)],
          }
        }),

      assignIsland: (shipId, islandId) =>
        set((state) => {
          if (!hasSailingUnlock(state.dm)) return state
          const island = getIslandById(islandId)
          const ship = state.ships.find((s) => s.id === shipId)
          if (!island || !ship) return state

          let dm = state.dm
          // Same reasoning as the IslandPickerModal/SailingPanel fallbacks —
          // a tab left open across the v10 update can still be running
          // against a dm from before unlockedIslandIds existed, and this
          // state updater throwing on undefined silently swallows the click
          // instead of crashing anything visible.
          const unlockedIslandIds = dm.unlockedIslandIds ?? []
          if (!unlockedIslandIds.includes(islandId)) {
            if (island.unlockCost > 0 && dm.gold < island.unlockCost) return state
            dm = {
              ...dm,
              gold: dm.gold - island.unlockCost,
              unlockedIslandIds: [...unlockedIslandIds, islandId],
            }
          }

          return {
            dm,
            ships: state.ships.map((s) =>
              s.id === shipId ? { ...s, assignedIslandId: islandId, voyageRemaining: voyageDuration(island, dm) } : s,
            ),
          }
        }),

      tick: (dtMs) =>
        set((state) => {
          const tabled = tickTables(state.tables, state.players, state.dm, dtMs, rng)
          const { ships, dm } = tickShips(state.ships, tabled.dm, dtMs, rng)
          return { tables: tabled.tables, players: tabled.players, ships, dm, lastTickAt: Date.now() }
        }),

      catchUpOffline: () =>
        set((state) => {
          const elapsed = Math.min(Math.max(0, Date.now() - state.lastTickAt), MAX_OFFLINE_MS)
          if (elapsed <= 0) return { lastTickAt: Date.now() }
          const tabled = tickTables(state.tables, state.players, state.dm, elapsed, rng)
          const { ships, dm } = tickShips(state.ships, tabled.dm, elapsed, rng)
          return { tables: tabled.tables, players: tabled.players, ships, dm, lastTickAt: Date.now() }
        }),

      // Replaces dm/players/tables/lastTickAt wholesale with a brand new
      // game. Just clearing localStorage from the console doesn't work here
      // — the game loop is still running against the OLD in-memory state,
      // so persist's next write re-saves it right back. This actually
      // resets the live store, so the reset itself gets persisted correctly.
      resetGame: () => set(() => freshGameState()),
    }),
    {
      name: 'tabletopmaster-save',
      version: 10,
      partialize: (state) => ({
        dm: state.dm,
        players: state.players,
        tables: state.tables,
        ships: state.ships,
        lastTickAt: state.lastTickAt,
      }),
      migrate: (persisted, version) => {
        // A save schema has changed almost every session — if a future
        // migration step has a bug on some real save shape we didn't
        // anticipate, that must never soft-lock the app on the loading
        // screen forever. Falling back to a fresh game is a bad day, but a
        // recoverable one; hanging on "Loading your dungeons..." forever
        // with no way out is worse.
        try {
          if (version < 2) return freshGameState()
          const state = persisted as GameState
          if (version < 4) {
            // v3's executionAttempts tracked attempts, not wins — the semantics
            // changed (escalation now only happens on a win), so there's no
            // sound way to carry old attempt counts forward; reset to base.
            const dm = state.dm as DMState & { executionAttempts?: Record<string, number> }
            const { executionAttempts: _executionAttempts, ...rest } = dm
            state.dm = { ...rest, executionTier: {}, trophies: dm.trophies ?? [] }
          }
          if (version < 5) {
            // v4 trophies were { name } only; v5 replaced that with { part, quality }.
            // Old trophies can't be mapped onto the new shape, so they're dropped —
            // executionTier (the real progress) is untouched.
            state.dm = { ...state.dm, trophies: [] }
          }
          if (version < 6) {
            // v6 adds the Infamy-funded legacyTier — new field, no bonus yet.
            state.players = state.players.map((p) => ({ ...p, legacyTier: (p as Player).legacyTier ?? 0 }))
          }
          if (version < 7) {
            // v7 switched from flat, tier-independent per-level growth to
            // growth proportional to a character's own base stats — but that
            // rate is now baked onto the character at creation. An existing
            // live character never had one computed, so give it the old flat
            // rate for its role and let it keep leveling exactly as it always
            // has; only a freshly-rolled character (on its next death/reroll)
            // gets the new proportional growth.
            state.players = state.players.map((p) => {
              const character = p.character as (Character & { growthPerLevel?: Character['growthPerLevel'] }) | null
              if (!character || character.growthPerLevel) return p
              return { ...p, character: { ...character, growthPerLevel: LEGACY_FLAT_GROWTH[character.role] } }
            })
          }
          if (version < 8) {
            // v8 adds Sailing: ships as a new top-level array, plus
            // discoveredArtifactIds tracking on the DM. Neither existed
            // before, so both just start empty.
            const dm = state.dm as DMState & { discoveredArtifactIds?: string[] }
            state.dm = { ...dm, discoveredArtifactIds: dm.discoveredArtifactIds ?? [] }
            const withShips = state as GameState & { ships?: Ship[] }
            state.ships = withShips.ships ?? []
          }
          if (version < 9) {
            // v9 replaced the placeholder "Ship 1".."Ship 7" names with
            // SHIP_NAMES — purely cosmetic (nothing reads a ship's name for
            // gameplay), so existing ships get renamed by their fleet slot
            // rather than keeping the old placeholder forever.
            state.ships = state.ships.map((s, i) => ({ ...s, name: shipNameForIndex(i + 1) }))
          }
          if (version < 10) {
            // v10 adds more islands beyond the original free Sunken Reef,
            // each gated behind its own unlockCost — new field, so anyone
            // who already had Sailing unlocked keeps the one island they
            // already had access to instead of it suddenly looking locked.
            const dm = state.dm as DMState & { unlockedIslandIds?: string[] }
            state.dm = { ...dm, unlockedIslandIds: dm.unlockedIslandIds ?? ['sunken-reef'] }
          }
          return state
        } catch (err) {
          console.error('Save migration failed — starting a fresh game instead of hanging forever:', err)
          return freshGameState()
        }
      },
    },
  ),
)

// Explicitly drive rehydration rather than relying solely on the
// onRehydrateStorage callback, whose firing proved unreliable across
// StrictMode's double module evaluation in dev. The migrate() above already
// guards against a bad save shape, but if rehydrate() itself ever rejects
// (e.g. corrupted/unparsable localStorage JSON), still flip hasHydrated so
// the app starts on a fresh game instead of sitting on the loading screen
// forever with no way for the player to recover.
void useGameStore.persist
  .rehydrate()
  ?.then(() => {
    useGameStore.setState({ hasHydrated: true })
    useGameStore.getState().catchUpOffline()
  })
  .catch((err) => {
    console.error('Rehydration failed — starting a fresh game instead of hanging forever:', err)
    useGameStore.setState({ hasHydrated: true })
  })
