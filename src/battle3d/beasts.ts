import * as THREE from 'three'
import { MaterialBag, ball, box, cone, cyl, mesh, pivot, shade } from './kit'

// Figures that aren't person-shaped: dragons (and the Tarrasque), hounds, eldritch things with
// eyes and tentacles, and little flying drones. Built facing +z, feet (or the lowest point of a
// hovering body) at y = 0, about 1 unit tall at scale 1.

export interface BeastParts {
  body: THREE.Group
  head: THREE.Group | null
  /** Swung in alternating pairs while walking. */
  legs: THREE.Group[]
  wings: THREE.Group[]
  tentacles: THREE.Group[]
  tail: THREE.Group | null
  muzzle: THREE.Object3D
}

export interface Beast {
  group: THREE.Group
  parts: BeastParts
  height: number
}

/** A four-legged dragon: long neck, horns, tail, and (unless grounded) bat wings. */
export function buildDragon(
  mats: MaterialBag,
  opts: { color: number; belly?: number; scale: number; wings: boolean; spikes?: boolean; fire?: number },
): Beast {
  const g = new THREE.Group()
  const body = new THREE.Group()
  g.add(body)
  const hide = mats.get(opts.color)
  const belly = mats.get(opts.belly ?? shade(opts.color, 0.35))
  const horn = mats.get(0xe8e0c8)
  // Body.
  const torso = mesh(ball(0.3, 1), hide, 0, 0.42, 0)
  torso.scale.set(1, 0.8, 1.5)
  body.add(torso)
  const under = mesh(ball(0.26, 1), belly, 0, 0.36, 0.02)
  under.scale.set(0.9, 0.6, 1.35)
  body.add(under)
  // Legs.
  const legs: THREE.Group[] = []
  for (const [x, z] of [
    [-0.2, 0.28],
    [0.2, -0.28],
    [0.2, 0.28],
    [-0.2, -0.28],
  ]) {
    const leg = pivot(x, 0.38, z)
    leg.add(mesh(cyl(0.07, 0.06, 0.34, 6), hide, 0, -0.17, 0))
    leg.add(mesh(box(0.13, 0.06, 0.16), hide, 0, -0.35, 0.04))
    body.add(leg)
    legs.push(leg)
  }
  // Neck and head.
  const neck = mesh(cyl(0.08, 0.14, 0.42, 6), hide, 0, 0.62, 0.42)
  neck.rotation.x = 0.7
  body.add(neck)
  const head = pivot(0, 0.82, 0.6)
  head.add(mesh(box(0.2, 0.17, 0.26), hide, 0, 0, 0))
  head.add(mesh(box(0.15, 0.1, 0.22), hide, 0, -0.03, 0.2))
  const eye = mats.get(opts.fire ?? 0xffd23a, 1.2)
  for (const s of [-1, 1]) {
    head.add(mesh(ball(0.025, 0), eye, s * 0.09, 0.04, 0.1))
    const h = mesh(cone(0.035, 0.22, 5), horn, s * 0.07, 0.12, -0.1)
    h.rotation.x = -1.0
    head.add(h)
  }
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, -0.02, 0.33)
  head.add(muzzle)
  body.add(head)
  // Tail.
  const tail = pivot(0, 0.42, -0.4)
  let seg: THREE.Object3D = tail
  for (let k = 0; k < 4; k++) {
    const s = pivot(0, 0, -0.16)
    s.add(mesh(cone(0.09 - k * 0.018, 0.2, 6).rotateX(-Math.PI / 2), hide, 0, 0, -0.08))
    s.rotation.x = 0.12
    seg.add(s)
    seg = s
  }
  body.add(tail)
  // Spikes down the back.
  if (opts.spikes !== false)
    for (let k = 0; k < 5; k++) body.add(mesh(cone(0.05, 0.14, 4), horn, 0, 0.66 - Math.abs(k - 2) * 0.03, 0.3 - k * 0.15))
  // Wings.
  const wings: THREE.Group[] = []
  if (opts.wings) {
    const membrane = mats.get(shade(opts.color, -0.25))
    for (const s of [-1, 1]) {
      const w = pivot(s * 0.15, 0.6, 0.05)
      const bone = mesh(cyl(0.02, 0.025, 0.6, 4), hide, s * 0.3, 0.12, 0)
      bone.rotation.z = -s * 1.2
      w.add(bone)
      const sail = mesh(new THREE.ConeGeometry(0.35, 0.65, 3).rotateZ(-s * Math.PI / 2), membrane, s * 0.33, 0.02, -0.12)
      sail.scale.set(1, 1, 0.12)
      w.add(sail)
      body.add(w)
      wings.push(w)
    }
  }
  g.scale.setScalar(opts.scale)
  return { group: g, parts: { body, head, legs, wings, tentacles: [], tail, muzzle }, height: 0.95 * opts.scale }
}

/** A hound: four legs, a long snout, glowing eyes. */
export function buildHound(mats: MaterialBag, color: number, scale: number, eyes = 0xffb02e): Beast {
  const g = new THREE.Group()
  const body = new THREE.Group()
  g.add(body)
  const fur = mats.get(color)
  const torso = mesh(ball(0.2, 1), fur, 0, 0.36, 0)
  torso.scale.set(0.9, 0.85, 1.6)
  body.add(torso)
  const legs: THREE.Group[] = []
  for (const [x, z] of [
    [-0.1, 0.2],
    [0.1, -0.2],
    [0.1, 0.2],
    [-0.1, -0.2],
  ]) {
    const leg = pivot(x, 0.3, z)
    leg.add(mesh(box(0.06, 0.3, 0.06), fur, 0, -0.15, 0))
    body.add(leg)
    legs.push(leg)
  }
  const head = pivot(0, 0.5, 0.3)
  head.add(mesh(box(0.17, 0.15, 0.18), fur, 0, 0, 0))
  head.add(mesh(box(0.1, 0.08, 0.16), fur, 0, -0.03, 0.15))
  const eye = mats.get(eyes, 1.3)
  for (const s of [-1, 1]) {
    head.add(mesh(ball(0.02, 0), eye, s * 0.06, 0.03, 0.09))
    const ear = mesh(cone(0.035, 0.1, 4), fur, s * 0.06, 0.11, -0.03)
    head.add(ear)
  }
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, -0.03, 0.25)
  head.add(muzzle)
  body.add(head)
  const tail = pivot(0, 0.42, -0.3)
  const t = mesh(cone(0.04, 0.3, 5), fur, 0, 0.1, -0.08)
  t.rotation.x = -0.7
  tail.add(t)
  body.add(tail)
  g.scale.setScalar(scale)
  return { group: g, parts: { body, head, legs, wings: [], tentacles: [], tail, muzzle }, height: 0.65 * scale }
}

/** A floating eldritch thing: a round body, one great eye (or several), and tentacles below. */
export function buildEldritch(
  mats: MaterialBag,
  opts: { color: number; scale: number; eyes?: number; tentacles?: number; eyeColor?: number; mouth?: boolean; crown?: number | null },
): Beast {
  const g = new THREE.Group()
  const body = new THREE.Group()
  g.add(body)
  const flesh = mats.get(opts.color)
  const dark = mats.get(shade(opts.color, -0.45))
  const core = mesh(ball(0.32, 1), flesh, 0, 0.75, 0)
  body.add(core)
  // Knobbly lumps.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    body.add(mesh(ball(0.1, 0), dark, Math.cos(a) * 0.27, 0.78 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.27 - 0.05))
  }
  const eyeMat = mats.get(opts.eyeColor ?? 0xfff2a8, 1.0)
  const pupil = mats.get(0x0b0710)
  const n = opts.eyes ?? 1
  const head = pivot(0, 0.75, 0)
  body.add(head)
  for (let k = 0; k < n; k++) {
    const x = n === 1 ? 0 : (k / (n - 1) - 0.5) * 0.36
    const y = n === 1 ? 0.04 : 0.1 - Math.abs(x) * 0.4
    const r = n === 1 ? 0.13 : 0.06
    head.add(mesh(ball(r, 1), eyeMat, x, y, 0.27))
    head.add(mesh(ball(r * 0.45, 0), pupil, x, y, 0.27 + r * 0.8))
  }
  if (opts.mouth) {
    head.add(mesh(box(0.26, 0.05, 0.04), pupil, 0, -0.14, 0.29))
    const tooth = mats.get(0xf3ecd8)
    for (let k = 0; k < 5; k++) head.add(mesh(cone(0.018, 0.05, 3).rotateX(Math.PI), tooth, -0.1 + k * 0.05, -0.11, 0.31))
  }
  if (opts.crown != null) {
    const c = mats.get(opts.crown, 0.6)
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      body.add(mesh(cone(0.04, 0.2, 4), c, Math.cos(a) * 0.18, 1.1, Math.sin(a) * 0.18))
    }
  }
  const tentacles: THREE.Group[] = []
  const count = opts.tentacles ?? 6
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2
    const t = pivot(Math.cos(a) * 0.18, 0.55, Math.sin(a) * 0.18)
    let seg: THREE.Object3D = t
    for (let j = 0; j < 3; j++) {
      const s = pivot(0, -0.15, 0)
      s.add(mesh(cyl(0.05 - j * 0.013, 0.04 - j * 0.012, 0.16, 5), j % 2 ? dark : flesh, 0, -0.08, 0))
      seg.add(s)
      seg = s
    }
    t.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)
    body.add(t)
    tentacles.push(t)
  }
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.05, 0.35)
  head.add(muzzle)
  g.scale.setScalar(opts.scale)
  return { group: g, parts: { body, head, legs: [], wings: [], tentacles, tail: null, muzzle }, height: 1.15 * opts.scale }
}

/** A little flying repair drone: a brass ball, one glowing eye, a spinning rotor. */
export function buildDrone(mats: MaterialBag, color: number): Beast {
  const g = new THREE.Group()
  const body = new THREE.Group()
  g.add(body)
  const brass = mats.get(color)
  body.add(mesh(ball(0.18, 1), brass, 0, 0.7, 0))
  body.add(mesh(cyl(0.2, 0.2, 0.04, 10), mats.get(shade(color, -0.3)), 0, 0.7, 0))
  const head = pivot(0, 0.7, 0)
  head.add(mesh(ball(0.06, 0), mats.get(0x6ef0ff, 1.4), 0, 0, 0.16))
  body.add(head)
  const rotor = pivot(0, 0.92, 0)
  rotor.add(mesh(box(0.5, 0.015, 0.05), mats.get(0x3a3a40), 0, 0, 0))
  rotor.add(mesh(cyl(0.015, 0.015, 0.06, 4), mats.get(0x3a3a40), 0, -0.03, 0))
  body.add(rotor)
  for (const s of [-1, 1]) {
    const arm = pivot(s * 0.18, 0.66, 0)
    arm.add(mesh(box(0.025, 0.18, 0.025), brass, 0, -0.09, 0.03))
    body.add(arm)
  }
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0, 0.2)
  head.add(muzzle)
  return { group: g, parts: { body, head, legs: [], wings: [rotor], tentacles: [], tail: null, muzzle }, height: 1.0 }
}

/** The Kraken: a great dark head with two eyes and a ring of eight arms. */
export function buildKraken(mats: MaterialBag, color: number, scale: number): Beast {
  return buildEldritch(mats, { color, scale, eyes: 2, tentacles: 8, eyeColor: 0xffe066, mouth: true })
}
