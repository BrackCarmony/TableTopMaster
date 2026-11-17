import { DELVE_BANDS, MAX_DELVE_DEPTH, RELICS, bandForDepth, getRelicById } from '../game/data/relics'
import { canBuyUpgrade, getNode, missingRequirements } from '../game/data/upgradeTree'
import { getUpgradeById } from '../game/data/upgrades'
import {
  caveInChance,
  delveDuration,
  delveGold,
  effectiveCrewSlots,
  hasDelvingUnlock,
  relicFindChance,
} from '../game/engine'
import { crewCost, useGameStore } from '../game/store'
import type { DelveCrew } from '../game/types'
import { Amount } from './currency'
import { useSection } from './nav'
import { PageHeader } from './shell/Shell'
import { describeEffects } from './upgradeText'

// Delving: crews dig a level deeper every trip they survive, until the level they turn back at;
// a cave-in sends them back to the surface. Each band of five levels has its own relics.

/** A colour for each band of the Underdark, top to bottom. */
const BAND_COLOR = ['#a8a29e', '#2dd4bf', '#a78bfa', '#60a5fa', '#fb923c']

const pct = (x: number) => `${Math.round(x * 100)}%`
const levels = (b: number) => {
  const from = DELVE_BANDS[b].from
  const to = b + 1 < DELVE_BANDS.length ? DELVE_BANDS[b + 1].from - 1 : MAX_DELVE_DEPTH
  return `levels ${from}–${to}`
}

/** The shaft, left to right: every level coloured by band, the crew where it is, a flag where it turns back. */
function DepthTrack({ crew }: { crew: DelveCrew }) {
  return (
    <div className="relative mt-3 pt-5">
      <div className="flex h-3 gap-px overflow-hidden rounded">
        {Array.from({ length: MAX_DELVE_DEPTH }, (_, i) => {
          const level = i + 1
          const beyond = level > crew.turnBackAt
          return (
            <div
              key={level}
              className="flex-1"
              title={`Level ${level} · ${DELVE_BANDS[bandForDepth(level)].name}`}
              style={{ background: BAND_COLOR[bandForDepth(level)], opacity: beyond ? 0.15 : level <= crew.deepest ? 0.85 : 0.45 }}
            />
          )
        })}
      </div>
      {/* The crew, and where it turns back. */}
      <div className="absolute top-0 -translate-x-1/2 text-sm transition-all duration-500" style={{ left: `${((crew.depth - 0.5) / MAX_DELVE_DEPTH) * 100}%` }} title={`Digging at level ${crew.depth}`}>
        ⛏️
      </div>
      <div
        className="absolute top-3 h-5 w-0.5 -translate-x-1/2 bg-slate-100"
        style={{ left: `${(crew.turnBackAt / MAX_DELVE_DEPTH) * 100}%` }}
        title={`Turns back at level ${crew.turnBackAt}`}
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>Surface</span>
        <span>Level {MAX_DELVE_DEPTH}</span>
      </div>
    </div>
  )
}

function CrewCard({ crew }: { crew: DelveCrew }) {
  const dm = useGameStore((s) => s.dm)
  const setTurnBack = useGameStore((s) => s.setTurnBack)
  const band = bandForDepth(crew.depth)
  const full = delveDuration(crew.depth, dm)
  const progress = Math.max(0, Math.min(1, 1 - crew.delveRemaining / full))
  const last = crew.last
  const relic = last?.relicId ? getRelicById(last.relicId) : undefined
  return (
    <div id={`crew-${crew.id}`} className="scroll-mt-28 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-100">⛏️ {crew.name}</h3>
        <span className="text-xs text-slate-500">
          Lifetime <Amount value={crew.lifetimeGold} currency="gold" size={12} className="text-amber-300/90" />
        </span>
      </div>
      <div className="mt-1 text-sm" style={{ color: BAND_COLOR[band] }}>
        Level {crew.depth} · {DELVE_BANDS[band].name}
      </div>
      <DepthTrack crew={crew} />

      {/* This trip. */}
      <div className="mt-3 rounded-lg bg-slate-950/50 px-3 py-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>This trip</span>
          <span className="tabular-nums">back in {Math.ceil(crew.delveRemaining / 1000)}s</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: BAND_COLOR[band] }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-slate-400">
            Haul <Amount value={delveGold(crew.depth, dm)} currency="gold" size={12} className="text-amber-300" />
          </span>
          <span className={caveInChance(crew.depth, dm) > 0.25 ? 'text-rose-300' : 'text-slate-400'}>💥 {pct(caveInChance(crew.depth, dm))} cave-in</span>
          <span className="text-slate-400">💎 {pct(relicFindChance(dm))} relic</span>
        </div>
      </div>

      {/* How deep it goes. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-400">
          Turn back at level
          <span className="ml-1 text-slate-500">(deeper pays more, caves in more)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTurnBack(crew.id, crew.turnBackAt - 1)}
            disabled={crew.turnBackAt <= 1}
            className="h-7 w-7 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            aria-label="Turn back shallower"
          >
            −
          </button>
          <span className="w-10 text-center text-sm font-semibold tabular-nums text-slate-100">{crew.turnBackAt}</span>
          <button
            onClick={() => setTurnBack(crew.id, crew.turnBackAt + 1)}
            disabled={crew.turnBackAt >= MAX_DELVE_DEPTH}
            className="h-7 w-7 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            aria-label="Dig deeper"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-800/80 pt-2 text-xs">
        {!last ? (
          <span className="italic text-slate-500">First trip under way.</span>
        ) : last.kind === 'collapse' ? (
          <span className="text-rose-300">💥 Cave-in at level {last.depth}: back to the surface, haul lost.</span>
        ) : last.kind === 'relic' ? (
          <span className="text-violet-300">
            💎 Found <b>{relic?.name}</b> at level {last.depth}, and <Amount value={last.gold} currency="gold" size={12} />
          </span>
        ) : (
          <span className="text-slate-400">
            Last trip: <Amount value={last.gold} currency="gold" size={12} className="text-amber-300/90" /> from level {last.depth}
          </span>
        )}
        {crew.deepest > 0 && <span className="ml-2 text-slate-500">· deepest {crew.deepest}</span>}
      </div>
    </div>
  )
}

function Relics() {
  const found = useGameStore((s) => s.dm.discoveredRelicIds)
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-violet-300">
        Relics · {found.length}/{RELICS.length} found
      </h2>
      <p className="mb-3 text-xs text-slate-500">Each one is permanent, and helps every table. Deeper bands hide better ones.</p>
      <div className="flex flex-col gap-3">
        {DELVE_BANDS.map((band, b) => (
          <div key={band.name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium" style={{ color: BAND_COLOR[b] }}>
                {band.name}
              </span>
              <span className="text-[11px] text-slate-500">
                {levels(b)} · {band.blurb}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {RELICS.filter((r) => r.band === b).map((r) =>
                found.includes(r.id) ? (
                  <div key={r.id} className="rounded-lg bg-slate-800/60 px-3 py-2" title={r.description}>
                    <div className="text-sm text-slate-100">💎 {r.name}</div>
                    <div className="text-xs" style={{ color: BAND_COLOR[b] }}>
                      {describeEffects([r.effect])}
                    </div>
                  </div>
                ) : (
                  <div key={r.id} className="rounded-lg border border-dashed border-slate-700 px-3 py-2 text-slate-600">
                    <div className="text-sm">❔ Undiscovered</div>
                    <div className="text-xs">Somewhere in {levels(b)}</div>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Locked() {
  const dm = useGameStore((s) => s.dm)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const [, go] = useSection()
  const unlock = getUpgradeById('delving-unlock')!
  const node = getNode('delve')!
  const missing = missingRequirements(dm, node)
  const open = canBuyUpgrade(dm, unlock.id)
  return (
    <div>
      <PageHeader />
      <div className="rounded-xl border border-orange-900/60 bg-orange-950/10 p-5">
        <h2 className="mb-2 text-base font-semibold text-orange-200">🔒 The tunnels are sealed</h2>
        <ul className="mb-4 flex list-disc flex-col gap-1 pl-5 text-sm text-orange-100/80">
          <li>Hire crews and send them down. Every trip they survive, they dig a level deeper.</li>
          <li>Deeper levels pay much more gold, but the chance of a cave-in climbs; one sends the crew back to the surface.</li>
          <li>You choose how deep each crew goes before it stops. Relics found along the way help every table, for good.</li>
        </ul>
        {missing.length > 0 ? (
          <p className="text-sm text-slate-400">
            Opens once you have {missing.map((m) => `${m.node.name}${m.rank > 1 ? ` rank ${m.rank}` : ''}`).join(' and ')}.{' '}
            <button onClick={() => go('shop')} className="text-orange-300 underline-offset-2 hover:underline">
              See the Upgrades tree
            </button>
          </p>
        ) : (
          <button
            disabled={!open || dm.gold < unlock.cost}
            onClick={() => buyUpgrade(unlock.id)}
            className="rounded-md bg-orange-700 px-3 py-1.5 text-sm font-medium text-orange-50 hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            Open the Underdark · <Amount value={unlock.cost} currency="gold" />
          </button>
        )}
      </div>
    </div>
  )
}

export function DelvingPanel() {
  const dm = useGameStore((s) => s.dm)
  const crews = useGameStore((s) => s.crews)
  const hireCrew = useGameStore((s) => s.hireCrew)
  if (!hasDelvingUnlock(dm)) return <Locked />
  const slots = effectiveCrewSlots(dm)
  const full = crews.length >= slots
  const cost = crewCost(crews.length)
  return (
    <div>
      <PageHeader
        actions={
          <button
            disabled={full || dm.gold < cost}
            onClick={() => hireCrew()}
            className="rounded-md bg-orange-700 px-3 py-1.5 text-sm font-medium text-orange-50 hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {full ? (
              `All crews hired (${crews.length}/${slots})`
            ) : (
              <>
                + Hire a crew · <Amount value={cost} currency="gold" />
              </>
            )}
          </button>
        }
      />
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-300">
        Crews · {crews.length}/{slots}
      </h2>
      {crews.length === 0 && <p className="text-sm italic text-slate-500">No crews yet: hire your first above.</p>}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {crews.map((c) => (
          <CrewCard key={c.id} crew={c} />
        ))}
      </div>
      <Relics />
    </div>
  )
}
