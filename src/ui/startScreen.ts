import { IS_TOUCH } from '../core/platform'
import type { Difficulty } from '../sim/ai/difficulty'
import { NEON_COLORS } from '../theme'
import { el, uiRoot } from './dom'

export interface PlayerSetup {
  name: string
  color: string
  difficulty: Difficulty
}

const STORAGE_KEY = 'neongrid.setup'

function loadSaved(): PlayerSetup {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults(), ...JSON.parse(raw) }
  } catch {
    /* ignore corrupt storage */
  }
  return defaults()
}

const defaults = (): PlayerSetup => ({ name: 'PLAYER', color: NEON_COLORS[0].hex, difficulty: 'medium' })

export function showStartScreen(onStart: (setup: PlayerSetup) => void): void {
  const saved = loadSaved()
  const screen = el('div', 'screen fade-in', uiRoot())

  el('div', 'title', screen, 'NEONGRID')
  el('div', 'subtitle', screen, 'LIGHT CYCLE ARENA')

  const panel = el('div', 'panel', screen)

  // name
  const nameWrap = el('div', '', panel)
  el('div', 'field-label', nameWrap, 'RIDER NAME')
  const nameInput = el('input', 'name-input', nameWrap)
  nameInput.maxLength = 12
  nameInput.value = saved.name
  nameInput.placeholder = 'PLAYER'

  // color
  let color = saved.color
  const colorWrap = el('div', '', panel)
  el('div', 'field-label', colorWrap, 'CYCLE COLOR')
  const swatches = el('div', 'swatches', colorWrap)
  const swatchEls = NEON_COLORS.map((c) => {
    const s = el('button', 'swatch', swatches)
    s.style.setProperty('--c', c.hex)
    s.title = c.name
    if (c.hex === color) s.classList.add('selected')
    s.addEventListener('click', () => {
      color = c.hex
      swatchEls.forEach((other) => other.classList.remove('selected'))
      s.classList.add('selected')
    })
    return s
  })

  // difficulty
  let difficulty = saved.difficulty
  const diffWrap = el('div', '', panel)
  el('div', 'field-label', diffWrap, 'OPPONENT DIFFICULTY')
  const choices = el('div', 'choices', diffWrap)
  const diffEls = (['easy', 'medium', 'hard'] as const).map((d) => {
    const b = el('button', 'choice', choices, d.toUpperCase())
    if (d === difficulty) b.classList.add('selected')
    b.addEventListener('click', () => {
      difficulty = d
      diffEls.forEach((other) => other.classList.remove('selected'))
      b.classList.add('selected')
    })
    return b
  })

  const start = el('button', 'big-btn', panel, 'ENTER THE GRID')
  el(
    'div',
    'controls-hint',
    panel,
    IS_TOUCH
      ? 'SWIPE ◀ ▶  TURN\nHOLD & DRAG  ▲ BOOST · ▼ BRAKE\nFIRST TO 3 ROUNDS WINS'
      : 'A / D or ◀ ▶  TURN     W / ▲  ACCELERATE     S / ▼  BRAKE\nFIRST TO 3 ROUNDS WINS',
  )

  const begin = () => {
    const setup: PlayerSetup = {
      name: (nameInput.value.trim() || 'PLAYER').toUpperCase(),
      color,
      difficulty,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(setup))
    } catch {
      /* storage unavailable */
    }
    if (IS_TOUCH && typeof document.documentElement.requestFullscreen === 'function') {
      // best-effort immersion; iPhone Safari has no fullscreen API — fine without
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    }
    screen.remove()
    onStart(setup)
  }

  start.addEventListener('click', begin)
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') begin()
  })
}
