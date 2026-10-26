// Clear errors for the Gamemaster (cluster A, module 0.23.0), end to end: the real module, in a
// stand-in Foundry, posts from a browser on the game's page to the production app, which refuses
// what it won't take with its reason in JSON. The Gamemaster is told once per cause what went wrong
// and what to do, the settings window (module 0.24.0, its real templates drawn from its own
// context) shows each saved campaign's status lines on its Connection tab and its state on its dot
// down the side, and both clear once a post gets through again: a campaign the app has under
// another title, a secret changed in the app, a post too large, the app's address wrong. Since
// module 0.25.0 a "Last refused" line goes once the same kind of post gets through: a chat message,
// or that character's sheet. The campaign card in the app shows what it refused, at 390 and 768
// pixels. Last, the routes' refusals one by one, each JSON with its reason. Synthetic campaigns
// only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots
// to SHOTS.
import { mkdirSync, readFileSync } from 'node:fs'
import { actor, message, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'

const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'erebor-secret-12345'
const SECRET_B = 'mirkwood-secret-6789'
const NEW_SECRET = 'erebor-secret-renewed-42'
const SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const cookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(test, what, ms = 30_000) {
  const end = realNow() + ms
  while (!(await test())) {
    if (realNow() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(100)
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const shoot = async (page, name, options = {}) => {
  if (!SHOTS) return
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/${name}.png`, ...options })
}
// The module's clock, moved on for each heartbeat as the time it waits would pass.
const realNow = Date.now
let ahead = 0
Date.now = () => realNow() + ahead

// Foundry's hooks: callAll and call run their handlers at once, as Foundry's do.
const registry = new Map()
globalThis.Hooks = {
  on(name, fn) { if (!registry.has(name)) registry.set(name, []); registry.get(name).push(fn); return fn },
  once(name, fn) {
    const once = (...args) => { this.off(name, once); return fn(...args) }
    return this.on(name, once)
  },
  off(name, fn) { registry.set(name, (registry.get(name) ?? []).filter(f => f !== fn)) },
  call(name, ...args) {
    for (const fn of registry.get(name) ?? []) if (fn(...args) === false) return false
    return true
  },
  callAll(name, ...args) { return Promise.all((registry.get(name) ?? []).map(fn => fn(...args))).then(() => true) },
}

// ---- Foundry's page, which the module's requests come from ----
const browser = await chromium.launch()
const problems = []
const foundryContext = await browser.newContext({ viewport: { width: 900, height: 900 } })
for (const origin of [GAME, 'https://example.com']) {
  await foundryContext.grantPermissions(['local-network-access'], { origin })
  await foundryContext.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' }))
}
const gmTab = await foundryContext.newPage()
await gmTab.goto(`${GAME}/game`)
// Every post and fetch the module makes, as the app answered it, read in the page as the module
// reads it: its status, content type and body. One that fails outright fails as a browser's does.
// `relay.answerAs` changes what the module is told of an answer, as another app would answer.
// Since module 0.33.0 the module also fetches its commands for every dnd5e campaign whose app
// takes removals, rolls off too: made from the game's page as before, but kept apart from the
// posts checked here (a failing fetch would count as a post's try), and not waited on by idle().
const posted = []
const relay = { answerAs: null }
let inFlight = 0
let lastActivity = realNow()
globalThis.fetch = async (url, init) => {
  const command = String(url).endsWith('/api/bridge/commands')
  if (!command) inFlight++
  try {
    const { status, statusText, type, body, error } = await gmTab.evaluate(async ({ url, init }) => {
      try {
        const response = await fetch(url, init)
        return { status: response.status, statusText: response.statusText, type: response.headers.get('content-type'), body: await response.text() }
      } catch (error) {
        return { error: error.name }
      }
    }, { url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
    const sent = JSON.parse(init.body)
    if (error) {
      if (!command) posted.push({ url: String(url), type: sent.type ?? 'fetch', campaign: sent.campaign?.title, status: null, error, bytes: Buffer.byteLength(init.body) })
      throw error === 'TypeError' ? new TypeError('Failed to fetch') : new DOMException('The fetch failed', error)
    }
    const told = relay.answerAs && body ? relay.answerAs(sent, body) : body
    if (!command) posted.push({ url: String(url), type: sent.type ?? 'fetch', campaign: sent.campaign?.title, status, type_: type, body, bytes: Buffer.byteLength(init.body) })
    return {
      ok: status >= 200 && status < 300, status, statusText,
      headers: new Headers(type ? { 'content-type': type } : {}),
      json: async () => JSON.parse(told), text: async () => told,
    }
  } finally { if (!command) { inFlight--; lastActivity = realNow() } }
}
const idle = async () => {
  await wait(50)
  while (inFlight > 0 || realNow() - lastActivity < 300) await wait(25)
}
const take = () => posted.splice(0)

// What the Gamemaster is told.
const notices = []
ui.notifications.warn = text => notices.push({ level: 'warn', text })
ui.notifications.info = text => notices.push({ level: 'info', text })
const told = () => notices.splice(0)
const warned = list => list.filter(n => n.level === 'warn').map(n => n.text)
const informed = list => list.filter(n => n.level === 'info').map(n => n.text)

// ---- The Gamemaster sets up two campaigns in the app ----
const context = await browser.newContext({ viewport: { width: 1180, height: 900 } })
await context.addCookies([cookie])
const gm = await context.newPage()
gm.on('pageerror', e => problems.push(`gm pageerror: ${e.message}`))
await gm.goto(`${BASE}/campaigns`)
const modal = gm.getByRole('dialog', { name: 'New campaign' })
for (const [title, secret] of [['Erebor', SECRET], ['Mirkwood Forest', SECRET_B]]) {
  await gm.getByRole('button', { name: 'New campaign' }).click()
  await modal.getByLabel('Campaign title').fill(title)
  await modal.getByLabel('Forge game address').fill('lonely-mountain.forge-vtt.com')
  await modal.getByLabel('Secret', { exact: true }).fill(secret)
  await modal.getByRole('button', { name: 'Set up campaign' }).click()
  await modal.getByRole('button', { name: 'Done' }).click()
}
await gm.getByRole('article', { name: 'Mirkwood Forest' }).waitFor()
// Changed on purpose (round 0.39.0 §4.8): the campaigns page lists the campaigns, those that need
// their Gamemaster first, and shows one beside the list on a wide screen, or in its place on a phone,
// chosen in the address: Erebor and Mirkwood Forest are chosen in turn before each is read.
const ids = {
  erebor: sql(`select id from campaign where title = 'Erebor'`),
  mirkwood: sql(`select id from campaign where title = 'Mirkwood Forest'`),
}
/** A campaign's row on a page of the campaigns page: its chip, its line saying what it needs, and the group it's in. */
const rowOn = (page, id) => page.locator(`[data-campaign="${id}"]`)
const rowState = (page, id) => rowOn(page, id).evaluate(row => ({
  chip: row.querySelector('[data-state]')?.textContent ?? null,
  text: row.textContent.replace(/\s+/g, ' ').trim(),
  group: document.getElementById(row.closest('ul')?.getAttribute('aria-labelledby') ?? '')?.textContent ?? null,
}))
/** A campaign chosen from its row, its page shown beside the list. */
async function choose(id, title) {
  await rowOn(gm, id).click()
  await gm.getByRole('article', { name: title }).waitFor()
  await gm.waitForFunction(id => new URL(location.href).searchParams.get('campaign') === id, id)
}
/** The page's toasts, as each shows, from now until the page is loaded again. */
const watchToasts = page => page.evaluate(() => {
  globalThis.__toasts = []
  new MutationObserver(() => {
    for (const toast of document.querySelectorAll('[data-page-toast]')) {
      if (globalThis.__toasts.at(-1) !== toast.textContent) globalThis.__toasts.push(toast.textContent)
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
})
const toastsOn = page => page.evaluate(() => globalThis.__toasts ?? [])

// ---- Foundry, in English, with a Gamemaster, two players and their characters ----
const english = JSON.parse(readFileSync(`${MODULE}/lang/en.json`, 'utf8'))
const lookup = text => String(text).split('.').reduce((o, part) => (o && typeof o === 'object') ? o[part] : undefined, english)
game.i18n.localize = text => (typeof lookup(text) === 'string' ? lookup(text) : text)
game.i18n.format = (text, data = {}) => game.i18n.localize(text).replace(/{[^}]+}/g, match => data[match.slice(1, -1)] ?? match)
game.i18n.lang = 'en'
// The page Foundry is served on, which the module names to the Gamemaster.
globalThis.location = { origin: GAME, protocol: 'https:' }
foundry.utils.getProperty = (object, path) => path.split('.').reduce((o, k) => o?.[k], object)
const gmUser = user('gm', 'Gamemaster', true)
users.activeGM = gmUser
user('alice', 'Alice')
user('bob', 'Bob')
const thorin = actor('thorin', 'Thorin', ['alice'])
const vex = actor('vex', 'Vex', ['bob'])

// Foundry's window classes, which the settings window reads as it's first imported, with the
// module: the window is drawn from its own templates, in jsdom, and used as the Gamemaster would.
process.env.MODULE_DIR = MODULE
const { find, openSettings, view } = await import('./fvtt/settings-app.mjs')
await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
const { heartbeat } = await import(`${MODULE}/scripts/heartbeat.mjs`)
const { buildEnvelope } = await import(`${MODULE}/scripts/transport.mjs`)
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-e': SECRET, 'camp-m': SECRET_B })
settings.set('chatEvents', true)
settings.set('campaigns', [
  { id: 'camp-e', title: 'Erebor', characters: ['thorin'] },
  // The app has it as "Mirkwood Forest".
  { id: 'camp-m', title: 'Mirkwood', characters: ['vex'] },
])
await Hooks.callAll('ready')
await idle()

/** A heartbeat cycle: the module's clock moved on past its wait, and its heartbeat run. */
const beat = async () => {
  ahead += 31_000
  heartbeat()
  await idle()
}

// ---- The settings window, drawn with its own templates and styles from its own context ----
// Module 0.24.0 replaced Manage Campaigns, which listed every campaign's status lines at once, with
// one window: a campaign's lines show on its Connection tab, and its state, its worst line's, on its
// dot down the side, every line as the dot's tooltip. One window stays open from the start on
// Mirkwood's Connection tab, to show the lines and dots rewritten as posts go, never drawn again.
const styles = readFileSync(`${MODULE}/styles/sending-stone.css`, 'utf8')
const manageTab = await foundryContext.newPage()
await manageTab.goto(`${GAME}/game`)
manageTab.on('pageerror', e => problems.push(`manage pageerror: ${e.message}`))
const STATES = ['error', 'warning', 'ok', 'idle']
/** A campaign's status lines as a window shows them, on its Connection tab: `state text`. */
const linesIn = (win, id) => [...find(win, `[data-campaign-status="${id}"]`).querySelectorAll('span')].map(span => `${span.dataset.state} ${span.textContent}`)
/** A campaign's dot down a window's side: its state and tooltip, and what it's read out as. */
const dotIn = (win, id) => ({
  state: find(win, `nav.sending-stone-nav [data-campaign-state="${id}"]`).dataset.state,
  tooltip: find(win, `nav.sending-stone-nav [data-campaign-state="${id}"]`).dataset.tooltip,
  label: find(win, `nav.sending-stone-nav [data-campaign-state-label="${id}"]`).textContent,
})
/**
 * Each saved campaign's status lines, by its id, as the settings window shows them now: `state
 * text`. A window opened afresh shows each campaign's at its Connection tab, as its context says,
 * and its dot its worst line's state, with every line; the window open throughout shows the same.
 */
async function manageCampaigns(shot) {
  const win = await openSettings()
  const shown = {}
  const dots = {}
  try {
    for (const { id } of game.settings.get('sending-stone', 'campaigns')) {
      await view(win, 'campaign', { campaignId: id, tab: 'connection' })
      shown[id] = linesIn(win, id)
      // What the template shows is what the window's context says.
      const drawn = await win._prepareContext()
      const context = drawn.campaign.status.map(({ state, text }) => `${state} ${text}`)
      if (!same(shown[id], context)) throw new Error(`The settings window shows ${id}'s lines as ${JSON.stringify(shown[id])}, its context ${JSON.stringify(context)}`)
      const side = drawn.nav.campaigns.find(campaign => campaign.id === id)
      const worst = STATES.find(state => drawn.campaign.status.some(line => line.state === state)) ?? 'idle'
      dots[id] = dotIn(win, id)
      const expected = { state: worst, tooltip: drawn.campaign.status.map(line => line.text).join(' '), label: game.i18n.localize(`SENDINGSTONE.Config.State.${worst}`) }
      if (!same(dots[id], expected) || !same(side.lines, drawn.campaign.status)) throw new Error(`${id}'s dot is ${JSON.stringify(dots[id])}, its lines' ${JSON.stringify(expected)}`)
      // The window at the campaign's Connection tab, its status beneath its secret.
      if (shot && SHOTS) {
        await manageTab.evaluate(({ html, styles }) => {
          document.body.innerHTML = `<style>${styles} body { font: 14px sans-serif; background: #f2efe6; color: #191813; padding: 12px; width: 880px }</style>${html}`
        }, { html: win.element.outerHTML, styles })
        await manageTab.waitForTimeout(200)
        await manageTab.locator('#sending-stone-settings').screenshot({ path: `${SHOTS}/${shot}-${id}.png` })
      }
    }
  } finally {
    await win.close()
  }
  // The window open throughout: Mirkwood's lines, and every dot, rewritten as they changed.
  const kept = { lines: linesIn(live, 'camp-m'), dots: Object.fromEntries(Object.keys(dots).map(id => [id, dotIn(live, id)])), renders: live.renders }
  if (!same(kept, { lines: shown['camp-m'], dots, renders: liveRenders })) throw new Error(`The window open throughout shows ${JSON.stringify(kept)}, afresh ${JSON.stringify({ lines: shown['camp-m'], dots })}`)
  return shown
}
// The window open throughout, at Mirkwood's Connection tab, as the Gamemaster left it.
const live = await openSettings()
await view(live, 'campaign', { campaignId: 'camp-m', tab: 'connection' })
const liveRenders = live.renders
const TIME = '\\d{1,2}:\\d{2}\\s?[AP]M'
const line = (state, text) => new RegExp(`^${state} ${text.split('{time}').map(part => part.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(TIME)}$`)
const shows = (lines, ...expected) => lines?.length === expected.length && expected.every((re, index) => re.test(lines[index]))

// ---- E1: a campaign the app has under another title: told once, however often it's refused ----
let out = take()
const hellos = Object.fromEntries(out.filter(p => p.type === 'bridge.hello').map(p => [p.campaign, p]))
const refusal = hellos.Mirkwood && JSON.parse(hellos.Mirkwood.body)
check(hellos.Erebor?.status === 200 && hellos.Mirkwood?.status === 404 && hellos.Mirkwood.type_ === 'application/json'
  && same(refusal, { reason: 'notSetUp', message: `No campaign titled “Mirkwood” is set up for ${GAME} in Sending Stone` }),
  `Erebor's hello is taken; Mirkwood's is refused 404, saying why in JSON: ${hellos.Mirkwood?.body}`)
for (let cycle = 0; cycle < 3; cycle++) await beat()
out = take()
let said = told()
const NOT_SET_UP = `Sending Stone: The app has no campaign titled “Mirkwood” for this game, ${GAME}. Set it up in the Sending Stone app with this title and this game's Forge address, or rename it here to match the app's, then Test.`
check(out.filter(p => p.type === 'bridge.heartbeat' && p.campaign === 'Mirkwood' && p.status === 404).length === 3
  && out.filter(p => p.type === 'bridge.heartbeat' && p.campaign === 'Erebor' && p.status === 200).length === 3,
  `three heartbeat cycles later, Mirkwood's every post is refused, Erebor's taken (${out.map(p => `${p.type} ${p.campaign} ${p.status}`).join(', ')})`)
check(same(warned(said), [NOT_SET_UP]) && informed(said).length === 0,
  `the Gamemaster is told once, naming Mirkwood and what to do, and told nothing in between: ${JSON.stringify(said.map(n => n.text))}`)
let lines = await manageCampaigns('errors-manage-notsetup')
check(shows(lines['camp-m'], line('error', `Not delivered since {time}: The app has no campaign titled “Mirkwood” for this game, ${GAME}.`))
  && shows(lines['camp-e'], line('ok', 'Delivered at {time}.')),
  `the settings window says Mirkwood's posts aren't delivered, and why, and Erebor's are: ${JSON.stringify(lines)}`)
const mirkwoodRefusal = () => sql(`select concat_ws('|', "refusalReason", "refusalStatus", "refusalDetail", "refusedAt" is not null) from campaign where title = 'Mirkwood Forest'`)
check(mirkwoodRefusal() === 'notSetUp|404|Mirkwood|t', `the app keeps the refusal on the campaign waiting for this game (${mirkwoodRefusal()})`)

// ---- E2: the campaign card says what Foundry sent, and what to rename it to, on a phone and a tablet ----
for (const [width, height] of [[390, 844], [768, 1024]]) {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true })
  await view.addCookies([cookie])
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  const card = page.getByRole('article', { name: 'Mirkwood Forest' })
  if (width === 390) {
    // On a phone, the list alone: Mirkwood Forest's row under Needs you, refused, saying why; a tap
    // shows its page in the list's place.
    await page.goto(`${BASE}/campaigns`)
    await rowOn(page, ids.mirkwood).waitFor()
    const rows = { mirkwood: await rowState(page, ids.mirkwood), erebor: await rowState(page, ids.erebor) }
    check(rows.mirkwood.group === 'Needs you' && rows.mirkwood.chip === 'Refused' && rows.mirkwood.text.includes('Foundry’s posts refused: title doesn’t match')
      && rows.erebor.group === 'Campaigns' && rows.erebor.chip === 'Live' && await card.count() === 0,
      `at 390, the list alone: Mirkwood Forest under Needs you, Refused, "Foundry’s posts refused: title doesn’t match"; Erebor, Live, under Campaigns (${JSON.stringify(rows)})`)
    await shoot(page, 'errors-list-390')
    await rowOn(page, ids.mirkwood).click()
  } else {
    await page.goto(`${BASE}/campaigns?campaign=${ids.mirkwood}`)
  }
  const note = card.locator('[data-refusal=notSetUp]')
  await note.waitFor()
  const text = await note.textContent()
  const fits = await card.evaluate(el => ({
    card: el.scrollWidth <= el.clientWidth, page: document.scrollingElement.scrollWidth <= innerWidth,
    note: el.querySelector('[data-refusal]').getBoundingClientRect().right <= el.getBoundingClientRect().right + 0.5,
  }))
  const boxed = await note.evaluate(el => el.classList.contains('border-danger/40'))
  check(/^At \d{1,2}:\d{2}/.test(text) && text.includes('Foundry sent a campaign titled “Mirkwood” from this game, and no campaign here has that title.')
    && text.includes('rename it to “Mirkwood Forest” on its Connection tab in Sending Stone’s settings in Foundry.') && boxed
    && await page.getByRole('article', { name: 'Erebor' }).locator('[data-refusal]').count() === 0,
    `at ${width}×${height}, the Mirkwood Forest card says, boxed, what Foundry sent and what to rename it to: "${text}"`)
  check(fits.card && fits.page && fits.note, `at ${width}×${height}, the note wraps, widening neither the card nor the page (${JSON.stringify(fits)})`)
  await card.scrollIntoViewIfNeeded()
  await shoot(page, `errors-card-${width}`)
  await view.close()
}

// ---- E3: renamed in Foundry, the campaign is taken, and the Gamemaster told so ----
await game.settings.set('sending-stone', 'campaigns', [
  { id: 'camp-e', title: 'Erebor', characters: ['thorin'] },
  { id: 'camp-m', title: 'Mirkwood Forest', characters: ['vex'] },
])
await until(() => posted.some(p => p.type === 'bridge.hello' && p.campaign === 'Mirkwood Forest'), "Mirkwood Forest's hello", 15_000)
await idle()
out = take()
said = told()
check(out.some(p => p.type === 'bridge.hello' && p.campaign === 'Mirkwood Forest' && p.status === 200)
  && sql(`select "foundryId" from campaign where title = 'Mirkwood Forest'`) === 'camp-m',
  `renamed "Mirkwood Forest", its hello is taken, and the app binds the campaign (${out.map(p => `${p.type} ${p.campaign} ${p.status}`).join(', ')})`)
check(same(informed(said), ["Sending Stone delivers Mirkwood Forest's events to the app again."]) && warned(said).length === 0,
  `the Gamemaster is told once that its events are delivered again: ${JSON.stringify(said.map(n => n.text))}`)
lines = await manageCampaigns()
check(shows(lines['camp-m'], line('ok', 'Delivered at {time}.')), `the settings window says so too: ${JSON.stringify(lines['camp-m'])}`)
await gm.reload()
const mirkwoodCard = gm.getByRole('article', { name: 'Mirkwood Forest' })
await mirkwoodCard.getByText('Live').waitFor({ timeout: 10_000 })
check(await mirkwoodCard.locator('[data-refusal]').count() === 0 && mirkwoodRefusal() === 'f', 'its card, reloaded, is Live, with no refusal: binding cleared it')
{
  const row = await rowState(gm, ids.mirkwood)
  const needs = await gm.getByRole('heading', { name: 'Needs you' }).count()
  check(row.chip === 'Live' && row.group === 'Campaigns' && needs === 0 && !row.text.includes('refused'),
    `and its row is Live, no longer needing the Gamemaster: with none that does, no Needs you (${JSON.stringify({ ...row, needs })})`)
}

// ---- E4: a secret changed in the app: told once, and that it's taken again with the new one ----
const ereborCard = gm.getByRole('article', { name: 'Erebor' })
await choose(ids.erebor, 'Erebor')
await watchToasts(gm)
await ereborCard.getByText('Change secret').click()
await ereborCard.getByLabel('New secret').fill(NEW_SECRET)
await ereborCard.getByRole('button', { name: 'Save secret' }).click()
await ereborCard.getByRole('status').filter({ hasText: 'Saved.' }).waitFor()
await until(async () => (await toastsOn(gm)).includes('Secret changed. Enter it in Foundry too.'), 'the toast', 5_000).catch(() => {})
check((await toastsOn(gm)).includes('Secret changed. Enter it in Foundry too.') && new URL(gm.url()).searchParams.get('campaign') === ids.erebor
  && await gm.getByRole('article').getByRole('heading', { level: 2 }).first().textContent() === 'Erebor',
  `Save secret says "Saved." where it stays, and in a toast "Secret changed. Enter it in Foundry too." (${JSON.stringify(await toastsOn(gm))}); Erebor still shown`)
await beat()
await beat()
out = take()
said = told()
const refusedSecret = out.find(p => p.campaign === 'Erebor' && p.status === 401)
const WRONG_SECRET = "Sending Stone: The app refused Erebor's secret. Enter the secret set for Erebor in the Sending Stone app, then Test."
check(refusedSecret && same(JSON.parse(refusedSecret.body), { reason: 'wrongSecret', message: 'The secret isn’t this campaign’s in Sending Stone' })
  && out.filter(p => p.campaign === 'Erebor').every(p => p.status === 401),
  `with the secret changed in the app, Erebor's posts are refused 401 wrongSecret (${out.map(p => `${p.type} ${p.campaign} ${p.status}`).join(', ')})`)
check(same(warned(said), [WRONG_SECRET]) && informed(said).length === 0, `the Gamemaster is told once, and what to do: ${JSON.stringify(said.map(n => n.text))}`)
lines = await manageCampaigns('errors-manage-wrongsecret')
check(shows(lines['camp-e'], line('error', "Not delivered since {time}: The app refused Erebor's secret."))
  && shows(lines['camp-m'], line('ok', 'Delivered at {time}.')), `the settings window says Erebor's secret is refused: ${JSON.stringify(lines)}`)
await gm.reload()
let secretNote = gm.getByRole('article', { name: 'Erebor' }).locator('[data-refusal=wrongSecret]')
await secretNote.waitFor()
check((await secretNote.textContent()).includes('Sending Stone refused Foundry’s post for this campaign: the secret it came with isn’t this campaign’s.')
  && await secretNote.evaluate(el => el.classList.contains('border-danger/40')), `the Erebor card says so, boxed: "${await secretNote.textContent()}"`)
{
  const row = await rowState(gm, ids.erebor)
  check(row.group === 'Needs you' && row.chip === 'Refused' && row.text.includes('Foundry’s posts refused: wrong secret'),
    `its row, under Needs you: Refused, "Foundry’s posts refused: wrong secret" (${JSON.stringify(row)})`)
}
await game.settings.set('sending-stone', 'campaignSecrets', { 'camp-e': NEW_SECRET, 'camp-m': SECRET_B })
await beat()
out = take()
said = told()
check(out.some(p => p.campaign === 'Erebor' && p.status === 200) && out.filter(p => p.campaign === 'Erebor').every(p => p.status < 300),
  `given the new secret, Erebor's posts are taken (${out.map(p => `${p.type} ${p.campaign} ${p.status}`).join(', ')})`)
check(same(informed(said), ["Sending Stone delivers Erebor's events to the app again."]) && warned(said).length === 0, `and the Gamemaster told so, once: ${JSON.stringify(said.map(n => n.text))}`)
lines = await manageCampaigns()
check(shows(lines['camp-e'], line('ok', 'Delivered at {time}.')), `the settings window says Erebor's posts are delivered: ${JSON.stringify(lines['camp-e'])}`)
await gm.reload()
secretNote = gm.getByRole('article', { name: 'Erebor' }).locator('[data-refusal=wrongSecret]')
await secretNote.waitFor()
check((await secretNote.textContent()).includes('Foundry has reached the app since, at') && !(await secretNote.evaluate(el => el.classList.contains('border-danger/40')))
  && await secretNote.evaluate(el => el.classList.contains('text-text-secondary')),
  `the card's note, reloaded, is muted, saying Foundry has reached the app since: "${await secretNote.textContent()}"`)

// ---- A post too large: told once per campaign and kind, the campaign's posts going on ----
// A whisper to Alice goes to Erebor alone, whose characters she plays; one to Bob, to Mirkwood Forest.
const whisper = (id, to, bytes) => message(id, { whisper: [to], content: `<p>${'A long letter. '.repeat(Math.ceil(bytes / 15))}</p>` })
await Hooks.callAll('createChatMessage', whisper('m-huge', 'alice', 4_100_000))
await idle()
out = take()
said = told()
const TOO_LARGE = /^Sending Stone: A chat message for Erebor came to (\d+\.\d) MB, more than the 4\.0 MB the app takes, and wasn't sent\. Nothing else is held back\.$/
check(out.length === 0 && warned(said).length === 1 && TOO_LARGE.test(warned(said)[0]) && Number(TOO_LARGE.exec(warned(said)[0])[1]) > 4 && informed(said).length === 0,
  `a whisper to Alice with 4 MB of text is not sent, larger than the app takes, and the Gamemaster is told so once: ${JSON.stringify(said.map(n => n.text))}`)
lines = await manageCampaigns('errors-manage-toolarge')
check(shows(lines['camp-e'], line('ok', 'Delivered at {time}.'), /^warning Last refused at \d{1,2}:\d{2}\s?[AP]M: A chat message for Erebor came to \d+\.\d MB, more than the 4\.0 MB the app takes, and wasn't sent\.$/),
  `the settings window says what was refused, Erebor's posts still delivered: ${JSON.stringify(lines['camp-e'])}`)
await Hooks.callAll('createChatMessage', whisper('m-huge-2', 'alice', 4_200_000))
await Hooks.callAll('createChatMessage', whisper('m-small', 'alice', 40))
await idle()
out = take()
said = told()
check(said.length === 0 && same(out.map(p => `${p.type} ${p.campaign} ${p.status}`), ['chat.message.created Erebor 204']),
  `another too large isn't told again, and a small whisper after it is taken, telling nothing (${JSON.stringify(said)})`)
// Since module 0.25.0 a chat message getting through clears the last refused one's line.
lines = await manageCampaigns()
check(shows(lines['camp-e'], line('ok', 'Delivered at {time}.')),
  `with the whisper taken, the settings window says Erebor's posts are delivered, the refused one's line gone: ${JSON.stringify(lines['camp-e'])}`)
// The app's own limit: told by an app that says it takes larger posts, the module sends one, which
// the app refuses 413, saying its limit.
const claimLarger = (sent, body) => {
  if (sent.campaign?.id !== 'camp-m') return body
  const answer = JSON.parse(body)
  if (answer.features?.maxBytes) answer.features.maxBytes = 8_000_000
  return JSON.stringify(answer)
}
relay.answerAs = claimLarger
await beat()
take()
// Its text comes twice in the post, as HTML and as text: some 4.3 MB, under what the app said.
await Hooks.callAll('createChatMessage', whisper('m-huge-3', 'bob', 2_100_000))
await idle()
out = take()
said = told()
const big = out.find(p => p.type === 'chat.message.created')
check(big?.status === 413 && same(JSON.parse(big.body), { reason: 'tooLarge', message: 'Larger than the 4000000 bytes Sending Stone takes', limit: 4000000 }),
  `posted to an app that takes less than it said, the whisper to Bob is refused 413, with the app's limit: ${big?.body}`)
check(warned(said).length === 1 && /^Sending Stone: A chat message for Mirkwood Forest came to \d+\.\d MB, more than the 4\.0 MB the app takes, and wasn't sent\. Nothing else is held back\.$/.test(warned(said)[0]) && informed(said).length === 0,
  `the Gamemaster is told once, with the app's limit: ${JSON.stringify(said.map(n => n.text))}`)
lines = await manageCampaigns()
check(shows(lines['camp-m'], line('ok', 'Delivered at {time}.'), /^warning Last refused at .+: A chat message for Mirkwood Forest came to \d+\.\d MB, more than the 4\.0 MB the app takes, and wasn't sent\.$/),
  `the settings window says Mirkwood Forest's posts are delivered, and what was last refused: ${JSON.stringify(lines['camp-m'])}`)
relay.answerAs = null
await Hooks.callAll('createChatMessage', whisper('m-small-2', 'bob', 40))
await idle()
out = take()
lines = await manageCampaigns()
check(same(out.map(p => `${p.type} ${p.campaign} ${p.status}`), ['chat.message.created Mirkwood Forest 204'])
  && shows(lines['camp-m'], line('ok', 'Delivered at {time}.')),
  `the next whisper is taken: the settings window says Mirkwood Forest's posts are delivered, the refused one's line gone (module 0.25.0): ${JSON.stringify(lines['camp-m'])}`)

// ---- A sheet too large for the app (module 0.25.0): its line goes once that sheet is sent ----
// Told again by an app that says it takes larger posts, the module sends Vex's sheet, grown past
// what the app takes, which refuses it 413. A post of another kind getting through leaves the line;
// Vex's next sheet, back to size, clears it, in the window open throughout too.
relay.answerAs = claimLarger
await beat()
take()
told()
const portrait = vex.img
const sheetTo = title => posted.some(p => p.type === 'character.updated' && p.campaign === title)
vex.img = `data:image/webp;base64,${'A'.repeat(4_100_000)}`
await Hooks.callAll('updateActor', vex, { img: vex.img })
await until(() => sheetTo('Mirkwood Forest'), "Vex's sheet to be sent", 15_000)
await idle()
out = take()
said = told()
const bigSheet = out.find(p => p.type === 'character.updated' && p.campaign === 'Mirkwood Forest')
check(bigSheet?.status === 413 && bigSheet.bytes > 4_000_000 && bigSheet.bytes < 8_000_000
  && same(JSON.parse(bigSheet.body), { reason: 'tooLarge', message: 'Larger than the 4000000 bytes Sending Stone takes', limit: 4000000 }),
  `Vex's sheet, ${bigSheet?.bytes} bytes, under what the app said it takes, is refused 413, with the app's limit: ${bigSheet?.body}`)
check(warned(said).length === 1 && /^Sending Stone: A character's sheet for Mirkwood Forest came to \d+\.\d MB, more than the 4\.0 MB the app takes, and wasn't sent\. Nothing else is held back\.$/.test(warned(said)[0]) && informed(said).length === 0,
  `the Gamemaster is told once: ${JSON.stringify(said.map(n => n.text))}`)
const SHEET_REFUSED = /^warning Last refused at \d{1,2}:\d{2}\s?[AP]M: A character's sheet for Mirkwood Forest came to \d+\.\d MB, more than the 4\.0 MB the app takes, and wasn't sent\.$/
lines = await manageCampaigns('errors-manage-sheet-refused')
check(shows(lines['camp-m'], line('ok', 'Delivered at {time}.'), SHEET_REFUSED),
  `the settings window says Vex's sheet was refused, Mirkwood Forest's posts still delivered: ${JSON.stringify(lines['camp-m'])}`)
await Hooks.callAll('createChatMessage', whisper('m-small-3', 'bob', 40))
await idle()
out = take()
lines = await manageCampaigns()
check(same(out.map(p => `${p.type} ${p.campaign} ${p.status}`), ['chat.message.created Mirkwood Forest 204'])
  && shows(lines['camp-m'], line('ok', 'Delivered at {time}.'), SHEET_REFUSED),
  `a whisper to Bob taken, the sheet's line stays: a post of another kind says nothing of sheets (${JSON.stringify(lines['camp-m'])})`)
vex.img = portrait
await Hooks.callAll('updateActor', vex, { img: vex.img })
await until(() => sheetTo('Mirkwood Forest'), "Vex's next sheet to be sent", 15_000)
await idle()
out = take()
said = told()
lines = await manageCampaigns('errors-manage-sheet-sent')
check(same(out.map(p => `${p.type} ${p.campaign}`), ['character.updated Mirkwood Forest']) && out[0].status < 300 && said.length === 0
  && shows(lines['camp-m'], line('ok', 'Delivered at {time}.')),
  `Vex's next sheet, back to size, is taken, telling nothing, and the settings window's Last refused line is gone, in the window open throughout too: ${JSON.stringify(lines['camp-m'])}`)
relay.answerAs = null

// ---- E5: the app's address wrong: told once for every campaign, and once that it's reached again ----
await game.settings.set('sending-stone', 'listenerUrl', 'localhost:3999')
await beat()
// Each post is tried three times, a second and three seconds apart, before it's given up.
const failedFor = title => posted.filter(p => p.campaign === title && p.error === 'TypeError').length
await until(() => failedFor('Erebor') >= 3 && failedFor('Mirkwood Forest') >= 3, "both campaigns' posts to fail three times", 30_000)
await idle()
out = take()
said = told()
const UNREACHABLE = "Sending Stone: Sending Stone can't reach the app at http://localhost:3999. Check the address in Sending Stone's settings (Test says more) and that the app is up. Events are lost until it answers; characters are sent again once it does."
check(out.length > 0 && out.every(p => p.error === 'TypeError') && new Set(out.map(p => p.campaign)).size === 2,
  `with the address wrong, both campaigns' posts fail outright (${out.length}: ${[...new Set(out.map(p => `${p.type} ${p.campaign}`))].join(', ')})`)
check(same(warned(said), [UNREACHABLE]) && informed(said).length === 0, `the Gamemaster is told once, naming the address, whichever campaign: ${JSON.stringify(said.map(n => n.text))}`)
lines = await manageCampaigns('errors-manage-unreachable')
const failing = line('error', "Not delivered since {time}: Sending Stone can't reach the app at http://localhost:3999.")
check(shows(lines['camp-e'].slice(0, 1), failing) && shows(lines['camp-m'].slice(0, 1), failing), `the settings window says each campaign's posts aren't delivered, and why: ${JSON.stringify(lines)}`)
await game.settings.set('sending-stone', 'listenerUrl', new URL(BASE).host)
await beat()
await until(() => notices.length > 0, 'the Gamemaster to be told it reaches the app', 30_000)
await idle()
out = take()
said = told()
check(out.some(p => p.campaign === 'Erebor' && p.status < 300) && out.some(p => p.campaign === 'Mirkwood Forest' && p.status < 300)
  && same(informed(said), ['Sending Stone reaches the app again.']) && warned(said).length === 0,
  `the address put right, both campaigns' posts are taken, and the Gamemaster told so once: ${JSON.stringify(said.map(n => n.text))}`)
lines = await manageCampaigns()
check(shows(lines['camp-e'].slice(0, 1), line('ok', 'Delivered at {time}.')) && shows(lines['camp-m'].slice(0, 1), line('ok', 'Delivered at {time}.')),
  `the settings window says both are delivered again: ${JSON.stringify(lines)}`)

// ---- E6: each refusal, in JSON, from the game's page and another's ----
const otherTab = await foundryContext.newPage()
await otherTab.goto('https://example.com/')
const raw = (page, path, body, secret, { text } = {}) => page.evaluate(async ({ url, body, secret, text }) => {
  const headers = { 'Content-Type': 'application/json' }
  if (secret) headers.Authorization = `Bearer ${secret}`
  const response = await fetch(url, { method: 'POST', headers, body: text ?? JSON.stringify(body) })
  return { status: response.status, type: response.headers.get('content-type'), body: await response.json().catch(() => null) }
}, { url: `${BASE}${path}`, body, secret, text })
const erebor = { id: 'camp-e', title: 'Erebor', characters: new Set(['thorin']) }
const chatCleared = buildEnvelope('chat.cleared', {}, { campaign: erebor })
const answers = {
  noSecret: await raw(gmTab, '/api/events', chatCleared),
  notForge: await raw(otherTab, '/api/events', chatCleared, NEW_SECRET),
  protocol: await raw(gmTab, '/api/events', { ...chatCleared, protocol: 3 }, NEW_SECRET),
  garbage: await raw(gmTab, '/api/events', null, NEW_SECRET, { text: 'not json at all' }),
  noCampaign: await raw(gmTab, '/api/events', { ...chatCleared, campaign: null }, NEW_SECRET),
  noId: await raw(gmTab, '/api/events', buildEnvelope('command.result', { status: 'done' }, { campaign: erebor, sequenced: false }), NEW_SECRET),
  huge: await raw(gmTab, '/api/events', null, NEW_SECRET, { text: JSON.stringify({ ...chatCleared, data: { pad: 'x'.repeat(4_100_000) } }) }),
}
const json = answer => answer.type === 'application/json'
check(answers.noSecret.status === 401 && json(answers.noSecret) && same(answers.noSecret.body, { reason: 'noSecret', message: 'Send the campaign’s secret' }), `events without a secret: 401 ${JSON.stringify(answers.noSecret.body)}`)
check(answers.notForge.status === 403 && same(answers.notForge.body, { reason: 'notForge', message: 'Only games on The Forge are accepted' }), `from a page not on The Forge, read there: 403 ${JSON.stringify(answers.notForge.body)}`)
check(answers.protocol.status === 400 && same(answers.protocol.body, { reason: 'unsupportedProtocol', message: 'Unsupported protocol 3', protocol: 2 }), `another protocol: 400 ${JSON.stringify(answers.protocol.body)}`)
check(answers.garbage.status === 400 && same(answers.garbage.body, { reason: 'badEnvelope', message: 'Not a Sending Stone envelope' }), `not an envelope: 400 ${JSON.stringify(answers.garbage.body)}`)
check(answers.noCampaign.status === 400 && same(answers.noCampaign.body, { reason: 'malformed', message: 'No campaign for chat.cleared', type: 'chat.cleared' }), `no campaign: 400 ${JSON.stringify(answers.noCampaign.body)}`)
check(answers.noId.status === 400 && answers.noId.body?.reason === 'malformed' && answers.noId.body.message === 'Malformed command.result' && answers.noId.body.type === 'command.result'
  && typeof answers.noId.body.detail === 'string' && answers.noId.body.detail.length > 0, `a roll's result without its id: 400 ${JSON.stringify(answers.noId.body)}`)
check(answers.huge.status === 413 && same(answers.huge.body, { reason: 'tooLarge', message: 'Larger than the 4000000 bytes Sending Stone takes', limit: 4000000 }), `4.1 MB: 413 ${JSON.stringify(answers.huge.body)}`)
await gm.reload()
const malformedNote = gm.getByRole('article', { name: 'Erebor' }).locator('[data-refusal=malformed]')
await malformedNote.waitFor()
const malformedText = await malformedNote.textContent()
check(malformedText.includes('Sending Stone couldn’t read what Foundry sent and dropped it: command.result') && malformedText.includes('Update the Sending Stone module; if it happens again, report it.')
  && await malformedNote.evaluate(el => el.classList.contains('border-danger/40')),
  `the Erebor card shows the malformed result it dropped, and what to do: "${malformedText}"`)
{
  const row = await rowState(gm, ids.erebor)
  check(row.group === 'Needs you' && row.chip === 'Refused' && row.text.includes('Foundry’s posts refused: couldn’t read them'),
    `its row: Refused, "Foundry’s posts refused: couldn’t read them" (${JSON.stringify(row)})`)
}
await shoot(gm, 'errors-card-malformed', { fullPage: true })

const fetchBody = (campaign, extra = {}) => ({ protocol: 2, session: 'e2e-session', campaign: { id: campaign.id, title: campaign.title }, ...extra })
const commands = {
  wrongSecret: await raw(gmTab, '/api/bridge/commands', fetchBody(erebor), 'not-erebors-secret'),
  notSetUp: await raw(gmTab, '/api/bridge/commands', fetchBody({ id: 'camp-x', title: 'Lake-town' }), NEW_SECRET),
  garbage: await raw(gmTab, '/api/bridge/commands', null, NEW_SECRET, { text: '{"nothing": true' }),
  huge: await raw(gmTab, '/api/bridge/commands', fetchBody(erebor, { pad: 'x'.repeat(5_000) }), NEW_SECRET),
}
check(commands.wrongSecret.status === 401 && json(commands.wrongSecret) && same(commands.wrongSecret.body, { reason: 'wrongSecret', message: 'The secret isn’t this campaign’s in Sending Stone' }), `a fetch with a wrong secret: 401 ${JSON.stringify(commands.wrongSecret.body)}`)
check(commands.notSetUp.status === 404 && same(commands.notSetUp.body, { reason: 'notSetUp', message: `No campaign titled “Lake-town” is set up for ${GAME} in Sending Stone` }), `a fetch for a campaign not set up: 404 ${JSON.stringify(commands.notSetUp.body)}`)
check(commands.garbage.status === 400 && same(commands.garbage.body, { reason: 'badEnvelope', message: 'Not a Sending Stone fetch' }), `not a fetch: 400 ${JSON.stringify(commands.garbage.body)}`)
check(commands.huge.status === 413 && same(commands.huge.body, { reason: 'tooLarge', message: 'Larger than the 4096 bytes Sending Stone takes', limit: 4096 }), `a 5 KB fetch: 413 ${JSON.stringify(commands.huge.body)}`)
// A fetch with a wrong secret is recorded on the campaign too, as a post's is.
await gm.reload()
const fetchNote = gm.getByRole('article', { name: 'Erebor' }).locator('[data-refusal=wrongSecret]')
await fetchNote.waitFor()
check((await fetchNote.textContent()).includes('the secret it came with isn’t this campaign’s') && await gm.getByRole('article', { name: 'Erebor' }).locator('[data-refusal]').count() === 1,
  "after the fetch with a wrong secret, Erebor's card says its secret was refused, the latest refusal in place of the malformed one")

await live.close()
console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors')
await browser.close()
process.exit(0)
