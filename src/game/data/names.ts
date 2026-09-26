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

/** Mundane, real-world-feeling names for the actual players — not the fantasy characters they roll. */
export const STANDARD_NAMES = [
  'Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Jamie', 'Riley',
  'Drew', 'Avery', 'Quinn', 'Reese', 'Parker', 'Rowan', 'Blake', 'Hayden',
  'Skyler', 'Charlie', 'Emerson', 'Finley', 'Harper', 'Kendall', 'Logan',
  'Marley', 'Peyton', 'Sage', 'Shawn', 'Val', 'Micah', 'Dana',
  'Chris', 'Pat', 'Robin', 'Terry', 'Jesse', 'Kai', 'Remy', 'Devon',
  'Elliot', 'Frankie', 'Gray', 'Harley', 'Indigo', 'Jules', 'Kit', 'Lane',
  'Marlowe', 'Noel', 'Oakley', 'Phoenix', 'Reagan', 'Sydney', 'Tate',
  'Vaughn', 'Winter', 'Ash', 'Blair', 'Cameron', 'Dallas', 'Ellis',
]

export const RACES = [
  'Human', 'Elf', 'Dwarf', 'Halfling', 'Half-Orc', 'Tiefling', 'Gnome', 'Dragonborn',
]

/** One name per fleet slot, in the order ships are bought (BASE_SHIP_SLOTS + all 6 more-ships tiers = 7 total) — a fixed roster, not a random roll, since a ship's name should stay tied to its place in the fleet. */
export const SHIP_NAMES = [
  'The Wandering Die',
  'Critical Miss',
  'Natural Twenty',
  'Homebrew Voyager',
  'Rolling Thunder',
  "The DM's Screen",
  'Nothing Left to Roll',
]

/** 1-based fleet slot index, e.g. the 1st ship bought is index 1. Falls back to a generic name past the named list. */
export function shipNameForIndex(index: number): string {
  return SHIP_NAMES[index - 1] ?? `Ship ${index}`
}

/** Fantasy character name — reused freely across lives/players, same as real tables recycle favorite names. */
export function rollName(rng: () => number): string {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]
  const last = SURNAMES[Math.floor(rng() * SURNAMES.length)]
  return `${first} ${last}`
}

/** Player name — drawn from `existingNames`-excluded standard names so active players don't collide. */
export function rollPlayerName(rng: () => number, existingNames: string[] = []): string {
  const available = STANDARD_NAMES.filter((n) => !existingNames.includes(n))
  const pool = available.length > 0 ? available : STANDARD_NAMES
  return pool[Math.floor(rng() * pool.length)]
}

export function rollRace(rng: () => number): string {
  return RACES[Math.floor(rng() * RACES.length)]
}
