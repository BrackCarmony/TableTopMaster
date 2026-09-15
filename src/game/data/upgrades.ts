import type { Upgrade } from '../types'

export const UPGRADES: Upgrade[] = [
  {
    id: 'faster-sessions-1',
    name: 'Faster Sessions I',
    description: 'Streamline prep between encounters. -20% encounter cooldown on every table.',
    currency: 'gold',
    cost: 150,
    effect: { kind: 'cooldownMultiplier', value: 0.8 },
  },
  {
    id: 'bigger-loot-1',
    name: 'Bigger Loot I',
    description: 'Your modules pay out better. +25% gold from every victory.',
    currency: 'gold',
    cost: 200,
    effect: { kind: 'goldMultiplier', value: 1.25 },
  },
  {
    id: 'extra-table-1',
    name: 'Rent a Second Room',
    description: 'Unlock another concurrent table.',
    currency: 'gold',
    cost: 400,
    effect: { kind: 'tableSlotBonus', value: 1 },
  },
  {
    id: 'extra-table-2',
    name: 'Rent a Third Room',
    description: 'Unlock yet another concurrent table.',
    currency: 'gold',
    cost: 1200,
    effect: { kind: 'tableSlotBonus', value: 1 },
  },
  {
    id: 'reputation-killer-1',
    name: 'Reputation as a Killer',
    description: 'Word spreads about what happens to your parties. +25% Infamy from every TPK.',
    currency: 'infamy',
    cost: 20,
    effect: { kind: 'infamyMultiplier', value: 1.25 },
  },
  {
    id: 'grimdark-setting-1',
    name: 'Grimdark Setting',
    description: 'Your world is a harsher, richer place. +15% XP from every victory.',
    currency: 'infamy',
    cost: 35,
    effect: { kind: 'xpMultiplier', value: 1.15 },
  },
  {
    id: 'more-chairs-1',
    name: 'More Chairs at the Table',
    description: 'Permanently +1 max players per table.',
    currency: 'infamy',
    cost: 50,
    effect: { kind: 'tableCapacityBonus', value: 1 },
  },
]

export function getUpgradeById(id: string): Upgrade | undefined {
  return UPGRADES.find((u) => u.id === id)
}
