export const FIRST_NAMES = [
  'Bramm', 'Cael', 'Doriel', 'Esk', 'Fenna', 'Grix', 'Hale', 'Isolde',
  'Joran', 'Kessa', 'Lorn', 'Maeve', 'Norrin', 'Orla', 'Pip', 'Quill',
  'Roran', 'Syl', 'Torvin', 'Una', 'Vex', 'Wren', 'Xanthe', 'Yorick', 'Zara',
]

export const SURNAMES = [
  'Ashvale', 'Blackwood', 'Cinderfall', 'Duskmere', 'Emberlyn', 'Frosthold',
  'Graywatch', 'Hollowbrook', 'Ironshade', 'Junewood', 'Kettlebrook',
  'Larkspur', 'Moonshadow', 'Nightbloom', 'Oakenshield', 'Ravensmere',
  'Stormwick', 'Thistledown', 'Underhill', 'Vaelthorn',
]

export const RACES = [
  'Human', 'Elf', 'Dwarf', 'Halfling', 'Half-Orc', 'Tiefling', 'Gnome', 'Dragonborn',
]

export function rollName(rng: () => number): string {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]
  const last = SURNAMES[Math.floor(rng() * SURNAMES.length)]
  return `${first} ${last}`
}

export function rollRace(rng: () => number): string {
  return RACES[Math.floor(rng() * RACES.length)]
}
