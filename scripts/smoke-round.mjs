// Verifies a full round resolves: banner appears with scoreboard, then round 2 starts.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto('http://localhost:5173')
await page.waitForSelector('text=NEONGRID', { timeout: 15000 })
await page.click('text=ENTER THE GRID')

await page.waitForSelector('.banner-title', { timeout: 120000 })
const banner = await page.textContent('.banner-title')
await page.screenshot({ path: '/tmp/tron-roundend.png' })
console.log(`round banner: "${banner}"`)

// banner auto-dismisses after 2.4s, then round 2 countdown begins
await page.waitForSelector('.hud-countdown:visible', { timeout: 10000 })
console.log('round 2 countdown started')
await page.screenshot({ path: '/tmp/tron-round2.png' })

console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors')
await browser.close()
