// Module 0.30.0's end-to-end world (its contract §7), shared by party-e2e, fullscreen-e2e,
// settings-e2e and results-e2e: the real module, in a stand-in Foundry with dnd5e 5.3.3's real dice
// classes, its activities and concentration ported (fvtt/activity5e.mjs, fvtt/dnd5e-cards.mjs),
// dnd5e's Group actors as data/actor/group.mjs prepares them, and with MIDI=1 the Midi-QOL stand-in
// (fvtt/midi-fake.mjs) at Midi's own defaults for what it shows players; fetching the production app
// from a browser on the game's page. Its words are the game's in English: the module's own, dnd5e's
// and, with Midi, Midi-QOL's for its options as the 0.30.0 contract §3.6 has them, Midi's own files never
// being run or loaded. Synthetic characters and groups only. Each suite imports it first; then
// `launch()`, `newCampaign()`, `foundryWorld()`, its actors, `startModule()`, and its pages with `browse()`.
// MODULE (or MODULE_DIR) runs another module, as SKEW=029 does module 0.29.0, and SKEW=030 module
// 0.30.0. Since module 0.31.0 (its contract §9), `embedded()` gives an actor Foundry's embedded items
// and writes, with dnd5e's own createWithContents read from its source, for moving items and coins;
// `startModule({ results })` sets "Hit/miss and save results in the app", and its campaigns may
// carry `transfers`. Since module 0.32.0 (its contract §9, §14.2): SKEW=031 is module 0.31.0; users
// have roles and core's Make Manual Rolls (fvtt/stub.mjs), changed with `setPermissions`; Manual Dice
// by `manualDice(state)`; Elven Accuracy's abilities; `dnd5e.dice.DamageRoll`, as dnd5e publishes it;
// with `foundryWorld({ dice6 })` dnd5e 6.0.5's dice classes, and `{ more }` two more players, Carol and
// Dana; Midi-QOL's rules for critical hits by `startModule({ midiCritical })`; and on a page, its
// party list on Inventory (`party(name)`), the Currency row (`currency(scope)`), an item's menu
// (`itemMenu(row, how)`) and the half space between a coin's amount and its abbreviation
// (`halfSpace(li)`). A group's members change by `changeMembers`, and coins in Foundry alone by
// `coinsInFoundry`. Since module 0.33.0: SKEW=032 is module 0.32.0; an item's quantity changes in
// Foundry alone by `quantityInFoundry`.
import { mkdirSync, readFileSync } from 'node:fs'
import { actors, settings, user, users } from './fvtt/stub.mjs'
import { JSDOM } from 'jsdom'
import { chromium, devices } from 'playwright'
export { chromium, devices }
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5, DND5E6 as DND5E6_ROOT } from './fvtt/paths.mjs'
export { BASE, MODULE, cookieFor, sql }
export { actors, settings, user, users }

/** Module 0.29.0, from before this round, against this round's app. */
export const SKEW = process.env.SKEW === '029'
export const NEW = !SKEW
/** Module 0.30.0, from before 0.31.0, against this round's app: no moves, no results setting. */
export const SKEW030 = process.env.SKEW === '030'
/** Module 0.31.0, from before 0.32.0, against this round's app: no typed dice, no party sends. */
export const SKEW031 = process.env.SKEW === '031'
/** Module 0.32.0, from before 0.33.0, against this round's app: no removals. */
export const SKEW032 = process.env.SKEW === '032'
export const MIDI = Boolean(process.env.MIDI)
export const DND5E6 = Boolean(process.env.DND5E6)
export const SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
/** Module 0.31.0's pictures, beside the others, whatever folder a run's SHOTS is. */
export const SHOTS_031 = SHOTS && `${SHOTS.replace(/\/[^/]*\/?$/, '')}/shots-031`
if (SHOTS_031) mkdirSync(SHOTS_031, { recursive: true })
/** Module 0.33.0's pictures, beside the others, whatever folder a run's SHOTS is. */
export const SHOTS_033 = SHOTS && `${SHOTS.replace(/\/[^/]*\/?$/, '')}/shots-033`
if (SHOTS_033) mkdirSync(SHOTS_033, { recursive: true })
export const VARIANT = `${SKEW ? '-skew029' : ''}${SKEW030 ? '-skew030' : ''}${SKEW031 ? '-skew031' : ''}${SKEW032 ? '-skew032' : ''}${MIDI ? '-midi' : ''}${DND5E6 ? '-dnd5e6' : ''}`
export const ALICE = await cookieFor('e2e-token')
export const BOB = await cookieFor('e2e-bob-token')
export const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
export const note = msg => console.log('note -', msg)
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
export async function until(test, what, ms = 30_000) {
  const end = Date.now() + ms
  while (!(await test())) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(100)
  }
}
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
/** Text as a regular expression matches it literally. */
export const escapeRe = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sorted = value => (Array.isArray(value) ? value.map(sorted)
  : (value && (typeof value === 'object')) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])])) : value)
/** As Postgres keeps JSON: each object's keys in its own order, so compared sorted. */
export const sameJson = (a, b) => same(sorted(a), sorted(b))
const began = Date.now()
export const part = name => console.log(`# ${name}, at ${((Date.now() - began) / 1000).toFixed(1)} s`)

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

// ---- The browser, and Foundry's page, which the module's requests come from ----
/** Every post the module makes, with the app's answer; and what went wrong on any page. */
export const posted = []
export const problems = []
/**
 * `answerAs` changes what the module is told of the app's answer to a post, as another app would
 * answer it; `lose` loses a post on the way.
 */
export const relay = { answerAs: null, lose: null }
export let browser
let gmTab
let fetches = 0
export async function launch(game) {
  browser = await chromium.launch()
  const foundryContext = await browser.newContext()
  await foundryContext.grantPermissions(['local-network-access'], { origin: game })
  await foundryContext.route(`${game}/**`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' }))
  gmTab = await foundryContext.newPage()
  await gmTab.goto(`${game}/game`)
  globalThis.fetch = async (url, init) => {
    const sent = JSON.parse(init.body)
    if (relay.lose?.(sent)) {
      posted.push({ url: String(url), type: sent.type ?? 'fetch', data: sent.data, status: 400, body: '', lost: true })
      return { ok: false, status: 400, statusText: 'Bad Request', headers: new Headers(), json: async () => ({}), text: async () => '' }
    }
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
    const told = (relay.answerAs && body && sent.type) ? relay.answerAs(body, sent) : body
    posted.push({ url: String(url), type: sent.type ?? 'fetch', data: sent.data, bytes: Buffer.byteLength(init.body), status, body, told })
    if (status >= 300) problems.push(`${sent.type ?? url} → ${status}`)
    return {
      ok: status >= 200 && status < 300, status, statusText,
      headers: new Headers(type ? { 'content-type': type } : {}),
      json: async () => JSON.parse(told), text: async () => told,
    }
  }
  return browser
}
/** Every event the module posted of a type, in order. */
export const postsOf = type => posted.filter(p => p.type === type)
/** Until no event has been posted for a while, the long-poll for commands aside. */
export async function settled(quiet = 800) {
  await wait(50)
  const count = () => posted.filter(p => p.type !== 'fetch').length
  let seen = count()
  let since = Date.now()
  while (Date.now() - since < quiet) {
    await wait(50)
    if (count() !== seen) { seen = count(); since = Date.now() }
  }
}

// ---- The Gamemaster's campaign in the app ----
/** Alice, the Gamemaster, sets up the campaign in the app; its id, and its invite. */
export async function newCampaign({ title, address, secret }) {
  const view = await browser.newContext()
  await view.addCookies([ALICE])
  const page = await view.newPage()
  await page.goto(`${BASE}/campaigns`)
  await page.getByRole('button', { name: 'New campaign' }).click()
  const modal = page.getByRole('dialog', { name: 'New campaign' })
  await modal.getByLabel('Campaign title').fill(title)
  await modal.getByLabel('Forge game address').fill(address)
  await modal.getByLabel('Secret', { exact: true }).fill(secret)
  await modal.getByRole('button', { name: 'Set up campaign' }).click()
  await modal.getByRole('button', { name: 'Done' }).click()
  const id = sql(`select id from campaign where title = '${title}'`)
  const invite = await page.getByRole('article', { name: title }).locator('code').first().textContent()
  await view.close()
  return { id, invite }
}

// ---- Foundry, with dnd5e ----
const flat = (object, prefix = '') => Object.entries(object).flatMap(([k, value]) => ((value && (typeof value === 'object'))
  ? flat(value, `${prefix}${k}.`) : [[`${prefix}${k}`, value]]))
/** The game's language: dnd5e's, then the module's own over it, and Midi-QOL's for its options. */
export const words = {}
/** Midi-QOL's words for its options, as the 0.30.0 contract §3.6 has them (MQX lang_en.json). */
export const MIDI_WORDS = {
  autoCheckHitOptions: { none: 'None', all: 'Check - all see result', whisper: 'Check - only GM sees results', gmOnly: 'Check - only GM sees anything' },
  autoCheckSavesOptions: { none: 'Off', allNoRoll: 'Save - All see result only', all: 'Save - All see result + save total', allShow: 'Save - All see Result + Rolls', whisper: 'Save - only GM sees results + rolls', gmOnly: 'Save - only GM sees anything' },
  gmAttackDisplayOptions: { full: 'Full Roll', hideFormula: 'Hide Formula', d20Only: 'D20 Only', attackTotal: 'Attack Total Only', hitMiss: 'Hit/Miss Only', hitMissCrit: 'Hit/Miss/Critical/Fumble', hidden: 'Hidden' },
  gmDamageDisplayOptions: { full: 'Full Roll', totalOnly: 'Damage Total Only', hidden: 'Hidden' },
  playerRollSavesOptions: { none: 'None (private roll)', nonePublic: 'None (public roll)', noneDialogPublic: 'Auto roll and show roll dialog (public roll)', noneDialogPrivate: 'Auto roll and show roll dialog (private roll)', noneDialogSelf: 'Auto roll and show roll dialog (self roll)', noneDialogBlind: 'Auto roll and show roll dialog (blind roll)', chat: 'Chat Message', mtb: 'Monks Token Bar', ftb: 'Flash Token Bar', rer: 'Rippers Epic Rolls' },
  rollNPCSavesOptions: { none: 'Chat Message', auto: 'Auto', autoDialog: 'Auto roll and show roll dialog', mtb: 'Monks Token Bar', ftb: 'Flash Token Bar', rer: 'Rippers Epic Rolls' },
  blindRollDisplayOptions: { hidden: 'Hidden (players see nothing)', obscured: 'Obscured (card shown, result ??)' },
}
/**
 * Midi-QOL's settings as Midi has them out of the box, of those that decide what players see
 * (MQX settings:117, 134-135, 182-185, 204, 209-210), over the stand-in's own for its workflow.
 */
export const MIDI_DEFAULTS = {
  autoCheckHit: 'none', autoCheckSaves: 'none', highlightSuccess: true, highLightCriticalAttackOnly: false,
  gmAttackDisplay: 'full', gmDamageDisplay: 'full', mergeCardMultiDamage: false, addFakeDice: false,
  playerRollSaves: 'none', rollNPCSaves: 'auto', rollNPCLinkedSaves: 'auto', rollSavesBlind: [], rollChecksBlind: [],
  rollSkillsBlind: [], blindRollDisplay: 'hidden',
}
const ABILITIES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
export const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
/** The d20s the game itself throws, in order, before any of its own. */
export const faces = []
export const W = {}

/**
 * Foundry with dnd5e: its dice, its configuration as far as sheets and cards use it, its settings as
 * it registers them, the Gamemaster, Alice and Bob; and Midi-QOL, with MIDI=1.
 */
export async function foundryWorld({ system = DND5E6 ? '6.0.5' : '5.3.3', dice6 = false, more = false } = {}) {
  globalThis.document = { hidden: false }
  globalThis.DOMParser = new JSDOM('').window.DOMParser
  CONST.DOCUMENT_OWNERSHIP_LEVELS = { INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 }
  // dnd5e 5.3.3's dice classes; or, `dice6`, 6.0.5's, as a suite that rolls them under each asks.
  const DND5E = dice6 ? `${DND5E6_ROOT}/module/dice` : `${DND5E5}/module/dice`
  const { messages } = await import('./fvtt/dice-core.mjs')
  const { default: BasicDie } = await import(`${DND5E}/basic-die.mjs`)
  const { default: BasicRoll } = await import(`${DND5E}/basic-roll.mjs`)
  const { default: D20Die } = await import(`${DND5E}/d20-die.mjs`)
  const { default: D20Roll } = await import(`${DND5E}/d20-roll.mjs`)
  const { default: DamageRoll } = await import(`${DND5E}/damage-roll.mjs`)
  Object.assign(CONFIG.Dice, { BasicDie, BasicRoll, D20Die, D20Roll, DamageRoll })
  CONFIG.Dice.terms.d = BasicDie
  const { DiceTerm } = foundry.dice.terms
  const randomFace = DiceTerm.prototype.randomFace
  DiceTerm.prototype.randomFace = function () { return faces.length ? faces.shift() : randomFace.call(this) }
  const ordinal = n => ['Cantrips', '1st Level', '2nd Level', '3rd Level'][n] ?? `${n}th Level`
  const leveled = {
    key: 'spell', slots: true, cantrips: true, prepares: true, order: 20, exclusive: { spells: false, slots: false },
    getAvailableLevels: actor => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => (actor.system.spells[`spell${l}`]?.max ?? 0) > 0),
    getSpellSlotKey: level => `spell${level}`, getLabel: ({ level }) => ordinal(level),
  }
  CONFIG.DND5E = {
    skills: { prc: { label: 'Perception', ability: 'wis' }, ath: { label: 'Athletics', ability: 'str' } },
    tools: {},
    abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
    defaultAbilities: { initiative: 'dex', concentration: 'con' },
    spellcasting: { spell: leveled },
    damageTypes: Object.fromEntries(['piercing', 'slashing', 'fire', 'cold', 'thunder'].map(type => [type, { label: capital(type) }])),
    healingTypes: { healing: { label: 'Healing' } },
    currencies: Object.fromEntries(['pp', 'gp', 'ep', 'sp', 'cp'].map(id => [id, { label: `DND5E.Currency${id.toUpperCase()}`, abbreviation: `DND5E.CurrencyAbbr${id.toUpperCase()}` }])),
    weightUnits: { lb: { abbreviation: 'lb' } },
    activityActivationTypes: {
      action: { label: 'Action', header: 'Actions' }, bonus: { label: 'Bonus Action', header: 'Bonus Actions' },
      reaction: { label: 'Reaction', header: 'Reactions' },
    },
    limitedUsePeriods: { lr: { label: 'Long Rest' }, sr: { label: 'Short Rest' } },
    // config.mjs:4292-4298: the abilities Elven Accuracy is for.
    characterFlags: { elvenAccuracy: { abilities: ['dex', 'int', 'wis', 'cha'] } },
  }
  const dnd5eLang = JSON.parse(readFileSync(`${system.startsWith('6') ? DND5E6_ROOT : DND5E5}/lang/en.json`, 'utf8'))
  Object.assign(words, Object.fromEntries(flat(dnd5eLang)), Object.fromEntries(flat(JSON.parse(readFileSync(`${MODULE}/lang/en.json`, 'utf8')))))
  if (MIDI) {
    for (const [prefix, options] of Object.entries(MIDI_WORDS)) {
      for (const [value, english] of Object.entries(options)) words[`midi-qol.${prefix}.${value}`] = english
    }
  }
  game.i18n.localize = k => words[k] ?? k
  game.i18n.has = k => Object.hasOwn(words, k)
  // Foundry's own shorthand for a translation (v13 and on), which dnd5e 6's dice call.
  globalThis._loc ??= (k, data) => (data ? game.i18n.format(k, data) : game.i18n.localize(k))
  game.i18n.format = (k, data = {}) => (words[k] ?? k).replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(data, name) ? String(data[name]) : match))
  foundry.utils.escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[ch])
  // Foundry's enricher, as far as these descriptions need it: it drops a secret section where it's
  // enriched without secrets, as for a group's observers (TextEditor.enrichHTML's `secrets`).
  foundry.applications.ux.TextEditor = { implementation: { async enrichHTML(html, options = {}) {
    return options.secrets === false ? String(html ?? '').replace(/<section class="secret"[^>]*>[\s\S]*?<\/section>/g, '') : html
  } } }
  CONFIG.statusEffects = [{ id: 'concentrating', name: 'Concentrating', img: 'systems/dnd5e/icons/svg/statuses/concentrating.svg' }]
  CONFIG.specialStatusEffects = { CONCENTRATING: 'concentrating' }
  // The game, and dnd5e, as a dev checkout of each reports itself.
  Object.assign(game.system, { id: 'dnd5e', title: 'D&D Fifth Edition', version: system })
  game.modules.set('sending-stone', { id: 'sending-stone', title: 'Sending Stone', active: true, version: JSON.parse(readFileSync(`${MODULE}/module.json`, 'utf8')).version })
  game.documentTypes = { Actor: ['character', 'npc', 'vehicle', 'group', 'encounter'] }
  // dnd5e's settings that decide what players see, as it registers them (D5 settings.mjs:538-578).
  game.settings.settings = new Map([
    ['dnd5e.attackRollVisibility', {
      name: 'SETTINGS.DND5E.VISIBILITY.Attack.Name', scope: 'world', default: 'none',
      choices: { all: 'SETTINGS.DND5E.VISIBILITY.Attack.All', hideAC: 'SETTINGS.DND5E.VISIBILITY.Attack.HideAC', none: 'SETTINGS.DND5E.VISIBILITY.Attack.None' },
    }],
    ['dnd5e.challengeVisibility', {
      name: 'SETTINGS.DND5E.VISIBILITY.Challenge.Name', scope: 'world', default: 'player',
      choices: { all: 'SETTINGS.DND5E.VISIBILITY.Challenge.All', player: 'SETTINGS.DND5E.VISIBILITY.Challenge.Player', none: 'SETTINGS.DND5E.VISIBILITY.Challenge.None' },
    }],
    ...(system.startsWith('6') ? [['dnd5e.chatCardSummary', { name: 'SETTINGS.DND5E.SUMMARIZECHAT.Name', scope: 'client', default: true, type: Boolean }]] : []),
  ])
  settings.set('messageMode', 'public')
  settings.set('criticalDamageModifiers', false)
  settings.set('criticalDamageMaxDice', false)
  // dnd5e out of the box: players see no hits, and whether creatures save only against players' cards.
  settings.set('attackRollVisibility', 'none')
  settings.set('challengeVisibility', 'player')

  const { Actor5e } = await import('./fvtt/actor5e.mjs')
  const cards = await import('./fvtt/dnd5e-cards.mjs')
  const { AttackActivity, SaveActivity, DamageActivity, HealActivity, Collection, Item5e, itemPreparers, equip } = await import('./fvtt/activity5e.mjs')
  const midiFake = await import('./fvtt/midi-fake.mjs')
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
    // dnd5e's own aggregateDamageRolls splits rolls into parts by damage type; for whole rolls of
    // one type each, that is a part per type, its total the sum of its rolls'.
    // As dnd5e publishes its dice when its script loads (dnd5e.mjs:38-43), before any module's init.
    dice: {
      DamageRoll,
      aggregateDamageRolls(rolls) {
        const types = new Map()
        for (const roll of rolls) types.set(roll.options?.type ?? '', (types.get(roll.options?.type ?? '') ?? 0) + roll.total)
        return [...types].map(([type, total]) => ({ total, options: { type } }))
      },
    },
  }
  globalThis.Item = { implementation: class { constructor(data) { Object.assign(this, data); this.system ??= {} } } }
  // dnd5e's ChatMessage5e finds the item a message is of (chat-message.mjs:987-994).
  Hooks.on('preCreateChatMessage', message => {
    Object.getPrototypeOf(message).getAssociatedItem ??= function () {
      const id = this.flags?.dnd5e?.item?.id
      return id ? (this.getAssociatedActor()?.items?.get(id) ?? undefined) : undefined
    }
  })
  users.activeGM = user('gm', 'Gamemaster', true)
  const gm = users.get('gm')
  gm.active = true
  gm.targets = new Set()
  const alice = user('alice', 'Alice')
  const bob = user('bob', 'Bob')
  // Neither player is in Foundry: they follow the game in the app.
  alice.active = false
  bob.active = false
  // Two more players, Foundry users with no seat in the app, as a suite asks.
  if (more) {
    for (const [id, name] of [['carol', 'Carol'], ['dana', 'Dana']]) user(id, name).active = false
  }
  if (MIDI) {
    midiFake.installMidi()
    Object.assign(midiFake.midi.settings, MIDI_DEFAULTS)
    game.modules.set('midi-qol', { id: 'midi-qol', title: 'Midi QOL', version: '14.1.2', active: true })
  }
  game.modules.set('lib-wrapper', { id: 'lib-wrapper', title: 'libWrapper', version: '1.12.13.0', active: false })
  globalThis.fromUuidSync = uuid => {
    const parts = String(uuid).split('.')
    if (parts[0] === 'Scene') return [...midiFake.placeables.values()].find(p => p.document.uuid === uuid)?.document ?? null
    if (parts[0] !== 'Actor') return null
    const actor = actors.get(parts[1]) ?? null
    if (parts.length === 2) return actor
    if (parts[2] === 'Item') return actor?.items?.get?.(parts[3]) ?? null
    return null
  }
  Object.assign(W, { messages, Actor5e, cards, equip, Collection, Item5e, itemPreparers, midi: midiFake.midi, placeables: midiFake.placeables, gm, alice, bob })
  return W
}

/**
 * A dnd5e character with what uses need, as activity5e gives them; its concentration dnd5e's, as
 * dnd5e-cards ports it. Foundry tells every client of a change to it, and the module sends its sheet
 * again.
 */
export function character(data, gear) {
  const actor = new W.cards.Character(data)
  const ability = actor.system.attributes.concentration
  Object.defineProperty(actor, 'concentration', { value: null, writable: true, configurable: true })
  W.equip(actor, gear)
  delete actor.concentration
  delete actor.beginConcentrating
  delete actor.endConcentration
  actor.system.attributes.concentration = { ...ability, limit: 1 }
  Object.defineProperty(actor, 'statuses', { configurable: true, get: () => new Set(actor.effects.flatMap(effect => [...(effect.statuses ?? [])])) })
  actor.allApplicableEffects = function* () { yield* actor.effects }
  actor.img = `icons/${data.id}.webp`
  actor.prototypeToken = { texture: { src: `tokens/${data.id}.webp` } }
  actors.set(actor.id, actor)
  const update = actor.update.bind(actor)
  actor.update = async changes => { await update(changes); await Hooks.callAll('updateActor', actor, changes, {}, 'gm') }
  return actor
}
/** An NPC, as the Gamemaster's creatures are. */
export function npc(id, name, ac, mods = {}) {
  const actor = new W.Actor5e({ id, name, mods, hp: { value: 30, max: 30, temp: 0 } })
  actor.type = 'npc'
  actor.documentName = 'Actor'
  actor.img = `icons/${id}.webp`
  actor.prototypeToken = { texture: { src: `tokens/${id}.webp` } }
  actors.set(id, actor)
  W.equip(actor, { ac })
  return actor
}

/**
 * A Group actor, as dnd5e 5.3.3 prepares one (data/actor/group.mjs:148-172): its members, each
 * `{actor}`, with their ids; its own items; who may see it, by user, as Foundry's ownership; and its
 * description and coin. Foundry tells every client of a change to it.
 */
export function group(id, name, { members = [], ownership = {}, description = {}, currency = {}, flags = {} } = {}) {
  const items = new Map()
  const g = {
    documentName: 'Actor', id, name, type: 'group', uuid: `Actor.${id}`, img: `icons/${id}.webp`,
    ownership: { default: 0, ...ownership }, flags,
    system: { members: [], description: { full: '', summary: '', ...description }, currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...currency } },
    items: { get: k => items.get(k), [Symbol.iterator]: () => items.values(), map: items, get size() { return items.size } },
    getUserLevel(u) { return u.isGM ? 3 : (this.ownership[u.id] ?? this.ownership.default ?? 0) },
    testUserPermission(u, level) { return this.getUserLevel(u) >= CONST.DOCUMENT_OWNERSHIP_LEVELS[level] },
    async update(changes) {
      for (const [path, value] of Object.entries(changes)) foundry.utils.setProperty(this, path, value)
      await Hooks.callAll('updateActor', this, changes, {}, 'gm')
    },
  }
  members.forEach(m => { m.prototypeToken ??= { texture: { src: `tokens/${m.id}.webp` } } })
  prepareMembers(g, members)
  actors.set(id, g)
  return g
}
/** A group's members as dnd5e prepares them: each `{actor}`, and their ids, `members.ids`. */
export function prepareMembers(g, members) {
  const list = members.map(m => ({ actor: m }))
  Object.defineProperty(list, 'ids', { value: new Set(members.map(m => m.id)), enumerable: false })
  g.system.members = list
}
/** An item a group holds, as its sheet reads one. */
export function item(parent, id, type, name, system = {}) {
  const it = {
    documentName: 'Item', id, uuid: `${parent.uuid}.Item.${id}`, name, type, img: `icons/${id}.webp`, sort: 0, parent,
    labels: { properties: [] },
    system: { quantity: 1, identified: true, description: { value: '' }, weight: { value: 1, units: 'lb' }, ...system },
  }
  parent.items.map.set(id, it)
  return it
}

// ---- Foundry's embedded items, for moving items and coins (module 0.31.0) ----
/** The actors `embedded()` was given, whose items are documents, as Foundry's. */
const documented = new Set()
/** Every write made to them, in order: [kind, actor or item id, ids or changes]. */
export const writes = []
const holds = []
/**
 * Hold the next write `test(kind, target, payload)` matches, kind "create", "delete", "update" (an
 * actor's) or "updateItem", until let go: as a write that takes its time, for a second move made
 * meanwhile. `held` resolves once a write is held.
 */
export function holdWrite(test) {
  let release
  let reached
  const hold = { test, until: new Promise(resolve => { release = resolve }), held: new Promise(resolve => { reached = resolve }) }
  hold.reached = reached
  holds.push(hold)
  return { held: hold.held, release: () => { const at = holds.indexOf(hold); if (at >= 0) holds.splice(at, 1); release() } }
}
async function writing(kind, target, payload) {
  writes.push([kind, target.id, payload])
  const hold = holds.find(h => h.test(kind, target, payload))
  if (hold) {
    holds.splice(holds.indexOf(hold), 1)
    hold.reached()
    await hold.until
  }
  // A write is never made at once, as none of Foundry's is.
  await new Promise(resolve => setImmediate(resolve))
}
let documents = false
/**
 * dnd5e's Item5e, as far as moving uses it: its own createWithContents, read from its source,
 * 5.3.3's or with DND5E6=1 6.0.5's (D5 documents/item.mjs:1278-1310; D6 :1303-1335), with
 * PhysicalItemTemplate.MAX_DEPTH 5; Foundry's fromCompendium [core, unverified: what it keeps]; and
 * each embedded item prepared as dnd5e prepares it: an unidentified one by its unidentified name
 * (identifiable.mjs:58-62), a container with what it holds (container.mjs:107-140).
 */
function documentsReady() {
  if (documents) return
  documents = true
  const D = DND5E6 ? `${DND5E6_ROOT}/module` : `${DND5E5}/module`
  const [first, last] = DND5E6 ? [1303, 1335] : [1278, 1310]
  const method = readFileSync(`${D}/documents/item.mjs`, 'utf8').split('\n').slice(first - 1, last).join('\n')
  if (!/^\s*static async createWithContents\(items, \{ container, keepId=false, transformAll, transformFirst \}=\{\}\) \{/.test(method)) {
    throw new Error(`dnd5e's createWithContents isn't at ${D}/documents/item.mjs:${first}-${last}`)
  }
  // `instanceof Item` in it: an item document, as Foundry's Item is.
  class Item { static [Symbol.hasInstance](value) { return (value?.documentName === 'Item') && (typeof value.toObject === 'function') } }
  const Item5e = new Function('Item', 'PhysicalItemTemplate', `return class Item5e extends Item {\n${method}\n}`)(Item, { MAX_DEPTH: 5 })
  CONFIG.Item = { ...(CONFIG.Item ?? {}), documentClass: Item5e }
  game.items = {
    ...(game.items ?? {}),
    fromCompendium(document, { keepId = false, clearSort = true, clearOwnership = true } = {}) {
      const data = document.toObject()
      if (!keepId) delete data._id
      if (clearSort) delete data.sort
      if (clearOwnership) delete data.ownership
      return data
    },
  }
  // Foundry's deleteProperty (common/utils/helpers.mjs).
  foundry.utils.deleteProperty ??= (object, key) => {
    const parts = key.split('.')
    const parent = parts.slice(0, -1).reduce((o, part) => o?.[part], object)
    if (!parent || !(parts.at(-1) in parent)) return false
    delete parent[parts.at(-1)]
    return true
  }
  W.itemPreparers.push(item => {
    if (!documented.has(item.actor)) return
    const source = item._source
    item.documentName = 'Item'
    item.sort = source.sort ?? 0
    item._stats = foundry.utils.deepClone(source._stats ?? {})
    item.effects = foundry.utils.deepClone(source.effects ?? [])
    item.labels ??= { properties: [] }
    if ((source.system?.identified === false) && source.system?.unidentified?.name) item.name = source.system.unidentified.name
    if (item.type === 'container') {
      Object.defineProperty(item.system, 'contents', {
        configurable: true,
        get: () => new W.Collection(item.actor.items.filter(other => other.system.container === item.id).map(other => [other.id, other])),
      })
      Object.defineProperty(item.system, 'allContainedItems', {
        configurable: true,
        get() {
          return this.contents.contents.reduce((all, inner) => {
            all.set(inner.id, inner)
            if (inner.type === 'container') inner.system.allContainedItems.forEach(deeper => all.set(deeper.id, deeper))
            return all
          }, new W.Collection())
        },
      })
    }
  })
}
/** An item document on an embedded actor, as its data: its update fires updateItem, as Foundry tells every client. */
function addDocument(actor, data) {
  const source = foundry.utils.deepClone(data)
  source._id ??= source.id ?? foundry.utils.randomID()
  source.id = source._id
  const item = new W.Item5e(actor, source)
  item.update = async function (changes = {}) {
    await writing('updateItem', this, changes)
    W.Item5e.prototype.update.call(this, changes)
    await Hooks.callAll('updateItem', this, foundry.utils.expandObject(changes), {}, 'gm')
    return this
  }
  actor.items.set(item.id, item)
  return item
}
/** dnd5e's coin as prepared from what's stored: 6.0.5 rounds it down for the sheet (D6 data/shared/currency.mjs:43-47). */
export function prepareCoins(actor) {
  actor.system.currency = Object.fromEntries(Object.entries(actor._source.system.currency).map(([key, value]) => [key, DND5E6 ? Math.floor(value) : value]))
}
/**
 * An actor, a character or a group, with its items as Foundry's embedded documents and its coin as
 * stored (`_source`) and prepared: createEmbeddedDocuments and deleteEmbeddedDocuments, each one
 * call with its ids, firing createItem and deleteItem; update, writing its coin as stored, firing
 * updateActor; each item's update firing updateItem, and its toObject and `_source`. Its items so
 * far become documents, and `items` (each its data, `_id` its id) and `currency` are added.
 */
export function embedded(actor, { items = [], currency = {} } = {}) {
  documentsReady()
  documented.add(actor)
  const before = Array.from(actor.items ?? [])
  actor.items = new W.Collection()
  for (const it of before) {
    addDocument(actor, it._source ? foundry.utils.deepClone(it._source)
      : { id: it.id, name: it.name, type: it.type, img: it.img, system: foundry.utils.deepClone(it.system ?? {}) })
  }
  for (const data of items) addDocument(actor, data)
  // As every Foundry actor has, which an item's description is enriched with.
  actor.getRollData ??= () => ({})
  actor._source = { ...(actor._source ?? {}), name: actor.name, system: { currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...(actor.system.currency ?? {}), ...currency } } }
  prepareCoins(actor)
  actor.update = async function (changes) {
    await writing('update', this, changes)
    for (const [path, value] of Object.entries(changes)) {
      if (path.startsWith('system.currency.')) foundry.utils.setProperty(this._source, path, value)
      else foundry.utils.setProperty(this, path, value)
    }
    prepareCoins(this)
    await Hooks.callAll('updateActor', this, foundry.utils.expandObject(changes), {}, 'gm')
    return this
  }
  actor.createEmbeddedDocuments = async function (type, data, options = {}) {
    await writing('create', this, data.map(entry => entry._id ?? null))
    const made = data.map(entry => {
      const source = foundry.utils.deepClone(entry)
      source._id = (options.keepId && source._id) ? source._id : foundry.utils.randomID()
      return addDocument(this, source)
    })
    for (const item of made) await Hooks.callAll('createItem', item, options, 'gm')
    return made
  }
  actor.deleteEmbeddedDocuments = async function (type, ids) {
    await writing('delete', this, [...ids])
    // As Foundry's: one that isn't there refuses the whole call.
    const missing = ids.find(id => !this.items.has(id))
    if (missing) throw new Error(`Item ${missing} does not exist`)
    const gone = ids.map(id => this.items.get(id))
    for (const id of ids) this.items.delete(id)
    for (const item of gone) await Hooks.callAll('deleteItem', item, {}, 'gm')
    return gone
  }
  return actor
}

/**
 * An actor's coin changed in Foundry alone: as stored and prepared again, with no update and no
 * hook, so the module finds it changed when it next reads it and the app's sheet still has the old.
 */
export function coinsInFoundry(actor, currency) {
  Object.assign(actor._source.system.currency, currency)
  prepareCoins(actor)
}
/**
 * An item's quantity changed in Foundry alone: as stored and prepared again, with no update and no
 * hook, so the module finds it changed when it next reads it and the app's sheet still has the old.
 */
export function quantityInFoundry(actor, itemId, quantity) {
  // The stand-in's own updateSource: stored and prepared again, with no write and no updateItem.
  W.Item5e.prototype.updateSource.call(actor.items.get(itemId), { 'system.quantity': quantity })
}
/**
 * A group's members changed in Foundry: prepared as dnd5e prepares them, then, unless `tell` is
 * false, its update, every client's, so the module sends the group again and the app learns of it.
 * Left untold, the module sees the change when it next reads the group, and the app doesn't.
 */
export async function changeMembers(g, members, { tell = true } = {}) {
  prepareMembers(g, members)
  if (tell) await Hooks.callAll('updateActor', g, { system: { members: members.map(m => ({ actor: m.id })) } }, {}, 'gm')
}

// ---- Who may type their own dice (module 0.32.0) ----
let permissionsStored = false
/**
 * Make Manual Rolls given to these roles, as core changes the world's roles' permissions (MD
 * scripts/module.mjs:15-17): the hook first, `game.permissions` after it; the setting created the
 * first time it's changed.
 */
export async function setPermissions(manualRolls) {
  const value = { ...game.permissions, MANUAL_ROLLS: manualRolls }
  const hook = permissionsStored ? 'updateSetting' : 'createSetting'
  permissionsStored = true
  await Hooks.callAll(hook, { key: 'core.permissions', value }, {}, 'gm')
  game.permissions = value
}
let manualDiceSwitch = false
let manualDiceReady = false
/**
 * Manual Dice, as installed and switched on or not: "missing", "inactive" (installed, not enabled
 * in the world), "off" (enabled, switched off in its own settings) or "active". Its setting is its
 * own: Foundry keeps it under its id, which the stand-in's settings don't tell apart.
 */
export function manualDice(state) {
  if (!manualDiceReady) {
    manualDiceReady = true
    const storedGet = game.settings.get
    game.settings.get = (module, key) => ((module === 'manual-dice') ? manualDiceSwitch : storedGet.call(game.settings, module, key))
    game.settings.settings ??= new Map()
  }
  if (state === 'missing') {
    game.modules.delete('manual-dice')
    game.settings.settings.delete('manual-dice.enabled')
  } else {
    game.modules.set('manual-dice', { id: 'manual-dice', title: 'Manual Dice', version: '1.0.0', active: state !== 'inactive', authors: [] })
    game.settings.settings.set('manual-dice.enabled', {})
  }
  manualDiceSwitch = state === 'active'
}
/** Midi-QOL's rules for critical hits, the Gamemaster's and the players', once `startModule` installs them. */
export let midiCritical = null

/**
 * Start the module, as Foundry does, with these campaigns, once its first fetch is made. A
 * campaign may carry `transfers`, "Players move items and coins" (module 0.31.0); `results` is
 * "Hit/miss and save results in the app", "foundry" or "always", left at its default unset. With
 * MIDI=1, `midiCritical` (`{ gm, player }`) puts Midi-QOL's rules for critical hits in place of
 * dnd5e's (fvtt/midi-critical.mjs), as Midi wraps dnd5e at its init, after the module's scripts load.
 */
export async function startModule({ campaigns, secrets, gmContent = false, results, midiCritical: rules }) {
  await import(`${MODULE}/scripts/module.mjs`)
  if (MIDI && rules) {
    const stand = await import('./fvtt/midi-critical.mjs')
    stand.installMidiCritical(CONFIG.Dice.DamageRoll)
    Object.assign(stand.midiCritical, rules)
    midiCritical = stand.midiCritical
  }
  await Hooks.callAll('init')
  settings.set('listenerUrl', new URL(BASE).host)
  settings.set('campaignSecrets', secrets)
  settings.set('chatEvents', true)
  settings.set('combatEvents', true)
  settings.set('gmContent', gmContent)
  if (results !== undefined) settings.set('chatResults', results)
  settings.set('campaigns', campaigns)
  await Hooks.callAll('ready')
  await until(() => posted.some(p => p.type === 'bridge.hello'), "the module's hello")
}
/** A setting changed in Foundry, as the Gamemaster's client stores it: then its hook, every client's. */
export async function changeSetting(namespace, key, value) {
  settings.set(key, value)
  await Hooks.callAll('updateSetting', { key: `${namespace}.${key}`, value }, { value }, {}, 'gm')
}

// ---- The players' pages ----
/** A page of the app in a browser of its own: a phone's, a tablet's or a computer's. */
export async function browse({ width, height, scheme = 'light', who = ALICE, path, toasts = true, device }) {
  const view = await browser.newContext(device ? { ...device, colorScheme: scheme } : { viewport: { width, height }, isMobile: width < 1024, hasTouch: width < 1024, colorScheme: scheme })
  await view.addCookies([who])
  await view.addInitScript(on => { try { localStorage.setItem('sending-stone:roll-toasts', on ? 'on' : 'off') } catch {} }, toasts)
  await view.route('https://*.forge-vtt.com/**', route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  if (path) await page.goto(`${BASE}${path}`)
  const nav = page.getByRole('navigation', { name: 'Table' })
  const who_ = {
    width: width ?? device?.viewport?.width, view, page, nav, scheme,
    log: page.getByRole('list', { name: 'Chat log' }),
    chat: () => nav.getByRole('button', { name: /^Chat/ }).click(),
    character: () => nav.getByRole('button', { name: /^Character/ }).click(),
    tab: name => page.getByRole('tablist', { name: 'Character sheet' }).getByRole('tab', { name: new RegExp(`^${name}\\b`) }).click(),
  }
  /**
   * Open a party sheet from the Inventory tab's party list (since PR #44), by the row's name: the
   * group's name and "Primary party" or "Party sheet". The sheet starts on its Character tab after
   * any reload, so Inventory is chosen every time.
   */
  who_.party = async name => {
    await who_.tab('Inventory')
    await page.getByRole('tabpanel').getByRole('region', { name: /^Part(y|ies)$/ })
      .getByRole('button', { name: new RegExp(`^${escapeRe(name)} (Primary party|Party sheet)$`) }).click()
  }
  /** The Currency row's buttons, in the group named by its label (module 0.32.0's feedback). */
  who_.currency = (scope = page) => scope.getByRole('group', { name: 'Currency', exact: true })
  /**
   * Open an item's own menu from its row: by `mouse`, a right-click on its name; `touch`, a touch
   * held 600 ms; or `key`, focus then Shift+F10. The menu, named the item's name.
   */
  who_.itemMenu = async (row, how, name) => {
    const target = row.locator('summary, button[aria-expanded]').first()
    if (how === 'mouse') await target.click({ button: 'right' })
    else if (how === 'key') {
      await target.focus()
      await page.keyboard.press('Shift+F10')
    } else await hold(target, 600)
    return page.getByRole('menu', { name })
  }
  /**
   * The separator between a coin's amount and its abbreviation, as drawn: its width, and the width
   * of a space in the li's own font, and the li's text.
   */
  who_.halfSpace = li => li.evaluate(el => {
    const spaced = [...el.querySelectorAll('span')].find(span => span.textContent === ' ')
    const canvas = document.createElement('canvas').getContext('2d')
    canvas.font = getComputedStyle(el).font
    return { separator: spaced?.getBoundingClientRect().width ?? null, space: canvas.measureText(' ').width, text: el.textContent, size: spaced && getComputedStyle(spaced).fontSize, font: getComputedStyle(el).fontSize }
  })
  /** A touch held on an element for `ms`, as a finger does: pointer events of a touch's kind. */
  async function hold(locator, ms) {
    const box = await locator.boundingBox()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const cdp = await view.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await page.waitForTimeout(ms)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  }
  who_.hold = hold
  return who_
}
const isDark = page => page.evaluate(() => document.documentElement.classList.contains('dark'))
export async function theme(who, scheme) {
  await who.page.emulateMedia({ colorScheme: scheme })
  await until(async () => (await isDark(who.page)) === (scheme === 'dark'), `the ${scheme} theme at ${who.width} px`, 10_000)
  who.scheme = scheme
}
/** A shot of the page, or of a part of it, at its width, in its theme; into `dir`, SHOTS unless said. */
export async function shoot(who, name, locator, dir = SHOTS) {
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
export async function shootBoth(who, name, locator, dir = SHOTS) {
  if (!SHOTS) return
  const was = who.scheme
  for (const scheme of [was, was === 'light' ? 'dark' : 'light']) {
    await theme(who, scheme)
    await shoot(who, name, typeof locator === 'function' ? locator() : locator, dir)
  }
  await theme(who, was)
}
/** How far the page scrolls sideways: 0 when it doesn't. */
export const sideways = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
/** What the app answers a request from this page, as JSON where it is; a POST of `body` as JSON. */
export const call = (page, path, { method = 'GET', body } = {}) => page.evaluate(async ({ path, method, body }) => {
  const response = await fetch(path, { method, ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), redirect: 'manual' })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: response.status, text, json }
}, { path, method, body })
/** Close everything, and say whether anything went wrong. */
export async function finish() {
  console.log('problems:', problems)
  check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
  await browser.close()
  process.exit(0)
}
