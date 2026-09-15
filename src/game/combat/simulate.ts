import type { RngFn } from '../rng'
import { inRange } from './grid'
import { planTurn } from './ai'
import type { CombatLogEvent, CombatUnit, EncounterResult, EncounterTemplate } from './types'

const MAX_ROUNDS = 50
const HIT_CHANCE = 0.85
const GOLD_PER_ENEMY = 15
const XP_PER_ENEMY = 10

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

function positionParty(partyUnits: CombatUnit[], template: EncounterTemplate): CombatUnit[] {
  return partyUnits.map((u, index) => {
    const pos = template.partyStartPositions[index % template.partyStartPositions.length]
    return { ...u, position: { ...pos }, hp: u.maxHp, alive: true }
  })
}

function checkOutcome(units: CombatUnit[]): 'victory' | 'defeat' | null {
  const partyAlive = units.some((u) => u.side === 'party' && u.alive)
  const enemyAlive = units.some((u) => u.side === 'enemy' && u.alive)
  if (!partyAlive) return 'defeat'
  if (!enemyAlive) return 'victory'
  return null
}

function resolveAttack(
  attacker: CombatUnit,
  target: CombatUnit,
  rng: RngFn,
  log: CombatLogEvent[],
): void {
  const hit = rng() < HIT_CHANCE
  const damage = hit ? Math.max(1, attacker.attackPower - target.defense) : 0
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

  let outcome: 'victory' | 'defeat' | 'stalemate' | null = null

  for (let round = 0; round < MAX_ROUNDS && outcome === null; round++) {
    for (const unit of initiativeOrder) {
      if (!unit.alive) continue
      outcome = checkOutcome(units)
      if (outcome) break

      const action = planTurn(unit, units, template.gridWidth, template.gridHeight)
      if (action.kind === 'idle') continue

      if (action.kind === 'heal') {
        const target = unitById.get(action.targetId)
        if (!target || !target.alive) continue
        const healed = Math.min(target.maxHp - target.hp, unit.healPower)
        target.hp += healed
        log.push({ type: 'heal', healerId: unit.id, targetId: target.id, amount: healed, targetHpAfter: target.hp })
        continue
      }

      if (action.kind === 'move') {
        unit.position = { ...action.path[action.path.length - 1] }
        log.push({ type: 'move', unitId: unit.id, path: action.path.map((p) => ({ ...p })) })
        const target = unitById.get(action.targetId)
        if (target && target.alive && inRange(unit.position, target.position, unit.attackRange)) {
          resolveAttack(unit, target, rng, log)
        }
        continue
      }

      if (action.kind === 'attack') {
        const target = unitById.get(action.targetId)
        if (!target || !target.alive) continue
        resolveAttack(unit, target, rng, log)
      }
    }
    if (!outcome) outcome = checkOutcome(units)

    if (!outcome) {
      for (const unit of units) {
        if (!unit.alive || !unit.attackPowerRampPerRound) continue
        unit.attackPower += unit.attackPowerRampPerRound
        log.push({ type: 'enrage', unitId: unit.id, attackPower: unit.attackPower })
      }
    }
  }

  if (!outcome) outcome = 'stalemate'

  const survivorIds = units.filter((u) => u.side === 'party' && u.alive).map((u) => u.id)
  log.push({ type: 'encounter_end', outcome, survivorIds })

  const enemyCount = template.enemies.length
  const goldReward = outcome === 'victory' ? enemyCount * GOLD_PER_ENEMY : 0
  const xpReward = outcome === 'victory' ? enemyCount * XP_PER_ENEMY : 0

  return { log, outcome, survivorIds, goldReward, xpReward }
}
