import * as THREE from 'three'
import { MaterialBag, ball, box, cone, cyl, mesh, shade } from './kit'

// Where each fight happens. The board is the encounter's grid as a raised tabletop of tiles;
// around it, each module gets its own ground, sky, light and scattered props (a forest clearing
// for goblins, a bandit camp, a crypt, a volcano, the deck of a ship for the Kraken...).

export type Particles = 'none' | 'snow' | 'embers' | 'motes' | 'ash' | 'sparks' | 'spores'

export interface Setting {
  id: string
  /** Top and horizon colours of the sky. */
  sky: [number, number]
  fog: number
  fogNear: number
  fogFar: number
  /** Two alternating tile colours on the board, and the colour of its sides. */
  tiles: [number, number]
  boardSide: number
  /** The ground around the board. */
  ground: number
  sun: { color: number; intensity: number; dir: [number, number, number] }
  hemi: { sky: number; ground: number; intensity: number }
  particles: Particles
  particleColor: number
  /** Pull the camera further back (dist, a multiplier) or aim it higher (lift) for this setting. */
  camera?: { dist?: number; lift?: number }
  /** Scatter props around the board; returns anything that animates (flames, lava, water). */
  props: (scene: THREE.Group, w: number, h: number, mats: MaterialBag, rnd: () => number) => Animated[]
}

export interface Animated {
  update(time: number): void
}

// ---------- props ----------

function tree(mats: MaterialBag, rnd: () => number, leaf: number, trunk = 0x6b4a2b, pine = false): THREE.Group {
  const g = new THREE.Group()
  const s = 0.8 + rnd() * 0.7
  g.add(mesh(cyl(0.08, 0.12, 0.8, 6), mats.get(trunk), 0, 0.4, 0))
  if (pine) {
    for (let k = 0; k < 3; k++) g.add(mesh(cone(0.55 - k * 0.13, 0.7, 7), mats.get(shade(leaf, k * 0.06)), 0, 0.85 + k * 0.42, 0))
  } else {
    const m = mats.get(leaf)
    g.add(mesh(ball(0.55, 1), m, 0, 1.2, 0))
    g.add(mesh(ball(0.38, 1), mats.get(shade(leaf, 0.1)), 0.3, 1.45, 0.1))
    g.add(mesh(ball(0.35, 1), mats.get(shade(leaf, -0.1)), -0.3, 1.05, -0.1))
  }
  g.scale.setScalar(s)
  return g
}

function rock(mats: MaterialBag, rnd: () => number, color: number, size = 1): THREE.Mesh {
  const r = mesh(new THREE.DodecahedronGeometry(0.3 * size * (0.6 + rnd()), 0), mats.get(shade(color, (rnd() - 0.5) * 0.2)))
  r.scale.y = 0.6 + rnd() * 0.5
  r.rotation.set(rnd(), rnd() * 6, rnd())
  return r
}

function spike(mats: MaterialBag, rnd: () => number, color: number, glow = 0): THREE.Group {
  const g = new THREE.Group()
  const n = 2 + Math.floor(rnd() * 3)
  for (let k = 0; k < n; k++) {
    const h = 0.6 + rnd() * 1.4
    const c = mesh(cone(0.12 + rnd() * 0.12, h, 5), mats.get(color, glow), (rnd() - 0.5) * 0.4, h / 2 - 0.05, (rnd() - 0.5) * 0.4)
    c.rotation.set((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5)
    g.add(c)
  }
  return g
}

function pillar(mats: MaterialBag, rnd: () => number, color: number, broken = true): THREE.Group {
  const g = new THREE.Group()
  const h = broken ? 0.8 + rnd() * 1.6 : 3
  const m = mats.get(color)
  g.add(mesh(box(0.55, 0.15, 0.55), m, 0, 0.075, 0))
  g.add(mesh(cyl(0.2, 0.22, h, 8), m, 0, h / 2 + 0.15, 0))
  if (!broken) g.add(mesh(box(0.55, 0.15, 0.55), m, 0, h + 0.22, 0))
  return g
}

function flame(mats: MaterialBag, color: number, size: number): { obj: THREE.Group; anim: Animated } {
  const g = new THREE.Group()
  const outer = mesh(cone(0.12 * size, 0.35 * size, 6), mats.get(color, 1.4), 0, 0.17 * size, 0)
  const inner = mesh(cone(0.07 * size, 0.22 * size, 6), mats.get(0xfff2a8, 1.6), 0, 0.12 * size, 0)
  g.add(outer, inner)
  const light = new THREE.PointLight(color, 1.6 * size, 4 * size, 1.6)
  light.position.y = 0.3 * size
  g.add(light)
  const phase = Math.random() * 10
  return {
    obj: g,
    anim: {
      update(t) {
        const f = 1 + Math.sin(t * 13 + phase) * 0.12 + Math.sin(t * 7.3 + phase) * 0.08
        outer.scale.set(1, f, 1)
        inner.scale.set(1, 2 - f, 1)
        light.intensity = 1.6 * size * f
      },
    },
  }
}

function tent(mats: MaterialBag, color: number): THREE.Group {
  const g = new THREE.Group()
  const t = mesh(new THREE.ConeGeometry(0.9, 1.1, 4), mats.get(color), 0, 0.55, 0)
  t.rotation.y = Math.PI / 4
  t.scale.z = 1.4
  g.add(t)
  g.add(mesh(box(0.3, 0.6, 0.02), mats.get(0x1e1610), 0, 0.3, 0.62))
  return g
}

function crate(mats: MaterialBag, rnd: () => number): THREE.Mesh {
  const s = 0.35 + rnd() * 0.2
  const c = mesh(box(s, s, s), mats.get(shade(0x8a6a3e, (rnd() - 0.5) * 0.2)), 0, s / 2, 0)
  c.rotation.y = rnd()
  return c
}

function gear(mats: MaterialBag, color: number, r: number): THREE.Group {
  const g = new THREE.Group()
  const m = mats.get(color)
  g.add(mesh(cyl(r, r, 0.12, 14).rotateX(Math.PI / 2), m))
  const teeth = 10
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2
    const t = mesh(box(r * 0.28, r * 0.28, 0.12), m, Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08, 0)
    t.rotation.z = a
    g.add(t)
  }
  g.add(mesh(cyl(r * 0.25, r * 0.25, 0.16, 8).rotateX(Math.PI / 2), mats.get(shade(color, -0.4))))
  return g
}

function banner(mats: MaterialBag, color: number, trim: number): THREE.Group {
  const g = new THREE.Group()
  g.add(mesh(cyl(0.03, 0.03, 2.4, 5), mats.get(0x3a2a1e), 0, 1.2, 0))
  g.add(mesh(box(0.6, 1.1, 0.03), mats.get(color), 0, 1.75, 0.04))
  g.add(mesh(box(0.62, 0.08, 0.035), mats.get(trim, 0.3), 0, 2.28, 0.04))
  return g
}

function cloud(mats: MaterialBag, rnd: () => number, color: number): THREE.Group {
  const g = new THREE.Group()
  const m = mats.get(color, 0.25)
  for (let k = 0; k < 4; k++) g.add(mesh(ball(0.5 + rnd() * 0.4, 1), m, (k - 1.5) * 0.55, rnd() * 0.25, (rnd() - 0.5) * 0.4))
  return g
}

/** Spots around the board, between `inner` and `outer` tiles beyond its edge. */
function ring(w: number, h: number, rnd: () => number, count: number, inner: number, outer: number): [number, number][] {
  const out: [number, number][] = []
  let tries = 0
  while (out.length < count && tries++ < count * 30) {
    const x = (rnd() - 0.5) * (w + outer * 2)
    const z = (rnd() - 0.5) * (h + outer * 2)
    const dx = Math.max(0, Math.abs(x) - w / 2)
    const dz = Math.max(0, Math.abs(z) - h / 2)
    const d = Math.max(dx, dz)
    if (d < inner || d > outer) continue
    // Keep the front (where the camera looks from) clear and low.
    if (z > h / 2 + 0.5 && Math.abs(x) < w / 2 + 3) continue
    out.push([x, z])
  }
  return out
}

function scatter(
  group: THREE.Group,
  spots: [number, number][],
  make: (i: number) => THREE.Object3D,
  rnd: () => number,
) {
  spots.forEach(([x, z], i) => {
    const o = make(i)
    o.position.set(x, 0, z)
    o.rotation.y = rnd() * Math.PI * 2
    group.add(o)
  })
}

// ---------- the settings ----------

const base = {
  fogNear: 14,
  fogFar: 40,
  particles: 'none' as Particles,
  particleColor: 0xffffff,
}

export const SETTINGS: Record<string, Setting> = {
  'goblin-ambush': {
    ...base,
    id: 'goblin-ambush',
    sky: [0x6aa8e0, 0xd8ecd0],
    fog: 0xc8e0c0,
    tiles: [0x6a9a3e, 0x5f8e38],
    boardSide: 0x5a3e24,
    ground: 0x4f7a32,
    sun: { color: 0xfff0d0, intensity: 2.2, dir: [4, 9, 5] },
    hemi: { sky: 0xd8f0ff, ground: 0x4a5a2a, intensity: 1.1 },
    particles: 'motes',
    particleColor: 0xfff6a0,
    props(g, w, h, mats, rnd) {
      scatter(g, ring(w, h, rnd, 26, 1.2, 7), () => tree(mats, rnd, pick3(rnd, [0x3f7a2e, 0x4a8a34, 0x5a9a3a]), 0x6b4a2b, rnd() < 0.3), rnd)
      scatter(g, ring(w, h, rnd, 10, 0.6, 4), () => rock(mats, rnd, 0x8a8a80), rnd)
      return []
    },
  },
  'bandit-hideout': {
    ...base,
    id: 'bandit-hideout',
    sky: [0x3a3a6a, 0xe0906a],
    fog: 0xb08a7a,
    tiles: [0x9a7a52, 0x8a6c48],
    boardSide: 0x4a3420,
    ground: 0x7a6040,
    sun: { color: 0xffb27a, intensity: 1.9, dir: [-6, 5, 4] },
    hemi: { sky: 0xffc8a0, ground: 0x4a3420, intensity: 0.9 },
    particles: 'embers',
    particleColor: 0xffa040,
    props(g, w, h, mats, rnd) {
      const anims: Animated[] = []
      scatter(g, ring(w, h, rnd, 4, 2, 5), () => tent(mats, pick3(rnd, [0x8a6a4a, 0x6a5a3a, 0x7a3a2a])), rnd)
      scatter(g, ring(w, h, rnd, 10, 0.5, 4), () => crate(mats, rnd), rnd)
      scatter(g, ring(w, h, rnd, 10, 3, 8), () => tree(mats, rnd, 0x3a5a2a, 0x4a3420, true), rnd)
      for (const [x, z] of ring(w, h, rnd, 2, 1, 2.5)) {
        const f = flame(mats, 0xff8a2e, 1.4)
        f.obj.position.set(x, 0, z)
        for (let k = 0; k < 6; k++) {
          const s = rock(mats, rnd, 0x6a6460, 0.5)
          s.position.set(x + Math.cos(k) * 0.35, 0.05, z + Math.sin(k) * 0.35)
          g.add(s)
        }
        g.add(f.obj)
        anims.push(f.anim)
      }
      return anims
    },
  },
  'sunken-crypt': {
    ...base,
    id: 'sunken-crypt',
    sky: [0x0a1418, 0x1e3a3a],
    fog: 0x16302e,
    fogNear: 8,
    fogFar: 26,
    tiles: [0x5a6460, 0x4e5854],
    boardSide: 0x2e3634,
    ground: 0x24302c,
    sun: { color: 0x8af0d0, intensity: 0.9, dir: [2, 8, 3] },
    hemi: { sky: 0x4a8a7a, ground: 0x101814, intensity: 0.8 },
    particles: 'spores',
    particleColor: 0x8af0c0,
    props(g, w, h, mats, rnd) {
      const anims: Animated[] = []
      scatter(g, ring(w, h, rnd, 10, 0.6, 3.5), () => pillar(mats, rnd, 0x6a7470), rnd)
      scatter(g, ring(w, h, rnd, 8, 0.4, 3), () => {
        const t = new THREE.Group()
        t.add(mesh(box(0.4, 0.55, 0.1), mats.get(0x7a807a), 0, 0.27, 0))
        t.add(mesh(cyl(0.2, 0.2, 0.1, 8, ).rotateX(Math.PI / 2), mats.get(0x7a807a), 0, 0.55, 0))
        t.rotation.z = (rnd() - 0.5) * 0.3
        return t
      }, rnd)
      for (const [x, z] of ring(w, h, rnd, 6, 0.3, 2)) {
        const f = flame(mats, 0x6af0c0, 0.6)
        f.obj.position.set(x, 0.35, z)
        g.add(mesh(cyl(0.05, 0.06, 0.35, 6), mats.get(0xe8e0c8), x, 0.17, z))
        g.add(f.obj)
        anims.push(f.anim)
      }
      return anims
    },
  },
  'dragons-peak': {
    ...base,
    id: 'dragons-peak',
    sky: [0x3a1e2e, 0xf08a3a],
    fog: 0xa05a3a,
    tiles: [0x5a4a44, 0x4e403a],
    boardSide: 0x2a201c,
    ground: 0x3a2e2a,
    sun: { color: 0xffa060, intensity: 2.0, dir: [-4, 6, 2] },
    hemi: { sky: 0xffa070, ground: 0x2a1410, intensity: 0.9 },
    particles: 'embers',
    particleColor: 0xff7a2e,
    props(g, w, h, mats, rnd) {
      scatter(g, ring(w, h, rnd, 18, 0.8, 7), () => rock(mats, rnd, 0x4a3e38, 2.2), rnd)
      scatter(g, ring(w, h, rnd, 6, 1, 5), () => spike(mats, rnd, 0x2a2226), rnd)
      const lava = lavaPools(g, w, h, mats, rnd, 5, 0xff5a1e)
      return [lava]
    },
  },
  'abyssal-rift': {
    ...base,
    id: 'abyssal-rift',
    sky: [0x14060e, 0x6a1430],
    fog: 0x3a0a1e,
    fogNear: 9,
    fogFar: 30,
    tiles: [0x4a2a30, 0x3e2228],
    boardSide: 0x1e0c12,
    ground: 0x24101a,
    sun: { color: 0xff6a5a, intensity: 1.3, dir: [3, 6, -2] },
    hemi: { sky: 0xff4a6a, ground: 0x14060a, intensity: 0.9 },
    particles: 'ash',
    particleColor: 0xff6a4a,
    props(g, w, h, mats, rnd) {
      scatter(g, ring(w, h, rnd, 12, 0.6, 6), () => spike(mats, rnd, 0x2a0e18), rnd)
      scatter(g, ring(w, h, rnd, 5, 1, 5), () => spike(mats, rnd, 0xc0304a, 0.8), rnd)
      return [lavaPools(g, w, h, mats, rnd, 6, 0xd8203a)]
    },
  },
  'frozen-wastes': {
    ...base,
    id: 'frozen-wastes',
    sky: [0x8ab0d8, 0xeaf4fa],
    fog: 0xdcecf6,
    tiles: [0xe6f0f6, 0xd4e4ee],
    boardSide: 0x8aa8c0,
    ground: 0xf0f6fa,
    sun: { color: 0xffffff, intensity: 2.0, dir: [5, 7, 4] },
    hemi: { sky: 0xd8ecff, ground: 0x8aa8c0, intensity: 1.2 },
    particles: 'snow',
    particleColor: 0xffffff,
    props(g, w, h, mats, rnd) {
      scatter(g, ring(w, h, rnd, 10, 0.6, 5), () => spike(mats, rnd, 0x9ad8f0, 0.25), rnd)
      scatter(g, ring(w, h, rnd, 14, 2, 8), () => tree(mats, rnd, 0xe8f2f8, 0x5a4a3e, true), rnd)
      scatter(g, ring(w, h, rnd, 8, 0.5, 4), () => rock(mats, rnd, 0xc8d8e4, 1.5), rnd)
      return []
    },
  },
  'clockwork-vault': {
    ...base,
    id: 'clockwork-vault',
    sky: [0x1e1810, 0x5a4428],
    fog: 0x3a2e1e,
    fogNear: 10,
    fogFar: 30,
    tiles: [0xb08a4a, 0x9a7840],
    boardSide: 0x4a3a24,
    ground: 0x3a3028,
    sun: { color: 0xffd08a, intensity: 1.6, dir: [2, 8, 4] },
    hemi: { sky: 0xffd8a0, ground: 0x2a2018, intensity: 0.9 },
    particles: 'sparks',
    particleColor: 0xffd060,
    props(g, w, h, mats, rnd) {
      const gears: THREE.Group[] = []
      for (const [x, z] of ring(w, h, rnd, 8, 1, 4)) {
        const r = 0.5 + rnd() * 0.9
        const gg = gear(mats, pick3(rnd, [0xb08a3a, 0x8a6a2e, 0x94a3b8]), r)
        gg.position.set(x, r + 0.1, z)
        gg.rotation.y = Math.atan2(x, z)
        g.add(gg)
        gears.push(gg)
      }
      scatter(g, ring(w, h, rnd, 6, 0.5, 3), () => pillar(mats, rnd, 0x6a5a40, false), rnd)
      return [{ update: (t) => gears.forEach((gg, i) => (gg.rotation.z = t * (i % 2 ? 0.4 : -0.3))) }]
    },
  },
  'void-between-stars': {
    ...base,
    id: 'void-between-stars',
    sky: [0x04030c, 0x1e1440],
    fog: 0x0a0818,
    fogNear: 18,
    fogFar: 60,
    tiles: [0x3a3460, 0x2e2a50],
    boardSide: 0x14102a,
    ground: -1,
    sun: { color: 0xb8a8ff, intensity: 1.4, dir: [3, 8, 4] },
    hemi: { sky: 0x8a7aff, ground: 0x0a0818, intensity: 0.8 },
    particles: 'motes',
    particleColor: 0xc8b8ff,
    props(g, w, h, mats, rnd) {
      const floaters: THREE.Object3D[] = []
      for (const [x, z] of ring(w, h, rnd, 12, 1.5, 9)) {
        const r = rock(mats, rnd, 0x3a3460, 2.5)
        r.position.set(x, (rnd() - 0.4) * 3, z)
        g.add(r)
        floaters.push(r)
      }
      g.add(stars(mats, rnd, 400))
      return [{ update: (t) => floaters.forEach((f, i) => (f.position.y += Math.sin(t * 0.6 + i) * 0.002)) }]
    },
  },
  'titans-forge': {
    ...base,
    id: 'titans-forge',
    sky: [0x1e0e08, 0x7a2e10],
    fog: 0x4a1e0e,
    fogNear: 10,
    fogFar: 32,
    tiles: [0x4a4648, 0x3e3a3c],
    boardSide: 0x1e1a1c,
    ground: 0x2a2224,
    sun: { color: 0xff9a4a, intensity: 1.8, dir: [-3, 7, 3] },
    hemi: { sky: 0xff8a4a, ground: 0x1a0e0a, intensity: 0.9 },
    particles: 'sparks',
    particleColor: 0xffa040,
    props(g, w, h, mats, rnd) {
      scatter(g, ring(w, h, rnd, 5, 1, 4), () => {
        const a = new THREE.Group()
        a.add(mesh(box(0.5, 0.35, 0.4), mats.get(0x2a2a2e), 0, 0.17, 0))
        a.add(mesh(box(0.9, 0.2, 0.4), mats.get(0x3a3a40), 0, 0.45, 0))
        return a
      }, rnd)
      scatter(g, ring(w, h, rnd, 8, 1, 6), () => pillar(mats, rnd, 0x3a3436, false), rnd)
      return [lavaPools(g, w, h, mats, rnd, 6, 0xff7a1e)]
    },
  },
  'undying-court': {
    ...base,
    id: 'undying-court',
    sky: [0x08080e, 0x1e2a24],
    fog: 0x141c18,
    fogNear: 9,
    fogFar: 28,
    tiles: [0x2a2a30, 0xd8d4cc],
    boardSide: 0x141418,
    ground: 0x1a1a20,
    sun: { color: 0x9af0a8, intensity: 1.1, dir: [0, 9, 3] },
    hemi: { sky: 0x6a9a7a, ground: 0x0a0a0e, intensity: 0.8 },
    particles: 'spores',
    particleColor: 0x8af06a,
    props(g, w, h, mats, rnd) {
      const anims: Animated[] = []
      scatter(g, ring(w, h, rnd, 10, 0.6, 3), () => pillar(mats, rnd, 0x3a3a44, false), rnd)
      scatter(g, ring(w, h, rnd, 6, 0.4, 2.5), () => banner(mats, 0x4a1e5a, 0xe0b33e), rnd)
      for (const [x, z] of ring(w, h, rnd, 6, 0.3, 2)) {
        const f = flame(mats, 0x8af06a, 0.7)
        f.obj.position.set(x, 0.9, z)
        g.add(mesh(cyl(0.04, 0.08, 0.9, 6), mats.get(0x2a2a30), x, 0.45, z))
        g.add(f.obj)
        anims.push(f.anim)
      }
      return anims
    },
  },
  'shattered-heavens': {
    ...base,
    id: 'shattered-heavens',
    sky: [0xf0b8a0, 0xfff4e0],
    fog: 0xfff0e0,
    fogNear: 16,
    fogFar: 50,
    tiles: [0xf2ead8, 0xe0d4b8],
    boardSide: 0xd8b860,
    ground: -1,
    sun: { color: 0xfff2d0, intensity: 2.2, dir: [3, 9, 5] },
    hemi: { sky: 0xffffff, ground: 0xe8c8a0, intensity: 1.3 },
    particles: 'motes',
    particleColor: 0xffe08a,
    props(g, w, h, mats, rnd) {
      const floaters: THREE.Object3D[] = []
      for (const [x, z] of ring(w, h, rnd, 14, 0.5, 9)) {
        const c = cloud(mats, rnd, 0xffffff)
        c.position.set(x, -0.6 - rnd() * 1.5, z)
        g.add(c)
        floaters.push(c)
      }
      scatter(g, ring(w, h, rnd, 6, 1, 5), () => {
        const p = pillar(mats, rnd, 0xf2ead8)
        p.position.y = 0.5 + rnd() * 2
        floaters.push(p)
        return p
      }, rnd)
      return [{ update: (t) => floaters.forEach((f, i) => (f.position.y += Math.sin(t * 0.5 + i) * 0.0025)) }]
    },
  },
  'maw-of-creation': {
    ...base,
    id: 'maw-of-creation',
    sky: [0x0a0418, 0x3a1450],
    fog: 0x1e0a2e,
    fogNear: 9,
    fogFar: 30,
    tiles: [0x5a2a4a, 0x4a223e],
    boardSide: 0x2a0e22,
    ground: 0x30122a,
    sun: { color: 0xd88aff, intensity: 1.2, dir: [2, 7, 4] },
    hemi: { sky: 0xa04aff, ground: 0x1a0612, intensity: 0.9 },
    particles: 'spores',
    particleColor: 0xd88aff,
    props(g, w, h, mats, rnd) {
      // A ring of great teeth around the arena.
      const n = 22
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2
        const r = Math.max(w, h) / 2 + 3
        const tooth = mesh(cone(0.5, 2.6 + rnd(), 5), mats.get(0xe8e0d0), Math.cos(a) * r, 1.1, Math.sin(a) * r * 0.9)
        tooth.rotation.z = Math.cos(a) * 0.3
        tooth.rotation.x = -Math.sin(a) * 0.3
        if (Math.sin(a) * r * 0.9 > h / 2 + 0.5 && Math.abs(Math.cos(a) * r) < w / 2 + 2) continue
        g.add(tooth)
      }
      scatter(g, ring(w, h, rnd, 8, 0.5, 4), () => spike(mats, rnd, 0x8a3a8a, 0.5), rnd)
      return []
    },
  },
  'the-last-throne': {
    ...base,
    id: 'the-last-throne',
    sky: [0x1a1a1e, 0x6a6a70],
    fog: 0x4a4a50,
    fogNear: 10,
    fogFar: 34,
    tiles: [0x5a5a5e, 0x4a4a4e],
    boardSide: 0x2a2a2e,
    ground: 0x3a3a3e,
    sun: { color: 0xe8e8f0, intensity: 1.5, dir: [-2, 8, 4] },
    hemi: { sky: 0xc8c8d0, ground: 0x1a1a1e, intensity: 0.9 },
    particles: 'ash',
    particleColor: 0xc8c8c8,
    props(g, w, h, mats, rnd) {
      // The throne itself, looming behind the board.
      const t = new THREE.Group()
      const stone = mats.get(0x2a2a30)
      t.add(mesh(box(3, 0.6, 2), stone, 0, 0.3, 0))
      t.add(mesh(box(2.2, 1, 1.4), stone, 0, 1.1, 0))
      t.add(mesh(box(2.4, 4.5, 0.5), stone, 0, 2.6, -0.6))
      for (const s of [-1, 1]) t.add(mesh(cone(0.3, 1.6, 4), stone, s * 1, 5.4, -0.6))
      t.add(mesh(ball(0.3, 0), mats.get(0xe4e4e7, 1.2), 0, 4.3, -0.3))
      t.position.set(0, 0, -h / 2 - 3.5)
      g.add(t)
      scatter(g, ring(w, h, rnd, 10, 0.8, 5), () => pillar(mats, rnd, 0x4a4a50), rnd)
      return []
    },
  },
  tarrasque: {
    ...base,
    id: 'tarrasque',
    sky: [0x4a5a3a, 0xc8b88a],
    fog: 0xa89a74,
    tiles: [0x7a6a4a, 0x6e5e42],
    boardSide: 0x3a3020,
    ground: 0x5a4a32,
    sun: { color: 0xffe8b0, intensity: 1.9, dir: [5, 6, 2] },
    hemi: { sky: 0xe8e0b0, ground: 0x3a2e1e, intensity: 1.0 },
    particles: 'ash',
    particleColor: 0xd8c8a0,
    props(g, w, h, mats, rnd) {
      scatter(g, ring(w, h, rnd, 16, 0.8, 8), () => rock(mats, rnd, 0x6a5a42, 2.5), rnd)
      scatter(g, ring(w, h, rnd, 8, 2, 8), () => {
        const s = tree(mats, rnd, 0x5a4a32, 0x4a3a28)
        s.children.slice(1).forEach((c) => (c.visible = false)) // dead stumps
        return s
      }, rnd)
      return []
    },
  },
  kraken: {
    ...base,
    id: 'kraken',
    sky: [0x2a3a5a, 0x8aa8b8],
    fog: 0x6a8a9a,
    fogNear: 12,
    fogFar: 36,
    tiles: [0x9a6a3e, 0x8a5e36],
    boardSide: 0x5a3a22,
    ground: -1,
    sun: { color: 0xd8e8ff, intensity: 1.5, dir: [3, 8, 5] },
    hemi: { sky: 0xb8d0e8, ground: 0x1e3a4a, intensity: 1.0 },
    particles: 'none',
    particleColor: 0xffffff,
    camera: { dist: 1.0, lift: 0.3 },
    props(g, w, h, mats) {
      // The sea, rolling under the ship.
      const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 40, 40).rotateX(-Math.PI / 2), mats.get(0x1e5a7a))
      water.position.y = -0.55
      ;(water.material as THREE.MeshLambertMaterial).transparent = true
      ;(water.material as THREE.MeshLambertMaterial).opacity = 0.92
      g.add(water)
      const pos = water.geometry.attributes.position
      const base0 = Float32Array.from(pos.array as Float32Array)
      // The hull under the deck, sitting in the water, with a pointed bow toward the enemy end.
      const wood = mats.get(0x5a3a22)
      const hullMat = mats.get(0x4a2e1a)
      g.add(mesh(box(w + 0.5, 0.9, h + 0.5), hullMat, 0, -0.75, 0))
      // A diamond turned and stretched into a pointed prow past the deck's far end.
      const side = (h + 0.5) / Math.SQRT2
      const bow = mesh(box(side, 0.9, side), hullMat, w / 2 + 0.25, -0.75, 0)
      bow.rotation.y = Math.PI / 4
      const prow = new THREE.Group()
      prow.add(bow)
      prow.scale.x = 1.5
      prow.position.x = (w / 2 + 0.25) * -0.5
      g.add(prow)
      // The Kraken's other arms, rising out of the sea around the ship.
      const arms: { root: THREE.Group; segs: THREE.Group[]; phase: number }[] = []
      const flesh = mats.get(0x1c7a8a)
      const sucker = mats.get(0x8ad8d0)
      const spots: [number, number, number][] = [
        [w / 2 + 2.6, -h / 2 - 1.2, 1.2],
        [w / 2 + 3.2, h / 2 + 0.6, 1.0],
        [-w / 2 - 1.8, -h / 2 - 1.6, 0.9],
        [1, -h / 2 - 2.6, 1.3],
        [w / 2 + 1.0, -h / 2 - 2.8, 1.1],
      ]
      spots.forEach(([x, z, size], i) => {
        const root = new THREE.Group()
        root.position.set(x, -0.6, z)
        root.rotation.y = Math.atan2(-x, -z) // curl toward the ship
        const segs: THREE.Group[] = []
        let parent: THREE.Object3D = root
        for (let k = 0; k < 7; k++) {
          const seg = new THREE.Group()
          seg.position.y = k === 0 ? 0 : 0.55 * size
          const r = (0.32 - k * 0.04) * size
          seg.add(mesh(cyl(r * 0.85, r, 0.6 * size, 7), flesh, 0, 0.27 * size, 0))
          seg.add(mesh(ball(r * 0.3, 0), sucker, 0, 0.27 * size, r * 0.85))
          parent.add(seg)
          segs.push(seg)
          parent = seg
        }
        g.add(root)
        arms.push({ root, segs, phase: i * 1.7 })
      })
      // Rails along the long sides of the deck, and a mast behind.
      for (const s of [-1, 1]) g.add(mesh(box(w + 0.6, 0.25, 0.15), wood, 0, 0.12, s * (h / 2 + 0.25)))
      g.add(mesh(cyl(0.15, 0.2, 7, 7), wood, -w / 2 + 1, 3.5, -h / 2 - 0.6))
      g.add(mesh(box(0.05, 3, 2.6), mats.get(0xe8e0c8), -w / 2 + 1.1, 4.2, -h / 2 - 0.6))
      return [
        {
          update(t) {
            for (const a of arms)
              a.segs.forEach((seg, k) => {
                // Each arm rises, curls over toward the deck and sways.
                seg.rotation.x = 0.22 + Math.sin(t * 0.9 + a.phase - k * 0.5) * 0.12
                seg.rotation.z = Math.sin(t * 0.6 + a.phase + k * 0.3) * 0.08
              })
            for (let i = 0; i < pos.count; i++) {
              const x = base0[i * 3]
              const z = base0[i * 3 + 2]
              pos.setY(i, Math.sin(x * 0.4 + t * 1.1) * 0.15 + Math.cos(z * 0.3 + t * 0.8) * 0.12)
            }
            pos.needsUpdate = true
            water.geometry.computeVertexNormals()
          },
        },
      ]
    },
  },
}

function pick3<T>(rnd: () => number, list: T[]): T {
  return list[Math.floor(rnd() * list.length)]
}

/** Glowing pools between the props; returns a gentle pulse for them. */
function lavaPools(g: THREE.Group, w: number, h: number, mats: MaterialBag, rnd: () => number, n: number, color: number): Animated {
  const m = mats.get(color, 1.2)
  for (const [x, z] of ring(w, h, rnd, n, 0.8, 6)) {
    const pool = mesh(cyl(0.5 + rnd() * 0.8, 0.5 + rnd() * 0.8, 0.04, 9), m, x, 0.02, z)
    pool.scale.z = 0.6 + rnd() * 0.6
    g.add(pool)
  }
  return { update: (t) => (m.emissiveIntensity = 1.0 + Math.sin(t * 1.7) * 0.3) }
}

function stars(mats: MaterialBag, rnd: () => number, n: number): THREE.Points {
  const p = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const b = Math.acos(rnd() * 2 - 1)
    const r = 45
    p[i * 3] = Math.sin(b) * Math.cos(a) * r
    p[i * 3 + 1] = Math.cos(b) * r
    p[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
  void mats
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, fog: false }))
}

/** The setting for an encounter id (e.g. "goblin-ambush-2", "kraken-awaits"), or by module id. */
export function settingFor(encounterOrModuleId: string | null | undefined): Setting {
  const id = encounterOrModuleId ?? ''
  if (id.startsWith('kraken')) return SETTINGS.kraken
  if (id.startsWith('tarrasque')) return SETTINGS.tarrasque
  const key = id.replace(/-\d+$/, '')
  return SETTINGS[key] ?? SETTINGS['goblin-ambush']
}

