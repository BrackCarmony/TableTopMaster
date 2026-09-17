import { useMemo, useState } from 'react'
import { formatNumber } from '../format'
import { projectStatsAtLevel } from '../game/characters'
import { CLASS_TIERS } from '../game/data/classes'
import type { Role } from '../game/types'
import { ROLE_ICON, ROLE_LABEL } from './icons'

const ROLES: Role[] = ['tank', 'dps', 'healer']
const LEVEL_PRESETS = [1, 10, 25, 50, 100]

export function ClassReferenceModal({ onClose }: { onClose: () => void }) {
  const [role, setRole] = useState<Role>('tank')
  const [level, setLevel] = useState(1)

  const tiers = CLASS_TIERS[role]

  // Derived from the actual leveling formula (level 2 minus level 1) instead
  // of hardcoded here, so this caption can never drift out of sync with what
  // applyLevelUpStats actually does.
  const perLevelGrowth = useMemo(() => {
    const base = projectStatsAtLevel(role, tiers[0], 1)
    const next = projectStatsAtLevel(role, tiers[0], 2)
    return {
      maxHp: next.maxHp - base.maxHp,
      attackPower: next.attackPower - base.attackPower,
      defense: next.defense - base.defense,
      healPower: next.healPower - base.healPower,
    }
  }, [role, tiers])

  function handleLevelInput(raw: string) {
    const parsed = Math.round(Number(raw))
    if (!Number.isFinite(parsed)) return
    setLevel(Math.max(1, parsed))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Class Reference</h2>
          <button className="text-slate-400 hover:text-slate-200" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  role === r ? 'bg-emerald-700 text-emerald-50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {ROLE_ICON[r]} {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Level</span>
            <div className="flex gap-1">
              {LEVEL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setLevel(preset)}
                  className={`rounded px-2 py-1 text-xs font-medium transition ${
                    level === preset ? 'bg-amber-700 text-amber-50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              value={level}
              onChange={(e) => handleLevelInput(e.target.value)}
              className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            />
          </div>
        </div>

        <p className="mb-3 text-xs text-slate-400">
          Stats below are each tier's base plus level-up growth: this role gains{' '}
          <span className="text-slate-200">
            {perLevelGrowth.maxHp > 0 && `+${perLevelGrowth.maxHp} HP`}
            {perLevelGrowth.attackPower > 0 && `, +${perLevelGrowth.attackPower} Attack`}
            {perLevelGrowth.defense > 0 && `, +${perLevelGrowth.defense} Defense`}
            {perLevelGrowth.healPower > 0 && `, +${perLevelGrowth.healPower} Heal`}
          </span>{' '}
          per level, on top of whichever tier's base stats it started from. A player's Veteran Tier (Infamy) adds a
          further +5% to every base stat per tier, compounding, before leveling is applied.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1.5 pr-2">Tier</th>
                <th className="py-1.5 pr-2">Class</th>
                <th className="py-1.5 pr-2">Unlock Cost</th>
                <th className="py-1.5 pr-2">Max HP</th>
                <th className="py-1.5 pr-2">Attack</th>
                <th className="py-1.5 pr-2">Defense</th>
                <th className="py-1.5 pr-2">Heal</th>
                <th className="py-1.5 pr-2">Move</th>
                <th className="py-1.5 pr-2">Range</th>
                <th className="py-1.5 pr-2">Speed</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tierDef) => {
                const stats = projectStatsAtLevel(role, tierDef, level)
                return (
                  <tr key={tierDef.tier} className="border-t border-slate-800 text-slate-300">
                    <td className="py-1.5 pr-2 font-medium text-slate-100">T{tierDef.tier}</td>
                    <td className="py-1.5 pr-2 text-slate-400">{tierDef.names.join(' / ')}</td>
                    <td className="py-1.5 pr-2">{tierDef.unlockCost === 0 ? 'Free' : `${formatNumber(tierDef.unlockCost)}g`}</td>
                    <td className="py-1.5 pr-2">{formatNumber(stats.maxHp)}</td>
                    <td className="py-1.5 pr-2">{formatNumber(stats.attackPower)}</td>
                    <td className="py-1.5 pr-2">{formatNumber(stats.defense)}</td>
                    <td className="py-1.5 pr-2">{stats.healPower > 0 ? formatNumber(stats.healPower) : '—'}</td>
                    <td className="py-1.5 pr-2">{tierDef.moveRange}</td>
                    <td className="py-1.5 pr-2">{tierDef.attackRange}</td>
                    <td className="py-1.5 pr-2">{tierDef.speed}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
