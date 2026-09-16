import { formatNumber } from '../format'
import { MODULES } from '../game/data/modules'
import { useGameStore } from '../game/store'
import type { CombatLogEvent } from '../game/combat/types'
import type { AdventureModule, BattleRewards, Table } from '../game/types'

function describeDangerLevel(tier: number): string {
  if (tier >= 8) return 'now a near-unrecognizable apex horror.'
  if (tier >= 5) return 'monstrously empowered.'
  if (tier >= 3) return 'considerably stronger.'
  return 'a little stronger.'
}

export function ModulePickerModal({
  table,
  onClose,
  onExecuted,
}: {
  table: Table
  onClose: () => void
  onExecuted: (log: CombatLogEvent[], moduleName: string, rewards: BattleRewards | null) => void
}) {
  const dm = useGameStore((s) => s.dm)
  const assignModule = useGameStore((s) => s.assignModule)
  const executeModuleNow = useGameStore((s) => s.executeModuleNow)

  const campaignModules = MODULES.filter((m) => m.kind === 'campaign')
  const executionModules = MODULES.filter((m) => m.kind === 'execution')

  function handleAssign(moduleDef: AdventureModule) {
    if (moduleDef.kind === 'execution') {
      const confirmed = window.confirm(
        `Send ${table.name}'s party to "${moduleDef.name}"? This is an execution contract — nothing is expected to survive.`,
      )
      if (!confirmed) return
      // A deliberate, one-off fight — resolve it right now and show it
      // happening, rather than letting it resolve silently on the next tick.
      executeModuleNow(table.id, moduleDef.id)
      const resolvedTable = useGameStore.getState().tables.find((t) => t.id === table.id)
      if (resolvedTable?.lastBattleLog) {
        onExecuted(
          resolvedTable.lastBattleLog,
          resolvedTable.lastBattleModuleName ?? moduleDef.name,
          resolvedTable.lastBattleRewards ?? null,
        )
      }
      onClose()
      return
    }
    assignModule(table.id, moduleDef.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Assign a Module &mdash; {table.name}</h2>
          <button className="text-slate-400 hover:text-slate-200" onClick={onClose}>
            ✕
          </button>
        </div>

        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Campaign Modules</h3>
        <div className="mb-6 flex flex-col gap-2">
          {campaignModules.map((moduleDef) => {
            const unlocked = dm.unlockedModuleIds.includes(moduleDef.id)
            const affordable = unlocked || dm.gold >= moduleDef.unlockCost
            return (
              <button
                key={moduleDef.id}
                disabled={!affordable}
                onClick={() => handleAssign(moduleDef)}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-left transition hover:border-emerald-600 hover:bg-slate-750 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">{moduleDef.name}</span>
                  <span className="text-xs text-slate-400">
                    {unlocked ? `Tier ${moduleDef.tier}` : `Unlock: ${formatNumber(moduleDef.unlockCost)}g`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{moduleDef.description}</p>
              </button>
            )
          })}
        </div>

        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-rose-400">Execution Contracts</h3>
        <div className="flex flex-col gap-2">
          {executionModules.map((moduleDef) => {
            const tier = dm.executionTier[moduleDef.id] ?? 0
            return (
              <button
                key={moduleDef.id}
                onClick={() => handleAssign(moduleDef)}
                className="rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-left transition hover:border-rose-600 hover:bg-rose-950/70"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-rose-200">{moduleDef.name}</span>
                  <span className="text-xs text-rose-400">Guaranteed TPK</span>
                </div>
                <p className="mt-1 text-xs text-rose-300/80">{moduleDef.description}</p>
                {tier > 0 && (
                  <p className="mt-1 text-xs font-medium text-rose-400">
                    Defeated {formatNumber(tier)} {tier === 1 ? 'time' : 'times'} already — {describeDangerLevel(tier)}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
