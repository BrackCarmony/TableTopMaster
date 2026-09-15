import { useEffect, useState } from 'react'
import type { CombatLogEvent } from '../../game/combat/types'
import { computeBoardStateAtStep, getEncounterGridSize } from '../../game/combat/replay'
import { GridView } from './GridView'
import { CombatLogPanel } from './CombatLogPanel'

const SPEED_OPTIONS = [1, 2, 4] as const

export function BattleModal({
  log,
  moduleName,
  onClose,
}: {
  log: CombatLogEvent[]
  moduleName: string | null
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1)

  const lastStep = log.length - 1

  useEffect(() => {
    if (!playing || step >= lastStep) return
    const interval = setInterval(() => {
      setStep((s) => Math.min(lastStep, s + 1))
    }, 700 / speed)
    return () => clearInterval(interval)
  }, [playing, speed, step, lastStep])

  const { width, height } = getEncounterGridSize(log)
  const boardUnits = computeBoardStateAtStep(log, step)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{moduleName ?? 'Battle'}</h2>
          <button className="text-slate-400 hover:text-slate-200" onClick={onClose}>
            ✕
          </button>
        </div>

        <GridView units={boardUnits} width={width} height={height} />

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

        <div className="mt-3">
          <CombatLogPanel log={log} upToStep={step} />
        </div>
      </div>
    </div>
  )
}
