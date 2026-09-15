import { useEffect, useRef } from 'react'
import type { CombatLogEvent } from '../../game/combat/types'
import { buildNameLookup, describeEvent } from '../../game/combat/replay'

export function CombatLogPanel({ log, upToStep }: { log: CombatLogEvent[]; upToStep: number }) {
  const nameById = buildNameLookup(log)
  const containerRef = useRef<HTMLDivElement>(null)

  const lines = log.slice(0, upToStep + 1).map((event, i) => ({ id: i, text: describeEvent(event, nameById) }))

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [upToStep])

  return (
    <div ref={containerRef} className="h-48 overflow-y-auto rounded-md border border-slate-800 bg-slate-950 p-2 text-xs">
      {lines.map((line) => (
        <div key={line.id} className="border-b border-slate-900 py-1 text-slate-300 last:border-none">
          {line.text}
        </div>
      ))}
    </div>
  )
}
