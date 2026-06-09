// Browser smoke test: start screen → ENTER THE GRID → countdown → mid-game.
// Run: node scripts/smoke.mjs   (dev server must be up on :5173)
import { chromium } from 'playwright'

const shot = (page, name) => page.screenshot({ path: `/tmp/tron-${name}.png` })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

await page.goto('http://localhost:5173')
await page.waitForSelector('text=NEONGRID', { timeout: 15000 })
await page.waitForTimeout(800)
await shot(page, 'start')
console.log('start screen rendered')

await page.fill('input.name-input', 'ALEX')
await page.click('.swatch >> nth=2') // magenta
await page.click('.choice >> text=HARD')
await page.click('text=ENTER THE GRID')
await page.waitForTimeout(1200) // mid-countdown
await shot(page, 'countdown')
console.log('countdown showing')

await page.waitForTimeout(4000) // ~2s after GO: trails forming
await shot(page, 'midgame')
console.log('mid-game captured')

await page.waitForTimeout(6000) // later: AI turns, longer trails
await shot(page, 'lategame')
console.log('late-game captured')

if (errors.length) {
  console.log('PAGE ERRORS:\n' + errors.join('\n'))
} else {
  console.log('no console errors')
}
await browser.close()
