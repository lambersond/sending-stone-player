// One damage card (module 0.28.0 and the app), end to end: the real module, in a stand-in Foundry
// with dnd5e 5.3.3's real dice classes (D20Roll, DamageRoll) and its activities ported
// (fvtt/activity5e.mjs), fetches from the production app, from a browser on the game's page. A
// message's damage rolls fold into one damage card in Alice's chat: its formula, a chip for each
// kind of damage, the total, and each roll's dice behind a tap; one roll's dice inline. Corvin, the
// Gamemaster's NPC, stabs Thorin with his dagger, 1d4 + 4 piercing and 2d6 poison, its attack
// skipped: one card, "5 Piercing + 7 Poison = 12". His Mind Lash, one roll of a damage type of the
// world's own, halved on a save. Alice's Rapier from her phone, its attack and its damage; then a
// critical hit, gold on her own bubble; one of her private rolls in Foundry, a whisper, gold and
// dashed; and a Potion of Healing, a Healing card. Every small text it adds is measured against what
// it's drawn on, in both themes, at 390 and 768 pixels.
// MIDI=1 puts the stand-in Midi-QOL workflow in the world (fvtt/midi-fake.mjs), which tags its rolls
// and writes them on its item card as Midi does: Corvin's dagger on Midi's card; his Serpent Fang's
// poison as Midi's other damage, a card of its own; Alice's attack and damage on one card, under one
// header, her Sneak Attack tagged, and her Hunter's Mark, of Midi's type "none", damage of no type
// that Midi counts, in the card's total as in Midi's; and dnd5e's own two-part damage message, one
// card too.
// SKEW=027 with MODULE (or MODULE_DIR) set to module 0.27.0, Midi in the world: that module marks
// no roll, and the app folds by class and damage type alone; Midi's other damage is counted on the
// main card, its bonus untagged, and a type of the world's own named from its key, the known limits.
// Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { mkdirSync } from 'node:fs'
import { combat, combatant, settings, user, users, actors } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

// Module 0.27.0, from before the module marked each roll; under Midi, as its rolls are written.
const SKEW = process.env.SKEW === '027'
const MIDI = !!process.env.MIDI || SKEW
const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const VARIANT = SKEW ? '-skew027' : (MIDI ? '-midi' : '')
const cookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const note = msg => console.log('note -', msg)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(test, what, ms = 30_000) {
  const end = Date.now() + ms
  while (!(await test())) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(100)
  }
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
// Banner mode: the tray's own buttons, Roll damage among them, are read and tapped where the player
// has chosen the banner over toasts; each browser starts with it chosen.
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
  posted.push({ url: String(url), type: sent.type ?? 'fetch', data: sent.data, status, body })
  if (status >= 300) problems.push(`${sent.type ?? url} → ${status}`)
  return {
    ok: status >= 200 && status < 300, status, statusText,
    headers: new Headers(type ? { 'content-type': type } : {}),
    json: async () => JSON.parse(body), text: async () => body,
  }
}

// ---- The Gamemaster sets up the campaign in the app ----
const setupView = await browser.newContext()
await setupView.addCookies([cookie])
const setup = await setupView.newPage()
await setup.goto(`${BASE}/campaigns`)
await setup.getByRole('button', { name: 'New campaign' }).click()
const modal = setup.getByRole('dialog', { name: 'New campaign' })
await modal.getByLabel('Campaign title').fill('Ashlands')
await modal.getByLabel('Forge game address').fill('lonely-mountain.forge-vtt.com')
await modal.getByLabel('Secret', { exact: true }).fill(SECRET)
await modal.getByRole('button', { name: 'Set up campaign' }).click()
await modal.getByRole('button', { name: 'Done' }).click()
await setupView.close()

// ---- Foundry, with dnd5e's dice, items and activities, and Midi-QOL if asked ----
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
CONFIG.DND5E = {
  skills: { prc: { label: 'Perception', ability: 'wis' } },
  tools: {},
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex' },
  spellcasting: { spell: { exclusive: { spells: false, slots: false } } },
  // Psionic is the world's own type, its label nothing the app knows: from module 0.28.0 the chip
  // says it as the game does.
  damageTypes: {
    piercing: { label: 'Piercing' }, poison: { label: 'Poison' }, slashing: { label: 'Slashing' },
    psionic: { label: 'Psionic Energy' },
  },
  healingTypes: { healing: { label: 'Healing' }, temphp: { label: 'Temporary Hit Points', labelShort: 'Temp HP' } },
  activityActivationTypes: { action: { label: 'Action', header: 'Actions' } },
}
// Midi's own types, as it adds them to dnd5e's at init (midi-qol.ts:413-416, 696-697): "none" is
// damage of no type, which it counts and applies (utils.ts:9216-9228); "midi-none" is none at all.
if (MIDI) {
  Object.assign(CONFIG.DND5E.damageTypes, { none: { label: 'No Type' }, 'midi-none': { label: 'No Damage' } })
}
settings.set('messageMode', 'public')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
settings.set('attackRollVisibility', 'all')

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, SaveActivity, DamageActivity, HealActivity, equip } = await import('./fvtt/activity5e.mjs')
const { midi, placeables, installMidi } = await import('./fvtt/midi-fake.mjs')
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
// dnd5e's ChatMessage5e finds the item a message is of (chat-message.mjs:987-994), whose name the
// module sends: Midi's card is labelled "Dagger (Melee)" by it, not by its title.
Hooks.on('preCreateChatMessage', message => {
  Object.getPrototypeOf(message).getAssociatedItem ??= function () {
    const id = this.flags?.dnd5e?.item?.id
    return id ? (this.getAssociatedActor()?.items?.get(id) ?? undefined) : undefined
  }
})

users.activeGM = user('gm', 'Gamemaster', true)
const gmUser = users.get('gm')
gmUser.targets = new Set()
const alice = user('alice', 'Alice')
if (MIDI) installMidi()

// Thorin, Alice's: a rapier, +6 to hit, 1d8 + 3 piercing, and a Potion of Healing, 2d4 + 2.
const thorin = new Actor5e({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 2, con: 2, wis: 1 }, hp: { value: 20, max: 40, temp: 0 } })
thorin.system.details = { level: 5 }
actors.set('thorin', thorin)
alice.character = thorin
equip(thorin, {
  ac: 16,
  items: [{
    id: 'rapier', name: 'Rapier', type: 'weapon',
    system: { properties: ['fin'], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{
      id: 'lunge', damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['piercing'] }],
      labels: { modifier: '+6', damage: [{ formula: '1d8 + 3', damageType: 'piercing', label: '1d8 + 3 Piercing' }] },
    }],
  }, {
    id: 'potion', name: 'Potion of Healing', type: 'consumable', system: { properties: [], quantity: 2 },
    activities: [{ id: 'drink', type: 'heal', affects: 'self', range: 'self', healing: { number: 2, denomination: 4, bonus: '2', types: ['healing'] } }],
  }],
})
// Corvin, the Gamemaster's: his dagger, piercing and poison both its own damage, as the user's was;
// his Serpent Fang, whose poison Midi deals as its other damage; and his Mind Lash, an Intelligence
// save against damage of the world's own type, halved on a save.
const corvin = new Actor5e({ id: 'corvin', name: 'Corvin', mods: { str: 4, dex: 2, int: 3 }, hp: { value: 50, max: 50, temp: 0 } })
corvin.type = 'npc'
actors.set('corvin', corvin)
equip(corvin, {
  ac: 15,
  items: [{
    id: 'dagger', name: 'Dagger (Melee)', type: 'weapon',
    system: { properties: ['fin'], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{
      id: 'stab', name: 'Midi Attack', damage: [
        { number: 1, denomination: 4, bonus: '@mod', types: ['piercing'] },
        { number: 2, denomination: 6, types: ['poison'] },
      ],
    }],
  }, {
    id: 'fang', name: 'Serpent Fang', type: 'weapon',
    system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{ id: 'bite', name: 'Midi Attack', damage: [{ number: 1, denomination: 6, bonus: '@mod', types: ['piercing'] }] }],
  }, {
    id: 'lash', name: 'Mind Lash', type: 'feat', system: { properties: [] },
    activities: [{ id: 'whip', type: 'save', name: 'Lash', save: ['int'], dc: 13, onSave: 'half', damage: [{ number: 2, denomination: 6, types: ['psionic'] }] }],
  }],
})
const goblin = new Actor5e({ id: 'goblin', name: 'Goblin', mods: {}, hp: { value: 60, max: 60, temp: 0 } })
goblin.type = 'npc'
actors.set('goblin', goblin)
equip(goblin, { ac: 13 })
// The tokens on the Gamemaster's canvas, each its actor's speaker, as Foundry finds one on the scene.
const place = actor => {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false, isLinked: true }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  placeables.set(token.id, placeable)
  actor.speakerToken = placeable
  return placeable
}
const tokens = { thorin: place(thorin), corvin: place(corvin), goblin: place(goblin) }
if (MIDI) canvas.scene.tokens.size = placeables.size

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
// Targets' armor class to players, so that a hit or a miss is shown.
settings.set('gmContent', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'], rolls: true, attacks: true }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const kinds = () => sql(`select array_to_string("rollKinds", ',') from campaign where title = 'Ashlands'`)
await until(() => kinds().includes('attack'), 'the app to hear the game takes attacks', 15_000)
check(kinds().split(',').includes('damage'), `the app keeps that the game takes players' attacks and their damage (${kinds()})`)

// A fight: Corvin, Thorin and a goblin.
const fight = combat('fight1')
combatant(fight, 'cbCorvin', corvin, { name: 'Corvin', initiative: 18, token: tokens.corvin.document })
combatant(fight, 'cbThorin', thorin, { initiative: 15, token: tokens.thorin.document })
combatant(fight, 'cbGoblin', goblin, { name: 'Goblin', initiative: 9, token: tokens.goblin.document })
fight.getCombatantsByActor = actor => fight.combatants.filter(cb => cb.actor?.id === actor.id)
fight.started = true
fight.round = 1
fight.turn = 0
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight1'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// Alice plays Thorin.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'sheet-thorin', 'Thorin', '${GAME}', 'Ashlands', id, 'thorin', 'e2e-user', now() from campaign where title = 'Ashlands'`)

// ---- What the module told the app, and what the app keeps ----
/** The message as the module last told the app of it, created or updated. */
const toldOf = id => posted.filter(p => ['chat.message.created', 'chat.message.updated'].includes(p.type) && (p.data?.message?.id === id)).at(-1)?.data
/** A message's rolls as the app stored them, or null before it has the message. */
const storedRolls = id => JSON.parse(sql(`select coalesce((data->'rolls')::text, 'null') from chat_message where "messageId" = '${id}'`) || 'null')
const MARKS = ['damage', 'damageLabel', 'section', 'flavor', 'attack']
const marksOf = roll => Object.fromEntries(MARKS.filter(mark => Object.hasOwn(roll, mark)).map(mark => [mark, roll[mark]]))
const latestRequest = () => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, "useId", result from roll_request order by "createdAt" desc limit 1) r`) || 'null')
const requests = () => Number(sql('select count(*) from roll_request'))
const useCard = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.use === id)
const madeFor = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const latestMessage = () => game.messages.contents.at(-1)
/** Each die of a roll as it came up, as the app lists it. */
const diceOf = roll => roll.dice.flatMap(die => die.results.map(result => String(result.result)))

// ---- Alice's phone and tablet ----
async function browse({ width, height, scheme }) {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, colorScheme: scheme })
  await view.addCookies([cookie])
  await view.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  await page.goto(`${BASE}/characters/sheet-thorin`)
  await page.getByRole('tablist', { name: 'Character sheet' }).waitFor()
  const nav = page.getByRole('navigation', { name: 'Table' })
  return {
    width, view, page, nav, scheme,
    log: page.getByRole('list', { name: 'Chat log' }),
    tray: page.getByRole('region', { name: 'Your rolls' }),
    chat: () => nav.getByRole('button', { name: /^Chat/ }).click(),
    sheet: () => nav.getByRole('button', { name: /^Character/ }).click(),
  }
}
const phone = await browse({ width: 390, height: 844, scheme: 'light' })
const tablet = await browse({ width: 768, height: 1024, scheme: 'dark' })
await phone.chat()
await tablet.chat()

/**
 * The newest message in the chat with this text, by its place in the log, which a later message
 * doesn't change; once it has a card of damage, or this many.
 */
async function messageWith(who, text, { cards = 1, after = 0 } = {}) {
  const items = who.log.locator(':scope > li')
  let index = -1
  await until(async () => {
    index = await items.evaluateAll((lis, text) => lis.map(li => li.textContent).findLastIndex(t => t.includes(text)), text)
    return (index >= after) && (await items.nth(index).locator(DAMAGE_CARD).count() >= cards)
  }, `"${text}" in the chat at ${who.width} px with ${cards} damage card(s)`)
  return items.nth(index)
}
// A damage card, its edge the action's: Damage's, or Healing's; a roll's own card, any card.
const DAMAGE_CARD = 'div.border-l-damage, div.border-l-primary'
const CARD = 'div.max-w-sm'
const chipsOf = card => card.locator('span.items-baseline.rounded-full').allTextContents()
const totalOf = async card => (await card.locator('span.text-3xl').count()) ? (await card.locator('span.text-3xl').textContent()).replace(/^\s*=\s*/, '').trim() : null
const classesOf = locator => locator.evaluate(el => [...el.classList])
/** An open card's rolls, as listed: each one's tag, formula, dice and what it came to. */
const rowsOf = card => card.locator('ul[aria-label="Rolls"] > li').evaluateAll(lis => lis.map(li => {
  const [left, right] = li.children
  return {
    tag: [...left.children].find(child => (child.tagName === 'SPAN') && !child.classList.contains('font-mono'))?.textContent ?? null,
    formula: left.querySelector('.font-mono').textContent,
    dice: [...left.querySelectorAll('ul[aria-label="Dice"] > li')].map(die => die.textContent),
    total: right.textContent,
  }
}))
/** The newest message in the chat that has this in it, once there is one. */
async function lastItem(who, has, what) {
  const items = who.log.locator(':scope > li').filter({ has })
  await until(async () => await items.count() > 0, `${what} in the chat at ${who.width} px`)
  return items.nth(await items.count() - 1)
}
const open = async card => {
  if (await card.locator('details').getAttribute('open') === null) await card.locator('summary').click()
  await card.locator('ul[aria-label="Rolls"]').waitFor()
}
const isDark = page => page.evaluate(() => document.documentElement.classList.contains('dark'))
async function theme(who, scheme) {
  await who.page.emulateMedia({ colorScheme: scheme })
  await until(async () => (await isDark(who.page)) === (scheme === 'dark'), `the ${scheme} theme at ${who.width} px`, 10_000)
}
async function shoot(who, locator, name) {
  if (!SHOTS) return
  await locator.scrollIntoViewIfNeeded()
  await who.page.waitForTimeout(350)
  // The app's 3D dice, still lying where the last throw left them, would hide the card.
  await locator.screenshot({ path: `${SHOTS}/${name}-${who.width}-${who.scheme}${VARIANT}.png`, style: '[id^=dice-canvas-threejs] { visibility: hidden !important; }' })
}
/** Each card shot in both themes, at the phone's and the tablet's width. */
async function shootAll(name, text, cards = 1, then = async () => {}) {
  if (!SHOTS) return
  for (const who of [phone, tablet]) {
    const scheme = who.scheme
    for (const each of [scheme, scheme === 'light' ? 'dark' : 'light']) {
      await theme(who, each)
      who.scheme = each
      const item = await messageWith(who, text, { cards })
      await then(who, item)
      await shoot(who, item, name)
    }
    await theme(who, scheme)
    who.scheme = scheme
  }
}

/**
 * WCAG contrast of an element's text against what it's drawn on: its own background and its
 * ancestors', blended over the first opaque one, as the browser paints them.
 */
const contrastOf = locator => locator.evaluate(async el => {
  await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming?.().iterations !== Infinity).map(a => a.finished.catch(() => {})))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const paint = css => {
    ctx.fillStyle = '#010203'
    ctx.fillStyle = css
    if ((ctx.fillStyle === '#010203') && !/^#010203$/i.test(css)) throw new Error(`The canvas can't paint ${css}`)
    ctx.fillRect(0, 0, 1, 1)
  }
  const layers = []
  for (let node = el; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor
    layers.push(color)
    ctx.clearRect(0, 0, 1, 1)
    paint(color)
    if (ctx.getImageData(0, 0, 1, 1).data[3] === 255) break
  }
  ctx.clearRect(0, 0, 1, 1)
  paint(getComputedStyle(document.body).backgroundColor)
  for (const color of layers.reverse()) paint(color)
  const bg = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
  paint(getComputedStyle(el).color)
  const fg = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
  const lum = rgb => {
    const [r, g, b] = rgb.map(v => v / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
})
/** What's measured, in each theme: [what, locator, the least it needs]. */
const measured = []
const measure = (what, locator, least = 4.5, opened) => measured.push({ what, locator, least, opened })

// ---- Corvin's dagger: piercing and poison, its attack skipped ----
gmUser.targets = new Set([tokens.thorin])
const dagger = corvin.items.get('dagger').system.activities.get('stab')
let corvinCard
if (MIDI) {
  // Midi's item card first, with no roll; then the Gamemaster rolls its damage with the attack
  // skipped, as Corvin's was, and Midi writes the damage on the card.
  const used = await dagger.use({}, { configure: false }, {})
  corvinCard = used.message
  const workflow = midi.made.at(-1)
  await until(() => storedRolls(corvinCard.id) !== null, "Midi's card in the app")
  check(storedRolls(corvinCard.id).length === 0 && corvinCard.type === 'usage', "Midi posts Corvin's dagger as its item card, with no roll yet")
  workflow.currentAction = workflow.WorkflowState_WaitForDamageRoll
  await workflow.activity.rollDamage(
    { workflow, midiOptions: { ...workflow.rollOptions, isCritical: false, fastForwardDamage: true, workflowOptions: workflow.workflowOptions } },
    { configure: false }, { create: false },
  )
  await until(() => storedRolls(corvinCard.id)?.length === 2, "the dagger's damage on Midi's card, in the app")
  // The app can store both rolls before the module's update post reaches this list; wait for it too.
  await until(() => toldOf(corvinCard.id)?.changes?.includes('rolls'), "the module's update post for the dagger's damage")
  const told = toldOf(corvinCard.id)
  check(told.changes?.includes('rolls') && same(told.message.rolls.map(roll => [roll.class, roll.damageType]), [['DamageRoll', 'piercing'], ['DamageRoll', 'poison']]),
    `Midi writes its damage on the card, and the module sends the card again with both rolls, piercing then poison (${JSON.stringify(told.changes)})`)
  if (SKEW) {
    check(told.message.rolls.every(roll => same(marksOf(roll), {})), 'module 0.27.0 marks neither roll: no damage, label or section')
  } else {
    check(same(storedRolls(corvinCard.id).map(marksOf), [
      { damage: true, damageLabel: 'Piercing', section: 'damage' },
      { damage: true, damageLabel: 'Poison', section: 'damage' },
    ]), "module 0.28.0 marks each as damage, with its label and Midi's section for the item's own damage, as the app keeps them")
  }
} else {
  // dnd5e names the Gamemaster's targets on its damage message (mixin.mjs:136-142).
  await dagger.rollDamage({}, { configure: false }, { data: { flags: { dnd5e: { targets: [{ name: 'Thorin', uuid: 'Actor.thorin', ac: 16 }] } } } })
  corvinCard = latestMessage()
  await until(() => storedRolls(corvinCard.id)?.length === 2, "the dagger's damage in the app")
  check(same(storedRolls(corvinCard.id).map(roll => [roll.damageType, marksOf(roll)]), [
    ['piercing', { damage: true, damageLabel: 'Piercing' }],
    ['poison', { damage: true, damageLabel: 'Poison' }],
  ]), "dnd5e's damage message of two parts, piercing then poison, each marked damage with its label")
}
const [pierce, venom] = corvinCard.rolls
const corvinText = `1d4 + 4 + 2d6, ${pierce.total} Piercing + ${venom.total} Poison = ${pierce.total + venom.total}`
for (const who of [phone, tablet]) {
  const item = await messageWith(who, 'Dagger (Melee)')
  const card = item.locator(DAMAGE_CARD)
  check(await item.locator(CARD).count() === 1 && await card.count() === 1
    && await card.getByText('Damage', { exact: true }).isVisible() && await card.getByText('Dagger (Melee)', { exact: true }).isVisible()
    && !(await item.textContent()).includes('Midi Attack'),
    `at ${who.width} px, Corvin's stab is one card, marked Damage and labelled "Dagger (Melee)" alone`)
  const summary = card.locator('summary')
  check(await summary.textContent() === corvinText && same(await chipsOf(card), [`${pierce.total} Piercing`, `${venom.total} Poison`]) && await totalOf(card) === String(pierce.total + venom.total),
    `its formula, a chip for each kind and their total: "${await summary.textContent()}"`)
  check(await card.locator('details').getAttribute('open') === null && await card.locator('ul[aria-label="Dice"], ul[aria-label="Rolls"]').count() === 0
    && await item.getByText('Thorin', { exact: true }).count() === 1,
    'closed, it shows no dice; it names its target, Thorin, once')
  await summary.click()
  const rows = card.locator('ul[aria-label="Rolls"] > li')
  await rows.first().waitFor()
  const listed = await rowsOf(card)
  check(await card.locator('details').getAttribute('open') !== null && same(listed, [
    { tag: null, formula: '1d4 + 4', dice: diceOf(pierce), total: `${pierce.total} Piercing` },
    { tag: null, formula: '2d6', dice: diceOf(venom), total: `${venom.total} Poison` },
  ]), `tapped, it opens on each roll, its formula, its dice and what it came to: ${JSON.stringify(listed)}`)
  if (who === phone) check(await who.page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth) <= 0, 'opened, it fits the phone, nothing scrolling sideways')
  await summary.click()
  await rows.first().waitFor({ state: 'detached' })
  check(await card.locator('details').getAttribute('open') === null, 'tapped again, it closes')
  if (who === phone) {
    measure('Corvin: Damage chip', card.locator('span.uppercase').filter({ hasText: 'Damage' }))
    measure('Corvin: chip word', card.locator('span.items-baseline.rounded-full > span').filter({ hasText: 'Poison' }))
    measure('Corvin: chip number', card.locator('span.items-baseline.rounded-full > span.font-bold').first())
    measure('Corvin: formula', card.locator('summary .font-mono'))
    measure('Corvin: total', card.locator('span.text-3xl'), 3)
  }
}
await shootAll('corvin-open', 'Dagger (Melee)', 1, (who, item) => open(item.locator(DAMAGE_CARD)))
for (const who of [phone, tablet]) {
  const card = (await messageWith(who, 'Dagger (Melee)')).locator(DAMAGE_CARD)
  if (await card.locator('details').getAttribute('open') !== null) await card.locator('summary').click()
}
await shootAll('corvin-closed', 'Dagger (Melee)')

// ---- Mind Lash: one roll, of the world's own type, halved on a save ----
gmUser.targets = new Set([tokens.thorin])
await corvin.items.get('lash').system.activities.get('whip').rollDamage({}, { configure: false })
const lash = latestMessage()
await until(() => storedRolls(lash.id)?.length === 1, 'the Mind Lash in the app')
const lashRoll = lash.rolls[0]
check(lash.flags.dnd5e.roll.damageOnSave === 'half', "dnd5e records that a save halves it")
const lashWord = SKEW ? 'Psionic' : 'Psionic Energy'
{
  const item = await messageWith(phone, 'Mind Lash')
  const card = item.locator(DAMAGE_CARD)
  check(await card.locator('summary, details').count() === 0 && same(await card.locator('ul[aria-label="Dice"] > li').allTextContents(), diceOf(lashRoll)),
    `one roll on the card: no summary to tap, its dice inline, ${JSON.stringify(diceOf(lashRoll))}`)
  check(same(await chipsOf(card), [`${lashRoll.total} ${lashWord}`]) && await totalOf(card) === String(lashRoll.total),
    SKEW ? `with module 0.27.0, which sends no label, its chip names the world's own type from its key: "${lashRoll.total} Psionic"`
      : `its chip names the world's own type as the game does: "${lashRoll.total} Psionic Energy"`)
  check(await card.getByText('Half damage on a save', { exact: true }).isVisible(), 'and it says a save halves it')
  measure('Mind Lash: save line', card.getByText('Half damage on a save', { exact: true }))
}
await shootAll('single-roll', 'Mind Lash')

// ---- Midi's other damage, a card of its own ----
if (MIDI) {
  midi.otherDamage = [{ formula: '2d6', type: 'poison' }]
  const used = await corvin.items.get('fang').system.activities.get('bite').use({}, { configure: false }, {})
  const fangCard = used.message
  const workflow = midi.made.at(-1)
  await until(() => storedRolls(fangCard.id) !== null, "Midi's Serpent Fang card in the app")
  workflow.currentAction = workflow.WorkflowState_WaitForDamageRoll
  await workflow.activity.rollDamage(
    { workflow, midiOptions: { ...workflow.rollOptions, isCritical: false, fastForwardDamage: true, workflowOptions: workflow.workflowOptions } },
    { configure: false }, { create: false },
  )
  midi.otherDamage = null
  await until(() => storedRolls(fangCard.id)?.length === 2, "the fang's damage and its other damage in the app")
  const [bite, poison] = fangCard.rolls
  check(poison.options['midi-qol'].rollType === 'otherDamage' && (SKEW ? !('section' in storedRolls(fangCard.id)[1]) : storedRolls(fangCard.id)[1].section === 'other'),
    SKEW ? "Midi's other damage reaches the app with module 0.27.0 unmarked" : "Midi's other damage reaches the app marked as such")
  const item = await messageWith(phone, 'Serpent Fang', { cards: SKEW ? 1 : 2 })
  const cards = item.locator(DAMAGE_CARD)
  if (SKEW) {
    check(await cards.count() === 1 && same(await chipsOf(cards), [`${bite.total} Piercing`, `${poison.total} Poison`]) && await totalOf(cards) === String(bite.total + poison.total)
      && await item.getByText('Other damage').count() === 0,
      `with module 0.27.0 the other damage is counted on the main card, the known limit: ${bite.total} + ${poison.total}`)
  } else {
    const [main, other] = [cards.nth(0), cards.nth(1)]
    check(await cards.count() === 2 && same(await chipsOf(main), [`${bite.total} Piercing`]) && await totalOf(main) === String(bite.total)
      && await main.getByText('Other damage').count() === 0,
      `the fang's own damage is the main card: ${bite.total} Piercing`)
    check(await other.getByText('Other damage', { exact: true }).isVisible() && same(await chipsOf(other), [`${poison.total} Poison`]) && await totalOf(other) === String(poison.total)
      && same(await other.locator('ul[aria-label="Dice"] > li').allTextContents(), diceOf(poison)),
      `its poison is a card of its own below it, captioned "Other damage", ${poison.total} Poison, its dice inline`)
    check(await main.getByText('Thorin', { exact: true }).count() === 1 && await other.getByText('Thorin', { exact: true }).count() === 0
      && await main.getByText('Serpent Fang', { exact: true }).isVisible() && await other.getByText('Serpent Fang', { exact: true }).isVisible(),
      'its target is named once, on the main card; with no attack card above, both cards name the item')
    measure('Other damage caption', other.getByText('Other damage', { exact: true }))
  }
  await shootAll('other-damage', 'Serpent Fang', SKEW ? 1 : 2)

  // dnd5e's own message of the dagger's two parts, Midi or not: one card.
  const after = await phone.log.locator(':scope > li').count()
  await dagger.rollDamage({}, { configure: false })
  const plain = latestMessage()
  await until(() => storedRolls(plain.id)?.length === 2, "dnd5e's own dagger damage in the app")
  const plainItem = await messageWith(phone, 'Dagger (Melee)', { after })
  const plainCard = plainItem.locator(DAMAGE_CARD)
  check(plain.flags.dnd5e.roll.type === 'damage' && await plainItem.locator(CARD).count() === 1
    && await plainCard.locator('summary').textContent() === `1d4 + 4 + 2d6, ${plain.rolls[0].total} Piercing + ${plain.rolls[1].total} Poison = ${plain.rolls[0].total + plain.rolls[1].total}`,
    "dnd5e's own damage message of the dagger's two parts is one card too")
}

// ---- Alice's rapier, from her phone: its attack and its damage ----
await phone.sheet()
await phone.page.getByRole('tab', { name: 'Actions' }).click()
const panel = phone.page.getByRole('tabpanel')
const lunge = panel.getByRole('button', { name: 'Rapier attack, +6' })
await lunge.waitFor()
const picker = phone.page.getByRole('dialog', { name: 'Rapier attack' })
const forceD20 = value => phone.page.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, value)
const unforce = () => phone.page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
/** Send what a tap rolls, and wait until the game has made it. */
async function sent(tap, what) {
  const before = requests()
  await tap()
  await until(() => requests() > before, `${what} to be sent`)
  const request = latestRequest()
  await until(() => ['done', 'failed'].includes(latestRequest().status), `${what} to be made`)
  return { request, made: latestRequest() }
}
gmUser.targets = new Set()
await forceD20(15)
await lunge.click()
await picker.waitFor()
let { request, made } = await sent(() => picker.getByRole('button', { name: /^Goblin/ }).click(), 'the attack')
await unforce()
check(made.status === 'done' && made.result.attack?.outcome === 'hit', `the rapier hits the goblin, 15 + 6 against AC 13 (${JSON.stringify(made.result.attack)})`)
const lungeId = request.id
// Her Sneak Attack, piercing; and her Hunter's Mark, whose macro names no damage type, which Midi
// makes its type "none" (utils.ts:28-29, Workflow.ts:4077-4078): damage of no type, which Midi
// counts in its card's total and applies.
if (MIDI) midi.bonusDamage = [{ formula: '2d6', type: 'piercing', flavor: 'Sneak Attack' }, { formula: '1d6', type: 'none', flavor: "Hunter's Mark" }]
;({ request, made } = await sent(() => phone.tray.getByRole('button', { name: 'Roll damage' }).click(), 'the damage'))
midi.bonusDamage = null
check(made.status === 'done' && request.useId === lungeId, 'its damage, from the tray, is made in the game')
let hitCard, base, bonus, mark, midiTotal
if (MIDI) {
  hitCard = useCard(lungeId)
  await until(() => storedRolls(hitCard.id)?.length === 4, "the attack, its damage, its Sneak Attack and its Hunter's Mark on Midi's card, in the app")
  ;[, base, bonus, mark] = hitCard.rolls
  check(same(hitCard.rolls.map(roll => [roll.options['midi-qol']?.rollType, roll.options.type]),
    [['attack', undefined], ['defaultDamage', 'piercing'], ['bonusDamage', 'piercing'], ['bonusDamage', 'none']]),
    "Midi's card holds the attack, then the rapier's damage, then the Sneak Attack, then the Hunter's Mark, of no type")
  // Midi's own total for its card, as its sumRolls adds damage up: all but its damage of none at all.
  const workflow = midi.made.find(made => made.chatCard?.id === hitCard.id)
  midiTotal = [...workflow.damageRolls, ...workflow.bonusDamageRolls].reduce((total, roll) => (roll.options.type === 'midi-none') ? total : total + roll.total, 0)
  // The known gap: the tray's total is the damage the app asked for, Midi's base damage alone.
  await phone.tray.getByRole('status').getByText(/At the table/).waitFor({ timeout: 30_000 })
  note(`the tray says "${await phone.tray.getByRole('status').textContent()}"; the card's total, with the bonus damage, is ${midiTotal}`)
} else {
  hitCard = madeFor(request.id)
  await until(() => storedRolls(hitCard.id)?.length === 1, "dnd5e's damage message in the app")
  base = hitCard.rolls[0]
}
await phone.chat()
{
  const item = await messageWith(phone, 'Rapier')
  const card = item.locator(DAMAGE_CARD)
  const attackCard = item.locator('div.border-l-attack')
  if (MIDI) {
    const pierced = base.total + bonus.total
    check(await item.locator('article header').count() === 1 && await item.locator(CARD).count() === 2 && await attackCard.count() === 1 && await card.count() === 1
      && await attackCard.evaluate((el, damage) => el.compareDocumentPosition(damage) === Node.DOCUMENT_POSITION_FOLLOWING, await card.elementHandle()),
      'the attack and its damage are one message under one header: the attack card, then the damage card below it')
    check(await attackCard.getByText('Attack', { exact: true }).isVisible() && await attackCard.getByText('Hit', { exact: true }).isVisible()
      && await attackCard.getByText('Goblin', { exact: true }).isVisible() && (await attackCard.textContent()).includes('21'),
      SKEW ? "with module 0.27.0, the attack is found as the card's D20Roll: marked Attack, a hit on the goblin, 21"
        : 'the attack, marked so by the module, is marked Attack: a hit on the goblin, 21')
    check(await card.getByText('Damage', { exact: true }).isVisible() && await card.getByText('Rapier', { exact: true }).count() === 0
      && await attackCard.getByText('Rapier', { exact: true }).isVisible() && await card.getByText('Goblin').count() === 0,
      "the damage card is marked Damage, and doesn't name the rapier or the goblin again under its attack's card")
    check(await card.locator('summary').textContent() === `1d8 + 3 + 2d6 + 1d6, ${pierced} Piercing + ${mark.total} No Type = ${pierced + mark.total}`,
      `the Sneak Attack's piercing is added to the rapier's, and the Hunter's Mark is damage of no type: "${await card.locator('summary').textContent()}"`)
    check(await totalOf(card) === String(midiTotal),
      `the card's total is Midi's own for its card, ${midiTotal}, the Hunter's Mark of no type counted, as Midi counts and applies it`)
    await open(card)
    const listed = await rowsOf(card)
    check(same(listed, [
      { tag: null, formula: '1d8 + 3', dice: diceOf(base), total: `${base.total} Piercing` },
      { tag: SKEW ? null : 'Sneak Attack', formula: '2d6', dice: diceOf(bonus), total: `${bonus.total} Piercing` },
      { tag: SKEW ? null : "Hunter's Mark", formula: '1d6', dice: diceOf(mark), total: `${mark.total} No Type` },
    ]), SKEW ? `with module 0.27.0, the bonus rolls are listed, untagged: ${JSON.stringify(listed)}` : `opened, each bonus roll is tagged with its name: ${JSON.stringify(listed)}`)
    if (!SKEW) measure('Sneak Attack tag', card.locator('ul[aria-label="Rolls"] > li').nth(1).getByText('Sneak Attack', { exact: true }), 4.5, card)
  } else {
    check(await card.count() === 1 && await item.locator(CARD).count() === 1 && same(await chipsOf(card), [`${base.total} Piercing`])
      && await card.getByText('Rapier', { exact: true }).isVisible() && await card.getByText('Goblin', { exact: true }).isVisible()
      && same(await card.locator('ul[aria-label="Dice"] > li').allTextContents(), diceOf(base)),
      `dnd5e's damage message is one card: "${base.total} Piercing", its dice inline, against the attack's target`)
    const attackItem = await lastItem(phone, phone.page.locator('div.border-l-attack'), 'the attack')
    check(await attackItem.getByText('Hit', { exact: true }).isVisible() && await attackItem.locator(DAMAGE_CARD).count() === 0, "its attack is dnd5e's message of its own, a hit, with no damage on it")
  }
  measure('Own: Damage chip', card.locator('span.uppercase').filter({ hasText: 'Damage' }))
  measure('Own: chip word', card.locator('span.items-baseline.rounded-full > span').filter({ hasText: 'Piercing' }))
  measure('Own: total', card.locator('span.text-3xl'), 3)
  if (MIDI) {
    measure('Own: Attack chip', attackCard.locator('span.uppercase').filter({ hasText: 'Attack' }))
    measure('Own: Hit pill', attackCard.getByText('Hit', { exact: true }))
  }
}
if (MIDI) await shootAll('attack-and-damage', 'Rapier', 1, (who, item) => open(item.locator(DAMAGE_CARD)))

// ---- A critical hit: gold, on Alice's own bubble ----
await phone.sheet()
await phone.page.getByRole('tab', { name: 'Actions' }).click()
await forceD20(20)
await lunge.click()
await picker.waitFor()
;({ request, made } = await sent(() => picker.getByRole('button', { name: /^Goblin/ }).click(), 'the critical hit'))
await unforce()
check(made.result.attack?.critical === true, 'a natural 20 is a critical hit')
const critId = request.id
;({ request, made } = await sent(() => phone.tray.getByRole('button', { name: 'Roll critical damage' }).click(), 'the critical damage'))
const critMessage = MIDI ? useCard(critId) : madeFor(request.id)
await until(() => storedRolls(critMessage.id)?.length === (MIDI ? 2 : 1), 'the critical damage in the app')
const critRoll = critMessage.rolls.at(-1)
check(critRoll.isCritical === true && storedRolls(critMessage.id).at(-1).critical === true, `the game rolls it critical: ${critRoll.formula} = ${critRoll.total}`)
await phone.chat()
/** The colours a card's edges are drawn in, and their style. */
const edgesOf = card => card.evaluate(el => {
  const style = getComputedStyle(el)
  return { top: style.borderTopColor, left: style.borderLeftColor, style: style.borderTopStyle }
})
const goldOf = card => card.getByText('Critical', { exact: true }).evaluate(el => getComputedStyle(el).backgroundColor)
{
  const item = await lastItem(phone, phone.page.locator(DAMAGE_CARD).filter({ hasText: 'Critical' }), 'the critical damage')
  const card = item.locator(DAMAGE_CARD)
  const classes = await classesOf(card)
  const edges = await edgesOf(card)
  check(await item.locator('article').getAttribute('data-side') === 'me' && classes.includes('border-gold') && !classes.includes('border-primary/30')
    && edges.top === await goldOf(card) && edges.left !== edges.top,
    `on Alice's own bubble the critical damage card is edged in gold, its left edge still Damage's (${JSON.stringify(edges)})`)
  check(await card.getByText('Critical', { exact: true }).isVisible() && (await classesOf(card.locator('span.text-3xl'))).includes('text-gold-text')
    && await totalOf(card) === String(critRoll.total),
    `with the Critical badge and its total in gold, ${critRoll.total}`)
  measure('Own critical: total', card.locator('span.text-3xl'), 3)
  measure('Own critical: chip word', card.locator('span.items-baseline.rounded-full > span').filter({ hasText: 'Piercing' }))
  if (MIDI) {
    const attackCard = item.locator('div.border-l-attack')
    check((await classesOf(attackCard)).includes('border-gold') && !(await classesOf(attackCard)).includes('border-primary/30'), 'and so is its attack, above it on the card')
  }
}
await shootAll('critical-own', 'Critical')

// ---- One of Alice's private rolls in Foundry: a whisper, gold and dashed ----
await thorin.items.get('rapier').system.activities.get('lunge').rollDamage({ isCritical: true }, { configure: false }, { rollMode: 'gmroll', data: { author: 'alice' } })
const secret = latestMessage()
await until(() => storedRolls(secret.id)?.length === 1, 'the whisper in the app')
check(same(secret.whisper, ['gm']) && secret.author.id === 'alice' && secret.rolls[0].isCritical === true, "Alice's private critical damage, whispered to the Gamemaster, which she sees too")
{
  const item = await lastItem(phone, phone.page.getByText('Whisper', { exact: true }), 'the whisper')
  const card = item.locator(DAMAGE_CARD)
  const classes = await classesOf(card)
  const edges = await edgesOf(card)
  check(classes.includes('border-gold') && classes.includes('border-dashed') && !classes.includes('border-whisper/60') && !classes.includes('border-solid')
    && edges.top === await goldOf(card) && edges.style === 'dashed',
    `a critical whisper's card is edged in gold, dashed as a whisper's (${JSON.stringify(edges)})`)
  measure('Whisper critical: total', card.locator('span.text-3xl'), 3)
  measure('Whisper: chip word', card.locator('span.items-baseline.rounded-full > span').filter({ hasText: 'Piercing' }))
}
await shootAll('critical-whisper', 'Whisper')

// ---- A Potion of Healing ----
await thorin.items.get('potion').system.activities.get('drink').rollDamage({}, { configure: false })
const potion = latestMessage()
await until(() => storedRolls(potion.id)?.length === 1, 'the healing in the app')
{
  const healed = potion.rolls[0]
  const item = await messageWith(phone, 'Potion of Healing')
  const card = item.locator(DAMAGE_CARD)
  const chip = card.locator('span.items-baseline.rounded-full')
  check((await classesOf(card)).includes('border-l-primary') && await card.getByText('Healing', { exact: true }).first().isVisible()
    && same(await chipsOf(card), [`${healed.total} Healing`]) && await totalOf(card) === String(healed.total)
    && (await classesOf(chip)).includes('bg-primary/10') && (await classesOf(chip.locator('span').last())).includes('text-primary-text'),
    `the potion is a Healing card, edged as healing, its chip "${healed.total} Healing" in healing's tone, not damage's`)
  measure('Own: Healing chip', card.locator('span.uppercase').filter({ hasText: 'Healing' }))
  measure('Own: healing word', chip.locator('span').last())
}
await shootAll('healing', 'Potion of Healing')

// ---- Every small text drawn, in both themes ----
for (const scheme of ['light', 'dark']) {
  await theme(phone, scheme)
  const results = []
  for (const { what, locator, least, opened } of measured) {
    if (opened) await open(opened)
    await locator.first().waitFor()
    results.push({ what, ratio: await contrastOf(locator.first()), least })
  }
  const low = results.filter(r => r.ratio < r.least)
  console.log(scheme, JSON.stringify(results.map(r => `${r.what}: ${r.ratio}`)))
  check(results.length === measured.length && results.length >= 10 && low.length === 0, `in the ${scheme} theme, ${results.length} texts measured, every small one at least 4.5:1 and every total at least 3:1 on what it's drawn on${low.length ? `: ${JSON.stringify(low)}` : ''}`)
}
await theme(phone, 'light')

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
