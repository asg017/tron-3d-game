// Mobile smoke test: iPhone emulation, swipe-to-turn, hold-drag throttle.
// Run: node scripts/smoke-mobile.mjs   (dev server must be up on :5173)
import { chromium, devices } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

const fail = (msg) => {
  console.error(`FAIL: ${msg}`)
  process.exitCode = 1
}

// dispatch a touch gesture as a series of TouchEvents on the canvas
const gesture = (steps) =>
  page.evaluate(async (steps) => {
    const canvas = document.querySelector('#scene canvas')
    const fire = (type, x, y) => {
      const touch = new Touch({ identifier: 7, target: canvas, clientX: x, clientY: y })
      canvas.dispatchEvent(
        new TouchEvent(type, {
          touches: type === 'touchend' ? [] : [touch],
          changedTouches: [touch],
          bubbles: true,
          cancelable: true,
        }),
      )
    }
    for (const [type, x, y, pause] of steps) {
      fire(type, x, y)
      if (pause) await new Promise((r) => setTimeout(r, pause))
    }
  }, steps)

const player = () =>
  page.evaluate(() => {
    const s = window.__NEONGRID.simState
    const p = s.bikes.find((b) => b.isPlayer)
    return { heading: p.heading, speed: p.speed, alive: p.alive, status: s.status }
  })

await page.goto('http://localhost:5173')
await page.waitForSelector('text=NEONGRID', { timeout: 15000 })
await page.screenshot({ path: '/tmp/tron-m-start.png' })
const hint = await page.textContent('.controls-hint')
if (!hint.includes('SWIPE')) fail(`start screen shows keyboard hint on touch device: "${hint}"`)
console.log('mobile start screen ok')

await page.tap('text=ENTER THE GRID')
await page.waitForSelector('.hud-hint', { state: 'visible', timeout: 5000 })
await page.screenshot({ path: '/tmp/tron-m-countdown.png' })
console.log('countdown + touch hint ok')

// wait for GO
await page.waitForFunction(() => window.__NEONGRID.simState.status === 'running', { timeout: 8000 })
await page.waitForTimeout(400)

// hold-drag up → speed should climb above cruise (26) while held
// (throttle tests run first, while the bike is far from any wall)
await gesture([
  ['touchstart', 200, 500, 30],
  ['touchmove', 200, 430, 700],
])
const boosted = await player()
await gesture([['touchend', 200, 430, 0]])
if (!(boosted.speed > 28)) fail(`hold-up boost: speed ${boosted.speed.toFixed(1)}, expected > 28`)
else console.log(`hold-up boost ok (speed ${boosted.speed.toFixed(1)})`)

// hold-drag down → speed should drop below cruise
await gesture([
  ['touchstart', 200, 400, 30],
  ['touchmove', 200, 470, 900],
])
const braked = await player()
await gesture([['touchend', 200, 470, 0]])
if (!(braked.speed < 24)) fail(`hold-down brake: speed ${braked.speed.toFixed(1)}, expected < 24`)
else console.log(`hold-down brake ok (speed ${braked.speed.toFixed(1)})`)

// swipe left → heading 0 (north) should become 3 (west)
let before = await player()
await gesture([
  ['touchstart', 200, 400, 30],
  ['touchmove', 160, 400, 30],
  ['touchmove', 110, 400, 30],
  ['touchend', 110, 400, 0],
])
await page.waitForTimeout(120)
let after = await player()
if (after.heading !== (before.heading + 3) % 4) {
  fail(`swipe left: heading ${before.heading} -> ${after.heading}, expected ${(before.heading + 3) % 4}`)
} else console.log('swipe left turns ok')

// swipe right back to original heading
before = after
await gesture([
  ['touchstart', 150, 400, 30],
  ['touchmove', 230, 400, 30],
  ['touchend', 230, 400, 0],
])
await page.waitForTimeout(120)
after = await player()
if (after.heading !== (before.heading + 1) % 4) {
  fail(`swipe right: heading ${before.heading} -> ${after.heading}, expected ${(before.heading + 1) % 4}`)
} else console.log('swipe right turns ok')

// one long fast flick (180px) must be exactly ONE turn, not a U-turn
before = await player()
let trailB4 = await page.evaluate(
  () => window.__NEONGRID.simState.bikes.find((b) => b.isPlayer).trail.length,
)
await gesture([
  ['touchstart', 280, 400, 16],
  ['touchmove', 240, 400, 16],
  ['touchmove', 190, 400, 16],
  ['touchmove', 140, 400, 16],
  ['touchmove', 100, 400, 16],
  ['touchend', 100, 400, 0],
])
await page.waitForTimeout(400)
after = await player()
let trailNow = await page.evaluate(
  () => window.__NEONGRID.simState.bikes.find((b) => b.isPlayer).trail.length,
)
if (after.heading !== (before.heading + 3) % 4 || trailNow !== trailB4 + 1) {
  fail(
    `long flick: heading ${before.heading} -> ${after.heading} (want one left), ` +
      `trail ${trailB4} -> ${trailNow} (want +1, +2 means U-turn bug)`,
  )
} else console.log('long flick = single turn ok (no U-turn)')

// push-pause-push in one stroke: pause re-arms, so two same-direction turns
before = await player()
trailB4 = trailNow
await gesture([
  ['touchstart', 300, 400, 16],
  ['touchmove', 270, 400, 16],
  ['touchmove', 240, 400, 250], // first turn, then hold still > REARM_STILL_MS
  ['touchmove', 210, 400, 16],
  ['touchmove', 175, 400, 16], // second push → second turn
  ['touchend', 175, 400, 0],
])
await page.waitForTimeout(400)
after = await player()
trailNow = await page.evaluate(
  () => window.__NEONGRID.simState.bikes.find((b) => b.isPlayer).trail.length,
)
if (after.heading !== (before.heading + 2) % 4 || trailNow !== trailB4 + 2) {
  fail(
    `push-pause-push: heading ${before.heading} -> ${after.heading} (want 180°), ` +
      `trail ${trailB4} -> ${trailNow} (want +2)`,
  )
} else console.log('push-pause-push deliberate double turn ok')

// zigzag without lifting: left then right in one continuous drag.
// the second turn lands inside the 150ms cooldown and must be buffered, then
// fire — net heading unchanged, two new trail corners.
before = await player()
const trailBefore = await page.evaluate(
  () => window.__NEONGRID.simState.bikes.find((b) => b.isPlayer).trail.length,
)
await gesture([
  ['touchstart', 200, 400, 16],
  ['touchmove', 178, 400, 16],
  ['touchmove', 152, 400, 16], // -48px → left turn
  ['touchmove', 176, 400, 16], // reversal: re-anchors at ~152
  ['touchmove', 200, 400, 16], // +48px from anchor → right turn (buffered)
  ['touchend', 200, 400, 0],
])
await page.waitForTimeout(400) // let the buffered turn clear the cooldown
after = await player()
const trailAfter = await page.evaluate(
  () => window.__NEONGRID.simState.bikes.find((b) => b.isPlayer).trail.length,
)
if (after.heading !== before.heading || trailAfter !== trailBefore + 2) {
  fail(
    `zigzag corner: heading ${before.heading} -> ${after.heading} (want same), ` +
      `trail ${trailBefore} -> ${trailAfter} (want +2)`,
  )
} else console.log('no-lift zigzag corner move ok')

// slow sideways drift must NOT trigger a turn (accidental-swipe guard)
before = await player()
const drift = [['touchstart', 260, 400, 0]]
for (let i = 1; i <= 12; i++) drift.push(['touchmove', 260 - i * 7, 400, 110]) // 84px over ~1.3s
drift.push(['touchend', 176, 400, 0])
await gesture(drift)
await page.waitForTimeout(150)
after = await player()
if (after.heading !== before.heading) {
  fail(`slow drift caused a turn: heading ${before.heading} -> ${after.heading}`)
} else console.log('slow-drift guard ok (no accidental turn)')

await page.screenshot({ path: '/tmp/tron-m-midgame.png' })

if (errors.length) fail('page errors:\n' + errors.join('\n'))
else console.log('no page errors')
await browser.close()
