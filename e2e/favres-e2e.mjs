// Old-style resources that stand for features, as favorites (#151, module 0.23.0), end to end: the
// real module, in a stand-in Foundry, sends Vex, a synthetic tiefling wizard and warlock, whose
// dnd5e resources dnd5e lists first among her favorites: Arcane Recovery, which no feature of hers
// is; "Hexblade’s Curse", with a typographic apostrophe, the label of her feature "Hexblade's
// Curse"; and "Fey Magic", which only her Fey Step spends. The module says which feature each
// stands for, and on a phone and a tablet the app shows each as that feature's own row, its
// description and activation, with the resource's count; Fey Step's own favorite is shown once, and
// both features are starred where the sheet lists them. Arcane Recovery stays a counter. Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { actor, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'

const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
if (SHOTS) (await import('node:fs')).mkdirSync(SHOTS, { recursive: true })
const cookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
// Shown, once it has had the time to show.
const shown = locator => locator.waitFor({ timeout: 10_000 }).then(() => true, () => false)
// A screenshot once its transitions have finished.
const shoot = async (page, name) => {
  if (!SHOTS) return
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/favres-${name}.png` })
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
  'DND5E.EffectTemporary': 'Temporary Effects',
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
const mageArmor = { id: 'magearmor', name: 'Mage Armor', img: 'icons/magearmor.webp', disabled: false, isSuppressed: false, isTemporary: true,
  statuses: new Set(), duration: { remaining: 28800, label: '8 Hours' }, description: '<p>Your base Armor Class becomes 13 plus your Dexterity modifier.</p>',
  parent: vex, origin: null, system: {} }
vex.effects = { get: id => (id === mageArmor.id ? mageArmor : undefined), [Symbol.iterator]: function* () { yield mageArmor } }
vex.allApplicableEffects = function* () { yield mageArmor }
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
  spells: { spell1: { value: 3, max: 4, level: 1, type: 'spell' }, spell2: { value: 0, max: 3, level: 2, type: 'spell' }, pact: { value: 1, max: 2, level: 3, type: 'pact' } },
  traits: {
    size: 'med',
    languages: { labels: { languages: ['Common', 'Infernal'] }, communication: { telepathy: { value: 30, units: 'ft' } } },
    armorProf: { value: new Set(['lgt']), custom: '' },
    dr: { value: new Set(['fire']), custom: '' },
    di: { value: new Set(), custom: '' },
    ci: { value: new Set(['charmed']) },
    dm: { amount: {} },
  },
  tools: { thief: { value: 1, ability: 'dex', total: 5, prof: { multiplier: 1 }, roll: { mode: 0 } }, herb: { value: 0, ability: 'wis', total: 1, prof: { multiplier: 0 } } },
  // Her feature's name with a typographic apostrophe, as an importer may write it; and a pool named
  // for no feature, which one feature spends.
  resources: {
    primary: { label: 'Arcane Recovery', value: 1, max: 1, sr: false, lr: true },
    secondary: { label: 'Hexblade\u2019s Curse', value: 0, max: 1, sr: true },
    tertiary: { label: 'Fey Magic', value: 1, max: 2, lr: true },
  },
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
  get(id) { return this.list.find(activity => activity.id === id) }
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
  activities: [attack('action', '2', [hits('1d6 - 1', 'bludgeoning')], 'reach 5 ft'),
    { ...save('action', 'dex', 15, [hits('8d6', 'fire')], { range: '150 ft', target: '20 ft Sphere' }), id: 'castfire', name: 'Cast Fireball',
      img: 'systems/dnd5e/icons/svg/activity/save.svg', uses: { max: 3, spent: 1, recovery: [{ period: 'dawn' }] } }] })
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
// Fey Step spends Fey Magic, as an item from before dnd5e's activities does once dnd5e prepares
// it; its own uses stay 2 of 2.
item('fey-step', 'feat', 'Fey Step', { system: { uses: { max: 2, spent: 0, recovery: [{ period: 'lr' }] }, properties: new Set() },
  text: '<p>You can teleport up to 30 feet to an unoccupied space you can see.</p>', activities: [activity('utility', 'bonus', {
    labels: { range: '30 ft' }, consumption: { targets: [{ type: 'attribute', target: 'resources.tertiary.value', value: '1' }] },
  })] })
item('curse', 'feat', "Hexblade's Curse", { system: { uses: { max: 1, spent: 1, recovery: [{ period: 'sr' }] }, properties: new Set() },
  text: '<p>You place a curse on a creature you can see within 30 feet, for a minute.</p>',
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
// A coat of her own making that casts Burning Hands, which her spellbook doesn't list.
const coat = item('coat', 'equipment', 'Cinder Coat', { text: '<p>While you wear this coat, you can cast <em>Burning Hands</em> from it.</p>',
  system: physical({ equipped: true, weight: { value: 4, units: 'lb' } }), activities: [activity('cast', 'action', { labels: { range: 'Self' } })] })
spell('coat-hands', 'Burning Hands', 1, 'spell', { flags: { dnd5e: { cachedFor: 'coat' } }, system: { linkedActivity: { displayInSpellbook: false, item: coat } },
  activities: [save('action', 'dex', 14, [hits('3d6', 'fire')], { range: 'Self', target: '15 ft Cone' })] })
const wizard = { name: 'Wizard', spellcasting: { ability: 'int', save: 14, attack: 6 } }
const warlock = { name: 'Warlock', spellcasting: { ability: 'cha', save: 14, attack: 6 } }
vex.spellcastingClasses = { wizard, warlock }
vex.system.favorites = [
  { type: 'item', id: '.Item.dagger', sort: 100000 },
  { type: 'activity', id: '.Item.staff.Activity.castfire', sort: 200000 },
  { type: 'item', id: '.Item.fire-bolt', sort: 300000 },
  { type: 'item', id: '.Item.potion', sort: 400000 },
  { type: 'slots', id: 'pact', sort: 500000 },
  { type: 'item', id: '.Item.find', sort: 600000 },
  { type: 'skill', id: 'arc', sort: 700000 },
  { type: 'tool', id: 'thief', sort: 800000 },
  { type: 'effect', id: '.ActiveEffect.magearmor', sort: 900000 },
  { type: 'item', id: '.Item.rope', sort: 1000000 },
  { type: 'item', id: '.Item.mind', sort: 1100000 },
  // A feature that a resource stands for, made a favorite too.
  { type: 'item', id: '.Item.fey-step', sort: 1150000 },
]
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


const escape = text => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
const favorites = stored.favorites
check(same(favorites.map(f => [f.type, f.id]), [
  ['resource', 'primary'], ['resource', 'secondary'], ['resource', 'tertiary'], ['item', 'dagger'], ['activity', 'castfire'], ['item', 'fire-bolt'],
  ['item', 'potion'], ['slots', 'pact'], ['item', 'find'], ['skill', 'arc'], ['tool', 'thief'], ['effect', 'magearmor'], ['item', 'rope'], ['item', 'mind'],
  ['item', 'fey-step'],
]), `the app keeps her 15 favorites as the module sends them, her resources first, then hers in her order: ${favorites.map(f => f.name).join(', ')}`)
// Module 0.23.0 says which feature each resource stands for, in the slim sheet it posts as in the one kept.
const linked = list => list.filter(f => f.type === 'resource').map(f => [f.id, f.itemId])
const sent = posted.findLast(p => p.type === 'character.updated').data.character.sheet
check(same(linked(favorites), [['primary', null], ['secondary', 'curse'], ['tertiary', 'fey-step']]) && same(linked(sent.favorites), linked(favorites)),
  `each resource names the feature it stands for: Arcane Recovery none, Hexblade’s Curse its feature of that name, folded, and Fey Magic the only feature that spends it (${JSON.stringify(linked(favorites))})`)

const NAMES = ['Arcane Recovery', "Hexblade's Curse", 'Fey Step', 'Dagger', 'Cast Fireball', 'Fire Bolt', 'Potion of Healing', 'Pact Magic — 3rd Level', 'Find Familiar', 'Arcana', "Thieves' Tools", 'Mage Armor', 'Hempen Rope', 'Eldritch Mind']

/** The names of the rows shown in a list of them, in order. */
const namesIn = scope => scope.locator('li').evaluateAll(rows => rows.filter(row => row.checkVisibility() && !row.parentElement.closest('li')).map(row => row.querySelector('.font-medium')?.textContent))
/** The names of the rows starred in a part of the sheet. */
const starredIn = scope => scope.getByText(', favorite', { exact: true }).evaluateAll(stars => stars.map(star => star.closest('li').querySelector('.font-medium').textContent))
/** What runs past the sheet's right edge. */
const overflowing = sheet => sheet.evaluate(region => [...region.querySelectorAll('*')].filter(el => el.checkVisibility() && el.getBoundingClientRect().right > region.getBoundingClientRect().right + 0.5).map(el => el.textContent.slice(0, 40)))

/** The sheet in a new browser of this size, on a tab. */
const openSheet = async ({ width, height, mobile = false, scheme = 'light', name, tab = 'Actions' }) => {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, colorScheme: scheme })
  await view.addCookies([cookie])
  await serveAssets(view)
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${name} pageerror: ${e.message}`))
  await page.goto(`${BASE}/characters/sheet-vex`)
  const sheet = page.getByRole('region', { name: 'Character' })
  await sheet.getByRole('button', { name: /^Intelligence check/ }).waitFor()
  const panel = sheet.getByRole('tabpanel')
  const showTab = async label => {
    await sheet.getByRole('tablist', { name: 'Character sheet' }).getByRole('tab', { name: new RegExp(`^${label}`) }).click()
    await panel.and(page.locator(`[aria-labelledby="sheet-tab-${label.toLowerCase()}"]`)).waitFor()
  }
  if (tab) await showTab(tab)
  const status = page.getByRole('region', { name: 'Your rolls' }).getByRole('status')
  const rolled = text => status.filter({ hasText: text }).waitFor({ timeout: 25_000 })
  return { view, page, sheet, panel, showTab, status, rolled }
}

// ---- On a phone ----
let { view, page, sheet, panel, showTab } = await openSheet({ width: 390, height: 844, mobile: true, scheme: 'dark', name: 'phone' })
let strip = panel.getByRole('region', { name: 'Favorites' })
const heading = await panel.locator('section').first().evaluate(section => section.querySelector('h2')?.textContent)
check(heading.startsWith('Favorites14'), `on a phone, her favorites come first on Actions, 14 of them, Fey Step's own shown once (${heading})`)
check(same(await namesIn(strip), NAMES), `her resources first, two as the features they stand for, then hers in her order: ${(await namesIn(strip)).join(', ')}`)

/** A row of the strip: what its toggle says, its count, and how that count is coloured. */
const rowOf = async name => {
  const row = strip.locator('li').filter({ has: page.getByText(name, { exact: true }) }).first()
  const toggle = row.getByRole('button', { name: new RegExp(`^${escape(name)}`), expanded: false })
  return {
    row, toggle,
    said: await toggle.count() ? await toggle.first().textContent() : null,
    text: (await row.innerText()).replaceAll('\n', ' | '),
    left: await row.evaluate(el => [...el.querySelectorAll('.sr-only')].map(span => span.textContent).find(text => / of \d+ uses left$/.test(text)) ?? null),
    ruby: await row.evaluate(el => [...el.querySelectorAll('.sr-only')].find(span => / of \d+ uses left$/.test(span.textContent))?.parentElement.classList.contains('text-ruby') ?? false),
  }
}
const curse = await rowOf("Hexblade's Curse")
check(curse.said?.startsWith("Hexblade's CurseBonus Action · 30 ft") && curse.text.includes('0/1') && curse.left === '0 of 1 uses left' && curse.ruby,
  `Hexblade’s Curse is the feature's row, as on Actions, with the resource's count, none left, in ruby: "${curse.said}", ${curse.left}`)
await curse.toggle.first().click()
await strip.getByText('You place a curse on a creature', { exact: false }).waitFor({ timeout: 10_000 })
check(true, 'and opens to its description')
await strip.getByRole('button', { name: /^Hexblade's Curse/, expanded: true }).click()
const fey = await rowOf('Fey Step')
check(fey.said?.startsWith('Fey StepFey Magic · Bonus Action') && fey.left === '1 of 2 uses left' && fey.text.includes('1/2') && !fey.text.includes('2/2')
  && await strip.locator('li').filter({ has: page.getByText('Fey Step', { exact: true }) }).count() === 1,
  `Fey Step, which Fey Magic stands for though named otherwise, says the pool first and shows its count, 1/2, not its own 2/2, once: "${fey.said}", ${fey.left}`)
await fey.toggle.first().click()
await strip.getByText('You can teleport up to 30 feet', { exact: false }).waitFor({ timeout: 10_000 })
check(true, 'and opens to its description')
await strip.getByRole('button', { name: /^Fey Step/, expanded: true }).click()
const recovery = await strip.locator('li').filter({ hasText: 'Arcane Recovery' }).innerText()
check(recovery.replaceAll('\n', ' | ') === 'Arcane Recovery | Long Rest | 1/1 | 1 of 1 uses left' && await strip.getByRole('button', { name: /^Arcane Recovery/ }).count() === 0,
  `Arcane Recovery, which no feature is, stays a counter, with nothing to open: ${recovery.replaceAll('\n', ' | ')}`)
check(await strip.getByText(', favorite', { exact: false }).count() === 0, 'none of them starred, as all of them are favorites')
check(same(await starredIn(panel.getByRole('region', { name: 'Bonus Actions', exact: true })), ['Fey Step', "Hexblade's Curse"]),
  `in Actions, Bonus Actions star Fey Step and Hexblade’s Curse: ${await starredIn(panel.getByRole('region', { name: 'Bonus Actions', exact: true }))}`)
check(same(await overflowing(sheet), []), 'nothing runs past the edge of the phone on Actions')
await shoot(page, 'phone-actions')
await showTab('Features')
check(same(await starredIn(panel), ['Eldritch Mind', 'Fey Step', "Hexblade's Curse"]), `on Features, Eldritch Mind, Fey Step and Hexblade’s Curse are starred: ${await starredIn(panel)}`)
check(same(await overflowing(sheet), []), 'nothing runs past the edge on Features')
await view.close()

// ---- On a tablet ----
;({ view, page, sheet, panel, showTab } = await openSheet({ width: 768, height: 1024, mobile: true, name: 'tablet' }))
strip = panel.getByRole('region', { name: 'Favorites' })
const lists = strip.getByRole('list')
const first = await namesIn(lists.first())
check(await lists.count() === 2 && same(first, NAMES.slice(0, 7)) && same(await namesIn(lists.last()), NAMES.slice(7)),
  `on a tablet, in two lists side by side, both features the resources stand for in the first: ${first.join(', ')}`)
const counts = await lists.first().locator('li').evaluateAll(rows => rows.filter(row => !row.parentElement.closest('li'))
  .map(row => [row.querySelector('.font-medium')?.textContent, [...row.querySelectorAll('.sr-only')].map(span => span.textContent).find(text => / of \d+ uses left$/.test(text)) ?? null]))
check(same(counts.slice(0, 3), [['Arcane Recovery', '1 of 1 uses left'], ["Hexblade's Curse", '0 of 1 uses left'], ['Fey Step', '1 of 2 uses left']]),
  `with the resources' counts: ${JSON.stringify(counts.slice(0, 3))}`)
check(same(await overflowing(sheet), []), 'nothing runs past the edge')
await shoot(page, 'tablet-actions')
await view.close()

check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, `no page errors (${problems.join('; ')})`)
await browser.close()
process.exit(0)
