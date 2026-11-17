import { useState } from 'react'
import { ROLE_ICON, ROLE_LABEL, TRAIT_ICON, TRAIT_LABEL } from './icons'
import { formatNumber } from '../format'
import { CROSS_TRAIN_ATTACK_BONUS_PER_TIER, CROSS_TRAIN_HP_BONUS_PER_TIER, CROSS_TRAIN_REGEN_PER_TIER } from '../game/characters'
import { getClassTier, maxTier } from '../game/data/classes'
import { dominantTrait } from '../game/personality'
import { newPlayerCost, useGameStore } from '../game/store'
import type { Player, Role } from '../game/types'
import { PageHeader } from './shell/Shell'
import { Amount } from './currency'
import { roleTierUnlockCost, veteranTierCost } from '../game/engine'

const ROLES: Role[] = ['tank', 'dps', 'healer']

// Every role's tier also grants this player's characters a small universal
// passive regardless of what role they actually roll — the whole point is to
// give a reason to tier up a role you rarely play, not just your main.
const CROSS_TRAIN_DESCRIPTION: Record<Role, string> = {
  tank: `+${Math.round(CROSS_TRAIN_HP_BONUS_PER_TIER * 100)}% Max HP`,
  dps: `+${Math.round(CROSS_TRAIN_ATTACK_BONUS_PER_TIER * 100)}% Attack`,
  healer: `+${Math.round(CROSS_TRAIN_REGEN_PER_TIER * 100)}% HP regen/round`,
}

function LegacyTierButton({ player }: { player: Player }) {
  const dm = useGameStore((s) => s.dm)
  const infamy = dm.infamy
  const upgradePlayerLegacyTier = useGameStore((s) => s.upgradePlayerLegacyTier)
  const nextCost = veteranTierCost(dm, player.legacyTier)
  const affordable = infamy >= nextCost

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md bg-rose-950/40 px-2 py-1 text-xs"
      title="Permanent stat bonus that survives every death and reroll, regardless of what role they roll next. Never caps."
    >
      <span className="text-rose-300">💀 Veteran Tier {formatNumber(player.legacyTier)}</span>
      <button
        disabled={!affordable}
        onClick={() => upgradePlayerLegacyTier(player.id)}
        className="rounded bg-rose-700 px-2 py-0.5 font-medium text-rose-50 hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
      >
        Upgrade &middot; <Amount value={nextCost} currency="infamy" size={12} />
      </button>
    </div>
  )
}

function TierButton({ player, role }: { player: Player; role: Role }) {
  const dm = useGameStore((s) => s.dm)
  const gold = dm.gold
  const unlockPlayerTier = useGameStore((s) => s.unlockPlayerTier)
  const tier = player.roleTiers[role]
  const maxed = tier >= maxTier(role)
  const nextCost = maxed ? null : roleTierUnlockCost(dm, getClassTier(role, tier + 1).unlockCost)
  const affordable = nextCost !== null && gold >= nextCost

  return (
    <div
      className="flex flex-col gap-1 rounded-md bg-slate-800/60 px-2 py-1.5 text-xs"
      title={`Every tier here gives ALL of this player's characters ${CROSS_TRAIN_DESCRIPTION[role]} per tier past T1, no matter what role they roll — a reason to tier this up even if it's not their main.`}
    >
      <span className="text-slate-300">
        {ROLE_ICON[role]} {ROLE_LABEL[role]} <span className="text-slate-500">T{tier}</span>
      </span>
      {maxed ? (
        <span className="text-slate-500">Maxed</span>
      ) : (
        <button
          disabled={!affordable}
          onClick={() => unlockPlayerTier(player.id, role)}
          className="rounded bg-amber-700 px-2 py-0.5 font-medium text-amber-50 hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          T{tier + 1} &middot; <Amount value={nextCost!} currency="gold" size={12} />
        </button>
      )}
    </div>
  )
}

function BuyCheapestLegacyTierButton() {
  const players = useGameStore((s) => s.players)
  const dm = useGameStore((s) => s.dm)
  const infamy = dm.infamy
  const upgradeCheapestLegacyTier = useGameStore((s) => s.upgradeCheapestLegacyTier)

  if (players.length === 0) return null
  const cheapest = players.reduce((min, p) => (p.legacyTier < min.legacyTier ? p : min))
  const cost = veteranTierCost(dm, cheapest.legacyTier)
  const affordable = infamy >= cost

  return (
    <button
      disabled={!affordable}
      onClick={() => upgradeCheapestLegacyTier()}
      title={`Upgrades whichever player currently has the lowest Veteran Tier (${cheapest.name}) — always the cheapest next purchase.`}
      className="rounded-md bg-rose-800 px-3 py-1.5 text-sm font-medium text-rose-50 hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
    >
      💀 Upgrade cheapest veteran &middot; <Amount value={cost} currency="infamy" />
    </button>
  )
}

function RecruitButton() {
  const players = useGameStore((s) => s.players)
  const dm = useGameStore((s) => s.dm)
  const infamy = dm.infamy
  const recruitNewPlayer = useGameStore((s) => s.recruitNewPlayer)
  const cost = newPlayerCost(players.length, dm)
  return (
    <button
      disabled={infamy < cost}
      onClick={() => recruitNewPlayer()}
      title="Grow your roster. New recruits start on the bench."
      className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-50 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
    >
      + Recruit &middot; <Amount value={cost} currency="infamy" />
    </button>
  )
}

/** All, everyone seated, the bench, or one table (by id). */
type Filter = 'all' | 'seated' | 'benched' | { table: string }

export function RosterPanel() {
  const players = useGameStore((s) => s.players)
  const tables = useGameStore((s) => s.tables)
  const [filter, setFilter] = useState<Filter>('all')

  const tableNameById = new Map(tables.map((t) => [t.id, t.name]))
  // A table that's gone (it can't be, today, but saves change) falls back to everyone.
  const active: Filter = typeof filter === 'object' && !tableNameById.has(filter.table) ? 'all' : filter
  const matches = (p: (typeof players)[number], f: Filter) =>
    f === 'all' ? true : f === 'seated' ? !!p.tableId : f === 'benched' ? !p.tableId : p.tableId === f.table
  const shown = players.filter((p) => matches(p, active))
  const isActive = (f: Filter) => (typeof f === 'object' && typeof active === 'object' ? f.table === active.table : f === active)
  const chips: { key: string; label: string; f: Filter }[] = [
    { key: 'all', label: 'All', f: 'all' },
    { key: 'seated', label: 'Seated', f: 'seated' },
    ...(tables.length > 1 ? tables.map((t) => ({ key: t.id, label: t.name, f: { table: t.id } as Filter })) : []),
    { key: 'benched', label: 'Benched', f: 'benched' },
  ]

  return (
    <div>
      <PageHeader
        actions={
          <>
            <RecruitButton />
            <BuyCheapestLegacyTierButton />
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {chips.map(({ key, label, f }) => (
          <button
            key={key}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              isActive(f) ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            } ${typeof f === 'object' ? 'ring-1 ring-inset ring-emerald-700/40' : ''}`}
          >
            {typeof f === 'object' && <span aria-hidden>🎲 </span>}
            {label} <span className="tabular-nums opacity-60">{players.filter((p) => matches(p, f)).length}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-sm italic text-slate-500">Nobody here right now.</p>}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {shown.map((player) => {
          const trait = dominantTrait(player.personality)
          const location = player.tableId ? (tableNameById.get(player.tableId) ?? 'Seated') : 'Benched'
          return (
            <div key={player.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-100">
                  {player.name}{' '}
                  <span title={TRAIT_LABEL[trait]} className="text-sm">
                    {TRAIT_ICON[trait]}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                    player.tableId ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' : 'bg-slate-800 text-slate-400 ring-slate-700'
                  }`}
                >
                  {location}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {player.character ? (
                  <>
                    {ROLE_ICON[player.character.role]} {player.character.race} {player.character.className} · Lv{' '}
                    {formatNumber(player.character.level)}
                  </>
                ) : (
                  'No character yet: seat them to roll one'
                )}
              </p>
              <div className="mt-2">
                <LegacyTierButton player={player} />
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
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
