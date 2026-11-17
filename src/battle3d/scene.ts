import * as THREE from 'three'
import type { CombatLogEvent, CombatUnit, GridCoord } from '../game/combat/types'
import { computeBoardStateAtStep } from '../game/combat/replay'
import { formatCompact } from '../format'
import { buildFigure, type Figure } from './figures'
import { MaterialBag, seeded } from './kit'
import { settingFor, type Animated, type Setting } from './settings'
import { SIGNATURES, type FxHost } from './signatures'
import { PER_TILE, eventDuration3D } from './timing'

// Plays a battle's combat log as a little 3D diorama: the grid as a tabletop board in the
// module's setting, every unit as a figure, and each log event (move, attack, heal, death...)
// as an animation. Driven by the battle modal: show(step) animates one step forward, or snaps
// straight to any other step (stepping back, skipping to the end).

interface UnitView {
  id: string
  name: string
  /** Added to its position (leaps, being pulled); see signatures.ts. */
  offset: THREE.Vector3
  baseScale: number
  side: 'party' | 'enemy'
  fig: Figure
  cell: GridCoord
  pos: THREE.Vector3
  /** Facing (yaw) it turns toward. */
  yaw: number
  hp: number
  maxHp: number
  alive: boolean
  /** 0 standing .. 1 fallen. */
  fallen: number
  fallSide: number
  label: HTMLDivElement
  bar: HTMLDivElement
  hpText: HTMLSpanElement
  /** Walking right now (legs swing). */
  walking: boolean
  /** Current action pose, if any. */
  pose: Pose | null
  flash: number
  flashColor: THREE.Color
  bob: number
  hopUntil: number
  /** The name plate's size, measured once. */
  labelSize?: { w: number; h: number }
  /** Who it's watching and until when; otherwise the nearest foe (refreshed at foeAt), with a
   * glance around now and then (at nextGlance). */
  watch: UnitView | null
  watchUntil: number
  foe: UnitView | null
  foeAt: number
  nextGlance: number
  /** Where its head is turned (relative to its facing), eased toward the watched unit. */
  lookYaw: number
  lookPitch: number
  /** 0..1, how far into its badly-hurt slump. */
  hurt: number
  nextBlink: number
  /** How open its mouth is, eased. */
  mouth: number
  /** Movement in its own frame (x sideways, z forward), smoothed, for capes and hair. */
  vel: THREE.Vector3
  lastRoot: THREE.Vector3
  /** Which of the victory celebrations it does. */
  cheerStyle: number
}

interface Pose {
  kind: 'swing' | 'shoot' | 'cast' | 'breath' | 'slam' | 'heal' | 'dodge' | 'hit' | 'cheer'
  start: number
  dur: number
  /** Direction to lunge (world, unit length) and how far. */
  dir: THREE.Vector3
  reach: number
  /** How far up (+) or down (-) to aim at the target, radians. */
  aim?: number
}

interface Tween {
  start: number
  dur: number
  update(k: number): void
  done?: () => void
}

interface Particle {
  obj: THREE.Mesh
  vel: THREE.Vector3
  life: number
  age: number
  grow: number
  gravity: number
}

const UP = new THREE.Vector3(0, 1, 0)
const STAVES = ['staff', 'orbstaff', 'leafstaff', 'holystaff', 'spear', 'scythe']

export class BattleScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200)
  private overlay: HTMLDivElement
  private banner: HTMLDivElement
  private units = new Map<string, UnitView>()
  private log: CombatLogEvent[] = []
  private step = -1
  private speed = 1
  private width = 8
  private height = 8
  private setting: Setting
  private world = new THREE.Group()
  private anims: Animated[] = []
  private tweens: Tween[] = []
  private particles: Particle[] = []
  private ambient: THREE.Points | null = null
  private ambientVel: Float32Array | null = null
  private raf = 0
  private clock = new THREE.Clock()
  private time = 0
  private camBase = new THREE.Vector3()
  private camTarget = new THREE.Vector3()
  private intro = 0
  private shake = 0
  private fxMats = new MaterialBag()
  private resizeObs: ResizeObserver
  /** What boss signature attacks (signatures.ts) draw with. */
  private fx: FxHost = {
    scene: this.scene,
    mats: this.fxMats,
    tween: (dur, update, done, delay = 0) => this.tween(dur, update, done, delay),
    at: (delay, fn) => this.at(delay, fn),
    particle: (at, vel, color, life, size, grow = 0, gravity = 0) => this.addParticle(at, vel, color, life, size, grow, gravity),
    burst: (at, color, n, speed) => this.burst(at, color, n, speed),
    shockwave: (at, color) => this.shockwave(at, color),
    pillar: (at, color, dur) => this.pillar(at, color, dur),
    shake: (amount) => (this.shake = Math.max(this.shake, amount)),
    muzzle: (u) => this.muzzleWorld(u as UnitView),
    pose: (u, kind, dur, reach = 0, dir) => {
      const v = u as UnitView
      const d = dir ?? this.nearestFoe(v)?.pos.clone().sub(v.pos).setY(0).normalize() ?? new THREE.Vector3(1, 0, 0)
      v.pose = { kind, start: this.time, dur, dir: d.clone(), reach }
    },
  }
  private disposed = false
  /** Slow motion for looking at effects (dev: window.b3d.timeScale = 0.1). */
  timeScale = 1
  /** Turn every figure slowly in place, to see them from all sides (the dev lineup pages). */
  turntable = false

  constructor(
    private container: HTMLElement,
    log: CombatLogEvent[],
    moduleId: string | null,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    container.appendChild(this.renderer.domElement)
    this.overlay = document.createElement('div')
    this.overlay.className = 'b3d-overlay'
    container.appendChild(this.overlay)
    this.banner = document.createElement('div')
    this.banner.className = 'b3d-banner'
    container.appendChild(this.banner)

    this.log = log
    const start = log[0]
    const encounterId = start && start.type === 'encounter_start' ? start.encounterId : undefined
    this.setting = settingFor(encounterId ?? moduleId)
    if (start && start.type === 'encounter_start') {
      this.width = start.gridWidth
      this.height = start.gridHeight
    }
    this.buildWorld()
    if (start && start.type === 'encounter_start') for (const u of start.units) this.addUnit(u)
    this.placeCamera()
    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(container)
    this.resize()
    this.loop()
  }

  // ---------- building ----------

  private cellToWorld(c: GridCoord, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(c.x - this.width / 2 + 0.5, 0, c.y - this.height / 2 + 0.5)
  }

  private buildWorld() {
    const s = this.setting
    const W = this.width
    const H = this.height
    this.scene.add(this.world)
    this.scene.fog = new THREE.Fog(s.fog, s.fogNear + Math.max(W, H) * 0.6, s.fogFar + Math.max(W, H))
    this.scene.background = new THREE.Color(s.sky[1])
    // Sky dome with a gradient.
    const skyGeo = new THREE.SphereGeometry(90, 24, 12)
    const top = new THREE.Color(s.sky[0])
    const bottom = new THREE.Color(s.sky[1])
    const colors: number[] = []
    const p = skyGeo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const k = THREE.MathUtils.clamp(p.getY(i) / 90, 0, 1)
      const c = bottom.clone().lerp(top, Math.pow(k, 0.6))
      colors.push(c.r, c.g, c.b)
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    this.scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })))

    // Light.
    const hemi = new THREE.HemisphereLight(s.hemi.sky, s.hemi.ground, s.hemi.intensity)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(s.sun.color, s.sun.intensity)
    sun.position.set(...s.sun.dir)
    sun.castShadow = true
    const span = Math.max(W, H) / 2 + 3
    sun.shadow.camera.left = -span
    sun.shadow.camera.right = span
    sun.shadow.camera.top = span
    sun.shadow.camera.bottom = -span
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 40
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0008
    sun.position.multiplyScalar(2)
    this.scene.add(sun)

    const mats = new MaterialBag()
    const rnd = seeded(s.id + W + 'x' + H)
    // Ground around the board (some settings float in the sky or space instead).
    if (s.ground >= 0) {
      const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40).rotateX(-Math.PI / 2), mats.get(s.ground))
      ground.position.y = -0.36
      ground.receiveShadow = true
      this.world.add(ground)
    }
    // The board: a slab with a tile per cell.
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.36, H + 0.5), mats.get(s.boardSide))
    slab.position.y = -0.22 // its top sits just under the tiles
    slab.receiveShadow = true
    this.world.add(slab)
    const tileGeo = new THREE.BoxGeometry(0.94, 0.1, 0.94)
    const tileMat = new THREE.MeshLambertMaterial({ flatShading: true })
    const tiles = new THREE.InstancedMesh(tileGeo, tileMat, W * H)
    tiles.receiveShadow = true
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    let i = 0
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const pos = this.cellToWorld({ x, y })
        m.makeTranslation(pos.x, -0.05 + (rnd() - 0.5) * 0.02, pos.z)
        tiles.setMatrixAt(i, m)
        c.setHex(s.tiles[(x + y) % 2]).offsetHSL(0, 0, (rnd() - 0.5) * 0.04)
        tiles.setColorAt(i, c)
        i++
      }
    this.world.add(tiles)
    // Props around the board.
    const props = new THREE.Group()
    // Props stand on the ground beside the board (settings with no ground place their own).
    if (s.ground >= 0) props.position.y = -0.36
    this.anims = s.props(props, W, H, mats, rnd)
    props.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    this.world.add(props)
    this.buildAmbient()
  }

  /** Drifting snow, embers, motes... above the board. */
  private buildAmbient() {
    const s = this.setting
    if (s.particles === 'none') return
    const n = 160
    const pos = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)
    const span = Math.max(this.width, this.height) + 6
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * span
      pos[i * 3 + 1] = Math.random() * 6
      pos[i * 3 + 2] = (Math.random() - 0.5) * span
      const fall = s.particles === 'snow' ? -0.6 : s.particles === 'ash' ? -0.25 : s.particles === 'embers' || s.particles === 'sparks' ? 0.5 : 0.08
      vel[i * 3] = (Math.random() - 0.5) * 0.2
      vel[i * 3 + 1] = fall * (0.6 + Math.random() * 0.8)
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const glow = s.particles !== 'snow' && s.particles !== 'ash'
    const mat = new THREE.PointsMaterial({
      color: s.particleColor,
      size: s.particles === 'snow' ? 0.09 : 0.07,
      transparent: true,
      opacity: glow ? 0.9 : 0.8,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    })
    this.ambient = new THREE.Points(geo, mat)
    this.ambientVel = vel
    this.scene.add(this.ambient)
  }

  private addUnit(u: CombatUnit) {
    const fig = buildFigure(u)
    const pos = this.cellToWorld(u.position)
    fig.root.position.copy(pos)
    const yaw = u.side === 'party' ? Math.PI / 2 : -Math.PI / 2
    fig.root.rotation.y = yaw
    this.world.add(fig.root)
    const label = document.createElement('div')
    label.className = `b3d-label ${u.side}`
    const name = document.createElement('div')
    name.className = 'b3d-name'
    // Party members by first name (the log has their full names); enemies by what they are.
    name.textContent = u.side === 'party' ? u.name.split(' ')[0] : u.name
    const barWrap = document.createElement('div')
    barWrap.className = 'b3d-bar'
    const bar = document.createElement('div')
    barWrap.appendChild(bar)
    const hpText = document.createElement('span')
    hpText.className = 'b3d-hp'
    label.append(name, barWrap, hpText)
    label.title = `${u.name}${u.className ? ` — ${u.race ?? ''} ${u.className}` : ''}`
    this.overlay.appendChild(label)
    const view: UnitView = {
      id: u.id,
      name: u.name,
      offset: new THREE.Vector3(),
      baseScale: fig.root.scale.x,
      side: u.side,
      fig,
      cell: { ...u.position },
      pos,
      yaw,
      hp: u.hp,
      maxHp: u.maxHp,
      alive: u.alive,
      fallen: u.alive ? 0 : 1,
      fallSide: Math.random() < 0.5 ? -1 : 1,
      label,
      bar,
      hpText,
      walking: false,
      pose: null,
      flash: 0,
      flashColor: new THREE.Color(0xffffff),
      bob: Math.random() * 10,
      hopUntil: 0,
      watch: null,
      watchUntil: 0,
      foe: null,
      foeAt: 0,
      nextGlance: 2 + Math.random() * 6,
      lookYaw: 0,
      lookPitch: 0,
      hurt: 0,
      nextBlink: Math.random() * 4,
      mouth: 0,
      vel: new THREE.Vector3(),
      lastRoot: pos.clone(),
      cheerStyle: [...u.id].reduce((h, c) => h + c.charCodeAt(0), 0),
    }
    this.units.set(u.id, view)
    this.renderHp(view)
  }

  private renderHp(v: UnitView) {
    const k = v.maxHp > 0 ? Math.max(0, v.hp) / v.maxHp : 0
    v.bar.style.width = `${(k * 100).toFixed(1)}%`
    v.bar.style.background = v.side === 'party' ? (k > 0.35 ? '#34d399' : '#fbbf24') : k > 0.35 ? '#f87171' : '#fb923c'
    v.hpText.textContent = `${formatCompact(Math.max(0, v.hp))}/${formatCompact(v.maxHp)}`
    v.label.classList.toggle('dead', !v.alive)
    v.hpText.style.display = v.alive ? '' : 'none'
    v.labelSize = undefined
  }

  // ---------- camera ----------

  private placeCamera() {
    const span = Math.max(this.width, this.height * 1.15)
    // Tall figures (giants, the Kraken, the World-Eater) need more room above the board.
    let tallest = 1
    for (const v of this.units.values()) tallest = Math.max(tallest, v.fig.height + (v.fig.hover ? 0.3 : 0))
    const extra = Math.max(0, tallest - 1.6)
    const dist = (span * 0.86 + 2.6 + extra * 0.9) * (this.setting.camera?.dist ?? 1)
    this.camTarget.set(0, 0.2 + extra * 0.3 + (this.setting.camera?.lift ?? 0), 0.6)
    this.camBase.set(0, dist * 0.66, dist * 0.9)
    this.intro = 1
  }

  private resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // Narrow views pull back so the whole board stays in frame.
    const fit = Math.max(1, 1.5 / this.camera.aspect)
    this.camera.fov = 38 * Math.min(1.5, fit)
    this.camera.updateProjectionMatrix()
  }

  private updateCamera(dt: number) {
    this.intro = Math.max(0, this.intro - dt * 0.45)
    const k = this.intro * this.intro * (3 - 2 * this.intro)
    const sway = Math.sin(this.time * 0.13) * 0.14
    const p = this.camBase.clone()
    p.applyAxisAngle(UP, sway + k * 0.9)
    p.multiplyScalar(1 + k * 0.6)
    p.y += k * 4
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5)
      p.x += (Math.random() - 0.5) * this.shake * 0.4
      p.y += (Math.random() - 0.5) * this.shake * 0.4
    }
    this.camera.position.copy(p)
    this.camera.lookAt(this.camTarget)
  }

  // ---------- driving ----------

  /** Show the battle as of `step`: animate if it's the next step, otherwise jump straight there. */
  show(step: number, speed: number) {
    this.speed = speed
    if (step === this.step) return
    if (step === this.step + 1 && step < this.log.length) {
      this.step = step
      this.play(this.log[step])
    } else this.snap(step)
  }

  private snap(step: number) {
    this.step = step
    // Finish anything still playing (so effects clean themselves up), then set the board.
    for (let round = 0; round < 10 && this.tweens.length; round++) {
      const list = this.tweens
      this.tweens = []
      for (const tw of list) {
        tw.update(1)
        tw.done?.()
      }
    }
    this.tweens = []
    for (const v of this.units.values()) {
      v.offset.set(0, 0, 0)
      v.fig.root.scale.setScalar(v.baseScale)
    }
    this.clearBanner()
    const state = computeBoardStateAtStep(this.log, step)
    for (const u of state) {
      const v = this.units.get(u.id)
      if (!v) continue
      v.cell = { ...u.position }
      this.cellToWorld(u.position, v.pos)
      v.hp = u.hp
      v.alive = u.alive
      v.fallen = u.alive ? 0 : 1
      v.walking = false
      v.pose = null
      v.watch = null
      this.renderHp(v)
    }
    // Face the other side.
    for (const v of this.units.values()) v.yaw = v.side === 'party' ? Math.PI / 2 : -Math.PI / 2
    if (step === 0) this.intro = 1
    else this.intro = 0
  }

  private dur(e: CombatLogEvent) {
    const start = this.log[0]
    return eventDuration3D(e, start?.type === 'encounter_start' ? start.units : undefined) / this.speed / 1000
  }

  private tween(dur: number, update: (k: number) => void, done?: () => void, delay = 0) {
    this.tweens.push({ start: this.time + delay, dur: Math.max(0.01, dur), update, done })
  }

  private at(delay: number, fn: () => void) {
    this.tween(0.001, () => {}, fn, delay)
  }

  private face(v: UnitView, target: THREE.Vector3) {
    v.yaw = Math.atan2(target.x - v.pos.x, target.z - v.pos.z)
  }

  private play(e: CombatLogEvent) {
    const D = this.dur(e)
    switch (e.type) {
      case 'encounter_start':
        this.intro = 1
        return
      case 'move': {
        const v = this.units.get(e.unitId)
        if (!v || e.path.length === 0) return
        const per = PER_TILE / this.speed / 1000
        const pts = e.path.map((c) => this.cellToWorld(c))
        const from = v.pos.clone()
        v.walking = true
        pts.forEach((to, i) => {
          const a = i === 0 ? from : pts[i - 1]
          this.tween(
            per,
            (k) => v.pos.lerpVectors(a, to, k),
            undefined,
            0.15 / this.speed + i * per,
          )
          this.at(0.15 / this.speed + i * per, () => this.face(v, to))
        })
        this.at(0.15 / this.speed + pts.length * per, () => {
          v.walking = false
          v.cell = { ...e.path[e.path.length - 1] }
          // Turn back toward the nearest foe.
          const foe = this.nearestFoe(v)
          if (foe) this.face(v, foe.pos)
        })
        return
      }
      case 'attack': {
        const a = this.units.get(e.attackerId)
        const t = this.units.get(e.targetId)
        if (!a || !t) return
        this.face(a, t.pos)
        // Someone with a blade in hand who can also strike from range (blade waves, bolts, a
        // dragon's breath) closes in and uses it when the target is right next to them. Bows,
        // crossbows and staves keep shooting: that's their weapon.
        const adjacent = Math.max(Math.abs(a.cell.x - t.cell.x), Math.abs(a.cell.y - t.cell.y)) <= 1
        const shooter = ['bow', 'crossbow', 'staff', 'orbstaff', 'leafstaff', 'holystaff', 'book'].includes(a.fig.hands[1] ?? '')
        const canMelee = a.fig.arms.length ? !!a.fig.hands[1] && !shooter : true
        const style = adjacent && canMelee && (a.fig.attack === 'bolt' || a.fig.attack === 'breath') ? 'melee' : a.fig.attack
        const dir = t.pos.clone().sub(a.pos).setY(0)
        const dist = dir.length()
        dir.normalize()
        // Bosses have their own signature attack; everyone else attacks by style.
        const sig = SIGNATURES[a.name]
        // Heads turn: the two of them lock eyes; everyone looks round at a boss or a giant
        // winding up, and those close by at whoever's being hit.
        this.watch(a, t, D)
        this.watch(t, a, D)
        for (const o of this.units.values()) {
          if (o === a || o === t || !o.alive) continue
          if (sig || a.fig.big) this.watch(o, a, D * 0.9, (Math.random() * 0.3) / this.speed)
          else if (o.pos.distanceTo(t.pos) < 2.6) this.watch(o, t, D * 0.7, (0.1 + Math.random() * 0.3) / this.speed)
        }
        let impactAt: number
        if (sig) {
          sig.run(this.fx, a, t, D)
          impactAt = D * sig.impact
        } else {
          const reach = style === 'melee' || style === 'slam' ? Math.max(0, Math.min(dist - (a.fig.big ? 0.9 : 0.55), 0.45)) : 0
          // A fighter's ranged attack comes from their weapon: daggers are thrown, other blades
          // swung to send a crescent wave. Only staff and spell casters cast bolts.
          const bladeRanged = style === 'bolt' && canMelee && a.fig.arms.length > 0
          const thrown = bladeRanged && a.fig.hands[1] === 'dagger' ? 'knife' : bladeRanged ? 'wave' : null
          const kind = style === 'melee' || thrown ? 'swing' : style === 'arrow' ? 'shoot' : style === 'bolt' ? 'cast' : style === 'breath' ? 'breath' : 'slam'
          // Aim up at big targets (and down at small ones): from the shoulders to the target's chest.
          const aim = Math.atan2(t.fig.height * 0.55 - a.fig.height * 0.62, Math.max(0.5, dist))
          a.pose = { kind, start: this.time, dur: D * 0.8, dir, reach, aim }
          impactAt = D * (style === 'melee' ? 0.42 : style === 'slam' ? 0.5 : 0.6)
          if (thrown) this.at(D * 0.36, () => this.projectile(a, t, thrown, D * 0.24))
          else if (style === 'arrow' || style === 'bolt') this.at(D * 0.33, () => this.projectile(a, t, style, D * 0.27))
          if (style === 'breath') this.at(D * 0.28, () => this.breath(a, t, D * 0.35))
        }
        this.at(impactAt, () => {
          if (e.hit) {
            t.hp = e.targetHpAfter
            this.renderHp(t)
            t.flash = 1
            t.flashColor.setHex(0xffffff)
            t.pose = { kind: 'hit', start: this.time, dur: 0.35, dir: dir.clone(), reach: 0.12 }
            const color = sig ? sig.color : style === 'melee' || style === 'slam' ? 0xffffff : a.fig.boltColor
            this.burst(t.pos.clone().setY(t.fig.height * 0.55), color, a.fig.big || sig ? 22 : 10, a.fig.big || sig ? 2.4 : 1.6)
            // Bosses, giants, dragons and the like land their blows with weight.
            if (sig) this.shake = Math.max(this.shake, sig.shake)
            else if (a.fig.big) this.shake = Math.max(this.shake, 0.4)
            this.floatText(t, `-${formatCompact(e.damage)}`, 'dmg')
            if (style === 'slam' && !sig) {
              this.shockwave(t.pos, a.fig.boltColor === 0xffffff ? 0xd8c8a0 : a.fig.boltColor)
              this.shake = 0.6
            }
          } else {
            t.pose = { kind: 'dodge', start: this.time, dur: 0.4, dir: dir.clone(), reach: 0.25 }
            this.floatText(t, 'Miss', 'miss')
          }
        })
        return
      }
      case 'heal': {
        const h = this.units.get(e.healerId)
        const t = this.units.get(e.targetId)
        if (!h || !t) return
        if (h !== t) {
          this.face(h, t.pos)
          this.watch(h, t, D)
          this.watch(t, h, D, D * 0.3)
        }
        h.pose = { kind: 'heal', start: this.time, dur: D * 0.75, dir: new THREE.Vector3(), reach: 0 }
        const color = h.fig.boltColor === 0xffffff ? 0x8af06a : h.fig.boltColor
        if (h !== t) this.at(D * 0.25, () => this.projectile(h, t, 'heal', D * 0.25, color))
        this.at(D * 0.5, () => {
          t.hp = e.targetHpAfter
          this.renderHp(t)
          t.flash = 0.8
          t.flashColor.setHex(color)
          this.sparkles(t, color, 16)
          this.floatText(t, `+${formatCompact(e.amount)}`, 'heal')
        })
        return
      }
      case 'revive': {
        const h = this.units.get(e.healerId)
        const t = this.units.get(e.targetId)
        if (!h || !t) return
        this.face(h, t.pos)
        h.pose = { kind: 'heal', start: this.time, dur: D * 0.7, dir: new THREE.Vector3(), reach: 0 }
        this.pillar(t.pos, 0xfff2a8, D * 0.9)
        for (const o of this.units.values())
          if (o !== t && o.alive && o.side === t.side) this.watch(o, t, D, (Math.random() * 0.3) / this.speed)
        this.at(D * 0.35, () => {
          t.alive = true
          t.hp = e.targetHpAfter
          this.renderHp(t)
          this.tween(D * 0.4, (k) => (t.fallen = 1 - k))
          this.sparkles(t, 0xfff2a8, 24)
          this.floatText(t, 'Revived!', 'heal')
        })
        return
      }
      case 'death': {
        const v = this.units.get(e.unitId)
        if (!v) return
        v.alive = false
        v.walking = false
        v.pose = null
        this.renderHp(v)
        this.tween(D * 0.75, (k) => (v.fallen = k * k))
        // Those nearby turn to watch them fall.
        for (const o of this.units.values())
          if (o !== v && o.alive && o.pos.distanceTo(v.pos) < 3.2) this.watch(o, v, D * 1.1, (Math.random() * 0.25) / this.speed)
        this.at(D * 0.45, () => this.burst(v.pos.clone().setY(0.1), 0x8a8070, 12, 0.6))
        return
      }
      case 'enrage': {
        for (const v of this.units.values())
          if (v.side === e.side && v.alive) {
            v.flash = 1
            v.flashColor.setHex(0xff4a2e)
          }
        this.showBanner(e.side === 'party' ? 'The party grows stronger!' : 'The enemy grows stronger!', e.side === 'party' ? 'good' : 'bad', D)
        return
      }
      case 'regen': {
        for (const v of this.units.values())
          if (v.side === e.side && v.alive) {
            v.flash = 0.6
            v.flashColor.setHex(0x6af0a0)
            this.sparkles(v, 0x6af0a0, 5)
          }
        // HP changes come from the log's following events, so only the shimmer here.
        this.resyncHp()
        return
      }
      case 'finisher': {
        this.shake = 1.2
        this.showBanner(e.description, 'bad', D)
        for (const v of this.units.values()) if (v.side === 'party' && v.alive) this.burst(v.pos.clone().setY(0.5), 0x6ef0ff, 14)
        this.at(D * 0.4, () => this.resyncHp())
        return
      }
      case 'encounter_end': {
        const text = e.outcome === 'victory' ? 'Victory!' : e.outcome === 'defeat' ? 'Total party kill' : 'Stalemate'
        this.showBanner(text, e.outcome === 'victory' ? 'good' : e.outcome === 'defeat' ? 'bad' : 'neutral', 999)
        // The winners celebrate (the enemy too, if the party falls).
        const winners = e.outcome === 'victory' ? 'party' : e.outcome === 'defeat' ? 'enemy' : null
        if (winners)
          for (const v of this.units.values())
            if (v.side === winners && v.alive) {
              v.watch = null
              v.pose = { kind: 'cheer', start: this.time + Math.random() * 0.3, dur: 2.2, dir: new THREE.Vector3(), reach: 0 }
            }
        this.resyncHp()
        return
      }
    }
  }

  /** After events that change HP without saying by how much (regen ticks, finishers), match the log's state. */
  private resyncHp() {
    const state = computeBoardStateAtStep(this.log, this.step)
    for (const u of state) {
      const v = this.units.get(u.id)
      if (!v) continue
      if (v.alive !== u.alive) {
        v.alive = u.alive
        if (!u.alive) this.tween(0.6, (k) => (v.fallen = k * k))
      }
      v.hp = u.hp
      this.renderHp(v)
    }
  }

  private nearestFoe(v: UnitView): UnitView | null {
    let best: UnitView | null = null
    let bd = Infinity
    for (const o of this.units.values()) {
      if (o.side === v.side || !o.alive) continue
      const d = o.pos.distanceToSquared(v.pos)
      if (d < bd) {
        bd = d
        best = o
      }
    }
    return best
  }

  // ---------- effects ----------

  private muzzleWorld(v: UnitView): THREE.Vector3 {
    v.fig.root.updateMatrixWorld(true)
    return v.fig.muzzle.getWorldPosition(new THREE.Vector3())
  }

  private projectile(a: UnitView, t: UnitView, style: 'arrow' | 'bolt' | 'heal' | 'knife' | 'wave', dur: number, color = a.fig.boltColor) {
    const from = this.muzzleWorld(a)
    const to = t.pos.clone().setY(t.fig.height * 0.55)
    let obj: THREE.Mesh
    if (style === 'arrow') {
      obj = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 4).rotateX(Math.PI / 2), this.fxMats.get(0xe9e3d0))
    } else if (style === 'knife') {
      // A thrown knife, tumbling end over end.
      obj = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), this.fxMats.get(0xd8dde4, 0.3))
      obj.add(new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.025).translate(0, -0.14, 0), this.fxMats.get(0x3a2a1e)))
    } else if (style === 'wave') {
      // A crescent of light cut from the blade, flying flat at the target.
      const c = color === 0xffffff ? 0xd8f2ff : color
      obj = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.035, 4, 16, Math.PI * 0.85).rotateZ(Math.PI * 0.075),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      )
      color = c
    } else {
      obj = new THREE.Mesh(new THREE.IcosahedronGeometry(style === 'heal' ? 0.07 : 0.1, 1), this.fxMats.get(color, 1.6))
      const light = new THREE.PointLight(color, 2, 3, 2)
      obj.add(light)
    }
    this.scene.add(obj)
    const arc = style === 'arrow' || style === 'knife' ? from.distanceTo(to) * 0.12 : style === 'wave' ? 0 : 0.15
    const flat = new THREE.Vector3()
    this.tween(
      dur,
      (k) => {
        obj.position.lerpVectors(from, to, k)
        obj.position.y += Math.sin(k * Math.PI) * arc
        if (style === 'arrow') obj.lookAt(to.x, to.y + Math.cos(k * Math.PI) * arc * 2, to.z)
        else if (style === 'knife') {
          obj.lookAt(to)
          obj.rotateX(-Math.PI / 2 + k * 18) // tumbling
        } else if (style === 'wave') {
          // Lying flat, its curve leading toward the target, growing as it flies.
          flat.copy(to).sub(from).setY(0).normalize()
          obj.rotation.set(-Math.PI / 2, 0, Math.atan2(-flat.x, -flat.z)) // the arc's middle points along `flat`
          obj.scale.setScalar(0.8 + k * 0.6)
          if (Math.random() < 0.5) this.spark(obj.position, color, 0.2)
        } else if (Math.random() < 0.6) this.spark(obj.position, color, 0.25)
      },
      () => {
        this.scene.remove(obj)
        obj.geometry.dispose()
      },
    )
  }

  private breath(a: UnitView, t: UnitView, dur: number) {
    const from = this.muzzleWorld(a)
    const to = t.pos.clone().setY(t.fig.height * 0.5)
    const color = a.fig.boltColor
    this.tween(dur, () => {
      for (let i = 0; i < 3; i++) {
        const dir = to.clone().sub(from)
        const len = dir.length()
        dir.normalize()
        const vel = dir.multiplyScalar(len / 0.45).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.2))
        this.addParticle(from.clone(), vel, color, 0.45, 0.12, 2.2, 0)
      }
    })
  }

  private spark(at: THREE.Vector3, color: number, life: number) {
    this.addParticle(at.clone(), new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.2) * 0.6, (Math.random() - 0.5) * 0.6), color, life, 0.04, -1, 0)
  }

  private burst(at: THREE.Vector3, color: number, n: number, speed = 1.6) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()))
      this.addParticle(at.clone(), v, color, 0.5 + Math.random() * 0.3, 0.05, -0.5, 4)
    }
  }

  private sparkles(v: UnitView, color: number, n: number) {
    for (let i = 0; i < n; i++) {
      const p = v.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * v.fig.height, (Math.random() - 0.5) * 0.6))
      this.addParticle(p, new THREE.Vector3(0, 0.6 + Math.random() * 0.6, 0), color, 0.9 + Math.random() * 0.5, 0.045, 0, 0)
    }
  }

  private shockwave(at: THREE.Vector3, color: number) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 4, 24).rotateX(Math.PI / 2), this.fxMats.get(color, 0.8))
    ring.position.copy(at).setY(0.05)
    this.scene.add(ring)
    const mat = ring.material as THREE.MeshLambertMaterial
    mat.transparent = true
    this.tween(
      0.6,
      (k) => {
        ring.scale.setScalar(1 + k * 4)
        mat.opacity = 1 - k
      },
      () => {
        this.scene.remove(ring)
        ring.geometry.dispose()
      },
    )
  }

  private pillar(at: THREE.Vector3, color: number, dur: number) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    )
    col.position.copy(at).setY(3)
    this.scene.add(col)
    this.tween(
      dur,
      (k) => ((col.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.55),
      () => {
        this.scene.remove(col)
        col.geometry.dispose()
      },
    )
  }

  private addParticle(at: THREE.Vector3, vel: THREE.Vector3, color: number, life: number, size: number, grow: number, gravity: number) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    const obj = new THREE.Mesh(PARTICLE_GEO, m)
    obj.scale.setScalar(size / 0.05)
    obj.position.copy(at)
    this.scene.add(obj)
    this.particles.push({ obj, vel, life, age: 0, grow, gravity })
  }

  private floatText(v: UnitView, text: string, kind: 'dmg' | 'heal' | 'miss') {
    const el = document.createElement('div')
    el.className = `b3d-float ${kind}`
    el.textContent = text
    const p = this.project(v.pos.clone().setY(v.fig.height + 0.15))
    if (!p) return
    el.style.left = `${p.x}px`
    el.style.top = `${p.y}px`
    el.style.animationDuration = `${Math.max(0.7, 1.4 / Math.sqrt(this.speed))}s`
    this.overlay.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }

  private showBanner(text: string, tone: 'good' | 'bad' | 'neutral', dur: number) {
    this.banner.textContent = text
    this.banner.className = `b3d-banner show ${tone}`
    if (dur < 900) this.at(dur * 0.9, () => this.clearBanner())
  }

  private clearBanner() {
    this.banner.className = 'b3d-banner'
  }

  private project(p: THREE.Vector3): { x: number; y: number } | null {
    const v = p.clone().project(this.camera)
    if (v.z > 1) return null
    return { x: ((v.x + 1) / 2) * this.container.clientWidth, y: ((1 - v.y) / 2) * this.container.clientHeight }
  }

  // ---------- frame ----------

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05) * this.timeScale
    this.time += dt
    // Tweens, in the order they were queued (anything a done() queues runs next frame).
    const list = this.tweens
    this.tweens = []
    for (const tw of list) {
      if (this.time < tw.start) {
        this.tweens.push(tw)
        continue
      }
      const k = Math.min(1, (this.time - tw.start) / tw.dur)
      tw.update(k)
      if (k >= 1) tw.done?.()
      else this.tweens.push(tw)
    }
    for (const v of this.units.values()) this.animateUnit(v, dt)
    this.updateParticles(dt)
    for (const a of this.anims) a.update(this.time)
    this.updateAmbient(dt)
    this.updateCamera(dt)
    this.renderer.render(this.scene, this.camera)
    this.updateLabels()
  }

  private animateUnit(v: UnitView, dt: number) {
    const f = v.fig
    const t = this.time
    v.bob += dt
    if (this.turntable) v.yaw = this.time * 0.45
    // Turn toward the facing.
    let dy = v.yaw - f.root.rotation.y
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    f.root.rotation.y += dy * Math.min(1, dt * 9)
    f.root.position.copy(v.pos).add(v.offset)
    // Badly hurt (under 30%): hunched over, breathing hard, a hand to the wound.
    const low = v.alive && v.maxHp > 0 && v.hp / v.maxHp < 0.3 ? 1 : 0
    v.hurt += (low - v.hurt) * Math.min(1, dt * 2)
    const hurt = v.hurt
    const person = !!f.spine
    const ft = f.footing
    const still = !v.walking && !f.hover
    const breathRate = 2.2 + hurt * 2.6
    const breath = Math.sin(v.bob * breathRate)
    // Fighters stand in their stance: feet apart, knees bent, leaning in; more so when hurt.
    const bend = person && still ? ft.bend + hurt * 0.35 : 0
    // Weight drifts slowly from one foot to the other.
    const shift = Math.sin(v.bob * 0.45)
    // Idle breathing / hovering.
    const hoverY = f.hover ? 0.25 + Math.sin(v.bob * 2) * 0.06 : 0
    f.body.position.set(0, hoverY + (v.walking ? Math.abs(Math.sin(v.bob * 11)) * 0.05 : breath * 0.008) - bend * 0.03, 0)
    f.body.rotation.set(0, 0, 0)
    // Limbs.
    const swing = v.walking ? Math.sin(v.bob * 11) * 0.7 : 0
    f.legs.forEach((l, i) => {
      const s = f.hover ? 0.3 : i % 2 ? -swing : swing
      l.rotation.x = s - bend * 0.55
      if (person) l.rotation.z = (i === 0 ? -1 : 1) * (still ? ft.spread : 0.02)
      // The knee bends as the leg swings back (and hangs bent when floating).
      const knee = f.knees[i]
      if (!knee) return
      if (f.kneeSign.length) {
        // Four legs: front knees fold back and hind hocks forward as each foot lifts.
        const lift = v.walking ? Math.max(0, Math.sin(v.bob * 11 + (i % 2 ? Math.PI : 0) + 1)) * 0.9 : 0
        knee.rotation.x = f.kneeSign[i] * (0.12 + lift)
      } else
        knee.rotation.x = f.hover
          ? 0.55
          : Math.max(0, s) * 1.2 + (v.walking ? 0.12 : 0.04 + bend * 1.1 + Math.max(0, shift * (i === 0 ? -1 : 1)) * 0.12)
    })
    // The upper body: leaning into the stance, twisting against the stride, breathing.
    if (f.spine)
      f.spine.rotation.set(
        (still ? ft.lean : v.walking ? 0.1 : 0) + hurt * 0.32 + breath * (0.012 + hurt * 0.025),
        v.walking ? swing * 0.2 : 0,
        still ? shift * 0.035 : 0,
      )
    // Arms rest in the figure's stance (weapon ready, staff held out, shield across), swinging
    // when walking and breathing when still. Hurt, the weapon droops and a free hand goes to
    // the wound.
    f.arms.forEach((a, i) => {
      const side = i === 0 ? -1 : 1
      const walk = v.walking ? (i ? swing : -swing) * 0.5 : 0
      const clutch = i === 0 && !f.hands[0] ? hurt : 0
      // Staves stay upright (the forearm held level against the slump); other weapons droop.
      const staff = STAVES.includes(f.hands[i] ?? '')
      const sh = staff ? f.stance.shoulder[i] - hurt * 0.32 : THREE.MathUtils.lerp(f.stance.shoulder[i], 0.02, hurt * 0.45)
      a.rotation.set(
        THREE.MathUtils.lerp(sh + walk + Math.sin(v.bob * 2 + i) * 0.035, -0.4, clutch),
        -side * 0.55 * clutch,
        side * 0.1,
      )
      const elbow = f.elbows[i]
      if (elbow) {
        const e = f.stance.elbow[i] * (1 - (staff ? 0 : hurt * 0.4)) - (v.walking ? 0.25 + Math.max(0, -walk) * 0.5 : 0) + Math.sin(v.bob * 2.2 + i) * 0.03
        elbow.rotation.set(THREE.MathUtils.lerp(e, -1.75, clutch), 0, 0)
      }
    })
    f.wings.forEach((w, i) => {
      const side = Math.sign(w.position.x) || 1
      const tip = f.wingTips[i]
      if (tip) {
        // Jointed wings rest folded back along the body, breathing a little.
        w.rotation.set(0, side * 0.55, side * (0.6 + Math.sin(v.bob * 1.3) * 0.05))
        tip.rotation.set(0, side * 0.5, -side * 1.35)
        return
      }
      w.rotation.z = side * (0.15 + Math.sin(t * (f.hover ? 9 : 2) + side) * (f.hover ? 0.5 : 0.08))
      if (w.children.length === 2 && f.wings.length === 1) w.rotation.y = t * 25 // a drone's rotor
    })
    // Necks sway in an S, tails ripple from the root out, jaws breathe, tentacles curl.
    f.neck.forEach((n, k) => {
      n.rotation.set((n.userData.rest as number) + Math.sin(v.bob * 0.9 - k * 0.6) * 0.04, Math.sin(v.bob * 0.6 - k * 0.5) * 0.09, 0)
    })
    f.tailSegs.forEach((seg, k) => (seg.rotation.y = Math.sin(t * 1.6 + v.bob - k * 0.7) * (v.walking ? 0.3 : 0.18)))
    if (f.jaw) f.jaw.rotation.x = Math.max(0, Math.sin(v.bob * 0.8)) * 0.08
    f.tentacleSegs.forEach((segs, i) =>
      segs.forEach((seg, k) => {
        if (k === 0) return
        seg.rotation.x = Math.sin(t * 1.9 + i * 1.1 - k * 0.8) * 0.3
        seg.rotation.z = Math.cos(t * 1.4 + i * 1.7 - k * 0.6) * 0.22
      }),
    )
    for (const anim of f.anims) anim(t, v.alive)
    f.tentacles.forEach((tt, i) => {
      tt.rotation.x = Math.sin(t * 1.7 + i) * 0.35 + 0.2
      tt.rotation.z = Math.cos(t * 1.3 + i * 1.7) * 0.35
    })
    if (f.tail && !f.tailSegs.length) f.tail.rotation.y = Math.sin(t * 1.6 + v.bob) * 0.3
    if (f.head)
      f.head.rotation.set(
        ((f.head.userData.rest as number | undefined) ?? 0) + Math.sin(v.bob * 1.1) * 0.04 + hurt * 0.05 - (person && still ? ft.lean * 0.8 : 0),
        Math.sin(v.bob * 0.7) * 0.06,
        0,
      )

    // Action poses.
    const p = v.pose
    if (p) {
      const k = (t - p.start) / p.dur
      if (k >= 1) v.pose = null
      else if (k >= 0) this.applyPose(v, p, k)
    }
    this.applyLook(v, dt)
    // Falling over.
    if (v.fallen > 0) this.applyFall(v, hoverY)
    this.applyFace(v, dt)
    this.applyCloth(v, dt)
    // Hit flash, and fading the fallen.
    v.flash = Math.max(0, v.flash - dt * 3)
    const fade = v.alive ? 1 : 1 - v.fallen * 0.55
    for (const m of f.mats.list) {
      if (v.flash > 0) {
        m.emissive.copy(v.flashColor)
        m.emissiveIntensity = v.flash * 0.9
      } else {
        m.emissive.setHex(m.userData.baseEmissive as number)
        m.emissiveIntensity = m.userData.baseIntensity as number
      }
      const base = (m.userData.baseOpacity as number | undefined) ?? 1
      const wantTransparent = fade < 0.999 || base < 1
      if (m.transparent !== wantTransparent) {
        m.transparent = wantTransparent
        m.needsUpdate = true
      }
      m.opacity = base * fade
    }
  }

  /** Watch another unit for a while (heads turn to it; see applyLook). */
  private watch(v: UnitView, target: UnitView, dur: number, delay = 0) {
    const go = () => {
      v.watch = target
      v.watchUntil = this.time + dur
    }
    if (delay > 0) this.at(delay, go)
    else go()
  }

  /**
   * Turn the head (and a little of the chest) toward whoever it's watching: the one it's
   * fighting, whatever's happening nearby, now and then a glance around; else the nearest foe.
   */
  private applyLook(v: UnitView, dt: number) {
    const f = v.fig
    const t = this.time
    let target: UnitView | null = null
    if (v.alive && !this.turntable) {
      if (v.watch && t < v.watchUntil) target = v.watch
      else {
        if (t > v.foeAt) {
          v.foe = this.nearestFoe(v)
          v.foeAt = t + 0.6
        }
        target = v.foe
        if (t > v.nextGlance) {
          v.nextGlance = t + 3 + Math.random() * 6
          if (!v.pose && !v.walking) {
            const others = [...this.units.values()].filter((o) => o !== v && o.alive)
            if (others.length) this.watch(v, others[Math.floor(Math.random() * others.length)], 0.9 + Math.random() * 1.2)
          }
        }
      }
    }
    let yaw = 0
    let pitch = 0
    if (target && target !== v) {
      const dx = target.fig.root.position.x - f.root.position.x
      const dz = target.fig.root.position.z - f.root.position.z
      const rel = Math.atan2(dx, dz) - f.root.rotation.y
      yaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(rel), Math.cos(rel)), -1.3, 1.3)
      const up = target.fig.height * 0.6 + target.fig.body.position.y - f.height * 0.85
      pitch = THREE.MathUtils.clamp(-Math.atan2(up, Math.max(0.6, Math.hypot(dx, dz))) * 0.8, -0.55, 0.35)
    }
    const k = Math.min(1, dt * 5)
    v.lookYaw += (yaw - v.lookYaw) * k
    v.lookPitch += (pitch - v.lookPitch) * k
    if (!f.head) return
    if (f.spine) {
      // The chest takes a share of the turn when it isn't busy; the head turns the rest of
      // the way, whatever the chest is doing.
      if (!v.pose) f.spine.rotation.y += v.lookYaw * 0.25
      f.head.rotation.y += THREE.MathUtils.clamp(v.lookYaw - f.spine.rotation.y, -1.3, 1.3)
      f.head.rotation.x += v.lookPitch
    } else if (f.neck.length) {
      const share = v.lookYaw / (f.neck.length + 1)
      for (const n of f.neck) n.rotation.y += share
      f.head.rotation.y += share
      f.head.rotation.x += v.lookPitch * 0.5
    } else {
      f.head.rotation.y += v.lookYaw * 0.7
      f.head.rotation.x += v.lookPitch * 0.5
    }
  }

  /**
   * Going down: people's knees buckle and they slump (the first third), then topple onto their
   * side with their arms flung loose. Beasts and floaters just keel over. Revived, it runs in
   * reverse: up onto a knee, then standing.
   */
  private applyFall(v: UnitView, hoverY: number) {
    const f = v.fig
    const fallen = v.fallen
    if (f.spine && !f.hover) {
      const ease = (x: number) => x * x * (3 - 2 * x)
      const b = ease(Math.min(1, fallen / 0.35))
      const c = ease(Math.max(0, (fallen - 0.35) / 0.65))
      const lerp = THREE.MathUtils.lerp
      f.legs.forEach((l, i) => {
        l.rotation.x = lerp(l.rotation.x, -0.95 + c * 0.4, b)
        l.rotation.z = lerp(l.rotation.z, (i === 0 ? -1 : 1) * 0.12, b)
      })
      f.knees.forEach((kn) => (kn.rotation.x = lerp(kn.rotation.x, 1.75 - c * 0.7, b)))
      f.spine.rotation.x = lerp(f.spine.rotation.x, 0.55 - c * 0.35, b)
      f.spine.rotation.y *= 1 - b
      if (f.head) f.head.rotation.x = lerp(f.head.rotation.x, 0.4, b)
      f.arms.forEach((a, i) => {
        const side = i === 0 ? -1 : 1
        a.rotation.set(lerp(a.rotation.x, 0.2 - c * 1.1, b), 0, lerp(a.rotation.z, side * (0.15 + c * 0.5), b))
        const e = f.elbows[i]
        if (e) e.rotation.x = lerp(e.rotation.x, -0.25 - c * 0.4, b)
      })
      f.body.rotation.z = v.fallSide * c * 1.45
      f.body.position.y = -b * (1 - c) * 0.13 - c * 0.04
      f.body.position.x = v.fallSide * c * f.height * -0.12
      return
    }
    f.body.rotation.z = v.fallSide * fallen * 1.45
    f.body.position.y = hoverY * (1 - fallen) - fallen * 0.04
    f.body.position.x = v.fallSide * fallen * f.height * -0.15
  }

  /**
   * Faces: eyes blink (and squeeze shut when hit or fallen), brows frown into an attack, knit
   * when hurt or struck and lift in a cheer; the mouth shouts with a blow, gasps when hit and
   * grins wide in victory. Skulls drop their jaw instead.
   */
  private applyFace(v: UnitView, dt: number) {
    const face = v.fig.face
    if (!face) return
    const t = this.time
    const p = v.pose
    const k = p ? THREE.MathUtils.clamp((t - p.start) / p.dur, 0, 1) : 0
    const env = p ? Math.sin(k * Math.PI) : 0
    let angry = 0
    let worried = v.hurt
    let joy = 0
    let open = 0
    let squint = 0
    if (p && v.alive)
      switch (p.kind) {
        case 'swing':
        case 'slam':
          angry = Math.min(1, env * 2)
          open = k > 0.36 && k < 0.8 ? Math.sin(((k - 0.36) / 0.44) * Math.PI) : 0
          break
        case 'shoot':
          angry = Math.min(1, env * 2) * 0.7
          squint = Math.min(1, env * 2) * 0.5 // sighting down the arrow
          break
        case 'cast':
        case 'breath':
          angry = Math.min(1, env * 2) * 0.8
          open = k > 0.3 && k < 0.75 ? Math.sin(((k - 0.3) / 0.45) * Math.PI) * 0.8 : 0
          break
        case 'heal':
          joy = env * 0.6
          open = env * 0.35
          break
        case 'hit':
          worried = Math.max(worried, env)
          open = env * 0.9
          squint = env
          break
        case 'dodge':
          worried = Math.max(worried, env * 0.7)
          open = env * 0.5
          break
        case 'cheer':
          joy = Math.min(1, k * 5)
          open = 0.6 + Math.abs(Math.sin(k * Math.PI * 4)) * 0.4
          break
      }
    if (!v.alive) {
      squint = 1
      open = 0.25
      worried = 0
    }
    // Blinking.
    if (t > v.nextBlink + 0.13) v.nextBlink = t + 1.8 + Math.random() * 4
    const blink = face.blinks && t > v.nextBlink ? 1 : 0
    const shut = face.blinks ? Math.max(blink, squint * 0.85) : 0
    for (const e of face.eyes) e.scale.y = 1 - shut * 0.85
    const r = face.brows[0] ? Math.abs(face.brows[0].position.x) / 0.42 : 0
    face.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1
      b.rotation.z = side * (angry * 0.5 - worried * 0.42)
      b.position.y = face.browY + r * (joy * 0.16 + worried * 0.05 - angry * 0.06)
    })
    v.mouth += (open - v.mouth) * Math.min(1, dt * 14)
    if (face.mouth) face.mouth.scale.set(1 + joy * 0.35, 1 + v.mouth * 3.2, 1)
    if (face.jaw) face.jaw.rotation.x = v.mouth * 0.55 + (v.alive ? Math.max(0, Math.sin(v.bob * 0.8)) * 0.05 : 0.3)
  }

  /**
   * Capes and long hair trail behind on the move (from how fast the figure is going in its own
   * frame), sway when still, and hang down rather than tipping with a lean.
   */
  private applyCloth(v: UnitView, dt: number) {
    const f = v.fig
    if (!f.cape.length && !f.hair.length) return
    const now = f.root.position
    if (dt > 0) {
      const d = now.clone().sub(v.lastRoot).divideScalar(dt)
      const yaw = f.root.rotation.y
      const fwd = d.x * Math.sin(yaw) + d.z * Math.cos(yaw)
      const sideways = d.x * Math.cos(yaw) - d.z * Math.sin(yaw)
      const k = Math.min(1, dt * 6)
      v.vel.x += (THREE.MathUtils.clamp(sideways, -3, 3) - v.vel.x) * k
      v.vel.z += (THREE.MathUtils.clamp(fwd, -3, 3) - v.vel.z) * k
    }
    v.lastRoot.copy(now)
    const t = this.time
    const lying = v.fallen > 0.5
    const lean = (f.spine?.rotation.x ?? 0) + f.body.rotation.x
    const flow = THREE.MathUtils.clamp(v.vel.z * 0.3 + (v.walking ? 0.25 : 0), -0.3, 0.9)
    const sway = Math.sin(t * 1.7 + v.bob) * 0.05
    if (f.cape.length === 2) {
      const [top, low] = f.cape
      top.rotation.set(lying ? 0.1 : Math.max(0.06 + flow - lean * 0.85 + sway, 0.04 - lean * 0.3), 0, THREE.MathUtils.clamp(-v.vel.x * 0.25, -0.3, 0.3))
      low.rotation.set(lying ? 0 : flow * 0.45 + Math.sin(t * 2.3 + v.bob) * 0.06 + (v.walking ? Math.sin(v.bob * 11) * 0.1 : 0), 0, 0)
    }
    if (f.hair.length) {
      const headTilt = lean + (f.head?.rotation.x ?? 0)
      f.hair.forEach((h, i) => {
        const rest = (h.userData.rest as number | undefined) ?? 0
        h.rotation.x = lying ? rest : rest + (i === 0 ? Math.max(-0.2, flow * 0.6 - headTilt * 0.7) : flow * 0.3) + Math.sin(t * 2.1 + v.bob + i) * 0.05
        h.rotation.z = i === 0 ? THREE.MathUtils.clamp(-v.vel.x * 0.3, -0.4, 0.4) + Math.sin(t * 1.3 + v.bob) * 0.04 : 0
      })
    }
  }

  /** Attack and reaction poses for things without arms: dragons, hounds, eldritch horrors. */
  private applyBeastPose(v: UnitView, p: Pose, k: number) {
    const f = v.fig
    const ease = (x: number) => {
      const c = Math.min(1, Math.max(0, x))
      return c * c * (3 - 2 * c)
    }
    const lunge = (amount: number) => f.root.position.add(p.dir.clone().multiplyScalar(amount))
    const neckBend = (amount: number) => f.neck.forEach((n) => (n.rotation.x += amount / Math.max(1, f.neck.length)))
    const jaw = (open: number) => f.jaw && (f.jaw.rotation.x = open)
    const flap = (strength: number, speed = 9) =>
      f.wings.forEach((w, i) => {
        const tip = f.wingTips[i]
        if (!tip || strength <= 0) return
        const side = Math.sign(w.position.x) || 1
        const beat = Math.sin(this.time * speed + i * 0.2)
        // Spread out from folded, then beat.
        w.rotation.set(0, side * 0.55 * (1 - strength), side * (0.6 * (1 - strength) + strength * (0.25 + beat * 0.55)))
        tip.rotation.set(0, side * 0.5 * (1 - strength), -side * 1.35 * (1 - strength) + side * strength * Math.sin(this.time * speed - 0.7) * 0.5)
      })
    const tentacles = (forward: number, spread: number) =>
      f.tentacleSegs.forEach((segs, i) => {
        const a = (i / Math.max(1, f.tentacleSegs.length)) * Math.PI * 2
        segs.forEach((seg, j) => {
          if (j === 0) return
          seg.rotation.x += forward * 0.35 + Math.sin(a) * spread * 0.3
          seg.rotation.z += -Math.cos(a) * spread * 0.3
        })
      })
    const front = (fn: (leg: THREE.Group, knee: THREE.Group | undefined, i: number) => void) =>
      f.legs.forEach((leg, i) => f.kneeSign[i] > 0 && fn(leg, f.knees[i], i))
    const hind = (fn: (leg: THREE.Group, knee: THREE.Group | undefined) => void) =>
      f.legs.forEach((leg, i) => f.kneeSign[i] < 0 && fn(leg, f.knees[i]))

    switch (p.kind) {
      case 'swing': {
        // Rear the head back with jaws wide (0-.4), lunge and snap (.4-.55), settle; a front
        // claw rakes as it strikes. Tentacled things coil and whip.
        const w = ease(k / 0.4)
        const st = ease((k - 0.4) / 0.15)
        const r = ease((k - 0.55) / 0.45)
        const coil = k < 0.4 ? w : k < 0.55 ? 1 - st * 2 : -1 * (1 - r)
        neckBend(-coil * 0.6)
        if (f.head) f.head.rotation.x += -coil * 0.25
        jaw(k < 0.4 ? w * 0.7 : k < 0.55 ? 0.7 * (1 - st) : 0)
        let claw = 0
        front((leg, knee, i) => {
          if (i !== 0) return
          claw = k < 0.4 ? w : k < 0.55 ? 1 - st : 0
          leg.rotation.x -= claw * 1.1
          if (knee) knee.rotation.x += claw * 0.9
        })
        tentacles(-coil * 1.4, 0)
        f.body.rotation.x = -coil * 0.12
        const l = k < 0.4 ? -0.2 * w : k < 0.55 ? -0.2 + 1.2 * st : 1 - r
        lunge(l * p.reach)
        flap(Math.max(0, coil) * 0.6)
        break
      }
      case 'breath':
      case 'cast':
      case 'shoot':
      case 'heal': {
        // Rear up and draw breath (0-.3), thrust the head forward with the jaws wide while it
        // pours out (.3-.75), then close. Wings spread and beat; tentacles fan out.
        const draw = ease(k / 0.3)
        const pour = ease((k - 0.3) / 0.12) * (1 - ease((k - 0.75) / 0.25))
        neckBend(-draw * (1 - pour) * 0.7 + pour * 0.45)
        if (f.head) f.head.rotation.x += -draw * (1 - pour) * 0.3 + pour * 0.15
        jaw(Math.max(draw * 0.25, pour * 0.85))
        f.body.rotation.x = -draw * (1 - pour) * 0.15 + pour * 0.05
        hind((leg, knee) => {
          leg.rotation.x -= pour * 0.2
          if (knee) knee.rotation.x -= pour * 0.3
        })
        if (!f.legs.length) f.body.position.y += Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.12
        tentacles(pour * 0.6, Math.max(draw, pour) * 1.4)
        flap(Math.max(draw, pour), 7)
        break
      }
      case 'slam': {
        // Rear up on the hind legs, forelegs (or tentacles) high (0-.5), and crash down (.5-.62).
        const up = k < 0.5 ? ease(k / 0.5) : 1 - ease((k - 0.5) / 0.12)
        const down = k >= 0.5 ? ease((k - 0.5) / 0.12) * (1 - ease((k - 0.7) / 0.3)) : 0
        f.body.rotation.x = -up * 0.55 + down * 0.08
        f.body.position.y += up * (f.legs.length ? 0.12 : 0.35)
        front((leg, knee) => {
          leg.rotation.x -= up * 1.2
          if (knee) knee.rotation.x += up * 1.3
        })
        hind((leg, knee) => {
          leg.rotation.x += up * 0.5
          if (knee) knee.rotation.x -= (up + down) * 0.5
        })
        neckBend(up * 0.3 - down * 0.2)
        jaw(up * 0.6)
        tentacles(-up * 1.6 + down * 1.6, up * 0.5)
        flap(up)
        lunge(Math.sin(k * Math.PI) * p.reach)
        break
      }
      case 'hit': {
        const s = Math.sin(k * Math.PI)
        lunge(s * p.reach)
        f.body.rotation.x = -s * 0.2
        neckBend(-s * 0.5)
        jaw(s * 0.5)
        tentacles(-s * 0.8, s * 0.5)
        break
      }
      case 'dodge': {
        const s = Math.sin(k * Math.PI)
        f.root.position.add(new THREE.Vector3(-p.dir.z, 0, p.dir.x).multiplyScalar(s * p.reach))
        f.body.rotation.z = s * 0.25
        flap(s * 0.6)
        break
      }
      case 'cheer': {
        const s = Math.abs(Math.sin(k * Math.PI * 2))
        f.body.position.y += s * 0.15
        neckBend(-s * 0.5)
        jaw(s * 0.6)
        flap(s)
        break
      }
    }
  }

  private applyPose(v: UnitView, p: Pose, k: number) {
    const f = v.fig
    if (!f.arms.length) return this.applyBeastPose(v, p, k)
    const ease = (x: number) => {
      const c = Math.min(1, Math.max(0, x))
      return c * c * (3 - 2 * c)
    }
    const lerp = THREE.MathUtils.lerp
    const lunge = (amount: number) => f.root.position.add(p.dir.clone().multiplyScalar(amount))
    const aim = p.aim ?? 0
    const st = f.stance
    /** Set arm i (0 left, 1 right): shoulder pitch (negative raises it forward), elbow bend (negative flexes), and yaw across the body (+ toward the middle). */
    const arm = (i: number, pitch: number, elbow: number, yaw = 0, spread = 0) => {
      const a = f.arms[i]
      if (!a) return
      const side = i === 0 ? -1 : 1
      a.rotation.set(pitch, -side * yaw, side * (0.1 + spread))
      const e = f.elbows[i]
      if (e) e.rotation.x = elbow
    }
    /** Ease arm i from its stance to a pose (k 0..1). */
    const toward = (i: number, pitch: number, elbow: number, t: number, yaw = 0) =>
      arm(i, lerp(st.shoulder[i], pitch, t), lerp(st.elbow[i], elbow, t), yaw * t)
    const crouch = (amount: number) => {
      f.legs.forEach((l) => (l.rotation.x -= amount * 0.35))
      f.knees.forEach((kn) => (kn.rotation.x += amount * 0.7))
      f.body.position.y -= amount * 0.04
    }
    /** Twist (+ turns the right shoulder back), lean (+ forward) and tilt the upper body, on top of the stance. */
    const chest = (twist: number, lean = 0, tilt = 0) => {
      if (!f.spine) return
      f.spine.rotation.y += twist
      f.spine.rotation.x += lean
      f.spine.rotation.z += tilt
    }
    const nod = (x: number) => f.head && (f.head.rotation.x += x)
    const shielded = ['shield', 'kite', 'tower'].includes(f.hands[0] ?? '')
    const heavy = !f.hands[0] && ['hammer', 'greatsword', 'club', 'scythe', 'spear'].includes(f.hands[1] ?? '')
    const dagger = f.hands[1] === 'dagger'

    switch (p.kind) {
      case 'swing': {
        // Wind up (0-.4), strike (.4-.55), recover. The chest coils back with the wind-up and
        // whips round through the blow, so the whole body throws it.
        const w = ease(k / 0.4)
        const s = ease((k - 0.4) / 0.15)
        const r = ease((k - 0.55) / 0.45)
        const coil = k < 0.4 ? w : k < 0.55 ? 1 - 2 * s : -(1 - r)
        if (dagger) {
          // A drawn-back stab with the right, the left blade crossing in after it.
          const pitch = k < 0.4 ? lerp(st.shoulder[1], -0.5, w) : k < 0.55 ? lerp(-0.5, -1.5 - aim, s) : lerp(-1.5 - aim, st.shoulder[1], r)
          const elbow = k < 0.4 ? lerp(st.elbow[1], -1.9, w) : k < 0.55 ? lerp(-1.9, -0.05, s) : lerp(-0.05, st.elbow[1], r)
          arm(1, pitch, elbow, 0.15)
          const k2 = Math.max(0, k - 0.12)
          arm(0, lerp(st.shoulder[0], -1.4 - aim, Math.sin(Math.min(1, k2 * 1.6) * Math.PI)), lerp(st.elbow[0], -0.3, Math.sin(Math.min(1, k2 * 1.6) * Math.PI)), 0.25)
          chest(coil * 0.35, k < 0.4 ? w * 0.08 : 0.08 + (1 - r) * 0.12)
        } else {
          // Overhead: raised up and back, elbow bent behind the head, then chopped down.
          const pitch = k < 0.4 ? lerp(st.shoulder[1], -2.7, w) : k < 0.55 ? lerp(-2.7, -0.55 - aim, s) : lerp(-0.55 - aim, st.shoulder[1], r)
          const elbow = k < 0.4 ? lerp(st.elbow[1], -1.5, w) : k < 0.55 ? lerp(-1.5, -0.1, s) : lerp(-0.1, st.elbow[1], r)
          arm(1, pitch, elbow, heavy ? 0.35 : 0.1)
          if (heavy) arm(0, pitch, elbow, 0.35)
          else if (shielded) toward(0, -0.75, -1.15, Math.sin(Math.min(1, k * 1.3) * Math.PI), 0.25)
          else if (f.arms[0]) toward(0, -0.9, -0.6, Math.sin(Math.min(1, k * 1.3) * Math.PI))
          // Arch back on the wind-up, crunch forward into the blow.
          chest(coil * (heavy ? 0.5 : 0.4), k < 0.4 ? -w * 0.18 : k < 0.55 ? -0.18 + s * 0.48 : 0.3 * (1 - r))
        }
        nod(k < 0.4 ? -w * 0.1 : k < 0.55 ? -0.1 + s * 0.2 : 0.1 * (1 - r))
        crouch(k < 0.4 ? w * 0.6 : k < 0.55 ? 0.6 : 0.6 * (1 - r))
        const l = k < 0.4 ? -0.15 * w : k < 0.55 ? -0.15 + 1.15 * s : 1 - r
        lunge(l * p.reach)
        f.body.rotation.x = l * 0.12
        break
      }
      case 'shoot': {
        // Raise the bow at the target (0-.25), draw to the cheek (.25-.42), loose, follow through.
        const raise = ease(k / 0.25) * (1 - ease((k - 0.8) / 0.2))
        const draw = ease((k - 0.22) / 0.2)
        const loosed = k > 0.42
        const out = ease((k - 0.8) / 0.2)
        if (f.hands[0] === 'crossbow') {
          arm(0, lerp(st.shoulder[0], -Math.PI / 2 - aim, raise), lerp(st.elbow[0], 0, raise), 0.08 * raise)
          arm(1, lerp(st.shoulder[1], -1.3 - aim, raise), lerp(st.elbow[1], -0.6, raise), 0.55 * raise)
          // Shouldered and sighting along it; a kick back when it looses.
          chest(-0.12 * raise, 0.06 * raise - (loosed ? Math.max(0, 0.18 - (k - 0.42) * 1.2) : 0))
          nod(0.12 * raise)
        } else {
          arm(0, lerp(st.shoulder[0], -Math.PI / 2 - aim, raise), lerp(st.elbow[0], 0, raise), 0.12 * raise)
          // The drawing hand: up to the string, pulled back past the cheek, then snapping open.
          const pitch = -Math.PI / 2 - aim - 0.1
          const elbow = loosed ? lerp(-2.4, -1.3, ease((k - 0.42) / 0.12)) : lerp(-0.4, -2.4, draw)
          const yaw = loosed ? lerp(0.5, 0.2, ease((k - 0.42) / 0.12)) : 0.5
          arm(1, lerp(st.shoulder[1], pitch, raise * (1 - out)), lerp(st.elbow[1], elbow, raise * (1 - out)), yaw * raise * (1 - out))
          // Side-on like an archer, the drawing shoulder pulled back with the string and
          // springing forward on release.
          chest(-0.25 * raise + (loosed ? 0 : -0.12 * draw * raise), -0.05 * draw * raise)
        }
        break
      }
      case 'cast': {
        // Staff lifted to the chest (0-.35), then thrust out at arm's length with its head
        // tipped toward the target (.35-.45), held, lowered. The staff stays upright because the
        // forearm stays level.
        const up = ease(k / 0.35)
        const thrust = ease((k - 0.35) / 0.1)
        const down = ease((k - 0.75) / 0.25)
        const staffArm = f.hands[1] === 'book' ? 0 : 1
        const free = 1 - staffArm
        const pitch = k < 0.35 ? lerp(st.shoulder[staffArm], -0.8, up) : lerp(-0.8, -1.25 - aim, thrust)
        const elbow = k < 0.35 ? lerp(st.elbow[staffArm], -0.75, up) : lerp(-0.75, -0.05, thrust)
        arm(staffArm, lerp(pitch, st.shoulder[staffArm], down), lerp(elbow, st.elbow[staffArm], down), 0.1)
        // The other hand pushes out at the target as the spell goes.
        const push = thrust * (1 - down)
        arm(free, lerp(st.shoulder[free], -1.5 - aim, push), lerp(st.elbow[free], -0.1, push), 0.2 * push)
        // Gather (drawn up and back), then lean into the release.
        const gather = up * (1 - thrust)
        chest((staffArm === 1 ? 1 : -1) * (gather * 0.25 - push * 0.2), -gather * 0.12 + push * 0.18)
        nod(-gather * 0.12)
        f.body.position.y += Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.03
        break
      }
      case 'heal': {
        // The staff (or book) held up and out in front; the free hand lifted high and open,
        // face turned up.
        const lift = Math.sin(Math.min(1, k * 1.3) * Math.PI)
        const held = (w: string | null) => !!w && ['staff', 'orbstaff', 'leafstaff', 'holystaff', 'book'].includes(w)
        for (const i of [0, 1]) {
          if (!f.arms[i]) continue
          if (held(f.hands[i])) arm(i, lerp(st.shoulder[i], -1.35, lift), lerp(st.elbow[i], -0.25, lift), 0.1 * lift)
          else arm(i, lerp(st.shoulder[i], -2.75, lift), lerp(st.elbow[i], -0.3, lift), 0, 0.35 * lift)
        }
        chest(0, -lift * 0.16)
        nod(-lift * 0.25)
        f.body.position.y += lift * 0.04
        break
      }
      case 'breath': {
        const s = Math.sin(Math.min(1, k * 1.2) * Math.PI)
        if (f.head) f.head.rotation.x = -0.3 + s * 0.5
        chest(0, -s * 0.12)
        break
      }
      case 'slam': {
        // Both arms high over the head, arched right back, then brought down hard, folding
        // over the blow.
        const up = k < 0.5 ? ease(k / 0.5) : 1 - ease(Math.min(1, (k - 0.5) / 0.12))
        const down = k >= 0.5 ? ease(Math.min(1, (k - 0.5) / 0.12)) * (1 - ease((k - 0.7) / 0.3)) : 0
        for (const i of [0, 1]) {
          if (!f.arms[i]) continue
          arm(i, lerp(st.shoulder[i], -2.9, up) + down * -0.3, lerp(st.elbow[i], -0.7, up), 0.3 * (up + down))
        }
        crouch(down)
        chest(0, -up * 0.3 + down * 0.4)
        nod(-up * 0.2 + down * 0.15)
        f.body.position.y += up * (f.hover ? 0.4 : 0.15)
        f.body.rotation.x = -up * 0.1 + down * 0.08
        lunge(Math.sin(k * Math.PI) * p.reach)
        break
      }
      case 'hit': {
        // Rocked back: the chest snaps back and turns from the blow, head thrown back, arms
        // up to cover.
        const s = Math.sin(k * Math.PI)
        lunge(s * p.reach)
        f.body.rotation.x = -s * 0.1
        chest(s * 0.25 * (v.fallSide || 1), -s * 0.3)
        nod(-s * 0.3)
        for (const i of [0, 1]) if (f.arms[i]) toward(i, -0.6, -1.4, s * 0.8, 0.2)
        break
      }
      case 'dodge': {
        // A quick sidestep, ducking and leaning away from it.
        const s = Math.sin(k * Math.PI)
        const side = new THREE.Vector3(-p.dir.z, 0, p.dir.x).multiplyScalar(s * p.reach)
        f.root.position.add(side)
        f.body.rotation.z = s * 0.15
        chest(-s * 0.3, s * 0.15, s * 0.2)
        crouch(s * 0.6)
        break
      }
      case 'cheer': {
        const up = Math.min(1, k * 4)
        const style = v.cheerStyle % 3
        if (style === 0) {
          // Both arms up, jumping for joy.
          const s = Math.abs(Math.sin(k * Math.PI * 2))
          f.body.position.y += s * 0.2
          for (const i of [0, 1]) if (f.arms[i]) arm(i, lerp(st.shoulder[i], -2.8, up), lerp(st.elbow[i], -0.3 - Math.sin(k * 20 + i) * 0.25, up), 0, 0.25 * up)
          crouch((1 - s) * 0.4)
          chest(0, -s * 0.12)
          nod(-0.2 * up)
        } else if (style === 1) {
          // The weapon thrust high and pumped, the other hand on the hip.
          const pump = Math.abs(Math.sin(k * Math.PI * 3))
          arm(1, lerp(st.shoulder[1], -2.5 - pump * 0.4, up), lerp(st.elbow[1], -0.9 + pump * 0.8, up), 0.1 * up)
          arm(0, lerp(st.shoulder[0], 0.25, up), lerp(st.elbow[0], -1.7, up), -0.5 * up, 0.45 * up)
          f.body.position.y += pump * 0.05
          chest(-0.15 * up, -0.15 * up)
          nod(-0.3 * up)
        } else {
          // Weapon raised in a salute, then a big laugh, head back and shoulders shaking.
          const laugh = Math.max(0, Math.sin(k * 30)) * up
          arm(1, lerp(st.shoulder[1], -1.6, up), lerp(st.elbow[1], -1.6, up), 0.35 * up)
          arm(0, lerp(st.shoulder[0], -0.3, up), lerp(st.elbow[0], -1.3, up), 0.5 * up)
          chest(0.1 * up, -0.22 * up - laugh * 0.05)
          nod(-0.35 * up - laugh * 0.08)
          f.body.position.y += laugh * 0.015
        }
        break
      }
    }
  }

  private updateParticles(dt: number) {
    const keep: Particle[] = []
    for (const p of this.particles) {
      p.age += dt
      const k = p.age / p.life
      if (k >= 1) {
        this.scene.remove(p.obj)
        ;(p.obj.material as THREE.Material).dispose()
        continue
      }
      p.vel.y -= p.gravity * dt
      p.obj.position.addScaledVector(p.vel, dt)
      p.obj.scale.multiplyScalar(1 + p.grow * dt)
      ;(p.obj.material as THREE.MeshBasicMaterial).opacity = 1 - k
      keep.push(p)
    }
    this.particles = keep
  }

  private updateAmbient(dt: number) {
    if (!this.ambient || !this.ambientVel) return
    const pos = this.ambient.geometry.attributes.position as THREE.BufferAttribute
    const a = pos.array as Float32Array
    const v = this.ambientVel
    const span = Math.max(this.width, this.height) + 6
    for (let i = 0; i < pos.count; i++) {
      a[i * 3] += (v[i * 3] + Math.sin(this.time * 0.7 + i) * 0.1) * dt
      a[i * 3 + 1] += v[i * 3 + 1] * dt
      a[i * 3 + 2] += v[i * 3 + 2] * dt
      if (a[i * 3 + 1] < -0.2) a[i * 3 + 1] = 6
      if (a[i * 3 + 1] > 6) a[i * 3 + 1] = 0
      if (Math.abs(a[i * 3]) > span / 2) a[i * 3] *= -0.98
      if (Math.abs(a[i * 3 + 2]) > span / 2) a[i * 3 + 2] *= -0.98
    }
    pos.needsUpdate = true
  }

  /**
   * Name plates follow their figures, but never sit on top of each other: living units nearest
   * the camera keep their spot, and any plate that would overlap one already placed is nudged
   * up above it (the fallen give way to the living).
   */
  private updateLabels() {
    const items: { v: UnitView; x: number; y: number; w: number; h: number }[] = []
    for (const v of this.units.values()) {
      const p = this.project(v.fig.root.position.clone().setY(v.fig.root.position.y + (v.alive ? v.fig.height + (v.fig.hover ? 0.3 : 0.12) : 0.5)))
      if (!p) {
        v.label.style.display = 'none'
        continue
      }
      v.label.style.display = ''
      if (!v.labelSize) v.labelSize = { w: v.label.offsetWidth || 50, h: v.label.offsetHeight || 28 }
      items.push({ v, x: p.x, y: p.y, w: v.labelSize.w + 4, h: v.labelSize.h + 1 })
    }
    items.sort((a, b) => Number(b.v.alive) - Number(a.v.alive) || b.y - a.y)
    const placed: { x: number; y: number; w: number; h: number }[] = []
    for (const it of items) {
      // The plate's box: centred on x, bottom edge at y.
      for (let guard = 0; guard < 12; guard++) {
        const hit = placed.find((o) => Math.abs(o.x - it.x) < (o.w + it.w) / 2 && it.y > o.y - o.h && it.y - it.h < o.y)
        if (!hit) break
        it.y = hit.y - hit.h
      }
      placed.push(it)
      it.v.label.style.transform = `translate(${it.x}px, ${it.y}px) translate(-50%, -100%)`
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObs.disconnect()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.overlay.remove()
    this.banner.remove()
  }
}

const PARTICLE_GEO = new THREE.IcosahedronGeometry(0.05, 0)

