// Check, forward and enchant activities from the app, end to end (module 0.21.0): the real module,
// in a stand-in Foundry with dnd5e 5.3.3's real dice classes, its activities ported
// (fvtt/activity5e.mjs, check and forward among them) and its enchantments (fvtt/enchant5e.mjs),
// fetches from the production app, from a browser on the game's page. Four characters, as
// fvtt/activities.mjs and fvtt/enchant.mjs have them, with dnd5e's own items, each on a phone 390
// wide. Rook, a Thief, rolls Fast Hands' Sleight of Hand, and his Thieves' Tools against their DC 15,
// with his own d20; asks the table with Fast Hands, its card in the app's chat; binds the goblin
// with Manacles, spending their use, then rolls to bind it. Zanna, a wizard, casts Maze at the goblin
// and concentrates on it; uses Entangle's Escape Plants check, which spends no slot and takes no
// concentration; casts Hellish Rebuke through its free casting, its damage with her dice, and Bless
// through its, Perrin's seven listed as one. Gorm, a fighter, casts Misty Step through his. Ari puts
// Shillelagh on her club, and leaves it on its card; Magic Weapon at 4th on her longsword, then at
// 2nd on her quarterstaff, the concentration that ends taking the longsword's +2 with it; ends it;
// sets her Flame Tongue alight and puts it out with its switch. What each phone shows and sends,
// what the game makes of it, and the sheet it sends back; requests the phone never offered,
// refused by the app or by the game; then the phones at 360, and a sheet as a module before 0.21.0
// sends it. MIDI=1 puts the stand-in Midi-QOL workflow in the world (fvtt/midi-fake.mjs), with its
// enchant activity (fvtt/enchant5e.mjs): the goblin's checks and saves are its, which proves only
// the module's path through it. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs, against the app on localhost:3000 and its database. Screenshots to
// SHOTS.
import { combat, combatant, settings, user, users, actors } from './fvtt/stub.mjs'
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
// The same, whatever order their keys are in, as the app's database keeps them in its own.
const sorted = value => (Array.isArray(value) ? value.map(sorted)
  : (value && (typeof value === 'object')) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value)
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))
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
const started = Date.now()

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
// Once set, Rook's sheet goes as a module before 0.21.0 sends it: his Thieves' Tools' check
// activity used in Foundry, with no `activity`, and no `check` or `forward` anywhere.
let before021 = false
const asBefore = body => {
  if (!before021 || !['bridge.hello', 'character.updated'].includes(body?.type)) return body
  const strip = value => {
    if (Array.isArray(value)) return value.forEach(strip)
    if (!value || (typeof value !== 'object')) return
    if (value.activity?.type === 'check') value.activity = null
    // An activity's check and forward, not an ability's check modifier.
    if (Array.isArray(value.check?.checks)) delete value.check
    if (value.forward && ('charges' in value.forward)) delete value.forward
    Object.values(value).forEach(strip)
  }
  const sheets = body.type === 'character.updated' ? [body.data.character] : body.data.characters
  for (const character of sheets ?? []) if (character.id === 'rook') strip(character.sheet)
  return body
}
globalThis.fetch = async (url, init) => {
  // Made from the game's page, and given up on there when the module gives it up.
  const id = ++fetches
  init.signal?.addEventListener('abort', () => {
    void gmTab.evaluate(id => globalThis.__aborts?.[id]?.abort(), id).catch(() => {})
  }, { once: true })
  const outgoing = JSON.stringify(asBefore(JSON.parse(init.body)))
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
/** The commands the module has fetched from the app, in order. */
const fetched = () => posted.filter(p => p.url.endsWith('/api/bridge/commands') && (p.status === 200))
  .flatMap(p => { try { return JSON.parse(p.body).commands ?? [] } catch { return [] } })
/** The last sheet the module sent the app of a character. */
const lastSheet = actorId => posted.filter(p => p.type === 'character.updated' && p.data?.character?.id === actorId).at(-1)?.data.character.sheet

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

// ---- Foundry, with dnd5e's dice, items, activities and enchantments ----
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
const TYPES = ['slashing', 'piercing', 'bludgeoning', 'radiant', 'fire', 'cold', 'lightning', 'poison', 'force', 'necrotic']
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
// Spellcasting by spell levels and by pact, as dnd5e's model, with what its sheet and its usage
// dialog use.
const ordinal = n => ['Cantrips', '1st Level', '2nd Level', '3rd Level'][n] ?? `${n}th Level`
const leveled = {
  key: 'spell', slots: true, cantrips: true, prepares: true, order: 20, exclusive: { spells: false, slots: false },
  getAvailableLevels: actor => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => (actor.system.spells[`spell${l}`]?.max ?? 0) > 0),
  getSpellSlotKey: level => `spell${level}`, getLabel: ({ level }) => ordinal(level),
}
const pact = { key: 'pact', slots: true, order: 30, exclusive: { spells: false, slots: false }, getAvailableLevels: () => [], getSpellSlotKey: () => 'pact', getLabel: () => 'Pact Magic' }
const skill = (label, ability) => ({ label, ability })
CONFIG.DND5E = {
  skills: {
    slt: skill('Sleight of Hand', 'dex'), inv: skill('Investigation', 'int'), acr: skill('Acrobatics', 'dex'),
    ath: skill('Athletics', 'str'), prc: skill('Perception', 'wis'),
  },
  tools: { thief: { label: "Thieves' Tools", ability: 'dex' } },
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex' },
  spellcasting: { spell: leveled, pact },
  damageTypes: Object.fromEntries(TYPES.map(type => [type, { label: capital(type) }])),
  healingTypes: { healing: { label: 'Healing' }, temphp: { label: 'Temporary HP' } },
  activityActivationTypes: {
    action: { label: 'Action', header: 'Actions' }, bonus: { label: 'Bonus Action', header: 'Bonus Actions' },
    reaction: { label: 'Reaction', header: 'Reactions' },
  },
  limitedUsePeriods: { lr: { label: 'Long Rest' } },
}
// Concentration, as the statuses dnd5e gives a character concentrating, and what it's on.
CONFIG.statusEffects = [{ id: 'concentrating', name: 'EFFECT.DND5E.StatusConcentrating', img: 'systems/dnd5e/icons/svg/statuses/concentrating.svg' }]
CONFIG.specialStatusEffects = { CONCENTRATING: 'concentrating' }
const translations = {
  'EFFECT.DND5E.StatusConcentrating': 'Concentrating', 'DND5E.FeaturesOther': 'Other Features',
  'TYPES.Item.weaponPl': 'Weapons', 'TYPES.Item.consumablePl': 'Consumables', 'TYPES.Item.toolPl': 'Tools',
}
const localize = game.i18n.localize.bind(game.i18n)
game.i18n.localize = key => translations[key] ?? localize(key)
// The kinds of item dnd5e lets be enchanted (data/item/*.mjs metadata).
CONFIG.Item = {
  dataModels: Object.fromEntries([
    ...['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container', 'spell', 'feat'].map(type => [type, { metadata: { enchantable: true } }]),
    ['class', { metadata: {} }], ['background', { metadata: {} }],
  ]),
  typeLabels: {},
}
settings.set('messageMode', 'public')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
settings.set('attackRollVisibility', 'hideAC')

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, SaveActivity, DamageActivity, HealActivity, Collection, activityTypes, equip, screen } = await import('./fvtt/activity5e.mjs')
const { midi, placeables, installMidi, MidiActivity } = await import('./fvtt/midi-fake.mjs')
const { EnchantActivity, midiEnchantActivity, registry: enchantments, staticID, withEffects } = await import('./fvtt/enchant5e.mjs')
// dnd5e's ActivityCollection finds activities by type, as the sheet's actions do.
Collection.prototype.getByType ??= function (type) { return this.contents.filter(activity => activity.type === type) }
globalThis.dnd5e = {
  settings: { rulesVersion: 'modern' },
  documents: {
    activity: { AttackActivity, SaveActivity, DamageActivity, HealActivity, EnchantActivity, CastActivity: { ENCHANTMENT_ID: staticID('dnd5espellchanges') } },
    // Trait.keyLabel, which names a tool as its base item is named.
    Trait: { keyLabel: (key, { trait } = {}) => ((trait === 'tool') ? ({ thief: "Thieves' Tools" })[key] : undefined) ?? key },
  },
  utils: { staticID },
  registry: {
    enchantments,
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
const bob = user('bob', 'Bob')
const carol = user('carol', 'Carol')
const dave = user('dave', 'Dave')
if (MIDI) {
  installMidi()
  activityTypes.enchant = midiEnchantActivity(MidiActivity)
}

/**
 * A character in the world, once equipped, as Foundry and dnd5e keep one: effects of its own, its
 * concentration among them, which its statuses and what it concentrates on follow, as dnd5e's do;
 * and every client told of a change to it or its items, as when a use spends a slot or a use of an
 * item, so that the module sends its sheet again.
 */
function character(actor, { level, classes }) {
  actor.documentName = 'Actor'
  actors.set(actor.id, actor)
  withEffects(actor, { level, classes })
  const focus = actor.concentration
  Object.defineProperty(focus, 'items', {
    get: () => new Set(focus.effects.contents.map(effect => actor.items.get(effect.flags.dnd5e?.item?.id)).filter(Boolean)),
  })
  Object.defineProperty(actor, 'statuses', {
    configurable: true,
    get: () => new Set(actor.effects.contents.flatMap(effect => [...effect.statuses])),
  })
  const update = actor.update.bind(actor)
  actor.update = async changes => {
    await update(changes)
    Hooks.callAll('updateActor', actor, changes, {}, 'gm')
  }
  const updateItems = actor.updateEmbeddedDocuments
  actor.updateEmbeddedDocuments = async (type, updates) => {
    await updateItems(type, updates)
    for (const { _id, ...changes } of updates) Hooks.callAll('updateItem', actor.items.get(_id), changes, {}, 'gm')
  }
  return actor
}

// dnd5e's check activity as its pack has it: `check` with its ability, the skills or tools it's
// associated with, and its DC's formula or calculation.
const checkActivity = (id, name, checkData, fields = {}) => ({ id, name, type: 'check', affects: '', range: 'self', check: checkData, ...fields })
// A spell's free casting, as spell-config.mjs:98-111 adds it: a forward to the activity, spending a
// use of the spell.
const free = (id, target, fields = {}) => ({
  id, name: 'Cast (free casting)', type: 'forward', activity: { id: target },
  consumption: [{ type: 'itemUses', target: '', value: '1' }], ...fields,
})
const spell = (id, name, level, activities, system = {}) => ({
  id, name, type: 'spell', system: { level, method: 'spell', prepared: 1, canPrepare: true, properties: [], ...system }, activities,
})

// Rook, a 3rd-level Thief: Dexterity 16, proficient in Sleight of Hand and thieves' tools, each +5.
const rook = new Actor5e({
  id: 'rook', name: 'Rook', owners: ['alice'], mods: { dex: 3, str: 0 }, prof: 2,
  skills: { slt: { ability: 'dex' }, acr: { ability: 'dex', value: 0 }, ath: { ability: 'str', value: 0 } },
  tools: { thief: { ability: 'dex' } },
})
alice.character = rook
equip(rook, {
  items: [
    // classes24 Fast Hands: two checks and Use an Object, each a bonus action.
    { id: 'hands', name: 'Fast Hands', type: 'feat', system: { properties: [] }, activities: [
      checkActivity('sltCheck', 'Sleight of Hand', { associated: ['slt'], ability: '', dc: { formula: '' } }, { activation: { type: 'bonus', value: null } }),
      checkActivity('thiefCheck', "Thieves' Tools", { associated: ['thief'], ability: 'dex', dc: { formula: '' } }, { activation: { type: 'bonus', value: null } }),
      { id: 'useObject', name: 'Use an Object', type: 'utility', affects: '', range: 'self', activation: { type: 'bonus', value: null } },
    ] },
    // equipment24 Thieves' Tools, a +1 set: its check is of its own tool, with no tool named.
    { id: 'tools', name: "Thieves' Tools", type: 'tool', system: { properties: [], quantity: 1, type: { value: '', baseItem: 'thief' }, ability: 'dex', bonus: '1', prof: { multiplier: 1 } },
      activities: [checkActivity('pick', 'Pick a Lock/Disarm a Trap', { ability: 'dex', associated: [], dc: { formula: '15' } }, { activation: { type: 'action', value: 1 } })] },
    // A homebrew knack whose first activity, by sort, is a forward to the one after it, for one of
    // its two uses: it rolls as what it names, under the forward's id.
    { id: 'knack', name: 'Steady Knack', type: 'feat', system: { properties: [], uses: { max: 2, spent: 0, recovery: [{ period: 'lr' }] } }, activities: [
      { id: 'knackUse', name: 'Steady Hands', type: 'utility', sort: 1, affects: 'self', range: 'self', activation: { type: 'bonus', value: 1 } },
      { id: 'knackFwd', name: 'Steady (knack)', type: 'forward', sort: 0, activity: { id: 'knackUse' }, activation: { type: 'bonus', value: 1 },
        consumption: [{ type: 'itemUses', target: '', value: '1' }] },
    ] },
    // equipment24 Manacles: Bind a creature, for their one use; or burst them.
    { id: 'manacles', name: 'Manacles', type: 'consumable', system: { properties: [], quantity: 1, uses: { max: 1, spent: 0 } }, activities: [
      checkActivity('bind', 'Bind', { associated: ['slt'], ability: '', dc: { formula: '13' } },
        { activation: { type: 'action', value: 1 }, affects: 'creature', count: 1, range: 'ft', consumption: [{ type: 'itemUses', target: '', value: '1' }] }),
      checkActivity('burst', 'Burst Check', { associated: ['ath'], ability: '', dc: { formula: '25' } }, { activation: { type: 'action', value: 1 } }),
    ] },
  ],
})

// What dnd5e works out of them, for his sheet.
Object.assign(rook.system.skills.slt, { total: 5, passive: 15 })
Object.assign(rook.system.skills.acr, { total: 3, passive: 13 })
Object.assign(rook.system.skills.ath, { total: 0, passive: 10 })
Object.assign(rook.system.tools.thief, { total: 5, passive: 15 })

// Zanna, a 15th-level wizard: Intelligence +5, proficiency +5, spell save DC 18; an 8th-level slot,
// and the 1st-level slots spent.
const zanna = new Actor5e({ id: 'zanna', name: 'Zanna', owners: ['bob'], mods: { int: 5, dex: 2 }, prof: 5, skills: { inv: { ability: 'int' } } })
bob.character = zanna
zanna.system.abilities.int.dc = 18
Object.assign(zanna.system.skills.inv, { total: 10, passive: 20 })
zanna.system.attributes.spellcasting = 'int'
zanna.system.attributes.spell = { dc: 18, attack: 10, mod: 5 }
zanna.spellcastingClasses = { wizard: { name: 'Wizard', spellcasting: { ability: 'int', save: 18, attack: 10 } } }
// Perrin's Bless (actors24/premades/level-1/perrin.yml): seven forwards, each a free casting of the
// spell, one naming another, two or three hops long, each spending its use.
const perrin = (id, name, sort, target, fields = {}) => ({ ...free(id, target, fields), name, sort })
equip(zanna, {
  spells: {
    spell1: { value: 0, max: 4, level: 1 }, spell2: { value: 3, max: 3, level: 2 }, spell3: { value: 2, max: 2, level: 3 },
    ...Object.fromEntries([4, 5, 6, 7, 9].map(level => [`spell${level}`, { value: 0, max: 0, level }])),
    spell8: { value: 1, max: 1, level: 8 },
  },
  items: [
    // spells24 Maze: its check the goblin makes, taking the spell's concentration.
    spell('maze', 'Maze', 8, [checkActivity('banish', 'Banish to Maze', { associated: ['inv'], ability: '', dc: { formula: '20' } },
      { activation: { type: 'action', value: 1 }, affects: 'creature', count: 1, range: 'ft', duration: { override: false } })],
    { properties: ['concentration'], duration: { value: '10', units: 'minute' } }),
    // The 2014 Entangle, in its pack's order: its Escape Plants check first by sort, with no
    // activation of its own and spending no slot; the spell cast after it.
    spell('entangle', 'Entangle', 1, [
      checkActivity('escapePlants', 'Escape Plants Check', { associated: [], ability: 'str', dc: { calculation: 'spellcasting', formula: '' } },
        { sort: 0, activation: { type: '', override: true }, duration: { override: true, concentration: false }, range: 'spec', affects: 'creature', count: 1, spellSlot: false }),
      { id: 'entangleCast', name: 'Cast', type: 'save', sort: 100000, activation: { type: 'action', value: 1 }, affects: 'creature', save: ['str'], dc: 18, duration: { override: false } },
    ], { properties: ['concentration'], duration: { value: '1', units: 'minute' } }),
    // Hellish Rebuke, granted with a use a day, with its free casting.
    spell('rebuke', 'Hellish Rebuke', 1, [
      { id: 'rebukeCast', name: 'Cast', type: 'save', activation: { type: 'reaction', value: 1 }, affects: 'creature', count: 1, save: ['dex'], dc: 18,
        damage: [{ number: 2, denomination: 10, types: ['fire'], scaling: 1 }], labels: { damage: [{ formula: '2d10', damageType: 'fire', label: '2d10 Fire' }] } },
      free('rebukeFree', 'rebukeCast', { activation: { type: 'reaction', value: 1 } }),
    ], { uses: { max: 1, spent: 0, recovery: [{ period: 'lr' }] } }),
    // Bless, granted with a use a day, with Perrin's seven free castings.
    spell('bless', 'Bless', 1, [
      { id: 'dnd5eactivity000', name: 'Cast', type: 'utility', sort: 0, activation: { type: 'action', value: 1 }, affects: 'ally', count: '3 + @scaling',
        duration: { override: false }, effects: ['Bless'] },
      perrin('2QtNAQPwdzdUtbif', 'Use (free casting)', 1, 'dnd5eactivity000', { activation: { type: 'action', value: 1 } }),
      perrin('j9kXvrOVzEMbdKJW', 'Use (free casting)', 1, 'dnd5eactivity000', { activation: { type: 'action', value: 1 } }),
      perrin('KWxuRvbiJlyFpkRk', 'Use (free casting) (free casting)', 2, '2QtNAQPwdzdUtbif', { activation: { type: 'action', value: 1 } }),
      perrin('8jvv7dRIQY9yURrH', 'Use (free casting)', 1, 'dnd5eactivity000', { activation: { type: 'action', value: 1 } }),
      perrin('sInDcKwhmsmPRTmO', 'Use (free casting) (free casting)', 2, '2QtNAQPwdzdUtbif', { activation: { type: 'action', value: 1 } }),
      perrin('BkF3ZsSb7nG1EGip', 'Use (free casting) (free casting)', 2, 'j9kXvrOVzEMbdKJW', { activation: { type: 'action', value: 1 } }),
      perrin('hV0VpciDU83310XO', 'Use (free casting) (free casting) (free casting)', 3, 'KWxuRvbiJlyFpkRk', { activation: { type: 'action', value: 1 } }),
    ], { properties: ['concentration'], duration: { value: '1', units: 'minute' }, uses: { max: 1, spent: 0, recovery: [{ period: 'lr' }] } }),
  ],
})

// Gorm, a 4th-level fighter with no spell slots, granted Misty Step by Fey Touched.
const gorm = new Actor5e({ id: 'gorm', name: 'Gorm', owners: ['dave'], mods: { str: 3 }, prof: 2 })
dave.character = gorm
equip(gorm, {
  items: [spell('misty', 'Misty Step', 2, [
    { id: 'mistyStep', name: 'Cast', type: 'utility', affects: 'self', range: 'self', activation: { type: 'bonus', value: 1 } },
    free('mistyFree', 'mistyStep', { activation: { type: 'bonus', value: 1 } }),
  ], { uses: { max: 1, spent: 0, recovery: [{ period: 'lr' }] } })],
})

// Ari, a 5th-level druid-wizard with slots to 4th level, concentrating on one thing at once.
const P = {
  sh1: 'QPsqj6jfS0iXSrTs', sh2: 'Oy8fnNNzPmehxXio', sh3: 'advnpQaBnsbuv02y', sh4: 'X9xoN8qHUiCc4SZR',
  mw1: 'SLSudYaACjmmmZsU', mw2: '8OhsRxK3dF1JeQXO', mw3: '7L1wKfaEdN85IA0Z', ablaze: 'MHnAqxEXBhUbnjPq',
}
const mgc = { key: 'system.properties', mode: 2, value: 'mgc' }
const rename = value => ({ key: 'name', mode: 5, value })
const bonus = value => ({ key: 'system.magicalBonus', mode: 5, value: String(value) })
const enchantment = (_id, name, changes = [], extra = {}) => ({ _id, name, type: 'enchantment', changes, transfer: false, flags: {}, ...extra })
const weapon = (id, name, sort, category, properties = [], { system = {}, activities = [], effects = [] } = {}) => ({
  id, name, sort, type: 'weapon',
  system: { type: { value: category }, properties, quantity: 1, attackType: 'melee', equipped: true, ...system },
  activities: [{ id: `${id}Swing`, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['bludgeoning'] }] }, ...activities],
  effects,
})
const ari = new Actor5e({ id: 'ari', name: 'Ari', owners: ['carol'], mods: { str: 1, wis: 3, int: 3 }, hp: { value: 30, max: 30, temp: 0 } })
carol.character = ari
ari.system.attributes.spellcasting = 'wis'
ari.system.attributes.spell = { dc: 13, attack: 5, mod: 3 }
ari.spellcastingClasses = { druid: { name: 'Druid', spellcasting: { ability: 'wis', save: 13, attack: 5 } } }
equip(ari, {
  spells: {
    spell1: { value: 4, max: 4, level: 1 }, spell2: { value: 3, max: 3, level: 2 }, spell3: { value: 2, max: 2, level: 3 },
    spell4: { value: 1, max: 1, level: 4 },
    ...Object.fromEntries([5, 6, 7, 8, 9].map(level => [`spell${level}`, { value: 0, max: 0, level }])),
  },
  items: [
    weapon('longsword', 'Longsword', 1, 'martialM'),
    weapon('club', 'Club', 2, 'simpleM'),
    weapon('quarterstaff', 'Quarterstaff', 3, 'simpleM'),
    // equipment24 Flame Tongue: its template's enchantment, made once, and Engulf in Flames on
    // itself, a switch.
    weapon('flametongue', 'Flame Tongue Longsword', 5, 'martialM', ['mgc'], {
      system: { attunement: 'required', attuned: true },
      activities: [
        { id: 'ftTemplate', type: 'enchant', name: 'Flame Tongue', activation: { type: '', value: null }, restrictionType: '', profiles: [{ _id: 'VtBOwsAVipxkP2f5' }] },
        { id: 'engulf', type: 'enchant', name: 'Engulf in Flames', activation: { type: 'bonus', value: 1 }, self: true, range: 'self',
          restrictionType: 'weapon', allowMagical: true, categories: ['simpleM', 'martialM'], profiles: [{ _id: P.ablaze }] },
      ],
      effects: [
        enchantment('VtBOwsAVipxkP2f5', 'Flame Tongue', [rename('Flame Tongue {}'), mgc]),
        enchantment(P.ablaze, 'Ablaze', [rename('{} (Ablaze)')]),
      ],
    }),
    // spells24 Shillelagh: a cantrip whose profile is by character level, on a simple melee weapon,
    // a minute.
    { id: 'shillelagh', name: 'Shillelagh', sort: 21, type: 'spell', system: { level: 0, method: 'spell', prepared: 1, canPrepare: true, properties: [] },
      activities: [{ id: 'imbue', type: 'enchant', name: 'Imbue Weapon', activation: { type: 'bonus', value: 1 }, range: 'self',
        restrictionType: 'weapon', allowMagical: true, categories: ['simpleM'],
        profiles: [{ _id: P.sh1, level: { max: 4 } }, { _id: P.sh2, level: { min: 5, max: 10 } }, { _id: P.sh3, level: { min: 11, max: 16 } }, { _id: P.sh4, level: { min: 17 } }] }],
      effects: [[P.sh1, '1d8'], [P.sh2, '1d10'], [P.sh3, '1d12'], [P.sh4, '2d6']].map(([_id, die]) =>
        enchantment(_id, `Shillelagh (${die})`, [rename('{} Shillelagh')], { duration: { seconds: 60 } })) },
    // The 2014 Magic Weapon: concentration, +1 to 3rd level, +2 at 4th and 5th, +3 from 6th, on a
    // weapon that isn't magical.
    { id: 'mweapon', name: 'Magic Weapon', sort: 22, type: 'spell', system: { level: 2, method: 'spell', prepared: 1, canPrepare: true, properties: ['concentration'] },
      activities: [{
        id: 'mw', type: 'enchant', name: 'Enchant Weapon', activation: { type: 'bonus', value: 1 }, range: 'touch', concentration: true,
        restrictionType: 'weapon', allowMagical: false,
        profiles: [{ _id: P.mw1, level: { max: 3 } }, { _id: P.mw2, level: { min: 4, max: 5 } }, { _id: P.mw3, level: { min: 6 } }],
      }],
      effects: [[P.mw1, 1], [P.mw2, 2], [P.mw3, 3]].map(([_id, plus]) => enchantment(_id, `Magic Weapon, +${plus}`, [rename(`{}, +${plus}`), mgc, bonus(plus)])) },
    // Eldritch Spear: a choice made once, with no activation, left to Foundry.
    { id: 'spear', name: 'Eldritch Spear', sort: 33, type: 'feat', system: { properties: [] },
      activities: [{ id: 'spearEnchant', type: 'enchant', name: 'Eldritch Spear', activation: { type: '', value: null }, restrictionType: 'spell', profiles: [{ _id: 'spearprofile0001' }] }],
      effects: [enchantment('spearprofile0001', 'Eldritch Spear', [])] },
  ],
})
character(rook, { level: 3, classes: { rogue: { levels: 3 } } })
character(zanna, { level: 15, classes: { wizard: { levels: 15 } } })
character(gorm, { level: 4, classes: { fighter: { levels: 4 } } })
character(ari, { level: 5, classes: { druid: { levels: 3 }, wizard: { levels: 2 } } })

// The tokens on the Gamemaster's canvas, and the fight: the four, and a goblin.
const place = actor => {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  placeables.set(token.id, placeable)
  return token
}
const goblin = new Actor5e({ id: 'goblin', name: 'Goblin', mods: { dex: 2 }, hp: { value: 40, max: 40, temp: 0 } })
goblin.type = 'npc'
goblin.documentName = 'Actor'
actors.set('goblin', goblin)
equip(goblin, { ac: 13 })
const tokens = Object.fromEntries([rook, zanna, gorm, ari, goblin].map(actor => [actor.id, place(actor)]))
if (MIDI) canvas.scene.tokens.size = placeables.size

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['rook', 'zanna', 'gorm', 'ari'], rolls: true, attacks: true }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const stored = column => sql(`select array_to_string("${column}", ',') from campaign where title = 'Ashlands'`)
await until(() => stored('rollFeatures').split(',').includes('activityChecks') && stored('rollKinds').split(',').includes('endEnchantment'),
  'the app to hear the game makes check activities and ends enchantments', 15_000)
check(['skill', 'tool', 'ability', 'use', 'damage', 'endEnchantment'].every(kind => stored('rollKinds').split(',').includes(kind)),
  `the app keeps that the game takes players' checks, spells and features, and ends their enchantments (${stored('rollKinds')})`)
check(stored('rollFeatures').split(',').includes('activityChecks'), `and that it rolls a check activity's checks against its DC (${stored('rollFeatures')})`)

// The fight, which the app hears of.
const fight = combat('fight')
combatant(fight, 'cbGob', goblin, { name: 'Goblin', initiative: 18, token: tokens.goblin })
combatant(fight, 'cbRook', rook, { initiative: 16, token: tokens.rook })
combatant(fight, 'cbZanna', zanna, { initiative: 12, token: tokens.zanna })
combatant(fight, 'cbGorm', gorm, { initiative: 9, token: tokens.gorm })
combatant(fight, 'cbAri', ari, { initiative: 7, token: tokens.ari })
fight.getCombatantsByActor = actor => fight.combatants.filter(cb => cb.actor?.id === actor.id)
fight.started = true
fight.round = 1
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// The one player plays them all, each on a phone of their own.
for (const actor of [rook, zanna, gorm, ari]) {
  sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
    select 'sheet-${actor.id}', '${actor.name}', '${GAME}', 'Ashlands', id, '${actor.id}', 'e2e-user', now() from campaign where title = 'Ashlands'`)
}

const requestRow = where => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, "useId", result from roll_request ${where} order by "createdAt" desc limit 1) r`) || 'null')
const requests = () => Number(sql('select count(*) from roll_request'))
const settled = request => ['done', 'failed'].includes(request?.status)
const useCard = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.use === id)
const madeFor = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const commandFor = id => fetched().find(command => command.id === id)
const faces = roll => roll.dice.map(die => die.results.map(r => r.result))
const usesLeft = (actor, id) => {
  const { uses } = actor.items.get(id).system
  return Math.max((Number(uses.max) || 0) - (Number(uses.spent) || 0), 0)
}
const slots = actor => Object.fromEntries(Object.entries(actor.system.spells).filter(([, pool]) => pool.max).map(([key, pool]) => [key, pool.value]))
const concentratingOn = actor => actor.concentration.effects.contents.map(effect => effect.flags.dnd5e.item.data)
const workflowOf = id => midi.made.find(w => w.workflowOptions.sendingStone === id)

/**
 * Open a character's sheet on a phone of the size given: the phone opens on it, in a fight too,
 * and a tap on Character keeps it there. Its tabs, its panel and its tray; and what it rolls with,
 * and sends, as the phone does.
 */
async function openSheet(actor, { width = 390, height = 844 } = {}) {
  const phone = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  await phone.addCookies([cookie])
  await phone.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await phone.newPage()
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
  page.on('response', async response => {
    if (response.request().method() === 'POST' && response.url().endsWith('/rolls') && response.status() !== 202) {
      console.log('refused:', response.status(), await response.text().catch(() => ''), response.request().postData())
    }
  })
  await page.goto(`${BASE}/characters/sheet-${actor.id}`)
  const nav = page.getByRole('navigation', { name: 'Table' })
  await nav.getByRole('button', { name: /^Character/ }).click()
  const sheetPane = page.getByRole('region', { name: 'Character' })
  const tabs = sheetPane.getByRole('tablist', { name: 'Character sheet' })
  await tabs.waitFor({ timeout: 15_000 })
  const tray = page.getByRole('region', { name: 'Your rolls' })
  const panel = sheetPane.getByRole('tabpanel')
  /** Show a tab of the sheet. */
  const show = name => tabs.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
  /** The d20 the app throws next, or Math.random again. */
  const forceD20 = value => page.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, value)
  const unforce = () => page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
  /** What the app answers a request the phone never offered, sent as the phone sends one: its status and why. */
  const forge = body => page.evaluate(async ({ body, id }) => {
    const response = await fetch(`/api/characters/sheet-${id}/rolls`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { status: response.status, ...(await response.json().catch(() => ({}))) }
  }, { body, id: actor.id })
  return { actor, page, nav, tabs, panel, show, tray, status: tray.getByRole('status'), forceD20, unforce, forge }
}

/**
 * Wait for room under the app's limit of 20 requests a minute from a character, which a script
 * tapping faster than any player would reach, keeping two for damage that follows on its own.
 */
const lastMinute = actor => Number(sql(`select count(*) from roll_request where "actorId" = '${actor.id}' and "createdAt" > now() - interval '1 minute'`))
const paced = actor => until(() => lastMinute(actor) < 17, 'room under the rate limit', 70_000)

/** Send what a tap rolls, uses or ends, and wait until the game has made it, or refused it. */
async function sent(phone, tap, what) {
  await paced(phone.actor)
  const before = requests()
  await tap()
  try {
    await until(() => requests() > before, `${what} to be sent`)
  } catch (error) {
    console.log('tray:', await phone.status.textContent().catch(() => '?'))
    throw error
  }
  const request = requestRow(`where "actorId" = '${phone.actor.id}'`)
  await until(() => settled(requestRow(`where id = '${request.id}'`)), `${what} to be made`)
  return { request, made: requestRow(`where id = '${request.id}'`), message: madeFor(request.id) }
}

/** Send a request the phone never offered, and wait until the game has made it or refused it. */
async function forged(phone, body, what) {
  await paced(phone.actor)
  const answer = await phone.forge(body)
  if (answer.status !== 202) return { answer }
  const request = requestRow(`where "actorId" = '${phone.actor.id}'`)
  await until(() => settled(requestRow(`where id = '${request.id}'`)), `${what} to be made`)
  return { answer, request, made: requestRow(`where id = '${request.id}'`) }
}

/** The damage or healing the app sends of a use by itself, once the game has made it, made too. */
async function followed(useId, what) {
  await until(() => settled(requestRow(`where "useId" = '${useId}'`)), `${what} to follow, sent and made`, 30_000)
  return requestRow(`where "useId" = '${useId}'`)
}

/** A menu's items: each one's name, and what it says under it, or why it can't be chosen. */
const menuItems = menu => menu.getByRole('menuitem').evaluateAll(all => all.map(item => {
  const note = item.getAttribute('aria-describedby')
  return { name: item.getAttribute('aria-label') ?? item.textContent.trim(), note: note ? document.getElementById(note)?.textContent ?? null : null, disabled: item.disabled }
}))
/** Does the page fit its width, with nothing to scroll sideways? And a box within it? */
const fits = (page, box) => page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  .then(([scroll, width]) => (scroll <= width) && (!box || (box.x >= 0 && box.x + box.width <= width + 0.5)))
/** The row of an item's activity beneath it, by the chip it has. */
const rowOf = chip => chip.locator('xpath=ancestor::li[1]')
/** A picker's levels: each one's name, whether it's chosen, and whether it may be. */
const levelsOf = picker => picker.getByRole('radio').evaluateAll(all => all.map(radio => [radio.getAttribute('aria-label') ?? radio.textContent.trim(), radio.getAttribute('aria-checked'), radio.disabled]))
/** Open an item's row, to show the activities folded beneath it, unless it's open already. */
const unfold = async (panel, name) => {
  const row = panel.locator('button[aria-expanded]').filter({ hasText: name }).first()
  if (await row.getAttribute('aria-expanded') !== 'true') await row.click()
}
/** The sheets the module has sent, once it has sent none for a second and a half. */
const quiet = async () => {
  let count
  do {
    count = posted.filter(p => p.type === 'character.updated').length
    await wait(1500)
  } while (posted.filter(p => p.type === 'character.updated').length !== count)
}
/** Wait until a tray says this, and say what it says. */
const trayShows = async (phone, text) => {
  await phone.status.getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 })
  return phone.status.textContent()
}

// ==== Rook: check activities ====
const rookP = await openSheet(rook)
await rookP.show('Actions')
// Fast Hands' Sleight of Hand: its chip's menu, to ask the table or roll his own.
const handsChip = rookP.panel.getByRole('button', { name: 'Fast Hands, Dexterity (Sleight of Hand) check' })
await handsChip.waitFor({ timeout: 15_000 })
check(/Sleight of Hand/.test(await handsChip.textContent()) && !/DC/.test(await handsChip.textContent()),
  `Fast Hands' row has a chip for its Sleight of Hand check, which has no DC: "${await handsChip.textContent()}"`)
await shoot(rookP.page, 'fast-hands-row-390')
await handsChip.click()
let menu = rookP.page.getByRole('menu')
await menu.waitFor()
let items = await menuItems(menu)
check(same(items.map(item => item.name), ['Ask the table', 'Roll my Sleight of Hand check (+5)', 'Roll with advantage', 'Roll with disadvantage', 'Modify roll…'])
  && items[0].note === 'Uses Fast Hands' && items[1].note === 'Spends nothing',
  `its menu asks the table, which uses Fast Hands, or rolls Rook's own, which spends nothing: ${JSON.stringify(items)}`)
await shoot(rookP.page, 'fast-hands-menu-390')
const messagesBefore = messages.size
await rookP.forceD20(12)
let { request, made, message } = await sent(rookP, () => menu.getByRole('menuitem', { name: 'Roll my Sleight of Hand check (+5)' }).click(), 'his Sleight of Hand check')
await rookP.unforce()
check(request.kind === 'skill' && request.payload.key === 'slt' && request.payload.item === 'hands' && request.payload.activity === 'sltCheck'
  && !('dc' in request.payload) && same(request.payload.dice, [{ faces: 20, results: [12] }]),
  `the phone sends his Sleight of Hand for Fast Hands' check, with his d20 and no DC: ${JSON.stringify(request.payload)}`)
check(made.status === 'done' && made.result.rolls[0].total === 17 && made.result.outcome === null && same(faces(message.rolls[0]), [[12]])
  && message.rolls[0].options.target === undefined && message.flags.dnd5e.roll.type === 'skill' && messages.size === messagesBefore + 1,
  `the game rolls it with his 12, +5, for 17, against no DC, posting the roll alone, no card (${JSON.stringify(made.result.outcome)})`)
let tray = await trayShows(rookP, 'At the table: 17')
check(!/·/.test(tray.split('At the table')[1]), `the tray shows the game's 17, with no verdict: "${tray}"`)

// His Thieves' Tools, +1, against the lock's DC 15, from Inventory.
await rookP.show('Inventory')
const toolsChip = rookP.panel.getByRole('button', { name: "Thieves' Tools, DC 15 Dexterity (Thieves' Tools) check" })
await toolsChip.waitFor({ timeout: 15_000 })
check(/Thieves' Tools.*DC 15/.test(await toolsChip.textContent()) && await toolsChip.locator('svg.lucide-hammer').count() === 1,
  `the tools' chip names its check and DC, with a hammer for a tool's: "${await toolsChip.textContent()}"`)
await toolsChip.click()
menu = rookP.page.getByRole('menu')
await menu.waitFor()
items = await menuItems(menu)
check(items[1]?.name === "Roll my Thieves' Tools check (+6)" && items[0].note === "Uses Thieves' Tools",
  `its menu rolls his Thieves' Tools, +5 and the set's +1: ${JSON.stringify(items)}`)
await shoot(rookP.page, 'tools-menu-390')
await rookP.forceD20(9)
;({ request, made, message } = await sent(rookP, () => menu.getByRole('menuitem', { name: "Roll my Thieves' Tools check (+6)" }).click(), 'the lock picked'))
await rookP.unforce()
check(request.kind === 'tool' && request.payload.key === 'thief' && request.payload.item === 'tools' && request.payload.activity === 'pick' && !('dc' in request.payload)
  && made.status === 'done' && made.result.rolls[0].total === 15 && made.result.outcome === 'success' && message.rolls[0].options.target === 15,
  `9 + 5 + the set's 1 = 15 against the activity's DC 15, which the game reads itself: ${made.result.outcome}`)
tray = await trayShows(rookP, 'At the table: 15 · Passed')
check(true, `the tray says he passed: "${tray}"`)
await toolsChip.click()
menu = rookP.page.getByRole('menu')
await rookP.forceD20(8)
;({ request, made, message } = await sent(rookP, () => menu.getByRole('menuitem', { name: "Roll my Thieves' Tools check (+6)" }).click(), 'the lock tried again'))
await rookP.unforce()
check(made.result.rolls[0].total === 14 && made.result.outcome === 'failure', `8 gives 14, a failure (${made.result.outcome})`)
tray = await trayShows(rookP, 'At the table: 14 · Failed')
check(true, `the tray says he failed: "${tray}"`)

// Fast Hands, asking the table: dnd5e's card, its one button, nothing spent.
await rookP.show('Actions')
const checkedBefore = midi.rolledChecks.length
await handsChip.click()
menu = rookP.page.getByRole('menu')
;({ request, made } = await sent(rookP, () => menu.getByRole('menuitem', { name: 'Ask the table' }).click(), 'the table asked'))
let card = useCard(request.id)
let buttons = [...new DOMParser().parseFromString(card?.content ?? '', 'text/html').querySelectorAll('button[data-action="rollCheck"]')].map(b => ({ ...b.dataset }))
check(request.kind === 'use' && request.payload.item === 'hands' && request.payload.activity === 'sltCheck' && same(request.payload.targets, [])
  && made.status === 'done' && same(made.result.use, { type: 'check' }) && same(buttons, [{ ability: 'dex', action: 'rollCheck', visibility: 'all', skill: 'slt' }]),
  `Fast Hands is used in the game: dnd5e's card, a button for his Sleight of Hand, no DC (${JSON.stringify(buttons)})`)
if (MIDI) check(midi.rolledChecks.length === checkedBefore && workflowOf(request.id), 'through Midi-QOL, at no one, no check is rolled')
await rookP.nav.getByRole('button', { name: 'Chat' }).click()
const handsCard = rookP.page.getByRole('list', { name: 'Chat log' }).getByRole('listitem').filter({ hasText: 'Fast Hands' }).last()
await handsCard.waitFor({ timeout: 15_000 })
check(/Sleight of Hand/.test(await handsCard.textContent()), `the app's chat shows the card: "${(await handsCard.textContent()).slice(0, 120)}"`)
await shoot(rookP.page, 'fast-hands-card-390')
await rookP.nav.getByRole('button', { name: /^Character/ }).click()

// A feature led by a forward: used through it, a use of the feature spent, the card its target's,
// the forward its cause.
await rookP.show('Features')
const knackChip = rookP.panel.getByRole('button', { name: 'Use Steady Knack' })
await knackChip.waitFor({ timeout: 15_000 })
const knackRow = rookP.panel.locator('button[aria-expanded]').filter({ hasText: 'Steady Knack' })
check(/1 use/.test(await knackRow.textContent()), `Steady Knack, led by its forward, says what using it spends: "${await knackRow.textContent()}"`)
;({ request, made } = await sent(rookP, () => knackChip.click(), 'the knack used'))
card = useCard(request.id)
check(request.payload.item === 'knack' && request.payload.activity === 'knackFwd' && made.status === 'done' && same(made.result.use, { type: 'utility' })
  && usesLeft(rook, 'knack') === 1 && card?.flags.dnd5e.activity.id === 'knackUse' && card.system.cause === '.Item.knack.Activity.knackFwd'
  && await rookP.page.getByRole('dialog').count() === 0,
  `a tap uses it through its forward, on Rook, nothing to choose: one of its two uses spent, Steady Hands' card, the forward its cause (${JSON.stringify(request.payload)})`)
await until(async () => /1\/2/.test(await rookP.panel.getByRole('listitem').filter({ hasText: 'Steady Knack' }).first().textContent()), 'the knack to show a use left')
check(true, 'the sheet the game sends again shows it 1/2')
// Manacles: Bind the goblin, asking the table, for their one use; then roll to bind it.
await rookP.show('Actions')
const bindChip = rookP.panel.getByRole('button', { name: 'Manacles, DC 13 Dexterity (Sleight of Hand) check' })
await bindChip.click()
menu = rookP.page.getByRole('menu')
items = await menuItems(menu)
check(items[0].name === 'Ask the table' && items[0].note === 'Uses Manacles' && items[1].name === 'Roll my Sleight of Hand check (+5)',
  `the manacles' menu: ${JSON.stringify(items.slice(0, 2))}`)
await menu.getByRole('menuitem', { name: 'Ask the table' }).click()
let picker = rookP.page.getByRole('dialog', { name: /^Manacles/ })
await picker.waitFor()
await shoot(rookP.page, 'manacles-picker-390')
const bindChecks = midi.rolledChecks.length
;({ request, made } = await sent(rookP, () => picker.getByRole('button', { name: /^Goblin/ }).click(), 'the goblin bound'))
card = useCard(request.id)
buttons = [...new DOMParser().parseFromString(card?.content ?? '', 'text/html').querySelectorAll('button[data-action="rollCheck"]')].map(b => ({ ...b.dataset }))
check(request.payload.activity === 'bind' && same(request.payload.targets, [{ combatId: 'fight', combatantId: 'cbGob' }]) && made.status === 'done'
  && usesLeft(rook, 'manacles') === 0 && same(buttons.map(b => [b.skill, b.dc]), [['slt', '13']]),
  `Bind at the goblin spends the manacles' use, its card's button a DC 13 Sleight of Hand (${JSON.stringify(buttons)})`)
if (MIDI) {
  await until(() => midi.rolledChecks.length > bindChecks, "the goblin's check")
  check(same(midi.rolledChecks.slice(bindChecks).map(r => [r.target, r.rollType, r.keys, r.dc]), [['tok-goblin', 'skill', ['slt'], 13]]),
    "through Midi-QOL, the goblin's check is Midi's, a Sleight of Hand, as Midi rolls one")
}
await until(async () => /0\/1/.test(await rookP.panel.getByRole('listitem').filter({ hasText: 'Manacles' }).first().textContent()), 'the manacles to show none left')
check(true, 'the sheet the game sends again shows the manacles 0/1')
await bindChip.click()
menu = rookP.page.getByRole('menu')
await rookP.forceD20(8)
;({ request, made, message } = await sent(rookP, () => menu.getByRole('menuitem', { name: 'Roll my Sleight of Hand check (+5)' }).click(), 'the bind rolled'))
await rookP.unforce()
check(request.kind === 'skill' && request.payload.activity === 'bind' && made.result.rolls[0].total === 13 && made.result.outcome === 'success'
  && message.rolls[0].options.target === 13 && usesLeft(rook, 'manacles') === 0,
  `his own roll to bind it: 8 + 5 = 13 against DC 13, a success, spending nothing more (${made.result.outcome})`)
tray = await trayShows(rookP, 'At the table: 13 · Passed')
check(true, `the tray: "${tray}"`)
// The same use sent again, as from a sheet out of date: the app passes it on, as it doesn't count
// uses; the game refuses it, nothing left to use, spending nothing.
let forgery = await forged(rookP, { kind: 'use', item: 'manacles', activity: 'bind', targets: [{ combatId: 'fight', combatantId: 'cbGob' }], mode: 0, explicit: false, extras: [], dice: [] }, 'Bind again')
check(forgery.made?.status === 'failed' && forgery.made.result.reason === 'consume' && !useCard(forgery.request.id) && usesLeft(rook, 'manacles') === 0,
  `Bind sent again, as from a sheet out of date, is refused by the game, nothing left to use (${JSON.stringify(forgery.made?.result?.reason ?? forgery.answer)})`)

// The tools' check asked of the table: its card's button checks its own tool; or, through
// Midi-QOL, which would have Rook check against himself with Foundry's dice, refused.
await rookP.show('Inventory')
await toolsChip.click()
menu = rookP.page.getByRole('menu')
;({ request, made } = await sent(rookP, () => menu.getByRole('menuitem', { name: 'Ask the table' }).click(), 'the tools used'))
if (MIDI) {
  check(made.status === 'failed' && made.result.reason === 'activity' && !useCard(request.id), `through Midi-QOL, the tools' check isn't used (${made.result.reason})`)
  tray = await trayShows(rookP, 'it can’t be used from Sending Stone')
  check(true, `the tray says why: "${tray}"`)
} else {
  buttons = [...new DOMParser().parseFromString(useCard(request.id)?.content ?? '', 'text/html').querySelectorAll('button[data-action="rollCheck"]')].map(b => ({ ...b.dataset }))
  check(made.status === 'done' && same(buttons, [{ ability: 'dex', action: 'rollCheck', visibility: 'all', dc: '15', tool: 'thief' }]),
    `the tools used: dnd5e's card, its button his Thieves' Tools against DC 15 (${JSON.stringify(buttons)})`)
}

// A roll the phone never offered: a check the activity doesn't ask for, and a DC of the player's own,
// which the app refuses, as it does a spell's check, below.
for (const [body, reason, why] of [
  [{ kind: 'skill', key: 'acr', item: 'hands', activity: 'sltCheck' }, 'unknown', "an Acrobatics check Fast Hands doesn't ask for"],
  [{ kind: 'skill', key: 'slt', item: 'hands', activity: 'sltCheck', dc: 5 }, 'invalid', 'a DC of his own'],
]) {
  forgery = await forged(rookP, { mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [10] }], ...body }, why)
  check((reason === 'invalid' ? forgery.answer.status === 400 : (forgery.answer.status === 422 && forgery.answer.reason === reason)) && !forgery.made,
    `the app refuses ${why} (${JSON.stringify(forgery.answer)})`)
}

// ==== Zanna: a spell's checks, and free castings ====
const zannaP = await openSheet(zanna)
// Maze: the goblin's Investigation check, DC 20, which Zanna doesn't roll: a tap casts it.
await zannaP.show('Spells')
const mazeChip = zannaP.panel.getByRole('button', { name: 'Maze, DC 20 Intelligence (Investigation) check' })
await mazeChip.waitFor({ timeout: 15_000 })
check(/Investigation\s*DC 20/.test(await mazeChip.textContent()), `Maze's chip: the goblin's Investigation, DC 20: "${await mazeChip.textContent()}"`)
await shoot(zannaP.page, 'maze-390')
await mazeChip.click()
picker = zannaP.page.getByRole('dialog', { name: /^Maze/ })
await picker.waitFor()
let levels = await levelsOf(picker)
check(await zannaP.page.getByRole('menu').count() === 0 && /^MazeChoose who to cast it at/.test(await picker.textContent()) && levels.length === 0,
  `a tap opens no menu of rolls of her own, but the picker, at whom to cast it, with her one 8th-level slot to cast it with: "${await picker.textContent()}"`)
const mazeChecks = midi.rolledChecks.length
;({ request, made } = await sent(zannaP, () => picker.getByRole('button', { name: /^Goblin/ }).click(), 'Maze'))
card = useCard(request.id)
buttons = [...new DOMParser().parseFromString(card?.content ?? '', 'text/html').querySelectorAll('button[data-action="rollCheck"]')].map(b => [b.dataset.skill, b.dataset.dc])
check(request.kind === 'use' && request.payload.item === 'maze' && request.payload.activity === 'banish' && request.payload.slot === null
  && same(request.payload.targets, [{ combatId: 'fight', combatantId: 'cbGob' }]) && made.status === 'done' && same(made.result.use, { type: 'check' })
  && slots(zanna).spell8 === 0 && same(buttons, [['inv', '20']]),
  `Maze is cast at the goblin with the one slot it may be, the game's own choice, its 8th-level slot spent, its card's button the goblin's DC 20 Investigation (${JSON.stringify(request.payload)})`)
if (MIDI) {
  await until(() => midi.rolledChecks.length > mazeChecks, "the goblin's check")
  check(same(midi.rolledChecks.slice(mazeChecks).map(r => [r.target, r.rollType, r.keys, r.dc]), [['tok-goblin', 'skill', ['inv'], 20]]),
    "through Midi-QOL, the goblin's Investigation is Midi's")
}
await until(() => same(concentratingOn(zanna), ['banish']), 'concentration on Maze')
await zannaP.show('Character')
const conditions = zannaP.panel.getByRole('list', { name: 'Conditions' })
await conditions.getByRole('button', { name: /Concentrating/ }).filter({ hasText: 'Maze' }).waitFor({ timeout: 15_000 })
check(true, `she concentrates on Maze, and her sheet says so: "${await conditions.textContent()}"`)

// Entangle, in its pack's order: its row casts it, the STR save; its Escape Plants check beneath
// it, used at the goblin, spends no slot and takes no concentration.
await zannaP.show('Spells')
const entangleChip = zannaP.panel.getByRole('button', { name: 'Entangle, STR saving throw DC 18' })
await entangleChip.click()
picker = zannaP.page.getByRole('dialog', { name: /^Entangle/ })
await picker.waitFor()
levels = await levelsOf(picker)
check(same(levels, [['1st Level, 0 slots left', 'false', true], ['2nd Level, 3 slots left', 'true', false], ['3rd Level, 2 slots left', 'false', false], ['8th Level, 0 slots left', 'false', true]]),
  `the row's chip casts Entangle, at 2nd level by default, with no 1st- or 8th-level slot left: ${JSON.stringify(levels)}`)
await shoot(zannaP.page, 'entangle-picker-390')
await zannaP.page.keyboard.press('Escape')
await picker.waitFor({ state: 'hidden' })
await unfold(zannaP.panel, 'Entangle')
const plantsChip = zannaP.panel.getByRole('button', { name: 'Entangle (Escape Plants Check), DC 18 Strength check' })
await plantsChip.waitFor({ timeout: 15_000 })
check(/Strength\s*DC 18/.test(await plantsChip.textContent()), `beneath it, Escape Plants' chip: the goblin's Strength, DC 18: "${await plantsChip.textContent()}"`)
await shoot(zannaP.page, 'entangle-390')
const before = { slots: slots(zanna), concentration: concentratingOn(zanna), checks: midi.rolledChecks.length }
await plantsChip.click()
picker = zannaP.page.getByRole('dialog', { name: /Entangle/ })
await picker.waitFor()
levels = await levelsOf(picker)
check(same(levels.map(([name]) => name), ['1st Level', '2nd Level', '3rd Level', '8th Level']) && levels[0][1] === 'true',
  `its picker offers every level to use it at, as dnd5e's dialog does, its slots not counted, the 1st first: ${JSON.stringify(levels)}`)
;({ request, made } = await sent(zannaP, () => picker.getByRole('button', { name: /^Goblin/ }).click(), 'Escape Plants'))
check(request.payload.activity === 'escapePlants' && request.payload.slot === 'spell1' && made.status === 'done' && same(made.result.use, { type: 'check' })
  && useCard(request.id)?.system?.spellLevel === 1 && same(slots(zanna), before.slots) && same(concentratingOn(zanna), before.concentration),
  `Escape Plants is used at the goblin at 1st level, though no 1st-level slot is left, spending no slot of any level, Zanna still concentrating on Maze alone (${JSON.stringify(request.payload)})`)
if (MIDI) {
  await until(() => midi.rolledChecks.length > before.checks, "the goblin's Strength check")
  check(same(midi.rolledChecks.slice(before.checks).map(r => [r.target, r.rollType, r.keys, r.dc]), [['tok-goblin', 'check', ['str'], 18]]),
    "through Midi-QOL, the goblin's Strength check is Midi's")
}

// Hellish Rebuke's free casting: its use, not a slot, the goblin's save, and its damage with
// Zanna's dice.
await unfold(zannaP.panel, 'Hellish Rebuke')
const rebukeChip = zannaP.panel.getByRole('button', { name: /^Hellish Rebuke \(Cast \(free casting\)\), DEX saving throw DC 18$/ })
await rebukeChip.waitFor({ timeout: 15_000 })
const rebukeRow = rowOf(rebukeChip)
check(/1 use/.test(await rebukeRow.textContent()) && await rebukeRow.locator('.opacity-60').count() === 0,
  `its free casting, beneath it, says it takes its one use: "${await rebukeRow.textContent()}"`)
const savesBefore = midi.rolledSaves.length
await rebukeChip.click()
picker = zannaP.page.getByRole('dialog', { name: /Hellish Rebuke/ })
await picker.waitFor()
check(await picker.getByRole('group', { name: 'Cast at' }).count() === 0, 'its picker offers no slot')
await shoot(zannaP.page, 'rebuke-free-picker-390')
;({ request, made } = await sent(zannaP, () => picker.getByRole('button', { name: /^Goblin/ }).click(), 'Hellish Rebuke, free'))
check(request.payload.item === 'rebuke' && request.payload.activity === 'rebukeFree' && made.status === 'done' && same(made.result.use, { type: 'save' })
  && slots(zanna).spell1 === 0 && usesLeft(zanna, 'rebuke') === 0 && useCard(request.id)?.system?.cause === '.Item.rebuke.Activity.rebukeFree',
  `cast at the goblin through its free casting: its use spent, no 1st-level slot, the spell's card naming the free casting its cause (${JSON.stringify(request.payload)})`)
let damage = await followed(request.id, 'its fire')
const fire = damage.payload.dice?.[0]?.results ?? []
check(damage.status === 'done' && damage.payload.dice[0].faces === 10 && fire.length === 2 && damage.result.rolls[0].total === fire[0] + fire[1],
  `its 2d10 fire follows with Zanna's dice, ${fire.join(' and ')}, and the game totals them: ${damage.result.rolls[0].total}`)
if (MIDI) {
  check(same(midi.rolledSaves.slice(savesBefore).filter(r => r.target === 'tok-goblin').map(r => [r.ability, r.dc]), [['dex', 18]]),
    "through Midi-QOL, the goblin's DEX save is Midi's")
}
await until(async () => /No uses left/.test(await rebukeRow.textContent()), 'the free casting to show its use spent')
check(await rebukeRow.locator('.opacity-60').count() === 1, `then it says so, faded: "${await rebukeRow.textContent()}"`)
// The same sent again, as from a sheet out of date: the game refuses it, its use spent, and casts
// nothing with a slot in its place.
forgery = await forged(zannaP, { kind: 'use', item: 'rebuke', activity: 'rebukeFree', targets: [{ combatId: 'fight', combatantId: 'cbGob' }], mode: 0, explicit: false, extras: [], dice: [] }, 'Hellish Rebuke again')
check(forgery.made?.status === 'failed' && forgery.made.result.reason === 'consume' && !useCard(forgery.request.id) && same(slots(zanna), before.slots),
  `sent again, the game refuses it, its use spent, no slot spent in its place (${JSON.stringify(forgery.made?.result?.reason ?? forgery.answer)})`)
// Escape Plants rolled as Zanna's own check, which the goblin makes, not she: the app refuses it.
forgery = await forged(zannaP, { kind: 'ability', key: 'str', item: 'entangle', activity: 'escapePlants', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [10] }] }, 'a spell\'s check rolled')
check(forgery.answer.status === 422 && forgery.answer.reason === 'unknown' && !forgery.made, `a spell's check rolled as her own is refused (${JSON.stringify(forgery.answer)})`)

// Bless: its seven free castings listed as one; used, at Rook.
await unfold(zannaP.panel, 'Bless')
const blessRow = zannaP.panel.locator('button[aria-expanded]').filter({ hasText: 'Bless' }).first().locator('xpath=ancestor::li[1]')
const freeRows = blessRow.getByRole('listitem').filter({ hasText: '(free casting)' })
const blessListed = lastSheet('zanna').spells.flatMap(section => section.spells).find(entry => entry.id === 'bless').activities.map(entry => entry.id)
check(await freeRows.count() === 1 && /1 use/.test(await freeRows.first().textContent()) && same(blessListed, ['dnd5eactivity000', '2QtNAQPwdzdUtbif']),
  `Bless lists one free casting, not Perrin's seven: "${await freeRows.first().textContent()}" (${JSON.stringify(blessListed)})`)
await shoot(zannaP.page, 'bless-390')
await freeRows.first().getByRole('button', { name: 'Cast Bless (Use (free casting))' }).click()
picker = zannaP.page.getByRole('dialog', { name: /Bless/ })
await picker.waitFor()
check(await picker.getByRole('group', { name: 'Cast at' }).count() === 0, 'its picker offers no slot, only whom to bless')
await picker.getByRole('checkbox', { name: /^Rook/ }).click()
;({ request, made } = await sent(zannaP, () => picker.getByRole('button', { name: 'Cast at 1 target' }).click(), 'Bless, free'))
check(request.payload.activity === '2QtNAQPwdzdUtbif' && made.status === 'done' && usesLeft(zanna, 'bless') === 0 && slots(zanna).spell1 === 0
  && useCard(request.id)?.flags.dnd5e.activity.id === 'dnd5eactivity000',
  `Bless cast at Rook through its free casting: its use spent, Bless's own card (${JSON.stringify(request.payload)})`)
await until(() => same(concentratingOn(zanna), ['dnd5eactivity000']), 'concentration on Bless, in place of Maze')
check(true, 'Zanna now concentrates on Bless, Maze ended, as dnd5e ends the one before')
await until(async () => /No uses left/.test(await freeRows.first().textContent()), 'the free casting to show its use spent')
check(await freeRows.first().locator('.opacity-60').count() === 1, 'then it shows no uses left, faded')
await zannaP.panel.getByRole('button', { name: 'Cast Bless', exact: true }).click()
picker = zannaP.page.getByRole('dialog', { name: /^Bless/ })
await picker.waitFor()
levels = await levelsOf(picker)
check(levels.some(([name, checked]) => /^2nd Level/.test(name) && checked === 'true'), `Bless itself is still cast with a slot, at 2nd: ${JSON.stringify(levels)}`)
await zannaP.page.keyboard.press('Escape')
await zannaP.show('Character')
await conditions.getByRole('button', { name: /Concentrating/ }).filter({ hasText: 'Bless' }).waitFor({ timeout: 15_000 })
check(true, `her sheet says she concentrates on Bless: "${await conditions.textContent()}"`)

// A long rest; then the free casting as the app before 0.21.0 sends it, with the 1st-level
// slot its picker chose, none of which is left: cast at 1st level, spending none.
await zanna.updateEmbeddedDocuments('Item', [{ _id: 'rebuke', 'system.uses.spent': 0 }])
await until(() => lastSheet('zanna') && JSON.stringify(lastSheet('zanna')).includes('"value":1,"max":1'), 'the sheet with the use back', 15_000)
forgery = await forged(zannaP, { kind: 'use', item: 'rebuke', activity: 'rebukeFree', slot: 'spell1', targets: [{ combatId: 'fight', combatantId: 'cbGob' }], mode: 0, explicit: false, extras: [], dice: [] }, 'an older app\'s free casting')
card = forgery.request && useCard(forgery.request.id)
check(forgery.made?.status === 'done' && slots(zanna).spell1 === 0 && usesLeft(zanna, 'rebuke') === 0 && card?.system?.scaling === undefined,
  `an older app's free casting, with a 1st-level slot none of which is left, is cast at 1st level, spending no slot (${JSON.stringify(forgery.made?.result?.status ?? forgery.answer)})`)

// Gorm's Misty Step, through its free casting, with no slot to cast it with.
const gormP = await openSheet(gorm)
await gormP.show('Spells')
await unfold(gormP.panel, 'Misty Step')
const mistyChip = gormP.panel.getByRole('button', { name: 'Cast Misty Step (Cast (free casting))' })
await mistyChip.waitFor({ timeout: 15_000 })
check(/1 use/.test(await rowOf(mistyChip).textContent()), `Gorm's Misty Step, with no slots, has its free casting: "${await rowOf(mistyChip).textContent()}"`)
;({ request, made } = await sent(gormP, () => mistyChip.click(), 'Misty Step, free'))
check(request.payload.activity === 'mistyFree' && request.payload.slot === null && made.status === 'done' && usesLeft(gorm, 'misty') === 0
  && await gormP.page.getByRole('dialog').count() === 0,
  `a tap casts it on him through its free casting, nothing to choose, its use spent (${JSON.stringify(request.payload)})`)

// ==== Ari: enchant activities ====
const ariP = await openSheet(ari)
const item = id => ari.items.get(id)
const enchantmentsOn = (id, origin) => item(id).effects.contents.filter(effect => effect.origin === origin)
const profileChips = picker => picker.getByRole('group', { name: 'Enchantment' }).getByRole('radio')
  .evaluateAll(all => all.map(chip => [chip.getAttribute('aria-label'), chip.getAttribute('aria-checked')]))
/** The items a picker offers to enchant, and whether it offers to leave it on the card. */
const itemChoices = async picker => {
  const names = await picker.getByRole('listitem').getByRole('button').allTextContents()
  return names.map(name => (name.startsWith('Leave it on the card') ? '(on the card)' : name))
}
/** An item's row in the Inventory tab, by the name the sheet gives it: its summary, which opens it. */
const inventoryRow = name => ariP.panel.locator('summary').filter({ hasText: new RegExp(`^${name.replace(/[+()]/g, '\\$&')}(Equipped|$)`) })

// Shillelagh on her club: the way it's cast at her level, and the weapons it may go on.
await ariP.show('Spells')
await ariP.panel.getByRole('button', { name: 'Cast Shillelagh' }).click()
picker = ariP.page.getByRole('dialog', { name: /^Shillelagh/ })
await picker.waitFor()
check(/^ShillelaghChoose what to enchant/.test(await picker.textContent()) && same(await profileChips(picker), [])
  && same(await itemChoices(picker), ['Club', 'Quarterstaff', '(on the card)']),
  `Shillelagh, one way at Ari's level, asks only what to enchant: her club or quarterstaff alone, or left on its card for another's: ${JSON.stringify(await itemChoices(picker))}`)
await shoot(ariP.page, 'shillelagh-picker-390')
;({ request, made } = await sent(ariP, () => picker.getByRole('button', { name: 'Club', exact: true }).click(), 'Shillelagh on the club'))
let command = commandFor(request.id)
check(command?.kind === 'use' && command.item === 'shillelagh' && command.activity === 'imbue' && same(command.targets, [])
  && same(command.enchant, { profile: P.sh2, item: 'club' }),
  `the module fetches Shillelagh, in its way at Ari's 5th level, a d10, on the club: ${JSON.stringify(command)}`)
check(made.status === 'done' && made.result.enchantment?.enchanted?.name === 'Shillelagh (1d10)' && item('club').name === 'Club Shillelagh'
  && enchantmentsOn('club', 'Actor.ari.Item.shillelagh.Activity.imbue').length === 1,
  `the game puts it on the club, as dnd5e applies it: "${item('club').name}"`)
tray = await trayShows(ariP, 'Shillelagh (1d10) on Club')
check(/Cast at the table · Shillelagh \(1d10\) on Club/.test(tray), `the tray says what it put on which item: "${tray}"`)
await ariP.show('Inventory')
await inventoryRow('Club Shillelagh').waitFor({ timeout: 15_000 })
check(await inventoryRow('Club Shillelagh').getByRole('img', { name: 'Enchanted' }).count() === 1, 'Inventory shows the club enchanted')
await inventoryRow('Club Shillelagh').click()
let enchantedList = ariP.panel.getByRole('list', { name: 'Enchantments' })
let listed = await enchantedList.getByRole('listitem').first().textContent()
check(/^Shillelagh \(1d10\) · 1 Minute · from Shillelagh/.test(listed), `its details say what's on it, for how long, from what: "${listed}"`)
await shoot(ariP.page, 'club-enchanted-390')
await inventoryRow('Club Shillelagh').click()

// Shillelagh again, left on its card, for an ally's weapon: no item named, the card posted with its
// tray for the Gamemaster, the club's untouched.
await ariP.show('Spells')
await ariP.panel.getByRole('button', { name: 'Cast Shillelagh' }).click()
picker = ariP.page.getByRole('dialog', { name: /^Shillelagh/ })
await picker.waitFor()
;({ request, made } = await sent(ariP, () => picker.getByRole('button', { name: /^Leave it on the card/ }).click(), 'Shillelagh left on its card'))
command = commandFor(request.id)
check(command?.kind === 'use' && same(command.enchant, { profile: P.sh2 }) && made.status === 'done' && !!useCard(request.id)
  && same(made.result.enchantment, { enchanted: null, ended: null }) && enchantmentsOn('club', 'Actor.ari.Item.shillelagh.Activity.imbue').length === 1,
  `left on the card, it's sent with its way and no item, and posted, nothing put on anything: ${JSON.stringify(command.enchant)}`)
await until(async () => await ariP.status.textContent() === 'ShillelaghCast at the table', 'the tray to say it was cast')
check(true, 'the tray says it was cast at the table, putting it on nothing')

// Magic Weapon at 4th on her longsword: its +2, and her concentration.
await ariP.show('Spells')
const castMw = ariP.panel.getByRole('button', { name: 'Cast Magic Weapon' })
await castMw.click()
picker = ariP.page.getByRole('dialog', { name: /^Magic Weapon/ })
await picker.waitFor()
const castAt = picker.getByRole('group', { name: 'Cast at' })
check(await castAt.getByRole('radio', { name: /^2nd Level/ }).getAttribute('aria-checked') === 'true' && same(await profileChips(picker), [['Magic Weapon, +1', 'true']]),
  'Magic Weapon is cast at 2nd by default, its +1 the way offered')
await castAt.getByRole('radio', { name: /^4th Level/ }).click()
const choices = await itemChoices(picker)
const heights = await picker.getByRole('listitem').getByRole('button').evaluateAll(all => all.map(button => Math.round(button.getBoundingClientRect().height)))
check(same(await profileChips(picker), [['Magic Weapon, +2', 'true']]) && same(choices, ['Longsword', 'Club Shillelagh', 'Quarterstaff', '(on the card)'])
  && heights.every(height => height >= 44) && await fits(ariP.page, await picker.boundingBox()),
  `at 4th, its +2 in its place, on any of her weapons that isn't magical, not the Flame Tongue, each a finger's height, the picker within the phone: ${JSON.stringify(choices)} ${JSON.stringify(heights)}`)
await shoot(ariP.page, 'magic-weapon-picker-390')
;({ request, made } = await sent(ariP, () => picker.getByRole('button', { name: 'Longsword', exact: true }).click(), 'Magic Weapon on the longsword'))
command = commandFor(request.id)
if (MIDI) await until(() => concentratingOn(ari).length === 1, 'Midi to begin concentrating')
const focus = ari.concentration.effects.contents[0]
const [plusTwo] = enchantmentsOn('longsword', 'Actor.ari.Item.mweapon.Activity.mw')
check(command?.slot === 'spell4' && same(command.enchant, { profile: P.mw2, item: 'longsword' }) && made.status === 'done'
  && item('longsword').name === 'Longsword, +2' && slots(ari).spell4 === 0 && same(concentratingOn(ari), ['mw'])
  && plusTwo?.getFlag('dnd5e', 'dependentOn') === focus.uuid && useCard(request.id)?.system?.concentration === focus.id,
  `at 4th on the longsword: its +2, the 4th-level slot spent, and Ari concentrating on it, the enchantment ending with her concentration${MIDI ? ', begun by Midi-QOL\'s workflow' : ''}`)
if (MIDI) check(!!workflowOf(request.id), "through Midi-QOL's workflow")
tray = await trayShows(ariP, 'Magic Weapon, +2 on Longsword')
check(true, `the tray says so: "${tray}"`)
await ariP.show('Character')
const ariConditions = ariP.panel.getByRole('list', { name: 'Conditions' })
await ariConditions.getByRole('button', { name: /Concentrating/ }).filter({ hasText: 'Magic Weapon' }).waitFor({ timeout: 15_000 })
check(true, `her sheet says she concentrates on Magic Weapon: "${await ariConditions.textContent()}"`)
await ariP.show('Inventory')
await inventoryRow('Longsword, +2').waitFor({ timeout: 15_000 })
check(await inventoryRow('Longsword, +2').getByRole('img', { name: 'Enchanted' }).count() === 1, 'Inventory shows the longsword enchanted, by the name its +2 gives it')
await inventoryRow('Longsword, +2').click()
enchantedList = ariP.panel.getByRole('list', { name: 'Enchantments' })
listed = await enchantedList.getByRole('listitem').first().textContent()
check(/^Magic Weapon, \+2 · Concentration · from Magic Weapon/.test(listed), `the longsword's details: "${listed}"`)
await shoot(ariP.page, 'longsword-enchanted-390')
await inventoryRow('Longsword, +2').click()

// Magic Weapon again, at 2nd on the quarterstaff: the concentration it ends takes the
// longsword's +2 with it, as in Foundry.
await ariP.show('Spells')
await castMw.click()
picker = ariP.page.getByRole('dialog', { name: /^Magic Weapon/ })
await picker.waitFor()
;({ request, made } = await sent(ariP, () => picker.getByRole('button', { name: 'Quarterstaff', exact: true }).click(), 'Magic Weapon on the quarterstaff'))
command = commandFor(request.id)
await until(() => item('longsword').name === 'Longsword' && concentratingOn(ari).length === 1 && ari.concentration.effects.contents[0].id !== focus.id,
  'the longsword\'s +2 to go with the concentration ended')
const [plusOne] = enchantmentsOn('quarterstaff', 'Actor.ari.Item.mweapon.Activity.mw')
check(command?.slot === 'spell2' && same(command.enchant, { profile: P.mw1, item: 'quarterstaff' }) && made.status === 'done'
  && item('quarterstaff').name === 'Quarterstaff, +1' && !item('longsword').effects.has(plusTwo.id) && slots(ari).spell2 === 2
  && plusOne?.getFlag('dnd5e', 'dependentOn') === ari.concentration.effects.contents[0].uuid,
  'at 2nd on the quarterstaff: its +1, tied to her new concentration; the one it ended took the longsword\'s +2 with it')
await ariP.show('Inventory')
await inventoryRow('Quarterstaff, +1').waitFor({ timeout: 15_000 })
await until(async () => await inventoryRow('Longsword, +2').count() === 0, 'the sheet to show the longsword as it was')
check(true, 'the sheet the game sends again shows the quarterstaff +1, and the longsword as it was')

// End it from the quarterstaff's details: the enchantment alone, her concentration going on.
await inventoryRow('Quarterstaff, +1').click()
enchantedList = ariP.panel.getByRole('list', { name: 'Enchantments' })
await enchantedList.getByRole('button', { name: 'End Magic Weapon, +1 on Quarterstaff, +1' }).click()
const confirm = ariP.page.getByRole('dialog', { name: 'End Magic Weapon, +1?' })
await confirm.waitFor()
check(/^On Quarterstaff, \+1\. Only the enchantment ends/.test(await confirm.getByText(/^On Quarterstaff/).textContent()), 'End asks first, saying on what')
await shoot(ariP.page, 'end-confirm-390')
;({ request, made } = await sent(ariP, () => confirm.getByRole('button', { name: 'End', exact: true }).click(), 'the +1 ended'))
command = commandFor(request.id)
check(command?.kind === 'endEnchantment' && same(command.enchantment, { item: 'quarterstaff', effect: plusOne.id }) && made.status === 'done'
  && item('quarterstaff').name === 'Quarterstaff' && concentratingOn(ari).length === 1,
  `the module fetches its end, and ends it, Ari still concentrating: ${JSON.stringify(command)}`)
await until(async () => await inventoryRow('Quarterstaff, +1').count() === 0, 'the sheet to show the quarterstaff as it was')
check(true, 'the sheet shows the quarterstaff as it was')

if (!MIDI) {
  // A module stops dnd5e's card: Magic Weapon is used, its slot spent, but not applied, with no
  // card to send the Gamemaster to.
  Hooks.once('dnd5e.preCreateUsageMessage', (activity, config) => { config.create = false })
  await ariP.show('Spells')
  await castMw.click()
  picker = ariP.page.getByRole('dialog', { name: /^Magic Weapon/ })
  await picker.waitFor()
  ;({ request, made } = await sent(ariP, () => picker.getByRole('button', { name: 'Quarterstaff', exact: true }).click(), 'Magic Weapon, its card stopped'))
  check(made.status === 'failed' && made.result.reason === 'enchant' && made.result.messageId === null && item('quarterstaff').name === 'Quarterstaff',
    `the game used it, but couldn't apply it (${JSON.stringify(made.result.reason)})`)
  tray = await trayShows(ariP, 'it was used, but the enchantment wasn’t applied')
  check(!/card/.test(tray), `the tray says so, sending the Gamemaster to no card: "${tray}"`)
}

// The Flame Tongue's switch, on the Actions tab: set alight, then put out.
await ariP.show('Actions')
const flames = ariP.panel.getByRole('switch', { name: /^Flame Tongue Longsword.*\(Engulf in Flames\)$/ })
await flames.waitFor({ timeout: 15_000 })
check(await flames.getAttribute('aria-checked') === 'false', 'the Flame Tongue is out')
;({ request, made } = await sent(ariP, () => flames.click(), 'the Flame Tongue set alight'))
command = commandFor(request.id)
check(command?.kind === 'use' && command.item === 'flametongue' && command.activity === 'engulf' && same(command.enchant, { profile: P.ablaze })
  && await ariP.page.getByRole('dialog').count() === 0 && made.status === 'done' && item('flametongue').name === 'Flame Tongue Longsword (Ablaze)',
  `a tap sets it alight in its one way, nothing asked, no item named: ${JSON.stringify(command)}`)
await until(async () => await flames.getAttribute('aria-checked') === 'true', 'the switch to be on')
check(true, 'the switch is on')
await shoot(ariP.page, 'flame-tongue-on-390')
// Lit, a use of it again, as from a sheet out of date, is refused: it's on it already.
forgery = await forged(ariP, { kind: 'use', item: 'flametongue', activity: 'engulf', targets: [], enchant: { profile: P.ablaze }, mode: 0, explicit: false, extras: [], dice: [] }, 'Engulf again')
check(forgery.answer.status === 422 && forgery.answer.reason === 'applied', `used again while alight, the app refuses it, on it already (${JSON.stringify(forgery.answer)})`)
;({ request, made } = await sent(ariP, () => flames.click(), 'the Flame Tongue put out'))
command = commandFor(request.id)
check(command?.kind === 'endEnchantment' && command.enchantment?.item === 'flametongue' && made.status === 'done'
  && await ariP.page.getByRole('dialog').count() === 0 && item('flametongue').name === 'Flame Tongue Longsword',
  `tapped again, it's put out, nothing asked: ${JSON.stringify(command)}`)
await until(async () => await flames.getAttribute('aria-checked') === 'false', 'the switch to be off')
check(true, 'the switch is off')
// Set alight in Foundry, the app not told: a tap from a sheet out of date reaches the game, which
// refuses it before anything is done, never putting it out. Once the sheet the module sends as the
// enchantment ends has gone, so that the app hears nothing more of it.
await quiet()
const callAll = Hooks.callAll
Hooks.callAll = (name, ...args) => (['createActiveEffect', 'updateItem'].includes(name) ? Promise.resolve(true) : callAll.call(Hooks, name, ...args))
try {
  await item('flametongue').system.activities.get('engulf').applyEnchantment(P.ablaze, item('flametongue'), { strict: false })
} finally {
  Hooks.callAll = callAll
}
check(item('flametongue').name === 'Flame Tongue Longsword (Ablaze)' && await flames.getAttribute('aria-checked') === 'false', 'alight in the game, the app none the wiser')
const sheetsBefore = posted.filter(p => p.type === 'character.updated').length
await wait(1000)
check(posted.filter(p => p.type === 'character.updated').length === sheetsBefore, 'and the module sends no sheet of it')
;({ request, made } = await sent(ariP, () => flames.click(), 'a tap from a sheet out of date'))
check(made.status === 'failed' && made.result?.reason === 'applied' && !useCard(request.id) && item('flametongue').name === 'Flame Tongue Longsword (Ablaze)',
  `the game refuses it, on it already, posting no card (${JSON.stringify(made.result?.reason)})`)
tray = await trayShows(ariP, 'that enchantment is on it already')
check(true, `the tray says so: "${tray}"`)
await Hooks.callAll('updateItem', item('flametongue'), {}, {}, 'gm')
await until(async () => await flames.getAttribute('aria-checked') === 'true', 'the switch to follow the sheet')
check(true, 'once the game sends the sheet again, the switch is on')

// What the phone never offers: Shillelagh on her longsword, Magic Weapon's +2 at 2nd, and an end
// of an enchantment that isn't there.
const [stick] = enchantmentsOn('club', 'Actor.ari.Item.shillelagh.Activity.imbue')
for (const [body, reason, why] of [
  [{ kind: 'use', item: 'shillelagh', activity: 'imbue', targets: [], enchant: { profile: P.sh2, item: 'longsword' } }, 'enchant-target', 'Shillelagh on a longsword'],
  [{ kind: 'use', item: 'mweapon', activity: 'mw', slot: 'spell2', targets: [], enchant: { profile: P.mw2, item: 'longsword' } }, 'profile', "Magic Weapon's +2 at 2nd"],
  [{ kind: 'endEnchantment', enchantment: { item: 'longsword', effect: stick.id } }, 'enchantment', 'the club\'s Shillelagh ended on the longsword'],
]) {
  forgery = await forged(ariP, { mode: 0, explicit: false, extras: [], dice: [], ...body }, why)
  check(forgery.answer.status === 422 && forgery.answer.reason === reason && !forgery.made, `the app refuses ${why}: ${forgery.answer.reason}`)
}
check(item('longsword').name === 'Longsword' && item('club').name === 'Club Shillelagh', 'nothing changed in the game')

// Eldritch Spear, a choice made once, is left to Foundry.
const spearEntry = lastSheet('ari').features.flatMap(section => section.features).find(entry => entry.id === 'spear')
await ariP.show('Features')
const spearRow = ariP.panel.getByRole('listitem').filter({ hasText: 'Eldritch Spear' }).first()
await spearRow.waitFor({ timeout: 15_000 })
check(spearEntry && !spearEntry.activity && await spearRow.getByRole('button', { name: /Eldritch Spear/ }).count() === 0,
  'Eldritch Spear, an enchantment chosen once, offers nothing to use: it\'s left to Foundry')

// ==== The narrowest phone, 360 wide ====
const narrowRook = await openSheet(rook, { width: 360, height: 780 })
await narrowRook.show('Actions')
const narrowHands = narrowRook.panel.getByRole('button', { name: 'Fast Hands, Dexterity (Sleight of Hand) check' })
await narrowHands.waitFor({ timeout: 15_000 })
check(await fits(narrowRook.page, await narrowHands.boundingBox()), '360: Fast Hands\' chip and its row fit')
await shoot(narrowRook.page, 'fast-hands-row-360')
await narrowHands.click()
menu = narrowRook.page.getByRole('menu')
await menu.waitFor()
check(await fits(narrowRook.page, await menu.boundingBox()), '360: its menu fits')
await shoot(narrowRook.page, 'fast-hands-menu-360')
await narrowRook.page.keyboard.press('Escape')
await narrowRook.show('Inventory')
await narrowRook.panel.getByRole('button', { name: "Thieves' Tools, DC 15 Dexterity (Thieves' Tools) check" }).click()
menu = narrowRook.page.getByRole('menu')
const longest = menu.getByRole('menuitem', { name: "Roll my Thieves' Tools check (+6)" })
await longest.waitFor()
const label = await longest.evaluate(item => {
  const text = item.querySelector('span span')
  return { whole: text.scrollWidth <= text.clientWidth + 0.5, right: item.getBoundingClientRect().right }
})
check(await fits(narrowRook.page, await menu.boundingBox()) && label.whole && (label.right <= 360.5),
  `360: the longest of its rows, "Roll my Thieves' Tools check (+6)", is whole, within the phone (${JSON.stringify(label)})`)
await shoot(narrowRook.page, 'tools-menu-360')
await narrowRook.page.keyboard.press('Escape')

const narrowZanna = await openSheet(zanna, { width: 360, height: 780 })
await narrowZanna.show('Spells')
await narrowZanna.panel.getByRole('button', { name: 'Maze, DC 20 Intelligence (Investigation) check' }).waitFor({ timeout: 15_000 })
await unfold(narrowZanna.panel, 'Entangle')
await unfold(narrowZanna.panel, 'Bless')
const narrowPlants = narrowZanna.panel.getByRole('button', { name: 'Entangle (Escape Plants Check), DC 18 Strength check' })
check(await fits(narrowZanna.page, await narrowPlants.boundingBox())
  && await fits(narrowZanna.page, await narrowZanna.panel.getByRole('button', { name: 'Maze, DC 20 Intelligence (Investigation) check' }).boundingBox()),
  '360: Maze\'s chip, and Entangle\'s Escape Plants beneath it, fit')
await narrowPlants.scrollIntoViewIfNeeded()
await shoot(narrowZanna.page, 'entangle-bless-360')

const narrowAri = await openSheet(ari, { width: 360, height: 780 })
await narrowAri.show('Spells')
await narrowAri.panel.getByRole('button', { name: 'Cast Magic Weapon' }).click()
picker = narrowAri.page.getByRole('dialog', { name: /^Magic Weapon/ })
await picker.waitFor()
check(await fits(narrowAri.page, await picker.boundingBox()), '360: Magic Weapon\'s picker fits')
await shoot(narrowAri.page, 'magic-weapon-picker-360')
await narrowAri.page.keyboard.press('Escape')
await narrowAri.show('Actions')
const narrowFlames = narrowAri.panel.getByRole('switch', { name: /^Flame Tongue Longsword.*\(Engulf in Flames\)$/ })
await narrowFlames.waitFor({ timeout: 15_000 })
check(await narrowFlames.getAttribute('aria-checked') === 'true' && await fits(narrowAri.page, await narrowFlames.boundingBox()),
  '360: the Flame Tongue\'s switch is on, and fits')
await shoot(narrowAri.page, 'flame-tongue-360')

// ==== A module before 0.21.0 ====
// Rook's sheet as one sends it: his check activities used in Foundry, nothing to tap.
before021 = true
await rook.updateEmbeddedDocuments('Item', [{ _id: 'tools', 'system.quantity': 2 }])
await rookP.show('Features')
const handsRow = rookP.panel.locator('button[aria-expanded]').filter({ hasText: 'Fast Hands' })
await until(async () => /Used in Foundry/.test(await handsRow.textContent()), 'Fast Hands to be used in Foundry')
check(await rookP.panel.getByRole('button', { name: /^Fast Hands, / }).count() === 0,
  `from a module before 0.21.0, Fast Hands' checks are used in Foundry, with no chip: "${await handsRow.textContent()}"`)
await shoot(rookP.page, 'before-0.21-390')
await rookP.show('Inventory')
await rookP.panel.getByText('Manacles').first().waitFor()
check(await rookP.panel.getByRole('button', { name: /^Thieves' Tools, / }).count() === 0 && await rookP.panel.getByRole('button', { name: /^Manacles, / }).count() === 0,
  "and his Thieves' Tools and Manacles offer nothing to roll or use")
before021 = false

// Nothing of it was asked of the Gamemaster.
check(screen.notifications.length === 0 && screen.templates === 0 && screen.subsequent.length === 0,
  `nothing was said, placed or opened on the Gamemaster's screen (${JSON.stringify(screen.notifications)})`)
console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
console.log(`${MIDI ? 'midi' : 'dnd5e'}: done in ${Math.round((Date.now() - started) / 1000)} s`)
await browser.close()
process.exit(0)
