/**
 * Fixed-timestep game loop: sim ticks at exactly 60 Hz regardless of display
 * refresh; render runs every animation frame with an interpolation alpha.
 */
export class GameLoop {
  private rafId = 0
  private last = 0
  private acc = 0
  private running = false

  constructor(
    private readonly dt: number,
    private readonly tick: () => void,
    private readonly render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    const frame = (now: number) => {
      if (!this.running) return
      const frameDt = Math.min((now - this.last) / 1000, 0.25)
      this.last = now
      this.acc += frameDt
      while (this.acc >= this.dt) {
        this.tick()
        this.acc -= this.dt
      }
      this.render(this.acc / this.dt, frameDt)
      this.rafId = requestAnimationFrame(frame)
    }
    this.rafId = requestAnimationFrame(frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }
}
