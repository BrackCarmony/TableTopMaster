import type { Artifact } from '../types'

export const ARTIFACTS: Artifact[] = [
  {
    id: 'defensive-rush',
    name: 'Defensive Rush',
    description: 'Your tanks charge in before the first round even begins — a free extra turn to close the distance and draw aggro immediately.',
    role: 'tank',
    effect: { kind: 'tankExtraTurnAtStart' },
  },
  {
    id: 'revivify',
    name: 'Revivify',
    description: "Once per battle, a healer can revive a fallen ally at half HP — mid-fight if the chance comes up, or as a guaranteed last resort at battle's end.",
    role: 'healer',
    effect: { kind: 'healerReviveOnce', hpFraction: 0.5 },
  },
  {
    id: 'extra-range',
    name: 'Extra Range',
    description: 'Your dps units strike from one tile further away.',
    role: 'dps',
    effect: { kind: 'dpsExtraRange', value: 1 },
  },
]

export function getArtifactById(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id)
}
