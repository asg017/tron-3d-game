import { collectSegs, isOwnFreshSeg, segsOverlap } from './collision'
import type { BikeState, InputCommand, RiderSetup, SimConfig, SimState } from './types'
import { DIRS, turnedLeft, turnedRight } from './types'

/**
 * Pure deterministic fixed-timestep simulation. No rendering, no wall clock,
 * no Math.random — given the same riders and the same per-tick inputs it
 * always produces the same state, which is what future lockstep PvP needs.
 */
export function createSim(cfg: SimConfig, riders: RiderSetup[]): SimState {
  const bikes: BikeState[] = riders.map((r, id) => ({
    id,
    name: r.name,
    color: r.color,
    isPlayer: r.isPlayer,
    alive: true,
    x: r.x,
    z: r.z,
    prevX: r.x,
    prevZ: r.z,
    heading: r.heading,
    speed: cfg.cruiseSpeed,
    turnCooldown: 0,
    trail: [{ x: r.x, z: r.z }],
    derezTicks: 0,
  }))
  return {
    tick: 0,
    status: 'countdown',
    countdownTicks: cfg.countdownTicks,
    roundOverTicks: 0,
    winnerId: null,
    bikes,
  }
}

/** Advance one fixed timestep. `inputs` is indexed by bike id. */
export function tickSim(state: SimState, cfg: SimConfig, inputs: InputCommand[]): void {
  state.tick++

  for (const b of state.bikes) {
    if (!b.alive) b.derezTicks++
  }

  if (state.status === 'countdown') {
    state.countdownTicks--
    if (state.countdownTicks <= 0) state.status = 'running'
    return
  }
  if (state.status === 'roundOver') {
    state.roundOverTicks++
    return
  }

  // --- move ---
  for (const b of state.bikes) {
    if (!b.alive) continue
    const input = inputs[b.id] ?? { turn: null, throttle: null }

    if (b.turnCooldown > 0) b.turnCooldown--
    if (input.turn && b.turnCooldown <= 0) {
      b.trail.push({ x: b.x, z: b.z })
      b.heading = input.turn === 'left' ? turnedLeft(b.heading) : turnedRight(b.heading)
      b.speed = Math.max(cfg.minSpeed, b.speed * cfg.turnPenalty)
      b.turnCooldown = cfg.turnCooldownTicks
    }

    if (input.throttle === 'accel') {
      b.speed = Math.min(cfg.maxSpeed, b.speed + cfg.accel * cfg.dt)
    } else if (input.throttle === 'brake') {
      b.speed = Math.max(cfg.minSpeed, b.speed - cfg.brake * cfg.dt)
    } else {
      const delta = cfg.cruiseSpeed - b.speed
      const step = cfg.cruiseEase * cfg.dt
      b.speed += Math.abs(delta) < step ? delta : Math.sign(delta) * step
    }

    b.prevX = b.x
    b.prevZ = b.z
    const dir = DIRS[b.heading]
    b.x += dir.x * b.speed * cfg.dt
    b.z += dir.z * b.speed * cfg.dt
  }

  // --- collide (all moves resolved first, so simultaneous crashes are fair) ---
  const segs = collectSegs(state.bikes)
  const crashed: boolean[] = state.bikes.map(() => false)
  const bound = cfg.arenaHalf - cfg.trailRadius

  for (const b of state.bikes) {
    if (!b.alive) continue

    if (Math.abs(b.x) > bound || Math.abs(b.z) > bound) {
      crashed[b.id] = true
      continue
    }
    for (const s of segs) {
      if (isOwnFreshSeg(s, b)) continue
      if (segsOverlap(b.prevX, b.prevZ, b.x, b.z, s.x1, s.z1, s.x2, s.z2, cfg.trailRadius)) {
        crashed[b.id] = true
        break
      }
    }
  }

  // head-on: swept paths of two alive bikes crossing kills both
  for (let i = 0; i < state.bikes.length; i++) {
    for (let j = i + 1; j < state.bikes.length; j++) {
      const a = state.bikes[i]
      const b = state.bikes[j]
      if (!a.alive || !b.alive) continue
      if (segsOverlap(a.prevX, a.prevZ, a.x, a.z, b.prevX, b.prevZ, b.x, b.z, cfg.headRadius)) {
        crashed[i] = true
        crashed[j] = true
      }
    }
  }

  for (const b of state.bikes) {
    if (b.alive && crashed[b.id]) {
      b.alive = false
      b.derezTicks = 0
    }
  }

  const alive = state.bikes.filter((b) => b.alive)
  if (alive.length <= 1) {
    state.status = 'roundOver'
    state.roundOverTicks = 0
    state.winnerId = alive.length === 1 ? alive[0].id : null
  }
}
