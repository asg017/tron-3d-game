import type { Rng } from '../../core/rng'
import { collectSegs, isOwnFreshSeg, rayClearance, type Seg } from '../collision'
import type { AiParams } from './difficulty'
import type { InputCommand, SimConfig, SimState, Throttle, Turn } from '../types'
import { DIRS, turnedLeft, turnedRight } from '../types'

/**
 * CPU rider. Produces the same InputCommand shape as the keyboard, so the sim
 * treats it identically to a human (or, later, a network peer).
 *
 * Strategy: raycast forward/left/right against all solid walls. Turn away
 * from danger (occasionally picking the wrong side, per difficulty), cut off
 * the player when feeling aggressive, and wander a little so play doesn't
 * look robotic.
 */
export class CpuController {
  private lastThrottle: Throttle = null
  private readonly phase: number

  constructor(
    private readonly bikeId: number,
    private readonly params: AiParams,
    private readonly rng: Rng,
  ) {
    this.phase = bikeId * 3 // desync decision ticks between CPUs
  }

  getInput(state: SimState, cfg: SimConfig): InputCommand {
    const me = state.bikes[this.bikeId]
    if (!me.alive || state.status !== 'running') return { turn: null, throttle: null }

    // between decisions: keep throttle, never turn
    if ((state.tick + this.phase) % this.params.reactionTicks !== 0) {
      return { turn: null, throttle: this.lastThrottle }
    }

    const p = this.params
    const segs = collectSegs(state.bikes)
    const skip = (s: Seg) => isOwnFreshSeg(s, me)
    const look = (heading: number) => {
      const d = DIRS[heading]
      return rayClearance(me.x, me.z, d.x, d.z, p.lookahead, segs, skip, cfg.arenaHalf, cfg.trailRadius + 0.4)
    }

    const fwd = look(me.heading)
    const leftClear = look(turnedLeft(me.heading))
    const rightClear = look(turnedRight(me.heading))

    // distance covered before the next decision plus a safety margin
    const reactionDist = me.speed * p.reactionTicks * cfg.dt
    const danger = Math.max(7, me.speed * 0.45 + reactionDist + 3)

    let turn: Turn = null
    let throttle: Throttle = null

    if (fwd < danger && me.turnCooldown <= 0) {
      let side: Turn = leftClear >= rightClear ? 'left' : 'right'
      if (this.rng() < p.mistakeChance) side = side === 'left' ? 'right' : 'left'
      const sideClear = side === 'left' ? leftClear : rightClear
      if (sideClear > 2.5 || fwd < 4) {
        turn = side
      } else {
        // both sides terrible: stall and hope a derez opens space
        throttle = 'brake'
      }
    } else if (me.turnCooldown <= 0) {
      const player = state.bikes.find((b) => b.isPlayer && b.alive)
      const distToPlayer = player ? Math.hypot(player.x - me.x, player.z - me.z) : Infinity

      if (player && distToPlayer < 50 && this.rng() < p.aggression * 0.12) {
        // steer toward where the player is heading to wall them off
        const pd = DIRS[player.heading]
        const tx = player.x + pd.x * player.speed * 0.9
        const tz = player.z + pd.z * player.speed * 0.9
        const ld = DIRS[turnedLeft(me.heading)]
        const towardLeft = (tx - me.x) * ld.x + (tz - me.z) * ld.z > 0
        const side: Turn = towardLeft ? 'left' : 'right'
        const sideClear = side === 'left' ? leftClear : rightClear
        if (sideClear > danger * 1.6 && fwd > danger) turn = side
      } else if (this.rng() < p.wanderChance && fwd > danger * 2) {
        const side: Turn = leftClear >= rightClear ? 'left' : 'right'
        const sideClear = side === 'left' ? leftClear : rightClear
        if (sideClear > danger * 2.2) turn = side
      }
    }

    if (!throttle) {
      const wantSpeed = cfg.maxSpeed * p.speedFactor
      if (fwd < danger * 1.2) throttle = 'brake'
      else if (fwd > p.lookahead * 0.8 && me.speed < wantSpeed) throttle = 'accel'
    }

    this.lastThrottle = throttle
    return { turn, throttle }
  }
}
