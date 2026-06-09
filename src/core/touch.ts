import type { InputCommand, Throttle, Turn } from '../sim/types'

/** horizontal swipe distance (css px) per 90° turn step */
const TURN_STEP_PX = 44
/** vertical dead zone before a held drag becomes throttle */
const THROTTLE_DEAD_PX = 30
/** a turn's worth of motion must happen within this window — slower drift never triggers */
const SWIPE_WINDOW_MS = 400
/** ignore sub-jitter horizontal motion when detecting direction reversals */
const JITTER_PX = 3
/** thumb held still this long re-arms the stroke for another same-direction turn */
const REARM_STILL_MS = 160

/**
 * One-thumb touch controls, same InputCommand interface as the keyboard:
 *
 * - swipe left/right            → one 90° turn per stroke, however far the
 *   swipe travels (no accidental U-turns from a long flick)
 * - reverse direction mid-drag  → re-arms and re-anchors at the turnaround
 *   point, so zigzag corner moves (left then right) chain without lifting
 * - pause mid-drag              → re-arms, so a deliberate push-pause-push
 *   chains same-direction turns without lifting
 * - hold and drag up / down     → accelerate / brake while held
 *
 * Guards against accidental turns: a stroke fires at most one turn per
 * direction segment, displacement only counts inside SWIPE_WINDOW_MS (slow
 * thumb drift re-anchors instead of accumulating), and touches that start on
 * UI elements are ignored entirely.
 */
export class TouchInput {
  private touchId: number | null = null
  private refX = 0
  private refT = 0
  private prevX = 0
  private lastMoveDir = 0
  private lastMoveT = 0
  private armed = true
  private originY = 0
  private queuedTurn: Turn = null
  private throttle: Throttle = null

  private readonly onStart = (e: TouchEvent) => {
    if (onUi(e) || this.touchId !== null) return
    const t = e.changedTouches[0]
    this.touchId = t.identifier
    this.refX = t.clientX
    this.prevX = t.clientX
    this.refT = performance.now()
    this.lastMoveT = this.refT
    this.lastMoveDir = 0
    this.armed = true
    this.originY = t.clientY
    if (e.cancelable) e.preventDefault()
  }

  private readonly onMove = (e: TouchEvent) => {
    if (onUi(e)) return
    const t = this.tracked(e)
    if (!t) return
    if (e.cancelable) e.preventDefault()
    const now = performance.now()

    const stepDx = t.clientX - this.prevX
    if (Math.abs(stepDx) > JITTER_PX) {
      // motion resuming after a standstill is a deliberate new push: re-arm
      if (now - this.lastMoveT > REARM_STILL_MS) {
        this.armed = true
        this.refX = this.prevX
        this.refT = now
      }
      this.lastMoveT = now

      // reversal re-arms and re-anchors at the turnaround point, so the
      // return stroke of a zigzag needs only TURN_STEP_PX of travel
      const dir = Math.sign(stepDx)
      if (this.lastMoveDir !== 0 && dir !== this.lastMoveDir) {
        this.armed = true
        this.refX = this.prevX
        this.refT = now
      }
      this.lastMoveDir = dir
    }
    this.prevX = t.clientX

    // too slow to be a swipe: follow along instead of accumulating
    if (now - this.refT > SWIPE_WINDOW_MS) {
      this.refX = t.clientX
      this.refT = now
    }

    const dx = t.clientX - this.refX
    if (this.armed && Math.abs(dx) >= TURN_STEP_PX) {
      this.queuedTurn = dx > 0 ? 'right' : 'left'
      // disarm: the rest of this stroke can't fire again in this direction,
      // however far it travels — one swipe, one turn
      this.armed = false
      this.refX = t.clientX
      this.refT = now
    }

    const dy = t.clientY - this.originY
    this.throttle = dy < -THROTTLE_DEAD_PX ? 'accel' : dy > THROTTLE_DEAD_PX ? 'brake' : null
  }

  private readonly onEnd = (e: TouchEvent) => {
    if (!this.tracked(e)) return
    this.touchId = null
    this.throttle = null
  }

  private tracked(e: TouchEvent): globalThis.Touch | null {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.touchId) return t
    }
    return null
  }

  attach(): void {
    window.addEventListener('touchstart', this.onStart, { passive: false })
    window.addEventListener('touchmove', this.onMove, { passive: false })
    window.addEventListener('touchend', this.onEnd)
    window.addEventListener('touchcancel', this.onEnd)
  }

  detach(): void {
    window.removeEventListener('touchstart', this.onStart)
    window.removeEventListener('touchmove', this.onMove)
    window.removeEventListener('touchend', this.onEnd)
    window.removeEventListener('touchcancel', this.onEnd)
    this.touchId = null
    this.queuedTurn = null
    this.throttle = null
  }

  /** Read this tick's command; consumes the buffered turn. */
  consume(): InputCommand {
    const turn = this.queuedTurn
    this.queuedTurn = null
    return { turn, throttle: this.throttle }
  }
}

function onUi(e: TouchEvent): boolean {
  return e.target instanceof Element && e.target.closest('#ui') !== null
}
