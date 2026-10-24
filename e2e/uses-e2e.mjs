// Players' spells and features from the app, end to end: the real module, in a stand-in Foundry
// with dnd5e 5.3.3's real dice classes (D20Roll, DamageRoll) and its activities ported
// (fvtt/activity5e.mjs), fetches from the production app, from a browser on the game's page. Alice
// casts from Thorin's sheet on her phone: Fireball at 4th at two of the foes, its damage following
// with no tap; Cure Wounds on Vex; Bless on them both; Second Wind; Chromatic Orb, its kind of
// damage chosen in the tray; and a longsword swung two-handed. Then from her other tabs: Cure Wounds
// from the Spells tab, Witch Bolt, which she hasn't prepared, rolled on her phone alone, Second Wind
// from Features, and a javelin she carries, not equipped, from Inventory; then Fireball cast at its
// highest from its damage's menu, and a longsword's damage with a die more, made d12s, from the
// tray's. Then wands cast higher for more of their charges: Magic Missile at 2nd, a dart more, and
// Fireball at 5th, ten d6; a wand's every level on a narrower phone, those its charges don't reach
// greyed out; Hex, which the Gamemaster gives the flame, and its damage used from beneath it,
// spending no charge; and a wand's last charge, out of combat; the app showing what charges each
// has left as the game sends the sheet again. Last, his old-style resources, named Second Wind
// and Bardic Inspiration, among his favorites as those features, and used from there (#151).
// MIDI=1 puts the stand-in Midi-QOL workflow in the world (fvtt/midi-fake.mjs). Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
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
const TYPES = ['slashing', 'piercing', 'bludgeoning', 'acid', 'cold', 'fire', 'lightning', 'poison', 'force', 'radiant', 'necrotic']
const ELEMENTS = ['acid', 'cold', 'fire', 'lightning', 'poison']
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
  skills: { prc: { label: 'Perception', ability: 'wis' } },
  tools: {},
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex' },
  spellcasting: { spell: leveled, innate },
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

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, SaveActivity, DamageActivity, HealActivity, Collection, Item5e, equip, screen } = await import('./fvtt/activity5e.mjs')
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

users.activeGM = user('gm', 'Gamemaster', true)
users.get('gm').targets = new Set()
const alice = user('alice', 'Alice')
user('bob', 'Bob')
if (MIDI) installMidi()

// What dnd5e labels a part of damage or healing with, for the sheet.
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
const spell = (id, name, level, activity, { duration = { units: 'inst' }, flags, ...system } = {}) => ({
  id, name, type: 'spell', flags,
  system: { level, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration, ...system },
  activities: [activity],
})

// Thorin, a cleric who fights: Wisdom +3, Strength +3, and spell slots up to 4th level.
const thorin = new Actor5e({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, con: 3, wis: 3 }, hp: { value: 20, max: 44, temp: 0 } })
thorin.system.details = { level: 7 }
thorin.system.attributes.spellcasting = 'wis'
thorin.system.attributes.spell = { dc: 14, attack: 6, mod: 3 }
thorin.spellcastingClasses = { cleric: { name: 'Cleric', spellcasting: { ability: 'wis', save: 14, attack: 6 } } }
actors.set('thorin', thorin)
alice.character = thorin
equip(thorin, {
  ac: 18,
  spells: {
    spell1: { value: 4, max: 4, level: 1 }, spell2: { value: 3, max: 3, level: 2 },
    spell3: { value: 2, max: 3, level: 3 }, spell4: { value: 1, max: 1, level: 4 },
    // As dnd5e's actors have every level's, though he has no slots of them.
    ...Object.fromEntries([5, 6, 7, 8, 9].map(level => [`spell${level}`, { value: 0, max: 0, level }])),
  },
  items: [
    spell('fireball', 'Fireball', 3, {
      id: 'blast', type: 'save', template: 'sphere', affects: 'creature', save: ['dex'], dc: 15,
      damage: [{ number: 8, denomination: 6, types: ['fire'], scaling: 1 }], labels: { damage: [hits('8d6', 'fire')] },
    }),
    // Tidy 5e lists a healing spell among actions where its player adds it.
    spell('cure', 'Cure Wounds', 1, {
      id: 'mend', type: 'heal', affects: 'ally', count: 1,
      healing: { number: 2, denomination: 8, bonus: '@mod', types: ['healing'], scaling: 2 },
      labels: { damage: [hits('2d8 + 3', 'healing')] }, ability: 'wis',
    }, { flags: { 'tidy5e-sheet': { 'action-filter-override': true } } }),
    spell('bless', 'Bless', 1, {
      id: 'blessing', type: 'utility', affects: 'ally', count: '3 + @scaling', concentration: true, effects: ['Bless'],
    }, { duration: { units: 'minute', value: 1 }, properties: ['concentration'] }),
    spell('orb', 'Chromatic Orb', 1, {
      id: 'orbCast', ability: 'wis', damage: [{ number: 3, denomination: 8, types: ELEMENTS, scaling: 1 }],
      labels: { modifier: '+6', damage: [{ formula: '3d8', label: '3d8 Acid, Cold, Fire, Lightning or Poison' }] },
    }),
    {
      id: 'wind', name: 'Second Wind', type: 'feat', system: { properties: [], uses: { max: 2, spent: 0, recovery: [] } },
      activities: [{
        id: 'breather', type: 'heal', affects: 'self', range: 'self', activation: { type: 'bonus', value: 1 },
        consumption: [{ type: 'itemUses', value: 1 }],
        healing: { number: 1, denomination: 10, bonus: '5', types: ['healing'] }, labels: { damage: [hits('1d10 + 5', 'healing')] },
      }],
    },
    // A feature with a roll of its own, Thorin's Wisdom in it.
    {
      id: 'omen', name: 'Fey Omen', type: 'feat', system: { properties: [] },
      activities: [{ id: 'foresee', type: 'utility', affects: '', formula: '1d4 + @abilities.wis.mod', rollName: 'Omen' }],
    },
    // Spirit Guardians is cast, then its save is used each turn, spending no slot.
    {
      id: 'guardians', name: 'Spirit Guardians', type: 'spell',
      system: { level: 3, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'minute', value: 10 } },
      activities: [
        { id: 'guard', name: 'Cast', type: 'utility', affects: 'self', range: 'self' },
        {
          id: 'aura', name: 'Emanation Save', type: 'save', affects: 'creature', save: ['wis'], dc: 14, spellSlot: false,
          damage: [{ number: 3, denomination: 8, types: ['radiant'], scaling: 1 }], labels: { damage: [hits('3d8', 'radiant')] },
        },
      ],
    },
    // A spell he hasn't prepared: the Spells tab rolls it, but the game isn't asked to cast it.
    spell('witch', 'Witch Bolt', 1, {
      id: 'witchBolt', ability: 'wis', damage: [{ number: 2, denomination: 12, types: ['lightning'], scaling: 1 }],
      labels: { modifier: '+6', damage: [hits('2d12', 'lightning')] },
    }, { prepared: 0 }),
    // Carried, not equipped, so not among his actions: thrown from his inventory.
    {
      id: 'javelin', name: 'Javelin', type: 'weapon',
      system: { properties: [], quantity: 3, attackType: 'ranged', equipped: false },
      activities: [{
        id: 'hurl', damage: [{ number: 1, denomination: 6, bonus: '@mod', types: ['piercing'] }],
        labels: { modifier: '+6', damage: [hits('1d6 + 3', 'piercing')] },
      }],
    },
    {
      id: 'sword', name: 'Longsword', type: 'weapon',
      system: { properties: ['ver'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{
        id: 'swing', versatile: 10, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }],
        labels: { modifier: '+6', damage: [hits('1d8 + 3', 'slashing')] },
      }],
    },
    // A bard's flame: it strikes, and casts Starry Wisp as an action and Shield as a reaction, each
    // for a charge, through the copies of the spells dnd5e keeps on the actor.
    {
      id: 'flame', name: 'Bardic Flame', type: 'weapon',
      system: { properties: ['mgc'], quantity: 1, attackType: 'melee', equipped: true, uses: { max: 10, spent: 0, recovery: [{ period: 'dawn' }] } },
      activities: [
        { id: 'strike', damage: [{ number: 1, denomination: 6, bonus: '@mod', types: ['bludgeoning'] }], labels: { modifier: '+6', damage: [hits('1d6 + 3', 'bludgeoning')] } },
        { id: 'castWisp', type: 'cast', name: 'Starry Wisp', consumption: [{ type: 'itemUses', value: '1' }], labels: { range: '60 ft' } },
        { id: 'castShield', type: 'cast', name: 'Shield', activation: { type: 'reaction', value: 1 }, consumption: [{ type: 'itemUses', value: '1' }], labels: { activation: 'Reaction', range: 'Self' } },
      ],
    },
    {
      id: 'wisp', name: 'Starry Wisp', type: 'spell', flags: { dnd5e: { cachedFor: '.Item.flame.Activity.castWisp' } },
      system: { level: 0, method: 'spell', properties: [] },
      activities: [{ id: 'wisp-shot', ability: 'wis', damage: [{ number: 1, denomination: 8, types: ['radiant'] }], labels: { modifier: '+6', damage: [hits('1d8', 'radiant')] } }],
    },
    {
      id: 'flameShield', name: 'Shield', type: 'spell', flags: { dnd5e: { cachedFor: '.Item.flame.Activity.castShield' } },
      system: { level: 1, method: 'spell', properties: [] },
      activities: [{ id: 'barrier', type: 'utility', affects: 'self', range: 'self', activation: { type: 'reaction', value: 1 }, labels: { activation: 'Reaction', range: 'Self' } }],
    },
    // Wands that cast their spells higher for more of their charges (module 0.20.0), each before
    // the copy of its spell dnd5e keeps on the actor. Magic missiles from 1st level, a level higher
    // for each charge more, as many levels as it has charges left, up to three; its darts two, and
    // one more for each level they're cast at.
    {
      id: 'mmWand', name: 'Wand of Magic Missiles', type: 'consumable', system: { properties: [], quantity: 1, uses: { max: 7, spent: 0 } },
      activities: [{
        id: 'castMm', type: 'cast', name: 'Magic Missile', spell: { level: 1 }, scaling: { allowed: true, max: 'min(@item.uses.value,3)' },
        consumption: [{ type: 'itemUses', value: '1', scaling: { mode: 'amount' } }], labels: { range: '120 ft' },
      }],
    },
    {
      id: 'mm', name: 'Magic Missile', type: 'spell', flags: { dnd5e: { cachedFor: '.Item.mmWand.Activity.castMm' } },
      system: { level: 1, method: 'spell', properties: [] },
      activities: [{
        id: 'mmDarts', type: 'damage', affects: 'creature', count: '2 + @item.level',
        damage: [{ number: 1, denomination: 4, bonus: '1', types: ['force'] }], labels: { damage: [hits('1d4 + 1', 'force')] },
      }],
    },
    // Fireballs, the same from 3rd level.
    {
      id: 'fbWand', name: 'Wand of Fireballs', type: 'consumable', system: { properties: [], quantity: 1, uses: { max: 7, spent: 0 } },
      activities: [{
        id: 'castFb', type: 'cast', name: 'Fireball', spell: { level: 3 }, scaling: { allowed: true, max: 'min(@item.uses.value,3)' },
        consumption: [{ type: 'itemUses', value: '1', scaling: { mode: 'amount' } }], labels: { range: '150 ft' },
      }],
    },
    {
      id: 'fb', name: 'Fireball', type: 'spell', flags: { dnd5e: { cachedFor: '.Item.fbWand.Activity.castFb' } },
      system: { level: 3, method: 'spell', properties: [] },
      activities: [{
        id: 'fbSave', type: 'save', template: 'sphere', affects: 'creature', save: ['dex'], dc: 15,
        damage: [{ number: 8, denomination: 6, types: ['fire'], scaling: 1 }], labels: { damage: [hits('8d6', 'fire')] },
      }],
    },
    // An older wand of lightning bolts, from 3rd level as high as its charges reach, with three of
    // its seven left.
    {
      id: 'boltWand', name: 'Wand of Lightning Bolts', type: 'consumable', system: { properties: [], quantity: 1, uses: { max: 7, spent: 4 } },
      activities: [{
        id: 'castBolt', type: 'cast', name: 'Lightning Bolt', spell: { level: 3 }, scaling: { allowed: true, max: '' },
        consumption: [{ type: 'itemUses', value: '1', scaling: { mode: 'amount' } }], labels: { range: 'Self' },
      }],
    },
    {
      id: 'bolt', name: 'Lightning Bolt', type: 'spell', flags: { dnd5e: { cachedFor: '.Item.boltWand.Activity.castBolt' } },
      system: { level: 3, method: 'spell', properties: [] },
      activities: [{
        id: 'boltSave', type: 'save', template: 'line', affects: 'creature', save: ['dex'], dc: 15,
        damage: [{ number: 8, denomination: 6, types: ['lightning'], scaling: 1 }], labels: { damage: [hits('8d6', 'lightning')] },
      }],
    },
  ],
})
// Foundry tells every client of a change to Thorin or his items, as when a use spends a slot or a
// use of a feature; the module then sends his sheet again.
thorin.documentName = 'Actor'
const updateThorin = thorin.update.bind(thorin)
thorin.update = async changes => {
  await updateThorin(changes)
  Hooks.callAll('updateActor', thorin, changes, {}, 'gm')
}
const updateItems = thorin.updateEmbeddedDocuments
thorin.updateEmbeddedDocuments = async (type, updates) => {
  await updateItems(type, updates)
  for (const { _id, ...changes } of updates) Hooks.callAll('updateItem', thorin.items.get(_id), changes, {}, 'gm')
}
const vex = new Actor5e({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3 }, hp: { value: 10, max: 30, temp: 0 } })
actors.set('vex', vex)
equip(vex, {})

// The tokens on the Gamemaster's canvas: Thorin's and Vex's, and the foes'.
const place = actor => {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  placeables.set(token.id, placeable)
  return token
}
const foe = (id, name, ac) => {
  const actor = new Actor5e({ id, name, mods: {}, hp: { value: 40, max: 40, temp: 0 } })
  actor.type = 'npc'
  actors.set(id, actor)
  equip(actor, { ac })
  return { actor, token: place(actor) }
}
const tokens = { thorin: place(thorin), vex: place(vex) }
const goblin = foe('goblin', 'Goblin', 13)
const hobgoblin = foe('hobgoblin', 'Hobgoblin', 18)
const ogre = foe('ogre', 'Ogre', 11)
if (MIDI) canvas.scene.tokens.size = placeables.size
// The Gamemaster had the ogre targeted before anything was cast.
users.get('gm').targets = new Set([ogre.token.object])
// The hobgoblin makes its saving throws, as far as Midi rolls them.
midi.saves.set(hobgoblin.token.id, true)

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
await until(() => stored().includes('use'), 'the app to hear the game takes spells and features', 10_000)
// From module 0.21.0, ending an enchantment with them; and the hello says check activities' checks
// are made (dnd5e 5) and that more dice change only a die damage adds.
// From module 0.29.0, ending a concentration, wherever players' rolls are made; and spending
// charges and Heroic Inspiration, wherever they may attack and cast.
// Changed on purpose (round 0.36.0 §13.4): from module 0.36.0, ending a turn wherever players' rolls
// are made, and damage on its own and recharges wherever they may attack and cast.
// Changed on purpose (round 0.36.0 §13.4, v6): and taking back a turn ended, right after it.
check(stored() === 't|skill,tool,ability,save,death,initiative,hitDie,hitDice,formula,endConcentration,endTurn,undoEndTurn,attack,use,damage,endEnchantment,spend,inspiration,textRoll,textDamage,itemDamage,recharge|t', `the app keeps that the game takes players' attacks, spells and features, and their damage (${stored()})`)
const features = sql(`select array_to_string("rollFeatures", ',') from campaign where title = 'Ashlands'`)
// From module 0.22.0, wherever uses are made, it makes one at its user too, as asked.
check(features === 'modifiers,areaAttacks,activityChecks,signedDice,selfTargets,gmRolls,gmRollMessages', `and that it takes damage a player changed, makes area attacks, makes a use at its user, and, from module 0.23.0, the Gamemaster's rolls as a character, from 0.25.0 each one's result listing its messages (${features})`)

// The Gamemaster's card says so.
await gm.reload()
const card = gm.getByRole('article', { name: 'Ashlands' })
await card.getByText("Players' rolls").waitFor()
check(/death saves, attacks and spells your players roll and cast here are made in your game too/.test(await card.textContent()), "the Gamemaster's campaign card says players' spells reach the game")
await shoot(gm, 'gm-card-uses')

// A fight: Thorin and Vex, against a goblin, a hobgoblin and an ogre.
const fight = combat('fight')
combatant(fight, 'cbGob', goblin.actor, { name: 'Goblin', initiative: 17, token: goblin.token })
combatant(fight, 'cbThorin', thorin, { initiative: 15, token: tokens.thorin })
combatant(fight, 'cbHob', hobgoblin.actor, { name: 'Hobgoblin', initiative: 13, token: hobgoblin.token })
combatant(fight, 'cbVex', vex, { initiative: 11, token: tokens.vex })
combatant(fight, 'cbOgre', ogre.actor, { name: 'Ogre', initiative: 6, token: ogre.token })
fight.getCombatantsByActor = actor => fight.combatants.filter(cb => cb.actor?.id === actor.id)
fight.started = true
fight.round = 1
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// Alice plays Thorin.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'sheet-thorin', 'Thorin', '${GAME}', 'Ashlands', id, 'thorin', 'e2e-user', now() from campaign where title = 'Ashlands'`)

// ---- On a phone ----
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
await phone.addCookies([cookie])
await phone.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
const page = await phone.newPage()
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
// What the app answers a roll it refuses, for when one is.
page.on('response', async response => {
  if (response.request().method() === 'POST' && response.url().endsWith('/rolls') && response.status() !== 202) {
    console.log('refused:', response.status(), await response.text().catch(() => ''), response.request().postData())
  }
})
await page.goto(`${BASE}/characters/sheet-thorin`)
// In a fight too, the phone opens on Thorin's sheet; a tap on Character keeps it there.
await page.getByRole('navigation', { name: 'Table' }).getByRole('button', { name: 'Character' }).click()
await page.getByRole('tab', { name: 'Actions' }).click()
const panel = page.getByRole('tabpanel')
const tray = page.getByRole('region', { name: 'Your rolls' })
const status = tray.getByRole('status')
const fireballChip = panel.getByRole('button', { name: 'Fireball, DEX saving throw DC 15' })
await fireballChip.waitFor({ timeout: 15_000 })
await tray.getByText('Checks, saves, attacks, spells and hit dice you roll, cast or spend here are made in your Gamemaster’s game too, with the same dice.').waitFor({ timeout: 15_000 })
check(true, "Thorin's spells and features are on his Actions tab, their chips casting them in the game, as the tray says")
await shoot(page, 'phone-actions')

/** The d20 the app throws next, or Math.random again. */
const forceD20 = value => page.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, value)
const unforce = () => page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
const requestRow = where => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, "useId", result from roll_request ${where} order by "createdAt" desc limit 1) r`) || 'null')
const latestRequest = () => requestRow('')
const requests = () => Number(sql('select count(*) from roll_request'))
const useCard = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.use === id)
const madeFor = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const hp = actor => actor.system.attributes.hp.value
const sum = values => values.reduce((total, value) => total + value, 0)
const settled = request => ['done', 'failed'].includes(request?.status)

/**
 * Wait for room under the app's limit of 20 rolls a minute from a player, which a script tapping
 * faster than any player would reach, keeping two for damage that follows on its own.
 */
const lastMinute = () => Number(sql(`select count(*) from roll_request where "createdAt" > now() - interval '1 minute'`))
const paced = () => until(() => lastMinute() < 18, 'room under the rate limit', 70_000)

/** Send what a tap uses or rolls, and wait until the game has made it. */
async function sent(tap, what) {
  await paced()
  const before = requests()
  await tap()
  try {
    await until(() => requests() > before, `${what} to be sent`)
  } catch (error) {
    // A use the app refused never reaches the game: the tray says why.
    console.log('tray:', await status.textContent())
    throw error
  }
  const request = latestRequest()
  await until(() => settled(requestRow(`where id = '${request.id}'`)), `${what} to be made`)
  return { request, made: requestRow(`where id = '${request.id}'`) }
}

/** The damage or healing the app sends of a use by itself, once the game has made it, made too. */
async function followed(useId, what) {
  await until(() => settled(requestRow(`where "useId" = '${useId}'`)), `${what} to follow, sent and made`, 30_000)
  return requestRow(`where "useId" = '${useId}'`)
}

// ---- Fireball at 4th, at the goblin and the hobgoblin ----
await fireballChip.click()
const fireballPicker = page.getByRole('dialog', { name: 'Fireball' })
await fireballPicker.waitFor()
const castAt = fireballPicker.getByRole('group', { name: 'Cast at' })
check(await castAt.getByRole('radio', { name: '3rd Level, 2 slots left' }).getAttribute('aria-checked') === 'true'
  && await castAt.getByRole('radio', { name: '4th Level, 1 slot left' }).getAttribute('aria-checked') === 'false',
  'Fireball is cast with its own level, 3rd, unless 4th is chosen')
const ticks = await fireballPicker.getByRole('checkbox').allTextContents()
// From module 0.22.0 its caster may be caught in it too, as Self, last, and isn't to start with.
// Since this round, a use that harms lists the others first, then the allies, Self last among
// them, each pill read after a comma.
check(JSON.stringify(ticks) === JSON.stringify(['Goblin', 'Hobgoblin', 'Ogre', 'Vex, Ally', 'Self, You'])
  && (await fireballPicker.getByRole('checkbox').evaluateAll(boxes => boxes.map(box => box.getAttribute('aria-checked')))).every(on => on === 'false'),
  `whoever is caught in the area is ticked, Thorin himself, as Self, last, none to start with: ${JSON.stringify(ticks)}`)
await castAt.getByRole('radio', { name: '4th Level, 1 slot left' }).click()
await fireballPicker.getByRole('checkbox', { name: 'Goblin', exact: true }).click()
await fireballPicker.getByRole('checkbox', { name: 'Hobgoblin' }).click()
await shoot(page, 'phone-fireball-picker')
const gobBefore = hp(goblin.actor)
let { request, made } = await sent(() => fireballPicker.getByRole('button', { name: 'Cast at 2 targets' }).click(), 'Fireball')
check(request.kind === 'use' && request.payload.item === 'fireball' && request.payload.activity === 'blast' && request.payload.slot === 'spell4'
  && JSON.stringify(request.payload.targets) === JSON.stringify([{ combatId: 'fight', combatantId: 'cbGob' }, { combatId: 'fight', combatantId: 'cbHob' }])
  && request.payload.dice.length === 0,
  `the app sends Fireball at the two ticked, with a 4th-level slot, and no dice (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && made.result.use?.type === 'save' && made.result.damage?.rolls?.[0]?.dice?.[0]?.number === 9,
  `the game casts it, its damage nine d6 for the higher slot (${JSON.stringify(made.result.damage)})`)
check(thorin.system.spells.spell4.value === 0 && thorin.system.spells.spell3.value === 2, 'a 4th-level slot is spent, and no 3rd')
const fireCard = useCard(request.id)
check(fireCard && screen.templates === 0, "the game posts Fireball's card, with no template placed")
let damage = await followed(request.id, "Fireball's damage")
const fire = damage.payload.dice[0]
check(damage.kind === 'damage' && fire.faces === 6 && fire.results.length === 9 && damage.status === 'done',
  `its damage follows with no tap: the app throws nine d6 and the game rolls them (${JSON.stringify(fire.results)})`)
const fireTotal = sum(fire.results)
if (MIDI) {
  const workflow = midi.made.at(-1)
  check(workflow.damageRolls?.[0]?.dice[0].results.map(r => r.result).join() === fire.results.join(), "Midi's workflow goes on with Alice's d6")
  check(hp(goblin.actor) === gobBefore - fireTotal && hp(hobgoblin.actor) === 40 - Math.floor(fireTotal / 2),
    `Midi has the goblins save, and applies the damage: ${fireTotal} to the goblin, which failed, half to the hobgoblin, which made it`)
  check(hp(ogre.actor) === 40 && hp(vex) === 10, 'no one else is hurt')
  check([...users.get('gm').targets].length === 1 && users.get('gm').targets.has(ogre.token.object), "the Gamemaster's own target is theirs again")
} else {
  check(JSON.stringify(fireCard.flags.dnd5e.targets?.map(t => t.name)) === JSON.stringify(['Goblin', 'Hobgoblin']), 'dnd5e marks the card with its two targets')
  const damageMessage = madeFor(damage.id)
  check(damageMessage?.flags.dnd5e.originatingMessage === fireCard.id && damageMessage.rolls[0].dice[0].results.map(r => r.result).join() === fire.results.join(),
    'dnd5e rolls its damage on the card with Alice\'s d6, for the Gamemaster to apply')
}
await status.getByText(`At the table: ${fireTotal}`).waitFor({ timeout: 30_000 })
check(/Fireball damage/.test(await status.textContent()), `the tray shows Fireball's damage, and its total at the table, ${fireTotal}`)
await shoot(page, 'phone-fireball-damage')

// ---- Spirit Guardians' save each turn, beneath it: used at 4th, with no 4th-level slot left ----
await panel.getByRole('button', { name: /^Spirit Guardians/, expanded: false }).click()
const guardianRows = panel.getByRole('list', { name: 'Spirit Guardians: its other activities' }).getByRole('listitem')
check(await guardianRows.count() === 1 && /^Emanation Save/.test(await guardianRows.first().textContent()),
  `Spirit Guardians lists its save each turn beneath it: "${await guardianRows.first().textContent()}"`)
await panel.getByRole('button', { name: 'Spirit Guardians (Emanation Save), WIS saving throw DC 14' }).scrollIntoViewIfNeeded()
await shoot(page, 'phone-activities')
await panel.getByRole('button', { name: 'Spirit Guardians (Emanation Save), WIS saving throw DC 14' }).click()
const auraPicker = page.getByRole('dialog', { name: 'Spirit Guardians (Emanation Save)' })
await auraPicker.waitFor()
const atLevel = auraPicker.getByRole('group', { name: 'At level' })
check(await atLevel.getByRole('radio', { name: '3rd Level' }).getAttribute('aria-checked') === 'true'
  && await atLevel.getByRole('radio', { name: '4th Level' }).isEnabled(),
  "it's used at the spell's own level, or at 4th though no 4th-level slot is left, since it spends none")
await atLevel.getByRole('radio', { name: '4th Level' }).click()
await auraPicker.getByRole('checkbox', { name: 'Hobgoblin' }).click()
await shoot(page, 'phone-aura-picker')
const slotsBefore = JSON.stringify(thorin.system.spells)
;({ request, made } = await sent(() => auraPicker.getByRole('button', { name: 'Use at 1 target' }).click(), "Spirit Guardians' save"))
check(request.payload.item === 'guardians' && request.payload.activity === 'aura' && request.payload.slot === 'spell4'
  && made.status === 'done' && made.result.damage?.rolls?.[0]?.dice?.[0]?.number === 4,
  `the game uses the save at 4th level, its damage four d8 (${JSON.stringify(made.result.damage)})`)
check(JSON.stringify(thorin.system.spells) === slotsBefore, 'and spends no slot')
damage = await followed(request.id, "the save's damage")
const aura = damage.payload.dice[0]
check(damage.status === 'done' && aura.faces === 8 && aura.results.length === 4, `its damage follows, four d8, made in the game (${aura.results})`)
await status.getByText(`At the table: ${sum(aura.results)}`).waitFor({ timeout: 30_000 })
check(/Spirit Guardians \(Emanation Save\) damage/.test(await status.textContent()), `the tray names it: "${await status.textContent()}"`)

// ---- Cure Wounds on Vex ----
await panel.getByRole('button', { name: 'Cure Wounds healing, 2d8 + 3' }).click()
const curePicker = page.getByRole('dialog', { name: 'Cure Wounds' })
await curePicker.waitFor()
const listed = await curePicker.getByRole('listitem').allTextContents()
// From module 0.22.0 the player's own combatant is listed as Self.
// Since this round, each pill read after a comma, and "No target" a button after the lists.
check(JSON.stringify(listed) === JSON.stringify(['Self, You', 'Vex, Ally', 'Goblin', 'Hobgoblin', 'Ogre']) && await curePicker.getByRole('button', { name: 'No target' }).isVisible(), `healing lists Thorin, as Self, and his allies first: ${JSON.stringify(listed)}`)
;({ request, made } = await sent(() => curePicker.getByRole('button', { name: /^Vex/ }).click(), 'Cure Wounds'))
check(request.payload.slot === 'spell1' && JSON.stringify(request.payload.targets) === JSON.stringify([{ combatId: 'fight', combatantId: 'cbVex' }]),
  `the app casts Cure Wounds on Vex, with a 1st-level slot (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && made.result.use?.type === 'heal' && made.result.damage?.healing === true, 'the game casts it, its healing to follow')
damage = await followed(request.id, 'its healing')
const healed = sum(damage.payload.dice[0].results) + 3
check(damage.payload.dice[0].faces === 8 && damage.payload.dice[0].results.length === 2 && damage.status === 'done', `the healing follows, two d8: ${healed}`)
if (MIDI) {
  check(hp(vex) === Math.min(30, 10 + healed), `Midi heals Vex: ${hp(vex)}`)
} else {
  const healMessage = madeFor(damage.id)
  check(healMessage?.flags.dnd5e.roll.type === 'healing' && healMessage.rolls[0].total === healed, 'dnd5e rolls the healing on the card')
}
await status.getByText(`At the table: ${healed}`).waitFor({ timeout: 30_000 })
check(/Cure Wounds healing/.test(await status.textContent()), 'the tray shows the healing')

// ---- Bless on Thorin and Vex ----
await panel.getByRole('button', { name: 'Cast Bless' }).click()
const blessPicker = page.getByRole('dialog', { name: 'Bless' })
await blessPicker.waitFor()
await blessPicker.getByText('Tick who to target. Up to 3.').waitFor()
await blessPicker.getByRole('checkbox', { name: /^Self/ }).click()
await blessPicker.getByRole('checkbox', { name: /^Vex/ }).click()
await shoot(page, 'phone-bless-picker')
const count = requests()
;({ request, made } = await sent(() => blessPicker.getByRole('button', { name: 'Cast at 2 targets' }).click(), 'Bless'))
check(JSON.stringify(request.payload.targets.map(t => t.combatantId)) === JSON.stringify(['cbThorin', 'cbVex']) && request.payload.slot === 'spell1',
  `the app casts Bless on Thorin and Vex (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && made.result.use?.type === 'utility' && made.result.damage === null, 'the game casts it, with nothing to roll after')
const blessCard = useCard(request.id)
if (MIDI) {
  check(midi.effects.filter(e => e.effect === 'Bless').map(e => e.target).sort().join() === 'tok-thorin,tok-vex', 'Midi blesses them both')
} else {
  check(JSON.stringify(blessCard.flags.dnd5e.targets?.map(t => t.name)) === JSON.stringify(['Thorin', 'Vex']), "dnd5e's card targets them both, for its effect")
}
await status.getByText('Cast at the table').waitFor({ timeout: 30_000 })
await wait(2500)
check(requests() === count + 1, 'nothing follows it')

// ---- Second Wind, at once ----
const thorinBefore = hp(thorin)
;({ request, made } = await sent(() => panel.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }).click(), 'Second Wind'))
check(await page.getByRole('dialog').count() === 0, 'Second Wind asks nothing: it heals its user')
check(request.payload.item === 'wind' && request.payload.targets.length === 0 && request.payload.slot === null && made.status === 'done',
  `the app uses it at once (${JSON.stringify(request.payload)})`)
check(thorin.items.get('wind').system.uses.spent === 1, 'the game spends a use of it')
damage = await followed(request.id, "Second Wind's healing")
const breath = damage.payload.dice[0].results[0] + 5
if (MIDI) check(hp(thorin) === Math.min(44, thorinBefore + breath), `Midi heals Thorin: ${hp(thorin)}`)
await status.getByText(`At the table: ${breath}`).waitFor({ timeout: 30_000 })
check(/Second Wind healing/.test(await status.textContent()), `the tray shows its healing, ${breath}`)

// ---- Fey Omen's roll, any time ----
const omen = panel.getByRole('button', { name: 'Roll Fey Omen: Omen, 1d4 + 3' })
check(await omen.textContent() === '1d4 + 3', "Fey Omen's own roll is a chip, with Thorin's Wisdom in it")
;({ request, made } = await sent(() => omen.click(), "Fey Omen's roll"))
const [omened] = request.payload.dice[0].results
check(request.kind === 'formula' && request.payload.item === 'omen' && request.payload.activity === 'foresee'
  && request.payload.dice.length === 1 && request.payload.dice[0].faces === 4 && made.status === 'done',
  `the app sends its d4, and the game rolls it (${JSON.stringify(request.payload)})`)
const omenRoll = madeFor(request.id)
check(omenRoll?.rolls[0].dice[0].results[0].result === omened && omenRoll.rolls[0].total === omened + 3 && omenRoll.flags.dnd5e.targets?.length === 0,
  `with Alice's ${omened}, for ${omenRoll?.rolls[0].total}, naming none of the Gamemaster's targets`)
await status.getByText(`At the table: ${omened + 3}`).waitFor({ timeout: 30_000 })
check(/Fey Omen: Omen1d4 \(\d\) \+3/.test(await status.textContent()), `the tray shows it: "${await status.textContent()}"`)

// ---- Chromatic Orb at the ogre, as fire ----
await forceD20(14)
await panel.getByRole('button', { name: 'Chromatic Orb attack, +6' }).click()
const orbPicker = page.getByRole('dialog', { name: 'Chromatic Orb attack' })
await orbPicker.waitFor()
console.log('orb slots:', JSON.stringify(await orbPicker.getByRole('radio').evaluateAll(radios => radios.map(r => [r.getAttribute('aria-label'), r.getAttribute('aria-checked')]))))
check(await orbPicker.getByRole('radio', { name: '1st Level, 2 slots left' }).getAttribute('aria-checked') === 'true', 'a spell attack is cast with a slot chosen too, its own level first')
;({ request, made } = await sent(() => orbPicker.getByRole('button', { name: 'Ogre' }).click(), 'Chromatic Orb'))
await unforce()
check(request.kind === 'attack' && request.payload.slot === 'spell1' && request.payload.target?.combatantId === 'cbOgre', `the app makes the spell attack at the ogre (${JSON.stringify(request.payload)})`)
const choices = made.result.damage?.rolls?.[0]?.types?.map(t => t.key)
check(made.result.attack?.outcome === 'hit' && JSON.stringify(choices) === JSON.stringify(ELEMENTS), `a hit, its damage of a kind to choose (${JSON.stringify(choices)})`)
await tray.getByText('Choose its kind of damage:').waitFor({ timeout: 30_000 })
check(await tray.getByRole('button', { name: /^Roll \w+ damage$/ }).count() === 5, 'the tray offers each kind, a button each')
await shoot(page, 'phone-orb-types')
const ogreBefore = hp(ogre.actor)
;({ request: damage, made } = await sent(() => tray.getByRole('button', { name: 'Roll Fire damage' }).click(), "the orb's damage"))
check(JSON.stringify(damage.payload.types) === JSON.stringify(['fire']) && damage.payload.dice[0].faces === 8 && damage.payload.dice[0].results.length === 3,
  `the app sends it as fire, with three d8 (${JSON.stringify(damage.payload)})`)
const orbTotal = sum(damage.payload.dice[0].results)
check(made.status === 'done', 'the game rolls it')
if (MIDI) {
  const roll = midi.made.at(-1).damageRolls?.[0]
  check(roll?.options.type === 'fire' && hp(ogre.actor) === ogreBefore - orbTotal, `Midi applies it as fire, with no dialog: ${orbTotal}`)
} else {
  const orbMessage = madeFor(damage.id)
  check(orbMessage?.rolls[0].options.type === 'fire', 'dnd5e rolls it as fire, with no dialog')
}
check(screen.notifications.length === 0 && !(globalThis.__dialogs ?? []).length, "nothing opened on the Gamemaster's screen")
await status.getByText(`At the table: ${orbTotal}`).waitFor({ timeout: 30_000 })
check(/3d8 \(\d, \d, \d\) Fire/.test(await status.textContent()), `the tray shows the damage as fire: "${await status.textContent()}"`)

// ---- The longsword, two-handed ----
await forceD20(12)
await panel.getByRole('button', { name: 'Longsword attack, +6' }).click()
const swordPicker = page.getByRole('dialog', { name: 'Longsword attack' })
await swordPicker.waitFor()
const modes = swordPicker.getByRole('group', { name: 'Mode' })
check(await modes.getByRole('radio', { name: 'One-Handed' }).getAttribute('aria-checked') === 'true', 'the longsword is swung one-handed unless chosen otherwise')
await modes.getByRole('radio', { name: 'Two-Handed' }).click()
await shoot(page, 'phone-sword-mode')
;({ request, made } = await sent(() => swordPicker.getByRole('button', { name: 'Goblin', exact: true }).click(), 'the two-handed swing'))
await unforce()
check(request.payload.attackMode === 'twoHanded' && made.result.attack?.outcome === 'hit' && made.result.damage?.rolls?.[0]?.dice?.[0]?.faces === 10,
  `swung two-handed, it hits, its damage a d10 (${JSON.stringify(made.result.damage)})`)
await tray.getByRole('button', { name: 'Roll damage' }).waitFor({ timeout: 30_000 })
;({ request: damage, made } = await sent(() => tray.getByRole('button', { name: 'Roll damage' }).click(), 'its damage'))
check(damage.payload.dice[0].faces === 10 && made.status === 'done', `the app throws a d10 for it, which the game rolls (${JSON.stringify(damage.payload.dice)})`)
await status.getByText(`At the table: ${damage.payload.dice[0].results[0] + 3}`).waitFor({ timeout: 30_000 })
check(true, 'and the tray shows its total')

// ---- Cure Wounds from the Spells tab, on Thorin ----
await page.getByRole('tab', { name: 'Spells' }).click()
await panel.getByRole('heading', { name: '1st Level' }).waitFor()
check(await tray.isVisible(), 'the tray shows with the spells, as they roll and cast')
await shoot(page, 'phone-spells-tab')
await panel.getByRole('button', { name: 'Cure Wounds healing, 2d8 + 3' }).click()
const spellsPicker = page.getByRole('dialog', { name: 'Cure Wounds' })
await spellsPicker.waitFor()
;({ request, made } = await sent(() => spellsPicker.getByRole('button', { name: /^Self/ }).click(), 'Cure Wounds from the Spells tab'))
check(request.payload.item === 'cure' && request.payload.activity === 'mend'
  && JSON.stringify(request.payload.targets) === JSON.stringify([{ combatId: 'fight', combatantId: 'cbThorin' }]) && made.status === 'done',
  `the Spells tab casts Cure Wounds in the game, as the Actions tab does (${JSON.stringify(request.payload)})`)
damage = await followed(request.id, 'its healing')
check(damage.status === 'done' && damage.payload.dice[0].results.length === 2, 'its healing follows, two d8, made in the game')

// ---- Witch Bolt, not prepared: rolled here alone ----
let before = requests()
await forceD20(11)
// Cure Wounds' healing, rolled by itself, may still tumble: Witch Bolt, tapped after it, is the
// latest roll whichever dice land first.
const tumbling = (await status.textContent()).includes('Rolling')
await panel.getByRole('button', { name: 'Witch Bolt attack, +6' }).click()
try {
  await status.getByText('Witch Bolt attack').waitFor({ timeout: 20_000 })
} catch (error) {
  console.log('tray:', await status.textContent())
  console.log('whole tray:', await tray.textContent())
  await page.screenshot({ path: `${SHOTS ?? '.'}/debug-witch.png` })
  throw error
}
await unforce()
await wait(1500)
check(requests() === before && await page.getByRole('dialog').count() === 0,
  `Witch Bolt, which Thorin hasn't prepared, rolls on Alice's phone alone: the game isn't asked to cast it${tumbling ? " (tapped while the healing's dice still tumbled)" : ''}`)
await panel.getByRole('button', { name: 'Witch Bolt damage, 2d12' }).click()
await status.getByText('Witch Bolt damage').waitFor({ timeout: 20_000 })
check(requests() === before && /2d12 \(\d+, \d+\) Lightning/.test(await status.textContent()), `and its damage too: "${await status.textContent()}"`)

// ---- Second Wind from Features ----
await page.getByRole('tab', { name: 'Features' }).click()
;({ request, made } = await sent(() => panel.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }).click(), 'Second Wind from Features'))
check(request.payload.item === 'wind' && request.payload.activity === 'breather' && made.status === 'done'
  && thorin.items.get('wind').system.uses.spent === 2,
  'the Features tab uses Second Wind in the game, spending its second use')
damage = await followed(request.id, "Second Wind's healing")
check(damage.status === 'done', 'its healing follows, made in the game')
await shoot(page, 'phone-features-tab')

// ---- The javelin from Inventory, at the goblin ----
await page.getByRole('tab', { name: 'Inventory' }).click()
await forceD20(15)
await panel.getByRole('button', { name: 'Javelin attack, +6' }).click()
const javelinPicker = page.getByRole('dialog', { name: 'Javelin attack' })
await javelinPicker.waitFor()
// The goblin, attacked last, is marked so.
;({ request, made } = await sent(() => javelinPicker.getByRole('button', { name: /^Goblin/ }).click(), 'the javelin'))
await unforce()
check(request.kind === 'attack' && request.payload.item === 'javelin' && request.payload.activity === 'hurl'
  && request.payload.target?.combatantId === 'cbGob' && made.result.attack?.outcome === 'hit',
  `a javelin carried, not equipped, is thrown from the Inventory tab, and hits (${JSON.stringify(request.payload)})`)
await tray.getByRole('button', { name: 'Roll damage' }).waitFor({ timeout: 30_000 })
;({ request: damage, made } = await sent(() => tray.getByRole('button', { name: 'Roll damage' }).click(), "the javelin's damage"))
check(damage.payload.dice[0].faces === 6 && made.status === 'done', `its damage, a d6, is made in the game (${JSON.stringify(damage.payload.dice)})`)
await shoot(page, 'phone-inventory-tab')

// ---- Fireball at its highest, from its damage's menu ----
await page.getByRole('tab', { name: 'Actions' }).click()
await panel.getByRole('button', { name: 'Fireball damage, 8d6' }).click({ button: 'right' })
const fireMenu = page.getByRole('menu', { name: 'Fireball damage 8d6' })
await fireMenu.waitFor()
check(JSON.stringify(await fireMenu.getByRole('menuitem').allTextContents()) === JSON.stringify(['Cast with maximum damage', 'Cast with damage modified…']),
  "Fireball's damage offers to cast it at its highest, or changed")
await shoot(page, 'phone-cast-menu')
await fireMenu.getByRole('menuitem', { name: 'Cast with maximum damage' }).click()
const highestPicker = page.getByRole('dialog', { name: 'Fireball' })
await highestPicker.waitFor()
await highestPicker.getByRole('checkbox', { name: 'Ogre' }).click()
;({ request, made } = await sent(() => highestPicker.getByRole('button', { name: 'Cast at 1 target' }).click(), 'Fireball at its highest'))
check(request.kind === 'use' && request.payload.modifiers === undefined && made.status === 'done', 'Fireball is cast at the ogre, the use itself as any other')
damage = await followed(request.id, 'its damage, at its highest')
check(JSON.stringify(damage.payload.modifiers) === JSON.stringify({ maximize: true }) && damage.payload.dice[0].results.length === 8
  && damage.payload.dice[0].results.every(result => result === 6) && damage.status === 'done',
  `its damage follows at its highest, every d6 a 6, and the game rolls it so (${JSON.stringify(damage.payload)})`)
await status.getByText('At the table: 48').waitFor({ timeout: 30_000 })
check(/8d6 \(6, 6, 6, 6, 6, 6, 6, 6\) Fire · Maximum/.test(await status.textContent()), `the tray shows it at its highest: "${await status.textContent()}"`)

// ---- The longsword, its damage a die more, made d12s ----
await forceD20(12)
await panel.getByRole('button', { name: 'Longsword attack, +6' }).click()
const againPicker = page.getByRole('dialog', { name: 'Longsword attack' })
await againPicker.waitFor()
;({ request, made } = await sent(() => againPicker.getByRole('button', { name: /^Goblin/ }).click(), 'the longsword again'))
await unforce()
check(made.result.attack?.outcome === 'hit', 'the longsword hits the goblin')
const rollIt = tray.getByRole('button', { name: 'Roll damage' })
await rollIt.waitFor({ timeout: 30_000 })
await rollIt.click({ button: 'right' })
await page.getByRole('menuitem', { name: 'Modify damage…' }).click()
const modify = page.getByRole('dialog', { name: 'Modify damage' })
await modify.waitFor()
await modify.getByRole('button', { name: 'One die more' }).click()
await modify.locator('label', { hasText: /^d12$/ }).click()
const shown = await modify.getByRole('status').textContent()
check(/^2d12 \+ 3 Slashing$/.test(shown), `the dialog shows what it will throw: ${shown}`)
await shoot(page, 'phone-modify-damage')
;({ request: damage, made } = await sent(() => modify.getByRole('button', { name: 'Roll' }).click(), 'the longsword\'s damage, changed'))
check(JSON.stringify(damage.payload.modifiers) === JSON.stringify({ extra: 1, faces: 12 })
  && damage.payload.dice.length === 1 && damage.payload.dice[0].faces === 12 && damage.payload.dice[0].results.length === 2 && made.status === 'done',
  `its damage goes to the game as two d12s, which it rolls (${JSON.stringify(damage.payload)})`)
const changedTotal = sum(damage.payload.dice[0].results) + 3
await status.getByText(`At the table: ${changedTotal}`).waitFor({ timeout: 30_000 })
check(true, `and the tray shows the game's total, ${changedTotal}`)

// ---- The flame's spells, cast from it under each kind of action ----
await page.getByRole('tab', { name: 'Actions' }).click()
const reactionsBox = panel.getByRole('region', { name: 'Reactions', exact: true })
const shieldRow = reactionsBox.getByRole('button', { name: /^Bardic Flame/, expanded: false })
await shieldRow.waitFor()
check(await panel.getByRole('button', { name: /^Bardic Flame/, expanded: false }).count() === 2 && /^Bardic FlameShield · Self · 1 charge/.test(await shieldRow.textContent()),
  `the flame is under Actions and under Reactions, its reaction row named for the Shield it casts, without saying it's a reaction: "${await shieldRow.textContent()}"`)
const casts = await sent(() => reactionsBox.getByRole('button', { name: 'Cast Bardic Flame (Shield)' }).click(), 'Shield, from the flame')
check(casts.request.kind === 'use' && casts.request.payload.item === 'flame' && casts.request.payload.activity === 'castShield' && casts.made.status === 'done',
  `Shield is cast from the flame by its Cast activity, and made in the game (${JSON.stringify(casts.request.payload)})`)
check(thorin.items.get('flame').system.uses.spent === 1 && useCard(casts.request.id)?.flags.dnd5e.item.id === 'flameShield',
  "the game spends a charge of the flame's, no spell slot, and posts the spell's card")
await panel.getByRole('region', { name: 'Actions', exact: true }).getByRole('button', { name: /^Bardic Flame/, expanded: false }).click()
const flameOthers = await panel.getByRole('list', { name: 'Bardic Flame: its other activities' }).getByRole('listitem').allTextContents()
check(flameOthers.length === 1 && /^Starry Wisp60 ft · Radiant · 1 charge\+61d8$/.test(flameOthers[0]),
  `opened, the flame lists Starry Wisp, cast for a charge, its attack and damage beside it: ${JSON.stringify(flameOthers)}`)
await shoot(page, 'phone-flame')

// ---- Earlier ----
await tray.getByText(/^Earlier rolls/).click()
const earlier = await tray.getByRole('listitem').allTextContents()
check(earlier.some(row => /^Fireballcast· at the table$/.test(row)) && earlier.some(row => /^Second Windused· at the table$/.test(row)),
  `the tray keeps each cast among the earlier rolls: ${JSON.stringify(earlier.slice(0, 8))}`)
// Folded away again.
await tray.getByText(/^Earlier rolls/).click()

// ---- Wands that cast their spells higher, for more of their charges ----
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
/** An item's row, by the button that opens it, whether it's open or not. */
const rowButton = (name, within = panel) => within.locator('button[aria-expanded]').filter({ hasText: name })
/**
 * The chip of an item's charges beside its row, such as "5/7", as a screen reader is told it: "5 of
 * 7". A phone, too narrow for it beside what the row rolls, shows them once the row's opened.
 */
const chargesShown = async button => {
  const told = button.locator('xpath=..').getByText(/^\d+ of \d+ uses left$/)
  if (!(await told.count())) return undefined
  const [shown, said] = await told.evaluate(span => [span.previousElementSibling?.textContent, span.textContent.replace(' uses left', '')])
  return shown === said.replace(' of ', '/') ? said : `${shown}, said as ${said}`
}
/** What an opened row lists of its uses, as a phone shows it: such as "5 of 7 left". */
const usesFact = button => button.locator('xpath=ancestor::li[1]').locator('dt', { hasText: /^Uses$/ }).locator('xpath=following-sibling::dd[1]')
/**
 * What it says of them, as read: since this round, where the row's count is folded away beside a
 * roll on a phone and its charges may be spent, the fact has a button to spend them besides.
 */
const factText = fact => fact.evaluate(dd => [...dd.childNodes].filter(node => !(node.nodeType === 1 && (node.matches('button') || node.querySelector('button')))).map(node => node.textContent).join(''))
/** Wait for the game to send the sheet again, and the app to show the charges it has now. */
const chargesBecome = (button, shown, what) => until(async () => (await chargesShown(button)) === shown, what, 20_000)
/** Each level chip: its text, what a screen reader is told, whether it's chosen, and whether it can be. */
const chipsOf = group => group.getByRole('radio').evaluateAll(radios => radios.map(r => [r.textContent, r.getAttribute('aria-label'), r.getAttribute('aria-checked'), !r.disabled]))
const spentOf = id => thorin.items.get(id).system.uses.spent

// Magic Missile from its wand at 2nd, at four of them, for two charges.
const mmRow = rowButton('Wand of Magic Missiles')
await mmRow.scrollIntoViewIfNeeded()
check(/^Wand of Magic Missiles.*120 ft · Force · 1–3 charges$/.test(await mmRow.textContent()) && await chargesShown(mmRow) === '7 of 7',
  `the wand of magic missiles casts for one to three of its charges, seven of seven left: "${await mmRow.locator('xpath=..').textContent()}"`)
const mmChip = panel.getByRole('button', { name: 'Wand of Magic Missiles damage, 1d4 + 1' })
await mmChip.click()
const mmPicker = page.getByRole('dialog', { name: 'Wand of Magic Missiles' })
await mmPicker.waitFor()
const mmLevels = mmPicker.getByRole('group', { name: 'Cast at' })
const mmChips = await chipsOf(mmLevels)
check(same(mmChips, [
  ['1st · 1 charge', '1st Level, 1 charge', 'true', true],
  ['2nd · 2 charges', '2nd Level, 2 charges', 'false', true],
  ['3rd · 3 charges', '3rd Level, 3 charges', 'false', true],
]), `it's cast at 1st for a charge, unless 2nd or 3rd is chosen, for a charge more each: ${JSON.stringify(mmChips)}`)
// Three darts at 1st: a fourth target can't be ticked.
await mmPicker.getByText('Tick who to target. Up to 3.').waitFor()
for (const name of ['Goblin', 'Hobgoblin', 'Ogre']) await mmPicker.getByRole('checkbox', { name, exact: true }).click()
check(await mmPicker.getByRole('checkbox', { name: /^Vex/ }).isDisabled(), 'at 1st, its three darts are at three of them, and no more can be ticked')
await mmLevels.getByRole('radio', { name: '2nd Level, 2 charges' }).click()
await mmPicker.getByText('Tick who to target. Up to 4.').waitFor()
await mmPicker.getByRole('checkbox', { name: /^Vex/ }).click()
const mmBoxes = await mmPicker.getByRole('checkbox').evaluateAll(boxes => boxes.map(b => [b.textContent, b.getAttribute('aria-checked'), b.disabled]))
// From module 0.22.0 Thorin himself is offered too, as Self, last: with four ticked, none is left for him.
check(same(mmBoxes.map(([name]) => name), ['Goblin', 'Hobgoblin', 'Ogre', 'Vex, Ally', 'Self, You'])
  && mmBoxes.slice(0, 4).every(([, ticked]) => ticked === 'true') && mmBoxes[4][1] === 'false' && mmBoxes[4][2] === true,
  `at 2nd, a fourth dart: all four of them ticked, and Self, last, can't be (${JSON.stringify(mmBoxes)})`)
await shoot(page, 'phone-wand-levels')
;({ request, made } = await sent(() => mmPicker.getByRole('button', { name: 'Cast at 4 targets' }).click(), 'Magic Missile at 2nd'))
check(request.kind === 'use' && request.payload.item === 'mmWand' && request.payload.activity === 'castMm' && request.payload.slot === 'spell2'
  && same(request.payload.targets.map(t => t.combatantId).sort(), ['cbGob', 'cbHob', 'cbOgre', 'cbVex']) && request.payload.dice.length === 0,
  `the app casts it from the wand at 2nd, at the four of them (${JSON.stringify(request.payload)})`)
const mmCard = useCard(request.id)
check(made.status === 'done' && spentOf('mmWand') === 2 && mmCard?.system.scaling === 1 && mmCard.flags.dnd5e.item.id === 'mm',
  `the game casts it a level higher, as dnd5e's card says (scaling ${mmCard?.system.scaling}), spending two of the wand's charges (${spentOf('mmWand')} spent)`)
damage = await followed(request.id, "the darts' damage")
const darts = damage.payload.dice[0]
check(damage.kind === 'damage' && damage.status === 'done' && damage.payload.dice.length === 1 && darts.faces === 4 && darts.results.length === 1,
  `the darts' damage follows, a d4 thrown on the phone, and the game rolls it (${JSON.stringify(damage.payload.dice)})`)
const dartsRoll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
check(same(dartsRoll?.dice[0].results.map(r => r.result), darts.results) && dartsRoll.total === darts.results[0] + 1,
  `${MIDI ? "Midi's workflow" : "dnd5e's card"} rolls them with Alice's d4: ${dartsRoll?.total}`)
await status.getByText(`At the table: ${darts.results[0] + 1}`).waitFor({ timeout: 30_000 })
await chargesBecome(mmRow, '5 of 7', 'the app to show the charges the wand has left')
await mmRow.click()
await usesFact(mmRow).waitFor()
check(await chargesShown(mmRow) === '5 of 7' && await factText(usesFact(mmRow)) === '5 of 7 left' && await usesFact(mmRow).isVisible()
  && /1–3 charges$/.test(await mmRow.textContent()),
  `once the game sends Thorin's sheet again, the app shows the wand with two charges fewer, five of seven, and opened, says so on the phone: "${await factText(usesFact(mmRow))}"`)
check(await usesFact(mmRow).getByRole('button', { name: 'Spend Wand of Magic Missiles: 5 of 7 left' }).isVisible(),
  'and, its count folded away beside the cast, offers to spend them there (module 0.29.0)')
await usesFact(mmRow).scrollIntoViewIfNeeded()
await shoot(page, 'phone-wand-charges')
await mmRow.click()

// Fireball from its wand at 5th, for three charges, its damage ten d6.
const fbRow = rowButton('Wand of Fireballs')
await fbRow.scrollIntoViewIfNeeded()
check(/1–3 charges$/.test(await fbRow.textContent()) && await chargesShown(fbRow) === '7 of 7', `the wand of fireballs too: "${await fbRow.textContent()}"`)
await panel.getByRole('button', { name: 'Wand of Fireballs, DEX saving throw DC 15' }).click()
const fbPicker = page.getByRole('dialog', { name: 'Wand of Fireballs' })
await fbPicker.waitFor()
const fbLevels = fbPicker.getByRole('group', { name: 'Cast at' })
const fbChips = await chipsOf(fbLevels)
check(same(fbChips.map(([text, , chosen]) => [text, chosen]), [['3rd · 1 charge', 'true'], ['4th · 2 charges', 'false'], ['5th · 3 charges', 'false']]),
  `it's cast at 3rd, 4th or 5th: ${JSON.stringify(fbChips)}`)
await fbLevels.getByRole('radio', { name: '5th Level, 3 charges' }).click()
await fbPicker.getByRole('checkbox', { name: 'Goblin', exact: true }).click()
await fbPicker.getByRole('checkbox', { name: 'Hobgoblin' }).click()
;({ request, made } = await sent(() => fbPicker.getByRole('button', { name: 'Cast at 2 targets' }).click(), 'Fireball at 5th'))
check(request.payload.item === 'fbWand' && request.payload.activity === 'castFb' && request.payload.slot === 'spell5' && request.payload.targets.length === 2,
  `the app casts it from the wand at 5th (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && spentOf('fbWand') === 3 && useCard(request.id)?.system.scaling === 2
  && same(made.result.damage?.rolls?.map(roll => roll.dice), [[{ faces: 6, number: 10 }]]),
  `the game casts it two levels higher, spending three charges, its damage ten d6 (${JSON.stringify(made.result.damage?.rolls)})`)
damage = await followed(request.id, "the wand's Fireball's damage")
const fireballs = damage.payload.dice[0]
check(damage.status === 'done' && damage.payload.dice.length === 1 && fireballs.faces === 6 && fireballs.results.length === 10,
  `its damage follows, ten d6 thrown on the phone, made in the game (${fireballs.results})`)
const fbRoll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
check(same(fbRoll?.dice[0].results.map(r => r.result), fireballs.results) && fbRoll.total === sum(fireballs.results),
  `with Alice's ten d6, for ${fbRoll?.total}`)
await status.getByText(`At the table: ${sum(fireballs.results)}`).waitFor({ timeout: 30_000 })
check(/10d6 \((\d+, ){9}\d+\) Fire/.test(await status.textContent()), `the tray shows the ten d6: "${await status.textContent()}"`)
await chargesBecome(fbRow, '4 of 7', 'the app to show the charges the wand of fireballs has left')
check(true, 'and the app shows the wand with three charges fewer, four of seven')

// An older wand of lightning bolts, with three charges left, on a narrower phone: each level to
// 9th, those its charges don't reach greyed out, none wider than the screen.
await page.setViewportSize({ width: 360, height: 780 })
const boltRow = rowButton('Wand of Lightning Bolts')
await boltRow.scrollIntoViewIfNeeded()
check(/1–3 charges$/.test(await boltRow.textContent()) && await chargesShown(boltRow) === '3 of 7',
  `a wand with three charges left says it casts for one to three: "${await boltRow.textContent()}"`)
await panel.getByRole('button', { name: 'Wand of Lightning Bolts, DEX saving throw DC 15' }).click()
const boltPicker = page.getByRole('dialog', { name: 'Wand of Lightning Bolts' })
await boltPicker.waitFor()
const boltChips = await chipsOf(boltPicker.getByRole('group', { name: 'Cast at' }))
check(same(boltChips.map(([text, , , enabled]) => [text, enabled]), [
  ['3rd · 1 charge', true], ['4th · 2 charges', true], ['5th · 3 charges', true], ['6th · 4 charges', false],
  ['7th · 5 charges', false], ['8th · 6 charges', false], ['9th · 7 charges', false],
]), `it's offered at each level from 3rd to 9th, those for more charges than are left greyed out: ${JSON.stringify(boltChips)}`)
const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: innerWidth, dialog: (d => d.scrollWidth <= d.clientWidth)(document.querySelector('dialog[open]')) }))
check(widths.page <= widths.screen && widths.dialog, `on a phone 360 wide, its seven chips fit, nothing wider than the screen (${JSON.stringify(widths)})`)
await shoot(page, 'phone-360-wand-levels')
const unsent = requests()
await boltPicker.getByRole('radio', { name: '6th Level, 4 charges' }).click({ force: true })
check(await boltPicker.getByRole('radio', { name: '3rd Level, 1 charge' }).getAttribute('aria-checked') === 'true', 'a level its charges don\'t reach can\'t be chosen')
await page.keyboard.press('Escape')
await boltPicker.waitFor({ state: 'hidden' })
check(requests() === unsent && spentOf('boltWand') === 4, 'closed, nothing is cast')
await page.setViewportSize({ width: 390, height: 844 })

// ---- Hex, cast from the flame, its damage used beneath it ----
// The Gamemaster gives the flame Hex to cast, for a charge, as a bonus action: dnd5e adds the Cast
// activity to the flame, and keeps a copy of the spell on Thorin, its curse first, then its damage,
// used after it's cast, spending nothing.
const flame = thorin.items.get('flame')
flame._source.activities.push({
  id: 'castHex', type: 'cast', name: 'Hex', spell: { level: 1 }, activation: { type: 'bonus', value: 1 },
  consumption: [{ type: 'itemUses', value: '1' }], labels: { activation: 'Bonus Action', range: '90 ft' },
})
flame.updateSource({})
thorin.items.set('hex', new Item5e(thorin, {
  id: 'hex', name: 'Hex', type: 'spell', flags: { dnd5e: { cachedFor: '.Item.flame.Activity.castHex' } },
  system: { level: 1, method: 'spell', properties: [], duration: { units: 'hour', value: 1 } },
  activities: [
    { id: 'hexCurse', type: 'utility', affects: 'creature', count: 1, activation: { type: 'bonus', value: 1 }, labels: { activation: 'Bonus Action', range: '90 ft' } },
    {
      id: 'hexDamage', name: 'Bonus Hex Damage', type: 'damage', affects: 'creature', count: 1, spellSlot: false, activation: { type: 'bonus', value: 1 },
      damage: [{ number: 1, denomination: 6, types: ['necrotic'] }], labels: { activation: 'Bonus Action', damage: [hits('1d6', 'necrotic')] },
    },
  ],
}))
await Hooks.callAll('updateItem', flame, { system: { activities: {} } }, {}, 'gm')
await Hooks.callAll('createItem', thorin.items.get('hex'), {}, 'gm')
const bonusBox = panel.getByRole('region', { name: 'Bonus Actions', exact: true })
const hexRow = rowButton('Bardic Flame', bonusBox)
await hexRow.waitFor({ timeout: 20_000 })
check(/^Bardic FlameHex · 90 ft · 1 charge · 1 more$/.test(await hexRow.textContent()) && await chargesShown(hexRow) === '9 of 10',
  `the flame is under Bonus Actions too, named for the Hex it casts, for a charge, with one more beneath it, nine of its ten charges left: "${await hexRow.textContent()}"`)
await hexRow.click()
const hexOthers = bonusBox.getByRole('list', { name: 'Bardic Flame: its other activities' }).getByRole('listitem')
const hexLater = await hexOthers.allTextContents()
check(hexLater.length === 1 && /^Hex \(Bonus Hex Damage\)/.test(hexLater[0]) && !/charge/.test(hexLater[0]) && /1d6$/.test(hexLater[0]),
  `opened, Hex's damage is beneath it, named for the spell, costing no charge: ${JSON.stringify(hexLater)}`)
check(await factText(usesFact(hexRow)) === '9 of 10 left', `and its uses: "${await factText(usesFact(hexRow))}"`)
await shoot(page, 'phone-hex-beneath')
// Hex cast from the flame, at the goblin.
await bonusBox.getByRole('button', { name: 'Cast Bardic Flame (Hex)' }).click()
const hexPicker = page.getByRole('dialog', { name: 'Bardic Flame (Hex)' })
await hexPicker.waitFor()
await hexPicker.getByText('Choose who to cast it at.').waitFor()
check(await hexPicker.getByRole('group').count() === 0, "it's cast at its own level, with nothing to choose but whom")
;({ request, made } = await sent(() => hexPicker.getByRole('button', { name: 'Goblin', exact: true }).click(), 'Hex from the flame'))
check(request.payload.item === 'flame' && request.payload.activity === 'castHex' && request.payload.slot === null
  && same(request.payload.targets.map(t => t.combatantId), ['cbGob']) && made.status === 'done',
  `the app casts Hex from the flame at the goblin (${JSON.stringify(request.payload)})`)
check(spentOf('flame') === 2 && useCard(request.id)?.flags.dnd5e.item.id === 'hex', "the game spends a charge of the flame's, and posts Hex's card")
await chargesBecome(hexRow, '8 of 10', 'the app to show the charge the flame spent')
check(await factText(usesFact(hexRow)) === '8 of 10 left', `the app shows the flame with a charge fewer, eight of ten: "${await factText(usesFact(hexRow))}"`)
// Its damage, from beneath it.
await bonusBox.getByRole('button', { name: 'Hex (Bonus Hex Damage) damage, 1d6' }).click()
const hexDamagePicker = page.getByRole('dialog', { name: 'Hex (Bonus Hex Damage)' })
await hexDamagePicker.waitFor()
await hexDamagePicker.getByText('Choose who to use it at.').waitFor()
check(await hexDamagePicker.getByRole('group').count() === 0, "its damage is used, not cast, with nothing to choose but whom")
;({ request, made } = await sent(() => hexDamagePicker.getByRole('button', { name: 'Goblin', exact: true }).click(), "Hex's damage"))
check(request.kind === 'use' && request.payload.item === 'hex' && request.payload.activity === 'hexDamage' && request.payload.slot === null
  && same(request.payload.targets.map(t => t.combatantId), ['cbGob']) && made.status === 'done',
  `the app uses it through the copy of Hex, with no slot (${JSON.stringify(request.payload)})`)
check(spentOf('flame') === 2, 'the game spends none of the flame\'s charges for it')
damage = await followed(request.id, "Hex's damage")
const hexDie = damage.payload.dice[0]
check(damage.status === 'done' && damage.payload.dice.length === 1 && hexDie.faces === 6 && hexDie.results.length === 1,
  `its d6 follows, thrown on the phone (${hexDie.results})`)
const hexRoll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
check(same(hexRoll?.dice[0].results.map(r => r.result), hexDie.results) && hexRoll.total === hexDie.results[0],
  `and the game rolls it with Alice's d6: ${hexRoll?.total}`)
await status.getByText(`At the table: ${hexDie.results[0]}`).waitFor({ timeout: 30_000 })
check(/Hex \(Bonus Hex Damage\) damage1d6 \(\d\) Necrotic/.test(await status.textContent()), `the tray names it: "${await status.textContent()}"`)
await usesFact(hexRow).scrollIntoViewIfNeeded()
await shoot(page, 'phone-hex-damage')
// The game sends the sheet again for the damage's card; the flame's charges stay as they were.
await wait(4000)
check(await chargesShown(hexRow) === '8 of 10' && await factText(usesFact(hexRow)) === '8 of 10 left', 'the app still shows eight of the flame\'s ten charges')
// Inventory lists the flame's activities in order, Hex's damage after Hex.
await page.getByRole('tab', { name: 'Inventory' }).click()
const flameItem = rowButton('Bardic Flame')
await flameItem.click()
const flameAll = (await panel.getByRole('list', { name: 'Bardic Flame: its other activities' }).getByRole('listitem').allTextContents()).map(row => /^(Starry Wisp|Shield|Hex \(Bonus Hex Damage\)|Hex)/.exec(row)?.[1])
check(same(flameAll, ['Starry Wisp', 'Shield', 'Hex', 'Hex (Bonus Hex Damage)']) && await chargesShown(flameItem) === '8 of 10',
  `in the inventory, the flame lists Hex's damage right after Hex, and eight of its ten charges: ${JSON.stringify(flameAll)}`)
await flameItem.click()

// ---- The wand's last charge, out of combat ----
await page.getByRole('tab', { name: 'Actions' }).click()
await thorin.updateEmbeddedDocuments('Item', [{ _id: 'mmWand', 'system.uses.spent': 6 }])
await chargesBecome(mmRow, '1 of 7', 'the app to show the wand with one charge')
check(/· 1 charge$/.test(await mmRow.textContent()), `with a charge left, the wand says it casts for one: "${await mmRow.textContent()}"`)
game.combats.delete('fight')
await Hooks.callAll('deleteCombat', fight)
await until(() => sql('select count(*) from combat') === '0', 'the fight to end in the app', 15_000)
// The page hears of it when it next asks.
await wait(3500)
;({ request, made } = await sent(() => mmChip.click(), 'Magic Missile with the last charge'))
check(await page.getByRole('dialog').count() === 0, 'out of combat, with one level it can be cast at, it asks nothing')
check(request.payload.item === 'mmWand' && request.payload.slot === null && request.payload.targets.length === 0 && made.status === 'done'
  && spentOf('mmWand') === 7 && !useCard(request.id)?.system.scaling,
  `it's cast at 1st, spending the last charge (${JSON.stringify(request.payload)})`)
damage = await followed(request.id, "the last darts' damage")
check(damage.status === 'done' && damage.payload.dice[0].faces === 4, 'its damage follows, made in the game')
await status.getByText(`At the table: ${damage.payload.dice[0].results[0] + 1}`).waitFor({ timeout: 30_000 })
await chargesBecome(mmRow, '0 of 7', 'the app to show the wand spent')
check(/No charges left$/.test(await mmRow.textContent()) && /opacity-60/.test(await mmRow.getAttribute('class')),
  `the app shows the wand with none left, faded: "${await mmRow.textContent()}"`)
await shoot(page, 'phone-wand-spent')

// ---- Old-style resources that stand for features, as favorites (#151, module 0.23.0) ----
// dnd5e lists Thorin's resources first among his favorites: "Second Wind", his feature's name,
// and "Bardic Inspiration", a feature he's given now, whose own uses are 3 of 3 while the
// resource has 3 of 4. Each shows as its feature's own row, its Use and description, with the
// resource's count; and a tap uses the feature in the game, as its row on Actions does.
await paced()
thorin.items.set('inspire', new Item5e(thorin, {
  id: 'inspire', name: 'Bardic Inspiration', type: 'feat',
  system: { properties: [], uses: { max: 3, spent: 0, recovery: [{ period: 'lr' }] }, description: { value: '<p>You inspire a creature that can hear you: once within the next 10 minutes, it adds a d6 to a roll.</p>' } },
  activities: [{
    id: 'inspireUse', type: 'utility', affects: 'self', range: 'self', activation: { type: 'bonus', value: 1 },
    consumption: [{ type: 'itemUses', value: '1' }], labels: { activation: 'Bonus Action', range: 'Self' },
  }],
}))
await thorin.updateEmbeddedDocuments('Item', [{ _id: 'wind', 'system.uses.spent': 0 }])
thorin.system.resources = {
  primary: { label: 'Second Wind', value: 2, max: 2, sr: true },
  secondary: { label: 'Bardic Inspiration', value: 3, max: 4, lr: true },
}
await Hooks.callAll('updateActor', thorin, { system: { resources: thorin.system.resources } })
const favStrip = panel.getByRole('region', { name: 'Favorites' })
await favStrip.getByRole('button', { name: 'Use Bardic Inspiration' }).waitFor({ timeout: 20_000 })
const stripRows = await favStrip.locator('li').evaluateAll(rows => rows.filter(row => !row.parentElement.closest('li')).map(row => [
  row.querySelector('.font-medium')?.textContent,
  [...row.querySelectorAll('.sr-only')].map(span => span.textContent).find(text => / of \d+ uses left$/.test(text)) ?? null,
  !!row.querySelector('button[aria-expanded]'),
]))
check(same(stripRows, [['Second Wind', '2 of 2 uses left', true], ['Bardic Inspiration', '3 of 4 uses left', true]]),
  `his favorites show both resources as their features' rows, each opening, with the resources' counts, Bardic Inspiration's 3 of 4, not its own 3 of 3 (${JSON.stringify(stripRows)})`)
await favStrip.getByRole('button', { name: /^Bardic Inspiration/, expanded: false }).click()
await favStrip.getByText('You inspire a creature that can hear you', { exact: false }).waitFor({ timeout: 10_000 })
check(true, "Bardic Inspiration's row opens to its description")
await favStrip.getByRole('button', { name: /^Bardic Inspiration/, expanded: true }).click()
await shoot(page, 'phone-resource-favorites')
;({ request, made } = await sent(() => favStrip.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }).click(), 'Second Wind from his favorites'))
check(request.payload.item === 'wind' && request.payload.activity === 'breather' && made.status === 'done' && spentOf('wind') === 1,
  `from the favorites, Second Wind is used in the game as on Actions, spending one of its own uses (${JSON.stringify(request.payload).slice(0, 120)})`)
damage = await followed(request.id, "Second Wind's healing")
check(damage.status === 'done', 'its healing follows, made in the game')
;({ request, made } = await sent(() => favStrip.getByRole('button', { name: 'Use Bardic Inspiration' }).click(), 'Bardic Inspiration from his favorites'))
check(request.payload.item === 'inspire' && request.payload.activity === 'inspireUse' && made.status === 'done' && spentOf('inspire') === 1,
  `and Bardic Inspiration's Use uses it in the game (${JSON.stringify(request.payload).slice(0, 120)})`)
const windRows = await favStrip.locator('li').filter({ hasText: 'Second Wind' }).count()
const windCounters = await favStrip.locator('li').filter({ hasText: 'Second Wind' }).filter({ hasNot: page.locator('button[aria-expanded]') }).count()
check(windRows === 1 && windCounters === 0 && await panel.getByRole('region', { name: 'Bonus Actions', exact: true }).getByText('Second Wind', { exact: true }).count() === 1,
  'the strip has one Second Wind row, no counter of that name, and Actions lists it too')

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
