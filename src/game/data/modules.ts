import type { AdventureModule } from '../types'
import {
  ABYSSAL_RIFT_1,
  ABYSSAL_RIFT_2,
  BANDIT_HIDEOUT_1,
  BANDIT_HIDEOUT_2,
  DRAGONS_PEAK_1,
  DRAGONS_PEAK_2,
  GOBLIN_AMBUSH_1,
  GOBLIN_AMBUSH_2,
  SUNKEN_CRYPT_1,
  SUNKEN_CRYPT_2,
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
    id: 'sunken-crypt',
    name: 'The Sunken Crypt',
    description: 'A flooded tomb crawling with the restless dead, guarded by a lich who never sleeps.',
    kind: 'campaign',
    tier: 3,
    unlockCost: 1200,
    encounters: [SUNKEN_CRYPT_1, SUNKEN_CRYPT_2],
  },
  {
    id: 'dragons-peak',
    name: "Dragon's Peak",
    description: 'A mountain aerie thick with wyrmlings, ruled over by an elder wyrm.',
    kind: 'campaign',
    tier: 4,
    unlockCost: 6000,
    encounters: [DRAGONS_PEAK_1, DRAGONS_PEAK_2],
  },
  {
    id: 'abyssal-rift',
    name: 'The Abyssal Rift',
    description: 'A tear into the lower planes, spilling out demons in service to a princely horror.',
    kind: 'campaign',
    tier: 5,
    unlockCost: 25000,
    encounters: [ABYSSAL_RIFT_1, ABYSSAL_RIFT_2],
  },
  {
    id: 'tarrasque-execution',
    name: 'The Tarrasque Awaits',
    description:
      "An execution contract, not a campaign. Send a party here to retire them for Infamy — nothing survives the Tarrasque. It only grows angrier with each party fed to it.",
    kind: 'execution',
    tier: 99,
    unlockCost: 0,
    encounters: [TARRASQUE_AWAITS],
    trophyParts: [
      'Scale',
      'Fang',
      'Claw',
      'Horn',
      'Tail Spike',
      'Hide',
      'Eye',
      'Heart',
      'Wing Membrane',
      'Tongue',
    ],
  },
]

export function getModuleById(id: string): AdventureModule | undefined {
  return MODULES.find((m) => m.id === id)
}
