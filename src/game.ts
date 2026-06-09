import { KeyboardInput } from './core/input'
import { GameLoop } from './core/loop'
import { IS_TOUCH } from './core/platform'
import { mulberry32 } from './core/rng'
import { TouchInput } from './core/touch'
import { CpuController } from './sim/ai/controller'
import { DIFFICULTIES } from './sim/ai/difficulty'
import { createSim, tickSim } from './sim/sim'
import type { InputCommand, RiderSetup, SimState } from './sim/types'
import { DEFAULT_CONFIG, DIRS, noInput } from './sim/types'
import { Arena } from './render/arena'
import { createBikeMesh, rotationYForDir } from './render/bike'
import { ChaseCamera, DESKTOP_CAMERA, MOBILE_CAMERA } from './render/camera'
import { ExplosionPool } from './render/effects'
import { GameRenderer } from './render/renderer'
import { TrailMesh } from './render/trail'
import { CPU_NAMES, NEON_COLORS } from './theme'
import { Hud } from './ui/hud'
import { showGameOverScreen, showRoundScreen, type ScoreLine } from './ui/screens'
import type { PlayerSetup } from './ui/startScreen'

const WINS_NEEDED = 3
/** ticks to let the crash explosion play before the round banner */
const ROUND_END_DELAY = 55

interface BikeVisual {
  mesh: ReturnType<typeof createBikeMesh>
  trail: TrailMesh
}

export class Game {
  private readonly gfx: GameRenderer
  private readonly arena: Arena
  private readonly chaseCam: ChaseCamera
  private readonly explosions: ExplosionPool
  private readonly input = new KeyboardInput()
  private readonly touch = new TouchInput()
  private readonly loop: GameLoop
  private readonly cfg = DEFAULT_CONFIG
  private readonly riders: RiderSetup[]
  private readonly seed: number

  private sim!: SimState
  private controllers: (CpuController | null)[] = []
  private visuals: BikeVisual[] = []
  private aliveLast: boolean[] = []
  private hud: Hud | null = null
  private scores: number[] = []
  private round = 0
  private roundHandled = false
  private gameOver = false
  private time = 0

  constructor(
    container: HTMLElement,
    private readonly setup: PlayerSetup,
    private readonly onExit: () => void,
  ) {
    this.seed = Date.now() & 0x7fffffff
    this.gfx = new GameRenderer(container, IS_TOUCH ? { maxDpr: 1.5, bloomStrength: 0.9 } : {})
    this.arena = new Arena(this.gfx.scene, this.cfg.arenaHalf)
    this.chaseCam = new ChaseCamera(this.gfx.camera, IS_TOUCH ? MOBILE_CAMERA : DESKTOP_CAMERA)
    this.explosions = new ExplosionPool(this.gfx.scene)
    this.riders = this.buildRiders()
    this.loop = new GameLoop(this.cfg.dt, () => this.tick(), (a, dt) => this.render(a, dt))
    // debug/automation handle (used by the smoke tests)
    ;(window as unknown as { __NEONGRID: Game }).__NEONGRID = this
  }

  /** current sim state, read-only — for smoke tests and debugging */
  get simState(): SimState {
    return this.sim
  }

  start(): void {
    this.input.attach()
    this.touch.attach()
    this.startMatch()
    this.loop.start()
  }

  private buildRiders(): RiderSetup[] {
    const pick = mulberry32(this.seed)
    const cpuColors = NEON_COLORS.filter((c) => c.hex !== this.setup.color)
    const names = [...CPU_NAMES]
    const takeName = () => names.splice(Math.floor(pick() * names.length), 1)[0]
    const takeColor = () => cpuColors.splice(Math.floor(pick() * cpuColors.length), 1)[0].hex
    return [
      { name: this.setup.name, color: this.setup.color, isPlayer: true, x: 0, z: 70, heading: 0 },
      { name: takeName(), color: takeColor(), isPlayer: false, x: -55, z: -70, heading: 2 },
      { name: takeName(), color: takeColor(), isPlayer: false, x: 55, z: -70, heading: 2 },
    ]
  }

  private startMatch(): void {
    this.scores = this.riders.map(() => 0)
    this.round = 0
    this.gameOver = false
    this.startRound()
  }

  private startRound(): void {
    this.round++
    this.roundHandled = false

    for (const v of this.visuals) {
      this.gfx.scene.remove(v.mesh)
      v.trail.dispose()
    }
    this.explosions.clear()

    this.sim = createSim(this.cfg, this.riders)
    const params = DIFFICULTIES[this.setup.difficulty]
    this.controllers = this.sim.bikes.map((b) =>
      b.isPlayer ? null : new CpuController(b.id, params, mulberry32(this.seed + this.round * 7919 + b.id)),
    )
    this.visuals = this.sim.bikes.map((b) => {
      const mesh = createBikeMesh(b.color)
      mesh.position.set(b.x, 0, b.z)
      const d = DIRS[b.heading]
      mesh.rotation.y = rotationYForDir(d.x, d.z)
      this.gfx.scene.add(mesh)
      return { mesh, trail: new TrailMesh(this.gfx.scene, b.color) }
    })
    this.aliveLast = this.sim.bikes.map(() => true)

    if (!this.hud) this.hud = new Hud(this.sim, WINS_NEEDED)

    const player = this.sim.bikes.find((b) => b.isPlayer)!
    const d = DIRS[player.heading]
    this.chaseCam.snapBehind({ x: player.x, z: player.z, dirX: d.x, dirZ: d.z, speed: player.speed, alive: true })
  }

  private tick(): void {
    const inputs: InputCommand[] = this.sim.bikes.map((b) => {
      if (b.isPlayer) {
        const kb = this.input.consume()
        const tc = this.touch.consume()
        return { turn: tc.turn ?? kb.turn, throttle: tc.throttle ?? kb.throttle }
      }
      return this.controllers[b.id]?.getInput(this.sim, this.cfg) ?? noInput()
    })
    tickSim(this.sim, this.cfg, inputs)

    if (this.sim.status === 'roundOver' && !this.roundHandled && this.sim.roundOverTicks >= ROUND_END_DELAY) {
      this.roundHandled = true
      this.handleRoundEnd()
    }
  }

  private scoreLines(): ScoreLine[] {
    return this.sim.bikes.map((b) => ({ name: b.name, color: b.color, wins: this.scores[b.id] }))
  }

  private handleRoundEnd(): void {
    const winnerId = this.sim.winnerId
    if (winnerId !== null) this.scores[winnerId]++

    const winner = winnerId !== null ? this.sim.bikes[winnerId] : null
    if (winner && this.scores[winner.id] >= WINS_NEEDED) {
      this.gameOver = true
      const title = winner.isPlayer ? `${winner.name} WINS THE GRID` : `DEREZZED BY ${winner.name}`
      showGameOverScreen(
        title,
        winner.color,
        this.scoreLines(),
        WINS_NEEDED,
        () => this.startMatch(),
        () => {
          this.destroy()
          this.onExit()
        },
      )
      return
    }

    const title = winner ? `ROUND ${this.round} — ${winner.name}` : `ROUND ${this.round} — DRAW`
    const color = winner ? winner.color : '#9fc8ff'
    void showRoundScreen(title, color, this.scoreLines(), WINS_NEEDED, 2400).then(() => {
      if (!this.gameOver) this.startRound()
    })
  }

  private render(alpha: number, frameDt: number): void {
    this.time += frameDt
    this.arena.update(this.time)

    for (const b of this.sim.bikes) {
      const v = this.visuals[b.id]
      const ix = b.prevX + (b.x - b.prevX) * alpha
      const iz = b.prevZ + (b.z - b.prevZ) * alpha

      if (this.aliveLast[b.id] && !b.alive) {
        this.explosions.spawn(b.x, b.z, b.color)
        v.mesh.visible = false
        this.aliveLast[b.id] = false
      }

      if (b.alive) {
        v.mesh.position.set(ix, 0, iz)
        const d = DIRS[b.heading]
        v.mesh.rotation.y = rotationYForDir(d.x, d.z)
      }

      const derez = b.alive ? 0 : Math.min(1, b.derezTicks / 60)
      v.trail.update(b.trail, b.alive ? ix : b.x, b.alive ? iz : b.z, derez)
    }

    this.explosions.update(frameDt)
    this.hud?.update(this.sim, this.cfg, this.scores, IS_TOUCH && this.round === 1)

    const player = this.sim.bikes.find((b) => b.isPlayer)!
    const d = DIRS[player.heading]
    this.chaseCam.update(frameDt, {
      x: player.prevX + (player.x - player.prevX) * alpha,
      z: player.prevZ + (player.z - player.prevZ) * alpha,
      dirX: d.x,
      dirZ: d.z,
      speed: player.speed,
      alive: player.alive,
    })

    this.gfx.render()
  }

  destroy(): void {
    this.loop.stop()
    this.input.detach()
    this.touch.detach()
    this.hud?.dispose()
    this.hud = null
    for (const v of this.visuals) {
      this.gfx.scene.remove(v.mesh)
      v.trail.dispose()
    }
    this.explosions.clear()
    this.gfx.dispose()
  }
}
