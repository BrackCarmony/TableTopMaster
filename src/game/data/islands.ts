import type { Island } from '../types'

// First-pass balance numbers — like every other constant introduced this
// way (execution tier growth, trophy infamy, etc), expect to retune these
// after playtesting. unlockCost anchors loosely to the classes.ts tier
// ladder (T6=375,000 / T7=1,875,000 / T9=46,875,000 / T10=234,375,000) for
// the same reason Sailing itself unlocks around T6 — each island should
// feel like it's gating on "about as much gold as the next couple of class
// tiers," right up through the late game once every character is capped at
// T10 and gold otherwise has nowhere left to go. The Maelstrom's Eye and
// everything past it goes beyond even that (flat multi-billion costs), since
// they're meant as the "you've maxed everything else" sink, not tied to any
// single tier. The Titan's Graveyard / World Serpent's Coil pair is
// deliberately NOT a "more targets" island like Shattered Archipelago /
// Maelstrom's Eye — bonus-target artifacts do nothing against a single boss
// like the Tarrasque, so these instead help sustain a long single-target
// fight (a party that out-scales a boss's own enrage over time), making
// repeat Tarrasque kills realistically achievable in the late game.
export const ISLANDS: Island[] = [
  {
    id: 'sunken-reef',
    name: 'The Sunken Reef',
    description: 'A shallow, wreck-strewn reef just past the harbor — the safest voyage on the charts, and the first one your ships are equipped for.',
    unlockCost: 0,
    baseGoldReward: 5000,
    baseVoyageDurationMs: 60_000,
    artifactPool: ['commanding-presence', 'revivify', 'extra-range'],
  },
  {
    id: 'storm-coast',
    name: 'The Storm Coast',
    description: 'A squall-battered coastline that chews up lesser ships — richer wrecks to pick through, if your fleet can survive the trip.',
    unlockCost: 1_875_000,
    baseGoldReward: 25_000,
    baseVoyageDurationMs: 90_000,
    artifactPool: ['stoneskin', 'armor-piercer', 'overflowing-font'],
  },
  {
    id: 'frozen-strait',
    name: 'The Frozen Strait',
    description: "A ruinous, ice-locked passage at the edge of the charts — the kind of voyage you only fund once gold stops meaning anything else.",
    unlockCost: 46_875_000,
    baseGoldReward: 120_000,
    baseVoyageDurationMs: 150_000,
    artifactPool: ['juggernauts-hide', 'ruinous-edge', 'wellspring-of-life'],
  },
  {
    id: 'shattered-archipelago',
    name: 'The Shattered Archipelago',
    description: 'A scattering of storm-broken islets, packed close enough together that nothing here ever fights alone.',
    unlockCost: 234_375_000,
    baseGoldReward: 500_000,
    baseVoyageDurationMs: 210_000,
    artifactPool: ['cleaving-strikes', 'ricochet-shot', 'chain-mending'],
  },
  {
    id: 'maelstroms-eye',
    name: "The Maelstrom's Eye",
    description: "The last charted point before the map just... stops. Nobody funds this voyage for the scenery.",
    unlockCost: 1_000_000_000,
    baseGoldReward: 2_000_000,
    baseVoyageDurationMs: 300_000,
    artifactPool: ['whirling-cleave', 'ricochet-barrage', 'cascading-mending'],
  },
  {
    id: 'titans-graveyard',
    name: "The Titan's Graveyard",
    description: 'Bones the size of ships, half-buried in ash — whatever put them there didn\'t need a crowd to do it. Neither will you.',
    unlockCost: 2_500_000_000,
    baseGoldReward: 4_000_000,
    baseVoyageDurationMs: 360_000,
    artifactPool: ['grim-endurance', 'rising-fury', 'enduring-grace'],
  },
  {
    id: 'world-serpents-coil',
    name: "The World Serpent's Coil",
    description: "A ring of open ocean that never quite stops churning — something down there is old, singular, and in absolutely no hurry.",
    unlockCost: 5_000_000_000,
    baseGoldReward: 8_000_000,
    baseVoyageDurationMs: 420_000,
    artifactPool: ['unyielding-resolve', 'relentless-fury', 'boundless-grace'],
  },
]

export function getIslandById(id: string): Island | undefined {
  return ISLANDS.find((i) => i.id === id)
}
