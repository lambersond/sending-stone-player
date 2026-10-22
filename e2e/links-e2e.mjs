// Descriptions that roll, end to end: the real module, in a stand-in Foundry with dnd5e 5.3.3's real
// dice classes (D20Roll, DamageRoll, BasicRoll), its conditions (config.mjs), its English
// (lang/en.json), its createRollLabel (ported from enrichers.mjs, as fvtt/texts.mjs has it) and its
// roll-request-card.hbs rendered by Handlebars, tells the production app, from a browser on the
// game's page, of Thorin's sheet; its descriptions are in dnd5e 5.3.3's enriched markup, as
// the 0.17.0 enrichers map (§2) gives it, which the stand-in's enrichHTML hands on as it is. Alice, on her
// phone, opens Thorin's Wand of Frost: she asks the table for its save, rolls her own against its
// DC and against the one its author hid, rolls its damage and its inline roll, and opens the rules
// of the conditions it names; reads his biography, whose secret save isn't asked and whose forged
// span acts on nothing; rolls from the description of the Starry Wisp his torch casts, in its
// info dialog; and opens his Climbing Rope, whose checks work as the wand's save does: she asks
// the table for its Athletics check, rolls her own against its DC, in plain words too and with
// advantage, and against the DC its author hid of a tool's check, and rolls the wand's Strength
// check; its passive checks stay text. A long-press on the wand's damage offers its other ways, as
// an attack's damage has them: a critical hit's, made in the game with her dice as the world's rules
// make one, dnd5e's own and, once the Gamemaster turns it on, Powerful Critical; at its highest; and
// a die more; a tap still rolls it plainly; and a Healing Draught's healing is never a critical
// hit's. His greataxe's damage, which dnd5e's link rolls through its attack, adds to a critical hit
// its critical damage and his Savage Attacks' die more, which the app keeps marked never a critical
// hit's for apps before 0.20.0: the phone offers it all the same, and throws them all, a die more
// too, as dnd5e's own way and Powerful Critical make them; one made up without his die more or its
// critical damage's die, the app refuses. A Blighted Rod's damage takes a d4 away: the phone offers
// it as a critical hit's or changed, never at its highest, and a die more is of its d6, never the
// d4, as the game makes it; one made up with a d4 more, the app refuses. On a desktop, a
// condition's rules show on a hover, and the context menu key opens the wand's damage menu. MIDI=1
// puts the stand-in Midi-QOL in the world (fvtt/midi-fake.mjs), with its settings for saves and
// concentration, its dnd5e.preRollDamage hook, a Gamemaster's Midi damage roll left open on its
// dnd5e.rollDamage hook, and its rules for a critical hit's damage, as fvtt/texts.mjs has them:
// since module 0.32.0 (decision 5), under each of Midi-QOL's rules for the Gamemaster ("doubleDice",
// "maxAll", "maxCrit", "maxCritRoll"), an app roll's critical hit's is dnd5e's: no sheet is sent, and
// the wand's 4d6 and the greataxe's 3d12 + 4 + 1d6 are offered, thrown and made as dnd5e makes them,
// a critical hit's made up as dnd5e throws it taken. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
// Screenshots to SHOTS.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { settings, user, users, actors } from './fvtt/stub.mjs'
import { expandSheet } from './fvtt/slim-expand.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

const DND5E_ROOT = DND5E5
const DND5E = `${DND5E_ROOT}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
const MIDI = Boolean(process.env.MIDI)
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

// Foundry's hooks: callAll and call run their handlers at once, as Foundry's do; once runs once.
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

// ---- Foundry, with dnd5e's dice, its conditions, its English and its request card ----
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
const TYPES = ['slashing', 'piercing', 'bludgeoning', 'acid', 'cold', 'fire', 'lightning', 'poison', 'force', 'radiant']
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
// dnd5e 5.3.3's conditions, as its config.mjs has them: an object of literals only.
const configSource = readFileSync(`${DND5E_ROOT}/module/config.mjs`, 'utf8')
const conditionsAt = configSource.indexOf('DND5E.conditionTypes = {')
const conditionTypes = new Function(`return ${configSource.slice(configSource.indexOf('{', conditionsAt), configSource.indexOf('\n};', conditionsAt) + 2)}`)()
const ordinal = n => ['Cantrips', '1st Level', '2nd Level', '3rd Level', '4th Level'][n] ?? `${n}th Level`
const leveled = {
  key: 'spell', slots: true, cantrips: true, prepares: true, order: 20, exclusive: { spells: false, slots: false },
  getAvailableLevels: actor => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => (actor.system.spells[`spell${l}`]?.max ?? 0) > 0),
  getSpellSlotKey: level => `spell${level}`, getLabel: ({ level }) => ordinal(level),
}
// Thieves' Tools, as dnd5e looks a tool up: by its base item in the compendium.
const THIEVES_TOOLS = 'Compendium.dnd5e.equipment24.Item.phbtulThievesToo'
const innate = { key: 'innate', order: -20, getAvailableLevels: () => [], getSpellSlotKey: () => 'innate', getLabel: () => 'Innate' }
CONFIG.DND5E = {
  skills: { ath: { label: 'Athletics', ability: 'str' }, prc: { label: 'Perception', ability: 'wis' } },
  tools: { thief: { ability: 'dex', id: THIEVES_TOOLS } },
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: capital(id) }])),
  defaultAbilities: { initiative: 'dex', concentration: 'con' },
  enrichmentLookup: { tools: { thief: { ability: 'dex', id: THIEVES_TOOLS } } },
  spellcasting: { spell: leveled, innate },
  damageTypes: Object.fromEntries(TYPES.map(type => [type, { label: capital(type) }])),
  healingTypes: { healing: { label: 'Healing' }, temphp: { label: 'Temporary HP' } },
  conditionTypes,
  activityActivationTypes: {
    action: { label: 'Action', header: 'Actions' }, bonus: { label: 'Bonus Action', header: 'Bonus Actions' },
    reaction: { label: 'Reaction', header: 'Reactions' },
  },
}

// dnd5e's English, as Foundry finds a string in its lang/en.json, whose keys are partly nested and
// partly dotted.
const english = JSON.parse(readFileSync(`${DND5E_ROOT}/lang/en.json`, 'utf8'))
function translation(object, parts) {
  if (!parts.length) return object
  for (let i = parts.length; i > 0; i--) {
    const at = parts.slice(0, i).join('.')
    if ((object !== null) && (typeof object === 'object') && Object.hasOwn(object, at)) {
      const found = translation(object[at], parts.slice(i))
      if (found !== undefined) return found
    }
  }
  return undefined
}
game.i18n.localize = text => {
  const found = translation(english, String(text).split('.'))
  return (typeof found === 'string') ? found : text
}
game.i18n.format = (text, data = {}) => game.i18n.localize(text).replace(/{[^}]+}/g, match => data[match.slice(1, -1)] ?? match)
game.i18n.has = text => typeof translation(english, String(text).split('.')) === 'string'
// Foundry's escapeHTML (common/utils/helpers.mjs).
foundry.utils.escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[ch])

// dnd5e 5.3.3's createRollLabel, ported from module/enrichers.mjs:1446-1501, for saves and checks;
// a tool's name is its base item's, from the compendium's index (as fvtt/texts.mjs has it); and
// Trait.keyLabel, which names a tool the same way.
const Trait = {
  getBaseItem: id => ((id === THIEVES_TOOLS) ? { name: "Thieves' Tools" } : null),
  keyLabel: (key, { trait } = {}) => ((trait === 'tool') ? ({ thief: "Thieves' Tools" })[key] : undefined) ?? key,
}
function createRollLabel(config) {
  const { label: ability, abbreviation } = CONFIG.DND5E.abilities[config.ability] ?? {}
  const skill = CONFIG.DND5E.skills[config.skill]?.label
  const toolUUID = CONFIG.DND5E.enrichmentLookup.tools[config.tool]
  const tool = toolUUID?.id ? Trait.getBaseItem(toolUUID.id, { indexOnly: true })?.name : toolUUID?.label ?? null
  const longSuffix = config.format === 'long' ? 'Long' : 'Short'
  const showDC = config.dc && !config.hideDC
  let label
  switch (config.type) {
    case 'check':
    case 'skill':
    case 'tool':
      if (ability && (skill || tool)) label = game.i18n.format('EDITOR.DND5E.Inline.SpecificCheck', { ability, type: skill ?? tool })
      else label = ability
      if (config.passive) {
        label = game.i18n.format(`EDITOR.DND5E.Inline.${showDC ? 'DC' : ''}Passive${longSuffix}`, { dc: config.dc, check: label })
      } else {
        if (showDC) label = game.i18n.format('EDITOR.DND5E.Inline.DC', { dc: config.dc, check: label })
        label = game.i18n.format(`EDITOR.DND5E.Inline.Check${longSuffix}`, { check: label })
      }
      break
    case 'concentration':
    case 'save':
      if (config.type === 'save') label = ability
      else label = `${game.i18n.localize('DND5E.Concentration')} ${ability ? `(${abbreviation})` : ''}`
      if (showDC) label = game.i18n.format('EDITOR.DND5E.Inline.DC', { dc: config.dc, check: label })
      label = game.i18n.format(`EDITOR.DND5E.Inline.Save${longSuffix}`, { save: label })
      break
    default:
      return ''
  }
  if (config.icon) {
    switch (config.type) {
      case 'check':
      case 'skill': label = `${ICON_CHECK}${label}`; break
      case 'tool': label = `<i class="fas fa-hammer"></i>${label}`; break
      default: label = `<i class="fas fa-shield-heart"></i>${label}`
    }
  }
  return label
}
const ICON_CHECK = '<i class="dnd5e-icon" data-src="systems/dnd5e/icons/svg/ability-score-improvement.svg"></i>'

// Handlebars, with dnd5e's dnd5e-dataset helper (module/utils.mjs:920-934), rendering dnd5e's own
// templates as Foundry's renderTemplate does.
const Handlebars = createRequire(import.meta.url)('handlebars')
Handlebars.registerHelper('dnd5e-dataset', (object) => {
  const entries = []
  for (let [name, value] of Object.entries(object ?? {})) {
    if (value === undefined) continue
    name = name.replace(/[A-Z]+(?![a-z])|[A-Z]/g, (a, b) => (b ? '-' : '') + a.toLowerCase())
    entries.push(`data-${name}="${Handlebars.escapeExpression(value)}"`)
  }
  return new Handlebars.SafeString(entries.join(' '))
})
const rendered = []
foundry.applications.handlebars = {
  async renderTemplate(path, data) {
    rendered.push(path)
    const file = String(path).replace(/^systems\/dnd5e\//, `${DND5E_ROOT}/`)
    return Handlebars.compile(readFileSync(file, 'utf8'))(data)
  },
}
// Foundry's enrichment hands a description on as it is: the fixtures below are already enriched.
foundry.applications.ux.TextEditor = { implementation: { async enrichHTML(html) { return html } } }

settings.set('messageMode', 'public')
settings.set('challengeVisibility', 'player')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
settings.set('attackRollVisibility', 'hideAC')

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, SaveActivity, DamageActivity, HealActivity, Collection, Item5e, equip } = await import('./fvtt/activity5e.mjs')
const { midi, installMidi } = await import('./fvtt/midi-fake.mjs')
Collection.prototype.getByType ??= function (type) { return this.contents.filter(activity => activity.type === type) }
// An item is a Foundry document of its own kind, as a description's origin reads it.
Object.defineProperty(Item5e.prototype, 'documentName', { value: 'Item', configurable: true })
globalThis.dnd5e = {
  settings: { rulesVersion: 'modern' },
  // As dnd5e publishes its dice when its script loads (dnd5e.mjs:38-43), before any module's init:
  // since module 0.32.0 the module keeps dnd5e's own configureDamage from it, for app criticals.
  dice: { DamageRoll },
  enrichers: { createRollLabel },
  documents: { activity: { AttackActivity, SaveActivity, DamageActivity, HealActivity }, Trait },
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

// ---- Midi-QOL, when asked for ----
const midiDamage = { subject: undefined, called: 0 }
if (MIDI) {
  installMidi()
  Object.assign(midi.settings, { autoCheckSaves: 'allShow', doConcentrationCheck: 'chatOnly', removeConcentration: true })
  // Hooks.ts:917-927: a damage roll with a subject, a spell's, gets the actor's spell damage bonus.
  Hooks.on('dnd5e.preRollDamage', rollConfig => {
    if (rollConfig.subject) midiDamage.subject = rollConfig.subject
    return true
  })
  // Its concentration hook: a failed check ends concentration.
  Hooks.on('dnd5e.rollConcentration', (rolls, { subject }) => {
    if (midi.settings.removeConcentration && rolls.some(roll => roll.isFailure)) subject.endConcentration?.()
  })
}

// Midi's rules for a critical hit's damage, as fvtt/texts.mjs ports them read-only from its
// configureDamage (patching.ts:1332-1505), wrapped round dnd5e's as Midi registers it
// (patching.ts:434), for the rules used here: "default", dnd5e's settings alone; "maxAll", each die
// doubled and at its highest; "maxCritRoll", a critical hit's dice rolled apart, beside each die, at
// their highest, as its placeCritical places them (1306-1322); and "maxCrit", the most each die
// could roll added beside it, as a number, a weapon's extra dice's too; and in each, a critical
// hit's critical damage added after it (1494-1502). Numbers are doubled only where the roll's
// options say so, which dnd5e's never do. The rule is the Gamemaster's (utils.ts:8643-8645:
// getCriticalDamage), as the bridge's client is. Installed once the module's scripts load, as Midi
// wraps dnd5e at its init, so that the module keeps dnd5e's own (module 0.32.0) and the self-test
// rolls through it, under "default". Since module 0.32.0 (decision 5), an app roll's critical is
// dnd5e's whatever the rule; "doubleDice", "Double Rolled Damage" (patching.ts:1456-1462), its die
// left once with mx2, is the rule of the world this was reported from.
const midiCritical = { gm: 'default', player: 'default' }
function installMidiCritical() {
  const { DiceTerm, Die, NumericTerm, OperatorTerm } = foundry.dice.terms
  const dnd5eConfigure = DamageRoll.prototype.configureDamage
  const placeCritical = (terms, term, extras, index) => {
    const prev = terms[index - 1]
    const sign = prev instanceof OperatorTerm ? prev.operator : '+'
    return [term, ...extras.flatMap(extra => [new OperatorTerm({ operator: sign, options: { criticalBonusDamage: true } }), extra])]
  }
  DamageRoll.prototype.configureDamage = function (options = { critical: {} }) {
    const rule = game.user?.isGM ? midiCritical.gm : midiCritical.player
    this.terms = this.terms.filter(t => !t.options.criticalBonusDamage && !t.options.criticalFlatBonus)
    this.terms.forEach(term => {
      term.number = term.options.baseNumber ?? term.number
      if (term.options.baseModifiers) term.modifiers = foundry.utils.deepClone(term.options.baseModifiers)
    })
    this.resetFormula()
    const criticalNotAllowed = (this.options.critical?.allow === false) || (options.critical?.allow === false)
    if (criticalNotAllowed || !this.isCritical || (rule === 'default')) {
      const effectiveIsCritical = criticalNotAllowed ? false : this.isCritical
      options.critical.allow = effectiveIsCritical
      this.options.isCritical = effectiveIsCritical
      options.critical.multiplyNumeric ??= game.settings.get('dnd5e', 'criticalDamageModifiers')
      options.critical.powerfulCritical ??= game.settings.get('dnd5e', 'criticalDamageMaxDice')
      dnd5eConfigure.call(this, { critical: options.critical })
      return
    }
    const extras = new Map()
    const addExtra = (term, extra) => extras.set(term, [...(extras.get(term) ?? []), extra])
    for (const [i, term] of this.terms.entries()) {
      const cm = this.options.critical?.multiplier ?? 2
      const cb = (this.options.critical?.bonusDice && (i === 0)) ? this.options.critical.bonusDice : 0
      if (term.modifiers && !term.options.baseModifiers) term.options.baseModifiers = foundry.utils.deepClone(term.modifiers)
      if (term.modifiers) term.modifiers = foundry.utils.deepClone(term.options.baseModifiers)
      term.options.baseNumber = term.options.baseNumber ?? term.number
      term.number = term.options.baseNumber
      if (rule === 'maxCritRoll') {
        if (term instanceof DiceTerm) {
          const critTerm = new Die({ number: term.number + cb, faces: term.faces })
          critTerm.modifiers = foundry.utils.deepClone(term.modifiers)
          critTerm.modifiers.push(`min${term.faces}`)
          critTerm.options = foundry.utils.deepClone(term.options)
          critTerm.options.criticalBonusDamage = true
          addExtra(term, critTerm)
        } else if ((term instanceof NumericTerm) && options.multiplyNumeric) term.number *= cm
      } else if (rule === 'maxCrit') {
        if (term instanceof DiceTerm) {
          const critTerm = new NumericTerm({ number: (term.number + cb) * (term.faces ?? 1) })
          critTerm.options = foundry.utils.deepClone(term.options)
          critTerm.options.criticalBonusDamage = true
          addExtra(term, critTerm)
        } else if ((term instanceof NumericTerm) && options.multiplyNumeric) term.number *= cm
      } else if (rule === 'maxAll') {
        if (term instanceof DiceTerm) {
          term.alter(cm, cb)
          term.modifiers.push(`min${term.faces}`)
        } else if ((term instanceof NumericTerm) && this.options.multiplyNumeric) term.number *= cm
      } else if (rule === 'doubleDice') {
        if (term instanceof DiceTerm) term.modifiers.push(`mx${cm}`)
        else if ((term instanceof NumericTerm) && this.options.multiplyNumeric) term.number *= cm
      }
    }
    if (extras.size) this.terms = this.terms.flatMap((term, i, terms) => (extras.has(term) ? placeCritical(terms, term, extras.get(term), i) : [term]))
    // 1494-1502: critical damage added after, in every rule, taking the first term's options where
    // it has no flavor of its own, marked.
    if (this.options.critical?.bonusDamage) {
      const extra = new Roll(this.options.critical.bonusDamage, this.data)
      for (const term of extra.terms) {
        if (((term instanceof DiceTerm) || (term instanceof NumericTerm)) && !term.options?.flavor) term.options = foundry.utils.deepClone(this.terms[0].options)
        term.options.criticalBonusDamage = true
      }
      if (!(extra.terms[0] instanceof OperatorTerm)) this.terms.push(new OperatorTerm({ operator: '+', options: { criticalBonusDamage: true } }))
      this.terms.push(...extra.terms)
    }
    while ((this.terms.length > 0) && (this.terms.at(-1) instanceof OperatorTerm)) this.terms.pop()
    this.resetFormula()
    this.options.configured = true
  }
}

// ---- Thorin, and his descriptions in dnd5e 5.3.3's enriched markup ----
// enrichers.mjs: createRollLink, createRequestLink (with the Gamemaster's "Request Roll" link) and
// _addDataset, which writes hideDC as data-hide-d-c; enrichDamage; enrichAttack; enrichCheck;
// enrichReference (with the Gamemaster's "Apply Status" link); and Foundry's inline rolls, waiting to
// be rolled, for everyone or for the Gamemaster alone. Foundry wraps what an enricher with onRender
// makes in <enriched-content> (§2.0, unverified): the wand's and the rope's are wrapped, the rest
// as texts.mjs has them.
const ICON = '<i class="fa-solid fa-dice-d20" inert=""></i>'
const REQUEST = '<a class="enricher-action" data-action="postRequest" data-tooltip="EDITOR.DND5E.Inline.RequestRoll" aria-label="Request Roll"><i class="fa-solid fa-comment-dots"></i></a>'
const wrap = html => `<enriched-content data-enricher-id="dnd5e-enricher">${html}</enriched-content>`
const SAVE_LINK = (ability, dc, label, hidden = false) => `<span class="roll-link-group" data-type="save" data-ability="${ability}" data-dc="${dc}"${hidden ? ' data-hide-d-c="true"' : ''}><a class="roll-link" data-action="roll">${ICON}${label}</a>${REQUEST}</span>`
const DAMAGE_LINK = (formula, type, label) => `<a class="roll-link-group" data-action="roll" data-type="damage" data-formulas="${formula}" data-damage-types="${type}" data-roll-type="damage"><span class="roll-link">${ICON}${formula}</span> ${label}</a>`
const ATTACK_LINK = formula => `<span class="roll-link-group" data-type="attack" data-formula="${formula}"><a class="roll-link" data-action="roll">${ICON}${formula}</a></span>`
const CHECK_LINK = (ability, dc, label) => `<span class="roll-link-group" data-type="check" data-ability="${ability}" data-dc="${dc}"><a class="roll-link" data-action="roll">${ICON}${label}</a>${REQUEST}</span>`
// enrichCheck's single skill or tool, [[/skill ath 15]] or [[/tool thief 16 hideDC]], its data
// as _addDataset writes it; and its passive check, [[/skill prc 15 passive]], createPassiveTag's.
const SKILL_LINK = (attrs, label) => `<span class="roll-link-group" ${attrs}><a class="roll-link" data-action="roll">${ICON}${label}</a>${REQUEST}</span>`
const PASSIVE = (attrs, label) => `<span class="passive-check" ${attrs} data-passive="true" data-tooltip="<section class=&quot;loading&quot; data-passive><i class=&quot;fas fa-spinner fa-spin-pulse&quot;></i></section>">${label}</span>`
const REFERENCE = (status, name) => {
  const uuid = conditionTypes[status].reference
  return `<span class="reference-link"><a class="content-link" draggable="true" data-link="" data-uuid="${uuid}" data-id="${uuid.split('.').at(-1)}" data-type="JournalEntryPage" data-tooltip="Text Page"><i class="fas fa-book-open"></i>${name}</a><a class="enricher-action" data-action="applyStatus" data-status="${status}" data-tooltip="" aria-label="Apply Status to Selected Tokens"><i class="fas fa-fw fa-reply-all fa-flip-horizontal"></i></a></span>`
}
// enrichDamage's healing, [[/heal 2d4 + 2]]: its type healing, and rolled as healing.
const HEAL_LINK = formula => `<a class="roll-link-group" data-action="roll" data-type="damage" data-formulas="${formula}" data-damage-types="healing" data-roll-type="healing"><span class="roll-link">${ICON}${formula}</span> Healing</a>`
const INLINE_ROLL = (formula, mode = 'roll') => `<a class="inline-roll ${mode}" data-mode="${mode}" data-flavor="" data-formula="${formula}"><i class="fas fa-dice-d20"></i>${formula}</a>`

// The wand: a save, its damage, a condition by its rules' link, a save whose DC its author hid, an
// inline roll, a save and a condition in plain words, a Strength check; and what only looks like a
// roll: an attack and a roll for the Gamemaster's eyes.
const WAND = `<p>Its frost calls for a ${wrap(SAVE_LINK('dex', 14, 'DC 14 Dexterity'))} saving throw, or deals ${wrap(DAMAGE_LINK('2d6', 'cold', 'Cold'))} damage, and its target is ${wrap(REFERENCE('restrained', 'Restrained'))} until the end of its next turn. Its whisper, a ${wrap(SAVE_LINK('wis', 16, 'Wisdom', true))} saving throw.</p>
<p>Its ice holds ${INLINE_ROLL('1d4')} charges. A creature on the ice must succeed on a DC 13 Constitution saving throw or it is Prone.</p>
<p>Swung, it makes a ${wrap(ATTACK_LINK('+5'))} attack; its frozen grip takes a ${wrap(CHECK_LINK('str', 12, 'DC 12 Strength'))} check to break; and its curse is the ${INLINE_ROLL('1d20', 'gmroll')} the Gamemaster rolls.</p>`
// The rope: [[/skill ath 15]]; a check in plain words; [[/tool thief 16 hideDC]], whose DC its
// author hid; and passive checks, [[/skill prc 15 passive]] and in plain words, which are no checks
// to roll.
const ROPE = `<p>Climbing it takes a ${wrap(SKILL_LINK('data-type="skill" data-ability="str" data-skill="ath" data-dc="15"', 'DC 15 Strength (Athletics)'))} check. Its knots are hard to see: finding them takes a DC 13 Wisdom (Perception) check, and untying them a ${wrap(SKILL_LINK('data-type="tool" data-ability="dex" data-tool="thief" data-dc="16" data-hide-d-c="true"', "Dexterity (Thieves' Tools)"))} check.</p>
<p>Its glint is seen at a ${wrap(PASSIVE('data-type="skill" data-ability="wis" data-skill="prc" data-dc="15"', 'DC 15 passive Wisdom (Perception)'))}, passive Perception 15; a passive Wisdom (Perception) check never finds its knots.</p>`
// Thorin's biography (texts.mjs), with a span a player forged and a save in a section only the
// Gamemaster and his player see.
const BIOGRAPHY = `<p>Thorin swore an oath: ${SAVE_LINK('dex', 15, 'DC 15 Dexterity')} saving throw, or ${DAMAGE_LINK('2d6', 'fire', 'Fire')} damage.</p>
<p><span class="ss-damage roll" data-n="2" data-formulas="100d6" data-types="fire">A forged fire</span></p>
<section class="secret" id="secret-oath"><p>Its price: a <span class="roll-link-group" data-type="save" data-ability="wis" data-dc="13"><a class="roll-link" data-action="roll">${ICON}DC 13 Wisdom</a></span> saving throw.</p></section>`
// A healing draught: [[/heal 2d4 + 2]].
const DRAUGHT = `<p>Drunk, it restores ${wrap(HEAL_LINK('2d4 + 2'))} hit points.</p>`
const WISP = `<p>A mote of light: a ${SAVE_LINK('dex', 13, 'DC 13 Dexterity')} saving throw, or ${DAMAGE_LINK('1d8', 'fire', 'Fire')} damage, and ${INLINE_ROLL('1d4')} motes.</p>`
// enrichDamage's link to one of the item's activities, [[/damage activity=chop]]: the formulas of the
// activity's damage configuration, resolved and simplified (enrichers.mjs:922-943), and its UUID, as
// fvtt/texts.mjs makes it.
const ACTIVITY_DAMAGE_LINK = (formula, type, label, uuid) => `<a class="roll-link-group" data-action="roll" data-type="damage" data-formulas="${formula}" data-damage-types="${type}" data-roll-type="damage" data-activity-uuid="${uuid}"><span class="roll-link">${ICON}${formula}</span> ${label}</a>`
// The greataxe: its attack's damage, Strength +4, through the activity, with what a critical hit adds.
const GREATAXE = `<p>It cleaves for ${wrap(ACTIVITY_DAMAGE_LINK('1d12 + 4', 'slashing', 'Slashing', 'Actor.thorin.Item.greataxe.Activity.chop'))} damage.</p>`
// A rod whose damage takes a die away, [[/damage 3 - 1d4 + 2d6 fire]], as fvtt/texts.mjs has it.
const BLIGHTED = `<p>It deals ${wrap(DAMAGE_LINK('3 - 1d4 + 2d6', 'fire', 'Fire'))} damage.</p>`

const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
// Thorin: Strength +4, Dexterity +1, Constitution +2 and proficient in its saves, Wisdom +2; at +3,
// proficient in Athletics and Perception, and with Thieves' Tools.
const thorin = new Actor5e({
  id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 4, dex: 1, con: 2, wis: 2 },
  skills: { ath: { ability: 'str' }, prc: { ability: 'wis' } }, tools: { thief: { ability: 'dex' } },
})
thorin.documentName = 'Actor'
thorin.system.details = { level: 5, biography: { value: BIOGRAPHY } }
// What the sheet shows of them, as dnd5e prepares them.
Object.assign(thorin.system.skills.ath, { total: 7, passive: 17 })
Object.assign(thorin.system.skills.prc, { total: 5, passive: 15 })
Object.assign(thorin.system.tools.thief, { total: 4, passive: 14 })
// What the sheet shows of his saves, as dnd5e prepares them: his Constitution save proficient.
for (const [id, ability] of Object.entries(thorin.system.abilities)) {
  ability.save.value = ability.mod + (ability.saveProf.hasProficiency ? thorin.system.attributes.prof : 0)
  ability.proficient = ability.saveProf.hasProficiency ? 1 : 0
  void id
}
actors.set('thorin', thorin)
alice.character = thorin
equip(thorin, {
  ac: 16,
  items: [
    { id: 'rod', name: 'Wand of Frost', type: 'equipment', system: { quantity: 1, equipped: false, description: { value: WAND } } },
    { id: 'rope', name: 'Climbing Rope', type: 'equipment', system: { quantity: 1, equipped: false, description: { value: ROPE } } },
    { id: 'draught', name: 'Healing Draught', type: 'consumable', system: { quantity: 1, type: { value: 'potion' }, description: { value: DRAUGHT } } },
    { id: 'blight', name: 'Blighted Rod', type: 'equipment', system: { quantity: 1, equipped: false, description: { value: BLIGHTED } } },
    // A torch that strikes, and casts Starry Wisp through the copy of the spell dnd5e keeps on him.
    {
      id: 'torch', name: 'Everburning Torch', type: 'weapon',
      system: { properties: [], quantity: 1, attackType: 'melee', equipped: true, description: { value: '<p>It never goes out.</p>' } },
      activities: [
        { id: 'burn', name: 'Strike', damage: [{ number: 1, denomination: 4, types: ['fire'] }], labels: { modifier: '+6', damage: [hits('1d4', 'fire')] } },
        { id: 'cast', type: 'cast', name: 'Starry Wisp', labels: { range: '60 ft' } },
      ],
    },
    {
      id: 'wisp-copy', name: 'Starry Wisp', type: 'spell', flags: { dnd5e: { cachedFor: '.Item.torch.Activity.cast' } },
      system: { level: 0, method: 'spell', properties: [], description: { value: WISP } },
      activities: [{ id: 'wisp-shot', ability: 'wis', damage: [{ number: 1, denomination: 8, types: ['fire'] }], labels: { modifier: '+5', damage: [hits('1d8', 'fire')] } }],
    },
    // A greataxe, whose critical hit adds its critical damage, 1d6, and, with his Savage Attacks, a die
    // more on its own (attack-data.mjs:326-328, 410-413).
    {
      id: 'greataxe', name: 'Greataxe', type: 'weapon',
      system: { properties: ['hvy', 'two'], quantity: 1, attackType: 'melee', equipped: true, description: { value: GREATAXE } },
      activities: [{
        id: 'chop', name: 'Chop', criticalBonus: '1d6', damage: [{ number: 1, denomination: 12, bonus: '@mod', types: ['slashing'] }],
        labels: { modifier: '+7', damage: [hits('1d12 + 4', 'slashing')] },
      }],
    },
  ],
})
// His Savage Attacks: a die more of a melee weapon's on a critical hit, from the start.
thorin.flags.dnd5e.meleeCriticalDamageDice = 1
const blessed = {
  documentName: 'ActiveEffect', id: 'blessed', uuid: 'Actor.thorin.ActiveEffect.blessed', name: 'Blessed', img: 'blessed.webp', parent: thorin,
  description: `<p>Add ${INLINE_ROLL('1d4')} to a roll, or make a ${SAVE_LINK('wis', 12, 'DC 12 Wisdom')} saving throw.</p>`,
  statuses: new Set(), disabled: false, isTemporary: true, duration: {},
}
thorin.allApplicableEffects = function* () { yield blessed }
// Vex, Bob's, in the campaign too: her player could be prompted, and mustn't be.
const vex = new Actor5e({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3 } })
vex.documentName = 'Actor'
actors.set('vex', vex)
bob.character = vex
equip(vex, {})

await import(`${MODULE}/scripts/module.mjs`)
if (MIDI) installMidiCritical()
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin', 'vex'], rolls: true, attacks: true, prompts: true }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const kinds = () => sql(`select array_to_string("rollKinds", ',') from campaign where title = 'Ashlands'`).split(',')
await until(() => kinds().includes('textDamage'), 'the app to hear the game takes rolls from descriptions', 15_000)
check(['ask', 'textRoll', 'textDamage', 'save'].every(kind => kinds().includes(kind)), `the app keeps that the game takes asks, a description's damage and rolls, and saves (${kinds().join(',')})`)
// From module 0.21.0, changing only a die damage adds, never one it takes away.
const features = () => sql(`select array_to_string("rollFeatures", ',') from campaign where title = 'Ashlands'`).split(',')
check(features().includes('signedDice'), `and that it changes only a die a description's damage adds, never one it takes away (${features().join(',')})`)

// A Gamemaster's Midi damage roll, left open, waiting for its dnd5e.rollDamage hook.
const pendingMidi = MIDI ? Hooks.once('dnd5e.rollDamage', () => { midiDamage.called++ }) : null
let rolledDamage = 0
Hooks.on('dnd5e.rollDamage', () => { rolledDamage++ })

// Alice plays Thorin.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'sheet-thorin', 'Thorin', '${GAME}', 'Ashlands', id, 'thorin', 'e2e-user', now() from campaign where title = 'Ashlands'`)

// The descriptions, as the module sent them and the app kept them.
// From module 0.22.0 the hello lists Thorin without his sheet, which follows it in a character.updated
// of its own, slim, put back here by the harness's own expander (fvtt/slim-expand.mjs).
const hello = () => {
  const at = posted.findLastIndex(p => p.type === 'bridge.hello')
  const sent = posted.slice(at).find(p => p.type === 'character.updated' && p.data.character.id === 'thorin')
  return expandSheet(sent.data.character.sheet)
}
await until(() => posted.slice(posted.findLastIndex(p => p.type === 'bridge.hello')).some(p => p.type === 'character.updated' && p.data.character.id === 'thorin'),
  "Thorin's sheet after the hello", 15_000)
const wandHash = hello().inventory.sections.flatMap(section => section.items).find(it => it.id === 'rod')?.text
const bioHash = hello().details.biography
const kept = hash => sql(`select html from sheet_text where hash = '${hash}'`)
check(/^[0-9a-f]{14}$/.test(wandHash ?? '') && kept(wandHash).includes('ss-save'), 'the app keeps the wand\'s description, its links marked')
const ropeHash = hello().inventory.sections.flatMap(section => section.items).find(it => it.id === 'rope')?.text
const ropeKept = kept(ropeHash)
const checkSpans = [...ropeKept.matchAll(/<span\b[^>]*\bss-check\b[^>]*>/g)].map(([tag]) => tag)
check(checkSpans.length === 3 && /data-checks="skill:str:ath"/.test(checkSpans[0]) && /data-dc="15"/.test(checkSpans[0])
  && /data-checks="skill:wis:prc"/.test(checkSpans[1]) && /data-dc="13"/.test(checkSpans[1])
  && /data-checks="tool:dex:thief"/.test(checkSpans[2]) && !/data-dc/.test(checkSpans[2]) && !ropeKept.includes('16') && !/passive-check/.test(ropeKept),
  `the app keeps the rope's checks marked, [[/skill ath 15]], one in plain words and [[/tool thief 16 hideDC]] without its DC, and its passive check as text: ${JSON.stringify(checkSpans)}`)
const { skills: sheetSkills, tools: sheetTools } = hello()
check(sheetSkills.find(skill => skill.id === 'ath')?.total === 7 && JSON.stringify(sheetTools) === JSON.stringify([{ id: 'thief', name: "Thieves' Tools", ability: 'dex', total: 4, passive: 14, proficiency: 1, mode: 0 }]),
  `Thorin's sheet has his Athletics, +7, and the tools he has, Thieves' Tools, +4: ${JSON.stringify(sheetTools)}`)

// ---- On a phone ----
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
await page.goto(`${BASE}/characters/sheet-thorin`)
const nav = page.getByRole('navigation', { name: 'Table' })
const panel = page.getByRole('tabpanel')
const tray = page.getByRole('region', { name: 'Your rolls' })
const status = tray.getByRole('status')
const banner = page.getByRole('region', { name: 'Your Gamemaster asks' })
await page.getByRole('tab', { name: 'Inventory' }).waitFor({ timeout: 15_000 })

const requestRow = where => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, result from roll_request ${where} order by "createdAt" desc limit 1) r`) || 'null')
const latestRequest = () => requestRow('')
const requests = () => Number(sql('select count(*) from roll_request'))
const madeFor = id => messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const settled = request => ['done', 'failed'].includes(request?.status)
const faces = roll => roll.dice.map(die => die.results.map(r => r.result))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Wait for room under the app's limit of 20 rolls a minute from a player. */
const lastMinute = () => Number(sql(`select count(*) from roll_request where "createdAt" > now() - interval '1 minute'`))
const paced = () => until(() => lastMinute() < 18, 'room under the rate limit', 70_000)

/** Send what a tap rolls or asks, and wait until the game has made it. */
async function sent(tap, what) {
  await paced()
  const before = requests()
  await tap()
  try {
    await until(() => requests() > before, `${what} to be sent`)
  } catch (error) {
    console.log('tray:', await status.textContent())
    throw error
  }
  const request = latestRequest()
  await until(() => settled(requestRow(`where id = '${request.id}'`)), `${what} to be made`)
  const made = requestRow(`where id = '${request.id}'`)
  return { request, made, message: madeFor(request.id) }
}

/** An item's description, opened on the Inventory tab: the wand's, unless another is named. */
async function wandText(name = 'Wand of Frost') {
  await nav.getByRole('button', { name: /^Character/ }).click().catch(() => {})
  await page.getByRole('tab', { name: 'Inventory' }).click()
  const row = panel.locator('li', { has: page.locator('summary', { hasText: name }) })
  const text = row.locator('.sheet-text')
  if (!(await text.isVisible().catch(() => false))) await row.locator('summary').click()
  await text.waitFor({ timeout: 15_000 })
  return text
}

// ---- 1. The wand's description: what acts, and what is only text ----
let wand = await wandText()
await wand.getByRole('button').first().waitFor()
const buttonNames = await wand.getByRole('button').evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-label') ?? b.textContent))
check(same(buttonNames, ['DC 14 Dexterity', '2d6 Cold, roll damage', 'Restrained', 'Wisdom', '1d4, roll it', 'DC 13 Constitution saving throw', 'Prone', 'DC 12 Strength']),
  `the wand's description opens with its save, damage, conditions, hidden save, inline roll, plain-text save and check as buttons, in order: ${JSON.stringify(buttonNames)}`)
check(await wand.getByRole('button', { name: 'DC 14 Dexterity', exact: true }).getAttribute('aria-haspopup') === 'menu'
  && await wand.getByRole('button', { name: 'DC 12 Strength', exact: true }).getAttribute('aria-haspopup') === 'menu'
  && await wand.getByRole('button', { name: 'Restrained' }).getAttribute('aria-haspopup') === 'dialog',
  'its saves and its check open a menu, and its conditions the conditions panel')
const wandWords = await wand.textContent()
check(['+5 attack', 'DC 12 Strength check', 'the 1d20 the Gamemaster rolls'].every(words => wandWords.includes(words))
  && await wand.locator('.roll').count() === 0 && await wand.locator('a').count() === 0,
  'its attack and the Gamemaster\'s roll are plain text, with no pill and no link')
check(!/Request Roll|Apply Status|16/.test(wandWords) && !kept(wandHash).includes('16'), "neither the Gamemaster's own links nor the DC its author hid are on the page, or in what the app keeps")
await shoot(page, 'phone-wand-description')

// ---- 2. A save's menu ----
const nothingPrompted = () => posted.filter(p => p.type === 'roll.prompt.opened').length === 0 && sql('select count(*) from roll_prompt') === '0'
await wand.getByRole('button', { name: 'DC 14 Dexterity', exact: true }).click()
let menu = page.getByRole('menu', { name: 'DC 14 Dexterity saving throw' })
await menu.waitFor()
let items = await menu.getByRole('menuitem').allTextContents()
check(same(items, ['Ask the table', 'Roll my Dexterity save (+1)', 'Roll with advantage', 'Roll with disadvantage', 'Modify roll…']),
  `a tap on the save opens its menu, titled with its DC: ${JSON.stringify(items)}`)
await shoot(page, 'phone-save-menu')

// ---- 3. Asking the table ----
let { request, made, message } = await sent(() => menu.getByRole('menuitem', { name: 'Ask the table' }).click(), 'the ask')
// The game lets a character ask again ten seconds on.
const askedAt = Date.now()
check(request.kind === 'ask' && request.payload.text === wandHash && Number.isInteger(request.payload.link) && !('dc' in request.payload) && made.status === 'done',
  `the phone asks the game by the description's hash and the link's number, sending no DC (${JSON.stringify(request.payload)})`)
check(rendered.at(-1) === 'systems/dnd5e/templates/chat/roll-request-card.hbs' && /data-type="save" data-ability="dex" data-dc="14"[^>]*data-action="rollRequest"/.test(message?.content ?? ''),
  "the game posts dnd5e's own roll request card, its button for a DC 14 Dexterity save")
check(message.author.id === 'alice' && message.speaker.actor === 'thorin' && message.speaker.alias === 'Thorin' && message.flavor === 'Roll Request: Wand of Frost',
  `from Alice, as Thorin, naming the wand: "${message.flavor}"`)
check(message.flags['sending-stone']?.request === request.id && message.flags['sending-stone']?.ask?.text === wandHash && message.flags.dnd5e?.item?.id === 'rod',
  `flagged sending-stone.request and .ask, and dnd5e.item the wand (${JSON.stringify(message.flags)})`)
await status.getByText('Posted to the table’s chat').waitFor({ timeout: 15_000 })
check(/DC 14 Dexterity saving throw/.test(await status.textContent()), `the tray says it was posted: "${await status.textContent()}"`)
await shoot(page, 'phone-tray-asked')
await wait(4000)
check(nothingPrompted() && await banner.count() === 0, 'nobody is prompted by it, Thorin and Vex included, though the campaign prompts its players')

// The app's chat shows the ask.
await nav.getByRole('button', { name: 'Chat' }).click()
const chat = page.getByRole('list', { name: 'Chat log' })
const askBubble = chat.getByRole('listitem').filter({ hasText: 'Thorin asks for a DC 14 Dexterity saving throw' })
await askBubble.waitFor({ timeout: 15_000 })
check(/Wand of Frost/.test(await askBubble.textContent()), `the app's chat shows the ask, naming the wand: "${await askBubble.textContent()}"`)
await askBubble.scrollIntoViewIfNeeded()
await shoot(page, 'phone-chat-ask')

// ---- 4. Rolling his own save against the description's DC ----
wand = await wandText()
await wand.getByRole('button', { name: 'DC 14 Dexterity', exact: true }).click()
menu = page.getByRole('menu', { name: 'DC 14 Dexterity saving throw' })
;({ request, made, message } = await sent(() => menu.getByRole('menuitem', { name: 'Roll my Dexterity save (+1)' }).click(), 'the Dexterity save'))
const d20 = request.payload.dice?.[0]?.results?.[0]
check(request.kind === 'save' && request.payload.key === 'dex' && request.payload.text === wandHash && Number.isInteger(request.payload.link) && !('dc' in request.payload),
  `the phone sends Thorin's Dexterity save, from the wand's link, with no DC of its own (${JSON.stringify(request.payload)})`)
let roll = message?.rolls[0]
check(made.status === 'done' && roll?.options.target === 14 && same(faces(roll), [[d20]]) && message.flags.dnd5e.roll.type === 'save' && message.author.id === 'alice',
  `the game rolls it with Alice's d20 (${d20}) against the description's DC 14: ${roll?.total}`)
let saved = roll.total >= 14
check(made.result.outcome === (saved ? 'success' : 'failure'), `and says he ${saved ? 'saved' : 'failed'} (${made.result.outcome})`)
await status.getByText(`At the table: ${roll.total} · ${saved ? 'Saved' : 'Failed'}`).waitFor({ timeout: 15_000 })
check(/Dexterity saving throw/.test(await status.textContent()) && /DC 14/.test(await status.textContent()), `the tray shows the DC and whether he saved, as the game has it: "${await status.textContent()}"`)
await shoot(page, 'phone-tray-save')

// ---- 5. The save whose DC its author hid ----
await wand.getByRole('button', { name: 'Wisdom', exact: true }).click()
menu = page.getByRole('menu', { name: 'Wisdom saving throw', exact: true })
await menu.waitFor()
items = await menu.getByRole('menuitem').allTextContents()
check(items.includes('Roll my Wisdom save (+2)') && !items.join().includes('16'), `its menu names no DC: ${JSON.stringify(items)}`)
;({ request, made, message } = await sent(() => menu.getByRole('menuitem', { name: 'Roll my Wisdom save (+2)' }).click(), 'the hidden save'))
roll = message?.rolls[0]
check(request.payload.key === 'wis' && !('dc' in request.payload) && made.status === 'done' && roll?.options.target === 16
  && same(faces(roll), [[request.payload.dice[0].results[0]]]),
  `the game rolls it with Alice's d20 against the DC its author hid, 16: ${roll?.total}`)
saved = roll.total >= 16
check(made.result.outcome === (saved ? 'success' : 'failure'), `and says whether he made it (${made.result.outcome})`)
await status.getByText(`At the table: ${roll.total}`).waitFor({ timeout: 15_000 })
const hiddenTray = await status.textContent()
check(/Wisdom saving throw/.test(hiddenTray) && !/DC/.test(hiddenTray), `the tray shows no DC: "${hiddenTray}"`)
await shoot(page, 'phone-tray-hidden-save')

// The save in plain words, its DC the one the text gives, rolled with advantage.
await wand.getByRole('button', { name: 'DC 13 Constitution saving throw' }).click()
menu = page.getByRole('menu', { name: 'DC 13 Constitution saving throw' })
await menu.waitFor()
items = await menu.getByRole('menuitem').allTextContents()
check(items[1] === 'Roll my Constitution save (+5)', `"a DC 13 Constitution saving throw" in plain words is a save, with Thorin's proficient Constitution save: ${JSON.stringify(items)}`)
;({ request, made, message } = await sent(() => menu.getByRole('menuitem', { name: 'Roll with advantage' }).click(), 'the Constitution save'))
roll = message?.rolls[0]
check(request.payload.key === 'con' && request.payload.mode === 1 && request.payload.dice[0].results.length === 2 && made.status === 'done'
  && roll?.options.target === 13 && roll.hasAdvantage && same(faces(roll), [request.payload.dice[0].results]),
  `the game rolls it with advantage, with both of Alice's d20s (${request.payload.dice[0].results}), against the DC the text gives, 13: ${roll?.total}`)
saved = roll.total >= 13
await status.getByText(`At the table: ${roll.total} · ${saved ? 'Saved' : 'Failed'}`).waitFor({ timeout: 15_000 })
check(/Constitution saving throw/.test(await status.textContent()) && /DC 13/.test(await status.textContent()) && made.result.outcome === (saved ? 'success' : 'failure'),
  `the tray shows its DC and whether he saved, as the game has it: "${await status.textContent()}"`)
await shoot(page, 'phone-tray-plain-save')

// ---- 6. The wand's damage ----
;({ request, made, message } = await sent(() => wand.getByRole('button', { name: '2d6 Cold, roll damage' }).click(), "the wand's damage"))
const d6s = request.payload.dice?.[0]?.results
roll = message?.rolls[0]
check(request.kind === 'textDamage' && request.payload.dice[0].faces === 6 && d6s.length === 2 && made.status === 'done',
  `the phone throws two d6 for the wand's damage, and sends them (${JSON.stringify(request.payload)})`)
check(roll instanceof DamageRoll && same(faces(roll), [d6s]) && roll.options.type === 'cold' && message.flags.dnd5e.roll.type === 'damage'
  && message.flags.dnd5e.item?.id === 'rod' && message.flags.dnd5e.item.uuid === 'Actor.thorin.Item.rod' && thorin.items.get('rod').name === 'Wand of Frost',
  `the game posts a damage card made with Alice's dice (${d6s}), cold, its dnd5e.item the Wand of Frost: ${roll?.total}`)
check(message.author.id === 'alice' && message.flavor === 'Wand of Frost - Damage Roll' && rolledDamage === 0,
  `from Alice, as "${message.flavor}", firing no dnd5e.rollDamage hook`)
// A tap is as it was, though a long-press now offers other ways to roll it.
check(!('critical' in request.payload) && !('modifiers' in request.payload) && roll.isCritical === false && made.result.rolls?.[0]?.critical === false
  && await wand.getByRole('button', { name: '2d6 Cold, roll damage' }).getAttribute('aria-haspopup') === 'menu' && await page.getByRole('menu').count() === 0,
  "a tap rolls it plainly, as before: no critical hit's and unchanged, and opens no menu, though the link now has one")
if (MIDI) {
  check(midiDamage.called === 0 && (registry.get('dnd5e.rollDamage') ?? []).includes(pendingMidi) && midiDamage.subject === undefined,
    "the Gamemaster's open Midi damage roll keeps waiting for its own, and Midi adds no spell damage bonus to it")
  Hooks.off('dnd5e.rollDamage', pendingMidi)
}
const damageTotal = roll.total
await status.getByText(`At the table: ${damageTotal}`).waitFor({ timeout: 15_000 })
check(/Wand of Frost damage/.test(await status.textContent()), `the tray shows it: "${await status.textContent()}"`)
await shoot(page, 'phone-tray-damage')

// ---- 7. The wand's inline roll ----
;({ request, made, message } = await sent(() => wand.getByRole('button', { name: '1d4, roll it' }).click(), "the wand's inline roll"))
roll = message?.rolls[0]
check(request.kind === 'textRoll' && request.payload.dice[0].faces === 4 && made.status === 'done' && roll?.constructor.name === 'BasicRoll'
  && same(faces(roll), [request.payload.dice[0].results]) && message.flavor === 'Wand of Frost' && message.flags.dnd5e.roll.type === 'generic' && message.author.id === 'alice',
  `the game posts the inline roll with Alice's d4 (${request.payload.dice[0].results}), named for the wand: ${roll?.total}`)
await status.getByText(`At the table: ${roll.total}`).waitFor({ timeout: 15_000 })
check(/Wand of Frost roll/.test(await status.textContent()), `the tray shows it: "${await status.textContent()}"`)
await shoot(page, 'phone-tray-inline-roll')

// The app's chat shows the wand's damage, named for it.
await nav.getByRole('button', { name: 'Chat' }).click()
const damageCard = chat.getByRole('listitem').filter({ hasText: 'Wand of Frost' }).filter({ hasText: '2d6' })
await damageCard.waitFor({ timeout: 15_000 })
const damageWords = await damageCard.textContent()
check(/Damage/.test(damageWords) && damageWords.includes(String(damageTotal)) && d6s.every(d => damageWords.includes(String(d))),
  `the app's chat shows the wand's damage, named for it, with its dice and total: "${damageWords}"`)
check(!/DC 16/.test(await chat.textContent()), "nor does the chat show the DC the wand's author hid")
await damageCard.scrollIntoViewIfNeeded()
await shoot(page, 'phone-chat-damage')

// ---- 7b. The wand's damage, its other ways: a long-press's menu ----
// How the world makes a critical hit's damage, as the sheet says it: dnd5e's own way, neither of its
// settings on, every die twice over, a weapon's extra dice thrown with its first.
const EVERY_DIE_TWICE = { perDie: 2, multiplyNumeric: false, powerfulCritical: false, altered: false, bonusDice: 'rolled' }
const sorted = value => JSON.stringify(value && Object.fromEntries(Object.entries(value).sort()))
const keptCritical = () => sorted(JSON.parse(sql(`select data->'critical' from actor_sheet where "actorId" = 'thorin'`) || 'null'))
check(sorted(hello().critical) === sorted(EVERY_DIE_TWICE) && keptCritical() === sorted(EVERY_DIE_TWICE),
  `Thorin's sheet says how the world makes a critical hit's damage, dnd5e's own way, every die twice and a weapon's extra dice thrown, and the app keeps it: ${keptCritical()}`)
const sum = values => values.reduce((total, value) => total + value, 0)
const cdp = await phone.newCDPSession(page)
/**
 * Hold a finger on a link, a third of the way along the first line it's on, as long as a long-press
 * takes and more; then lift it. Whether its menu was open while the finger was down.
 */
async function longPress(link, itsMenu) {
  await link.scrollIntoViewIfNeeded()
  const line = await link.evaluate(el => { const { x, y, width, height } = el.getClientRects()[0]; return { x, y, width, height } })
  const finger = { x: line.x + line.width / 3, y: line.y + line.height / 2 }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] })
  await wait(750)
  const opened = await itsMenu.isVisible()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await wait(300)
  return opened
}
/**
 * Wait until the phone hears how the world now makes a critical hit's: the Modify dialog of a link's
 * damage, the wand's unless another is named, says so.
 */
const modify = page.getByRole('dialog', { name: 'Modify damage' })
async function modifyOnceItSays(hint, link = wandDamage, itsMenu = damageMenu) {
  await until(async () => {
    await longPress(link, itsMenu)
    await itsMenu.getByRole('menuitem', { name: 'Modify damage…' }).tap()
    await modify.waitFor()
    if (await modify.getByText(hint, { exact: true }).isVisible()) return true
    await modify.getByRole('button', { name: 'Cancel' }).tap()
    await modify.waitFor({ state: 'hidden' })
    return false
  }, `the phone to say a critical hit's is "${hint}"`, 30_000)
}
/** The world's rules for a critical hit's changed, as the Gamemaster changes a setting. */
async function criticalRulesChange(key, change, rule) {
  const first = !criticalSettings.has(key)
  criticalSettings.add(key)
  change()
  await Hooks.callAll(first ? 'createSetting' : 'updateSetting', { key })
  await until(() => keptCritical() === sorted(rule), `the app to keep the sheet as the world now makes a critical hit's: ${JSON.stringify(rule)}`, 15_000)
}
const criticalSettings = new Set()

wand = await wandText()
const wandDamage = wand.getByRole('button', { name: '2d6 Cold, roll damage' })
const damageMenu = page.getByRole('menu', { name: 'Wand of Frost damage 2d6' })
let before = requests()
const held = await longPress(wandDamage, damageMenu)
items = await damageMenu.getByRole('menuitem').allTextContents()
check(held && same(items, ['Roll critical damage', 'Roll maximum damage', 'Modify damage…']),
  `a long-press on the wand's damage opens its menu, titled with its formula, as an attack's damage has it: ${JSON.stringify(items)}`)
check(await damageMenu.isVisible() && requests() === before, 'and lifting the finger neither rolls it nor closes the menu')
await shoot(page, 'phone-damage-menu')

// A critical hit's, made in the game with Alice's dice, as the world makes one.
;({ request, made, message } = await sent(() => damageMenu.getByRole('menuitem', { name: 'Roll critical damage' }).tap(), "the wand's critical damage"))
let thrown = request.payload.dice?.[0]?.results ?? []
roll = message?.rolls[0]
check(request.kind === 'textDamage' && request.payload.critical === true && !('modifiers' in request.payload) && request.payload.dice.length === 1
  && request.payload.dice[0].faces === 6 && thrown.length === 4 && made.status === 'done',
  `the phone throws four d6, the wand's 2d6 twice over as the world makes a critical hit's, and sends them as one (${JSON.stringify(request.payload)})`)
check(roll instanceof DamageRoll && roll.isCritical === true && roll.formula === '4d6' && same(faces(roll), [thrown]) && roll.total === sum(thrown)
  && roll.options.type === 'cold' && message.flavor === 'Wand of Frost - Damage Roll' && message.author.id === 'alice' && message.flags.dnd5e.roll.type === 'damage'
  && made.result.rolls?.[0]?.critical === true,
  `the game makes it a critical hit's, 4d6, with Alice's dice as the phone threw them (${thrown}), its card's roll and the result saying so: ${roll?.total}`)
await status.getByText(`At the table: ${roll.total}`).waitFor({ timeout: 15_000 })
let damageTray = await status.textContent()
check(damageTray.startsWith(`${roll.total}Wand of Frost damage`) && damageTray.includes(`4d6 (${thrown.join(', ')}) cold · Critical hit`),
  `the tray shows the dice the phone threw, as a critical hit's, and the game's total: "${damageTray}"`)
await shoot(page, 'phone-tray-critical-damage')
const criticalCard = message.id
await until(() => sql(`select data->'rolls'->0->>'critical' from chat_message where "messageId" = '${criticalCard}'`) === 'true', 'the app to keep the card as a critical hit\'s')
await nav.getByRole('button', { name: 'Chat' }).click()
const criticalBubble = chat.getByRole('listitem').filter({ hasText: 'Wand of Frost' }).filter({ hasText: '4d6' })
await criticalBubble.waitFor({ timeout: 15_000 })
const criticalWords = await criticalBubble.textContent()
// From app 0.28 it's a damage card, its total read after its chip as "16 Cold = 16", where a roll's
// own card read "Total 16".
check(/Critical/.test(criticalWords) && criticalWords.includes(`${roll.total} Cold = ${roll.total}`) && thrown.every(d => criticalWords.includes(String(d))),
  `the app's chat shows the card as a critical hit's, with its dice and total: "${criticalWords}"`)
await criticalBubble.scrollIntoViewIfNeeded()
await shoot(page, 'phone-chat-critical-damage')

// At its highest.
wand = await wandText()
await longPress(wandDamage, damageMenu)
;({ request, made, message } = await sent(() => damageMenu.getByRole('menuitem', { name: 'Roll maximum damage' }).tap(), "the wand's maximum damage"))
roll = message?.rolls[0]
check(request.kind === 'textDamage' && same(request.payload.modifiers, { maximize: true }) && !('critical' in request.payload)
  && same(request.payload.dice, [{ faces: 6, results: [6, 6] }]) && made.status === 'done'
  && roll.formula === '2d6' && roll.total === 12 && roll.isCritical === false && same(faces(roll), [[6, 6]]),
  `at its highest, the phone throws both d6 at 6, and the game rolls it every die at its highest: ${roll?.total} (${JSON.stringify(request.payload)})`)
await status.getByText('At the table: 12').waitFor({ timeout: 15_000 })
damageTray = await status.textContent()
check(damageTray.includes('2d6 (6, 6) cold · Maximum') && !/Critical/.test(damageTray), `the tray shows it at its highest: "${damageTray}"`)
await shoot(page, 'phone-tray-maximum-damage')

// A die more, from Modify damage: the dialog says what it will throw.
await longPress(wandDamage, damageMenu)
await damageMenu.getByRole('menuitem', { name: 'Modify damage…' }).tap()
await modify.waitFor()
await modify.getByRole('button', { name: 'One die more' }).tap()
const willThrow = await modify.getByRole('status').textContent()
check(willThrow === '3d6 cold' && await modify.getByText('Every die twice.', { exact: true }).isVisible(),
  `Modify damage shows what it will throw, a die more: "${willThrow}"; and its Critical hit says how the world makes one, every die twice`)
await shoot(page, 'phone-modify-description-damage')
;({ request, made, message } = await sent(() => modify.getByRole('button', { name: 'Roll' }).tap(), "the wand's damage, a die more"))
thrown = request.payload.dice?.[0]?.results ?? []
roll = message?.rolls[0]
check(request.kind === 'textDamage' && same(request.payload.modifiers, { extra: 1 }) && !('critical' in request.payload) && request.payload.dice.length === 1
  && request.payload.dice[0].faces === 6 && thrown.length === 3 && made.status === 'done'
  && roll.formula === '3d6' && same(faces(roll), [thrown]) && roll.total === sum(thrown) && roll.isCritical === false,
  `a die more: the phone throws three d6, and the game makes it 3d6 with Alice's dice (${thrown}): ${roll?.total}`)
await status.getByText(`At the table: ${roll.total}`).waitFor({ timeout: 15_000 })
damageTray = await status.textContent()
check(damageTray.includes(`3d6 (${thrown.join(', ')}) cold`), `the tray shows the three dice: "${damageTray}"`)
await shoot(page, 'phone-tray-extra-damage')

// The Gamemaster turns on Powerful Critical: a critical hit's dice once, and the most they could
// roll added. The sheet says so; the phone throws them so, from Modify damage's Critical hit.
const POWERFUL = { perDie: 1, multiplyNumeric: false, powerfulCritical: true, altered: false, bonusDice: 'rolled' }
await criticalRulesChange('dnd5e.criticalDamageMaxDice', () => settings.set('criticalDamageMaxDice', true), POWERFUL)
check(true, `the world's Powerful Critical reaches the app on Thorin's sheet: ${keptCritical()}`)
await modifyOnceItSays('Its dice, and the most they could roll added.')
await modify.getByText('Critical hit', { exact: true }).tap()
const powerfulThrow = await modify.getByRole('status').textContent()
check(powerfulThrow === '2d6 + 12 cold', `and the phone hears of it: Modify damage's Critical hit throws "${powerfulThrow}"`)
await shoot(page, 'phone-modify-powerful-critical')
;({ request, made, message } = await sent(() => modify.getByRole('button', { name: 'Roll' }).tap(), "the wand's critical damage, under Powerful Critical"))
thrown = request.payload.dice?.[0]?.results ?? []
roll = message?.rolls[0]
check(request.payload.critical === true && !('modifiers' in request.payload) && request.payload.dice[0].faces === 6 && thrown.length === 2 && made.status === 'done'
  && roll.isCritical === true && roll.formula === '2d6 + 12' && same(faces(roll), [thrown]) && roll.total === sum(thrown) + 12 && made.result.rolls?.[0]?.critical === true,
  `under Powerful Critical, the phone throws two d6, and the game makes them a critical hit's, 2d6 + 12, with Alice's dice (${thrown}): ${roll?.total}`)
await status.getByText(`At the table: ${roll.total}`).waitFor({ timeout: 15_000 })
damageTray = await status.textContent()
check(damageTray.startsWith(`${roll.total}Wand of Frost damage`) && damageTray.includes(`2d6 (${thrown.join(', ')}) +12 cold · Critical hit`),
  `the tray shows its dice and the most they could roll, the phone's total the game's: "${damageTray}"`)
await shoot(page, 'phone-tray-powerful-critical')
await criticalRulesChange('dnd5e.criticalDamageMaxDice', () => settings.set('criticalDamageMaxDice', false), EVERY_DIE_TWICE)

/** Thorin's character.updated posts so far. */
const thorinSheets = () => posted.filter(p => p.type === 'character.updated' && p.data.character.id === 'thorin').length
/**
 * Thorin's character.updated posts so far, counted once the last of them is the sheet the app
 * keeps: the app stores a sheet before its post is told here.
 */
async function thorinSheetsSettled() {
  await until(() => sorted(posted.filter(p => p.type === 'character.updated' && p.data.character.id === 'thorin').at(-1)?.data.character.sheet.critical) === keptCritical(),
    "Thorin's last posted sheet to be the one the app keeps", 15_000)
  return thorinSheets()
}
/** Where the last of Thorin's posted sheets differs from the one `back` before it: up to 8 paths. */
function sheetChanges(back = 1) {
  const all = posted.filter(p => p.type === 'character.updated' && p.data.character.id === 'thorin')
  const paths = []
  const walk = (a, b, path) => {
    if (paths.length >= 8 || JSON.stringify(a) === JSON.stringify(b)) return
    if (a && b && typeof a === 'object' && typeof b === 'object') for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], `${path}.${key}`)
    else paths.push(`${path}: ${JSON.stringify(a)?.slice(0, 80)} -> ${JSON.stringify(b)?.slice(0, 80)}`)
  }
  if (all.length > back) walk(all.at(-1 - back).data, all.at(-1).data, '')
  return paths
}
/**
 * Midi-QOL's rule for a critical hit's damage changed, as the Gamemaster changes its settings: then
 * long enough for the module to send a sheet, were one to be sent (it settles 250 ms).
 */
async function midiRule(rule) {
  const first = !criticalSettings.has('midi-qol.ConfigSettings')
  criticalSettings.add('midi-qol.ConfigSettings')
  midiCritical.gm = midiCritical.player = rule
  await Hooks.callAll(first ? 'createSetting' : 'updateSetting', { key: 'midi-qol.ConfigSettings' })
  await wait(1500)
}
if (MIDI) {
  // Decision 5 (module 0.32.0): Midi-QOL's rules for a critical hit's damage are the Gamemaster's
  // own rolls' alone, never an app roll's, which dnd5e makes. Under each of the Gamemaster's rules,
  // "doubleDice" (the reported world's), "maxAll" and "maxCritRoll": no sheet is sent, as nothing an
  // app roll's critical needs has changed; the wand's damage still offers a critical hit's, every die
  // twice, with nothing "as the game rolls it"; and the game makes it 4d6 of the phone's four d6,
  // never 2d6mx2 or 4d6min6.
  // The phone hears that Powerful Critical is off again before Midi's rules change: the app keeps
  // the sheet before the phone's next poll brings it.
  await modifyOnceItSays('Every die twice.')
  await modify.getByRole('button', { name: 'Cancel' }).tap()
  await modify.waitFor({ state: 'hidden' })
  for (const rule of ['doubleDice', 'maxAll', 'maxCritRoll']) {
    const sheets = await thorinSheetsSettled()
    await midiRule(rule)
    check(thorinSheets() === sheets && keptCritical() === sorted(EVERY_DIE_TWICE),
      `under Midi's "${rule}" for the Gamemaster, no sheet is sent: the app keeps dnd5e's own way, ${keptCritical()}${thorinSheets() === sheets ? '' : ` (${thorinSheets() - sheets} sent, changing ${JSON.stringify(sheetChanges(thorinSheets() - sheets))})`}`)
    await longPress(wandDamage, damageMenu)
    items = await damageMenu.getByRole('menuitem').allTextContents()
    check(same(items, ['Roll critical damage', 'Roll maximum damage', 'Modify damage…']), `and the wand's damage still offers a critical hit's: ${JSON.stringify(items)}`)
    await damageMenu.getByRole('menuitem', { name: 'Modify damage…' }).tap()
    await modify.waitFor()
    await modify.getByText('Critical hit', { exact: true }).tap()
    const critThrow = await modify.getByRole('status').textContent()
    const said = await modify.textContent()
    check(critThrow === '4d6 cold' && await modify.getByText('Every die twice.', { exact: true }).isVisible() && !said.includes('rolls it') && !/mx\d|min\d/.test(said),
      `Modify damage's Critical hit throws "${critThrow}", every die twice, and says nothing of the game rolling it its own way`)
    await modify.getByRole('button', { name: 'Cancel' }).tap()
    await modify.waitFor({ state: 'hidden' })
    await longPress(wandDamage, damageMenu)
    ;({ request, made, message } = await sent(() => damageMenu.getByRole('menuitem', { name: 'Roll critical damage' }).tap(), `the wand's critical damage, under Midi's ${rule}`))
    thrown = request.payload.dice?.[0]?.results ?? []
    roll = message?.rolls[0]
    check(request.payload.critical === true && thrown.length === 4 && made.status === 'done'
      && roll.isCritical === true && roll.formula === '4d6' && same(faces(roll), [thrown]) && roll.total === sum(thrown),
      `the phone throws four d6 (${thrown}), and the game makes them dnd5e's critical hit's: ${roll?.formula} = ${roll?.total}`)
    await status.getByText(`At the table: ${roll.total}`).waitFor({ timeout: 15_000 })
    damageTray = await status.textContent()
    check(damageTray.includes(`4d6 (${thrown.join(', ')}) cold · Critical hit`) && !/mx\d|min\d/.test(damageTray), `the tray shows the dice the phone threw: "${damageTray}"`)
    if (rule === 'doubleDice') await shoot(page, 'phone-tray-midi-critical')
  }
  await midiRule('default')
}

// ---- 7c. Healing: never a critical hit's ----
const draught = await wandText('Healing Draught')
const healing = draught.getByRole('button', { name: '2d4 + 2 Healing, roll healing' })
const healingMenu = page.getByRole('menu', { name: 'Healing Draught healing 2d4 + 2' })
before = requests()
const heldHealing = await longPress(healing, healingMenu)
items = await healingMenu.getByRole('menuitem').allTextContents()
check(heldHealing && same(items, ['Roll maximum healing', 'Modify healing…']) && requests() === before,
  `a long-press on the draught's healing offers it at its highest, or changed, and never as a critical hit's: ${JSON.stringify(items)}`)
await shoot(page, 'phone-healing-menu')
;({ request, made, message } = await sent(() => healingMenu.getByRole('menuitem', { name: 'Roll maximum healing' }).tap(), "the draught's healing at its highest"))
roll = message?.rolls[0]
check(request.kind === 'textDamage' && same(request.payload.modifiers, { maximize: true }) && !('critical' in request.payload)
  && same(request.payload.dice, [{ faces: 4, results: [4, 4] }]) && made.status === 'done'
  && roll.total === 10 && roll.isCritical === false && roll.options.type === 'healing' && message.flavor === 'Healing Draught - Healing Roll'
  && message.flags.dnd5e.roll.type === 'healing' && message.flags.dnd5e.item?.id === 'draught',
  `the game rolls it at its highest, 2d4 + 2 = ${roll?.total}, as healing, no critical hit's (${JSON.stringify(request.payload)})`)
await status.getByText('At the table: 10').waitFor({ timeout: 15_000 })
check(/Healing Draught healing/.test(await status.textContent()) && /· Maximum/.test(await status.textContent()), `the tray shows it: "${await status.textContent()}"`)
await shoot(page, 'phone-tray-maximum-healing')

// ---- 7d. The greataxe's damage, through its activity: what a critical hit adds ----
// dnd5e's link rolls it through the greataxe's attack, whose critical hit throws its die twice and
// Thorin's Savage Attacks' die more, and adds its critical damage, 1d6. The app keeps what it adds,
// marked never a critical hit's for apps before 0.20.0; the phone throws all of it, and the game
// makes it so, as each of the world's rules makes it.
const sizes = dice => (dice ?? []).map(({ faces, results }) => [faces, results.length])
/** What the app answers a roll the phone never offered, sent as the phone sends one: its status and why. */
async function forge(body) {
  await paced()
  return page.evaluate(async body => {
    const response = await fetch('/api/characters/sheet-thorin/rolls', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { status: response.status, ...(await response.json().catch(() => ({}))) }
  }, body)
}
/** Wait until the tray shows a roll the game made, by its label and the game's total; what it says. */
async function trayShows(label, total) {
  await until(async () => {
    const text = await status.textContent()
    return text.includes(label) && text.includes(`At the table: ${total}`)
  }, `the tray to show ${label}, ${total} at the table`, 15_000)
  return status.textContent()
}
const greataxeHash = hello().inventory.sections.flatMap(section => section.items).find(it => it.id === 'greataxe')?.text
const axeKept = kept(greataxeHash)
const chopSpan = /<span\b[^>]*\bss-damage\b[^>]*>/.exec(axeKept)?.[0] ?? ''
check(/data-formulas="1d12 \+ 4"/.test(chopSpan) && /data-critical="false"/.test(chopSpan) && /data-critical-dice="1"/.test(chopSpan)
  && /data-critical-damage="1d6"/.test(chopSpan) && !/Activity/.test(axeKept),
  `the app keeps the greataxe's damage with what a critical hit adds, its extra die and its critical damage, marked never a critical hit's for apps before them, and not its activity: ${chopSpan}`)
// A weapon's row is an action's, on the Inventory tab as on the Actions tab: its description opens
// below it, as the torch's does.
await nav.getByRole('button', { name: /^Character/ }).click().catch(() => {})
await page.getByRole('tab', { name: 'Actions' }).click()
await panel.getByRole('button', { name: /^Greataxe/, expanded: false }).click()
const axe = panel.locator('li', { has: page.getByRole('button', { name: /^Greataxe/, expanded: true }) }).locator('.sheet-text')
await axe.getByRole('button').first().waitFor({ timeout: 15_000 })
const chopDamage = axe.getByRole('button', { name: '1d12 + 4 Slashing, roll damage' })
const chopMenu = page.getByRole('menu', { name: 'Greataxe damage 1d12 + 4' })
before = requests()
// The phone may hear of the world's rules as they were last set a moment after.
let heldAxe = false
await until(async () => {
  heldAxe = await longPress(chopDamage, chopMenu)
  items = await chopMenu.getByRole('menuitem').allTextContents()
  if (items.includes('Roll critical damage')) return true
  await page.keyboard.press('Escape')
  await chopMenu.waitFor({ state: 'hidden' })
  return false
}, "the phone to offer the greataxe's critical hit", 30_000)
check(heldAxe && same(items, ['Roll critical damage', 'Roll maximum damage', 'Modify damage…']) && requests() === before,
  `a long-press on the greataxe's damage offers it as a critical hit's, though older apps are told it's never one: ${JSON.stringify(items)}`)
await shoot(page, 'phone-greataxe-menu')
;({ request, made, message } = await sent(() => chopMenu.getByRole('menuitem', { name: 'Roll critical damage' }).tap(), "the greataxe's critical damage"))
let [twelves, sixes] = (request.payload.dice ?? []).map(({ results }) => results)
roll = message?.rolls[0]
check(request.kind === 'textDamage' && request.payload.critical === true && !('modifiers' in request.payload)
  && same(sizes(request.payload.dice), [[12, 3], [6, 1]]) && made.status === 'done',
  `the phone throws three d12, the greataxe's die twice and Thorin's die more, then its critical damage's d6 (${JSON.stringify(request.payload)})`)
check(roll instanceof DamageRoll && roll.isCritical === true && roll.formula === '3d12 + 4 + 1d6' && same(faces(roll), [twelves, sixes])
  && roll.total === sum(twelves) + sum(sixes) + 4 && roll.options.type === 'slashing' && message.flavor === 'Greataxe - Damage Roll'
  && made.result.rolls?.[0]?.critical === true,
  `the game makes it a critical hit's as dnd5e does, 3d12 + 4 + 1d6, with Alice's dice as the phone threw them (${twelves}; ${sixes}): ${roll?.total}`)
damageTray = await trayShows('Greataxe damage', roll.total)
check(damageTray.startsWith(`${roll.total}Greataxe damage`) && damageTray.includes(`3d12 (${twelves.join(', ')}) +4 +1d6 (${sixes.join(', ')}) slashing · Critical hit`),
  `the tray shows the dice the phone threw, its critical damage's too, the phone's total the game's: "${damageTray}"`)
await shoot(page, 'phone-tray-greataxe-critical')
// The app checks a critical hit's dice as the world makes them, what it adds too: made up without
// Thorin's die more, or without the critical damage's die, they're refused, and nothing reaches the
// game.
const chopCritical = request.payload
before = requests()
const madeUp = [
  await forge({ ...chopCritical, dice: [{ faces: 12, results: [1, 2] }, { faces: 6, results: [3] }] }),
  await forge({ ...chopCritical, dice: [{ faces: 12, results: [1, 2, 3] }] }),
]
check(same(madeUp, [{ status: 422, reason: 'dice' }, { status: 422, reason: 'dice' }]) && requests() === before,
  `a critical hit's made up with two d12 and the d6, or three d12 alone, is refused for its dice: ${JSON.stringify(madeUp)}`)

// From Modify damage: a critical hit's and a die more, two more of the greataxe's own die, Thorin's
// and its critical damage as they are.
await longPress(chopDamage, chopMenu)
await chopMenu.getByRole('menuitem', { name: 'Modify damage…' }).tap()
await modify.waitFor()
await modify.getByText('Critical hit', { exact: true }).tap()
await modify.getByRole('button', { name: 'One die more' }).tap()
const chopThrow = await modify.getByRole('status').textContent()
check(chopThrow === '5d12 + 4 + 1d6 slashing', `Modify damage's Critical hit and a die more throws "${chopThrow}"`)
await shoot(page, 'phone-modify-greataxe-critical')
;({ request, made, message } = await sent(() => modify.getByRole('button', { name: 'Roll' }).tap(), "the greataxe's critical damage, a die more"))
;[twelves, sixes] = (request.payload.dice ?? []).map(({ results }) => results)
roll = message?.rolls[0]
check(request.payload.critical === true && same(request.payload.modifiers, { extra: 1 }) && same(sizes(request.payload.dice), [[12, 5], [6, 1]]) && made.status === 'done'
  && roll.isCritical === true && roll.formula === '5d12 + 4 + 1d6' && same(faces(roll), [twelves, sixes]) && roll.total === sum(twelves) + sum(sixes) + 4,
  `a die more of a critical hit's: the phone throws five d12 and the d6, and the game makes it 5d12 + 4 + 1d6 with Alice's dice: ${roll?.total}`)
damageTray = await trayShows('Greataxe damage', roll.total)
check(damageTray.startsWith(`${roll.total}Greataxe damage`), `the tray shows the game's total as the phone's: "${damageTray}"`)

// Under Powerful Critical: its die once, Thorin's die more thrown with it, the most its own could
// roll, and its critical damage.
await criticalRulesChange('dnd5e.criticalDamageMaxDice', () => settings.set('criticalDamageMaxDice', true), POWERFUL)
await modifyOnceItSays('Its dice, and the most they could roll added.', chopDamage, chopMenu)
await modify.getByText('Critical hit', { exact: true }).tap()
const powerfulChop = await modify.getByRole('status').textContent()
check(powerfulChop === '2d12 + 4 + 12 + 1d6 slashing', `under Powerful Critical, Modify damage's Critical hit throws "${powerfulChop}"`)
;({ request, made, message } = await sent(() => modify.getByRole('button', { name: 'Roll' }).tap(), "the greataxe's critical damage, under Powerful Critical"))
;[twelves, sixes] = (request.payload.dice ?? []).map(({ results }) => results)
roll = message?.rolls[0]
check(request.payload.critical === true && !('modifiers' in request.payload) && same(sizes(request.payload.dice), [[12, 2], [6, 1]]) && made.status === 'done'
  && roll.isCritical === true && roll.formula === '2d12 + 4 + 12 + 1d6' && same(faces(roll), [twelves, sixes]) && roll.total === sum(twelves) + sum(sixes) + 16,
  `the phone throws two d12 and the d6, and the game makes them 2d12 + 4 + 12 + 1d6 with Alice's dice (${twelves}; ${sixes}): ${roll?.total}`)
damageTray = await trayShows('Greataxe damage', roll.total)
check(damageTray.startsWith(`${roll.total}Greataxe damage`) && damageTray.includes(`2d12 (${twelves.join(', ')}) +4 +12 +1d6 (${sixes.join(', ')}) slashing · Critical hit`),
  `the tray shows them, the phone's total the game's: "${damageTray}"`)
await shoot(page, 'phone-tray-greataxe-powerful')
await criticalRulesChange('dnd5e.criticalDamageMaxDice', () => settings.set('criticalDamageMaxDice', false), EVERY_DIE_TWICE)

// Module 0.33.0 (its decisions): the Gamemaster turns on dnd5e's Critical Damage Modifiers, and
// a critical hit's numbers are still never doubled: no sheet is sent, its rule unchanged; Modify
// damage's Critical hit throws 3d12 + 4 + 1d6, and the game makes it so, + 4, never + 8.
{
  const sheets = await thorinSheetsSettled()
  await criticalRulesChange('dnd5e.criticalDamageModifiers', () => settings.set('criticalDamageModifiers', true), EVERY_DIE_TWICE)
  await wait(400)
  check(thorinSheets() === sheets && keptCritical() === sorted(EVERY_DIE_TWICE),
    `under Critical Damage Modifiers no sheet is sent, the app keeping every die twice, multiplyNumeric false: ${keptCritical()}${thorinSheets() === sheets ? '' : ` (${thorinSheets() - sheets} sent, changing ${JSON.stringify(sheetChanges(thorinSheets() - sheets))})`}`)
  await modifyOnceItSays('Every die twice.', chopDamage, chopMenu)
  await modify.getByText('Critical hit', { exact: true }).tap()
  const numbersOnce = await modify.getByRole('status').textContent()
  check(numbersOnce === '3d12 + 4 + 1d6 slashing', `Modify damage's Critical hit throws "${numbersOnce}", its 4 not doubled`)
  ;({ request, made, message } = await sent(() => modify.getByRole('button', { name: 'Roll' }).tap(), "the greataxe's critical damage, under Critical Damage Modifiers"))
  ;[twelves, sixes] = (request.payload.dice ?? []).map(({ results }) => results)
  roll = message?.rolls[0]
  check(request.payload.critical === true && same(sizes(request.payload.dice), [[12, 3], [6, 1]]) && made.status === 'done'
    && roll.isCritical === true && roll.formula === '3d12 + 4 + 1d6' && roll.total === sum(twelves) + sum(sixes) + 4
    && roll.options.critical?.multiplyNumeric === false,
    `the game makes it 3d12 + 4 + 1d6 with Alice's dice (${twelves}; ${sixes}), never 3d12 + 8 + 1d6: ${roll?.total}`)
  damageTray = await trayShows('Greataxe damage', roll.total)
  check(damageTray.includes(`3d12 (${twelves.join(', ')}) +4 +1d6 (${sixes.join(', ')}) slashing · Critical hit`),
    `the tray shows its 4 once: "${damageTray}"`)
  await criticalRulesChange('dnd5e.criticalDamageModifiers', () => settings.set('criticalDamageModifiers', false), EVERY_DIE_TWICE)
}

if (MIDI) {
  // Decision 5: under Midi's "maxCrit" and "maxCritRoll" for the Gamemaster, the greataxe's critical
  // hit's is still dnd5e's: no sheet is sent, it's still offered, and Modify damage's Critical hit
  // throws its die twice, Thorin's die more and its critical damage's d6. The critical hit's made up as
  // dnd5e's own way throws it, three d12 and the d6, which the app turned down under "maxCritRoll"
  // when it couldn't plan the world's, is now taken, and the game makes it so.
  // The phone hears that Powerful Critical is off again before Midi's rules change.
  await modifyOnceItSays('Every die twice.', chopDamage, chopMenu)
  await modify.getByRole('button', { name: 'Cancel' }).tap()
  await modify.waitFor({ state: 'hidden' })
  for (const rule of ['maxCrit', 'maxCritRoll']) {
    const sheets = await thorinSheetsSettled()
    await midiRule(rule)
    check(thorinSheets() === sheets && keptCritical() === sorted(EVERY_DIE_TWICE),
      `under Midi's "${rule}" for the Gamemaster, no sheet is sent, the app keeping dnd5e's own way: ${keptCritical()}${thorinSheets() === sheets ? '' : ` (${thorinSheets() - sheets} sent, changing ${JSON.stringify(sheetChanges(thorinSheets() - sheets))})`}`)
    await longPress(chopDamage, chopMenu)
    items = await chopMenu.getByRole('menuitem').allTextContents()
    check(same(items, ['Roll critical damage', 'Roll maximum damage', 'Modify damage…']), `the greataxe's damage still offers a critical hit's: ${JSON.stringify(items)}`)
    await chopMenu.getByRole('menuitem', { name: 'Modify damage…' }).tap()
    await modify.waitFor()
    await modify.getByText('Critical hit', { exact: true }).tap()
    const critChop = await modify.getByRole('status').textContent()
    check(critChop === '3d12 + 4 + 1d6 slashing' && !(await modify.textContent()).includes('rolls it'),
      `Modify damage's Critical hit throws "${critChop}", as dnd5e makes it`)
    await modify.getByRole('button', { name: 'Cancel' }).tap()
    await modify.waitFor({ state: 'hidden' })
  }
  before = requests()
  const takenUp = await forge({ ...chopCritical, dice: [{ faces: 12, results: [1, 2, 3] }, { faces: 6, results: [4] }] })
  check(takenUp.status === 202 && requests() === before + 1,
    `under "maxCritRoll", the greataxe's critical hit's made up as dnd5e's own way throws it, three d12 and the d6, is now taken: ${JSON.stringify(takenUp)}`)
  const takenRow = latestRequest()
  await until(() => settled(requestRow(`where id = '${takenRow.id}'`)), "the made-up critical hit's to be made")
  roll = madeFor(takenRow.id)?.rolls[0]
  check(requestRow(`where id = '${takenRow.id}'`).status === 'done' && roll?.isCritical === true && roll.formula === '3d12 + 4 + 1d6'
    && same(faces(roll), [[1, 2, 3], [4]]) && roll.total === 14,
    `and the game makes it 3d12 + 4 + 1d6 with those dice: ${roll?.formula} = ${roll?.total}`)
  await midiRule('default')
}

// ---- 7e. Damage that takes a die away (module 0.21.0) ----
// The Blighted Rod's 3 - 1d4 + 2d6: the phone offers it as a critical hit's, or changed, never at
// its highest, which would take the most away; a die more is of its d6, the first die it adds,
// never the d4 it takes away, as the game makes it; and one made up with a d4 more, the app
// refuses.
const blightHash = hello().inventory.sections.flatMap(section => section.items).find(it => it.id === 'blight')?.text
const blightSpan = /<span\b[^>]*\bss-damage\b[^>]*>/.exec(kept(blightHash) ?? '')?.[0] ?? ''
check(/data-formulas="3 - 1d4 \+ 2d6"/.test(blightSpan), `the app keeps the rod's damage as the game can plan it, its d4 taken away: ${blightSpan}`)
const blight = await wandText('Blighted Rod')
const blightDamage = blight.getByRole('button', { name: '3 - 1d4 + 2d6 Fire, roll damage' })
const blightMenu = page.getByRole('menu', { name: 'Blighted Rod damage 3 - 1d4 + 2d6' })
await blightDamage.waitFor({ timeout: 15_000 })
before = requests()
// The phone may hear of the world's rules as they were last set a moment after.
let heldBlight = false
await until(async () => {
  heldBlight = await longPress(blightDamage, blightMenu)
  items = await blightMenu.getByRole('menuitem').allTextContents()
  if (items.includes('Roll critical damage')) return true
  await page.keyboard.press('Escape')
  await blightMenu.waitFor({ state: 'hidden' })
  return false
}, "the phone to offer the rod's critical hit", 30_000)
check(heldBlight && same(items, ['Roll critical damage', 'Modify damage…']) && requests() === before,
  `a long-press on the rod's damage offers it as a critical hit's, or changed, never at its highest, and rolls nothing: ${JSON.stringify(items)}`)
await blightMenu.getByRole('menuitem', { name: 'Modify damage…' }).tap()
await modify.waitFor()
await modify.getByRole('button', { name: 'One die more' }).tap()
const blightThrow = await modify.getByRole('status').textContent()
check(blightThrow === '3 − 1d4 + 3d6 fire' && await modify.getByText('Maximum damage', { exact: true }).count() === 0,
  `Modify damage offers no maximum, and a die more is of its d6, the d4 as it was: "${blightThrow}"`)
await shoot(page, 'phone-modify-blighted')
;({ request, made, message } = await sent(() => modify.getByRole('button', { name: 'Roll' }).tap(), "the rod's damage, a die more"))
const [blightFours = [], blightSixes = []] = (request.payload.dice ?? []).map(({ results }) => results)
roll = message?.rolls[0]
check(request.kind === 'textDamage' && same(request.payload.modifiers, { extra: 1 }) && !('critical' in request.payload)
  && same(sizes(request.payload.dice), [[4, 1], [6, 3]]) && made.status === 'done',
  `the phone throws the d4 and three d6, and sends them a die more (${JSON.stringify(request.payload)})`)
const blightTotal = 3 - sum(blightFours) + sum(blightSixes)
check(roll instanceof DamageRoll && roll.formula === '3 - 1d4 + 3d6' && same(faces(roll), [blightFours, blightSixes]) && roll.total === blightTotal
  && roll.isCritical === false && message.flavor === 'Blighted Rod - Damage Roll',
  `the game makes it 3 - 1d4 + 3d6, the d6 more on the first die it adds, with Alice's dice (${blightFours}; ${blightSixes}): ${roll?.total}`)
damageTray = await trayShows('Blighted Rod damage', blightTotal)
check(damageTray.startsWith(`${blightTotal}Blighted Rod damage`) && damageTray.includes(`−1d4 (${blightFours.join(', ')}) +3d6 (${blightSixes.join(', ')}) fire`),
  `the tray shows the d4 taken away and the three d6, the phone's total the game's: "${damageTray}"`)
await shoot(page, 'phone-tray-blighted')
// A d4 more made up, as a module before 0.21.0 would throw it: refused for its dice, and nothing
// reaches the game.
before = requests()
const rolledBefore = messages.size
const blightMadeUp = await forge({ ...request.payload, dice: [{ faces: 4, results: [1, 2] }, { faces: 6, results: [1, 2] }] })
check(same(blightMadeUp, { status: 422, reason: 'dice' }) && requests() === before && messages.size === rolledBefore,
  `the rod's damage made up with a d4 more is refused for its dice, and nothing reaches the game: ${JSON.stringify(blightMadeUp)}`)

// ---- 8. A condition: the conditions panel, at it ----
wand = await wandText()
await wand.getByRole('button', { name: 'Prone' }).click()
const conditions = page.getByRole('dialog', { name: 'Conditions' })
await conditions.waitFor()
const prone = conditions.getByRole('heading', { name: 'Prone', exact: true })
await until(async () => {
  const [heading, top] = await Promise.all([prone.boundingBox(), conditions.locator('header').boundingBox()])
  return heading && top && heading.y >= top.y + top.height - 2 && heading.y < top.y + top.height + 80
}, 'the panel to open at Prone', 5000)
check(true, 'a tap on Prone opens the conditions panel, scrolled to Prone')
await shoot(page, 'phone-conditions-panel')
await conditions.getByRole('button', { name: 'Close' }).click()
await conditions.waitFor({ state: 'hidden' })

// ---- 9. and 11. The biography: a secret save isn't asked; a forged span is text ----
await page.getByRole('tab', { name: 'Biography' }).click()
const bio = panel.locator('.sheet-text')
await bio.getByRole('button').first().waitFor({ timeout: 15_000 })
await bio.getByRole('button', { name: 'DC 13 Wisdom', exact: true }).click()
menu = page.getByRole('menu', { name: 'DC 13 Wisdom saving throw' })
await menu.waitFor()
items = await menu.getByRole('menuitem').allTextContents()
check(!items.includes('Ask the table') && items[0] === 'Roll my Wisdom save (+2)', `a save in a section only the Gamemaster and Thorin's player see isn't asked of the table: ${JSON.stringify(items)}`)
await shoot(page, 'phone-secret-menu')
await page.keyboard.press('Escape')
await menu.waitFor({ state: 'hidden' })
await bio.getByRole('button', { name: 'DC 15 Dexterity', exact: true }).click()
menu = page.getByRole('menu', { name: 'DC 15 Dexterity saving throw' })
check((await menu.getByRole('menuitem').allTextContents())[0] === 'Ask the table', 'one outside it is')
await page.keyboard.press('Escape')
await menu.waitFor({ state: 'hidden' })
const forged = bio.getByText('A forged fire')
check(await forged.isVisible() && await bio.getByRole('button', { name: /forged/ }).count() === 0
  && await forged.evaluate(el => !el.closest('button') && !el.closest('.roll')) && !kept(bioHash).includes('100d6'),
  'a span forged in the biography stays plain text, and its formula never reaches the app')

// ---- 10. The Starry Wisp the torch casts, in its info dialog ----
await page.getByRole('tab', { name: 'Actions' }).click()
await panel.getByRole('button', { name: /^Everburning Torch/, expanded: false }).click()
await panel.getByRole('button', { name: 'About Everburning Torch (Starry Wisp)' }).click()
const info = page.getByRole('dialog', { name: 'Starry Wisp' })
await info.waitFor()
const infoText = info.locator('.sheet-text')
await infoText.getByRole('button').first().waitFor({ timeout: 15_000 })
check(same(await infoText.getByRole('button').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label') ?? b.textContent)), ['DC 13 Dexterity', '1d8 Fire, roll damage', '1d4, roll it']),
  "Starry Wisp's info dialog shows its description's save, damage and inline roll as buttons")
await infoText.getByRole('button', { name: 'DC 13 Dexterity', exact: true }).click()
menu = info.getByRole('menu', { name: 'DC 13 Dexterity saving throw' })
await menu.waitFor()
check(await menu.isVisible(), 'its save opens its menu inside the dialog')
await shoot(page, 'phone-info-menu')
await page.keyboard.press('Escape')
await menu.waitFor({ state: 'hidden' })
check(await info.isVisible(), 'Escape closes the menu, and leaves the dialog open')
;({ request, made, message } = await sent(() => infoText.getByRole('button', { name: '1d8 Fire, roll damage' }).click(), "Starry Wisp's damage"))
await info.waitFor({ state: 'hidden', timeout: 5000 })
roll = message?.rolls[0]
check(request.kind === 'textDamage' && made.status === 'done' && same(faces(roll), [request.payload.dice[0].results]) && request.payload.dice[0].faces === 8
  && message.flavor === 'Starry Wisp (Everburning Torch) - Damage Roll' && roll.options.type === 'fire',
  `a tap on its damage closes the dialog, and the game rolls it with Alice's d8 (${request.payload.dice[0].results}), named for the spell and the torch: ${roll?.total}`)
await status.getByText(`At the table: ${roll.total}`).waitFor({ timeout: 15_000 })
check(/Starry Wisp \(Everburning Torch\) damage/.test(await status.textContent()), `the tray shows it: "${await status.textContent()}"`)
await shoot(page, 'phone-tray-wisp-damage')
await panel.getByRole('button', { name: 'About Everburning Torch (Starry Wisp)' }).click()
await info.waitFor()
await infoText.getByRole('button', { name: 'DC 13 Dexterity', exact: true }).click()
;({ request, made, message } = await sent(() => info.getByRole('menu').getByRole('menuitem', { name: 'Roll my Dexterity save (+1)' }).click(), "Starry Wisp's save"))
await info.waitFor({ state: 'hidden', timeout: 5000 })
roll = message?.rolls[0]
saved = roll?.total >= 13
check(request.kind === 'save' && made.status === 'done' && roll.options.target === 13 && made.result.outcome === (saved ? 'success' : 'failure'),
  `its save, rolled from the dialog, closes it, and the game rolls it against its DC 13: ${roll?.total}, ${made.result.outcome}`)
await status.getByText(`At the table: ${roll.total} · ${saved ? 'Saved' : 'Failed'}`).waitFor({ timeout: 15_000 })
await shoot(page, 'phone-tray-wisp-save')

// ---- 12. The rope's checks, which work as a save does ----
let rope = await wandText('Climbing Rope')
await rope.getByRole('button').first().waitFor()
const ropeButtons = await rope.getByRole('button').evaluateAll(buttons => buttons.map(b => [b.getAttribute('aria-label') ?? b.textContent, b.getAttribute('aria-haspopup')]))
check(same(ropeButtons, [['DC 15 Strength (Athletics)', 'menu'], ['DC 13 Wisdom (Perception) check', 'menu'], ["Dexterity (Thieves' Tools)", 'menu']]),
  `the rope's description opens with [[/skill ath 15]], a check in plain words and [[/tool thief 16 hideDC]] as buttons, each opening a menu: ${JSON.stringify(ropeButtons)}`)
const ropeWords = await rope.textContent()
check(['at a DC 15 passive Wisdom (Perception), passive Perception 15; a passive Wisdom (Perception) check never'].every(words => ropeWords.includes(words))
  && !ropeWords.includes('16') && await rope.getByRole('button', { name: /passive/ }).count() === 0 && await rope.locator('a').count() === 0,
  "its passive checks, dnd5e's and in plain words, are plain text, and the DC its author hid isn't on the page")
await shoot(page, 'phone-rope-description')

// Its menu: to ask the table, or roll his own, as a save's.
await rope.getByRole('button', { name: 'DC 15 Strength (Athletics)', exact: true }).click()
menu = page.getByRole('menu', { name: 'DC 15 Strength (Athletics) check' })
await menu.waitFor()
items = await menu.getByRole('menuitem').allTextContents()
check(same(items, ['Ask the table', 'Roll my Strength (Athletics) check (+7)', 'Roll with advantage', 'Roll with disadvantage', 'Modify roll…']),
  `a tap on the check opens its menu, titled with its DC, offering his Athletics as the sheet has it: ${JSON.stringify(items)}`)
await shoot(page, 'phone-check-menu')

// Asking the table for it.
await until(() => Date.now() - askedAt > 11_000, 'the game to let Thorin ask again', 15_000)
;({ request, made, message } = await sent(() => menu.getByRole('menuitem', { name: 'Ask the table' }).click(), "the check's ask"))
check(request.kind === 'ask' && request.payload.text === ropeHash && Number.isInteger(request.payload.link) && !('dc' in request.payload) && made.status === 'done',
  `the phone asks the game for the check by the description's hash and the link's number, sending no DC (${JSON.stringify(request.payload)})`)
check(rendered.at(-1) === 'systems/dnd5e/templates/chat/roll-request-card.hbs' && (message?.content.match(/<button\b/g) ?? []).length === 1
  && message.content.includes('<button data-type="skill" data-ability="str" data-skill="ath" data-dc="15" data-format="short" data-action="rollRequest" data-visibility="all">')
  && message.content.includes(`<span class="visible-dc">${ICON_CHECK}DC 15 Strength (Athletics)</span>`) && message.content.includes(`<span class="hidden-dc">${ICON_CHECK}Strength (Athletics)</span>`),
  "the game posts dnd5e's own roll request card, its one button for a DC 15 Strength (Athletics) check, labelled as dnd5e labels it")
check(message.author.id === 'alice' && message.speaker.actor === 'thorin' && message.speaker.alias === 'Thorin' && message.flavor === 'Roll Request: Climbing Rope',
  `from Alice, as Thorin, naming the rope: "${message.flavor}"`)
check(message.flags['sending-stone']?.request === request.id && message.flags['sending-stone']?.ask?.text === ropeHash
  && message.flags['sending-stone'].ask.link === request.payload.link && message.flags.dnd5e?.item?.id === 'rope',
  `flagged sending-stone.request and .ask, and dnd5e.item the rope (${JSON.stringify(message.flags)})`)
await status.getByText('Posted to the table’s chat').waitFor({ timeout: 15_000 })
check(/DC 15 Strength \(Athletics\) check/.test(await status.textContent()), `the tray says it was posted: "${await status.textContent()}"`)
await shoot(page, 'phone-tray-check-asked')
await wait(4000)
check(nothingPrompted() && await banner.count() === 0, 'nobody is prompted by it, Thorin and Vex included')
const storedAsk = () => JSON.parse(sql(`select data->'ask' from chat_message where "messageId" = '${message.id}'`) || 'null')
await until(() => storedAsk() !== null, 'the app to keep the card')
// As stored, in jsonb, which keeps keys in an order of its own.
const keysSorted = value => JSON.stringify(value, (_, v) => ((v && (typeof v === 'object') && !Array.isArray(v)) ? Object.fromEntries(Object.entries(v).sort()) : v))
check(keysSorted(storedAsk()) === keysSorted({ type: 'check', checks: [{ type: 'skill', ability: 'str', skill: 'ath' }], dc: 15, label: 'Climbing Rope' }),
  `the module tells the app what the card asks for: ${JSON.stringify(storedAsk())}`)
await nav.getByRole('button', { name: 'Chat' }).click()
const checkBubble = chat.getByRole('listitem').filter({ hasText: 'Thorin asks for a DC 15 Strength (Athletics) check' })
await checkBubble.waitFor({ timeout: 15_000 })
const checkBubbleWords = await checkBubble.textContent()
check(/Climbing Rope/.test(checkBubbleWords) && checkBubbleWords.includes("Check"), `the app's chat shows the ask, marked a check, naming the rope: "${checkBubbleWords}"`)
await checkBubble.scrollIntoViewIfNeeded()
await shoot(page, 'phone-chat-check-ask')

// Rolling his own against the description's DC.
rope = await wandText('Climbing Rope')
await rope.getByRole('button', { name: 'DC 15 Strength (Athletics)', exact: true }).click()
menu = page.getByRole('menu', { name: 'DC 15 Strength (Athletics) check' })
;({ request, made, message } = await sent(() => menu.getByRole('menuitem', { name: 'Roll my Strength (Athletics) check (+7)' }).click(), 'the Athletics check'))
let natural = request.payload.dice?.[0]?.results?.[0]
roll = message?.rolls[0]
check(request.kind === 'skill' && request.payload.key === 'ath' && request.payload.text === ropeHash && Number.isInteger(request.payload.link) && !('dc' in request.payload),
  `the phone sends Thorin's Athletics check, from the rope's link, with no DC of its own (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && roll?.options.target === 15 && same(faces(roll), [[natural]]) && roll.total === natural + 7
  && message.flags.dnd5e.roll.type === 'skill' && message.flags.dnd5e.roll.skillId === 'ath' && message.author.id === 'alice' && message.speaker.actor === 'thorin',
  `the game rolls his Athletics with Alice's d20 (${natural}), +7 as the phone has it, against the description's DC 15: ${roll?.total}`)
let passed = roll.total >= 15
check(made.result.outcome === (passed ? 'success' : 'failure'), `and says he ${passed ? 'passed' : 'failed'} (${made.result.outcome})`)
await status.getByText(`At the table: ${roll.total} · ${passed ? 'Passed' : 'Failed'}`).waitFor({ timeout: 15_000 })
let checkTray = await status.textContent()
check(checkTray.startsWith(`${roll.total}Strength (Athletics) check`) && /DC 15/.test(checkTray),
  `the tray shows the phone's total, the game's, the DC, and whether he passed, as the game has it: "${checkTray}"`)
await shoot(page, 'phone-tray-check')

// The check in plain words, its DC the one the text gives, rolled with advantage.
await rope.getByRole('button', { name: 'DC 13 Wisdom (Perception) check' }).click()
menu = page.getByRole('menu', { name: 'DC 13 Wisdom (Perception) check' })
await menu.waitFor()
items = await menu.getByRole('menuitem').allTextContents()
check(same(items, ['Ask the table', 'Roll my Wisdom (Perception) check (+5)', 'Roll with advantage', 'Roll with disadvantage', 'Modify roll…']),
  `"a DC 13 Wisdom (Perception) check" in plain words is a check, with Thorin's proficient Perception: ${JSON.stringify(items)}`)
;({ request, made, message } = await sent(() => menu.getByRole('menuitem', { name: 'Roll with advantage' }).click(), 'the Perception check'))
const pair = request.payload.dice?.[0]?.results ?? []
roll = message?.rolls[0]
check(request.kind === 'skill' && request.payload.key === 'prc' && request.payload.mode === 1 && pair.length === 2 && made.status === 'done'
  && roll?.options.target === 13 && roll.hasAdvantage && same(faces(roll), [pair]) && roll.total === Math.max(...pair) + 5,
  `the game rolls it with advantage, with both of Alice's d20s (${pair}), against the DC the text gives, 13: ${roll?.total}`)
passed = roll.total >= 13
await status.getByText(`At the table: ${roll.total} · ${passed ? 'Passed' : 'Failed'}`).waitFor({ timeout: 15_000 })
checkTray = await status.textContent()
check(made.result.outcome === (passed ? 'success' : 'failure') && checkTray.startsWith(`${roll.total}Wisdom (Perception) check`) && /DC 13/.test(checkTray) && /Advantage/.test(checkTray),
  `the tray shows its DC, its advantage and whether he passed, as the game has it: "${checkTray}"`)
await shoot(page, 'phone-tray-plain-check')

// The tool's check whose DC its author hid.
await rope.getByRole('button', { name: "Dexterity (Thieves' Tools)", exact: true }).click()
menu = page.getByRole('menu', { name: "Dexterity (Thieves' Tools) check", exact: true })
await menu.waitFor()
items = await menu.getByRole('menuitem').allTextContents()
check(same(items, ['Ask the table', "Roll my Dexterity (Thieves' Tools) check (+4)", 'Roll with advantage', 'Roll with disadvantage', 'Modify roll…']),
  `its menu names no DC, and offers Thorin's Thieves' Tools as the sheet has them: ${JSON.stringify(items)}`)
await shoot(page, 'phone-hidden-check-menu')
;({ request, made, message } = await sent(() => menu.getByRole('menuitem', { name: "Roll my Dexterity (Thieves' Tools) check (+4)" }).click(), "the Thieves' Tools check"))
natural = request.payload.dice?.[0]?.results?.[0]
roll = message?.rolls[0]
check(request.kind === 'tool' && request.payload.key === 'thief' && request.payload.text === ropeHash && !('dc' in request.payload) && made.status === 'done'
  && roll?.options.target === 16 && same(faces(roll), [[natural]]) && roll.total === natural + 4
  && message.flags.dnd5e.roll.type === 'tool' && message.flags.dnd5e.roll.toolId === 'thief',
  `the game rolls his Thieves' Tools with Alice's d20 (${natural}), +4 as the phone has it, against the DC its author hid, 16: ${roll?.total}`)
passed = roll.total >= 16
check(made.result.outcome === (passed ? 'success' : 'failure'), `and says whether he passed (${made.result.outcome})`)
await status.getByText(`At the table: ${roll.total} · ${passed ? 'Passed' : 'Failed'}`).waitFor({ timeout: 15_000 })
checkTray = await status.textContent()
check(checkTray.startsWith(`${roll.total}Dexterity (Thieves' Tools) check`) && !/DC/.test(checkTray), `the tray shows no DC: "${checkTray}"`)
await shoot(page, 'phone-tray-hidden-check')

// The wand's Strength check: an ability check.
wand = await wandText()
await wand.getByRole('button', { name: 'DC 12 Strength', exact: true }).click()
menu = page.getByRole('menu', { name: 'DC 12 Strength check' })
await menu.waitFor()
items = await menu.getByRole('menuitem').allTextContents()
check(same(items, ['Ask the table', 'Roll my Strength check (+4)', 'Roll with advantage', 'Roll with disadvantage', 'Modify roll…']),
  `the wand's [[/check str 12]] offers Thorin's Strength check: ${JSON.stringify(items)}`)
;({ request, made, message } = await sent(() => menu.getByRole('menuitem', { name: 'Roll my Strength check (+4)' }).click(), "the wand's Strength check"))
natural = request.payload.dice?.[0]?.results?.[0]
roll = message?.rolls[0]
check(request.kind === 'ability' && request.payload.key === 'str' && request.payload.text === wandHash && made.status === 'done'
  && roll?.options.target === 12 && same(faces(roll), [[natural]]) && roll.total === natural + 4
  && message.flags.dnd5e.roll.type === 'ability' && message.flags.dnd5e.roll.ability === 'str',
  `the game rolls his Strength check with Alice's d20 (${natural}), +4, against its DC 12: ${roll?.total}`)
passed = roll.total >= 12
await status.getByText(`At the table: ${roll.total} · ${passed ? 'Passed' : 'Failed'}`).waitFor({ timeout: 15_000 })
check(made.result.outcome === (passed ? 'success' : 'failure') && /Strength check/.test(await status.textContent()) && /DC 12/.test(await status.textContent()),
  `and the tray shows whether he passed, as the game has it: "${await status.textContent()}"`)
await shoot(page, 'phone-tray-ability-check')

// The app's chat shows none of the DCs their authors hid.
await nav.getByRole('button', { name: 'Chat' }).click()
await chat.getByRole('listitem').last().waitFor()
check(!/DC 16/.test(await chat.textContent()), 'the app\'s chat shows neither DC its authors hid')

// ---- 8. On a desktop: a condition's rules on a hover ----
const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })
await desktop.addCookies([cookie])
await desktop.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
const wide = await desktop.newPage()
wide.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
await wide.goto(`${BASE}/characters/sheet-thorin`)
await wide.getByRole('tab', { name: 'Inventory' }).click()
const wideRow = wide.getByRole('tabpanel').locator('li', { has: wide.locator('summary', { hasText: 'Wand of Frost' }) })
await wideRow.locator('summary').click()
const restrained = wideRow.locator('.sheet-text').getByRole('button', { name: 'Restrained' })
await restrained.waitFor({ timeout: 15_000 })
await restrained.hover()
const tooltip = wide.getByRole('tooltip')
await tooltip.waitFor({ timeout: 5000 })
const rules = await tooltip.textContent()
check(/^Restrained/.test(rules) && /Speed 0/.test(rules) && /Disadvantage/.test(rules), `on a desktop, a hover on Restrained shows its rules: "${rules.slice(0, 120)}…"`)
await shoot(wide, 'desktop-condition-tooltip')
await wide.mouse.move(5, 5)
await tooltip.waitFor({ state: 'hidden', timeout: 5000 })
// The keyboard's context menu key opens the wand's damage menu, as a long-press does on the phone.
const wideDamage = wideRow.locator('.sheet-text').getByRole('button', { name: '2d6 Cold, roll damage' })
const wideMenu = wide.getByRole('menu', { name: 'Wand of Frost damage 2d6' })
await wideDamage.focus()
await wide.keyboard.press('ContextMenu')
await wideMenu.waitFor({ timeout: 5000 })
const wideItems = await wideMenu.getByRole('menuitem').allTextContents()
await shoot(wide, 'desktop-damage-menu')
await wide.keyboard.press('Escape')
await wideMenu.waitFor({ state: 'hidden', timeout: 5000 })
check(same(wideItems, ['Roll critical damage', 'Roll maximum damage', 'Modify damage…']) && await wideDamage.evaluate(button => button === document.activeElement),
  `on a desktop, the context menu key opens the wand's damage menu, ${JSON.stringify(wideItems)}, and Escape gives the link back its focus`)
await desktop.close()

// Nothing in all of it prompted anyone.
check(nothingPrompted(), 'nothing in all of it prompted anyone')

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
