// The installed app's launch page (ROADMAP item 56), end to end, with no Foundry: the stone that lights
// as the installed app opens, the worker that keeps it, and what neither may ever do. A browser's tab,
// and a browser's window made full screen, get nothing: no page of the app registers a worker, and
// /launch typed in hands over as it is. What the server sends for the page and its two workers. Then
// the app installed on a Pixel 7: the first opening from the server, the worker registered by the
// launch page for /launch alone and keeping that one page; the second opening from the worker, its
// rune watched lighting while the first page is held; Back; no other page controlled. Signed out; the
// device offline, upright, on its side and short and narrow, with Try again; back online with its
// first ask unanswered, and nothing said while the first page is on its way; a first page that
// doesn't come; reduced motion; a light device and a dark one. And the way out: an older worker
// replaced, the retiring worker, an iPhone's Home Screen app.
//
// "Installed" is an init script that answers the display mode, or navigator.standalone: headless
// Chromium installs nothing. What only a phone shows (its own launch screen giving way to this page,
// how long it takes, whether an iPhone finishes installing a worker whose page has left) is on the
// device checklist. A really changed worker file taking the place of the one before it can't be
// shown here: the lanes share one build, and a route never sees a worker script's update.
//
// No check takes a fixed wait as its proof: each waits for the thing itself, and the one that moves the
// page's clock stops it first, as an installed clock otherwise runs on by itself. /launch is opened with
// waitUntil 'commit', as its own script leaves while it is still being read; and while its first page
// is held the page tells the suite what it shows through a binding, as page.evaluate waits for a held
// navigation. A look at what the browser keeps, taken while a worker may be deleting, reads the caches'
// names and opens none: opening a cache makes it. Synthetic data only (seed.sql's Alice and her
// Thorin). Screenshots to SHOTS.
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { chromium, devices, request } from 'playwright'
import { BASE, cookieFor } from './env.mjs'

const SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const ALICE = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const began = Date.now()
const part = name => console.log(`# ${name}, at ${((Date.now() - began) / 1000).toFixed(1)} s`)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
/** What `test` answers, once it answers something; a look that fails meanwhile, as one made while a page leaves, is taken again. */
async function until(test, what, ms = 15_000) {
  const end = Date.now() + ms
  for (;;) {
    const got = await Promise.resolve().then(test).catch(() => undefined)
    if (got) return got
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(50)
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const shoot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/launch-${name}.png` }) }
const at = page => new URL(page.url()).pathname

const PIXEL = devices['Pixel 7']
const IPHONE = devices['iPhone 15']
const NIGHT = 'rgb(13, 13, 20)'
const WORKER = '/launch-worker.js'
const KEPT = 'sending-stone-launch-'
const UNREACHED = 'Sending Stone couldn’t be reached.'
const OFFLINE = `${UNREACHED} It opens once you’re back online. Try again`

// ---- What stands in for a device ----
/** The page runs as an app of its own, which it reads from its display mode: installed, or a browser's window made full screen. */
const displayMode = (context, mode) => context.addInitScript(mode => {
  const own = window.matchMedia.bind(window)
  window.matchMedia = query => (query.split(',').some(one => one.trim() === `(display-mode: ${mode})`)
    ? { matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
    : own(query))
}, mode)
/** The Home Screen app of an iPhone, which says so on navigator.standalone. */
const homeScreen = context => context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true }))
/** Each call a page makes to register a worker, kept by its tab from page to page, so that a look once the page has settled misses none. */
const countRegisters = context => context.addInitScript(() => {
  if (!('serviceWorker' in navigator)) return
  const own = ServiceWorkerContainer.prototype.register
  ServiceWorkerContainer.prototype.register = function (script, options) {
    const calls = JSON.parse(sessionStorage.getItem('launch-registers') ?? '[]')
    sessionStorage.setItem('launch-registers', JSON.stringify([...calls, { script: String(script), ...options }]))
    return own.call(this, script, options)
  }
})
/**
 * What the launch page tells of itself while it shows: its look as it is first drawn, which of the
 * rune's parts are lit and what it says every 40 ms, and how each of its own asks of the server ended.
 */
async function listen(context) {
  const told = { look: undefined, lit: [], said: [], asks: [] }
  await context.exposeBinding('launchTells', (_source, what, value) => { if (what === 'look') told.look = value; else told[what].push(value) })
  await context.addInitScript(() => {
    if (location.pathname !== '/launch') return
    const own = window.fetch
    window.fetch = (...args) => {
      const asked = own(...args)
      asked.then(() => window.launchTells('asks', 'answered'), () => window.launchTells('asks', 'unanswered'))
      return asked
    }
    const lit = () => ['.dot', '.inner', '.outer'].map(part => (Number(getComputedStyle(document.querySelector(part)).opacity) > 0.5 ? part[1] : '')).join('')
    const said = () => {
      const words = document.getElementById('unreached')
      return { body: document.body.className, words: words.hidden ? null : words.innerText.replace(/\s+/g, ' ').trim() }
    }
    const begin = () => {
      const box = document.querySelector('.stone').getBoundingClientRect()
      window.launchTells('look', {
        background: getComputedStyle(document.body).backgroundColor,
        theme: document.querySelector('meta[name="theme-color"]').content,
        stone: [box.width, box.height],
        centred: Math.abs(box.x + box.width / 2 - innerWidth / 2) < 0.6 && Math.abs(box.y + box.height / 2 - innerHeight / 2) < 0.6,
        status: document.querySelector('[role="status"]').textContent.trim(),
        title: document.title,
      })
      setInterval(() => { window.launchTells('lit', lit()); window.launchTells('said', said()) }, 40)
    }
    // Not on DOMContentLoaded: the page's own script leaves at once, and the document never says it has loaded.
    const drawn = setInterval(() => { if (document.querySelector('.stone svg')) { clearInterval(drawn); begin() } }, 10)
  })
  return told
}
/** A device's browser with the app in it: installed or not, signed in as Alice or not. */
async function device({ installed = false, signedIn = true, ...options }) {
  const context = await browser.newContext(options)
  if (installed === 'home screen') await homeScreen(context)
  else if (installed) await displayMode(context, 'standalone')
  if (signedIn) await context.addCookies([ALICE])
  await countRegisters(context)
  const told = await listen(context)
  return { context, told, page: await context.newPage() }
}

// ---- Looks ----
/**
 * What a page's browser holds for the app: its tab's calls to register, the registrations, and its caches' names.
 * Their names alone: caches.open() makes the cache it is asked for, so a look that opened each one to list it would
 * bring back, empty, a cache a worker deleted between the two. keptPage() looks inside, once nothing is changing.
 */
const workers = page => page.evaluate(async () => {
  // A registration stands for a moment with no worker to name, as it is made and as it goes.
  const worker = registration => registration.active ?? registration.waiting ?? registration.installing
  const script = registration => { const own = worker(registration); if (!own) return null; const url = new URL(own.scriptURL); return url.pathname + url.search }
  return {
    calls: JSON.parse(sessionStorage.getItem('launch-registers') ?? '[]'),
    registrations: (await navigator.serviceWorker.getRegistrations()).map(registration => ({ scope: new URL(registration.scope).pathname, script: script(registration), state: worker(registration)?.state ?? null, updateViaCache: registration.updateViaCache })),
    kept: await caches.keys(),
  }
})
const nothing = held => held.calls.length === 0 && held.registrations.length === 0 && held.kept.length === 0
/** The launch worker, active for /launch alone. */
const active = page => until(async () => {
  const { registrations } = await workers(page)
  return registrations.length === 1 && registrations[0].script === WORKER && registrations[0].state === 'activated' && registrations
}, 'the launch worker to be active')
/** The one page the launch worker keeps, looked at while no worker is deleting: what its cache holds, and the page's bytes' digest, taken in the page. */
const keptPage = page => page.evaluate(async prefix => {
  const names = (await caches.keys()).filter(name => name.startsWith(prefix))
  if (names.length !== 1) return { names, entries: [] }
  const cache = await caches.open(names[0])
  const entries = (await cache.keys()).map(entry => new URL(entry.url).pathname)
  const kept = await cache.match('/launch')
  if (!kept) return { names, entries }
  const digest = await crypto.subtle.digest('SHA-256', await kept.arrayBuffer())
  return { names, entries, type: kept.headers.get('content-type'), status: kept.status, sha: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') }
}, KEPT)
/** Your characters, read and hydrated: Thorin's row, which comes in behind its outline, and the theme's toggle. */
const characters = async (page, timeout = 30_000) => {
  await page.getByRole('link', { name: /Thorin/ }).waitFor({ timeout })
  await page.getByRole('radio', { name: 'System', checked: true }).waitFor({ timeout })
}
const isLaunch = response => new URL(response.url()).pathname === '/launch' && response.request().isNavigationRequest()
/** Opens the app as a tap on its icon does, at /launch; says where its page came from and, unless it's to stay, where it ended. */
async function open(page, { settle = true } = {}) {
  const [response] = await Promise.all([page.waitForResponse(isLaunch), page.goto(`${BASE}/launch`, { waitUntil: 'commit' })])
  if (settle) await page.waitForURL(url => url.pathname !== '/launch', { timeout: 15_000 })
  return { fromWorker: response.fromServiceWorker(), at: at(page) }
}
/** The launch page as it stands, where nothing is on its way: the stone, the rune and its words. */
const standing = page => page.evaluate(() => {
  const box = element => { const b = element.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom } }
  const stone = box(document.querySelector('.stone'))
  const said = document.getElementById('unreached')
  const words = box(said)
  const again = box(document.getElementById('again'))
  const image = document.querySelector('.stone img')
  const text = document.createRange()
  text.selectNodeContents(said)
  // The least room between the screen's sides and the stone, the words' own text or Try again.
  const gutter = Math.min(...[stone, box(text), again].flatMap(({ left, right }) => [left, innerWidth - right]))
  return {
    at: location.pathname,
    body: document.body.className,
    background: getComputedStyle(document.body).backgroundColor,
    drawn: image.complete && image.naturalWidth > 0,
    size: [stone.right - stone.left, stone.bottom - stone.top],
    centred: Math.abs((stone.left + stone.right) / 2 - innerWidth / 2) < 0.6 && Math.abs((stone.top + stone.bottom) / 2 - innerHeight / 2) < 0.6,
    lit: ['.dot', '.inner', '.outer'].map(part => getComputedStyle(document.querySelector(part)).opacity),
    animating: document.getAnimations().length,
    words: said.hidden ? null : said.innerText.replace(/\s+/g, ' ').trim(),
    under: words.top >= stone.bottom,
    beside: words.left >= stone.right - 0.5 && words.top < stone.bottom && words.bottom > stone.top,
    within: words.left >= 0 && words.right <= innerWidth && again.left >= 0 && again.top >= 0 && again.right <= innerWidth && again.bottom <= innerHeight,
    gutter: Math.round(gutter),
    scrolls: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
    light: matchMedia('(prefers-color-scheme: light)').matches,
  }
})
/** The launch page kept where it is, its first page answered with nothing to show, so that it can be looked at. */
async function staying(context, page) {
  await context.route('**/characters', route => route.fulfill({ status: 204 }))
  await page.goto(`${BASE}/launch`, { waitUntil: 'commit' })
  await page.waitForFunction(() => document.querySelector('.stone img')?.complete)
}
/** Back, as the device's own: every page it passed through on its way to your characters. */
async function back(page) {
  const through = []
  const passed = frame => { if (frame === page.mainFrame()) through.push(new URL(frame.url()).pathname) }
  page.on('framenavigated', passed)
  await page.goBack().catch(() => {})
  await characters(page, 10_000).catch(() => {})
  page.off('framenavigated', passed)
  return { at: at(page), through }
}
/** The rune's states in the order they were seen, each once. */
const states = lit => lit.filter((state, index) => index === 0 || state !== lit[index - 1])
// The dot; the dot and the inner arc; all three; dark; and again.
const TWICE = ['d', 'di', 'dio', '', 'd', 'di', 'dio']
const lightsTwice = order => order.some((_, from) => TWICE.every((state, index) => order[from + index] === state))

const browser = await chromium.launch()
const api = await request.newContext()

// =================================================================================================
part('1. a browser, not installed')
// =================================================================================================
{
  const tab = await device({ viewport: { width: 1100, height: 800 } })
  await tab.page.goto(`${BASE}/characters`)
  await characters(tab.page)
  await tab.page.goto(`${BASE}/characters/seedthorin`)
  await tab.page.getByRole('heading', { level: 1, name: 'Thorin Oakenshield', exact: true }).waitFor()
  await tab.page.goto(`${BASE}/characters`)
  await characters(tab.page)
  let held = await workers(tab.page)
  check(nothing(held), `in a browser's tab, your characters and a character's page register no worker, and nothing is kept (${JSON.stringify(held)})`)
  const typed = await open(tab.page)
  await characters(tab.page)
  held = await workers(tab.page)
  check(!typed.fromWorker && typed.at === '/characters' && nothing(held), `/launch typed into that tab hands over to your characters, and still registers nothing (${JSON.stringify({ typed, held })})`)
  await tab.context.close()

  // A browser's own window made full screen matches (display-mode: fullscreen), as an installed app doesn't.
  const full = await device({ viewport: { width: 1100, height: 800 } })
  await displayMode(full.context, 'fullscreen')
  const filled = await open(full.page)
  await characters(full.page)
  held = await workers(full.page)
  check(await full.page.evaluate(() => matchMedia('(display-mode: fullscreen)').matches && !matchMedia('(display-mode: standalone)').matches) && filled.at === '/characters' && nothing(held),
    `nor does it in a browser's window made full screen (${JSON.stringify({ filled, held })})`)
  await full.context.close()
}

// =================================================================================================
part('2. what the server sends')
// =================================================================================================
const served = await api.get(`${BASE}/launch`)
const body = await served.body()
const html = body.toString('utf8')
{
  const named = [...html.matchAll(/\s(?:src|href)="([^"]*)"/g)].map(([, address]) => address)
  const head = await api.head(`${BASE}/launch`)
  check(served.status() === 200 && served.headers()['content-type'] === 'text/html; charset=utf-8' && served.headers()['cache-control'] === 'no-cache'
    && html.split('<script').length === 2 && !html.includes('/_next/') && named.length === 2 && named.includes('/manifest.webmanifest')
    && named.some(address => address.startsWith('data:image/png;base64,')) && head.status() === 200 && head.headers()['cache-control'] === 'no-cache',
    `GET /launch, signed out: 200, HTML, never cached, one document with one script, naming only the manifest and its own image, no file of a build; HEAD 200 too (${body.length} bytes, ${served.headers()['cache-control']})`)
  const asAlice = await api.get(`${BASE}/launch`, { headers: { cookie: `${ALICE.name}=${ALICE.value}` } })
  check(asAlice.status() === 200 && (await asAlice.body()).equals(body) && !html.includes('Alice'), "with Alice's session it is the same page, byte for byte, with nothing of hers in it")
  const worker = await api.get(`${BASE}${WORKER}`)
  const retiring = await api.get(`${BASE}/launch-worker-retire.js`)
  check(worker.status() === 200 && /javascript/.test(worker.headers()['content-type']) && worker.headers()['cache-control'] === 'no-cache, no-store, must-revalidate'
    && worker.headers()['content-security-policy'] === "default-src 'self'" && retiring.status() === 200 && /javascript/.test(retiring.headers()['content-type']),
    `GET ${WORKER}: 200, JavaScript, never cached nor stored, and it may fetch from this app alone; the worker that retires it is served too (${worker.headers()['cache-control']}; ${worker.headers()['content-security-policy']})`)
}

// =================================================================================================
part('3. the app installed on a Pixel 7')
// =================================================================================================
const app = await device({ ...PIXEL, installed: true })
const p = app.page
{
  const first = await open(p)
  await characters(p)
  check(!first.fromWorker && first.at === '/characters', `the first opening comes from the server, and ends at your characters (${JSON.stringify(first)})`)
  const registrations = await active(p)
  const { calls } = await workers(p)
  check(same(registrations, [{ scope: '/launch', script: WORKER, state: 'activated', updateViaCache: 'none' }]) && same(calls, [{ script: WORKER, scope: '/launch', updateViaCache: 'none' }]),
    `the launch page registered its worker as it left, once, for /launch alone: active (${JSON.stringify({ registrations, calls })})`)
  const { kept } = await workers(p)
  const page = await keptPage(p)
  // The same tie as the release's check on the address it is deployed to: the cache is named for the page as served.
  check(same(kept, [`${KEPT}${sha256(body).slice(0, 12)}`]) && same(page.entries, ['/launch']) && page.sha === sha256(body) && page.status === 200 && page.type === 'text/html; charset=utf-8',
    `it keeps one page and nothing else, /launch, byte for byte what the server sends signed out, in a cache named for it (${JSON.stringify({ kept, holds: page.entries })})`)
  check(await p.evaluate(() => navigator.serviceWorker.controller === null), 'your characters is not in its hands: no worker controls it')

  // The second opening, its first page held until the rune has been seen through two cycles.
  let letGo
  const hold = new Promise(resolve => { letGo = resolve })
  let asked = false
  await app.context.route('**/characters', async route => { asked = true; await hold; await route.continue() })
  app.told.look = undefined
  app.told.lit.length = 0
  const [response] = await Promise.all([p.waitForResponse(isLaunch), p.goto(`${BASE}/launch`, { waitUntil: 'commit' })])
  await until(() => asked, 'the launch page to ask for your characters')
  check(response.fromServiceWorker() && at(p) === '/launch', 'the second opening comes from the worker, and it has asked for your characters, which the suite holds')
  const look = await until(() => app.told.look, 'the launch page to tell its look')
  check(look.background === NIGHT && look.theme === '#0d0d14' && same(look.stone, [144, 144]) && look.centred && look.status === 'Loading…',
    `held, it is the night the manifest gives the phone's own screen, the stone 144 by 144 in the middle, a status saying "Loading…" (${JSON.stringify(look)})`)
  const lit = await until(() => lightsTwice(states(app.told.lit)), 'the rune to light through two cycles', 20_000).then(() => true, () => false)
  check(lit, `held, the rune lights from the dot outward and goes dark, over and over: the dot, the dot and the inner arc, all three, dark (${JSON.stringify(states(app.told.lit).slice(0, 12))})`)
  letGo()
  await p.waitForURL(`${BASE}/characters`)
  await characters(p)
  await app.context.unroute('**/characters')
  const went = await back(p)
  check(went.at === '/characters' && !went.through.includes('/launch'), `let go, your characters takes its place; and Back doesn't return to the stone (${JSON.stringify(went)})`)

  await p.goto(`${BASE}/characters/seedthorin`)
  await p.getByRole('heading', { level: 1, name: 'Thorin Oakenshield', exact: true }).waitFor()
  const sheet = await p.evaluate(() => navigator.serviceWorker.controller === null)
  await p.goto(`${BASE}/characters`)
  await characters(p)
  const after = await workers(p)
  const still = await keptPage(p)
  check(sheet && same(after.kept, kept) && same(still.entries, ['/launch']) && still.sha === sha256(body),
    `Thorin's page is not in its hands either; after it, and your characters again, the one kept page is the same (${JSON.stringify({ kept: after.kept, holds: still.entries })})`)
}

// =================================================================================================
part('4. signed out')
// =================================================================================================
{
  const out = await device({ ...PIXEL, installed: true, signedIn: false })
  const first = await open(out.page)
  await out.page.getByRole('heading', { level: 1, name: 'Sign in' }).waitFor()
  await active(out.page)
  // What an opening shows is what the worker keeps, not a page fetched then: a mark put into the kept page shows.
  await out.page.evaluate(async prefix => {
    const cache = await caches.open((await caches.keys()).find(name => name.startsWith(prefix)))
    const kept = await cache.match('/launch')
    await cache.put('/launch', new Response((await kept.text()).replace('<title>', '<title>kept: '), { headers: kept.headers }))
  }, KEPT)
  let letGo
  const hold = new Promise(resolve => { letGo = resolve })
  await out.context.route('**/characters', async route => { await hold; await route.continue() })
  out.told.look = undefined
  const [response] = await Promise.all([out.page.waitForResponse(isLaunch), out.page.goto(`${BASE}/launch`, { waitUntil: 'commit' })])
  const look = await until(() => out.told.look, 'the launch page to tell its look')
  letGo()
  const signIn = await out.page.waitForURL(url => url.pathname === '/login', { timeout: 15_000 }).then(() => true, () => false)
  if (signIn) await out.page.getByRole('heading', { level: 1, name: 'Sign in' }).waitFor()
  check(!first.fromWorker && first.at === '/login' && response.fromServiceWorker() && look.title === 'kept: Sending Stone' && signIn,
    `installed and signed out: the second opening shows the page the worker keeps, a mark put into it and all, not one fetched then; then Sign in (${JSON.stringify({ first, title: look.title })})`)
  await out.context.close()
}

// =================================================================================================
part('5. the device offline')
// =================================================================================================
{
  await app.context.setOffline(true)
  app.told.asks.length = 0
  const opening = await open(p, { settle: false })
  await until(() => app.told.asks.length === 1, 'the launch page to have asked the server')
  let look = await standing(p)
  check(opening.fromWorker && look.at === '/launch' && look.drawn && same(look.size, [144, 144]) && look.centred && look.body === 'staying offline' && same(look.lit, ['0', '0', '0']) && look.animating === 0
    && look.words === OFFLINE && look.under && look.within && look.gutter >= 16 && !look.scrolls && same(app.told.asks, ['unanswered']),
    `offline, the opening comes from the worker and stays: the stone in the middle, dark and still, "${OFFLINE.replace(' Try again', '')}" and Try again under it (${JSON.stringify(look)})`)
  await shoot(p, 'offline')
  for (const tap of [1, 2]) {
    // Gone from the launch page, there's nothing left to tap: the check below says so.
    if (at(p) !== '/launch') break
    await p.getByRole('button', { name: 'Try again' }).tap()
    await until(() => app.told.asks.length === 1 + tap || at(p) !== '/launch', 'Try again to ask the server', 10_000).catch(() => {})
  }
  look = at(p) === '/launch' ? await standing(p) : { at: p.url() }
  check(look.at === '/launch' && look.drawn && look.body === 'staying offline' && look.words === OFFLINE && same(app.told.asks, ['unanswered', 'unanswered', 'unanswered']),
    `Try again tapped twice, still offline, asks the server each time and leaves the stone and its words where they are: never the browser's own error page (${JSON.stringify({ at: look.at, asks: app.told.asks })})`)

  // A phone on its side, and a window both short and narrow (a split screen): no room under the stone, so the words stand beside it.
  const sides = []
  for (const viewport of [{ width: 800, height: 360 }, { width: 640, height: 360 }, { width: 390, height: 479 }, { width: 360, height: 400 }]) {
    await p.setViewportSize(viewport)
    await p.waitForFunction(width => innerWidth === width, viewport.width)
    sides.push({ ...(await standing(p)), viewport: `${viewport.width}x${viewport.height}` })
    if (viewport.width === 800) await shoot(p, 'offline-on-its-side')
    if (viewport.width === 360) await shoot(p, 'offline-short-and-narrow')
  }
  check(sides.every(side => side.beside && side.within && side.gutter >= 16 && !side.scrolls && side.words === OFFLINE),
    `on its side, at 800 by 360 and 640 by 360, and short and narrow, at 390 by 479 and 360 by 400, the words stand beside the stone, the stone, the words and Try again at least 16 pixels from the screen's sides, and nothing to scroll (${JSON.stringify(sides.map(({ viewport, beside, within, gutter, scrolls }) => ({ viewport, beside, within, gutter, scrolls })))})`)
  await p.setViewportSize(PIXEL.viewport)

  // Back online, as a connection can be a moment from working: the page's first ask then goes unanswered, at the network.
  // Your characters is held, so that what the page says while it is on its way can be seen.
  const launchAddress = url => url.pathname === '/launch'
  let refused = 0
  const refuseOnce = route => {
    if (route.request().method() !== 'HEAD' || refused > 0) return route.fallback()
    refused += 1
    return route.abort('internetdisconnected')
  }
  await app.context.route(launchAddress, refuseOnce)
  let letGo
  const hold = new Promise(resolve => { letGo = resolve })
  let asked = false
  await app.context.route('**/characters', async route => { asked = true; await hold; await route.continue() })
  const asks = app.told.asks.length
  app.told.said.length = 0
  await app.context.setOffline(false)
  const handed = await until(() => asked, 'the launch page, back online, to ask for your characters').then(() => true, () => false)
  const between = app.told.said.splice(0)
  const fromLit = app.told.lit.length
  check(handed && refused === 1 && same(app.told.asks.slice(asks), ['unanswered', 'answered']) && between.some(said => said.body === 'staying' && said.words === `${UNREACHED} Try again`),
    `back online, its first ask unanswered: it says only that Sending Stone couldn't be reached, asks again by itself, and hands over (${JSON.stringify({ asks: app.told.asks.slice(asks), between: [...new Set(between.map(said => `${said.body}: ${said.words}`))] })})`)

  // While your characters is on its way, looked at through the binding: page.evaluate waits for the held navigation.
  const onItsWay = await until(() => app.told.said.length >= 5 && app.told.said, 'the launch page to tell what it shows while your characters is on its way')
  const lit = states(app.told.lit.slice(fromLit))
  letGo()
  const opened = await p.waitForURL(`${BASE}/characters`, { timeout: 15_000 }).then(() => true, () => false)
  if (opened) await characters(p)
  await app.context.unroute('**/characters')
  await app.context.unroute(launchAddress, refuseOnce)
  // The page had long finished loading when it left: only its own replace keeps Back from it.
  const went = opened ? await back(p) : {}
  check(onItsWay.every(said => said.body === '' && said.words === null) && lit.some(state => state !== '') && opened && went.at === '/characters' && !went.through.includes('/launch'),
    `while your characters is on its way nothing is said, and the rune lights again; then your characters takes the stone's place, and Back doesn't return to it (${JSON.stringify({ said: [...new Set(onItsWay.map(said => `${said.body}: ${said.words}`))], lit, went })})`)
}

// =================================================================================================
part('6. a first page that does not come')
// =================================================================================================
{
  const slow = await device(PIXEL)
  // The page's own clock in the suite's hands and stopped before the page opens, so that its 15 seconds pass when the
  // suite says and never while the machine is slow: a paused clock moves only by fastForward.
  const now = Date.now()
  await slow.page.clock.install({ time: now })
  await slow.page.clock.pauseAt(now + 1000)
  await staying(slow.context, slow.page)
  await slow.page.clock.fastForward(14_000)
  const before = await standing(slow.page)
  await slow.page.clock.fastForward(1_000)
  await slow.page.locator('#unreached').waitFor({ timeout: 5_000 }).catch(() => {})
  const waited = await standing(slow.page)
  check(before.words === null && waited.at === '/launch' && waited.words === `${UNREACHED} Try again` && waited.body === '' && waited.animating === 3 && waited.under && waited.within,
    `nothing is said for 14 seconds; after 15 with no first page, "${UNREACHED}" and Try again, the rune still lighting (${JSON.stringify({ before: before.words, after: waited.words, animating: waited.animating })})`)
  await shoot(slow.page, 'waited')
  // The rest on time, as a device keeps it.
  await slow.page.clock.resume()
  await slow.context.unroute('**/characters')
  await slow.page.getByRole('button', { name: 'Try again' }).tap()
  const opened = await slow.page.waitForURL(`${BASE}/characters`, { timeout: 15_000 }).then(() => true, () => false)
  if (opened) await slow.page.getByRole('heading', { level: 1, name: 'Alice Adventurer' }).waitFor()
  check(opened && same(slow.told.asks, ['answered']), `Try again asks the server, which answers, and opens your characters (${JSON.stringify(slow.told.asks)})`)
  await slow.context.close()
}

// =================================================================================================
part('7. its look')
// =================================================================================================
{
  const still = await device({ ...PIXEL, reducedMotion: 'reduce' })
  await staying(still.context, still.page)
  const look = await standing(still.page)
  check(same(look.lit, ['0.85', '0.85', '0.85']) && look.animating === 0 && look.words === null, `where the device asks for less motion, the rune is lit and still (${JSON.stringify({ lit: look.lit, animating: look.animating })})`)
  await shoot(still.page, 'reduced-motion')
  await still.context.close()

  const looks = []
  for (const [name, phone] of [['pixel', PIXEL], ['iphone', IPHONE]]) {
    for (const colorScheme of ['light', 'dark']) {
      const one = await device({ ...phone, colorScheme })
      await staying(one.context, one.page)
      // Its picture with the whole rune lit.
      await one.page.waitForFunction(() => ['.dot', '.inner', '.outer'].every(part => Number(getComputedStyle(document.querySelector(part)).opacity) > 0.9))
      await shoot(one.page, `${name}-${colorScheme}`)
      looks.push({ name, colorScheme, ...(await standing(one.page)) })
      await one.context.close()
    }
  }
  check(looks.every(look => look.background === NIGHT && same(look.size, [144, 144]) && look.centred && look.drawn && !look.scrolls && look.light === (look.colorScheme === 'light')),
    `on a light device and a dark one, a Pixel 7 and an iPhone 15, it is the same night page, the stone 144 by 144 in the middle (${JSON.stringify(looks.map(({ name, colorScheme, background, centred }) => ({ name, colorScheme, background, centred })))})`)
}

// =================================================================================================
part('8. a release, and the way out')
// =================================================================================================
{
  // A worker from before, under another address, with the cache it would have kept and one that isn't the launch page's.
  const next = await device({ ...PIXEL, installed: true })
  await next.page.goto(`${BASE}/characters`)
  await characters(next.page)
  await next.page.evaluate(older => navigator.serviceWorker.register(older, { scope: '/launch' }), `${WORKER}?older`)
  await until(async () => { const [older] = (await workers(next.page)).registrations; return older?.script === `${WORKER}?older` && older.state === 'activated' }, 'the older worker to be active')
  await next.page.evaluate(async () => {
    for (const name of await caches.keys()) await caches.delete(name)
    await (await caches.open('sending-stone-launch-before')).put('/launch', new Response('<!doctype html><title>before</title>', { headers: { 'Content-Type': 'text/html' } }))
    await caches.open('something-else')
  })
  const opening = await open(next.page)
  await characters(next.page)
  const registrations = await active(next.page)
  const names = await until(async () => { const { kept } = await workers(next.page); return !kept.includes('sending-stone-launch-before') && kept }, 'the older cache to go', 10_000).catch(async () => (await workers(next.page)).kept)
  check(opening.fromWorker && same(registrations, [{ scope: '/launch', script: WORKER, state: 'activated', updateViaCache: 'none' }])
    && same(names.toSorted(), [`${KEPT}${sha256(body).slice(0, 12)}`, 'something-else'].toSorted()),
    `an older worker and its cache: after one opening this release's worker has taken its place, the older launch cache is gone, and a cache that isn't the launch page's is left alone (${JSON.stringify(names)})`)

  await next.page.evaluate(() => navigator.serviceWorker.register('/launch-worker-retire.js', { scope: '/launch' }))
  const retired = await until(async () => { const held = await workers(next.page); return held.registrations.length === 0 && same(held.kept, ['something-else']) && held }, 'the retiring worker to leave nothing', 10_000).catch(() => workers(next.page))
  const from = await open(next.page)
  await characters(next.page)
  check(retired.registrations.length === 0 && same(retired.kept, ['something-else']) && !from.fromWorker && from.at === '/characters',
    `the retiring worker, put in its place, deletes the launch page's cache and no other and unregisters itself; the next opening comes from the server and hands over as before (${JSON.stringify({ registrations: retired.registrations, kept: retired.kept, from })})`)
  await next.context.close()

  const home = await device({ ...IPHONE, installed: 'home screen' })
  const first = await open(home.page)
  await characters(home.page)
  await active(home.page)
  const { calls } = await workers(home.page)
  const second = await open(home.page)
  await characters(home.page)
  check(!first.fromWorker && same(calls, [{ script: WORKER, scope: '/launch', updateViaCache: 'none' }]) && second.fromWorker && second.at === '/characters',
    `an iPhone's Home Screen app, which says so on navigator.standalone, registers the worker too, and its second opening comes from it (${JSON.stringify({ first, second })})`)
  await home.context.close()
}

await app.context.close()
await api.dispose()
await browser.close()
