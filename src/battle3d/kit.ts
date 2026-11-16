import * as THREE from 'three'

// Small shared building blocks for the battle figures and settings: flat-shaded low-poly
// materials and a few shape helpers. Every figure gets its own material instances (see
// MaterialBag) so it can flash when hit and fade when it falls without touching anyone else.

export class MaterialBag {
  readonly list: THREE.MeshLambertMaterial[] = []

  /** A flat-shaded colour; `glow` makes it shine on its own (eyes, runes, magic). */
  get(color: number, glow = 0): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true })
    if (glow > 0) {
      m.emissive.setHex(color)
      m.emissiveIntensity = glow
    }
    m.userData.baseEmissive = m.emissive.getHex()
    m.userData.baseIntensity = m.emissiveIntensity
    m.userData.baseOpacity = 1
    this.list.push(m)
    return m
  }

  /** See-through (ghosts, flames, auras): `opacity` is kept as it fades out when it falls. */
  see(color: number, opacity: number, glow = 0): THREE.MeshLambertMaterial {
    const m = this.get(color, glow)
    m.transparent = true
    m.opacity = opacity
    m.depthWrite = false
    m.userData.baseOpacity = opacity
    return m
  }
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  return m
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
export const ball = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail)
export const cyl = (rTop: number, rBottom: number, h: number, seg = 7) =>
  new THREE.CylinderGeometry(rTop, rBottom, h, seg)
export const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg)

/** A pivot group at (x, y, z): limbs hang from these so they can swing. */
export function pivot(x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, y, z)
  return g
}

/** A repeatable 0..1 random sequence from a string (a unit id), so a character always looks the same. */
export function seeded(key: string): () => number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export const pick = <T,>(rnd: () => number, list: readonly T[]): T => list[Math.floor(rnd() * list.length)]

/** Lighten (amount > 0) or darken (< 0) a hex colour. */
export function shade(color: number, amount: number): number {
  const c = new THREE.Color(color)
  if (amount > 0) c.lerp(new THREE.Color(0xffffff), amount)
  else c.lerp(new THREE.Color(0x000000), -amount)
  return c.getHex()
}

export const hex = (css: string) => new THREE.Color(css).getHex()
