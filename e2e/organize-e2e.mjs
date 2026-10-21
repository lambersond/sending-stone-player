// The Actions tab organized, end to end: the real module (in a stand-in Foundry, with a
// dnd5e-shaped Vex, a tiefling wizard and warlock) sends her actions and spell slots to the
// production app. On a phone Alice finds them grouped by kind, spells by how they're cast with
// their slots; on tablets, laptops and a wide screen she lays them out in columns or a table.
// Screenshots to SHOTS.
import { actor, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'

const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
const cookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
// Shown, once it has had the time to show.
const shown = locator => locator.waitFor({ timeout: 10_000 }).then(() => true, () => false)
// A screenshot once its transitions have finished.
const shoot = async (page, name) => {
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

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
let inFlight = 0
let lastActivity = Date.now()
const posted = []
// Since module 0.33.0 the module also fetches its commands for every dnd5e campaign whose app takes
// removals, rolls and moves off too: made from the game's page as before, but kept apart from the
// posts checked here, and not waited on by idle(), as the app holds one open while a player is at
// the table.
globalThis.fetch = async (url, init) => {
  const command = String(url).endsWith('/api/bridge/commands')
  if (!command) inFlight++
  try {
    const { status, statusText, type, body } = await gmTab.evaluate(async ({ url, init }) => {
      const response = await fetch(url, init)
      return { status: response.status, statusText: response.statusText, type: response.headers.get('content-type'), body: await response.text() }
    }, { url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
    if (!command) posted.push({ type: JSON.parse(init.body).type, status, body, size: init.body.length, data: JSON.parse(init.body).data })
    if (status >= 300) problems.push(`${JSON.parse(init.body).type} → ${status}`)
    return {
      ok: status >= 200 && status < 300, status, statusText,
      headers: new Headers(type ? { 'content-type': type } : {}),
      json: async () => JSON.parse(body), text: async () => body,
    }
  } finally { if (!command) { inFlight--; lastActivity = Date.now() } }
}
const idle = async () => {
  await wait(50)
  while (inFlight > 0 || Date.now() - lastActivity < 150) await wait(25)
}

// ---- The Gamemaster (Alice) sets up the campaign ----
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

// Game assets: any image the sheet asks for, as a small picture.
const serveAssets = ctx => ctx.route(`${GAME}/**`, route => {
  const { pathname } = new URL(route.request().url())
  if (/\.(svg|webp|png)$/.test(pathname)) {
    let hue = 0
    for (const char of pathname) hue = (hue * 31 + char.charCodeAt(0)) % 360
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="hsl(${hue} 45% 35%)"/><circle cx="16" cy="16" r="9" fill="hsl(${(hue + 40) % 360} 70% 75%)"/></svg>` })
  }
  return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' })
})

// ---- Foundry, with Vex as dnd5e 5.3 prepares her ----
const translations = {
  'TYPES.Item.weaponPl': 'Weapons', 'TYPES.Item.equipmentPl': 'Equipment', 'TYPES.Item.consumablePl': 'Consumables',
  'TYPES.Item.toolPl': 'Tools', 'TYPES.Item.lootPl': 'Loot', 'DND5E.Items': 'Items',
  'DND5E.CurrencyPP': 'Platinum', 'DND5E.CurrencyAbbrPP': 'PP', 'DND5E.CurrencyGP': 'Gold', 'DND5E.CurrencyAbbrGP': 'GP',
  'DND5E.CurrencySP': 'Silver', 'DND5E.CurrencyAbbrSP': 'SP',
  'DND5E.WeightUnitsLb': 'lb', 'DND5E.ItemRarityRare': 'Rare', 'DND5E.CAST.SECTIONS.Spellbook': 'Additional Spells',
  'DND5E.AbilityStr': 'Strength', 'DND5E.AbilityDex': 'Dexterity', 'DND5E.AbilityCon': 'Constitution',
  'DND5E.AbilityInt': 'Intelligence', 'DND5E.AbilityWis': 'Wisdom', 'DND5E.AbilityCha': 'Charisma',
  'DND5E.Alignment': 'Alignment', 'DND5E.Age': 'Age', 'DND5E.Gender': 'Gender', 'DND5E.Height': 'Height', 'DND5E.Weight': 'Weight',
  'DND5E.Eyes': 'Eyes', 'DND5E.Hair': 'Hair', 'DND5E.Skin': 'Skin', 'DND5E.Faith': 'Faith',
  'DND5E.PersonalityTraits': 'Personality Traits', 'DND5E.Ideals': 'Ideals', 'DND5E.Bonds': 'Bonds', 'DND5E.Flaws': 'Flaws',
  'DND5E.Size': 'Size', 'DND5E.SizeMedium': 'Medium', 'DND5E.Senses': 'Senses', 'DND5E.Speed': 'Speed', 'DND5E.Languages': 'Languages',
  'DND5E.SenseDarkvision': 'Darkvision', 'DND5E.MovementWalk': 'Walk', 'DND5E.MovementFly': 'Fly', 'DND5E.DistFtAbbr': 'ft',
  'DND5E.DamRes': 'Damage Resistances', 'DND5E.DamImm': 'Damage Immunities', 'DND5E.ConImm': 'Condition Immunities',
  'DND5E.TraitArmorProf': 'Armor Training', 'DND5E.TraitToolProf': 'Tool Proficiencies', 'DND5E.Telepathy': 'Telepathy',
  'DND5E.USES.Recovery.Period.LongRest.Label': 'Long Rest', 'DND5E.USES.Recovery.Period.Dawn.Label': 'Dawn',
  'DND5E.USES.Recovery.Period.ShortRest.Label': 'Short Rest', 'DND5E.ActionOther': 'Other', 'DND5E.AbbreviationDC': 'DC',
}
game.i18n.localize = key => translations[key] ?? key
game.i18n.has = key => key in translations
game.i18n.format = (key, data) => key === 'DND5E.MOVEMENT.HoverSpeed' ? `${data.speed} (hover)` : key
const dnd5eSettings = { encumbrance: 'variant', metricWeightUnits: false }
const getSetting = game.settings.get.bind(game.settings)
game.settings.get = (module, key) => module === 'dnd5e'
  ? (key in dnd5eSettings ? dnd5eSettings[key] : (() => { throw new Error(`no setting ${key}`) })())
  : getSetting(module, key)

// Spellcasting methods, shaped as dnd5e's models.
class SingleLevelSpellcasting {}
const ordinal = n => ['Cantrips', '1st Level', '2nd Level', '3rd Level', '4th Level'][n] ?? `${n}th Level`
const multi = { key: 'spell', slots: true, cantrips: true, prepares: true, order: 20,
  getAvailableLevels: actor => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => (actor.system.spells[`spell${l}`]?.max ?? 0) > 0),
  getSpellSlotKey: level => `spell${level}`, getLabel: ({ level }) => ordinal(level) }
const pact = Object.assign(new SingleLevelSpellcasting(), { key: 'pact', slots: true, order: 10,
  getAvailableLevels: actor => actor.system.spells.pact?.max ? [actor.system.spells.pact.level] : [],
  getSpellSlotKey: level => level === 0 ? 'spell0' : 'pact',
  getLabel: ({ level } = {}) => level ? `Pact Magic — ${ordinal(level)}` : 'Pact Magic' })
const plain = (key, label, order) => ({ key, order, getAvailableLevels: () => [], getSpellSlotKey: () => key, getLabel: () => label })
const ABILITY_LABELS = { str: 'DND5E.AbilityStr', dex: 'DND5E.AbilityDex', con: 'DND5E.AbilityCon', int: 'DND5E.AbilityInt', wis: 'DND5E.AbilityWis', cha: 'DND5E.AbilityCha' }
CONFIG.DND5E = {
  abilities: Object.fromEntries(Object.entries(ABILITY_LABELS).map(([id, label]) => [id, { label, abbreviation: id }])),
  skills: { arc: { label: 'Arcana' }, dec: { label: 'Deception' } },
  currencies: {
    pp: { label: 'DND5E.CurrencyPP', abbreviation: 'DND5E.CurrencyAbbrPP' },
    gp: { label: 'DND5E.CurrencyGP', abbreviation: 'DND5E.CurrencyAbbrGP' },
    sp: { label: 'DND5E.CurrencySP', abbreviation: 'DND5E.CurrencyAbbrSP' },
  },
  weightUnits: { lb: { label: 'Pounds', abbreviation: 'DND5E.WeightUnitsLb' } },
  movementUnits: { ft: { label: 'Feet', abbreviation: 'DND5E.DistFtAbbr' } },
  encumbrance: { baseUnits: { default: { imperial: 'lb', metric: 'kg' } } },
  itemRarity: { rare: 'DND5E.ItemRarityRare' },
  spellcasting: { spell: multi, pact, atwill: plain('atwill', 'At-Will', -30), innate: plain('innate', 'Innate Spellcasting', -20), ritual: plain('ritual', 'Ritual Only', -10) },
  actorSizes: { med: { label: 'DND5E.SizeMedium' } },
  senses: { darkvision: 'DND5E.SenseDarkvision' },
  movementTypes: { walk: { label: 'DND5E.MovementWalk' }, fly: { label: 'DND5E.MovementFly' } },
  communicationTypes: { telepathy: { label: 'DND5E.Telepathy' } },
  traits: {
    saves: { labels: { title: 'DND5E.ClassSaves' } }, skills: { labels: { title: 'DND5E.Skills' } },
    languages: { labels: { title: 'DND5E.Languages' } },
    armor: { labels: { title: 'DND5E.TraitArmorProf' }, actorKeyPath: 'system.traits.armorProf' },
    tool: { labels: { title: 'DND5E.TraitToolProf' } },
    dr: { labels: { title: 'DND5E.DamRes' } }, di: { labels: { title: 'DND5E.DamImm' } },
    dm: { labels: { title: 'DND5E.DamMod' } }, ci: { labels: { title: 'DND5E.ConImm' } },
  },
  conditionTypes: {},
  limitedUsePeriods: { lr: { label: 'DND5E.USES.Recovery.Period.LongRest.Label' }, sr: { label: 'DND5E.USES.Recovery.Period.ShortRest.Label' }, dawn: { label: 'DND5E.USES.Recovery.Period.Dawn.Label' } },
  activityActivationTypes: {
    action: { label: 'Action', header: 'Actions' }, bonus: { label: 'Bonus Action', header: 'Bonus Actions' },
    reaction: { label: 'Reaction', header: 'Reactions' }, minute: { label: 'Minute', header: 'Minutes' },
    hour: { label: 'Hour', header: 'Hours' }, special: { label: 'Special' },
  },
  damageTypes: { piercing: { label: 'Piercing' }, bludgeoning: { label: 'Bludgeoning' }, slashing: { label: 'Slashing' }, fire: { label: 'Fire' }, force: { label: 'Force' } },
  healingTypes: { healing: { label: 'Healing' }, temphp: { label: 'Temporary Hit Points' } },
}
CONFIG.statusEffects = []
CONFIG.Item = { typeLabels: {}, dataModels: {
  weapon: { inventorySection: { id: 'weapons', order: 100, label: 'TYPES.Item.weaponPl' } },
  equipment: { inventorySection: { id: 'equipment', order: 200, label: 'TYPES.Item.equipmentPl' } },
  consumable: { inventorySection: { id: 'consumables', order: 300, label: 'TYPES.Item.consumablePl' } },
  tool: { inventorySection: { id: 'tool', order: 400, label: 'TYPES.Item.toolPl' } },
  container: { inventorySection: { id: 'containers', order: 500, label: 'TYPES.Item.containerPl' } },
  loot: { inventorySection: { id: 'loot', order: 600, label: 'TYPES.Item.lootPl' } },
  feat: {},
} }
const traitLabels = { fire: 'Fire', poison: 'Poison', charmed: 'Charmed', lgt: 'Light Armor', thief: "Thieves' Tools", herb: 'Herbalism Kit' }
globalThis.dnd5e = {
  utils: { staticID: id => id.padEnd(16, '0').slice(0, 16) },
  dataModels: { spellcasting: { SingleLevelSpellcasting } },
  documents: { Trait: { keyLabel: key => traitLabels[key] } },
}
foundry.applications.ux.TextEditor = { implementation: { async enrichHTML(html) {
  return html.replace(/\[\[\/(\w+) ([^\]]+)\]\]/g, '<a class="roll-link" data-type="$1"><i class="fa-solid fa-dice-d20"></i>$2</a>')
} } }
globalThis.fromUuid = async () => null
globalThis.fromUuidSync = () => null
foundry.utils.getProperty = (object, path) => path.split('.').reduce((o, k) => o?.[k], object)

users.activeGM = user('gm', 'Gamemaster', true)
user('alice', 'Alice')
const vex = actor('vex', 'Vex', ['alice'], 'character', { value: 0, max: 38, temp: 0 })
vex.documentName = 'Actor'
vex.img = 'worlds/erebor/vex.svg'
vex.statuses = new Set()
vex.allApplicableEffects = function* () {}
const ability = (value, proficient = 0) => {
  const mod = Math.floor((value - 10) / 2)
  return { value, mod, proficient, checkBonus: 0, checkProf: { term: '0', flat: 0 }, save: { value: mod + (proficient ? 3 : 0), roll: { mode: 0 } }, check: { roll: { mode: 0 } } }
}
vex.system = {
  abilities: { str: ability(8), dex: ability(14), con: ability(14), int: ability(17, 1), wis: ability(12, 1), cha: ability(16) },
  skills: {
    arc: { ability: 'int', total: 6, passive: 16, prof: { multiplier: 1 }, roll: { mode: 0 } },
    dec: { ability: 'cha', total: 6, passive: 16, prof: { multiplier: 1 }, roll: { mode: 0 } },
  },
  attributes: {
    hp: { value: 0, max: 38, temp: 0 }, ac: { value: 13 }, prof: 3, init: { total: 2 },
    movement: { walk: 30, fly: 60, hover: true, speed: 30, units: 'ft' },
    senses: { ranges: { darkvision: 60 }, units: 'ft', special: 'Sees invisibility within 10 ft' },
    encumbrance: { value: 62.5, max: 255, thresholds: { encumbered: 85, heavilyEncumbered: 170 } },
    attunement: { value: 1, max: 3 },
    spellcasting: 'int', spell: { dc: 14, attack: 6, mod: 3 },
    death: { success: 1, failure: 2 },
  },
  currency: { pp: 2, gp: 41.5, sp: 0 },
  spells: { spell1: { value: 3, max: 4, level: 1 }, spell2: { value: 0, max: 3, level: 2 }, pact: { value: 1, max: 2, level: 3 } },
  traits: {
    size: 'med',
    languages: { labels: { languages: ['Common', 'Infernal'] }, communication: { telepathy: { value: 30, units: 'ft' } } },
    armorProf: { value: new Set(['lgt']), custom: '' },
    dr: { value: new Set(['fire']), custom: '' },
    di: { value: new Set(), custom: '' },
    ci: { value: new Set(['charmed']) },
    dm: { amount: {} },
  },
  tools: { thief: { value: 1 }, herb: { value: 0 } },
  details: {
    level: 5, alignment: 'Chaotic Good', age: '24', gender: '', height: "5' 9\"", weight: '140 lb', eyes: 'Gold', hair: 'Black', skin: 'Crimson', faith: '  ',
    trait: 'I idolize a hero of the old tales, and measure my deeds against theirs.', ideal: 'Freedom. Chains are meant to be broken.', bond: '', flaw: 'I trust no one, not even my patron.',
    appearance: 'Curling horns, a long tail, and eyes like molten gold.\nShe wears a patched violet cloak.', xp: { value: 6500, max: 14000 },
    biography: { value: '<p>Born in the shadow of Mirkwood, Vex was raised by a wandering troupe.</p><h2>The Pact</h2><p>At sixteen she struck a bargain with a fiend, and has been <em>paying for it</em> ever since.</p>' },
  },
}
const items = new Map()
vex.items = { get: id => items.get(id), [Symbol.iterator]: () => items.values() }
// An item's activities, as dnd5e's ActivityCollection holds them.
class Activities {
  constructor(list) { this.list = list }
  get size() { return this.list.length }
  get contents() { return this.list }
  getByType(type) { return this.list.filter(activity => activity.type === type) }
  [Symbol.iterator]() { return this.list[Symbol.iterator]() }
}
const item = (id, type, name, { system = {}, labels = {}, flags = {}, text, activities = [], effects = 0, ...fields } = {}) => {
  const it = {
    documentName: 'Item', id, uuid: `Actor.vex.Item.${id}`, type, name, img: `icons/${id}.webp`, sort: 0,
    parent: vex, actor: vex, labels, flags, effects: { size: effects },
    system: { description: { value: text ?? `<p>About ${name}.</p>` }, activities: new Activities(activities), ...system },
    getFlag: (scope, key) => flags[scope]?.[key], getRollData: () => ({}), ...fields,
  }
  items.set(id, it)
  return it
}
// Activities as dnd5e 6 prepares them: labelled, the ability modifier in their damage.
const activity = (type, activation, { labels = {}, ...fields } = {}) => ({
  type, activation: { type: activation }, isHidden: false,
  labels: { activation: CONFIG.DND5E.activityActivationTypes[activation]?.label ?? activation, ...labels }, ...fields,
})
const hits = (formula, type) => ({ formula, label: `${formula} ${CONFIG.DND5E.damageTypes[type]?.label ?? CONFIG.DND5E.healingTypes[type]?.label}`, damageType: type })
const attack = (activation, modifier, damage, range, fields = {}) => activity('attack', activation, {
  labels: { modifier, toHit: `+${modifier}`, damage, target: '1 Creature' }, damage: { parts: damage }, getRangeLabel: () => range, ...fields,
})
const save = (activation, ability, dc, damage, labels = {}) => activity('save', activation, {
  labels: { damage, ...labels }, save: { ability: new Set([ability]), dc: { value: dc } }, damage: { parts: damage },
})
const physical = (fields = {}) => ({ quantity: 1, weight: { value: 0, units: 'lb' }, priceLabel: null, identified: true, ...fields })
item('dagger', 'weapon', 'Dagger', { sort: 2, labels: { properties: [{ label: 'Finesse' }, { label: 'Light' }, { label: 'Thrown' }] },
  system: physical({ quantity: 2, weight: { value: 1, units: 'lb' }, priceLabel: '2 GP', equipped: true }),
  activities: [attack('action', '5', [hits('1d4 + 3', 'piercing')], 'reach 5 ft or range 20/60 ft')] })
item('staff', 'weapon', 'Staff of Fire', { sort: 1, labels: { properties: [{ label: 'Magical' }] },
  text: '<p>You have resistance to fire damage while you hold this staff. It has 10 charges; cast <em>Fireball</em> for 3 of them, dealing [[/damage 8d6 fire]].</p>',
  system: physical({ weight: { value: 4, units: 'lb' }, priceLabel: '5000 GP', equipped: true, attunement: 'required', attuned: true, rarity: 'rare',
    uses: { max: 10, spent: 3, value: 7, recovery: [{ period: 'dawn' }] } }),
  activities: [attack('action', '2', [hits('1d6 - 1', 'bludgeoning')], 'reach 5 ft')] })
item('cursed', 'weapon', 'Unidentified Weapon', {
  system: physical({ equipped: true, identified: false, unidentified: { description: '<p>A blade of black iron, warm to the touch.</p>' }, description: { value: '<p>A Sword of Life Stealing.</p>' } }),
  activities: [attack('action', '7', [hits('1d8 + 3', 'slashing')], 'reach 5 ft')] })
item('mystery', 'equipment', 'Plain Ring', { labels: { properties: [{ label: 'Magical' }] },
  system: physical({ identified: false, unidentified: { description: '<p>A plain iron ring, cold to the touch.</p>' }, description: { value: '<p>A Ring of Three Wishes.</p>' },
    priceLabel: '50000 GP', attunement: 'required', rarity: 'rare', uses: { max: 3, value: 3, recovery: [] } }) })
item('potion', 'consumable', 'Potion of Healing', { text: '<p>You regain [[/heal 2d4 + 2]] hit points when you drink this potion.</p>',
  system: physical({ quantity: 3, weight: { value: 1.5, units: 'lb' }, priceLabel: '150 GP' }),
  activities: [activity('heal', 'action', { labels: { damage: [hits('2d4 + 2', 'healing')], range: 'Self' } })] })
const wand = item('wand', 'consumable', 'Wand of Magic Missiles', { system: physical({ priceLabel: '500 GP', uses: { max: 7, spent: 2, recovery: [{ period: 'dawn' }] } }),
  activities: [activity('cast', 'action', { labels: { range: '120 ft' } })] })
item('kit', 'tool', "Thieves' Tools", { system: physical({ weight: { value: 1, units: 'lb' }, priceLabel: '25 GP' }) })
item('gem', 'loot', 'Ruby', { system: physical({ priceLabel: '500 GP' }) })
item('pack', 'container', 'Backpack', { system: physical({ weight: { value: 5, units: 'lb' }, priceLabel: '2 GP', capacity: { weight: { value: 30, units: 'lb' } }, contentsWeight: 12.25 }) })
item('rope', 'loot', 'Hempen Rope', { text: '<p>50 feet of hempen rope. It has 2 hit points and can be burst with a DC 17 Strength check.</p>', system: physical({ container: 'pack', weight: { value: 10, units: 'lb' }, priceLabel: '1 GP' }) })
item('fey-step', 'feat', 'Fey Step', { system: { uses: { max: 2, spent: 0, recovery: [{ period: 'lr' }] }, properties: new Set() },
  text: '<p>You can teleport up to 30 feet to an unoccupied space you can see.</p>', activities: [activity('utility', 'bonus', { labels: { range: '30 ft' } })] })
item('curse', 'feat', "Hexblade's Curse", { system: { uses: { max: 1, spent: 1, recovery: [{ period: 'sr' }] }, properties: new Set() },
  activities: [activity('utility', 'bonus', { labels: { range: '30 ft', target: '1 Creature' } })] })
item('mind', 'feat', 'Eldritch Mind', { system: { properties: new Set(['trait']) } })
const spell = (id, name, level, method, { prepared = 0, labels = {}, properties = [], duration = { units: 'inst' }, uses, system = {}, ...fields } = {}) => item(id, 'spell', name, {
  labels: { school: 'Evocation', components: { vsm: 'V, S' }, activation: 'Action', range: '120 ft', duration: 'Instantaneous', ...labels },
  system: { level, method, prepared, canPrepare: ['spell', 'pact'].includes(method), properties: new Set(properties), duration,
    uses: uses ?? {}, hasLimitedUses: Boolean(uses), ...system }, ...fields,
})
spell('fire-bolt', 'Fire Bolt', 0, 'spell', { labels: { target: '1 Creature' }, text: '<p>You hurl a mote of fire. On a hit, the target takes [[/damage 2d10 fire]].</p>',
  activities: [attack('action', '6', [hits('2d10', 'fire')], '120 ft')] })
spell('blast', 'Eldritch Blast', 0, 'pact', { labels: { school: 'Evocation', target: '1 Creature' }, text: '<p>A beam of crackling energy streaks toward a creature within range.</p>',
  activities: [attack('action', '6', [hits('1d10 + 3', 'force')], '120 ft')] })
spell('shield', 'Shield', 1, 'spell', { prepared: 1, labels: { school: 'Abjuration', activation: 'Reaction', range: 'Self', duration: '1 Round' },
  text: '<p>An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.</p>',
  activities: [activity('utility', 'reaction', { labels: { range: 'Self' } })] })
spell('sleep', 'Sleep', 1, 'spell', { prepared: 0, duration: { units: 'minute', value: 1 }, labels: { school: 'Enchantment', range: '60 ft', duration: '1 Minute', components: { vsm: 'V, S, M' }, materials: 'A pinch of sand' },
  activities: [activity('utility', 'action')] })
spell('find', 'Find Familiar', 1, 'spell', { prepared: 2, properties: ['ritual'], labels: { school: 'Conjuration', activation: '1 Hour', range: '10 ft', duration: 'Instantaneous', components: { vsm: 'V, S, M' }, materials: 'Burning incense worth 10+ GP, which the spell consumes' },
  activities: [activity('summon', 'hour')] })
spell('mirror', 'Mirror Image', 2, 'spell', { prepared: 1, duration: { units: 'minute', value: 1 }, labels: { school: 'Illusion', range: 'Self', duration: '1 Minute' },
  activities: [activity('utility', 'action', { labels: { range: 'Self' } })] })
spell('misty', 'Misty Step', 2, 'spell', { prepared: 1, labels: { school: 'Conjuration', activation: 'Bonus Action', range: 'Self' },
  activities: [activity('utility', 'bonus', { labels: { range: 'Self' } })] })
spell('fireball', 'Fireball', 3, 'pact', { prepared: 1, labels: { range: '150 ft', target: '20 ft Sphere', components: { vsm: 'V, S, M' }, materials: 'A ball of bat guano and sulfur' },
  text: '<p>A bright streak flashes from you to a point you choose. Each creature in a 20-foot-radius Sphere makes a Dexterity saving throw, taking [[/damage 8d6 fire]] on a failed save, or half as much on a success.</p>',
  activities: [save('action', 'dex', 14, [hits('8d6', 'fire')], { range: '150 ft', target: '20 ft Sphere' })] })
spell('invisibility', 'Invisibility', 2, 'pact', { prepared: 1, properties: ['concentration'], duration: { units: 'hour', value: 1 }, labels: { school: 'Illusion', range: 'Touch', target: '1 Creature', duration: '1 Hour', concentrationDuration: 'Concentration, up to 1 Hour' },
  activities: [activity('utility', 'action')] })
spell('dim', 'Dimension Door', 4, 'spell', { prepared: 1, labels: { school: 'Conjuration', range: '500 ft' }, activities: [activity('utility', 'action')] })
spell('disguise', 'Disguise Self', 1, 'atwill', { duration: { units: 'hour', value: 1 }, labels: { school: 'Illusion', range: 'Self', duration: '1 Hour' }, activities: [activity('utility', 'action')] })
spell('hellish', 'Hellish Rebuke', 2, 'innate', { labels: { activation: 'Reaction', range: '60 ft' }, uses: { max: 1, value: 1, spent: 0, recovery: [{ period: 'lr' }] },
  activities: [save('reaction', 'dex', 14, [hits('2d10', 'fire')], { range: '60 ft' })] })
spell('detect', 'Detect Magic', 1, 'ritual', { labels: { school: 'Divination', range: 'Self', duration: '10 Minutes' }, properties: ['concentration', 'ritual'], activities: [activity('utility', 'action')] })
spell('wand-bolt', 'Magic Missile', 1, 'spell', { flags: { dnd5e: { cachedFor: 'wand' } }, system: { linkedActivity: { displayInSpellbook: true, item: wand } },
  activities: [activity('damage', 'action', { labels: { damage: [hits('3d4 + 3', 'force')], range: '120 ft' }, damage: { parts: [{}] } })] })
// The wand casts it through the copy of it dnd5e keeps, for a charge; the copy isn't an action of its own.
Object.assign(wand.system.activities.list[0], {
  id: 'wand-cast', name: 'Magic Missile', canUse: true, cachedSpell: items.get('wand-bolt'),
  consumption: { targets: [{ type: 'itemUses', target: '', value: '1' }] },
})
items.get('wand-bolt').flags.dnd5e.cachedFor = '.Item.wand.Activity.wand-cast'
// A coat of her own making that casts Burning Hands, which her spellbook doesn't list.
const coat = item('coat', 'equipment', 'Cinder Coat', { text: '<p>While you wear this coat, you can cast <em>Burning Hands</em> from it.</p>',
  system: physical({ equipped: true, weight: { value: 4, units: 'lb' } }), activities: [activity('cast', 'action', { labels: { range: 'Self' } })] })
spell('coat-hands', 'Burning Hands', 1, 'spell', { flags: { dnd5e: { cachedFor: 'coat' } }, system: { linkedActivity: { displayInSpellbook: false, item: coat } },
  activities: [save('action', 'dex', 14, [hits('3d6', 'fire')], { range: 'Self', target: '15 ft Cone' })] })
// The coat casts it through the copy of it dnd5e keeps; the copy isn't an action of its own.
Object.assign(coat.system.activities.list[0], { id: 'coat-cast', name: 'Burning Hands', canUse: true, cachedSpell: items.get('coat-hands'), consumption: { targets: [] } })
items.get('coat-hands').flags.dnd5e.cachedFor = '.Item.coat.Activity.coat-cast'
const wizard = { name: 'Wizard', spellcasting: { ability: 'int', save: 14, attack: 6 } }
const warlock = { name: 'Warlock', spellcasting: { ability: 'cha', save: 14, attack: 6 } }
vex.spellcastingClasses = { wizard, warlock }
const byType = {}
for (const it of items.values()) (byType[it.type] ??= []).push(it)
vex.itemTypes = byType

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['vex'] }])
await Hooks.callAll('ready')
await idle()
// From module 0.22.0 the hello goes first, its characters without their sheets; once it's answered,
// each sheet follows in a character.updated of its own, after the descriptions it refers to; and the
// app takes them all, answering the hello and the sheet with what it takes of sheets.
const helloAt = posted.findIndex(p => p.type === 'bridge.hello')
const sheetAt = posted.findIndex(p => p.type === 'character.updated')
const helloSent = posted[helloAt]?.data
check(helloAt >= 0 && helloSent.sheetsApart === true && helloSent.characters.length > 0 && helloSent.characters.every(c => !('sheet' in c))
  && posted.slice(0, helloAt).every(p => !['character.texts', 'character.updated'].includes(p.type))
  && sheetAt > helloAt && posted.slice(helloAt + 1, sheetAt).some(p => p.type === 'character.texts') && posted[sheetAt].data.character.sheet?.slim === 1
  && posted.slice(0, sheetAt + 1).every(p => p.status === 204 || (['bridge.hello', 'character.updated'].includes(p.type) && p.status === 200 && JSON.parse(p.body).features?.slimSheets === 1)),
  `the hello goes first, its characters without sheets, then the descriptions, then the sheet, slim, in a post of its own, and the app takes them all (${posted.map(p => `${p.type} ${p.size}B`).join(', ')})`)

// Every description the stored sheet refers to is kept.
const stored = JSON.parse(sql(`select s.data::text from actor_sheet s join campaign c on c.id = s."campaignId" where c.title = 'Ashlands'`))
const refs = new Set()
const walk = value => {
  if (Array.isArray(value)) value.forEach(walk)
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) (k === 'text' && typeof v === 'string') ? refs.add(v) : walk(v)
}
walk(stored)
refs.add(stored.details.biography)
const held = new Set(sql(`select hash from sheet_text t join campaign c on c.id = t."campaignId" where c.title = 'Ashlands'`).split('\n'))
check(refs.size >= 25 && [...refs].every(ref => held.has(ref)), `the app keeps every description the sheet refers to: its items', spells' and biography's, ${refs.size} of them`)
check(!JSON.stringify(stored).includes('Map to the Hoard') && !JSON.stringify(stored).includes('50000') && sql(`select count(*) from sheet_text where html like '%Wishes%' or html like '%Hoard%'`) === '0', "an unidentified ring's and puzzle box's secrets stay in Foundry")

// Alice plays Vex.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'sheet-vex', 'Vex', '${GAME}', 'Ashlands', id, 'vex', 'e2e-user', now() from campaign where title = 'Ashlands'`)


const LAYOUT_KEY = 'sending-stone:actions-layout'

/** A section's groups, each by its name, with its open actions' names. */
const groupsOf = (panel, section) => panel.getByRole('region', { name: section, exact: true }).locator('[role=group]').evaluateAll(groups =>
  groups.map(group => [group.querySelector('h3 [id]').textContent, [...group.querySelectorAll('li')].filter(li => li.checkVisibility()).map(li => li.querySelector('button .font-medium').textContent)]))
/** A section's group captions, each with its count and slots, as read. */
const captionsOf = (panel, section) => panel.getByRole('region', { name: section, exact: true }).locator('h3 button').allTextContents()
/** The button that closes or opens a group, by its name, then its count, as Chromium names it. */
const groupToggle = (scope, name) => scope.getByRole('button', { name: new RegExp(`^${name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*, \\d+ actions?\\b`) })
/** An action's button that opens it, found by its name. */
const opener = (panel, name) => panel.locator('button[aria-expanded]').filter({ has: panel.page().getByText(name, { exact: true }) }).first()
/** The slots an open action can be cast with, as shown; null for none shown. */
const castAt = (panel, name) => panel.evaluate((root, name) => {
  const button = [...root.querySelectorAll('button[aria-expanded="true"]')].find(open => open.querySelector('.font-medium')?.textContent === name)
  const details = document.getElementById(button.getAttribute('aria-controls'))
  const term = [...details.querySelectorAll('dt')].find(dt => dt.textContent === 'Cast at')
  return term ? [...term.nextElementSibling.querySelectorAll('li')].map(li => li.firstElementChild.textContent) : null
}, name)
/** The names of actions shown dimmed, as spells with no slot left are. */
const dimmed = panel => panel.locator('button[aria-expanded]').evaluateAll(all => all.filter(button => getComputedStyle(button).opacity === '0.6').map(button => button.querySelector('.font-medium').textContent))
/** What runs past the sheet's right edge. */
const overflowing = sheet => sheet.evaluate(region => [...region.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > region.getBoundingClientRect().right + 0.5).map(el => el.textContent.slice(0, 40)))
/** Each section's left edge and top, rounded. */
const boxes = (panel, names) => Promise.all(names.map(async name => {
  const box = await panel.getByRole('region', { name, exact: true }).boundingBox()
  return { name, x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) }
}))

/**
 * The sheet's settings, opened from the cog beside its tabs, and their layouts for the Actions
 * tab, where it offers more than one.
 */
const openSettings = async page => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.waitFor()
  return { settings, picker: settings.getByRole('group', { name: 'Actions layout' }) }
}
/** Close the sheet's settings, as Escape does. */
const closeSettings = async page => {
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Settings' }).waitFor({ state: 'detached' })
}
/** Choose a layout for the Actions tab in the sheet's settings, and close them. */
const chooseLayout = async (page, name) => {
  const { picker } = await openSettings(page)
  await picker.getByRole('button', { name, exact: true }).click()
  if (await picker.getByRole('button', { name, exact: true }).getAttribute('aria-pressed') !== 'true') throw new Error(`FAIL: ${name} is chosen in the sheet's settings, which stay open`)
  await closeSettings(page)
}

/** The sheet on Actions, in a new browser of this size. */
const openActions = async ({ width, height, mobile = false, scheme = 'light', name, stored }) => {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, colorScheme: scheme })
  await view.addCookies([cookie])
  await serveAssets(view)
  if (stored) await view.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, stored])
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${name} pageerror: ${e.message}`))
  await page.goto(`${BASE}/characters/sheet-vex`)
  const sheet = page.getByRole('region', { name: 'Character' })
  await sheet.getByRole('button', { name: /^Intelligence check/ }).waitFor()
  const showActions = async () => {
    await sheet.getByRole('tablist', { name: 'Character sheet' }).getByRole('tab', { name: 'Actions', exact: true }).click()
    await sheet.getByRole('tabpanel').getByRole('heading', { name: 'Actions', exact: true }).waitFor()
  }
  await showActions()
  return { view, page, sheet, panel: sheet.getByRole('tabpanel'), showActions }
}

// ---- On a phone ----
let { view, page, sheet, panel, showActions } = await openActions({ width: 390, height: 844, mobile: true, scheme: 'dark', name: 'phone' })
check(same(await panel.getByRole('heading', { level: 2 }).allTextContents(), ['Actions', 'Bonus Actions', 'Reactions']), 'her actions are in sections by how each is activated, as before')
const actionGroups = await groupsOf(panel, 'Actions')
check(same(actionGroups, [
  ['Weapons', ['Unidentified Weapon', 'Staff of Fire', 'Dagger']],
  ['Equipment', ['Cinder Coat']],
  ['Consumables', ['Potion of Healing', 'Wand of Magic Missiles']],
  ['Cantrips', ['Eldritch Blast', 'Fire Bolt']],
  ['Pact Magic — 3rd Level', ['Fireball']],
  ['2nd Level', ['Mirror Image']],
]), `within Actions they're grouped as Tidy 5e groups by where things come from: what she carries by kind, then spells as her spellbook groups them; the spells her coat and wand cast are cast from them: ${JSON.stringify(actionGroups)}`)
const actionCaptions = await captionsOf(panel, 'Actions')
check(same(actionCaptions, ['Weapons3, 3 actions', 'Equipment1, 1 action', 'Consumables2, 2 actions', 'Cantrips2, 2 actions', 'Pact Magic — 3rd Level1, 1 action1/21 of 2 spell slots left',
  '2nd Level1, 1 action0/30 of 3 spell slots left']), `each group shows how many it holds, and a spell level or pact magic its slots: ${actionCaptions.join(' | ')}`)
check(actionGroups.filter(([name]) => /1st Level|Cinder Coat|Wand of/.test(name)).length === 0, "Burning Hands, cast from her coat and not in her spellbook, is the coat's to cast, with no group of its own")
const bonusGroups = await groupsOf(panel, 'Bonus Actions')
check(same(bonusGroups, [['2nd Level', ['Misty Step']], ['Features', ['Fey Step', "Hexblade's Curse"]]]), `bonus actions: a 2nd-level spell, then her features: ${JSON.stringify(bonusGroups)}`)
const reactionGroups = await groupsOf(panel, 'Reactions')
check(same(reactionGroups, [['Innate Spellcasting', ['Hellish Rebuke']], ['1st Level', ['Shield']]]) && same(await captionsOf(panel, 'Reactions'), ['Innate Spellcasting1, 1 action', '1st Level1, 1 action3/43 of 4 spell slots left']),
  `reactions: her innate spell, then a 1st-level one with its slots: ${JSON.stringify(reactionGroups)}`)
let { settings: phoneSettings } = await openSettings(page)
check(await phoneSettings.getByRole('group', { name: 'Actions layout' }).count() === 0 && await page.getByRole('group', { name: /Layout/i }).count() === 0,
  "on a phone there are no layouts to choose, in the sheet's settings or on the tab; the list scrolls as before")
await closeSettings(page)
check(same(await dimmed(panel), []), 'with a pact slot left, every spell can be cast')
if (SHOTS) await shoot(page, 'phone-groups')

const consumables = groupToggle(panel, 'Consumables')
await consumables.click()
check(await consumables.getAttribute('aria-expanded') === 'false' && same((await groupsOf(panel, 'Actions'))[2], ['Consumables', []]) && await panel.getByRole('button', { name: /^Potion of Healing/ }).count() === 0,
  'she closes Consumables, and its actions are out of the way')
await page.reload()
await sheet.getByRole('button', { name: /^Intelligence check/ }).waitFor()
await showActions()
check(await groupToggle(panel, 'Consumables').getAttribute('aria-expanded') === 'false', 'and it stays closed when she comes back')
if (SHOTS) await shoot(page, 'phone-closed')
await groupToggle(panel, 'Consumables').click()
check(same((await groupsOf(panel, 'Actions'))[2], ['Consumables', ['Potion of Healing', 'Wand of Magic Missiles']]), 'until she opens it again')

await opener(panel, 'Mirror Image').click()
const mirrorAt = await castAt(panel, 'Mirror Image')
check(same(mirrorAt, ['2nd 0/3', 'Pact 3rd 1/2']), `Mirror Image opens to the slots it can be cast with: no 2nd-level slot is left, but a pact slot, at 3rd level, is (${mirrorAt})`)
await opener(panel, 'Fireball').click()
check(same(await castAt(panel, 'Fireball'), ['Pact 3rd 1/2']), 'Fireball, a 3rd-level pact spell, only with a pact slot')
await opener(panel, 'Fire Bolt').click()
check(await castAt(panel, 'Fire Bolt') === null, 'a cantrip needs no slot')
if (SHOTS) {
  await opener(panel, 'Mirror Image').scrollIntoViewIfNeeded()
  await shoot(page, 'phone-cast-at')
}

// She spends her last pact slot in Foundry.
vex.system.spells.pact.value = 0
await Hooks.callAll('updateActor', vex, { system: { spells: { pact: { value: 0 } } } })
await new Promise(resolve => setTimeout(resolve, 400))
await idle()
await groupToggle(panel.getByRole('region', { name: 'Actions', exact: true }), 'Pact Magic — 3rd Level').filter({ hasText: '0/2' }).waitFor({ timeout: 20_000 })
const spent = await dimmed(panel)
check(same(spent.toSorted(), ['Fireball', 'Mirror Image', 'Misty Step']), `when she spends her last pact slot in Foundry, the spells with no slot left to cast them dim (${spent})`)
const noSlots = await panel.getByText(/· No slots left$/).allTextContents()
const mirrorSpent = await castAt(panel, 'Mirror Image')
check(noSlots.length === 3 && same(mirrorSpent, ['2nd 0/3', 'Pact 3rd 0/2']), `and say so (${noSlots.join(' | ')}), Mirror Image with every slot it could use spent (${mirrorSpent})`)
check(!spent.includes('Shield') && !spent.includes('Hellish Rebuke'), 'Shield still has 1st-level slots, and Hellish Rebuke its own use')
if (SHOTS) await shoot(page, 'phone-no-slots')

// Turned on its side, the phone is as wide as a small tablet.
await page.setViewportSize({ width: 844, height: 390 })
await chooseLayout(page, 'Table')
await panel.getByRole('table', { name: 'Actions', exact: true }).waitFor()
check(true, 'turned sideways, the phone offers the layouts, and shows a table')
await page.setViewportSize({ width: 390, height: 844 })
await panel.locator('[role=group] li').first().waitFor()
;({ settings: phoneSettings } = await openSettings(page))
check(await panel.getByRole('table').count() === 0 && await phoneSettings.getByRole('group', { name: 'Actions layout' }).count() === 0, 'turned back, it lists them again, with no layouts to choose')
await closeSettings(page)
await page.setViewportSize({ width: 844, height: 390 })
await panel.getByRole('table', { name: 'Actions', exact: true }).waitFor({ timeout: 5_000 })
check(true, 'and sideways again, the table it chose')
await view.close()

// ---- On a tablet, upright ----
;({ view, page, sheet, panel, showActions } = await openActions({ width: 820, height: 1180, mobile: true, name: 'tablet' }))
const { picker } = await openSettings(page)
check(same(await picker.getByRole('button').evaluateAll(all => all.map(button => [button.textContent, button.getAttribute('aria-pressed')])), [['List', 'true'], ['Columns', 'false'], ['Table', 'false']]),
  "on a tablet she can lay her actions out three ways, in the sheet's settings, listed to start with")
await closeSettings(page)
if (SHOTS) await shoot(page, 'tablet-list')

await chooseLayout(page, 'Columns')
let [actions, bonus, reactions] = await boxes(panel, ['Actions', 'Bonus Actions', 'Reactions'])
check(actions.x < bonus.x && bonus.x === reactions.x && actions.y === bonus.y && reactions.y > bonus.y,
  `in columns, Actions takes the left, and Bonus Actions and Reactions sit beside it (${JSON.stringify([actions, bonus, reactions])})`)
check((await overflowing(sheet)).length === 0, 'nothing runs past the sheet')
if (SHOTS) await shoot(page, 'tablet-columns')

await chooseLayout(page, 'Table')
const actionsTable = panel.getByRole('table', { name: 'Actions', exact: true })
await actionsTable.waitFor()
check(await panel.getByRole('table').count() === 3 && same(await actionsTable.getByRole('columnheader').allTextContents(), ['Name', 'Range', 'Hit / DC', 'Damage', 'Uses']),
  'as a table, each section is one, with columns for range, to hit or DC, damage and uses')
// Chromium shows a header for a group of rows as a cell of its own; it's found as a th.
const rowHeaders = await actionsTable.locator('tbody th').allTextContents()
check(same(rowHeaders, ['Weapons3, 3 actions', 'Equipment1, 1 action', 'Consumables2, 2 actions', 'Cantrips2, 2 actions', 'Pact Magic — 3rd Level1, 1 action0/20 of 2 spell slots left',
  '2nd Level1, 1 action0/30 of 3 spell slots left']),
  `its groups head their rows, with their slots (${rowHeaders.join(' | ')})`)
const columnLefts = await actionsTable.locator('tbody tr').evaluateAll(rows => rows.filter(row => row.children.length === 5)
  .map(row => [...row.children].slice(1).map(cell => Math.round(cell.getBoundingClientRect().left))))
check(columnLefts.length === 10 && [0, 1, 2, 3].every(column => new Set(columnLefts.map(row => row[column])).size === 1),
  `every action's range, to hit, damage and uses line up in their columns (${JSON.stringify(columnLefts[0])} on each of ${columnLefts.length} rows)`)
check(await panel.locator('table').evaluateAll(all => all.every(table => table.parentElement.scrollWidth <= table.parentElement.clientWidth)) && (await overflowing(sheet)).length === 0, 'the tables fit the sheet')
await actionsTable.getByRole('button', { name: 'Fireball damage, 8d6' }).click()
await page.getByRole('region', { name: 'Your rolls' }).getByRole('status').filter({ hasText: 'Fireball damage' }).waitFor({ timeout: 25_000 })
check(true, 'and rolls from it, as from the list')
await opener(panel, 'Mirror Image').click()
check(same(await castAt(panel, 'Mirror Image'), ['2nd 0/3', 'Pact 3rd 0/2']), 'an action opens in a row of its own, spell slots and all')
await panel.getByText('About Mirror Image.').or(panel.getByText(/Three illusory duplicates/)).first().waitFor({ timeout: 10_000 }).catch(() => {})
if (SHOTS) await shoot(page, 'tablet-table')

await page.reload()
await sheet.getByRole('button', { name: /^Intelligence check/ }).waitFor()
await showActions()
await panel.getByRole('table', { name: 'Actions', exact: true }).waitFor()
const { picker: kept } = await openSettings(page)
check(await kept.getByRole('button', { name: 'Table', exact: true }).getAttribute('aria-pressed') === 'true', 'the tablet remembers the table')
await closeSettings(page)

const tableWeapons = groupToggle(panel.getByRole('table', { name: 'Actions', exact: true }), 'Weapons')
await tableWeapons.click()
const shownRows = await panel.getByRole('table', { name: 'Actions', exact: true }).locator('tbody tr').evaluateAll(rows => rows.filter(row => row.children.length === 5 && row.checkVisibility()).length)
check(await tableWeapons.getAttribute('aria-expanded') === 'false' && shownRows === 7 && await panel.getByRole('button', { name: 'Dagger', exact: true }).count() === 0,
  `in the table, closing Weapons hides its three rows (${shownRows} left)`)
await chooseLayout(page, 'Columns')
check(await groupToggle(panel, 'Weapons').getAttribute('aria-expanded') === 'false', 'and Weapons stays closed in columns')
if (SHOTS) await shoot(page, 'tablet-columns-closed')
await groupToggle(panel, 'Weapons').click()
await chooseLayout(page, 'Table')
await view.close()

// ---- On a tablet turned sideways, beside combat and the chat ----
;({ view, page, sheet, panel } = await openActions({ width: 1024, height: 768, mobile: true, name: 'tablet sideways', stored: 'columns' }))
const sheetWidth = await sheet.evaluate(region => Math.round(region.getBoundingClientRect().width))
const { picker: narrowPicker } = await openSettings(page)
check(same(await narrowPicker.getByRole('button').evaluateAll(all => all.map(button => [button.textContent, button.getAttribute('aria-pressed')])), [['List', 'true'], ['Table', 'false']]),
  `beside the chat the sheet is ${sheetWidth} pixels wide, too narrow for two columns, so columns aren't offered, and her actions are listed`)
await closeSettings(page)
;[actions, bonus] = await boxes(panel, ['Actions', 'Bonus Actions'])
check(actions.x === bonus.x && bonus.y > actions.y && (await overflowing(sheet)).length === 0, 'one section under another, nothing running past the sheet')
if (SHOTS) await shoot(page, 'tablet-sideways-list')
await chooseLayout(page, 'Table')
await panel.getByRole('table', { name: 'Actions', exact: true }).waitFor()
check(await panel.locator('table').evaluateAll(all => all.every(table => table.parentElement.scrollWidth <= table.parentElement.clientWidth)) && (await overflowing(sheet)).length === 0, 'and the tables fit it too')
if (SHOTS) await shoot(page, 'tablet-sideways-table')
await view.close()

// ---- On a laptop and a wide screen ----
for (const [width, height, columns] of [[1440, 900, 2], [1920, 1080, 3]]) {
  ;({ view, page, sheet, panel } = await openActions({ width, height, name: `${width}`, stored: 'columns' }))
  const placed = await boxes(panel, ['Actions', 'Bonus Actions', 'Reactions'])
  const lefts = [...new Set(placed.map(box => box.x))]
  check(lefts.length === columns && placed[0].x === lefts[0], `at ${width} pixels, the sections stand in ${columns} columns (${JSON.stringify(placed)})`)
  check((await overflowing(sheet)).length === 0 && await page.evaluate(() => document.scrollingElement.scrollHeight === document.scrollingElement.clientHeight), `nothing runs past the sheet, and the page itself doesn't scroll, at ${width} pixels`)
  if (SHOTS) await shoot(page, `laptop-${width}-columns`)
  await chooseLayout(page, 'Table')
  await panel.getByRole('table', { name: 'Actions', exact: true }).waitFor()
  if (SHOTS) await shoot(page, `laptop-${width}-table`)
  await view.close()
}

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors')
await browser.close()
process.exit(0)
