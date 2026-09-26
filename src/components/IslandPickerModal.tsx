import { formatNumber } from '../format'
import { ISLANDS } from '../game/data/islands'
import { useGameStore } from '../game/store'
import type { Ship } from '../game/types'

export function IslandPickerModal({ ship, onClose }: { ship: Ship; onClose: () => void }) {
  const assignIsland = useGameStore((s) => s.assignIsland)

  function handleAssign(islandId: string) {
    assignIsland(ship.id, islandId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Send {ship.name} to...</h2>
          <button className="text-slate-400 hover:text-slate-200" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {ISLANDS.map((island) => (
            <button
              key={island.id}
              onClick={() => handleAssign(island.id)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-left transition hover:border-cyan-600 hover:bg-slate-750"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">{island.name}</span>
                <span className="text-xs text-slate-400">
                  {formatNumber(island.baseGoldReward)}g &middot; {Math.round(island.baseVoyageDurationMs / 1000)}s
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{island.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
