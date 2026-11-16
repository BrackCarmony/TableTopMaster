import * as THREE from 'three'
import type { CombatUnit, Role } from '../game/combat/types'
import { CLASS_TIERS } from '../game/data/classes'
import { ENEMY_SPRITES } from '../components/combat/sprites'
import { buildDragon, buildDrone, buildEldritch, buildHound, buildKraken, type Beast } from './beasts'
import { buildHumanoid, type HumanoidLook, type Weapon } from './humanoid'
import { MaterialBag, hex, pick, seeded, shade } from './kit'

// Every unit in a battle becomes a Figure: party members dressed by race, class and tier, and
// each enemy by name (falling back to its 2D sprite archetype and colour for any name not
// listed here, so a new module always gets something sensible).

const FIGURE_SCALE = 1.2

export type AttackStyle = 'melee' | 'arrow' | 'bolt' | 'breath' | 'slam'

export interface Figure {
  root: THREE.Group
  body: THREE.Group
  head: THREE.Group | null
  legs: THREE.Group[]
  arms: THREE.Group[]
  /** Forearm and shin pivots (people only): [left, right]. */
  elbows: THREE.Group[]
  knees: THREE.Group[]
  /** How the arms rest when doing nothing: shoulder pitch and elbow bend, [left, right]. */
  stance: { shoulder: [number, number]; elbow: [number, number] }
  /** What each hand holds, [left, right]: picks how it attacks and aims. */
  hands: [Weapon | null, Weapon | null]
  wings: THREE.Group[]
  tentacles: THREE.Group[]
  tail: THREE.Group | null
  muzzle: THREE.Object3D
  /** Height of the top of the figure, for the name plate. */
  height: number
  attack: AttackStyle
  /** Colour of its arrows, spells and breath. */
  boltColor: number
  hover: boolean
  /** Takes more than its cell (giants, dragons): pushed a little less far when lunging. */
  big: boolean
  mats: MaterialBag
}

// ---------- party ----------

const TIER_OF = new Map<string, { role: Role; tier: number }>()
for (const role of Object.keys(CLASS_TIERS) as Role[])
  for (const t of CLASS_TIERS[role]) for (const n of t.names) TIER_OF.set(n, { role, tier: t.tier })

/** Armour metal by tier: leather, iron, steel, blued steel, gold, mithril, obsidian, crimson, radiant, starlight. */
const METAL = [0x7a5532, 0x7d8189, 0xb8bec8, 0x6d87b5, 0xe0b33e, 0xd9e6f2, 0x3b3442, 0x9e2b38, 0xf4ecd2, 0xc9b8ff]
/** Glowing trim from tier 6 up. */
const TRIM = [0, 0, 0, 0, 0, 0x7ad7ff, 0xff7a2e, 0xffcf4a, 0xfff6c8, 0xe7a8ff]
const CLOTH = [0x7a3b2e, 0x2f5d8a, 0x3f6d3a, 0x6a3f86, 0x8a6a2e, 0x2e6f6a, 0x8a2e4f, 0x40485a]

const SKINS: Record<string, number[]> = {
  Human: [0xf1c9a5, 0xd9a47c, 0xa8714b, 0x6e4a33, 0xf5d7bd],
  Elf: [0xf7e1cc, 0xe8c8a8, 0xc9e0d0, 0xd8b896],
  Dwarf: [0xe8b796, 0xc98f6a, 0x9e6a4a],
  Halfling: [0xf1c9a5, 0xd9a47c, 0xb7825c],
  'Half-Orc': [0x7f9a62, 0x6d8a5a, 0x8aa06e, 0x9aa38a],
  Tiefling: [0xb8423f, 0x8a3a6e, 0x6e4aa0, 0xc0605a],
  Gnome: [0xf5d0b0, 0xe0b090, 0xc79a78],
  Dragonborn: [0xb83a2e, 0xc9952e, 0x2e6fb8, 0x3a8a4a, 0x9a9aa8, 0x8a5a2e],
}
const HAIR = [0x2b1d14, 0x5a3a22, 0x9a6a2e, 0xd9b45a, 0xb8442e, 0xe8e2d4, 0x1c1c24, 0x6a2e8a]

function partyLook(u: CombatUnit): { look: HumanoidLook; attack: AttackStyle; bolt: number } {
  const rnd = seeded(u.id)
  const race = u.race ?? 'Human'
  const cls = u.className ?? ''
  const tierInfo = TIER_OF.get(cls)
  // Logs saved before class names were recorded: guess the tier from level.
  const tier = tierInfo?.tier ?? Math.min(10, 1 + Math.floor(Math.log2(1 + u.level / 10)))
  const t = tier - 1
  const skin = pick(rnd, SKINS[race] ?? SKINS.Human)
  const look: HumanoidLook = {
    skin,
    hair: pick(rnd, HAIR),
    hairStyle: pick(rnd, ['short', 'long', 'bun', 'short'] as const),
    shirt: pick(rnd, CLOTH),
    pants: shade(pick(rnd, CLOTH), -0.35),
    boots: 0x3a2a1e,
    ears: 'round',
  }
  // Race.
  switch (race) {
    case 'Elf':
      Object.assign(look, { scale: 1.05, width: 0.86, ears: 'long', hairStyle: 'long' })
      break
    case 'Dwarf':
      Object.assign(look, { scale: 0.8, width: 1.35, headSize: 1.1, beard: look.hair })
      break
    case 'Halfling':
      Object.assign(look, { scale: 0.68, headSize: 1.25, ears: 'pointy', hairStyle: 'short' })
      break
    case 'Gnome':
      Object.assign(look, { scale: 0.62, headSize: 1.35, ears: 'pointy', hair: pick(rnd, [0xe8e2d4, 0xd9643a, 0x6ab0e0, 0xe06ab0]) })
      break
    case 'Half-Orc':
      Object.assign(look, { scale: 1.08, width: 1.2, tusks: true, ears: 'pointy', hairStyle: pick(rnd, ['mohawk', 'short'] as const) })
      break
    case 'Tiefling':
      Object.assign(look, { ears: 'pointy', horns: 0x2a2030, tail: skin, hair: pick(rnd, [0x1c1c24, 0x4a1e5a, 0xd9d0e8]) })
      break
    case 'Dragonborn':
      Object.assign(look, { scale: 1.08, width: 1.12, head: 'snout', hairStyle: 'none', hair: null, horns: shade(skin, 0.4), tail: skin })
      break
  }
  const metal = METAL[t]
  const trim = TRIM[t] || null
  look.steel = tier >= 5 ? metal : 0xb8bec8
  let attack: AttackStyle = 'melee'
  let bolt = 0xffffff
  const has = (...names: string[]) => names.includes(cls)

  if (u.role === 'tank') {
    look.armor = metal
    look.trim = trim
    look.helmet = tier === 1 ? 'cap' : tier >= 4 && rnd() < 0.5 ? 'horned' : 'full'
    if (has('Paladin', 'Crusader', 'Templar')) look.cape = has('Crusader') ? 0x9e2b38 : 0xf2efe6
    if (tier >= 5) look.cape = look.cape ?? shade(metal, -0.4)
    if (tier >= 8) look.helmet = 'crown'
    look.left = tier <= 1 ? 'shield' : tier <= 3 ? 'kite' : 'tower'
    look.right = has('Paladin', 'Crusader', 'Templar', 'Immortal Guardian')
      ? 'mace'
      : has('Titan', 'Colossus', 'World-Breaker', 'Avatar of Stone', "Mountain's Wrath")
        ? 'hammer'
        : 'sword'
    if (race === 'Dwarf' && look.right === 'sword') look.right = 'axe'
  } else if (u.role === 'dps') {
    const archer = has('Ranger', 'Sharpshooter', 'Deadeye', 'Archfiend Hunter', 'Apex Predator')
    const mage = has('Battlemage')
    const reaper = has("Death's Herald", 'Soul Render', 'Shadow Reaper')
    const rogue = has('Rogue', 'Assassin', 'Void Stalker')
    look.cape = tier >= 3 ? shade(pick(rnd, CLOTH), -0.3) : null
    look.trim = trim
    look.steel = tier >= 6 ? shade(metal, 0.1) : 0xc8ccd4
    if (archer) {
      look.left = 'bow'
      look.helmet = rnd() < 0.5 ? 'hood' : null
      look.helmetColor = 0x3f5a2e
      look.shirt = 0x4a6a32
      attack = 'arrow'
      bolt = trim ?? 0xe9e3d0
    } else if (mage) {
      look.robe = 0x3a3f8a
      look.right = 'orbstaff'
      look.magic = 0xff8a3a
      look.helmet = 'circlet'
      attack = 'bolt'
      bolt = 0xff8a3a
    } else if (reaper) {
      look.right = 'scythe'
      look.helmet = 'hood'
      look.helmetColor = 0x1c1a24
      look.shirt = 0x2a2533
      look.cape = 0x1c1a24
    } else if (rogue || tier <= 1) {
      look.right = tier <= 1 ? 'axe' : 'dagger'
      look.left = tier <= 1 ? null : 'dagger'
      look.helmet = tier <= 1 ? null : 'hood'
      look.helmetColor = 0x2a2a30
      look.shirt = tier <= 1 ? 0x6a4a2e : 0x2f2f38
    } else {
      // Blademasters and the high-tier killers: a big glowing blade.
      look.right = tier >= 7 ? 'greatsword' : 'sword'
      look.left = tier >= 7 ? null : 'sword'
      look.armor = tier >= 6 ? shade(metal, -0.2) : null
    }
    // Range only counts once the class shoots; a long reach without a bow is magic.
    if (!archer && !mage && u.attackRange > 2 && attack === 'melee') {
      attack = 'bolt'
      bolt = trim ?? 0xb8f2ff
    }
  } else {
    const nature = has('Druid', 'Archdruid', 'Grand Shaman', "Nature's Avatar", 'Worldtree Warden', 'Life-Weaver', 'Eternal Spring', 'Astral Matriarch')
    attack = 'bolt'
    if (nature) {
      look.robe = pick(rnd, [0x3f6d3a, 0x6a5a2e, 0x2e5a4a])
      look.right = 'leafstaff'
      look.helmet = tier >= 3 ? 'antlers' : 'hood'
      look.helmetColor = tier >= 3 ? 0x6b4a2b : 0x4a6a32
      look.magic = 0x8af06a
      bolt = 0x8af06a
      if (tier >= 7) look.halo = 0x9af07a
    } else {
      look.robe = tier <= 1 ? 0x8a8070 : pick(rnd, [0xf2efe6, 0xe8d9a8, 0xd8e6f2])
      look.right = tier <= 1 ? 'book' : 'holystaff'
      look.helmet = has('Bishop') ? 'mitre' : tier >= 4 ? 'circlet' : tier >= 2 ? 'hood' : null
      look.helmetColor = has('Bishop') ? 0xf2efe6 : 0xd8c48a
      look.magic = 0xfff2a8
      bolt = 0xfff2a8
      if (tier >= 5) look.halo = 0xfff2a8
      if (has('Seraph', 'Archon of Mercy', 'Hand of the Divine', 'The Last Light', 'Voice of Creation')) {
        look.wings = 'feather'
        look.wingColor = 0xfdfbf2
      }
    }
    look.trim = trim
    look.cape = tier >= 6 ? (trim ?? 0xf2efe6) : null
  }
  // Each class name's own touches, so the two (or three) names at a tier never look alike.
  const style = CLASS_STYLE[cls]
  if (style) {
    const { attack: a, bolt: b, ...rest } = style
    Object.assign(look, rest)
    if (a) attack = a
    if (b) bolt = b
  }
  return { look, attack, bolt }
}

type ClassStyle = Partial<HumanoidLook> & { attack?: AttackStyle; bolt?: number }

/**
 * Per-class touches on top of the role-and-tier defaults above (armour metal and glowing trim
 * still come from the tier). Every class name in data/classes.ts is listed.
 */
const CLASS_STYLE: Record<string, ClassStyle> = {
  // Tanks.
  Squire: { helmet: 'cap', left: 'shield', right: 'sword' },
  Fighter: { helmet: 'cap', left: 'shield', right: 'axe', cape: null },
  Knight: { helmet: 'full', left: 'kite', right: 'sword', cape: 0x2f5d8a },
  Paladin: { helmet: 'full', left: 'kite', right: 'mace', cape: 0xf2efe6, halo: null },
  Crusader: { helmet: 'full', left: 'kite', right: 'sword', cape: 0x9e2b38 },
  Templar: { helmet: 'full', left: 'tower', right: 'mace', cape: 0xf2efe6, helmetColor: 0xe8e2d4 },
  Warlord: { helmet: 'horned', left: 'tower', right: 'axe', cape: 0x7a1e1e },
  Titan: { helmet: 'horned', left: 'tower', right: 'hammer', width: 1.3 },
  'Immortal Guardian': { helmet: 'crown', left: 'kite', right: 'mace', cape: 0xe0b33e },
  Colossus: { helmet: 'full', left: 'tower', right: 'hammer', width: 1.4 },
  'Bulwark of the Ages': { helmet: 'full', left: 'tower', right: 'sword', cape: 0x40485a },
  'Adamant Sentinel': { helmet: 'full', left: 'tower', right: 'spear' },
  "Mountain's Wrath": { helmet: 'horned', left: 'shield', right: 'hammer', width: 1.35 },
  'World-Breaker': { helmet: 'horned', left: 'tower', right: 'hammer', cape: 0x5a1e1e },
  'Eternal Rampart': { helmet: 'crown', left: 'tower', right: 'sword', cape: 0xf2efe6 },
  'God-Forged Aegis': { helmet: 'crown', left: 'kite', right: 'sword', halo: 0xfff2a8 },
  'Unbreakable One': { helmet: 'full', left: 'tower', right: 'mace', width: 1.3 },
  'Avatar of Stone': { helmet: 'full', left: 'tower', right: 'hammer', skin: 0x8a8580, width: 1.4 },
  'The Last Wall': { helmet: 'crown', left: 'tower', right: 'sword', cape: 0xe7a8ff },
  // Damage.
  Brigand: { right: 'axe', left: null, helmet: null },
  Rogue: { right: 'dagger', left: 'dagger', helmet: 'hood', helmetColor: 0x2f2f38 },
  Ranger: { left: 'bow', helmet: 'hood', helmetColor: 0x3f5a2e, cape: 0x3f5a2e },
  Assassin: { right: 'dagger', left: 'dagger', helmet: 'hood', helmetColor: 0x14141a, shirt: 0x1c1c22, cape: 0x14141a },
  Sharpshooter: { left: 'crossbow', helmet: 'cap', helmetColor: 0x5a4a3a, shirt: 0x6a5a3a },
  Battlemage: { robe: 0x3a3f8a, right: 'orbstaff', left: 'sword', helmet: 'circlet' },
  Blademaster: { right: 'sword', left: 'sword', helmet: null, cape: 0x8a2e4f },
  Deadeye: { left: 'crossbow', helmet: 'hood', helmetColor: 0x40485a },
  'Shadow Reaper': { right: 'scythe', helmet: 'hood', helmetColor: 0x1c1a24, eyes: 0xb8a8ff, eyeGlow: 1 },
  'Archfiend Hunter': { left: 'crossbow', helmet: 'horned', cape: 0x5a1e1e },
  'Void Stalker': { right: 'dagger', left: 'dagger', helmet: 'hood', helmetColor: 0x2a1e48, eyes: 0xc8a8ff, eyeGlow: 1.2 },
  "Death's Herald": { right: 'scythe', helmet: 'hood', helmetColor: 0x0e0e12, robe: 0x1c1a24 },
  'Soul Render': { right: 'scythe', helmet: 'horned', eyes: 0x8af06a, eyeGlow: 1.2 },
  'Storm of Blades': { right: 'sword', left: 'sword', helmet: 'circlet', cape: 0x2e6f6a },
  'World Ender': { right: 'greatsword', helmet: 'horned', cape: 0x3a1010 },
  "Oblivion's Edge": { right: 'greatsword', helmet: 'hood', helmetColor: 0x14141a, eyes: 0xff5a5a, eyeGlow: 1.2 },
  'Apex Predator': { left: 'bow', helmet: 'antlers', helmetColor: 0xe8e0c8, cape: 0x6a4a2e },
  'Doom Incarnate': { right: 'greatsword', helmet: 'horned', eyes: 0xff7a2e, eyeGlow: 1.4 },
  'The Final Cut': { right: 'greatsword', helmet: 'circlet', cape: 0xf2efe6 },
  Annihilator: { right: 'hammer', helmet: 'full', width: 1.25 },
  // Healers.
  Acolyte: { right: 'book', helmet: null },
  Cleric: { right: 'holystaff', helmet: 'hood', helmetColor: 0xd8c48a },
  Druid: { right: 'leafstaff', helmet: 'hood', helmetColor: 0x4a6a32 },
  'High Priest': { right: 'holystaff', left: 'book', helmet: 'circlet' },
  Archdruid: { right: 'leafstaff', helmet: 'antlers' },
  Bishop: { right: 'holystaff', helmet: 'mitre', helmetColor: 0xf2efe6 },
  'Grand Shaman': { right: 'leafstaff', helmet: 'horned', robe: 0x6a4a2e, helmetColor: 0x8a6a4a },
  'Living Saint': { right: 'holystaff', helmet: 'circlet', halo: 0xfff2a8 },
  "Nature's Avatar": { right: 'leafstaff', helmet: 'antlers', helmetColor: 0x5fbf4a, halo: 0x9af07a },
  'Divine Conduit': { right: 'orbstaff', magic: 0xfff2a8, helmet: 'circlet', halo: 0xfff2a8 },
  'Worldtree Warden': { right: 'leafstaff', helmet: 'antlers', robe: 0x3f5a2e, cape: 0x5fbf4a },
  Seraph: { right: 'holystaff', helmet: 'circlet', wings: 'feather', wingColor: 0xfdfbf2, halo: 0xfff2a8 },
  'Life-Weaver': { right: 'leafstaff', helmet: 'circlet', helmetColor: 0x8af06a, wings: 'feather', wingColor: 0xc8f0b0 },
  'Archon of Mercy': { right: 'holystaff', helmet: 'crown', wings: 'feather', wingColor: 0xfdfbf2 },
  'Eternal Spring': { right: 'leafstaff', helmet: 'antlers', helmetColor: 0xf2a8c6, robe: 0x5a8a3a },
  'Voice of Creation': { right: 'orbstaff', magic: 0xffffff, helmet: 'circlet', wings: 'feather', wingColor: 0xe8e0ff },
  'Astral Matriarch': { right: 'orbstaff', magic: 0xc8b8ff, robe: 0x2e2a5a, helmet: 'crown', helmetColor: 0xc8b8ff, bolt: 0xc8b8ff },
  'Hand of the Divine': { right: 'holystaff', helmet: 'crown', wings: 'feather', wingColor: 0xfff6d8, halo: 0xfff2a8 },
  'The Last Light': { right: 'orbstaff', magic: 0xfff6c8, helmet: 'circlet', wings: 'feather', wingColor: 0xffffff, halo: 0xffffff },
}

// ---------- enemies ----------

type EnemyBuild =
  | { kind: 'humanoid'; look: HumanoidLook; attack?: AttackStyle; bolt?: number; hover?: boolean }
  | { kind: 'beast'; build: (m: MaterialBag) => Beast; attack: AttackStyle; bolt?: number; hover?: boolean }

const goblinSkin = 0x6fa04a
const bone = 0xe8e2cf

/** Hand-made looks for every enemy in the current modules. */
const ENEMY_LOOKS: Record<string, () => EnemyBuild> = {
  Goblin: () => ({
    kind: 'humanoid',
    look: { scale: 0.62, headSize: 1.3, skin: goblinSkin, head: 'goblin', ears: 'long', shirt: 0x6a4a2e, pants: 0x4a3a28, boots: 0x3a2a1e, right: 'dagger', eyes: 0xffd23a, eyeGlow: 0.5 },
  }),
  'Goblin Archer': () => ({
    kind: 'humanoid',
    look: { scale: 0.6, headSize: 1.3, skin: goblinSkin, head: 'goblin', ears: 'long', shirt: 0x4a5a2e, pants: 0x4a3a28, boots: 0x3a2a1e, left: 'bow', helmet: 'hood', helmetColor: 0x3a4a22 },
    attack: 'arrow',
  }),
  'Goblin Boss': () => ({
    kind: 'humanoid',
    look: { scale: 0.85, width: 1.3, headSize: 1.25, skin: 0x4f8a36, head: 'goblin', ears: 'long', shirt: 0x5a3a22, pants: 0x3a2a1e, boots: 0x2a1e14, armor: 0x7a5532, helmet: 'horned', helmetColor: 0x7d8189, right: 'club', eyes: 0xff5a2e, eyeGlow: 0.6 },
  }),
  Bandit: () => ({
    kind: 'humanoid',
    look: { skin: 0xd9a47c, hair: 0x3a2a1e, beard: 0x3a2a1e, shirt: 0x8a6a4a, pants: 0x4a3a2e, boots: 0x2a1e14, helmet: 'hood', helmetColor: 0x5a3a2a, right: 'sword' },
  }),
  'Bandit Crossbowman': () => ({
    kind: 'humanoid',
    look: { skin: 0xc98f6a, hair: 0x2b1d14, shirt: 0x6a5a3a, pants: 0x4a3a2e, boots: 0x2a1e14, helmet: 'cap', helmetColor: 0x6a4a2e, left: 'crossbow' },
    attack: 'arrow',
  }),
  'Bandit Medic': () => ({
    kind: 'humanoid',
    look: { skin: 0xf1c9a5, hair: 0x9a6a2e, hairStyle: 'bun', shirt: 0xd8d0b8, pants: 0x4a3a2e, boots: 0x2a1e14, right: 'book', magic: 0xb8ff9a },
    attack: 'bolt',
    bolt: 0xb8ff9a,
  }),
  'Bandit Captain': () => ({
    kind: 'humanoid',
    look: { scale: 1.12, width: 1.15, skin: 0xa8714b, hair: 0x1c1c24, beard: 0x1c1c24, shirt: 0x7a2e2e, pants: 0x2e2a2a, boots: 0x1e1610, armor: 0x5a4a3a, cape: 0x5a1e1e, helmet: 'cap', helmetColor: 0x2a2a2a, right: 'greatsword' },
  }),
  'Skeleton Soldier': () => ({
    kind: 'humanoid',
    look: { bony: true, skin: bone, head: 'skull', shirt: bone, pants: bone, boots: bone, eyes: 0x6ef0ff, eyeGlow: 0.9, right: 'sword', left: 'shield', steel: 0x8a8070 },
  }),
  'Skeleton Archer': () => ({
    kind: 'humanoid',
    look: { bony: true, skin: 0xd8d2c0, head: 'skull', shirt: bone, pants: bone, boots: bone, eyes: 0x6ef0ff, eyeGlow: 0.9, left: 'bow' },
    attack: 'arrow',
  }),
  Lich: () => ({
    kind: 'humanoid',
    look: { scale: 1.1, bony: true, skin: 0xcfc6e8, head: 'skull', shirt: 0x3a2a5a, pants: 0x2a1e40, boots: 0x1e1430, robe: 0x3a2a5a, helmet: 'crown', helmetColor: 0x8a6ae0, right: 'orbstaff', magic: 0xa78bfa, eyes: 0xa78bfa, eyeGlow: 1.2, cape: 0x1e1430 },
    attack: 'bolt',
    bolt: 0xa78bfa,
    hover: true,
  }),
  'Cultist Priest': () => ({
    kind: 'humanoid',
    look: { skin: 0xd9c8b8, shirt: 0x4a1e6a, pants: 0x2a1040, boots: 0x1e1030, robe: 0x4a1e6a, helmet: 'hood', helmetColor: 0x3a1458, right: 'orbstaff', magic: 0x9a4af0, eyes: 0xc08af0, eyeGlow: 0.8 },
    attack: 'bolt',
    bolt: 0x9a4af0,
  }),
  Wyrmling: () => ({ kind: 'beast', build: (m) => buildDragon(m, { color: 0xe0782e, scale: 0.9, wings: true }), attack: 'breath', bolt: 0xff8a2e }),
  'Elder Wyrm': () => ({ kind: 'beast', build: (m) => buildDragon(m, { color: 0xb8401e, belly: 0xe8a050, scale: 2.0, wings: true }), attack: 'breath', bolt: 0xff6a1e }),
  Imp: () => ({
    kind: 'humanoid',
    look: { scale: 0.55, headSize: 1.2, skin: 0xd8463a, ears: 'pointy', horns: 0x2a1e1e, tail: 0xd8463a, wings: 'bat', wingColor: 0x8a2a2a, shirt: 0xd8463a, pants: 0xb83a30, boots: 0x2a1e1e, eyes: 0xffd23a, eyeGlow: 1 },
    hover: true,
  }),
  Hellhound: () => ({ kind: 'beast', build: (m) => buildHound(m, 0x3a1e1a, 1.2, 0xff5a1e), attack: 'breath', bolt: 0xff5a1e }),
  'Imp Shaman': () => ({
    kind: 'humanoid',
    look: { scale: 0.62, headSize: 1.2, skin: 0xb8302a, ears: 'pointy', horns: 0x2a1e1e, tail: 0xb8302a, shirt: 0x5a1e1e, pants: 0x3a1414, boots: 0x2a1e1e, robe: 0x5a1e1e, right: 'orbstaff', magic: 0xff4a2e, eyes: 0xffd23a, eyeGlow: 1 },
    attack: 'bolt',
    bolt: 0xff4a2e,
  }),
  'Demon Prince': () => ({
    kind: 'humanoid',
    look: { scale: 1.6, width: 1.2, skin: 0x8a1e1e, horns: 0x1c1418, tail: 0x8a1e1e, wings: 'bat', wingColor: 0x4a1010, shirt: 0x8a1e1e, pants: 0x2a1010, boots: 0x1c1418, armor: 0x2a2028, trim: 0xff5a1e, right: 'greatsword', steel: 0x2a2028, eyes: 0xffd23a, eyeGlow: 1.3 },
  }),
  'Ice Wraith': () => ({
    kind: 'humanoid',
    look: { skin: 0xbff0ff, head: 'skull', shirt: 0x8ad8f0, pants: 0x8ad8f0, boots: 0x8ad8f0, robe: 0x6ac8e8, helmet: 'hood', helmetColor: 0x4aa8d0, eyes: 0xe0ffff, eyeGlow: 1.4, right: 'scythe', steel: 0xd8f6ff },
    hover: true,
  }),
  'Frost Giant': () => ({
    kind: 'humanoid',
    look: { scale: 1.75, width: 1.3, skin: 0x8ac0e0, hair: 0xf2f6fa, beard: 0xf2f6fa, shirt: 0x5a6a7a, pants: 0x3a4a5a, boots: 0x2a3440, armor: 0xa8c8e0, right: 'club', eyes: 0xe0ffff, eyeGlow: 0.8 },
    attack: 'slam',
  }),
  'Clockwork Sentinel': () => ({
    kind: 'humanoid',
    look: { skin: 0x94a3b8, head: 'box', shirt: 0xb08a3a, pants: 0x6a5a3a, boots: 0x3a3430, armor: 0x94a3b8, trim: 0x6ef0ff, right: 'spear', left: 'kite', eyes: 0x6ef0ff, eyeGlow: 1.4 },
  }),
  'Iron Golem': () => ({
    kind: 'humanoid',
    look: { scale: 1.55, width: 1.45, skin: 0x64748b, head: 'box', shirt: 0x4a5463, pants: 0x3a4250, boots: 0x2a3038, armor: 0x7a8494, trim: 0xff8a2e, eyes: 0xff8a2e, eyeGlow: 1.4 },
    attack: 'slam',
  }),
  'Repair Drone': () => ({ kind: 'beast', build: (m) => buildDrone(m, 0xb08a3a), attack: 'bolt', bolt: 0x6ef0ff, hover: true }),
  'Star Spawn': () => ({ kind: 'beast', build: (m) => buildEldritch(m, { color: 0x818cf8, scale: 0.8, eyes: 3, tentacles: 5 }), attack: 'bolt', bolt: 0xc8b0ff, hover: true }),
  'Void Horror': () => ({ kind: 'beast', build: (m) => buildEldritch(m, { color: 0x4a3fa8, scale: 1.2, eyes: 1, tentacles: 7, mouth: true }), attack: 'melee', hover: true }),
  'Ember Wraith': () => ({
    kind: 'humanoid',
    look: { skin: 0x3a2a24, head: 'skull', shirt: 0x5a2a1a, pants: 0x5a2a1a, boots: 0x5a2a1a, robe: 0x3a1a10, helmet: 'hood', helmetColor: 0x2a140c, eyes: 0xff8a2e, eyeGlow: 1.6, right: 'orbstaff', magic: 0xff8a2e },
    attack: 'bolt',
    bolt: 0xff8a2e,
    hover: true,
  }),
  'Fire Titan': () => ({
    kind: 'humanoid',
    look: { scale: 1.85, width: 1.35, skin: 0xd86a2e, hair: 0xffb02e, hairStyle: 'mohawk', shirt: 0x5a2a1a, pants: 0x3a1a10, boots: 0x2a140c, armor: 0x3a3030, trim: 0xffb02e, right: 'hammer', steel: 0x3a3030, eyes: 0xffe066, eyeGlow: 1.6 },
    attack: 'slam',
  }),
  'Deathless Knight': () => ({
    kind: 'humanoid',
    look: { skin: 0x9ca3af, head: 'skull', shirt: 0x2a2a30, pants: 0x1e1e24, boots: 0x141418, armor: 0x4a4e58, helmet: 'full', helmetColor: 0x4a4e58, cape: 0x2a1e2e, right: 'sword', left: 'kite', steel: 0x6a6e78, eyes: 0x8af06a, eyeGlow: 1.3 },
  }),
  'Wraith Chancellor': () => ({
    kind: 'humanoid',
    look: { skin: 0xc8b8f0, head: 'skull', shirt: 0x3a2a5a, pants: 0x3a2a5a, boots: 0x3a2a5a, robe: 0x2a1e48, helmet: 'mitre', helmetColor: 0x5a3a8a, right: 'book', magic: 0x8b5cf6, eyes: 0xc8a8ff, eyeGlow: 1.4 },
    attack: 'bolt',
    bolt: 0x8b5cf6,
    hover: true,
  }),
  'The Undying King': () => ({
    kind: 'humanoid',
    look: { scale: 1.45, bony: true, skin: 0xf5f3ff, head: 'skull', shirt: bone, pants: bone, boots: bone, armor: 0x2a2a34, trim: 0x8af06a, helmet: 'crown', helmetColor: 0xe0b33e, cape: 0x4a1e5a, right: 'greatsword', steel: 0x8af06a, eyes: 0x8af06a, eyeGlow: 1.6 },
  }),
  'Renegade Seraph': () => ({
    kind: 'humanoid',
    look: { skin: 0xf5d7bd, hair: 0xfca5a5, hairStyle: 'long', shirt: 0xf2efe6, pants: 0xe8d9c8, boots: 0xb89a6a, armor: 0xd8c8a8, wings: 'feather', wingColor: 0xfca5a5, halo: 0xff8a8a, right: 'spear', steel: 0xffd2d2 },
    hover: true,
  }),
  'Choir Warden': () => ({
    kind: 'humanoid',
    look: { skin: 0xf2e6d2, hair: 0xfde68a, shirt: 0xfdf8e8, pants: 0xfdf8e8, boots: 0xd8c48a, robe: 0xfdf8e8, wings: 'feather', wingColor: 0xfff6d8, halo: 0xfde68a, right: 'holystaff', magic: 0xfde68a },
    attack: 'bolt',
    bolt: 0xfde68a,
    hover: true,
  }),
  'The Fallen Archon': () => ({
    kind: 'humanoid',
    look: { scale: 1.7, skin: 0xe8d0b0, hair: 0xfbbf24, hairStyle: 'long', shirt: 0x3a3030, pants: 0x2a2424, boots: 0x1e1a1a, armor: 0xfbbf24, trim: 0xfff2a8, wings: 'feather', wingColor: 0x5a5050, halo: 0xfbbf24, right: 'greatsword', steel: 0xfff2a8, eyes: 0xfff2a8, eyeGlow: 1.2 },
    hover: true,
  }),
  'Voidling Colossus': () => ({ kind: 'beast', build: (m) => buildEldritch(m, { color: 0x4f46e5, scale: 1.8, eyes: 5, tentacles: 8, mouth: true }), attack: 'slam', hover: true }),
  "Hunger's Attendant": () => ({ kind: 'beast', build: (m) => buildEldritch(m, { color: 0x4338ca, scale: 0.95, eyes: 1, tentacles: 6, mouth: true, eyeColor: 0xff6a6a }), attack: 'melee', hover: true }),
  'The World-Eater': () => ({ kind: 'beast', build: (m) => buildEldritch(m, { color: 0x312e81, scale: 2.4, eyes: 1, tentacles: 10, mouth: true, eyeColor: 0xff3a3a, crown: 0x9a8af0 }), attack: 'breath', bolt: 0x9a4af0, hover: true }),
  'Nameless Guardian': () => ({
    kind: 'humanoid',
    look: { scale: 1.6, width: 1.4, skin: 0x57534e, head: 'box', shirt: 0x4a4642, pants: 0x3a3632, boots: 0x2a2622, armor: 0x6a655e, trim: 0xd8d0c0, right: 'tower', left: 'tower', eyes: 0xd8d0c0, eyeGlow: 1.2 },
    attack: 'slam',
  }),
  'Herald of Endings': () => ({
    kind: 'humanoid',
    look: { scale: 1.3, skin: 0xa1a1aa, head: 'skull', shirt: 0x3a3a40, pants: 0x3a3a40, boots: 0x2a2a30, robe: 0x2a2a30, wings: 'feather', wingColor: 0x6a6a72, halo: 0xa1a1aa, right: 'scythe', steel: 0xe4e4e7, eyes: 0xffffff, eyeGlow: 1.4 },
    hover: true,
  }),
  'Whatever Sits the Throne': () => ({ kind: 'beast', build: (m) => buildEldritch(m, { color: 0xd4d4d8, scale: 2.2, eyes: 7, tentacles: 9, mouth: true, eyeColor: 0x1a1a1a, crown: 0xe4e4e7 }), attack: 'breath', bolt: 0xffffff, hover: true }),
  Tarrasque: () => ({ kind: 'beast', build: (m) => buildDragon(m, { color: 0x166534, belly: 0x8aa06e, scale: 2.7, wings: false, fire: 0xff3a1e }), attack: 'melee' }),
  'The Kraken': () => ({ kind: 'beast', build: (m) => buildKraken(m, 0x1c7a8a, 2.4), attack: 'slam', hover: true }),
}

/** Any enemy not listed above: built from its 2D sprite's archetype and colour. */
function fallbackEnemy(name: string): EnemyBuild {
  const def = ENEMY_SPRITES[name] ?? { archetype: 'grunt', color: '#9ca3af' }
  const c = hex(def.color)
  switch (def.archetype) {
    case 'dragon':
      return { kind: 'beast', build: (m) => buildDragon(m, { color: c, scale: 1.4, wings: true }), attack: 'breath', bolt: 0xff8a2e }
    case 'eldritch':
      return { kind: 'beast', build: (m) => buildEldritch(m, { color: c, scale: 1.1 }), attack: 'bolt', bolt: shade(c, 0.4), hover: true }
    case 'undead':
      return { kind: 'humanoid', look: { bony: true, skin: c, head: 'skull', shirt: c, pants: c, boots: c, right: 'sword', eyes: 0x6ef0ff, eyeGlow: 1 } }
    case 'giant':
      return { kind: 'humanoid', look: { scale: 1.7, width: 1.3, skin: c, shirt: shade(c, -0.4), pants: shade(c, -0.5), boots: 0x2a2018, right: 'club' }, attack: 'slam' }
    case 'construct':
      return { kind: 'humanoid', look: { head: 'box', skin: c, shirt: c, pants: shade(c, -0.3), boots: shade(c, -0.5), armor: c, eyes: 0x6ef0ff, eyeGlow: 1.3, right: 'hammer' } }
    case 'celestial':
      return { kind: 'humanoid', look: { skin: 0xf2e6d2, hair: c, shirt: 0xfdf8e8, pants: 0xfdf8e8, boots: 0xd8c48a, robe: 0xfdf8e8, wings: 'feather', wingColor: 0xfff6d8, halo: c, right: 'spear' }, hover: true }
    case 'demon':
      return { kind: 'humanoid', look: { skin: c, horns: 0x1c1418, tail: c, shirt: c, pants: shade(c, -0.4), boots: 0x1c1418, eyes: 0xffd23a, eyeGlow: 1, right: 'axe' } }
    case 'caster':
      return { kind: 'humanoid', look: { skin: 0xd9c8b8, shirt: c, pants: c, boots: 0x2a2018, robe: c, helmet: 'hood', helmetColor: shade(c, -0.3), right: 'orbstaff', magic: c }, attack: 'bolt', bolt: c }
    case 'archer':
      return { kind: 'humanoid', look: { skin: 0xd9a47c, shirt: c, pants: shade(c, -0.4), boots: 0x2a2018, left: 'bow' }, attack: 'arrow' }
    case 'champion':
      return { kind: 'humanoid', look: { scale: 1.2, width: 1.2, skin: 0xd9a47c, shirt: c, pants: shade(c, -0.4), boots: 0x2a2018, armor: shade(c, -0.2), helmet: 'horned', right: 'greatsword' } }
    default:
      return { kind: 'humanoid', look: { skin: 0xd9a47c, shirt: c, pants: shade(c, -0.4), boots: 0x2a2018, right: 'sword' } }
  }
}

export function hasClassStyle(name: string): boolean {
  return name in CLASS_STYLE
}

export function hasCustomLook(name: string): boolean {
  return name in ENEMY_LOOKS
}

// ---------- assembling ----------

/** How an arm rests holding this: staves, books and bows held out in front, shields across the body, blades at the ready. */
function restFor(w: Weapon | null | undefined): [number, number] {
  switch (w) {
    case 'staff':
    case 'orbstaff':
    case 'leafstaff':
    case 'holystaff':
      return [-0.15, -1.3]
    case 'book':
      return [-0.2, -1.25]
    case 'bow':
    case 'crossbow':
      return [-0.45, -1.1]
    case 'shield':
    case 'kite':
    case 'tower':
      return [-0.3, -0.85]
    case null:
    case undefined:
      return [0.02, -0.12]
    default:
      return [-0.1, -0.7]
  }
}

function fromHumanoid(look: HumanoidLook, attack: AttackStyle, bolt: number, hover: boolean): Figure {
  const mats = new MaterialBag()
  const h = buildHumanoid(look, mats)
  const root = new THREE.Group()
  root.add(h.group)
  const p = h.parts
  const [sl, el] = restFor(look.left)
  const [sr, er] = restFor(look.right)
  return {
    root,
    body: p.body,
    head: p.head,
    legs: [p.legL, p.legR],
    arms: [p.armL, p.armR],
    elbows: p.elbows,
    knees: p.knees,
    stance: { shoulder: [sl, sr], elbow: [el, er] },
    hands: [look.left ?? null, look.right ?? null],
    wings: [p.wingL, p.wingR].filter((w): w is THREE.Group => !!w),
    tentacles: [],
    tail: p.tail ?? null,
    muzzle: p.muzzle,
    height: h.height,
    attack,
    boltColor: bolt,
    hover,
    big: (look.scale ?? 1) > 1.3,
    mats,
  }
}

function fromBeast(build: (m: MaterialBag) => Beast, attack: AttackStyle, bolt: number, hover: boolean): Figure {
  const mats = new MaterialBag()
  const b = build(mats)
  const root = new THREE.Group()
  root.add(b.group)
  const p = b.parts
  return {
    root,
    body: p.body,
    head: p.head,
    legs: p.legs,
    arms: [],
    elbows: [],
    knees: [],
    stance: { shoulder: [0, 0], elbow: [0, 0] },
    hands: [null, null],
    wings: p.wings,
    tentacles: p.tentacles,
    tail: p.tail,
    muzzle: p.muzzle,
    height: b.height,
    attack,
    boltColor: bolt,
    hover,
    big: b.height > 1.3,
    mats,
  }
}

export function buildFigure(u: CombatUnit): Figure {
  let fig: Figure
  if (u.side === 'party') {
    const { look, attack, bolt } = partyLook(u)
    fig = fromHumanoid(look, attack, bolt, false)
  } else {
    const e = (ENEMY_LOOKS[u.name] ?? (() => fallbackEnemy(u.name)))()
    const fallbackAttack: AttackStyle = u.attackRange > 1 ? 'bolt' : 'melee'
    fig =
      e.kind === 'humanoid'
        ? fromHumanoid(e.look, e.attack ?? (e.look.left === 'bow' || e.look.left === 'crossbow' ? 'arrow' : fallbackAttack), e.bolt ?? e.look.magic ?? 0xffffff, !!e.hover)
        : fromBeast(e.build, e.attack, e.bolt ?? 0xffffff, !!e.hover)
    // A ranged enemy should never walk up and hit you with a bow.
    if (u.attackRange > 1 && fig.attack === 'melee') fig.attack = 'bolt'
  }
  // Figures stand a little taller than a tile is wide, like miniatures on a battle map.
  fig.root.scale.setScalar(FIGURE_SCALE)
  fig.height *= FIGURE_SCALE
  fig.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
    }
  })
  return fig
}
