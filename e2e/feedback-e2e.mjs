// The feedback round (module 0.29.0 and the app), end to end: the real module, in a stand-in
// Foundry with dnd5e 5.3.3's real dice classes, its activities ported (fvtt/activity5e.mjs) and its
// concentration ported (fvtt/dnd5e-cards.mjs), fetches from the production app, from a browser on
// the game's page. Alice plays Thorin, on a phone (390 px) and a tablet (768 px); Bob plays Vex, on
// his phone; Alice is the campaign's Gamemaster too. In a fight with Éowyn, an NPC the Gamemaster
// marked Friendly, Bram, a Neutral one, three foes and a Secret lurker: the combat as the app keeps
// it, with no Secret disposition anywhere, and the tracker's colours; the target picker's Allies and
// Others, its pills and its search (accents, a ticked row kept, Escape twice, no keyboard on open).
// Thorin ends his concentration on Bless from the header's chip, its confirm first, Bless going
// from Vex with it, the concentration check the game was asking closing and not coming back with a
// hello; then one of two from the chip's menu, and the last from the Effects row. He spends two
// Sorcery Points from their count's popover, the line "Spends 2 · Sorcery Points" in Foundry's chat
// and the app's, and the count moved; more than are left is turned down, by the app and by the
// game; a feature's charges, Replicate Magic Item's, and an old-style resource, Bardic Inspiration;
// Lucky's Use greyed at none left. He gains Heroic Inspiration and uses it, each with its line. On
// Vex's sheet as the Gamemaster, Alice spends a Channel Divinity and gains Vex Heroic Inspiration,
// each line marked GM in Foundry and in the app, and each shown on Bob's page as hers; she finds no
// End there. Then hits, misses and saves on chat cards: dnd5e's Attack
// Roll Visibility none against Hide AC, Challenge Visibility player against none (Bob seeing what
// Alice's card lets him), a save message naming only its creature, the summary line, the content of
// a card whose DC is hidden kept free of it, and "Send Gamemaster-only information" sending all.
// MIDI=1 puts the stand-in Midi-QOL in the world (fvtt/midi-fake.mjs, fvtt/midi-saves.mjs): the
// app's attack becomes Midi's card, its hits written as Midi's workflow writes them, Midi's save
// cards' verdicts, an NPC's withheld under "player" and sent under "all", and a concentration check
// Midi asks in the app, which ending the concentration from the app leaves as it is.
// SKEW=028 with MODULE (or MODULE_DIR) set to module 0.28.0: no End, no spending, no inspiration
// control, no greyed Use, no Neutral pill and no wire pills; the sections, the Ally and You pills,
// search and the AC fallback, the app's alone, still there. OLDAPP=1 against the app at 1323970,
// served in this one's place, with module 0.29.0: the new kinds dropped, every new field ignored,
// everything the module sends taken. Synthetic characters only. Run with --import
// ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { mkdirSync, readFileSync } from 'node:fs'
import { combat, combatant, settings, user, users, actors } from './fvtt/stub.mjs'
import { JSDOM } from 'jsdom'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

// Module 0.28.0, from before this round; or the app from before it, with this round's module.
const SKEW = process.env.SKEW === '028'
const OLDAPP = Boolean(process.env.OLDAPP)
/** Whether both sides are this round's. */
const NEW = !SKEW && !OLDAPP
const MIDI = Boolean(process.env.MIDI)
const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
// Module 0.31.0's pictures go beside the others, in shots-031.
const SHOTS031 = SHOTS && `${SHOTS.replace(/\/[^/]*\/?$/, '')}/shots-031`
if (SHOTS031) mkdirSync(SHOTS031, { recursive: true })
const VARIANT = `${SKEW ? '-skew028' : ''}${OLDAPP ? '-oldapp' : ''}${MIDI ? '-midi' : ''}`
const ALICE = await cookieFor('e2e-token')
const BOB = await cookieFor('e2e-bob-token')
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
/** As Postgres keeps JSON: each object's keys in its own order, so compared sorted. */
const sorted = value => (Array.isArray(value) ? value.map(sorted)
  : (value && (typeof value === 'object')) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value)
const sameJson = (a, b) => same(sorted(a), sorted(b))

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
// Banner mode: the tray's words are read where the player has chosen the banner over toasts, as
// each browser starts; the tablet chooses the toasts, the default, below.
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
/** Every command the module fetched, by its id. */
const fetchedCommand = id => posted.filter(p => p.type === 'fetch' && p.status === 200)
  .flatMap(p => { try { return JSON.parse(p.body).commands ?? [] } catch { return [] } }).find(command => command.id === id)

// ---- Alice, the Gamemaster, sets up the campaign in the app ----
const setupView = await browser.newContext()
await setupView.addCookies([ALICE])
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

// ---- Foundry, with dnd5e's dice, items, activities and concentration ----
globalThis.document = { hidden: false }
globalThis.DOMParser = new JSDOM('').window.DOMParser
const { messages } = await import('./fvtt/dice-core.mjs')
const { default: BasicDie } = await import(`${DND5E}/basic-die.mjs`)
const { default: BasicRoll } = await import(`${DND5E}/basic-roll.mjs`)
const { default: D20Die } = await import(`${DND5E}/d20-die.mjs`)
const { default: D20Roll } = await import(`${DND5E}/d20-roll.mjs`)
const { default: DamageRoll } = await import(`${DND5E}/damage-roll.mjs`)
Object.assign(CONFIG.Dice, { BasicDie, BasicRoll, D20Die, D20Roll, DamageRoll })
CONFIG.Dice.terms.d = BasicDie
// The d20s the game itself throws, as the Gamemaster rolls a creature's save in Foundry, in order.
const faces = []
const { DiceTerm } = foundry.dice.terms
const randomFace = DiceTerm.prototype.randomFace
DiceTerm.prototype.randomFace = function () { return faces.length ? faces.shift() : randomFace.call(this) }
const ABILITIES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
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
  defaultAbilities: { initiative: 'dex', concentration: 'con' },
  spellcasting: { spell: leveled, innate },
  damageTypes: Object.fromEntries(['piercing', 'cold', 'thunder'].map(type => [type, { label: capital(type) }])),
  healingTypes: { healing: { label: 'Healing' } },
  activityActivationTypes: {
    action: { label: 'Action', header: 'Actions' }, bonus: { label: 'Bonus Action', header: 'Bonus Actions' },
    reaction: { label: 'Reaction', header: 'Reactions' },
  },
  limitedUsePeriods: { lr: { label: 'Long Rest' }, sr: { label: 'Short Rest' } },
}
// The module's own words, from its language file, as Foundry's i18n gives them; and Foundry's
// escapeHTML (common/utils/helpers.mjs), which its chat lines pass names through.
const flat = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => (typeof value === 'object')
  ? flat(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]])
const words = Object.fromEntries(flat(JSON.parse(readFileSync(`${MODULE}/lang/en.json`, 'utf8'))))
game.i18n.localize = key => words[key] ?? key
game.i18n.has = key => Object.hasOwn(words, key)
game.i18n.format = (key, data = {}) => (words[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(data[name] ?? ''))
foundry.utils.escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[ch])
// Foundry's enricher, for the effects' descriptions: plain text here.
foundry.applications.ux.TextEditor = { implementation: { async enrichHTML(html) { return html } } }
const STATUS = 'systems/dnd5e/icons/svg/statuses'
CONFIG.statusEffects = [{ id: 'concentrating', name: 'Concentrating', img: `${STATUS}/concentrating.svg` }]
CONFIG.specialStatusEffects = { CONCENTRATING: 'concentrating' }
settings.set('messageMode', 'public')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
// Out of the box: dnd5e shows players no hits, and whether creatures save only against players' cards.
settings.set('attackRollVisibility', 'none')
settings.set('challengeVisibility', 'player')

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { Character, saveCard } = await import('./fvtt/dnd5e-cards.mjs')
const { AttackActivity, SaveActivity, DamageActivity, HealActivity, Collection, equip } = await import('./fvtt/activity5e.mjs')
const { midi, placeables, installMidi } = await import('./fvtt/midi-fake.mjs')
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
// dnd5e's ChatMessage5e finds the item a message is of (chat-message.mjs:987-994), whose name the
// module sends, and the app labels a card by.
Hooks.on('preCreateChatMessage', message => {
  Object.getPrototypeOf(message).getAssociatedItem ??= function () {
    const id = this.flags?.dnd5e?.item?.id
    return id ? (this.getAssociatedActor()?.items?.get(id) ?? undefined) : undefined
  }
})

users.activeGM = user('gm', 'Gamemaster', true)
const gmUser = users.get('gm')
gmUser.active = true
gmUser.targets = new Set()
const alice = user('alice', 'Alice')
const bob = user('bob', 'Bob')
// Neither player is in Foundry: their rolls are made from the app.
alice.active = false
bob.active = false
let midiSaves
if (MIDI) {
  installMidi()
  game.modules.set('midi-qol', { active: true, version: '13.0.60' })
  const saves = await import('./fvtt/midi-saves.mjs')
  ;({ midiSaves } = saves)
  saves.installMidiSaves({ actorClasses: [Actor5e], concentrationClass: Character })
  // Saves and concentration checks left to dnd5e's cards until the Midi part below.
  Object.assign(midi.settings, { autoCheckSaves: 'none', doConcentrationCheck: 'chatOnly', requiresTargets: 'none' })
}

/** What dnd5e labels a part of damage or healing with, for the sheet. */
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
const spell = (id, name, level, activity, system = {}) => ({
  id, name, type: 'spell',
  system: { level, method: 'spell', prepared: 1, canPrepare: true, properties: ['concentration'], duration: { units: 'minute', value: 1 }, ...system },
  activities: [activity],
})
/**
 * A dnd5e character with what uses need, as activity5e gives them; its concentration dnd5e's, as
 * dnd5e-cards ports it, which equip() would put its own in place of. Its statuses and its effects
 * as Foundry derives them from what's on it.
 */
function character(data, gear) {
  const actor = new Character(data)
  const ability = actor.system.attributes.concentration
  Object.defineProperty(actor, 'concentration', { value: null, writable: true, configurable: true })
  equip(actor, gear)
  delete actor.concentration
  delete actor.beginConcentrating
  delete actor.endConcentration
  actor.system.attributes.concentration = { ...ability, limit: 1 }
  Object.defineProperty(actor, 'statuses', { configurable: true, get: () => new Set(actor.effects.flatMap(effect => [...(effect.statuses ?? [])])) })
  actor.allApplicableEffects = function* () { yield* actor.effects }
  actors.set(actor.id, actor)
  return actor
}
/** What dnd5e's sheet shows of an effect on the actor. */
const effectLook = (effect, fields = {}) => Object.assign(effect, {
  img: 'icons/magic/light/explosion-star-glow-silhouette.webp', type: 'base', origin: null, description: '',
  disabled: false, isSuppressed: false, isTemporary: true, duration: { remaining: 9, label: '9 Rounds', value: 10 }, updateDuration() {},
}, fields)

// Thorin, Alice's: a sorcerer who fights. Two Sorcery Points a Quickened Spell; Lucky, all three
// spent; Replicate Magic Item, three, with nothing to use; a Potion of Healing, used up as it runs
// out; Bardic Inspiration, an old-style resource; Bless and Hex, which he concentrates on; and a
// Rallying Cry that heals up to three allies.
const thorin = character({
  id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 1, dex: 3, con: 2, wis: 1, cha: 4 },
  skills: { prc: { ability: 'wis', value: 1 } }, hp: { value: 30, max: 38, temp: 0 },
}, {
  ac: 16,
  spells: { spell1: { value: 3, max: 4, level: 1 }, spell2: { value: 2, max: 3, level: 2 } },
  items: [
    {
      id: 'rapier', name: 'Rapier', type: 'weapon',
      system: { properties: ['fin'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'lunge', damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['piercing'] }], labels: { modifier: '+6', damage: [hits('1d8 + 3', 'piercing')] } }],
    },
    {
      id: 'sorcery', name: 'Sorcery Points', type: 'feat', system: { properties: [], uses: { max: 20, spent: 12, recovery: [{ period: 'lr' }] } },
      activities: [{ id: 'quicken', name: 'Quickened Spell', type: 'utility', activation: { type: 'bonus', value: 1 }, consumption: [{ type: 'itemUses', value: '2' }] }],
    },
    {
      id: 'lucky', name: 'Lucky', type: 'feat', system: { properties: [], uses: { max: 3, spent: 3, recovery: [{ period: 'lr' }] } },
      activities: [{ id: 'luck', type: 'utility', activation: { type: 'reaction', value: 1 }, consumption: [{ type: 'itemUses', value: '1' }] }],
    },
    { id: 'replicate', name: 'Replicate Magic Item', type: 'feat', system: { properties: [], uses: { max: 3, spent: 0, recovery: [{ period: 'lr' }] } } },
    {
      id: 'potion', name: 'Potion of Healing', type: 'consumable', system: { properties: [], quantity: 2, uses: { max: 1, spent: 0, autoDestroy: true } },
      activities: [{ id: 'drink', type: 'heal', affects: 'self', range: 'self', healing: { number: 2, denomination: 4, bonus: '2', types: ['healing'] }, labels: { damage: [hits('2d4 + 2', 'healing')] } }],
    },
    {
      id: 'rally', name: 'Rallying Cry', type: 'feat', system: { properties: [] },
      activities: [{ id: 'cry', type: 'heal', affects: 'ally', count: 3, activation: { type: 'bonus', value: 1 }, healing: { number: 1, denomination: 4, types: ['healing'] }, labels: { damage: [hits('1d4', 'healing')] } }],
    },
    spell('bless', 'Bless', 1, { id: 'blessing', type: 'utility', affects: 'ally', count: 3, concentration: true }),
    spell('hex', 'Hex', 1, { id: 'hexing', type: 'utility', affects: 'creature', concentration: true, activation: { type: 'bonus', value: 1 } }),
    // His own save spell, cast in Foundry: its card is his player's.
    ...[['thunder', 'Thunderclap'], ['step', 'Thunder Step']].map(([id, name]) => ({
      id, name, type: 'spell', system: { level: 0, method: 'spell', properties: [] },
      activities: [{ id: 'save', type: 'save', save: ['con'], dc: 14, damage: [{ number: 1, denomination: 6, types: ['thunder'] }] }],
    })),
  ],
})
thorin.system.details = { level: 6 }
thorin.system.attributes.spellcasting = 'cha'
thorin.system.attributes.spell = { dc: 14, attack: 6, mod: 4 }
thorin.spellcastingClasses = { sorcerer: { name: 'Sorcerer', spellcasting: { ability: 'cha', save: 14, attack: 6 } } }
thorin.system.attributes.inspiration = false
thorin.system.resources = { primary: { label: 'Bardic Inspiration', value: 3, max: 3, sr: true, lr: false } }
Object.assign(thorin.system.skills.prc, { total: 3, passive: 13 })
thorin.system.attributes.init.total = 3
for (const ability of Object.values(thorin.system.abilities)) {
  ability.save.value = ability.mod + (ability.saveProf.hasProficiency ? thorin.system.attributes.prof : 0)
}
alice.character = thorin
// Vex, Bob's: a cleric, two Channel Divinities, concentrating on Hunter's Mark.
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3, con: 1 }, hp: { value: 24, max: 30, temp: 0 } }, {
  ac: 14,
  items: [
    { id: 'channel', name: 'Channel Divinity', type: 'feat', system: { properties: [], uses: { max: 2, spent: 0, recovery: [{ period: 'sr' }] } } },
    spell('mark', "Hunter's Mark", 1, { id: 'marking', type: 'utility', affects: 'creature', concentration: true, activation: { type: 'bonus', value: 1 } }),
  ],
})
vex.system.details = { level: 6 }
bob.character = vex
// Foundry tells every client of a change to an actor or what's on it; the module then sends the
// character's sheet again.
for (const actor of [thorin, vex]) {
  const update = actor.update.bind(actor)
  actor.update = async changes => { await update(changes); await Hooks.callAll('updateActor', actor, changes, {}, 'gm') }
}
/** An effect deleted as Foundry deletes one: gone from its actor, then the hook every client runs. */
function deletable(effect) {
  effect.delete = async function () {
    const index = this.parent.effects.indexOf(this)
    if (index < 0) throw new Error(`ActiveEffect ${this.id} does not exist`)
    this.parent.effects.splice(index, 1)
    await Hooks.callAll('deleteActiveEffect', this, {}, game.user?.id)
    return this
  }
  return effect
}
/**
 * Start concentrating on a spell, as casting it does, with what it keeps up on others as its
 * dependents: deleted with it on the active Gamemaster's client, as dnd5e's ActiveEffect5e
 * _onDelete does (active-effect.mjs:666-670); then Foundry tells every client of the new effect.
 */
async function concentrate(actor, name, id, dependents = []) {
  const effect = effectLook(actor.concentrateOn(name, { id }), { description: `<p>Concentrating on ${name}.</p>` })
  effect.flags.dnd5e.dependents = dependents.map(({ uuid }) => ({ uuid }))
  const own = effect.delete.bind(effect)
  effect.delete = async function () {
    await own()
    if (game.user === game.users.activeGM) for (const dependent of dependents) await dependent.delete()
    return this
  }
  await Hooks.callAll('createActiveEffect', effect, {}, 'gm')
  return effect
}
let blessings = 0
/** Bless, as Thorin's casting of it puts it on another, Foundry's effect on them. */
async function blessed(actor) {
  const id = `blessed${String(++blessings).padStart(9, '0')}`
  const effect = deletable(effectLook({
    id, name: 'Bless', parent: actor, documentName: 'ActiveEffect', uuid: `${actor.uuid}.ActiveEffect.${id}`, statuses: new Set(), flags: {},
  }, { origin: 'Actor.thorin.Item.bless', description: '<p>Add 1d4 to attack rolls and saving throws.</p>' }))
  actor.effects.push(effect)
  await Hooks.callAll('createActiveEffect', effect, {}, 'gm')
  return effect
}

// The rest of the fight: Corvin, the Gamemaster's caster; Éowyn, an NPC the Gamemaster marked
// Friendly; Bram, a Neutral merchant; the goblin boss, a goblin and a wolf, Hostile; and a
// lurker whose token is Secret.
const npc = (id, name, ac, mods = {}) => {
  const actor = new Actor5e({ id, name, mods, hp: { value: 30, max: 30, temp: 0 } })
  actor.type = 'npc'
  actors.set(id, actor)
  equip(actor, { ac })
  return actor
}
const corvin = npc('corvin', 'Corvin', 15, { int: 3 })
equip(corvin, {
  ac: 15,
  // A save each, by name, for a card each.
  items: [['frost', 'Frost Breath'], ['storm', 'Ice Storm'], ['hail', 'Hail Burst']].map(([id, name]) => ({
    id, name, type: 'feat', system: { properties: [] }, activities: [{ id: 'save', type: 'save', save: ['con'], dc: 13, damage: [{ number: 2, denomination: 6, types: ['cold'] }] }],
  })),
})
const eowyn = npc('eowyn', 'Éowyn', 17)
const bram = npc('bram', 'Bram', 10)
const boss = npc('boss', 'Goblin Boss', 17, { str: 2 })
const goblin = npc('goblin', 'Goblin', 13)
const wolf = npc('wolf', 'Wolf', 13, { con: 1 })
const lurker = npc('lurker', 'Lurker', 14)
const DISPOSITION = { secret: -2, hostile: -1, neutral: 0, friendly: 1 }
// The tokens on the Gamemaster's canvas, each its actor's speaker, as Foundry finds one on the scene.
const place = (actor, disposition) => {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false, isLinked: true, disposition: DISPOSITION[disposition] }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  placeables.set(token.id, placeable)
  actor.speakerToken = placeable
  return placeable
}
const tokens = {
  thorin: place(thorin, 'friendly'), vex: place(vex, 'friendly'), eowyn: place(eowyn, 'friendly'), bram: place(bram, 'neutral'),
  boss: place(boss, 'hostile'), goblin: place(goblin, 'hostile'), wolf: place(wolf, 'hostile'), lurker: place(lurker, 'secret'),
  corvin: place(corvin, 'hostile'),
}
if (MIDI) canvas.scene.tokens.size = placeables.size
globalThis.fromUuidSync = uuid => {
  const parts = String(uuid).split('.')
  if (parts[0] === 'Scene') return Object.values(tokens).find(token => token.document.uuid === uuid)?.document ?? null
  if (parts[0] !== 'Actor') return null
  const actor = actors.get(parts[1]) ?? null
  if (parts.length === 2) return actor
  if (parts[2] === 'Item') return actor?.items?.get?.(parts[3]) ?? null
  if (parts[2] === 'ActiveEffect') return actor?.effects?.find?.(effect => effect.id === parts[3]) ?? null
  return null
}

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('gmContent', false)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin', 'vex'], rolls: true, attacks: true, prompts: true }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const kinds = () => sql(`select array_to_string("rollKinds", ',') from campaign where id = '${A}'`).split(',')
await until(() => kinds().includes('use'), 'the app to hear the game takes spells and features', 15_000)
const NEW_KINDS = ['endConcentration', 'spend', 'inspiration']
const told = posted.find(p => p.type === 'bridge.hello').data.features.rolls.kinds
if (NEW) {
  check(NEW_KINDS.every(kind => kinds().includes(kind)) && same(told.filter(kind => NEW_KINDS.includes(kind)), NEW_KINDS),
    `module 0.29.0's hello lists ending concentration, spending and Heroic Inspiration, and the app keeps them (${kinds().join(',')})`)
} else if (SKEW) {
  check(!NEW_KINDS.some(kind => told.includes(kind) || kinds().includes(kind)), `module 0.28.0 lists none of this round's kinds, nor does the app keep them (${kinds().join(',')})`)
} else {
  check(same(told.filter(kind => NEW_KINDS.includes(kind)), NEW_KINDS) && !NEW_KINDS.some(kind => kinds().includes(kind)),
    `module 0.29.0 lists this round's kinds; the app from before drops them, as kinds it doesn't know (${kinds().join(',')})`)
}

// ---- The fight ----
const fight = combat('fight1')
const join = (id, actor, initiative, token, fields = {}) => combatant(fight, id, actor, { name: actor.name, initiative, token: token.document, ...fields })
join('cbEowyn', eowyn, 21, tokens.eowyn)
join('cbBoss', boss, 19, tokens.boss)
join('cbThorin', thorin, 17, tokens.thorin)
join('cbBram', bram, 14, tokens.bram)
join('cbGoblin', goblin, 12, tokens.goblin)
join('cbVex', vex, 10, tokens.vex)
join('cbWolf', wolf, 8, tokens.wolf)
join('cbLurker', lurker, 5, tokens.lurker)
fight.getCombatantsByActor = actor => fight.combatants.filter(cb => cb.actor?.id === actor.id)
fight.started = true
fight.round = 1
fight.turn = 2
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight1'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => (sql('select count(*) from combat') === '1') && posted.some(p => p.type === 'combat.created'), 'the app to hear of the fight', 15_000)
/** The fight as the app keeps it. */
const storedCombat = () => sql('select data::text from combat')
const dispositions = () => Object.fromEntries(JSON.parse(storedCombat()).combatants.map(c => [c.name, c.disposition === undefined ? 'absent' : c.disposition]))
/** What the module sent of the fight, every time, as text. */
const combatPosts = () => posted.filter(p => p.type.startsWith('combat.')).map(p => JSON.stringify(p.data))
const SECRET_LEAK = /"disposition":(?:"secret"|-?\d)/
const sentCombat = posted.find(p => p.type === 'combat.created')?.data?.combat
const sentDispositions = sentCombat.combatants.map(c => [c.name, c.disposition === undefined ? 'absent' : c.disposition])
const EXPECTED = { 'Éowyn': 'friendly', 'Goblin Boss': 'hostile', Thorin: 'friendly', Bram: 'neutral', Goblin: 'hostile', Vex: 'friendly', Wolf: 'hostile', Lurker: null }
if (SKEW) {
  check(sentDispositions.every(([, d]) => d === 'absent') && Object.values(dispositions()).every(d => d === 'absent'),
    `module 0.28.0 sends no dispositions, and the app keeps none (${JSON.stringify(dispositions())})`)
} else {
  check(same(sentDispositions, Object.entries(EXPECTED)),
    `the module sends each token's disposition, Friendly, Neutral and Hostile, the Secret lurker's as none (${JSON.stringify(sentDispositions)})`)
  if (NEW) check(same(dispositions(), EXPECTED), `the app keeps them as sent (${JSON.stringify(dispositions())})`)
  // Its combatants are loose: it keeps what it's sent, and reads nothing of what it doesn't know.
  else check(same(dispositions(), EXPECTED), `the app from before keeps the fight as sent, and takes it (${JSON.stringify(dispositions())})`)
}
check(!SECRET_LEAK.test(storedCombat()) && !combatPosts().some(text => SECRET_LEAK.test(text)), 'no disposition is ever a number or "secret", in what the module sent or what the app keeps')
// With Gamemaster-only information on, the same: the next turn's snapshot.
settings.set('gmContent', true)
let sentBefore = combatPosts().length
fight.turn = 3
await Hooks.callAll('combatTurnChange', fight, { round: 1, turn: 2, combatantId: 'cbThorin' }, { round: 1, turn: 3, combatantId: 'cbBram' })
await until(() => combatPosts().length > sentBefore, 'the next turn to be sent', 15_000)
await wait(1500)
check(!SECRET_LEAK.test(storedCombat()) && !combatPosts().some(text => SECRET_LEAK.test(text)) && JSON.parse(storedCombat()).combatants.every(c => 'hp' in c),
  `nor with Gamemaster-only information on, every creature's hit points sent with it (${combatPosts().length} combat events sent)`)
settings.set('gmContent', false)
fight.turn = 2
await Hooks.callAll('combatTurnChange', fight, { round: 1, turn: 3, combatantId: 'cbBram' }, { round: 1, turn: 2, combatantId: 'cbThorin' })

// Alice plays Thorin; Bob follows the campaign's invite and chooses Vex.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', 'Ashlands', '${A}', 'thorin', 'e2e-user', now())`)
await setup.reload()
const inviteUrl = await setup.getByRole('article', { name: 'Ashlands' }).locator('code').first().textContent()
await setupView.close()

// ---- What the module told the app, and what the app keeps ----
/** The message as the module last told the app of it, created or updated. */
const toldOf = id => posted.filter(p => ['chat.message.created', 'chat.message.updated'].includes(p.type) && (p.data?.message?.id === id)).at(-1)?.data?.message
const storedMessage = id => JSON.parse(sql(`select coalesce(data::text, 'null') from chat_message where "messageId" = '${id}' and "campaignId" = '${A}'`) || 'null')
const latestRequest = () => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, role, payload, result from roll_request order by "createdAt" desc limit 1) r`) || 'null')
const requests = () => Number(sql('select count(*) from roll_request'))
const promptRow = id => JSON.parse(sql(`select row_to_json(p)::text from (select "closedAt" is not null as closed, "closedReason" as reason from roll_prompt where "promptId" = '${id}') p`) || 'null')
const opened = () => posted.filter(p => p.type === 'roll.prompt.opened').map(p => p.data.prompt)
const byGm = id => sql(`select "byGm" from chat_message where "messageId" = '${id}' and "campaignId" = '${A}'`)
const sheetOf = actorId => JSON.parse(sql(`select coalesce(data::text, 'null') from actor_sheet where "actorId" = '${actorId}' and "campaignId" = '${A}'`) || 'null')
const madeFor = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const useCard = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.use === id)
const latestMessage = () => game.messages.contents.at(-1)
const lineOf = id => { const m = messages.get(id); return m && { content: m.content, author: m.author?.id, actor: m.speaker?.actor, flags: m.flags?.['sending-stone'], whisper: m.whisper } }

// ---- Alice's phone and tablet, and Bob's phone ----
async function browse({ width, height, scheme, who = ALICE, path = '/characters/sheet-thorin', toasts = false }) {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, colorScheme: scheme })
  await view.addCookies([who])
  if (toasts) await view.addInitScript(() => { try { localStorage.setItem('sending-stone:roll-toasts', 'on') } catch {} })
  await view.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  if (path) await page.goto(`${BASE}${path}`)
  const nav = page.getByRole('navigation', { name: 'Table' })
  const status = page.getByRole('region', { name: 'Your rolls' }).getByRole('status')
  return {
    width, view, page, nav, scheme, status,
    sheet: page.getByRole('region', { name: 'Character' }),
    log: page.getByRole('list', { name: 'Chat log' }),
    banner: page.getByRole('region', { name: 'Your Gamemaster asks' }),
    panel: page.getByRole('tabpanel'),
    // A tab's name may carry a count after it, as Effects' does while something is concentrated on.
    tab: name => page.getByRole('tablist', { name: 'Character sheet' }).getByRole('tab', { name: new RegExp(`^${name}\\b`) }).click(),
    chat: () => nav.getByRole('button', { name: /^Chat/ }).click(),
    character: () => nav.getByRole('button', { name: /^Character/ }).click(),
    combat: () => nav.getByRole('button', { name: /^Combat/ }).click(),
  }
}
const phone = await browse({ width: 390, height: 844, scheme: 'light' })
const tablet = await browse({ width: 768, height: 1024, scheme: 'dark', toasts: true })
for (const who of [phone, tablet]) await who.page.getByRole('tablist', { name: 'Character sheet' }).waitFor()
const isDark = page => page.evaluate(() => document.documentElement.classList.contains('dark'))
async function theme(who, scheme) {
  await who.page.emulateMedia({ colorScheme: scheme })
  await until(async () => (await isDark(who.page)) === (scheme === 'dark'), `the ${scheme} theme at ${who.width} px`, 10_000)
  who.scheme = scheme
}
/** A shot of the page, or of a part of it, at this width, in its theme. */
async function shoot(who, name, locator, dir = SHOTS) {
  if (!SHOTS) return
  await who.page.waitForTimeout(350)
  const path = `${dir}/${name}-${who.width}-${who.scheme}${VARIANT}.png`
  const style = '[id^=dice-canvas-threejs] { visibility: hidden !important; }'
  if (locator) {
    await locator.scrollIntoViewIfNeeded()
    await locator.screenshot({ path, style })
  } else await who.page.screenshot({ path, style })
}
/** Shots in both themes, the page left in the one it had. */
async function shootBoth(who, name, locator, dir = SHOTS) {
  if (!SHOTS) return
  const was = who.scheme
  for (const scheme of [was, was === 'light' ? 'dark' : 'light']) {
    await theme(who, scheme)
    await shoot(who, name, typeof locator === 'function' ? locator() : locator, dir)
  }
  await theme(who, was)
}
const forceD20 = (page, value) => page.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, value)
const unforce = page => page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
/** Tap it, and once the app has sent what it asks for and the game has made it, both. */
async function sent(tap, what) {
  const before = requests()
  await tap()
  await until(() => requests() > before, `${what} to be sent`)
  const request = latestRequest()
  await until(() => ['done', 'failed'].includes(latestRequest().status), `${what} to be made`)
  return { request, made: latestRequest() }
}
/** What the app answers a request from this page, as JSON where it is. */
const call = (page, path, { method = 'GET', body } = {}) => page.evaluate(async ({ path, method, body }) => {
  const response = await fetch(path, { method, ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), redirect: 'manual' })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: response.status, text, json }
}, { path, method, body })
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }
const classesOf = locator => locator.evaluate(el => [...el.classList])
/** The newest message in a chat whose text has this in it, once there is one, after so many. */
async function messageWith(who, text, after = 0) {
  const items = who.log.locator(':scope > li')
  let index = -1
  await until(async () => {
    index = await items.evaluateAll((lis, text) => lis.map(li => li.textContent).findLastIndex(t => t.includes(text)), text)
    return index >= after
  }, `"${text}" in the chat at ${who.width} px`)
  return items.nth(index)
}
const chatCount = who => who.log.locator(':scope > li').count()
/**
 * WCAG contrast of an element's text against what it's drawn on: its own background and its
 * ancestors', blended over the first opaque one, as the browser paints them.
 */
const contrastOf = locator => locator.evaluate(async el => {
  await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming?.().iterations !== Infinity).map(a => a.finished.catch(() => {})))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const paint = css => { ctx.fillStyle = '#010203'; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1) }
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
/** Each text's contrast in both themes, where it is now, the page left in its theme. */
async function contrastsOf(who, texts) {
  const was = who.scheme
  const ratios = {}
  for (const scheme of ['light', 'dark']) {
    await theme(who, scheme)
    for (const [what, locator] of Object.entries(texts)) ratios[`${what} (${scheme})`] = await contrastOf(locator)
  }
  await theme(who, was)
  return ratios
}
const allAA = ratios => Object.values(ratios).every(ratio => ratio >= 4.5)
/** Small texts measured in both themes at the end: [what, how to find it again on the phone]. */
const measured = []
const measure = (what, find) => measured.push({ what, find })

// =================================================================================================
// The combat tracker: Éowyn as an ally, Bram in grey
// =================================================================================================
await phone.combat()
const rowOfCombatant = (who, name) => who.page.locator('section[aria-labelledby="initiative-heading"] ol > li').filter({ has: who.page.getByText(name, { exact: true }) })
await rowOfCombatant(phone, 'Lurker').waitFor()
const trackerLook = async (who, name) => {
  const row = rowOfCombatant(who, name)
  return { box: await classesOf(row.locator(':scope > span').first()), role: (await row.locator('span.text-xs.text-text-secondary').allTextContents()).filter(t => !/Defeated/.test(t)) }
}
{
  const ally = await trackerLook(phone, 'Éowyn')
  const neutral = await trackerLook(phone, 'Bram')
  const foe = await trackerLook(phone, 'Goblin Boss')
  const lurking = await trackerLook(phone, 'Lurker')
  const party = await trackerLook(phone, 'Vex')
  if (NEW) {
    check(ally.box.includes('bg-party/15') && ally.box.includes('text-party') && same(ally.role, ['Ally']),
      `the tracker draws Éowyn, marked Friendly, as the party's allies are, "Ally" (${JSON.stringify(ally)})`)
    check(neutral.box.includes('bg-text-secondary/15') && neutral.box.includes('text-text-secondary') && same(neutral.role, ['Neutral']),
      `and Bram, Neutral, in grey, "Neutral" (${JSON.stringify(neutral)})`)
    check(same(foe.box, lurking.box) && foe.role.length === 0 && lurking.role.length === 0 && !foe.box.includes('bg-party/15') && !(await phone.page.locator('section[aria-labelledby="initiative-heading"]').textContent()).includes('Enemy'),
      `the goblin boss, Hostile, and the Secret lurker are drawn alike, as before, never called an enemy (${JSON.stringify([foe, lurking])})`)
    measure('Tracker: Ally role', p => rowOfCombatant(p, 'Éowyn').getByText('Ally', { exact: true }))
    measure('Tracker: Neutral role', p => rowOfCombatant(p, 'Bram').getByText('Neutral', { exact: true }))
    measure('Tracker: Ally initiative', p => rowOfCombatant(p, 'Éowyn').locator(':scope > span').first())
    measure('Tracker: Neutral initiative', p => rowOfCombatant(p, 'Bram').locator(':scope > span').first())
  } else {
    check(same(ally.box, foe.box) && same(neutral.box, foe.box) && ally.role.length === 0 && neutral.role.length === 0 && party.box.includes('bg-party/15'),
      `${SKEW ? 'with module 0.28.0' : 'the app from before'}, Éowyn and Bram are drawn as any other creature, the party as before (${JSON.stringify([ally, neutral, party])})`)
  }
}
await shootBoth(phone, 'tracker', phone.page.locator('section[aria-labelledby="initiative-heading"]'))
await phone.character()

// =================================================================================================
// The target picker: Allies and Others, pills, the shield, search
// =================================================================================================
const lunge = phone.panel.getByRole('button', { name: 'Rapier attack, +6' })
const picker = phone.page.getByRole('dialog', { name: 'Rapier attack' })
/** A picker's sections, each its heading and the names its rows read as, the pills with them. */
const sectionsOf = dialog => dialog.evaluate(el => [...el.querySelectorAll('ul')].filter(ul => ul.querySelector('li > button')).map(ul => ({
  heading: ul.getAttribute('aria-labelledby') ? document.getElementById(ul.getAttribute('aria-labelledby'))?.textContent : null,
  rows: [...ul.querySelectorAll(':scope > li > button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
})))
/** Rows of a picker: whether each has the shield and the ally's edge. */
const markingsOf = dialog => dialog.locator('ul > li > button').evaluateAll(buttons => buttons.map(b => ({
  name: b.querySelector('span.font-semibold')?.textContent,
  shield: !!b.querySelector('.lucide-shield-check.text-party'), crosshair: !!b.querySelector('.lucide-crosshair.text-attack'),
  edge: b.classList.contains('border-l-4') && b.classList.contains('border-l-party'),
})))
const searchbox = dialog => dialog.getByRole('searchbox', { name: 'Search targets by name' })
const liveText = dialog => dialog.locator('p[aria-live="polite"]').textContent()
const focusedIn = page => page.evaluate(() => ({ tag: document.activeElement?.tagName, type: document.activeElement?.getAttribute('type'), name: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() }))

await phone.tab('Actions')
await lunge.waitFor()
let firstAttack = null
if (!OLDAPP) {
  await lunge.click()
  await picker.waitFor()
  await picker.locator('ul > li > button').first().waitFor()
  const focus = await focusedIn(phone.page)
  const sections = await sectionsOf(picker)
  const OTHERS = NEW ? ['Goblin Boss', 'Bram, Neutral', 'Goblin', 'Wolf', 'Lurker'] : ['Éowyn', 'Goblin Boss', 'Bram', 'Goblin', 'Wolf', 'Lurker']
  const ALLIES = NEW ? ['Éowyn, Ally', 'Vex, Ally'] : ['Vex, Ally']
  check(same(sections, [{ heading: 'Others', rows: OTHERS }, { heading: 'Allies', rows: ALLIES }]),
    NEW ? `an attack lists the Others first, Bram with a Neutral pill, then the Allies, Éowyn, marked Friendly, among them, each in turn order: ${JSON.stringify(sections)}`
      : `with module 0.28.0, Éowyn and Bram are Others, no Neutral pill; Vex, of the party, an Ally: ${JSON.stringify(sections)}`)
  const marks = await markingsOf(picker)
  const allyNames = NEW ? ['Éowyn', 'Vex'] : ['Vex']
  check(marks.every(m => allyNames.includes(m.name) ? (m.shield && m.edge && !m.crosshair) : (m.crosshair && !m.shield && !m.edge)),
    `each ally's row has the shield and the ally's edge, each other's the crosshair (${JSON.stringify(marks)})`)
  check(await searchbox(picker).isVisible() && await searchbox(picker).getAttribute('placeholder') === 'Search' && focus.tag !== 'INPUT',
    `seven to pick from, it offers a search, nothing typed in it as it opens, so no keyboard comes up (${JSON.stringify(focus)})`)
  // Typed as a player may, without the accent: Éowyn's found.
  await searchbox(picker).fill('eowyn')
  await until(async () => (await sectionsOf(picker)).flatMap(s => s.rows).length === 1, 'the search to narrow the list')
  check(same(await sectionsOf(picker), [{ heading: null, rows: [NEW ? 'Éowyn, Ally' : 'Éowyn'] }]) && await liveText(picker) === '1 target found',
    `"eowyn" finds Éowyn alone, her section's heading gone with the other, and a screen reader hears "1 target found"`)
  await shootBoth(phone, 'picker-search', picker)
  await searchbox(picker).fill('zz')
  await picker.getByText('No one matches', { exact: true }).waitFor()
  check(await liveText(picker) === '0 targets found' && await picker.getByRole('button', { name: 'No target' }).isVisible(), '"zz" matches no one, and "No target" is still there')
  // Escape clears what's typed, the picker staying open; a second closes it.
  await searchbox(picker).press('Escape')
  await wait(300)
  check(await picker.isVisible() && await searchbox(picker).inputValue() === '' && (await sectionsOf(picker)).length === 2, 'Escape clears the search, the picker still open, both sections back')
  await shootBoth(phone, 'picker-sections', picker)
  if (NEW) {
    const ratios = await contrastsOf(phone, {
      Ally: picker.locator('span.rounded-full').filter({ hasText: 'Ally' }).first(),
      Neutral: picker.locator('span.rounded-full').filter({ hasText: 'Neutral' }).first(),
      heading: picker.locator('h3').first(),
    })
    check(allAA(ratios), `the Ally and Neutral pills and the headings are at least 4.5:1 in both themes: ${JSON.stringify(ratios)}`)
  }
  await searchbox(picker).press('Escape')
  await picker.waitFor({ state: 'detached' })
  check(true, 'a second Escape, the box empty, closes the picker')
  // The attack, at the goblin, Attack Roll Visibility "None": no hit or miss is told.
  await forceD20(phone.page, 15)
  await lunge.click()
  await picker.waitFor()
  const { request, made } = await sent(() => picker.getByRole('button', { name: /^Goblin$/ }).click(), 'the attack')
  await unforce(phone.page)
  const attackMessage = messages.get(made.result.messageId)
  const total = attackMessage?.rolls.find(roll => roll instanceof CONFIG.Dice.D20Roll)?.total
  // The result says whether it hit as Foundry shows players: not under Attack Roll Visibility
  // "None"; under Midi, by its Auto Check Hits, "all".
  check(request.payload.target?.combatantId === 'cbGoblin' && made.status === 'done' && total >= 13 && made.result.attack?.outcome === (MIDI ? 'hit' : null),
    `the rapier hits the goblin, a 15, ${total}, against AC 13, which the result says only as Foundry shows players it (${JSON.stringify(made.result.attack)})`)
  firstAttack = { request, made }
  // The same picker on the tablet, searched.
  await tablet.tab('Actions')
  const tabletPicker = tablet.page.getByRole('dialog', { name: 'Rapier attack' })
  await tablet.panel.getByRole('button', { name: 'Rapier attack, +6' }).click()
  await tabletPicker.locator('ul > li > button').first().waitFor()
  check(same(await sectionsOf(tabletPicker), sections), 'on the tablet, the same sections, in the same order')
  await shootBoth(tablet, 'picker-sections', tabletPicker)
  await searchbox(tabletPicker).fill('bram')
  await until(async () => (await sectionsOf(tabletPicker)).flatMap(s => s.rows).length === 1, 'the search to narrow the list on the tablet')
  await shootBoth(tablet, 'picker-search', tabletPicker)
  await searchbox(tabletPicker).press('Escape')
  await searchbox(tabletPicker).press('Escape')
  await tabletPicker.waitFor({ state: 'detached' })
} else {
  note("the app from before keeps its own picker, which isn't this round's to test")
}

// A use that helps, to tick: the player and the allies first, then the others; a ticked row kept
// whatever's searched, and sent.
const cry = phone.panel.getByRole('button', { name: 'Rallying Cry healing, 1d4' })
const crying = phone.page.getByRole('dialog', { name: 'Rallying Cry' })
if (!OLDAPP) {
  await cry.click()
  await crying.waitFor()
  await crying.getByRole('checkbox').first().waitFor()
  const ticks = await sectionsOf(crying)
  const ALLIES = NEW ? ['Self, You', 'Éowyn, Ally', 'Vex, Ally'] : ['Self, You', 'Vex, Ally']
  const OTHERS = NEW ? ['Goblin Boss', 'Bram, Neutral', 'Goblin', 'Wolf', 'Lurker'] : ['Éowyn', 'Goblin Boss', 'Bram', 'Goblin', 'Wolf', 'Lurker']
  check(same(ticks, [{ heading: 'Allies', rows: ALLIES }, { heading: 'Others', rows: OTHERS }]),
    `a use that helps lists the player first, then the allies, then the others: ${JSON.stringify(ticks)}`)
  const you = await contrastsOf(phone, { You: crying.locator('span.rounded-full').filter({ hasText: 'You' }).first() })
  check(allAA(you), `and the You pill: ${JSON.stringify(you)}`)
  await crying.getByRole('checkbox', { name: /^Vex/ }).click()
  await searchbox(crying).fill('gob')
  await until(async () => (await sectionsOf(crying)).flatMap(s => s.rows).length === 3, 'the search to narrow the ticks')
  const narrowed = await sectionsOf(crying)
  check(same(narrowed, [{ heading: 'Allies', rows: ['Vex, Ally'] }, { heading: 'Others', rows: ['Goblin Boss', 'Goblin'] }]) && await liveText(crying) === '2 targets found'
    && await crying.getByRole('checkbox', { name: /^Vex/ }).getAttribute('aria-checked') === 'true',
    `"gob" finds the two goblins, and Vex, ticked, stays: ${JSON.stringify(narrowed)}`)
  await shootBoth(phone, 'picker-ticked', crying)
  await crying.getByRole('checkbox', { name: /^Goblin Boss/ }).click()
  await searchbox(crying).fill('')
  const { request } = await sent(() => crying.getByRole('button', { name: /at 2 targets$/ }).click(), 'the Rallying Cry')
  check(same(request.payload.targets.map(t => t.combatantId).sort(), ['cbBoss', 'cbVex']),
    `both ticked are sent, Vex among them, though the search had hidden none of them (${JSON.stringify(request.payload.targets)})`)
}

// =================================================================================================
// Ending a concentration
// =================================================================================================
await phone.tab('Character')
const conditionsOf = who => who.page.getByRole('list', { name: 'Conditions' })
const chipOf = who => conditionsOf(who).getByRole('button', { name: /^Concentrating/ })
const vexBless = await blessed(vex)
let blessing = await concentrate(thorin, 'Bless', 'bless', [vexBless])
await chipOf(phone).waitFor({ timeout: 15_000 })
await until(() => sheetOf('vex')?.effects?.some(section => section.effects.some(effect => effect.name === 'Bless')), "Vex's Bless in the app", 15_000)
if (NEW) {
  check(sameJson(sheetOf('thorin').concentration, { effects: [{ id: blessing.id, name: 'Bless', item: 'bless' }] }),
    `the module sends what Thorin concentrates on, by its effect, named for its item (${JSON.stringify(sheetOf('thorin').concentration)})`)
} else if (SKEW) {
  check(!('concentration' in sheetOf('thorin')), 'module 0.28.0 sends nothing of what he concentrates on but the Concentrating condition')
} else {
  note(`the app from before keeps the sheet ${'concentration' in sheetOf('thorin') ? 'with' : 'without'} its concentration`)
}
// The Effects tab, opened on the concentration's row.
const effectRow = (who, name) => who.panel.locator('details').filter({ has: who.page.locator('summary', { hasText: name }) }).first()
async function openEffect(who, name) {
  await who.tab('Effects')
  const row = effectRow(who, name)
  await row.waitFor()
  if (await row.getAttribute('open') === null) await row.locator('summary').click()
  return row
}
// The game asks for his concentration check.
let count = opened().length
let asked = await thorin.challengeConcentration({ dc: 10 })
const askedId = `${asked.id}-thorin`
await phone.banner.waitFor({ timeout: 15_000 })
check(/Concentration check/.test(await phone.banner.textContent()) && promptRow(askedId)?.closed === false, 'the game asks for his concentration check, and the phone asks Alice for it')
const confirmOf = (who, name) => who.page.getByRole('dialog', { name: `End concentration on ${name}?` })
if (NEW) {
  // The Effects row first: what it concentrates on, and End.
  let row = await openEffect(phone, 'Concentrating: Bless')
  const lead = row.getByText('Concentrating on Bless', { exact: true })
  const end = row.getByRole('button', { name: 'End concentration on Bless' })
  await lead.waitFor()
  await end.waitFor()
  check(await lead.isVisible() && await end.isVisible() && (await end.textContent()).trim() === 'End' && await phone.page.locator('summary').filter({ hasText: 'Concentrating: Bless' }).getByRole('button').count() === 0,
    'opened, his concentration\'s row says what it\'s on, "Concentrating on Bless", with End, inside the row, never on its summary')
  await shootBoth(phone, 'concentration-effects', row)
  const ratios = await contrastsOf(phone, { lead: lead, End: end })
  check(allAA(ratios), `what it's on, and End, are at least 4.5:1 in both themes: ${JSON.stringify(ratios)}`)
  await phone.tab('Character')
  // The chip: one concentration, so a tap asks to end it.
  const before = requests()
  await chipOf(phone).click()
  let confirm = confirmOf(phone, 'Bless')
  await confirm.waitFor()
  check(await confirm.getByText('What it keeps up on your allies ends too.', { exact: true }).isVisible()
    && await confirm.getByRole('button', { name: 'End', exact: true }).isVisible() && await confirm.getByRole('button', { name: 'Keep', exact: true }).isVisible()
    && requests() === before,
    'the Concentrating chip asks first: "End concentration on Bless?", that what it keeps up on allies ends too, End or Keep, nothing sent yet')
  await shootBoth(phone, 'concentration-confirm', confirm)
  await confirm.getByRole('button', { name: 'Keep', exact: true }).click()
  await confirm.waitFor({ state: 'detached' })
  await wait(800)
  check(requests() === before && thorin.concentration.effects.size === 1, 'Keep keeps it: nothing sent')
  await chipOf(phone).click()
  confirm = confirmOf(phone, 'Bless')
  await confirm.waitFor()
  const { request, made } = await sent(() => confirm.getByRole('button', { name: 'End', exact: true }).click(), 'ending the concentration')
  check(same({ kind: request.payload.kind, concentration: request.payload.concentration }, { kind: 'endConcentration', concentration: { effect: blessing.id } }) && made.status === 'done' && made.result.messageId === null,
    `End sends the effect to end, and the game ends it, posting nothing (${JSON.stringify(request.payload.concentration)})`)
  check(thorin.ended.at(-1) === 'Bless' && thorin.concentration.effects.size === 0 && !vex.effects.includes(vexBless),
    'Thorin no longer concentrates on Bless, and Bless is gone from Vex with it, as dnd5e ends what depends on it')
  await until(() => !sheetOf('vex')?.effects?.some(section => section.effects.some(effect => effect.name === 'Bless')), "Vex's sheet in the app without Bless", 15_000)
  check(true, "and the app's copy of Vex's sheet no longer lists it")
  await phone.status.getByText('Ended at the table').waitFor({ timeout: 15_000 })
  check(/Concentration on Bless/.test(await phone.status.textContent()), `the tray says so: "${await phone.status.textContent()}"`)
} else {
  // Older on one side or the other: the chip opens Effects, as before, and nothing ends it here.
  await chipOf(phone).click()
  await until(async () => await phone.page.getByRole('tab', { name: /^Effects\b/ }).getAttribute('aria-selected') === 'true', 'the Effects tab')
  check(await phone.page.getByRole('dialog').count() === 0, 'the Concentrating chip opens the Effects tab, as before, asking nothing')
  const row = await openEffect(phone, 'Concentrating: Bless')
  check(await row.getByRole('button', { name: /^End concentration/ }).count() === 0 && await row.getByText('Concentrating on Bless', { exact: true }).count() === 0,
    'and its row offers no End')
  await phone.tab('Character')
  // The Gamemaster ends it in Foundry.
  await thorin.endConcentration(blessing.id)
  check(thorin.concentration.effects.size === 0 && !vex.effects.includes(vexBless), 'the Gamemaster ends it in Foundry, Bless going from Vex with it')
}
if (SKEW) {
  await wait(3000)
  check(promptRow(askedId)?.closed === false, 'module 0.28.0 leaves the concentration check asked once it ends, the known limit')
  const { deleteMessage } = await import('./fvtt/dnd5e-cards.mjs')
  await deleteMessage(asked)
  await until(() => promptRow(askedId)?.closed === true, 'the card deleted to close it', 15_000)
} else {
  await until(() => promptRow(askedId)?.closed === true, 'the concentration check to close', 15_000)
  check(promptRow(askedId).reason === 'gone' && posted.some(p => p.type === 'roll.prompt.closed' && p.data.id === askedId && p.data.reason === 'gone'),
    'his concentration ended, the check the game was asking closes, "gone"')
  await until(async () => (await phone.banner.count()) === 0, 'the banner to go', 15_000)
  // A hello doesn't bring it back.
  const hellos = posted.filter(p => p.type === 'bridge.hello').length
  await Hooks.callAll('sendingStone.helloWanted', 'camp-ash')
  await until(() => posted.filter(p => p.type === 'bridge.hello').length > hellos, 'the hello to be sent again', 15_000)
  await wait(2000)
  const again = posted.filter(p => p.type === 'bridge.hello').at(-1)
  check(!(again.data.prompts ?? []).some(p => p.id === askedId) && promptRow(askedId).closed === true && (await phone.banner.count()) === 0,
    "a hello after doesn't list it, and the app doesn't ask it again")
}

if (NEW) {
  // Two at once: the chip's menu, each to end.
  thorin.system.attributes.concentration.limit = 2
  const vexBless2 = await blessed(vex)
  blessing = await concentrate(thorin, 'Bless', 'bless', [vexBless2])
  const hexing = await concentrate(thorin, 'Hex', 'hex')
  await until(() => sheetOf('thorin')?.concentration?.effects?.length === 2, 'both concentrations in the app', 15_000)
  await until(async () => /Bless, Hex/.test(await chipOf(phone).textContent()), 'the chip to name both')
  await chipOf(phone).click()
  const menu = phone.page.getByRole('menu', { name: 'Concentrating' })
  await menu.waitFor()
  const items = await menu.getByRole('menuitem').allTextContents()
  check(same(items.map(t => t.trim()), ['End concentration on Bless', 'End concentration on Hex']), `with two, the chip opens a menu of them, each to end: ${JSON.stringify(items)}`)
  await shootBoth(phone, 'concentration-menu', menu)
  await menu.getByRole('menuitem', { name: 'End concentration on Hex' }).click()
  const confirm = confirmOf(phone, 'Hex')
  await confirm.waitFor()
  const { request, made } = await sent(() => confirm.getByRole('button', { name: 'End', exact: true }).click(), 'ending Hex')
  check(request.payload.concentration?.effect === hexing.id && made.status === 'done' && thorin.ended.at(-1) === 'Hex'
    && same([...thorin.concentration.effects].map(e => e.id), [blessing.id]) && vex.effects.includes(vexBless2),
    'ending Hex from the menu, after its confirm, ends Hex alone: Bless, and Vex\'s blessing, stay')
  await until(() => sheetOf('thorin')?.concentration?.effects?.length === 1, 'one concentration in the app', 15_000)
  // The last from its Effects row, on the tablet.
  const row = await openEffect(tablet, 'Concentrating: Bless')
  await row.getByRole('button', { name: 'End concentration on Bless' }).click()
  const asking = confirmOf(tablet, 'Bless')
  await asking.waitFor()
  await shootBoth(tablet, 'concentration-confirm', asking)
  await asking.getByRole('button', { name: 'Keep', exact: true }).click()
  await asking.waitFor({ state: 'detached' })
  await shootBoth(tablet, 'concentration-effects', effectRow(tablet, 'Concentrating: Bless'))
  await effectRow(tablet, 'Concentrating: Bless').getByRole('button', { name: 'End concentration on Bless' }).click()
  await confirmOf(tablet, 'Bless').waitFor()
  const ended = await sent(() => confirmOf(tablet, 'Bless').getByRole('button', { name: 'End', exact: true }).click(), 'ending Bless from Effects')
  check(ended.request.payload.concentration?.effect === blessing.id && ended.made.status === 'done' && thorin.concentration.effects.size === 0 && !vex.effects.includes(vexBless2),
    'from its Effects row, on the tablet, the last ends too, and Vex\'s blessing with it')
  const toast = tablet.page.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]').filter({ hasText: 'Concentration on Bless' })
  await until(async () => /ended/i.test(await toast.first().textContent().catch(() => '')), 'the toast to say it ended', 15_000)
  check(true, `the tablet's toast says it ended: "${await toast.first().textContent()}"`)
  await until(async () => await effectRow(tablet, 'Concentrating: Bless').count() === 0, 'the row to go', 15_000)
  thorin.system.attributes.concentration.limit = 1
}

// =================================================================================================
// Spending charges
// =================================================================================================
const spendButton = (who, name) => who.panel.getByRole('button', { name: new RegExp(`^Spend ${name}: \\d+ of \\d+ left$`) })
const popoverOf = (who, name) => who.page.getByRole('dialog', { name: `Spend ${name}` })
const item = id => thorin.items.get(id)
const usesLeft = id => { const uses = item(id).system.uses; return uses.max - uses.spent }
/** Spend so many from a counter's popover: what was sent, what was made, and the line. */
async function spend(who, name, n, { shot } = {}) {
  const before = requests()
  await spendButton(who, name).click()
  const pop = popoverOf(who, name)
  await pop.waitFor()
  for (let i = 1; i < n; i++) await pop.getByRole('button', { name: 'One more' }).click()
  await pop.getByRole('button', { name: `Spend ${n}`, exact: true }).waitFor()
  if (shot) await shootBoth(who, shot, pop)
  check(requests() === before, `opening ${name}'s popover, and choosing ${n}, spends nothing yet`)
  const result = await sent(() => pop.getByRole('button', { name: `Spend ${n}`, exact: true }).click(), `spending ${name}`)
  return { ...result, line: result.made.result?.messageId ? messages.get(result.made.result.messageId) : null }
}
/** Its chat line in the app, as text, once it's there. */
const lineInChat = async (who, text) => (await messageWith(who, text)).textContent()

if (NEW) {
  await phone.tab('Features')
  const sorcery = spendButton(phone, 'Sorcery Points')
  await sorcery.waitFor()
  check(await sorcery.getAttribute('aria-label') === 'Spend Sorcery Points: 8 of 20 left', 'Sorcery Points\' count, 8 of 20, is a button: "Spend Sorcery Points: 8 of 20 left"')
  // The popover: from 1, up to as many as are left.
  await sorcery.click()
  let pop = popoverOf(phone, 'Sorcery Points')
  await pop.waitFor()
  const fewer = pop.getByRole('button', { name: 'One fewer' })
  const more = pop.getByRole('button', { name: 'One more' })
  check(/1\s*of 8/.test(await pop.textContent()) && await fewer.getAttribute('aria-disabled') === 'true' && await more.getAttribute('aria-disabled') !== 'true'
    && await pop.getByRole('button', { name: 'Spend 1', exact: true }).isVisible(),
    `its popover opens on 1 of the 8 left, One fewer greyed, and "Spend 1" (${(await pop.textContent()).replace(/\s+/g, ' ')})`)
  for (let i = 0; i < 7; i++) await more.click()
  // Greyed at 8, it's still a button, so focus isn't lost from it: tapped all the same, it stays.
  await more.click({ force: true })
  check(/8\s*of 8/.test(await pop.textContent()) && await more.getAttribute('aria-disabled') === 'true', 'One more stops at the 8 left, greyed there')
  await pop.press('Escape')
  await pop.waitFor({ state: 'detached' })
  const { request, made, line } = await spend(phone, 'Sorcery Points', 2, { shot: 'spend-popover' })
  check(same({ kind: request.payload.kind, counter: request.payload.counter, count: request.payload.count, mode: request.payload.mode, explicit: request.payload.explicit, extras: request.payload.extras, dice: request.payload.dice },
    { kind: 'spend', counter: { item: 'sorcery' }, count: 2, ...PLAIN }) && made.status === 'done',
    `"Spend 2" sends the counter the sheet names and how many, throwing no dice (${JSON.stringify({ counter: request.payload.counter, count: request.payload.count })})`)
  check(same(lineOf(line?.id), { content: '<p>Spends 2 · Sorcery Points</p>', author: 'alice', actor: 'thorin', flags: { request: request.id }, whisper: [] }) && usesLeft('sorcery') === 6,
    `the game spends them, 6 left, and posts for everyone, as Thorin, by Alice: "${line?.content}"`)
  await phone.status.getByText('Spent 2 at the table').waitFor({ timeout: 15_000 })
  check(/Sorcery Points/.test(await phone.status.textContent()), `the tray says so: "${await phone.status.textContent()}"`)
  await until(async () => await spendButton(phone, 'Sorcery Points').getAttribute('aria-label') === 'Spend Sorcery Points: 6 of 20 left', 'the count to move', 15_000)
  check(true, 'and the count moves to 6 of 20, as the game sends the sheet')
  await phone.chat()
  const chatLine = await lineInChat(phone, 'Spends 2 · Sorcery Points')
  check(!/\b6\b|left/.test(chatLine.replace('Spends 2 · Sorcery Points', '')), `the app's chat has the line, saying nothing of what's left: "${chatLine}"`)
  await phone.character()

  // More than are left: the app says so; or the game, where it has spent them meanwhile.
  const tooMany = await call(phone.page, '/api/characters/sheet-thorin/rolls', { method: 'POST', body: { kind: 'spend', counter: { item: 'sorcery' }, count: 7, ...PLAIN } })
  check(tooMany.status === 422 && tooMany.json?.reason === 'short', `seven of the six left, posted all the same, the app turns down: ${tooMany.status} ${tooMany.json?.reason}`)
  item('sorcery').updateSource({ 'system.uses.spent': 19 })
  await phone.tab('Features')
  const refused = await spend(phone, 'Sorcery Points', 3)
  check(refused.made.status === 'failed' && refused.made.result?.reason === 'short' && !refused.line && usesLeft('sorcery') === 1,
    `with one left in the game, spending 3 the app thought there were is turned down there, "short", nothing spent (${JSON.stringify(refused.made.result)})`)
  await phone.status.getByText(/Not spent at the table/).waitFor({ timeout: 15_000 })
  check((await phone.status.textContent()).includes('you haven’t that many left'), `the tray says why: "${await phone.status.textContent()}"`)
  await Hooks.callAll('updateItem', item('sorcery'), { system: { uses: { spent: 19 } } }, {}, 'gm')
  await until(async () => await spendButton(phone, 'Sorcery Points').getAttribute('aria-label') === 'Spend Sorcery Points: 1 of 20 left', 'the count to catch up', 15_000)

  // Replicate Magic Item, on the tablet, with toasts.
  await tablet.tab('Features')
  const replicated = await spend(tablet, 'Replicate Magic Item', 1, { shot: 'spend-popover' })
  check(replicated.made.status === 'done' && replicated.line?.content === '<p>Spends 1 · Replicate Magic Item</p>' && usesLeft('replicate') === 2,
    `Replicate Magic Item's charges are spent too: "${replicated.line?.content}"`)
  const toast = tablet.page.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]').filter({ hasText: 'Replicate Magic Item' })
  await until(async () => /spent 1/i.test(await toast.first().textContent().catch(() => '')), 'the toast to say they were spent', 15_000)
  check(true, `the tablet's toast says so: "${(await toast.first().textContent()).replace(/\s+/g, ' ')}"`)

  // Bardic Inspiration, an old-style resource, among the favorites.
  await phone.tab('Actions')
  const favorites = phone.panel.getByRole('region', { name: 'Favorites' })
  await spendButton(phone, 'Bardic Inspiration').waitFor()
  check(await favorites.getByRole('button', { name: 'Spend Bardic Inspiration: 3 of 3 left' }).count() === 1, 'Bardic Inspiration, a resource, is spent from its favorite\'s count')
  const bardic = await spend(phone, 'Bardic Inspiration', 1)
  check(same(bardic.request.payload.counter, { resource: 'primary' }) && bardic.line?.content === '<p>Spends 1 · Bardic Inspiration</p>' && thorin.system.resources.primary.value === 2,
    `by the resource, named by its label: "${bardic.line?.content}", 2 left`)

  // "Use spends this too", where the row's Use spends the counter.
  await spendButton(phone, 'Sorcery Points').first().click()
  pop = popoverOf(phone, 'Sorcery Points')
  await pop.waitFor()
  check(await pop.getByText('Use spends this too', { exact: true }).isVisible(), 'on Actions, Sorcery Points\' popover says Quickened Spell\'s Use spends them too')
  const ratios = await contrastsOf(phone, { note: pop.getByText('Use spends this too', { exact: true }), heading: pop.getByText('Spend Sorcery Points', { exact: true }), left: pop.getByText(/^\s*of \d+$/) })
  check(allAA(ratios), `the popover's small texts are at least 4.5:1 in both themes: ${JSON.stringify(ratios)}`)
  await pop.press('Escape')
  await pop.waitFor({ state: 'detached' })
}
// Lucky, all spent: its Use greyed, with this round's module and app.
await phone.tab('Actions')
const luck = phone.panel.getByRole('button', { name: 'Use Lucky' })
await luck.waitFor()
{
  const before = requests()
  const disabled = await luck.getAttribute('aria-disabled')
  const title = await luck.getAttribute('title')
  // A tap all the same: greyed, it's still a button, which ignores it.
  await luck.click({ force: true })
  await wait(1500)
  const asking = phone.page.getByRole('dialog', { name: 'Lucky' })
  if (NEW) {
    check(disabled === 'true' && title === 'None left' && requests() === before && await asking.count() === 0 && await spendButton(phone, 'Lucky').count() === 0,
      'Lucky, none left, its Use spending it: the Use is greyed, "None left", a tap sends nothing, and its 0 of 3 is no button')
    await shootBoth(phone, 'use-none-left', luck.locator('xpath=ancestor::li[1]'))
  } else {
    // In a fight, it asks whom it's at first: no one ticked, it's used all the same.
    if (await asking.count()) await asking.getByRole('button', { name: 'Use', exact: true }).click()
    await until(() => requests() > before, "Lucky's Use to be sent")
    check(disabled === null && requests() > before, `${SKEW ? 'module 0.28.0 says nothing of what Lucky\'s Use spends' : 'the app from before knows nothing of it'}: its Use isn't greyed, and a tap sends it`)
    await until(() => ['done', 'failed'].includes(latestRequest().status), 'the Use to be made')
  }
}
if (!NEW) {
  check(await phone.page.getByRole('button', { name: /^Spend / }).count() === 0, 'no count is a button to spend')
  await phone.tab('Features')
  check(await phone.page.getByRole('button', { name: /^Spend / }).count() === 0 && (await phone.panel.textContent()).includes('Sorcery Points'), 'nor on Features')
}
// The potion, used up as it runs out, is spent only by drinking it.
await phone.tab('Inventory')
await phone.panel.getByText('Potion of Healing', { exact: true }).first().waitFor()
check(await spendButton(phone, 'Potion of Healing').count() === 0, "the Potion of Healing's count is no button: it's spent only by drinking it")

// =================================================================================================
// Heroic Inspiration
// =================================================================================================
await phone.tab('Character')
const inspiration = who => who.page.getByRole('button', { name: /Heroic Inspiration$/ })
if (NEW) {
  await inspiration(phone).waitFor()
  check(await inspiration(phone).getAttribute('aria-label') === 'Not inspired. Gain Heroic Inspiration' && (await inspiration(phone).textContent()).trim() === 'Not inspired',
    'not inspired, the header says so, a button to gain it: "Not inspired. Gain Heroic Inspiration"')
  await shootBoth(phone, 'inspiration-button', inspiration(phone))
  const notInspired = await contrastsOf(phone, { 'Not inspired': inspiration(phone) })
  check(allAA(notInspired), `"Not inspired" is at least 4.5:1 in both themes: ${JSON.stringify(notInspired)}`)
  await inspiration(phone).click()
  let asking = phone.page.getByRole('dialog', { name: 'Gain Heroic Inspiration?' })
  await asking.waitFor()
  check(await asking.getByText('Foundry’s chat will say so.', { exact: true }).isVisible() && await asking.getByRole('button', { name: 'Gain', exact: true }).isVisible() && await asking.getByRole('button', { name: 'Cancel', exact: true }).isVisible(),
    'it asks first: "Gain Heroic Inspiration?", Foundry\'s chat saying so, Gain or Cancel')
  await shootBoth(phone, 'inspiration-confirm', asking)
  let { request, made } = await sent(() => asking.getByRole('button', { name: 'Gain', exact: true }).click(), 'gaining inspiration')
  let line = messages.get(made.result.messageId)
  check(request.payload.kind === 'inspiration' && request.payload.inspiration === 'gain' && made.status === 'done' && thorin.system.attributes.inspiration === true
    && same(lineOf(line?.id), { content: '<p>Gains Heroic Inspiration</p>', author: 'alice', actor: 'thorin', flags: { request: request.id }, whisper: [] }),
    `Gain gains it in the game, which posts "${line?.content}"`)
  await phone.status.getByText('Gained at the table').waitFor({ timeout: 15_000 })
  await until(async () => await inspiration(phone).getAttribute('aria-label') === 'Inspired. Use Heroic Inspiration', 'the header to say he is inspired', 15_000)
  check((await inspiration(phone).textContent()).trim() === 'Inspired', 'the tray says it was gained, and the header that he is inspired, a button to use it')
  // In gold-text, as the label was before this round: a token made for large text in the light
  // theme (globals.test.ts), so 12 px "Inspired" falls short of AA there, as it did before.
  const inspired = await contrastsOf(phone, { Inspired: inspiration(phone) })
  check(inspired['Inspired (dark)'] >= 4.5 && inspired['Inspired (light)'] >= 3,
    `"Inspired", in gold as before, is at least 4.5:1 in the dark theme and 3:1 in the light: ${JSON.stringify(inspired)}`)
  if (inspired['Inspired (light)'] < 4.5) note(`"Inspired" is ${inspired['Inspired (light)']}:1 in the light theme, short of AA for its 12 px, as the label was before this round`)
  await shootBoth(phone, 'inspiration-button', inspiration(phone))
  await tablet.tab('Character')
  await until(async () => await inspiration(tablet).getAttribute('aria-label') === 'Inspired. Use Heroic Inspiration', "the tablet's header to say he is inspired", 15_000)
  await shootBoth(tablet, 'inspiration-button', inspiration(tablet))
  await inspiration(phone).click()
  asking = phone.page.getByRole('dialog', { name: 'Use Heroic Inspiration?' })
  await asking.waitFor()
  ;({ request, made } = await sent(() => asking.getByRole('button', { name: 'Use', exact: true }).click(), 'using inspiration'))
  line = messages.get(made.result.messageId)
  check(request.payload.inspiration === 'use' && made.status === 'done' && thorin.system.attributes.inspiration === false && line?.content === '<p>Uses Heroic Inspiration</p>',
    `Use uses it, and the game posts "${line?.content}"`)
  await phone.status.getByText('Used at the table').waitFor({ timeout: 15_000 })
  await phone.chat()
  await messageWith(phone, 'Gains Heroic Inspiration')
  await messageWith(phone, 'Uses Heroic Inspiration')
  check(true, "both lines are in the app's chat")
  await phone.character()
} else {
  check(await inspiration(phone).count() === 0 && await phone.page.getByText('Not inspired').count() === 0, 'not inspired, the header says nothing of it, as before')
  await thorin.update({ 'system.attributes.inspiration': true })
  await phone.page.getByText('Inspired', { exact: true }).waitFor({ timeout: 15_000 })
  check(await inspiration(phone).count() === 0, 'inspired, it says so, a label and no button, as before')
  await thorin.update({ 'system.attributes.inspiration': false })
}

// =================================================================================================
// Vex's sheet, as the Gamemaster
// =================================================================================================
// Bob follows the campaign's invite and plays Vex.
const bobView = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB, path: null })
await bobView.page.goto(inviteUrl)
await bobView.page.getByRole('radio', { name: /^Vex/ }).check()
await bobView.page.getByRole('button', { name: 'Join as this character' }).click()
await bobView.page.waitForURL(/\/characters\/[\w-]+$/)
await bobView.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const markOn = await concentrate(vex, "Hunter's Mark", 'mark')
const gmView = await browse({ width: 768, height: 1024, scheme: 'light', path: `/campaigns/${A}/characters/vex` })
await gmView.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await chipOf(gmView).waitFor({ timeout: 15_000 })
await chipOf(gmView).click()
await until(async () => await gmView.page.getByRole('tab', { name: /^Effects\b/ }).getAttribute('aria-selected') === 'true', 'the Effects tab on the GM page')
{
  const row = await openEffect(gmView, "Concentrating: Hunter's Mark")
  check(await gmView.page.getByRole('dialog').count() === 0 && await row.getByRole('button', { name: /^End concentration/ }).count() === 0,
    "on Vex's sheet as the Gamemaster, the Concentrating chip opens Effects, and nothing there ends it: ending it would leave no mark")
}
if (NEW) {
  const refused = await call(gmView.page, `/api/campaigns/${A}/characters/vex/rolls`, { method: 'POST', body: { kind: 'endConcentration', concentration: { effect: markOn.id }, ...PLAIN } })
  check(refused.status === 409 && refused.json?.reason === 'unavailable', `posted all the same, the app turns it down: ${refused.status} ${refused.json?.reason}`)
  await gmView.tab('Features')
  const { request, made, line } = await spend(gmView, 'Channel Divinity', 1)
  check(request.role === 'gm' && fetchedCommand(request.id)?.by === 'gm' && made.status === 'done'
    && same(lineOf(line?.id), { content: '<p>Spends 1 · Channel Divinity</p>', author: 'bob', actor: 'vex', flags: { request: request.id, by: 'gm' }, whisper: [] }),
    `the Gamemaster spends one of Vex's Channel Divinities, its line by Bob, as Vex's, flagged as the Gamemaster's (${JSON.stringify(lineOf(line?.id)?.flags)})`)
  await bobView.status.getByText('Spent at the table').waitFor({ timeout: 15_000 })
  check(/Channel Divinity/.test(await bobView.status.textContent()), `Bob's page shows it as the Gamemaster's, spent: "${await bobView.status.textContent()}"`)
  const resultOf = () => posted.findLast(p => p.type === 'command.result' && p.data?.id === request.id)?.data
  await until(() => resultOf(), 'its result as the module posted it', 15_000)
  const result = resultOf()
  check(same(result?.messages, [line.id]), `its result lists the line, as the Gamemaster's (${JSON.stringify(result?.messages)})`)
  const { markAppRoll } = await import(`${MODULE}/scripts/command-rolls.mjs`)
  const dom = new JSDOM(`<ol id="chat-log"><li class="chat-message"><header class="message-header"><h4 class="message-sender">Vex</h4><span class="message-metadata"><time>Now</time></span></header><div class="message-content">${line.content}</div></li></ol>`)
  const held = { document: globalThis.document, HTMLElement: globalThis.HTMLElement }
  Object.assign(globalThis, { document: dom.window.document, HTMLElement: dom.window.HTMLElement })
  try { markAppRoll(line, dom.window.document.querySelector('li')) } finally { Object.assign(globalThis, held) }
  const badge = dom.window.document.querySelector('.sending-stone-badge')
  check(badge?.className === 'sending-stone-badge sending-stone-gm' && badge.textContent === 'GM', `in Foundry its line carries the GM badge (${badge?.outerHTML})`)
  await until(() => byGm(line.id) === 't', 'the app to mark the line', 15_000)
  await gmView.chat()
  const item = await messageWith(gmView, 'Spends 1 · Channel Divinity')
  check(await item.locator('[title="Rolled by the Gamemaster"]').count() === 1, "and in the app's chat it has the GM pill")
  // Heroic Inspiration, from the Gamemaster's page too: the tray there can't say whether it was used
  // or gained, only that it changed.
  vex.system.attributes.inspiration = false
  await gmView.character()
  await gmView.tab('Character')
  await inspiration(gmView).click()
  const asking = gmView.page.getByRole('dialog', { name: 'Gain Heroic Inspiration?' })
  await asking.waitFor()
  const gained = await sent(() => asking.getByRole('button', { name: 'Gain', exact: true }).click(), "Vex's inspiration")
  const gainLine = messages.get(gained.made.result.messageId)
  check(gained.request.role === 'gm' && vex.system.attributes.inspiration === true
    && same(lineOf(gainLine?.id), { content: '<p>Gains Heroic Inspiration</p>', author: 'bob', actor: 'vex', flags: { request: gained.request.id, by: 'gm' }, whisper: [] }),
    `the Gamemaster gains Vex Heroic Inspiration, its line flagged as theirs (${JSON.stringify(lineOf(gainLine?.id)?.flags)})`)
  await gmView.status.getByText('Gained at the table').waitFor({ timeout: 15_000 })
  await bobView.status.getByText('Changed at the table').waitFor({ timeout: 15_000 })
  check(/Heroic Inspiration/.test(await bobView.status.textContent()),
    `the GM page's tray says it was gained; Bob's, which can't tell a use from a gain, that it changed: "${await gmView.status.textContent()}", "${await bobView.status.textContent()}"`)
} else {
  await gmView.tab('Features')
  check(await gmView.page.getByRole('button', { name: /^Spend / }).count() === 0, "the GM page offers no spending either")
}
await gmView.view.close()

// =================================================================================================
// Hits, misses and saves on chat cards
// =================================================================================================
await bobView.chat()
await phone.chat()
await tablet.chat()

/** A target's text as read, its armor class with it where it's shown: "Goblin, Hit". */
const targetsOf = item => item.evaluate(li => {
  const p = [...li.querySelectorAll('p')].find(p => /Targets?:/.test(p.querySelector(':scope > span.sr-only')?.textContent ?? ''))
  if (!p) return null
  return [...p.querySelectorAll(':scope > span.inline-flex')].map(span => {
    const name = span.querySelector('span.font-semibold')?.textContent
    const ac = [...span.querySelectorAll('span.text-xs')].map(s => s.textContent).find(t => /^AC/.test(t))
    const pills = [...span.querySelectorAll('span.rounded-full')]
    const read = pills.map(pill => `, ${pill.textContent.trim()}${pill.querySelector('svg.lucide-x[aria-hidden="true"]') ? ' ✗' : ''}`).join('')
    // Each pill read after a comma.
    const commas = [...span.querySelectorAll('span.sr-only')].filter(s => s.textContent === ', ').length
    return `${name}${ac ? ` (${ac})` : ''}${read}${commas === pills.length ? '' : ' [no comma]'}`
  })
})
/** A card's targets once they read as expected, as a page hears of a message's update; else as they are. */
async function targetsBecome(item, expected, ms = 15_000) {
  await until(async () => same(await targetsOf(item), expected), 'the targets to read as expected', ms).catch(() => {})
  return targetsOf(item)
}
const summaryOf = item => item.evaluate(li => {
  const p = [...li.querySelectorAll('p')].find(p => /Targets?:/.test(p.querySelector(':scope > span.sr-only')?.textContent ?? ''))
  const before = p?.previousElementSibling
  return (before?.tagName === 'P') ? before.textContent : null
})
/**
 * The newest message in a chat by this speaker, with this in its text, from this place in the log
 * on, once its card names whom it was aimed at.
 */
async function cardOf(who, speaker, { text = '', after = 0 } = {}) {
  const items = who.log.locator(':scope > li')
  let index = -1
  await until(async () => {
    index = await items.evaluateAll((lis, [speaker, text]) => lis
      .map(li => [li.querySelector('header .font-semibold')?.textContent, li.textContent])
      .findLastIndex(([by, all]) => (by === speaker) && all.includes(text)), [speaker, text])
    return (index >= after) && ((await targetsOf(items.nth(index))) !== null)
  }, `${speaker}'s "${text}" with its targets at ${who.width} px`)
  return items.nth(index)
}
const roll20 = async (face, bonus, options = {}) => {
  faces.push(face)
  return new CONFIG.Dice.D20Roll(`1d20 + ${bonus}`, {}, { criticalSuccess: 20, criticalFailure: 1, ...options }).evaluate()
}
/** The Goblin Boss's scimitar at Thorin and Vex, rolled in Foundry by the Gamemaster: 11 + 4. */
async function bossAttack() {
  const roll = await roll20(11, 4, { rollType: 'attack' })
  return ChatMessage.create({
    author: 'gm', speaker: ChatMessage.getSpeaker({ actor: boss }), rolls: [roll], flavor: 'Scimitar - Attack Roll',
    flags: { dnd5e: { messageType: 'roll', roll: { type: 'attack' }, targets: [{ name: 'Thorin', img: '', uuid: 'Actor.thorin', ac: 16 }, { name: 'Vex', img: '', uuid: 'Actor.vex', ac: 14 }] } },
  })
}
/** A creature's save, rolled in Foundry by the Gamemaster from a card, its d20 this. */
async function saveFrom(card, actor, face) {
  faces.push(face)
  await actor.rollSavingThrow({ ability: 'con', target: 13 }, { configure: false }, { data: { flags: { dnd5e: { originatingMessage: card.id } } } })
  return latestMessage()
}
const settle = () => wait(2500)

// ---- dnd5e's attacks ----
let attackItem
if (firstAttack) {
  // The rapier's hit at the goblin, under Attack Roll Visibility "None".
  const card = MIDI ? useCard(firstAttack.request.id) : madeFor(firstAttack.request.id)
  await until(() => toldOf(card.id), 'the attack in the app')
  check(toldOf(card.id).dnd5e.targets.every(t => !('outcome' in t) && !('ac' in t)), `under Attack Roll Visibility "None", the module tells the app nothing of the hit (${JSON.stringify(toldOf(card.id).dnd5e.targets)})`)
  attackItem = await cardOf(phone, 'Thorin', { text: 'Rapier' })
  check(same(await targetsOf(attackItem), ['Goblin']), `and the app shows the goblin with no pill (${JSON.stringify(await targetsOf(attackItem))})`)
}
settings.set('attackRollVisibility', 'hideAC')
const updatesOf = id => posted.filter(p => (p.type === 'chat.message.updated') && (p.data.message.id === id)).length
/** The rapier at the goblin, from the phone, its d20 this: the card it made. */
async function rapierAt(face) {
  await phone.character()
  await phone.tab('Actions')
  await forceD20(phone.page, face)
  await lunge.click()
  await picker.waitFor()
  const { request, made } = await sent(() => picker.getByRole('button', { name: /^Goblin(?! Boss)/ }).click(), 'the attack')
  await unforce(phone.page)
  await phone.chat()
  const card = MIDI ? useCard(request.id) : madeFor(request.id)
  if (MIDI) {
    // Midi's workflow writes the hit on its card as it checks it: first while its check is still
    // the Gamemaster's alone, then once it isn't.
    const hit = made.result.attack?.outcome === 'hit'
    let updates = updatesOf(card.id)
    await card.update({ 'flags.midi-qol': { messageType: 'attack', GMOnlyAttackRoll: true, hitTargetUuids: hit ? [tokens.goblin.document.uuid] : [], hitECTargetUuids: [], targets: [{ uuid: tokens.goblin.document.uuid }] } })
    await until(() => updatesOf(card.id) > updates, "Midi's first write to be sent")
    check(!('outcome' in toldOf(card.id).dnd5e.targets[0]), "while Midi's check of the hit is the Gamemaster's alone, nothing is told of it")
    updates = updatesOf(card.id)
    await card.update({ 'flags.midi-qol.GMOnlyAttackRoll': false })
    await until(() => updatesOf(card.id) > updates, "Midi's second write to be sent")
  }
  return { request, made, card }
}
{
  const before = await chatCount(phone)
  const { made, card } = await rapierAt(15)
  await settle()
  const told = toldOf(card.id).dnd5e.targets[0]
  attackItem = await cardOf(phone, 'Thorin', { text: 'Rapier', after: before })
  if (!SKEW) check(told.outcome === 'hit' && !('ac' in told), `${MIDI ? 'Midi\'s check made, under Auto Check Hits "all"' : 'under "Hide AC"'}, the module tells the app the rapier hit, never the goblin's armor class (${JSON.stringify(told)})`)
  if (NEW) check(same(await targetsBecome(attackItem, ['Goblin, Hit']), ['Goblin, Hit']) && made.result.attack?.outcome === 'hit', `and the app pills it "Hit" (${JSON.stringify(await targetsOf(attackItem))})`)
  else check(same(await targetsOf(attackItem), ['Goblin']), `${SKEW ? 'module 0.28.0 tells nothing of it' : 'the app from before shows nothing of it'}: the goblin has no pill`)
  if (NEW) measure('Chat: Hit pill', who => who.log.locator(':scope > li').filter({ hasText: 'Rapier' }).locator('span.rounded-full').filter({ hasText: 'Hit' }).last())
}
{
  const before = await chatCount(phone)
  const { card } = await rapierAt(2)
  await settle()
  const item = await cardOf(phone, 'Thorin', { text: 'Rapier', after: before })
  if (NEW) {
    check(toldOf(card.id).dnd5e.targets[0].outcome === 'miss' && same(await targetsBecome(item, ['Goblin, Miss ✗']), ['Goblin, Miss ✗']), `a 2 misses: "Miss", muted, after a cross (${JSON.stringify(await targetsOf(item))})`)
    await shootBoth(phone, 'chat-miss', item)
  } else check(same(await targetsOf(item), ['Goblin']), 'and no miss either')
}

// The Gamemaster's goblin boss at Thorin and Vex: one hit, one miss, summed up.
{
  const before = await chatCount(phone)
  const attack = await bossAttack()
  await until(() => toldOf(attack.id), "the boss's attack in the app")
  await settle()
  const item = await cardOf(phone, 'Goblin Boss', { after: before })
  if (NEW && MIDI) {
    // Module 0.30.0, F7 (its contract §1a M3/A7): with Midi-QOL active, dnd5e's own attack card has
    // no tray of targets, Midi drawing its own in its place on every message, so an attack at two
    // targets shows players no hit or miss in Foundry, and none is told; dnd5e's highlight of the
    // total is for one target alone.
    check(same(await targetsOf(item), ['Thorin', 'Vex']) && await summaryOf(item) === null && toldOf(attack.id).dnd5e.targets.every(t => !('outcome' in t) && !('ac' in t)),
      `with Midi-QOL, the boss's attack at Thorin and Vex tells neither hit nor miss, as Foundry draws no tray for it (F7): ${JSON.stringify([await targetsOf(item), await summaryOf(item)])}`)
    for (const who of [phone, tablet]) await shootBoth(who, 'chat-hits-midi-dnd5e', await cardOf(who, 'Goblin Boss'))
    // F7: the Miss pill and the summary measured on Midi's own card below, "Hit 1 of 2 · 1 of 2 saved".
    measure('Chat: Miss pill', who => who.log.locator(':scope > li').filter({ hasText: 'Hit 1 of 2' }).locator('span.rounded-full').filter({ hasText: 'Miss' }).last())
    measure('Chat: summary', who => who.log.locator(':scope > li').getByText(/^Hit 1 of 2/).last())
  } else if (NEW) {
    check(same(await targetsOf(item), ['Thorin, Miss ✗', 'Vex, Hit']) && await summaryOf(item) === 'Hit 1 of 2',
      `15 against AC 16 and AC 14: Thorin missed, Vex hit, and over them "Hit 1 of 2" (${JSON.stringify([await targetsOf(item), await summaryOf(item)])})`)
    for (const who of [phone, tablet]) await shootBoth(who, 'chat-hits-summary', await cardOf(who, 'Goblin Boss'))
    measure('Chat: Miss pill', who => who.log.locator(':scope > li').filter({ hasText: 'Hit 1 of 2' }).locator('span.rounded-full').filter({ hasText: 'Miss' }).last())
    measure('Chat: summary', who => who.log.locator(':scope > li').getByText('Hit 1 of 2', { exact: true }).last())
  } else {
    check(same(await targetsOf(item), ['Thorin', 'Vex']) && await summaryOf(item) === null, 'no pills, and no summary')
  }
}

// ---- dnd5e's saves: the Gamemaster's card, its DC hidden ----
settings.set('challengeVisibility', 'player')
/** A viewer's chat once it has heard of the newest message, this speaker's, from so many on. */
const heard = (who, speaker, after) => cardOf(who, speaker, { after })
{
  const at = await chatCount(phone)
  const frost = await saveCard({ by: corvin, item: corvin.items.get('frost'), dc: 13, abilities: ['con'], targets: [thorin, goblin, wolf], author: 'gm' })
  await until(() => storedMessage(frost.id), 'the card in the app')
  const stored = storedMessage(frost.id)
  if (!SKEW) {
    check(!/DC 13|data-dc/.test(stored.content) && !/DC 13/.test(stored.text ?? '') && /data-dc="13"/.test(frost.content) && /DC 13/.test(frost.content),
      `its DC hidden from players, the content the app keeps has no DC, nor any button's data-dc, which Foundry's card has (${stored.content.length} characters)`)
  } else note(`module 0.28.0 sends the content as it is: ${/data-dc/.test(stored.content) ? 'with' : 'without'} its data-dc`)
  // It asks Thorin's save: Alice rolls it from the banner.
  await phone.character()
  await phone.banner.waitFor({ timeout: 15_000 })
  await forceD20(phone.page, 18)
  const { request, made } = await sent(() => phone.banner.getByRole('button', { name: /^Roll Constitution saving throw/ }).click(), 'his save')
  await unforce(phone.page)
  const save = madeFor(request.id)
  check(made.status === 'done' && save?.flags.dnd5e.originatingMessage === frost.id, "his save is made on the Gamemaster's card")
  await until(() => toldOf(save.id), 'his save in the app')
  if (!SKEW) check(sameJson(toldOf(save.id).dnd5e.save, { target: 'Actor.thorin' }), `on the Gamemaster's card, under "Show only from other players", the module names whose save it is, nothing of how it went (${JSON.stringify(toldOf(save.id).dnd5e.save)})`)
  await phone.chat()
  const saveItem = await heard(phone, 'Thorin', at)
  if (NEW) check(same(await targetsOf(saveItem), ['Thorin']), `his save's message names only him, with no pill (${JSON.stringify(await targetsOf(saveItem))})`)
  else note(`his save's message, as this app shows it: ${JSON.stringify(await targetsOf(saveItem))}`)
  const goblinSave = await saveFrom(frost, goblin, 3)
  await until(() => toldOf(goblinSave.id), "the goblin's save in the app")
  await heard(phone, 'Goblin', at)
  if (!SKEW) check(sameJson(toldOf(goblinSave.id).dnd5e.save, { target: 'Actor.goblin' }), "nor of the goblin's, rolled in Foundry")
  const card = await cardOf(phone, 'Corvin', { text: 'Frost Breath' })
  check(same(await targetsOf(card), ['Thorin', 'Goblin', 'Wolf']) && await summaryOf(card) === null, `the card's targets have no pill, and no summary (${JSON.stringify(await targetsOf(card))})`)
}
// Under "Show all", another card: the goblin saves, the wolf fails.
settings.set('challengeVisibility', 'all')
{
  const at = [await chatCount(phone), await chatCount(bobView), await chatCount(tablet)]
  const card = await saveCard({ by: corvin, item: corvin.items.get('storm'), dc: 13, abilities: ['con'], targets: [goblin, wolf], author: 'gm' })
  await until(() => storedMessage(card.id), 'the second card in the app')
  const goblinSave = await saveFrom(card, goblin, 18)
  const wolfSave = await saveFrom(card, wolf, 4)
  await until(() => toldOf(wolfSave.id), 'the saves in the app')
  await heard(phone, 'Wolf', at[0])
  await heard(bobView, 'Wolf', at[1])
  await heard(tablet, 'Wolf', at[2])
  const item = await cardOf(phone, 'Corvin', { text: 'Ice Storm' })
  if (NEW) {
    check(sameJson(toldOf(goblinSave.id).dnd5e.save, { target: 'Actor.goblin', outcome: 'success' }) && sameJson(toldOf(wolfSave.id).dnd5e.save, { target: 'Actor.wolf', outcome: 'failure' }),
      'under "Show all", the module tells how each save went: the goblin\'s 18 saved, the wolf\'s 5 failed')
    check(same(await targetsOf(item), ['Goblin, Saved ✗', 'Wolf, Failed']) && await summaryOf(item) === '1 of 2 saved',
      `the card pills each target, Saved muted after a cross, Failed as a hit is, and sums them up, "1 of 2 saved" (${JSON.stringify([await targetsOf(item), await summaryOf(item)])})`)
    const bobs = await cardOf(bobView, 'Corvin', { text: 'Ice Storm' })
    check(same(await targetsOf(bobs), ['Goblin, Saved ✗', 'Wolf, Failed']), 'Bob sees them too')
    const own = await cardOf(phone, 'Wolf')
    check(same(await targetsOf(own), ['Wolf, Failed']), `the wolf's save message names only the wolf, with its pill (${JSON.stringify(await targetsOf(own))})`)
    for (const who of [phone, tablet]) await shootBoth(who, 'chat-saves-summary', await cardOf(who, 'Corvin', { text: 'Ice Storm' }))
    measure('Chat: Saved pill', who => who.log.locator(':scope > li').filter({ hasText: 'Ice Storm' }).locator('span.rounded-full').filter({ hasText: 'Saved' }).last())
    measure('Chat: Failed pill', who => who.log.locator(':scope > li').filter({ hasText: 'Ice Storm' }).locator('span.rounded-full').filter({ hasText: 'Failed' }).last())
  } else {
    check(same(await targetsOf(item), ['Goblin', 'Wolf']), 'no save pills')
  }
}
// Alice's own card, cast in Foundry, under "Show none": how the saves went is hers to see.
settings.set('challengeVisibility', 'none')
{
  const at = [await chatCount(phone), await chatCount(bobView)]
  const card = await saveCard({ by: thorin, item: thorin.items.get('thunder'), dc: 14, abilities: ['con'], targets: [goblin, wolf], author: 'alice' })
  await until(() => storedMessage(card.id), "Thorin's card in the app")
  const goblinSave = await saveFrom(card, goblin, 2)
  const wolfSave = await saveFrom(card, wolf, 19)
  await until(() => toldOf(wolfSave.id), 'the saves in the app')
  await heard(phone, 'Wolf', at[0])
  await heard(bobView, 'Wolf', at[1])
  if (NEW) {
    check(sameJson(toldOf(goblinSave.id).dnd5e.save, { target: 'Actor.goblin', outcome: 'failure', readers: ['thorin'] }),
      `under "Show none", against his player's card, the module tells how it went, for his player alone (${JSON.stringify(toldOf(goblinSave.id).dnd5e.save)})`)
    const alices = await cardOf(phone, 'Thorin', { text: 'Thunderclap' })
    const bobs = await cardOf(bobView, 'Thorin', { text: 'Thunderclap' })
    check(same(await targetsOf(alices), ['Goblin, Failed', 'Wolf, Saved ✗']) && await summaryOf(alices) === '1 of 2 saved',
      `Alice sees them, "1 of 2 saved" (${JSON.stringify(await targetsOf(alices))})`)
    check(same(await targetsOf(bobs), ['Goblin', 'Wolf']) && await summaryOf(bobs) === null, `Bob doesn't (${JSON.stringify(await targetsOf(bobs))})`)
    await shootBoth(bobView, 'chat-saves-hidden', bobs)
  } else {
    check(same(await targetsOf(await cardOf(phone, 'Thorin', { text: 'Thunderclap' })), ['Goblin', 'Wolf']), 'no save pills')
  }
}
// Under "Show only from other players": everyone sees how it went against hers.
settings.set('challengeVisibility', 'player')
{
  const at = [await chatCount(phone), await chatCount(bobView)]
  const card = await saveCard({ by: thorin, item: thorin.items.get('step'), dc: 14, abilities: ['con'], targets: [goblin], author: 'alice' })
  await until(() => storedMessage(card.id), "Thorin's second card in the app")
  const goblinSave = await saveFrom(card, goblin, 17)
  await until(() => toldOf(goblinSave.id), 'the save in the app')
  await heard(phone, 'Goblin', at[0])
  await heard(bobView, 'Goblin', at[1])
  if (NEW) {
    check(sameJson(toldOf(goblinSave.id).dnd5e.save, { target: 'Actor.goblin', outcome: 'success' }), 'against a player\'s card, under "Show only from other players", the module tells everyone how it went')
    const bobs = await cardOf(bobView, 'Thorin', { text: 'Thunder Step' })
    check(same(await targetsOf(bobs), ['Goblin, Saved ✗']), `and Bob sees it (${JSON.stringify(await targetsOf(bobs))})`)
  } else check(same(await targetsOf(await cardOf(phone, 'Thorin', { text: 'Thunder Step' })), ['Goblin']), 'and still no pills')
}

// ---- With Gamemaster-only information on: every result sent ----
settings.set('gmContent', true)
settings.set('attackRollVisibility', 'none')
settings.set('challengeVisibility', 'none')
{
  const before = await chatCount(phone)
  const attack = await bossAttack()
  await until(() => toldOf(attack.id), "the boss's attack in the app")
  await settle()
  const item = await cardOf(phone, 'Goblin Boss', { after: before })
  const SHOWN = ['Thorin (AC 16), Miss ✗', 'Vex (AC 14), Hit']
  if (NEW) {
    check(same(toldOf(attack.id).dnd5e.targets.map(t => [t.outcome, t.ac]), [['miss', 16], ['hit', 14]]) && same(await targetsOf(item), SHOWN) && await summaryOf(item) === 'Hit 1 of 2',
      `with Gamemaster-only information on, under Attack Roll Visibility "None", the hits and the armor classes are sent: ${JSON.stringify([await targetsOf(item), await summaryOf(item)])}`)
  } else {
    // Older on one side: the app works out hit and miss from the armor classes, as before; the app
    // from before draws its pills without the cross, or the comma read before them.
    const shown = (await targetsOf(item)).map(t => t.replace(' ✗', '').replace(' [no comma]', ''))
    check(same(shown, SHOWN.map(t => t.replace(' ✗', ''))),
      `with Gamemaster-only information on, the armor classes are sent, and the app works out hit and miss from them, as before (${JSON.stringify(await targetsOf(item))})`)
    if (SKEW) check(await summaryOf(item) === 'Hit 1 of 2', `and this app sums them up over the targets: "${await summaryOf(item)}"`)
  }
  const at = await chatCount(phone)
  const card = await saveCard({ by: corvin, item: corvin.items.get('hail'), dc: 13, abilities: ['con'], targets: [goblin], author: 'gm' })
  await until(() => storedMessage(card.id), 'the card in the app')
  const goblinSave = await saveFrom(card, goblin, 16)
  await until(() => toldOf(goblinSave.id), 'the save in the app')
  await heard(phone, 'Goblin', at)
  check(/data-dc="13"/.test(storedMessage(card.id).content), "the card's content is sent as it is, its DC in it")
  if (NEW) {
    check(sameJson(toldOf(goblinSave.id).dnd5e.save, { target: 'Actor.goblin', outcome: 'success' }), 'and a save\'s outcome, under "Show none", for everyone')
    const shown = await cardOf(phone, 'Corvin', { text: 'Hail Burst' })
    check(same(await targetsOf(shown), ['Goblin (AC 15), Saved ✗']), `on the card: ${JSON.stringify(await targetsOf(shown))}`)
  }
}
settings.set('gmContent', false)
settings.set('attackRollVisibility', 'hideAC')
settings.set('challengeVisibility', 'player')

// ---- Hit/miss and save results in the app: Always show them to players (module 0.31.0) ----
// The same as with Gamemaster-only information on, but with no armor class or DC anywhere.
if (NEW) {
  settings.set('chatResults', 'always')
  settings.set('attackRollVisibility', 'none')
  settings.set('challengeVisibility', 'none')
  {
    const before = await chatCount(phone)
    const attack = await bossAttack()
    await until(() => toldOf(attack.id), "the boss's attack in the app")
    await settle()
    const item = await cardOf(phone, 'Goblin Boss', { after: before })
    check(same(toldOf(attack.id).dnd5e.targets.map(t => [t.outcome, 'ac' in t]), [['miss', false], ['hit', false]]) && same(await targetsOf(item), ['Thorin, Miss ✗', 'Vex, Hit'])
      && await summaryOf(item) === 'Hit 1 of 2',
      `with "Always show them to players", under Attack Roll Visibility "None", the hits are sent and no armor class: ${JSON.stringify([await targetsOf(item), await summaryOf(item)])}`)
    await shootBoth(phone, 'chat-always', item, SHOTS031)
    const at = await chatCount(phone)
    const card = await saveCard({ by: corvin, item: corvin.items.get('hail'), dc: 13, abilities: ['con'], targets: [goblin], author: 'gm' })
    await until(() => storedMessage(card.id), 'the card in the app')
    const goblinSave = await saveFrom(card, goblin, 16)
    await until(() => toldOf(goblinSave.id), 'the save in the app')
    await heard(phone, 'Goblin', at)
    check(!/data-dc/.test(storedMessage(card.id).content), "the card's content is sent without its DC, as without the setting")
    check(sameJson(toldOf(goblinSave.id).dnd5e.save, { target: 'Actor.goblin', outcome: 'success' }), 'and a save\'s outcome, under "Show none", for everyone')
    const shown = await cardOf(phone, 'Corvin', { text: 'Hail Burst', after: at })
    check(same(await targetsOf(shown), ['Goblin, Saved ✗']), `on the card, no armor class: ${JSON.stringify(await targetsOf(shown))}`)
  }
  {
    // The app's own result of Thorin's rapier: hit or miss told, under Attack Roll Visibility "None".
    const { made } = await rapierAt(15)
    check(made.result.attack?.outcome === 'hit' && !('ac' in (made.result.attack ?? {})), `the rapier's own result says it hit, with no armor class (${JSON.stringify(made.result.attack)})`)
    await phone.character()
    await phone.status.getByText(/At the table: \d+ · Hit/).waitFor({ timeout: 15_000 })
    check(true, `and the tray says so: "${await phone.status.textContent()}"`)
    await phone.chat()
  }
  settings.set('chatResults', 'foundry')
  settings.set('attackRollVisibility', 'hideAC')
  settings.set('challengeVisibility', 'player')
}

// ---- Midi-QOL's cards ----
if (MIDI) {
  Object.assign(midi.settings, { autoCheckSaves: 'all' })
  const uuid = actor => tokens[actor.id].document.uuid
  /** Thorin's Midi card, as Midi's workflow writes its flags once it has checked hits and saves. */
  async function midiCard({ name, targets, hit, saved, attack = false }) {
    const rolls = attack ? [await roll20(14, 6, { 'midi-qol': { rollType: 'attack' } })] : []
    return ChatMessage.create({
      author: 'alice', speaker: ChatMessage.getSpeaker({ actor: thorin }), rolls, flavor: name,
      content: `<div class="midi-qol-hits-display"><div>Goblin AC 13 hit</div></div><div class="midi-qol-saves-display"><div>DC 14 save</div></div>`,
      flags: {
        'midi-qol': {
          messageType: 'attack', GMOnlyAttackRoll: false, targets: targets.map(actor => ({ uuid: uuid(actor) })),
          ...(attack && { hitTargetUuids: hit.map(uuid), hitECTargetUuids: [] }),
          ...(saved && { saveUuids: saved.map(uuid), failedSaveUuids: targets.filter(actor => !saved.includes(actor)).map(uuid) }),
        },
        dnd5e: {
          messageType: 'usage', item: { id: 'thunder', type: 'spell' }, activity: { id: 'save', type: 'save' },
          targets: targets.map(actor => ({ name: actor.name, img: '', uuid: actor.uuid, ac: actor.system.attributes.ac.value, ...(saved && { saved: saved.includes(actor) }) })),
        },
      },
    })
  }
  let before = await chatCount(phone)
  let card = await midiCard({ name: 'Thunderclap', targets: [vex, goblin, wolf], saved: [vex, wolf] })
  await until(() => toldOf(card.id), "Midi's card in the app")
  await settle()
  let item = await cardOf(phone, 'Thorin', { after: before })
  check(same(toldOf(card.id).dnd5e.targets.map(t => t.save ?? null), ['success', null, null]) && same(await targetsOf(item), ['Vex, Saved ✗', 'Goblin', 'Wolf']) && await summaryOf(item) === '1 of 1 saved',
    `Midi's save card, under Challenge Visibility "Show only from other players": Vex's save shown, the NPCs' withheld, as Midi keeps them (${JSON.stringify([await targetsOf(item), await summaryOf(item)])})`)
  check(!/AC 13|DC 14/.test(storedMessage(card.id).content) && !/AC 13|DC 14/.test(storedMessage(card.id).text ?? ''), "Midi's own sections of hits and saves are emptied from what the app keeps")
  settings.set('challengeVisibility', 'all')
  before = await chatCount(phone)
  card = await midiCard({ name: 'Thunderclap', targets: [vex, goblin, wolf], saved: [vex, wolf] })
  await until(() => toldOf(card.id), "Midi's second card in the app")
  await settle()
  item = await cardOf(phone, 'Thorin', { after: before })
  check(same(await targetsOf(item), ['Vex, Saved ✗', 'Goblin, Failed', 'Wolf, Saved ✗']) && await summaryOf(item) === '2 of 3 saved',
    `under "Show all", the NPCs' too: ${JSON.stringify([await targetsOf(item), await summaryOf(item)])}`)
  before = await chatCount(phone)
  card = await midiCard({ name: 'Thundering Strike', targets: [goblin, wolf], hit: [goblin], saved: [wolf], attack: true })
  await until(() => toldOf(card.id), "Midi's attack card in the app")
  await settle()
  item = await cardOf(phone, 'Thorin', { after: before })
  check(same(await targetsOf(item), ['Goblin, Hit, Failed', 'Wolf, Miss ✗, Saved ✗']) && await summaryOf(item) === 'Hit 1 of 2 · 1 of 2 saved',
    `an attack with a save on Midi's card: each target's hit and save, summed up "${await summaryOf(item)}"`)
  for (const who of [phone, tablet]) await shootBoth(who, 'chat-midi', await cardOf(who, 'Thorin', { text: 'Hit 1 of 2 · 1 of 2 saved' }))
  settings.set('challengeVisibility', 'player')

  // A concentration check Midi asks in the app, which ending the concentration leaves as it is.
  midi.settings.doConcentrationCheck = 'chat'
  const hexing = await concentrate(thorin, 'Hex', 'hex')
  await until(() => sheetOf('thorin')?.concentration?.effects?.length === 1, 'his concentration in the app', 15_000)
  count = opened().length
  const rolled = midiSaves.concentrationRolls.length
  const midiAsked = await thorin.challengeConcentration({ dc: 12 })
  await until(() => opened().length > count, "Midi's concentration check to be asked", 15_000)
  const prompt = opened()[count]
  check(midiAsked.flags['sending-stone']?.midiHeld === true && prompt.source === 'concentration', "Midi's concentration card is held, and its check asked in the app")
  await phone.character()
  await phone.tab('Character')
  await chipOf(phone).click()
  const confirm = confirmOf(phone, 'Hex')
  await confirm.waitFor()
  const { made } = await sent(() => confirm.getByRole('button', { name: 'End', exact: true }).click(), 'ending Hex')
  await wait(3000)
  check(made.status === 'done' && thorin.concentration.effects.size === 0 && promptRow(prompt.id)?.closed === false
    && !posted.some(p => p.type === 'roll.prompt.closed' && p.data.id === prompt.id) && midiSaves.concentrationRolls.length === rolled && midiAsked.flags['sending-stone']?.midiDone !== true,
    "ending Hex from the app leaves Midi's check as Midi has it: still asked, nothing rolled, nothing released")
  void hexing
  midi.settings.doConcentrationCheck = 'chatOnly'
}

// =================================================================================================
// Every new small text, in both themes
// =================================================================================================
if (NEW) {
  for (const scheme of ['light', 'dark']) {
    await theme(phone, scheme)
    const results = []
    for (const { what, find } of measured) {
      if (what.startsWith('Tracker')) await phone.combat()
      else await phone.chat()
      const locator = find(phone)
      await locator.waitFor()
      results.push({ what, ratio: await contrastOf(locator) })
    }
    const low = results.filter(r => r.ratio < 4.5)
    console.log(scheme, JSON.stringify(results.map(r => `${r.what}: ${r.ratio}`)))
    check(results.length === measured.length && results.length >= 8 && low.length === 0,
      `in the ${scheme} theme, ${results.length} new small texts measured, each at least 4.5:1 on what it's drawn on${low.length ? `: ${JSON.stringify(low)}` : ''}`)
  }
  await theme(phone, 'light')
}

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
