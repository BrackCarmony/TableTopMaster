import { useMemo, useState } from 'react'
import { BattleModal } from '../components/combat/BattleModal'
import { runEncounter } from '../game/combat/simulate'
import type { CombatLogEvent, CombatUnit, EncounterTemplate, Role } from '../game/combat/types'
import { CLASS_TIERS } from '../game/data/classes'
import * as ENCOUNTER_EXPORTS from '../game/data/encounters'
import { MODULES } from '../game/data/modules'
import { RACES } from '../game/data/names'
import { createRng } from '../game/rng'
import { SIGNATURE_BOSSES } from './timing'

// Dev-only battle preview for working on the 3D view: any encounter, any party tier, without
// playing up to it.  http://localhost:5173/?battle=dragons-peak-2&tier=4&size=5&seed=3
//   battle  an encounter id (see ?battle=list), tier 1-10, size 1-8 party members,
//   power   multiplies the party's stats (default 4, enough to see a fight through), seed.
//   &showcase  just the boss's signature attack, three times (the third misses);
//   &showcase=party  each party member's attack (or heal) in turn instead.
//   &classes=Ranger,Knight,Druid  pick the party's classes (each at its own tier).
//   ?battle=lineup&role=tank|dps|healer[&race=Elf] stands every class of a role in rows.

const ENCOUNTERS = Object.values(ENCOUNTER_EXPORTS).filter(
  (v): v is EncounterTemplate => typeof v === 'object' && v !== null && 'enemies' in v && 'id' in v,
)
const ROLES: Role[] = ['tank', 'dps', 'healer', 'dps', 'healer', 'tank', 'dps', 'dps']
const NAMES = ['Bramm', 'Cael', 'Fenna', 'Grix', 'Isolde', 'Maeve', 'Pip', 'Wren']

/** Where each class name sits: its role and tier. */
function findClass(name: string): { role: Role; tier: number } | null {
  for (const role of Object.keys(CLASS_TIERS) as Role[]) {
    const t = CLASS_TIERS[role].find((c) => c.names.includes(name))
    if (t) return { role, tier: t.tier }
  }
  return null
}

function partyFor(tier: number, size: number, power: number, seed: number, classes: string[] = []): CombatUnit[] {
  const rng = createRng(seed)
  return Array.from({ length: classes.length || size }, (_, i) => {
    const picked = classes[i] ? findClass(classes[i]) : null
    const role = picked?.role ?? ROLES[i % ROLES.length]
    const t = CLASS_TIERS[role][Math.min(picked?.tier ?? tier, 10) - 1]
    const className = picked ? classes[i] : t.names[Math.floor(rng() * t.names.length)]
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

/** Every class of a role (or every race) standing in rows, to compare looks: ?battle=lineup&role=tank&race=Elf */
function lineupLog(role: Role, race: string | null): CombatLogEvent[] {
  const units: CombatUnit[] = []
  CLASS_TIERS[role].forEach((t, i) =>
    t.names.forEach((className, j) =>
      units.push({
        ...partyFor(t.tier, 1, 1, i)[0],
        id: `${className}-${j}`,
        name: className,
        role,
        className,
        race: race ?? RACES[(i + j) % RACES.length],
        attackRange: t.attackRange,
        position: { x: i, y: j * 2 + 1 },
      }),
    ),
  )
  return [{ type: 'encounter_start', units, gridWidth: 10, gridHeight: 6, encounterId: 'goblin-ambush-1' }]
}

export default function BattlePreview() {
  const q = new URLSearchParams(location.search)
  if (q.get('battle') === 'lineup') {
    const role = (q.get('role') ?? 'tank') as Role
    return (
      <div className="min-h-screen bg-slate-950">
        <BattleModal log={lineupLog(role, q.get('race'))} moduleName={`${role} lineup`} rewards={null} onClose={() => {}} />
      </div>
    )
  }
  return <Preview q={q} />
}

function Preview({ q }: { q: URLSearchParams }) {
  const id = q.get('battle') ?? 'list'
  const enc = ENCOUNTERS.find((e) => e.id === id)
  const [run, setRun] = useState(0)
  const tier = Number(q.get('tier') ?? 0) || guessTier(id)
  const size = Number(q.get('size') ?? 5)
  const power = Number(q.get('power') ?? 4)
  const seed = Number(q.get('seed') ?? 1) + run
  const showcase = q.has('showcase')
  const result = useMemo(() => {
    if (!enc) return null
    const classes = (q.get('classes') ?? '').split(',').filter(Boolean)
    const r = runEncounter(partyFor(tier, size, power, seed, classes), enc, createRng(seed))
    return showcase ? { ...r, log: showcaseLog(r.log, q.get('showcase') === 'party') } : r
  }, [enc, tier, size, power, seed, showcase, q])
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

/** Just the opening and the boss (the first enemy listed with a signature, else the first enemy) attacking three party members in turn: &showcase */
function showcaseLog(log: CombatLogEvent[], partyAttacks = false): CombatLogEvent[] {
  const start = log[0]
  if (start?.type !== 'encounter_start') return log
  const enemies = start.units.filter((u) => u.side === 'enemy')
  const boss = enemies.find((u) => SIGNATURE_BOSSES.includes(u.name)) ?? enemies[0]
  const party = start.units.filter((u) => u.side === 'party')
  const events: CombatLogEvent[] = [start]
  if (partyAttacks) {
    // &showcase=party: each party member attacks the boss in turn (healers heal a friend).
    party.forEach((p, i) =>
      events.push(
        p.role === 'healer'
          ? { type: 'heal', healerId: p.id, targetId: party[(i + 1) % party.length].id, amount: 5, targetHpAfter: party[(i + 1) % party.length].hp }
          : { type: 'attack', attackerId: p.id, targetId: boss.id, hit: true, damage: 10, targetHpAfter: boss.hp - 10 * (i + 1) },
      ),
    )
    return events
  }
  for (let i = 0; i < 3; i++) {
    const t = party[i % party.length]
    events.push({ type: 'attack', attackerId: boss.id, targetId: t.id, hit: i !== 2, damage: 10, targetHpAfter: t.hp - 10 * (i + 1) })
  }
  return events
}

/** A party tier that roughly matches the module (modules are listed in tier order). */
function guessTier(id: string): number {
  const i = MODULES.findIndex((m) => m.encounters.some((e) => e.id === id))
  return i < 0 ? 5 : Math.min(10, Math.max(1, Math.round((i * 10) / 12) + 1))
}
