// Roll results as toasts, end to end (#153, and toasts2: toasts replace the bottom banner): the real
// module, in a stand-in Foundry with dnd5e 5.3.3's real dice classes, sends Thorin's sheet in a fight
// on his turn with a goblin and an ogre, and takes his player's rolls. On a phone (390×844) and a
// tablet (768×1024), in the default Toasts mode: no banner on any tab, but a "Your rolls" button left
// of the cog; each roll Alice makes pops up as a bold card centred near the top of the screen, edged and
// tinted by how it came out (primary, gold, ruby, damage, warning), says what the game made of it, and
// goes four seconds after its way to the game ends, or at once when tapped; three at most, the newest
// on top. The toasts start 8 pixels below the sheet's row of tabs, or the table's header where the row
// isn't shown, so that every tab, the Rolls button and the cog stay tappable, under a plain toast and a
// waiting one (toasts3). An attack that hits stays, with its Roll damage, the damage menu and a ×, until
// its damage is rolled, then goes at once; one that misses goes after four seconds like any other, its
// damage offered by the popover's latest roll and the row's chip, not the dot; so does a use whose kind
// of damage is to choose stay, and an area attack's toast says whom it hit, staying only if it hit
// anyone. Closed with ×, the damage rolls from the row's chip and from the Rolls
// popover, whose dot says so; the popover holds the banner's own: the latest in full, Earlier rolls,
// the reach line, and scrolls inside on a short phone. Roll results, in the cog, switches to the
// banner and back, kept across a reload. The dark theme and reduced motion; the Gamemaster's page.
// Last, the game gone quiet: a roll's toast goes, and pops up again, in the warning's colours, when
// the app gives the roll up. Run with --import ./fvtt/unref-timers.mjs
// --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
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
const CAMPAIGN = sql(`select id from campaign where title = 'Ashlands'`)

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
const ELEMENTS = ['acid', 'cold', 'fire', 'lightning', 'poison']
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
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
  damageTypes: Object.fromEntries(['slashing', ...ELEMENTS].map(type => [type, { label: capital(type) }])),
  healingTypes: { healing: { label: 'Healing' } },
  activityActivationTypes: { action: { label: 'Action', header: 'Actions' }, bonus: { label: 'Bonus Action', header: 'Bonus Actions' } },
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

// Thorin, who fights with a longsword and a greataxe, breathes fire at an area, casts Fire Bolt and
// Dragon's Breath, catches his breath, and is poisoned: his sheet has all seven tabs, and a
// condition's dot on Effects. He is hurt, for Second Wind to heal him.
const thorin = new Actor5e({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, con: 3, wis: 2 }, hp: { value: 8, max: 40, temp: 0 } })
thorin.system.details = { level: 5 }
thorin.system.attributes.spellcasting = 'wis'
thorin.system.attributes.spell = { dc: 13, attack: 5, mod: 2 }
thorin.spellcastingClasses = { cleric: { name: 'Cleric', spellcasting: { ability: 'wis', save: 13, attack: 5 } } }
actors.set('thorin', thorin)
alice.character = thorin
const SLOTS = { 1: 2, 2: 4 }
equip(thorin, {
  ac: 18,
  spells: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => [`spell${level}`, { value: SLOTS[level] ?? 0, max: SLOTS[level] ?? 0, level }])),
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
  }, {
    // An attack at an area: a cone of fire, at everyone caught in it.
    id: 'breath', name: 'Breath Weapon', type: 'feat', system: { properties: [] },
    activities: [{
      id: 'breathBlast', template: 'cone', damage: [{ number: 2, denomination: 6, types: ['fire'] }],
      labels: { modifier: '+6', damage: [{ formula: '2d6', damageType: 'fire', label: '2d6 Fire' }] },
    }],
  }, {
    // A saving throw at an area, whose kind of damage is chosen once it's cast.
    id: 'dragon', name: 'Dragon’s Breath', type: 'spell',
    system: { level: 2, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'inst' } },
    activities: [{
      id: 'exhale', type: 'save', template: 'cone', affects: 'creature', save: ['dex'], dc: 15,
      damage: [{ number: 3, denomination: 6, types: ELEMENTS, scaling: 1 }],
      labels: { damage: [{ formula: '3d6', label: '3d6 Acid, Cold, Fire, Lightning or Poison' }] },
    }],
  }, {
    // Healing that follows at once, with no one to pick.
    id: 'wind', name: 'Second Wind', type: 'feat', system: { properties: [], uses: { max: 6, spent: 0, recovery: [] } },
    activities: [{
      id: 'breather', type: 'heal', affects: 'self', range: 'self', activation: { type: 'bonus', value: 1 },
      consumption: [{ type: 'itemUses', value: 1 }],
      healing: { number: 1, denomination: 10, bonus: '5', types: ['healing'] },
      labels: { damage: [{ formula: '1d10 + 5', damageType: 'healing', label: '1d10 + 5 Healing' }] },
    }],
  }],
})
thorin.statuses = new Set(['poisoned'])

// A goblin and an ogre to fight, with their tokens on the Gamemaster's canvas.
const foe = (id, name, ac) => {
  const actor = new Actor5e({ id, name, mods: {}, hp: { value: 300, max: 300, temp: 0 } })
  actor.type = 'npc'
  actors.set(id, actor)
  equip(actor, { ac })
  const token = { id: `tok${id}`, name, uuid: `Scene.scene.Token.tok${id}`, actor, hidden: false }
  token.object = { id: token.id, name, document: token, actor }
  placeables.set(token.id, token.object)
  return { actor, token }
}
const goblin = foe('goblin', 'Goblin', 13)
const ogre = foe('ogre', 'Ogre', 30)

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

// A fight on Thorin's turn: the goblin, at 15, has gone, and Thorin, at 12, is up; the ogre after.
const fight = combat('fight1')
combatant(fight, 'cbGoblin', goblin.actor, { name: 'Goblin', initiative: 15, token: goblin.token })
combatant(fight, 'cbThorin', thorin, { initiative: 12 })
combatant(fight, 'cbOgre', ogre.actor, { name: 'Ogre', initiative: 9, token: ogre.token })
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
const rowWhere = where => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, "useId", result from roll_request ${where} order by "createdAt" desc limit 1) r`) || 'null')
const latestRequest = () => rowWhere('')
const rowOf = id => rowWhere(`where id = '${id}'`)
const settled = row => ['done', 'failed'].includes(row?.status)
const REACH = 'Checks, saves, attacks, spells and hit dice you roll, cast or spend here are made in your Gamemaster’s game too, with the same dice.'
const GM_REACH = 'Checks, saves, attacks, spells and hit dice you roll, cast or spend here are made in your game too, with the same dice.'
const TOASTS_HINT = 'Each roll pops up at the top of the screen for 4 seconds; one you need to act on stays until you do.'
const BANNER_HINT = 'Your rolls stay in a banner at the bottom of the sheet.'

/**
 * Room under the app's limit of 20 rolls a minute from a player. This suite rolls far faster than any
 * player, so whenever it nears the limit the rolls the game has already made are dated a minute back,
 * as if made then; never further, so that an attack's damage stays due.
 */
const lastMinute = () => Number(sql(`select count(*) from roll_request where "createdAt" > now() - interval '1 minute'`))
async function paced() {
  if (lastMinute() < 14) return
  sql(`update roll_request set "createdAt" = now() - interval '61 seconds' where status in ('done', 'failed') and "createdAt" > now() - interval '61 seconds'`)
  await until(() => lastMinute() < 14, 'room under the rate limit', 70_000)
}

/** Thorin's page, or his sheet as the Gamemaster's, in a new browser of this size, once its tabs are there. */
async function open({ width, height, reducedMotion = 'no-preference', scheme = 'light', path = '/characters/sheet-thorin' }) {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion })
  await view.addCookies([cookie])
  await view.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  await page.goto(`${BASE}${path}`)
  const sheet = page.getByRole('region', { name: 'Character' })
  const tabs = sheet.getByRole('tablist', { name: 'Character sheet' })
  await tabs.waitFor({ timeout: 20_000 })
  const log = page.getByRole('log', { name: 'Roll results' })
  await log.waitFor({ state: 'attached', timeout: 15_000 })
  // When the page posts each roll, by its own clock, for the toasts' timings.
  await page.evaluate(() => {
    const post = window.fetch
    globalThis.__posts = []
    window.fetch = (url, init) => {
      if (init?.method === 'POST' && String(url).endsWith('/rolls')) globalThis.__posts.push({ at: performance.now(), body: JSON.parse(init.body) })
      return post(url, init)
    }
  })
  return {
    view, page, sheet, tabs, log,
    toasts: log.locator('[data-roll-toast]'),
    banner: page.locator('section[aria-label="Your rolls"]'),
    nav: page.getByRole('navigation', { name: 'Table' }),
    panel: sheet.getByRole('tabpanel'),
    cog: page.getByRole('button', { name: 'Settings', exact: true }),
    settings: page.getByRole('dialog', { name: 'Settings' }),
    rollsButton: page.getByRole('button', { name: /^Your rolls/ }),
    popover: page.getByRole('dialog', { name: 'Your rolls' }),
  }
}

/**
 * A toast's line from the game, found by its place, under its title and dice: kept to two lines for
 * the player's own rolls, but not for the Gamemaster's (polish §2), so not found by that.
 */
const LINE = ':scope > div > p.text-sm:not(.tabular-nums)'
/** What a toast says: its label, the total on its badge, its dice, and its way to the game. */
const readToast = toast => toast.evaluate((el, LINE) => ({
  label: el.querySelector('.font-semibold')?.textContent ?? null,
  badge: el.querySelector(':scope > span')?.textContent ?? null,
  dice: el.querySelector('p.tabular-nums')?.textContent ?? null,
  table: el.querySelector(LINE)?.textContent ?? null,
}), LINE)
/** The labels of the toasts showing, top first. */
const shownLabels = toasts => toasts.evaluateAll(els => els.map(el => el.querySelector('.font-semibold')?.textContent))
/** The ids of the toasts showing. */
const toastIds = page => page.evaluate(() => [...document.querySelectorAll('[role=log] [data-roll-toast]')].map(el => el.dataset.rollToast))
/** The toast of a roll new since `before`, by its label, once it pops up. */
async function popped(page, label, before, ms = 30_000) {
  let id
  await until(async () => {
    id = await page.evaluate(({ label, before }) => [...document.querySelectorAll('[role=log] [data-roll-toast]')]
      .find(el => !before.includes(el.dataset.rollToast) && el.querySelector('.font-semibold')?.textContent === label)?.dataset.rollToast, { label, before })
    return !!id
  }, `the toast of ${label}`, ms)
  return page.getByRole('log', { name: 'Roll results' }).locator(`[data-roll-toast="${id}"]`)
}
/**
 * From now, in the page, the toasts showing each time they change, as the page changes them, by its
 * own clock: until `stopWatching`, which adds how they are then. Changes are seen as the page makes
 * them, so that a busy or throttled page can't hide one between looks.
 */
const watchToasts = page => page.evaluate(LINE => {
  const samples = globalThis.__toastSamples = []
  const look = () => {
    const els = [...document.querySelectorAll('[role=log] [data-roll-toast]')]
    const sample = {
      at: performance.now(),
      ids: els.map(el => el.dataset.rollToast),
      labels: els.map(el => el.querySelector('.font-semibold')?.textContent),
      tables: els.map(el => el.querySelector(LINE)?.textContent ?? ''),
      leaving: els.map(el => el.dataset.leaving === 'true'),
      waits: els.map(el => el.dataset.waits === 'true'),
    }
    const last = samples.at(-1)
    const same = last && ['ids', 'labels', 'tables', 'leaving', 'waits'].every(key => JSON.stringify(last[key]) === JSON.stringify(sample[key]))
    if (!same) samples.push(sample)
  }
  globalThis.__toastWatch?.disconnect()
  globalThis.__toastWatch = new MutationObserver(look)
  globalThis.__toastWatch.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-leaving', 'data-waits', 'data-roll-toast'] })
  globalThis.__toastLook = look
  look()
}, LINE)
/** The samples where what shows changed, in brief, for a failure's message. */
const changes = samples => JSON.stringify((samples ?? []).filter((s, i) => i === 0 || JSON.stringify([s.ids, s.labels, s.tables]) !== JSON.stringify([samples[i - 1].ids, samples[i - 1].labels, samples[i - 1].tables])).map(s => [Math.round(s.at), s.ids, s.labels, s.tables]))
const stopWatching = page => page.evaluate(() => {
  globalThis.__toastWatch.disconnect()
  // How they are as the watch ends, kept even if unchanged, for how long it lasted.
  const samples = globalThis.__toastSamples
  const end = samples.at(-1)
  globalThis.__toastLook()
  if (samples.at(-1) === end) samples.push({ ...end, at: performance.now() })
  return samples
})
/** The rolls the page posted, since the last look. */
const postsSince = (page, from = 0) => page.evaluate(from => globalThis.__posts.filter(p => p.at > from), from)
/** Whether this holds within `ms`. */
const within = async (test, ms) => { try { await until(test, 'it', ms); return true } catch { return false } }
/** Whether this holds at every look for `ms`, looked at each 100 ms. */
const throughout = async (test, ms) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (!(await test())) return false
    await wait(100)
  }
  return true
}
/**
 * Whether every point of a control a finger may land on, its centre and 2 pixels inside each edge,
 * is that control or in it, by `elementFromPoint`; else what is there instead, a toast or not.
 */
const tappable = locator => locator.evaluate(el => {
  const b = el.getBoundingClientRect()
  const [x, y] = [b.left + b.width / 2, b.top + b.height / 2]
  const misses = [[x, y], [b.left + 2, y], [b.right - 2, y], [x, b.top + 2], [x, b.bottom - 2]].flatMap(([px, py]) => {
    const hit = document.elementFromPoint(px, py)
    return hit && (hit === el || el.contains(hit)) ? [] : [`${Math.round(px)},${Math.round(py)} ${hit?.closest('[data-roll-toast]') ? 'a toast' : hit?.outerHTML.slice(0, 50)}`]
  })
  return { ok: b.width > 0 && misses.length === 0, misses }
})
/** The sheet's row: the cog, the Rolls button and every tab, by name. */
const rowControls = async ({ cog, rollsButton, tabs }) =>
  [['the cog', cog], ['the Rolls button', rollsButton], ...(await tabs.getByRole('tab').all()).map((t, index) => [`tab ${index + 1}`, t])]
/** Those of the row not tappable at every point, and why. */
async function untappable(controls) {
  const bad = []
  for (const [name, control] of controls) {
    const { ok, misses } = await tappable(control)
    if (!ok) bad.push(`${name}: ${misses.join(', ')}`)
  }
  return bad
}
/**
 * Where the toasts start (toasts3): the top set on their region, the log's top and its first card's,
 * against where they should, the bottom of the sheet's row of tabs, rounded up, and 8 pixels more, or
 * the table's header's where the row isn't shown; and the row's box and the cards', for whether any
 * card lies over the row. Measured once the cards have slid in.
 */
async function placeOf(page) {
  // Measured at rest: a toast that pops up again between waiting and measuring, as a roll's result
  // arrives, drops in anew, so the measure is taken only while no toast is moving.
  for (let tries = 0; ; tries++) {
    await page.evaluate(() => Promise.all([...document.querySelectorAll('[role=log] [data-roll-toast]')].flatMap(el => el.getAnimations().map(a => a.finished.catch(() => {})))))
    const place = await measurePlace(page)
    if (!place.moving || tries >= 20) return place
  }
}
function measurePlace(page) {
  return page.evaluate(() => {
    const moving = [...document.querySelectorAll('[role=log] [data-roll-toast]')].some(el => el.getAnimations().some(a => a.playState === 'running'))
    const log = document.querySelector('[role=log][aria-label="Roll results"]')
    const row = document.querySelector('[role=tablist][aria-label="Character sheet"]')?.parentElement
    const header = document.querySelector('a[aria-label="All characters"], a[aria-label="Your campaigns"]')?.closest('header')
    const box = el => {
      const b = el?.getBoundingClientRect()
      return b && { top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height }
    }
    const rowBox = box(row)
    const shown = !!rowBox && rowBox.height > 0 && rowBox.bottom > 0 && rowBox.top < innerHeight
    const under = shown ? rowBox.bottom : box(header)?.bottom
    return {
      set: log?.parentElement.style.top ?? null,
      want: under === undefined ? null : Math.ceil(under) + 8,
      under: shown ? 'row' : 'header',
      log: box(log)?.top,
      cards: [...(log?.querySelectorAll('[data-roll-toast]') ?? [])].map(box),
      row: shown ? rowBox : null,
      moving,
    }
  })
}
/** What's wrong with where the toasts start, if anything. */
function misplaced(place, under = 'row') {
  const bad = []
  if (place.under !== under) bad.push(`under the ${place.under}, not the ${under}`)
  if (place.want === null || place.set !== `${place.want}px`) bad.push(`top set ${place.set}, not ${place.want}px`)
  if (!(Math.abs(place.log - place.want) <= 0.5)) bad.push(`log at ${place.log}`)
  if (place.cards.length > 0 && !(Math.abs(place.cards[0].top - place.want) <= 0.5)) bad.push(`first card at ${place.cards[0].top}`)
  if (place.row && place.cards.some(card => card.top < place.row.bottom)) bad.push(`a card over the row, which ends at ${place.row.bottom}`)
  return bad
}
const placed = place => `${place.under} ends ${Math.round(place.want - 8)}, toasts at ${place.set}, cards ${place.cards.map(c => `${Math.round(c.top)}–${Math.round(c.bottom)}`).join(', ') || 'none'}`
/** Forcing the next d20 the app throws, as attacks-e2e does, or Math.random again. */
const forceD20 = (page, value) => page.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, value)
const unforce = page => page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })

/** Each accent's colour in the theme, as the page has it. */
const ACCENT_VAR = { warning: '--color-warning', gold: '--color-gold', ruby: '--color-ruby', damage: '--color-damage', primary: '--color-primary' }
/**
 * How a toast looks: its edge, border, shadow, badge, title and lines as computed; and its colours as
 * drawn, a pixel of its left edge and one of the card just inside its top edge, at the right.
 */
async function lookOf(page, toast) {
  await toast.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  const style = await toast.evaluate((el, vars) => {
    const probe = document.createElement('span')
    document.body.append(probe)
    const colour = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number) }
    const accent = colour(vars[el.dataset.accent])
    const card = colour('--color-card')
    probe.remove()
    const s = getComputedStyle(el)
    const badge = el.querySelector(':scope > span')
    const b = getComputedStyle(badge)
    const title = getComputedStyle(el.querySelector('.font-semibold'))
    const box = el.getBoundingClientRect()
    return {
      accent: el.dataset.accent, accentRgb: accent, cardRgb: card,
      edge: s.borderLeftWidth, edgeRgb: s.borderLeftColor.match(/[\d.]+/g).slice(0, 3).map(Number), border: s.borderTopColor, shadow: s.boxShadow,
      badge: [Math.round(badge.getBoundingClientRect().width), Math.round(badge.getBoundingClientRect().height), b.borderTopLeftRadius, b.fontSize, b.fontWeight],
      title: [title.fontSize, title.fontWeight],
      lines: [...el.querySelectorAll('p.tabular-nums, p.line-clamp-2')].map(p => getComputedStyle(p).fontSize),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    }
  }, ACCENT_VAR)
  const png = await toast.screenshot({ animations: 'disabled' })
  const [edgePixel, tintPixel] = await page.evaluate(async ({ data, points, width }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const drawn = canvas.getContext('2d')
    drawn.drawImage(image, 0, 0)
    const scale = image.width / width
    return points.map(([x, y]) => [...drawn.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data].slice(0, 3))
  }, { data: png.toString('base64'), points: [[2, style.box.height / 2], [style.box.width - 28, 4]], width: style.box.width })
  return { ...style, edgePixel, tintPixel }
}
/**
 * What of the bold card a toast's look lacks, at this width: a 4-pixel edge in its accent, drawn so; a
 * light tint of it over the card, drawn so; a faint border of it; the large shadow; the tray's badge,
 * a bold title, and its lines at text-sm; full width but for the gutters on a phone, max-w-md wider.
 */
function unlike(look, width) {
  const bad = []
  const near = (a, b, by) => a.every((v, i) => Math.abs(v - b[i]) <= by)
  if (look.edge !== '4px' || !near(look.edgeRgb, look.accentRgb, 1)) bad.push(`edge ${look.edge} ${look.edgeRgb} not ${look.accentRgb}`)
  if (!near(look.edgePixel, look.accentRgb, 8)) bad.push(`edge drawn ${look.edgePixel}`)
  // How far the card's colour is drawn towards the accent's, and how far off that line.
  const towards = look.accentRgb.map((v, i) => v - look.cardRgb[i])
  const moved = look.tintPixel.map((v, i) => v - look.cardRgb[i])
  const length = towards.reduce((sum, v) => sum + v * v, 0)
  const t = moved.reduce((sum, v, i) => sum + v * towards[i], 0) / length
  const off = Math.sqrt(moved.reduce((sum, v, i) => sum + (v - t * towards[i]) ** 2, 0))
  if (!(t >= 0.05 && t <= 0.25 && off <= 8)) bad.push(`tint drawn ${look.tintPixel}: ${t.toFixed(3)} of the way from the card ${look.cardRgb} to ${look.accentRgb}, ${off.toFixed(1)} off`)
  const alpha = Number(/\/\s*([\d.]+)\)$/.exec(look.border)?.[1] ?? /rgba\(.*,\s*([\d.]+)\)$/.exec(look.border)?.[1] ?? 1)
  if (!(alpha > 0 && alpha <= 0.5)) bad.push(`border ${look.border}`)
  if (!look.shadow.includes('0px 25px 50px -12px')) bad.push(`shadow ${look.shadow}`)
  if (!same(look.badge, [48, 48, '12px', '24px', '700'])) bad.push(`badge ${look.badge}`)
  if (!same(look.title, ['16px', '600'])) bad.push(`title ${look.title}`)
  if (look.lines.length === 0 || look.lines.some(size => size !== '14px')) bad.push(`lines ${look.lines}`)
  const wide = width < 640 ? width - 32 : 448
  if (Math.abs(look.box.width - wide) > 1 || Math.abs(look.box.x + look.box.width / 2 - width / 2) > 1) bad.push(`box ${JSON.stringify(look.box)}`)
  return bad
}
const tinted = look => `tint ${look.tintPixel} over ${look.cardRgb}, edge ${look.edgePixel}`

for (const { width, height } of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  const at = `at ${width}×${height}`
  const { view, page, sheet, tabs, log, toasts, banner, nav, panel, cog, settings, rollsButton, popover } = await open({ width, height })
  const ability = name => sheet.getByRole('button', { name: new RegExp(`^${name} check`) })
  const tab = name => tabs.getByRole('tab', { name })
  const picker = page.getByRole('dialog', { name: 'Longsword attack' })
  const cdp = await view.newCDPSession(page)
  /** Hold a finger on a button as long as a long-press takes, then lift it: whether its menu opened. */
  async function longPress(button, menu) {
    const { x, y, width, height } = await button.boundingBox()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + width / 2, y: y + height / 2 }] })
    await wait(750)
    const opened = await menu.isVisible()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await wait(300)
    return opened
  }
  /** Until no toast but those that wait for the player shows, tapping each away. */
  async function clearToasts() {
    await until(async () => {
      const plain = log.locator('[data-roll-toast]:not([data-waits])')
      if (await plain.count() === 0) return true
      await plain.first().click({ timeout: 2_000 }).catch(() => {})
      return false
    }, 'the toasts to clear', 15_000)
  }
  /** A longsword attack at the goblin, its d20 forced: the request once the game made it, and its toast. */
  async function swing(d20, what) {
    await paced()
    await clearToasts()
    const before = await toastIds(page)
    await forceD20(page, d20)
    await panel.getByRole('button', { name: 'Longsword attack, +6' }).click()
    await picker.waitFor()
    const count = requests()
    await picker.getByRole('button', { name: /^Goblin/ }).click()
    await until(() => requests() > count, `${what} to be sent`)
    await unforce(page)
    const { id } = latestRequest()
    await until(() => settled(rowOf(id)), `${what} to be made`)
    const toast = await popped(page, 'Longsword attack', before)
    await until(async () => /^At the table: /.test((await readToast(toast)).table ?? ''), `the toast of ${what} to say what the game made of it`, 10_000)
    return { request: rowOf(id), toast }
  }
  /** Tap what rolls an attack's damage: the damage request, once the game made it, and its toast. */
  async function rollDamageOf(attackId, tap, label, what) {
    await paced()
    const before = await toastIds(page)
    await tap()
    await until(() => !!rowWhere(`where "useId" = '${attackId}'`), `${what} to be sent`)
    const { id } = rowWhere(`where "useId" = '${attackId}'`)
    await until(() => settled(rowOf(id)), `${what} to be made`)
    const toast = await popped(page, label, before)
    await until(async () => /^At the table: \d+/.test((await readToast(toast)).table ?? ''), `the toast of ${what} to say what the game made of it`, 10_000)
    return { request: rowOf(id), toast }
  }

  // ---- T1: the setting, in the cog: Roll results, Toasts to start with ----
  await cog.click()
  await settings.waitFor()
  const results = settings.getByRole('radiogroup', { name: 'Roll results' })
  const radios = () => results.getByRole('radio').evaluateAll(all => all.map(el => `${el.textContent}:${el.getAttribute('aria-checked')}`))
  const resultsHint = () => results.evaluate(el => document.getElementById(el.getAttribute('aria-describedby'))?.textContent)
  const order = await settings.evaluate(el => ['Send to the table', 'Roll results', 'Theme'].map(label => el.innerText.indexOf(label)))
  check(same(await radios(), ['Toasts:true', 'Banner:false']) && order.every(index => index >= 0) && order[0] < order[1] && order[1] < order[2]
    && await resultsHint() === TOASTS_HINT && await settings.getByRole('switch', { name: 'Roll toasts' }).count() === 0,
    `${at}, the cog has Roll results, Toasts or Banner, on Toasts, between Send to the table and Theme, saying what Toasts do; no Roll toasts switch (${order})`)
  await page.keyboard.press('Escape')
  await settings.waitFor({ state: 'detached' })

  // ---- T2: no banner on any tab; the Rolls button just left of the cog on every one ----
  const tabNames = await tabs.getByRole('tab').evaluateAll(all => all.map(el => el.getAttribute('aria-label') ?? el.textContent))
  const everyTab = []
  for (const [index, name] of tabNames.entries()) {
    await tabs.getByRole('tab').nth(index).click()
    const cogBox = await cog.boundingBox()
    const rollsBox = await rollsButton.boundingBox()
    everyTab.push({
      name, banner: await banner.count(), statuses: await sheet.locator('[role=status]').count(),
      rolls: await rollsButton.isVisible() && Math.abs(rollsBox.x + rollsBox.width - cogBox.x) <= 1 && Math.abs(rollsBox.y - cogBox.y) <= 1
        && Math.round(rollsBox.width) === Math.round(cogBox.width) && Math.round(rollsBox.height) === Math.round(cogBox.height),
    })
  }
  check(tabNames.length === 7 && everyTab.every(t => t.banner === 0 && t.statuses === 0 && t.rolls),
    `${at}, on each of the seven tabs there's no banner and no roll status in the sheet, and the Rolls button sits just left of the cog, the cog's size (${JSON.stringify(everyTab)})`)
  const button = await rollsButton.evaluate(el => ({ title: el.title, name: el.textContent, icon: !!el.querySelector('svg.lucide-history'), dot: !!el.querySelector('.rounded-full'), classes: el.className }))
  const cogClasses = await cog.getAttribute('class')
  check(button.title === 'Your rolls' && button.name === 'Your rolls' && button.icon && !button.dot && ['rounded-lg', 'p-2', 'text-text-secondary'].every(c => button.classes.split(' ').includes(c) && cogClasses.split(' ').includes(c)),
    `${at}, it's "Your rolls", a History icon styled as the cog, with no dot before any roll (${JSON.stringify(button)})`)
  await tab('Character').click()
  check(await log.count() === 1 && await toasts.count() === 0, `${at}, before any roll the toasts' log is there, empty`)

  // ---- T3: a Strength check pops up a bold toast, primary, as its dice land ----
  await watchToasts(page)
  await forceD20(page, 12)
  let before = requests()
  await ability('Strength').click()
  await toasts.first().waitFor({ timeout: 25_000 })
  await unforce(page)
  const diceZ = await page.evaluate(() => Number(getComputedStyle(document.querySelector('[id^=dice-canvas-threejs]')).zIndex))
  await until(() => requests() > before, 'the Strength check to be sent')
  const strength = latestRequest()
  await until(() => settled(rowOf(strength.id)), 'the Strength check to be made')
  await until(async () => /^At the table: \d+$/.test((await readToast(toasts.first())).table ?? ''), 'the toast to say what the game made of it', 5_000)
  let toast = await readToast(toasts.first())
  check(await toasts.count() === 1 && same(toast, { label: 'Strength check', badge: '15', dice: 'd20 12 +3', table: 'At the table: 15' }) && rowOf(strength.id).status === 'done',
    `${at}, a Strength check pops up one toast: its total, its die and +3, and what the game made of it with the same die (${JSON.stringify(toast)})`)
  check(!(await log.evaluate(el => el.contains(document.activeElement))) && await log.locator('button, a, [tabindex]').count() === 0 && await toasts.first().getAttribute('data-waits') === null,
    `${at}, it takes no focus, and holds nothing to tap but itself`)
  check(await toasts.first().evaluate(el => getComputedStyle(el).animationName) === 'toast-in', `${at}, it slides in, where motion is welcome`)
  let look = await lookOf(page, toasts.first())
  check(look.accent === 'primary' && unlike(look, width).length === 0,
    `${at}, it's the bold card in the primary green: a 4-pixel edge and a light tint of it, a faint border, the large shadow, the 48-pixel badge, a bold 16-pixel title and 14-pixel lines, ${Math.round(look.box.width)} pixels wide (${unlike(look, width).join('; ')}; ${tinted(look)})`)
  await shoot(page, `toasts-${width}-primary`)

  // ---- T4: centred just below the tab row, above the dice; nothing in the row, or above it, under it ----
  const geometry = await page.evaluate(() => {
    const root = document.scrollingElement
    const region = document.querySelector('[role=log][aria-label="Roll results"]').parentElement
    return { pageX: root.scrollWidth - root.clientWidth, pageY: root.scrollHeight - root.clientHeight, z: Number(getComputedStyle(region).zIndex), fixed: getComputedStyle(region).position }
  })
  check(look.box.y >= 8 && geometry.pageX === 0 && geometry.pageY === 0 && geometry.fixed === 'fixed' && geometry.z === 100001 && geometry.z > diceZ && diceZ === 100000,
    `${at}, near the top, the page scrolling neither way, the toasts fixed above the tumbling dice (${JSON.stringify({ ...geometry, diceZ, top: look.box.y })})`)
  let place = await placeOf(page)
  check(misplaced(place).length === 0 && place.cards.length === 1,
    `${at}, the toast starts 8 pixels below the tab row, its bottom rounded up: ${placed(place)} (${misplaced(place).join('; ')})`)
  const controls = await rowControls({ cog, rollsButton, tabs })
  if (width >= 768) {
    controls.push(['the back link', page.getByRole('link', { name: 'All characters' })],
      ['Delete Thorin', page.getByRole('button', { name: 'Delete Thorin' })],
      ["the rail's Character", nav.getByRole('button', { name: 'Character', exact: true })])
  }
  let blocked = await untappable(controls)
  check(controls.length >= 9 && blocked.length === 0 && await toasts.count() === 1,
    `${at}, with the toast showing, nothing is under it: the cog, the Rolls button and each of the ${controls.length - 2 - (width >= 768 ? 3 : 0)} tabs${width >= 768 ? ', the back link, Delete and the rail' : ''} are tappable at their centre and each edge (${blocked.join('; ')})`)

  // ---- T5: gone four seconds after the game made it ----
  await toasts.first().waitFor({ state: 'detached', timeout: 10_000 })
  let samples = await stopWatching(page)
  const atTable = samples.find(s => s.tables.some(text => text.startsWith('At the table')))
  const gone = samples.find(s => atTable && s.at > atTable.at && !s.labels.includes('Strength check'))
  const shownFor = gone && atTable ? gone.at - atTable.at : NaN
  check(shownFor >= 3600 && shownFor <= 4600, `${at}, the toast goes ${Math.round(shownFor)} ms after it says what the game made of it${Number.isNaN(shownFor) ? ` (${changes(samples)})` : ''}`)

  // ---- T6: a tap clears one at once ----
  await ability('Dexterity').click()
  const dex = toasts.filter({ hasText: 'Dexterity check' })
  await dex.waitFor({ timeout: 25_000 })
  await until(async () => /^At the table: \d+$/.test((await readToast(dex)).table ?? ''), 'the Dexterity check to be made', 30_000)
  const dexBox = await dex.boundingBox()
  const tappedAt = Date.now()
  await page.touchscreen.tap(dexBox.x + dexBox.width / 2, dexBox.y + dexBox.height / 2)
  await dex.waitFor({ state: 'detached', timeout: 1_000 })
  const clearedIn = Date.now() - tappedAt
  check(clearedIn <= 300 && await throughout(async () => await dex.count() === 0, 5_000),
    `${at}, tapped once the game has made it, the Dexterity check's toast goes at once (${clearedIn} ms), and doesn't come back`)

  // ---- T7: three at most, the newest on top ----
  await paced()
  await watchToasts(page)
  // Where each is, found first, so that the taps follow one another as a quick thumb's would.
  const centres = []
  for (const name of ['Strength', 'Dexterity', 'Constitution', 'Intelligence']) {
    const b = await ability(name).boundingBox()
    centres.push([b.x + b.width / 2, b.y + b.height / 2])
  }
  // When the page hears each tap, by its own clock.
  await page.evaluate(() => {
    globalThis.__taps = []
    document.addEventListener('click', event => {
      const button = event.target.closest?.('button')
      if (button) globalThis.__taps.push([button.getAttribute('aria-label') ?? button.textContent, event.timeStamp])
    }, { capture: true })
  })
  await Promise.all(centres.map(([x, y]) => page.touchscreen.tap(x, y)))
  const taps = await page.evaluate(() => globalThis.__taps)
  const gaps = taps.slice(1).map(([, time], index) => Math.round(time - taps[index][1]))
  check(same(taps.map(([label]) => label.split(' check')[0]), ['Strength', 'Dexterity', 'Constitution', 'Intelligence']),
    `${at}, the page hears the four taps in order: ${JSON.stringify(taps.map(([label]) => label))}`)
  const watched = Date.now()
  if (await within(async () => await toasts.count() === 3, 7_000)) await shoot(page, `toasts-${width}-three`)
  await wait(8_000 - (Date.now() - watched))
  samples = await stopWatching(page)
  const most = Math.max(...samples.map(s => s.labels.length))
  const full = samples.filter(s => s.labels.length === 3)
  // Each toast that comes pops up on top, whatever order the dice land in: above every one already
  // showing, two that land together both above them.
  const onTop = samples.slice(1).every((s, index) => {
    const old = s.labels.findIndex(label => samples[index].labels.includes(label))
    return old === -1 || s.labels.slice(old).every(label => samples[index].labels.includes(label))
  })
  // The order they landed in, oldest first, as each first showed, the newest on top in each look.
  // Dice that land in any order, Intelligence's may land first: then it's the one that goes.
  const landed = []
  for (const s of samples) for (const label of [...s.labels].reverse()) if (!landed.includes(label)) landed.push(label)
  // Once the fourth lands, the first to land is gone, and the last shows among a full three.
  const oldestGone = landed.length === 4 && full.some(s => s.labels.includes(landed[3]))
    && samples.filter(s => s.labels.includes(landed[3])).every(s => !s.labels.includes(landed[0]))
  check(gaps.every(gap => gap <= 200) && most === 3 && full.length > 0 && oldestGone && onTop,
    `${at}, four checks tapped ${gaps.join(', ')} ms apart show three toasts at most, each popping up on top as its dice land, the last to land among them and the first gone (landed ${landed.map(label => label.split(' ')[0]).join(', ')}: ${JSON.stringify([...new Set(samples.map(s => s.labels.join(' > ')))])})`)
  await until(async () => await toasts.count() === 0, 'the toasts to go', 10_000)

  // ---- T8: a natural 20 is gold, a natural 1 ruby ----
  await paced()
  before = await toastIds(page)
  await forceD20(page, 20)
  await ability('Constitution').click()
  const gold = await popped(page, 'Constitution check', before)
  await unforce(page)
  await until(async () => /^At the table: 23$/.test((await readToast(gold)).table ?? ''), 'the natural 20 to be made', 30_000)
  look = await lookOf(page, gold)
  check(look.accent === 'gold' && (await readToast(gold)).dice === 'd20 20 +3 · Natural 20' && unlike(look, width).length === 0,
    `${at}, a natural 20's toast is the bold card in gold (${unlike(look, width).join('; ')}; ${tinted(look)})`)
  await shoot(page, `toasts-${width}-gold`)
  await gold.click()
  before = await toastIds(page)
  await forceD20(page, 1)
  await ability('Wisdom').click()
  const ruby = await popped(page, 'Wisdom check', before)
  await unforce(page)
  await until(async () => /^At the table: 3$/.test((await readToast(ruby)).table ?? ''), 'the natural 1 to be made', 30_000)
  look = await lookOf(page, ruby)
  check(look.accent === 'ruby' && (await readToast(ruby)).dice === 'd20 1 +2 · Natural 1' && unlike(look, width).length === 0,
    `${at}, a natural 1's is in ruby (${unlike(look, width).join('; ')}; ${tinted(look)})`)
  await shoot(page, `toasts-${width}-ruby`)
  await ruby.click()

  // ---- T9: healing that follows a use at once is in the primary green ----
  await tab('Actions').click()
  await paced()
  before = await toastIds(page)
  await panel.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }).click()
  const healing = await popped(page, 'Second Wind healing', before)
  await until(async () => /^At the table: \d+/.test((await readToast(healing)).table ?? ''), 'the healing to be made', 30_000)
  look = await lookOf(page, healing)
  check(look.accent === 'primary' && await healing.getAttribute('data-waits') === null && unlike(look, width).length === 0,
    `${at}, Second Wind's healing, rolled at once, pops up in the primary green, as healing (${JSON.stringify(await readToast(healing))}; ${unlike(look, width).join('; ')})`)
  await clearToasts()

  // ---- T10: an attack that hits stays, more than four seconds, the cap never dropping it ----
  let { request: hit, toast: sticky } = await swing(15, 'the longsword attack')
  toast = await readToast(sticky)
  const rollDamage = sticky.getByRole('button', { name: 'Roll damage' })
  const dismiss = sticky.getByRole('button', { name: 'Dismiss' })
  check(hit.result.attack?.outcome === 'hit' && toast.table === 'At the table: 21 · Hit' && await sticky.getAttribute('data-waits') === 'true'
    && await rollDamage.isVisible() && await dismiss.isVisible() && await sticky.getByRole('button').count() === 2,
    `${at}, the longsword's hit pops up a toast that waits for Alice: "${toast.table}", with Roll damage and a ×`)
  const keys = await sticky.getByRole('button').evaluateAll(all => all.map(el => el.tabIndex >= 0 && !el.closest('[inert],[aria-hidden="true"]')))
  check(!(await log.evaluate(el => el.contains(document.activeElement))) && keys.every(Boolean),
    `${at}, it takes no focus as it pops up, and its buttons are reached by keyboard`)
  check(await rollsButton.evaluate(el => el.textContent) === 'Your rolls, damage to roll' && await rollsButton.locator('.rounded-full.bg-primary').isVisible(),
    `${at}, the Rolls button shows its dot, said as "damage to roll"`)
  look = await lookOf(page, sticky)
  check(look.accent === 'primary' && unlike(look, width).length === 0, `${at}, a hit's toast is the bold card in the primary green (${unlike(look, width).join('; ')})`)
  await shoot(page, `toasts-${width}-sticky`)
  // Nothing in the row under it while it waits.
  const row = await rowControls({ cog, rollsButton, tabs })
  place = await placeOf(page)
  blocked = await untappable(row)
  check(misplaced(place).length === 0 && place.cards.length === 1 && blocked.length === 0,
    `${at}, the waiting toast starts below the tab row too, and the cog, the Rolls button and every tab stay tappable at their centre and each edge: ${placed(place)} (${[...misplaced(place), ...blocked].join('; ')})`)
  const stickyBox = await sticky.boundingBox()
  // Its body tapped, it stays; and it stays past four seconds, as checks pop up under the cap.
  await page.touchscreen.tap(stickyBox.x + 60, stickyBox.y + 14)
  await watchToasts(page)
  // The Character tab by a tap, as nothing lies over the tabs.
  await tab('Character').tap()
  await ability('Strength').waitFor()
  await paced()
  // Each check tapped where it is, scrolled out from under the waiting toast where it's under it.
  for (const name of ['Strength', 'Dexterity', 'Constitution']) await ability(name).tap()
  const checkedAt = Date.now()
  // Under the waiting toast and two plain ones, the row is still clear, and each of its controls
  // takes a real tap: each tab shows, and the Rolls popover and the cog's settings open, over the
  // toasts, their own controls tappable there.
  await until(async () => await toasts.count() === 3, 'three toasts to show, the waiting one among them', 20_000)
  place = await placeOf(page)
  blocked = await untappable(row)
  const stack = await toasts.evaluateAll(all => all.map(el => el.dataset.waits === 'true'))
  await shoot(page, `toasts-${width}-stack`)
  const rowTaps = []
  for (const [index, name] of tabNames.entries()) {
    const t = tabs.getByRole('tab').nth(index)
    const b = await t.boundingBox()
    const shown = await toasts.count()
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    rowTaps.push([name, await within(async () => await t.getAttribute('aria-selected') === 'true', 2_000), shown])
  }
  const popAt = await rollsButton.boundingBox()
  let shownThen = await toasts.count()
  await page.touchscreen.tap(popAt.x + popAt.width / 2, popAt.y + popAt.height / 2)
  const popoverOpened = await within(() => popover.isVisible(), 2_000)
  const popoverReach = popoverOpened ? await tappable(popover.getByRole('group', { name: 'Longsword attack' }).getByRole('button', { name: 'Roll damage' })) : { ok: false }
  rowTaps.push(['the Rolls button', popoverOpened && popoverReach.ok, shownThen])
  await page.keyboard.press('Escape')
  await popover.waitFor({ state: 'detached' })
  const cogAt = await cog.boundingBox()
  shownThen = await toasts.count()
  await page.touchscreen.tap(cogAt.x + cogAt.width / 2, cogAt.y + cogAt.height / 2)
  const settingsOpened = await within(() => settings.isVisible(), 2_000)
  const settingsReach = settingsOpened ? await tappable(settings.getByRole('radio', { name: 'Banner' })) : { ok: false }
  rowTaps.push(['the cog', settingsOpened && settingsReach.ok, shownThen])
  await page.keyboard.press('Escape')
  await settings.waitFor({ state: 'detached' })
  check(stack.length === 3 && stack.filter(Boolean).length === 1 && misplaced(place).length === 0 && blocked.length === 0 && rowTaps.every(([, ok, shown]) => ok && shown >= 1),
    `${at}, under the waiting toast and two plain ones the row is clear, every point of it tappable, and real taps on it work: each tab shows, and the Rolls popover and the cog's settings open over the toasts, their controls tappable there: ${placed(place)} (${JSON.stringify({ stack, rowTaps, popoverReach, settingsReach })}; ${[...misplaced(place), ...blocked].join('; ')})`)
  await wait(Math.max(0, 6_500 - (Date.now() - checkedAt)))
  samples = await stopWatching(page)
  const stickyId = await sticky.getAttribute('data-roll-toast')
  const capped = samples.filter(s => s.ids.length > 0)
  check(capped.length > 0 && capped.every(s => s.ids.includes(stickyId) && !s.leaving[s.ids.indexOf(stickyId)]) && Math.max(...samples.map(s => s.ids.length)) <= 3
    && samples.some(s => s.labels.includes('Constitution check')) && samples.at(-1).at - samples[0].at >= 6_000 && await sticky.isVisible(),
    `${at}, tapped on its body it stays, and through ${Math.round(samples.at(-1).at - samples[0].at)} ms and three checks it is never dropped nor fades, three toasts at most (${JSON.stringify([...new Set(samples.map(s => s.labels.join(' > ')))])})`)
  await tab('Actions').tap()

  // ---- T11: its Roll damage rolls at the table; it goes at once, and the damage pops up ----
  // When the waiting toast starts to fade, and goes, as the page changes it, by the page's clock.
  await page.evaluate(id => {
    const marks = globalThis.__stickyMarks = []
    const log = document.querySelector('[role=log][aria-label="Roll results"]')
    const state = () => {
      const el = log.querySelector(`[data-roll-toast="${id}"]`)
      if (!el) return 'gone'
      return el.dataset.leaving === 'true' ? 'leaving' : 'shown'
    }
    let last = state()
    globalThis.__stickyObserver?.disconnect()
    globalThis.__stickyObserver = new MutationObserver(() => {
      const now = state()
      if (now !== last) marks.push({ at: performance.now(), state: now })
      last = now
    })
    globalThis.__stickyObserver.observe(log, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-leaving'] })
  }, stickyId)
  const postedFrom = await page.evaluate(() => performance.now())
  let damage
  ;({ request: damage, toast } = await rollDamageOf(hit.id, () => rollDamage.click(), 'Longsword damage', 'the damage'))
  const marks = await page.evaluate(() => { globalThis.__stickyObserver.disconnect(); return globalThis.__stickyMarks })
  const [damagePost] = (await postsSince(page, postedFrom)).filter(p => p.body.kind === 'damage')
  const fading = marks.find(m => m.at >= damagePost.at && m.state !== 'shown')
  const goneAt = marks.find(m => m.at >= damagePost.at && m.state === 'gone')
  const d8 = damage.payload.dice[0].results[0]
  check(damage.kind === 'damage' && damage.payload.dice[0].faces === 8 && damage.status === 'done' && (await readToast(toast)).table === `At the table: ${d8 + 3}`,
    `${at}, its Roll damage sends that attack's damage, the d8 thrown, and the game rolls it: ${d8 + 3}, as its own toast says`)
  check(fading?.state === 'leaving' && goneAt && fading.at - damagePost.at <= 250 && goneAt.at - fading.at >= 100 && goneAt.at - damagePost.at <= 700,
    `${at}, the waiting toast starts to fade ${Math.round(fading?.at - damagePost.at)} ms after the damage is sent, and is gone ${Math.round(goneAt?.at - damagePost.at)} ms after (${JSON.stringify(marks.map(m => [m.state, Math.round(m.at - damagePost.at)]))})`)
  look = await lookOf(page, toast)
  check(look.accent === 'damage' && unlike(look, width).length === 0 && await rollsButton.evaluate(el => el.textContent) === 'Your rolls' && await toast.getByRole('button').count() === 0,
    `${at}, the damage's toast is the bold card in the damage red, holding nothing to tap, and the Rolls button's dot is gone (${unlike(look, width).join('; ')}; ${tinted(look)})`)
  await shoot(page, `toasts-${width}-damage`)

  // ---- T11a: a critical hit's damage is in the gold of a natural 20, as the hit is ----
  const { request: crit, toast: critToast } = await swing(20, 'the critical hit')
  check(crit.result.attack?.critical === true && (await readToast(critToast)).table === 'At the table: 26 · Critical hit' && (await lookOf(page, critToast)).accent === 'gold',
    `${at}, a natural 20 with the longsword is a critical hit, its toast gold: "${(await readToast(critToast)).table}"`)
  ;({ request: damage, toast } = await rollDamageOf(crit.id, () => critToast.getByRole('button', { name: 'Roll critical damage' }).click(), 'Longsword damage', 'the critical damage'))
  const critDice = damage.payload.dice[0].results
  const critTotal = critDice.reduce((sum, die) => sum + die, 3)
  const critSaid = await readToast(toast)
  look = await lookOf(page, toast)
  const critBadge = await toast.evaluate(el => el.querySelector(':scope > span').className.split(' '))
  check(damage.status === 'done' && critDice.length === 2 && critSaid.table === `At the table: ${critTotal}` && critSaid.badge === String(critTotal)
    && / · Critical hit$/.test(critSaid.dice ?? '') && look.accent === 'gold' && unlike(look, width).length === 0
    && critBadge.includes('bg-gold') && critBadge.includes('text-on-gold') && !critBadge.some(c => c.startsWith('bg-damage')),
    `${at}, its damage, two d8 thrown, pops up as the bold card in gold, not the damage red, its total on the gold badge, its dice saying "Critical hit" (${JSON.stringify(critSaid)}; ${unlike(look, width).join('; ')}; ${tinted(look)})`)
  await shoot(page, `toasts-${width}-critical-damage`)
  // The Rolls popover's latest roll, the same damage, in gold too.
  await rollsButton.click()
  await popover.waitFor()
  const critLatest = await popover.getByRole('status').evaluate(el => ({
    text: el.textContent, gold: [...el.querySelectorAll('.bg-gold.text-on-gold')].map(badge => badge.textContent), red: el.querySelectorAll('[class*="bg-damage"]').length,
  }))
  check(critLatest.text.includes('Longsword damage') && same(critLatest.gold, [String(critTotal)]) && critLatest.red === 0,
    `${at}, the Rolls popover's latest roll is that damage, its total in gold (${JSON.stringify(critLatest)})`)
  await page.keyboard.press('Escape')
  await popover.waitFor({ state: 'detached' })

  // ---- T12: the damage menu on a waiting toast ----
  ;({ request: hit, toast: sticky } = await swing(15, 'the second attack'))
  const stickyDamage = sticky.getByRole('button', { name: 'Roll damage' })
  const menu = page.getByRole('menu', { name: 'Longsword damage 1d8 + 3' })
  let held = true
  if (width < 768) held = await longPress(stickyDamage, menu)
  else await stickyDamage.click({ button: 'right' })
  await menu.waitFor()
  const ways = await menu.getByRole('menuitem').allTextContents()
  check(held && same(ways, ['Roll maximum damage', 'Modify damage…']) && await sticky.evaluate(el => !!el.querySelector('[role=menu]')),
    `${at}, a ${width < 768 ? 'long-press' : 'right-click'} on its Roll damage opens the damage menu inside the toast: ${JSON.stringify(ways)}`)
  await shoot(page, `toasts-${width}-sticky-menu`)
  ;({ request: damage, toast } = await rollDamageOf(hit.id, () => menu.getByRole('menuitem', { name: 'Roll maximum damage' }).click(), 'Longsword damage', 'the damage at its highest'))
  check(same(damage.payload.modifiers, { maximize: true }) && damage.status === 'done' && (await readToast(toast)).table === 'At the table: 11' && await sticky.count() === 0,
    `${at}, chosen, its highest is sent, and the game rolls 11; the waiting toast is gone`)

  // ---- T13: × closes one, which never comes back; its damage rolls from the row's chip ----
  ;({ request: hit, toast: sticky } = await swing(15, 'the third attack'))
  let closedId = await sticky.getAttribute('data-roll-toast')
  // Timed in the page, from the ×'s click to the toast leaving the log, so that the time
  // Playwright takes to find the button steady, as it slides in, isn't counted.
  await page.evaluate(id => {
    const log = document.querySelector('[role=log][aria-label="Roll results"]')
    const toast = log.querySelector(`[data-roll-toast="${id}"]`)
    globalThis.__closed = {}
    toast.querySelector('button[aria-label="Dismiss"]').addEventListener('click', () => { globalThis.__closed.clicked = performance.now() }, { capture: true })
    globalThis.__closeObserver?.disconnect()
    globalThis.__closeObserver = new MutationObserver(() => {
      if (!log.querySelector(`[data-roll-toast="${id}"]`) && globalThis.__closed.gone === undefined) globalThis.__closed.gone = performance.now()
    })
    globalThis.__closeObserver.observe(log, { subtree: true, childList: true })
  }, closedId)
  await sticky.getByRole('button', { name: 'Dismiss' }).click()
  await sticky.waitFor({ state: 'detached', timeout: 1_000 })
  const closed = await page.evaluate(() => { globalThis.__closeObserver.disconnect(); return globalThis.__closed })
  const closeMs = closed.gone - closed.clicked
  const stays = await throughout(async () => await log.locator(`[data-roll-toast="${closedId}"]`).count() === 0, 5_000)
  const dot = await rollsButton.evaluate(el => el.textContent)
  check(closeMs >= 0 && closeMs <= 400 && stays && dot === 'Your rolls, damage to roll',
    `${at}, its × closes it at once (${Math.round(closeMs)} ms after the click), and it doesn't come back (${stays}); the Rolls button's dot says its damage is still to roll ("${dot}")`)
  ;({ request: damage } = await rollDamageOf(hit.id, () => panel.getByRole('button', { name: 'Longsword damage, 1d8 + 3' }).click(), 'Longsword damage', 'the damage from the chip'))
  check(damage.kind === 'damage' && damage.status === 'done' && await rollsButton.evaluate(el => el.textContent) === 'Your rolls' && await log.locator(`[data-roll-toast="${closedId}"]`).count() === 0,
    `${at}, the row's damage chip rolls it at the table, the dot goes, and the closed toast stays closed`)

  // ---- T14: closed, its damage rolls from the Rolls popover, which holds the banner's own ----
  ;({ request: hit, toast: sticky } = await swing(15, 'the fourth attack'))
  closedId = await sticky.getAttribute('data-roll-toast')
  await sticky.getByRole('button', { name: 'Dismiss' }).click()
  await sticky.waitFor({ state: 'detached', timeout: 1_000 })
  await rollsButton.click()
  await popover.waitFor()
  const latest = popover.getByRole('status')
  const earlierCount = Number(/Earlier rolls \((\d+)\)/.exec(await popover.textContent())?.[1])
  check(await latest.getAttribute('aria-live') === 'off' && /Longsword attack/.test(await latest.textContent()) && /At the table: 21 · Hit/.test(await latest.textContent())
    && await latest.getByRole('button', { name: 'Roll damage' }).isVisible() && earlierCount >= 10 && await popover.getByText(REACH).isVisible() && await banner.count() === 0,
    `${at}, the Rolls button opens "Your rolls": the latest in full, unannounced, with its Roll damage; Earlier rolls (${earlierCount}); and the reach line (${await latest.textContent()})`)
  const box = await popover.boundingBox()
  check(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height, `${at}, it fits the screen (${JSON.stringify(box)})`)
  await popover.getByText(/^Earlier rolls/).click()
  const earlier = await popover.locator('details li').evaluateAll(all => all.map(el => el.firstElementChild?.textContent))
  check(earlier.length === earlierCount && earlier.includes('Strength check') && earlier.includes('Longsword damage'), `${at}, the earlier rolls are listed: ${JSON.stringify(earlier)}`)
  await shoot(page, `toasts-${width}-popover`)
  // The damage menu and its dialog open inside it; Escape on the dialog closes only that.
  const popDamage = latest.getByRole('button', { name: 'Roll damage' })
  if (width < 768) held = await longPress(popDamage, menu)
  else await popDamage.click({ button: 'right' })
  await menu.waitFor()
  check(await popover.evaluate(el => !!el.querySelector('[role=menu]')), `${at}, its Roll damage opens the damage menu inside the popover`)
  await menu.getByRole('menuitem', { name: 'Modify damage…' }).click()
  const modify = page.getByRole('dialog', { name: 'Modify damage' })
  await modify.waitFor()
  await page.keyboard.press('Escape')
  await modify.waitFor({ state: 'hidden', timeout: 2_000 })
  check(await popover.isVisible() && await menu.count() === 0, `${at}, Escape on Modify damage closes that alone; the popover stays open`)
  ;({ request: damage } = await rollDamageOf(hit.id, () => popDamage.click(), 'Longsword damage', 'the damage from the popover'))
  check(damage.kind === 'damage' && damage.status === 'done' && await rollsButton.evaluate(el => el.textContent) === 'Your rolls'
    && await log.locator(`[data-roll-toast="${closedId}"]`).count() === 0 && await popover.isVisible(),
    `${at}, its Roll damage rolls it at the table, the dot goes, the closed toast stays closed, and the popover stays open`)
  await page.keyboard.press('Escape')
  await popover.waitFor({ state: 'detached' })
  check(await rollsButton.evaluate(el => el === document.activeElement), `${at}, Escape closes it, focus back on the Rolls button`)

  // ---- T15: an earlier roll's damage, the latest another, from the popover ----
  ;({ request: hit, toast: sticky } = await swing(15, 'the fifth attack'))
  await sticky.getByRole('button', { name: 'Dismiss' }).click()
  await sticky.waitFor({ state: 'detached', timeout: 1_000 })
  await tab('Character').click()
  await paced()
  before = await toastIds(page)
  await ability('Charisma').click()
  const charisma = await popped(page, 'Charisma check', before)
  await until(async () => /^At the table: /.test((await readToast(charisma)).table ?? ''), 'the Charisma check to be made', 30_000)
  await charisma.click()
  await rollsButton.click()
  await popover.waitFor()
  const due = popover.getByRole('group', { name: 'Longsword attack' })
  check(/Charisma check/.test(await popover.getByRole('status').textContent()) && await due.getByRole('button', { name: 'Roll damage' }).isVisible(),
    `${at}, with a Charisma check the latest, the popover still offers the closed attack's damage, named for it`)
  ;({ request: damage } = await rollDamageOf(hit.id, () => due.getByRole('button', { name: 'Roll damage' }).click(), 'Longsword damage', "the earlier attack's damage"))
  check(damage.status === 'done' && await due.count() === 0 && await rollsButton.evaluate(el => el.textContent) === 'Your rolls', `${at}, which rolls it at the table, and the dot goes`)
  await page.keyboard.press('Escape')
  await popover.waitFor({ state: 'detached' })
  await clearToasts()
  await tab('Actions').click()

  // ---- T15a: an attack that misses doesn't wait: its toast goes four seconds after it says so (toasts3) ----
  // dnd5e's card still offers a miss's damage, for what deals damage on one; the Rolls popover's latest
  // roll and the row's chip offer it too, but no dot says so, nor does the popover list it once it
  // isn't the latest.
  await watchToasts(page)
  let miss
  ;({ request: miss, toast } = await swing(3, 'a miss'))
  const missId = await toast.getAttribute('data-roll-toast')
  const missed = await readToast(toast)
  check(miss.result.attack?.outcome === 'miss' && !!miss.result.damage && missed.table === 'At the table: 9 · Miss' && await toast.getAttribute('data-waits') === null
    && await toast.getByRole('button').count() === 0 && await toast.getAttribute('data-accent') === 'ruby' && await rollsButton.evaluate(el => el.textContent) === 'Your rolls',
    `${at}, a longsword attack that misses the goblin, its damage still due at the table, pops up a ruby toast that doesn't wait, with nothing to tap, and no dot on the Rolls button: "${missed.dice}", "${missed.table}"`)
  await shoot(page, `toasts-${width}-miss`)
  await toast.waitFor({ state: 'detached', timeout: 10_000 })
  samples = await stopWatching(page)
  const missSaid = samples.find(s => s.ids.includes(missId) && s.tables[s.ids.indexOf(missId)].endsWith('· Miss'))
  const missGone = samples.find(s => missSaid && s.at > missSaid.at && !s.ids.includes(missId))
  const missFor = missSaid && missGone ? missGone.at - missSaid.at : NaN
  check(missFor >= 3600 && missFor <= 4600 && !samples.some(s => s.ids.includes(missId) && s.waits[s.ids.indexOf(missId)]),
    `${at}, the miss's toast goes ${Math.round(missFor)} ms after it says "· Miss", never waiting${Number.isNaN(missFor) ? ` (${changes(samples)})` : ''}`)
  await rollsButton.click()
  await popover.waitFor()
  const missLatest = popover.getByRole('status')
  check(/Longsword attack/.test(await missLatest.textContent()) && /At the table: 9 · Miss/.test(await missLatest.textContent()) && await missLatest.getByRole('button', { name: 'Roll damage' }).isVisible()
    && await popover.locator('[role=group]').count() === 0,
    `${at}, the Rolls popover's latest roll is the miss in full, with its Roll damage (${await missLatest.textContent()})`)
  ;({ request: damage } = await rollDamageOf(miss.id, () => missLatest.getByRole('button', { name: 'Roll damage' }).click(), 'Longsword damage', "the miss's damage from the popover"))
  check(damage.kind === 'damage' && damage.useId === miss.id && damage.status === 'done', `${at}, which rolls the miss's damage at the table`)
  await page.keyboard.press('Escape')
  await popover.waitFor({ state: 'detached' })
  // Another miss, then a check: the miss isn't the latest, and nothing lists it; the chip rolls it.
  ;({ request: miss, toast } = await swing(3, 'another miss'))
  await toast.click()
  await toast.waitFor({ state: 'detached', timeout: 1_000 })
  await tab('Character').click()
  await paced()
  before = await toastIds(page)
  await ability('Charisma').click()
  const afterMiss = await popped(page, 'Charisma check', before)
  await until(async () => /^At the table: /.test((await readToast(afterMiss)).table ?? ''), 'the Charisma check after the miss to be made', 30_000)
  await afterMiss.click()
  await rollsButton.click()
  await popover.waitFor()
  check(/Charisma check/.test(await popover.getByRole('status').textContent()) && await popover.locator('[role=group]').count() === 0
    && await popover.getByRole('button', { name: /damage/i }).count() === 0 && await rollsButton.evaluate(el => el.textContent) === 'Your rolls',
    `${at}, with a check after it, the popover lists no miss's damage to roll, and the Rolls button has no dot`)
  await page.keyboard.press('Escape')
  await popover.waitFor({ state: 'detached' })
  await tab('Actions').click()
  ;({ request: damage } = await rollDamageOf(miss.id, () => panel.getByRole('button', { name: 'Longsword damage, 1d8 + 3' }).click(), 'Longsword damage', "the miss's damage from the chip"))
  check(damage.kind === 'damage' && damage.useId === miss.id && damage.status === 'done', `${at}, but the row's damage chip still rolls that miss's damage at the table`)
  await clearToasts()

  // ---- T16: a use whose kind of damage is to choose waits, with a button for each ----
  await paced()
  await clearToasts()
  // Cast from the Spells tab, where Thorin's spells are.
  await tab('Spells').click()
  await panel.getByRole('heading', { name: '2nd Level' }).waitFor()
  before = await toastIds(page)
  console.log('spell buttons:', JSON.stringify(await panel.getByRole('button', { name: /^Dragon’s Breath/ }).evaluateAll(all => all.map(el => el.getAttribute('aria-label') ?? el.textContent))))
  const breathChip = panel.getByRole('button', { name: /^Dragon’s Breath, / })
  await breathChip.first().click()
  const breathPicker = page.getByRole('dialog', { name: 'Dragon’s Breath' })
  await breathPicker.waitFor()
  await breathPicker.getByRole('checkbox', { name: 'Goblin', exact: true }).click()
  let count = requests()
  await breathPicker.getByRole('button', { name: 'Cast at 1 target' }).click()
  await until(() => requests() > count, "Dragon's Breath to be sent")
  const cast = latestRequest()
  await until(() => settled(rowOf(cast.id)), "Dragon's Breath to be made")
  const kinds = await popped(page, 'Dragon’s Breath', before)
  await kinds.getByRole('button', { name: 'Roll Acid damage' }).waitFor({ timeout: 10_000 })
  const kindButtons = await kinds.getByRole('button').evaluateAll(all => all.map(el => el.getAttribute('aria-label')))
  check(rowOf(cast.id).kind === 'use' && rowOf(cast.id).status === 'done' && await kinds.getAttribute('data-waits') === 'true' && await kinds.getByText('Choose its kind of damage:').isVisible()
    && same(kindButtons, ['Roll Acid damage', 'Roll Cold damage', 'Roll Fire damage', 'Roll Lightning damage', 'Roll Poison damage', 'Dismiss']),
    `${at}, cast, Dragon's Breath pops up a toast that waits for its kind of damage to be chosen: ${JSON.stringify(kindButtons)}`)
  await shoot(page, `toasts-${width}-kinds`)
  ;({ request: damage } = await rollDamageOf(cast.id, () => kinds.getByRole('button', { name: 'Roll Cold damage' }).click(), 'Dragon’s Breath damage', "Dragon's Breath's damage"))
  check(same(damage.payload.types, ['cold']) && damage.status === 'done' && await kinds.count() === 0,
    `${at}, a tap on Cold sends its damage as cold, the game rolls it, and the toast that waited goes`)

  // ---- T17: an area attack's toast says whom it hit ----
  await paced()
  await clearToasts()
  await tab('Actions').click()
  before = await toastIds(page)
  await forceD20(page, 15)
  await panel.getByRole('button', { name: 'Breath Weapon attack, +6' }).click()
  const area = page.getByRole('dialog', { name: 'Breath Weapon attack' })
  await area.waitFor()
  await area.getByRole('checkbox', { name: /^Goblin/ }).click()
  await area.getByRole('checkbox', { name: /^Ogre/ }).click()
  count = requests()
  await area.getByRole('button', { name: 'Attack 2 targets' }).click()
  await until(() => requests() > count, 'the area attack to be sent')
  await unforce(page)
  const blast = latestRequest()
  await until(() => settled(rowOf(blast.id)), 'the area attack to be made')
  const areaToast = await popped(page, 'Breath Weapon attack', before)
  await areaToast.getByRole('list', { name: 'Targets' }).waitFor({ timeout: 10_000 })
  const outcomes = await areaToast.getByRole('list', { name: 'Targets' }).getByRole('listitem').allTextContents()
  check((await readToast(areaToast)).table === 'At the table: 21 · Hit 1 of 2' && same(outcomes, ['Goblin: Hit', 'Ogre: Miss']) && await areaToast.getAttribute('data-waits') === 'true',
    `${at}, the area attack's toast says it hit one of two, and whom: ${JSON.stringify(outcomes)}`)
  await shoot(page, `toasts-${width}-area`)
  ;({ request: damage } = await rollDamageOf(blast.id, () => areaToast.getByRole('button', { name: 'Roll damage' }).click(), 'Breath Weapon damage', "the area attack's damage"))
  check(damage.status === 'done' && await areaToast.count() === 0, `${at}, its Roll damage rolls it, and it goes`)
  // One that misses everyone in it doesn't wait (toasts3): it goes, its damage left to the chip.
  await paced()
  await clearToasts()
  before = await toastIds(page)
  await forceD20(page, 3)
  await panel.getByRole('button', { name: 'Breath Weapon attack, +6' }).click()
  await area.waitFor()
  await area.getByRole('checkbox', { name: /^Goblin/ }).check()
  await area.getByRole('checkbox', { name: /^Ogre/ }).check()
  count = requests()
  await area.getByRole('button', { name: 'Attack 2 targets' }).click()
  await until(() => requests() > count, 'the area attack that misses to be sent')
  await unforce(page)
  const allMiss = latestRequest()
  await until(() => settled(rowOf(allMiss.id)), 'the area attack that misses to be made')
  const missToast = await popped(page, 'Breath Weapon attack', before)
  await missToast.getByRole('list', { name: 'Targets' }).waitFor({ timeout: 10_000 })
  const missOutcomes = await missToast.getByRole('list', { name: 'Targets' }).getByRole('listitem').allTextContents()
  check((await readToast(missToast)).table === 'At the table: 9 · Hit 0 of 2' && same(missOutcomes, ['Goblin: Miss', 'Ogre: Miss']) && !!rowOf(allMiss.id).result.damage
    && await missToast.getAttribute('data-waits') === null && await missToast.getByRole('button').count() === 0 && await rollsButton.evaluate(el => el.textContent) === 'Your rolls',
    `${at}, an area attack that misses both doesn't wait: "${(await readToast(missToast)).table}", ${JSON.stringify(missOutcomes)}, nothing to tap, no dot`)
  await missToast.click()
  await missToast.waitFor({ state: 'detached', timeout: 1_000 })
  await clearToasts()
  await tab('Character').click()

  // ---- T18: a toast shows over the Combat pane, below the table's header there, then below the row again ----
  {
    await paced()
    await ability('Strength').click()
    await toasts.filter({ hasText: 'Strength check' }).waitFor({ timeout: 25_000 })
    await nav.getByRole('button', { name: /^Combat/ }).click()
    const combatPane = page.getByRole('region', { name: 'Combat' })
    await combatPane.waitFor()
    const over = await toasts.first().evaluate(el => {
      const b = el.getBoundingClientRect()
      return el.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2))
    })
    // The sheet's row isn't shown with the combat: the toasts start below the header instead.
    await until(async () => (await placeOf(page)).under === 'header', 'the toasts to move under the header', 2_000).catch(() => {})
    place = await placeOf(page)
    const back = page.getByRole('link', { name: 'All characters' })
    const headerReach = await tappable(back)
    check(await combatPane.isVisible() && !(await sheet.isVisible()) && await toasts.filter({ hasText: 'Strength check' }).isVisible() && over
      && misplaced(place, 'header').length === 0 && headerReach.ok,
      `${at}, a roll's toast stays over the Combat pane when Alice turns to it, starting 8 pixels below the table's header, its back link tappable: ${placed(place)} (${[...misplaced(place, 'header'), ...headerReach.misses].join('; ')})`)
    await shoot(page, `toasts-${width}-combat`)
    await nav.getByRole('button', { name: 'Character', exact: true }).click()
    await sheet.waitFor()
    await until(async () => (await placeOf(page)).under === 'row', 'the toasts to move under the row again', 2_000).catch(() => {})
    place = await placeOf(page)
    check(misplaced(place).length === 0, `${at}, back on the sheet, they start below its tab row again: ${placed(place)} (${misplaced(place).join('; ')})`)
    await clearToasts()
  }

  // ---- T19: Banner: no toasts, the waiting one with them, the banner instead; kept; Toasts again ----
  await tab('Actions').click()
  ;({ request: hit, toast: sticky } = await swing(15, 'an attack before the switch'))
  await cog.press('Enter')
  await settings.waitFor()
  await results.getByRole('radio', { name: 'Banner' }).press('Enter')
  await banner.waitFor({ timeout: 5_000 })
  const bannerStatus = banner.getByRole('status')
  check(same(await radios(), ['Toasts:false', 'Banner:true']) && await resultsHint() === BANNER_HINT && await settings.isVisible() && await log.count() === 0
    && await rollsButton.count() === 0 && await bannerStatus.getAttribute('aria-live') === 'polite' && /At the table: 21 · Hit/.test(await bannerStatus.textContent())
    && await banner.getByRole('button', { name: 'Roll damage' }).isVisible(),
    `${at}, Banner clears the toasts, the waiting one too, and the Rolls button; the settings stay open, saying what the banner does; the banner shows, announced, the attack and its Roll damage`)
  await page.keyboard.press('Escape')
  await settings.waitFor({ state: 'detached' })
  ;({ request: damage } = await (async () => {
    await paced()
    await banner.getByRole('button', { name: 'Roll damage' }).click()
    await until(() => !!rowWhere(`where "useId" = '${hit.id}'`), 'the damage from the banner to be sent')
    const { id } = rowWhere(`where "useId" = '${hit.id}'`)
    await until(() => settled(rowOf(id)), 'the damage from the banner to be made')
    return { request: rowOf(id) }
  })())
  await bannerStatus.getByText(/^At the table: \d+/).waitFor({ timeout: 30_000 })
  check(damage.status === 'done' && /Longsword damage/.test(await bannerStatus.textContent()) && await page.locator('[data-roll-toast]').count() === 0,
    `${at}, the banner's Roll damage rolls it, and no toast pops up`)
  await tab('Character').click()
  await paced()
  await ability('Wisdom').click()
  check(await throughout(async () => await page.locator('[data-roll-toast]').count() === 0, 6_000) && /Wisdom check/.test(await bannerStatus.textContent()),
    `${at}, with the banner, a Wisdom check pops up no toast in 6 seconds, the banner showing it`)
  await page.reload()
  await tabs.waitFor()
  await banner.getByText(REACH).waitFor({ timeout: 15_000 })
  await cog.click()
  check(same(await radios(), ['Toasts:false', 'Banner:true']) && await rollsButton.count() === 0 && await page.evaluate(() => localStorage.getItem('sending-stone:roll-toasts')) === 'off',
    `${at}, after a reload Roll results is still Banner, stored as toasts off, and the banner shows`)
  await results.getByRole('radio', { name: 'Toasts' }).click()
  await page.keyboard.press('Escape')
  await settings.waitFor({ state: 'detached' })
  await log.waitFor({ state: 'attached' })
  check(await banner.count() === 0 && await rollsButton.isVisible() && await throughout(async () => await toasts.count() === 0, 2_000)
    && await page.evaluate(() => localStorage.getItem('sending-stone:roll-toasts')) === 'on',
    `${at}, Toasts again: the banner goes, the Rolls button is back, and nothing already rolled pops up`)
  await paced()
  await ability('Charisma').click()
  check(await within(async () => (await shownLabels(toasts)).includes('Charisma check'), 25_000), `${at}, and a Charisma check pops up its toast`)
  await view.close()

  // ---- T20: no sliding where motion is unwelcome; the dark theme, each accent and the popover ----
  {
    const dark = await open({ width, height, reducedMotion: 'reduce', scheme: 'dark' })
    const darkAbility = name => dark.sheet.getByRole('button', { name: new RegExp(`^${name} check`) })
    await paced()
    let before = await toastIds(dark.page)
    await forceD20(dark.page, 12)
    await darkAbility('Strength').click()
    const plain = await popped(dark.page, 'Strength check', before)
    await unforce(dark.page)
    const motion = await plain.evaluate(el => ({ name: getComputedStyle(el).animationName, transition: getComputedStyle(el).transitionProperty }))
    check(motion.name === 'none', `${at}, where motion is unwelcome the toast doesn't slide in (${JSON.stringify(motion)})`)
    await until(async () => (await readToast(plain)).table === 'At the table: 15', 'the dark Strength check to be made', 30_000)
    const looks = [await lookOf(dark.page, plain)]
    await shoot(dark.page, `toasts-${width}-primary-dark`)
    await plain.click()
    for (const [name, d20, accent] of [['Constitution', 20, 'gold'], ['Wisdom', 1, 'ruby']]) {
      before = await toastIds(dark.page)
      await forceD20(dark.page, d20)
      await darkAbility(name).click()
      const one = await popped(dark.page, `${name} check`, before)
      await unforce(dark.page)
      await until(async () => /^At the table: /.test((await readToast(one)).table ?? ''), `the dark ${name} check to be made`, 30_000)
      looks.push(await lookOf(dark.page, one))
      await shoot(dark.page, `toasts-${width}-${accent}-dark`)
      await one.click()
    }
    await dark.tabs.getByRole('tab', { name: 'Actions' }).click()
    await paced()
    before = await toastIds(dark.page)
    await forceD20(dark.page, 15)
    await dark.panel.getByRole('button', { name: 'Longsword attack, +6' }).click()
    const darkPicker = dark.page.getByRole('dialog', { name: 'Longsword attack' })
    await darkPicker.waitFor()
    count = requests()
    await darkPicker.getByRole('button', { name: /^Goblin/ }).click()
    await until(() => requests() > count, 'the dark attack to be sent')
    await unforce(dark.page)
    const darkHit = latestRequest()
    const darkSticky = await popped(dark.page, 'Longsword attack', before)
    await darkSticky.getByRole('button', { name: 'Roll damage' }).waitFor({ timeout: 30_000 })
    looks.push(await lookOf(dark.page, darkSticky))
    await shoot(dark.page, `toasts-${width}-sticky-dark`)
    before = await toastIds(dark.page)
    await paced()
    await darkSticky.getByRole('button', { name: 'Roll damage' }).click()
    const darkDamage = await popped(dark.page, 'Longsword damage', before)
    await until(async () => /^At the table: \d+/.test((await readToast(darkDamage)).table ?? ''), 'the dark damage to be made', 30_000)
    looks.push(await lookOf(dark.page, darkDamage))
    await shoot(dark.page, `toasts-${width}-damage-dark`)
    await darkDamage.click()
    const bad = looks.flatMap(l => unlike(l, width).map(problem => `${l.accent}: ${problem}`))
    check(same(looks.map(l => l.accent), ['primary', 'gold', 'ruby', 'primary', 'damage']) && bad.length === 0 && settled(rowWhere(`where "useId" = '${darkHit.id}'`)),
      `${at}, in the dark theme each is the bold card in its accent, primary, gold, ruby, a hit's primary and damage's red, its tint drawn over the dark card (${bad.join('; ')}; ${looks.map(tinted).join(' | ')})`)
    await dark.rollsButton.click()
    await dark.popover.waitFor()
    await dark.popover.getByText(/^Earlier rolls/).click()
    check(/Longsword damage/.test(await dark.popover.getByRole('status').textContent()) && await dark.popover.getByText(REACH).isVisible(), `${at}, the dark popover shows the latest, the damage, and the reach line`)
    await shoot(dark.page, `toasts-${width}-popover-dark`)
    await dark.view.close()
  }
}

// ---- T21: on a short phone the popover scrolls inside, and fits ----
{
  const short = await open({ width: 390, height: 500 })
  const { page, panel, tabs, sheet, rollsButton, popover, log } = short
  await tabs.getByRole('tab', { name: 'Actions' }).click()
  const picker = page.getByRole('dialog', { name: 'Longsword attack' })
  for (const n of [1, 2, 3]) {
    await paced()
    const before = await toastIds(page)
    await forceD20(page, 15)
    await panel.getByRole('button', { name: 'Longsword attack, +6' }).click()
    await picker.waitFor()
    await picker.getByRole('button', { name: /^Goblin/ }).click()
    await unforce(page)
    const waiting = await popped(page, 'Longsword attack', before)
    await waiting.getByRole('button', { name: 'Dismiss' }).click({ timeout: 30_000 })
    await waiting.waitFor({ state: 'detached' })
  }
  await tabs.getByRole('tab', { name: 'Character' }).click()
  await paced()
  const before = await toastIds(page)
  await sheet.getByRole('button', { name: /^Strength check/ }).click()
  const plain = await popped(page, 'Strength check', before)
  await until(async () => /^At the table: /.test((await readToast(plain)).table ?? ''), 'the Strength check to be made', 30_000)
  await plain.click()
  await rollsButton.click()
  await popover.waitFor()
  await popover.getByText(/^Earlier rolls/).click()
  const fit = await popover.evaluate(el => {
    const box = el.getBoundingClientRect()
    const scroller = el.firstElementChild
    const root = document.scrollingElement
    const reach = [...el.querySelectorAll('p')].find(p => p.textContent.startsWith('Checks, saves'))
    scroller.scrollTop = scroller.scrollHeight
    const end = reach.getBoundingClientRect()
    return {
      top: box.top, bottom: box.bottom, left: box.left, right: box.right, maxHeight: el.style.maxHeight,
      scrolls: scroller.scrollHeight > scroller.clientHeight, scrolled: scroller.scrollTop > 0,
      reachShown: end.top >= box.top && end.bottom <= box.bottom + 1, pageY: root.scrollHeight - root.clientHeight, pageX: root.scrollWidth - root.clientWidth,
      groups: el.querySelectorAll('[role=group]').length,
    }
  })
  check(fit.groups === 3 && fit.scrolls && fit.scrolled && fit.reachShown && fit.top >= 0 && fit.bottom <= 500 && fit.left >= 0 && fit.right <= 390
    && /^\d+px$/.test(fit.maxHeight) && fit.pageX === 0 && fit.pageY === 0 && await log.locator('[data-roll-toast]').count() === 0,
    `on a 390×500 phone, the popover, with three closed attacks' damage, the latest and the earlier rolls, fits the screen and scrolls inside to the reach line, the page not scrolling (${JSON.stringify(fit)})`)
  await shoot(page, 'toasts-390x500-popover-scrolled')
  await short.view.close()
}

// ---- T22: the Gamemaster's page, at Thorin's sheet: toasts in their words ----
const gmView = await open({ width: 768, height: 1024, path: `/campaigns/${CAMPAIGN}/characters/thorin` })
{
  const { page, sheet, tabs, panel, banner, rollsButton, popover } = gmView
  check(await banner.count() === 0 && await rollsButton.isVisible() && await sheet.locator('[role=status]').count() === 0,
    "the Gamemaster's page at Thorin's sheet has no banner either, but the Rolls button")
  await tabs.getByRole('tab', { name: 'Actions' }).click()
  await paced()
  const before = await toastIds(page)
  await forceD20(page, 15)
  await panel.getByRole('button', { name: 'Longsword attack, +6' }).click()
  const picker = page.getByRole('dialog', { name: 'Longsword attack' })
  await picker.waitFor()
  await picker.getByRole('button', { name: /^Goblin/ }).click()
  await unforce(page)
  const waiting = await popped(page, 'Longsword attack', before)
  await waiting.getByRole('button', { name: 'Roll damage' }).waitFor({ timeout: 30_000 })
  check((await readToast(waiting)).table === 'At the table: 21 · Hit' && await waiting.getAttribute('data-waits') === 'true',
    "the Gamemaster's hit, made as Thorin's, waits for its damage as the player's does")
  // Below the row on the Gamemaster's page too, wherever the row is there.
  const gmPlace = await placeOf(page)
  const gmBlocked = await untappable([...await rowControls(gmView), ['the back link', page.getByRole('link', { name: 'Your campaigns' })]])
  check(misplaced(gmPlace).length === 0 && gmBlocked.length === 0,
    `on the Gamemaster's page, the waiting toast starts 8 pixels below the tab row, and the cog, the Rolls button, every tab and the back link stay tappable at their centre and each edge: ${placed(gmPlace)} (${[...misplaced(gmPlace), ...gmBlocked].join('; ')})`)
  await shoot(page, 'toasts-gm-sticky')
  const damageBefore = await toastIds(page)
  await paced()
  await waiting.getByRole('button', { name: 'Roll damage' }).click()
  const gmDamage = await popped(page, 'Longsword damage', damageBefore)
  await until(async () => /^At the table: \d+/.test((await readToast(gmDamage)).table ?? ''), "the Gamemaster's damage to be made", 30_000)
  await waiting.waitFor({ state: 'detached', timeout: 2_000 })
  await rollsButton.click()
  await popover.waitFor()
  check(await popover.getByText(GM_REACH).isVisible(), `the Gamemaster's popover says the rolls are made in their game: "${GM_REACH}"`)
  await shoot(page, 'toasts-gm-popover')
  await page.keyboard.press('Escape')
  await tabs.getByRole('tab', { name: 'Character' }).click()
}

// ---- T23: the game gone quiet: the toast goes, and pops up again, in the warning's, when the app gives the roll up ----
// Each page's toast is followed by its roll's id: since this round the player's pages also show the
// Gamemaster's Intelligence check as Thorin, from their page, as a toast of its own, marked as
// theirs, once it isn't made (#156); the Gamemaster's page shows it only as their own.
{
  const phone = await open({ width: 390, height: 844 })
  const tablet = await open({ width: 768, height: 1024, scheme: 'dark' })
  const { stopPollers } = await import(`${MODULE}/scripts/commands.mjs`)
  const { checkBridge } = await import(`${MODULE}/scripts/bridge.mjs`)
  users.get('gm').isActiveGM = false
  checkBridge()
  stopPollers()
  await wait(500)
  await paced()
  const views = [['on a phone', phone, 'your Gamemaster’s game'], ['on a tablet, dark', tablet, 'your Gamemaster’s game'], ["on the Gamemaster's page", gmView, 'your game']]
  const quiet = []
  const quietIds = []
  for (const [where, { page, sheet }, game] of views) {
    const count = requests()
    await watchToasts(page)
    const before = await toastIds(page)
    await sheet.getByRole('button', { name: /^Intelligence check/ }).click()
    await until(() => requests() > count, `the unfetched roll ${where} to be sent`)
    const toast = await popped(page, 'Intelligence check', before)
    await until(async () => (await readToast(toast)).table === `Sending to ${game}…`, `the toast ${where} to say it is on its way`, 5_000)
    quiet.push(toast)
    quietIds.push(await toast.getAttribute('data-roll-toast'))
  }
  for (const [index, [where, { page }, game]] of views.entries()) {
    await quiet[index].waitFor({ state: 'detached', timeout: 6_000 })
    const samples = await stopWatching(page)
    const shown = samples.find(s => s.ids.includes(quietIds[index]))
    const left = samples.find(s => shown && s.at > shown.at && !s.ids.includes(quietIds[index]))
    check(shown && left && left.at - shown.at >= 3600 && left.at - shown.at <= 4600,
      `${where}, a roll the game hasn't picked up shows "Sending to ${game}…", and goes after ${Math.round(left?.at - shown?.at)} ms${left && shown ? '' : ` (${changes(samples)})`}`)
    await watchToasts(page)
  }
  sql(`update roll_request set "createdAt" = now() - interval '31 seconds' where status = 'pending'`)
  for (const [index, [where, { page }, game]] of views.entries()) {
    const toast = quiet[index]
    await toast.waitFor({ timeout: 15_000 })
    await until(async () => (await readToast(toast)).table?.startsWith(`Not made at the table: ${game} didn’t pick it up`), `the toast ${where} to say it was given up`, 5_000)
    const look = await lookOf(page, toast)
    const colour = await toast.evaluate((el, LINE) => getComputedStyle(el.querySelector(LINE)).color.match(/[\d.]+/g).slice(0, 3).map(Number), LINE)
    const viewWidth = page.viewportSize().width
    check(look.accent === 'warning' && same(colour, look.accentRgb) && unlike(look, viewWidth).length === 0,
      `${where}, given up by the app, it pops up again, "${(await readToast(toast)).table}", the bold card in the warning's colours, its words too (${unlike(look, viewWidth).join('; ')}; ${tinted(look)})`)
    await shoot(page, `toasts-${viewWidth}-warning${index === 1 ? '-dark' : ''}${index === 2 ? '-gm' : ''}`)
  }
  const gmToasts = []
  for (const [index, [where, { page }]] of views.entries()) {
    await quiet[index].waitFor({ state: 'detached', timeout: 6_000 })
    const samples = await stopWatching(page)
    const again = samples.find(s => s.ids.includes(quietIds[index]))
    const goneAgain = samples.find(s => again && s.at > again.at && !s.ids.includes(quietIds[index]))
    check(again && goneAgain && goneAgain.at - again.at >= 3600 && goneAgain.at - again.at <= 4600, `${where}, it goes ${Math.round(goneAgain?.at - again?.at)} ms later${again && goneAgain ? '' : ` (${changes(samples)})`}`)
    gmToasts.push([...new Set(samples.flatMap(s => s.ids.map((id, at) => id.startsWith('gm:') ? `${s.labels[at]}: ${s.tables[at]}` : null)).filter(Boolean))])
  }
  const gmGivenUp = 'Intelligence check: Not made at the table: your Gamemaster’s game didn’t pick it up'
  check(gmToasts[0].includes(gmGivenUp) && gmToasts[1].includes(gmGivenUp) && gmToasts.every(seen => seen.every(text => text.startsWith('Intelligence check: Not made at the table'))) && gmToasts[2].length === 0,
    `the Gamemaster's Intelligence check as Thorin, given up too, pops up on the player's phone and tablet once it's given up, never before, and not on the Gamemaster's own page (${JSON.stringify(gmToasts)})`)
  await phone.view.close()
  await tablet.view.close()
  await gmView.view.close()
}

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
