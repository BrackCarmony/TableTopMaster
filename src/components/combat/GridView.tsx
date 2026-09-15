import type { CombatUnit } from '../../game/combat/types'

const ROLE_ICON: Record<CombatUnit['role'], string> = {
  tank: '🛡️',
  dps: '⚔️',
  healer: '✚',
}

export function GridView({ units, width, height }: { units: CombatUnit[]; width: number; height: number }) {
  const byCell = new Map<string, CombatUnit>()
  for (const u of units) {
    byCell.set(`${u.position.x},${u.position.y}`, u)
  }

  const cells = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const unit = byCell.get(`${x},${y}`)
      cells.push(
        <div
          key={`${x},${y}`}
          className="relative flex aspect-square items-center justify-center border border-slate-800 bg-slate-950/50"
        >
          {unit && (
            <div
              className={`flex h-[85%] w-[85%] flex-col items-center justify-center rounded-md text-[10px] font-semibold leading-tight transition-opacity ${
                unit.alive ? 'opacity-100' : 'opacity-25 grayscale'
              } ${
                unit.side === 'party'
                  ? 'border border-emerald-500 bg-emerald-900/70 text-emerald-100'
                  : 'border border-rose-600 bg-rose-950/70 text-rose-100'
              }`}
              title={`${unit.name} (${unit.hp}/${unit.maxHp} HP)`}
            >
              <span>{ROLE_ICON[unit.role]}</span>
              <span className="w-full truncate px-0.5 text-center">{unit.name.split(' ')[0]}</span>
              <span className="text-[9px] text-slate-300">
                {unit.hp}/{unit.maxHp}
              </span>
            </div>
          )}
        </div>,
      )
    }
  }

  return (
    <div
      className="grid w-full gap-0.5 overflow-hidden rounded-md border border-slate-800 bg-slate-900 p-1"
      style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
    >
      {cells}
    </div>
  )
}
