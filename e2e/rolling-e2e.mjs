// Formulas with dice modifiers (#149) and Self among a use's targets (#150), end to end (module
// 0.22.0): the real module, in a stand-in Foundry with dnd5e 5.3.3's real dice classes, Foundry's
// Die modifiers (fvtt/dice-core.mjs) and its activities ported (fvtt/activity5e.mjs), fetches from
// the production app, from a browser on the game's page. Garrus, a Great Weapon Fighter, swings a
// greatsword whose damage is 2d6r<=2 + 7 + 1d8, which the app couldn't read before: its damage chip
// is a button, and enabled, on his Actions row, its other activity's row, his favorites and his
// Inventory row; an attack, then its damage, sends Alice's first throw, the game rerolls her 1s with
// its own dice, and the tray shows the game's total; its description's [[/damage 2d6r<=2 + 7]] rolls
// the same way; at its highest it may be, but a maul whose die explodes may not. Then his Potion of
// Healing and Shared Shape, whose range is Self: in his fight, Self is first and the default, ticked
// where it takes more, made at his own combatant; in a fight he isn't in, and out of combat, the use
// is sent with self, and the game's card targets him all the same; an attack never offers Self; and
// the app offers Self beyond his own combatant only while the hello says selfTargets. MIDI=1 puts
// the stand-in Midi-QOL workflow in the world (fvtt/midi-fake.mjs). Run with --import
// ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { combat, combatant, settings, user, users, actors } from './fvtt/stub.mjs'
import { expandSheet } from './fvtt/slim-expand.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
const MIDI = !!process.env.MIDI
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
  await page.screenshot({ path: `${SHOTS}/${name}${MIDI ? '-midi' : ''}.png` })
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sum = values => values.reduce((total, value) => total + value, 0)

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
// Where set, the hello goes as a module before 0.22.0 sends it: without selfTargets.
let helloBefore022 = false
let fetches = 0
globalThis.fetch = async (url, init) => {
  // Made from the game's page, and given up on there when the module gives it up.
  const id = ++fetches
  init.signal?.addEventListener('abort', () => {
    void gmTab.evaluate(id => globalThis.__aborts?.[id]?.abort(), id).catch(() => {})
  }, { once: true })
  let outgoing = init.body
  const sending = JSON.parse(outgoing)
  if (helloBefore022 && sending.type === 'bridge.hello') {
    delete sending.data.features.rolls.selfTargets
    outgoing = JSON.stringify(sending)
  }
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
  }, { id, url: String(url), init: { method: init.method, headers: init.headers, body: outgoing, mode: init.mode, credentials: init.credentials, cache: init.cache } })
  if (error) throw new DOMException('The fetch was given up on', error)
  const sent = JSON.parse(outgoing)
  posted.push({ url: String(url), type: sent.type ?? 'fetch', data: sent.data, status, body })
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

// ---- Foundry, with dnd5e's dice, items and activities ----
// The Gamemaster's tab is in view, so Dice So Nice would show Midi's rolls.
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
const TYPES = ['slashing', 'piercing', 'bludgeoning', 'fire', 'thunder']
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
CONFIG.DND5E = {
  skills: { prc: { label: 'Perception', ability: 'wis' } },
  tools: {},
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex' },
  spellcasting: { spell: { exclusive: { spells: false, slots: false } } },
  damageTypes: Object.fromEntries(TYPES.map(type => [type, { label: capital(type) }])),
  healingTypes: { healing: { label: 'Healing' }, temphp: { label: 'Temporary HP' } },
  activityActivationTypes: {
    action: { label: 'Action', header: 'Actions' }, bonus: { label: 'Bonus Action', header: 'Bonus Actions' },
    reaction: { label: 'Reaction', header: 'Reactions' },
  },
}
settings.set('messageMode', 'public')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
settings.set('attackRollVisibility', 'hideAC')
// dnd5e's names for the inventory's sections.
const translations = {
  'TYPES.Item.weaponPl': 'Weapons', 'TYPES.Item.equipmentPl': 'Equipment', 'TYPES.Item.consumablePl': 'Consumables',
  'TYPES.Item.toolPl': 'Tools', 'TYPES.Item.lootPl': 'Loot', 'DND5E.Items': 'Items',
}
game.i18n.localize = key => translations[key] ?? key
// Foundry's escapeHTML (common/utils/helpers.mjs), as a description's card names its item.
foundry.utils.escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[ch])
// Foundry's enrichment hands a description on as it is: the one below is already enriched.
foundry.applications.ux.TextEditor = { implementation: { async enrichHTML(html) { return html } } }

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, SaveActivity, DamageActivity, HealActivity, Collection, Item5e, equip } = await import('./fvtt/activity5e.mjs')
const { midi, placeables, installMidi } = await import('./fvtt/midi-fake.mjs')
Collection.prototype.getByType ??= function (type) { return this.contents.filter(activity => activity.type === type) }
// An item is a Foundry document of its own kind, as a description's origin reads it.
Object.defineProperty(Item5e.prototype, 'documentName', { value: 'Item', configurable: true })
globalThis.dnd5e = {
  settings: { rulesVersion: 'modern' },
  documents: { activity: { AttackActivity, SaveActivity, DamageActivity, HealActivity } },
  registry: {
    messages: {
      get(id, type) {
        return [...messages.values()].filter(m => (m.flags?.dnd5e?.originatingMessage === id) && (m.flags?.dnd5e?.roll?.type === type))
      },
    },
  },
}
globalThis.Item = { implementation: class { constructor(data) { Object.assign(this, data); this.system ??= {} } } }
globalThis.fromUuidSync = uuid => {
  const [type, id, embedded, embeddedId] = String(uuid).split('.')
  if (type !== 'Actor') return null
  const actor = actors.get(id) ?? null
  return embedded === 'Item' ? (actor?.items?.get(embeddedId) ?? null) : actor
}

users.activeGM = user('gm', 'Gamemaster', true)
users.get('gm').targets = new Set()
const alice = user('alice', 'Alice')
const bob = user('bob', 'Bob')
if (MIDI) installMidi()

// What dnd5e labels a part of damage or healing with, for the sheet.
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
// enrichDamage's link, [[/damage 2d6r<=2 + 7 fire]], as dnd5e 5.3.3 writes it: its formula's < as
// &lt; in the attribute, as Foundry escapes it.
const ICON = '<i class="fa-solid fa-dice-d20" inert=""></i>'
const DAMAGE_LINK = (formula, type, label) => `<a class="roll-link-group" data-action="roll" data-type="damage" data-formulas="${formula.replaceAll('<', '&lt;')}" data-damage-types="${type}" data-roll-type="damage"><span class="roll-link">${ICON}${formula.replaceAll('<', '&lt;')}</span> ${label}</a>`
const GREATSWORD_TEXT = `<p>Its edge remembers every fire it was forged in: once a day it burns for ${DAMAGE_LINK('2d6r<=2 + 7', 'fire', 'Fire')} damage.</p>`

// Garrus, a Great Weapon Fighter: Strength +5, proficiency +3; his greatsword's damage rerolls a 1
// or 2 on its d6s, and adds 7 and a d8 of his Hex-like curse, as a formula of its own (#149). His
// maul's d6 explodes. His potion, and a feature he shares his shape with, are used from Self, at
// him unless Alice picks otherwise (#150); his Whirlwind is an attack from Self, at those around him.
const garrus = new Actor5e({ id: 'garrus', name: 'Garrus', owners: ['alice'], mods: { str: 5, dex: 1, con: 3, wis: 1 }, hp: { value: 30, max: 60, temp: 0 } })
garrus.documentName = 'Actor'
garrus.system.details = { level: 8 }
actors.set('garrus', garrus)
alice.character = garrus
const GWF = '2d6r<=2 + 7 + 1d8'
equip(garrus, {
  ac: 18,
  items: [
    {
      id: 'gsword', name: 'Greatsword', type: 'weapon',
      system: { properties: ['hvy', 'two'], quantity: 1, attackType: 'melee', equipped: true, description: { value: GREATSWORD_TEXT } },
      activities: [
        { id: 'swing', name: 'Swing', damage: [{ custom: GWF, types: ['slashing'] }], labels: { modifier: '+8', damage: [hits(GWF, 'slashing')] } },
        { id: 'heavy', name: 'Heavy Blow', damage: [{ custom: GWF, types: ['slashing'] }], labels: { modifier: '+8', damage: [hits(GWF, 'slashing')] } },
      ],
    },
    {
      id: 'maul', name: 'Thunder Maul', type: 'weapon',
      system: { properties: ['hvy', 'two'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'pound', name: 'Pound', damage: [{ custom: '1d6x + 4', types: ['thunder'] }], labels: { modifier: '+8', damage: [hits('1d6x + 4', 'thunder')] } }],
    },
    {
      id: 'whirl', name: 'Whirlwind', type: 'feat', system: { properties: [] },
      activities: [{
        id: 'spin', name: 'Spin', template: 'sphere', range: 'self', damage: [{ number: 1, denomination: 10, bonus: '5', types: ['slashing'] }],
        labels: { modifier: '+8', damage: [hits('1d10 + 5', 'slashing')] },
      }],
    },
    {
      id: 'potion', name: 'Potion of Healing', type: 'consumable',
      system: { properties: [], quantity: 3, type: { value: 'potion' } },
      activities: [{
        id: 'drink', name: 'Drink', type: 'heal', range: 'self', affects: 'creature', count: 1,
        healing: { number: 2, denomination: 4, bonus: '2', types: ['healing'] }, labels: { damage: [hits('2d4 + 2', 'healing')] },
      }],
    },
    {
      id: 'shape', name: 'Shared Shape', type: 'feat', system: { properties: [] },
      activities: [{ id: 'shift', name: 'Shift', type: 'utility', range: 'self', affects: 'creature', count: 2, activation: { type: 'bonus', value: 1 } }],
    },
  ],
})
// His favorites: the greatsword, its Heavy Blow, and the potion.
garrus.system.favorites = [
  { type: 'item', id: '.Item.gsword', sort: 100000 },
  { type: 'activity', id: '.Item.gsword.Activity.heavy', sort: 200000 },
  { type: 'item', id: '.Item.potion', sort: 300000 },
]
const updateGarrus = garrus.update.bind(garrus)
garrus.update = async changes => {
  await updateGarrus(changes)
  Hooks.callAll('updateActor', garrus, changes, {}, 'gm')
}
const vex = new Actor5e({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3 }, hp: { value: 20, max: 30, temp: 0 } })
vex.documentName = 'Actor'
actors.set('vex', vex)
bob.character = vex
equip(vex, {})

// The tokens on the Gamemaster's canvas: Garrus's and Vex's, and the foes'.
const place = actor => {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  placeables.set(token.id, placeable)
  return token
}
const foe = (id, name, ac) => {
  const actor = new Actor5e({ id, name, mods: {}, hp: { value: 60, max: 60, temp: 0 } })
  actor.type = 'npc'
  actors.set(id, actor)
  equip(actor, { ac })
  return { actor, token: place(actor) }
}
const tokens = { garrus: place(garrus), vex: place(vex) }
// Foundry's: the tokens of an actor on the scene the Gamemaster views.
garrus.getActiveTokens = () => [tokens.garrus]
vex.getActiveTokens = () => [tokens.vex]
const goblin = foe('goblin', 'Goblin', 13)
const ogre = foe('ogre', 'Ogre', 11)
if (MIDI) canvas.scene.tokens.size = placeables.size

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['garrus', 'vex'], rolls: true, attacks: true }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const kinds = () => sql(`select array_to_string("rollKinds", ',') from campaign where title = 'Ashlands'`).split(',')
const features = () => sql(`select array_to_string("rollFeatures", ',') from campaign where title = 'Ashlands'`).split(',')
await until(() => kinds().includes('textDamage') && features().includes('selfTargets'), 'the app to hear the game makes attacks, uses and descriptions', 15_000)
check(['attack', 'use', 'damage', 'textDamage'].every(kind => kinds().includes(kind)) && features().includes('selfTargets') && features().includes('modifiers'),
  `the app keeps that the game makes attacks, uses and a description's damage, changed or not, and a use at its user (${kinds().join(',')}; ${features().join(',')})`)
const hello = posted.find(p => p.type === 'bridge.hello')
check(hello.data.features.rolls.selfTargets === true, "the module's hello says it makes a use at its user")

// The sheet as the module sent it, slim, put back by the harness's own expander
// (fvtt/slim-expand.mjs): the dice and modifiers as written, and a use from Self so marked.
const sentSheet = () => expandSheet(posted.filter(p => p.type === 'character.updated' && p.data.character.id === 'garrus').at(-1).data.character.sheet)
await until(() => posted.some(p => p.type === 'character.updated' && p.data.character.id === 'garrus'), "Garrus's sheet after the hello", 15_000)
const rowOf = id => sentSheet().inventory.sections.flatMap(section => section.items).find(item => item.id === id)
check(same(rowOf('gsword')?.damage?.map(part => part.formula), [GWF]) && rowOf('gsword').activity === null,
  `the module sends the greatsword's damage as written: ${JSON.stringify(rowOf('gsword')?.damage)}`)
check(rowOf('potion')?.activity?.targets?.fromSelf === true && rowOf('potion').activity.targets.self !== true
  && sentSheet().features.flatMap(section => section.features).find(feature => feature.id === 'shape')?.activity?.targets?.fromSelf === true,
  `and its potion and Shared Shape as used from Self, at whom Alice picks: ${JSON.stringify(rowOf('potion')?.activity?.targets)}`)

// A fight: Garrus, a goblin and an ogre.
const fightA = combat('fightA')
combatant(fightA, 'cbGob', goblin.actor, { name: 'Goblin', initiative: 17, token: goblin.token })
combatant(fightA, 'cbGarrus', garrus, { initiative: 15, token: tokens.garrus })
combatant(fightA, 'cbOgre', ogre.actor, { name: 'Ogre', initiative: 6, token: ogre.token })
fightA.getCombatantsByActor = actor => fightA.combatants.filter(cb => cb.actor?.id === actor.id)
fightA.started = true
fightA.round = 1
let current = fightA
Object.defineProperty(game, 'combat', { get: () => current, configurable: true })
await Hooks.callAll('createCombat', fightA)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// Alice plays Garrus.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'sheet-garrus', 'Garrus', '${GAME}', 'Ashlands', id, 'garrus', 'e2e-user', now() from campaign where title = 'Ashlands'`)

// ---- On a phone, 390 wide ----
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
await phone.addCookies([cookie])
await phone.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
const page = await phone.newPage()
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
page.on('response', async response => {
  if (response.request().method() === 'POST' && response.url().endsWith('/rolls') && response.status() !== 202) {
    console.log('refused:', response.status(), await response.text().catch(() => ''), response.request().postData())
  }
})
const nav = page.getByRole('navigation', { name: 'Table' })
const panel = page.getByRole('tabpanel')
const tray = page.getByRole('region', { name: 'Your rolls' })
const status = tray.getByRole('status')
async function openSheet() {
  await page.goto(`${BASE}/characters/sheet-garrus`)
  await page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  if (await nav.isVisible()) await nav.getByRole('button', { name: 'Character' }).click()
}
await openSheet()
await page.getByRole('tab', { name: 'Actions' }).click()
await tray.getByText('Checks, saves, attacks, spells and hit dice you roll, cast or spend here are made in your Gamemaster’s game too, with the same dice.').waitFor({ timeout: 15_000 })

/** The dice the app throws next, each at its lowest for 1 and its highest for 20, or Math.random again. */
const force = value => page.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, value)
const unforce = () => page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
const requestRow = where => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, "useId", result from roll_request ${where} order by "createdAt" desc limit 1) r`) || 'null')
const latestRequest = () => requestRow('')
const requests = () => Number(sql('select count(*) from roll_request'))
const useCard = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.use === id)
const madeFor = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const settledRow = row => ['done', 'failed'].includes(row?.status)
/** Send what a tap rolls, and wait until the game has made it. */
async function sent(tap, what) {
  const before = requests()
  await tap()
  await until(() => requests() > before, `${what} to be sent`)
  const request = latestRequest()
  await until(() => settledRow(requestRow(`where id = '${request.id}'`)), `${what} to be made`)
  return { request, made: requestRow(`where id = '${request.id}'`) }
}
/** The damage or healing the app sends of a use by itself, once the game has made it, made too. */
async function followed(useId, what) {
  await until(() => settledRow(requestRow(`where "useId" = '${useId}'`)), `${what} to follow, sent and made`, 30_000)
  return requestRow(`where "useId" = '${useId}'`)
}
/** Wait for room under the app's limit of 20 rolls a minute from a player. */
const lastMinute = () => Number(sql(`select count(*) from roll_request where "createdAt" > now() - interval '1 minute'`))
const paced = () => until(() => lastMinute() < 16, 'room under the rate limit', 70_000)
/** The tray once it shows a roll the game made, by its label and the game's total. */
async function trayShows(label, total) {
  await until(async () => {
    const text = await status.textContent()
    return text.includes(label) && text.includes(`At the table: ${total}`)
  }, `the tray to show ${label}, ${total} at the table`, 30_000)
  return status.textContent()
}
const cdp = await phone.newCDPSession(page)
/** Hold a finger on a button, as long as a long-press takes and more; then lift it. Whether its menu was open. */
async function longPress(button, itsMenu) {
  await button.scrollIntoViewIfNeeded()
  const { x, y, width, height } = await button.boundingBox()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + width / 2, y: y + height / 2 }] })
  await wait(750)
  const opened = await itsMenu.isVisible()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await wait(300)
  return opened
}
const closeMenu = async () => {
  await page.keyboard.press('Escape')
  await page.getByRole('menu').waitFor({ state: 'hidden' }).catch(() => {})
}
/** Each of a die's results as the game kept them: the number, and whether it counts. */
const kept = die => die.results.map(r => [r.result, r.active !== false])

// ==== #149: 2d6r<=2 + 7 + 1d8 ====
// ---- 1. The damage chip is a button, enabled, wherever the greatsword's damage is ----
const DAMAGE = `Greatsword damage, ${GWF}`
const favorites = panel.getByRole('region', { name: 'Favorites' })
const actionsList = panel.getByRole('region', { name: 'Actions', exact: true })
await favorites.waitFor({ timeout: 15_000 })
const rowChip = actionsList.getByRole('button', { name: DAMAGE, exact: true })
check(await rowChip.count() === 1 && await rowChip.isEnabled(), `on his Actions row, "${DAMAGE}" is a button, and enabled`)
await actionsList.getByRole('button', { name: /^Greatsword/, expanded: false }).click()
const others = actionsList.getByRole('list', { name: 'Greatsword: its other activities' })
await others.waitFor({ timeout: 10_000 })
const heavyChips = await others.getByRole('button').evaluateAll(buttons => buttons.map(b => [b.getAttribute('aria-label') ?? b.textContent, !b.disabled]))
const heavyDamage = heavyChips.find(([name]) => /damage/.test(name) && name.endsWith(GWF))
check(heavyDamage?.[1] === true && /Heavy Blow/.test(heavyDamage[0]), `on its Heavy Blow's row beneath it, its damage is a button, enabled: ${JSON.stringify(heavyChips)}`)
await shoot(page, 'rolling-actions-row')
const favoriteChips = await favorites.getByRole('button').evaluateAll(buttons => buttons.map(b => [b.getAttribute('aria-label') ?? b.textContent, !b.disabled]))
const favoriteDamage = favoriteChips.filter(([name]) => /damage/.test(name) && name.endsWith(GWF))
check(favoriteDamage.length === 2 && favoriteDamage.every(([, enabled]) => enabled)
  && favoriteDamage.some(([name]) => name === DAMAGE) && favoriteDamage.some(([name]) => /Heavy Blow/.test(name)),
  `among his favorites, the greatsword's damage and its Heavy Blow's are buttons, enabled: ${JSON.stringify(favoriteDamage)}`)
await shoot(page, 'rolling-favorites')
await page.getByRole('tab', { name: 'Inventory' }).click()
const inventoryChip = panel.getByRole('region', { name: 'Weapons', exact: true }).getByRole('button', { name: DAMAGE, exact: true })
await inventoryChip.waitFor({ timeout: 10_000 })
check(await inventoryChip.count() === 1 && await inventoryChip.isEnabled(), 'and on his Inventory row, among his weapons')
await shoot(page, 'rolling-inventory-row')

// ---- 2. An attack, then its damage: Alice's first throw, the game's rerolls, the game's total ----
await page.getByRole('tab', { name: 'Actions' }).click()
const swing = actionsList.getByRole('button', { name: 'Greatsword attack, +8' })
const picker = page.getByRole('dialog', { name: 'Greatsword attack' })
await force(15)
await swing.click()
await picker.waitFor()
const attackTargets = await picker.getByRole('listitem').allTextContents()
// Since this round "No target" is a button after the list, not the list's last row.
check(same(attackTargets, ['Goblin', 'Ogre']) && await picker.getByRole('button', { name: 'No target' }).isVisible(), `an attack offers no Self: ${JSON.stringify(attackTargets)}, and No target`)
let { request, made } = await sent(() => picker.getByRole('button', { name: 'Goblin' }).click(), 'the greatsword attack')
await unforce()
const preview = made.result.damage?.rolls?.[0]
check(request.kind === 'attack' && request.payload.item === 'gsword' && request.payload.activity === 'swing' && made.status === 'done' && made.result.attack?.outcome === 'hit'
  && preview?.formula === GWF && same(preview.dice.map(({ faces, number }) => [faces, number]), [[6, 2], [8, 1]]),
  `the game makes the attack, a hit, its damage ${preview?.formula}: each die's number to throw, two d6 and a d8 (${JSON.stringify(made.result.damage)})`)
const attackId = request.id
const rollDamage = tray.getByRole('button', { name: 'Roll damage' })
await rollDamage.waitFor({ timeout: 30_000 })
// Alice's dice all land on 1: the game rerolls both d6s, once, with its own.
await paced()
await force(1)
let damage
;({ request: damage, made } = await sent(() => rollDamage.click(), "the greatsword's damage"))
await unforce()
check(damage.kind === 'damage' && damage.useId === attackId && same(damage.payload.dice, [{ faces: 6, results: [1, 1] }, { faces: 8, results: [1] }]),
  `the app sends Alice's first throw, two d6 and a d8, each a 1, and nothing of a reroll (${JSON.stringify(damage.payload.dice)})`)
let roll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
let [sixes, eight] = roll?.dice ?? []
check(made.status === 'done' && roll?.formula === GWF && sixes.results.length === 4 && sixes.results[0].rerolled === true && sixes.results[1].rerolled === true
  && same(kept(sixes).slice(0, 2), [[1, false], [1, false]]) && kept(sixes).slice(2).every(([value, counts]) => counts && value >= 1 && value <= 6) && same(kept(eight), [[1, true]]),
  `the game rolls ${roll?.formula} with Alice's 1s, rerolling each d6 once with its own dice: ${JSON.stringify(kept(sixes))}, and her d8: ${JSON.stringify(kept(eight))}`)
let gameTotal = sum(sixes.results.slice(2).map(r => r.result)) + 7 + 1
check(roll.total === gameTotal && made.result.rolls?.[0]?.total === gameTotal, `its total, the game's, ${gameTotal}`)
if (MIDI) check(goblin.actor.system.attributes.hp.value === 60 - gameTotal, `Midi applies the game's total to the goblin: ${goblin.actor.system.attributes.hp.value}`)
let shown = await trayShows('Greatsword damage', gameTotal)
check(shown.includes(`At the table: ${gameTotal}`), `the tray shows the game's total, ${gameTotal}, not Alice's ${1 + 1 + 7 + 1}: "${shown}"`)
await shoot(page, 'rolling-gwf-damage')

// ---- 3. At its highest: offered for rerolls of its lowest faces, never for a die that explodes ----
const swordMenu = page.getByRole('menu', { name: `Greatsword damage ${GWF}` })
let held = await longPress(rowChip, swordMenu)
const swordWays = held ? await swordMenu.getByRole('menuitem').allTextContents() : []
check(held && swordWays.includes('Roll maximum damage'), `a long-press on the greatsword's damage offers it at its highest, its rerolls on a 1 or 2 no bar to it: ${JSON.stringify(swordWays)}`)
await closeMenu()
const MAUL = 'Thunder Maul damage, 1d6x + 4'
const maulChip = actionsList.getByRole('button', { name: MAUL, exact: true })
check(await maulChip.isEnabled(), `the maul's damage, ${MAUL}, is a button, enabled`)
const maulMenu = page.getByRole('menu', { name: 'Thunder Maul damage 1d6x + 4' })
held = await longPress(maulChip, maulMenu)
const maulWays = held ? await maulMenu.getByRole('menuitem').allTextContents() : []
check(held && !maulWays.includes('Roll maximum damage') && maulWays.length > 0, `a long-press on it offers no maximum, as its d6 explodes, but its other ways: ${JSON.stringify(maulWays)}`)
await shoot(page, 'rolling-maul-menu')
await closeMenu()
// After an attack, as the game says its damage.
await paced()
await force(15)
await actionsList.getByRole('button', { name: 'Thunder Maul attack, +8' }).click()
const maulPicker = page.getByRole('dialog', { name: 'Thunder Maul attack' })
await maulPicker.waitFor()
;({ request, made } = await sent(() => maulPicker.getByRole('button', { name: /^Goblin/ }).click(), 'the maul attack'))
await unforce()
check(made.result.attack?.outcome === 'hit' && made.result.damage?.rolls?.[0]?.formula === '1d6x + 4', `the maul hits, its damage ${made.result.damage?.rolls?.[0]?.formula}`)
const maulDamage = tray.getByRole('button', { name: 'Roll damage' })
await maulDamage.waitFor({ timeout: 30_000 })
const trayMenu = page.getByRole('menu', { name: 'Thunder Maul damage 1d6x + 4' })
const before = requests()
held = await longPress(maulDamage, trayMenu)
const trayWays = held ? await trayMenu.getByRole('menuitem').allTextContents() : []
check(held && !trayWays.includes('Roll maximum damage') && trayWays.includes('Modify damage…') && requests() === before,
  `nor does the tray's, as the game has it, though it may be changed: ${JSON.stringify(trayWays)}`)
if (held) await closeMenu()
// Its 6 explodes: Foundry throws another, the game's own.
await paced()
await force(20)
;({ request: damage, made } = await sent(() => maulDamage.click(), "the maul's damage"))
await unforce()
roll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
const [boom] = roll?.dice ?? []
check(same(damage.payload.dice, [{ faces: 6, results: [6] }]) && made.status === 'done' && boom?.results[0].result === 6 && boom.results[0].exploded === true && boom.results.length > 1,
  `Alice's 6 is sent alone; the game explodes it with its own: ${JSON.stringify(kept(boom ?? { results: [] }))}`)
gameTotal = sum(boom.results.map(r => r.result)) + 4
await trayShows('Thunder Maul damage', gameTotal)
check(roll.total === gameTotal, `the tray shows the game's total, ${gameTotal}`)

// ---- 4. Its description's [[/damage 2d6r<=2 + 7]] ----
await page.getByRole('tab', { name: 'Inventory' }).click()
const swordItem = panel.locator('li', { has: page.getByRole('button', { name: /^Greatsword/ }) }).first()
await swordItem.getByRole('button', { name: /^Greatsword/ }).first().click()
const swordText = swordItem.locator('.sheet-text')
await swordText.waitFor({ timeout: 15_000 })
const linkNames = await swordText.getByRole('button').evaluateAll(buttons => buttons.map(b => [b.getAttribute('aria-label') ?? b.textContent, !b.disabled]))
const link = swordText.getByRole('button', { name: /^2d6r<=2 \+ 7 Fire/ })
check(await link.count() === 1 && await link.isEnabled(), `its description's damage, with a reroll's comparison, is a button: ${JSON.stringify(linkNames)}`)
await shoot(page, 'rolling-description-link')
await paced()
await force(1)
;({ request, made } = await sent(() => link.click(), "the description's damage"))
await unforce()
const message = madeFor(request.id)
roll = message?.rolls[0]
;[sixes] = roll?.dice ?? []
check(request.kind === 'textDamage' && same(request.payload.dice, [{ faces: 6, results: [1, 1] }]) && made.status === 'done',
  `the phone sends its two d6, each a 1, and nothing more (${JSON.stringify(request.payload)})`)
check(roll?.formula === '2d6r<=2 + 7' && sixes.results.length === 4 && same(kept(sixes).slice(0, 2), [[1, false], [1, false]]) && kept(sixes).slice(2).every(([, counts]) => counts),
  `the game rolls ${roll?.formula} with them, rerolling each with its own: ${JSON.stringify(kept(sixes ?? { results: [] }))}`)
gameTotal = sum(sixes.results.slice(2).map(r => r.result)) + 7
shown = await trayShows('Greatsword damage', gameTotal)
check(roll.total === gameTotal, `the tray shows the game's total, ${gameTotal}: "${shown}"`)
await shoot(page, 'rolling-description-damage')

// ==== #150: Self ====
// ---- 5. In his fight: Self first, the default, made at his own combatant ----
await page.getByRole('tab', { name: 'Actions' }).click()
const potionChip = actionsList.getByRole('button', { name: 'Potion of Healing healing, 2d4 + 2' })
const potionPicker = page.getByRole('dialog', { name: 'Potion of Healing' })
await paced()
await potionChip.click()
await potionPicker.waitFor()
let listed = await potionPicker.getByRole('listitem').allTextContents()
const selfButton = potionPicker.getByRole('button', { name: /^Self/ })
// Since this round, each pill read after a comma, and "No target" a button after the lists.
check(same(listed, ['Self, YouDefault', 'Goblin', 'Ogre']) && await potionPicker.getByRole('button', { name: 'No target' }).isVisible() && (await selfButton.getAttribute('class')).includes('border-primary'),
  `his potion, from Self, lists Self first, marked the default: ${JSON.stringify(listed)}`)
await shoot(page, 'rolling-potion-picker')
const hpBefore = garrus.system.attributes.hp.value
;({ request, made } = await sent(() => selfButton.click(), 'the potion at Self'))
check(request.kind === 'use' && request.payload.item === 'potion' && request.payload.activity === 'drink'
  && same(request.payload.targets, [{ combatId: 'fightA', combatantId: 'cbGarrus' }]) && !('self' in request.payload) && made.status === 'done',
  `in his fight, Self is his own combatant (${JSON.stringify(request.payload)})`)
/** Whom the game made a use at: as its card names them, or with Midi, its workflow's targets. */
const targetsOf = request => (MIDI
  ? [...(midi.made.findLast(workflow => workflow.activity?.item?.id === request.payload.item)?.targets ?? [])].map(t => t.name ?? t.document?.name)
  : useCard(request.id)?.flags.dnd5e.targets?.map(t => t.name))
check(same(targetsOf(request), ['Garrus']), `the game's card targets him: ${JSON.stringify(targetsOf(request))}`)
let healing = await followed(request.id, 'its healing')
check(healing.status === 'done' && healing.payload.dice[0].faces === 4, 'its healing follows, made in the game')
if (MIDI) {
  await until(() => garrus.system.attributes.hp.value > hpBefore, 'Midi to heal Garrus', 15_000)
  check(garrus.system.attributes.hp.value === hpBefore + sum(healing.payload.dice[0].results) + 2, `Midi heals him: ${garrus.system.attributes.hp.value}`)
}

// Shared Shape takes two: Self first, ticked already.
const shapeChip = panel.getByRole('region', { name: 'Bonus Actions', exact: true }).getByRole('button', { name: 'Use Shared Shape' })
const shapePicker = page.getByRole('dialog', { name: 'Shared Shape' })
await paced()
await shapeChip.click()
await shapePicker.waitFor()
const boxes = await shapePicker.getByRole('checkbox').evaluateAll(list => list.map(b => [b.textContent, b.getAttribute('aria-checked')]))
check(same(boxes[0], ['Self, You', 'true']) && boxes.slice(1).every(([, on]) => on === 'false'), `Shared Shape, which takes two, has Self first and ticked already: ${JSON.stringify(boxes)}`)
await shoot(page, 'rolling-shape-picker')
;({ request, made } = await sent(() => shapePicker.getByRole('button', { name: /at 1 target/ }).click(), 'Shared Shape at Self'))
check(request.payload.item === 'shape' && same(request.payload.targets, [{ combatId: 'fightA', combatantId: 'cbGarrus' }]) && made.status === 'done'
  && same(targetsOf(request), ['Garrus']), `made at him, his own combatant, the card targeting him (${JSON.stringify(request.payload)})`)

// An attack from Self never offers Self.
await paced()
await force(15)
await actionsList.getByRole('button', { name: 'Whirlwind attack, +8' }).click()
const whirl = page.getByRole('dialog', { name: 'Whirlwind attack' })
await whirl.waitFor()
const caught = await whirl.getByRole('checkbox').allTextContents()
check(same(caught, ['Goblin', 'Ogre']), `nor does an attack at an area from Self: ${JSON.stringify(caught)}`)
await page.keyboard.press('Escape')
await whirl.waitFor({ state: 'detached' })
await unforce()

// ---- 6. In a fight he isn't in: sent with self ----
game.combats.delete('fightA')
await Hooks.callAll('deleteCombat', fightA)
const fightB = combat('fightB')
combatant(fightB, 'cbVex', vex, { initiative: 14, token: tokens.vex })
combatant(fightB, 'cbGob2', goblin.actor, { name: 'Goblin', initiative: 9, token: goblin.token })
fightB.getCombatantsByActor = actor => fightB.combatants.filter(cb => cb.actor?.id === actor.id)
fightB.started = true
fightB.round = 1
current = fightB
await Hooks.callAll('createCombat', fightB)
await until(() => sql(`select count(*) from combat where "combatId" = 'fightB'`) === '1' && sql('select count(*) from combat') === '1', "the app to hear of Vex's fight", 15_000)
await openSheet()
await page.getByRole('tab', { name: 'Actions' }).click()
await paced()
await potionChip.click()
await potionPicker.waitFor()
listed = await potionPicker.getByRole('listitem').allTextContents()
check(same(listed, ['Self, YouDefault', 'Vex, Ally', 'Goblin']) && await potionPicker.getByRole('button', { name: 'No target' }).isVisible(), `in Vex's fight, which he isn't in, his potion still lists Self first, the default: ${JSON.stringify(listed)}`)
;({ request, made } = await sent(() => potionPicker.getByRole('button', { name: /^Self/ }).click(), 'the potion at Self, out of his fight'))
check(same(request.payload.targets, []) && request.payload.self === true && made.status === 'done',
  `the app sends it with self, and no combatant (${JSON.stringify(request.payload)})`)
check(same(targetsOf(request), ['Garrus']), `the game's card targets him all the same: ${JSON.stringify(targetsOf(request))}`)
healing = await followed(request.id, 'its healing')
check(healing.status === 'done', 'its healing follows')
await paced()
await shapeChip.click()
await shapePicker.waitFor()
await shapePicker.getByRole('checkbox', { name: /^Vex/ }).click()
;({ request, made } = await sent(() => shapePicker.getByRole('button', { name: /at 2 targets/ }).click(), 'Shared Shape at Self and Vex'))
check(same(request.payload.targets, [{ combatId: 'fightB', combatantId: 'cbVex' }]) && request.payload.self === true && made.status === 'done'
  && same([...targetsOf(request)].sort(), ['Garrus', 'Vex']), `Shared Shape at Self and Vex: Vex picked, self besides, the card targeting both (${JSON.stringify(request.payload)}; ${JSON.stringify(targetsOf(request))})`)
await paced()
await force(15)
await swing.click()
await picker.waitFor()
const watchingTargets = await picker.getByRole('listitem').allTextContents()
// An attack lists the others first, then the allies.
check(same(watchingTargets, ['Goblin', 'Vex, Ally']) && await picker.getByRole('button', { name: 'No target' }).isVisible(), `an attack there offers no Self either: ${JSON.stringify(watchingTargets)}`)
await page.keyboard.press('Escape')
await picker.waitFor({ state: 'detached' })
await unforce()

// ---- 7. Out of combat: no one to pick, sent with self ----
game.combats.delete('fightB')
await Hooks.callAll('deleteCombat', fightB)
current = null
await until(() => sql('select count(*) from combat') === '0', 'the fight to end in the app', 15_000)
await openSheet()
await page.getByRole('tab', { name: 'Actions' }).click()
await paced()
;({ request, made } = await sent(() => potionChip.click(), 'the potion out of combat'))
check(await potionPicker.count() === 0 && same(request.payload.targets, []) && request.payload.self === true && made.status === 'done',
  `out of combat, a tap drinks it at once, sent with self (${JSON.stringify(request.payload)})`)
check(same(targetsOf(request), ['Garrus']), `the game's card targets him: ${JSON.stringify(targetsOf(request))}`)
await followed(request.id, 'its healing')
await shoot(page, 'rolling-potion-out-of-combat')

// ---- 8. Self only where the hello says selfTargets ----
const { announce } = await import(`${MODULE}/scripts/bridge.mjs`)
helloBefore022 = true
announce({ campaignId: 'camp-ash' })
await until(() => !features().includes('selfTargets'), 'the app to hear a hello without selfTargets', 15_000)
check(kinds().includes('use'), `a hello without selfTargets, as from a module before 0.22.0: the app keeps uses, and no selfTargets (${features().join(',')})`)
await openSheet()
await page.getByRole('tab', { name: 'Actions' }).click()
await paced()
;({ request, made } = await sent(() => potionChip.click(), 'the potion, before 0.22.0'))
check(same(request.payload.targets, []) && !('self' in request.payload) && made.status === 'done' && same(targetsOf(request) ?? [], []),
  `out of combat, it's sent at no one, without self, as before (${JSON.stringify(request.payload)})`)
await followed(request.id, 'its healing')
const fightC = combat('fightC')
combatant(fightC, 'cbVex3', vex, { initiative: 14, token: tokens.vex })
combatant(fightC, 'cbGob3', goblin.actor, { name: 'Goblin', initiative: 9, token: goblin.token })
fightC.getCombatantsByActor = actor => fightC.combatants.filter(cb => cb.actor?.id === actor.id)
fightC.started = true
fightC.round = 1
current = fightC
await Hooks.callAll('createCombat', fightC)
await until(() => sql('select count(*) from combat') === '1', "the app to hear of Vex's next fight", 15_000)
await openSheet()
await page.getByRole('tab', { name: 'Actions' }).click()
await potionChip.click()
await potionPicker.waitFor()
listed = await potionPicker.getByRole('listitem').allTextContents()
check(same(listed, ['Vex, Ally', 'Goblin']) && await potionPicker.getByRole('button', { name: 'No target' }).isVisible(), `and in a fight he isn't in, no Self is offered: ${JSON.stringify(listed)}`)
await page.keyboard.press('Escape')
await potionPicker.waitFor({ state: 'detached' })
helloBefore022 = false
announce({ campaignId: 'camp-ash' })
await until(() => features().includes('selfTargets'), 'the app to hear selfTargets again', 15_000)
await openSheet()
await page.getByRole('tab', { name: 'Actions' }).click()
await potionChip.click()
await potionPicker.waitFor()
listed = await potionPicker.getByRole('listitem').allTextContents()
check(same(listed, ['Self, YouDefault', 'Vex, Ally', 'Goblin']) && await potionPicker.getByRole('button', { name: 'No target' }).isVisible(), `once the hello says selfTargets again, Self is back: ${JSON.stringify(listed)}`)
await shoot(page, 'rolling-self-again')
await page.keyboard.press('Escape')

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
