import { useEffect, useRef } from 'react'
import type { CombatLogEvent } from '../game/combat/types'
import { BattleScene } from './scene'

/**
 * The 3D battle view: a tabletop diorama replaying the log. Loaded lazily by the battle modal
 * (three.js only downloads when a battle is first watched in 3D).
 */
export default function Battle3DView({
  log,
  step,
  speed,
  moduleId,
}: {
  log: CombatLogEvent[]
  step: number
  speed: number
  moduleId: string | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const scene = useRef<BattleScene | null>(null)

  useEffect(() => {
    if (!box.current) return
    const s = new BattleScene(box.current, log, moduleId)
    scene.current = s
    return () => {
      s.dispose()
      scene.current = null
    }
  }, [log, moduleId])

  useEffect(() => {
    scene.current?.show(step, speed)
  }, [step, speed, log, moduleId])

  return <div ref={box} className="b3d relative aspect-[16/10] w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950" />
}
