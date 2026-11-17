import { useCallback, useSyncExternalStore } from 'react'
import { getClassTier, maxTier } from '../game/data/classes'
import { TREE, canBuyUpgrade, nextRankId } from '../game/data/upgradeTree'
import { getUpgradeById } from '../game/data/upgrades'
import { effectiveShipSlots, effectiveTableCapacity, hasSailingUnlock, roleTierUnlockCost, veteranTierCost } from '../game/engine'
import { newPlayerCost, shipCost, useGameStore } from '../game/store'
import type { Role } from '../game/types'

// The game's sections, the URL hash that opens each (so they can be bookmarked and the back
// button works), and the little badges on the nav that say where there's something to do.

export type SectionId = 'tables' | 'roster' | 'shop' | 'sailing' | 'trophies' | 'classes'

export interface Section {
  id: SectionId
  icon: string
  label: string
  /** One line under the section's title. */
  blurb: string
}

export const SECTIONS: Section[] = [
  { id: 'tables', icon: '🎲', label: 'Tables', blurb: 'Seat your players, pick their adventures and watch the battles.' },
  { id: 'roster', icon: '👥', label: 'Roster', blurb: 'Recruit players and train their roles; veterans keep their tiers through every death.' },
  { id: 'shop', icon: '🌳', label: 'Upgrades', blurb: 'Six branches of upgrades. Each opens more of the tree as you buy into it.' },
  { id: 'sailing', icon: '⚓', label: 'Sailing', blurb: 'Send ships to explore islands for gold and artifacts that empower every party.' },
  { id: 'trophies', icon: '🏆', label: 'Trophies', blurb: 'Parts taken from fallen bosses. Every one raises the starting level of new characters.' },
  { id: 'classes', icon: '📖', label: 'Classes', blurb: 'Every class at every tier, and how its stats grow with level.' },
]

const isSection = (s: string): s is SectionId => SECTIONS.some((x) => x.id === s)

function readHash(): SectionId {
  const h = location.hash.replace(/^#/, '')
  return isSection(h) ? h : 'tables'
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

/** The open section (from the URL hash) and a way to switch. */
export function useSection(): [SectionId, (s: SectionId, anchor?: string) => void] {
  const section = useSyncExternalStore(subscribe, readHash, () => 'tables' as SectionId)
  const go = useCallback((s: SectionId, anchor?: string) => {
    if (readHash() !== s) location.hash = s
    // Jump to a particular card (a table, a ship) once the section has rendered.
    requestAnimationFrame(() => {
      const el = anchor ? document.getElementById(anchor) : null
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else window.scrollTo({ top: 0 })
    })
  }, [])
  return [section, go]
}

/**
 * A nav badge: a count (or just a dot) of things that want doing there. `attention` is for
 * things that are stuck until you act (a table with no adventure), `available` for things you
 * can afford, `neutral` for plain totals; `locked` shows a padlock.
 */
export interface Badge {
  count?: number
  tone: 'attention' | 'available' | 'neutral' | 'locked'
  title: string
}

const ROLES: Role[] = ['tank', 'dps', 'healer']

export function useNavBadges(): Partial<Record<SectionId, Badge>> {
  const dm = useGameStore((s) => s.dm)
  const players = useGameStore((s) => s.players)
  const tables = useGameStore((s) => s.tables)
  const ships = useGameStore((s) => s.ships)
  const badges: Partial<Record<SectionId, Badge>> = {}

  // Tables that can't run or are running short-handed while players sit on the bench.
  const capacity = effectiveTableCapacity(dm)
  const benched = players.filter((p) => p.tableId === null).length
  const stuck = tables.filter((t) => {
    const seated = players.filter((p) => p.tableId === t.id).length
    return !t.assignedModuleId || seated === 0 || (seated < capacity && benched > 0)
  }).length
  if (stuck) badges.tables = { count: stuck, tone: 'attention', title: `${stuck} table${stuck === 1 ? ' needs' : 's need'} players or an adventure` }

  // Players with a role tier or veteran tier they could buy now, or a recruit you can afford.
  const trainable = players.filter(
    (p) =>
      dm.infamy >= veteranTierCost(dm, p.legacyTier) ||
      ROLES.some((r) => p.roleTiers[r] < maxTier(r) && dm.gold >= roleTierUnlockCost(dm, getClassTier(r, p.roleTiers[r] + 1).unlockCost)),
  ).length
  if (trainable) badges.roster = { count: trainable, tone: 'available', title: `${trainable} player${trainable === 1 ? '' : 's'} can be trained` }
  else if (dm.infamy >= newPlayerCost(players.length, dm)) badges.roster = { tone: 'available', title: 'You can afford a new recruit' }

  const affordable = TREE.map((n) => nextRankId(dm, n))
    .filter((id): id is string => !!id && canBuyUpgrade(dm, id))
    .map((id) => getUpgradeById(id)!)
    .filter((u) => (u.currency === 'gold' ? dm.gold : dm.infamy) >= u.cost).length
  if (affordable) badges.shop = { count: affordable, tone: 'available', title: `${affordable} upgrade${affordable === 1 ? '' : 's'} you can afford` }

  if (!hasSailingUnlock(dm)) {
    const unlock = getUpgradeById('sailing-unlock')
    badges.sailing =
      unlock && dm.gold >= unlock.cost
        ? { tone: 'available', title: 'You can afford to take to the seas' }
        : { tone: 'locked', title: `Unlock in Upgrades or here for ${unlock?.cost ?? '?'} gold` }
  } else {
    const idle = ships.filter((s) => !s.assignedIslandId).length
    if (idle) badges.sailing = { count: idle, tone: 'attention', title: `${idle} ship${idle === 1 ? ' is' : 's are'} idle at the dock` }
    else if (ships.length < effectiveShipSlots(dm) && dm.gold >= shipCost(ships.length))
      badges.sailing = { tone: 'available', title: 'You can afford another ship' }
  }

  if (dm.trophies.length) badges.trophies = { count: dm.trophies.length, tone: 'neutral', title: `${dm.trophies.length} trophies` }
  return badges
}
