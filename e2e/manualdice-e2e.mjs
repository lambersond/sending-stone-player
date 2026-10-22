// Players entering their own dice results (module 0.26.0's setting, live from module 0.32.0), end
// to end. The real module, in a stand-in Foundry with dnd5e 5.3.3's real dice classes, its settings
// window drawn from its real templates in jsdom (fvtt/settings-app.mjs) and used as the Gamemaster
// would, posts from a browser on the game's page to the production app. Alice runs "Erebor", whose
// players roll in the app, and plays Thorin in it, his assigned Character in Foundry, with the
// Player role, which Make Manual Rolls (core's MANUAL_ROLLS, Trusted and above by default) leaves
// out. With Manual Dice missing, the campaign's Player actions switch, "Allow Players to enter dice
// results manually", is disabled, saying it needs Manual Dice, with View modules; the hello says no
// one may, and Thorin's cog in the app has no such setting. With Manual Dice installed, active and
// on, the switch is enabled; ticked and saved, the hello says players may, and Thorin's player not
// yet: the Players tab marks him "Alice needs Make Manual Rolls…", and his cog still has no switch.
// The Gamemaster gives Players Make Manual Rolls: Thorin's character.updated says he may, no hello,
// the mark says "Alice may…", and the cog, on a phone and a tablet, shows "Enter dice results
// manually", enabled and off, between Send to the table and Roll results; never on Alice's
// Gamemaster page for him. Turned on at 390, it's stored on his row, kept through a reload, and a
// tablet open meanwhile follows within a poll. Alice's assigned Character cleared and Bob made an
// owner too: still allowed. The permission taken away: a character.updated saying he may not, and
// the open cog drops the switch, the stored choice kept; given back, it returns, on. Manual Dice
// switched off in its own settings: the hello goes again saying no one may, the cog's setting goes,
// and the window keeps the choice, ticked but disabled. With SKEW=031 and MODULE=module-0.31.0, the
// module before this: its Players tab's own disabled "Coming soon" switch, a hello that always says
// Thorin may not, and no switch in the app at any step, Make Manual Rolls given or not. Synthetic
// characters only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
// Screenshots to SHOTS.
import { mkdirSync, readFileSync } from 'node:fs'
import { settings, user, users, actors } from './fvtt/stub.mjs'
import { JSDOM } from 'jsdom'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

/** Module 0.31.0, from before this round, against this round's app: no gate, no marks. */
const SKEW031 = process.env.SKEW === '031'
const NEW = !SKEW031
const VARIANT = SKEW031 ? '-skew031' : ''
const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'erebor-secret-12345'
const SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const cookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(test, what, ms = 30_000) {
  const end = Date.now() + ms
  while (!(await test())) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(100)
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const shoot = async (page, name) => {
  if (!SHOTS) return
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/${name}${VARIANT}.png` })
}

// Foundry's hooks: callAll and call run their handlers at once, as Foundry's do.
const registry = new Map()
globalThis.Hooks = {
  on(name, fn) { if (!registry.has(name)) registry.set(name, []); registry.get(name).push(fn); return fn },
  once(name, fn) { return this.on(name, fn) },
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
await foundryContext.grantPermissions(['local-network-access'], { origin: GAME })
await foundryContext.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' }))
const gmTab = await foundryContext.newPage()
await gmTab.goto(`${GAME}/game`)
const posted = []
let fetches = 0
globalThis.fetch = async (url, init) => {
  // Made from the game's page, and given up on there when the module gives it up.
  const id = ++fetches
  init.signal?.addEventListener('abort', () => {
    void gmTab.evaluate(id => globalThis.__aborts?.[id]?.abort(), id).catch(() => {})
  }, { once: true })
  const { status, statusText, type, body, error } = await gmTab.evaluate(async ({ id, url, init }) => {
    const controller = new AbortController()
    ;(globalThis.__aborts ??= {})[id] = controller
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      return { status: response.status, statusText: response.statusText, type: response.headers.get('content-type'), body: await response.text() }
    } catch (error) {
      return { error: error.name }
    } finally {
      delete globalThis.__aborts[id]
    }
  }, { id, url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
  if (error) throw new DOMException('The fetch was given up on', error)
  const sent = JSON.parse(init.body)
  posted.push({ url: String(url), type: sent.type ?? 'fetch', session: sent.session, data: sent.data, status, body })
  if (status >= 300) problems.push(`${sent.type ?? url} → ${status}`)
  return {
    ok: status >= 200 && status < 300, status, statusText,
    headers: new Headers(type ? { 'content-type': type } : {}),
    json: async () => JSON.parse(body), text: async () => body,
  }
}

// ---- Alice sets up the campaign in the app ----
const setupContext = await browser.newContext()
await setupContext.addCookies([cookie])
const setup = await setupContext.newPage()
await setup.goto(`${BASE}/campaigns`)
await setup.getByRole('button', { name: 'New campaign' }).click()
const modal = setup.getByRole('dialog', { name: 'New campaign' })
await modal.getByLabel('Campaign title').fill('Erebor')
await modal.getByLabel('Forge game address').fill('lonely-mountain.forge-vtt.com')
await modal.getByLabel('Secret', { exact: true }).fill(SECRET)
await modal.getByRole('button', { name: 'Set up campaign' }).click()
await modal.getByRole('button', { name: 'Done' }).click()
await setupContext.close()
const A = sql(`select id from campaign where title = 'Erebor'`)

// ---- Foundry, in English, with dnd5e's dice and Thorin, whom a player owns ----
const english = JSON.parse(readFileSync(`${MODULE}/lang/en.json`, 'utf8'))
const lookup = text => String(text).split('.').reduce((o, part) => (o && typeof o === 'object') ? o[part] : undefined, english)
game.i18n.localize = text => (typeof lookup(text) === 'string' ? lookup(text) : text)
game.i18n.format = (text, data = {}) => game.i18n.localize(text).replace(/{[^}]+}/g, match => data[match.slice(1, -1)] ?? match)
game.i18n.lang = 'en'
globalThis.location = { origin: GAME, protocol: 'https:' }
foundry.utils.getProperty ??= (object, path) => path.split('.').reduce((o, k) => o?.[k], object)
// Foundry's window classes, which the settings window reads as it's first imported, with the
// module: the window is drawn from its own templates, in jsdom, and used as the Gamemaster would.
process.env.MODULE_DIR = MODULE
const { click, find, openSettings, save, tick, view } = await import('./fvtt/settings-app.mjs')
globalThis.DOMParser = new JSDOM('').window.DOMParser
await import('./fvtt/dice-core.mjs')
const { default: BasicDie } = await import(`${DND5E}/basic-die.mjs`)
const { default: BasicRoll } = await import(`${DND5E}/basic-roll.mjs`)
const { default: D20Die } = await import(`${DND5E}/d20-die.mjs`)
const { default: D20Roll } = await import(`${DND5E}/d20-roll.mjs`)
const { default: DamageRoll } = await import(`${DND5E}/damage-roll.mjs`)
Object.assign(CONFIG.Dice, { BasicDie, BasicRoll, D20Die, D20Roll, DamageRoll })
CONFIG.Dice.terms.d = BasicDie
const ABILITIES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
CONFIG.DND5E = {
  skills: { prc: { label: 'Perception', ability: 'wis' } },
  tools: {},
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex', concentration: 'con' },
  damageTypes: { slashing: { label: 'Slashing' } },
  healingTypes: { healing: { label: 'Healing' } },
}
globalThis.dnd5e = { settings: { rulesVersion: 'modern' } }
const { Character } = await import('./fvtt/dnd5e-cards.mjs')
users.activeGM = user('gm', 'Gamemaster', true)
// Alice has the Player role (1): core's default Make Manual Rolls, Trusted and above, leaves her out.
const player = user('alice', 'Alice')
const bob = user('bob', 'Bob')
const thorin = new Character({
  id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 4, dex: 1, con: 3, wis: 2 },
  skills: { prc: { ability: 'wis' } },
})
thorin.system.skills.prc.total = 5
thorin.system.skills.prc.passive = 15
thorin.system.attributes.init.total = 1
thorin.system.attributes.ac = { value: 18 }
thorin.system.details = { level: 5 }
actors.set('thorin', thorin)
player.character = thorin

// Manual Dice, as installed and switched on or not: "missing", "inactive" (installed, not enabled in
// the world), "off" (enabled, switched off in its own settings) or "active". Its setting is its
// own: Foundry keeps it under its id, which the stand-in's settings don't tell apart.
let manualDiceSwitch = false
const storedGet = game.settings.get
game.settings.get = (module, key) => (module === 'manual-dice') ? manualDiceSwitch : storedGet(module, key)
game.settings.settings ??= new Map()
const manualDice = state => {
  if (state === 'missing') {
    game.modules.delete('manual-dice')
    game.settings.settings.delete('manual-dice.enabled')
  } else {
    game.modules.set('manual-dice', { id: 'manual-dice', title: 'Manual Dice', active: state !== 'inactive', authors: [] })
    game.settings.settings.set('manual-dice.enabled', {})
  }
  manualDiceSwitch = state === 'active'
}
manualDice('missing')

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ere': SECRET })
settings.set('campaigns', [{ id: 'camp-ere', title: 'Erebor', characters: ['thorin'], rolls: true, attacks: false, prompts: false }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const features = () => sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`).split(',')
await until(() => features().includes('gmRolls'), 'the hello to be taken', 15_000)
/** The latest hello, as the module sent it and the app took it: what it says of entering results. */
const hello = () => {
  const latest = posted.findLast(p => p.type === 'bridge.hello')
  return latest && { status: latest.status, manualDice: latest.data.features.rolls.manualDice, characters: latest.data.characters.map(c => [c.id, c.manualDice]) }
}
const hellos = () => posted.filter(p => p.type === 'bridge.hello').length
/** What the app keeps of Thorin in the campaign's roster: whether he enters his own results. */
const kept = () => sql(`select coalesce(e->>'manualDice', 'absent') from campaign, jsonb_array_elements(characters::jsonb) e where campaign.id = '${A}' and e->>'id' = 'thorin'`)
check(same(hello(), { status: 200, manualDice: false, characters: [['thorin', false]] }) && !features().includes('manualDice') && kept() === 'false',
  `with Manual Dice missing, module 0.26.0's hello says players may not enter their dice results, nor Thorin's player, and the app keeps that (${JSON.stringify(hello())}, ${features()}, ${kept()})`)

// ---- The settings window, drawn with its own templates and styles from its own context ----
const lang = english.SENDINGSTONE.Config
const styles = readFileSync(`${MODULE}/styles/sending-stone.css`, 'utf8')
const windowTab = await foundryContext.newPage()
await windowTab.goto(`${GAME}/game`)
windowTab.on('pageerror', e => problems.push(`window pageerror: ${e.message}`))
/** The window as Foundry draws it, with the module's styles, each box ticked as it is now. */
async function shootWindow(win, name) {
  if (!SHOTS) return
  const copy = win.element.cloneNode(true)
  const boxes = [...win.element.querySelectorAll('input')]
  copy.querySelectorAll('input').forEach((box, index) => box.toggleAttribute('checked', boxes[index].checked))
  await windowTab.evaluate(({ html, styles }) => {
    document.body.innerHTML = `<style>${styles} body { font: 14px sans-serif; background: #f2efe6; color: #191813; padding: 12px; width: 880px }</style>${html}`
  }, { html: copy.outerHTML, styles })
  await windowTab.waitForTimeout(200)
  await windowTab.locator('#sending-stone-settings').screenshot({ path: `${SHOTS}/${name}${VARIANT}.png` })
}
/** The Player actions tab's switch, as the window shows it. */
const allowIn = win => {
  const box = find(win, '[name="campaign.manualDice"]')
  return {
    label: find(win, '.sending-stone-dice label[for="sending-stone-manual-dice"]').textContent.trim(),
    type: box.type, checked: box.checked, disabled: box.disabled, greyed: box.closest('.form-group').classList.contains('disabled'),
    locked: 'locked' in box.dataset,
    note: find(win, '.sending-stone-dice-note').textContent.replace(/\s+/g, ' ').trim(),
    modules: !!win.element.querySelector('.sending-stone-dice-note [data-action="view"][data-section="modules"]'),
    chip: !!win.element.querySelector('.sending-stone-dice .sending-stone-pill'),
  }
}
/** Each character's own switch on the Players tab, as module 0.31.0 has it: whose, and how it shows. */
const ownSwitches = win => [...win.element.querySelectorAll('[data-filter-list="players"] [data-manual-dice]')].map(box => ({
  actor: box.dataset.manualDice, type: box.type, checked: box.checked, disabled: box.disabled, name: box.getAttribute('name'),
  label: box.getAttribute('aria-label'), tooltip: box.closest('[data-tooltip]')?.dataset.tooltip,
  chip: box.parentElement.querySelector('.sending-stone-pill')?.textContent.trim(),
}))
/**
 * Each character's mark on the Players tab, from module 0.32.0: whose, whether its player may enter
 * its dice results in the app, what it says, its icon, whether it takes focus; and whether its row
 * has any switch or chip besides.
 */
const marks = win => [...win.element.querySelectorAll('[data-filter-list="players"] [data-manual-dice]')].map(mark => ({
  actor: mark.dataset.manualDice, tag: mark.tagName.toLowerCase(), state: mark.dataset.state ?? null, role: mark.getAttribute('role'),
  label: mark.getAttribute('aria-label'), tooltip: mark.dataset.tooltip ?? null, icon: mark.querySelector('i[inert]')?.className ?? null,
  tabindex: mark.getAttribute('tabindex'),
  boxes: mark.closest('li').querySelectorAll('input').length, chip: !!mark.closest('li').querySelector('.sending-stone-pill'),
}))
/** Each state's own icon, so that the states differ by more than how faint the mark is. */
const MARK_ICONS = { allowed: 'fa-solid fa-keyboard', permission: 'fa-solid fa-lock', none: 'fa-solid fa-user-slash' }
/** The Players tab's mark for Thorin, as it should be in a state, with its words. */
const markOf = (state, label) => [{ actor: 'thorin', tag: 'span', state, role: 'img', label, tooltip: label, icon: MARK_ICONS[state], tabindex: '0', boxes: 0, chip: false }]
const NEEDS = "Alice needs Make Manual Rolls to enter Thorin's dice results in the app"
const MAY = "Alice may enter Thorin's dice results in the app"
const ALLOW = 'Allow Players to enter dice results manually'
const VIEW_MODULES = lang.Actions.ViewModules
let win = await openSettings()
await view(win, 'campaign', { campaignId: 'camp-ere', tab: 'actions' })
let allow = allowIn(win)
check(allow.label === ALLOW && lang.Actions.DicePlayers === ALLOW && allow.type === 'checkbox' && allow.disabled && allow.greyed && allow.locked && !allow.checked
  && allow.note === `${lang.Actions.ManualDice.missing} ${VIEW_MODULES}` && allow.modules && !allow.chip,
  `with Manual Dice missing, Erebor's Player actions tab has "${ALLOW}", disabled, saying "${lang.Actions.ManualDice.missing}", with ${VIEW_MODULES}, no Coming soon chip on it (${JSON.stringify(allow)})`)
await shootWindow(win, 'manualdice-window-missing')
await view(win, 'campaign', { campaignId: 'camp-ere', tab: 'players' })
check(ownSwitches(win).length === 0 && !!win.element.querySelector('[data-filter-list="players"] [data-actor-id="thorin"]'),
  "and its Players tab lists Thorin with no switch or mark of his own")
await win.close()

// ---- Thorin's cog in the app: no such setting while players may not ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', 'Erebor', '${A}', 'thorin', 'e2e-user', now())`)
const MANUAL = 'Enter dice results manually'
const HINT = 'Type in what your own dice show, instead of rolling here.'
/** What the app keeps of Alice's choice on her seat at Thorin: "t", "f". */
const stored = () => sql(`select "manualDice" from "character" where id = 'sheet-thorin'`)
/** A page on a browser of this size, signed in as Alice, once its sheet is there. */
async function browse(width, height, path) {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: width < 1024, hasTouch: width < 1024 })
  await view.addCookies([cookie])
  await view.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  await page.goto(`${BASE}${path}`)
  await page.getByRole('region', { name: 'Character' }).getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  return { view, page }
}
/**
 * The page's cog, opened: whether it offers to send rolls to the table, as it does while the game
 * takes them, and the manual dice setting, if any: its state, what describes it, whether anything
 * says it's coming, and where it sits among the settings.
 */
async function cogOf(page) {
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  if (!(await dialog.isVisible())) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await dialog.waitFor()
  }
  const manual = dialog.getByRole('switch', { name: MANUAL, exact: true })
  const text = await dialog.evaluate(el => el.innerText)
  const shown = { sends: await dialog.getByRole('switch', { name: 'Send to the table', exact: true }).count(), manual: await manual.count(), soon: text.includes('Coming soon') }
  if (shown.manual !== 1) return shown
  return {
    ...shown,
    disabled: await manual.isDisabled(),
    checked: await manual.isChecked(),
    description: await manual.evaluate(el => document.getElementById(el.getAttribute('aria-describedby'))?.textContent),
    chip: await manual.evaluate(el => document.getElementById(el.getAttribute('aria-describedby'))?.querySelector('span')?.textContent ?? null),
    order: ['Send to the table', MANUAL, 'Roll results'].map(label => text.indexOf(label)),
  }
}
/** The cog's switch as it's offered from module 0.32.0: enabled, on or off, said of exactly, in its place. */
const offered = (cog, on, sends = true) => cog.manual === 1 && !cog.disabled && cog.checked === on && cog.description === HINT
  && cog.chip === null && !cog.soon && (sends ? cog.order[0] >= 0 && cog.order[0] < cog.order[1] : true) && cog.order[1] >= 0 && cog.order[1] < cog.order[2]
/** Until an open cog shows the switch, or none, as said: by its count alone, within a poll or two. */
const cogShows = async (page, count, what) => {
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  if (!(await dialog.isVisible())) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await dialog.waitFor()
  }
  await until(async () => (await dialog.getByRole('switch', { name: MANUAL, exact: true }).count()) === count, what, 10_000)
}
const phone = await browse(390, 844, '/characters/sheet-thorin')
let cog = await cogOf(phone.page)
check(same(cog, { sends: 1, manual: 0, soon: false }), `at 390, Thorin's cog offers Send to the table, as the game takes his rolls, but nothing of entering his dice results (${JSON.stringify(cog)})`)
await shoot(phone.page, 'manualdice-cog-phone-missing')
await phone.page.keyboard.press('Escape')

// ---- Manual Dice installed, active and on: the switch is enabled, and the Gamemaster allows it ----
manualDice('active')
let before = hellos()
win = await openSettings()
await view(win, 'campaign', { campaignId: 'camp-ere', tab: 'actions' })
allow = allowIn(win)
check(allow.label === ALLOW && !allow.disabled && !allow.greyed && !allow.locked && !allow.checked
  && allow.note === lang.Actions.ManualDice.active && !allow.modules && !!find(win, '.sending-stone-dice-note i.fa-check'),
  `with Manual Dice active, the switch is enabled, saying "${lang.Actions.ManualDice.active}" (${JSON.stringify(allow)})`)
tick(win, 'campaign.manualDice')
await shootWindow(win, 'manualdice-window-active')
await save(win)
// Saving sends the hello more than once, the campaigns' last, and from module 0.31.0 each answer
// wakes the fetching beside the next: the app can have taken the last before its answer is back.
await until(() => hellos() > before && features().includes('manualDice') && hello()?.manualDice === true, 'the hello saying players may, answered', 15_000)
check(same(settings.get('campaigns').map(({ id, manualDice }) => [id, manualDice]), [['camp-ere', true]])
  && same(hello(), { status: 200, manualDice: true, characters: [['thorin', false]] }) && kept() === 'false',
  `ticked and saved, Erebor keeps it; its hello is sent again saying its players may enter their dice results, and ${NEW ? "Thorin's player not, Alice lacking Make Manual Rolls" : 'Thorin not, as module 0.31.0 says of everyone'}; the app keeps both (${JSON.stringify(hello())}, ${features()}, ${kept()})`)
win = await openSettings()
await view(win, 'campaign', { campaignId: 'camp-ere', tab: 'players' })
if (NEW) {
  const shown = marks(win)
  check(same(shown, markOf('permission', NEEDS)) && !win.element.textContent.includes('Coming soon'),
    `the Players tab marks Thorin "${NEEDS}", a read-only keyboard, no switch and nothing coming soon (${JSON.stringify(shown)})`)
} else {
  const own = ownSwitches(win)
  const OWN = "Enter Thorin's dice results manually"
  check(same(own, [{ actor: 'thorin', type: 'checkbox', checked: false, disabled: true, name: null, label: OWN, tooltip: OWN, chip: 'Coming soon' }]),
    `module 0.31.0's Players tab gives Thorin a switch of his own, "${OWN}", off and disabled, Coming soon, nothing stored (${JSON.stringify(own)})`)
}
await shootWindow(win, 'manualdice-window-players')
await win.close()
await phone.page.reload()
await phone.page.getByRole('region', { name: 'Character' }).getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
cog = await cogOf(phone.page)
check(same(cog, { sends: 1, manual: 0, soon: false }),
  `at 390, Thorin's cog still offers nothing of it, ${NEW ? 'as Alice may not' : 'as module 0.31.0 says no player may'}, and nothing says it's coming (${JSON.stringify(cog)})`)

// ---- The Gamemaster gives Players Make Manual Rolls ----
/**
 * The world's roles' permissions changed, as core changes them (MD scripts/module.mjs:15-17): the
 * hook first, `game.permissions` after; the setting created the first time it's changed.
 */
let permissionsStored = false
async function setPermissions(manualRolls) {
  const value = { ...game.permissions, MANUAL_ROLLS: manualRolls }
  const hook = permissionsStored ? 'updateSetting' : 'createSetting'
  permissionsStored = true
  await Hooks.callAll(hook, { key: 'core.permissions', value }, {}, 'gm')
  game.permissions = value
}
/** Thorin's character.updated posts since a count, by what each said of him. */
const updatesSince = from => posted.filter(p => p.type === 'character.updated').slice(from).map(p => ({ status: p.status, manualDice: p.data.character.manualDice }))
const updatesNow = () => posted.filter(p => p.type === 'character.updated').length
const GRANT = [1, 2, 3, 4]
const DEFAULT = [2, 3, 4]
let updates = updatesNow()
before = hellos()
await setPermissions(GRANT)
if (NEW) {
  await until(() => updatesNow() > updates && kept() === 'true', "Thorin's character.updated saying he may", 15_000)
  // Anything more would come within the settle (250 ms): waited for well past it.
  await wait(1500)
  check(same(updatesSince(updates), [{ status: 200, manualDice: true }]) && hellos() === before && kept() === 'true',
    `Make Manual Rolls given to Players: once its changes settle, one character.updated for Thorin saying his player may, no hello, and the app keeps it (${JSON.stringify(updatesSince(updates))}, ${hellos() - before} hellos)`)
  win = await openSettings()
  await view(win, 'campaign', { campaignId: 'camp-ere', tab: 'players' })
  const shown = marks(win)
  check(same(shown, markOf('allowed', MAY)), `the Players tab, drawn again, marks him "${MAY}" (${JSON.stringify(shown)})`)
  await shootWindow(win, 'manualdice-window-allowed')
  await win.close()
} else {
  await wait(1500)
  check(updatesSince(updates).length === 0 && hellos() === before && kept() === 'false',
    `module 0.31.0 sends nothing when the roles' permissions change, and the app keeps "may not" (${JSON.stringify(updatesSince(updates))})`)
}

// ---- Thorin's cog: Enter dice results manually, enabled and off; never on the Gamemaster's page ----
if (NEW) {
  await cogShows(phone.page, 1, 'the switch in the open cog at 390')
  cog = await cogOf(phone.page)
  check(offered(cog, false), `at 390, Thorin's open cog now shows "${MANUAL}", enabled and off, said of exactly as "${HINT}", with no chip, after Send to the table and before Roll results (${JSON.stringify(cog)})`)
  await shoot(phone.page, 'manualdice-cog-phone')
} else {
  await wait(4000)
  cog = await cogOf(phone.page)
  check(same(cog, { sends: 1, manual: 0, soon: false }), `at 390, a poll later, still nothing of it under module 0.31.0 (${JSON.stringify(cog)})`)
}
const tablet = await browse(768, 1024, '/characters/sheet-thorin')
cog = await cogOf(tablet.page)
check(NEW ? offered(cog, false) : same(cog, { sends: 1, manual: 0, soon: false }), `at 768 too (${JSON.stringify(cog)})`)
await shoot(tablet.page, 'manualdice-cog-tablet')
const gmPage = await browse(768, 1024, `/campaigns/${A}/characters/thorin`)
cog = await cogOf(gmPage.page)
check(cog.manual === 0 && !cog.soon, `on Alice's Gamemaster page for Thorin, his cog has no switch for it, as the Gamemaster's seat never types (${JSON.stringify(cog)})`)
await shoot(gmPage.page, 'manualdice-cog-gm')
await gmPage.view.close()

if (NEW) {
  // ---- Turned on at 390: stored on her seat, kept through a reload, and followed by the tablet ----
  check(stored() === 'f', `nothing stored yet: off by default (${stored()})`)
  // Tapped as a finger does, on its label: the switch itself is drawn over its box.
  await phone.page.getByRole('dialog', { name: 'Settings' }).locator('label').filter({ hasText: MANUAL }).tap()
  check(await phone.page.getByRole('dialog', { name: 'Settings' }).getByRole('switch', { name: MANUAL, exact: true }).isChecked(),
    'tapped at 390, the switch shows on at once')
  await until(() => stored() === 't', 'the choice stored', 10_000)
  check(stored() === 't', `and her seat at Thorin keeps it: "manualDice" is ${stored()}`)
  await shoot(phone.page, 'manualdice-cog-phone-on')
  // The tablet, open all along, with its cog open: on within a poll or two.
  const tabletSwitch = tablet.page.getByRole('dialog', { name: 'Settings' }).getByRole('switch', { name: MANUAL, exact: true })
  const shownAt = Date.now()
  await until(() => tabletSwitch.isChecked(), 'the tablet to follow', 10_000)
  check(await tabletSwitch.isChecked(), `the 768 page, open meanwhile, shows it on within ${((Date.now() - shownAt) / 1000).toFixed(1)} s, a poll being 3 s`)
  await phone.page.reload()
  await phone.page.getByRole('region', { name: 'Character' }).getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  cog = await cogOf(phone.page)
  check(offered(cog, true), `reloaded, the phone's cog still shows it on (${JSON.stringify(cog)})`)

  // ---- Alice's assigned Character cleared, and Bob made an owner too: still allowed ----
  updates = updatesNow()
  player.character = null
  await Hooks.callAll('updateUser', player, { character: null }, {}, 'gm')
  await wait(1500)
  check(kept() === 'true' && updatesSince(updates).every(u => u.manualDice === true),
    `Alice's assigned Character cleared: Thorin's player owners count, Alice the only one, who may: still "may" (${kept()}, ${JSON.stringify(updatesSince(updates))})`)
  updates = updatesNow()
  thorin.owners.push('bob')
  await Hooks.callAll('updateActor', thorin, { ownership: { bob: 3 } }, {}, 'gm')
  await until(() => updatesNow() > updates, "Thorin's update for his new owner", 15_000)
  await wait(500)
  const owned = posted.findLast(p => p.type === 'character.updated')
  check(owned.status === 200 && same(owned.data.character.owners.map(o => o.id), ['alice', 'bob']) && owned.data.character.manualDice === true && kept() === 'true',
    `Bob made a Player owner of Thorin too: his update names both owners and still says "may" (${JSON.stringify(owned.data.character.owners)}, ${owned.data.character.manualDice})`)
  player.character = thorin
  await Hooks.callAll('updateUser', player, { character: 'thorin' }, {}, 'gm')
  await wait(1000)
}

// ---- Thorin's sheet changes: the update says what the gate says, from module 0.32.0 ----
updates = updatesNow()
thorin.system.attributes.hp.value -= 5
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: thorin.system.attributes.hp.value } } } })
await until(() => updatesNow() > updates, "Thorin's update", 15_000)
const update = posted.findLast(p => p.type === 'character.updated')
if (NEW) {
  const keys = Object.keys(update.data.character)
  check(update.status < 300 && update.data.character.manualDice === true && keys.indexOf('manualDice') === keys.indexOf('owners') + 1
    && keys.indexOf('manualDice') < keys.indexOf('sheet') && kept() === 'true',
    `Thorin's update carries manualDice true, after owners and before sheet, and the roster says so (${keys.join(',')}, ${kept()})`)
} else {
  check(update.status < 300 && !('manualDice' in update.data.character) && kept() === 'false',
    `module 0.31.0's update says nothing of it, and the roster keeps the hello's word (${kept()})`)
}

if (NEW) {
  // ---- The permission taken away: may not, the switch goes, the choice kept; given back, it returns ----
  updates = updatesNow()
  await setPermissions(DEFAULT)
  await until(() => updatesNow() > updates && kept() === 'false', "Thorin's character.updated saying he may not", 15_000)
  await wait(1000)
  check(same(updatesSince(updates), [{ status: 200, manualDice: false }]) && kept() === 'false',
    `Make Manual Rolls back to Trusted and above: one character.updated saying Thorin's player may not (${JSON.stringify(updatesSince(updates))})`)
  await cogShows(phone.page, 0, "the switch to go from the phone's open cog")
  cog = await cogOf(phone.page)
  check(same(cog, { sends: 1, manual: 0, soon: false }) && stored() === 't',
    `at 390, the open cog drops the switch within a poll, and her stored choice stays on (${JSON.stringify(cog)}, ${stored()})`)
  updates = updatesNow()
  await setPermissions(GRANT)
  await until(() => kept() === 'true', 'the roster saying he may again', 15_000)
  await cogShows(phone.page, 1, 'the switch to come back')
  cog = await cogOf(phone.page)
  check(offered(cog, true), `given back, the switch comes back in the open cog, on as she left it (${JSON.stringify(cog)})`)
}

// ---- Manual Dice switched off in its own settings: told at once, and the cog's setting goes ----
before = hellos()
manualDice('off')
await Hooks.callAll('updateSetting', { key: 'manual-dice.enabled', value: false })
await until(() => hellos() > before && !features().includes('manualDice'), 'the hello saying players may not', 15_000)
check(same(hello(), { status: 200, manualDice: false, characters: [['thorin', false]] }),
  `switched off in its own settings, Manual Dice sends Erebor's hello again, saying its players may not, nor Thorin's (${JSON.stringify(hello())}, ${features()})`)
// Watched by its count alone: read in full as it goes, the switch could be gone between the reads.
const phoneCog = phone.page.getByRole('dialog', { name: 'Settings' })
await until(async () => (await phoneCog.isVisible()) && (await phoneCog.getByRole('switch', { name: MANUAL, exact: true }).count()) === 0,
  "the cog's setting to go", 15_000)
cog = await cogOf(phone.page)
check(same(cog, { sends: 1, manual: 0, soon: false }) && kept() === 'false' && (NEW ? stored() === 't' : stored() === 'f'),
  `at 390, Thorin's cog, open throughout, drops it${NEW ? ', and her stored choice stays on' : ''} (${JSON.stringify(cog)}, ${stored()})`)
await phone.page.keyboard.press('Escape')
win = await openSettings()
await view(win, 'campaign', { campaignId: 'camp-ere', tab: 'actions' })
allow = allowIn(win)
check(allow.checked && allow.disabled && allow.greyed && allow.locked && allow.note === `${lang.Actions.ManualDice.off} ${VIEW_MODULES}` && allow.modules
  && same(settings.get('campaigns').map(({ manualDice }) => manualDice), [true]),
  `the window keeps Erebor's choice, ticked but disabled, saying "${lang.Actions.ManualDice.off}" (${JSON.stringify(allow)})`)
await shootWindow(win, 'manualdice-window-off')
await view(win, 'campaign', { campaignId: 'camp-ere', tab: 'players' })
check(ownSwitches(win).length === 0, "and Thorin's own switch or mark is gone from the Players tab")
await win.close()
await tablet.view.close()
await phone.view.close()

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
