// Phones and tablets, end to end (#152, #154, #155): the real module, in a stand-in Foundry with
// dnd5e 5.3.3's real dice classes, sends Thorin's sheet (attacks, a spell, a condition) in a
// fight on his turn, and takes his player's rolls. At 360, 390, 768 and 1024 pixels Alice's
// character page has no app bar, fills the screen without scrolling either way, and opens on
// the character; the cog beside the sheet's tabs opens its settings, which close by Escape, a
// tap elsewhere or the cog again; their switch stops and resumes sending her rolls to the game,
// and it, the theme and the Actions tab's layout (offered only where the sheet is wide enough)
// are kept across a reload. A screen that narrows from side by side to one pane shows the
// character; the characters list keeps the app bar, with Campaigns and Sign out. Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { mkdirSync } from 'node:fs'
import { combat, combatant, settings, user, users, actors } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
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
const shoot = async (page, name) => {
  if (!SHOTS) return
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

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
// Banner mode: these checks read the banner at the bottom of the sheet, which shows only where the
// player has chosen it over toasts, the default; so each browser starts with the banner chosen, as a
// player who turned toasts off has it.
const newContext = browser.newContext.bind(browser)
browser.newContext = async (...args) => {
  const made = await newContext(...args)
  await made.addInitScript(() => {
    try {
      if (localStorage.getItem('sending-stone:roll-toasts') === null) localStorage.setItem('sending-stone:roll-toasts', 'off')
    } catch {}
  })
  return made
}
const problems = []
const foundryContext = await browser.newContext()
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

// ---- The Gamemaster sets up the campaign in the app ----
const context = await browser.newContext()
await context.addCookies([cookie])
const gm = await context.newPage()
await gm.goto(`${BASE}/campaigns`)
await gm.getByRole('button', { name: 'New campaign' }).click()
const modal = gm.getByRole('dialog', { name: 'New campaign' })
await modal.getByLabel('Campaign title').fill('Ashlands')
await modal.getByLabel('Forge game address').fill('lonely-mountain.forge-vtt.com')
await modal.getByLabel('Secret', { exact: true }).fill(SECRET)
await modal.getByRole('button', { name: 'Set up campaign' }).click()
await modal.getByRole('button', { name: 'Done' }).click()
await context.close()

// ---- Foundry, with dnd5e's dice, items and attacks ----
globalThis.document = { hidden: false }
const { messages } = await import('./fvtt/dice-core.mjs')
const { default: BasicDie } = await import(`${DND5E}/basic-die.mjs`)
const { default: BasicRoll } = await import(`${DND5E}/basic-roll.mjs`)
const { default: D20Die } = await import(`${DND5E}/d20-die.mjs`)
const { default: D20Roll } = await import(`${DND5E}/d20-roll.mjs`)
const { default: DamageRoll } = await import(`${DND5E}/damage-roll.mjs`)
Object.assign(CONFIG.Dice, { BasicDie, BasicRoll, D20Die, D20Roll, DamageRoll })
CONFIG.Dice.terms.d = BasicDie
const ABILITIES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
// Spellcasting by spell levels, as dnd5e's model, with what its sheet uses.
const ordinal = n => ['Cantrips', '1st Level', '2nd Level', '3rd Level'][n] ?? `${n}th Level`
const leveled = {
  key: 'spell', slots: true, cantrips: true, prepares: true, order: 20, exclusive: { spells: false, slots: false },
  getAvailableLevels: actor => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => (actor.system.spells[`spell${l}`]?.max ?? 0) > 0),
  getSpellSlotKey: level => `spell${level}`, getLabel: ({ level }) => ordinal(level),
}
const innate = { key: 'innate', order: -20, getAvailableLevels: () => [], getSpellSlotKey: () => 'innate', getLabel: () => 'Innate' }
CONFIG.DND5E = {
  skills: { prc: { label: 'Perception', ability: 'wis' } },
  tools: {},
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex' },
  spellcasting: { spell: leveled, innate },
  damageTypes: { slashing: { label: 'Slashing' }, fire: { label: 'Fire' } },
  healingTypes: { healing: { label: 'Healing' } },
  activityActivationTypes: { action: { label: 'Action', header: 'Actions' } },
}
// A condition, as dnd5e 5 lists the statuses it names.
CONFIG.statusEffects = [{ id: 'poisoned', name: 'Poisoned', img: 'systems/dnd5e/icons/svg/statuses/poisoned.svg' }]
settings.set('messageMode', 'public')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
settings.set('attackRollVisibility', 'hideAC')

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, equip } = await import('./fvtt/activity5e.mjs')
const { placeables } = await import('./fvtt/midi-fake.mjs')
globalThis.dnd5e = {
  settings: { rulesVersion: 'modern' },
  documents: { activity: { AttackActivity } },
  registry: {
    messages: {
      get(id, type) {
        return [...messages.values()].filter(m => (m.flags?.dnd5e?.originatingMessage === id) && (m.flags?.dnd5e?.roll?.type === type))
      },
    },
  },
}
globalThis.Item = { implementation: class { constructor(data) { Object.assign(this, data); this.system ??= {} } } }

users.activeGM = user('gm', 'Gamemaster', true)
users.get('gm').targets = new Set()
const alice = user('alice', 'Alice')

// Thorin, who fights with a longsword and a greataxe, casts Fire Bolt, and is poisoned: his sheet
// has all seven tabs, and a condition's dot on Effects.
const thorin = new Actor5e({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, con: 3, wis: 2 } })
thorin.system.details = { level: 5 }
thorin.system.attributes.spellcasting = 'wis'
thorin.system.attributes.spell = { dc: 13, attack: 5, mod: 2 }
thorin.spellcastingClasses = { cleric: { name: 'Cleric', spellcasting: { ability: 'wis', save: 13, attack: 5 } } }
actors.set('thorin', thorin)
alice.character = thorin
equip(thorin, {
  ac: 18,
  spells: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => [`spell${level}`, { value: level === 1 ? 2 : 0, max: level === 1 ? 2 : 0, level }])),
  items: [{
    id: 'longsword', name: 'Longsword', type: 'weapon',
    system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{
      id: 'swing', damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }],
      labels: { modifier: '+6', damage: [{ formula: '1d8 + 3', damageType: 'slashing', label: '1d8 + 3 Slashing' }] },
    }],
  }, {
    id: 'greataxe', name: 'Greataxe', type: 'weapon',
    system: { properties: ['hvy', 'two'], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{
      id: 'cleave', damage: [{ number: 1, denomination: 12, bonus: '@mod', types: ['slashing'] }],
      labels: { modifier: '+6', damage: [{ formula: '1d12 + 3', damageType: 'slashing', label: '1d12 + 3 Slashing' }] },
    }],
  }, {
    id: 'firebolt', name: 'Fire Bolt', type: 'spell',
    system: { level: 0, method: 'spell', prepared: 1, canPrepare: false, properties: [], duration: { units: 'inst' } },
    activities: [{
      id: 'bolt', ability: 'wis', damage: [{ number: 1, denomination: 10, types: ['fire'] }],
      labels: { modifier: '+5', damage: [{ formula: '1d10', damageType: 'fire', label: '1d10 Fire' }] },
    }],
  }],
})
thorin.statuses = new Set(['poisoned'])

// A goblin to fight, with its token on the Gamemaster's canvas.
const goblin = new Actor5e({ id: 'goblin', name: 'Goblin', mods: {}, hp: { value: 7, max: 7, temp: 0 } })
goblin.type = 'npc'
actors.set('goblin', goblin)
equip(goblin, { ac: 13 })
const goblinToken = { id: 'tokgoblin', name: 'Goblin', uuid: 'Scene.scene.Token.tokgoblin', actor: goblin, hidden: false }
goblinToken.object = { id: goblinToken.id, name: 'Goblin', document: goblinToken, actor: goblin }
placeables.set(goblinToken.id, goblinToken.object)

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'], rolls: true, attacks: true }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const stored = () => sql(`select "rollsEnabled", array_to_string("rollKinds", ','), "bridgePolledAt" is not null from campaign where title = 'Ashlands'`)
await until(() => stored().includes('attack'), 'the app to hear the game takes attacks', 10_000)
check(stored().startsWith('t|') && stored().split('|')[1].split(',').includes('ability'), `the app keeps that the game takes players' rolls (${stored()})`)

// A fight on Thorin's turn: the goblin, at 15, has gone, and Thorin, at 12, is up.
const fight = combat('fight1')
combatant(fight, 'cbGoblin', goblin, { name: 'Goblin', initiative: 15, token: goblinToken })
combatant(fight, 'cbThorin', thorin, { initiative: 12 })
fight.started = true
fight.round = 1
fight.turn = 1
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight1'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// Alice plays Thorin.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'sheet-thorin', 'Thorin', '${GAME}', 'Ashlands', id, 'thorin', 'e2e-user', now() from campaign where title = 'Ashlands'`)

const requests = () => Number(sql('select count(*) from roll_request'))
const latestRequest = () => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, result from roll_request order by "createdAt" desc limit 1) r`) || 'null')
const REACH = 'Checks, saves, attacks, spells and hit dice you roll, cast or spend here are made in your Gamemaster’s game too, with the same dice.'
const OFF = 'Only you see these rolls: Send to the table is off in Settings.'

/** Thorin's page in a new browser of this size, once his sheet's tabs are there. */
async function open({ width, height, mobile = false, touch = false }) {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: touch, colorScheme: 'light' })
  await view.addCookies([cookie])
  await view.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  await page.goto(`${BASE}/characters/sheet-thorin`)
  const sheet = page.getByRole('region', { name: 'Character' })
  const tabs = sheet.getByRole('tablist', { name: 'Character sheet' })
  await tabs.waitFor({ timeout: 20_000 })
  return {
    view, page, sheet, tabs,
    nav: page.getByRole('navigation', { name: 'Table' }),
    panel: sheet.getByRole('tabpanel'),
    tray: page.getByRole('region', { name: 'Your rolls' }),
    cog: page.getByRole('button', { name: 'Settings', exact: true }),
    settings: page.getByRole('dialog', { name: 'Settings' }),
  }
}

/** Where the page, the game table, its header, the sheet's tabs and the cog are, and what scrolls. */
const measure = page => page.evaluate(() => {
  const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height } }
  const root = document.scrollingElement
  const header = document.querySelector('main header')
  const table = document.querySelector('main > div')
  const tablist = document.querySelector('[role=tablist][aria-label="Character sheet"]')
  const cog = document.querySelector('button[aria-label="Settings"]')
  return {
    pageX: root.scrollWidth - root.clientWidth, pageY: root.scrollHeight - root.clientHeight,
    width: innerWidth, height: innerHeight, holds: table.contains(header),
    table: box(table), header: box(header), tablist: box(tablist), cog: box(cog),
    sheet: box(document.querySelector('section[aria-label="Character"]')),
    tabsScroll: tablist.scrollWidth - tablist.clientWidth, cogInRow: tablist.parentElement.contains(cog) && !tablist.contains(cog),
  }
})
/** Where the open settings are, and whether what has focus is in them. */
const popover = settings => settings.evaluate(el => {
  const b = el.getBoundingClientRect()
  return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, focusIn: el.contains(document.activeElement), focused: document.activeElement.getAttribute('role') }
})
const isDark = page => page.evaluate(() => document.documentElement.classList.contains('dark'))

for (const { width, height, mobile = false, touch = false, onePane = true } of [
  { width: 360, height: 780, mobile: true, touch: true },
  { width: 390, height: 844, mobile: true, touch: true },
  { width: 768, height: 1024, mobile: true },
  { width: 1024, height: 768, onePane: false },
]) {
  const at = `at ${width}×${height}`
  const { view, page, sheet, tabs, nav, panel, tray, cog, settings } = await open({ width, height, mobile, touch })

  // ---- No app bar: the game table fills the screen, its own header at the top ----
  check(await page.getByRole('banner').count() === 0 && await page.getByRole('button', { name: 'Sign out' }).count() === 0
    && await page.getByRole('link', { name: 'Campaigns' }).count() === 0 && await page.getByRole('link', { name: 'All characters' }).isVisible(),
    `${at}, Thorin's page has no app bar, no Sign out or Campaigns, and its own back arrow to all characters`)
  let m = await measure(page)
  check(m.holds && Math.abs(m.table.height - m.height) < 1 && m.table.top === 0 && m.header.top === 0 && m.pageX === 0 && m.pageY === 0,
    `${at}, the game table is as tall as the screen, its header at the top, and the page scrolls neither way (${JSON.stringify({ table: m.table.height, header: m.header.top, pageX: m.pageX, pageY: m.pageY })})`)

  // ---- Character first, in a fight too ----
  if (onePane) {
    check(await nav.getByRole('button', { name: 'Character', exact: true }).getAttribute('aria-current') === 'page'
      && await nav.getByRole('button', { name: 'Combat , your turn' }).getAttribute('aria-current') === null && await sheet.isVisible(),
      `${at}, in a fight on Thorin's turn, the page opens on his character, the Combat tab marked for his turn`)
  } else {
    check(!(await nav.isVisible()) && await sheet.isVisible() && await page.getByRole('region', { name: 'Combat' }).isVisible()
      && await page.getByRole('tablist', { name: 'Combat or chat' }).getByRole('tab', { name: 'Combat' }).getAttribute('aria-selected') === 'true',
      `${at}, the character fills the left, the fight beside it, with no tabs at the bottom`)
  }

  // ---- The cog: after the sheet's tabs, on their row, on the screen ----
  const named = await tabs.getByRole('tab').evaluateAll(all => all.map(tab => tab.textContent))
  check(named.length === 7 && /^Effects, 1 conditions$/.test(named[5].replace(/\s+/g, ' ').trim()),
    `${at}, the sheet has its seven tabs, Effects with its condition's dot (${named.join(' | ')})`)
  check(m.cogInRow && m.cog.left >= m.tablist.right - 0.5 && Math.abs((m.cog.top + m.cog.bottom) / 2 - (m.tablist.top + m.tablist.bottom) / 2) < 2
    && m.cog.left >= 0 && m.cog.right <= Math.min(m.width, m.sheet.right) && m.tabsScroll <= 0,
    `${at}, the settings' cog is after the tabs, outside their list, on their row and on the sheet (${Math.round(m.tablist.right)} → ${Math.round(m.cog.left)}–${Math.round(m.cog.right)} of ${m.width})`)
  if (width <= 390) {
    const scrolled = []
    for (let index = 0; index < named.length; index++) {
      await tabs.getByRole('tab').nth(index).click()
      await page.waitForTimeout(100)
      const now = await measure(page)
      if (now.tabsScroll > 0 || now.cog.right > now.width || now.cog.left < now.tablist.right - 0.5 || now.pageX !== 0) scrolled.push([named[index], now.tabsScroll, now.tablist.right, now.cog.left])
    }
    check(scrolled.length === 0, `${at}, whichever tab is chosen, the tabs and the cog fit, nothing scrolling sideways (${JSON.stringify(scrolled)})`)
    await tabs.getByRole('tab', { name: 'Character' }).click()
  }
  await shoot(page, `${width}-character`)

  // ---- The settings open and close ----
  check(await cog.getAttribute('aria-haspopup') === 'dialog' && await cog.getAttribute('aria-expanded') === 'false', `${at}, the cog says it opens a dialog, closed`)
  await cog.click()
  await settings.waitFor()
  await page.waitForTimeout(300)
  let p = await popover(settings)
  m = await measure(page)
  check(await cog.getAttribute('aria-expanded') === 'true' && p.left >= 0 && p.right <= m.width && p.top >= 0 && p.bottom <= m.height && m.pageX === 0 && m.pageY === 0
    && p.focusIn && p.focused === 'switch',
    `${at}, a tap on the cog opens the settings on the screen, its switch first and focused, nothing scrolling (${JSON.stringify(p)})`)
  await shoot(page, `${width}-settings`)
  await page.keyboard.press('Escape')
  await settings.waitFor({ state: 'detached' })
  check(await cog.evaluate(el => el === document.activeElement) && await cog.getAttribute('aria-expanded') === 'false', `${at}, Escape closes them, and the cog has focus again`)
  await cog.click()
  await settings.waitFor()
  await cog.click()
  await settings.waitFor({ state: 'detached' })
  check(true, `${at}, the cog again closes them`)
  await cog.click()
  await settings.waitFor()
  const name = await page.getByRole('heading', { level: 1 }).boundingBox()
  if (touch) await page.touchscreen.tap(name.x + name.width / 2, name.y + name.height / 2)
  else await page.mouse.click(name.x + name.width / 2, name.y + name.height / 2)
  await settings.waitFor({ state: 'detached' })
  check(true, `${at}, a ${touch ? 'tap' : 'click'} elsewhere closes them`)

  // ---- The switch stops sending rolls to the table, and starts again ----
  await tray.getByText(REACH).waitFor({ timeout: 15_000 })
  const strength = sheet.getByRole('button', { name: /^Strength check/ })
  const status = tray.getByRole('status')
  await cog.click()
  const send = settings.getByRole('switch', { name: 'Send to the table' })
  check(await send.isChecked(), `${at}, the switch is on, as the tray says`)
  await settings.getByText('Send to the table', { exact: true }).click()
  check(!(await send.isChecked()) && await settings.isVisible(), `${at}, a tap turns it off, the settings staying open`)
  await page.keyboard.press('Escape')
  await settings.waitFor({ state: 'detached' })
  await tray.getByText(OFF).waitFor({ timeout: 5_000 })
  let before = requests()
  await strength.click()
  await status.getByText('Strength check').waitFor({ timeout: 25_000 })
  await wait(1500)
  check(requests() === before && !/At the table/.test(await status.textContent()), `${at}, switched off, a Strength check is rolled here only, as the tray says: "${OFF}"`)
  await page.reload()
  await tabs.waitFor()
  await tray.getByText(OFF).waitFor({ timeout: 15_000 })
  await cog.click()
  check(!(await send.isChecked()), `${at}, after a reload it is still off`)
  await settings.getByText('Send to the table', { exact: true }).click()
  check(await send.isChecked(), `${at}, and a tap turns it on again`)
  await page.keyboard.press('Escape')
  await settings.waitFor({ state: 'detached' })
  await tray.getByText(REACH).waitFor({ timeout: 5_000 })
  before = requests()
  await strength.click()
  await until(() => requests() > before, 'the Strength check to be sent')
  await until(() => ['done', 'failed'].includes(latestRequest().status), 'the Strength check to be made')
  const made = latestRequest()
  await status.getByText(/At the table: \d+/).waitFor({ timeout: 30_000 })
  check(made.status === 'done' && made.payload.kind === 'ability' && made.payload.key === 'str', `${at}, switched on, the Strength check is sent to the game and made there (${JSON.stringify(made.payload).slice(0, 80)})`)

  // ---- The theme ----
  await cog.click()
  await settings.getByRole('radio', { name: 'Dark' }).click()
  await until(() => isDark(page), 'the page to turn dark', 5_000)
  check(await isDark(page) && await settings.isVisible(), `${at}, Dark in the settings makes the page dark, the settings staying open`)
  await page.keyboard.press('Escape')
  await page.reload()
  await tabs.waitFor()
  check(await isDark(page), `${at}, and it stays dark after a reload`)
  await cog.click()
  await settings.getByRole('radio', { name: 'Dark', checked: true }).waitFor()
  await settings.getByRole('radio', { name: 'System' }).click()
  await until(async () => !(await isDark(page)), 'the page to turn light', 5_000)
  check(!(await isDark(page)), `${at}, back to System, the light device's theme`)
  await page.keyboard.press('Escape')
  await settings.waitFor({ state: 'detached' })

  // ---- The Actions tab's layout, where the sheet is wide enough ----
  await cog.click()
  await settings.waitFor()
  const layouts = settings.getByRole('group', { name: 'Actions layout' })
  if (width <= 390) {
    check(await settings.getByText('Theme', { exact: true }).isVisible() && await layouts.count() === 0 && await settings.getByText('Actions layout').count() === 0,
      `${at}, too narrow for more than a list, the settings offer no layouts`)
    await page.keyboard.press('Escape')
  } else {
    const offered = await layouts.getByRole('button').evaluateAll(all => all.map(button => [button.textContent, button.getAttribute('aria-pressed')]))
    check(same(offered, [['List', 'true'], ['Table', 'false']]), `${at}, the sheet ${Math.round(m.sheet.width)} pixels wide, the settings offer a list or a table, listed to start with (${JSON.stringify(offered)})`)
    await layouts.getByRole('button', { name: 'Table', exact: true }).click()
    await page.keyboard.press('Escape')
    await settings.waitFor({ state: 'detached' })
    await tabs.getByRole('tab', { name: 'Actions' }).click()
    await panel.getByRole('table', { name: 'Actions', exact: true }).waitFor({ timeout: 5_000 })
    check(await panel.getByRole('table', { name: 'Actions', exact: true }).getByRole('button', { name: 'Longsword attack, +6' }).isVisible(), `${at}, Table lays the Actions tab out in a table`)
    await page.reload()
    await tabs.waitFor()
    await tabs.getByRole('tab', { name: 'Actions' }).click()
    await panel.getByRole('table', { name: 'Actions', exact: true }).waitFor({ timeout: 5_000 })
    await cog.click()
    check(await layouts.getByRole('button', { name: 'Table', exact: true }).getAttribute('aria-pressed') === 'true', `${at}, and it is still a table after a reload`)
    await page.keyboard.press('Escape')
  }
  await settings.waitFor({ state: 'detached' })

  // ---- Narrowed from side by side to one pane, the character shows ----
  if (!onePane) {
    const aside = page.getByRole('tablist', { name: 'Combat or chat' })
    await aside.getByRole('tab', { name: 'Chat' }).click()
    await page.getByRole('region', { name: 'Chat' }).waitFor()
    await page.setViewportSize({ width: 768, height: 1024 })
    await nav.waitFor()
    // The page hears the screen narrow just after the browser lays it out anew.
    await until(async () => await nav.getByRole('button', { name: 'Character', exact: true }).getAttribute('aria-current') === 'page', 'the character to show', 5_000)
    check(await nav.getByRole('button', { name: 'Character', exact: true }).getAttribute('aria-current') === 'page' && await sheet.isVisible()
      && !(await page.getByRole('region', { name: 'Chat' }).isVisible()), `${at}, with the chat beside the sheet, narrowed to 768 the page shows the character`)
    await shoot(page, '1024-narrowed')
  }
  await view.close()
}

// ---- From a laptop to a phone ----
{
  const { view, page, sheet, tabs, nav } = await open({ width: 1280, height: 800 })
  const aside = page.getByRole('tablist', { name: 'Combat or chat' })
  await tabs.getByRole('tab', { name: 'Spells' }).click()
  await aside.getByRole('tab', { name: 'Chat' }).click()
  await page.getByRole('region', { name: 'Chat' }).waitFor()
  check(!(await nav.isVisible()), 'at 1280 pixels the chat is beside the sheet, which shows Spells')
  await page.setViewportSize({ width: 390, height: 844 })
  await nav.waitFor()
  await until(async () => await nav.getByRole('button', { name: 'Character', exact: true }).getAttribute('aria-current') === 'page', 'the character to show', 5_000)
  const narrowed = {
    current: await nav.getByRole('button', { name: 'Character', exact: true }).getAttribute('aria-current'),
    sheet: await sheet.isVisible(), chat: await page.getByRole('region', { name: 'Chat' }).isVisible(),
    spells: await tabs.getByRole('tab', { name: /^Spells/ }).getAttribute('aria-selected'),
    pageX: await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth),
  }
  check(narrowed.current === 'page' && narrowed.sheet && !narrowed.chat && narrowed.spells === 'true' && narrowed.pageX === 0,
    `narrowed to 390 pixels, the page shows the character, still on Spells, nothing scrolling sideways (${JSON.stringify(narrowed)})`)
  await shoot(page, '1280-narrowed-390')
  await page.setViewportSize({ width: 1280, height: 800 })
  await nav.waitFor({ state: 'hidden' })
  check(await aside.getByRole('tab', { name: 'Chat' }).getAttribute('aria-selected') === 'true' && await page.getByRole('region', { name: 'Chat' }).isVisible(),
    'widened again, the chat is still beside the sheet')
  await view.close()
}

// ---- The characters list keeps the app bar ----
{
  const view = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: 'light' })
  await view.addCookies([cookie])
  await view.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`characters pageerror: ${e.message}`))
  await page.goto(`${BASE}/characters`)
  const banner = page.getByRole('banner')
  await banner.waitFor()
  check(await banner.getByRole('link', { name: 'Campaigns' }).isVisible() && await banner.getByRole('button', { name: 'Sign out' }).isVisible()
    && await banner.getByRole('radiogroup', { name: 'Theme' }).isVisible()
    && await page.evaluate(() => document.scrollingElement.scrollWidth === document.scrollingElement.clientWidth),
    'at 360 pixels the characters list has the app bar, with Campaigns, Sign out and the theme, nothing scrolling sideways')
  await shoot(page, '360-characters')
  await page.getByRole('link', { name: /Thorin/ }).first().tap()
  await page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  check(await page.getByRole('banner').count() === 0 && await page.getByRole('button', { name: 'Sign out' }).count() === 0, "opened from the list, Thorin's page has none")
  await page.getByRole('link', { name: 'All characters' }).tap()
  await page.waitForURL(`${BASE}/characters`)
  await banner.waitFor()
  check(await banner.getByRole('button', { name: 'Sign out' }).isVisible(), 'and its back arrow leads to the list, and the app bar, again')
  await view.close()
}

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
