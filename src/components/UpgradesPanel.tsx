import { formatNumber } from '../format'
import { UPGRADES } from '../game/data/upgrades'
import { useGameStore } from '../game/store'
import type { Upgrade } from '../game/types'

function UpgradeRow({ upgrade }: { upgrade: Upgrade }) {
  const dm = useGameStore((s) => s.dm)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const purchased = dm.purchasedUpgradeIds.includes(upgrade.id)
  const balance = upgrade.currency === 'gold' ? dm.gold : dm.infamy
  const affordable = balance >= upgrade.cost

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
      <div>
        <div className="text-sm font-medium text-slate-100">{upgrade.name}</div>
        <div className="text-xs text-slate-400">{upgrade.description}</div>
      </div>
      <button
        disabled={purchased || !affordable}
        onClick={() => buyUpgrade(upgrade.id)}
        className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
          purchased
            ? 'bg-slate-800 text-slate-500'
            : upgrade.currency === 'gold'
              ? 'bg-amber-700 text-amber-50 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-400'
              : 'bg-rose-800 text-rose-50 hover:bg-rose-700 disabled:bg-slate-700 disabled:text-slate-400'
        }`}
      >
        {purchased ? 'Owned' : `${formatNumber(upgrade.cost)} ${upgrade.currency === 'gold' ? 'g' : 'infamy'}`}
      </button>
    </div>
  )
}

export function UpgradesPanel() {
  const goldUpgrades = UPGRADES.filter((u) => u.currency === 'gold')
  const infamyUpgrades = UPGRADES.filter((u) => u.currency === 'infamy')

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-100">Upgrades</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-400">Gold Shop</h3>
          {goldUpgrades.map((u) => (
            <UpgradeRow key={u.id} upgrade={u} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-400">Infamy Shop (Permanent)</h3>
          {infamyUpgrades.map((u) => (
            <UpgradeRow key={u.id} upgrade={u} />
          ))}
        </div>
      </div>
    </div>
  )
}
