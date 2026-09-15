import type { AdventureModule } from '../types'
import {
  BANDIT_HIDEOUT_1,
  BANDIT_HIDEOUT_2,
  GOBLIN_AMBUSH_1,
  GOBLIN_AMBUSH_2,
  TARRASQUE_AWAITS,
} from './encounters'

export const MODULES: AdventureModule[] = [
  {
    id: 'goblin-ambush',
    name: 'Goblin Ambush',
    description: 'A starter dungeon crawl against a warband of goblins. Good for a fresh party.',
    kind: 'campaign',
    tier: 1,
    unlockCost: 0,
    encounters: [GOBLIN_AMBUSH_1, GOBLIN_AMBUSH_2],
  },
  {
    id: 'bandit-hideout',
    name: "The Bandit's Hideout",
    description: 'A tougher run through a bandit camp, capped off by their captain.',
    kind: 'campaign',
    tier: 2,
    unlockCost: 250,
    encounters: [BANDIT_HIDEOUT_1, BANDIT_HIDEOUT_2],
  },
  {
    id: 'tarrasque-execution',
    name: 'The Tarrasque Awaits',
    description:
      "An execution contract, not a campaign. Send a party here to retire them for Infamy — nothing survives the Tarrasque.",
    kind: 'execution',
    tier: 99,
    unlockCost: 0,
    encounters: [TARRASQUE_AWAITS],
  },
]

export function getModuleById(id: string): AdventureModule | undefined {
  return MODULES.find((m) => m.id === id)
}
