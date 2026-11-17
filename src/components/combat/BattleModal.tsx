import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { formatNumber } from '../../format'
import type { CombatLogEvent } from '../../game/combat/types'
import { computeBoardStateAtStep, getEncounterGridSize } from '../../game/combat/replay'
import type { BattleRewards } from '../../game/types'
import { GridView } from './GridView'
import { CombatLogPanel } from './CombatLogPanel'
import { MODULES } from '../../game/data/modules'
import { STEP_MS_2D, eventDuration3D } from '../../battle3d/timing'

// The 3D view (three.js) is only downloaded the first time a battle is watched in 3D.
const Battle3DView = lazy(() => import('../../battle3d/Battle3DView'))

type ViewMode = '3d' | '2d'
const VIEW_KEY = 'ttm-battle-view'

/** The 3D camera: the whole board, or one that moves in on whoever is acting. */
type CameraChoice = 'overview' | 'follow'
const CAMERA_KEY = 'ttm-battle-camera'

/** WebGL is needed for the 3D view; without it the grid is the only choice. */
function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function savedView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === '2d' ? '2d' : '3d'
  } catch {
    return '3d'
  }
}

function savedCamera(): CameraChoice {
  try {
    return localStorage.getItem(CAMERA_KEY) === 'follow' ? 'follow' : 'overview'
  } catch {
    return 'overview'
  }
}

const SPEED_OPTIONS = [1, 2, 4] as const

const OUTCOME_STYLE: Record<BattleRewards['outcome'], string> = {
  victory: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
  defeat: 'border-rose-800 bg-rose-950/50 text-rose-300',
  stalemate: 'border-amber-800 bg-amber-950/50 text-amber-300',
}

const OUTCOME_LABEL: Record<BattleRewards['outcome'], string> = {
  victory: 'Victory',
  defeat: 'Defeat',
  stalemate: 'Stalemate',
}

function BattleSummaryBanner({ rewards }: { rewards: BattleRewards }) {
  const parts: string[] = []
  if (rewards.xp > 0) parts.push(`+${formatNumber(rewards.xp)} XP`)
  if (rewards.gold > 0) parts.push(`+${formatNumber(rewards.gold)} Gold`)
  if (rewards.infamy > 0) parts.push(`+${formatNumber(rewards.infamy)} Infamy`)

  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-sm font-medium ${OUTCOME_STYLE[rewards.outcome]}`}>
      {OUTCOME_LABEL[rewards.outcome]}
      {parts.length > 0 ? ` — ${parts.join(', ')}` : ' — no rewards earned'}
    </div>
  )
}

export function BattleModal({
  log,
  moduleName,
  rewards,
  onClose,
}: {
  log: CombatLogEvent[]
  moduleName: string | null
  rewards: BattleRewards | null
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1)
  const webgl = useMemo(hasWebGL, [])
  const [view, setView] = useState<ViewMode>(() => (webgl ? savedView() : '2d'))
  const [camera, setCamera] = useState<CameraChoice>(savedCamera)
  const moduleId = useMemo(() => MODULES.find((m) => m.name === moduleName)?.id ?? null, [moduleName])

  const lastStep = log.length - 1

  // Each step waits for its own animation in 3D (a long walk takes longer than a heal); the
  // grid keeps its steady beat.
  useEffect(() => {
    if (!playing || step >= lastStep) return
    const start = log[0]
    const units = start?.type === 'encounter_start' ? start.units : undefined
    const ms = view === '3d' ? eventDuration3D(log[step], units) : STEP_MS_2D
    const timer = setTimeout(() => setStep((s) => Math.min(lastStep, s + 1)), ms / speed)
    return () => clearTimeout(timer)
  }, [playing, speed, step, lastStep, view, log])

  const chooseView = (v: ViewMode) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* storage blocked: the choice just won't be remembered */
    }
  }

  const chooseCamera = (c: CameraChoice) => {
    setCamera(c)
    try {
      localStorage.setItem(CAMERA_KEY, c)
    } catch {
      /* storage blocked: the choice just won't be remembered */
    }
  }

  const { width, height } = getEncounterGridSize(log)
  const boardUnits = computeBoardStateAtStep(log, step)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        className={`max-h-[94vh] w-full ${view === '3d' ? 'max-w-5xl' : 'max-w-3xl'} overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 className="text-lg font-semibold text-slate-100">{moduleName ?? 'Battle'}</h2>
          {view === '3d' && (
            <div className="ml-auto flex items-center gap-1">
              <span className="mr-1 text-xs text-slate-500">Camera</span>
              {(['overview', 'follow'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => chooseCamera(c)}
                  title={c === 'overview' ? 'The whole board' : 'Moves in on whoever is acting'}
                  className={`rounded-md px-2 py-1 text-xs ${
                    camera === c ? 'bg-sky-700 text-sky-50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {c === 'overview' ? 'Overview' : 'Follow'}
                </button>
              ))}
            </div>
          )}
          <div className={`${view === '3d' ? '' : 'ml-auto '}flex gap-1`}>
            {webgl &&
              (['3d', '2d'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => chooseView(v)}
                  className={`rounded-md px-2 py-1 text-xs ${
                    view === v ? 'bg-emerald-700 text-emerald-50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {v === '3d' ? '3D' : 'Grid'}
                </button>
              ))}
          </div>
          <button className="text-slate-400 hover:text-slate-200" onClick={onClose}>
            ✕
          </button>
        </div>

        {view === '3d' ? (
          <Suspense
            fallback={
              <div className="flex aspect-[16/10] w-full items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-sm text-slate-400">
                Setting up the table…
              </div>
            }
          >
            <Battle3DView log={log} step={step} speed={speed} moduleId={moduleId} camera={camera} />
          </Suspense>
        ) : (
          <GridView units={boardUnits} width={width} height={height} />
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            ◀
          </button>
          <button
            className="rounded-md bg-slate-700 px-3 py-1 text-sm text-slate-100 hover:bg-slate-600"
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
            onClick={() => setStep((s) => Math.min(lastStep, s + 1))}
          >
            ▶
          </button>
          <div className="ml-auto flex gap-1">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setSpeed(opt)}
                className={`rounded-md px-2 py-1 text-xs ${
                  speed === opt ? 'bg-emerald-700 text-emerald-50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {opt}x
              </button>
            ))}
          </div>
          <button
            className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
            onClick={() => setStep(lastStep)}
          >
            Skip to end
          </button>
        </div>

        {rewards && step >= lastStep && <BattleSummaryBanner rewards={rewards} />}

        <div className="mt-3">
          <CombatLogPanel log={log} upToStep={step} />
        </div>
      </div>
    </div>
  )
}
