import { useMemo, useState } from 'react'
import { BattleModal } from '../components/combat/BattleModal'
import { runEncounter } from '../game/combat/simulate'
import type { CombatUnit, EncounterTemplate, Role } from '../game/combat/types'
import { CLASS_TIERS } from '../game/data/classes'
import * as ENCOUNTER_EXPORTS from '../game/data/encounters'
import { MODULES } from '../game/data/modules'
import { RACES } from '../game/data/names'
import { createRng } from '../game/rng'

// Dev-only battle preview for working on the 3D view: any encounter, any party tier, without
// playing up to it.  http://localhost:5173/?battle=dragons-peak-2&tier=4&size=5&seed=3
//   battle  an encounter id (see ?battle=list), tier 1-10, size 1-8 party members,
//   power   multiplies the party's stats (default 4, enough to see a fight through), seed.

const ENCOUNTERS = Object.values(ENCOUNTER_EXPORTS).filter(
  (v): v is EncounterTemplate => typeof v === 'object' && v !== null && 'enemies' in v && 'id' in v,
)
const ROLES: Role[] = ['tank', 'dps', 'healer', 'dps', 'healer', 'tank', 'dps', 'dps']
const NAMES = ['Bramm', 'Cael', 'Fenna', 'Grix', 'Isolde', 'Maeve', 'Pip', 'Wren']

function partyFor(tier: number, size: number, power: number, seed: number): CombatUnit[] {
  const rng = createRng(seed)
  return Array.from({ length: size }, (_, i) => {
    const role = ROLES[i % ROLES.length]
    const t = CLASS_TIERS[role][Math.min(tier, 10) - 1]
    const className = t.names[Math.floor(rng() * t.names.length)]
    const race = RACES[(i + seed) % RACES.length]
    const scale = power * Math.pow(1.6, tier - 1)
    return {
      id: `p${i}`,
      name: `${NAMES[i % NAMES.length]} Ashvale`,
      side: 'party',
      role,
      level: tier * 10,
      className,
      race,
      position: { x: 0, y: 0 },
      hp: Math.round(t.baseMaxHp * scale),
      maxHp: Math.round(t.baseMaxHp * scale),
      attackPower: Math.round(t.baseAttackPower * scale * 0.6),
      defense: Math.round(t.baseDefense * scale * 0.5),
      healPower: Math.round(t.baseHealPower * scale * 0.6),
      moveRange: t.moveRange,
      attackRange: t.attackRange,
      speed: t.speed,
      alive: true,
      flavor: null,
    } satisfies CombatUnit
  })
}

export default function BattlePreview() {
  const q = new URLSearchParams(location.search)
  const id = q.get('battle') ?? 'list'
  const enc = ENCOUNTERS.find((e) => e.id === id)
  const [run, setRun] = useState(0)
  const tier = Number(q.get('tier') ?? 0) || guessTier(id)
  const size = Number(q.get('size') ?? 5)
  const power = Number(q.get('power') ?? 4)
  const seed = Number(q.get('seed') ?? 1) + run
  const result = useMemo(
    () => (enc ? runEncounter(partyFor(tier, size, power, seed), enc, createRng(seed)) : null),
    [enc, tier, size, power, seed],
  )
  const moduleName = MODULES.find((m) => m.encounters.some((e) => e.id === id))?.name ?? null

  if (!enc || !result)
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <h1 className="mb-3 text-lg font-semibold">Battle preview (dev)</h1>
        <ul className="grid grid-cols-2 gap-1 text-sm md:grid-cols-4">
          {ENCOUNTERS.map((e) => (
            <li key={e.id}>
              <a className="text-emerald-300 hover:underline" href={`?battle=${e.id}`}>
                {e.id}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <div className="min-h-screen bg-slate-950">
      <BattleModal
        key={seed}
        log={result.log}
        moduleName={moduleName}
        rewards={{ outcome: result.outcome, xp: 0, gold: 0, infamy: 0 }}
        onClose={() => setRun((r) => r + 1)}
      />
    </div>
  )
}

/** A party tier that roughly matches the module (modules are listed in tier order). */
function guessTier(id: string): number {
  const i = MODULES.findIndex((m) => m.encounters.some((e) => e.id === id))
  return i < 0 ? 5 : Math.min(10, Math.max(1, Math.round((i * 10) / 12) + 1))
}
