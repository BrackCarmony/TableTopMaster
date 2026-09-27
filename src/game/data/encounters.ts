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

// Campaign tiers scale up by 1.6x per tier on top of their tier-1
// baseline (compounding, so tier 10 lands at 1.6^9 ≈ 107x tier 1) — steep
// enough that the fight itself, not just a module's gold unlockCost, is what
// actually gates progress into a new tier. Bumped up from an initial 1.35x
// once per-level stat growth became proportional to tier (see
// characters.ts) — a fully-leveled high-tier character no longer dilutes
// back toward a low-tier one over time, so the monster curve needed to
// climb to match. Still a first pass — retune again if it feels off.
//
// Enemy headcount also grows with tier, from 2-4 early on up to a full 7 by
// Undying Court — matching the up-to-7-seat table a fully-invested roster
// can field, so the later fights actually look and feel like they're using
// the extra chairs instead of staying a 3-enemy skirmish forever.
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
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 2 }, hp: 36, attackPower: 9, defense: 4, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 4 }, hp: 36, attackPower: 9, defense: 4, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Bandit Crossbowman', role: 'dps', position: { x: 7, y: 6 }, hp: 28, attackPower: 11, defense: 1, healPower: 0, moveRange: 2, attackRange: 3, speed: 8 },
    { name: 'Bandit Medic', role: 'healer', position: { x: 8, y: 4 }, hp: 26, attackPower: 5, defense: 1, healPower: 8, moveRange: 3, attackRange: 2, speed: 8 },
  ],
}

export const BANDIT_HIDEOUT_2: EncounterTemplate = {
  id: 'bandit-hideout-2',
  name: 'The Bandit Captain',
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Bandit Captain', role: 'tank', position: { x: 7, y: 4 }, hp: 77, attackPower: 14, defense: 6, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 2 }, hp: 36, attackPower: 9, defense: 4, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
    { name: 'Bandit', role: 'dps', position: { x: 7, y: 6 }, hp: 36, attackPower: 9, defense: 4, healPower: 0, moveRange: 3, attackRange: 1, speed: 9 },
  ],
}

export const SUNKEN_CRYPT_1: EncounterTemplate = {
  id: 'sunken-crypt-1',
  name: 'Restless Dead',
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Skeleton Soldier', role: 'tank', position: { x: 7, y: 2 }, hp: 108, attackPower: 21, defense: 15, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Skeleton Soldier', role: 'tank', position: { x: 7, y: 6 }, hp: 108, attackPower: 21, defense: 15, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Skeleton Archer', role: 'dps', position: { x: 8, y: 4 }, hp: 77, attackPower: 28, defense: 7, healPower: 0, moveRange: 2, attackRange: 4, speed: 9 },
  ],
}

export const SUNKEN_CRYPT_2: EncounterTemplate = {
  id: 'sunken-crypt-2',
  name: "The Lich's Vigil",
  gridWidth: 9,
  gridHeight: 9,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Lich', role: 'tank', position: { x: 7, y: 4 }, hp: 180, attackPower: 31, defense: 18, healPower: 0, moveRange: 3, attackRange: 2, speed: 9 },
    { name: 'Skeleton Soldier', role: 'tank', position: { x: 7, y: 2 }, hp: 108, attackPower: 21, defense: 15, healPower: 0, moveRange: 3, attackRange: 1, speed: 8 },
    { name: 'Cultist Priest', role: 'healer', position: { x: 8, y: 6 }, hp: 81, attackPower: 15, defense: 7, healPower: 25, moveRange: 3, attackRange: 2, speed: 9 },
  ],
}

export const DRAGONS_PEAK_1: EncounterTemplate = {
  id: 'dragons-peak-1',
  name: 'Wyrmling Nest',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 2 }, hp: 225, attackPower: 62, defense: 25, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 5 }, hp: 225, attackPower: 62, defense: 25, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 8 }, hp: 225, attackPower: 62, defense: 25, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 0 }, hp: 225, attackPower: 62, defense: 25, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
  ],
}

export const DRAGONS_PEAK_2: EncounterTemplate = {
  id: 'dragons-peak-2',
  name: 'The Elder Wyrm',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Elder Wyrm', role: 'tank', position: { x: 8, y: 5 }, hp: 451, attackPower: 73, defense: 37, healPower: 0, moveRange: 4, attackRange: 2, speed: 13 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 2 }, hp: 225, attackPower: 62, defense: 25, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 8 }, hp: 225, attackPower: 62, defense: 25, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
    { name: 'Wyrmling', role: 'dps', position: { x: 8, y: 0 }, hp: 225, attackPower: 62, defense: 25, healPower: 0, moveRange: 4, attackRange: 2, speed: 14 },
  ],
}

export const ABYSSAL_RIFT_1: EncounterTemplate = {
  id: 'abyssal-rift-1',
  name: 'Rift Spawn',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Imp', role: 'dps', position: { x: 8, y: 2 }, hp: 393, attackPower: 118, defense: 45, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
    { name: 'Hellhound', role: 'dps', position: { x: 8, y: 5 }, hp: 491, attackPower: 130, defense: 53, healPower: 0, moveRange: 5, attackRange: 1, speed: 18 },
    { name: 'Imp Shaman', role: 'healer', position: { x: 8, y: 8 }, hp: 361, attackPower: 65, defense: 39, healPower: 85, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Imp', role: 'dps', position: { x: 8, y: 0 }, hp: 393, attackPower: 118, defense: 45, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
  ],
}

export const ABYSSAL_RIFT_2: EncounterTemplate = {
  id: 'abyssal-rift-2',
  name: "Demon Prince's Court",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Demon Prince', role: 'tank', position: { x: 8, y: 5 }, hp: 1048, attackPower: 158, defense: 79, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Imp', role: 'dps', position: { x: 8, y: 2 }, hp: 393, attackPower: 118, defense: 45, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
    { name: 'Imp', role: 'dps', position: { x: 8, y: 8 }, hp: 393, attackPower: 118, defense: 45, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
    { name: 'Imp', role: 'dps', position: { x: 8, y: 0 }, hp: 393, attackPower: 118, defense: 45, healPower: 0, moveRange: 5, attackRange: 3, speed: 16 },
  ],
}

export const FROZEN_WASTES_1: EncounterTemplate = {
  id: 'frozen-wastes-1',
  name: 'Wastes Ambush',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 2 }, hp: 734, attackPower: 253, defense: 105, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 5 }, hp: 734, attackPower: 253, defense: 105, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 8 }, hp: 734, attackPower: 253, defense: 105, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 0 }, hp: 734, attackPower: 253, defense: 105, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 9 }, hp: 734, attackPower: 253, defense: 105, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
  ],
}

export const FROZEN_WASTES_2: EncounterTemplate = {
  id: 'frozen-wastes-2',
  name: "The Frost Giant's Lair",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Frost Giant', role: 'tank', position: { x: 8, y: 5 }, hp: 2411, attackPower: 334, defense: 168, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 2 }, hp: 734, attackPower: 253, defense: 105, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 8 }, hp: 734, attackPower: 253, defense: 105, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 0 }, hp: 734, attackPower: 253, defense: 105, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
    { name: 'Ice Wraith', role: 'dps', position: { x: 8, y: 9 }, hp: 734, attackPower: 253, defense: 105, healPower: 0, moveRange: 4, attackRange: 2, speed: 15 },
  ],
}

export const CLOCKWORK_VAULT_1: EncounterTemplate = {
  id: 'clockwork-vault-1',
  name: 'Sentinel Line',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 2 }, hp: 2517, attackPower: 468, defense: 369, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 5 }, hp: 2517, attackPower: 468, defense: 369, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 8 }, hp: 2517, attackPower: 468, defense: 369, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 0 }, hp: 2517, attackPower: 468, defense: 369, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 9 }, hp: 2517, attackPower: 468, defense: 369, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
  ],
}

export const CLOCKWORK_VAULT_2: EncounterTemplate = {
  id: 'clockwork-vault-2',
  name: 'The Iron Golem Core',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Iron Golem', role: 'tank', position: { x: 8, y: 5 }, hp: 5537, attackPower: 704, defense: 504, healPower: 0, moveRange: 2, attackRange: 1, speed: 7 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 2 }, hp: 2517, attackPower: 468, defense: 369, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Repair Drone', role: 'healer', position: { x: 8, y: 8 }, hp: 1677, attackPower: 252, defense: 252, healPower: 588, moveRange: 4, attackRange: 2, speed: 12 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 0 }, hp: 2517, attackPower: 468, defense: 369, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
    { name: 'Clockwork Sentinel', role: 'tank', position: { x: 8, y: 9 }, hp: 2517, attackPower: 468, defense: 369, healPower: 0, moveRange: 3, attackRange: 1, speed: 10 },
  ],
}

export const VOID_BETWEEN_STARS_1: EncounterTemplate = {
  id: 'void-between-stars-1',
  name: 'Star Spawn Swarm',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 2 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 5 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 8 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 0 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 9 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 9, y: 4 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
  ],
}

export const VOID_BETWEEN_STARS_2: EncounterTemplate = {
  id: 'void-between-stars-2',
  name: "The Void Horror's Maw",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Void Horror', role: 'tank', position: { x: 8, y: 5 }, hp: 12751, attackPower: 1475, defense: 752, healPower: 0, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 2 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 8 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 0 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 8, y: 9 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
    { name: 'Star Spawn', role: 'dps', position: { x: 9, y: 4 }, hp: 5906, attackPower: 1288, defense: 535, healPower: 0, moveRange: 5, attackRange: 3, speed: 20 },
  ],
}

export const TITANS_FORGE_1: EncounterTemplate = {
  id: 'titans-forge-1',
  name: 'Molten Sentries',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 2 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 5 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 8 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 0 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 9 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 9, y: 4 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
  ],
}

export const TITANS_FORGE_2: EncounterTemplate = {
  id: 'titans-forge-2',
  name: "The Fire Titan's Anvil",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Fire Titan', role: 'tank', position: { x: 8, y: 5 }, hp: 29420, attackPower: 3091, defense: 1588, healPower: 0, moveRange: 3, attackRange: 1, speed: 12 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 2 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 8 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 0 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 8, y: 9 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Ember Wraith', role: 'dps', position: { x: 9, y: 4 }, hp: 13742, attackPower: 2663, defense: 1374, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
  ],
}

export const UNDYING_COURT_1: EncounterTemplate = {
  id: 'undying-court-1',
  name: 'The Deathless Guard',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 2 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 7 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Wraith Chancellor', role: 'healer', position: { x: 8, y: 5 }, hp: 24053, attackPower: 2750, defense: 2062, healPower: 6183, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 0 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 9 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 9, y: 3 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 9, y: 6 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
  ],
}

export const UNDYING_COURT_2: EncounterTemplate = {
  id: 'undying-court-2',
  name: "The Undying King's Throne",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'The Undying King', role: 'tank', position: { x: 8, y: 5 }, hp: 67687, attackPower: 6460, defense: 3368, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 2 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Wraith Chancellor', role: 'healer', position: { x: 8, y: 8 }, hp: 24053, attackPower: 2750, defense: 2062, healPower: 6183, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 0 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 8, y: 9 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Deathless Knight', role: 'tank', position: { x: 9, y: 3 }, hp: 30923, attackPower: 5154, defense: 3091, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Wraith Chancellor', role: 'healer', position: { x: 9, y: 6 }, hp: 24053, attackPower: 2750, defense: 2062, healPower: 6183, moveRange: 4, attackRange: 3, speed: 16 },
  ],
}

// Tiers 11-13 continue the campaign past Undying Court at a steeper 2.2x
// per tier (vs. the original ladder's 1.6x) — these are meant to consume a
// levelled-up, sailing-artifact-equipped roster's growth noticeably faster
// than the early game ever needed to. Same structure as tier 9/10 (a
// tank+healer skirmish, then a boss + escort), same headcount cap of 7,
// just scaled up off the Undying Court baseline.
export const SHATTERED_HEAVENS_1: EncounterTemplate = {
  id: 'shattered-heavens-1',
  name: 'The Fallen Choir',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Renegade Seraph', role: 'tank', position: { x: 8, y: 2 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Renegade Seraph', role: 'tank', position: { x: 8, y: 7 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Choir Warden', role: 'healer', position: { x: 8, y: 5 }, hp: 52917, attackPower: 6050, defense: 4536, healPower: 13603, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Renegade Seraph', role: 'tank', position: { x: 8, y: 0 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Renegade Seraph', role: 'tank', position: { x: 8, y: 9 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Renegade Seraph', role: 'tank', position: { x: 9, y: 3 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Renegade Seraph', role: 'tank', position: { x: 9, y: 6 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
  ],
}

export const SHATTERED_HEAVENS_2: EncounterTemplate = {
  id: 'shattered-heavens-2',
  name: "The Fallen Archon's Judgment",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'The Fallen Archon', role: 'tank', position: { x: 8, y: 5 }, hp: 148911, attackPower: 14212, defense: 7410, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Renegade Seraph', role: 'tank', position: { x: 8, y: 2 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Choir Warden', role: 'healer', position: { x: 8, y: 8 }, hp: 52917, attackPower: 6050, defense: 4536, healPower: 13603, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Renegade Seraph', role: 'tank', position: { x: 8, y: 0 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Renegade Seraph', role: 'tank', position: { x: 8, y: 9 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Renegade Seraph', role: 'tank', position: { x: 9, y: 3 }, hp: 68031, attackPower: 11339, defense: 6800, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Choir Warden', role: 'healer', position: { x: 9, y: 6 }, hp: 52917, attackPower: 6050, defense: 4536, healPower: 13603, moveRange: 4, attackRange: 3, speed: 16 },
  ],
}

export const MAW_OF_CREATION_1: EncounterTemplate = {
  id: 'maw-of-creation-1',
  name: "Hunger's Vanguard",
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Voidling Colossus', role: 'tank', position: { x: 8, y: 2 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Voidling Colossus', role: 'tank', position: { x: 8, y: 7 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: "Hunger's Attendant", role: 'healer', position: { x: 8, y: 5 }, hp: 116417, attackPower: 13310, defense: 9980, healPower: 29926, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Voidling Colossus', role: 'tank', position: { x: 8, y: 0 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Voidling Colossus', role: 'tank', position: { x: 8, y: 9 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Voidling Colossus', role: 'tank', position: { x: 9, y: 3 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Voidling Colossus', role: 'tank', position: { x: 9, y: 6 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
  ],
}

export const MAW_OF_CREATION_2: EncounterTemplate = {
  id: 'maw-of-creation-2',
  name: 'The World-Eater',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'The World-Eater', role: 'tank', position: { x: 8, y: 5 }, hp: 327605, attackPower: 31266, defense: 16301, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Voidling Colossus', role: 'tank', position: { x: 8, y: 2 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: "Hunger's Attendant", role: 'healer', position: { x: 8, y: 8 }, hp: 116417, attackPower: 13310, defense: 9980, healPower: 29926, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Voidling Colossus', role: 'tank', position: { x: 8, y: 0 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Voidling Colossus', role: 'tank', position: { x: 8, y: 9 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Voidling Colossus', role: 'tank', position: { x: 9, y: 3 }, hp: 149667, attackPower: 24945, defense: 14960, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: "Hunger's Attendant", role: 'healer', position: { x: 9, y: 6 }, hp: 116417, attackPower: 13310, defense: 9980, healPower: 29926, moveRange: 4, attackRange: 3, speed: 16 },
  ],
}

export const THE_LAST_THRONE_1: EncounterTemplate = {
  id: 'the-last-throne-1',
  name: 'Echoes of Every Ending',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Nameless Guardian', role: 'tank', position: { x: 8, y: 2 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Nameless Guardian', role: 'tank', position: { x: 8, y: 7 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Herald of Endings', role: 'healer', position: { x: 8, y: 5 }, hp: 256116, attackPower: 29282, defense: 21956, healPower: 65837, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Nameless Guardian', role: 'tank', position: { x: 8, y: 0 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Nameless Guardian', role: 'tank', position: { x: 8, y: 9 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Nameless Guardian', role: 'tank', position: { x: 9, y: 3 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Nameless Guardian', role: 'tank', position: { x: 9, y: 6 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
  ],
}

export const THE_LAST_THRONE_2: EncounterTemplate = {
  id: 'the-last-throne-2',
  name: 'Whatever Sits the Throne',
  gridWidth: 10,
  gridHeight: 10,
  partyStartPositions: PARTY_START,
  enemies: [
    { name: 'Whatever Sits the Throne', role: 'tank', position: { x: 8, y: 5 }, hp: 720731, attackPower: 68786, defense: 35862, healPower: 0, moveRange: 4, attackRange: 2, speed: 18 },
    { name: 'Nameless Guardian', role: 'tank', position: { x: 8, y: 2 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Herald of Endings', role: 'healer', position: { x: 8, y: 8 }, hp: 256116, attackPower: 29282, defense: 21956, healPower: 65837, moveRange: 4, attackRange: 3, speed: 16 },
    { name: 'Nameless Guardian', role: 'tank', position: { x: 8, y: 0 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Nameless Guardian', role: 'tank', position: { x: 8, y: 9 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Nameless Guardian', role: 'tank', position: { x: 9, y: 3 }, hp: 329268, attackPower: 54880, defense: 32913, healPower: 0, moveRange: 3, attackRange: 1, speed: 14 },
    { name: 'Herald of Endings', role: 'healer', position: { x: 9, y: 6 }, hp: 256116, attackPower: 29282, defense: 21956, healPower: 65837, moveRange: 4, attackRange: 3, speed: 16 },
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
