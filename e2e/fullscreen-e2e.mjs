// Full screen (the app, the 0.30.0 contract §5.1-§5.2 and §7 fullscreen-e2e.mjs, decision 4), end to end,
// in the world of world-030.mjs. Alice plays Thorin, who carries an Everburning Torch that casts
// Starry Wisp, in a campaign whose Iron Company she may observe. On a computer, 1280×800: "Full
// screen" fills the screen with the whole page, and while it does a roll's toast, the dice, the cog's
// popover, the torch's ⓘ dialog and the party's side panel, opened from the Inventory tab's party list
// since PR #44, each show on top; leaving it from outside
// turns the button back; it lasts from the sheet to the party's own page and back, and ends on the
// way back to the list. The Gamemaster's page has it too. An iPhone, which lets no page fill the
// screen, gets the button and the modal explaining Add to Home Screen, and in the Home Screen app no
// button at all; a Pixel 7 gets the toggle, an installed app too. The manifest, its icons and the
// head's tags as pinned. Headless Chromium can't show the viewport growing, Escape leaving full
// screen, or that a page may only enter it from a tap (the 0.30.0 full-screen map): those are on the
// device checklist. Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BASE, SHOTS, VARIANT, actors, browse, character, check, devices, finish, foundryWorld, group, item, launch, newCampaign, note, part,
  same, sameJson, shoot, shootBoth, startModule, sql, theme, until, wait,
} from './world-030.mjs'

const GAME = 'https://stone-hall.forge-vtt.com'
const SECRET = 'stone-hall-full-30'
const TITLE = 'Stonehall'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'stone-hall.forge-vtt.com', secret: SECRET })
await foundryWorld()
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${type}` })
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, wis: 2 }, hp: { value: 30, max: 38, temp: 0 } }, {
  ac: 16,
  items: [
    {
      id: 'torch', name: 'Everburning Torch', type: 'weapon',
      system: { properties: [], quantity: 1, attackType: 'melee', equipped: true, description: { value: '<p>It never goes out.</p>' } },
      activities: [
        { id: 'burn', name: 'Strike', damage: [{ number: 1, denomination: 4, types: ['fire'] }], labels: { modifier: '+6', damage: [hits('1d4', 'fire')] } },
        { id: 'cast', type: 'cast', name: 'Starry Wisp', labels: { range: '60 ft' } },
      ],
    },
    {
      id: 'wisp-copy', name: 'Starry Wisp', type: 'spell', flags: { dnd5e: { cachedFor: '.Item.torch.Activity.cast' } },
      system: { level: 0, method: 'spell', properties: [], description: { value: '<p>A mote of starlight.</p>' } },
      activities: [{ id: 'wisp-shot', ability: 'wis', damage: [{ number: 1, denomination: 8, types: ['fire'] }], labels: { modifier: '+5', damage: [hits('1d8', 'fire')] } }],
    },
  ],
})
thorin.system.details = { level: 5 }
game.users.get('alice').character = thorin
const company = group('company', 'The Iron Company', { members: [thorin], ownership: { alice: 2 }, description: { full: '<p>Sworn at Stonehall.</p>' } })
item(company, 'rope', 'loot', 'Hempen Rope')
Object.defineProperty(actors, 'party', { get: () => null, configurable: true })
await startModule({ campaigns: [{ id: 'camp-stone', title: TITLE, characters: ['thorin'], groups: ['company'], rolls: true }], secrets: { 'camp-stone': SECRET } })
await until(() => sql(`select count(*) from group_sheet where "campaignId" = '${A}'`) === '1', 'the party sheet in the app')
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)

const full = page => page.evaluate(() => document.fullscreenElement === document.documentElement)
const nothingFull = page => page.evaluate(() => document.fullscreenElement === null)
const toggle = who => who.page.locator('header').first().getByRole('button', { name: /^(Exit full screen|Full screen)$/ })
/** Once the page has re-rendered from the browser's fullscreenchange: the toggle's label. */
const labelled = async (who, label) => {
  await until(async () => (await toggle(who).getAttribute('aria-label')) === label, `"${label}"`, 5_000).catch(() => {})
  return toggle(who).getAttribute('aria-label')
}
/** Whether an element shows, and is what's on top at its centre, as a tap there would find it. */
const onTop = locator => locator.evaluate(async el => {
  // Once it has slid or faded in, as the side panel does.
  await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming?.().iterations !== Infinity).map(a => a.finished.catch(() => {})))
  const box = el.getBoundingClientRect()
  const style = getComputedStyle(el)
  const x = box.left + box.width / 2
  const y = box.top + box.height / 2
  const hit = document.elementFromPoint(x, y)
  return { shown: box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none', top: !!hit && el.contains(hit) }
})

// =================================================================================================
// A computer, 1280×800
// =================================================================================================
part('1. a computer')
const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin' })
const sheet = desk.page.getByRole('region', { name: 'Character' })
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await toggle(desk).waitFor()
check(await toggle(desk).getAttribute('aria-label') === 'Full screen' && await toggle(desk).getAttribute('title') === 'Full screen'
  && await toggle(desk).getAttribute('aria-pressed') === null && await toggle(desk).locator('svg.lucide-maximize').count() === 1,
  'the header has "Full screen", its icon the corners of a frame')
{
  // What shows of the header's right: the dialog its Delete opens is in it, unopened.
  const cluster = await desk.page.locator('header').first().locator(':scope > div').last().locator(':scope > *')
    .evaluateAll(els => els.filter(el => el.getBoundingClientRect().width > 0).map(el => el.getAttribute('aria-label') ?? el.getAttribute('role')))
  check(same(cluster, ['status', 'Full screen', 'Delete Thorin']), `after whether the game is live and before Delete, with no party button since PR #44 (${JSON.stringify(cluster)})`)
}
await toggle(desk).click()
await until(() => full(desk.page), 'full screen', 5_000)
check(await labelled(desk, 'Exit full screen') === 'Exit full screen' && await toggle(desk).locator('svg.lucide-minimize').count() === 1,
  'a click fills the screen with the whole page, documentElement, and the button reads "Exit full screen"')
await shoot(desk, 'fullscreen-header', desk.page.locator('header').first())
// A roll's toast, over everything.
await sheet.getByRole('button', { name: /^Strength check/ }).click()
const toast = desk.page.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]').first()
await toast.waitFor({ timeout: 30_000 })
await wait(600)
{
  const look = await onTop(toast)
  check(look.shown && look.top, `while full screen, a roll's toast shows, on top at its centre (${JSON.stringify(look)})`)
}
// The dice, which taps pass through: on top where a tap would find them, were they to take it.
{
  const dice = desk.page.locator('[id^=dice-canvas-threejs]').first()
  await dice.waitFor({ state: 'attached', timeout: 15_000 })
  const look = await dice.evaluate(el => {
    const was = el.style.pointerEvents
    el.style.pointerEvents = 'auto'
    const box = el.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    el.style.pointerEvents = was
    return { width: Math.round(box.width), height: Math.round(box.height), top: !!hit && el.contains(hit), shown: getComputedStyle(el).visibility !== 'hidden' }
  })
  check(look.shown && look.top && look.width === 1280 && look.height === 800, `and the dice, over the whole screen, on top (${JSON.stringify(look)})`)
}
// The cog's popover.
await desk.page.getByRole('button', { name: 'Settings', exact: true }).click()
const cog = desk.page.getByRole('dialog').filter({ hasText: 'Roll results' }).last()
await cog.waitFor()
{
  const look = await onTop(cog)
  check(look.shown && look.top, `the cog's popover shows, on top (${JSON.stringify(look)})`)
}
await desk.page.keyboard.press('Escape')
await cog.waitFor({ state: 'hidden' })
// The torch's ⓘ.
await desk.tab('Actions')
await sheet.getByRole('button', { name: /^Everburning Torch/, expanded: false }).click()
await sheet.getByRole('button', { name: 'About Everburning Torch (Starry Wisp)' }).click()
const info = desk.page.getByRole('dialog', { name: 'Starry Wisp' })
await info.waitFor()
{
  const look = await onTop(info)
  check(look.shown && look.top, `an item's ⓘ dialog shows, on top (${JSON.stringify(look)})`)
}
await info.getByRole('button', { name: 'Close' }).click()
await info.waitFor({ state: 'hidden' })
// The party's side panel, from the Inventory tab's party list.
await desk.tab('Inventory')
await sheet.getByRole('region', { name: /^Part(y|ies)$/ }).getByRole('button', { name: /^The Iron Company (Primary party|Party sheet)$/ }).click()
const panel = desk.page.getByRole('dialog', { name: 'The Iron Company' })
await panel.getByRole('heading', { name: 'Members · 1' }).waitFor({ timeout: 15_000 })
{
  const look = await onTop(panel)
  check(look.shown && look.top && await full(desk.page), `the party's side panel shows, on top, and the page is still full screen (${JSON.stringify(look)})`)
}
await panel.getByRole('button', { name: 'Close' }).click()
await panel.waitFor({ state: 'hidden' })

part('2. an exit from outside')
await desk.page.evaluate(() => document.exitFullscreen())
await until(async () => (await toggle(desk).getAttribute('aria-label')) === 'Full screen', 'the button to turn back', 5_000)
check(await nothingFull(desk.page), 'left from outside, as Escape would, the page is no longer full screen and the button reads "Full screen" again')

part('3. to the party page and back')
await toggle(desk).click()
await until(() => full(desk.page), 'full screen again', 5_000)
await desk.tab('Inventory')
await sheet.getByRole('region', { name: /^Part(y|ies)$/ }).getByRole('button', { name: /^The Iron Company (Primary party|Party sheet)$/ }).click()
await panel.getByRole('link', { name: /^Open as page/ }).click()
await desk.page.waitForURL(`${BASE}/characters/sheet-thorin/party/company`)
await desk.page.getByRole('heading', { level: 1, name: 'The Iron Company' }).waitFor()
check(await full(desk.page) && await labelled(desk, 'Exit full screen') === 'Exit full screen',
  '"Open as page" keeps full screen: the party page fills it, its own button "Exit full screen"')
await desk.page.getByRole('link', { name: 'Back to Thorin' }).click()
await desk.page.waitForURL(`${BASE}/characters/sheet-thorin`)
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor()
check(await full(desk.page) && await labelled(desk, 'Exit full screen') === 'Exit full screen', 'back to Thorin, still full screen')
await desk.page.getByRole('link', { name: 'All characters' }).click()
await desk.page.waitForURL(`${BASE}/characters`)
await until(() => nothingFull(desk.page), 'full screen to end', 5_000)
check(true, 'the back arrow to the list of characters ends it')

part('4. the Gamemaster')
const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin` })
await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await toggle(gm).click()
await until(() => full(gm.page), 'the GM page full screen', 5_000)
check(await labelled(gm, 'Exit full screen') === 'Exit full screen' && await gm.page.getByRole('button', { name: /^Delete / }).count() === 0,
  "the Gamemaster's page has the button too, with no Delete beside it, and it fills the screen")
await toggle(gm).click()
await until(() => nothingFull(gm.page), 'the GM page back', 5_000)
check(await labelled(gm, 'Full screen') === 'Full screen', 'and a second click ends it')
await gm.view.close()
await desk.view.close()

// =================================================================================================
// An iPhone, and its Home Screen app
// =================================================================================================
part('5. an iPhone')
const IPHONE_TEXT = [
  "iPhone doesn't let websites fill the whole screen. Add Sending Stone to your Home Screen instead: it opens there without Safari's bars.",
  "In Safari, tap Share, then Add to Home Screen, and open Sending Stone from your Home Screen. You'll sign in once more there.",
]
/** No Fullscreen API, as on every iPhone browser; and, as the Home Screen app, standalone. */
const asIphone = (standalone = false) => async view => {
  await view.addInitScript(home => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => undefined, configurable: true })
    if (home) Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true })
  }, standalone)
}
for (const scheme of ['light', 'dark']) {
  const phone = await browse({ device: devices['iPhone 15'], scheme })
  await asIphone()(phone.view)
  await phone.page.goto(`${BASE}/characters/sheet-thorin`)
  await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  phone.width = 390
  await toggle(phone).waitFor()
  check(await toggle(phone).getAttribute('aria-label') === 'Full screen', `iPhone 15 (${scheme}): no Fullscreen API, and yet the button`)
  await shoot(phone, 'fullscreen-iphone-header', phone.page.locator('header').first())
  await toggle(phone).tap()
  const modal = phone.page.getByRole('dialog', { name: 'Full screen on iPhone' })
  await modal.waitFor()
  const paragraphs = await modal.locator('p').allTextContents()
  check(same(paragraphs.map(p => p.replace(/\s+/g, ' ').trim()), IPHONE_TEXT) && await modal.getByRole('button', { name: 'Got it' }).isVisible()
    && await modal.getByRole('button', { name: 'Close' }).isVisible() && await nothingFull(phone.page),
    'a tap explains Share, then Add to Home Screen, with "Got it" and Close, and nothing is made full screen')
  await shoot(phone, 'fullscreen-iphone-modal')
  await modal.getByRole('button', { name: 'Got it' }).tap()
  await modal.waitFor({ state: 'hidden' })
  check(true, '"Got it" closes it')
  await phone.view.close()
}
{
  const home = await browse({ device: devices['iPhone 15'] })
  await asIphone(true)(home.view)
  await home.page.goto(`${BASE}/characters/sheet-thorin`)
  await home.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await wait(1000)
  check(await toggle(home).count() === 0 && await home.page.locator('header').first().getByRole('status').isVisible(),
    'opened from the Home Screen, navigator.standalone: no button at all')
  await home.view.close()
}

// =================================================================================================
// A Pixel 7, and the app installed on it; a tablet
// =================================================================================================
part('6. a Pixel 7')
for (const installed of [false, true]) {
  const pixel = await browse({ device: devices['Pixel 7'] })
  // Installed: the page runs as an app of its own, which it reads from the display mode.
  if (installed) await pixel.view.addInitScript(() => {
    const own = window.matchMedia.bind(window)
    window.matchMedia = query => (/display-mode: (standalone|fullscreen)/.test(query)
      ? { matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
      : own(query))
  })
  await pixel.page.goto(`${BASE}/characters/sheet-thorin`)
  await pixel.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  const standalone = await pixel.page.evaluate(() => window.matchMedia('(display-mode: standalone)').matches)
  await toggle(pixel).tap()
  await until(() => full(pixel.page), 'the Pixel full screen', 5_000)
  check(standalone === installed && await labelled(pixel, 'Exit full screen') === 'Exit full screen',
    installed ? 'installed, standalone, the toggle is still there, and works' : 'on a Pixel 7, the toggle fills the screen')
  await toggle(pixel).tap()
  await until(() => nothingFull(pixel.page), 'the Pixel back', 5_000)
  await pixel.view.close()
}
{
  const tablet = await browse({ width: 768, height: 1024, path: '/characters/sheet-thorin' })
  await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await toggle(tablet).waitFor()
  await shootBoth(tablet, 'fullscreen-header', tablet.page.locator('header').first())
  await tablet.view.close()
}

// =================================================================================================
// The manifest, its icons and the head
// =================================================================================================
part('7. assets')
const MANIFEST = {
  id: '/', name: 'Sending Stone', short_name: 'Sending Stone', description: 'Follow your Foundry VTT game from any device.',
  start_url: '/characters', scope: '/', display: 'standalone', background_color: '#0d0d14', theme_color: '#0d0d14',
  icons: [
    { src: '/brand/stone-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/brand/stone-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/brand/stone-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
// Fetched as a browser does, the module's stand-in Foundry having the page's own fetch.
const plain = await browse({ width: 390, height: 844 })
const manifest = await plain.view.request.get(`${BASE}/manifest.webmanifest`).then(async r => ({ status: r.status(), json: await r.json() }))
check(manifest.status === 200 && sameJson(manifest.json, MANIFEST), `GET /manifest.webmanifest answers 200 with the manifest as pinned (${JSON.stringify(manifest.json)})`)
/** A PNG's size, from its header. */
const pngSize = bytes => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) })
const icon = async src => {
  const response = await plain.view.request.get(new URL(src, BASE).href)
  const bytes = await response.body()
  const png = bytes.subarray(1, 4).toString() === 'PNG'
  return { status: response.status(), type: response.headers()['content-type'], ...(png ? pngSize(bytes) : {}) }
}
for (const { src, sizes } of MANIFEST.icons) {
  const got = await icon(src)
  check(got.status === 200 && got.type === 'image/png' && `${got.width}x${got.height}` === sizes, `${src}: 200, image/png, ${sizes} (${JSON.stringify(got)})`)
}
{
  const page = await browse({ width: 390, height: 844, path: '/characters' })
  const head = await page.page.evaluate(() => ({
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
    apple: [...document.querySelectorAll('link[rel="apple-touch-icon"]')].map(l => ({ href: l.getAttribute('href'), sizes: l.getAttribute('sizes'), type: l.getAttribute('type') })),
    themes: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => [m.getAttribute('media'), m.getAttribute('content')]),
    capable: document.querySelector('meta[name="mobile-web-app-capable"]')?.getAttribute('content'),
    title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content'),
  }))
  check(head.manifest === '/manifest.webmanifest' && head.apple.length === 1 && head.capable === 'yes' && head.title === 'Sending Stone'
    && same(head.themes, [['(prefers-color-scheme: light)', '#f6f6f9'], ['(prefers-color-scheme: dark)', '#0d0d14']]),
    `the head links the manifest and the Apple icon, has two theme colours, light and dark, and is a web app named Sending Stone (${JSON.stringify(head)})`)
  const apple = await icon(head.apple[0].href)
  check(apple.status === 200 && apple.type === 'image/png' && apple.width === 180 && apple.height === 180, `the Apple icon: 200, image/png, 180x180 (${JSON.stringify(apple)})`)
  await page.view.close()
}
note("headless Chromium can't show the viewport growing, Escape leaving full screen, or that it must start from a tap: those are on the device checklist")

await finish()
