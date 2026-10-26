// The campaign page, option A, "Index" (round 0.39.0 §4, its e2e §4.8), end to end: the Gamemaster's
// campaigns as a list, those that need them first, the chosen one beside it on a wide screen and in
// its place on a phone, chosen in the address. Alice runs every campaign; the real module, in the
// stand-in Foundry of gm-e2e (fvtt/stub.mjs), posts from a Forge game's page to the app for two of
// them, and nothing else stands in for Foundry. Barrowmaze is refused (a post with the wrong
// secret), Curse of Strahd waits for Foundry, Erebor is live with two of its three characters
// chosen, Frostmaiden was last heard a week ago, its seven characters none chosen; then eight more,
// each heard a day apart, for the search. The order and its labels, the chips, flags and seats; the
// choice at 1280, a reload keeping it, and the list scrolling within itself; the search; at 390, 768
// and 1024, a tap, All campaigns, and the browser's Back; Copy, Reset link, Remove, Change secret on
// the refused campaign and Delete, their dialogs opening on Cancel, their toasts and focus, the
// campaign shown staying shown; New campaign's Done; the Gamemaster's sheet's way back; the footer's
// Help links and the header's current page (item 3); and the page at 360, 390, 768 and 1280 in both
// themes. Synthetic campaigns only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { mkdirSync } from 'node:fs'
import { actor, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'

const GAME = 'https://ashlands-campaigns.forge-vtt.com'
const ADDRESS = 'ashlands-campaigns.forge-vtt.com'
const SECRETS = { erebor: 'erebor-campaigns-39', frost: 'frostmaiden-campaigns-39' }
const SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const note = msg => console.log('note -', msg)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const realNow = Date.now
async function until(test, what, ms = 30_000) {
  const end = realNow() + ms
  while (!(await test())) {
    if (realNow() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(100)
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const flat = text => String(text ?? '').replace(/\s+/g, ' ').trim()
const began = realNow()
const part = name => console.log(`# ${name}, at ${((realNow() - began) / 1000).toFixed(1)} s`)

const browser = await chromium.launch()
const problems = []
const watch = (page, who) => page.on('pageerror', e => problems.push(`${who} pageerror: ${e.message}`))

// ---- Foundry's page, which the module's posts come from ----
const foundryContext = await browser.newContext()
await foundryContext.grantPermissions(['local-network-access'], { origin: GAME })
await foundryContext.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' }))
const gmTab = await foundryContext.newPage()
await gmTab.goto(`${GAME}/game`)
const posted = []
let inFlight = 0
let lastActivity = realNow()
globalThis.fetch = async (url, init) => {
  inFlight++
  try {
    const { status, statusText, body } = await gmTab.evaluate(async ({ url, init }) => {
      const response = await fetch(url, init)
      return { status: response.status, statusText: response.statusText, body: await response.text() }
    }, { url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
    const sent = JSON.parse(init.body)
    posted.push({ type: sent.type ?? 'fetch', campaign: sent.campaign?.title, status })
    return { ok: status >= 200 && status < 300, status, statusText, headers: new Headers({ 'content-type': 'application/json' }), json: async () => JSON.parse(body || '{}'), text: async () => body }
  } finally { inFlight--; lastActivity = realNow() }
}
const idle = async () => {
  await wait(50)
  while (inFlight > 0 || realNow() - lastActivity < 300) await wait(25)
}
/** A post as a module with this secret would make it, from the game's page: the app's answer. */
const raw = (body, secret) => gmTab.evaluate(async ({ url, body, secret }) => {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }, body: JSON.stringify(body) })
  const text = await response.text()
  let refusal = {}
  try { refusal = JSON.parse(text) } catch {}
  return { status: response.status, reason: refusal.reason }
}, { url: `${BASE}/api/events`, body, secret })

// ---- The Gamemaster's browser, at 1280 ----
const ALICE = await cookieFor('e2e-token')
/** A page of the app in a browser of its own, its toasts noted as each shows. */
async function browse({ width, height, scheme = 'light', path = '/campaigns', clipboard = false }) {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: width < 1024, hasTouch: width < 1024, colorScheme: scheme })
  await view.addCookies([ALICE])
  if (clipboard) await view.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  await view.addInitScript(() => {
    globalThis.__toasts = []
    new MutationObserver(() => {
      for (const toast of document.querySelectorAll('[data-page-toast]')) {
        if (globalThis.__toasts.at(-1) !== toast.textContent) globalThis.__toasts.push(toast.textContent)
      }
    }).observe(document, { childList: true, subtree: true, characterData: true })
  })
  const page = await view.newPage()
  watch(page, `${width}`)
  if (path) await page.goto(`${BASE}${path}`)
  return { view, page, width, scheme }
}
const toastsOn = page => page.evaluate(() => globalThis.__toasts ?? [])
const theme = async (who, scheme) => {
  await who.page.emulateMedia({ colorScheme: scheme })
  await until(async () => (await who.page.evaluate(() => document.documentElement.classList.contains('dark'))) === (scheme === 'dark'), `the ${scheme} theme`, 10_000)
  who.scheme = scheme
}
/** A shot of the page or a part, at its width, in each theme, the page left as it was. */
async function shootBoth(who, name, locator) {
  if (!SHOTS) return
  const was = who.scheme
  for (const scheme of [was, was === 'light' ? 'dark' : 'light']) {
    await theme(who, scheme)
    await who.page.waitForTimeout(350)
    const path = `${SHOTS}/${name}-${who.width}-${scheme}.png`
    if (locator) await locator.screenshot({ path })
    else await who.page.screenshot({ path, fullPage: true })
  }
  await theme(who, was)
}
const sideways = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const chosenIn = page => new URL(page.url()).searchParams.get('campaign')
const historyOf = page => page.evaluate(() => history.length)
/** A campaign's row, by its id. */
const rowOf = (page, id) => page.locator(`[data-campaign="${id}"]`)
/** The list as shown: each group's label, if shown, and its rows' titles, in order. */
const listOf = page => page.evaluate(() => [...document.querySelectorAll('ul[aria-labelledby]')].filter(ul => ul.querySelector('[data-campaign]') && ul.checkVisibility())
  .map(ul => {
    const label = document.getElementById(ul.getAttribute('aria-labelledby'))
    return {
      label: label?.textContent ?? null,
      shown: label ? !label.classList.contains('sr-only') : false,
      rows: [...ul.querySelectorAll('[data-campaign]')].map(row => row.querySelector('span span')?.textContent ?? null),
    }
  }))
/** A row as drawn: its title, its line, its chip, its foot, and its seats' letters and titles. */
const rowState = (page, id) => rowOf(page, id).evaluate(row => {
  const [head] = row.children
  return {
    title: head.children[0]?.textContent ?? null, sub: head.children[1]?.textContent ?? null,
    chip: row.querySelector('[data-state]')?.textContent ?? null,
    // As a screen reader has it: the seats' letters are for the eye alone.
    foot: (() => {
      const foot = row.lastElementChild?.cloneNode(true)
      for (const hidden of foot?.querySelectorAll('[aria-hidden]') ?? []) hidden.remove()
      return foot?.textContent.replace(/\s+/g, ' ').trim() ?? null
    })(),
    seats: [...row.querySelectorAll('[data-seats] > span')].map(seat => [seat.textContent, seat.title]),
    current: row.getAttribute('aria-current'),
  }
})
/** The page's campaign shown, by its heading. */
const shownTitle = page => page.locator('article[aria-labelledby] h2').first().textContent().catch(() => null)
const focusOf = page => page.evaluate(() => {
  const el = document.activeElement
  return { tag: el?.tagName.toLowerCase() ?? null, id: el?.id || null, campaign: el?.dataset?.campaign ?? null, name: el?.getAttribute('aria-label') ?? el?.textContent?.trim().slice(0, 60) ?? null }
})

part('setting up')
const desk = await browse({ width: 1280, height: 800, clipboard: true })
const { page } = desk
await page.getByRole('heading', { name: 'Your campaigns' }).waitFor()
check(await page.getByText(/You haven’t set up a campaign yet|You haven't set up a campaign yet/).isVisible(), 'with no campaigns, the page invites the Gamemaster to set one up')
const modal = page.getByRole('dialog', { name: 'New campaign' })
/** A campaign set up through New campaign; its id, once Done has shown it. */
async function setUp(title, secret = `${title.toLowerCase().replace(/\W+/g, '-')}-secret-39`) {
  await page.getByRole('button', { name: 'New campaign' }).click()
  await modal.getByLabel('Campaign title').fill(title)
  await modal.getByLabel('Forge game address').fill(ADDRESS)
  await modal.getByLabel('Secret', { exact: true }).fill(secret)
  await modal.getByRole('button', { name: 'Set up campaign' }).click()
  await modal.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('article', { name: title, exact: true }).waitFor()
  return sql(`select id from campaign where "ownerId" = 'e2e-user' and title = '${title}'`)
}
const ID = {}
ID.barrow = await setUp('Barrowmaze')
ID.strahd = await setUp('Curse of Strahd')
ID.erebor = await setUp('Erebor', SECRETS.erebor)
ID.frost = await setUp('Frostmaiden', SECRETS.frost)
check(chosenIn(page) === ID.frost && await shownTitle(page) === 'Frostmaiden', `New campaign › Done shows the campaign set up, chosen in the address (${page.url()})`)

// Foundry connects Erebor and Frostmaiden: the real module, from Ashlands.
users.activeGM = user('gm', 'Gamemaster', true)
user('alice', 'Alice')
user('bob', 'Bob')
actor('thorin', 'Thorin Oakenshield', ['alice'])
actor('vex', 'Vex', ['bob'])
actor('bard', 'Bard the Bowman', [])
const DWARVES = ['Dain', 'Balin', 'Dwalin', 'Fili', 'Kili', 'Oin', 'Gloin']
for (const name of DWARVES) actor(name.toLowerCase(), name, [])
game.world.title = 'Ashlands'
await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-erebor': SECRETS.erebor, 'camp-frost': SECRETS.frost })
const EREBOR = { id: 'camp-erebor', title: 'Erebor', characters: ['thorin', 'vex', 'bard'] }
settings.set('campaigns', [EREBOR, { id: 'camp-frost', title: 'Frostmaiden', characters: DWARVES.map(name => name.toLowerCase()) }])
await Hooks.callAll('ready')
await idle()
check(posted.filter(p => p.type === 'bridge.hello').map(p => `${p.campaign} ${p.status}`).sort().join() === 'Erebor 200,Frostmaiden 200',
  `Erebor's and Frostmaiden's hellos are taken (${JSON.stringify(posted.filter(p => p.type === 'bridge.hello'))})`)
// Then Frostmaiden leaves Sending Stone's campaigns, last heard a week ago.
await game.settings.set('sending-stone', 'campaigns', [EREBOR])
await idle()
sql(`update campaign set "lastSeenAt" = now() - interval '7 days' where id = '${ID.frost}'`)
// Alice plays Thorin in Erebor, and Bob Vex; Bard is no one's yet.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin Oakenshield', '${GAME}', 'Erebor', '${ID.erebor}', 'thorin', 'e2e-user', now()),
         ('sheet-vex', 'Vex', '${GAME}', 'Erebor', '${ID.erebor}', 'vex', 'e2e-bob', now())`)
// Barrowmaze's Foundry posts with a secret that isn't its own.
const { buildEnvelope } = await import(`${MODULE}/scripts/transport.mjs`)
const refused = await raw(buildEnvelope('chat.cleared', {}, { campaign: { id: 'camp-barrow', title: 'Barrowmaze', characters: new Set() } }), 'not-barrowmazes-secret')
check(refused.status === 401 && refused.reason === 'wrongSecret', `Barrowmaze's Foundry, posting with a wrong secret, is refused: ${refused.status} ${refused.reason}`)
/** Erebor heard just now, as its heartbeat would have it. */
const live = () => sql(`update campaign set "lastSeenAt" = now() where id = '${ID.erebor}'`)

// =================================================================================================
// 1. At 1280: the order and its labels
// =================================================================================================
part('1. the order')
live()
await page.goto(`${BASE}/campaigns`)
await rowOf(page, ID.erebor).waitFor()
{
  const list = await listOf(page)
  check(same(list, [
    { label: 'Needs you', shown: true, rows: ['Barrowmaze', 'Curse of Strahd'] },
    { label: 'Campaigns', shown: true, rows: ['Erebor', 'Frostmaiden'] },
  ]), `"Needs you" over the refused then the waiting, "Campaigns" over the live then the older (${JSON.stringify(list)})`)
  const rows = {}
  for (const [key, id] of Object.entries(ID)) rows[key] = await rowState(page, id)
  check(rows.barrow.chip === 'Refused' && rows.barrow.foot === 'Foundry’s posts refused: wrong secret' && rows.barrow.seats.length === 0
    && rows.strahd.chip === 'Waiting for Foundry' && rows.strahd.foot === 'Connect Foundry to start' && rows.strahd.sub === ADDRESS
    && rows.erebor.chip === 'Live' && rows.frost.chip === 'Offline',
    `the chips and flags: ${JSON.stringify([rows.barrow, rows.strahd].map(r => [r.chip, r.foot, r.sub]))}, Erebor ${rows.erebor.chip}, Frostmaiden ${rows.frost.chip}`)
  check(same(rows.erebor.seats, [['AA', 'Alice Adventurer as Thorin Oakenshield'], ['B', 'Bob as Vex'], ['?', 'Bard the Bowman, not chosen yet']])
    && rows.erebor.foot === '2 of 3 characters chosen' && rows.erebor.sub === `Ashlands · ${ADDRESS}`,
    `Erebor's row: "${rows.erebor.sub}", its seats each its player's letters, or ? for none chosen yet, "${rows.erebor.foot}" (${JSON.stringify(rows.erebor.seats)})`)
  check(rows.frost.seats.length === 5 && rows.frost.seats.every(([letters]) => letters === '?') && /^0 of 7 characters chosen ?Last heard [A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}\s?[AP]M$/.test(rows.frost.foot),
    `Frostmaiden's: five seats at most of its seven, and when Foundry was last heard: "${rows.frost.foot}"`)
  check(await page.getByRole('searchbox', { name: 'Find a campaign' }).count() === 0, 'with four campaigns, no search')
  // Named apart from step 9's, taken once Barrowmaze's secret is changed and its refusal gone.
  await shootBoth(desk, 'campaigns-needs-you-refused', page.getByRole('list', { name: 'Needs you' }))
}

// =================================================================================================
// 2. At 1280: the choice
// =================================================================================================
part('2. the choice')
{
  await until(async () => (await rowState(page, ID.barrow)).current === 'true', 'the first to be marked current', 10_000)
  check(await shownTitle(page) === 'Barrowmaze' && chosenIn(page) === null,
    'with none chosen, the first in order, Barrowmaze, is shown beside the list, its row current')
  const entries = await historyOf(page)
  await rowOf(page, ID.erebor).click()
  await page.getByRole('article', { name: 'Erebor', exact: true }).waitFor()
  const focus = await focusOf(page)
  check(chosenIn(page) === ID.erebor && await historyOf(page) === entries && focus.campaign === ID.erebor && (await rowState(page, ID.erebor)).current === 'true',
    `a click on Erebor shows it, replacing the address (${page.url()}), focus kept on its row`)
  await page.reload()
  await page.getByRole('article', { name: 'Erebor', exact: true }).waitFor()
  check(await shownTitle(page) === 'Erebor', 'a reload keeps it')
  await shootBoth(desk, 'campaigns')
}

// Eight more, connected once, each heard a day apart, for the search.
const MORE = [
  ['Ghosts of Saltmarsh', 'Saltmarsh Coast'], ['Hoard of the Dragon Queen', 'Greenest'], ['Lost Mine of Phandelver', 'Phandalin'],
  ['Out of the Abyss', 'Underdark'], ['Princes of the Apocalypse', 'Red Larch'], ['Tomb of Annihilation', 'Chult'],
  ['Waterdeep Heist', 'Waterdeep'], ['Wild Beyond the Witchlight', 'Feywild'],
]
for (const [index, [title, world]] of MORE.entries()) {
  const id = await setUp(title)
  ID[title] = id
  sql(`update campaign set "foundryId" = 'camp-more-${index}', "worldTitle" = '${world}', "lastSeenAt" = now() - interval '${index + 1} days' where id = '${id}'`)
}
await page.goto(`${BASE}/campaigns?campaign=${ID.erebor}`)
await page.getByRole('article', { name: 'Erebor', exact: true }).waitFor()
{
  const list = page.locator('[data-campaign]').first().locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]')
  const box = await list.evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight, page: document.documentElement.scrollHeight }))
  const last = rowOf(page, ID['Wild Beyond the Witchlight'])
  await last.scrollIntoViewIfNeeded()
  await last.click()
  await page.getByRole('article', { name: 'Wild Beyond the Witchlight', exact: true }).waitFor()
  check(box.scroll > box.client && box.client <= 800 && await page.locator('[data-campaign]').count() === 12,
    `with twelve at 1280 × 800, the list scrolls within itself (${JSON.stringify(box)}), and its last row, reached, is chosen`)
}

// =================================================================================================
// 3. Search
// =================================================================================================
part('3. search')
{
  const search = page.getByRole('searchbox', { name: 'Find a campaign' })
  const status = page.locator('p[role="status"].sr-only').first()
  check(await search.getAttribute('placeholder') === 'Find a campaign', 'from seven campaigns, "Find a campaign"')
  await search.fill('saltmarsh')
  await until(async () => same((await listOf(page)).flatMap(g => g.rows), ['Ghosts of Saltmarsh']), 'the search by title', 5_000)
  const one = await listOf(page)
  check(same(one, [{ label: 'Campaigns', shown: false, rows: ['Ghosts of Saltmarsh'] }]) && await status.textContent() === '1 campaign shown',
    `"saltmarsh" finds Ghosts of Saltmarsh by its title, none needing the Gamemaster, so no label; "1 campaign shown" (${JSON.stringify(one)})`)
  await search.fill('ashlands')
  await until(async () => (await listOf(page)).flatMap(g => g.rows).length === 2, 'the search by world', 5_000)
  check(same((await listOf(page)).flatMap(g => g.rows), ['Erebor', 'Frostmaiden']) && await status.textContent() === '2 campaigns shown',
    '"ashlands" finds Erebor and Frostmaiden by their world; "2 campaigns shown"')
  await search.fill('barrow')
  await until(async () => (await listOf(page)).flatMap(g => g.rows).length === 1, 'the search for Barrowmaze', 5_000)
  check(same(await listOf(page), [{ label: 'Needs you', shown: true, rows: ['Barrowmaze'] }]), 'the labels follow what the search leaves: "barrow", under Needs you alone')
  await search.fill('zzz')
  await page.getByText('No campaign matches “zzz”.').waitFor()
  check(await page.locator('[data-campaign]').count() === 0 && await shownTitle(page) === 'Wild Beyond the Witchlight',
    '"zzz": "No campaign matches “zzz”.", the campaign shown staying shown')
  await shootBoth(desk, 'campaigns-search-none', page.locator('[data-campaign], input[type="search"]').first().locator('xpath=ancestor::div[1]'))
  await search.press('Escape')
  await until(async () => (await page.locator('[data-campaign]').count()) === 12, 'all twelve again', 5_000)
  check(await search.inputValue() === '', 'Escape clears it, all twelve shown again')
}

// =================================================================================================
// 4. 390, 768 and 1024
// =================================================================================================
part('4. phones and tablets')
for (const [width, height] of [[390, 844], [768, 1024]]) {
  const small = await browse({ width, height })
  const p = small.page
  await rowOf(p, ID.erebor).waitFor()
  check(await p.getByRole('article').count() === 0 && await p.getByRole('heading', { name: 'Your campaigns', level: 1 }).isVisible(),
    `at ${width}, the list alone, under the page's heading`)
  if (width === 390) await shootBoth(small, 'campaigns-list')
  const entries = await historyOf(p)
  await rowOf(p, ID.erebor).click()
  const article = p.getByRole('article', { name: 'Erebor', exact: true })
  await article.waitFor()
  await until(async () => (await focusOf(p)).tag === 'h2', 'focus on the heading', 5_000).catch(() => {})
  const focus = await focusOf(p)
  const back = p.getByRole('button', { name: 'All campaigns' })
  check(chosenIn(p) === ID.erebor && await historyOf(p) === entries + 1 && await back.isVisible() && focus.tag === 'h2'
    && await rowOf(p, ID.erebor).isVisible() === false && await p.getByRole('heading', { name: 'Your campaigns', level: 1 }).count() === 1,
    `at ${width}, a tap shows Erebor in the list's place, the address pushed, "All campaigns" above it, focus on its heading, the page's own heading kept for screen readers (${JSON.stringify(focus)})`)
  if (width === 390) await shootBoth(small, 'campaigns-detail')
  await back.click()
  await rowOf(p, ID.erebor).waitFor()
  await until(async () => (await focusOf(p)).campaign === ID.erebor, 'focus on the row', 5_000).catch(() => {})
  check(chosenIn(p) === null && (await focusOf(p)).campaign === ID.erebor && await p.getByRole('article').count() === 0,
    `All campaigns: the list again, the address bare, focus on Erebor's row`)
  if (width === 390) {
    await rowOf(p, ID.strahd).click()
    await p.getByRole('article', { name: 'Curse of Strahd', exact: true }).waitFor()
    await p.goBack()
    await rowOf(p, ID.strahd).waitFor()
    check(chosenIn(p) === null && await p.getByRole('article').count() === 0, 'a tap, then the browser\'s Back: the list again')
  }
  await small.view.close()
}
{
  const tablet = await browse({ width: 1024, height: 768 })
  const p = tablet.page
  await rowOf(p, ID.erebor).waitFor()
  const entries = await historyOf(p)
  await rowOf(p, ID.erebor).click()
  await p.getByRole('article', { name: 'Erebor', exact: true }).waitFor()
  check(await rowOf(p, ID.barrow).isVisible() && chosenIn(p) === ID.erebor && await historyOf(p) === entries,
    'at 1024, the index wider than 900, list and campaign side by side, a click replacing the address')
  await tablet.view.close()
}

// =================================================================================================
// 5. Dialogs and toasts
// =================================================================================================
part('5. dialogs and toasts')
await page.goto(`${BASE}/campaigns?campaign=${ID.erebor}`)
const erebor = page.getByRole('article', { name: 'Erebor', exact: true })
await erebor.waitFor()
{
  // Copy.
  const copy = erebor.getByRole('button', { name: 'Copy invite link' })
  await copy.click()
  await erebor.getByRole('button', { name: 'Copied' }).waitFor()
  await until(async () => (await toastsOn(page)).includes('Invite link copied'), 'the toast', 5_000).catch(() => {})
  check((await toastsOn(page)).includes('Invite link copied') && flat(await erebor.getByRole('button', { name: 'Copied' }).textContent()) === 'Copied',
    `Copy: the toast "Invite link copied", and the button's word "Copied" (${JSON.stringify(await toastsOn(page))})`)
  // Reset link.
  const before = await erebor.locator('code').first().textContent()
  await erebor.getByRole('button', { name: 'Reset link' }).click()
  const reset = page.getByRole('dialog', { name: 'Reset the invite link?' })
  await reset.waitFor()
  const opened = await focusOf(page)
  await reset.getByRole('button', { name: 'Reset link' }).click()
  await until(async () => (await erebor.locator('code').first().textContent()) !== before, 'a new code', 15_000)
  await until(async () => (await toastsOn(page)).includes('A new invite link is ready'), 'the toast', 5_000).catch(() => {})
  // The new link isn't on the clipboard, so its button offers Copy again rather than staying Copied.
  const copyAgain = erebor.getByRole('button', { name: 'Copy invite link' })
  check(opened.name === 'Cancel' && (await toastsOn(page)).includes('A new invite link is ready') && await shownTitle(page) === 'Erebor'
    && await erebor.getByRole('button', { name: 'Copied' }).count() === 0 && await copyAgain.count() === 1 && flat(await copyAgain.textContent()) === 'Copy',
    `Reset link: its dialog opens on Cancel (${opened.name}); then "A new invite link is ready", a new code whose button says Copy again, Erebor still shown`)
  // Remove Bob.
  await erebor.getByRole('button', { name: 'Remove Bob as Vex' }).click()
  const remove = page.getByRole('dialog', { name: 'Remove Bob as Vex?' })
  await remove.waitFor()
  const cancel = await focusOf(page)
  await remove.getByRole('button', { name: 'Remove', exact: true }).click()
  await erebor.getByRole('listitem').filter({ hasText: 'Vex' }).getByText('Not chosen yet').waitFor({ timeout: 15_000 })
  await until(async () => (await focusOf(page)).name === "Open Vex's sheet", 'focus on the sheet link', 10_000).catch(() => {})
  check(cancel.name === 'Cancel' && (await focusOf(page)).name === "Open Vex's sheet" && await shownTitle(page) === 'Erebor',
    `Remove Bob: its dialog opens on Cancel; then focus on "Open Vex's sheet", Erebor still shown (${JSON.stringify(await focusOf(page))})`)
}
{
  // Change secret, on the refused campaign.
  await rowOf(page, ID.barrow).click()
  const barrow = page.getByRole('article', { name: 'Barrowmaze', exact: true })
  await barrow.waitFor()
  const box = barrow.locator('[data-refusal="wrongSecret"]')
  check(await box.evaluate(el => el.classList.contains('border-danger/40')), 'Barrowmaze\'s refusal, boxed while current')
  await shootBoth(desk, 'campaigns-refused', barrow)
  await barrow.locator('summary', { hasText: 'Change secret' }).click()
  await barrow.getByLabel('New secret').fill('barrowmaze-renewed-39')
  await barrow.getByRole('button', { name: 'Save secret' }).click()
  await barrow.getByRole('status').filter({ hasText: 'Saved.' }).waitFor({ timeout: 15_000 })
  await until(async () => (await box.count()) === 0, 'the refusal box to go', 15_000)
  await until(async () => (await toastsOn(page)).includes('Secret changed. Enter it in Foundry too.'), 'the toast', 5_000).catch(() => {})
  check((await toastsOn(page)).includes('Secret changed. Enter it in Foundry too.') && await shownTitle(page) === 'Barrowmaze' && chosenIn(page) === ID.barrow,
    'Change secret on the refused campaign: "Secret changed. Enter it in Foundry too.", the refusal box gone, Barrowmaze still shown though the list re-sorts')
}
{
  // Delete.
  const title = 'Wild Beyond the Witchlight'
  await rowOf(page, ID[title]).click()
  const doomed = page.getByRole('article', { name: title, exact: true })
  await doomed.waitFor()
  await doomed.getByRole('button', { name: 'Delete campaign' }).click()
  const dialog = page.getByRole('dialog', { name: `Delete ${title}?` })
  await dialog.waitFor()
  const opened = await focusOf(page)
  await dialog.getByRole('button', { name: 'Delete campaign' }).click()
  await rowOf(page, ID[title]).waitFor({ state: 'detached', timeout: 15_000 })
  await until(async () => (await focusOf(page)).id === 'your-campaigns' && chosenIn(page) === null, 'focus on the page\'s heading', 10_000).catch(() => {})
  await until(async () => (await toastsOn(page)).includes(`${title} deleted`), 'the toast', 5_000).catch(() => {})
  check(opened.name === 'Cancel' && (await toastsOn(page)).includes(`${title} deleted`) && chosenIn(page) === null && (await focusOf(page)).id === 'your-campaigns',
    `Delete: its dialog opens on Cancel; then "${title} deleted", its row gone, the address bare, focus on "Your campaigns" (${JSON.stringify(await focusOf(page))})`)
}

// =================================================================================================
// 6. New campaign › Done
// =================================================================================================
part('6. new campaign')
{
  const id = await setUp('Zhentarim Road')
  check(chosenIn(page) === id && await shownTitle(page) === 'Zhentarim Road' && (await rowState(page, id)).current === 'true',
    'New campaign › Done: the new one chosen in the address, and shown beside the list')
}

// =================================================================================================
// 7. Back links
// =================================================================================================
part('7. back links')
{
  await page.goto(`${BASE}/campaigns/${ID.erebor}/characters/thorin`)
  const back = page.getByRole('link', { name: 'Your campaigns' })
  await back.waitFor({ timeout: 20_000 })
  check(await back.getAttribute('href') === `/campaigns?campaign=${ID.erebor}`, `the Gamemaster's sheet's back arrow leads to its campaign: ${await back.getAttribute('href')}`)
  await back.click()
  await page.getByRole('article', { name: 'Erebor', exact: true }).waitFor()
  check(await shownTitle(page) === 'Erebor', 'followed, the campaigns page shows Erebor')
}

// =================================================================================================
// 8. The footer's Help, and the header's current page
// =================================================================================================
part('8. the footer')
const FORMS = [
  ['Report a bug (opens in a new tab)', 'https://github.com/lambersond/sending-stone-player/issues/new?template=bug_report.yml'],
  ['Request a feature (opens in a new tab)', 'https://github.com/lambersond/sending-stone-player/issues/new?template=feature_request.yml'],
]
for (const [width, height] of [[360, 780], [390, 844], [768, 1024], [1280, 800]]) {
  const who = await browse({ width, height })
  for (const path of ['/campaigns', '/characters']) {
    await who.page.goto(`${BASE}${path}`)
    const footer = who.page.getByRole('contentinfo')
    await footer.waitFor()
    const links = await footer.getByRole('navigation', { name: 'Help' }).getByRole('link')
      .evaluateAll(all => all.map(a => [a.textContent.replace(/\s+/g, ' ').trim(), a.getAttribute('href'), a.target, a.rel]))
    const current = await who.page.getByRole('banner').getByRole('link', { name: 'Campaigns' }).getAttribute('aria-current')
    check(same(links, FORMS.map(([name, href]) => [name, href, '_blank', 'noopener noreferrer'])) && await sideways(who.page) === 0
      && current === (path === '/campaigns' ? 'page' : null),
      `at ${width}, ${path}: the footer's Help, "Report a bug" and "Request a feature", each in a new tab; nothing scrolls sideways; the header's Campaigns ${current ? 'marked the current page' : 'not marked'}`)
    if (path === '/campaigns') await shootBoth(who, 'campaigns-footer', footer)
  }
  await who.view.close()
}

// =================================================================================================
// 9. Sizes and themes
// =================================================================================================
part('9. sizes and themes')
live()
for (const [width, height] of [[360, 780], [390, 844], [768, 1024], [1280, 800]]) {
  const who = await browse({ width, height })
  await rowOf(who.page, ID.erebor).waitFor()
  const side = {}
  for (const scheme of ['light', 'dark']) {
    await theme(who, scheme)
    side[scheme] = await sideways(who.page)
  }
  await theme(who, 'light')
  check(side.light === 0 && side.dark === 0, `at ${width}, light and dark, nothing scrolls sideways`)
  await shootBoth(who, 'campaigns')
  await shootBoth(who, 'campaigns-needs-you', who.page.getByRole('list', { name: 'Needs you' }))
  if (width < 900) {
    await rowOf(who.page, ID.erebor).click()
    await who.page.getByRole('article', { name: 'Erebor', exact: true }).waitFor()
    check(await sideways(who.page) === 0, `at ${width}, Erebor shown in the list's place scrolls nothing sideways`)
    await shootBoth(who, 'campaigns-detail')
  }
  await who.view.close()
}

note(`${posted.length} posts from Foundry`)
console.log('problems:', problems)
check(problems.length === 0, 'no page errors')
await browser.close()
process.exit(0)
