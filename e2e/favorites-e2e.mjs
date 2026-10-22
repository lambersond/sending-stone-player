// Favorites, end to end: the real module (in a stand-in Foundry, with a dnd5e-shaped Vex, a
// tiefling wizard and warlock) sends what she made a favorite in Foundry to the production app. On
// a phone and a tablet, Alice finds them at the top of Actions, Inventory, Spells and Effects; on a
// laptop and a wide screen, in a column beside them. Each rolls, opens and shows its uses as it
// does where the sheet lists it, and each is starred there. Screenshots to SHOTS.
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
  resources: { primary: { label: 'Arcane Recovery', value: 1, max: 1, sr: false, lr: true }, secondary: { label: '', value: 0, max: 0 } },
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
  ['resource', 'primary'], ['item', 'dagger'], ['activity', 'castfire'], ['item', 'fire-bolt'], ['item', 'potion'], ['slots', 'pact'],
  ['item', 'find'], ['skill', 'arc'], ['tool', 'thief'], ['effect', 'magearmor'], ['item', 'rope'], ['item', 'mind'],
]), `the app keeps her favorites as the module sends them, her resource first, then hers in her order: ${favorites.map(f => f.name).join(', ')}`)

const NAMES = ['Arcane Recovery', 'Dagger', 'Cast Fireball', 'Fire Bolt', 'Potion of Healing', 'Pact Magic — 3rd Level', 'Find Familiar', 'Arcana', "Thieves' Tools", 'Mage Armor', 'Hempen Rope', 'Eldritch Mind']

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
let { view, page, sheet, panel, showTab, status, rolled } = await openSheet({ width: 390, height: 844, mobile: true, scheme: 'dark', name: 'phone' })
let strip = panel.getByRole('region', { name: 'Favorites' })
check((await panel.locator('section').first().evaluate(section => section.querySelector('h2')?.textContent)).startsWith('Favorites12'), 'on a phone, her favorites come first on Actions, under a heading that counts them')
check(same(await namesIn(strip), NAMES), `in the order she gave them in Foundry: ${(await namesIn(strip)).join(', ')}`)
const daggerRow = await strip.getByRole('button', { name: /^Dagger/, expanded: false }).textContent()
const fireballRow = await strip.getByRole('button', { name: /^Cast Fireball/, expanded: false }).textContent()
check(daggerRow === 'Dagger×2 · Action · reach 5 ft or range 20/60 ft · Piercing' && fireballRow === 'Cast FireballStaff of Fire · Action · 150 ft · Fire',
  `each shows as it does where the sheet lists it, with what its group there would say: her two daggers (${daggerRow}), and the staff's Fireball (${fireballRow})`)
check(await strip.getByRole('button', { name: 'Cast Fireball damage, 8d6' }).isVisible() && (await strip.getByTitle('DEX saving throw').innerText()) === 'DEX 15'
  && await strip.getByRole('button', { name: 'Potion of Healing healing, 2d4 + 2' }).isVisible(), "with what each rolls: the Fireball's DEX 15 save and 8d6, the potion's healing")
const slotsRow = await strip.locator('li').filter({ hasText: 'Pact Magic' }).innerText()
check(slotsRow.replaceAll('\n', ' | ') === 'Pact Magic — 3rd Level | Spell slots | 1/2 | 1 of 2 spell slots left' && await strip.locator('li').filter({ hasText: 'Pact Magic' }).locator('.rounded-full.border-2').count() === 2, `her pact slots, with a pip for each: ${slotsRow.replaceAll('\n', ' | ')}`)
check(await strip.getByText(', favorite', { exact: true }).count() === 0, 'none of them starred, as all of them are favorites')
if (SHOTS) await shoot(page, 'phone-actions')

// Rolling from them
await strip.getByRole('button', { name: 'Cast Fireball damage, 8d6' }).click()
await rolled('Cast Fireball damage')
const fireball = await status.textContent()
const fireballDice = /8d6 \(([\d, ]+)\) Fire/.exec(fireball)
check(fireballDice && fireballDice[1].split(', ').length === 8, `the staff's Fireball rolls its 8d6 from her favorites: ${fireball}`)
await strip.getByRole('button', { name: /^Arcana check, \+6/ }).click()
await rolled('Arcana check')
check(/d20 \d+ \+6/.test(await status.textContent()), `so does Arcana: ${await status.textContent()}`)
const cdp = await view.newCDPSession(page)
const tools = strip.getByRole('button', { name: /^Thieves' Tools check/ })
await tools.scrollIntoViewIfNeeded()
const toolsBox = await tools.boundingBox()
const finger = { x: toolsBox.x + toolsBox.width / 3, y: toolsBox.y + toolsBox.height / 2 }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] })
await wait(750)
const toolsMenu = page.getByRole('menu', { name: "Thieves' Tools check +5" })
check(await toolsMenu.isVisible(), 'a long-press on her tools offers other ways to roll, as on a skill')
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await wait(300)
await toolsMenu.getByRole('menuitem', { name: 'Roll with advantage' }).tap()
await rolled("Thieves' Tools check")
const toolsRoll = await status.textContent()
check(/Advantage/.test(toolsRoll) && /d20 \d+ \d+ \+5/.test(toolsRoll), `with advantage, two d20s and her +5: ${toolsRoll}`)
await wait(2500)
check(sql(`select count(*) from chat_message m join campaign c on c.id = m."campaignId" where c.title = 'Ashlands'`) === '0', 'and no roll reaches the chat')

// Opening one
await strip.getByText('Find Familiar', { exact: true }).click()
await strip.getByText('Burning incense worth 10+ GP', { exact: false }).waitFor({ timeout: 10_000 })
check(await strip.getByText('Level 1 · Conjuration').isVisible(), 'a spell opens to its details, as in Spells')
await strip.getByText('Find Familiar', { exact: true }).click()

// Stars where the sheet lists them
const actionsSection = panel.getByRole('region', { name: 'Actions', exact: true })
check(same(await starredIn(actionsSection), ['Dagger', 'Potion of Healing', 'Fire Bolt']), `in Actions her favorites are starred: ${await starredIn(actionsSection)}`)
check(same(await overflowing(sheet), []), 'nothing runs past the edge of the phone on Actions')

// Hidden, and remembered
const heading = strip.getByRole('button', { name: /^Favorites\s*, 12$/ })
await heading.click()
check(await heading.getAttribute('aria-expanded') === 'false' && (await namesIn(strip)).length === 0, 'tapping Favorites hides them')
await showTab('Inventory')
strip = panel.getByRole('region', { name: 'Favorites' })
check(await strip.getByRole('button', { name: /^Favorites/ }).getAttribute('aria-expanded') === 'false', 'they stay hidden on Inventory')
await page.reload()
await sheet.getByRole('button', { name: /^Intelligence check/ }).waitFor()
await showTab('Spells')
check(await panel.getByRole('region', { name: 'Favorites' }).getByRole('button', { name: /^Favorites/ }).getAttribute('aria-expanded') === 'false', 'and after a reload, on Spells')
await panel.getByRole('region', { name: 'Favorites' }).getByRole('button', { name: /^Favorites/ }).click()
check(same(await namesIn(panel.getByRole('region', { name: 'Favorites' })), NAMES), 'tapping it again shows them')
check(same(await starredIn(panel.getByRole('region', { name: 'Cantrips', exact: true })), ['Fire Bolt'])
  && same(await starredIn(panel.getByRole('region', { name: '1st Level', exact: true })), ['Find Familiar']), 'in Spells, Fire Bolt and Find Familiar are starred')
if (SHOTS) await shoot(page, 'phone-spells')

await showTab('Inventory')
await panel.getByText('Backpack', { exact: true }).click()
// It opens as its details' toggle event comes, a moment after the tap.
await panel.getByRole('list', { name: 'In the Backpack' }).waitFor()
check(same(await starredIn(panel.getByRole('region', { name: 'Weapons', exact: true })), ['Dagger'])
  && same(await starredIn(panel.getByRole('region', { name: 'Containers', exact: true })), ['Hempen Rope']), 'in Inventory, the dagger is starred, and the rope in her backpack')
check(await page.getByRole('region', { name: 'Your rolls' }).isVisible(), 'the roll tray shows on Inventory too, where her favorites roll')
check(same(await overflowing(sheet), []), 'nothing runs past the edge on Inventory')
if (SHOTS) await shoot(page, 'phone-inventory')
await showTab('Effects')
check(same(await starredIn(panel.getByRole('region', { name: 'Temporary Effects' })), ['Mage Armor']) && await panel.getByRole('region', { name: 'Favorites' }).isVisible(), 'in Effects, Mage Armor is starred, under her favorites')
check(same(await overflowing(sheet), []), 'nothing runs past the edge on Effects')
for (const tab of ['Features', 'Biography', 'Character']) {
  await showTab(tab)
  check(await sheet.getByRole('region', { name: 'Favorites' }).count() === 0, `${tab} has no favorites of its own`)
}
check(await sheet.getByRole('button', { name: /^Arcana check, \+6.*, favorite$/ }).isVisible(), 'on Character, Arcana is starred')
await showTab('Features')
check(same(await starredIn(panel), ['Eldritch Mind']), 'on Features, Eldritch Mind is')
await view.close()

// ---- On a tablet ----
;({ view, page, sheet, panel, showTab } = await openSheet({ width: 768, height: 1024, mobile: true, name: 'tablet' }))
strip = panel.getByRole('region', { name: 'Favorites' })
const lists = strip.getByRole('list')
check(await lists.count() === 2 && same(await namesIn(lists.first()), NAMES.slice(0, 6)) && same(await namesIn(lists.last()), NAMES.slice(6)),
  'on a tablet, they are in two lists side by side, half in each, so that they take half the height')
const [left, right] = await Promise.all([lists.first().boundingBox(), lists.last().boundingBox()])
check(Math.abs(left.y - right.y) < 1 && right.x > left.x + left.width && Math.abs(left.width - right.width) < 1, `side by side and as wide (${Math.round(left.width)} and ${Math.round(right.width)} pixels)`)
check(same(await overflowing(sheet), []), 'nothing runs past the edge')
if (SHOTS) await shoot(page, 'tablet-actions')
await showTab('Inventory')
if (SHOTS) await shoot(page, 'tablet-inventory')
await view.close()

// ---- On a laptop ----
;({ view, page, sheet, panel, showTab, status, rolled } = await openSheet({ width: 1440, height: 900, name: 'laptop' }))
let column = sheet.getByRole('complementary', { name: 'Favorites' })
check(await column.isVisible() && await panel.getByRole('region', { name: 'Favorites' }).count() === 0, 'on a laptop, her favorites are in a column beside Actions, not in it')
check(same(await namesIn(column), NAMES), 'in her order')
const [columnBox, panelBox] = await Promise.all([column.boundingBox(), panel.boundingBox()])
check(columnBox.x + columnBox.width <= panelBox.x + 1 && Math.round(columnBox.width) === 360, `to its left, 360 pixels wide, as Tidy 5e has them in its sidebar (${Math.round(columnBox.width)})`)
// The layouts are in the sheet's settings, behind the cog beside its tabs.
await page.getByRole('button', { name: 'Settings', exact: true }).click()
let sheetSettings = page.getByRole('dialog', { name: 'Settings' })
await sheetSettings.waitFor()
check(await sheetSettings.getByRole('group', { name: 'Actions layout' }).getByRole('button', { name: 'Table', exact: true }).isVisible(), 'with room beside them for the Actions table')
await page.keyboard.press('Escape')
await sheetSettings.waitFor({ state: 'detached' })
const scroller = column.locator('.overflow-y-auto')
check(await scroller.evaluate(el => el.scrollHeight > el.clientHeight), 'the column scrolls, being longer than the screen')
await panel.evaluate(el => el.parentElement.scrollTo({ top: 600 }))
await wait(200)
const stillBox = await column.boundingBox()
check(stillBox.y === columnBox.y && await panel.evaluate(el => el.parentElement.scrollTop) > 0, 'and stays put as the tab scrolls')
await column.getByRole('button', { name: 'Fire Bolt attack, +6' }).click()
await rolled('Fire Bolt attack')
check(/d20 \d+ \+6/.test(await status.textContent()), `a favorite rolls from the column: ${await status.textContent()}`)
await column.getByRole('button', { name: /^Cast Fireball/, expanded: false }).click()
const fireballOpen = column.getByRole('button', { name: /^Cast Fireball/, expanded: true })
await column.getByText('You have resistance to fire damage', { exact: false }).waitFor({ timeout: 10_000 })
const facts = await column.locator('dl').first().innerText()
check(facts.includes('DC 15 DEX') && facts.includes('2 of 3 left, Dawn') && await fireballOpen.isVisible(), `the staff's Fireball opens to its save and uses, and the staff's description: ${facts.replaceAll('\n', ' ')}`)
if (SHOTS) await shoot(page, 'laptop-actions')
await showTab('Features')
check(await sheet.getByRole('complementary', { name: 'Favorites' }).count() === 0, 'Features has no column')
await showTab('Effects')
column = sheet.getByRole('complementary', { name: 'Favorites' })
check(await column.isVisible() && same(await namesIn(column), NAMES), 'Effects has it again')
if (SHOTS) await shoot(page, 'laptop-effects')

// ---- Foundry: she changes her favorites ----
vex.system.favorites = vex.system.favorites.filter(f => f.id !== '.Item.potion').concat([{ type: 'item', id: '.Item.misty', sort: 50000 }])
await Hooks.callAll('updateActor', vex, { system: { favorites: vex.system.favorites } })
await wait(400)
await idle()
await column.getByText('Misty Step', { exact: true }).waitFor({ timeout: 20_000 })
const changed = await namesIn(column)
check(same(changed, ['Arcane Recovery', 'Misty Step', ...NAMES.slice(1).filter(name => name !== 'Potion of Healing')]), `when she changes her favorites in Foundry, the column follows: ${changed.join(', ')}`)
await showTab('Actions')
check(same(await starredIn(panel.getByRole('region', { name: 'Bonus Actions', exact: true })), ['Misty Step'])
  && !(await starredIn(panel.getByRole('region', { name: 'Actions', exact: true }))).includes('Potion of Healing'), 'and so do the stars')
await view.close()

// ---- On a wide screen ----
;({ view, page, sheet, panel, showTab } = await openSheet({ width: 1920, height: 1080, name: 'wide' }))
await page.getByRole('button', { name: 'Settings', exact: true }).click()
sheetSettings = page.getByRole('dialog', { name: 'Settings' })
await sheetSettings.getByRole('group', { name: 'Actions layout' }).getByRole('button', { name: 'Columns', exact: true }).click()
await page.keyboard.press('Escape')
await sheetSettings.waitFor({ state: 'detached' })
check(await sheet.getByRole('complementary', { name: 'Favorites' }).isVisible(), 'on a wide screen, the column is beside the Actions in columns')
check(same(await overflowing(sheet), []), 'nothing runs past the edge')
if (SHOTS) await shoot(page, 'wide-actions')
await view.close()

// ---- Narrower than the column needs ----
;({ view, page, sheet, panel, showTab } = await openSheet({ width: 1366, height: 768, name: 'small laptop' }))
check(await sheet.getByRole('complementary').count() === 0 && await panel.getByRole('region', { name: 'Favorites' }).isVisible()
  && await panel.getByRole('region', { name: 'Favorites' }).getByRole('list').count() === 2, 'on a smaller laptop, too narrow for the column, they are at the top, in two lists')
if (SHOTS) await shoot(page, 'small-laptop-actions')
await view.close()

check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, `no page errors (${problems.join('; ')})`)
await browser.close()
process.exit(0)
