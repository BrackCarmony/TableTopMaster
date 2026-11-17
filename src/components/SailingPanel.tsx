import { useState } from 'react'
import { formatNumber } from '../format'
import { getArtifactById } from '../game/data/artifacts'
import { getIslandById } from '../game/data/islands'
import { getUpgradeById } from '../game/data/upgrades'
import { effectiveShipSlots, hasSailingUnlock, voyageDuration } from '../game/engine'
import { shipCost, useGameStore } from '../game/store'
import type { Ship } from '../game/types'
import { IslandPickerModal } from './IslandPickerModal'
import { PageHeader } from './shell/Shell'

function ShipRow({ ship }: { ship: Ship }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const dm = useGameStore((s) => s.dm)
  const island = ship.assignedIslandId ? getIslandById(ship.assignedIslandId) : undefined
  // The bar must track the ship's ACTUAL current voyage length (after
  // sailSpeedMultiplier), not the island's unmodified base duration —
  // otherwise a sped-up ship's voyageRemaining never counts down to 0
  // against that larger denominator, and the bar always starts partway
  // full instead of empty.
  const fullDuration = island ? voyageDuration(island, dm) : 0
  const progress = island ? Math.max(0, Math.min(1, 1 - ship.voyageRemaining / fullDuration)) : 0
  const secondsLeft = Math.max(0, Math.ceil(ship.voyageRemaining / 1000))

  return (
    <div id={`ship-${ship.id}`} className="flex scroll-mt-28 flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-100">⛵ {ship.name}</span>
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded-md bg-slate-700 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-600"
        >
          {island ? 'Change Destination' : 'Send to Island'}
        </button>
      </div>
      {island ? (
        <div className="text-xs text-slate-400">
          Exploring {island.name} &middot; next return in {secondsLeft}s
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-cyan-600" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      ) : (
        <div className="text-xs italic text-slate-500">Idle at dock.</div>
      )}
      {pickerOpen && <IslandPickerModal ship={ship} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}

export function SailingPanel() {
  const dm = useGameStore((s) => s.dm)
  const ships = useGameStore((s) => s.ships)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const buyShip = useGameStore((s) => s.buyShip)

  if (!hasSailingUnlock(dm)) {
    const sailingUnlock = getUpgradeById('sailing-unlock')!
    return (
      <div>
        <PageHeader />
        <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/10 p-5">
        <h2 className="mb-2 text-base font-semibold text-cyan-200">🔒 The docks are closed</h2>
        <p className="mb-3 text-sm text-cyan-300/80">
          Buy ships, send them to explore islands, and bring back gold and artifacts that permanently empower your party.
        </p>
        <button
          disabled={dm.gold < sailingUnlock.cost}
          onClick={() => buyUpgrade('sailing-unlock')}
          className="rounded-md bg-cyan-700 px-3 py-1.5 text-sm font-medium text-cyan-50 hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Unlock Sailing — {formatNumber(sailingUnlock.cost)}g
        </button>
        </div>
      </div>
    )
  }

  const slots = effectiveShipSlots(dm)
  const nextCost = shipCost(ships.length)
  const atCapacity = ships.length >= slots
  const discovered = dm.discoveredArtifactIds ?? []

  return (
    <div>
      <PageHeader
        actions={
          <button
            disabled={atCapacity || dm.gold < nextCost}
            onClick={() => buyShip()}
            className="rounded-md bg-cyan-700 px-3 py-1.5 text-sm font-medium text-cyan-50 hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {atCapacity ? `Fleet full (${ships.length}/${slots})` : `+ Buy ship — ${formatNumber(nextCost)}g`}
          </button>
        }
      />
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
        Fleet · {ships.length}/{slots} ships
      </h2>

      {ships.length === 0 && <p className="mb-4 text-sm italic text-slate-500">No ships yet: buy your first above.</p>}
      {ships.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {ships.map((ship) => (
            <ShipRow key={ship.id} ship={ship} />
          ))}
        </div>
      )}

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">Artifacts found · {discovered.length}</h2>
      {discovered.length === 0 && <p className="text-sm italic text-slate-500">Nothing yet. Voyages sometimes bring one back.</p>}
      {discovered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {discovered.map((id) => {
            const artifact = getArtifactById(id)
            if (!artifact) return null
            return (
              <span key={id} title={artifact.description} className="rounded bg-cyan-900/40 px-2 py-1 text-xs text-cyan-200">
                🏺 {artifact.name}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
