import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createCharacterForPlayer, createPlayer, generateTableId } from './characters'
import { getClassTier, maxTier } from './data/classes'
import {
  MAX_OFFLINE_MS,
  effectiveTableCapacity,
  effectiveTableSlots,
  resolveEncounter,
  tickTables,
} from './engine'
import { createRng } from './rng'
import { getModuleById } from './data/modules'
import { getUpgradeById } from './data/upgrades'
import type { DMState, GameState, Player, Role, Table } from './types'

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
  seatPlayer: (playerId: string, tableId: string) => void
  recruitNewPlayer: () => void
  unlockPlayerTier: (playerId: string, role: Role) => void
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

      seatPlayer: (playerId, tableId) =>
        set((state) => {
          const player = state.players.find((p) => p.id === playerId)
          const table = state.tables.find((t) => t.id === tableId)
          if (!player || !table || player.tableId !== null) return state
          const seatedCount = state.players.filter((p) => p.tableId === tableId).length
          if (seatedCount >= effectiveTableCapacity(state.dm)) return state

          const character = createCharacterForPlayer(player, rng)
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
          const resolved = resolveEncounter(preparedTable, seated, dm, rng)
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
      version: 2,
      partialize: (state) => ({ dm: state.dm, players: state.players, tables: state.tables, lastTickAt: state.lastTickAt }),
      migrate: (_persisted, version) => (version < 2 ? freshGameState() : (_persisted as GameState)),
    },
  ),
)

// Explicitly drive rehydration rather than relying solely on the
// onRehydrateStorage callback, whose firing proved unreliable across
// StrictMode's double module evaluation in dev.
void useGameStore.persist.rehydrate()?.then(() => {
  useGameStore.setState({ hasHydrated: true })
  useGameStore.getState().catchUpOffline()
})
