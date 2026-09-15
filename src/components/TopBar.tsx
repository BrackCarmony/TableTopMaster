import { useGameStore } from '../game/store'

export function TopBar() {
  const dm = useGameStore((s) => s.dm)

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">TableTopMaster</h1>
        <p className="text-sm text-slate-400">{dm.name} &middot; Level {dm.level}</p>
      </div>
      <div className="flex gap-6 text-right">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Gold</div>
          <div className="text-lg font-semibold text-amber-400">{dm.gold}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Infamy</div>
          <div className="text-lg font-semibold text-rose-400">{dm.infamy}</div>
        </div>
      </div>
    </header>
  )
}
