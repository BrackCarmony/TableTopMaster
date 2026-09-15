import { useGameStore } from '../game/store'

export function TrophyCase() {
  const trophies = useGameStore((s) => s.dm.trophies)

  if (trophies.length === 0) return null

  const sorted = [...trophies].sort((a, b) => b.earnedAt - a.earnedAt)

  return (
    <div className="rounded-lg border border-amber-900/60 bg-amber-950/10 p-4">
      <h2 className="mb-3 text-base font-semibold text-amber-200">Trophy Case</h2>
      <div className="flex flex-col gap-1.5">
        {sorted.map((trophy) => (
          <div key={trophy.id} className="flex items-center justify-between rounded-md bg-slate-900/50 px-3 py-1.5 text-sm">
            <span className="text-amber-100">🏆 {trophy.name}</span>
            <span className="text-xs text-slate-500">{new Date(trophy.earnedAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
