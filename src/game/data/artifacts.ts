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
  {
    id: 'stoneskin',
    name: 'Stoneskin',
    description: 'Your tanks shrug off 15% of every hit they take.',
    role: 'tank',
    effect: { kind: 'tankDamageReduction', value: 0.15 },
  },
  {
    id: 'armor-piercer',
    name: 'Armor Piercer',
    description: "Your dps units ignore 30% of a target's defense.",
    role: 'dps',
    effect: { kind: 'dpsDefensePierce', value: 0.3 },
  },
  {
    id: 'overflowing-font',
    name: 'Overflowing Font',
    description: "Your healers' healing power is boosted by 30%.",
    role: 'healer',
    effect: { kind: 'healerHealPowerBonus', value: 0.3 },
  },
  {
    id: 'juggernauts-hide',
    name: "Juggernaut's Hide",
    description: 'Your tanks shrug off another 25% of every hit they take.',
    role: 'tank',
    effect: { kind: 'tankDamageReduction', value: 0.25 },
  },
  {
    id: 'ruinous-edge',
    name: 'Ruinous Edge',
    description: "Your dps units ignore another 50% of a target's defense.",
    role: 'dps',
    effect: { kind: 'dpsDefensePierce', value: 0.5 },
  },
  {
    id: 'wellspring-of-life',
    name: 'Wellspring of Life',
    description: "Your healers' healing power is boosted by another 50%.",
    role: 'healer',
    effect: { kind: 'healerHealPowerBonus', value: 0.5 },
  },
  {
    id: 'cleaving-strikes',
    name: 'Cleaving Strikes',
    description: 'A landed tank attack also cleaves into one nearby enemy for 50% damage.',
    role: 'tank',
    effect: { kind: 'tankCleave', targets: 1, damagePercent: 0.5 },
  },
  {
    id: 'ricochet-shot',
    name: 'Ricochet Shot',
    description: 'A landed dps attack also ricochets into one other enemy in range for 50% damage.',
    role: 'dps',
    effect: { kind: 'dpsRicochet', targets: 1, damagePercent: 0.5 },
  },
  {
    id: 'chain-mending',
    name: 'Chain Mending',
    description: "A healer's heal also mends one other wounded ally in range for 50% of their healing power.",
    role: 'healer',
    effect: { kind: 'healerChainHeal', targets: 1, healPercent: 0.5 },
  },
  {
    id: 'whirling-cleave',
    name: 'Whirling Cleave',
    description: 'Cleaving Strikes reaches another enemy, and cleave damage rises to 75%.',
    role: 'tank',
    effect: { kind: 'tankCleave', targets: 1, damagePercent: 0.75 },
  },
  {
    id: 'ricochet-barrage',
    name: 'Ricochet Barrage',
    description: 'Ricochet Shot bounces to another enemy, and ricochet damage rises to 75%.',
    role: 'dps',
    effect: { kind: 'dpsRicochet', targets: 1, damagePercent: 0.75 },
  },
  {
    id: 'cascading-mending',
    name: 'Cascading Mending',
    description: 'Chain Mending reaches another ally, and its heal rises to 75% of healing power.',
    role: 'healer',
    effect: { kind: 'healerChainHeal', targets: 1, healPercent: 0.75 },
  },
]

export function getArtifactById(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id)
}
