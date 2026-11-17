import { useEffect, useState } from 'react'
import { formatNumber } from '../format'
import { growthRateFor, projectStatsAtLevel } from '../game/characters'
import { CLASS_TIERS, type ClassTierDef } from '../game/data/classes'
import type { Role } from '../game/types'
import { ROLE_ICON, ROLE_LABEL } from './icons'
import { PageHeader } from './shell/Shell'
import { Amount } from './currency'
import { CLASS_CAPTION, classArt, classThumb } from './classArt'
import { useGameStore } from '../game/store'

const ROLES: Role[] = ['tank', 'dps', 'healer']
const LEVEL_PRESETS = [1, 10, 25, 50, 100]

function asPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

const ROLE_TONE: Record<Role, { text: string; ring: string; bg: string }> = {
  tank: { text: 'text-sky-300', ring: 'ring-sky-500/50', bg: 'bg-sky-500/15' },
  dps: { text: 'text-rose-300', ring: 'ring-rose-500/50', bg: 'bg-rose-500/15' },
  healer: { text: 'text-amber-300', ring: 'ring-amber-500/50', bg: 'bg-amber-500/15' },
}

/** A class name with its little portrait; opens the full artwork. */
function ClassChip({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      title={`See the ${name}`}
      className="group flex items-center gap-2 rounded-lg py-0.5 pl-0.5 pr-2 text-left transition hover:bg-slate-800"
    >
      <img
        src={classThumb(name)}
        alt=""
        loading="lazy"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-slate-700 transition group-hover:ring-slate-400"
      />
      <span className="text-slate-300 group-hover:text-slate-50">{name}</span>
    </button>
  )
}

/** The full artwork for one class, with its tier, stats at the chosen level and who plays it; arrows step through the role. */
function ClassViewer({
  role,
  name,
  level,
  onPick,
  onClose,
}: {
  role: Role
  name: string
  level: number
  onPick: (name: string) => void
  onClose: () => void
}) {
  const all = CLASS_TIERS[role].flatMap((t) => t.names.map((n) => ({ name: n, tier: t })))
  const i = Math.max(0, all.findIndex((c) => c.name === name))
  const { tier } = all[i] as { name: string; tier: ClassTierDef }
  const stats = projectStatsAtLevel(role, tier, level)
  const playing = useGameStore((s) => s.players.filter((p) => p.character?.className === name).map((p) => p.name))
  const tone = ROLE_TONE[role]
  const step = (d: number) => onPick(all[(i + d + all.length) % all.length].name)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const stat = (label: string, value: string) => (
    <div className="rounded-md bg-slate-800/70 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="tabular-nums text-sm font-semibold text-slate-100">{value}</div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:flex-row"
      >
        <div className="relative shrink-0 bg-slate-950 sm:w-[46%]">
          <img key={name} src={classArt(name)} alt={`${name} artwork`} className="mx-auto block max-h-[52vh] w-auto sm:max-h-none sm:w-full" />
          {(['‹', '›'] as const).map((glyph, k) => (
            <button
              key={glyph}
              onClick={() => step(k ? 1 : -1)}
              aria-label={k ? 'Next class' : 'Previous class'}
              className={`absolute top-1/2 -translate-y-1/2 ${k ? 'right-2' : 'left-2'} flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-2xl leading-none text-white/90 backdrop-blur transition hover:bg-black/75`}
            >
              {glyph}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`text-xs font-medium ${tone.text}`}>
                {ROLE_ICON[role]} {ROLE_LABEL[role]} · Tier {tier.tier}
                {tier.names.length > 1 && <span className="text-slate-500"> · alongside {tier.names.filter((n) => n !== name).join(' and ')}</span>}
              </div>
              <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-50">{name}</h2>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200" aria-label="Close">
              ✕
            </button>
          </div>
          <p className="text-sm italic text-slate-300">{CLASS_CAPTION[name]}</p>
          <div>
            <div className="mb-1.5 text-[11px] text-slate-500">At level {formatNumber(level)}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {stat('Max HP', formatNumber(stats.maxHp))}
              {stat('Attack', formatNumber(stats.attackPower))}
              {stat('Defense', formatNumber(Math.round(stats.defense)))}
              {stat('Heal', stats.healPower > 0 ? formatNumber(stats.healPower) : '—')}
              {stat('Move / Range', `${tier.moveRange} / ${tier.attackRange}`)}
              {stat('Speed', String(tier.speed))}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Unlock: {tier.unlockCost === 0 ? 'free' : <Amount value={tier.unlockCost} currency="gold" size={12} />} for a player's {ROLE_LABEL[role]} tier {tier.tier}
          </div>
          {playing.length > 0 && (
            <div className={`rounded-md px-2.5 py-1.5 text-xs ring-1 ${tone.bg} ${tone.ring} ${tone.text}`}>
              Played right now by {playing.join(', ')}
            </div>
          )}
          <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-slate-500">
            <span>
              {i + 1} of {all.length} {ROLE_LABEL[role]} classes · ← → to browse
            </span>
            <span>Art made with an AI image model</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ClassReference() {
  const [role, setRole] = useState<Role>('tank')
  const [level, setLevel] = useState(1)
  const [viewing, setViewing] = useState<string | null>(null)

  const tiers = CLASS_TIERS[role]

  // Growth is a percentage of each tier's own base stats (see
  // computeGrowthPerLevel), not a flat amount — so this reads the rate
  // straight from the same source real characters level through, and it
  // applies identically at every tier instead of being tier-1-specific.
  const growthRate = growthRateFor(role)

  function handleLevelInput(raw: string) {
    const parsed = Math.round(Number(raw))
    if (!Number.isFinite(parsed)) return
    setLevel(Math.max(1, parsed))
  }

  return (
    <div>
      <PageHeader />
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">

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
          <span className="text-slate-300">Click a class to see its artwork.</span> Each level adds a percentage of <span className="text-slate-200">this tier's own base stats</span> — this
          role grows{' '}
          <span className="text-slate-200">
            {growthRate.maxHp > 0 && `${asPercent(growthRate.maxHp)} HP`}
            {growthRate.attackPower > 0 && `, ${asPercent(growthRate.attackPower)} Attack`}
            {growthRate.defense > 0 && `, ${asPercent(growthRate.defense)} Defense`}
            {growthRate.healPower > 0 && `, ${asPercent(growthRate.healPower)} Heal`}
          </span>{' '}
          per level, at every tier — so a higher tier doesn't just start stronger, it grows faster too, and the gap
          holds at any level instead of leveling out the difference. A player's Veteran Tier (Infamy) adds a further
          +5% per tier to the base itself, compounding, which also scales that tier's per-level growth to match.
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
                    <td className="py-1 pr-2">
                      <div className="flex flex-wrap gap-x-1">
                        {tierDef.names.map((n) => (
                          <ClassChip key={n} name={n} onOpen={() => setViewing(n)} />
                        ))}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2">{tierDef.unlockCost === 0 ? 'Free' : <Amount value={tierDef.unlockCost} currency="gold" size={12} />}</td>
                    <td className="py-1.5 pr-2">{formatNumber(stats.maxHp)}</td>
                    <td className="py-1.5 pr-2">{formatNumber(stats.attackPower)}</td>
                    <td className="py-1.5 pr-2">{formatNumber(Math.round(stats.defense))}</td>
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
      {viewing && <ClassViewer role={role} name={viewing} level={level} onPick={setViewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
