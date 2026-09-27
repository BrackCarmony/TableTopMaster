import type { AdventureModule } from '../types'
import {
  ABYSSAL_RIFT_1,
  ABYSSAL_RIFT_2,
  BANDIT_HIDEOUT_1,
  BANDIT_HIDEOUT_2,
  CLOCKWORK_VAULT_1,
  CLOCKWORK_VAULT_2,
  DRAGONS_PEAK_1,
  DRAGONS_PEAK_2,
  FROZEN_WASTES_1,
  FROZEN_WASTES_2,
  GOBLIN_AMBUSH_1,
  GOBLIN_AMBUSH_2,
  MAW_OF_CREATION_1,
  MAW_OF_CREATION_2,
  SHATTERED_HEAVENS_1,
  SHATTERED_HEAVENS_2,
  SUNKEN_CRYPT_1,
  SUNKEN_CRYPT_2,
  TARRASQUE_AWAITS,
  THE_LAST_THRONE_1,
  THE_LAST_THRONE_2,
  TITANS_FORGE_1,
  TITANS_FORGE_2,
  UNDYING_COURT_1,
  UNDYING_COURT_2,
  VOID_BETWEEN_STARS_1,
  VOID_BETWEEN_STARS_2,
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
    id: 'frozen-wastes',
    name: 'The Frozen Wastes',
    description: 'A glacial expanse haunted by ice wraiths, ruled by a Frost Giant who never blinks.',
    kind: 'campaign',
    tier: 6,
    unlockCost: 100000,
    encounters: [FROZEN_WASTES_1, FROZEN_WASTES_2],
  },
  {
    id: 'clockwork-vault',
    name: 'The Clockwork Vault',
    description: 'A sealed dwarven vault, still defended by its constructs long after the builders died.',
    kind: 'campaign',
    tier: 7,
    unlockCost: 500000,
    encounters: [CLOCKWORK_VAULT_1, CLOCKWORK_VAULT_2],
  },
  {
    id: 'void-between-stars',
    name: 'The Void Between Stars',
    description: 'A tear in reality where things that should not exist reach through toward the light.',
    kind: 'campaign',
    tier: 8,
    unlockCost: 2500000,
    encounters: [VOID_BETWEEN_STARS_1, VOID_BETWEEN_STARS_2],
  },
  {
    id: 'titans-forge',
    name: "The Titan's Forge",
    description: 'A volcanic foundry where a fire titan still hammers out weapons for a war long over.',
    kind: 'campaign',
    tier: 9,
    unlockCost: 12000000,
    encounters: [TITANS_FORGE_1, TITANS_FORGE_2],
  },
  {
    id: 'undying-court',
    name: 'The Court of the Undying King',
    description: 'The final resting place of a king who refused to rest, and the court that serves him still.',
    kind: 'campaign',
    tier: 10,
    unlockCost: 60000000,
    encounters: [UNDYING_COURT_1, UNDYING_COURT_2],
  },
  // Tiers 11-13 pick up past Undying Court at a steeper 2.2x-per-tier scale
  // (vs. the original ladder's 1.6x) — see encounters.ts. unlockCost keeps
  // the same ~5x-per-tier pace as tiers 1-10.
  {
    id: 'shattered-heavens',
    name: 'The Shattered Heavens',
    description: 'A war in the sky that never ended — seraphim who kept fighting long after whatever they were defending was gone.',
    kind: 'campaign',
    tier: 11,
    unlockCost: 300000000,
    encounters: [SHATTERED_HEAVENS_1, SHATTERED_HEAVENS_2],
  },
  {
    id: 'maw-of-creation',
    name: 'The Maw of Creation',
    description: 'A wound in reality that swallows everything it touches, patient enough to wait for you specifically.',
    kind: 'campaign',
    tier: 12,
    unlockCost: 1500000000,
    encounters: [MAW_OF_CREATION_1, MAW_OF_CREATION_2],
  },
  {
    id: 'the-last-throne',
    name: 'The Last Throne',
    description: "Whatever sat here first is long gone. What's sitting here now isn't answering questions about that.",
    kind: 'campaign',
    tier: 13,
    unlockCost: 7500000000,
    encounters: [THE_LAST_THRONE_1, THE_LAST_THRONE_2],
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

/** The next-higher-tier unlocked campaign module after `currentModuleId`, or undefined if it's already the highest unlocked one. Used by the Auto-Advance perk. */
export function getNextUnlockedCampaignModule(currentModuleId: string, unlockedModuleIds: string[]): AdventureModule | undefined {
  const current = getModuleById(currentModuleId)
  if (!current) return undefined
  return MODULES.filter((m) => m.kind === 'campaign' && m.tier > current.tier && unlockedModuleIds.includes(m.id)).sort(
    (a, b) => a.tier - b.tier,
  )[0]
}

/** The next-lower-tier unlocked campaign module before `currentModuleId`, or undefined if it's already the lowest. Used by the Auto-Advance perk. */
export function getPreviousUnlockedCampaignModule(currentModuleId: string, unlockedModuleIds: string[]): AdventureModule | undefined {
  const current = getModuleById(currentModuleId)
  if (!current) return undefined
  return MODULES.filter((m) => m.kind === 'campaign' && m.tier < current.tier && unlockedModuleIds.includes(m.id)).sort(
    (a, b) => b.tier - a.tier,
  )[0]
}
