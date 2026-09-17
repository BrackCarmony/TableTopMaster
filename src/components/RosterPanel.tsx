import { ROLE_ICON, TRAIT_ICON, TRAIT_LABEL } from './icons'
import { formatNumber } from '../format'
import { getClassTier, maxTier } from '../game/data/classes'
import { legacyTierCost } from '../game/data/legacy'
import { dominantTrait } from '../game/personality'
import { useGameStore } from '../game/store'
import type { Player, Role } from '../game/types'

const ROLES: Role[] = ['tank', 'dps', 'healer']

function LegacyTierButton({ player }: { player: Player }) {
  const infamy = useGameStore((s) => s.dm.infamy)
  const upgradePlayerLegacyTier = useGameStore((s) => s.upgradePlayerLegacyTier)
  const nextCost = legacyTierCost(player.legacyTier)
  const affordable = infamy >= nextCost

  return (
    <div
      className="flex items-center justify-between gap-2 rounded bg-rose-950/40 px-2 py-1 text-xs"
      title="Permanent stat bonus that survives every death and reroll, regardless of what role they roll next. Never caps."
    >
      <span className="text-rose-300">💀 Veteran Tier {formatNumber(player.legacyTier)}</span>
      <button
        disabled={!affordable}
        onClick={() => upgradePlayerLegacyTier(player.id)}
        className="rounded bg-rose-700 px-2 py-0.5 font-medium text-rose-50 hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
      >
        Upgrade &middot; {formatNumber(nextCost)} Infamy
      </button>
    </div>
  )
}

function TierButton({ player, role }: { player: Player; role: Role }) {
  const gold = useGameStore((s) => s.dm.gold)
  const unlockPlayerTier = useGameStore((s) => s.unlockPlayerTier)
  const tier = player.roleTiers[role]
  const maxed = tier >= maxTier(role)
  const nextCost = maxed ? null : getClassTier(role, tier + 1).unlockCost
  const affordable = nextCost !== null && gold >= nextCost

  return (
    <div className="flex items-center justify-between gap-2 rounded bg-slate-800/60 px-2 py-1 text-xs">
      <span className="text-slate-300">
        {ROLE_ICON[role]} Tier {tier}
      </span>
      {maxed ? (
        <span className="text-slate-500">Maxed</span>
      ) : (
        <button
          disabled={!affordable}
          onClick={() => unlockPlayerTier(player.id, role)}
          className="rounded bg-amber-700 px-2 py-0.5 font-medium text-amber-50 hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          Unlock T{tier + 1} &middot; {formatNumber(nextCost!)}g
        </button>
      )}
    </div>
  )
}

function BuyCheapestLegacyTierButton() {
  const players = useGameStore((s) => s.players)
  const infamy = useGameStore((s) => s.dm.infamy)
  const upgradeCheapestLegacyTier = useGameStore((s) => s.upgradeCheapestLegacyTier)

  if (players.length === 0) return null
  const cheapest = players.reduce((min, p) => (p.legacyTier < min.legacyTier ? p : min))
  const cost = legacyTierCost(cheapest.legacyTier)
  const affordable = infamy >= cost

  return (
    <button
      disabled={!affordable}
      onClick={() => upgradeCheapestLegacyTier()}
      title={`Upgrades whichever player currently has the lowest Veteran Tier (${cheapest.name}) — always the cheapest next purchase.`}
      className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-rose-50 hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
    >
      💀 Upgrade Cheapest &middot; {formatNumber(cost)} Infamy
    </button>
  )
}

export function RosterPanel() {
  const players = useGameStore((s) => s.players)
  const tables = useGameStore((s) => s.tables)

  const tableNameById = new Map(tables.map((t) => [t.id, t.name]))

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">Roster</h2>
        <BuyCheapestLegacyTierButton />
      </div>
      <div className="flex flex-col gap-3">
        {players.map((player) => {
          const trait = dominantTrait(player.personality)
          const location = player.tableId ? tableNameById.get(player.tableId) ?? 'Seated' : 'Benched'
          return (
            <div key={player.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">
                  {player.name} <span title={TRAIT_LABEL[trait]}>{TRAIT_ICON[trait]}</span>
                </span>
                <span className={`text-xs ${player.tableId ? 'text-emerald-400' : 'text-slate-500'}`}>{location}</span>
              </div>
              {player.character && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Currently: {player.character.className} (Lv {formatNumber(player.character.level)})
                </p>
              )}
              <div className="mt-2">
                <LegacyTierButton player={player} />
              </div>
              <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {ROLES.map((role) => (
                  <TierButton key={role} player={player} role={role} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
