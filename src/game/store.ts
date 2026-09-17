import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createCharacterForPlayer, createPlayer, generateTableId, LEGACY_FLAT_GROWTH } from './characters'
import { getClassTier, maxTier } from './data/classes'
import { legacyTierCost } from './data/legacy'
import { trophyStartingLevelBonus } from './data/trophies'
import {
  MAX_OFFLINE_MS,
  effectiveTableCapacity,
  effectiveTableSlots,
  hasRoleSelectionUnlock,
  resolveEncounter,
  tickTables,
} from './engine'
import { createRng } from './rng'
import { getModuleById } from './data/modules'
import { getUpgradeById } from './data/upgrades'
import type { Character, DMState, GameState, Player, Role, Table } from './types'

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
  }
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
  buyUpgrade: (upgradeId: string) => void
  tick: (dtMs: number) => void
  catchUpOffline: () => void
}

function freshGameState(): GameState {
  const table = createTable('Table 1')
  const first = createSeatedStarterPlayer(table.id, [])
  const second = createSeatedStarterPlayer(table.id, [first.name])
  return {
    dm: createInitialDm(),
    players: [first, second],
    tables: [table],
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

      tick: (dtMs) =>
        set((state) => {
          const { tables, players, dm } = tickTables(state.tables, state.players, state.dm, dtMs, rng)
          return { tables, players, dm, lastTickAt: Date.now() }
        }),

      catchUpOffline: () =>
        set((state) => {
          const elapsed = Math.min(Math.max(0, Date.now() - state.lastTickAt), MAX_OFFLINE_MS)
          if (elapsed <= 0) return { lastTickAt: Date.now() }
          const { tables, players, dm } = tickTables(state.tables, state.players, state.dm, elapsed, rng)
          return { tables, players, dm, lastTickAt: Date.now() }
        }),
    }),
    {
      name: 'tabletopmaster-save',
      version: 7,
      partialize: (state) => ({ dm: state.dm, players: state.players, tables: state.tables, lastTickAt: state.lastTickAt }),
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
