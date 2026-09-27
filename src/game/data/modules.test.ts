import { describe, expect, it } from 'vitest'
import { getModuleById, getNextUnlockedCampaignModule, getPreviousUnlockedCampaignModule, MODULES } from './modules'

describe('MODULES', () => {
  it('has no duplicate ids', () => {
    const ids = MODULES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has no duplicate tiers among campaign modules', () => {
    const tiers = MODULES.filter((m) => m.kind === 'campaign').map((m) => m.tier)
    expect(new Set(tiers).size).toBe(tiers.length)
  })
})

const ALL_CAMPAIGN_IDS = MODULES.filter((m) => m.kind === 'campaign').map((m) => m.id)

describe('getNextUnlockedCampaignModule', () => {
  it('returns the next-higher-tier unlocked campaign module', () => {
    const next = getNextUnlockedCampaignModule('undying-court', ALL_CAMPAIGN_IDS)
    expect(next?.id).toBe('shattered-heavens')
  })

  it('skips over tiers that are not yet unlocked', () => {
    const next = getNextUnlockedCampaignModule('undying-court', ['undying-court', 'the-last-throne'])
    expect(next?.id).toBe('the-last-throne')
  })

  it('returns undefined when already at the highest unlocked tier', () => {
    const next = getNextUnlockedCampaignModule('the-last-throne', ALL_CAMPAIGN_IDS)
    expect(next).toBeUndefined()
  })

  it('returns undefined for an unknown module id', () => {
    expect(getNextUnlockedCampaignModule('not-a-real-module', ALL_CAMPAIGN_IDS)).toBeUndefined()
  })

  it('never returns an execution module', () => {
    const next = getNextUnlockedCampaignModule('the-last-throne', MODULES.map((m) => m.id))
    expect(next).toBeUndefined()
  })
})

describe('getPreviousUnlockedCampaignModule', () => {
  it('returns the next-lower-tier unlocked campaign module', () => {
    const previous = getPreviousUnlockedCampaignModule('shattered-heavens', ALL_CAMPAIGN_IDS)
    expect(previous?.id).toBe('undying-court')
  })

  it('skips over tiers that are not yet unlocked', () => {
    const previous = getPreviousUnlockedCampaignModule('the-last-throne', ['goblin-ambush', 'the-last-throne'])
    expect(previous?.id).toBe('goblin-ambush')
  })

  it('returns undefined when already at the lowest tier', () => {
    const previous = getPreviousUnlockedCampaignModule('goblin-ambush', ALL_CAMPAIGN_IDS)
    expect(previous).toBeUndefined()
  })

  it('returns undefined for an unknown module id', () => {
    expect(getPreviousUnlockedCampaignModule('not-a-real-module', ALL_CAMPAIGN_IDS)).toBeUndefined()
  })
})

describe('tier 11-13 modules', () => {
  it('scale hp/attack/defense at 2.2x per tier off the tier-10 baseline', () => {
    const tier10 = getModuleById('undying-court')!
    const tier11 = getModuleById('shattered-heavens')!
    const tank10 = tier10.encounters[0].enemies[0]
    const tank11 = tier11.encounters[0].enemies[0]
    expect(tank11.hp).toBe(Math.round(tank10.hp * 2.2))
    expect(tank11.attackPower).toBe(Math.round(tank10.attackPower * 2.2))
    expect(tank11.defense).toBe(Math.round(tank10.defense * 2.2))
  })
})
