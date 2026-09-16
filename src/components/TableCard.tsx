import { useState } from 'react'
import { getModuleById } from '../game/data/modules'
import { effectiveTableCapacity } from '../game/engine'
import { useGameStore } from '../game/store'
import type { CombatLogEvent } from '../game/combat/types'
import type { BattleRewards, Table } from '../game/types'
import { ROLE_ICON } from './icons'
import { ModulePickerModal } from './ModulePickerModal'
import { SeatPlayerModal } from './SeatPlayerModal'
import { BattleModal } from './combat/BattleModal'

interface BattleSnapshot {
  log: CombatLogEvent[]
  moduleName: string | null
  rewards: BattleRewards | null
}

export function TableCard({ table }: { table: Table }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [seatOpen, setSeatOpen] = useState(false)
  const [battleSnapshot, setBattleSnapshot] = useState<BattleSnapshot | null>(null)

  const seatedPlayers = useGameStore((s) => s.players.filter((p) => p.tableId === table.id))
  const capacity = useGameStore((s) => effectiveTableCapacity(s.dm))

  const moduleDef = table.assignedModuleId ? getModuleById(table.assignedModuleId) : undefined
  const cooldownSeconds = Math.max(0, Math.ceil(table.cooldownRemaining / 1000))
  const openSeats = Math.max(0, capacity - seatedPlayers.length)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-100">{table.name}</h3>
        <span className="text-xs text-slate-500">
          {seatedPlayers.length}/{capacity} seated
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {seatedPlayers.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md bg-slate-800/60 px-2 py-1 text-sm">
            <span className="flex items-center gap-1.5 text-slate-200">
              <span>{ROLE_ICON[p.character!.role]}</span>
              {p.name}
              <span className="text-slate-500">
                ({p.character!.race} {p.character!.className})
              </span>
            </span>
            <span className="text-xs text-slate-400">Lv {p.character!.level}</span>
          </div>
        ))}
        {Array.from({ length: openSeats }).map((_, i) => (
          <button
            key={i}
            onClick={() => setSeatOpen(true)}
            className="rounded-md border border-dashed border-slate-700 px-2 py-1 text-left text-sm text-slate-500 transition hover:border-emerald-600 hover:text-emerald-400"
          >
            + Open seat
          </button>
        ))}
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
        {moduleDef ? (
          <>
            <div className="text-slate-200">{moduleDef.name}</div>
            <div className="text-xs text-slate-500">
              Encounter {table.encounterIndex + 1}/{moduleDef.encounters.length} &middot; next in {cooldownSeconds}s
            </div>
          </>
        ) : (
          <div className="text-slate-500 italic">No module assigned.</div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-600"
          onClick={() => setPickerOpen(true)}
        >
          Assign Module
        </button>
        <button
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!table.lastBattleLog}
          onClick={() =>
            table.lastBattleLog &&
            setBattleSnapshot({
              log: table.lastBattleLog,
              moduleName: table.lastBattleModuleName,
              rewards: table.lastBattleRewards ?? null,
            })
          }
        >
          View Battle
        </button>
      </div>

      {pickerOpen && (
        <ModulePickerModal
          table={table}
          onClose={() => setPickerOpen(false)}
          onExecuted={(log, moduleName, rewards) => setBattleSnapshot({ log, moduleName, rewards })}
        />
      )}
      {seatOpen && <SeatPlayerModal table={table} onClose={() => setSeatOpen(false)} />}
      {battleSnapshot && (
        <BattleModal
          log={battleSnapshot.log}
          moduleName={battleSnapshot.moduleName}
          rewards={battleSnapshot.rewards}
          onClose={() => setBattleSnapshot(null)}
        />
      )}
    </div>
  )
}
