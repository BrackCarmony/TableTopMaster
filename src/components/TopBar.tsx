import { useState } from 'react'
import { formatNumber } from '../format'
import { useGameStore } from '../game/store'
import { ClassReferenceModal } from './ClassReferenceModal'

export function TopBar() {
  const dm = useGameStore((s) => s.dm)
  const [referenceOpen, setReferenceOpen] = useState(false)

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
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Gold</div>
            <div className="text-lg font-semibold text-amber-400">{formatNumber(dm.gold)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Infamy</div>
            <div className="text-lg font-semibold text-rose-400">{formatNumber(dm.infamy)}</div>
          </div>
        </div>
      </div>

      {referenceOpen && <ClassReferenceModal onClose={() => setReferenceOpen(false)} />}
    </header>
  )
}
