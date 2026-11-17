import * as THREE from 'three'
import { MaterialBag, ball, box, cone, cyl, mesh, pivot, shade, taper } from './kit'

// One parametric humanoid that every person-shaped figure is built from: party members of
// every race and class, goblins, bandits, skeletons, cultists, giants, angels. Built facing +z,
// about 1 unit tall at scale 1, feet at y = 0. Limbs hang from pivots so the battle view can
// walk, swing and fall them.

export type Weapon =
  | 'sword'
  | 'greatsword'
  | 'axe'
  | 'mace'
  | 'hammer'
  | 'dagger'
  | 'spear'
  | 'scythe'
  | 'club'
  | 'bow'
  | 'crossbow'
  | 'staff'
  | 'orbstaff'
  | 'leafstaff'
  | 'holystaff'
  | 'book'
  | 'shield'
  | 'kite'
  | 'tower'
  | 'wrench'

export interface HumanoidLook {
  scale?: number
  /** Shoulder/hip width multiplier (dwarves and orcs are broad, elves slim). */
  width?: number
  /** Head size multiplier (gnomes and halflings have big heads). */
  headSize?: number
  skin: number
  hair?: number | null
  hairStyle?: 'short' | 'long' | 'ponytail' | 'mohawk' | 'bun' | 'none'
  beard?: number | null
  head?: 'round' | 'snout' | 'skull' | 'box' | 'goblin'
  ears?: 'round' | 'pointy' | 'long'
  horns?: number | null
  tusks?: boolean
  tail?: number | null
  eyes?: number
  eyeGlow?: number
  shirt: number
  pants: number
  boots: number
  /** A long robe or skirt over the legs. */
  robe?: number | null
  /** Plate armour (chest, pauldrons, greaves) in this metal colour. */
  armor?: number | null
  /** Armour trim that glows (high tiers). */
  trim?: number | null
  helmet?: 'cap' | 'full' | 'horned' | 'crown' | 'hood' | 'circlet' | 'antlers' | 'mitre' | null
  helmetColor?: number
  cape?: number | null
  wings?: 'feather' | 'bat' | null
  wingColor?: number
  halo?: number | null
  right?: Weapon | null
  left?: Weapon | null
  /** Metal of the weapons. */
  steel?: number
  /** Colour of magic (staff orbs, bolts). */
  magic?: number
  /** Skeletons: thin bones instead of limbs with flesh. */
  bony?: boolean
}

/** The movable bits of a face: eyes blink and squint, brows frown or lift, the mouth opens. */
export interface Face {
  eyes: THREE.Mesh[]
  /** Glowing eyes (undead, constructs, demons) don't blink. */
  blinks: boolean
  /** [left, right]; each a pivot that tilts at its middle. */
  brows: THREE.Group[]
  browY: number
  /** A dark slit that opens by stretching tall. */
  mouth: THREE.Mesh | null
  /** Skulls: the lower jaw drops instead. */
  jaw: THREE.Group | null
}

export interface Parts {
  /** Hips and legs: the whole figure stands on this. */
  body: THREE.Group
  /** The waist joint: turn or bend it to twist and lean the upper body. */
  spine: THREE.Group
  /** Everything above the waist, in the same coordinates as `body` (attach chest pieces here). */
  upper: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  /** Forearm pivots [left, right] and shin pivots [left, right]: bend them to flex. */
  elbows: THREE.Group[]
  knees: THREE.Group[]
  head: THREE.Group
  face: Face | null
  /** Cape from the shoulders: [upper half, lower half], each hanging from the one before. */
  cape: THREE.Group[]
  /** Long hair or a ponytail, root first, swinging behind the head. */
  hair: THREE.Group[]
  /** Where projectiles and spells leave from (a hand or staff tip). */
  muzzle: THREE.Object3D
  tail?: THREE.Group
  wingL?: THREE.Group
  wingR?: THREE.Group
}

/** Height of the waist joint. */
export const WAIST = 0.45

export function buildHumanoid(look: HumanoidLook, mats: MaterialBag): { group: THREE.Group; parts: Parts; height: number } {
  const S = look.scale ?? 1
  const W = look.width ?? 1
  const HS = look.headSize ?? 1
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  // The upper body hangs from a joint at the waist, so it can twist into a swing, lean into a
  // spell or slump when hurt while the legs stay planted. `upper` cancels the joint's height so
  // everything on it is placed in plain body coordinates.
  const spine = pivot(0, WAIST, 0)
  body.add(spine)
  const upper = pivot(0, -WAIST, 0)
  spine.add(upper)

  const skin = mats.get(look.skin)
  const shirt = mats.get(look.shirt)
  const pants = mats.get(look.pants)
  const boots = mats.get(look.boots)
  const metal = look.armor != null ? mats.get(look.armor) : null
  const trim = look.trim != null ? mats.get(look.trim, 0.9) : null
  const limb = look.bony ? 0.045 : 0.1

  // Legs.
  const hipY = 0.42
  const legs: THREE.Group[] = []
  const knees: THREE.Group[] = []
  for (const side of [-1, 1]) {
    // Thigh from the hip, shin from the knee.
    const leg = pivot(side * 0.075 * W, hipY, 0)
    leg.add(mesh(box(limb, 0.17, limb * 1.1), look.bony ? skin : pants, 0, -0.08, 0))
    const knee = pivot(0, -0.16, 0)
    knee.add(mesh(box(limb * 0.95, 0.16, limb * 1.05), look.bony ? skin : pants, 0, -0.075, 0))
    knee.add(mesh(box(limb * 1.15, 0.13, limb * 1.6), look.bony ? skin : boots, 0, -0.195, 0.02))
    if (metal && !look.robe) knee.add(mesh(box(limb * 1.2, 0.14, limb * 1.25), metal, 0, -0.06, 0.01))
    leg.add(knee)
    body.add(leg)
    legs.push(leg)
    knees.push(knee)
  }

  // Torso: a chest broad at the shoulders narrowing to the belt.
  if (look.bony) {
    upper.add(mesh(box(0.05, 0.36, 0.05), skin, 0, 0.6, -0.02))
    for (let k = 0; k < 3; k++) upper.add(mesh(box((0.24 - (2 - k) * 0.02) * W, 0.035, 0.14), skin, 0, 0.66 + k * 0.05, 0))
    body.add(mesh(box(0.2 * W, 0.06, 0.1), skin, 0, 0.46, 0))
  } else {
    upper.add(mesh(taper(0.32 * W, 0.25 * W, 0.36, 0.19, 0.16), shirt, 0, 0.6, 0))
    body.add(mesh(box(0.27 * W, 0.06, 0.18), boots, 0, 0.45, 0)) // belt
    body.add(mesh(box(0.06, 0.05, 0.02), mats.get(0xc9a04a), 0, 0.45, 0.092)) // buckle
  }
  if (look.robe != null) {
    const robe = mats.get(look.robe)
    body.add(mesh(cyl(0.14 * W, 0.25 * W, 0.46, 8), robe, 0, 0.23, 0))
    upper.add(mesh(taper(0.34 * W, 0.27 * W, 0.34, 0.2, 0.19), robe, 0, 0.62, 0))
  }
  if (metal) {
    upper.add(mesh(taper(0.35 * W, 0.28 * W, 0.24, 0.215, 0.19), metal, 0, 0.65, 0))
    for (const side of [-1, 1]) upper.add(mesh(ball(0.085, 0), metal, side * 0.19 * W, 0.77, 0))
    if (trim) upper.add(mesh(box(0.06, 0.2, 0.012), trim, 0, 0.65, 0.11))
  }
  // A cape in two halves from the shoulders, so it can stream out behind on the move.
  const capeSegs: THREE.Group[] = []
  if (look.cape != null) {
    const cm = mats.get(look.cape)
    cm.side = THREE.DoubleSide
    const top = pivot(0, 0.77, -0.105)
    top.add(mesh(box(0.3 * W, 0.26, 0.022), cm, 0, -0.13, 0))
    const low = pivot(0, -0.25, 0)
    low.add(mesh(taper(0.31 * W, 0.34 * W, 0.26, 0.022), cm, 0, -0.13, 0))
    top.add(low)
    upper.add(top)
    capeSegs.push(top, low)
  }

  // Arms.
  const arms: THREE.Group[] = []
  const elbows: THREE.Group[] = []
  const sleeve = look.bony ? skin : look.robe != null ? mats.get(look.robe) : shirt
  for (const side of [-1, 1]) {
    // Upper arm from the shoulder, forearm and hand from the elbow. Shoulders turn
    // yaw-then-pitch so an arm can be raised forward and then swung across.
    const arm = pivot(side * 0.2 * W, 0.75, 0)
    arm.rotation.order = 'YXZ'
    arm.add(mesh(box(limb * 0.85, 0.17, limb * 0.85), sleeve, 0, -0.08, 0))
    if (metal) arm.add(mesh(box(limb * 1.05, 0.08, limb * 1.05), metal, 0, -0.04, 0))
    const elbow = pivot(0, -0.16, 0)
    elbow.add(mesh(box(limb * 0.8, 0.16, limb * 0.8), sleeve, 0, -0.075, 0))
    if (metal && !look.bony) elbow.add(mesh(box(limb * 0.95, 0.07, limb * 0.95), metal, 0, -0.12, 0)) // gauntlet cuff
    elbow.add(mesh(ball(0.05, 0), skin, 0, -0.17, 0))
    arm.add(elbow)
    upper.add(arm)
    arms.push(arm)
    elbows.push(elbow)
  }
  const [armL, armR] = arms

  // Head.
  const head = pivot(0, 0.79, 0)
  head.rotation.order = 'YXZ' // turn to look, then nod
  upper.add(head)
  const hr = 0.14 * HS
  const shape = look.head ?? 'round'
  const closedHelm = look.helmet === 'full' || look.helmet === 'horned'
  let jaw: THREE.Group | null = null
  if (shape === 'box') head.add(mesh(box(hr * 1.6, hr * 1.5, hr * 1.5), skin, 0, hr, 0))
  else if (shape === 'skull') {
    head.add(mesh(ball(hr * 0.95, 1), skin, 0, hr * 1.05, 0))
    // The lower jaw hinges at the back so it can drop open (laughing, shrieking).
    jaw = pivot(0, hr * 0.55, -hr * 0.2)
    jaw.add(mesh(box(hr * 1.05, hr * 0.32, hr * 0.85), skin, 0, -hr * 0.12, hr * 0.32))
    head.add(jaw)
  } else head.add(mesh(ball(hr, 1), skin, 0, hr, 0))
  if (shape === 'snout') head.add(mesh(box(hr * 0.9, hr * 0.7, hr * 1.1), skin, 0, hr * 0.75, hr * 0.85))
  if (shape === 'goblin') head.add(mesh(cone(hr * 0.25, hr * 0.7, 4), skin, 0, hr * 0.95, hr * 1.1).rotateX(Math.PI / 2))
  // Eyes.
  const eyeMat = look.eyeGlow ? mats.get(look.eyes ?? 0xffffff, look.eyeGlow) : mats.get(look.eyes ?? 0x1b1424)
  const eyeY = shape === 'snout' ? hr * 1.15 : hr * 1.08
  const eyes: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    const eye = mesh(ball(shape === 'skull' ? hr * 0.22 : hr * 0.13, 0), eyeMat, side * hr * 0.4, eyeY, hr * 0.86)
    eyes.push(eye)
    head.add(eye)
  }
  // Brows and a mouth, on faces that can pull expressions (not skulls, boxes or closed helms).
  const brows: THREE.Group[] = []
  let mouth: THREE.Mesh | null = null
  const browY = eyeY + hr * 0.26
  if ((shape === 'round' || shape === 'snout' || shape === 'goblin') && !closedHelm) {
    const bm = mats.get(look.hair != null && look.hairStyle !== 'none' ? shade(look.hair, -0.2) : shade(look.skin, -0.45))
    for (const side of [-1, 1]) {
      const b = pivot(side * hr * 0.42, browY, hr * 0.84)
      b.add(mesh(box(hr * 0.46, hr * 0.1, hr * 0.14), bm))
      head.add(b)
      brows.push(b)
    }
    const mm = mats.get(0x2a1418)
    if (shape === 'snout') mouth = mesh(box(hr * 0.62, hr * 0.06, hr * 0.12), mm, 0, hr * 0.52, hr * 1.38)
    else mouth = mesh(box(hr * (shape === 'goblin' ? 0.62 : 0.4), hr * 0.06, hr * 0.16), mm, 0, hr * 0.56, hr * 0.86)
    head.add(mouth)
  }
  // Ears.
  if (look.ears === 'pointy' || look.ears === 'long') {
    const len = look.ears === 'long' ? hr * 1.4 : hr * 0.8
    for (const side of [-1, 1]) {
      const ear = mesh(cone(hr * 0.2, len, 4), skin, side * hr * 1.0, hr * 1.1, 0)
      ear.rotation.z = -side * 1.2
      head.add(ear)
    }
  }
  // Hair (hidden under closed helmets) and beard.
  const hairSegs: THREE.Group[] = []
  if (look.hair != null && look.hairStyle !== 'none' && !closedHelm) {
    const hair = mats.get(look.hair)
    let style = look.hairStyle ?? 'short'
    // A ponytail would poke through the back of a cowl: it's tucked in.
    if (style === 'ponytail' && look.helmet === 'hood') style = 'long'
    if (style === 'mohawk') head.add(mesh(box(hr * 0.35, hr * 0.6, hr * 1.8), hair, 0, hr * 2.0, -hr * 0.1))
    else {
      const cap = mesh(new THREE.SphereGeometry(hr * 1.08, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, hr * 1.05, -hr * 0.08)
      head.add(cap)
      if (style === 'long') {
        // A fall of hair down the back, swinging from the crown.
        const fall = pivot(0, hr * 1.25, -hr * 0.7)
        fall.add(mesh(taper(hr * 1.9, hr * 1.7, hr * 1.7, hr * 0.5, hr * 0.35), hair, 0, -hr * 0.85, -hr * 0.05))
        fall.userData.rest = 0.05
        head.add(fall)
        hairSegs.push(fall)
      }
      if (style === 'ponytail') {
        head.add(mesh(ball(hr * 0.2, 0), mats.get(shade(look.hair, -0.35)), 0, hr * 1.55, -hr * 0.98))
        const a = pivot(0, hr * 1.5, -hr * 1.05)
        a.add(mesh(taper(hr * 0.42, hr * 0.32, hr * 0.9, hr * 0.36), hair, 0, -hr * 0.42, 0))
        const b = pivot(0, -hr * 0.85, 0)
        b.add(mesh(cone(hr * 0.17, hr * 0.8, 5).rotateX(Math.PI), hair, 0, -hr * 0.35, 0))
        a.add(b)
        a.userData.rest = 0.55
        b.userData.rest = -0.25
        head.add(a)
        hairSegs.push(a, b)
      }
      if (style === 'bun') head.add(mesh(ball(hr * 0.5, 0), hair, 0, hr * 1.9, -hr * 0.7))
    }
  }
  if (look.beard != null) head.add(mesh(cone(hr * 0.75, hr * 1.4, 6), mats.get(look.beard), 0, hr * 0.1, hr * 0.75).rotateX(Math.PI))
  if (look.horns != null) {
    const horn = mats.get(look.horns)
    for (const side of [-1, 1]) {
      const h = mesh(cone(hr * 0.22, hr * 1.1, 5), horn, side * hr * 0.6, hr * 2.0, -hr * 0.1)
      h.rotation.z = -side * 0.5
      head.add(h)
    }
  }
  if (look.tusks) {
    const tooth = mats.get(0xf3ecd8)
    for (const side of [-1, 1]) head.add(mesh(cone(hr * 0.1, hr * 0.4, 4), tooth, side * hr * 0.35, hr * 0.55, hr * 0.85))
  }
  // Headgear.
  const hc = look.helmetColor ?? look.armor ?? 0x6b6f78
  if (look.helmet) {
    const hm = mats.get(hc)
    switch (look.helmet) {
      case 'cap':
        head.add(mesh(new THREE.SphereGeometry(hr * 1.12, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, 0, hr * 1.1, 0))
        break
      case 'full':
      case 'horned':
        head.add(mesh(cyl(hr * 1.05, hr * 1.12, hr * 1.9, 8), hm, 0, hr * 1.05, 0))
        head.add(mesh(box(hr * 1.2, hr * 0.14, 0.02), mats.get(0x111111), 0, hr * 1.15, hr * 1.1))
        // A raised ridge over the crown.
        head.add(mesh(box(hr * 0.16, hr * 0.22, hr * 2.0), mats.get(shade(hc, -0.15)), 0, hr * 2.0, 0))
        if (look.helmet === 'horned')
          for (const side of [-1, 1]) {
            const h = mesh(cone(hr * 0.25, hr * 1.2, 5), mats.get(0xeee6d0), side * hr * 1.1, hr * 2.0, 0)
            h.rotation.z = -side * 0.8
            head.add(h)
          }
        break
      case 'crown': {
        const gold = mats.get(look.helmetColor ?? 0xf2c14e, 0.3)
        head.add(mesh(cyl(hr * 0.85, hr * 0.85, hr * 0.32, 8), gold, 0, hr * 1.95, 0))
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2
          head.add(mesh(cone(hr * 0.13, hr * 0.32, 4), gold, Math.sin(a) * hr * 0.78, hr * 2.25, Math.cos(a) * hr * 0.78))
        }
        break
      }
      case 'circlet':
        head.add(mesh(cyl(hr * 1.06, hr * 1.06, hr * 0.18, 10), mats.get(look.helmetColor ?? 0xf2c14e, 0.4), 0, hr * 1.45, 0))
        break
      case 'hood': {
        // A cowl: a shell just bigger than the head, covering the top, sides and back down to
        // the jaw but open over the face, with a little point drooping at the back and a fold
        // down onto the shoulders behind.
        hm.side = THREE.DoubleSide
        const gap = 1.9 // radians of opening across the face (+z)
        const brow = Math.PI * 0.36 // closed all round above this: the opening starts at the hairline
        head.add(mesh(new THREE.SphereGeometry(hr * 1.2, 12, 4, 0, Math.PI * 2, 0, brow), hm, 0, hr * 1.02, -hr * 0.05))
        head.add(
          mesh(
            new THREE.SphereGeometry(hr * 1.2, 12, 4, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, brow, Math.PI * 0.68 - brow),
            hm,
            0,
            hr * 1.02,
            -hr * 0.05,
          ),
        )
        const point = mesh(cone(hr * 0.42, hr * 0.9, 6), hm, 0, hr * 2.0, -hr * 0.75)
        point.rotation.x = -1.0
        head.add(point)
        head.add(mesh(box(hr * 1.9, hr * 0.9, hr * 0.5), hm, 0, hr * 0.15, -hr * 0.85))
        break
      }
      case 'mitre':
        head.add(mesh(cone(hr * 0.75, hr * 1.9, 4), hm, 0, hr * 2.6, 0))
        break
      case 'antlers': {
        const wood = mats.get(look.helmetColor ?? 0x6b4a2b)
        for (const side of [-1, 1]) {
          const a = mesh(cyl(hr * 0.06, hr * 0.1, hr * 1.4, 4), wood, side * hr * 0.6, hr * 2.3, 0)
          a.rotation.z = -side * 0.5
          head.add(a)
          const b = mesh(cyl(hr * 0.05, hr * 0.07, hr * 0.7, 4), wood, side * hr * 1.0, hr * 2.6, 0)
          b.rotation.z = side * 0.4
          head.add(b)
        }
        break
      }
    }
  }
  if (look.halo != null) {
    const halo = mesh(new THREE.TorusGeometry(hr * 0.9, hr * 0.1, 5, 16), mats.get(look.halo, 1.2), 0, hr * 2.7, -hr * 0.2)
    halo.rotation.x = Math.PI / 2
    head.add(halo)
  }

  // Tail and wings.
  let tail: THREE.Group | undefined
  if (look.tail != null) {
    tail = pivot(0, 0.44, -0.08)
    const t = mesh(cyl(0.015, 0.035, 0.42, 4), mats.get(look.tail), 0, -0.05, -0.2)
    t.rotation.x = -1.1
    tail.add(t)
    body.add(tail)
  }
  let wingL: THREE.Group | undefined
  let wingR: THREE.Group | undefined
  if (look.wings) {
    const wm = mats.get(look.wingColor ?? 0xffffff, look.wings === 'feather' ? 0.25 : 0)
    const ws: THREE.Group[] = []
    for (const side of [-1, 1]) {
      const w = pivot(side * 0.08, 0.7, -0.1)
      const shapeGeo =
        look.wings === 'feather' ? box(0.5, 0.18, 0.03) : new THREE.ConeGeometry(0.22, 0.55, 3).rotateZ(Math.PI / 2)
      const wing = mesh(shapeGeo, wm, side * 0.27, 0.06, 0)
      wing.rotation.z = side * 0.35
      w.add(wing)
      if (look.wings === 'feather') {
        const lower = mesh(box(0.38, 0.14, 0.03), wm, side * 0.22, -0.08, 0)
        lower.rotation.z = side * 0.6
        w.add(lower)
      }
      w.rotation.y = side * 0.5
      upper.add(w)
      ws.push(w)
    }
    ;[wingL, wingR] = ws
  }

  // Hands and what they hold.
  const steel = look.steel ?? 0xb8bec8
  const magic = look.magic ?? 0x9ad8ff
  let muzzle: THREE.Object3D = armR
  const holdR = pivot(0, -0.18, 0.02)
  elbows[1].add(holdR)
  const holdL = pivot(0, -0.18, 0.02)
  elbows[0].add(holdL)
  if (look.right) muzzle = attachWeapon(look.right, holdR, mats, steel, magic, look.trim ?? null) ?? holdR
  else muzzle = holdR
  if (look.left) {
    const m = attachWeapon(look.left, holdL, mats, steel, magic, look.trim ?? null)
    if (look.left === 'bow' || look.left === 'crossbow') muzzle = m ?? holdL
  }

  const face: Face | null =
    shape === 'box' ? null : { eyes, blinks: !look.eyeGlow, brows, browY, mouth, jaw }

  root.scale.setScalar(S)
  return {
    group: root,
    parts: { body, spine, upper, legL: legs[0], legR: legs[1], armL, armR, elbows, knees, head, face, cape: capeSegs, hair: hairSegs, muzzle, tail, wingL, wingR },
    height: (0.79 + hr * 2 + 0.05) * S,
  }
}

/** Put a weapon in a hand; returns where projectiles and spells leave from, if it has such a spot. */
function attachWeapon(
  w: Weapon,
  hand: THREE.Group,
  mats: MaterialBag,
  steelColor: number,
  magic: number,
  trimColor: number | null,
): THREE.Object3D | null {
  const steel = mats.get(steelColor)
  const wood = mats.get(0x6b4a2b)
  const grip = mats.get(0x3a2a1e)
  const g = new THREE.Group()
  hand.add(g)
  // Blades, hafts and clubs run on along the forearm, tipped forward: pointing ahead at rest
  // (forearm angled down-forward), up and back in a wind-up, forward-down in a chop.
  g.rotation.x = Math.PI - 0.6
  const tip = new THREE.Object3D()
  const glow = trimColor != null ? mats.get(trimColor, 0.9) : null
  switch (w) {
    case 'sword':
      g.add(mesh(box(0.03, 0.1, 0.03), grip, 0, 0.0, 0))
      g.add(mesh(box(0.12, 0.025, 0.03), steel, 0, 0.06, 0))
      g.add(mesh(box(0.045, 0.38, 0.015), glow ?? steel, 0, 0.26, 0))
      break
    case 'greatsword':
      g.add(mesh(box(0.035, 0.16, 0.035), grip, 0, 0.0, 0))
      g.add(mesh(box(0.18, 0.03, 0.04), steel, 0, 0.09, 0))
      g.add(mesh(box(0.07, 0.62, 0.02), glow ?? steel, 0, 0.42, 0))
      break
    case 'dagger':
      g.add(mesh(box(0.025, 0.07, 0.025), grip, 0, 0, 0))
      g.add(mesh(cone(0.03, 0.2, 4), glow ?? steel, 0, 0.13, 0))
      break
    case 'axe':
      g.add(mesh(cyl(0.018, 0.018, 0.45, 5), wood, 0, 0.15, 0))
      g.add(mesh(box(0.16, 0.13, 0.025), glow ?? steel, 0.07, 0.33, 0))
      break
    case 'mace':
      g.add(mesh(cyl(0.018, 0.018, 0.34, 5), grip, 0, 0.1, 0))
      g.add(mesh(ball(0.07, 0), glow ?? steel, 0, 0.3, 0))
      break
    case 'hammer':
      g.add(mesh(cyl(0.02, 0.02, 0.5, 5), wood, 0, 0.18, 0))
      g.add(mesh(box(0.22, 0.12, 0.12), glow ?? steel, 0, 0.42, 0))
      break
    case 'club':
      g.add(mesh(cyl(0.07, 0.03, 0.5, 6), wood, 0, 0.2, 0))
      break
    case 'spear':
      g.rotation.x = Math.PI / 2 // long polearms stand upright like staves
      g.add(mesh(cyl(0.015, 0.015, 0.9, 5), wood, 0, 0.25, 0))
      g.add(mesh(cone(0.04, 0.16, 4), glow ?? steel, 0, 0.78, 0))
      break
    case 'scythe': {
      g.rotation.x = Math.PI / 2
      g.add(mesh(cyl(0.016, 0.016, 0.9, 5), mats.get(0x2a2230), 0, 0.25, 0))
      // The blade reaches forward from the top of the shaft (+z here is ahead of the holder)
      // and curves down.
      const blade = mesh(box(0.015, 0.05, 0.36), glow ?? steel, 0, 0.66, 0.16)
      blade.rotation.x = 0.35
      g.add(blade)
      break
    }
    case 'wrench':
      g.add(mesh(box(0.03, 0.34, 0.03), steel, 0, 0.12, 0))
      g.add(mesh(box(0.11, 0.06, 0.03), steel, 0, 0.3, 0))
      break
    case 'staff':
    case 'orbstaff':
    case 'leafstaff':
    case 'holystaff': {
      // Staves stand upright when the forearm is held out in front (the usual stance).
      g.rotation.x = Math.PI / 2
      g.add(mesh(cyl(0.017, 0.02, 0.95, 5), w === 'holystaff' ? mats.get(0xe8d9a8) : wood, 0, 0.12, 0))
      const top = w === 'leafstaff' ? mats.get(0x5fbf4a) : mats.get(magic, 0.9)
      if (w === 'leafstaff') {
        for (let k = 0; k < 4; k++) {
          const leaf = mesh(cone(0.04, 0.12, 4), top, Math.sin(k * 1.6) * 0.05, 0.6 + k * 0.03, Math.cos(k * 1.6) * 0.05)
          leaf.rotation.z = Math.sin(k * 1.6) * 0.8
          g.add(leaf)
        }
      } else if (w === 'holystaff') {
        g.add(mesh(box(0.2, 0.035, 0.035), mats.get(0xf2c14e, 0.5), 0, 0.52, 0))
        g.add(mesh(ball(0.05, 0), top, 0, 0.64, 0))
      } else g.add(mesh(ball(w === 'orbstaff' ? 0.07 : 0.05, 0), top, 0, 0.62, 0))
      tip.position.set(0, 0.64, 0)
      g.add(tip)
      return tip
    }
    case 'book':
      g.rotation.x = 0.3
      g.add(mesh(box(0.14, 0.04, 0.18), mats.get(0x6a2a3a), 0, 0, 0.05))
      g.add(mesh(box(0.13, 0.042, 0.17), mats.get(0xf3ecd8), 0.005, 0, 0.05))
      tip.position.set(0, 0.06, 0.05)
      g.add(tip)
      return tip
    case 'bow': {
      // Held in the fist with the limbs running up and down (the hand's ±z when the forearm
      // points forward), bending back toward the archer (+y), the string behind them.
      g.rotation.set(0, 0, 0)
      g.add(mesh(box(0.03, 0.03, 0.09), grip, 0, 0, 0))
      for (const s of [-1, 1]) {
        const limb = mesh(box(0.022, 0.022, 0.3), wood, 0, 0.035, s * 0.18)
        limb.rotation.x = -s * 0.28 // tips curve back toward the archer
        g.add(limb)
      }
      g.add(mesh(box(0.006, 0.006, 0.62), mats.get(0xe9e3d0), 0, 0.09, 0))
      tip.position.set(0, -0.06, 0)
      g.add(tip)
      return tip
    }
    case 'crossbow':
      // The stock runs along the forearm and out past the fist.
      g.rotation.set(0, 0, 0)
      g.add(mesh(box(0.05, 0.34, 0.05), wood, 0, -0.08, 0))
      g.add(mesh(box(0.36, 0.03, 0.025), steel, 0, -0.22, 0))
      tip.position.set(0, -0.26, 0)
      g.add(tip)
      return tip
    case 'shield':
      // Shields face out from a forearm bent across the body (see the stance in figures.ts).
      g.rotation.set(1.1, 0, 0)
      g.add(mesh(cyl(0.17, 0.17, 0.035, 10).rotateX(Math.PI / 2), mats.get(shade(steelColor, -0.25)), 0, 0.02, 0.07))
      g.add(mesh(ball(0.045, 0), glow ?? steel, 0, 0.02, 0.095))
      break
    case 'kite':
      g.rotation.set(1.1, 0, 0)
      g.add(mesh(box(0.26, 0.3, 0.035), steel, 0, 0.05, 0.07))
      g.add(mesh(cone(0.13, 0.16, 4).rotateZ(Math.PI), steel, 0, -0.17, 0.07))
      if (glow) g.add(mesh(box(0.05, 0.3, 0.01), glow, 0, 0.05, 0.095))
      break
    case 'tower':
      g.rotation.set(1.1, 0, 0)
      g.add(mesh(box(0.32, 0.52, 0.04), steel, 0, 0.08, 0.07))
      g.add(mesh(box(0.36, 0.05, 0.05), glow ?? mats.get(shade(steelColor, 0.3)), 0, 0.32, 0.07))
      break
  }
  return null
}
