import type { Relic } from '../types'

// Delving: crews dig one level deeper every trip they survive. Every five levels is a band of
// the Underdark with its own relics to find; the deeper the band, the better its relics, the
// bigger the haul, and the likelier a cave-in. First-pass numbers, like the islands: Delving
// unlocks around the T8 class tier (~9.4M gold) the way Sailing does around T6, and a crew's
// first levels pay about what the Storm Coast and Frozen Strait do.

export interface DelveBand {
  name: string
  /** First level of the band (each runs five levels; the last runs to MAX_DELVE_DEPTH). */
  from: number
  blurb: string
}

export const DELVE_BANDS: DelveBand[] = [
  { name: 'The Upper Caverns', from: 1, blurb: 'Damp, dark and mostly bats.' },
  { name: 'The Fungal Deep', from: 6, blurb: 'Glowing forests of mushrooms taller than houses.' },
  { name: 'The Drow Cities', from: 11, blurb: 'Spires of black stone, and eyes in every shadow.' },
  { name: 'The Sunless Sea', from: 16, blurb: 'A lake no light has ever touched, and what swims in it.' },
  { name: 'The Bottom of the World', from: 21, blurb: 'Where the mountain keeps its heart.' },
]

export const MAX_DELVE_DEPTH = 30

export function bandForDepth(depth: number): number {
  let band = 0
  DELVE_BANDS.forEach((b, i) => {
    if (depth >= b.from) band = i
  })
  return band
}

export const RELICS: Relic[] = [
  // The Upper Caverns
  { id: 'glowworm-lantern', name: 'Glowworm Lantern', band: 0, description: 'Lights the way, and the lesson. +5% XP.', effect: { kind: 'xpMultiplier', value: 1.05 } },
  { id: 'dwarven-pick', name: 'Dwarven Pick', band: 0, description: 'Still sharp after a thousand years. +5% attack for every character.', effect: { kind: 'partyAttackMultiplier', value: 1.05 } },
  { id: 'cave-pearl', name: 'Cave Pearl', band: 0, description: 'Grown drop by drop in the dark. +5% gold from victories.', effect: { kind: 'goldMultiplier', value: 1.05 } },
  // The Fungal Deep
  { id: 'spore-draught', name: 'Spore Draught', band: 1, description: 'Tastes awful, mends everything. Every character regains 1% of max HP each round.', effect: { kind: 'partyRegenPercent', value: 0.01 } },
  { id: 'toadstool-buckler', name: 'Toadstool Buckler', band: 1, description: 'Springier than steel. +8% defense for every character.', effect: { kind: 'partyDefenseMultiplier', value: 1.08 } },
  { id: 'puffball-tonic', name: 'Puffball Tonic', band: 1, description: 'One sniff and wounds close. +8% healing.', effect: { kind: 'partyHealMultiplier', value: 1.08 } },
  // The Drow Cities
  { id: 'drow-silk', name: 'Drow Silk', band: 2, description: 'Light as shadow, tough as chain. +8% max HP for every character.', effect: { kind: 'partyHpMultiplier', value: 1.08 } },
  { id: 'spider-venom', name: 'Spider Venom', band: 2, description: 'A drop on every blade. +8% attack for every character.', effect: { kind: 'partyAttackMultiplier', value: 1.08 } },
  { id: 'obsidian-mirror', name: 'Obsidian Mirror', band: 2, description: 'Monsters see their own deaths in it. Enemies start fights with 4% less HP.', effect: { kind: 'enemyHpMultiplier', value: 0.96 } },
  // The Sunless Sea
  { id: 'sunless-pearl', name: 'Pearl of the Sunless Sea', band: 3, description: 'Sailors pay anything to see it. +15% voyage gold.', effect: { kind: 'voyageGoldMultiplier', value: 1.15 } },
  { id: 'blindfish-oil', name: 'Blindfish Oil', band: 3, description: 'Keeps the lamps burning between sessions. −8% encounter cooldown.', effect: { kind: 'cooldownMultiplier', value: 0.92 } },
  { id: 'drowned-lantern', name: 'Lantern of the Drowned', band: 3, description: 'It guides lost souls back. +5% chance a fallen character is spared in a campaign fight.', effect: { kind: 'cheatDeathChance', value: 0.05 } },
  // The Bottom of the World
  { id: 'heart-of-the-mountain', name: 'Heart of the Mountain', band: 4, description: 'Still beating. +10% gold from victories.', effect: { kind: 'goldMultiplier', value: 1.1 } },
  { id: 'elder-thought-stone', name: 'Elder Thought-Stone', band: 4, description: 'Hold it and you remember things you never learned. +10% XP.', effect: { kind: 'xpMultiplier', value: 1.1 } },
  { id: 'deep-kings-crown', name: 'Crown of the Deep King', band: 4, description: 'The last king of the deep wore it into battle. +12% attack for every character.', effect: { kind: 'partyAttackMultiplier', value: 1.12 } },
]

export function getRelicById(id: string): Relic | undefined {
  return RELICS.find((r) => r.id === id)
}
