import type { Island } from '../types'

// First-pass balance numbers — like every other constant introduced this
// way (execution tier growth, trophy infamy, etc), expect to retune these
// after playtesting.
export const ISLANDS: Island[] = [
  {
    id: 'sunken-reef',
    name: 'The Sunken Reef',
    description: 'A shallow, wreck-strewn reef just past the harbor — the safest voyage on the charts, and the only one your ships are equipped for so far.',
    baseGoldReward: 5000,
    baseVoyageDurationMs: 60_000,
    artifactPool: ['defensive-rush', 'revivify', 'extra-range'],
  },
]

export function getIslandById(id: string): Island | undefined {
  return ISLANDS.find((i) => i.id === id)
}
