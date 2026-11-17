import { useGameStore } from './game/store'
import { useGameLoop } from './hooks/useGameLoop'
import { TableCard } from './components/TableCard'
import { UpgradesPanel } from './components/UpgradesPanel'
import { RosterPanel } from './components/RosterPanel'
import { TrophyCase } from './components/TrophyCase'
import { SailingPanel } from './components/SailingPanel'
import { ClassReference } from './components/ClassReference'
import { DelvingPanel } from './components/DelvingPanel'
import { PageHeader, Shell } from './components/shell/Shell'
import { useSection } from './components/nav'
import { formatNumber } from './format'

function TablesPage() {
  const tables = useGameStore((s) => s.tables)
  const players = useGameStore((s) => s.players)
  const seated = players.filter((p) => p.tableId).length
  return (
    <div>
      <PageHeader>
        <p className="mt-2 text-xs text-slate-500">
          {formatNumber(tables.length)} table{tables.length === 1 ? '' : 's'} · {formatNumber(seated)} seated ·{' '}
          {formatNumber(players.length - seated)} on the bench
        </p>
      </PageHeader>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {tables.map((table) => (
          <TableCard key={table.id} table={table} />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  useGameLoop()
  const hasHydrated = useGameStore((s) => s.hasHydrated)
  const [section] = useSection()

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading your dungeons...
      </div>
    )
  }

  return (
    <Shell>
      {section === 'tables' && <TablesPage />}
      {section === 'roster' && <RosterPanel />}
      {section === 'shop' && <UpgradesPanel />}
      {section === 'sailing' && <SailingPanel />}
      {section === 'delving' && <DelvingPanel />}
      {section === 'trophies' && <TrophyCase />}
      {section === 'classes' && <ClassReference />}
    </Shell>
  )
}
