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
  /** Shin pivots matching `legs`; `kneeSign` is the way each one bends (+1 front, -1 hind). */
  knees?: THREE.Group[]
  kneeSign?: number[]
  /** Neck segments from the shoulders up, each with its resting tilt in userData.rest. */
  neck?: THREE.Group[]
  /** The lower jaw (opens to bite and breathe). */
  jaw?: THREE.Group | null
  /** Tail segments from the root out, for a rippling wave. */
  tailSegs?: THREE.Group[]
  /** Outer wing joints (fold and flap after the inner ones). */
  wingTips?: THREE.Group[]
  /** Each tentacle's segments, root first. */
  tentacleSegs?: THREE.Group[][]
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
  // Legs: thigh from the hip, shin from the knee, a clawed foot.
  const legs: THREE.Group[] = []
  const knees: THREE.Group[] = []
  const kneeSign: number[] = []
  for (const [x, z] of [
    [-0.2, 0.28],
    [0.2, -0.28],
    [0.2, 0.28],
    [-0.2, -0.28],
  ]) {
    const leg = pivot(x, 0.38, z)
    leg.add(mesh(cyl(0.065, 0.075, 0.2, 6), hide, 0, -0.09, 0))
    const knee = pivot(0, -0.18, 0)
    knee.add(mesh(cyl(0.05, 0.06, 0.18, 6), hide, 0, -0.08, 0))
    knee.add(mesh(box(0.13, 0.05, 0.16), hide, 0, -0.17, 0.04))
    for (const c of [-1, 0, 1]) {
      const claw = mesh(cone(0.015, 0.06, 4), horn, c * 0.04, -0.18, 0.13)
      claw.rotation.x = Math.PI / 2
      knee.add(claw)
    }
    leg.add(knee)
    body.add(leg)
    legs.push(leg)
    knees.push(knee)
    kneeSign.push(z > 0 ? 1 : -1)
  }
  // Neck: three segments rising forward from the shoulders, the head on the last.
  const neck: THREE.Group[] = []
  let parent: THREE.Object3D = body
  const rest = [0.7, 0.05, 0.05]
  for (let k = 0; k < 3; k++) {
    const seg = pivot(0, k === 0 ? 0.46 : 0.14, k === 0 ? 0.28 : 0)
    seg.rotation.x = rest[k]
    seg.userData.rest = rest[k]
    seg.add(mesh(cyl(0.085 - k * 0.012, 0.11 - k * 0.012, 0.17, 6), hide, 0, 0.07, 0))
    if (opts.spikes !== false) seg.add(mesh(cone(0.035, 0.1, 4), horn, 0, 0.08, -0.08 + k * 0.01))
    parent.add(seg)
    neck.push(seg)
    parent = seg
  }
  const head = pivot(0, 0.14, 0)
  head.userData.rest = -(rest[0] + rest[1] + rest[2]) + 0.05
  head.rotation.x = head.userData.rest
  head.add(mesh(box(0.2, 0.17, 0.26), hide, 0, 0.02, 0.05))
  head.add(mesh(box(0.15, 0.08, 0.22), hide, 0, 0.0, 0.25))
  const eye = mats.get(opts.fire ?? 0xffd23a, 1.2)
  for (const sd of [-1, 1]) {
    head.add(mesh(ball(0.025, 0), eye, sd * 0.09, 0.06, 0.15))
    const h = mesh(cone(0.035, 0.22, 5), horn, sd * 0.07, 0.14, -0.05)
    h.rotation.x = -1.0
    head.add(h)
  }
  // The lower jaw, hinged at the back of the mouth, with a row of teeth.
  const jaw = pivot(0, -0.06, 0.1)
  jaw.add(mesh(box(0.13, 0.04, 0.24), belly, 0, -0.015, 0.13))
  for (const tx of [-0.045, 0.045]) {
    const tooth = mesh(cone(0.012, 0.04, 3), horn, tx, 0.02, 0.22)
    jaw.add(tooth)
  }
  head.add(jaw)
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, -0.03, 0.36)
  head.add(muzzle)
  parent.add(head)
  // Tail.
  const tail = pivot(0, 0.42, -0.4)
  const tailSegs: THREE.Group[] = []
  let seg: THREE.Object3D = tail
  for (let k = 0; k < 5; k++) {
    const s = pivot(0, 0, k === 0 ? 0 : -0.16)
    s.add(mesh(cone(0.09 - k * 0.015, 0.2, 6).rotateX(-Math.PI / 2), hide, 0, 0, -0.08))
    if (opts.spikes !== false && k < 4) s.add(mesh(cone(0.03, 0.08, 4), horn, 0, 0.07 - k * 0.01, -0.08))
    s.rotation.x = 0.1
    seg.add(s)
    tailSegs.push(s)
    seg = s
  }
  body.add(tail)
  // Spikes down the back.
  if (opts.spikes !== false)
    for (let k = 0; k < 5; k++) body.add(mesh(cone(0.05, 0.14, 4), horn, 0, 0.66 - Math.abs(k - 2) * 0.03, 0.3 - k * 0.15))
  // Wings: an inner arm from the shoulder and an outer one from the wrist, each with its sail.
  const wings: THREE.Group[] = []
  const wingTips: THREE.Group[] = []
  if (opts.wings) {
    const membrane = mats.get(shade(opts.color, -0.25))
    membrane.side = THREE.DoubleSide
    for (const sd of [-1, 1]) {
      const w = pivot(sd * 0.15, 0.6, 0.05)
      const bone = mesh(cyl(0.02, 0.025, 0.34, 4), hide, sd * 0.16, 0, 0)
      bone.rotation.z = Math.PI / 2
      w.add(bone)
      const sail = mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(sd * 0.32, 0, 0), new THREE.Vector3(sd * 0.2, 0, -0.32)]), membrane)
      sail.geometry.computeVertexNormals()
      w.add(sail)
      const tip = pivot(sd * 0.32, 0, 0)
      const bone2 = mesh(cyl(0.012, 0.02, 0.36, 4), hide, sd * 0.17, 0, 0)
      bone2.rotation.z = Math.PI / 2
      tip.add(bone2)
      const sail2 = mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(sd * 0.36, 0, 0.02), new THREE.Vector3(sd * 0.05, 0, -0.38)]), membrane)
      sail2.geometry.computeVertexNormals()
      tip.add(sail2)
      tip.add(mesh(cone(0.015, 0.06, 4), horn, sd * 0.37, 0, 0).rotateZ(-sd * Math.PI / 2))
      w.add(tip)
      body.add(w)
      wings.push(w)
      wingTips.push(tip)
    }
  }
  g.scale.setScalar(opts.scale)
  return {
    group: g,
    parts: { body, head, legs, wings, tentacles: [], tail, muzzle, knees, kneeSign, neck, jaw, tailSegs, wingTips },
    height: 0.95 * opts.scale,
  }
}

/** A hound: four legs, a long snout, glowing eyes. */
export function buildHound(mats: MaterialBag, color: number, scale: number, eyes = 0xffb02e): Beast {
  const g = new THREE.Group()
  const body = new THREE.Group()
  g.add(body)
  const fur = mats.get(color)
  const dark = mats.get(shade(color, -0.3))
  const torso = mesh(ball(0.2, 1), fur, 0, 0.36, 0)
  torso.scale.set(0.9, 0.85, 1.6)
  body.add(torso)
  const legs: THREE.Group[] = []
  const knees: THREE.Group[] = []
  const kneeSign: number[] = []
  for (const [x, z] of [
    [-0.1, 0.2],
    [0.1, -0.2],
    [0.1, 0.2],
    [-0.1, -0.2],
  ]) {
    const leg = pivot(x, 0.32, z)
    leg.add(mesh(box(0.07, 0.17, 0.08), fur, 0, -0.08, 0))
    const knee = pivot(0, -0.16, 0)
    knee.add(mesh(box(0.05, 0.15, 0.05), fur, 0, -0.07, 0))
    knee.add(mesh(box(0.06, 0.03, 0.08), dark, 0, -0.15, 0.02))
    leg.add(knee)
    body.add(leg)
    legs.push(leg)
    knees.push(knee)
    kneeSign.push(z > 0 ? 1 : -1)
  }
  const neck = pivot(0, 0.42, 0.24)
  neck.userData.rest = 0
  body.add(neck)
  const head = pivot(0, 0.08, 0.06)
  head.userData.rest = 0
  head.add(mesh(box(0.17, 0.14, 0.18), fur, 0, 0.01, 0))
  head.add(mesh(box(0.1, 0.06, 0.16), fur, 0, 0.0, 0.15))
  const eye = mats.get(eyes, 1.3)
  for (const s of [-1, 1]) {
    head.add(mesh(ball(0.02, 0), eye, s * 0.06, 0.04, 0.09))
    head.add(mesh(cone(0.035, 0.1, 4), fur, s * 0.06, 0.12, -0.03))
  }
  const jaw = pivot(0, -0.04, 0.06)
  jaw.add(mesh(box(0.09, 0.03, 0.16), dark, 0, -0.01, 0.09))
  head.add(jaw)
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, -0.03, 0.25)
  head.add(muzzle)
  neck.add(head)
  const tail = pivot(0, 0.42, -0.3)
  const tailSegs: THREE.Group[] = []
  let parent: THREE.Object3D = tail
  for (let k = 0; k < 2; k++) {
    const s = pivot(0, k === 0 ? 0 : 0.15, 0)
    s.add(mesh(cone(0.04 - k * 0.012, 0.17, 5), fur, 0, 0.08, 0))
    s.rotation.x = k === 0 ? -0.8 : -0.3
    parent.add(s)
    tailSegs.push(s)
    parent = s
  }
  body.add(tail)
  g.scale.setScalar(scale)
  return {
    group: g,
    parts: { body, head, legs, wings: [], tentacles: [], tail, muzzle, knees, kneeSign, neck: [neck], jaw, tailSegs },
    height: 0.65 * scale,
  }
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
  const tentacleSegs: THREE.Group[][] = []
  const count = opts.tentacles ?? 6
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2
    const t = pivot(Math.cos(a) * 0.18, 0.55, Math.sin(a) * 0.18)
    let seg: THREE.Object3D = t
    const segs: THREE.Group[] = []
    for (let j = 0; j < 4; j++) {
      const s = pivot(0, j === 0 ? 0 : -0.13, 0)
      s.add(mesh(cyl(0.05 - j * 0.01, 0.04 - j * 0.009, 0.15, 5), j % 2 ? dark : flesh, 0, -0.07, 0))
      seg.add(s)
      segs.push(s)
      seg = s
    }
    tentacleSegs.push(segs)
    t.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)
    body.add(t)
    tentacles.push(t)
  }
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.05, 0.35)
  head.add(muzzle)
  g.scale.setScalar(opts.scale)
  return { group: g, parts: { body, head, legs: [], wings: [], tentacles, tail: null, muzzle, tentacleSegs }, height: 1.15 * opts.scale }
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
