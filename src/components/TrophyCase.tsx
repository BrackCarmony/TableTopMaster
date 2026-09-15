import { useGameStore } from '../game/store'

export function TrophyCase() {
  const trophies = useGameStore((s) => s.dm.trophies)

  if (trophies.length === 0) return null

  const byPart = new Map<string, Set<string>>()
  for (const t of trophies) {
    if (!byPart.has(t.part)) byPart.set(t.part, new Set())
    byPart.get(t.part)!.add(t.quality)
  }
  const parts = [...byPart.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="rounded-lg border border-amber-900/60 bg-amber-950/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-amber-200">Trophy Case</h2>
        <span className="text-xs text-slate-500">
          {parts.length} part{parts.length === 1 ? '' : 's'} collected &middot; {trophies.length} total
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {parts.map(([part, qualities]) => (
          <div key={part} className="rounded-md bg-slate-900/50 px-3 py-2">
            <div className="text-sm font-medium text-amber-100">🏆 {part}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {[...qualities].map((quality) => (
                <span key={quality} className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-300">
                  {quality}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
