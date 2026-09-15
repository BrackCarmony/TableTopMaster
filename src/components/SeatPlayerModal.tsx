import { ROLE_ICON, TRAIT_ICON, TRAIT_LABEL } from './icons'
import { newPlayerCost, useGameStore } from '../game/store'
import { dominantTrait } from '../game/personality'
import type { Role, Table } from '../game/types'

const ROLES: Role[] = ['tank', 'dps', 'healer']

export function SeatPlayerModal({ table, onClose }: { table: Table; onClose: () => void }) {
  const players = useGameStore((s) => s.players)
  const infamy = useGameStore((s) => s.dm.infamy)
  const seatPlayer = useGameStore((s) => s.seatPlayer)
  const recruitNewPlayer = useGameStore((s) => s.recruitNewPlayer)

  const benched = players.filter((p) => p.tableId === null)
  const cost = newPlayerCost(players.length)
  const canRecruit = infamy >= cost

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Seat a Player &mdash; {table.name}</h2>
          <button className="text-slate-400 hover:text-slate-200" onClick={onClose}>
            ✕
          </button>
        </div>

        <button
          disabled={!canRecruit}
          onClick={() => recruitNewPlayer()}
          className="mb-4 w-full rounded-md border border-rose-800 bg-rose-950/40 px-3 py-2 text-left transition hover:border-rose-600 hover:bg-rose-950/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-rose-200">Recruit New Player</span>
            <span className="text-xs text-rose-400">{cost} infamy</span>
          </div>
          <p className="mt-1 text-xs text-rose-300/80">Grow your roster. New recruits start on the bench.</p>
        </button>

        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Benched Players</h3>
        {benched.length === 0 && <p className="text-sm italic text-slate-500">Nobody's on the bench right now.</p>}
        <div className="flex flex-col gap-2">
          {benched.map((player) => {
            const trait = dominantTrait(player.personality)
            return (
              <button
                key={player.id}
                onClick={() => {
                  seatPlayer(player.id, table.id)
                  onClose()
                }}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-left transition hover:border-emerald-600 hover:bg-slate-750"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">
                    {player.name} <span title={TRAIT_LABEL[trait]}>{TRAIT_ICON[trait]}</span>
                  </span>
                  <span className="text-xs text-slate-400">{TRAIT_LABEL[trait]}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {ROLES.map((role) => (
                    <span key={role} className="mr-3">
                      {ROLE_ICON[role]} T{player.roleTiers[role]}
                    </span>
                  ))}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
