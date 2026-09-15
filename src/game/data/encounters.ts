import type { EncounterTemplate } from '../combat/types'

const PARTY_START = [
  { x: 1, y: 2 },
  { x: 1, y: 3 },
  { x: 1, y: 4 },
  { x: 1, y: 5 },
]

export const GOBLIN_AMBUSH_1: EncounterTemplate = {
  id: 'goblin-ambush-1',
  name: 'Goblin Skirmishers',
  gridWidth: 8,
  gridHeight: 8,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Goblin', role: 'dps', position: { x: 6, y: 2 }, hp: 14, attackPower: 4, defense: 1, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Goblin', role: 'dps', position: { x: 6, y: 4 }, hp: 14, attackPower: 4, defense: 1, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Goblin Archer', role: 'dps', position: { x: 6, y: 6 }, hp: 12, attackPower: 5, defense: 0, healPower: 0, moveRange: 2, attackRange: 3, speed: 8 },
  ],
}

export const GOBLIN_AMBUSH_2: EncounterTemplate = {
  id: 'goblin-ambush-2',
  name: "Goblin Boss's Last Stand",
  gridWidth: 8,
  gridHeight: 8,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Goblin Boss', role: 'tank', position: { x: 6, y: 3 }, hp: 34, attackPower: 7, defense: 3, healPower: 0, moveRange: 3, attackRange: 1, speed: 7 },
    { name: 'Goblin', role: 'dps', position: { x: 6, y: 5 }, hp: 14, attackPower: 4, defense: 1, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
  ],
}

export const BANDIT_HIDEOUT_1: EncounterTemplate = {
  id: 'bandit-hideout-1',
  name: 'Bandit Lookouts',
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 2 }, hp: 22, attackPower: 6, defense: 2, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 4 }, hp: 22, attackPower: 6, defense: 2, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Bandit Crossbowman', role: 'dps', position: { x: 7, y: 6 }, hp: 18, attackPower: 7, defense: 1, healPower: 0, moveRange: 2, attackRange: 3, speed: 8 },
    { name: 'Bandit Medic', role: 'healer', position: { x: 8, y: 4 }, hp: 16, attackPower: 3, defense: 1, healPower: 5, moveRange: 3, attackRange: 2, speed: 8 },
  ],
}

export const BANDIT_HIDEOUT_2: EncounterTemplate = {
  id: 'bandit-hideout-2',
  name: 'The Bandit Captain',
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Bandit Captain', role: 'tank', position: { x: 7, y: 4 }, hp: 48, attackPower: 9, defense: 4, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 2 }, hp: 22, attackPower: 6, defense: 2, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 6 }, hp: 22, attackPower: 6, defense: 2, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
  ],
}

/** Execution encounter: absurdly overtuned, meant to wipe the party on purpose. */
export const TARRASQUE_AWAITS: EncounterTemplate = {
  id: 'tarrasque-awaits',
  name: 'The Tarrasque',
  gridWidth: 8,
  gridHeight: 8,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'The Tarrasque', role: 'dps', position: { x: 5, y: 3 }, hp: 900, attackPower: 60, defense: 15, healPower: 0, moveRange: 4, attackRange: 2, speed: 20 },
  ],
}
