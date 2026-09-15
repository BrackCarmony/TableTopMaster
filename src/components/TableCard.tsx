import { useState } from 'react'
import { getModuleById } from '../game/data/modules'
import type { Table } from '../game/types'
import { RecruitButton } from './RecruitButton'
import { ModulePickerModal } from './ModulePickerModal'
import { BattleModal } from './combat/BattleModal'

const ROLE_ICON = { tank: '🛡️', dps: '⚔️', healer: '✚' } as const

export function TableCard({ table }: { table: Table }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [battleOpen, setBattleOpen] = useState(false)

  const moduleDef = table.assignedModuleId ? getModuleById(table.assignedModuleId) : undefined
  const cooldownSeconds = Math.max(0, Math.ceil(table.cooldownRemaining / 1000))

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-100">{table.name}</h3>
        <span className="text-xs text-slate-500">{table.players.length} players</span>
      </div>

      <div className="flex flex-col gap-1">
        {table.players.length === 0 && <p className="text-sm text-slate-500 italic">No players recruited yet.</p>}
        {table.players.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md bg-slate-800/60 px-2 py-1 text-sm">
            <span className="flex items-center gap-1.5 text-slate-200">
              <span>{ROLE_ICON[p.character.role]}</span>
              {p.character.name}
              <span className="text-slate-500">
                ({p.character.race} {p.character.className})
              </span>
            </span>
            <span className="text-xs text-slate-400">Lv {p.character.level}</span>
          </div>
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
        <RecruitButton table={table} />
        <button
          className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-600"
          onClick={() => setPickerOpen(true)}
        >
          Assign Module
        </button>
        <button
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!table.lastBattleLog}
          onClick={() => setBattleOpen(true)}
        >
          View Battle
        </button>
      </div>

      {pickerOpen && <ModulePickerModal table={table} onClose={() => setPickerOpen(false)} />}
      {battleOpen && table.lastBattleLog && (
        <BattleModal log={table.lastBattleLog} moduleName={table.lastBattleModuleName} onClose={() => setBattleOpen(false)} />
      )}
    </div>
  )
}
