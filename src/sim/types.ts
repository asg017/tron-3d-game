export type Turn = 'left' | 'right' | null
export type Throttle = 'accel' | 'brake' | null

/**
 * One bike's input for one tick. Player keyboard, CPU AI and (future) network
 * peers all produce these — the sim never knows the difference.
 */
export interface InputCommand {
  turn: Turn
  throttle: Throttle
}

export const noInput = (): InputCommand => ({ turn: null, throttle: null })

/** 0 = -Z (north), 1 = +X (east), 2 = +Z (south), 3 = -X (west) */
export type Heading = 0 | 1 | 2 | 3

export const DIRS: ReadonlyArray<{ x: number; z: number }> = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
]

export const turnedLeft = (h: Heading): Heading => (((h + 3) % 4) as Heading)
export const turnedRight = (h: Heading): Heading => (((h + 1) % 4) as Heading)

export interface TrailPoint {
  x: number
  z: number
}

export interface BikeState {
  id: number
  name: string
  /** css hex color, e.g. '#00f0ff' */
  color: string
  isPlayer: boolean
  alive: boolean
  x: number
  z: number
  prevX: number
  prevZ: number
  heading: Heading
  speed: number
  /** ticks until the next turn is allowed */
  turnCooldown: number
  /** corner points since spawn; the live wall runs from the last point to (x, z) */
  trail: TrailPoint[]
  /** ticks since crash (drives the derez fade) */
  derezTicks: number
}

export type SimStatus = 'countdown' | 'running' | 'roundOver'

export interface SimState {
  tick: number
  status: SimStatus
  countdownTicks: number
  roundOverTicks: number
  /** bike id of the round winner, or null (draw / not decided) */
  winnerId: number | null
  bikes: BikeState[]
}

export interface SimConfig {
  dt: number
  /** half-extent of the square arena */
  arenaHalf: number
  cruiseSpeed: number
  maxSpeed: number
  minSpeed: number
  accel: number
  brake: number
  /** rate at which speed relaxes back to cruise with no throttle input */
  cruiseEase: number
  /** speed multiplier applied on each 90° turn */
  turnPenalty: number
  turnCooldownTicks: number
  /** collision half-thickness of trail walls */
  trailRadius: number
  /** bike vs bike collision radius */
  headRadius: number
  countdownTicks: number
}

export const DEFAULT_CONFIG: SimConfig = {
  dt: 1 / 60,
  arenaHalf: 100,
  cruiseSpeed: 26,
  maxSpeed: 42,
  minSpeed: 14,
  accel: 20,
  brake: 34,
  cruiseEase: 7,
  turnPenalty: 0.8,
  turnCooldownTicks: 9,
  trailRadius: 0.35,
  headRadius: 1.3,
  countdownTicks: 180,
}

export interface RiderSetup {
  name: string
  color: string
  isPlayer: boolean
  x: number
  z: number
  heading: Heading
}
