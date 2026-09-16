import type { EncounterTemplate } from '../combat/types'

// Covers every seat a table can ever have (base 4 + every stacking
// tableCapacityBonus upgrade) so extra players from capacity upgrades never
// wrap around and land on top of an earlier party member — see
// data/upgrades.test.ts's positional-capacity guard. y=0..7 fits every
// current grid (the smallest is 8 tall).
const PARTY_START = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 1, y: 2 },
  { x: 1, y: 3 },
  { x: 1, y: 4 },
  { x: 1, y: 5 },
  { x: 1, y: 6 },
  { x: 1, y: 7 },
]

// Campaign tiers scale up by 1.35x per tier on top of their tier-1
// baseline (compounding, so tier 10 lands at 1.35^9 ≈ 14.9x tier 1) — steep
// enough that the fight itself, not just a module's gold unlockCost, is what
// actually gates progress into a new tier.
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
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 2 }, hp: 30, attackPower: 8, defense: 3, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 4 }, hp: 30, attackPower: 8, defense: 3, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Bandit Crossbowman', role: 'dps', position: { x: 7, y: 6 }, hp: 24, attackPower: 9, defense: 1, healPower: 0, moveRange: 2, attackRange: 3, speed: 8 },
    { name: 'Bandit Medic', role: 'healer', position: { x: 8, y: 4 }, hp: 22, attackPower: 4, defense: 1, healPower: 7, moveRange: 3, attackRange: 2, speed: 8 },
  ],
}

export const BANDIT_HIDEOUT_2: EncounterTemplate = {
  id: 'bandit-hideout-2',
  name: 'The Bandit Captain',
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Bandit Captain', role: 'tank', position: { x: 7, y: 4 }, hp: 65, attackPower: 12, defense: 5, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 2 }, hp: 30, attackPower: 8, defense: 3, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 6 }, hp: 30, attackPower: 8, defense: 3, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
  ],
}

export const SUNKEN_CRYPT_1: EncounterTemplate = {
  id: 'sunken-crypt-1',
  name: 'Restless Dead',
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Skeleton Soldier', role: 'tank', position: { x: 7, y: 2 }, hp: 77, attackPower: 15, defense: 11, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Skeleton Soldier', role: 'tank', position: { x: 7, y: 6 }, hp: 77, attackPower: 15, defense: 11, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Skeleton Archer', role: 'dps', position: { x: 8, y: 4 }, hp: 55, attackPower: 20, defense: 5, healPower: 0, moveRange: 2, attackRange: 4, speed: 9 },
  ],
}

export const SUNKEN_CRYPT_2: EncounterTemplate = {
  id: 'sunken-crypt-2',
  name: "The Lich's Vigil",
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Lich', role: 'tank', position: { x: 7, y: 4 }, hp: 128, attackPower: 22, defense: 13, healPower: 0, moveRange: 3, attackRange: 2, speed: 9 },
    { name: 'Skeleton Soldier', role: 'tank', position: { x: 7, y: 2 }, hp: 77, attackPower: 15, defense: 11, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Cultist Priest', role: 'healer', position: { x: 8, y: 6 }, hp: 58, attackPower: 11, defense: 5, healPower: 18, moveRange: 3, attackRange: 2, speed: 9 },
  ],
}

export const DRAGONS_PEAK_1: EncounterTemplate = {
  id: 'dragons-peak-1',
  name: 'Wyrmling Nest',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 2 }, hp: 135, attackPower: 37, defense: 15, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 5 }, hp: 135, attackPower: 37, defense: 15, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 8 }, hp: 135, attackPower: 37, defense: 15, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
  ],
}

export const DRAGONS_PEAK_2: EncounterTemplate = {
  id: 'dragons-peak-2',
  name: 'The Elder Wyrm',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Elder Wyrm', role: 'tank', position: { x: 8, y: 5 }, hp: 271, attackPower: 44, defense: 22, healPower: 0, moveRange: 4, attackRange: 2, speed: 13 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 2 }, hp: 135, attackPower: 37, defense: 15, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 8 }, hp: 135, attackPower: 37, defense: 15, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
  ],
}

export const ABYSSAL_RIFT_1: EncounterTemplate = {
  id: 'abyssal-rift-1',
  name: 'Rift Spawn',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Imp', role: 'dps', position: { x: 8, y: 2 }, hp: 199, attackPower: 60, defense: 23, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
    { name: 'Hellhound', role: 'dps', position: { x: 8, y: 5 }, hp: 249, attackPower: 66, defense: 27, healPower: 0, moveRange: 5, attackRange: 1, speed: 18 },
    { name: 'Imp Shaman', role: 'healer', position: { x: 8, y: 8 }, hp: 183, attackPower: 33, defense: 20, healPower: 43, moveRange: 4, attackRange: 2, speed: 15 },
  ],
}

export const ABYSSAL_RIFT_2: EncounterTemplate = {
  id: 'abyssal-rift-2',
  name: "Demon Prince's Court",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Demon Prince', role: 'tank', position: { x: 8, y: 5 }, hp: 531, attackPower: 80, defense: 40, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Imp', role: 'dps', position: { x: 8, y: 2 }, hp: 199, attackPower: 60, defense: 23, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
    { name: 'Imp', role: 'dps', position: { x: 8, y: 8 }, hp: 199, attackPower: 60, defense: 23, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
  ],
}

export const FROZEN_WASTES_1: EncounterTemplate = {
  id: 'frozen-wastes-1',
  name: 'Wastes Ambush',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 2 }, hp: 314, attackPower: 108, defense: 45, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 5 }, hp: 314, attackPower: 108, defense: 45, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 8 }, hp: 314, attackPower: 108, defense: 45, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
  ],
}

export const FROZEN_WASTES_2: EncounterTemplate = {
  id: 'frozen-wastes-2',
  name: "The Frost Giant's Lair",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Frost Giant', role: 'tank', position: { x: 8, y: 5 }, hp: 1031, attackPower: 143, defense: 72, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 2 }, hp: 314, attackPower: 108, defense: 45, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 8 }, hp: 314, attackPower: 108, defense: 45, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
  ],
}

export const CLOCKWORK_VAULT_1: EncounterTemplate = {
  id: 'clockwork-vault-1',
  name: 'Sentinel Line',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 2 }, hp: 908, attackPower: 169, defense: 133, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 5 }, hp: 908, attackPower: 169, defense: 133, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 8 }, hp: 908, attackPower: 169, defense: 133, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
  ],
}

export const CLOCKWORK_VAULT_2: EncounterTemplate = {
  id: 'clockwork-vault-2',
  name: 'The Iron Golem Core',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Iron Golem', role: 'tank', position: { x: 8, y: 5 }, hp: 1998, attackPower: 254, defense: 182, healPower: 0, moveRange: 2, attackRange: 1, speed: 7 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 2 }, hp: 908, attackPower: 169, defense: 133, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Repair Drone', role: 'healer', position: { x: 8, y: 8 }, hp: 605, attackPower: 91, defense: 91, healPower: 212, moveRange: 4, attackRange: 2, speed: 12 },
  ],
}

export const VOID_BETWEEN_STARS_1: EncounterTemplate = {
  id: 'void-between-stars-1',
  name: 'Star Spawn Swarm',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 2 }, hp: 1798, attackPower: 392, defense: 163, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 5 }, hp: 1798, attackPower: 392, defense: 163, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 8 }, hp: 1798, attackPower: 392, defense: 163, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
  ],
}

export const VOID_BETWEEN_STARS_2: EncounterTemplate = {
  id: 'void-between-stars-2',
  name: "The Void Horror's Maw",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Void Horror', role: 'tank', position: { x: 8, y: 5 }, hp: 3882, attackPower: 449, defense: 229, healPower: 0, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 2 }, hp: 1798, attackPower: 392, defense: 163, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 8 }, hp: 1798, attackPower: 392, defense: 163, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
  ],
}

export const TITANS_FORGE_1: EncounterTemplate = {
  id: 'titans-forge-1',
  name: 'Molten Sentries',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 2 }, hp: 3530, attackPower: 684, defense: 353, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 5 }, hp: 3530, attackPower: 684, defense: 353, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 8 }, hp: 3530, attackPower: 684, defense: 353, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
  ],
}

export const TITANS_FORGE_2: EncounterTemplate = {
  id: 'titans-forge-2',
  name: "The Fire Titan's Anvil",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Fire Titan', role: 'tank', position: { x: 8, y: 5 }, hp: 7557, attackPower: 794, defense: 408, healPower: 0, moveRange: 3, attackRange: 1, speed: 12 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 2 }, hp: 3530, attackPower: 684, defense: 353, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 8 }, hp: 3530, attackPower: 684, defense: 353, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
  ],
}

export const UNDYING_COURT_1: EncounterTemplate = {
  id: 'undying-court-1',
  name: 'The Deathless Guard',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 2 }, hp: 6702, attackPower: 1117, defense: 670, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 7 }, hp: 6702, attackPower: 1117, defense: 670, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Wraith Chancellor', role: 'healer', position: { x: 8, y: 5 }, hp: 5213, attackPower: 596, defense: 447, healPower: 1340, moveRange: 4, attackRange: 3, speed: 16 },
  ],
}

export const UNDYING_COURT_2: EncounterTemplate = {
  id: 'undying-court-2',
  name: "The Undying King's Throne",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'The Undying King', role: 'tank', position: { x: 8, y: 5 }, hp: 14670, attackPower: 1400, defense: 730, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 2 }, hp: 6702, attackPower: 1117, defense: 670, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Wraith Chancellor', role: 'healer', position: { x: 8, y: 8 }, hp: 5213, attackPower: 596, defense: 447, healPower: 1340, moveRange: 4, attackRange: 3, speed: 16 },
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
