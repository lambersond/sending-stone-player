// Favorites added and removed from the app (module 0.37.0 and the app, its contract §4-§7, §12.2),
// end to end, in the world of world-030.mjs, Thorin's favorites dnd5e's own (fvtt/favorites-core.mjs
// through `favoring`). Alice plays Thorin in Ashlands, with moves on: a Longsword, a Rope, two
// Potions of Healing, Fire Bolt, Second Wind (a feature that rolls) and Lucky (one that doesn't), a
// Fighter class, a Staff of Embers that strikes and casts Fireball, two Wands whose second
// activities share one id (as dnd5e's staticID gives migrated items), a Cloak with its effect "Cloak
// of Protection", Bless on him, Prone, and a resource Ki standing for his Ki feature; his favorites
// already Stealth, his 1st-level slots and Lucky, after Ki. Bob plays Vex, whose game character has
// no favorites of dnd5e's; the Iron Company holds a Rope; a Wolf Alice owns is his companion. A
// right-click, a held touch, Shift+F10 or the context-menu key opens each row's menu, titled with its
// name: Add to favorites or Remove from favorites as the character's favorites say, first, then
// Inventory's Send to… and Remove…; on the Actions list and table, Spells, Features and its class
// card, Effects, an activity beneath its item, and among the favorites Remove alone. Each is made by
// dnd5e's own addFavorite or removeFavorite on the Gamemaster's Foundry, stored by the id dnd5e's
// menus build, a new one last, nothing posted in chat; the tray, the rolls and the toasts follow it.
// Waiting while on its way, a second refused; a favorite made in Foundry meanwhile done with nothing
// written; an item deleted in Foundry meanwhile refused `gone` by the module; crafted posts refused by
// the app; never on a resource's feature, a resource, a skill, slots, a condition, a party's sheet, a
// companion's pane or the Gamemaster's page; no switch; no longer offered once Foundry has been closed
// a while (the view's 204 key, §7.7); phones; both themes. The contract's steps run in the order
// Thorin's favorites allow: the keyboard (6) before the adds of 4, which make its rows favorites;
// waiting (7) as 4 adds Fire Bolt; never offered (10) before the Rope is deleted (9). DND5E6=1: steps 1-5
// under dnd5e 6.0.5's stand-ins. SKEW=036 with MODULE=module-0.36.0: no favorites at all. Synthetic
// characters only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
// Screenshots to SHOTS.
import {
  BASE, BOB, DND5E6, SKEW036, W, activeScene, actors, browse, call, character, check, companion, embedded, escapeRe,
  favoring, finish, foundryWorld, group, launch, newCampaign, note, part, place, posted, postsOf, relay, same, sceneWorld,
  settled, shoot, shootBoth, sideways, sql, startFetching, startModule, stopFetching, theme, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashlands-favorites.forge-vtt.com'
const SECRET = 'ashlands-favorites-37'
const TITLE = 'Ashlands'
const NEW = !SKEW036
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'ashlands-favorites.forge-vtt.com', secret: SECRET })
await foundryWorld()
await sceneWorld()
game.modules.get('sending-stone').version = SKEW036 ? '0.36.0' : '0.37.0'
// As Foundry's (common/constants.mjs), which dnd5e's addFavorite sorts a new favorite by.
CONST.SORT_INTEGER_DENSITY = 100000
// What an NPC's sheet names, as dnd5e configures it, for the Wolf's (as companions-e2e has it).
Object.assign(CONFIG.DND5E, {
  movementTypes: { walk: { label: 'DND5E.MOVEMENT.Type.Speed' } },
  movementUnits: { ft: { label: 'Feet', abbreviation: 'DND5E.DistFtAbbr' } },
  actorSizes: { med: { label: 'DND5E.SizeMedium' } },
})
CONFIG.DND5E.skills.ste = { label: 'Stealth', ability: 'dex' }
CONFIG.statusEffects.push({ id: 'prone', name: 'Prone', img: 'systems/dnd5e/icons/svg/statuses/prone.svg' })
// A class's identifier, as dnd5e prepares it from its data.
W.itemPreparers.push(item => { if (item.type === 'class') item.identifier = item._source?.system?.identifier ?? item.id })

// The module's results to the app, held while `results.held` is, as a result on its way takes its time.
const results = { held: null, release: null }
{
  const inner = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (results.held) {
      let type = null
      try { type = JSON.parse(init.body).type } catch {}
      while ((type === 'command.result') && results.held) await results.held
    }
    return inner(url, init)
  }
}
const holdResults = () => { results.held = new Promise(resolve => { results.release = resolve }) }
const releaseResults = () => {
  const release = results.release
  results.held = null
  results.release = null
  release?.()
}

// ---- The world ----
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
const POTION = 'Compendium.dnd5e.items.Item.phb-potion'
const DRINK = [{ id: 'drink', type: 'heal', affects: 'self', range: 'self', healing: { number: 2, denomination: 4, bonus: '2', types: ['healing'] }, labels: { damage: [hits('2d4 + 2', 'healing')] } }]
const zap = (id, name) => ({ id, name, attack: { ability: 'dex' }, damage: [{ number: 1, denomination: 4, types: ['piercing'] }], labels: { modifier: '+4', damage: [hits('1d4', 'piercing')] } })
const thorin = character({
  id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 2, con: 2, wis: 1 },
  skills: { ste: { ability: 'dex' }, prc: { ability: 'wis' } }, hp: { value: 30, max: 44, temp: 0 },
}, {
  ac: 16,
  spells: { spell1: { value: 2, max: 2, level: 1 } },
  items: [
    {
      id: 'longsword', name: 'Longsword', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true, weight: { value: 3, units: 'lb' } },
      activities: [{ id: 'slash', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+6', damage: [hits('1d8 + 3', 'slashing')] } }],
    },
    {
      id: 'potion', name: 'Potion of Healing', type: 'consumable', _stats: { compendiumSource: POTION },
      system: { quantity: 2, identified: true, properties: [], weight: { value: 0.5, units: 'lb' } }, activities: DRINK,
    },
    {
      id: 'firebolt', name: 'Fire Bolt', type: 'spell', system: { level: 0, method: 'spell', prepared: 1, properties: [], duration: { units: 'inst' } },
      activities: [{ id: 'bolt', ability: 'wis', damage: [{ number: 1, denomination: 10, types: ['fire'] }], labels: { modifier: '+4', damage: [hits('1d10', 'fire')] } }],
    },
    {
      id: 'secondwind', name: 'Second Wind', type: 'feat', system: { properties: [], uses: { max: 1, spent: 0, recovery: [{ period: 'sr' }] } },
      activities: [{
        id: 'breather', type: 'heal', affects: 'self', range: 'self', activation: { type: 'bonus', value: 1 }, consumption: [{ type: 'itemUses', value: 1 }],
        healing: { number: 1, denomination: 10, bonus: '5', types: ['healing'] }, labels: { damage: [hits('1d10 + 5', 'healing')] },
      }],
    },
    { id: 'lucky', name: 'Lucky', type: 'feat', system: { properties: [], description: { value: '<p>Three luck points a long rest.</p>' } }, activities: [] },
    { id: 'ki', name: 'Ki', type: 'feat', system: { properties: [] }, activities: [] },
    { id: 'fighter', name: 'Fighter', type: 'class', system: { identifier: 'fighter', levels: 5, hd: { denomination: 'd10', spent: 0, value: 5, max: 5 } }, activities: [] },
    {
      id: 'staff', name: 'Staff of Embers', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true, weight: { value: 4, units: 'lb' } },
      activities: [
        { id: 'strike', name: 'Strike', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 6, bonus: '@mod', types: ['piercing'] }], labels: { modifier: '+6', damage: [hits('1d6 + 3', 'piercing')] } },
        {
          id: 'castfireball', name: 'Cast Fireball', type: 'save', template: 'sphere', affects: 'creature', save: ['dex'], dc: 15, sort: 1,
          damage: [{ number: 8, denomination: 6, types: ['fire'] }], labels: { damage: [hits('8d6', 'fire')] },
        },
      ],
    },
    // Two wands whose second activities share one id, as dnd5e's staticID gives migrated items.
    {
      id: 'wandfrost', name: 'Wand of Frost', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'ranged', equipped: true, weight: { value: 1, units: 'lb' } },
      activities: [zap('frostzap', 'Frost Zap'), { id: 'burst', name: 'Frost Burst', type: 'damage', sort: 1, damage: [{ number: 2, denomination: 6, types: ['cold'] }], labels: { damage: [hits('2d6', 'cold')] } }],
    },
    {
      id: 'wandsparks', name: 'Wand of Sparks', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'ranged', equipped: true, weight: { value: 1, units: 'lb' } },
      activities: [zap('sparkzap', 'Spark Zap'), { id: 'burst', name: 'Spark Burst', type: 'damage', sort: 1, damage: [{ number: 2, denomination: 6, types: ['thunder'] }], labels: { damage: [hits('2d6', 'thunder')] } }],
    },
  ],
})
thorin.system.details = { level: 5 }
thorin.system.attributes.spellcasting = 'wis'
thorin.system.attributes.spell = { dc: 12, attack: 4, mod: 1 }
thorin.system.resources = { primary: { label: 'Ki', value: 4, max: 4, sr: true, lr: false } }
// Bless on him; Prone, a condition, which the sheet lists among its conditions.
const effect = (parent, data) => ({
  documentName: 'ActiveEffect', parent, origin: null, disabled: false, isSuppressed: false, isTemporary: false, transfer: false,
  statuses: new Set(), duration: {}, description: '', system: {}, img: 'icons/effect.webp', ...data, _id: data.id,
})
thorin.effects.push(
  effect(thorin, { id: 'bless', name: 'Bless', isTemporary: true, description: '<p>A d4 added to attacks and saving throws.</p>' }),
  effect(thorin, { id: 'proneeffect', name: 'Prone', type: 'condition', statuses: new Set(['prone']) }),
)
const loot = (_id, name, system = {}) => ({ _id, name, type: 'loot', system: { quantity: 1, identified: true, ...system } })
embedded(thorin, {
  items: [
    loot('rope', 'Rope', { weight: { value: 10, units: 'lb' } }),
    {
      _id: 'cloak', name: 'Cloak', type: 'equipment', system: { quantity: 1, identified: true, equipped: true, attunement: 'required', attuned: true, weight: { value: 1, units: 'lb' } },
      effects: [{ _id: 'cloakfx', name: 'Cloak of Protection', transfer: true, description: '<p>+1 to armor class and saving throws.</p>' }],
    },
  ],
  currency: { gp: 15 },
})
// His favorites already, after Ki, the resource dnd5e lists first: Stealth, his 1st-level slots and Lucky.
const port = favoring(thorin, [{ type: 'skill', id: 'ste', sort: 100000 }, { type: 'slots', id: 'spell1', sort: 200000 }, { type: 'item', id: '.Item.lucky', sort: 300000 }])
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3, wis: 2 }, hp: { value: 24, max: 30, temp: 0 } }, {
  ac: 14,
  items: [{
    id: 'dagger', name: 'Dagger', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true, weight: { value: 1, units: 'lb' } },
    activities: [{ id: 'stab', attack: { ability: 'dex' }, damage: [{ number: 1, denomination: 4, bonus: '@mod', types: ['piercing'] }], labels: { modifier: '+6', damage: [hits('1d4 + 3', 'piercing')] } }],
  }],
})
vex.system.details = { level: 5 }
embedded(vex, { currency: { gp: 10 } })
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const company = group('company', 'The Iron Company', { members: [thorin, vex], ownership: { alice: 3, bob: 2 }, currency: { gp: 20 } })
embedded(company, { items: [loot('crope', 'Rope', { weight: { value: 10, units: 'lb' } })] })
Object.defineProperty(actors, 'party', { get: () => actors.get('company') ?? null, configurable: true })
// The Wolf, a companion Alice owns: a linked NPC, with a bite.
const wolf = companion('wolf', 'Wolf', {
  owners: ['alice'], linked: true, ac: 13,
  gear: { items: [{
    id: 'bite', name: 'Bite', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{ id: 'chomp', attack: { ability: 'str' }, damage: [{ number: 2, denomination: 4, bonus: '@mod', types: ['piercing'] }], labels: { modifier: '+4', damage: [hits('2d4 + 2', 'piercing')] } }],
  }] },
  npc: {
    spec: { mods: { str: 2, dex: 2 }, prof: 2, hp: { value: 11, max: 11, temp: 0 }, npc: { denomination: 8, max: 2, spent: 0 } },
    system: {
      traits: { size: 'med' }, details: { cr: 0.25, type: { value: 'beast', label: 'Beast' } },
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, attributes: { movement: { walk: 40, units: 'ft' }, init: { total: 2 } },
    },
  },
})
const arena = await activeScene('arena')
for (const actor of [thorin, wolf]) await place(arena, actor, { id: `tok-${actor.id}`, actorLink: true, tell: false })
const campaign = changes => ({ id: 'camp-ash', title: TITLE, characters: ['thorin', 'vex'], groups: ['company'], rolls: true, transfers: true, ...changes })
await startModule({ campaigns: [campaign()], secrets: { 'camp-ash': SECRET } })
await settled()

// ---- What's kept and posted ----
const hello = () => postsOf('bridge.hello').at(-1)
const favoritesEnabled = () => sql(`select "favoritesEnabled" from campaign where id = '${A}'`)
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }
const rowsOf = kind => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, role, "actorId", label, status, payload, result, "createdAt" from roll_request where "campaignId" = '${A}' and kind = '${kind}') r`))
const favorites = () => rowsOf('favorite')
/** The `count`th favorite, once the module has answered it and posted its result. */
async function answered(count, what) {
  await until(() => favorites().length >= count && ['done', 'failed'].includes(favorites()[count - 1].status), what, 30_000)
  const made = favorites()[count - 1]
  await until(() => postsOf('command.result').some(p => p.data?.id === made.id), `${what}: its result as posted`, 10_000)
  return made
}
/** Wait for room under the app's limit of 20 rolls a minute from a seat. */
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 15, 'room under the rate limit', 70_000)
/** Thorin's favorites in Foundry, by sort: `{type, id}` each. */
const stored = () => [...thorin.system.favorites].sort((a, b) => a.sort - b.sort).map(({ type, id }) => ({ type, id }))
/** Is this the last of Thorin's favorites in Foundry, by the highest sort? */
const lastStored = (type, id) => {
  const list = thorin.system.favorites
  const top = Math.max(...list.map(f => f.sort))
  const found = list.filter(f => f.id === id)
  return found.length === 1 && found[0].type === type && found[0].sort === top
}
/** A favorite posted as a page would post it, through a seat's API. */
const crafted = (who, api, favorite, extra = {}) => call(who.page, `${api}/rolls`, { method: 'POST', body: { kind: 'favorite', favorite, ...PLAIN, ...extra } })
/**
 * A change to Thorin in Foundry, a hit point lost, so that his sheet goes again: the module never
 * sends again a sheet the app refused, as one `relay.lose` loses is.
 */
const poke = () => thorin.update({ 'system.attributes.hp.value': thorin.system.attributes.hp.value - 1 })

// ---- Alice plays Thorin; Bob follows the invite and chooses Vex ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const API = '/api/characters/sheet-thorin'
const GM_API = `/api/campaigns/${A}/characters/thorin`
const WOLF_API = `${API}/companions/wolf`
const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin' })
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const sentBy = []
desk.page.on('request', request => {
  if (request.method() === 'POST' && /\/rolls$/.test(request.url())) sentBy.push(request.postDataJSON())
})
const view = async (who, path) => (await call(who.page, `${path}/table`)).json
const sheetOf = async (who, path = API) => (await view(who, path))?.sheet

// ---- The page's parts ----
/** The sheet's own tab, apart from any companion's. */
const tabOf = who => who.page.locator('#sheet-panel')
/** The favorites, a strip at the top of the tab or a column beside it. */
const panelOf = who => who.page.getByRole('region', { name: 'Favorites', exact: true }).or(who.page.getByRole('complementary', { name: 'Favorites', exact: true }))
const FAVORITES = 'section:has(> h2 > button[aria-expanded]), aside'
const TARGETS = ':is(summary, button[aria-expanded], div[tabindex="0"], span[tabindex="0"], li[tabindex="0"])'
/** What a row's menu opens from, by its name: outside the favorites, or within them. */
const rowTarget = (scope, name) => scope.locator(`${TARGETS}:not(:is(${FAVORITES}) *):not(:is(${FAVORITES}))`).filter({ hasText: new RegExp(`^${escapeRe(name)}`) }).first()
const panelTarget = (who, name) => panelOf(who).locator(TARGETS).filter({ hasText: new RegExp(`^${escapeRe(name)}`) }).first()
/** A row by its name, whatever it opens from, as one with no menu and nothing to open: its li. */
const plainRow = (scope, name) => scope.locator(`li:not(:is(${FAVORITES}) *)`).filter({ hasText: new RegExp(`^${escapeRe(name)}`) }).first()
const panelRow = (who, name) => panelOf(who).locator('li').filter({ hasText: new RegExp(`^${escapeRe(name)}`) }).first()
/** The names of the rows in a part of the sheet, the outermost, in order. */
const namesIn = scope => scope.locator('li').evaluateAll(rows => rows.filter(row => row.checkVisibility() && !row.parentElement.closest('li')).map(row => row.querySelector('.font-medium')?.textContent))
/** The names of the rows starred in a part of the sheet. */
const starredIn = scope => scope.getByText(', favorite', { exact: true }).evaluateAll(stars => stars.map(star => {
  // A row of a list, or of the Actions table.
  const row = star.closest('li, tr')
  return row?.querySelector('.font-medium')?.textContent ?? row?.textContent ?? null
}))
/** A menu, as a screen reader has it: each item's name, without what's said under it, whether it can be chosen, and why not. */
const lookOf = menu => menu.evaluate(m => {
  const said = ids => (ids ?? '').split(' ').filter(Boolean).map(id => document.getElementById(id)?.textContent.trim()).join(' ')
  const items = [...m.querySelectorAll('[role="menuitem"]')]
  return {
    items: items.map(i => i.textContent.replace(said(i.getAttribute('aria-describedby')), '').trim()),
    disabled: items.map(i => i.disabled === true || i.getAttribute('aria-disabled') === 'true'),
    reasons: items.map(i => said(i.getAttribute('aria-describedby'))),
    menu: said(m.getAttribute('aria-describedby')),
    focused: document.activeElement?.closest('[role="menuitem"]')?.textContent.replace(said(document.activeElement?.getAttribute('aria-describedby')), '').trim() ?? null,
    inside: m.contains(document.activeElement),
  }
})
const itemsOf = async menu => (await lookOf(menu)).items
/** A right-click on a row's name, near its start: the menu named so. */
async function menuOf(who, target, name, timeout = 10_000) {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  await target.click({ button: 'right', position: { x: Math.min(30, box.width / 2), y: Math.min(box.height / 2, 14) } })
  const menu = who.page.getByRole('menu', { name, exact: true })
  await menu.waitFor({ timeout })
  return menu
}
/** A right-click that should open no menu: whether none opened. */
async function noMenu(who, target) {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  await target.click({ button: 'right', position: { x: Math.min(30, box.width / 2), y: Math.min(box.height / 2, 14) } })
  await wait(500)
  const none = await who.page.getByRole('menu').count() === 0
  if (!none) await who.page.keyboard.press('Escape')
  return none
}
async function closeMenu(who, menu) {
  await who.page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
}
const toastLog = who => who.page.getByRole('log', { name: 'Roll results' })
/** The rolls' line of a label, as the rolls' button shows it in Toasts: its words. */
async function rollLine(who, label) {
  const dialog = who.page.getByRole('dialog', { name: 'Your rolls' })
  await who.page.getByRole('button', { name: /^Your rolls/ }).click()
  await dialog.waitFor()
  const line = dialog.locator('li').filter({ hasText: new RegExp(`^${escapeRe(label)}`) }).first()
  const text = (await line.count()) ? await line.textContent() : await dialog.textContent()
  await who.page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  return text
}
/** Until the page's own sheet says whether something is one of the character's favorites. */
const sheetSays = (who, test, what) => until(async () => test((await sheetOf(who))?.favorites ?? []), what, 15_000)
const GAME_WORDS = 'your Gamemaster’s game'
/** Choose an entry of a menu, and wait until the game has made it. */
async function chosen(menu, label, what) {
  await paced()
  const count = favorites().length
  await menu.getByRole('menuitem', { name: label, exact: true }).click()
  return answered(count + 1, what)
}
/** Until a row's menu says this, as the sheet comes back: its items. */
async function menuSays(who, target, name, items, what) {
  let seen = null
  await until(async () => {
    // A row may have no menu yet, as before its page's next poll.
    const menu = await menuOf(who, target, name, 3_000).catch(() => null)
    seen = menu && await itemsOf(menu)
    if (menu) await closeMenu(who, menu)
    return same(seen, items)
  }, what, 30_000).catch(() => {})
  return seen
}

if (SKEW036) {
  // ===============================================================================================
  // 15. Module 0.36.0: no favorites
  // ===============================================================================================
  part('15. module 0.36.0')
  check(!('favorites' in (hello().data.features ?? {})), `module 0.36.0's hello says nothing of favorites (${JSON.stringify(Object.keys(hello().data.features ?? {}))})`)
  await wait(4000)
  check(favoritesEnabled() === 'f', `the app keeps favoritesEnabled off (${favoritesEnabled()})`)
  await desk.tab('Inventory')
  await rowTarget(tabOf(desk), 'Rope').waitFor({ timeout: 15_000 })
  const tableView = await view(desk, API)
  check(tableView?.favorites === undefined, `Alice's view says nothing of favorites (${tableView?.favorites})`)
  const menu = await menuOf(desk, rowTarget(tabOf(desk), 'Rope'), 'Rope')
  const items = await itemsOf(menu)
  check(same(items, ['Send to…', 'Remove…']), `the Rope's menu is as module 0.36.0's: ${JSON.stringify(items)}`)
  await closeMenu(desk, menu)
  await desk.tab('Actions')
  await panelTarget(desk, 'Lucky').waitFor({ timeout: 15_000 })
  check(await noMenu(desk, panelTarget(desk, 'Lucky')), 'among his favorites, a right-click on Lucky opens no menu')
  const refused = await crafted(desk, API, { op: 'add', type: 'item', id: 'rope' })
  check(refused.status === 409 && refused.json?.reason === 'unavailable', `a crafted favorite: ${refused.status} ${refused.json?.reason}`)
  check(favorites().length === 0 && same(stored(), [{ type: 'skill', id: 'ste' }, { type: 'slots', id: 'spell1' }, { type: 'item', id: '.Item.lucky' }]), 'nothing is kept, and Foundry\'s favorites are as they were')
  await finish()
}

// =================================================================================================
// 1. The hello and the answer
// =================================================================================================
part('1. the hello and the answer')
{
  const features = hello().data.features
  // Changed on purpose (round 0.38.0 §D10.4): dishes from the Magical Recipe Book follow favorites, under dnd5e 6 too ("off").
  check(same(features.favorites, { enabled: true, kinds: ['favorite'], reason: null }) && same(Object.keys(features).slice(-3), ['companions', 'favorites', 'dishes'])
    && !(features.rolls?.kinds ?? []).includes('favorite') && !(features.companions?.kinds ?? []).includes('favorite'),
  `the hello offers favorites, after companions, before dishes, never among the rolls' nor a companion's kinds (${JSON.stringify({ favorites: features.favorites, keys: Object.keys(features) })})`)
  check(JSON.parse(hello().body ?? '{}').features?.favorites === 1, `the app answers favorites: 1 (${hello().body})`)
  await until(() => favoritesEnabled() === 't', 'the app to keep favorites on', 15_000)
  check(favoritesEnabled() === 't', 'the app keeps favoritesEnabled on in the campaign row')
  await until(async () => (await view(desk, API))?.favorites === true, 'Alice\'s view to offer favorites', 15_000)
  const [own, gm, pet] = await Promise.all([API, GM_API, WOLF_API].map(path => call(desk.page, `${path}/table`)))
  check(own.json?.favorites === true && gm.status === 200 && !('favorites' in (gm.json ?? {})) && pet.status === 200 && !('favorites' in (pet.json ?? {})),
    `Alice's view at Thorin's seat has favorites: true; the Gamemaster's at Thorin's page and the Wolf's pane's say nothing of them (${JSON.stringify([own.json?.favorites, gm.status, gm.json?.favorites, pet.status, pet.json?.favorites])})`)
}

// =================================================================================================
// 2. Add from Inventory
// =================================================================================================
part('2. add the Rope from Inventory')
await desk.tab('Inventory')
{
  const rope = rowTarget(tabOf(desk), 'Rope')
  await rope.waitFor({ timeout: 15_000 })
  await rope.scrollIntoViewIfNeeded()
  const box = await rope.boundingBox()
  await rope.click({ button: 'right', position: { x: 30, y: box.height / 2 } })
  let menu = desk.page.getByRole('menu', { name: 'Rope', exact: true })
  await menu.waitFor()
  const look = await lookOf(menu)
  const at = await menu.boundingBox()
  const pointer = { x: box.x + 30, y: box.y + box.height / 2 }
  const near = Math.min(Math.abs(at.y - pointer.y), Math.abs(at.y + at.height - pointer.y))
  check(same(look.items, ['Add to favorites', 'Send to…', 'Remove…']) && look.disabled.every(d => !d) && near < 60 && at.x <= pointer.x + 60 && at.x + at.width >= pointer.x - 60,
    `a right-click on the Rope's name opens its menu, "Rope", at the pointer: "Add to favorites" first, then "Send to…" and "Remove…" (${JSON.stringify([look.items, pointer, at])})`)
  const icon = await menu.getByRole('menuitem', { name: 'Add to favorites' }).evaluate(item => {
    const svg = item.querySelector('svg')
    return { lucide: svg?.getAttribute('class') ?? '', hidden: svg?.getAttribute('aria-hidden') }
  })
  check(/lucide-star\b/.test(icon.lucide) && /text-gold-text/.test(icon.lucide) && icon.hidden === 'true', `"Add to favorites" has the gold star, hidden from screen readers (${icon.lucide})`)
  await shootBoth(desk, 'favoriting-menu', menu)
  // Fetching held, so that it waits on its way.
  await paced()
  const messagesBefore = W.messages.size
  const chatBefore = (await view(desk, API))?.messages?.length ?? 0
  const postsBefore = posted.length
  await stopFetching()
  await menu.getByRole('menuitem', { name: 'Add to favorites' }).click()
  await menu.waitFor({ state: 'hidden' })
  await until(() => favorites().length === 1, 'the Rope\'s favorite to be posted', 15_000)
  const body = sentBy.at(-1)
  check(body?.kind === 'favorite' && sameJsonish(body.favorite, { op: 'add', type: 'item', id: 'rope' }) && same([body.mode, body.explicit, body.extras, body.dice], [0, false, [], []]),
    `the POST: ${JSON.stringify(body)}`)
  const row = favorites()[0]
  check(row.role === 'player' && row.actorId === 'thorin' && sameJsonish(row.payload?.favorite, { op: 'add', type: 'item', id: 'rope' }) && !('label' in (row.payload ?? {})) && !('typed' in (row.payload ?? {})),
    `kept for Thorin, the player's, its payload without a label: ${JSON.stringify({ role: row.role, actorId: row.actorId, payload: row.payload })}`)
  let line = await rollLine(desk, 'Rope')
  check(line?.includes(`Sending to ${GAME_WORDS}…`), `the rolls' line: "${line}"`)
  holdResults()
  startFetching()
  await until(() => favorites()[0].status === 'claimed', 'the module to take it', 20_000)
  await until(async () => (await rollLine(desk, 'Rope'))?.includes(`Adding it to favorites in ${GAME_WORDS}…`), 'the line to say it\'s being added', 10_000).catch(() => {})
  line = await rollLine(desk, 'Rope')
  check(line?.includes(`Adding it to favorites in ${GAME_WORDS}…`), `taken, the line says: "${line}"`)
  releaseResults()
  const made = await answered(1, 'the Rope added')
  await toastLog(desk).getByText('Added to favorites').first().waitFor({ timeout: 10_000 })
  const toast = await toastLog(desk).locator('[data-roll-toast]').filter({ hasText: 'Added to favorites' }).first().textContent()
  check(made.status === 'done' && made.result?.favorited === true && toast.startsWith('Rope'), `done, favorited; a toast "${toast}"`)
  line = await rollLine(desk, 'Rope')
  check(line?.includes('Added to favorites'), `the rolls' line: "${line}"`)
  check(lastStored('item', '.Item.rope') && stored().length === 4, `Foundry's favorites gain {type: "item", id: ".Item.rope"}, last, its sort the highest (${JSON.stringify(thorin.system.favorites)})`)
  const result = postsOf('command.result').find(p => p.data.id === made.id)
  const resultAt = posted.indexOf(result)
  const sheetAt = posted.findIndex((p, i) => i >= postsBefore && i < resultAt && p.type === 'character.updated' && p.data?.character?.id === 'thorin'
    && (p.data.character.sheet?.favorites ?? []).some(f => f.type === 'item' && f.id === 'rope'))
  check(sheetAt >= 0 && resultAt > sheetAt && result.data.favorited === true && result.data.messageId === null && same(result.data.rolls, []),
    `posted: Thorin's sheet with the Rope a favorite (${sheetAt}), then the result (${resultAt}): ${JSON.stringify(result.data)}`)
  await wait(1000)
  check(W.messages.size === messagesBefore && ((await view(desk, API))?.messages?.length ?? 0) === chatBefore, 'nothing is posted in Foundry\'s chat, nor the app\'s')
  await until(async () => (await namesIn(panelOf(desk))).at(-1) === 'Rope', 'the Rope among his favorites', 15_000)
  check(same(await namesIn(panelOf(desk)), ['Ki', 'Stealth', '1st Level', 'Lucky', 'Rope']), `his favorites list the Rope last: ${JSON.stringify(await namesIn(panelOf(desk)))}`)
  await until(async () => (await starredIn(tabOf(desk))).includes('Rope'), 'the Rope starred', 15_000)
  check(true, 'the Rope\'s row on Inventory is starred')
  menu = await menuOf(desk, rowTarget(tabOf(desk), 'Rope'), 'Rope')
  check(same(await itemsOf(menu), ['Remove from favorites', 'Send to…', 'Remove…']), `reopened, its menu: ${JSON.stringify(await itemsOf(menu))}`)
  const off = await menu.getByRole('menuitem', { name: 'Remove from favorites' }).evaluate(item => item.querySelector('svg')?.getAttribute('class') ?? '')
  check(/lucide-star-off\b/.test(off), `"Remove from favorites" has the struck star (${off})`)
  await closeMenu(desk, menu)
}
function sameJsonish(a, b) { return same(Object.keys(a ?? {}).sort().map(k => [k, a[k]]), Object.keys(b).sort().map(k => [k, b[k]])) }

// =================================================================================================
// 3. Remove from the panel, on a phone
// =================================================================================================
part('3. remove the Rope among his favorites, on a phone')
const phone = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin' })
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await phone.tab('Inventory')
{
  const strip = phone.page.getByRole('region', { name: 'Favorites', exact: true })
  const rope = panelTarget(phone, 'Rope')
  await rope.waitFor({ timeout: 15_000 })
  await rope.evaluate(el => el.scrollIntoView({ block: 'center' }))
  const box = await rope.boundingBox()
  await phone.hold(rope, 600)
  const menu = phone.page.getByRole('menu', { name: 'Rope', exact: true })
  await menu.waitFor({ timeout: 5_000 })
  const at = await menu.boundingBox()
  const finger = box.y + box.height / 2
  check(await strip.isVisible() && same(await itemsOf(menu), ['Remove from favorites']) && at.y + at.height <= finger,
    `a 600 ms held touch on the Rope in the Favorites strip opens its menu above the finger, "Remove from favorites" alone (${JSON.stringify({ items: await itemsOf(menu), menu: at, finger })})`)
  await shootBoth(phone, 'favoriting-menu', menu)
  const made = await chosen(menu, 'Remove from favorites', 'the Rope removed')
  await toastLog(phone).getByText('Removed from favorites').first().waitFor({ timeout: 10_000 })
  check(made.status === 'done' && made.result?.favorited === false && !thorin.system.favorites.some(f => f.id === '.Item.rope'),
    'done, favorited false: "Removed from favorites"; Foundry\'s favorites lose the Rope')
  await until(async () => (await panelTarget(phone, 'Rope').count()) === 0, 'the strip\'s Rope to go', 15_000)
  await until(async () => !(await starredIn(tabOf(phone))).includes('Rope'), 'the Rope\'s star to go', 15_000)
  check(same(await namesIn(strip), ['Ki', 'Stealth', '1st Level', 'Lucky']), `the strip's Rope row is gone, and its star: ${JSON.stringify(await namesIn(strip))}`)
}

// =================================================================================================
// 6. The keyboard (before the adds of step 4, which make these favorites)
// =================================================================================================
if (!DND5E6) {
  part('6. the keyboard')
  await desk.tab('Actions')
  const scope = tabOf(desk)
  const staff = rowTarget(scope, 'Staff of Embers')
  await staff.waitFor({ timeout: 15_000 })
  if (await staff.getAttribute('aria-expanded') !== 'true') await staff.click()
  const cast = rowTarget(scope, 'Cast Fireball')
  await cast.waitFor({ timeout: 10_000 })
  await cast.evaluate(el => el.scrollIntoView({ block: 'center' }))
  // Reached by Tab from what comes before it.
  const before = await cast.evaluate(el => {
    const all = [...document.querySelectorAll('a[href], button:not([disabled]), summary, input, [tabindex="0"]')].filter(n => n.getClientRects().length > 0)
    const at = all.indexOf(el)
    if (at > 0) all[at - 1].focus()
    return at
  })
  await desk.page.keyboard.press('Tab')
  const ring = await cast.evaluate(el => ({ focused: document.activeElement === el, visible: el.matches(':focus-visible'), shadow: getComputedStyle(el).boxShadow, tag: el.tagName }))
  check(before > 0 && ring.focused && ring.visible && ring.shadow !== 'none' && ring.tag === 'SPAN', `Tab reaches the Staff's Cast Fireball, its focus ring shown (${JSON.stringify(ring)})`)
  await desk.page.keyboard.press('Shift+F10')
  let menu = desk.page.getByRole('menu', { name: 'Cast Fireball', exact: true })
  await menu.waitFor()
  let bottom = (await cast.boundingBox()).y + (await cast.boundingBox()).height
  let look = await lookOf(menu)
  let below = await menu.evaluate((m, under) => m.getBoundingClientRect().top >= under - 2, bottom)
  check(below && same(look.items, ['Add to favorites']) && look.focused === 'Add to favorites', `Shift+F10 opens "Cast Fireball" below it, "Add to favorites" focused (${JSON.stringify(look)})`)
  await closeMenu(desk, menu)
  check(await cast.evaluate(el => document.activeElement === el), 'Escape closes it, focus back on its name')
  await desk.tab('Effects')
  const bless = rowTarget(tabOf(desk), 'Bless')
  await bless.waitFor({ timeout: 15_000 })
  await bless.focus()
  await desk.page.keyboard.press('ContextMenu')
  menu = desk.page.getByRole('menu', { name: 'Bless', exact: true })
  await menu.waitFor()
  bottom = (await bless.boundingBox()).y + (await bless.boundingBox()).height
  look = await lookOf(menu)
  below = await menu.evaluate((m, under) => m.getBoundingClientRect().top >= under - 2, bottom)
  check(below && same(look.items, ['Add to favorites']) && look.focused === 'Add to favorites', `the context-menu key on Bless's row opens "Bless" below it, "Add to favorites" focused (${JSON.stringify(look)})`)
  await closeMenu(desk, menu)
  check(await bless.evaluate(el => document.activeElement === el), 'Escape closes it, focus back on Bless\'s row')
}

// =================================================================================================
// 4. Every row (and 7, waiting, as Fire Bolt is added)
// =================================================================================================
part('4. every row')
/** Add a row's target, by right-click: its menu, what's made, where it's kept. */
async function addFrom(who, target, name, items, stored, what) {
  const menu = await menuOf(who, target, name)
  const seen = await itemsOf(menu)
  const made = await chosen(menu, 'Add to favorites', what)
  const [type, id] = stored
  check(same(seen, items) && made.status === 'done' && made.result?.favorited === true && lastStored(type, id),
    `${what}: its menu ${JSON.stringify(seen)}; made, kept in Foundry as {type: "${type}", id: "${id}"}, last`)
  // Until the app's sheet has it last, as the page's next poll brings it.
  await sheetSays(who, list => sheetId(list.at(-1)) === id, `${name} last in the app's sheet`)
  return made
}
/** A favorite as the app's sheet names it, by the id dnd5e stores it by. */
const sheetId = favorite => {
  if (!favorite) return null
  if (favorite.type === 'item') return `.Item.${favorite.id}`
  if (favorite.type === 'activity') return `.Item.${favorite.itemId}.Activity.${favorite.id}`
  if (favorite.type === 'effect') {
    const [first, second] = favorite.id.split('.')
    return second === undefined ? `.ActiveEffect.${first}` : `.Item.${first}.ActiveEffect.${second}`
  }
  return favorite.id
}
const panelNames = () => namesIn(panelOf(desk))
await desk.tab('Actions')
{
  const scope = tabOf(desk)
  await addFrom(desk, rowTarget(scope, 'Longsword'), 'Longsword', ['Add to favorites'], ['item', '.Item.longsword'], 'the Actions list\'s Longsword')
  await until(async () => (await panelNames()).at(-1) === 'Longsword', 'the Longsword last', 15_000)
  check(true, 'the Longsword shows last among his favorites')
  await until(async () => (await starredIn(scope)).includes('Longsword'), 'the Longsword starred', 15_000)
  check(true, 'and it\'s starred on the Actions tab')
}
await desk.tab('Spells')
{
  // 7. Waiting: fetching held, Fire Bolt added.
  part('7. waiting, as Fire Bolt is added')
  const scope = tabOf(desk)
  const bolt = rowTarget(scope, 'Fire Bolt')
  await bolt.waitFor({ timeout: 15_000 })
  let menu = await menuOf(desk, bolt, 'Fire Bolt')
  const items = await itemsOf(menu)
  await paced()
  const count = favorites().length
  const updates = port.updates
  await stopFetching()
  await menu.getByRole('menuitem', { name: 'Add to favorites' }).click()
  await until(() => favorites().length === count + 1, 'Fire Bolt\'s favorite to be posted', 15_000)
  menu = await menuOf(desk, bolt, 'Fire Bolt')
  let look = await lookOf(menu)
  check(same(items, ['Add to favorites']) && same(look.items, ['Add to favorites']) && same(look.disabled, [true]) && same(look.reasons, ['It’s on its way already'])
    && look.menu === 'It’s on its way already',
  `on Spells, Fire Bolt's menu "Add to favorites"; while it's on its way, disabled, described "It’s on its way already", as is the menu, whose only item it is (${JSON.stringify(look)})`)
  await shootBoth(desk, 'favoriting-waiting', menu)
  await closeMenu(desk, menu)
  const second = await crafted(desk, API, { op: 'add', type: 'item', id: 'firebolt' })
  check(second.status === 409 && second.json?.reason === 'moving', `a crafted second one for it meanwhile: ${second.status} ${second.json?.reason}`)
  // Its sheet lost on the way back, so the page has only the result.
  relay.lose = sent => sent.type === 'character.updated' && sent.data?.character?.id === 'thorin'
  const sentAt = Date.now()
  startFetching()
  const made = await answered(count + 1, 'Fire Bolt added')
  menu = await menuOf(desk, bolt, 'Fire Bolt')
  look = await lookOf(menu)
  const soon = Date.now() - sentAt
  check(made.status === 'done' && made.result?.favorited === true && favorites().length === count + 1 && port.updates === updates + 1
    && thorin.system.favorites.filter(f => f.id === '.Item.firebolt').length === 1 && same(look.disabled, [true]) && same(look.items, ['Add to favorites']),
  `fetching again, made once (one update, one entry in Foundry); done, and until the sheet comes the entry still waits (${soon} ms; ${JSON.stringify(look)})`)
  await closeMenu(desk, menu)
  // Past FAVORITE_SETTLE with the sheet still lost: it waits no more, and offers what the sheet says.
  await wait(Math.max(0, 10_500 - (Date.now() - sentAt)))
  menu = await menuOf(desk, bolt, 'Fire Bolt')
  look = await lookOf(menu)
  check(same(look.items, ['Add to favorites']) && same(look.disabled, [false]), `ten seconds on, with no sheet, it waits no more: ${JSON.stringify(look)}`)
  await closeMenu(desk, menu)
  relay.lose = null
  // The module doesn't send again a sheet the app refused, so the sheet comes with his next change.
  await poke()
  const seen = await menuSays(desk, bolt, 'Fire Bolt', ['Remove from favorites'], 'Fire Bolt\'s menu to say Remove')
  check(same(seen, ['Remove from favorites']), `the sheet come, its menu says "Remove from favorites" (${JSON.stringify(seen)})`)
  await until(async () => (await panelNames()).at(-1) === 'Fire Bolt', 'Fire Bolt last', 15_000)
  check(true, 'Fire Bolt shows last among his favorites')
}
part('4. every row, Features and Effects')
await desk.tab('Features')
{
  const scope = tabOf(desk)
  await addFrom(desk, rowTarget(scope, 'Second Wind'), 'Second Wind', ['Add to favorites'], ['item', '.Item.secondwind'], 'on Features, Second Wind')
  const fighter = rowTarget(scope, 'Fighter')
  const tag = await fighter.evaluate(el => ({ tag: el.tagName, tab: el.tabIndex }))
  check(tag.tag === 'LI' && tag.tab === 0, `the Fighter class card takes focus, as it has a menu (${JSON.stringify(tag)})`)
  await addFrom(desk, fighter, 'Fighter', ['Add to favorites'], ['item', '.Item.fighter'], 'the Fighter class card')
  const lucky = await menuOf(desk, rowTarget(scope, 'Lucky'), 'Lucky')
  check(same(await itemsOf(lucky), ['Remove from favorites']), `Lucky's row, already a favorite, says "Remove from favorites" (${JSON.stringify(await itemsOf(lucky))})`)
  await closeMenu(desk, lucky)
}
await desk.tab('Effects')
{
  const scope = tabOf(desk)
  // Banner on for this step: Effects shows the rolls once the player has acted.
  await desk.page.getByRole('button', { name: 'Settings', exact: true }).click()
  const cog = desk.page.getByRole('dialog', { name: 'Settings' })
  await cog.waitFor()
  await cog.getByRole('radiogroup', { name: 'Roll results' }).getByRole('radio', { name: 'Banner' }).click()
  await desk.page.keyboard.press('Escape')
  await cog.waitFor({ state: 'hidden' })
  const banner = desk.page.getByRole('region', { name: 'Your rolls' })
  await addFrom(desk, rowTarget(scope, 'Bless'), 'Bless', ['Add to favorites'], ['effect', '.ActiveEffect.bless'], 'on Effects, Bless')
  await banner.getByText('Added to favorites').first().waitFor({ timeout: 10_000 })
  const said = await banner.locator('li').filter({ hasText: /^Bless/ }).first().textContent().catch(() => banner.textContent())
  check(said.startsWith('Bless') && said.includes('Added to favorites'), `with Roll results Banner, Effects shows its line: "${said}"`)
  await addFrom(desk, rowTarget(scope, 'Cloak of Protection'), 'Cloak of Protection', ['Add to favorites'], ['effect', '.Item.cloak.ActiveEffect.cloakfx'], 'the Cloak\'s effect')
  await desk.page.getByRole('button', { name: 'Settings', exact: true }).click()
  await cog.waitFor()
  await cog.getByRole('radiogroup', { name: 'Roll results' }).getByRole('radio', { name: 'Toasts' }).click()
  await desk.page.keyboard.press('Escape')
  await cog.waitFor({ state: 'hidden' })
}
part('4. every row, the Actions table')
await desk.tab('Actions')
{
  await desk.page.getByRole('button', { name: 'Settings', exact: true }).click()
  const cog = desk.page.getByRole('dialog', { name: 'Settings' })
  await cog.waitFor()
  await cog.getByRole('group', { name: 'Actions layout' }).getByRole('button', { name: 'Table' }).click()
  await desk.page.keyboard.press('Escape')
  await cog.waitFor({ state: 'hidden' })
  const scope = tabOf(desk)
  await scope.locator('table').first().waitFor({ timeout: 10_000 })
  const sword = scope.locator('table button[aria-expanded]').filter({ hasText: /^Longsword/ }).first()
  const menu = await menuOf(desk, sword, 'Longsword')
  check(same(await itemsOf(menu), ['Remove from favorites']), `in the Actions table, the Longsword's menu: ${JSON.stringify(await itemsOf(menu))}`)
  await closeMenu(desk, menu)
  const staff = scope.locator('table button[aria-expanded]').filter({ hasText: /^Staff of Embers/ }).first()
  if (await staff.getAttribute('aria-expanded') !== 'true') await staff.click()
  const cast = scope.locator('table span[tabindex="0"]').filter({ hasText: /^Cast Fireball/ }).first()
  await cast.waitFor({ timeout: 10_000 })
  await addFrom(desk, cast, 'Cast Fireball', ['Add to favorites'], ['activity', '.Item.staff.Activity.castfireball'], 'in the table, the Staff\'s Cast Fireball beneath it')
  await until(async () => (await panelNames()).at(-1) === 'Cast Fireball', 'Cast Fireball last', 15_000)
  const seen = await menuSays(desk, cast, 'Cast Fireball', ['Remove from favorites'], 'Cast Fireball\'s menu to say Remove')
  const star = await cast.evaluate(el => el.textContent.includes(', favorite'))
  const staffStar = (await starredIn(scope)).includes('Staff of Embers')
  check(same(seen, ['Remove from favorites']) && !star && !staffStar, `then its menu says ${JSON.stringify(seen)}; no star on the sub-row, nor on the Staff, which isn't one`)
  await desk.page.getByRole('button', { name: 'Settings', exact: true }).click()
  await cog.waitFor()
  await cog.getByRole('group', { name: 'Actions layout' }).getByRole('button', { name: 'List' }).click()
  await desk.page.keyboard.press('Escape')
  await cog.waitFor({ state: 'hidden' })
}
const ADDED = ['Longsword', 'Fire Bolt', 'Second Wind', 'Fighter 5', 'Bless', 'Cloak of Protection', 'Cast Fireball']
{
  const names = await panelNames()
  check(same(names, ['Ki', 'Stealth', '1st Level', 'Lucky', ...ADDED]), `each shows last among his favorites, in the order added: ${JSON.stringify(names)}`)
  check(same(stored(), [
    { type: 'skill', id: 'ste' }, { type: 'slots', id: 'spell1' }, { type: 'item', id: '.Item.lucky' }, { type: 'item', id: '.Item.longsword' },
    { type: 'item', id: '.Item.firebolt' }, { type: 'item', id: '.Item.secondwind' }, { type: 'item', id: '.Item.fighter' }, { type: 'effect', id: '.ActiveEffect.bless' },
    { type: 'effect', id: '.Item.cloak.ActiveEffect.cloakfx' }, { type: 'activity', id: '.Item.staff.Activity.castfireball' },
  ]), `and Foundry's list matches, by the ids dnd5e's own menus build: ${JSON.stringify(stored())}`)
}
// 13. The panel, at every width, in both themes, once the toasts have gone.
const toastsGone = who => until(async () => (await toastLog(who).locator('[data-roll-toast]').count()) === 0, 'the toasts to go', 15_000).catch(() => {})
await toastsGone(desk)
await shootBoth(desk, 'favoriting-panel', panelOf(desk))
await phone.tab('Actions')
await until(async () => (await namesIn(panelOf(phone))).length === 11, 'the phone\'s strip with all of them', 15_000)
await toastsGone(phone)
await shootBoth(phone, 'favoriting-panel', panelOf(phone))

// =================================================================================================
// 5. The wands
// =================================================================================================
part('5. the wands')
await desk.tab('Actions')
{
  const scope = tabOf(desk)
  for (const [wand, burst, item] of [['Wand of Frost', 'Frost Burst', 'wandfrost'], ['Wand of Sparks', 'Spark Burst', 'wandsparks']]) {
    const row = rowTarget(scope, wand)
    if (await row.getAttribute('aria-expanded') !== 'true') await row.click()
    const sub = rowTarget(scope, burst)
    await sub.waitFor({ timeout: 10_000 })
    await addFrom(desk, sub, burst, ['Add to favorites'], ['activity', `.Item.${item}.Activity.burst`], `${wand}'s ${burst}`)
  }
  check(thorin.system.favorites.some(f => f.id === '.Item.wandfrost.Activity.burst') && thorin.system.favorites.some(f => f.id === '.Item.wandsparks.Activity.burst'),
    'both wands\' activities of one id are kept in Foundry, each by its item')
  await until(async () => (await panelNames()).includes('Frost Burst') && (await panelNames()).includes('Spark Burst'), 'both among his favorites', 15_000)
  check(same((await panelNames()).slice(-2), ['Frost Burst', 'Spark Burst']), `two rows among his favorites: ${JSON.stringify(await panelNames())}`)
  const menu = await menuOf(desk, panelTarget(desk, 'Frost Burst'), 'Frost Burst')
  check(same(await itemsOf(menu), ['Remove from favorites']), 'among his favorites, Frost Burst\'s menu: "Remove from favorites"')
  const made = await chosen(menu, 'Remove from favorites', 'Frost Burst removed')
  await until(async () => !(await panelNames()).includes('Frost Burst'), 'Frost Burst to go', 15_000)
  check(made.status === 'done' && made.result?.favorited === false && !thorin.system.favorites.some(f => f.id === '.Item.wandfrost.Activity.burst')
    && thorin.system.favorites.some(f => f.id === '.Item.wandsparks.Activity.burst') && (await panelNames()).includes('Spark Burst'),
  'removed from among them, Frost Burst goes from Foundry and the panel; Spark Burst stays in both')
}
if (DND5E6) {
  check(game.system.version === '6.0.5', 'all of it under dnd5e 6.0.5\'s stand-ins')
  await finish()
}

// =================================================================================================
// 8. Foundry first
// =================================================================================================
part('8. made a favorite in Foundry meanwhile')
await desk.tab('Inventory')
{
  const scope = tabOf(desk)
  const potion = rowTarget(scope, 'Potion of Healing')
  await potion.waitFor({ timeout: 15_000 })
  await stopFetching()
  relay.lose = sent => sent.type === 'character.updated' && sent.data?.character?.id === 'thorin'
  await thorin.system.addFavorite({ type: 'item', id: '.Item.potion' })
  const updates = port.updates
  await wait(1500)
  const menu = await menuOf(desk, potion, 'Potion of Healing')
  const items = await itemsOf(menu)
  const count = favorites().length
  await paced()
  const answer = desk.page.waitForResponse(r => r.request().method() === 'POST' && /\/rolls$/.test(r.url()))
  await menu.getByRole('menuitem', { name: 'Add to favorites' }).click()
  const status = (await answer).status()
  relay.lose = null
  await poke()
  startFetching()
  const made = await answered(count + 1, 'the Potion added again')
  await toastLog(desk).getByText('Added to favorites').first().waitFor({ timeout: 10_000 })
  check(same(items, ['Add to favorites', 'Send to…', 'Remove…']) && status === 202 && made.status === 'done' && made.result?.favorited === true && port.updates === updates
    && thorin.system.favorites.filter(f => f.id === '.Item.potion').length === 1,
  `the Gamemaster made the Potion a favorite in Foundry, her sheet not yet told: her menu still says "Add to favorites" (${JSON.stringify(items)}); taken (${status}), it's "Added to favorites", nothing written by her (${port.updates - updates} updates), one entry`)
  const seen = await menuSays(desk, potion, 'Potion of Healing', ['Remove from favorites', 'Send to…', 'Remove…'], 'the Potion\'s menu to say Remove')
  check(same(seen, ['Remove from favorites', 'Send to…', 'Remove…']), `within a poll, her menu: ${JSON.stringify(seen)}`)
}

// =================================================================================================
// 10. Never offered
// =================================================================================================
part('10. never offered')
await desk.tab('Features')
{
  const scope = tabOf(desk)
  const ki = plainRow(scope, 'Ki')
  await ki.waitFor({ timeout: 15_000 })
  const stop = await ki.locator(TARGETS).count()
  check((await starredIn(scope)).includes('Ki') && stop === 0 && await noMenu(desk, ki), `on Features, Ki's row, which the resource stands for, is starred, takes no focus and opens no menu (${stop})`)
}
await desk.tab('Actions')
{
  check(await noMenu(desk, panelRow(desk, 'Ki')), 'among his favorites, the Ki resource\'s row opens no menu')
  check(await noMenu(desk, panelRow(desk, '1st Level')), 'nor his 1st-level slots')
  const stealth = panelOf(desk).getByRole('button', { name: /^Stealth/ }).first()
  await stealth.click({ button: 'right' })
  const d20 = desk.page.getByRole('menu').first()
  await d20.waitFor({ timeout: 10_000 })
  const items = await itemsOf(d20)
  check(same(items, ['Roll with advantage', 'Roll with disadvantage', 'Modify roll…']), `Stealth's d20 menu is still its rolls' alone: ${JSON.stringify(items)}`)
  await closeMenu(desk, d20)
}
await desk.tab('Effects')
{
  const prone = tabOf(desk).locator(`${TARGETS}, li`).filter({ hasText: /^Prone/ }).first()
  await prone.waitFor({ timeout: 15_000 })
  check(await noMenu(desk, prone), 'a condition, Prone, opens no menu')
}
{
  await desk.party('The Iron Company')
  const panel = desk.page.getByRole('dialog', { name: 'The Iron Company' })
  const rope = panel.locator('summary, div[tabindex="0"]').filter({ hasText: /^Rope/ }).first()
  await rope.waitFor({ timeout: 15_000 })
  const menu = await menuOf(desk, rope, 'Rope')
  check(same(await itemsOf(menu), ['Send to…']), `the Company's Rope in its panel: ${JSON.stringify(await itemsOf(menu))}`)
  await closeMenu(desk, menu)
  await panel.getByRole('button', { name: 'Close' }).click()
}
{
  await desk.page.locator('#creature-tab-wolf').click()
  const pane = desk.page.locator('#creature-panel-wolf')
  await pane.waitFor()
  await desk.page.locator('#creature-wolf-sheet-tab-actions').click()
  const bite = pane.locator('button[aria-expanded]').filter({ hasText: /^Bite/ }).first()
  await bite.waitFor({ timeout: 15_000 })
  check(await noMenu(desk, bite), 'the Wolf\'s pane: a right-click on its Bite opens no menu')
  const refused = await crafted(desk, WOLF_API, { op: 'add', type: 'item', id: 'bite' })
  check(refused.status === 422, `a crafted favorite at the Wolf's seat: ${refused.status} ${refused.json?.reason}`)
  await desk.page.locator('#creature-tab-self').click()
}
const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin` })
await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await gm.tab('Inventory')
{
  const rope = rowTarget(gm.page.getByRole('tabpanel').first(), 'Rope')
  await rope.waitFor({ timeout: 15_000 })
  const menu = await menuOf(gm, rope, 'Rope')
  check(same(await itemsOf(menu), ['Send to…', 'Remove…']), `at Thorin's page as the Gamemaster, the Rope's menu: ${JSON.stringify(await itemsOf(menu))}`)
  await closeMenu(gm, menu)
  const refused = await crafted(gm, GM_API, { op: 'add', type: 'item', id: 'rope' })
  check(refused.status === 409 && refused.json?.reason === 'unavailable', `a crafted favorite from the Gamemaster's seat: ${refused.status} ${refused.json?.reason}`)
  await gm.view.close()
}

// =================================================================================================
// 9. Refusals
// =================================================================================================
part('9. refusals')
await desk.tab('Inventory')
{
  const scope = tabOf(desk)
  const rope = rowTarget(scope, 'Rope')
  await stopFetching()
  relay.lose = sent => sent.type === 'character.updated' && sent.data?.character?.id === 'thorin'
  await thorin.deleteEmbeddedDocuments('Item', ['rope'])
  await wait(1500)
  const menu = await menuOf(desk, rope, 'Rope')
  const count = favorites().length
  await paced()
  const answer = desk.page.waitForResponse(r => r.request().method() === 'POST' && /\/rolls$/.test(r.url()))
  await menu.getByRole('menuitem', { name: 'Add to favorites' }).click()
  const status = (await answer).status()
  relay.lose = null
  startFetching()
  const made = await answered(count + 1, 'the Rope, deleted meanwhile')
  const words = 'Not added to favorites: it can’t be found in the game any more'
  await toastLog(desk).getByText(words).first().waitFor({ timeout: 10_000 })
  check(status === 202 && made.status === 'failed' && made.result?.reason === 'gone' && !thorin.system.favorites.some(f => f.id === '.Item.rope'),
    `the Gamemaster deleted the Rope in Foundry, her sheet not yet told: her add is taken (${status}), and the module's "gone": "${words}"`)
  const results = [
    await crafted(desk, API, { op: 'add', type: 'item', id: 'nowhere' }),
    await crafted(desk, API, { op: 'add', type: 'resource', id: 'primary' }),
    await crafted(desk, API, { op: 'add', type: 'item', id: 'potion', item: 'potion' }),
    await crafted(desk, API, { op: 'remove', type: 'tool', id: 'resources.primary' }),
  ].map(r => [r.status, r.json?.reason ?? null])
  check(same(results.map(([s]) => s), [422, 400, 400, 400]) && results[0][1] === 'gone' && thorin.system.resources.primary.max === 4,
    `crafted: an item the held sheet lacks 422 gone; a "resource" 400; "item" on an item 400; a tool "resources.primary" 400; Ki's maximum still 4 (${JSON.stringify(results)})`)
}
{
  // Vex, whose game character has no favorites of dnd5e's: the module's "unknown".
  const bob = await browse({ width: 768, height: 1024, scheme: 'dark', who: BOB })
  await bob.page.goto(invite)
  await bob.page.getByRole('radio', { name: /^Vex/ }).check()
  await bob.page.getByRole('button', { name: 'Join as this character' }).click()
  await bob.page.waitForURL(/\/characters\/[\w-]+$/)
  await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await bob.tab('Inventory')
  const dagger = rowTarget(bob.page.getByRole('tabpanel').first(), 'Dagger')
  await dagger.waitFor({ timeout: 15_000 })
  await until(async () => (await view(bob, `/api/characters/${sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)}`))?.favorites === true, 'Bob\'s view to offer favorites', 15_000)
  const menu = await menuOf(bob, dagger, 'Dagger')
  const items = await itemsOf(menu)
  // 13. A menu at 768, in both themes.
  await shootBoth(bob, 'favoriting-menu', menu)
  const count = favorites().length
  const made = await chosen(menu, 'Add to favorites', 'Vex\'s Dagger')
  const words = 'Not added to favorites: your character in the game can’t make it'
  await toastLog(bob).getByText(words).first().waitFor({ timeout: 10_000 })
  check(same(items, ['Add to favorites', 'Send to…', 'Remove…']) && made.status === 'failed' && made.result?.reason === 'unknown' && made.actorId === 'vex' && favorites().length === count + 1,
    `Bob's menu on Vex's Dagger ${JSON.stringify(items)}; Vex has no favorites in the game, the module's "unknown": "${words}"`)
  await bob.view.close()
}

// =================================================================================================
// 11. No switch
// =================================================================================================
part('11. no switch')
await desk.tab('Inventory')
{
  const scope = tabOf(desk)
  const hellos = postsOf('bridge.hello').length
  await game.settings.set('sending-stone', 'campaigns', [campaign({ rolls: false })])
  await until(() => postsOf('bridge.hello').length > hellos && postsOf('bridge.hello').at(-1).data.features.rolls?.enabled === false, 'the hello with rolls off', 15_000)
  await wait(1500)
  const frost = rowTarget(scope, 'Wand of Frost')
  await addFrom(desk, frost, 'Wand of Frost', ['Add to favorites', 'Send to…', 'Remove…'], ['item', '.Item.wandfrost'], 'with Players roll in the app off, the Wand of Frost')
  await desk.page.getByRole('button', { name: 'Settings', exact: true }).click()
  const cog = desk.page.getByRole('dialog', { name: 'Settings' })
  await cog.waitFor()
  const send = cog.getByRole('switch', { name: 'Send to the table', exact: true })
  if (await send.count() && await send.isChecked()) await send.locator('xpath=ancestor::label[1]').click()
  const off = (await send.count()) === 0 || !(await send.isChecked())
  await desk.page.keyboard.press('Escape')
  await cog.waitFor({ state: 'hidden' })
  // As the page's next poll brings the sheet with it a favorite.
  const items = await menuSays(desk, frost, 'Wand of Frost', ['Remove from favorites', 'Send to…', 'Remove…'], 'the Wand of Frost\'s menu to say Remove')
  const menu = await menuOf(desk, frost, 'Wand of Frost')
  const made = await chosen(menu, 'Remove from favorites', 'with Send to the table off, the Wand of Frost removed')
  check(off && same(items, ['Remove from favorites', 'Send to…', 'Remove…']) && made.status === 'done' && made.result?.favorited === false && !thorin.system.favorites.some(f => f.id === '.Item.wandfrost'),
    `with this device's Send to the table off too, still offered and made: ${JSON.stringify(items)}`)
}

// =================================================================================================
// 11. Foundry closed a while: no longer offered, as the page's view says, its 204 key with it
// =================================================================================================
part('11. Foundry closed a while')
await desk.tab('Features')
{
  const lucky = rowTarget(tabOf(desk), 'Lucky')
  await lucky.waitFor({ timeout: 15_000 })
  await stopFetching({ age: [A] })
  await until(async () => (await view(desk, API))?.favorites === undefined, 'the view to stop offering favorites', 15_000)
  let none = false
  await until(async () => (none = await noMenu(desk, lucky)), 'Lucky\'s menu to go, as the page polls', 20_000).catch(() => {})
  check(none, 'Foundry closed a while: the view offers no favorites, and the page, polling, drops Lucky\'s menu')
  startFetching()
  await until(async () => (await view(desk, API))?.favorites === true, 'the view to offer favorites again', 45_000)
  const back = await menuSays(desk, lucky, 'Lucky', ['Remove from favorites'], 'Lucky\'s menu to come back')
  check(same(back, ['Remove from favorites']), `open again, it's offered again: ${JSON.stringify(back)}`)
}

// =================================================================================================
// 12. On a phone
// =================================================================================================
part('12. on a phone')
for (const width of [390, 360]) {
  const small = width === 390 ? phone : await browse({ width: 360, height: 780, path: '/characters/sheet-thorin' })
  if (width === 360) await small.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await small.tab('Features')
  const scope = tabOf(small)
  const lucky = rowTarget(scope, 'Lucky')
  await lucky.waitFor({ timeout: 15_000 })
  await lucky.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await small.hold(lucky, 600)
  const menu = small.page.getByRole('menu', { name: 'Lucky', exact: true })
  await menu.waitFor({ timeout: 5_000 })
  await wait(300)
  const at = await menu.boundingBox()
  const look = await small.page.evaluate(() => ({ width: document.documentElement.clientWidth, height: innerHeight, selected: String(getSelection()) }))
  const open = await lucky.evaluate(el => el.closest('details')?.open ?? false)
  check(same(await itemsOf(menu), ['Remove from favorites']) && at.x >= 8 - 0.5 && at.x + at.width <= look.width - 8 + 0.5 && at.y >= 8 - 0.5 && at.y + at.height <= look.height - 8 + 0.5
    && !open && look.selected === '' && await sideways(small.page) === 0,
  `at ${width} px, a held touch on Lucky's row opens its menu within the screen, 8 px from its edges; let go, the row's still closed, its name not selected, nothing sideways (${JSON.stringify({ at, look, open })})`)
  await closeMenu(small, menu)
  // A drag while pressed, as a scroll: 30 px within the press, and on, as a finger scrolling the
  // list does; nothing opens, and the list scrolls.
  await small.tab('Inventory')
  const sword = panelTarget(small, 'Longsword')
  await sword.waitFor({ timeout: 15_000 })
  await sword.evaluate(el => el.scrollIntoView({ block: 'center' }))
  const box = await sword.boundingBox()
  const x = box.x + Math.min(30, box.width / 2)
  const y = box.y + box.height / 2
  const scrolls = () => small.page.evaluate(() => [document.scrollingElement, ...document.querySelectorAll('*')]
    .filter(el => el.scrollHeight > el.clientHeight + 1).reduce((sum, el) => sum + el.scrollTop, 0))
  const scrolled = await scrolls()
  const cdp = await small.view.newCDPSession(small.page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let step = 1; step <= 9; step++) {
    await small.page.waitForTimeout(15)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 10 }] })
  }
  await small.page.waitForTimeout(600)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  await wait(400)
  const after = await scrolls()
  check(await small.page.getByRole('menu').count() === 0 && after > scrolled && await sword.getAttribute('aria-expanded') === 'false',
    `at ${width} px, a drag of 30 px and on while pressed on Longsword among his favorites opens nothing, nor the row, and scrolls (${scrolled} → ${after})`)
  if (width === 360) await small.view.close()
}

// =================================================================================================
// 13. Widths and themes: a menu at 1280, 768 (Bob's) and 390, in both themes, and the panel, above
// =================================================================================================
part('13. widths and themes')
const tablet = await browse({ width: 768, height: 1024, path: '/characters/sheet-thorin' })
await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
for (const who of [desk, tablet, phone]) {
  await who.tab('Inventory')
  const potion = rowTarget(tabOf(who), 'Potion of Healing')
  await potion.waitFor({ timeout: 15_000 })
  for (const scheme of ['light', 'dark']) {
    await theme(who, scheme)
    const menu = await menuOf(who, potion, 'Potion of Healing')
    const look = await menu.evaluate(m => {
      const box = m.getBoundingClientRect()
      const item = m.querySelector('[role="menuitem"]')
      return { inside: box.left >= 0 && box.right <= document.documentElement.clientWidth, height: item.getBoundingClientRect().height, width: box.width }
    })
    check(look.inside && look.width >= 224 && look.height >= 24 && await sideways(who.page) === 0,
      `at ${who.width} px, ${scheme}: the Potion's menu within the screen, at least 224 px wide, its items ${Math.round(look.height)} px tall; nothing sideways`)
    // The whole page, the menu open on it.
    await shoot(who, 'favoriting-potion-menu')
    await closeMenu(who, menu)
  }
  await theme(who, 'light')
}
note(`Thorin's favorites at the end: ${JSON.stringify(stored())}`)
await finish()
