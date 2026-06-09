import type { SimConfig, SimState } from '../sim/types'
import { el, uiRoot } from './dom'

/** In-game overlay: per-rider round pips, speed bar, countdown numerals. */
export class Hud {
  private readonly root: HTMLElement
  private readonly riderEls: { wrap: HTMLElement; pips: HTMLElement }[] = []
  private readonly fill: HTMLElement
  private readonly countdown: HTMLElement
  private lastCountText = ''

  constructor(state: SimState, private readonly winsNeeded: number) {
    this.root = el('div', '', uiRoot())

    const scores = el('div', 'hud-scores fade-in', this.root)
    for (const b of state.bikes) {
      const wrap = el('div', 'hud-rider', scores)
      wrap.style.setProperty('--rc', b.color)
      el('div', 'rname', wrap, b.name)
      const pips = el('div', 'pips', wrap, '')
      this.riderEls.push({ wrap, pips })
    }

    const speed = el('div', 'hud-speed', this.root)
    const bar = el('div', 'bar', speed)
    this.fill = el('div', 'fill', bar)
    el('div', 'spd-label', speed, 'VELOCITY')

    this.countdown = el('div', 'hud-countdown', this.root, '')
    this.countdown.style.display = 'none'
  }

  update(state: SimState, cfg: SimConfig, scores: number[]): void {
    for (const b of state.bikes) {
      const r = this.riderEls[b.id]
      r.wrap.classList.toggle('dead', !b.alive)
      r.pips.textContent = '●'.repeat(scores[b.id]) + '○'.repeat(this.winsNeeded - scores[b.id])
    }

    const player = state.bikes.find((b) => b.isPlayer)
    if (player) {
      const frac = (player.speed - cfg.minSpeed) / (cfg.maxSpeed - cfg.minSpeed)
      this.fill.style.width = `${Math.round(frac * 100)}%`
      this.fill.style.setProperty('--neon', player.color)
      this.fill.style.background = player.color
      this.fill.style.boxShadow = `0 0 12px ${player.color}`
    }

    let text = ''
    if (state.status === 'countdown') {
      text = String(Math.max(1, Math.ceil(state.countdownTicks / 60)))
    } else if (state.status === 'running' && state.tick < 60 + cfg.countdownTicks) {
      text = 'GO'
    }
    if (text !== this.lastCountText) {
      this.lastCountText = text
      this.countdown.textContent = text
      this.countdown.style.display = text ? 'block' : 'none'
    }
  }

  dispose(): void {
    this.root.remove()
  }
}
