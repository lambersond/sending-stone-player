// Midi-QOL's own saves asked in the app (module 0.27.0), end to end: the real module, in a stand-in
// Foundry with dnd5e 5.3.3's real dice classes, dnd5e's actors, concentration and activities
// ported, and Midi's workflow (fvtt/midi-fake.mjs) with its saves on it (fvtt/midi-saves.mjs:
// checkSaves, its branches, concentration in both modes and OverTime turn saves, modelled on
// Midi's source), fetches from the production app, from a browser on the game's page. Alice runs
// "Ashlands" and plays Thorin, a fighter in a fight with a goblin shaman. While Thorin's page isn't
// open, Midi rolls his saves as it's set up and nobody is asked. Once his phone has it open, the
// goblin's Hold Person asks him on the phone, Midi waiting: answered with his d20, Midi's verdict is
// his; with the advantage Midi gives him, both his d20s; unanswered, with the wait shortened to five
// seconds, "Midi is rolling…", then "Midi rolled it", Midi's own way taken once. With Alice in
// Foundry too, asked in Midi's chat request: "Answer here or in Foundry", a roll in Foundry first
// closing it as "Rolled in Foundry", and the wait over, "Left to Foundry". On her tablet, a save of
// two abilities, and his concentration in Midi's chat mode (its card held, so Midi's Gamemaster
// doesn't roll it) and in its item mode. OverTime turn saves: a Wisdom save at the end of his turn,
// and an Athletics or Acrobatics check to escape at its start, Midi's workflow removing the effect.
// The Gamemaster answers one from her own page at his sheet. Thorin's Fireball from the app, with
// himself caught in it, asks him for his save while his own spell waits on it. An aborted workflow's
// prompt goes quietly; a hello while one waits keeps it. With only the Gamemaster's page at his
// sheet, he isn't open, and Midi rolls at once. The green text this round fixed is measured against
// what it's drawn on, in both themes. At 390 and 768 pixels.
// SKEW=026 with MODULE (or MODULE_DIR) set to module 0.26.0: that module asks the app nothing of
// Midi's saves, whatever the app says is open, and Midi rolls them as ever. Synthetic characters
// only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots
// to SHOTS.
import { mkdirSync } from 'node:fs'
import { combat, combatant, settings, user, users, actors } from './fvtt/stub.mjs'
import { JSDOM } from 'jsdom'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

// Module 0.26.0, from before Midi's saves were asked in the app.
const SKEW = process.env.SKEW === '026'
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
const shoot = async (page, name, options = {}) => {
  if (!SHOTS) return
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/${name}${SKEW ? '-skew026' : ''}.png`, ...options })
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Foundry's hooks: callAll and call run their handlers at once, as Foundry's do; once removes itself.
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
// Banner mode on the phone: its checks read the tray's banner, which shows only where the player has
// chosen it over toasts; the tablet keeps the toasts, the default.
const newContext = browser.newContext.bind(browser)
const problems = []
const foundryContext = await newContext()
await foundryContext.grantPermissions(['local-network-access'], { origin: GAME })
await foundryContext.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' }))
const gmTab = await foundryContext.newPage()
await gmTab.goto(`${GAME}/game`)
const posted = []
let fetches = 0
// How long the module's word that a prompt closed takes to reach the app, as on a slow connection.
let closeLag = 0
globalThis.fetch = async (url, init) => {
  const sent = JSON.parse(init.body)
  if (closeLag && (sent.type === 'roll.prompt.closed')) await wait(closeLag)
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
  posted.push({ url: String(url), type: sent.type ?? 'fetch', session: sent.session, data: sent.data, status, body, at: Date.now() })
  if (status >= 300) problems.push(`${sent.type ?? url} → ${status}`)
  return {
    ok: status >= 200 && status < 300, status, statusText,
    headers: new Headers(type ? { 'content-type': type } : {}),
    json: async () => JSON.parse(body), text: async () => body,
  }
}
/** Every answer to the module's fetches of its commands, parsed, oldest first. */
const fetchAnswers = () => posted.filter(p => (p.type === 'fetch') && (p.status === 200) && p.url.endsWith('/api/bridge/commands'))
  .flatMap(p => { try { return [JSON.parse(p.body)] } catch { return [] } })
/** Which characters the app last told the module are open. */
const lastOpen = () => fetchAnswers().at(-1)?.open
const fetchedCommand = id => fetchAnswers().flatMap(answer => answer.commands ?? []).find(command => command.id === id)

// ---- Alice sets up the campaign in the app ----
const setupView = await newContext()
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
const A = sql(`select id from campaign where title = 'Ashlands'`)

// ---- Foundry, with dnd5e's dice, actors, concentration and activities, and Midi-QOL ----
globalThis.document ??= { hidden: false }
globalThis.DOMParser = new JSDOM('').window.DOMParser
const { messages } = await import('./fvtt/dice-core.mjs')
const { default: BasicDie } = await import(`${DND5E}/basic-die.mjs`)
const { default: BasicRoll } = await import(`${DND5E}/basic-roll.mjs`)
const { default: D20Die } = await import(`${DND5E}/d20-die.mjs`)
const { default: D20Roll } = await import(`${DND5E}/d20-roll.mjs`)
const { default: DamageRoll } = await import(`${DND5E}/damage-roll.mjs`)
Object.assign(CONFIG.Dice, { BasicDie, BasicRoll, D20Die, D20Roll, DamageRoll })
CONFIG.Dice.terms.d = BasicDie
const ABILITIES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
// Spellcasting by spell levels, as dnd5e's model, with what its sheet and its usage dialog use.
const ordinal = n => ['Cantrips', '1st Level', '2nd Level', '3rd Level', '4th Level'][n] ?? `${n}th Level`
const leveled = {
  key: 'spell', slots: true, cantrips: true, prepares: true, order: 20, exclusive: { spells: false, slots: false },
  getAvailableLevels: actor => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => (actor.system.spells[`spell${l}`]?.max ?? 0) > 0),
  getSpellSlotKey: level => `spell${level}`, getLabel: ({ level }) => ordinal(level),
}
const innate = { key: 'innate', order: -20, getAvailableLevels: () => [], getSpellSlotKey: () => 'innate', getLabel: () => 'Innate' }
CONFIG.DND5E = {
  skills: {
    ath: { label: 'Athletics', ability: 'str' }, acr: { label: 'Acrobatics', ability: 'dex' },
    prc: { label: 'Perception', ability: 'wis' },
  },
  tools: {},
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex', concentration: 'con' },
  spellcasting: { spell: leveled, innate },
  damageTypes: Object.fromEntries(['fire', 'slashing'].map(type => [type, { label: capital(type) }])),
  healingTypes: { healing: { label: 'Healing' } },
  activityActivationTypes: { action: { label: 'Action', header: 'Actions' } },
}
CONFIG.statusEffects = []
settings.set('messageMode', 'public')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
settings.set('attackRollVisibility', 'hideAC')
settings.set('challengeVisibility', 'all')

const { Character } = await import('./fvtt/dnd5e-cards.mjs')
const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, SaveActivity, DamageActivity, HealActivity, Collection, equip } = await import('./fvtt/activity5e.mjs')
const { midi, placeables, installMidi } = await import('./fvtt/midi-fake.mjs')
// dnd5e's ActivityCollection finds activities by type, as the sheet's actions do.
Collection.prototype.getByType ??= function (type) { return this.contents.filter(activity => activity.type === type) }
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
  if (!embedded) return actor
  return (embedded === 'Item') ? (actor?.items?.get?.(embeddedId) ?? null) : null
}

// Midi-QOL 13, its saves checked and shown to everyone, the Gamemaster's saves fast-forwarded.
installMidi()
game.modules.set('midi-qol', { active: true, version: '13.0.60' })
const { midiSaves, saveWorkflow, runSaves, saveActivity, itemConcentrationCheck, overTimeTurn, installMidiSaves } = await import('./fvtt/midi-saves.mjs')
installMidiSaves({ actorClasses: [Actor5e], concentrationClass: Character })
Object.assign(midi.settings, { autoCheckSaves: 'all', requiresTargets: 'none', gmAutoFastForward: ['save'] })

// ---- The world ----
users.activeGM = user('gm', 'Gamemaster', true)
const gmUser = users.get('gm')
gmUser.active = true
gmUser.targets = new Set()
// Alice isn't in Foundry, to start with.
const alice = user('alice', 'Alice')
alice.active = false
const spell = (id, name, level, activity) => ({
  id, name, type: 'spell',
  system: { level, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'inst' } },
  activities: [activity],
})
// Thorin, Alice's: Strength +4, Constitution +3 and a +6 save, Athletics +7, Acrobatics +1, and
// Fireball, which can catch him too.
const thorin = new Character({
  id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 4, dex: 1, con: 3, wis: 2 },
  skills: { ath: { ability: 'str', value: 1 }, acr: { ability: 'dex', value: 0 }, prc: { ability: 'wis', value: 1 } },
  hp: { value: 44, max: 44, temp: 0 },
})
// His items and spell slots, as activity5e has them; his concentration stays dnd5e's, as
// dnd5e-cards ports it, which equip() would put its own in place of.
Object.defineProperty(thorin, 'concentration', { value: null, writable: true, configurable: true })
equip(thorin, {
  ac: 18,
  spells: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => [`spell${level}`, { value: (level === 3) ? 2 : 0, max: (level === 3) ? 2 : 0, level }])),
  items: [spell('fireball', 'Fireball', 3, {
    id: 'blast', type: 'save', template: 'sphere', affects: 'creature', save: ['dex'], dc: 15,
    damage: [{ number: 8, denomination: 6, types: ['fire'], scaling: 1 }],
    labels: { damage: [{ formula: '8d6', damageType: 'fire', label: '8d6 Fire' }] },
  })],
})
delete thorin.concentration
delete thorin.beginConcentrating
delete thorin.endConcentration
thorin.system.attributes.concentration = { ability: 'con', limit: 1, roll: { mode: 0, max: null, min: null }, bonuses: { save: '' } }
thorin.system.details = { level: 5 }
thorin.system.attributes.spellcasting = 'wis'
thorin.system.attributes.spell = { dc: 13, attack: 5, mod: 2 }
thorin.spellcastingClasses = { fighter: { name: 'Fighter', spellcasting: { ability: 'wis', save: 13, attack: 5 } } }
Object.assign(thorin.system.skills.ath, { total: 7, passive: 17 })
Object.assign(thorin.system.skills.acr, { total: 1, passive: 11 })
Object.assign(thorin.system.skills.prc, { total: 5, passive: 15 })
thorin.system.attributes.init.total = 1
// Each save's bonus, as dnd5e prepares it: proficient in Constitution saves.
for (const ability of Object.values(thorin.system.abilities)) {
  ability.save.value = ability.mod + (ability.saveProf.hasProficiency ? thorin.system.attributes.prof : 0)
}
// A favourite check, for the Favorites panel's badge.
thorin.system.favorites = [{ type: 'skill', id: 'ath', sort: 100000 }]
actors.set('thorin', thorin)
alice.character = thorin
const goblin = new Actor5e({ id: 'goblin', name: 'Goblin Shaman', mods: { dex: 2, wis: 1 }, hp: { value: 40, max: 40, temp: 0 } })
goblin.type = 'npc'
equip(goblin, { ac: 13 })
actors.set('goblin', goblin)
// The tokens on the Gamemaster's canvas, each its actor's speaker, as Foundry finds one on the scene.
const place = (actor, disposition) => {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false, disposition, isLinked: true }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  placeables.set(token.id, placeable)
  actor.speakerToken = placeable
  return placeable
}
const tokens = { thorin: place(thorin, 1), goblin: place(goblin, -1) }
canvas.scene.tokens.size = placeables.size

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'], rolls: true, attacks: true, prompts: true }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const features = () => sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`)
await until(() => features().includes('prompts'), 'the hello to be taken', 15_000)
const hello = posted.find(p => p.type === 'bridge.hello')
const helloAnswer = JSON.parse(hello.body || 'null')
check(helloAnswer?.features?.midiPrompts === 1, `the app answers the hello saying it reads Midi's prompts, format 1 (${hello.body})`)
if (SKEW) {
  check(!('midiPrompts' in hello.data.features.rolls) && !features().split(',').includes('midiPrompts'),
    `module 0.26.0's hello says nothing of Midi's saves, and the app keeps nothing of them (${features()})`)
} else {
  // Changed on purpose (round 0.41.0 §8.4): from module 0.41.0, damage on its own's choices wherever
  // it's offered, and companions' saves wherever players are asked for theirs.
  check(hello.data.features.rolls.midiPrompts === true && features() === 'modifiers,prompts,areaAttacks,activityChecks,signedDice,selfTargets,gmRolls,gmRollMessages,midiPrompts,aloneChoices,companionPrompts',
    `module 0.27.0's hello says Midi's saves are asked in the app, and the app keeps that (${features()})`)
}

// A fight: the goblin shaman has gone; it's Thorin's turn.
const fight = combat('fight')
combatant(fight, 'cbGob', goblin, { name: 'Goblin Shaman', initiative: 17, token: tokens.goblin.document })
combatant(fight, 'cbThorin', thorin, { initiative: 15, token: tokens.thorin.document })
fight.getCombatantsByActor = actor => fight.combatants.filter(cb => cb.actor?.id === actor.id)
fight.started = true
fight.round = 1
fight.turn = 1
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// Alice plays Thorin.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', 'Ashlands', '${A}', 'thorin', 'e2e-user', now())`)

// ---- What's asked, and what's made ----
const opened = () => posted.filter(p => p.type === 'roll.prompt.opened').map(p => p.data.prompt)
const closesOf = id => posted.filter(p => (p.type === 'roll.prompt.closed') && (p.data.id === id)).map(p => p.data.reason)
const promptRow = id => JSON.parse(sql(`select row_to_json(p)::text from (select "closedAt" is not null as closed, "closedReason" as reason, data, "openedAt", "expiresAt" from roll_prompt where "promptId" = '${id}') p`) || 'null')
const prompts = () => Number(sql('select count(*) from roll_prompt'))
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, role, payload, result, "useId" from roll_request ${id ? `where id = '${id}'` : 'order by "createdAt" desc limit 1'}) r`) || 'null')
const requests = () => Number(sql('select count(*) from roll_request'))
const settled = row => ['done', 'failed'].includes(row?.status)
const processedFor = workflow => midiSaves.processed.find(p => p.workflow === workflow)
const hp = actor => actor.system.attributes.hp.value
/** The next prompt the module opens after `count` were. */
async function nextPrompt(count, ms = 15_000) {
  await until(() => opened().length > count, 'a prompt to open', ms)
  return opened()[count]
}
let spells = 0
/** A spell of the goblin shaman's at Thorin: Midi's workflow, at its saves. */
async function monsterSpell({ name = 'Hold Person', abilities = ['wis'], dc = 14 } = {}) {
  const slug = `spell${++spells}`
  const item = { id: slug, name, type: 'spell', uuid: `Actor.goblin.Item.${slug}`, flags: {}, system: { description: { value: '' } } }
  const workflow = await saveWorkflow({ actor: goblin, item, activity: saveActivity({ item, abilities, dc }), targets: [tokens.thorin], token: tokens.goblin })
  return { workflow, running: runSaves(workflow) }
}

/** A page on a browser of this size and theme; the tray's banner in place of toasts if asked. */
async function browse({ width, height, scheme, banner = false }) {
  const view = await newContext({ viewport: { width, height }, isMobile: width < 1024, hasTouch: width < 1024, colorScheme: scheme })
  if (banner) {
    await view.addInitScript(() => {
      try {
        if (localStorage.getItem('sending-stone:roll-toasts') === null) localStorage.setItem('sending-stone:roll-toasts', 'off')
      } catch {}
    })
  }
  await view.addCookies([cookie])
  await view.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  page.on('response', async response => {
    if (response.request().method() === 'POST' && response.url().endsWith('/rolls') && response.status() !== 202) {
      console.log('refused:', response.status(), await response.text().catch(() => ''), response.request().postData())
    }
  })
  return { view, page }
}
/** The d20 the app throws next, or Math.random again. */
const forceD20 = (page, value) => page.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, value)
const unforce = page => page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
/** Tap it, and once the request it sends is made in the game, the request and what came of it. */
async function tap(button, what) {
  const before = requests()
  await button.click()
  await until(() => requests() > before, `${what} to be sent`)
  const request = rollRow()
  await until(() => settled(rollRow(request.id)), `${what} to be made`)
  return { request, made: rollRow(request.id) }
}
/** What the app answers a request from this page, as JSON where it is. */
const call = (page, path, { method = 'GET', body } = {}) => page.evaluate(async ({ path, method, body }) => {
  const response = await fetch(path, { method, ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), redirect: 'manual' })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: response.status, text, json }
}, { path, method, body })
const overflow = page => page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth)
/** The text of each of the banner's rows. */
const rowsOf = banner => banner.locator('li').allTextContents()

/**
 * WCAG contrast of an element's text against what it's drawn on: its own background and its
 * ancestors', blended over the first opaque one, as the browser paints them.
 */
const contrastOf = locator => locator.evaluate(async el => {
  // Once its colours have finished changing, as a tab just chosen fades to its own.
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
  const hex = rgb => `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`
  return { ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, fg: hex(fg), bg: hex(bg), shared: el.classList.contains('text-primary-text') }
})

// ---- Not open in the app: Midi rolls, and nobody is asked ----
await wait(2_000)
check(Array.isArray(lastOpen()) && lastOpen().length === 0, `the app tells the module, in each fetch's answer, that no character is open (${JSON.stringify(lastOpen())})`)
let queued = midiSaves.queued.length
let count = opened().length
let promptsBefore = prompts()
let started = Date.now()
let { workflow, running } = await monsterSpell()
await running
check(midiSaves.queued.length === queued + 1 && Date.now() - started < 3_000, `a save of Thorin's while his page isn't open is Midi's own at once (${Date.now() - started} ms)`)
check(opened().length === count && prompts() === promptsBefore && processedFor(workflow)?.results[0]?.[0]?.total !== undefined
  && (workflow.saves.has(tokens.thorin) || workflow.failedSaves.has(tokens.thorin)),
  `nothing is asked in the app, and Midi rolls it, as it's set up: ${processedFor(workflow).results[0][0].total} against DC 14`)

// ---- On Alice's phone ----
const { view: phoneView, page } = await browse({ width: 390, height: 844, scheme: 'dark', banner: true })
const openedFrom = Date.now()
await page.goto(`${BASE}/characters/sheet-thorin`)
const sheet = page.getByRole('region', { name: 'Character' })
const banner = page.getByRole('region', { name: 'Your Gamemaster asks' })
const tray = page.getByRole('region', { name: 'Your rolls' })
const status = tray.getByRole('status')
await sheet.getByRole('button', { name: /^Athletics check/ }).first().waitFor({ timeout: 20_000 })
// The module hears it at the next fetch's answer: one held for as long as nothing changes.
await until(() => lastOpen()?.includes('thorin'), 'the module to hear Thorin is open', 45_000)
check(same(lastOpen(), ['thorin']), `with his page open on her phone, the app tells the module Thorin is open (${JSON.stringify(lastOpen())}, ${Math.round((Date.now() - openedFrom) / 1000)} s after it opened)`)

if (SKEW) {
  // Module 0.26.0 takes no notice: Midi's own way at once, and nobody is asked.
  queued = midiSaves.queued.length
  count = opened().length
  promptsBefore = prompts()
  started = Date.now()
  ;({ workflow, running } = await monsterSpell())
  await running
  check(midiSaves.queued.length === queued + 1 && Date.now() - started < 3_000, `module 0.26.0 leaves Thorin's save to Midi at once, though his page is open (${Date.now() - started} ms)`)
  await wait(3_000)
  check(opened().length === count && prompts() === promptsBefore && (await banner.count()) === 0, 'and nothing is asked in the app')
  midi.settings.doConcentrationCheck = 'chat'
  thorin.concentrateOn('Bless')
  const rolls = midiSaves.concentrationRolls.length
  await thorin.challengeConcentration({ dc: 12 })
  await wait(3_000)
  check(midiSaves.concentrationRolls.length === rolls + 1 && midiSaves.concentrationRolls.at(-1).via === 'gm' && prompts() === promptsBefore && (await banner.count()) === 0,
    "Midi's concentration card is Midi's Gamemaster's to roll, as ever, and asks the app nothing")
  await shoot(page, 'phone-skew-nothing-asked')
  console.log('problems:', problems)
  check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
  await browser.close()
  process.exit(0)
}

// ---- The goblin shaman's Hold Person: asked on the phone, Midi waiting ----
queued = midiSaves.queued.length
count = opened().length
;({ workflow, running } = await monsterSpell())
let prompt = await nextPrompt(count)
await banner.waitFor({ timeout: 15_000 })
let row = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
let rows = await rowsOf(banner)
const timer = row.getByRole('timer')
check(rows.length === 1 && /^Hold Person: Wisdom save/.test(rows[0]) && rows[0].includes('DC 14') && /Midi rolls for you in (0:5\d|1:00)/.test(await timer.textContent()),
  `the phone asks for the save Midi asks of Thorin: what asks it, its DC and how long Midi waits, "${rows[0]}"`)
const saveButton = row.getByRole('button', { name: 'Roll Wisdom saving throw, +2' })
check(await row.getByRole('button').count() === 1 && await saveButton.isEnabled() && (await saveButton.getAttribute('aria-haspopup')) === null,
  'one button, Wisdom +2, a plain tap with no menu of its own: Midi decides how it\'s rolled')
await saveButton.click({ button: 'right' })
await wait(400)
check(await page.getByRole('menu').count() === 0 && await page.getByRole('dialog').count() === 0, 'a right-click or long press on it opens no roll menu')
check(prompt.source === 'midi' && prompt.type === 'save' && same(prompt.abilities, ['wis']) && prompt.askedInFoundry === false && prompt.messageId === workflow.chatCard.id
  && promptRow(prompt.id)?.closed === false, `the app keeps the prompt open as the module sent it (${JSON.stringify(prompt)})`)
const stored = promptRow(prompt.id)
const lifetime = Date.parse(stored.expiresAt) - Date.parse(stored.openedAt)
check(Date.parse(prompt.expiresAt) - Date.parse(prompt.openedAt) === 60_000 && lifetime > 55_000 && lifetime <= 63_000,
  `a minute's wait, which the app puts on its own clock as it first stores it (${lifetime} ms)`)
await shoot(page, 'phone-midi-prompt')
// A hello while it waits lists it: the app keeps it open.
const hellos = posted.filter(p => p.type === 'bridge.hello').length
await Hooks.callAll('sendingStone.helloWanted', 'camp-ash')
await until(() => posted.filter(p => p.type === 'bridge.hello').length > hellos, 'the hello to be sent again', 15_000)
const again = posted.filter(p => p.type === 'bridge.hello').at(-1)
check(again.status < 300 && again.data.prompts?.some(p => p.id === prompt.id) && promptRow(prompt.id).closed === false && await banner.isVisible(),
  'a hello sent while Midi waits lists the prompt, and the app keeps it open')
check(midiSaves.queued.length === queued, "meanwhile Midi's own request is never made: it waits on the app")
await forceD20(page, 16)
let { request, made } = await tap(saveButton, 'the Wisdom save')
await unforce(page)
await running
const holdRoll = processedFor(workflow).results[0][0]
check(request.payload.kind === 'save' && request.payload.key === 'wis' && request.payload.prompt === prompt.id && request.payload.mode === 0
  && request.payload.explicit === false && same(request.payload.extras, []) && same(request.payload.dice, [{ faces: 20, results: [16] }]),
  `the phone answers the prompt with Alice's d20, as Midi has it rolled (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && made.result.messageId === null && made.result.visible === true && made.result.outcome === 'success' && made.result.rolls[0].total === 18,
  `the game makes it, with no message where Midi shows saves without one, and says he saved, as Midi shows its players (${JSON.stringify(made.result)})`)
check(holdRoll.dice[0].results.map(r => r.result).join() === '16' && holdRoll.total === 18 && workflow.saves.has(tokens.thorin) && !workflow.failedSaves.has(tokens.thorin)
  && midiSaves.queued.length === queued, "Midi takes Alice's roll as Thorin's save: 16 + 2, saved, its own request never made")
await status.getByText(/At the table/).waitFor({ timeout: 20_000 })
let said = await status.textContent()
check(said.includes('At the table: 18 · Saved'), `the tray shows the game's total and that he saved: "${said}"`)
await until(async () => (await banner.count()) === 0, 'the banner to go once answered', 15_000)
check(same(closesOf(prompt.id), ['answered']) && promptRow(prompt.id).reason === 'answered', 'the prompt closes, answered, once')

// Midi gives him advantage, as for Magic Resistance: shown, and rolled with both of his d20s.
midiSaves.advantage.set('thorin', { wis: { hasAdvantage: true } })
count = opened().length
;({ workflow, running } = await monsterSpell())
prompt = await nextPrompt(count)
row = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
await row.waitFor({ timeout: 15_000 })
rows = await rowsOf(banner)
const advButton = row.getByRole('button', { name: 'Roll Wisdom saving throw, Advantage (Midi), +2' })
check(same(prompt.advantage, { wis: 'adv' }) && rows[0].includes('DC 14 · Advantage (Midi)') && await advButton.count() === 1,
  `Midi's advantage is shown, with no choice of it: "${rows[0]}"`)
await shoot(page, 'phone-midi-advantage')
;({ request, made } = await tap(advButton, 'the Wisdom save with advantage'))
await running
const advRoll = processedFor(workflow).results[0][0]
const advDice = request.payload.dice[0].results
check(request.payload.mode === 1 && request.payload.explicit === false && advDice.length === 2 && made.status === 'done',
  `the phone sends it with advantage, two d20s (${JSON.stringify(request.payload)})`)
check(advRoll.options.advantageMode === 1 && same(advRoll.dice[0].results.map(r => r.result), advDice) && advRoll.total === Math.max(...advDice) + 2,
  `Midi rolls it with advantage, both of Alice's d20s, the higher kept: ${advRoll.total}`)
midiSaves.advantage.delete('thorin')
await until(async () => (await banner.count()) === 0, 'the banner to go once answered', 15_000)

// ---- Unanswered: Midi's own way, once the wait is over ----
await game.settings.set('sending-stone', 'midiPromptWait', 5_000)
// The module's word that it closed is slow to come, as on a slow connection: the phone says Midi
// is rolling meanwhile.
closeLag = 4_000
queued = midiSaves.queued.length
count = opened().length
;({ workflow, running } = await monsterSpell())
prompt = await nextPrompt(count)
row = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
await row.getByRole('timer').waitFor({ timeout: 10_000 })
const short = await row.getByRole('timer').textContent()
check(Date.parse(prompt.expiresAt) - Date.parse(prompt.openedAt) === 5_000 && /Midi rolls for you in 0:0[1-5]/.test(short),
  `a wait shortened to five seconds: "${short}"`)
check(midiSaves.queued.length === queued, 'before it is over, Midi waits')
await row.getByText('Midi is rolling…').waitFor({ timeout: 10_000 })
check(await row.getByRole('button').count() === 0 && await row.getByRole('timer').count() === 0, 'at 0:00 the buttons go, and the phone says Midi is rolling')
await shoot(page, 'phone-midi-rolling')
await until(() => midiSaves.queued.length > queued, "Midi's own request", 10_000)
check(midiSaves.queued.length === queued + 1, "Midi's own request is made once the wait is over, once")
await row.getByText('Midi rolled it').waitFor({ timeout: 15_000 })
check(promptRow(prompt.id).reason === 'expired' && same(closesOf(prompt.id), ['expired']), 'its close comes, expired, and the phone says Midi rolled it')
await shoot(page, 'phone-midi-rolled-it')
await running
const late = await call(page, '/api/characters/sheet-thorin/rolls', {
  method: 'POST', body: { kind: 'save', key: 'wis', prompt: prompt.id, mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [10] }] },
})
check(late.status === 422 && rollRow().payload.prompt !== prompt.id, `an answer sent after is refused (${late.status} ${late.text})`)
const shownFrom = Date.now()
await until(async () => (await banner.count()) === 0, "the notice to go", 15_000)
check(Date.now() - shownFrom >= 2_000, `the notice shows a while, then goes (${Date.now() - shownFrom} ms more)`)
closeLag = 0
check(midiSaves.queued.length === queued + 1 && processedFor(workflow)?.results[0]?.[0]?.options?.sendingStone === undefined, "Midi's own roll, with Foundry's dice, is the save")

// ---- An aborted workflow's prompt goes quietly ----
await game.settings.set('sending-stone', 'midiPromptWait', 60_000)
count = opened().length
;({ workflow, running } = await monsterSpell({ name: 'Command' }))
prompt = await nextPrompt(count)
await banner.getByRole('listitem').filter({ hasText: 'Command' }).waitFor({ timeout: 15_000 })
workflow.aborted = true
await until(() => closesOf(prompt.id).length, 'the aborted workflow to close it', 15_000)
await until(async () => (await banner.count()) === 0, 'the banner to go', 15_000)
check(same(closesOf(prompt.id), ['gone']) && promptRow(prompt.id).reason === 'gone', 'a workflow Midi aborts closes its prompt as gone, and the banner goes with no notice')
await running

// ---- Asked in Foundry too: Midi's chat request ----
alice.active = true
midi.settings.playerRollSaves = 'chat'
count = opened().length
;({ workflow, running } = await monsterSpell())
prompt = await nextPrompt(count)
row = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
await row.getByRole('timer').waitFor({ timeout: 15_000 })
let words = await row.getByRole('timer').textContent()
check(prompt.askedInFoundry === true && /Answer here or in Foundry · (0:5\d|1:00)/.test(words), `with Alice in Foundry and Midi asking her there too, the phone says so: "${words}"`)
await shoot(page, 'phone-midi-foundry')
await until(() => typeof workflow.saveRequests['tok-thorin'] === 'function', "Midi's chat request")
// She rolls it in Foundry first.
const foundry = await thorin.rollSavingThrow({ ability: 'wis' }, { configure: false }, {})
await running
await row.getByText('Rolled in Foundry').waitFor({ timeout: 15_000 })
check(same(closesOf(prompt.id), ['rolled']) && promptRow(prompt.id).reason === 'rolled' && processedFor(workflow).results[0][0] === foundry[0],
  "rolled in Foundry first, that's the save Midi takes, and the phone says it was rolled in Foundry")
await shoot(page, 'phone-midi-rolled-in-foundry')
await until(async () => (await banner.count()) === 0, 'the notice to go', 15_000)
// Its wait over, with no answer anywhere: left to Foundry.
await game.settings.set('sending-stone', 'midiPromptWait', 5_000)
count = opened().length
;({ workflow, running } = await monsterSpell())
prompt = await nextPrompt(count)
row = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
await row.getByText('Left to Foundry').waitFor({ timeout: 20_000 })
await until(() => closesOf(prompt.id).length, 'its close', 15_000)
check(same(closesOf(prompt.id), ['expired']) && await row.getByRole('button').count() === 0, 'its wait over, the phone leaves it to Foundry, where Midi still asks her')
await shoot(page, 'phone-midi-left-to-foundry')
await thorin.rollSavingThrow({ ability: 'wis' }, { configure: false }, {})
await running
await game.settings.set('sending-stone', 'midiPromptWait', 60_000)
alice.active = false
midi.settings.playerRollSaves = 'none'
await until(async () => (await banner.count()) === 0, 'the notice to go', 15_000)

// ---- OverTime turn saves ----
const overTime = (id, value) => ({ id, uuid: `Actor.thorin.ActiveEffect.${id}`, name: id, statuses: new Set(), changes: [{ key: 'flags.midi-qol.OverTime', value }] })
// At the end of his turn: a Wisdom save against fear.
const fear = overTime('fear', 'turn=end,label=Frightened,saveAbility=wis,saveDC=13')
thorin.effects = [fear]
count = opened().length
running = overTimeTurn(thorin, tokens.thorin, fear, { start: false })
prompt = await nextPrompt(count)
row = banner.getByRole('listitem').filter({ hasText: 'Frightened' })
await row.waitFor({ timeout: 15_000 })
rows = await rowsOf(banner)
check(prompt.source === 'overtime' && /^Frightened: Wisdom save/.test(rows[0]) && rows[0].includes('DC 13'), `an OverTime save at the end of his turn is asked: "${rows[0]}"`)
await shoot(page, 'phone-midi-overtime-save')
await forceD20(page, 14)
;({ request, made } = await tap(row.getByRole('button', { name: 'Roll Wisdom saving throw, +2' }), 'the OverTime save'))
await unforce(page)
workflow = await running
check(made.status === 'done' && processedFor(workflow).results[0][0].total === 16 && workflow.saves.has(tokens.thorin)
  && same(midiSaves.expired.at(-1), { actorId: 'thorin', effect: 'fear', reason: 'midi-qol:overTime' }) && !thorin.effects.includes(fear),
  "saved, 14 + 2, Midi's own workflow removes the effect")
await status.getByText('At the table: 16').waitFor({ timeout: 20_000 })
said = await status.textContent()
check(said.includes('At the table: 16 · Saved'), `the tray says he saved: "${said}"`)
// At the start of it: an Athletics or Acrobatics check to escape a web.
const web = overTime('web', 'turn=start,label=Webbed,rollType=skill,saveAbility=ath|acr,saveDC=12')
thorin.effects = [web]
count = opened().length
running = overTimeTurn(thorin, tokens.thorin, web, { start: true })
prompt = await nextPrompt(count)
row = banner.getByRole('listitem').filter({ hasText: 'Webbed' })
await row.waitFor({ timeout: 15_000 })
rows = await rowsOf(banner)
const athletics = row.getByRole('button', { name: 'Roll Athletics check, +7' })
const acrobatics = row.getByRole('button', { name: 'Roll Acrobatics check, +1' })
check(prompt.type === 'skill' && same(prompt.skills, ['ath', 'acr']) && same(prompt.abilities, []) && /^Webbed: Athletics or Acrobatics check/.test(rows[0])
  && await athletics.count() === 1 && await acrobatics.count() === 1, `an OverTime check of two skills at the start of his turn offers each: "${rows[0]}"`)
await shoot(page, 'phone-midi-overtime-skill')
await forceD20(page, 10)
;({ request, made } = await tap(athletics, 'the Athletics check'))
await unforce(page)
workflow = await running
const webRoll = processedFor(workflow).results[0][0]
check(request.payload.kind === 'skill' && request.payload.key === 'ath' && made.status === 'done' && webRoll.total === 17 && workflow.saves.has(tokens.thorin) && !thorin.effects.includes(web),
  `Athletics chosen is rolled with his Strength, 10 + 7, and Midi's workflow frees him (${JSON.stringify(request.payload)})`)
await status.getByText(/Athletics/).waitFor({ timeout: 20_000 })
await until(async () => /At the table: 17/.test(await status.textContent()), 'the tray to show the check made', 20_000)
said = await status.textContent()
check(said.includes('At the table: 17 · Passed'), `the tray says the check Midi asked for passed: "${said}"`)
check(![...messages.values()].some(m => m.flags?.['midi-qol']?.overtimeActorUuid), 'nothing is stamped as an OverTime action save')
thorin.effects = []
await until(async () => (await banner.count()) === 0, 'the banner to go', 15_000)

// ---- Thorin's own Fireball, at the goblin shaman and himself ----
const nav = page.getByRole('navigation', { name: 'Table' })
if (await nav.count()) await nav.getByRole('button', { name: /^Character/ }).click()
await page.getByRole('tab', { name: 'Actions' }).click()
const panel = page.getByRole('tabpanel')
await panel.getByRole('button', { name: 'Fireball, DEX saving throw DC 15' }).click()
const picker = page.getByRole('dialog', { name: 'Fireball' })
await picker.waitFor()
await picker.getByRole('checkbox', { name: 'Goblin Shaman' }).click()
await picker.getByRole('checkbox', { name: /^Self/ }).click()
const thorinBefore = hp(thorin)
const goblinBefore = hp(goblin)
count = opened().length
const castAt = requests()
await picker.getByRole('button', { name: 'Cast at 2 targets' }).click()
await until(() => requests() > castAt, 'Fireball to be sent')
const use = rollRow()
prompt = await nextPrompt(count, 40_000)
row = banner.getByRole('listitem').filter({ hasText: 'Fireball' })
await row.waitFor({ timeout: 15_000 })
rows = await rowsOf(banner)
check(use.kind === 'use' && same(use.payload.targets.map(t => t.combatantId).sort(), ['cbGob', 'cbThorin']) && /^Fireball: Dexterity save/.test(rows[0]) && rows[0].includes('DC 15'),
  `his own Fireball, at the goblin shaman and at himself, as Self, has Midi ask him for his save on the phone: "${rows[0]}" (${JSON.stringify(use.payload.targets)})`)
await shoot(page, 'phone-midi-own-fireball')
const fireButton = row.getByRole('button', { name: 'Roll Dexterity saving throw, +1' })
check(await fireButton.isEnabled(), "its button is ready, though his own spell's workflow waits on it")
await forceD20(page, 19)
const answered = await tap(fireButton, 'his Dexterity save')
await unforce(page)
const fireFlow = midi.made.find(w => w.chatCard && (w.chatCard.flags?.['sending-stone']?.use === use.id))
await until(() => processedFor(fireFlow) && fireFlow.currentAction === fireFlow.WorkflowState_Completed, "Fireball's workflow to end", 30_000)
await until(() => settled(rollRow(`${use.id}`)), 'the use', 15_000)
const damage = JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload from roll_request where "useId" = '${use.id}') r`) || 'null')
const fire = damage?.payload?.dice?.[0]?.results ?? []
const fireTotal = fire.reduce((sum, d) => sum + d, 0)
const goblinSaved = fireFlow.saves.has(tokens.goblin)
check(rollRow(use.id).status === 'done' && damage?.status === 'done' && answered.made.status === 'done' && same(closesOf(prompt.id), ['answered']),
  'his use, its damage and his answer are each made, his answer not held behind his own spell')
check(fireFlow.saves.has(tokens.thorin) && hp(thorin) === thorinBefore - Math.floor(fireTotal / 2) && hp(goblin) === goblinBefore - (goblinSaved ? Math.floor(fireTotal / 2) : fireTotal),
  `saved with 19 + 1, Thorin takes half of Alice's ${fireTotal} fire, the goblin shaman ${goblinSaved ? 'half, saving' : 'all of it, failing'} its own save, as Midi rolls it`)
await until(async () => (await banner.count()) === 0, 'the banner to go', 15_000)
check(await overflow(page) <= 0, 'at 390 pixels nothing runs off the side')

// ---- The colours fixed this round, on the dark phone ----
async function measure(view, theme) {
  const results = []
  const take = async (what, locator) => {
    await locator.first().waitFor({ timeout: 10_000 })
    results.push({ what, ...(await contrastOf(locator.first())) })
  }
  // The Actions tab, chosen, with the favourites beside or above it.
  await view.getByRole('tab', { name: 'Actions' }).click()
  await take('selected tab', view.getByRole('tab', { selected: true }))
  await take("favourite check's badge", view.locator('span.text-primary-text', { hasText: /^str$/i }))
  await view.locator('button[aria-label="Settings"]').first().click()
  await take("cog's chosen roll results", view.getByRole('radio', { checked: true }).filter({ hasText: /Toasts|Banner/ }))
  await shoot(view, `aa-cog-${theme}`)
  await view.keyboard.press('Escape')
  return results
}
let measured = await measure(page, 'dark')
check(measured.every(m => m.shared && m.ratio >= 4.5) && measured.every(m => m.fg === '#00a86b'),
  `in the dark theme each is the shared green, #00a86b, at 4.5:1 or more on what it's drawn on: ${measured.map(m => `${m.what} ${m.ratio} (${m.fg} on ${m.bg})`).join('; ')}`)

// ---- On Alice's tablet, light, with the toasts ----
const { view: tabletView, page: tablet } = await browse({ width: 768, height: 1024, scheme: 'light' })
await tablet.goto(`${BASE}/characters/sheet-thorin`)
const tabletBanner = tablet.getByRole('region', { name: 'Your Gamemaster asks' })
await tablet.getByRole('region', { name: 'Character' }).getByRole('button', { name: /^Athletics check/ }).first().waitFor({ timeout: 20_000 })
measured = await measure(tablet, 'light')
check(measured.every(m => m.shared && m.ratio >= 4.5) && measured.every(m => m.fg === '#006b4b'),
  `in the light theme each is the shared darker green, #006b4b, at 4.5:1 or more: ${measured.map(m => `${m.what} ${m.ratio} (${m.fg} on ${m.bg})`).join('; ')}`)

// A save of two abilities: one button each, the choice Midi's.
count = opened().length
;({ workflow, running } = await monsterSpell({ name: 'Grasping Vine', abilities: ['str', 'dex'], dc: 13 }))
prompt = await nextPrompt(count)
row = tabletBanner.getByRole('listitem').filter({ hasText: 'Grasping Vine' })
await row.waitFor({ timeout: 15_000 })
rows = await rowsOf(tabletBanner)
const strButton = row.getByRole('button', { name: 'Roll Strength saving throw, +4' })
const dexButton = row.getByRole('button', { name: 'Roll Dexterity saving throw, +1' })
check(/^Grasping Vine: Strength or Dexterity save/.test(rows[0]) && await strButton.count() === 1 && await dexButton.count() === 1
  && same((await row.getByRole('button').allTextContents()).map(t => t.trim()), ['str +4', 'dex +1']),
  `a save of either ability offers each, by its abbreviation: "${rows[0]}"`)
const headingContrast = await contrastOf(tabletBanner.locator('#prompts-heading'))
check(headingContrast.shared && headingContrast.ratio >= 4.5, `the banner's heading is the shared green, at ${headingContrast.ratio}:1 on its tint (${headingContrast.fg} on ${headingContrast.bg})`)
await shoot(tablet, 'tablet-midi-two-abilities')
await shoot(page, 'phone-midi-two-abilities')
await forceD20(tablet, 12)
;({ request, made } = await tap(dexButton, 'the Dexterity save'))
await unforce(tablet)
await running
const vineRoll = processedFor(workflow).results[0][0]
check(request.payload.key === 'dex' && vineRoll.options.midiChosenId === 'dex' && vineRoll.total === 13 && workflow.saves.has(tokens.thorin),
  'Dexterity chosen, Midi has it as the choice, and 12 + 1 saves')
await tablet.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]').filter({ hasText: 'Dexterity' }).first().waitFor({ timeout: 20_000 })
const toast = await tablet.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]').filter({ hasText: 'Dexterity' }).first().textContent()
check(/13/.test(toast) && /Saved/.test(toast), `the tablet's toast shows the save made in the game, with no message of its own there: "${toast}"`)
await until(async () => (await tabletBanner.count()) === 0, 'the banner to go', 15_000)

// ---- Concentration, in Midi's chat mode: its card held ----
midi.settings.doConcentrationCheck = 'chat'
thorin.effects = []
thorin.ended = []
thorin.concentrateOn('Bless')
count = opened().length
const midiRolls = midiSaves.concentrationRolls.length
const card = await thorin.challengeConcentration({ dc: 12 })
prompt = await nextPrompt(count)
row = tabletBanner.getByRole('listitem').filter({ hasText: 'Bless' })
await row.waitFor({ timeout: 15_000 })
rows = await rowsOf(tabletBanner)
const concButton = row.getByRole('button', { name: 'Roll Concentration check, +6' })
check(card.flags['midi-qol'].concentrationRolled === true && card.flags['sending-stone'].midiHeld === true && midiSaves.concentrationRolls.length === midiRolls,
  "Midi's concentration card, made by the Gamemaster's client, is held: Midi's Gamemaster doesn't roll it")
check(prompt.source === 'concentration' && /^Bless: Concentration check/.test(rows[0]) && rows[0].includes('DC 12') && await concButton.count() === 1,
  `and the tablet asks for it: "${rows[0]}"`)
await shoot(tablet, 'tablet-midi-concentration')
await forceD20(tablet, 3)
;({ request, made } = await tap(concButton, 'the concentration check'))
await unforce(tablet)
let message = messages.get(made.result.messageId)
check(request.payload.kind === 'save' && request.payload.key === 'con' && made.status === 'done' && made.result.outcome === 'failure'
  && message?.rolls[0].total === 9 && message.rolls[0].options.target === 12 && same(message.whisper, ['gm']),
  'rolled as Midi\'s Gamemaster would roll it, against its DC, whispered: 3 + 6 fails')
await until(() => thorin.ended.includes('Bless') && card.flags['sending-stone'].midiDone === true, 'Midi to end his concentration', 10_000)
check(thorin.concentration.effects.size === 0 && midiSaves.concentrationRolls.length === midiRolls, "Midi's own hook ends his concentration, and its Gamemaster never rolls the card")
await until(async () => (await tabletBanner.count()) === 0, 'the banner to go', 15_000)

// In its item mode: a workflow's save, asked as a concentration check.
midi.settings.doConcentrationCheck = 'item'
thorin.concentrateOn('Hex')
count = opened().length
running = itemConcentrationCheck(thorin, tokens.thorin, 10)
prompt = await nextPrompt(count)
row = tabletBanner.getByRole('listitem').filter({ hasText: 'Hex' })
await row.waitFor({ timeout: 15_000 })
rows = await rowsOf(tabletBanner)
check(prompt.type === 'concentration' && prompt.source === 'concentration' && /^Hex: Concentration check/.test(rows[0]) && rows[0].includes('DC 10'),
  `in Midi's item mode too: "${rows[0]}"`)
await shoot(tablet, 'tablet-midi-concentration-item')
await forceD20(tablet, 15)
;({ request, made } = await tap(row.getByRole('button', { name: 'Roll Concentration check, +6' }), 'the concentration check'))
await unforce(tablet)
workflow = await running
check(made.status === 'done' && made.result.outcome === 'success' && workflow.saves.has(tokens.thorin) && thorin.concentration.effects.size === 1,
  'made, 15 + 6, he keeps concentrating on Hex')
midi.settings.doConcentrationCheck = 'chat'
thorin.effects = []
await until(async () => (await tabletBanner.count()) === 0, 'the banner to go', 15_000)
check(await overflow(tablet) <= 0, 'at 768 pixels nothing runs off the side')

// ---- The Gamemaster answers one, from her own page at his sheet ----
const { view: gmView, page: gmPage } = await browse({ width: 768, height: 1024, scheme: 'light' })
await gmPage.goto(`${BASE}/campaigns/${A}/characters/thorin`)
const gmAsks = gmPage.getByRole('region', { name: 'Your game asks' })
await gmPage.getByRole('region', { name: 'Character' }).getByRole('button', { name: /^Athletics check/ }).first().waitFor({ timeout: 20_000 })
count = opened().length
;({ workflow, running } = await monsterSpell())
prompt = await nextPrompt(count)
row = gmAsks.getByRole('listitem').filter({ hasText: 'Hold Person' })
await row.waitFor({ timeout: 15_000 })
await banner.waitFor({ timeout: 15_000 })
check(/^Hold Person: Wisdom save/.test((await rowsOf(gmAsks))[0]), "the Gamemaster's page at Thorin's sheet shows what Midi asks of him too")
await shoot(gmPage, 'gm-midi-prompt')
await forceD20(gmPage, 5)
;({ request, made } = await tap(row.getByRole('button', { name: 'Roll Wisdom saving throw, +2' }), "the Gamemaster's answer"))
await unforce(gmPage)
await running
check(request.role === 'gm' && fetchedCommand(request.id)?.by === 'gm' && made.status === 'done' && made.result.outcome === 'failure' && workflow.failedSaves.has(tokens.thorin),
  "she answers it as the Gamemaster, and Midi takes it: 5 + 2 fails")
await until(async () => (await banner.count()) === 0 && (await gmAsks.count()) === 0, 'the banners to go', 15_000)
check(same(closesOf(prompt.id), ['answered']), "the prompt closes, answered, on Alice's pages and the Gamemaster's")

// ---- Only the Gamemaster's page at his sheet: he isn't open ----
await phoneView.close()
await tabletView.close()
await until(() => lastOpen() && !lastOpen().includes('thorin'), 'the app to tell the module Thorin is no longer open', 40_000)
check(same(lastOpen(), []), "with only the Gamemaster's page at his sheet, the app tells the module no one has Thorin open")
queued = midiSaves.queued.length
count = opened().length
started = Date.now()
;({ workflow, running } = await monsterSpell())
await running
check(midiSaves.queued.length === queued + 1 && Date.now() - started < 3_000, `and his save is Midi's own at once (${Date.now() - started} ms)`)
await wait(3_000)
check(opened().length === count && (await gmAsks.count()) === 0, "nothing is asked in the app, not even on the Gamemaster's page")

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await gmView.close()
await browser.close()
process.exit(0)
