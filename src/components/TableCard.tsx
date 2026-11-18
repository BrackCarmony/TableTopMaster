import { useState } from 'react'
import { formatNumber } from '../format'
import { getModuleById } from '../game/data/modules'
import { autoAdvanceStreakNeeded, effectiveTableCapacity, flawlessStreak, hasAutoAdvanceUnlock, hasQuickRefillUnlock } from '../game/engine'
import { getNextUnlockedCampaignModule } from '../game/data/modules'
import { useGameStore } from '../game/store'
import type { CombatLogEvent } from '../game/combat/types'
import type { BattleRewards, Table } from '../game/types'
import { ROLE_ICON } from './icons'
import { ModulePickerModal } from './ModulePickerModal'
import { SeatPlayerModal } from './SeatPlayerModal'
import { BattleModal } from './combat/BattleModal'
import { useCooldownProgress } from './shell/progress'
import { Amount } from './currency'

interface BattleSnapshot {
  log: CombatLogEvent[]
  moduleName: string | null
  rewards: BattleRewards | null
}

const OUTCOME: Record<BattleRewards['outcome'], { label: string; tone: string }> = {
  victory: { label: 'Won', tone: 'text-emerald-400' },
  defeat: { label: 'Wiped', tone: 'text-rose-400' },
  stalemate: { label: 'Stalemate', tone: 'text-amber-400' },
}

export function TableCard({ table }: { table: Table }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [seatOpen, setSeatOpen] = useState(false)
  const [battleSnapshot, setBattleSnapshot] = useState<BattleSnapshot | null>(null)

  const seatedPlayers = useGameStore((s) => s.players.filter((p) => p.tableId === table.id))
  const capacity = useGameStore((s) => effectiveTableCapacity(s.dm))
  const dm = useGameStore((s) => s.dm)
  const players = useGameStore((s) => s.players)
  const quickRefillTable = useGameStore((s) => s.quickRefillTable)
  const progress = useCooldownProgress(table.id, table.cooldownRemaining)

  const moduleDef = table.assignedModuleId ? getModuleById(table.assignedModuleId) : undefined
  const cooldownSeconds = Math.max(0, Math.ceil(table.cooldownRemaining / 1000))
  const openSeats = Math.max(0, capacity - seatedPlayers.length)

  const playersById = new Map(players.map((p) => [p.id, p]))
  const canQuickRefill =
    openSeats > 0 && (table.lastWipeRoster?.some((entry) => playersById.get(entry.playerId)?.tableId === null) ?? false)
  const benched = players.filter((p) => p.tableId === null).length

  // What it's up to, at a glance.
  const status = !moduleDef
    ? { label: 'Needs an adventure', tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' }
    : seatedPlayers.length === 0
      ? { label: 'Empty', tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' }
      : openSeats > 0 && benched > 0
        ? { label: 'Seats free', tone: 'bg-sky-500/15 text-sky-300 ring-sky-500/30' }
        : { label: 'Playing', tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' }
  const last = table.lastBattleRewards
  // Delegate the Table: how close this table is to moving up a tier.
  const climbTo =
    moduleDef?.kind === 'campaign' && hasAutoAdvanceUnlock(dm) ? getNextUnlockedCampaignModule(moduleDef.id, dm.unlockedModuleIds) : undefined
  const streak = flawlessStreak(table)
  const needed = moduleDef ? autoAdvanceStreakNeeded(moduleDef.encounters.length) : 0

  return (
    <div id={`table-${table.id}`} className="flex scroll-mt-28 flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-100">{table.name}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${status.tone}`}>{status.label}</span>
      </div>

      {/* The adventure: which encounter, and how long until the next. */}
      <button
        onClick={() => setPickerOpen(true)}
        className="group rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-left text-sm transition hover:border-slate-600"
      >
        {moduleDef ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-200">{moduleDef.name}</span>
              <span className="text-[11px] text-slate-500 group-hover:text-slate-300">Change ›</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex gap-0.5" title={`Encounter ${table.encounterIndex + 1} of ${moduleDef.encounters.length}`}>
                {moduleDef.encounters.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-3 rounded-full ${i < table.encounterIndex ? 'bg-emerald-500/70' : i === table.encounterIndex ? 'bg-emerald-300' : 'bg-slate-700'}`}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-500">
                Encounter {table.encounterIndex + 1}/{moduleDef.encounters.length}
              </span>
              <span className="ml-auto tabular-nums text-xs text-slate-400">
                {seatedPlayers.length ? `next in ${cooldownSeconds}s` : 'waiting for players'}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800">
              {seatedPlayers.length > 0 && <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${progress * 100}%` }} />}
            </div>
            {climbTo && (
              <div
                className="mt-1.5 text-[11px] text-slate-500"
                title="Delegate the Table moves up a tier after this many flawless wins in a row here; any death, loss or stalemate drops it back at once."
              >
                🤖 {Math.min(streak, needed)}/{needed} flawless wins to move up to {climbTo.name}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <span className="italic text-slate-500">No adventure assigned.</span>
            <span className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-medium text-emerald-50 group-hover:bg-emerald-600">Choose one</span>
          </div>
        )}
      </button>

      <div className="flex flex-col gap-1">
        {seatedPlayers.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md bg-slate-800/60 px-2 py-1 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 text-slate-200">
              <span>{ROLE_ICON[p.character!.role]}</span>
              <span className="truncate">
                {p.name}
                <span className="text-slate-500">
                  {' '}
                  · {p.character!.race} {p.character!.className}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">Lv {formatNumber(p.character!.level)}</span>
          </div>
        ))}
        {openSeats > 0 && (
          <button
            onClick={() => setSeatOpen(true)}
            className="flex items-center justify-between rounded-md border border-dashed border-slate-700 px-2 py-1 text-left text-sm text-slate-500 transition hover:border-emerald-600 hover:text-emerald-400"
          >
            <span>+ Seat a player</span>
            <span className="text-xs">
              {openSeats} open seat{openSeats === 1 ? '' : 's'}
            </span>
          </button>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3">
        <button
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
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
          ▶ Watch last battle
        </button>
        {hasQuickRefillUnlock(dm) && (
          <button
            className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-emerald-50 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-40"
            disabled={!canQuickRefill}
            title="Reseat whoever was sitting here in the same roles right before the last wipe, in one click."
            onClick={() => quickRefillTable(table.id)}
          >
            ♻️ Quick Refill
          </button>
        )}
        {last && (
          <span className="ml-auto text-xs text-slate-500">
            Last: <span className={OUTCOME[last.outcome].tone}>{OUTCOME[last.outcome].label}</span>
            {last.gold > 0 && <Amount value={last.gold} currency="gold" size={12} className="ml-1 text-amber-300/90" />}
          </span>
        )}
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
