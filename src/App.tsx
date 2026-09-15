import { useGameStore } from './game/store'
import { useGameLoop } from './hooks/useGameLoop'
import { TopBar } from './components/TopBar'
import { TableCard } from './components/TableCard'
import { UpgradesPanel } from './components/UpgradesPanel'
import { RosterPanel } from './components/RosterPanel'
import { TrophyCase } from './components/TrophyCase'

export default function App() {
  useGameLoop()
  const hasHydrated = useGameStore((s) => s.hasHydrated)
  const tables = useGameStore((s) => s.tables)

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading your dungeons...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <TopBar />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tables.map((table) => (
            <TableCard key={table.id} table={table} />
          ))}
        </div>
        <TrophyCase />
        <RosterPanel />
        <UpgradesPanel />
      </main>
    </div>
  )
}
