import type { InputCommand, Turn } from '../sim/types'

/**
 * Keyboard → InputCommand. Turns are edge-triggered (one turn per key press,
 * buffered until the next sim tick); throttle is level-triggered (held keys).
 * Arrows or WASD.
 */
export class KeyboardInput {
  private queuedTurn: Turn = null
  private accelHeld = false
  private brakeHeld = false

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.queuedTurn = 'left'
        e.preventDefault()
        break
      case 'ArrowRight':
      case 'KeyD':
        this.queuedTurn = 'right'
        e.preventDefault()
        break
      case 'ArrowUp':
      case 'KeyW':
        this.accelHeld = true
        e.preventDefault()
        break
      case 'ArrowDown':
      case 'KeyS':
        this.brakeHeld = true
        e.preventDefault()
        break
    }
  }

  private readonly onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.accelHeld = false
        break
      case 'ArrowDown':
      case 'KeyS':
        this.brakeHeld = false
        break
    }
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.queuedTurn = null
    this.accelHeld = false
    this.brakeHeld = false
  }

  /** Read this tick's command; consumes the buffered turn. */
  consume(): InputCommand {
    const turn = this.queuedTurn
    this.queuedTurn = null
    return {
      turn,
      throttle: this.accelHeld ? 'accel' : this.brakeHeld ? 'brake' : null,
    }
  }
}
