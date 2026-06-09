import { el, uiRoot } from './dom'

export interface ScoreLine {
  name: string
  color: string
  wins: number
}

function scoreboard(parent: HTMLElement, lines: ScoreLine[], winsNeeded: number): void {
  const board = el('div', 'scoreboard', parent)
  for (const line of [...lines].sort((a, b) => b.wins - a.wins)) {
    const row = el('div', 'score-row', board)
    row.style.setProperty('--rc', line.color)
    el('span', '', row, line.name)
    el('span', '', row, '●'.repeat(line.wins) + '○'.repeat(winsNeeded - line.wins))
  }
}

/** Between-rounds banner; resolves when it auto-dismisses. */
export function showRoundScreen(
  title: string,
  color: string,
  lines: ScoreLine[],
  winsNeeded: number,
  ms: number,
): Promise<void> {
  const screen = el('div', 'screen fade-in', uiRoot())
  const t = el('div', 'banner-title', screen, title)
  t.style.setProperty('--bc', color)
  scoreboard(screen, lines, winsNeeded)
  return new Promise((resolve) => {
    setTimeout(() => {
      screen.remove()
      resolve()
    }, ms)
  })
}

export function showGameOverScreen(
  title: string,
  color: string,
  lines: ScoreLine[],
  winsNeeded: number,
  onRematch: () => void,
  onMenu: () => void,
): void {
  const screen = el('div', 'screen fade-in', uiRoot())
  el('div', 'subtitle', screen, 'MATCH COMPLETE')
  const t = el('div', 'banner-title', screen, title)
  t.style.setProperty('--bc', color)
  scoreboard(screen, lines, winsNeeded)

  const panel = el('div', 'panel', screen)
  panel.style.minWidth = '320px'
  const rematch = el('button', 'big-btn', panel, 'REMATCH')
  const menu = el('button', 'big-btn', panel, 'MAIN MENU')
  rematch.addEventListener('click', () => {
    screen.remove()
    onRematch()
  })
  menu.addEventListener('click', () => {
    screen.remove()
    onMenu()
  })
}
