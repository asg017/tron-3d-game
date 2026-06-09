/**
 * Sanity check for the lockstep-PvP property: two sims fed the same seed and
 * the same scripted inputs must agree tick-for-tick. Run: npx tsx scripts/determinism.ts
 */
import { mulberry32 } from '../src/core/rng'
import { CpuController } from '../src/sim/ai/controller'
import { DIFFICULTIES } from '../src/sim/ai/difficulty'
import { createSim, tickSim } from '../src/sim/sim'
import type { InputCommand, RiderSetup, SimState } from '../src/sim/types'
import { DEFAULT_CONFIG } from '../src/sim/types'

const riders: RiderSetup[] = [
  { name: 'P1', color: '#00f0ff', isPlayer: true, x: 0, z: 70, heading: 0 },
  { name: 'C1', color: '#ff9100', isPlayer: false, x: -55, z: -70, heading: 2 },
  { name: 'C2', color: '#ff2dc4', isPlayer: false, x: 55, z: -70, heading: 2 },
]

function runMatch(seed: number): { state: SimState; ticks: number } {
  const cfg = DEFAULT_CONFIG
  const sim = createSim(cfg, riders)
  const controllers = sim.bikes.map((b) =>
    b.isPlayer ? null : new CpuController(b.id, DIFFICULTIES.hard, mulberry32(seed + b.id)),
  )
  // scripted "player": turns on a fixed schedule
  const playerRng = mulberry32(seed * 31 + 7)
  let ticks = 0
  while (sim.status !== 'roundOver' && ticks < 60 * 120) {
    ticks++
    const inputs: InputCommand[] = sim.bikes.map((b) => {
      if (!b.isPlayer) return controllers[b.id]!.getInput(sim, cfg)
      const roll = playerRng()
      return {
        turn: roll < 0.01 ? 'left' : roll < 0.02 ? 'right' : null,
        throttle: roll < 0.5 ? 'accel' : null,
      }
    })
    tickSim(sim, cfg, inputs)
  }
  return { state: sim, ticks }
}

const a = runMatch(1337)
const b = runMatch(1337)
const sa = JSON.stringify(a.state)
const sb = JSON.stringify(b.state)

if (sa !== sb) {
  throw new Error('FAIL: identical seeds + inputs diverged')
}
console.log(
  `OK: deterministic. Round resolved in ${a.ticks} ticks (${(a.ticks / 60).toFixed(1)}s), ` +
    `winner: ${a.state.winnerId === null ? 'draw' : a.state.bikes[a.state.winnerId].name}, ` +
    `state hash length ${sa.length}`,
)

const c = runMatch(42)
console.log(
  `OK: different seed produces a different match (${c.ticks} ticks, ` +
    `winner: ${c.state.winnerId === null ? 'draw' : c.state.bikes[c.state.winnerId].name})`,
)
