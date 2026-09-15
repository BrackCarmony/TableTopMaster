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

export const SUNKEN_CRYPT_1: EncounterTemplate = {
  id: 'sunken-crypt-1',
  name: 'Restless Dead',
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Skeleton Soldier', role: 'tank', position: { x: 7, y: 2 }, hp: 42, attackPower: 8, defense: 6, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Skeleton Soldier', role: 'tank', position: { x: 7, y: 6 }, hp: 42, attackPower: 8, defense: 6, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Skeleton Archer', role: 'dps', position: { x: 8, y: 4 }, hp: 30, attackPower: 11, defense: 3, healPower: 0, moveRange: 2, attackRange: 4, speed: 9 },
  ],
}

export const SUNKEN_CRYPT_2: EncounterTemplate = {
  id: 'sunken-crypt-2',
  name: "The Lich's Vigil",
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Lich', role: 'tank', position: { x: 7, y: 4 }, hp: 70, attackPower: 12, defense: 7, healPower: 0, moveRange: 3, attackRange: 2, speed: 9 },
    { name: 'Skeleton Soldier', role: 'tank', position: { x: 7, y: 2 }, hp: 42, attackPower: 8, defense: 6, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Cultist Priest', role: 'healer', position: { x: 8, y: 6 }, hp: 32, attackPower: 6, defense: 3, healPower: 10, moveRange: 3, attackRange: 2, speed: 9 },
  ],
}

export const DRAGONS_PEAK_1: EncounterTemplate = {
  id: 'dragons-peak-1',
  name: 'Wyrmling Nest',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 2 }, hp: 55, attackPower: 15, defense: 6, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 5 }, hp: 55, attackPower: 15, defense: 6, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 8 }, hp: 55, attackPower: 15, defense: 6, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
  ],
}

export const DRAGONS_PEAK_2: EncounterTemplate = {
  id: 'dragons-peak-2',
  name: 'The Elder Wyrm',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Elder Wyrm', role: 'tank', position: { x: 8, y: 5 }, hp: 110, attackPower: 18, defense: 9, healPower: 0, moveRange: 4, attackRange: 2, speed: 13 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 2 }, hp: 55, attackPower: 15, defense: 6, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 8 }, hp: 55, attackPower: 15, defense: 6, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
  ],
}

export const ABYSSAL_RIFT_1: EncounterTemplate = {
  id: 'abyssal-rift-1',
  name: 'Rift Spawn',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Imp', role: 'dps', position: { x: 8, y: 2 }, hp: 60, attackPower: 18, defense: 7, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
    { name: 'Hellhound', role: 'dps', position: { x: 8, y: 5 }, hp: 75, attackPower: 20, defense: 8, healPower: 0, moveRange: 5, attackRange: 1, speed: 18 },
    { name: 'Imp Shaman', role: 'healer', position: { x: 8, y: 8 }, hp: 55, attackPower: 10, defense: 6, healPower: 13, moveRange: 4, attackRange: 2, speed: 15 },
  ],
}

export const ABYSSAL_RIFT_2: EncounterTemplate = {
  id: 'abyssal-rift-2',
  name: "Demon Prince's Court",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Demon Prince', role: 'tank', position: { x: 8, y: 5 }, hp: 160, attackPower: 24, defense: 12, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Imp', role: 'dps', position: { x: 8, y: 2 }, hp: 60, attackPower: 18, defense: 7, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
    { name: 'Imp', role: 'dps', position: { x: 8, y: 8 }, hp: 60, attackPower: 18, defense: 7, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
  ],
}

/**
 * Execution encounter: absurdly overtuned, meant to wipe the party on
 * purpose. Its attack power ramps every round it's still fighting, so no
 * matter how leveled/healer-sustained a party gets, the fight can't stall
 * out into a stalemate — it always eventually one-shots its way through.
 */
export const TARRASQUE_AWAITS: EncounterTemplate = {
  id: 'tarrasque-awaits',
  name: 'The Tarrasque',
  gridWidth: 8,
  gridHeight: 8,
  partyStartPositions: PARTY_START,
  enemies: [
    {
      name: 'Tarrasque',
      role: 'dps',
      position: { x: 5, y: 3 },
      hp: 2600,
      attackPower: 60,
      defense: 22,
      healPower: 0,
      moveRange: 4,
      attackRange: 2,
      speed: 20,
      attackPowerRampPerRound: 25,
    },
  ],
}
