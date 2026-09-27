import { useState } from 'react'
import { formatDuration, formatNumber } from '../format'
import { OFFLINE_PROGRESS_GOLD_FRACTION, offlineProgressDurationMs } from '../game/engine'
import { useGameStore } from '../game/store'
import { ClassReferenceModal } from './ClassReferenceModal'

export function TopBar() {
  const dm = useGameStore((s) => s.dm)
  const resetGame = useGameStore((s) => s.resetGame)
  const buyOfflineProgress = useGameStore((s) => s.buyOfflineProgress)
  const [referenceOpen, setReferenceOpen] = useState(false)

  function handleReset() {
    const confirmed = window.confirm(
      'Reset your entire game? This permanently deletes your gold, infamy, roster, tiers, trophies, and every table — there is no undo.',
    )
    if (!confirmed) return
    resetGame()
  }

  const offlineCost = Math.round(dm.gold * OFFLINE_PROGRESS_GOLD_FRACTION)
  const offlineDurationMs = offlineProgressDurationMs(offlineCost)
  // Below this, the button is just clutter — a fresh game would otherwise
  // show it from the very first click, buying single-digit seconds against a
  // starting balance of 60 gold. It only becomes worth showing once there's
  // a real amount of time on offer.
  const MIN_VISIBLE_OFFLINE_DURATION_MS = 60_000
  const showOfflineProgress = offlineDurationMs >= MIN_VISIBLE_OFFLINE_DURATION_MS

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">TableTopMaster</h1>
        <p className="text-sm text-slate-400">{dm.name} &middot; Level {formatNumber(dm.level)}</p>
      </div>
      <div className="flex items-center gap-6">
        <button
          onClick={() => setReferenceOpen(true)}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          📖 Class Reference
        </button>
        <button
          onClick={handleReset}
          title="Wipe all progress and start a brand new game"
          className="rounded-md border border-rose-900 px-3 py-1.5 text-sm font-medium text-rose-400 transition hover:border-rose-600 hover:bg-rose-950/40 hover:text-rose-300"
        >
          🔄 Reset Game
        </button>
        {showOfflineProgress && (
          <button
            onClick={() => buyOfflineProgress()}
            title="Spend 10% of your current gold to instantly simulate that much time passing — every table and ship advances exactly as if you'd left the game running, minus the gold that time would have earned."
            className="tabular-nums rounded-md border border-amber-800 px-3 py-1.5 text-sm font-medium text-amber-400 transition hover:border-amber-600 hover:bg-amber-950/40"
          >
            ⏩ Buy {formatDuration(offlineDurationMs)} ({formatNumber(offlineCost)}g)
          </button>
        )}
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Gold</div>
            <div className="tabular-nums text-lg font-semibold text-amber-400">{formatNumber(dm.gold)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Infamy</div>
            <div className="tabular-nums text-lg font-semibold text-rose-400">{formatNumber(dm.infamy)}</div>
          </div>
        </div>
      </div>

      {referenceOpen && <ClassReferenceModal onClose={() => setReferenceOpen(false)} />}
    </header>
  )
}
