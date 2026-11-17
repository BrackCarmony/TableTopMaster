import { useState } from 'react'
import { formatNumber } from '../format'
import { useGameStore } from '../game/store'
import type { Upgrade } from '../game/types'
import { PageHeader } from './shell/Shell'
import { shopLines, type ShopLine } from './shopLines'

/** One upgrade line: the next one to buy, how far along the line you are, and its price. */
function LineCard({ line }: { line: ShopLine }) {
  const dm = useGameStore((s) => s.dm)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const u = line.next as Upgrade
  const balance = u.currency === 'gold' ? dm.gold : dm.infamy
  const affordable = balance >= u.cost
  const gold = u.currency === 'gold'
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border bg-slate-900/60 px-3 py-2.5 ${
        affordable ? (gold ? 'border-amber-700/50' : 'border-rose-700/50') : 'border-slate-800'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-100">{u.name}</span>
          {line.items.length > 1 && (
            <span className="flex gap-0.5" title={`${line.owned} of ${line.items.length} bought`}>
              {line.items.map((x, i) => (
                <span key={x.id} className={`h-1.5 w-1.5 rounded-full ${i < line.owned ? (gold ? 'bg-amber-400' : 'bg-rose-400') : 'bg-slate-700'}`} />
              ))}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400">{u.description}</div>
      </div>
      <button
        disabled={!affordable}
        onClick={() => buyUpgrade(u.id)}
        className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium tabular-nums transition disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 ${
          gold ? 'bg-amber-700 text-amber-50 hover:bg-amber-600' : 'bg-rose-800 text-rose-50 hover:bg-rose-700'
        }`}
      >
        {formatNumber(u.cost)} {gold ? 'g' : 'infamy'}
      </button>
    </div>
  )
}

function Column({ title, tone, lines }: { title: string; tone: string; lines: ShopLine[] }) {
  const open = lines.filter((l) => l.next)
  return (
    <section className="flex flex-col gap-2">
      <h2 className={`text-xs font-semibold uppercase tracking-wider ${tone}`}>{title}</h2>
      {open.map((l) => (
        <LineCard key={l.key} line={l} />
      ))}
      {open.length === 0 && <p className="text-sm italic text-slate-500">Everything here is yours.</p>}
    </section>
  )
}

export function UpgradesPanel() {
  const dm = useGameStore((s) => s.dm)
  const [showOwned, setShowOwned] = useState(false)
  const lines = shopLines(dm)
  const owned = lines.flatMap((l) => l.items.slice(0, l.owned))

  return (
    <div>
      <PageHeader />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Column title="Gold shop" tone="text-amber-400" lines={lines.filter((l) => l.currency === 'gold')} />
        <Column title="Infamy shop · permanent" tone="text-rose-400" lines={lines.filter((l) => l.currency === 'infamy')} />
      </div>
      {owned.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowOwned((s) => !s)} className="text-sm text-slate-400 hover:text-slate-200">
            <span className={`mr-1 inline-block text-xs transition-transform ${showOwned ? '' : '-rotate-90'}`}>▼</span>
            Owned ({formatNumber(owned.length)})
          </button>
          {showOwned && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {owned.map((u) => (
                <span
                  key={u.id}
                  title={u.description}
                  className={`rounded-md px-2 py-1 text-xs ${u.currency === 'gold' ? 'bg-amber-950/50 text-amber-200' : 'bg-rose-950/50 text-rose-200'}`}
                >
                  ✓ {u.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
