import { useEffect, type ReactNode } from 'react'
import { formatDuration, formatNumber } from '../../format'
import { getIslandById } from '../../game/data/islands'
import { getModuleById } from '../../game/data/modules'
import {
  OFFLINE_PROGRESS_GOLD_FRACTION,
  effectiveTableCapacity,
  hasSailingUnlock,
  offlineProgressDurationMs,
  voyageDuration,
} from '../../game/engine'
import { useGameStore } from '../../game/store'
import { SECTIONS, useNavBadges, useSection, type Badge, type SectionId } from '../nav'
import { useCooldownProgress } from './progress'

// The frame around every section: a sidebar (desktop) or tab strip (phones) to move between
// the parts of the game, a bar keeping gold and infamy in view, and a live glance at every
// table and ship from wherever you are.

function BadgePill({ badge }: { badge: Badge | undefined }) {
  if (!badge) return null
  if (badge.tone === 'locked')
    return (
      <span className="text-xs opacity-60" title={badge.title}>
        🔒
      </span>
    )
  const tone =
    badge.tone === 'attention'
      ? 'bg-amber-500/20 text-amber-300 ring-amber-500/40'
      : badge.tone === 'available'
        ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40'
        : 'bg-slate-700/60 text-slate-300 ring-slate-600/40'
  if (badge.count == null)
    return <span title={badge.title} className={`h-2 w-2 shrink-0 rounded-full ${badge.tone === 'attention' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
  return (
    <span title={badge.title} className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums ring-1 ${tone}`}>
      {formatNumber(badge.count)}
    </span>
  )
}

function NavItem({ id, compact }: { id: SectionId; compact?: boolean }) {
  const [section, go] = useSection()
  const badges = useNavBadges()
  const s = SECTIONS.find((x) => x.id === id)!
  const active = section === id
  const key = SECTIONS.findIndex((x) => x.id === id) + 1
  if (compact)
    return (
      <button
        onClick={() => go(id)}
        aria-current={active ? 'page' : undefined}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
          active ? 'bg-slate-100 font-semibold text-slate-900' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
        }`}
      >
        <span aria-hidden>{s.icon}</span>
        {s.label}
        <BadgePill badge={badges[id]} />
      </button>
    )
  return (
    <button
      onClick={() => go(id)}
      aria-current={active ? 'page' : undefined}
      title={`${s.label} (${key})`}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
        active ? 'bg-slate-800 font-semibold text-slate-50' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
      }`}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-emerald-400" />}
      <span aria-hidden className="text-base">
        {s.icon}
      </span>
      <span className="flex-1">{s.label}</span>
      <BadgePill badge={badges[id]} />
    </button>
  )
}

function TableGlance({ id }: { id: string }) {
  const [, go] = useSection()
  const table = useGameStore((s) => s.tables.find((t) => t.id === id))
  const seated = useGameStore((s) => s.players.filter((p) => p.tableId === id).length)
  const capacity = useGameStore((s) => effectiveTableCapacity(s.dm))
  const progress = useCooldownProgress(id, table?.cooldownRemaining ?? 0)
  if (!table) return null
  const mod = table.assignedModuleId ? getModuleById(table.assignedModuleId) : undefined
  const running = !!mod && seated > 0
  return (
    <button onClick={() => go('tables', `table-${id}`)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-800/60">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-slate-300">{table.name}</span>
        <span className="shrink-0 tabular-nums text-slate-500">
          {seated}/{capacity}
        </span>
      </div>
      <div className={`truncate text-[11px] ${mod ? 'text-slate-500' : 'text-amber-400/80'}`}>
        {mod ? `${mod.name} · ${table.encounterIndex + 1}/${mod.encounters.length}` : 'No adventure'}
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
        {running && <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${progress * 100}%` }} />}
      </div>
    </button>
  )
}

function ShipGlance({ id }: { id: string }) {
  const [, go] = useSection()
  const ship = useGameStore((s) => s.ships.find((x) => x.id === id))
  const dm = useGameStore((s) => s.dm)
  if (!ship) return null
  const island = ship.assignedIslandId ? getIslandById(ship.assignedIslandId) : undefined
  const progress = island ? Math.max(0, Math.min(1, 1 - ship.voyageRemaining / voyageDuration(island, dm))) : 0
  return (
    <button onClick={() => go('sailing', `ship-${id}`)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-800/60">
      <div className="truncate text-xs font-medium text-slate-300">⛵ {ship.name}</div>
      <div className={`truncate text-[11px] ${island ? 'text-slate-500' : 'text-amber-400/80'}`}>{island ? island.name : 'Idle at the dock'}</div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
        {island && <div className="h-full rounded-full bg-cyan-500/80" style={{ width: `${progress * 100}%` }} />}
      </div>
    </button>
  )
}

/** Every table and ship at a glance; click one to go to it. */
function LiveStatus() {
  const tableIds = useGameStore((s) => s.tables.map((t) => t.id).join(','))
  const shipIds = useGameStore((s) => (hasSailingUnlock(s.dm) ? s.ships.map((x) => x.id).join(',') : ''))
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">At the tables</h3>
      {tableIds.split(',').filter(Boolean).map((id) => (
        <TableGlance key={id} id={id} />
      ))}
      {shipIds && (
        <>
          <h3 className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">At sea</h3>
          {shipIds.split(',').map((id) => (
            <ShipGlance key={id} id={id} />
          ))}
        </>
      )}
    </div>
  )
}

function ResetButton() {
  const resetGame = useGameStore((s) => s.resetGame)
  return (
    <button
      onClick={() => {
        if (
          window.confirm(
            'Reset your entire game? This permanently deletes your gold, infamy, roster, tiers, trophies, and every table — there is no undo.',
          )
        )
          resetGame()
      }}
      title="Wipe all progress and start a brand new game"
      className="rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-rose-950/40 hover:text-rose-400"
    >
      Reset game…
    </button>
  )
}

function Brand() {
  const dm = useGameStore((s) => s.dm)
  return (
    <div>
      <div className="text-lg font-bold tracking-tight text-slate-50">
        <span aria-hidden>🎲 </span>TableTopMaster
      </div>
      <div className="text-xs text-slate-500">
        {dm.name} · Level {formatNumber(dm.level)}
      </div>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-800 bg-slate-900/80 md:flex">
      <div className="border-b border-slate-800 px-4 py-4">
        <Brand />
      </div>
      <nav className="flex flex-col gap-0.5 p-2" aria-label="Sections">
        {SECTIONS.map((s) => (
          <NavItem key={s.id} id={s.id} />
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-800 p-2">
        <LiveStatus />
      </div>
      <div className="border-t border-slate-800 px-2 py-2">
        <ResetButton />
      </div>
    </aside>
  )
}

function Currency({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-right leading-tight">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`tabular-nums text-base font-semibold sm:text-lg ${tone}`}>{formatNumber(value)}</div>
    </div>
  )
}

function OfflineButton() {
  const gold = useGameStore((s) => s.dm.gold)
  const buyOfflineProgress = useGameStore((s) => s.buyOfflineProgress)
  const cost = Math.round(gold * OFFLINE_PROGRESS_GOLD_FRACTION)
  const ms = offlineProgressDurationMs(cost)
  // Only worth offering once it buys a real amount of time.
  if (ms < 60_000) return null
  return (
    <button
      onClick={() => buyOfflineProgress()}
      title="Spend 10% of your current gold to instantly simulate that much time passing — every table and ship advances exactly as if you'd left the game running, minus the gold that time would have earned."
      className="tabular-nums rounded-md border border-amber-800/80 px-2.5 py-1 text-xs font-medium text-amber-300 transition hover:border-amber-600 hover:bg-amber-950/40 sm:text-sm"
    >
      ⏩ <span className="hidden sm:inline">Skip </span>
      {formatDuration(ms)} <span className="text-amber-500/80">({formatNumber(cost)}g)</span>
    </button>
  )
}

function TopBar() {
  const [section] = useSection()
  const dm = useGameStore((s) => s.dm)
  const s = SECTIONS.find((x) => x.id === section)!
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
        <div className="min-w-0 flex-1">
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-400 md:flex">
            <span aria-hidden>{s.icon}</span>
            <span className="font-medium text-slate-200">{s.label}</span>
          </div>
        </div>
        <OfflineButton />
        <Currency label="Gold" value={dm.gold} tone="text-amber-400" />
        <Currency label="Infamy" value={dm.infamy} tone="text-rose-400" />
      </div>
      {/* Phones: the sections as a strip of tabs under the bar. */}
      <nav className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 md:hidden" aria-label="Sections">
        {SECTIONS.map((x) => (
          <NavItem key={x.id} id={x.id} compact />
        ))}
      </nav>
    </header>
  )
}

/** A section's title, what it's for, and its main actions. */
export function PageHeader({ actions, children }: { actions?: ReactNode; children?: ReactNode }) {
  const [section] = useSection()
  const s = SECTIONS.find((x) => x.id === section)!
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-50">
          <span aria-hidden>{s.icon}</span>
          {s.label}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">{s.blurb}</p>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const [, go] = useSection()
  // Number keys jump between sections (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (document.querySelector('.fixed.inset-0.z-50')) return // a dialog is open
      const n = Number(e.key)
      if (n >= 1 && n <= SECTIONS.length) go(SECTIONS[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="md:pl-60">
        <TopBar />
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</main>
        <footer className="flex justify-center pb-8 md:hidden">
          <ResetButton />
        </footer>
      </div>
    </div>
  )
}
