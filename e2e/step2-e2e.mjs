// Step 2 of the fuller sheet, end to end: the real module (in a stand-in Foundry, with a
// dnd5e-shaped Vex, a tiefling wizard and warlock who is down and making death saves) sends her
// inventory, spells, traits and biography to the production app; Alice reads them on a phone and
// on laptops. Screenshots to SHOTS.
import { actor, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

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
  getSpellSlotKey: () => 'pact', getLabel: () => 'Pact Magic' })
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
  spellcasting: { spell: multi, pact, atwill: plain('atwill', 'At-Will', -30), innate: plain('innate', 'Innate', -20), ritual: plain('ritual', 'Ritual', -10) },
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
  limitedUsePeriods: { lr: { label: 'DND5E.USES.Recovery.Period.LongRest.Label' }, dawn: { label: 'DND5E.USES.Recovery.Period.Dawn.Label' } },
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
// Foundry's Roll, which the module checks a description's formulas with, and dnd5e's damage types.
await import('./fvtt/dice-core.mjs')
// dnd5e 5.3.3's real DamageRoll, which the module builds a damage link's parts with, to see that a
// player can throw their dice (module 0.21.0).
const { default: DamageRoll } = await import(`${DND5E5}/module/dice/damage-roll.mjs`)
CONFIG.Dice.DamageRoll = DamageRoll
Object.assign(CONFIG.DND5E, { damageTypes: { fire: { label: 'Fire' } }, healingTypes: { healing: { label: 'Healing' }, temphp: { label: 'Temporary Hit Points' } } })
foundry.applications.ux.TextEditor = { implementation: { async enrichHTML(html) {
  return html
    .replace(/\[\[\/(damage|heal) ([^\]]+)\]\]/g, (_, kind, config) => {
      // dnd5e 5.3.3's damage and healing links, as its enricher makes them.
      const words = config.trim().split(/\s+/)
      const type = /^[a-z]+$/.test(words.at(-1)) ? words.pop() : (kind === 'heal' ? 'healing' : '')
      const formula = words.join(' ')
      const label = type ? ` ${type[0].toUpperCase()}${type.slice(1)}` : ''
      return `<a class="roll-link-group" data-action="roll" data-type="damage" data-formulas="${formula}"${type ? ` data-damage-types="${type}"` : ''} data-roll-type="${kind === 'heal' ? 'healing' : 'damage'}"><span class="roll-link"><i class="fa-solid fa-dice-d20" inert=""></i>${formula}</span>${label}</a>`
    })
    // Foundry's own inline rolls.
    .replace(/\[\[\/(?:r|roll) ([^\]]+)\]\]/g, '<a class="inline-roll roll" data-mode="roll" data-formula="$1"><i class="fas fa-dice-d20"></i>$1</a>')
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
  currency: { pp: 2, gp: 12877, sp: 0 },
  spells: { spell1: { value: 3, max: 4 }, spell2: { value: 0, max: 3 }, pact: { value: 1, max: 2, level: 3 } },
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
const item = (id, type, name, { system = {}, labels = {}, flags = {}, text, ...fields } = {}) => {
  const it = {
    documentName: 'Item', id, uuid: `Actor.vex.Item.${id}`, type, name, img: `icons/${id}.webp`, sort: 0,
    parent: vex, actor: vex, labels, system: { description: { value: text ?? `<p>About ${name}.</p>` }, ...system },
    getFlag: (scope, key) => flags[scope]?.[key], getRollData: () => ({}), ...fields,
  }
  items.set(id, it)
  return it
}
const physical = (fields = {}) => ({ quantity: 1, weight: { value: 0, units: 'lb' }, priceLabel: null, identified: true, ...fields })
item('dagger', 'weapon', 'Dagger', { sort: 2, labels: { properties: [{ label: 'Finesse' }, { label: 'Light' }, { label: 'Thrown' }] },
  system: physical({ quantity: 2, weight: { value: 1, units: 'lb' }, priceLabel: '2 GP', equipped: true }) })
item('staff', 'weapon', 'Staff of Fire', { sort: 1, labels: { properties: [{ label: 'Magical' }] },
  text: '<p>You have resistance to fire damage while you hold this staff. It has 10 charges; cast <em>Fireball</em> for 3 of them, dealing [[/damage 8d6 fire]].</p>',
  system: physical({ weight: { value: 4, units: 'lb' }, priceLabel: '5000 GP', equipped: true, attunement: 'required', attuned: true, rarity: 'rare',
    uses: { max: 10, spent: 3, value: 7, recovery: [{ period: 'dawn' }] } }) })
item('mystery', 'equipment', 'Plain Ring', { labels: { properties: [{ label: 'Magical' }] },
  system: physical({ identified: false, unidentified: { description: '<p>A plain iron ring, cold to the touch.</p>' }, description: { value: '<p>A Ring of Three Wishes.</p>' },
    priceLabel: '50000 GP', attunement: 'required', rarity: 'rare', uses: { max: 3, value: 3, recovery: [] } }) })
item('potion', 'consumable', 'Potion of Healing', { text: '<p>You regain [[/heal 2d4 + 2]] hit points when you drink this potion.</p>',
  system: physical({ quantity: 3, weight: { value: 1.5, units: 'lb' }, priceLabel: '150 GP' }) })
item('kit', 'tool', "Thieves' Tools", { system: physical({ weight: { value: 1, units: 'lb' }, priceLabel: '25 GP' }) })
item('gem', 'loot', 'Ruby', { system: physical({ priceLabel: '500 GP' }) })
item('pack', 'container', 'Backpack', { system: physical({ weight: { value: 5, units: 'lb' }, priceLabel: '2 GP', capacity: { weight: { value: 30, units: 'lb' } }, contentsWeight: 12.25 }) })
item('rope', 'loot', 'Hempen Rope', { text: '<p>50 feet of hempen rope. It has 2 hit points and can be burst with a DC 17 Strength check.</p>', system: physical({ container: 'pack', weight: { value: 10, units: 'lb' }, priceLabel: '1 GP' }) })
item('pouch', 'container', 'Pouch', { system: physical({ container: 'pack', capacity: { count: 6, weight: {} }, contentsCount: 2 }) })
item('coin', 'loot', 'Old Coin', { system: physical({ container: 'pouch', quantity: 2 }) })
item('box', 'container', 'Puzzle Box', { system: physical({ identified: false, properties: new Set(['unidentifiedContents']), unidentified: { description: '<p>A locked box of black wood.</p>' }, capacity: { count: 1, weight: {} }, contentsCount: 1 }) })
item('secret', 'loot', 'Map to the Hoard', { system: physical({ container: 'box' }) })
item('sack', 'container', 'Sack', { system: physical({ capacity: { weight: {} } }) })
const spell = (id, name, level, method, { prepared = 0, labels = {}, properties = [], ...fields } = {}) => item(id, 'spell', name, {
  labels: { school: 'Evocation', components: { vsm: 'V, S' }, activation: '1 Action', range: '120 ft', duration: 'Instantaneous', ...labels },
  system: { level, method, prepared, canPrepare: method === 'spell', properties: new Set(properties), uses: {} }, ...fields,
})
spell('fire-bolt', 'Fire Bolt', 0, 'spell', { labels: { target: '1 Creature' }, text: '<p>You hurl a mote of fire. On a hit, the target takes [[/damage 2d10 fire]].</p>' })
spell('shield', 'Shield', 1, 'spell', { prepared: 1, labels: { school: 'Abjuration', activation: '1 Reaction', range: 'Self', duration: '1 Round' },
  text: '<p>An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.</p>' })
spell('sleep', 'Sleep', 1, 'spell', { prepared: 0, labels: { school: 'Enchantment', range: '60 ft', duration: '1 Minute', components: { vsm: 'V, S, M' }, materials: 'A pinch of sand' } })
spell('find', 'Find Familiar', 1, 'spell', { prepared: 2, properties: ['ritual'], labels: { school: 'Conjuration', activation: '1 Hour', range: '10 ft', duration: 'Instantaneous', components: { vsm: 'V, S, M' }, materials: 'Burning incense worth 10+ GP, which the spell consumes' } })
spell('mirror', 'Mirror Image', 2, 'spell', { prepared: 1, labels: { school: 'Illusion', range: 'Self', duration: '1 Minute' } })
spell('fireball', 'Fireball', 3, 'pact', { labels: { range: '150 ft', target: '20 ft Sphere', components: { vsm: 'V, S, M' }, materials: 'A ball of bat guano and sulfur' },
  text: '<p>A bright streak flashes from you to a point you choose. Each creature in a 20-foot-radius Sphere makes a Dexterity saving throw, taking [[/damage 8d6 fire]] on a failed save, or half as much on a success.</p>' })
spell('invisibility', 'Invisibility', 2, 'pact', { properties: ['concentration'], labels: { school: 'Illusion', range: 'Touch', target: '1 Creature', duration: '1 Hour', concentrationDuration: 'Concentration, up to 1 Hour' } })
spell('dim', 'Dimension Door', 4, 'spell', { prepared: 1, labels: { school: 'Conjuration', range: '500 ft' } })
spell('disguise', 'Disguise Self', 1, 'atwill', { labels: { school: 'Illusion', range: 'Self', duration: '1 Hour' } })
spell('hellish', 'Hellish Rebuke', 2, 'innate', { labels: { activation: '1 Reaction', range: '60 ft' }, system: { level: 2, method: 'innate', properties: new Set(), uses: { max: 1, value: 0, spent: 1, recovery: [{ period: 'lr' }] } } })
spell('detect', 'Detect Magic', 1, 'ritual', { labels: { school: 'Divination', range: 'Self', duration: '10 Minutes' }, properties: ['concentration', 'ritual'] })
// The spells her items cast: the staff's Magic Missile, the ring's Charm Person, which dnd5e's sheet
// leaves out until she attunes to the ring, and the unidentified ring's Wish, left out.
const cast = (id, name, linkedActivity, labels = {}) => spell(id, name, 1, 'spell', { labels, flags: { dnd5e: { cachedFor: `.Item.${linkedActivity.item.id}.Activity.cast` } },
  system: { level: 1, method: 'spell', properties: new Set(), linkedActivity: { displayInSpellbook: linkedActivity.canUse, ...linkedActivity } } })
cast('wand-bolt', 'Magic Missile', { canUse: true, item: items.get('staff') })
cast('ring-charm', 'Charm Person', { canUse: false, visibility: { requireAttunement: true }, item: { id: 'charms', name: 'Ring of Charms', system: { identified: true, attuned: false } } }, { school: 'Enchantment', range: '30 ft' })
cast('ring-wish', 'Wish', { canUse: true, item: items.get('mystery') })
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

// ---- On a phone ----
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
await phone.addCookies([cookie])
await serveAssets(phone)
const page = await phone.newPage()
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
const views = []
page.on('response', async response => {
  const url = new URL(response.url())
  if (url.pathname.endsWith('/table') && response.status() === 200) views.push(await response.json().catch(() => null))
})
await page.goto(`${BASE}/characters/sheet-vex`)
const sheetPane = page.getByRole('region', { name: 'Character' })
await sheetPane.getByRole('button', { name: /^Intelligence check/ }).waitFor()
const tabs = sheetPane.getByRole('tablist', { name: 'Character sheet' })
check(same(await tabs.getByRole('tab').allTextContents(), ['Character', 'Actions', 'Inventory', 'Spells', 'Features', 'Effects', 'Biography']), "a spellcaster's sheet has Tidy 5e's tabs, Spells among them")
const tabWidths = () => tabs.getByRole('tab').evaluateAll(all => all.map(tab => Math.round(tab.getBoundingClientRect().width)))
let widths = await tabWidths()
check(widths[0] > 80 && widths.slice(1).every(width => width <= 34), `on a phone, only the chosen tab shows its label; the rest are icons (${widths})`)
check(await tabs.evaluate(list => list.scrollWidth <= list.clientWidth), 'and all seven fit, without scrolling')

const stat = label => sheetPane.locator('dt', { hasText: label }).first().locator('xpath=..')
check((await stat('Death saves').textContent()) === 'Death savesSuccesses1 of 3Failures2 of 3Roll', 'down at 0 hit points, her death saves show beside them: one success, two failures')
check(await stat('Death saves').getByRole('button', { name: 'Death saving throw' }).isVisible(), 'with a button to roll the next one')
const marks = await stat('Death saves').locator('[aria-hidden] > span').evaluateAll(all => all.map(mark => getComputedStyle(mark).backgroundColor !== 'rgba(0, 0, 0, 0)'))
check(same(marks, [true, false, false, true, true, false]), 'as marks filled in')
if (SHOTS) await shoot(page, `phone-character`)
const traits = sheetPane.getByRole('region', { name: 'Traits' })
const traitRows = await traits.locator('dt').evaluateAll(all => all.map(dt => `${dt.textContent}: ${dt.nextElementSibling.textContent}`))
check(same(traitRows, [
  'Size: Medium', 'Senses: Darkvision 60 ft, Sees invisibility within 10 ft', 'Speed: Walk 30 ft, Fly (hover) 60 ft',
  'Languages: Common, Infernal, Telepathy 30 ft', 'Armor Training: Light Armor', "Tool Proficiencies: Thieves' Tools",
  'Damage Resistances: Fire', 'Condition Immunities: Charmed',
]), `her traits are under her skills: ${traitRows.join(' | ')}`)
if (SHOTS) {
  await traits.scrollIntoViewIfNeeded()
  await shoot(page, `phone-traits`)
}

// Inventory
await tabs.getByRole('tab', { name: 'Inventory' }).click()
const panel = sheetPane.getByRole('tabpanel')
check(await panel.getAttribute('aria-labelledby') === 'sheet-tab-inventory', 'Inventory opens')
widths = await tabWidths()
check(widths[2] > 80 && widths[0] <= 34, `and now it is the labelled tab (${widths})`)
const facts = await panel.locator('dl').first().locator('dt').evaluateAll(all => all.map(dt => `${dt.textContent}: ${dt.nextElementSibling.textContent}`))
check(same(facts, ['Currency: 2 PP12.8k GP0 SP', 'Encumbrance: 62.5 / 255 lb', 'Attunement: 1 / 3']), `her coin, load and attunement, thousands of gold shortened: ${facts.join(' | ')}`)
await panel.getByRole('button', { name: '12.8k GP, exact amount' }).click()
check(await page.getByRole('dialog', { name: '12,877 GP' }).isVisible(), 'a tap on 12.8k GP gives the exact amount')
await page.keyboard.press('Escape')
check(await page.getByRole('dialog', { name: '12,877 GP' }).count() === 0, 'and Escape closes it')
check(same(await panel.getByRole('heading').allTextContents(), ['Weapons', 'Equipment', 'Consumables', 'Tools', 'Loot', 'Containers']), 'items by type, as dnd5e groups them, then containers')
const rows = region => panel.getByRole('region', { name: region }).locator(':scope > ul > li').evaluateAll(all => all.map(li => li.querySelector('summary, div').textContent))
check(same(await rows('Weapons'), ['Staff of FireEquipped · Attuned · 4 lb · 5000 GP7/107 of 10 uses left', 'DaggerEquipped · 2 lb · 2 GP×2']), 'weapons show what is equipped and attuned, their weight, price, count and charges')
check(same(await rows('Equipment'), ['Plain Ring']), "the unidentified ring shows nothing a player wouldn't know")
check(same(await rows('Containers'), ['Backpack5 lb · 2 GP', 'Puzzle Box', 'Sack']), 'containers, by themselves')
const containers = panel.getByRole('region', { name: 'Containers' })
await containers.getByText('Backpack', { exact: true }).click()
const backpack = containers.locator(':scope > ul > li').first()
await backpack.locator('dt', { hasText: 'Capacity' }).waitFor()
check((await backpack.locator('dt', { hasText: 'Capacity' }).locator('xpath=following-sibling::dd[1]').textContent()) === '12.3 / 30 lb', 'the backpack opens to how full it is')
const inPack = backpack.getByRole('list', { name: 'In the Backpack' })
await inPack.waitFor()
check(same(await inPack.locator(':scope > li').evaluateAll(all => all.map(li => li.querySelector('summary, div').textContent)), ['Hempen Rope10 lb · 1 GP', 'Pouch']), 'and what it holds')
await inPack.getByText('Pouch', { exact: true }).click()
await inPack.getByRole('list', { name: 'In the Pouch' }).waitFor()
const rotated = name => inPack.locator('summary', { hasText: name }).locator(':scope > svg').last().evaluate(svg => getComputedStyle(svg).rotate !== 'none' || getComputedStyle(svg).transform !== 'none')
await page.waitForTimeout(300)
check(await rotated('Pouch') && !(await rotated('Hempen Rope')), 'inside the open backpack, only the open pouch is marked open')
const inPouch = await inPack.getByRole('list', { name: 'In the Pouch' }).locator(':scope > li').allTextContents()
check(same(inPouch, ['Old Coin×2']), `a pouch inside it opens to its own: two old coins (${inPouch})`)
await inPack.getByText('Hempen Rope', { exact: true }).click()
await inPack.getByText(/50 feet of hempen rope/).waitFor({ timeout: 10_000 })
check(true, 'an item in a container opens to its description')
if (SHOTS) {
  await backpack.scrollIntoViewIfNeeded()
  await shoot(page, `phone-inventory-backpack`)
}
await containers.getByText('Puzzle Box', { exact: true }).click()
check(await shown(containers.getByText("What it holds isn't known yet.")) && await shown(containers.getByText('Not identified')), "the unidentified puzzle box doesn't tell what it holds")
await containers.getByText(/A locked box of black wood/).waitFor({ timeout: 10_000 })
await containers.getByText('Sack', { exact: true }).click()
check(await shown(containers.getByText("It's empty.")), 'and the sack says it is empty')
const ringRow = panel.getByRole('region', { name: 'Equipment' }).locator('details')
await ringRow.locator('summary').click()
await ringRow.getByText(/A plain iron ring/).waitFor({ timeout: 10_000 })
check(await shown(ringRow.getByText('Not identified', { exact: true })) && !(await page.content()).includes('Wishes'), 'the ring opens to what a player sees of it, not what it is')
const weapons = panel.getByRole('region', { name: 'Weapons' })
await weapons.getByText('Staff of Fire', { exact: true }).click()
await weapons.getByRole('button', { name: /^8d6 Fire, roll/ }).waitFor({ timeout: 10_000 })
check(await shown(weapons.getByText('Rare · Requires attunement · Magical')), "the staff opens to its rarity, attunement and properties, and its description with its roll marked")
const staffFacts = await weapons.locator('details', { hasText: 'Staff of Fire' }).locator('dt').evaluateAll(all => all.map(dt => `${dt.textContent}: ${dt.nextElementSibling.textContent}`))
check(same(staffFacts, ['Weight: 4 lb', 'Price: 5000 GP']), `and its weight and price in full, cut short under its name on a phone: ${staffFacts.join(' | ')}`)
if (SHOTS) {
  await panel.evaluate(el => el.closest('[class*="overflow"]')?.scrollTo?.({ top: 0 }))
  await page.locator('#sheet-panel').evaluate(el => el.parentElement.scrollTo({ top: 0 }))
  await page.waitForTimeout(200)
  await shoot(page, `phone-inventory`)
}

// Spells
await tabs.getByRole('tab', { name: 'Spells' }).click()
const casting = panel.getByRole('region', { name: 'Spellcasting' })
check(same(await casting.locator('dl dt').allTextContents(), ['Ability', 'Spell save DC', 'Spell attack']) && same(await casting.locator('dl dd').allTextContents(), ['Intelligence', '14', '+6']), 'Spells opens to how she casts: Intelligence, DC 14, +6')
check(same(await casting.getByRole('list', { name: 'By class' }).getByRole('listitem').allTextContents(), ['WizardIntelligenceDC 14+6 to hit', 'WarlockCharismaDC 14+6 to hit']), 'and how each of her classes casts')
check(same(await panel.getByRole('heading').allTextContents(), ['Spellcasting', 'At-Will', 'Innate', 'Ritual', 'Cantrips', 'Pact Magic', '1st Level', '2nd Level', '4th Level', 'Additional Spells']), "her spellbook's sections, in dnd5e's order")
const slots = async name => (await panel.getByRole('region', { name }).locator('.sr-only', { hasText: 'slots left' }).textContent())
check(await slots('1st Level') === '3 of 4 spell slots left' && await slots('Pact Magic') === '1 of 2 spell slots left' && await slots('2nd Level') === '0 of 3 spell slots left', 'with the slots left at each level and of her pact magic')
check(await panel.getByRole('region', { name: '4th Level' }).locator('.sr-only', { hasText: 'slots left' }).count() === 0, 'a level without slots shows none')
const spellRows = name => panel.getByRole('region', { name }).locator(':scope > ul > li > details > summary').allTextContents()
check(same(await spellRows('1st Level'), ['Find Familiar1 Hour · 10 ftRRitualAlwaysAlways prepared', 'Shield1 Reaction · Self', 'Sleep1 Action · 60 ftNot prepared']), '1st level: Find Familiar always prepared, a ritual; Shield; Sleep, not prepared')
check(await panel.getByRole('region', { name: '1st Level' }).locator('summary', { hasText: 'Sleep' }).evaluate(el => getComputedStyle(el).opacity) === '0.6', 'a spell not prepared is muted')
check(same(await spellRows('Innate'), ['Hellish Rebuke1 Reaction · 60 ft0/10 of 1 uses left']), 'an innate spell with its uses')
const pactMagic = panel.getByRole('region', { name: 'Pact Magic' })
check(same(await spellRows('Pact Magic'), ['Invisibility1 Action · TouchCConcentration', 'Fireball1 Action · 150 ft']), 'pact magic, Invisibility needing concentration')
await pactMagic.getByText('Invisibility', { exact: true }).click()
await pactMagic.locator('details[open] dt').first().waitFor()
const specifics = await pactMagic.locator('details[open] dt').evaluateAll(all => all.map(dt => `${dt.textContent}: ${dt.nextElementSibling.textContent}`))
check(same(specifics, ['Casting time: 1 Action', 'Range: Touch', 'Target: 1 Creature', 'Duration: Concentration, up to 1 Hour', 'Components: V, S']), `a spell opens to how it is cast: ${specifics.join(' | ')}`)
check(await shown(pactMagic.getByText('Level 2 · Illusion')), 'with its level and school')
await pactMagic.getByText('Fireball', { exact: true }).click()
await pactMagic.getByRole('button', { name: /^8d6 Fire, roll/ }).waitFor({ timeout: 10_000 })
check((await pactMagic.locator('details', { hasText: 'Fireball' }).locator('dt', { hasText: 'Components' }).locator('xpath=following-sibling::dd[1]').textContent()) === 'V, S, M (A ball of bat guano and sulfur)', 'and its description, its damage roll marked, and its materials')
if (SHOTS) {
  await pactMagic.scrollIntoViewIfNeeded()
  await shoot(page, `phone-spells-open`)
  await page.locator('#sheet-panel').evaluate(el => el.parentElement.scrollTo({ top: 0 }))
  await page.waitForTimeout(200)
  await shoot(page, `phone-spells`)
}

// Every spell her items cast, the one the ring can't cast yet muted and saying why; none of the
// ring she hasn't identified.
check(same(await spellRows('Additional Spells'), ['Charm PersonNeeds attuning · From Ring of Charms · 1 Action', 'Magic Missile1 Action · 120 ft · From Staff of Fire']), 'every spell her items cast, the one she must attune to the ring for saying so')
check(await panel.getByRole('region', { name: 'Additional Spells' }).locator('summary', { hasText: 'Charm Person' }).evaluate(el => getComputedStyle(el).opacity) === '0.6', 'and muted')

// With more than four spells, she finds hers by name, whatever its case.
const search = panel.getByRole('searchbox', { name: 'Search spells by name' })
await search.fill('fIrE')
await panel.getByRole('region', { name: '1st Level' }).waitFor({ state: 'detached', timeout: 10_000 })
check(same(await panel.getByRole('heading').allTextContents(), ['Spellcasting', 'Cantrips', 'Pact Magic']) && same(await spellRows('Pact Magic'), ['Fireball1 Action · 150 ft']), 'searching "fIrE" finds Fire Bolt and Fireball, and no other')
if (SHOTS) await shoot(page, `phone-spells-search`)
await search.fill('wishes')
await panel.getByText('No spells match “wishes”.').waitFor({ timeout: 10_000 })
check(true, 'and says when none match')
await search.fill('')
await panel.getByRole('region', { name: 'Additional Spells' }).waitFor({ timeout: 10_000 })
check((await panel.getByRole('heading').count()) === 10, 'every section comes back when the search is cleared')

// Biography
await tabs.getByRole('tab', { name: 'Biography' }).click()
const details = panel.getByRole('region', { name: 'Details' })
const detailRows = await details.locator('dt').evaluateAll(all => all.map(dt => `${dt.textContent}: ${dt.nextElementSibling.textContent}`))
check(same(detailRows, ['Experience: 6,500 / 14,000 XP', 'Alignment: Chaotic Good', 'Age: 24', `Height: 5' 9"`, 'Weight: 140 lb', 'Eyes: Gold', 'Hair: Black', 'Skin: Crimson']), `Biography opens to her details, leaving out what is blank: ${detailRows.join(' | ')}`)
check(same(await panel.getByRole('region', { name: 'Personality' }).locator('dt').allTextContents(), ['Personality Traits', 'Ideals', 'Flaws']), 'her personality, without the bond she has none of')
check((await panel.getByRole('region', { name: 'Appearance' }).locator('p').evaluate(p => p.getClientRects().length > 0 && p.innerText)) === 'Curling horns, a long tail, and eyes like molten gold.\nShe wears a patched violet cloak.', 'her appearance, its lines kept')
const story = panel.getByRole('region', { name: 'Biography' })
await story.getByRole('heading', { name: 'The Pact' }).waitFor({ timeout: 10_000 })
check(await shown(story.locator('em', { hasText: 'paying for it' })), 'and her story, as written in Foundry')
if (SHOTS) await shoot(page, `phone-biography`)

// ---- A change in Foundry: she is healed, and casts Shield ----
const viewsBefore = views.length
vex.system.attributes.hp.value = 7
vex.system.attributes.death = { success: 0, failure: 0 }
vex.system.spells.spell1.value = 2
await Hooks.callAll('updateActor', vex, {})
await new Promise(resolve => setTimeout(resolve, 400))
await idle()
for (let i = 0; i < 20 && views.length === viewsBefore; i++) await page.waitForTimeout(500)
await tabs.getByRole('tab', { name: 'Spells' }).click()
await panel.getByRole('region', { name: '1st Level' }).getByText('2 of 4 spell slots left').waitFor({ timeout: 10_000 })
check(true, 'after she casts Shield, her 1st-level slots show one fewer')
await tabs.getByRole('tab', { name: 'Character' }).click()
await sheetPane.locator('dt', { hasText: 'Hit points' }).waitFor()
check(await sheetPane.locator('dt', { hasText: 'Death saves' }).count() === 0, 'healed, her death saves are gone')

/**
 * Whether the sheet's tabs fit their row, with the settings' cog after them and on the screen; and
 * whether the page itself scrolls sideways.
 */
const tabRow = page => page.evaluate(() => {
  const list = document.querySelector('[role=tablist][aria-label="Character sheet"]')
  const cog = list.parentElement.querySelector('button[aria-label="Settings"]')
  const root = document.scrollingElement
  return {
    fit: list.scrollWidth <= list.clientWidth, scrolls: getComputedStyle(list).overflowX === 'auto',
    cog: cog.getBoundingClientRect().left >= list.getBoundingClientRect().right - 0.5 && cog.getBoundingClientRect().right <= innerWidth,
    pageX: root.scrollWidth - root.clientWidth,
  }
})

// ---- Small phones ----
// From 360 pixels, the narrowest phones the sheet is laid out for, the seven tabs and the
// settings' cog fit.
const phone360 = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: 'light' })
await phone360.addCookies([cookie])
await serveAssets(phone360)
const narrow = await phone360.newPage()
narrow.on('pageerror', e => problems.push(`360 pageerror: ${e.message}`))
await narrow.goto(`${BASE}/characters/sheet-vex`)
const narrowTabs = narrow.getByRole('region', { name: 'Character' }).getByRole('tablist', { name: 'Character sheet' })
await narrowTabs.waitFor()
let row = await tabRow(narrow)
check(row.fit && row.cog && row.pageX === 0, "on a 360-pixel phone the seven tabs still fit, and the settings' cog after them")
await narrowTabs.getByRole('tab', { name: 'Biography' }).click()
row = await tabRow(narrow)
check(row.fit && row.cog && row.pageX === 0, 'whichever is chosen')
await phone360.close()

// Narrower still, the tabs scroll in their row, the cog stays on the screen, and the page itself
// doesn't scroll sideways: a character's page has no app bar to run past it. The sheet must not
// run past it either.
const small = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, colorScheme: 'light' })
await small.addCookies([cookie])
await serveAssets(small)
const tiny = await small.newPage()
tiny.on('pageerror', e => problems.push(`small pageerror: ${e.message}`))
await tiny.goto(`${BASE}/characters/sheet-vex`)
const tinyTabs = tiny.getByRole('region', { name: 'Character' }).getByRole('tablist', { name: 'Character sheet' })
await tinyTabs.waitFor()
row = await tabRow(tiny)
check(row.scrolls && row.cog && row.pageX === 0, `on a 320-pixel phone the tabs scroll in their row, the cog on the screen, and the page doesn't scroll sideways (${JSON.stringify(row)})`)
const tinySheet = tiny.getByRole('region', { name: 'Character' })
for (const name of ['Character', 'Inventory', 'Spells', 'Biography']) {
  await tinyTabs.getByRole('tab', { name }).click()
  await tiny.waitForTimeout(300)
  const over = await tinySheet.evaluate(region => [...region.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > region.getBoundingClientRect().right + 0.5).map(el => el.textContent.slice(0, 40)))
  check(over.length === 0, `on a 320-pixel phone nothing on ${name} runs past the sheet${over.length ? `: ${over.slice(0, 3)}` : ''}`)
}

// ---- On laptops ----
for (const [width, height, labelled] of [[1440, 900, true], [1024, 768, false]]) {
  const laptop = await browser.newContext({ viewport: { width, height }, colorScheme: 'light' })
  await laptop.addCookies([cookie])
  await serveAssets(laptop)
  const wide = await laptop.newPage()
  wide.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  await wide.goto(`${BASE}/characters/sheet-vex`)
  const wideSheet = wide.getByRole('region', { name: 'Character' })
  await wideSheet.getByRole('button', { name: /^Intelligence check/ }).waitFor()
  const wideTabs = wideSheet.getByRole('tablist', { name: 'Character sheet' })
  const wideWidths = await wideTabs.getByRole('tab').evaluateAll(all => all.map(tab => Math.round(tab.getBoundingClientRect().width)))
  check(labelled ? wideWidths.every(w => w > 50) : wideWidths.slice(1).every(w => w <= 34), `at ${width} pixels, ${labelled ? 'every tab is labelled' : 'the sheet is narrow beside the chat, so only the chosen tab is'} (${wideWidths})`)
  check(await wideTabs.evaluate(list => list.scrollWidth <= list.clientWidth), `and the tabs fit at ${width} pixels`)
  check(await wide.evaluate(() => document.scrollingElement.scrollHeight === document.scrollingElement.clientHeight), `the page itself does not scroll at ${width} pixels`)
  if (SHOTS) await shoot(wide, `laptop-${width}-character`)
  await wideTabs.getByRole('tab', { name: 'Inventory' }).click()
  const wideContainers = wideSheet.getByRole('region', { name: 'Containers' })
  await wideContainers.getByText('Backpack', { exact: true }).click()
  await wideContainers.getByRole('list', { name: 'In the Backpack' }).getByText('Pouch', { exact: true }).click()
  await wideContainers.getByRole('list', { name: 'In the Pouch' }).waitFor()
  if (SHOTS) await shoot(wide, `laptop-${width}-inventory`)
  await wideTabs.getByRole('tab', { name: 'Spells' }).click()
  await wideSheet.getByRole('region', { name: '1st Level' }).getByText('Shield', { exact: true }).click()
  await wideSheet.getByText(/An invisible barrier/).waitFor({ timeout: 10_000 })
  if (SHOTS) await shoot(wide, `laptop-${width}-spells`)
  await wideTabs.getByRole('tab', { name: 'Biography' }).click()
  await wideSheet.getByRole('heading', { name: 'The Pact' }).waitFor({ timeout: 10_000 })
  if (SHOTS) await shoot(wide, `laptop-${width}-biography`)
  await laptop.close()
}

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors')
await browser.close()
process.exit(0)
