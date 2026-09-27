import type { RngFn } from '../rng'
import { inRange, manhattanDistance } from './grid'
import { planTurn } from './ai'
import type { CombatLogEvent, CombatUnit, EncounterResult, EncounterTemplate, EnemySpawn, GridCoord, Role } from './types'

export const MAX_ROUNDS = 50
const HIT_CHANCE = 0.85

// Reward scales with how tough the enemies actually were, not just their
// count — otherwise a 3-goblin fight and a 3-demon-prince-court fight pay
// the same XP/gold, and a flat per-kill reward is never enough to level up
// more than once regardless of which module you're grinding.
const XP_PER_POWER = 1.5
const GOLD_PER_POWER = 2.5

function enemyPower(spawn: EnemySpawn): number {
  return spawn.hp / 10 + spawn.attackPower + spawn.defense + spawn.healPower
}

function cloneUnits(units: CombatUnit[]): CombatUnit[] {
  return units.map((u) => ({ ...u, position: { ...u.position } }))
}

function buildEnemyUnits(template: EncounterTemplate): CombatUnit[] {
  return template.enemies.map((spawn, index) => ({
    id: `enemy-${template.id}-${index}`,
    name: spawn.name,
    side: 'enemy' as const,
    role: spawn.role,
    level: 1,
    position: { ...spawn.position },
    hp: spawn.hp,
    maxHp: spawn.hp,
    attackPower: spawn.attackPower,
    defense: spawn.defense,
    healPower: spawn.healPower,
    moveRange: spawn.moveRange,
    attackRange: spawn.attackRange,
    speed: spawn.speed,
    alive: true,
    flavor: null,
    attackPowerRampPerRound: spawn.attackPowerRampPerRound,
  }))
}

const ROLE_FRONT_PRIORITY: Record<Role, number> = { tank: 0, dps: 1, healer: 2 }
// Tanks step one column toward the enemies, healers one column away from
// them, dps stay put — an actual front line instead of everyone sharing one
// column and only differing by row.
const ROLE_COLUMN_OFFSET: Record<Role, number> = { tank: 1, dps: 0, healer: -1 }

function averagePosition(positions: GridCoord[]): GridCoord {
  const sum = positions.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / positions.length, y: sum.y / positions.length }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Fills the template's start positions role-first instead of in whatever
 * order units happen to be listed: tanks land on whichever positions are
 * actually closest (by the same Manhattan metric the AI's nearest-enemy
 * targeting uses) to the enemies, dps take the next-closest, and healers
 * land farthest back. Otherwise a tank stuck in a back row can't draw
 * aggro, and a squishier ally standing closer eats the hits meant for it.
 * On top of that row choice, tanks then push one column toward the
 * enemies and healers pull one column back, so the party isn't just a
 * single-file line — it has an actual front and back.
 */
function positionParty(partyUnits: CombatUnit[], template: EncounterTemplate): CombatUnit[] {
  const enemyPositions = template.enemies.map((e) => e.position)
  const hasEnemies = enemyPositions.length > 0
  const enemyCentroid = hasEnemies ? averagePosition(enemyPositions) : null
  const orderedPositions =
    enemyCentroid === null
      ? template.partyStartPositions
      : [...template.partyStartPositions].sort(
          (a, b) => manhattanDistance(a, enemyCentroid) - manhattanDistance(b, enemyCentroid),
        )

  const orderedUnits = [...partyUnits].sort((a, b) => ROLE_FRONT_PRIORITY[a.role] - ROLE_FRONT_PRIORITY[b.role])
  const positionById = new Map(orderedUnits.map((u, i) => [u.id, orderedPositions[i % orderedPositions.length]]))

  const partyBaseX = averagePosition(template.partyStartPositions).x
  const towardEnemies = enemyCentroid === null || enemyCentroid.x === partyBaseX ? 1 : Math.sign(enemyCentroid.x - partyBaseX)

  return partyUnits.map((u) => {
    const pos = positionById.get(u.id)!
    const x = clamp(pos.x + towardEnemies * ROLE_COLUMN_OFFSET[u.role], 0, template.gridWidth - 1)
    return { ...u, position: { x, y: pos.y }, hp: u.maxHp, alive: true }
  })
}

function checkOutcome(units: CombatUnit[]): 'victory' | 'defeat' | null {
  const partyAlive = units.some((u) => u.side === 'party' && u.alive)
  const enemyAlive = units.some((u) => u.side === 'enemy' && u.alive)
  if (!partyAlive) return 'defeat'
  if (!enemyAlive) return 'victory'
  return null
}

/** One hit's worth of hit-roll + damage + death, against a single target. Returns whether it landed. Shared by a normal attack and by each Cleave/Ricochet bonus target, so a bonus hit rolls its own miss chance and dies the same way a primary hit would. */
function applySingleHit(
  attacker: CombatUnit,
  target: CombatUnit,
  rng: RngFn,
  log: CombatLogEvent[],
  damageMultiplier = 1,
): boolean {
  const hit = rng() < HIT_CHANCE
  // Armor Piercer-style artifacts shave a fraction off the target's defense
  // before it's subtracted; Stoneskin-style artifacts then shave a fraction
  // off the resulting raw damage — always still floored at 1 on a hit, same
  // as before either artifact existed.
  const effectiveDefense = target.defense * (1 - (attacker.defensePiercePercent ?? 0))
  const rawDamage = (attacker.attackPower - effectiveDefense) * damageMultiplier
  // Grim Endurance-style artifacts let damageReductionPercent climb every
  // round on top of whatever Stoneskin-style base it already has — hard
  // clamped here (not just at the static artifact-stacking clamp) since this
  // value keeps growing round over round with no cap of its own otherwise.
  const reduction = Math.min(0.9, target.damageReductionPercent ?? 0)
  const mitigatedDamage = rawDamage * (1 - reduction)
  const damage = hit ? Math.max(1, Math.round(mitigatedDamage)) : 0
  if (hit) {
    target.hp = Math.max(0, target.hp - damage)
  }
  log.push({
    type: 'attack',
    attackerId: attacker.id,
    targetId: target.id,
    hit,
    damage,
    targetHpAfter: target.hp,
  })
  if (hit && target.hp <= 0 && target.alive) {
    target.alive = false
    log.push({ type: 'death', unitId: target.id })
  }
  return hit
}

/** Living units on `origin`'s opposite/same side (per `predicate`), other than `exclude`, within `origin.attackRange` — nearest first. Used to find Cleave/Ricochet's extra enemy targets and Chain Mending's extra wounded allies. */
function findNearbyTargets(
  origin: CombatUnit,
  exclude: CombatUnit,
  units: CombatUnit[],
  count: number,
  predicate: (u: CombatUnit) => boolean,
): CombatUnit[] {
  if (count <= 0) return []
  return units
    .filter((u) => u.id !== exclude.id && predicate(u) && inRange(origin.position, u.position, origin.attackRange))
    .sort((a, b) => manhattanDistance(origin.position, a.position) - manhattanDistance(origin.position, b.position))
    .slice(0, count)
}

/**
 * Resolves an attacker's primary hit against `target`, then — only if the
 * primary hit actually landed — Cleave/Ricochet's bonus hits against other
 * nearby enemies, each with its own independent hit roll at a fraction of
 * normal damage. Bonus hits never chain further (they don't re-trigger this).
 */
function resolveAttack(
  attacker: CombatUnit,
  target: CombatUnit,
  rng: RngFn,
  log: CombatLogEvent[],
  units: CombatUnit[],
): void {
  const hit = applySingleHit(attacker, target, rng, log)
  if (!hit || !attacker.bonusTargetsOnHit) return
  const bonusTargets = findNearbyTargets(attacker, target, units, attacker.bonusTargetsOnHit, (u) => u.alive && u.side !== attacker.side)
  for (const bonusTarget of bonusTargets) {
    applySingleHit(attacker, bonusTarget, rng, log, attacker.bonusTargetDamagePercent ?? 0.5)
  }
}

const DEFAULT_REVIVE_HP_FRACTION = 0.5

/** Revivify — brings a fallen unit back at a fraction of maxHp and spends the healer's once-per-battle charge. */
function performRevive(healer: CombatUnit, target: CombatUnit, log: CombatLogEvent[]): void {
  target.alive = true
  target.hp = Math.max(1, Math.round(target.maxHp * (healer.reviveHpFraction ?? DEFAULT_REVIVE_HP_FRACTION)))
  healer.reviveAvailable = false
  log.push({ type: 'revive', healerId: healer.id, targetId: target.id, targetHpAfter: target.hp })
}

/** Resolves a single unit's turn (heal / revive / move+maybe-attack / attack / idle) and applies its effects in place. Shared by the pre-round Defensive Rush pass and the normal round loop so the dispatch logic isn't duplicated. */
function takeTurn(
  unit: CombatUnit,
  units: CombatUnit[],
  unitById: Map<string, CombatUnit>,
  template: EncounterTemplate,
  rng: RngFn,
  log: CombatLogEvent[],
): void {
  const action = planTurn(unit, units, template.gridWidth, template.gridHeight)
  if (action.kind === 'idle') return

  if (action.kind === 'heal') {
    const target = unitById.get(action.targetId)
    if (!target || !target.alive) return
    const healed = Math.min(target.maxHp - target.hp, unit.healPower)
    target.hp += healed
    log.push({ type: 'heal', healerId: unit.id, targetId: target.id, amount: healed, targetHpAfter: target.hp })

    // Chain Mending — the same heal also splashes onto other wounded allies
    // in range, at a fraction of the healer's healPower (not of the primary
    // heal's actual amount, so a fully-topped-off primary target still lets
    // a badly wounded secondary target receive a meaningful heal).
    if (unit.bonusTargetsOnHeal) {
      const bonusAllies = findNearbyTargets(unit, target, units, unit.bonusTargetsOnHeal, (u) => u.alive && u.side === unit.side && u.hp < u.maxHp)
      for (const ally of bonusAllies) {
        const bonusHealed = Math.min(ally.maxHp - ally.hp, Math.round(unit.healPower * (unit.bonusHealPercent ?? 0.5)))
        ally.hp += bonusHealed
        log.push({ type: 'heal', healerId: unit.id, targetId: ally.id, amount: bonusHealed, targetHpAfter: ally.hp })
      }
    }
    return
  }

  if (action.kind === 'revive') {
    const target = unitById.get(action.targetId)
    if (!target || target.alive || !unit.reviveAvailable) return
    performRevive(unit, target, log)
    return
  }

  if (action.kind === 'move') {
    unit.position = { ...action.path[action.path.length - 1] }
    log.push({ type: 'move', unitId: unit.id, path: action.path.map((p) => ({ ...p })) })
    const target = unitById.get(action.targetId)
    if (target && target.alive && inRange(unit.position, target.position, unit.attackRange)) {
      resolveAttack(unit, target, rng, log, units)
    }
    return
  }

  if (action.kind === 'attack') {
    const target = unitById.get(action.targetId)
    if (!target || !target.alive) return
    resolveAttack(unit, target, rng, log, units)
  }
}

/**
 * Runs one deterministic encounter given a seeded RNG. Party units enter at
 * full HP (a "rest" is assumed between encounters); enemies are built fresh
 * from the template. Returns the full event log plus the outcome and any
 * gold/XP reward.
 */
export function runEncounter(partyUnits: CombatUnit[], template: EncounterTemplate, rng: RngFn): EncounterResult {
  const positionedParty = positionParty(cloneUnits(partyUnits), template)
  const enemyUnits = buildEnemyUnits(template)
  const units = [...positionedParty, ...enemyUnits]
  const unitById = new Map(units.map((u) => [u.id, u]))

  const log: CombatLogEvent[] = [
    {
      type: 'encounter_start',
      units: cloneUnits(units),
      gridWidth: template.gridWidth,
      gridHeight: template.gridHeight,
    },
  ]

  const initiativeOrder = [...units].sort((a, b) => b.speed - a.speed)

  // Defensive Rush — a tank with an extra turn at the start of battle acts
  // once here, before round 0 even begins, then never again (the flag is
  // never reset).
  for (const unit of initiativeOrder) {
    if (unit.alive && unit.extraTurnAtStart) takeTurn(unit, units, unitById, template, rng, log)
  }

  let outcome: 'victory' | 'defeat' | 'stalemate' | null = checkOutcome(units)
  let roundsElapsed = 0

  for (let round = 0; round < MAX_ROUNDS && outcome === null; round++) {
    roundsElapsed = round + 1
    for (const unit of initiativeOrder) {
      if (!unit.alive) continue
      outcome = checkOutcome(units)
      if (outcome) break
      takeTurn(unit, units, unitById, template, rng, log)
    }
    if (!outcome) outcome = checkOutcome(units)

    // End-of-round ramps — a boss's flat attackPowerRampPerRound enrage, and
    // the three sustain artifacts (Grim Endurance / Rising Fury / Enduring
    // Grace) that let a party out-scale a long fight instead of just eating
    // an ever-growing hit. All apply on the same timing. Logged as at most
    // one 'enrage' line per SIDE per round (not per unit) — with 3 party
    // members each carrying a ramp, one line per unit every round made
    // watching a long fight painfully slow to step through.
    if (!outcome) {
      const rampedSides = new Set<'party' | 'enemy'>()
      for (const unit of units) {
        if (!unit.alive) continue
        let ramped = false
        if (unit.attackPowerRampPerRound) {
          unit.attackPower += unit.attackPowerRampPerRound
          ramped = true
        }
        if (unit.attackPowerRampPercent) {
          unit.attackPower = Math.round(unit.attackPower * (1 + unit.attackPowerRampPercent))
          ramped = true
        }
        if (unit.healPowerRampPercent) {
          unit.healPower = Math.round(unit.healPower * (1 + unit.healPowerRampPercent))
          ramped = true
        }
        if (unit.damageReductionRampPercent) {
          unit.damageReductionPercent = (unit.damageReductionPercent ?? 0) + unit.damageReductionRampPercent
          ramped = true
        }
        if (ramped) rampedSides.add(unit.side)
      }
      for (const side of rampedSides) {
        log.push({ type: 'enrage', side })
      }
    }
  }

  if (!outcome) outcome = 'stalemate'

  // Revivify fallback — a healer who still has their charge unused (every
  // turn had someone to heal instead, or the fatal blow landed after their
  // last action) gets to use it right now rather than losing the ally purely
  // to turn-order timing. Applies regardless of outcome, so a costly victory
  // can still bring someone back — but a healer who also fell can't cast it.
  for (const unit of units) {
    if (!unit.alive || !unit.reviveAvailable) continue
    const fallenAlly = units.find((u) => u.side === unit.side && !u.alive)
    if (!fallenAlly) continue
    performRevive(unit, fallenAlly, log)
  }
  outcome = checkOutcome(units) ?? outcome

  const survivorIds = units.filter((u) => u.side === 'party' && u.alive).map((u) => u.id)
  log.push({ type: 'encounter_end', outcome, survivorIds })

  const totalPower = template.enemies.reduce((sum, spawn) => sum + enemyPower(spawn), 0)
  // A stalemate still teaches the party something even without a kill, but
  // only a real victory pays out loot — otherwise grinding out an unwinnable
  // fight forever would be a free gold pump.
  const goldReward = outcome === 'victory' ? Math.round(totalPower * GOLD_PER_POWER) : 0
  const xpReward = outcome === 'victory' || outcome === 'stalemate' ? Math.round(totalPower * XP_PER_POWER) : 0

  return { log, outcome, survivorIds, goldReward, xpReward, roundsElapsed }
}
