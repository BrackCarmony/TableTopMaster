import { effectiveTableCapacity } from '../game/engine'
import { useGameStore } from '../game/store'
import type { Table } from '../game/types'

function recruitCost(playerCount: number): number {
  return 20 + playerCount * 15
}

export function RecruitButton({ table }: { table: Table }) {
  const gold = useGameStore((s) => s.dm.gold)
  const capacity = useGameStore((s) => effectiveTableCapacity(s.dm))
  const recruitPlayer = useGameStore((s) => s.recruitPlayer)

  const full = table.players.length >= capacity
  const cost = recruitCost(table.players.length)
  const affordable = gold >= cost

  return (
    <button
      className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-50 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      disabled={full || !affordable}
      onClick={() => recruitPlayer(table.id)}
    >
      {full ? 'Table full' : `Recruit Player (${cost}g)`}
    </button>
  )
}
