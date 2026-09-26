import type { Island } from '../types'

// First-pass balance numbers — like every other constant introduced this
// way (execution tier growth, trophy infamy, etc), expect to retune these
// after playtesting. unlockCost anchors loosely to the classes.ts tier
// ladder (T6=375,000 / T7=1,875,000 / T9=46,875,000) for the same reason
// Sailing itself unlocks around T6 — each island should feel like it's
// gating on "about as much gold as the next couple of class tiers," right
// up through the late game once every character is capped at T10 and gold
// otherwise has nowhere left to go.
export const ISLANDS: Island[] = [
  {
    id: 'sunken-reef',
    name: 'The Sunken Reef',
    description: 'A shallow, wreck-strewn reef just past the harbor — the safest voyage on the charts, and the first one your ships are equipped for.',
    unlockCost: 0,
    baseGoldReward: 5000,
    baseVoyageDurationMs: 60_000,
    artifactPool: ['defensive-rush', 'revivify', 'extra-range'],
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
]

export function getIslandById(id: string): Island | undefined {
  return ISLANDS.find((i) => i.id === id)
}
