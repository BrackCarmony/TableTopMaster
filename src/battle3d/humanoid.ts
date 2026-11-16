import * as THREE from 'three'
import { MaterialBag, ball, box, cone, cyl, mesh, pivot, shade } from './kit'

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
  hairStyle?: 'short' | 'long' | 'mohawk' | 'bun' | 'none'
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

export interface Parts {
  body: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  head: THREE.Group
  /** Where projectiles and spells leave from (a hand or staff tip). */
  muzzle: THREE.Object3D
  tail?: THREE.Group
  wingL?: THREE.Group
  wingR?: THREE.Group
}

export function buildHumanoid(look: HumanoidLook, mats: MaterialBag): { group: THREE.Group; parts: Parts; height: number } {
  const S = look.scale ?? 1
  const W = look.width ?? 1
  const HS = look.headSize ?? 1
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

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
  for (const side of [-1, 1]) {
    const leg = pivot(side * 0.075 * W, hipY, 0)
    leg.add(mesh(box(limb, 0.3, limb * 1.1), look.bony ? skin : pants, 0, -0.15, 0))
    leg.add(mesh(box(limb * 1.15, 0.13, limb * 1.6), look.bony ? skin : boots, 0, -0.355, 0.02))
    if (metal && !look.robe) leg.add(mesh(box(limb * 1.2, 0.16, limb * 1.25), metal, 0, -0.22, 0.01))
    body.add(leg)
    legs.push(leg)
  }

  // Torso.
  const torso = new THREE.Group()
  body.add(torso)
  if (look.bony) {
    torso.add(mesh(box(0.05, 0.36, 0.05), skin, 0, 0.6, -0.02))
    for (let k = 0; k < 3; k++) torso.add(mesh(box(0.24 * W, 0.035, 0.14), skin, 0, 0.66 + k * 0.05, 0))
    torso.add(mesh(box(0.2 * W, 0.06, 0.1), skin, 0, 0.46, 0))
  } else {
    torso.add(mesh(box(0.3 * W, 0.36, 0.18), shirt, 0, 0.6, 0))
    torso.add(mesh(box(0.31 * W, 0.05, 0.19), boots, 0, 0.45, 0)) // belt
  }
  if (look.robe != null) {
    const robe = mats.get(look.robe)
    torso.add(mesh(cyl(0.14 * W, 0.25 * W, 0.46, 8), robe, 0, 0.23, 0))
    torso.add(mesh(box(0.32 * W, 0.34, 0.2), robe, 0, 0.62, 0))
  }
  if (metal) {
    torso.add(mesh(box(0.33 * W, 0.24, 0.21), metal, 0, 0.65, 0))
    for (const side of [-1, 1]) torso.add(mesh(ball(0.085, 0), metal, side * 0.19 * W, 0.77, 0))
    if (trim) torso.add(mesh(box(0.06, 0.2, 0.012), trim, 0, 0.65, 0.11))
  }
  if (look.cape != null) {
    const cape = mesh(box(0.3 * W, 0.5, 0.025), mats.get(look.cape), 0, 0.53, -0.11)
    cape.rotation.x = 0.12
    torso.add(cape)
  }

  // Arms.
  const arms: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const arm = pivot(side * 0.2 * W, 0.75, 0)
    arm.add(mesh(box(limb * 0.85, 0.32, limb * 0.85), look.bony ? skin : look.robe != null ? mats.get(look.robe) : shirt, 0, -0.15, 0))
    arm.add(mesh(ball(0.05, 0), skin, 0, -0.33, 0))
    body.add(arms.length ? arm : arm)
    arms.push(arm)
  }
  const [armL, armR] = arms

  // Head.
  const head = pivot(0, 0.79, 0)
  body.add(head)
  const hr = 0.14 * HS
  const shape = look.head ?? 'round'
  if (shape === 'box') head.add(mesh(box(hr * 1.6, hr * 1.5, hr * 1.5), skin, 0, hr, 0))
  else if (shape === 'skull') {
    head.add(mesh(ball(hr * 0.95, 1), skin, 0, hr, 0))
    head.add(mesh(box(hr * 1.1, hr * 0.5, hr * 0.9), skin, 0, hr * 0.35, 0.03))
  } else head.add(mesh(ball(hr, 1), skin, 0, hr, 0))
  if (shape === 'snout') head.add(mesh(box(hr * 0.9, hr * 0.7, hr * 1.1), skin, 0, hr * 0.75, hr * 0.85))
  if (shape === 'goblin') head.add(mesh(cone(hr * 0.25, hr * 0.7, 4), skin, 0, hr * 0.95, hr * 1.1).rotateX(Math.PI / 2))
  // Eyes.
  const eyeMat = look.eyeGlow ? mats.get(look.eyes ?? 0xffffff, look.eyeGlow) : mats.get(look.eyes ?? 0x1b1424)
  const eyeY = shape === 'snout' ? hr * 1.15 : hr * 1.08
  for (const side of [-1, 1])
    head.add(mesh(ball(shape === 'skull' ? hr * 0.22 : hr * 0.13, 0), eyeMat, side * hr * 0.4, eyeY, hr * 0.86))
  // Ears.
  if (look.ears === 'pointy' || look.ears === 'long') {
    const len = look.ears === 'long' ? hr * 1.4 : hr * 0.8
    for (const side of [-1, 1]) {
      const ear = mesh(cone(hr * 0.2, len, 4), skin, side * hr * 1.0, hr * 1.1, 0)
      ear.rotation.z = -side * 1.2
      head.add(ear)
    }
  }
  // Hair and beard.
  if (look.hair != null && look.hairStyle !== 'none') {
    const hair = mats.get(look.hair)
    const style = look.hairStyle ?? 'short'
    if (style === 'mohawk') head.add(mesh(box(hr * 0.35, hr * 0.6, hr * 1.8), hair, 0, hr * 2.0, -hr * 0.1))
    else {
      const cap = mesh(new THREE.SphereGeometry(hr * 1.08, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, hr * 1.05, -hr * 0.08)
      head.add(cap)
      if (style === 'long') head.add(mesh(box(hr * 1.9, hr * 1.7, hr * 0.5), hair, 0, hr * 0.4, -hr * 0.75))
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
        if (look.helmet === 'horned')
          for (const side of [-1, 1]) {
            const h = mesh(cone(hr * 0.25, hr * 1.2, 5), mats.get(0xeee6d0), side * hr * 1.1, hr * 2.0, 0)
            h.rotation.z = -side * 0.8
            head.add(h)
          }
        break
      case 'crown': {
        head.add(mesh(cyl(hr * 0.85, hr * 0.85, hr * 0.45, 8), mats.get(look.helmetColor ?? 0xf2c14e, 0.3), 0, hr * 2.0, 0))
        break
      }
      case 'circlet':
        head.add(mesh(cyl(hr * 1.06, hr * 1.06, hr * 0.18, 10), mats.get(look.helmetColor ?? 0xf2c14e, 0.4), 0, hr * 1.45, 0))
        break
      case 'hood':
        head.add(mesh(cone(hr * 1.35, hr * 2.6, 7), hm, 0, hr * 1.6, -hr * 0.2))
        break
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
      body.add(w)
      ws.push(w)
    }
    ;[wingL, wingR] = ws
  }

  // Hands and what they hold.
  const steel = look.steel ?? 0xb8bec8
  const magic = look.magic ?? 0x9ad8ff
  let muzzle: THREE.Object3D = armR
  const holdR = pivot(0, -0.34, 0.02)
  armR.add(holdR)
  const holdL = pivot(0, -0.34, 0.02)
  armL.add(holdL)
  if (look.right) muzzle = attachWeapon(look.right, holdR, mats, steel, magic, look.trim ?? null) ?? holdR
  else muzzle = holdR
  if (look.left) {
    const m = attachWeapon(look.left, holdL, mats, steel, magic, look.trim ?? null)
    if (look.left === 'bow' || look.left === 'crossbow') muzzle = m ?? holdL
  }

  root.scale.setScalar(S)
  return {
    group: root,
    parts: { body, legL: legs[0], legR: legs[1], armL, armR, head, muzzle, tail, wingL, wingR },
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
  // Held forward and up, like a blade raised in front.
  g.rotation.x = Math.PI / 2 - 0.35
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
      g.add(mesh(cyl(0.015, 0.015, 0.9, 5), wood, 0, 0.25, 0))
      g.add(mesh(cone(0.04, 0.16, 4), glow ?? steel, 0, 0.78, 0))
      break
    case 'scythe': {
      g.add(mesh(cyl(0.016, 0.016, 0.9, 5), mats.get(0x2a2230), 0, 0.25, 0))
      const blade = mesh(box(0.34, 0.05, 0.015), glow ?? steel, -0.15, 0.68, 0)
      blade.rotation.z = -0.3
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
      // Staves stand upright beside the hand.
      g.rotation.x = 0
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
      g.rotation.set(0, 0, 0)
      const curve = new THREE.TorusGeometry(0.3, 0.014, 4, 10, Math.PI * 0.8)
      const bow = mesh(curve, wood, 0, 0, 0)
      bow.rotation.set(0, Math.PI / 2, Math.PI / 2 + Math.PI * 0.1)
      g.add(bow)
      g.add(mesh(box(0.004, 0.55, 0.004), mats.get(0xe9e3d0), 0, 0, -0.12))
      tip.position.set(0, 0, 0.1)
      g.add(tip)
      return tip
    }
    case 'crossbow':
      g.rotation.set(0, 0, 0)
      g.add(mesh(box(0.05, 0.05, 0.32), wood, 0, 0, 0.1))
      g.add(mesh(box(0.34, 0.025, 0.03), steel, 0, 0, 0.22))
      tip.position.set(0, 0, 0.3)
      g.add(tip)
      return tip
    case 'shield':
      g.rotation.set(0, 0, 0)
      g.add(mesh(cyl(0.17, 0.17, 0.035, 10).rotateX(Math.PI / 2), mats.get(shade(steelColor, -0.25)), 0, 0.02, 0.07))
      g.add(mesh(ball(0.045, 0), glow ?? steel, 0, 0.02, 0.095))
      break
    case 'kite':
      g.rotation.set(0, 0, 0)
      g.add(mesh(box(0.26, 0.3, 0.035), steel, 0, 0.05, 0.07))
      g.add(mesh(cone(0.13, 0.16, 4).rotateZ(Math.PI), steel, 0, -0.17, 0.07))
      if (glow) g.add(mesh(box(0.05, 0.3, 0.01), glow, 0, 0.05, 0.095))
      break
    case 'tower':
      g.rotation.set(0, 0, 0)
      g.add(mesh(box(0.32, 0.52, 0.04), steel, 0, 0.08, 0.07))
      g.add(mesh(box(0.36, 0.05, 0.05), glow ?? mats.get(shade(steelColor, 0.3)), 0, 0.32, 0.07))
      break
  }
  return null
}
