// Portraits for every class (public/classes, made with an AI image model; originals in
// art/classes) and a line about each. A class's files are named by its slug:
// "Mountain's Wrath" -> mountains-wrath.jpg and mountains-wrath-thumb.jpg.

export function classSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const base = `${import.meta.env.BASE_URL}classes/`

export const classArt = (name: string) => `${base}${classSlug(name)}.jpg`
export const classThumb = (name: string) => `${base}${classSlug(name)}-thumb.jpg`

export const CLASS_CAPTION: Record<string, string> = {
  // Tanks
  Squire: 'Padded coat, borrowed shield, and more nerve than sense.',
  Fighter: 'Mismatched mail, a battered shield and a grin for every scar.',
  Knight: 'Polished plate, a lion on the shield, and a vow to keep.',
  Paladin: 'Sun-blessed steel and a mace that rings like a temple bell.',
  Crusader: 'Crimson and steel, and a faith that does not bend.',
  Templar: 'A pale sentinel behind a shield as tall as a door.',
  Warlord: 'Spikes, horns and a voice that turns a rout into a charge.',
  Titan: 'A wall of bronze scales with a hammer to match.',
  'Immortal Guardian': 'Golden, ageless, and still standing when the dust settles.',
  Colossus: 'Mithril plate on a frame built like a fortress gate.',
  'Bulwark of the Ages': 'Every dent in that shield is a century it held.',
  'Adamant Sentinel': 'Black adamantine, planted like it grew there.',
  "Mountain's Wrath": 'Armor of living rock, with magma where the seams should be.',
  'World-Breaker': 'Each swing of that hammer leaves the ground in pieces.',
  'Eternal Rampart': 'A shield that throws up a wall of golden light.',
  'God-Forged Aegis': 'Plate hammered out in heaven, and a halo to prove it.',
  'Unbreakable One': 'Arrows bounce, blades snap, and he does not move.',
  'Avatar of Stone': 'The mountain itself, given a shield and a grudge.',
  'The Last Wall': 'Between the world and the dark, a shield full of stars.',
  // Damage
  Brigand: 'A notched axe, a patched jerkin and no plan at all.',
  Rogue: 'Two knives, a hood, and a hand already in your pocket.',
  Ranger: 'The arrow is already on its way.',
  Assassin: 'Masked, hooded, and gone before the body hits the floor.',
  Sharpshooter: 'Goggles up, crossbow level, and a gnome who never misses.',
  Battlemage: 'Steel in one hand and fire in the other.',
  Blademaster: 'Two swords and a dance nobody else knows the steps to.',
  Deadeye: 'A crossbow, a calm breath, and one shot.',
  'Shadow Reaper': 'Tattered robes, violet eyes, and a scythe that whispers.',
  'Archfiend Hunter': 'Wears what is left of the last demon that tried.',
  'Void Stalker': 'Stars in the cloak and the void on both blades.',
  "Death's Herald": 'The ravens arrive first. Then the scythe.',
  'Soul Render': 'A scythe trailing the ghosts it has already taken.',
  'Storm of Blades': 'Two swords in hand and a dozen more on the wind.',
  'World Ender': 'A greatsword of fire, carried like it weighs nothing.',
  "Oblivion's Edge": 'A blade of darkness with a single line of red.',
  'Apex Predator': 'Antlers, war paint and a bow that has never lost a hunt.',
  'Doom Incarnate': 'Black scales, gold plate and a sword still burning.',
  'The Final Cut': 'One gleaming blade. One stroke. Nothing after.',
  Annihilator: 'Violet plate and a hammer that cracks the sky.',
  // Healers
  Acolyte: 'A plain robe, a prayer book, and a light just starting to glow.',
  Cleric: 'A staff with a little sun on top, and a hand that mends.',
  Druid: 'Moss, vines, a leafy staff, and a fox who follows.',
  'High Priest': 'Gold-stitched robes and a book heavy with blessings.',
  Archdruid: 'Antlers of wood and a hawk who keeps watch.',
  Bishop: 'A tall mitre, a golden crozier and a blessing for everyone.',
  'Grand Shaman': 'Feathers, bones and the spirits on a first-name basis.',
  'Living Saint': 'Flowers bloom wherever this one stands.',
  "Nature's Avatar": 'Green antlers, a halo of leaves, and spring on the move.',
  'Divine Conduit': 'Light from above, poured through a golden orb.',
  'Worldtree Warden': 'Roots in the ground and bark on the shoulders.',
  Seraph: 'White wings, a golden halo and a staff topped with a star.',
  'Life-Weaver': 'Green wings and threads of life between the fingers.',
  'Archon of Mercy': 'Silver scales, white wings and a crown of compassion.',
  'Eternal Spring': 'Blossoming antlers and a storm of cherry petals.',
  'Voice of Creation': 'Sings, and the light listens.',
  'Astral Matriarch': 'Robes of night sky and a crown of starlight.',
  'Hand of the Divine': 'Golden wings, a radiant crown, and heaven at their back.',
  'The Last Light': 'When every other light goes out, this one is still burning.',
}
