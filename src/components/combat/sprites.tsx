import type { Role } from '../../game/combat/types'

type EnemyArchetype =
  | 'grunt'
  | 'archer'
  | 'caster'
  | 'champion'
  | 'undead'
  | 'dragon'
  | 'demon'
  | 'giant'
  | 'construct'
  | 'eldritch'
  | 'celestial'

interface EnemySpriteDef {
  archetype: EnemyArchetype
  color: string
}

/**
 * Every enemy is grouped into one of ~10 shape archetypes (not a bespoke
 * icon per name — 40+ unique names would mean 40+ hand-drawn shapes for
 * marginal visual gain) and given its own color, so each module still reads
 * as visually distinct even where two modules share a shape. Falls back to
 * DEFAULT_ENEMY_SPRITE for any name not listed here (e.g. a future module),
 * so a missing entry never breaks rendering.
 */
export const ENEMY_SPRITES: Record<string, EnemySpriteDef> = {
  // Goblin Ambush (T1)
  Goblin: { archetype: 'grunt', color: '#4ade80' },
  'Goblin Archer': { archetype: 'archer', color: '#4ade80' },
  'Goblin Boss': { archetype: 'champion', color: '#16a34a' },
  // Bandit Hideout (T2)
  Bandit: { archetype: 'grunt', color: '#d4a373' },
  'Bandit Crossbowman': { archetype: 'archer', color: '#d4a373' },
  'Bandit Medic': { archetype: 'caster', color: '#e9c46a' },
  'Bandit Captain': { archetype: 'champion', color: '#b08968' },
  // Sunken Crypt (T3)
  'Skeleton Soldier': { archetype: 'undead', color: '#e5e7eb' },
  'Skeleton Archer': { archetype: 'undead', color: '#cbd5e1' },
  Lich: { archetype: 'undead', color: '#a78bfa' },
  'Cultist Priest': { archetype: 'caster', color: '#7c3aed' },
  // Dragon's Peak (T4)
  Wyrmling: { archetype: 'dragon', color: '#fb923c' },
  'Elder Wyrm': { archetype: 'dragon', color: '#ea580c' },
  // Abyssal Rift (T5)
  Imp: { archetype: 'demon', color: '#f87171' },
  Hellhound: { archetype: 'demon', color: '#ef4444' },
  'Imp Shaman': { archetype: 'caster', color: '#dc2626' },
  'Demon Prince': { archetype: 'demon', color: '#991b1b' },
  // Frozen Wastes (T6)
  'Ice Wraith': { archetype: 'undead', color: '#67e8f9' },
  'Frost Giant': { archetype: 'giant', color: '#38bdf8' },
  // Clockwork Vault (T7)
  'Clockwork Sentinel': { archetype: 'construct', color: '#94a3b8' },
  'Iron Golem': { archetype: 'construct', color: '#64748b' },
  'Repair Drone': { archetype: 'construct', color: '#78716c' },
  // Void Between Stars (T8)
  'Star Spawn': { archetype: 'eldritch', color: '#818cf8' },
  'Void Horror': { archetype: 'eldritch', color: '#6366f1' },
  // Titan's Forge (T9)
  'Ember Wraith': { archetype: 'undead', color: '#fb923c' },
  'Fire Titan': { archetype: 'giant', color: '#f97316' },
  // Undying Court (T10)
  'Deathless Knight': { archetype: 'undead', color: '#9ca3af' },
  'Wraith Chancellor': { archetype: 'undead', color: '#8b5cf6' },
  'The Undying King': { archetype: 'undead', color: '#f5f3ff' },
  // Shattered Heavens (T11)
  'Renegade Seraph': { archetype: 'celestial', color: '#fca5a5' },
  'Choir Warden': { archetype: 'celestial', color: '#fde68a' },
  'The Fallen Archon': { archetype: 'celestial', color: '#fbbf24' },
  // Maw of Creation (T12)
  'Voidling Colossus': { archetype: 'eldritch', color: '#4f46e5' },
  "Hunger's Attendant": { archetype: 'eldritch', color: '#4338ca' },
  'The World-Eater': { archetype: 'eldritch', color: '#312e81' },
  // The Last Throne (T13)
  'Nameless Guardian': { archetype: 'construct', color: '#57534e' },
  'Herald of Endings': { archetype: 'celestial', color: '#a1a1aa' },
  'Whatever Sits the Throne': { archetype: 'eldritch', color: '#e4e4e7' },
  // Execution contracts
  Tarrasque: { archetype: 'dragon', color: '#166534' },
  'The Kraken': { archetype: 'eldritch', color: '#22d3ee' },
}

const DEFAULT_ENEMY_SPRITE: EnemySpriteDef = { archetype: 'grunt', color: '#9ca3af' }

/** Player sprites are tier-graded by level (no exact class tier reaches CombatUnit — see toCombatUnit), not given a bespoke icon per class name. Same shape per role throughout a character's life; only the color ramp advances. */
function tierColorForLevel(level: number): string {
  if (level >= 300) return '#f0abfc' // legendary — radiant magenta-white
  if (level >= 100) return '#fbbf24' // gold
  if (level >= 50) return '#e5e7eb' // silver
  if (level >= 20) return '#c2843d' // bronze
  return '#94a3b8' // plain, unadorned
}

function ArchetypeIcon({ archetype, color }: { archetype: EnemyArchetype | 'tank' | 'dps' | 'healer'; color: string }) {
  switch (archetype) {
    case 'grunt':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="12" cy="6.5" r="3" fill={color} />
          <path d="M6.5 20 L8 11.5 Q12 9.5 16 11.5 L17.5 20 Z" fill={color} />
          <path d="M16.5 12.5 L20 15.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'archer':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="10.5" cy="6.5" r="2.8" fill={color} />
          <path d="M5.5 20 L7 11.5 Q10.5 9.5 13.5 11.5 L15 20 Z" fill={color} />
          <path d="M17 5 Q21 12 17 19" stroke={color} strokeWidth="1.4" fill="none" />
          <path d="M17 5 L17 19" stroke={color} strokeWidth="0.8" />
        </svg>
      )
    case 'caster':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="12" cy="6" r="2.6" fill={color} />
          <path d="M6 20 L9 10 Q12 8.5 15 10 L18 20 Z" fill={color} />
          <path d="M18 3 L18 13" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="18" cy="3" r="1.6" fill={color} />
        </svg>
      )
    case 'champion':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <path d="M8.5 5 L12 2 L15.5 5 L14.5 7 L12 5.5 L9.5 7 Z" fill={color} />
          <circle cx="12" cy="8.5" r="2.8" fill={color} />
          <path d="M5.5 20 L7 13 Q12 10.5 17 13 L18.5 20 Z" fill={color} />
        </svg>
      )
    case 'undead':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="12" cy="7" r="4" fill={color} />
          <circle cx="10.3" cy="6.5" r="0.8" fill="#0f172a" />
          <circle cx="13.7" cy="6.5" r="0.8" fill="#0f172a" />
          <path d="M7.5 20 L8.5 13 L15.5 13 L16.5 20" stroke={color} strokeWidth="1.4" fill="none" />
          <path d="M9 16 L15 16" stroke={color} strokeWidth="1" />
        </svg>
      )
    case 'dragon':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <path d="M6 15 Q2.5 17.5 1.5 14.5 Z" fill={color} />
          <ellipse cx="11" cy="15" rx="5" ry="3" fill={color} />
          <path d="M15 13 L21 7 L18.5 15 Z" fill={color} />
          <path d="M20 6 L22 7.5 L19.5 8.5 Z" fill={color} />
          <path d="M8.5 13 L11.5 3 L14.5 13 Z" fill={color} opacity="0.85" />
          <circle cx="18.5" cy="10" r="0.7" fill="#0f172a" />
        </svg>
      )
    case 'demon':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <path d="M7 4 L9.5 7.5 L7.5 8.5 Z" fill={color} />
          <path d="M17 4 L14.5 7.5 L16.5 8.5 Z" fill={color} />
          <circle cx="12" cy="8" r="3.4" fill={color} />
          <path d="M9 20 L12 11.5 L15 20 M7.5 15 L12 11.5 L16.5 15" stroke={color} strokeWidth="1.3" fill="none" />
        </svg>
      )
    case 'giant':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="12" cy="6" r="3.4" fill={color} />
          <path d="M5.5 20 L7 10.5 Q12 8 17 10.5 L18.5 20 Z" fill={color} />
          <ellipse cx="20" cy="14" rx="2.2" ry="3.4" fill={color} transform="rotate(30 20 14)" />
        </svg>
      )
    case 'construct':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <rect x="9" y="3" width="6" height="4.5" rx="1" fill={color} />
          <path d="M6 19 L7 11 L17 11 L18 19 Z" fill={color} />
          <circle cx="10" cy="15" r="1" fill="#0f172a" />
          <circle cx="14" cy="15" r="1" fill="#0f172a" />
          <path d="M12 3 L12 0.5" stroke={color} strokeWidth="1.2" />
        </svg>
      )
    case 'eldritch':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="12" cy="11" r="5" fill={color} />
          <path
            d="M8 15 Q6 18 4 19 M10.5 16 Q9.5 19.5 8 21 M13.5 16 Q14.5 19.5 16 21 M16 15 Q18 18 20 19"
            stroke={color}
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="12" cy="10.5" r="1.4" fill="#0f172a" />
        </svg>
      )
    case 'celestial':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="12" cy="4.5" r="1.6" fill="none" stroke={color} strokeWidth="1" />
          <circle cx="12" cy="8.5" r="2.8" fill={color} />
          <path d="M9.5 11 L3 9 L6 15 Z M14.5 11 L21 9 L18 15 Z" fill={color} opacity="0.85" />
          <path d="M7 20 L8.5 12.5 Q12 11 15.5 12.5 L17 20 Z" fill={color} />
        </svg>
      )
    case 'tank':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="10.5" cy="6.5" r="2.8" fill={color} />
          <path d="M5.5 20 L7 11.5 Q10.5 9.5 13.5 11.5 L15 20 Z" fill={color} />
          <path d="M15 9 Q19.5 10 19 15.5 Q17 18 14.5 17.5 Q13.5 12.5 15 9 Z" fill={color} opacity="0.9" />
        </svg>
      )
    case 'dps':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="11" cy="6.5" r="2.8" fill={color} />
          <path d="M6 20 L7.5 11.5 Q11 9.5 14.5 11.5 L15.5 18 Z" fill={color} />
          <path d="M13 14 L20 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M17.5 6 L19.5 8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'healer':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
          <circle cx="12" cy="6" r="2.6" fill={color} />
          <path d="M6.5 20 L9 10.5 Q12 9 15 10.5 L17.5 20 Z" fill={color} />
          <path d="M18.5 3 L18.5 13" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M15.5 7 L21.5 7" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

export function EnemySprite({ name }: { name: string }) {
  const def = ENEMY_SPRITES[name] ?? DEFAULT_ENEMY_SPRITE
  return <ArchetypeIcon archetype={def.archetype} color={def.color} />
}

export function PlayerSprite({ role, level }: { role: Role; level: number }) {
  return <ArchetypeIcon archetype={role} color={tierColorForLevel(level)} />
}
