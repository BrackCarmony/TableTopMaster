import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createCharacter, generatePlayerId, generateTableId } from './characters'
import {
  MAX_OFFLINE_MS,
  effectiveTableCapacity,
  effectiveTableSlots,
  tickTables,
} from './engine'
import { createRng } from './rng'
import { getModuleById } from './data/modules'
import { getUpgradeById } from './data/upgrades'
import type { DMState, GameState, Table } from './types'

const rng = createRng(Date.now() ^ 0x9e3779b9)

function createTable(name: string): Table {
  return {
    id: generateTableId(),
    name,
    capacity: 0, // informational only; effective capacity is computed from DM upgrades
    players: [],
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

function ensureTableSlots(tables: Table[], dm: DMState): Table[] {
  const slots = effectiveTableSlots(dm)
  if (tables.length >= slots) return tables
  const additions: Table[] = []
  for (let i = tables.length; i < slots; i++) {
    additions.push(createTable(`Table ${i + 1}`))
  }
  return [...tables, ...additions]
}

interface GameStore extends GameState {
  hasHydrated: boolean
  recruitPlayer: (tableId: string) => void
  assignModule: (tableId: string, moduleId: string) => void
  buyUpgrade: (upgradeId: string) => void
  tick: (dtMs: number) => void
  catchUpOffline: () => void
}

function recruitCost(playerCount: number): number {
  return 20 + playerCount * 15
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      dm: createInitialDm(),
      tables: [createTable('Table 1')],
      lastTickAt: Date.now(),
      hasHydrated: false,

      recruitPlayer: (tableId) =>
        set((state) => {
          const table = state.tables.find((t) => t.id === tableId)
          if (!table) return state
          const capacity = effectiveTableCapacity(state.dm)
          if (table.players.length >= capacity) return state
          const cost = recruitCost(table.players.length)
          if (state.dm.gold < cost) return state

          const character = createCharacter(rng)
          const newPlayer = { id: generatePlayerId(), name: character.name, recruitedAt: Date.now(), character }

          return {
            dm: { ...state.dm, gold: state.dm.gold - cost },
            tables: state.tables.map((t) => (t.id === tableId ? { ...t, players: [...t.players, newPlayer] } : t)),
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
          const { tables, dm } = tickTables(state.tables, state.dm, dtMs, rng)
          return { tables, dm, lastTickAt: Date.now() }
        }),

      catchUpOffline: () =>
        set((state) => {
          const elapsed = Math.min(Math.max(0, Date.now() - state.lastTickAt), MAX_OFFLINE_MS)
          if (elapsed <= 0) return { lastTickAt: Date.now() }
          const { tables, dm } = tickTables(state.tables, state.dm, elapsed, rng)
          return { tables, dm, lastTickAt: Date.now() }
        }),
    }),
    {
      name: 'tabletopmaster-save',
      version: 1,
      partialize: (state) => ({ dm: state.dm, tables: state.tables, lastTickAt: state.lastTickAt }),
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
