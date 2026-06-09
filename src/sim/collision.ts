import type { BikeState } from './types'

/**
 * All trail geometry is axis-aligned (90° turns only), so every wall segment
 * is an axis-aligned box once inflated by the trail radius. Collision and AI
 * raycasts reduce to interval overlap tests — exact and cheap.
 */
export interface Seg {
  x1: number
  z1: number
  x2: number
  z2: number
  owner: number
  kind: 'fixed' | 'live'
  /** for fixed segs: index into the owner's trail (seg i = point i -> point i+1) */
  index: number
}

/** Solid wall segments for every currently-alive bike (crashed trails derez and stop being solid). */
export function collectSegs(bikes: BikeState[]): Seg[] {
  const segs: Seg[] = []
  for (const b of bikes) {
    if (!b.alive) continue
    const t = b.trail
    for (let i = 0; i < t.length - 1; i++) {
      segs.push({ x1: t[i].x, z1: t[i].z, x2: t[i + 1].x, z2: t[i + 1].z, owner: b.id, kind: 'fixed', index: i })
    }
    const last = t[t.length - 1]
    segs.push({ x1: last.x, z1: last.z, x2: b.x, z2: b.z, owner: b.id, kind: 'live', index: t.length - 1 })
  }
  return segs
}

/**
 * A bike can never legitimately hit its own newest wall pieces (they share an
 * endpoint with its movement), so those are excluded from its checks.
 */
export function isOwnFreshSeg(seg: Seg, bike: BikeState): boolean {
  if (seg.owner !== bike.id) return false
  return seg.kind === 'live' || seg.index === bike.trail.length - 2
}

/** Overlap test between two axis-aligned segments, the second inflated by radius r. Exact for AA boxes. */
export function segsOverlap(
  ax1: number, az1: number, ax2: number, az2: number,
  bx1: number, bz1: number, bx2: number, bz2: number,
  r: number,
): boolean {
  const aMinX = Math.min(ax1, ax2)
  const aMaxX = Math.max(ax1, ax2)
  const aMinZ = Math.min(az1, az2)
  const aMaxZ = Math.max(az1, az2)
  const bMinX = Math.min(bx1, bx2) - r
  const bMaxX = Math.max(bx1, bx2) + r
  const bMinZ = Math.min(bz1, bz2) - r
  const bMaxZ = Math.max(bz1, bz2) + r
  return aMinX <= bMaxX && aMaxX >= bMinX && aMinZ <= bMaxZ && aMaxZ >= bMinZ
}

/**
 * Distance from (px, pz) along axis direction (dx, dz) until the first wall
 * or trail segment, capped at maxDist. Used by both AI lookahead and HUD.
 */
export function rayClearance(
  px: number, pz: number,
  dx: number, dz: number,
  maxDist: number,
  segs: Seg[],
  skip: (s: Seg) => boolean,
  arenaHalf: number,
  r: number,
): number {
  let best = maxDist

  // arena walls
  if (dx > 0) best = Math.min(best, arenaHalf - r - px)
  else if (dx < 0) best = Math.min(best, px - (-arenaHalf + r))
  else if (dz > 0) best = Math.min(best, arenaHalf - r - pz)
  else best = Math.min(best, pz - (-arenaHalf + r))

  for (const s of segs) {
    if (skip(s)) continue
    const minX = Math.min(s.x1, s.x2) - r
    const maxX = Math.max(s.x1, s.x2) + r
    const minZ = Math.min(s.z1, s.z2) - r
    const maxZ = Math.max(s.z1, s.z2) + r
    let t: number
    if (dx !== 0) {
      if (pz < minZ || pz > maxZ) continue
      t = dx > 0 ? minX - px : px - maxX
      // already inside the inflated box and it extends ahead of us
      if (t < 0 && (dx > 0 ? maxX >= px : minX <= px)) t = 0
    } else {
      if (px < minX || px > maxX) continue
      t = dz > 0 ? minZ - pz : pz - maxZ
      if (t < 0 && (dz > 0 ? maxZ >= pz : minZ <= pz)) t = 0
    }
    if (t >= 0 && t < best) best = t
  }
  return Math.max(0, best)
}
