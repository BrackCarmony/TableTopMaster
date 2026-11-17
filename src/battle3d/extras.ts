import * as THREE from 'three'
import type { Figure } from './figures'
import type { HumanoidLook } from './humanoid'
import { ball, box, cone, cyl, mesh, pivot } from './kit'

// Details added on top of a base model to give each enemy its own character: bandit masks, a
// captain's tricorn, quivers, a golem's furnace, flames, ghostly tails. Positions are in the
// humanoid's own frame (see humanoid.ts: feet at 0, shoulders at 0.75, head pivot at 0.79,
// facing +z), so they scale with the figure. Anything worn above the waist goes on `fig.upper`
// so it twists and leans with the chest.

/** Radius of a humanoid's head. */
export const headR = (look: HumanoidLook) => 0.14 * (look.headSize ?? 1)
const W = (look: HumanoidLook) => look.width ?? 1

/** A flickering flame (outer cone and bright core) that dies down when its owner falls. */
export function flame(fig: Figure, parent: THREE.Object3D, x: number, y: number, z: number, color: number, size: number) {
  const g = pivot(x, y, z)
  const outer = mesh(cone(0.07 * size, 0.24 * size, 6), fig.mats.see(color, 0.85, 1.6), 0, 0.12 * size, 0)
  const inner = mesh(cone(0.04 * size, 0.14 * size, 6), fig.mats.see(0xfff2a8, 0.95, 1.8), 0, 0.08 * size, 0)
  outer.castShadow = inner.castShadow = false
  g.add(outer, inner)
  parent.add(g)
  const phase = Math.random() * 10
  let life = 1
  fig.anims.push((t, alive) => {
    life += ((alive ? 1 : 0) - life) * 0.05
    const f = (1 + Math.sin(t * 13 + phase) * 0.15 + Math.sin(t * 7.1 + phase) * 0.1) * life
    outer.scale.set(life, Math.max(0.01, f), life)
    inner.scale.set(life, Math.max(0.01, 2 * life - f), life)
    outer.rotation.y = t * 2 + phase
  })
  return g
}

/** See-through and legless, trailing a wisp instead: wraiths and other ghosts. */
export function ghostify(fig: Figure, tail: number, opacity = 0.72) {
  for (const m of fig.mats.list) {
    m.transparent = true
    m.opacity = opacity
    m.depthWrite = false
    m.userData.baseOpacity = opacity
  }
  for (const l of fig.legs) l.visible = false
  const wisp = pivot(0, 0.46, 0)
  const tailMesh = mesh(cone(0.17, 0.62, 7), fig.mats.see(tail, opacity * 0.8, 0.4), 0, -0.3, -0.04)
  tailMesh.rotation.x = Math.PI
  wisp.add(tailMesh)
  fig.body.add(wisp)
  fig.anims.push((t) => {
    wisp.rotation.x = 0.25 + Math.sin(t * 2.1) * 0.12
    wisp.rotation.z = Math.sin(t * 1.7) * 0.15
  })
}

/** A cloth mask over the nose and mouth, tied at the back. */
export function bandana(fig: Figure, look: HumanoidLook, color: number) {
  const r = headR(look)
  const m = fig.mats.get(color)
  fig.head?.add(mesh(box(r * 2.08, r * 0.72, r * 1.15), m, 0, r * 0.62, r * 0.5))
  fig.head?.add(mesh(ball(r * 0.22, 0), m, 0, r * 0.75, -r * 0.98))
}

export function eyepatch(fig: Figure, look: HumanoidLook) {
  const r = headR(look)
  const m = fig.mats.get(0x141414)
  fig.head?.add(mesh(box(r * 0.42, r * 0.36, r * 0.12), m, r * 0.4, r * 1.08, r * 0.92))
  const strap = mesh(box(r * 2.15, r * 0.1, r * 2.15), m, 0, r * 1.2, 0)
  strap.rotation.z = -0.35
  fig.head?.add(strap)
}

/** A pirate captain's three-cornered hat. */
export function tricorn(fig: Figure, look: HumanoidLook, color: number, trim: number) {
  const r = headR(look)
  const hat = pivot(0, r * 1.75, 0)
  const m = fig.mats.get(color)
  hat.add(mesh(cyl(r * 0.85, r * 0.95, r * 0.65, 8), m, 0, r * 0.3, 0))
  const brims = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]
  for (const a of brims) {
    const b = mesh(box(r * 1.9, r * 0.5, r * 0.12), m, Math.sin(a) * r * 0.75, r * 0.15, Math.cos(a) * r * 0.75)
    b.rotation.y = a
    b.rotation.x = -0.35
    hat.add(b)
    const t = mesh(box(r * 1.92, r * 0.08, r * 0.13), fig.mats.get(trim, 0.3), Math.sin(a) * r * 0.79, r * 0.38, Math.cos(a) * r * 0.79)
    t.rotation.y = a
    t.rotation.x = -0.35
    hat.add(t)
  }
  hat.add(mesh(ball(r * 0.18, 0), fig.mats.get(0xe8e2d4), r * 0.5, r * 0.55, r * 0.55)) // a feather knot
  fig.head?.add(hat)
}

/** Coat tails hanging behind the legs. */
export function coatTails(fig: Figure, look: HumanoidLook, color: number) {
  const m = fig.mats.get(color)
  for (const s of [-1, 1]) {
    const tail = mesh(box(0.13 * W(look), 0.34, 0.03), m, s * 0.075 * W(look), 0.3, -0.1)
    tail.rotation.x = 0.12
    fig.body.add(tail)
  }
}

/** A quiver of arrows (or bolts) on the back. */
export function quiver(fig: Figure, color: number, fletch: number) {
  const q = pivot(0.06, 0.62, -0.14)
  q.rotation.z = 0.35
  q.add(mesh(cyl(0.045, 0.04, 0.3, 7), fig.mats.get(color)))
  for (let i = 0; i < 4; i++)
    q.add(mesh(cone(0.018, 0.06, 3), fig.mats.get(fletch), Math.cos(i * 1.6) * 0.02, 0.18, Math.sin(i * 1.6) * 0.02))
  fig.upper.add(q)
}

/** A shoulder bag on the hip, with a painted mark. */
export function satchel(fig: Figure, color: number, mark: number) {
  const s = pivot(0.17, 0.46, 0.02)
  s.add(mesh(box(0.08, 0.12, 0.14), fig.mats.get(color)))
  s.add(mesh(box(0.012, 0.06, 0.02), fig.mats.get(mark), 0.042, 0.01, 0))
  s.add(mesh(box(0.012, 0.02, 0.06), fig.mats.get(mark), 0.042, 0.01, 0))
  fig.body.add(s)
  const strap = mesh(box(0.02, 0.46, 0.2), fig.mats.get(color), 0.02, 0.63, 0.0)
  strap.rotation.z = -0.65
  fig.upper.add(strap)
}

/** A shaggy fur mantle over the shoulders. */
export function furMantle(fig: Figure, look: HumanoidLook, color: number) {
  const m = fig.mats.get(color)
  const w = W(look)
  for (let i = 0; i < 7; i++) {
    const x = (i / 6 - 0.5) * 0.42 * w
    fig.upper.add(mesh(ball(0.07 + (i % 2) * 0.015, 0), m, x, 0.77 - Math.abs(x) * 0.25, -0.03))
  }
  fig.upper.add(mesh(box(0.36 * w, 0.12, 0.05), m, 0, 0.72, -0.1))
}

/** Spikes or crystals jutting from the shoulders. */
export function shoulderSpikes(fig: Figure, look: HumanoidLook, color: number, glow = 0, count = 3) {
  const m = glow ? fig.mats.get(color, glow) : fig.mats.get(color)
  for (const s of [-1, 1])
    for (let i = 0; i < count; i++) {
      const c = mesh(cone(0.035, 0.18 - i * 0.03, 5), m, s * (0.2 + i * 0.03) * W(look), 0.83, (i - 1) * 0.05)
      c.rotation.z = -s * (0.4 + i * 0.25)
      fig.upper.add(c)
    }
}

/** Something glowing in the chest (a furnace grill, a sigil, a gem) that pulses. */
export function chestGlow(fig: Figure, look: HumanoidLook, color: number, shape: 'grill' | 'sigil' | 'gem' | 'cracks', z = 0.1) {
  const g = pivot(0, 0.63, z * (shape === 'grill' ? 1.05 : 1))
  const m = fig.mats.get(color, 1.4)
  const w = W(look)
  if (shape === 'grill') {
    g.add(mesh(box(0.16 * w, 0.12, 0.02), m))
    for (let i = 0; i < 4; i++) g.add(mesh(box(0.014, 0.13, 0.03), fig.mats.get(0x1c1c20), (i / 3 - 0.5) * 0.12 * w, 0, 0.005))
  } else if (shape === 'sigil') {
    const ring = mesh(new THREE.TorusGeometry(0.06, 0.011, 4, 16), m)
    g.add(ring)
    for (let i = 0; i < 3; i++) {
      const bar = mesh(box(0.012, 0.11, 0.01), m)
      bar.rotation.z = (i / 3) * Math.PI
      g.add(bar)
    }
  } else if (shape === 'gem') g.add(mesh(new THREE.OctahedronGeometry(0.045), m))
  else
    for (let i = 0; i < 6; i++) {
      const c = mesh(box(0.012, 0.09 + (i % 3) * 0.04, 0.01), m, ((i % 3) - 1) * 0.08 * w, (i < 3 ? 0.05 : -0.08), 0)
      c.rotation.z = (i % 2 ? 0.5 : -0.4) + i * 0.2
      g.add(c)
    }
  fig.upper.add(g)
  const phase = Math.random() * 6
  fig.anims.push((t, alive) => {
    m.userData.baseIntensity = alive ? 1.1 + Math.sin(t * 2.4 + phase) * 0.4 : 0.1
  })
}

/** The big brass key in a clockwork figure's back, turning. */
export function windupKey(fig: Figure, color: number) {
  const k = pivot(0, 0.65, -0.11)
  const m = fig.mats.get(color)
  k.add(mesh(cyl(0.015, 0.015, 0.1, 5).rotateX(Math.PI / 2), m, 0, 0, -0.05))
  for (const s of [-1, 1]) k.add(mesh(new THREE.TorusGeometry(0.045, 0.014, 4, 10), m, s * 0.055, 0, -0.1))
  fig.upper.add(k)
  fig.anims.push((t, alive) => {
    if (alive) k.rotation.z = t * 1.6
  })
}

/** A small glowing thing orbiting above the head (a lich's phylactery). */
export function orbiter(fig: Figure, color: number, radius: number, height: number, speed: number) {
  const o = pivot(0, height, 0)
  const gem = mesh(new THREE.OctahedronGeometry(0.05), fig.mats.get(color, 1.5))
  gem.castShadow = false
  o.add(gem)
  fig.body.add(o)
  fig.anims.push((t, alive) => {
    o.visible = alive
    gem.position.set(Math.cos(t * speed) * radius, Math.sin(t * speed * 2) * 0.04, Math.sin(t * speed) * radius)
    gem.rotation.y = t * 3
  })
}

/** A necklace of bones or teeth. */
export function boneNecklace(fig: Figure, look: HumanoidLook, color = 0xf3ecd8) {
  const m = fig.mats.get(color)
  const w = W(look)
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 2.2
    const c = mesh(cone(0.016, 0.06, 4), m, Math.sin(a) * 0.12 * w, 0.73 - Math.cos(a) * 0.03, Math.cos(a) * 0.1)
    c.rotation.x = Math.PI
    fig.upper.add(c)
  }
}

/** Extra glowing eyes scattered over a surface (eldritch things). */
export function eyeCluster(fig: Figure, parent: THREE.Object3D, at: THREE.Vector3, n: number, spread: number, size: number, color: number) {
  const white = fig.mats.get(color, 1.0)
  const pupil = fig.mats.get(0x0b0710)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = i === 0 ? 0 : spread
    const s = i === 0 ? size * 1.4 : size
    parent.add(mesh(ball(s, 1), white, at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, at.z))
    parent.add(mesh(ball(s * 0.45, 0), pupil, at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, at.z + s * 0.75))
  }
}

/** A ring of jagged teeth (a gaping mouth). */
export function fangs(fig: Figure, parent: THREE.Object3D, at: THREE.Vector3, width: number, size: number) {
  const m = fig.mats.get(0xf3ecd8)
  for (let i = 0; i < 6; i++) {
    const x = at.x + (i / 5 - 0.5) * width
    const top = mesh(cone(size * 0.35, size, 4), m, x, at.y + size * 0.4, at.z)
    top.rotation.x = Math.PI
    parent.add(top)
    parent.add(mesh(cone(size * 0.3, size * 0.8, 4), m, x + width * 0.05, at.y - size * 0.4, at.z))
  }
}

/** An hourglass floating above, its sand glowing (the Herald of Endings). */
export function hourglass(fig: Figure, height: number) {
  const h = pivot(0, height, 0)
  const frame = fig.mats.get(0x3a3a40)
  const glass = fig.mats.see(0xe8f0ff, 0.35, 0.3)
  const sand = fig.mats.get(0xe4e4e7, 1.0)
  h.add(mesh(cyl(0.08, 0.08, 0.02, 8), frame, 0, 0.12, 0), mesh(cyl(0.08, 0.08, 0.02, 8), frame, 0, -0.12, 0))
  h.add(mesh(cone(0.07, 0.11, 8), glass, 0, 0.06, 0).rotateX(Math.PI), mesh(cone(0.07, 0.11, 8), glass, 0, -0.06, 0))
  h.add(mesh(cone(0.045, 0.06, 8), sand, 0, -0.09, 0))
  for (const s of [-1, 1]) h.add(mesh(cyl(0.008, 0.008, 0.24, 4), frame, s * 0.07, 0, 0))
  h.scale.setScalar(1.6)
  fig.body.add(h)
  fig.anims.push((t, alive) => {
    h.visible = alive
    h.position.y = height + Math.sin(t * 1.3) * 0.04
    h.rotation.y = t * 0.6
  })
}

/** Patches of moss on an old stone figure. */
export function moss(fig: Figure, look: HumanoidLook, color = 0x4f7a32) {
  const m = fig.mats.get(color)
  const w = W(look)
  for (const [x, y, z, s] of [
    [0.19 * w, 0.8, 0.02, 0.07],
    [-0.08 * w, 0.52, 0.1, 0.06],
    [0.1 * w, 0.68, 0.11, 0.045],
    [-0.2 * w, 0.78, -0.02, 0.05],
  ])
  {
    const patch = mesh(ball(s, 0), m, x, y, z)
    patch.scale.set(1.2, 0.55, 1.2)
    fig.upper.add(patch)
  }
}

/** Put something on the end of a staff (a skull, a lantern), just below where its spells leave from. */
export function staffTop(fig: Figure, make: (m: Figure['mats']) => THREE.Object3D) {
  const tip = fig.muzzle
  const o = make(fig.mats)
  o.position.copy(tip.position)
  tip.parent?.add(o)
}

export function skull(mats: Figure['mats'], size = 0.06): THREE.Group {
  const g = new THREE.Group()
  const b = mats.get(0xe8e2cf)
  g.add(mesh(ball(size, 1), b))
  g.add(mesh(box(size * 1.1, size * 0.6, size), b, 0, -size * 0.6, size * 0.15))
  const hole = mats.get(0x1a1014)
  for (const s of [-1, 1]) g.add(mesh(ball(size * 0.25, 0), hole, s * size * 0.38, 0, size * 0.85))
  return g
}

/** A weapon's head made to glow from inside (molten, frozen, cursed). */
export function fistGlow(fig: Figure, color: number, size: number) {
  for (const e of fig.elbows) e.add(mesh(ball(size, 0), fig.mats.get(color, 0.8), 0, -0.19, 0))
}
