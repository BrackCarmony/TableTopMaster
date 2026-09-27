import { formatCompact, formatNumber } from '../../format'
import type { CombatUnit } from '../../game/combat/types'
import { EnemySprite, PlayerSprite } from './sprites'

export function GridView({ units, width, height }: { units: CombatUnit[]; width: number; height: number }) {
  // If two units ever end up sharing a cell, never let a dead one's token
  // cover a living one — a hidden-but-alive unit reads as a far more
  // confusing bug than one corpse being drawn over another.
  const byCell = new Map<string, CombatUnit>()
  for (const u of units) {
    const key = `${u.position.x},${u.position.y}`
    const existing = byCell.get(key)
    if (!existing || (!existing.alive && u.alive)) {
      byCell.set(key, u)
    }
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
              className={`flex h-[90%] w-[90%] flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-semibold leading-tight transition-opacity ${
                unit.alive ? 'opacity-100' : 'opacity-25 grayscale'
              } ${
                unit.side === 'party'
                  ? 'border border-emerald-500 bg-emerald-900/70 text-emerald-100'
                  : 'border border-rose-600 bg-rose-950/70 text-rose-100'
              }`}
              title={`${unit.name} (${formatNumber(unit.hp)}/${formatNumber(unit.maxHp)} HP)`}
            >
              {unit.side === 'party' ? (
                <PlayerSprite role={unit.role} level={unit.level} />
              ) : (
                <EnemySprite name={unit.name} />
              )}
              <span className="w-full truncate px-0.5 text-center">{unit.name.split(' ')[0]}</span>
              <span className="text-[10px] text-slate-300">
                {formatCompact(unit.hp)}/{formatCompact(unit.maxHp)}
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
