import * as THREE from 'three'
import type { Figure } from './figures'
import { MaterialBag } from './kit'

// Every module's boss attacks in its own way: the Goblin Boss leaps in for a big bonk, the Lich
// drains the soul out of you, the Fire Titan calls down a meteor, a giant tentacle comes over
// the rail at you. Each signature plays its effects and the battle scene lands the hit (damage
// number, flash, shake) at `impact`.

export interface FxUnit {
  pos: THREE.Vector3
  fig: Figure
  /** Added to the figure's position (leaps, being pulled). */
  offset: THREE.Vector3
}

export type PoseKind = 'swing' | 'shoot' | 'cast' | 'breath' | 'slam' | 'heal'

export interface FxHost {
  scene: THREE.Scene
  mats: MaterialBag
  tween(dur: number, update: (k: number) => void, done?: () => void, delay?: number): void
  at(delay: number, fn: () => void): void
  particle(at: THREE.Vector3, vel: THREE.Vector3, color: number, life: number, size: number, grow?: number, gravity?: number): void
  burst(at: THREE.Vector3, color: number, n: number, speed?: number): void
  shockwave(at: THREE.Vector3, color: number): void
  pillar(at: THREE.Vector3, color: number, dur: number): void
  shake(amount: number): void
  muzzle(u: FxUnit): THREE.Vector3
  pose(u: FxUnit, kind: PoseKind, dur: number, reach?: number, dir?: THREE.Vector3): void
}

export interface Signature {
  /** When the blow lands, as a fraction of the attack's duration. */
  impact: number
  /** Colour of the burst where it lands. */
  color: number
  /** Camera shake when it lands. */
  shake: number
  run(fx: FxHost, a: FxUnit, t: FxUnit, D: number): void
}

// ---------- helpers ----------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function glow(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

function solid(color: number, emissive = 0): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true, transparent: true })
  if (emissive) {
    m.emissive.setHex(color)
    m.emissiveIntensity = emissive
  }
  return m
}

/** Put an object in the scene for `dur` seconds, calling update(k) as it plays, then clean it up. */
function temp(fx: FxHost, obj: THREE.Object3D, dur: number, update: (k: number) => void, delay = 0) {
  fx.at(delay, () => fx.scene.add(obj))
  fx.tween(dur, update, () => {
    fx.scene.remove(obj)
    obj.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | undefined
      mat?.dispose()
    })
  }, delay)
}

function setOpacity(obj: THREE.Object3D, o: number) {
  obj.traverse((c) => {
    const m = (c as THREE.Mesh).material as THREE.Material | undefined
    if (m) m.opacity = o
  })
}

/** A glowing beam between two points. */
function beam(fx: FxHost, from: THREE.Vector3, to: THREE.Vector3, color: number, width: number, dur: number, delay = 0) {
  const len = from.distanceTo(to)
  const geo = new THREE.CylinderGeometry(width, width, len, 8, 1, true).translate(0, len / 2, 0).rotateX(Math.PI / 2)
  const core = new THREE.Mesh(geo, glow(color, 0.9))
  const outer = new THREE.Mesh(geo.clone().scale(2.4, 2.4, 1), glow(color, 0.35))
  const g = new THREE.Group()
  g.add(core, outer)
  g.position.copy(from)
  g.lookAt(to)
  temp(fx, g, dur, (k) => {
    const w = Math.sin(Math.min(1, k * 1.2) * Math.PI) * (1 + Math.sin(k * 40) * 0.15)
    g.scale.set(w, w, 1)
    setOpacity(core, 0.9 * w)
  }, delay)
}

/** A rune circle on the ground that spins open and fades. */
function rune(fx: FxHost, at: THREE.Vector3, color: number, r: number, dur: number, delay = 0) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.RingGeometry(r * 0.86, r, 40).rotateX(-Math.PI / 2), glow(color, 0.9)))
  g.add(new THREE.Mesh(new THREE.RingGeometry(r * 0.5, r * 0.56, 6).rotateX(-Math.PI / 2), glow(color, 0.8)))
  g.add(new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), glow(color, 0.18)))
  g.position.copy(at).setY(0.03)
  temp(fx, g, dur, (k) => {
    g.rotation.y = k * 2
    g.scale.setScalar(0.2 + Math.min(1, k * 4) * 0.8)
    setOpacity(g, k < 0.75 ? 1 : (1 - k) * 4)
  }, delay)
}

/** A bendy arm made of segments (tentacles, bony hands' forearms). */
function arm(segments: number, base: number, color: number, emissive = 0): { root: THREE.Group; segs: THREE.Group[] } {
  const root = new THREE.Group()
  const segs: THREE.Group[] = []
  let parent: THREE.Object3D = root
  const mat = solid(color, emissive)
  for (let k = 0; k < segments; k++) {
    const s = new THREE.Group()
    s.position.y = k === 0 ? 0 : base * 1.6
    const r = base * (1 - (k / segments) * 0.75)
    s.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, base * 1.7, 7).translate(0, base * 0.8, 0), mat))
    parent.add(s)
    segs.push(s)
    parent = s
  }
  return { root, segs }
}

const head = (u: FxUnit) => u.pos.clone().setY(u.fig.height * 0.6)
const chest = (u: FxUnit) => u.pos.clone().setY(u.fig.height * 0.45)

// ---------- the bosses ----------

export const SIGNATURES: Record<string, Signature> = {
  /** Leaps high and brings the club down: a dust ring, and stars circling the victim's head. */
  'Goblin Boss': {
    impact: 0.5,
    color: 0xd8c8a0,
    shake: 0.6,
    run(fx, a, t, D) {
      const dir = t.pos.clone().sub(a.pos).setY(0)
      const reach = Math.max(0, dir.length() - 0.75)
      dir.normalize()
      fx.pose(a, 'slam', D * 0.6)
      fx.tween(D * 0.45, (k) => a.offset.copy(dir).multiplyScalar(reach * k).setY(Math.sin(k * Math.PI) * 1.3), undefined, D * 0.05)
      fx.tween(D * 0.3, (k) => a.offset.copy(dir).multiplyScalar(reach * (1 - k)), undefined, D * 0.65)
      fx.at(D * 0.5, () => {
        fx.shockwave(t.pos, 0xd8c8a0)
        const stars = new THREE.Group()
        for (let i = 0; i < 4; i++) {
          const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), glow(0xffe066))
          s.position.set(Math.cos((i / 4) * Math.PI * 2) * 0.25, 0, Math.sin((i / 4) * Math.PI * 2) * 0.25)
          stars.add(s)
        }
        stars.position.copy(t.pos).setY(t.fig.height + 0.1)
        temp(fx, stars, 1.2, (k) => {
          stars.rotation.y = k * 9
          setOpacity(stars, 1 - k * k)
        })
      })
    },
  },

  /** Three quick slashes, each leaving a bright crescent. */
  'Bandit Captain': {
    impact: 0.62,
    color: 0xffffff,
    shake: 0.3,
    run(fx, a, t, D) {
      const dir = t.pos.clone().sub(a.pos).setY(0)
      const reach = Math.max(0, Math.min(dir.length() - 0.6, 0.45))
      dir.normalize()
      for (let i = 0; i < 3; i++) {
        fx.at(D * (0.05 + i * 0.2), () => fx.pose(a, 'swing', D * 0.22, reach, dir))
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 4, 18, Math.PI * 0.9), glow(0xffffff))
        arc.position.copy(chest(t))
        arc.lookAt(a.pos.clone().setY(arc.position.y))
        arc.rotateZ([0.6, -0.7, 1.6][i])
        temp(fx, arc, D * 0.18, (k) => {
          arc.scale.setScalar(0.7 + k * 0.5)
          setOpacity(arc, 1 - k)
        }, D * (0.12 + i * 0.2))
        fx.at(D * (0.14 + i * 0.2), () => fx.burst(chest(t), 0xffe8c0, 5, 1.2))
      }
    },
  },

  /** A beam of grave-light, and the victim's soul pulled out in wisps back into the staff. */
  Lich: {
    impact: 0.55,
    color: 0xa78bfa,
    shake: 0.2,
    run(fx, a, t, D) {
      fx.pose(a, 'cast', D * 0.85)
      rune(fx, a.pos, 0xa78bfa, 0.7, D * 0.9)
      fx.at(D * 0.2, () => beam(fx, fx.muzzle(a), chest(t), 0x8af06a, 0.05, D * 0.55))
      fx.tween(D * 0.5, () => {
        const from = chest(t).add(V(rand(-0.25, 0.25), rand(-0.2, 0.4), rand(-0.25, 0.25)))
        const vel = fx.muzzle(a).sub(from).multiplyScalar(1 / 0.6)
        fx.particle(from, vel, Math.random() < 0.5 ? 0xa78bfa : 0x8af06a, 0.6, 0.06, -0.4, 0)
      }, undefined, D * 0.3)
    },
  },

  /** Rears up and pours out fire; the ground around its victim keeps burning. */
  'Elder Wyrm': {
    impact: 0.55,
    color: 0xff6a1e,
    shake: 0.7,
    run(fx, a, t, D) {
      fx.pose(a, 'breath', D * 0.85)
      fx.tween(D * 0.45, () => {
        const from = fx.muzzle(a)
        const to = chest(t)
        for (let i = 0; i < 5; i++) {
          const vel = to.clone().sub(from).multiplyScalar(1 / 0.4).add(V(rand(-1.5, 1.5), rand(-0.8, 0.8), rand(-1.5, 1.5)))
          fx.particle(from.clone(), vel, Math.random() < 0.3 ? 0xffe066 : 0xff5a1e, 0.45, 0.14, 2.6, 0)
        }
      }, undefined, D * 0.2)
      fx.at(D * 0.55, () => {
        const ring = new THREE.Group()
        for (let i = 0; i < 9; i++) {
          const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 5), glow(i % 2 ? 0xffb02e : 0xff5a1e))
          const ang = (i / 9) * Math.PI * 2
          f.position.set(Math.cos(ang) * 0.55, 0.22, Math.sin(ang) * 0.55)
          ring.add(f)
        }
        ring.position.copy(t.pos)
        temp(fx, ring, 1.6, (k) => {
          ring.children.forEach((c, i) => c.scale.set(1, 0.7 + Math.sin(k * 30 + i) * 0.35, 1))
          setOpacity(ring, k < 0.7 ? 1 : (1 - k) / 0.3)
        })
      })
    },
  },

  /** A burning sigil opens under the victim and a column of hellfire erupts out of it. */
  'Demon Prince': {
    impact: 0.6,
    color: 0xff3a1e,
    shake: 0.8,
    run(fx, a, t, D) {
      fx.pose(a, 'slam', D * 0.7)
      rune(fx, t.pos, 0xff3a1e, 0.75, D * 0.85, D * 0.1)
      fx.at(D * 0.55, () => {
        fx.pillar(t.pos, 0xff4a1e, D * 0.5)
        for (let i = 0; i < 26; i++)
          fx.particle(t.pos.clone().add(V(rand(-0.3, 0.3), 0.05, rand(-0.3, 0.3))), V(rand(-0.3, 0.3), rand(2, 4.5), rand(-0.3, 0.3)), i % 3 ? 0xff5a1e : 0xffd23a, 0.8, 0.08, -0.5, 0)
      })
    },
  },

  /** The club comes down and a line of ice spikes bursts up across the board to the victim. */
  'Frost Giant': {
    impact: 0.6,
    color: 0xbff0ff,
    shake: 0.8,
    run(fx, a, t, D) {
      fx.pose(a, 'slam', D * 0.6)
      const from = a.pos.clone()
      const to = t.pos.clone()
      const n = Math.max(3, Math.round(from.distanceTo(to) * 2))
      for (let i = 1; i <= n; i++) {
        const p = from.clone().lerp(to, i / n)
        const spike = new THREE.Group()
        for (let j = 0; j < 3; j++) {
          const h = rand(0.35, 0.8) * (i === n ? 1.6 : 1)
          const c = new THREE.Mesh(new THREE.ConeGeometry(rand(0.07, 0.13), h, 5).translate(0, h / 2, 0), solid(0xbff0ff, 0.4))
          c.position.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15))
          c.rotation.set(rand(-0.4, 0.4), 0, rand(-0.4, 0.4))
          spike.add(c)
        }
        spike.position.copy(p)
        temp(fx, spike, 1.1, (k) => {
          spike.scale.set(1, Math.min(1, k * 6) * (k > 0.7 ? (1 - k) / 0.3 : 1), 1)
        }, D * 0.3 + (i / n) * D * 0.3)
      }
    },
  },

  /** Vents steam as it winds up, then a piston punch that sprays sparks. */
  'Iron Golem': {
    impact: 0.5,
    color: 0xff8a2e,
    shake: 0.7,
    run(fx, a, t, D) {
      const dir = t.pos.clone().sub(a.pos).setY(0)
      const reach = Math.max(0, Math.min(dir.length() - 0.9, 0.6))
      dir.normalize()
      fx.pose(a, 'swing', D * 0.8, reach, dir)
      fx.tween(D * 0.4, () => {
        for (const s of [-1, 1])
          fx.particle(a.pos.clone().add(V(s * 0.35, a.fig.height * 0.75, 0)), V(s * rand(0.2, 0.6), rand(0.8, 1.4), rand(-0.2, 0.2)), 0x9a9a9a, 0.6, 0.045, 0.8, 0)
      })
      fx.at(D * 0.5, () => {
        fx.shockwave(t.pos, 0xff8a2e)
        for (let i = 0; i < 24; i++) fx.particle(chest(t), V(rand(-2, 2), rand(0.5, 3), rand(-2, 2)), 0xffd060, 0.7, 0.03, 0, 6)
      })
    },
  },

  /** A rift of nothing opens under the victim and tentacles reach up out of it. */
  'Void Horror': {
    impact: 0.6,
    color: 0x9a6aff,
    shake: 0.5,
    run(fx, a, t, D) {
      fx.pose(a, 'cast', D * 0.8)
      const rift = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x05020c, transparent: true }))
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.65, 32).rotateX(-Math.PI / 2), glow(0x9a6aff))
      const g = new THREE.Group()
      g.add(rift, rim)
      g.position.copy(t.pos).setY(0.03)
      temp(fx, g, D * 0.95, (k) => {
        g.scale.setScalar(Math.min(1, k * 5) * (k > 0.8 ? (1 - k) * 5 : 1))
        rim.rotation.y = k * 4
      }, D * 0.1)
      for (let i = 0; i < 5; i++) {
        const tent = arm(6, 0.1, 0x7a4ad8, 0.6) // bright enough to read against the starfield
        const ang = (i / 5) * Math.PI * 2
        tent.root.position.copy(t.pos).add(V(Math.cos(ang) * 0.4, 0, Math.sin(ang) * 0.4))
        tent.root.rotation.y = -ang
        temp(fx, tent.root, D * 0.65, (k) => {
          const rise = Math.sin(Math.min(1, k * 1.4) * Math.PI)
          tent.root.scale.setScalar(Math.max(0.01, rise))
          tent.segs.forEach((s, j) => (s.rotation.z = -0.25 - j * 0.12 * rise + Math.sin(k * 12 + i + j) * 0.1))
        }, D * 0.3)
      }
    },
  },

  /** Raises the hammer, a fireball climbs into the sky, and a meteor comes down on the victim. */
  'Fire Titan': {
    impact: 0.72,
    color: 0xff7a1e,
    shake: 1.2,
    run(fx, a, t, D) {
      fx.pose(a, 'slam', D * 0.5)
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), glow(0xffb02e))
      const start = fx.muzzle(a)
      temp(fx, orb, D * 0.25, (k) => orb.position.copy(start).setY(start.y + k * 8), D * 0.12)
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), solid(0xff6a1e, 1.2))
      const sky = t.pos.clone().add(V(-3, 10, -2))
      const land = t.pos.clone().setY(0.3)
      temp(fx, rock, D * 0.32, (k) => {
        rock.position.lerpVectors(sky, land, k * k)
        rock.rotation.set(k * 6, k * 4, 0)
        for (let i = 0; i < 3; i++) fx.particle(rock.position.clone(), V(rand(-0.5, 0.5), rand(0.5, 1.5), rand(-0.5, 0.5)), i ? 0xff8a2e : 0xffe066, 0.5, 0.12, 1.5, 0)
      }, D * 0.4)
      fx.at(D * 0.72, () => {
        fx.shockwave(t.pos, 0xff7a1e)
        fx.burst(t.pos.clone().setY(0.3), 0xffb02e, 40, 3.5)
        fx.pillar(t.pos, 0xff7a1e, 0.6)
      })
    },
  },

  /** Bony hands claw up out of the ground around the victim in a ring of grave-fog. */
  'The Undying King': {
    impact: 0.6,
    color: 0x8af06a,
    shake: 0.4,
    run(fx, a, t, D) {
      fx.pose(a, 'slam', D * 0.6)
      rune(fx, t.pos, 0x8af06a, 0.8, D * 0.9, D * 0.1)
      fx.tween(D * 0.6, () => fx.particle(t.pos.clone().add(V(rand(-0.6, 0.6), 0.05, rand(-0.6, 0.6))), V(0, rand(0.1, 0.3), 0), 0x2f7a3a, 0.9, 0.07, 0.6, 0), undefined, D * 0.15)
      for (let i = 0; i < 6; i++) {
        const hand = new THREE.Group()
        const bone = solid(0xe8e2cf, 0.15)
        hand.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 5).translate(0, 0.25, 0), bone))
        for (let f = 0; f < 4; f++) {
          const finger = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.16, 4).translate(0, 0.08, 0), bone)
          finger.position.set((f - 1.5) * 0.03, 0.5, 0)
          finger.rotation.x = 0.5
          hand.add(finger)
        }
        const ang = (i / 6) * Math.PI * 2
        hand.position.copy(t.pos).add(V(Math.cos(ang) * 0.42, 0, Math.sin(ang) * 0.42))
        hand.rotation.set(0, -ang + Math.PI / 2, 0)
        hand.rotateX(-0.35)
        hand.scale.setScalar(1.5)
        temp(fx, hand, D * 0.75, (k) => {
          const rise = Math.min(1, k * 3) * (k > 0.75 ? (1 - k) * 4 : 1)
          hand.scale.set(1.5, Math.max(0.01, rise) * 1.5, 1.5)
        }, D * 0.3 + i * 0.04)
      }
    },
  },

  /** Spears of golden light rain from the sky, the last striking true. */
  'The Fallen Archon': {
    impact: 0.66,
    color: 0xfff2a8,
    shake: 0.6,
    run(fx, a, t, D) {
      fx.pose(a, 'cast', D * 0.85)
      for (let i = 0; i < 5; i++) {
        const last = i === 4
        const at = last ? t.pos.clone() : t.pos.clone().add(V(rand(-1.2, 1.2), 0, rand(-1.2, 1.2)))
        const spear = new THREE.Group()
        // Solid gold (glowing light vanishes against the Heavens' pale sky), with a bright halo.
        spear.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), solid(0xf2b52e, 0.7)))
        spear.add(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 6).rotateX(Math.PI).translate(0, -1.3, 0), solid(0xffe08a, 0.9)))
        spear.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8, 1, true), glow(0xffd23a, 0.35)))
        const from = at.clone().setY(9)
        const to = at.clone().setY(1.2)
        const delay = D * (0.25 + i * 0.1)
        temp(fx, spear, D * 0.12, (k) => spear.position.lerpVectors(from, to, k), delay)
        fx.at(delay + D * 0.12, () => {
          fx.burst(at.clone().setY(0.1), 0xfff2a8, last ? 20 : 8, last ? 2.5 : 1.4)
          if (!last) fx.shake(0.15)
        })
      }
    },
  },

  /** Opens its maw: light and life are sucked out of the victim while its eye burns a beam. */
  'The World-Eater': {
    impact: 0.66,
    color: 0x9a4af0,
    shake: 0.9,
    run(fx, a, t, D) {
      fx.pose(a, 'breath', D * 0.85)
      fx.tween(D * 0.55, () => {
        for (let i = 0; i < 3; i++) {
          const from = t.pos.clone().add(V(rand(-0.9, 0.9), rand(0, 1.4), rand(-0.9, 0.9)))
          fx.particle(from, fx.muzzle(a).sub(from).multiplyScalar(1 / 0.55), i ? 0x6a3aff : 0xff6a6a, 0.55, 0.06, -0.6, 0)
        }
      }, undefined, D * 0.1)
      fx.at(D * 0.35, () => beam(fx, head(a), chest(t), 0xff3a3a, 0.07, D * 0.35))
      const pull = a.pos.clone().sub(t.pos).setY(0).normalize().multiplyScalar(0.35)
      fx.tween(D * 0.3, (k) => t.offset.copy(pull).multiplyScalar(Math.sin(k * Math.PI)), undefined, D * 0.4)
    },
  },

  /** Rings of white and black close in on the victim, and it flickers as it's unmade. */
  'Whatever Sits the Throne': {
    impact: 0.62,
    color: 0xffffff,
    shake: 1.0,
    run(fx, a, t, D) {
      fx.pose(a, 'cast', D * 0.85)
      for (let i = 0; i < 6; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1, 0.02, 4, 40),
          i % 2 ? new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true }) : glow(0xffffff),
        )
        ring.position.copy(chest(t))
        ring.rotation.set(rand(0, Math.PI), rand(0, Math.PI), 0)
        temp(fx, ring, D * 0.4, (k) => {
          ring.scale.setScalar(3 * (1 - k) + 0.05)
          ring.rotation.x += 0.05
          setOpacity(ring, Math.min(1, k * 3))
        }, D * (0.15 + i * 0.04))
      }
      const base = t.fig.root.scale.x
      fx.tween(D * 0.3, (k) => {
        const glitch = Math.random() < 0.5 ? 1 : 0.8 + Math.random() * 0.4
        t.fig.root.scale.set(base * glitch, base * (k < 1 ? 2 - glitch : 1), base * glitch)
      }, () => t.fig.root.scale.setScalar(base), D * 0.45)
      fx.at(D * 0.62, () => fx.pillar(t.pos, 0xffffff, 0.5))
    },
  },

  /** Rears and stomps: the board cracks, rocks fly and everything shakes. */
  Tarrasque: {
    impact: 0.55,
    color: 0xb8a070,
    shake: 1.4,
    run(fx, a, t, D) {
      const dir = t.pos.clone().sub(a.pos).setY(0)
      const reach = Math.max(0, Math.min(dir.length() - 1.4, 0.6))
      dir.normalize()
      fx.pose(a, 'slam', D * 0.75, reach, dir)
      fx.at(D * 0.55, () => {
        fx.shockwave(t.pos, 0xb8a070)
        fx.shockwave(a.pos, 0xb8a070)
        const cracks = new THREE.Group()
        for (let i = 0; i < 7; i++) {
          const len = rand(0.8, 1.8)
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, len).translate(0, 0, len / 2), new THREE.MeshBasicMaterial({ color: 0x1a120a, transparent: true }))
          c.rotation.y = (i / 7) * Math.PI * 2 + rand(-0.2, 0.2)
          cracks.add(c)
        }
        cracks.position.copy(t.pos).setY(0.015)
        temp(fx, cracks, 1.8, (k) => {
          cracks.scale.setScalar(Math.min(1, k * 8))
          setOpacity(cracks, k < 0.7 ? 1 : (1 - k) / 0.3)
        })
        for (let i = 0; i < 10; i++) {
          const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.06, 0.14), 0), solid(0x6a5a42))
          const vel = V(rand(-1.5, 1.5), rand(2.5, 4), rand(-1.5, 1.5))
          const p = t.pos.clone().setY(0.1)
          temp(fx, r, 0.9, (k) => {
            const s = k * 0.9
            r.position.set(p.x + vel.x * s, Math.max(0, p.y + vel.y * s - 4.9 * s * s), p.z + vel.z * s)
            r.rotation.set(k * 8, k * 5, 0)
          })
        }
      })
    },
  },

  /** A giant tentacle rises out of the sea beside the deck and crashes down on the victim. */
  'The Kraken': {
    impact: 0.6,
    color: 0x8ad8f0,
    shake: 1.1,
    run(fx, a, t, D) {
      fx.pose(a, 'slam', D * 0.7)
      const side = t.pos.z >= 0 ? 1 : -1
      const base = t.pos.clone().add(V(0.4, -0.6, side * 2.2))
      const tent = arm(8, 0.26, 0x1c7a8a)
      tent.root.position.copy(base)
      tent.root.rotation.y = side > 0 ? Math.PI : 0 // curl toward the deck
      temp(fx, tent.root, D * 0.85, (k) => {
        const rise = k < 0.4 ? k / 0.4 : 1
        const slam = k < 0.4 ? 0 : k < 0.62 ? (k - 0.4) / 0.22 : 1 - (k - 0.62) / 0.38
        tent.root.position.y = base.y + (k > 0.62 ? -(k - 0.62) * 3 : 0)
        tent.segs.forEach((s, j) => {
          s.rotation.x = rise * 0.04 + slam * (0.11 + j * 0.015)
          s.rotation.z = Math.sin(k * 8 + j) * 0.05
        })
        tent.root.scale.setScalar(Math.max(0.01, rise))
      }, D * 0.05)
      fx.at(D * 0.6, () => {
        for (let i = 0; i < 30; i++) fx.particle(t.pos.clone().setY(0.2), V(rand(-1.8, 1.8), rand(1.5, 3.5), rand(-1.8, 1.8)), i % 2 ? 0x8ad8f0 : 0xffffff, 0.8, 0.07, 0, 6)
      })
    },
  },
}

