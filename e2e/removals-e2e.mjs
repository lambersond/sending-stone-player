// An item removed from a character (module 0.33.0 and the app, its contract §9.3, decisions 2), end
// to end, in the world of world-030.mjs, its actors' items Foundry's embedded documents. Alice plays
// Thorin and runs "Iron Hills", rolls and moves off at first; Bob plays Vex. Thorin holds 3 Potions
// of Healing (a compendium's, which he can drink: its row rolls), a Rope (one of his favorites), a
// Backpack with a Bedroll and a Pouch holding a Gem, an unidentified Strange Vial (a Potion of Giant
// Strength), 0 Arrows, an equipped and attuned Ring of Protection, a Longsword (an attack's row), a
// Sealed Chest (an unidentified Iron Strongbox) hiding a Letter, a Pebble with nothing to open (a
// plain row), 3 Torches, 2 of "Pick <b>Axe</b>", a Sack holding a Candle and a lantern with a long name. The Iron Company, the
// primary party, Alice's user owns; it holds a Rope. With rolls and moves off: the hello offers
// removals and the module fetches all the same; "Remove…" in the item's own menu by a right-click,
// a held touch, Shift+F10 on a row that rolls and on a plain row; never among the favorites nor on
// the party's sheet. The confirmation for one, for part of a stack ("How many", set to all), for a
// container ("Everything in it goes too."), for one in a container, one that hides what it holds,
// an unidentified one, a worn one and a stack of none, each with its public line "Removes …" in
// Foundry's chat as Thorin, badged, and in the app's, the tray and a toast. Refused by the module
// (fewer than asked, or how many there are has changed, in Foundry alone) and by the app (crafted);
// `typed` never badges a line. While a removal is on its way, "Remove…" waits, and a second is
// refused; moves on, a give on its way does too; the Gamemaster's removal racing it finds it gone.
// The Gamemaster's own, marked theirs. Every width in both themes. DND5E6=1: steps 1-10 under dnd5e
// 6.0.5's stand-ins. SKEW=032 with MODULE=module-0.32.0: no Remove at all, and with rolls and moves
// off no fetching. Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { JSDOM } from 'jsdom'
import {
  BASE, BOB, DND5E6, MODULE, SKEW032, W, actors, browse, call, character, check, embedded, escapeRe, finish, foundryWorld,
  group, holdWrite, launch, newCampaign, note, part, posted, postsOf, quantityInFoundry, same, sameJson, settled, shoot, shootBoth,
  sideways, sql, startModule, theme, until, wait, writes,
} from './world-030.mjs'

const GAME = 'https://iron-hills.forge-vtt.com'
const SECRET = 'iron-hills-removals-33'
const TITLE = 'Iron Hills'
const NEW = !SKEW032
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'iron-hills.forge-vtt.com', secret: SECRET })
await foundryWorld()
game.modules.get('sending-stone').version = SKEW032 ? '0.32.0' : '0.33.0'

// When the module's fetches for commands begin.
const fetchStarts = []
{
  const inner = globalThis.fetch
  globalThis.fetch = (url, init) => {
    if (String(url).endsWith('/api/bridge/commands')) fetchStarts.push(Date.now())
    return inner(url, init)
  }
}
// Manage Campaigns, drawn from the module's own templates in jsdom, as the Gamemaster uses it.
process.env.MODULE_DIR ??= MODULE
const windowApp = await import('./fvtt/settings-app.mjs')

// ---- The world ----
const POTION = 'Compendium.dnd5e.items.Item.phb-potion'
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${type}` })
const DRINK = [{ id: 'drink', type: 'heal', affects: 'self', range: 'self', healing: { number: 2, denomination: 4, bonus: '2', types: ['healing'] }, labels: { damage: [hits('2d4 + 2', 'healing')] } }]
const potionData = (id, quantity) => ({
  id, _id: id, name: 'Potion of Healing', type: 'consumable', _stats: { compendiumSource: POTION },
  system: { quantity, identified: true, properties: [], weight: { value: 0.5, units: 'lb' } }, activities: DRINK,
})
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, wis: 1 }, hp: { value: 30, max: 38, temp: 0 } }, {
  ac: 16,
  items: [
    {
      id: 'longsword', name: 'Longsword', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true, weight: { value: 3, units: 'lb' } },
      activities: [{ id: 'slash', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+5', damage: [hits('1d8 + 3', 'slashing')] } }],
    },
    potionData('potion', 3),
  ],
})
thorin.system.details = { level: 5 }
// His Rope, a favorite.
thorin.system.favorites = [{ type: 'item', id: '.Item.rope', sort: 100000 }]
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const loot = (_id, name, system = {}) => ({ _id, name, type: 'loot', system: { quantity: 1, identified: true, ...system } })
embedded(thorin, {
  items: [
    loot('rope', 'Rope', { weight: { value: 10, units: 'lb' } }),
    { _id: 'backpack', name: 'Backpack', type: 'container', system: { quantity: 1, identified: true, capacity: { count: 10 }, weight: { value: 5, units: 'lb' } } },
    loot('bedroll', 'Bedroll', { container: 'backpack', weight: { value: 7, units: 'lb' } }),
    { _id: 'pouch', name: 'Pouch', type: 'container', system: { quantity: 1, identified: true, container: 'backpack', capacity: { count: 5 }, weight: { value: 1, units: 'lb' } } },
    loot('gem', 'Gem', { container: 'pouch', weight: { value: 0.1, units: 'lb' } }),
    {
      _id: 'vial', name: 'Potion of Giant Strength', type: 'consumable', _stats: { compendiumSource: 'Compendium.dnd5e.items.Item.dmg-giant-strength' },
      system: { quantity: 1, identified: false, unidentified: { name: 'Strange Vial', description: '<p>A cloudy vial.</p>' }, description: { value: '<p>Your Strength becomes 21.</p>' } },
    },
    { _id: 'arrows', name: 'Arrows', type: 'consumable', system: { quantity: 0, identified: true, weight: { value: 0.05, units: 'lb' } } },
    { _id: 'ring', name: 'Ring of Protection', type: 'equipment', system: { quantity: 1, identified: true, equipped: true, attunement: 'required', attuned: true, weight: { value: 0, units: 'lb' } } },
    {
      _id: 'chest', name: 'Iron Strongbox', type: 'container',
      system: { quantity: 1, identified: false, properties: ['unidentifiedContents'], unidentified: { name: 'Sealed Chest' }, capacity: { count: 4 }, weight: { value: 15, units: 'lb' } },
    },
    loot('letter', 'Letter', { container: 'chest' }),
    loot('pebble', 'Pebble'),
    { _id: 'torch', name: 'Torch', type: 'consumable', system: { quantity: 3, identified: true, weight: { value: 1, units: 'lb' } } },
    loot('pickaxe', 'Pick <b>Axe</b>', { quantity: 2, weight: { value: 10, units: 'lb' } }),
    { _id: 'sack', name: 'Sack', type: 'container', system: { quantity: 1, identified: true, capacity: { count: 5 }, weight: { value: 0.5, units: 'lb' } } },
    loot('candle', 'Candle', { container: 'sack', weight: { value: 0.1, units: 'lb' } }),
    // A name long enough that its dialog's title wraps on a small phone.
    loot('lantern', 'Lantern of the Deep Roads, Ever-Burning and Hooded', { weight: { value: 2, units: 'lb' } }),
  ],
  currency: { gp: 15 },
})
embedded(vex, { currency: { gp: 10 } })
const company = group('company', 'The Iron Company', { members: [thorin, vex], ownership: { alice: 3, bob: 2 }, currency: { gp: 20 } })
embedded(company, { items: [loot('crope', 'Rope', { weight: { value: 10, units: 'lb' } })] })
Object.defineProperty(actors, 'party', { get: () => actors.get('company') ?? null, configurable: true })
const campaign = changes => ({ id: 'camp-iron', title: TITLE, characters: ['thorin', 'vex'], groups: ['company'], rolls: false, ...changes })

await startModule({ campaigns: [campaign()], secrets: { 'camp-iron': SECRET } })
await settled()

// ---- What's kept and posted ----
const hello = () => postsOf('bridge.hello').at(-1)
const removalsEnabled = () => sql(`select "removalsEnabled" from campaign where id = '${A}'`)
const transfersEnabled = () => sql(`select "transfersEnabled" from campaign where id = '${A}'`) === 't'
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }
/** A removal posted as a page would post it, through a seat's API. */
const crafted = (who, api, remove, extra = {}) => call(who.page, `${api}/rolls`, { method: 'POST', body: { kind: 'remove', remove, ...PLAIN, ...extra } })
const rowsOf = kind => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, role, "actorId", label, status, payload, result, "createdAt" from roll_request where "campaignId" = '${A}' and kind = '${kind}') r`))
const removals = () => rowsOf('remove')
const moves = () => rowsOf('transfer')
/** The lines Foundry's chat has of removals: their text, speaker, author, the module's flags, whisper. */
const lines = () => [...W.messages.values()].filter(m => /^<p>Removes /.test(m.content ?? ''))
  .map(m => ({ text: m.content.slice(3, -4), actor: m.speaker?.actor, author: m.author?.id ?? m.author, by: m.flags?.['sending-stone']?.by ?? null, flags: m.flags?.['sending-stone'] ?? {}, whisper: m.whisper ?? [], id: m.id, message: m }))
const lastLine = () => lines().at(-1)
/** Every item an inventory lists, at any depth. */
const listed = inventory => [...(inventory?.sections ?? []).flatMap(s => s.items), ...(inventory?.containers ?? [])]
  .flatMap(function flat(item) { return [item, ...(item.contents ?? []).flatMap(flat)] })
const holding = (actor, name) => [...actor.items].filter(it => it.name === name)
/** The `count`th removal, once the module has answered it and posted its result. */
async function answered(count, what, rows = removals) {
  await until(() => rows().length >= count && ['done', 'failed'].includes(rows()[count - 1].status), what, 30_000)
  const made = rows()[count - 1]
  await until(() => postsOf('command.result').some(p => p.data?.id === made.id), `${what}: its result as posted`, 10_000)
  return made
}
/** Wait for room under the app's limit of 20 rolls and moves a minute from a seat. */
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 16, 'room under the rate limit', 70_000)
/** The badge the module puts on a message's card in Foundry, as Foundry draws a chat card. */
const { markAppRoll } = await import(`${MODULE}/scripts/command-rolls.mjs`)
function badgeOn(message) {
  const dom = new JSDOM(`<ol id="chat-log"><li class="chat-message"><header class="message-header"><h4 class="message-sender">Thorin</h4><span class="message-metadata"><time>Now</time></span></header><div class="message-content">${message.content ?? ''}</div></li></ol>`)
  const held = { document: globalThis.document, HTMLElement: globalThis.HTMLElement }
  Object.assign(globalThis, { document: dom.window.document, HTMLElement: dom.window.HTMLElement })
  try { markAppRoll(message, dom.window.document.querySelector('li')) } finally { Object.assign(globalThis, held) }
  return dom.window.document.querySelector('.sending-stone-badge')?.getAttribute('aria-label') ?? null
}
const BADGE = 'Rolled on Sending Stone'
const BADGE_GM = 'Rolled on Sending Stone by the Gamemaster'

if (NEW) {
  part('1. the hello and fetching')
  const features = hello().data.features
  check(same(features.removals, { enabled: true, kinds: ['remove'], reason: null }) && features.transfers?.enabled === false && features.rolls?.enabled === false,
    `the hello offers removals, moves and rolls off: ${JSON.stringify({ removals: features.removals, transfers: features.transfers?.enabled, rolls: features.rolls?.enabled })}`)
  await until(() => removalsEnabled() === 't', 'the app to keep removals on', 15_000)
  check(removalsEnabled() === 't', 'the app keeps removalsEnabled on in the campaign row')
  await until(() => fetchStarts.length > 0, 'the module to fetch', 20_000)
  check(fetchStarts.length > 0, `with rolls and moves off, the module fetches /api/bridge/commands all the same (${fetchStarts.length} so far)`)
} else {
  part('19. module 0.32.0')
  check(!('removals' in (hello().data.features ?? {})), `module 0.32.0's hello says nothing of removals (${JSON.stringify(Object.keys(hello().data.features ?? {}))})`)
  await wait(4000)
  check(removalsEnabled() === 'f', `the app keeps removalsEnabled off (${removalsEnabled()})`)
}

// ---- Alice plays Thorin; Bob follows the invite and chooses Vex ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const alice = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const bob = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB, toasts: false })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const vexSheet = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)
const ALICE_API = '/api/characters/sheet-thorin'
const BOB_API = `/api/characters/${vexSheet}`
const GM_API = actor => `/api/campaigns/${A}/characters/${actor}`

// The posts each page makes of its rolls and removals, as sent, and the app's answers.
const sentBy = new Map()
const answersTo = new Map()
const watchPosts = who => {
  sentBy.set(who, [])
  answersTo.set(who, [])
  who.page.on('request', request => {
    if (request.method() === 'POST' && /\/rolls$/.test(request.url())) sentBy.get(who).push(request.postDataJSON())
  })
  who.page.on('response', response => {
    if (response.request().method() === 'POST' && /\/rolls$/.test(response.url())) answersTo.get(who).push(response.status())
  })
}
watchPosts(alice)

const tabpanel = who => who.page.getByRole('tabpanel').first()
// The favorites strip (a section headed by its own toggle) and column (an aside) are left out:
// nothing is removed there. The row is the li nearest its name.
const FAVORITES = 'section:has(> h2 > button[aria-expanded]), aside'
/** An item's row on the Inventory, by its name: its li. */
const rowOf = (scope, name) => scope.locator(`:is(summary, button[aria-expanded], div[tabindex="0"]):not(:is(${FAVORITES}) *)`)
  .filter({ hasText: new RegExp(`^${escapeRe(name)}`) }).first().locator('xpath=ancestor::li[1]')
/** What a row's menu opens from: its summary, its name's button where it rolls, or a plain row. */
const targetOf = li => li.locator(':scope > details > summary, :scope > div[tabindex="0"], button[aria-expanded]').first()
/** A right-click on a row's name: the menu named the item's name. */
async function menuOf(who, li, name) {
  const target = targetOf(li)
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  await target.click({ button: 'right', position: { x: Math.min(40, box.width / 2), y: box.height / 2 } })
  const menu = who.page.getByRole('menu', { name })
  await menu.waitFor({ timeout: 10_000 })
  return menu
}
const itemsOf = menu => menu.getByRole('menuitem').allTextContents()
const summary = d => d.locator('p[aria-live="polite"]').first().textContent()
const tray = who => who.page.getByRole('region', { name: 'Your rolls' })
const toastLog = who => who.page.getByRole('log', { name: 'Roll results' })
const sheetOf = async (who, api) => (await call(who.page, `${api}/table`)).json?.sheet
/** Until the page's sheet has an item as many times, or not at all. */
async function sheetHas(who, api, name, quantity, what) {
  await until(async () => {
    const it = listed((await sheetOf(who, api))?.inventory).find(i => i.name === name)
    return quantity === null ? !it : (it?.quantity ?? 1) === quantity
  }, what, 15_000)
}
async function chatHas(who, api, text, speaker) {
  await until(async () => (await call(who.page, `${api}/table`)).json?.messages?.some(m => (m.speaker === speaker) && (m.text ?? '').includes(text)), `"${text}" in the app's chat`, 15_000)
  return true
}
/** Opens Remove… from a row's menu: the dialog. */
async function removeFrom(who, li, name) {
  const menu = await menuOf(who, li, name)
  await menu.getByRole('menuitem', { name: 'Remove…' }).click()
  const dialog = who.page.getByRole('dialog', { name: `Remove ${name}?`, exact: true })
  await dialog.waitFor({ timeout: 10_000 })
  return dialog
}
const removeButton = dialog => dialog.getByRole('button', { name: 'Remove', exact: true })
/** Until the page's own row of an item shows its count, as its view's poll brings it. */
const rowShows = (scope, name, marks, what) => until(async () => ((await rowOf(scope, name).count()) > 0) && (await rowOf(scope, name).textContent()).includes(marks), what, 15_000)
const removesNow = async (who, api) => (await call(who.page, `${api}/table`)).json?.removes === true

// =================================================================================================
// 2. The menu with moves off
// =================================================================================================
part('2. the menu, moves off')
await alice.tab('Inventory')
const sheetTab = tabpanel(alice)
await rowOf(sheetTab, 'Rope').waitFor({ timeout: 15_000 })
if (NEW) await until(() => removesNow(alice, ALICE_API), 'the view to let Alice remove items', 15_000)
check(await sheetTab.getByRole('button', { name: /^Give/ }).count() === 0 && await sheetTab.getByRole('button', { name: /^Send to/ }).count() === 0,
  'moves off: no "Give…" nor "Send to" anywhere on Thorin\'s Inventory')

if (SKEW032) {
  // Module 0.32.0: no menu at all with moves off, and "Send to…" alone with them on.
  await targetOf(rowOf(sheetTab, 'Rope')).click({ button: 'right' })
  await wait(600)
  check(await alice.page.getByRole('menu').count() === 0 && await alice.page.getByRole('menuitem', { name: 'Remove…' }).count() === 0 && !(await removesNow(alice, ALICE_API)),
    'with module 0.32.0 and moves off, a right-click on the Rope opens no menu, and there\'s no "Remove…" anywhere')
  await alice.page.keyboard.press('Escape')
  const refused = await crafted(alice, ALICE_API, { item: 'rope', quantity: 1, held: 1 })
  check(refused.status === 409 && refused.json?.reason === 'unavailable', `a crafted removal: ${refused.status} ${refused.json?.reason}`)
  check(fetchStarts.length === 0, `with rolls and moves off, module 0.32.0 never fetches (${fetchStarts.length})`)
  const hellos = postsOf('bridge.hello').length
  await game.settings.set('sending-stone', 'campaigns', [campaign({ transfers: true })])
  await until(() => postsOf('bridge.hello').length > hellos && transfersEnabled(), 'moves on', 15_000)
  await until(async () => (await alice.page.getByRole('button', { name: /^Send to/ }).count()) > 0, 'the moves to show', 15_000)
  const menu = await menuOf(alice, rowOf(sheetTab, 'Rope'), 'Rope')
  const items = await itemsOf(menu)
  check(same(items, ['Send to…']), `moves on, the Rope's menu is "Send to…" alone (${JSON.stringify(items)})`)
  await alice.page.keyboard.press('Escape')
  check(removalsEnabled() === 'f', 'and the app still keeps removals off')
  await finish()
}

{
  const rope = targetOf(rowOf(sheetTab, 'Rope'))
  await rope.scrollIntoViewIfNeeded()
  const box = await rope.boundingBox()
  await rope.click({ button: 'right', position: { x: 30, y: box.height / 2 } })
  const menu = alice.page.getByRole('menu', { name: 'Rope' })
  await menu.waitFor()
  const items = await itemsOf(menu)
  const at = await menu.boundingBox()
  const pointer = { x: box.x + 30, y: (await rope.boundingBox()).y + box.height / 2 }
  const near = Math.min(Math.abs(at.y - pointer.y), Math.abs(at.y + at.height - pointer.y))
  check(same(items, ['Remove…']) && near < 60 && at.x <= pointer.x + 60 && at.x + at.width >= pointer.x - 60,
    `a right-click on the Rope's name opens its menu, "Rope", at the pointer, with "Remove…" alone (${JSON.stringify([items, pointer, at])})`)
  await shootBoth(alice, 'removals-menu')
  await alice.page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
}
// A held touch on the Longsword's name.
{
  const swordName = sheetTab.getByRole('button', { name: /^Longsword/, expanded: false }).first()
  // A finger touches what's on the screen: the row brought into view first.
  await swordName.evaluate(el => el.scrollIntoView({ block: 'center' }))
  const menu = await alice.itemMenu(swordName.locator('xpath=ancestor::li[1]'), 'touch', 'Longsword')
  await menu.waitFor({ timeout: 5_000 })
  await wait(300)
  check(await menu.isVisible() && same(await itemsOf(menu), ['Remove…']) && await swordName.getAttribute('aria-expanded') === 'false',
    'a 600 ms held touch on the Longsword\'s name opens its menu, "Longsword", "Remove…"; let go, the row is still closed')
  await alice.page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
}
// The favorites strip's Rope: no menu.
{
  const strip = alice.page.getByRole('region', { name: 'Favorites' })
  if (await strip.count()) {
    await strip.getByText('Rope', { exact: true }).first().click({ button: 'right' })
    await wait(500)
    check(await alice.page.getByRole('menu').count() === 0, 'a right-click on the Rope among his favorites opens no menu')
    await alice.page.keyboard.press('Escape')
  } else note('no favorites strip on Inventory at 390')
}
// The Company's panel: no menu, moves off.
{
  await alice.party('The Iron Company')
  const panel = alice.page.getByRole('dialog', { name: 'The Iron Company' })
  await panel.locator('summary', { hasText: /^Rope/ }).first().waitFor({ timeout: 15_000 })
  await panel.locator('summary', { hasText: /^Rope/ }).first().click({ button: 'right' })
  await wait(500)
  check(await alice.page.getByRole('menu').count() === 0, 'on the Company\'s panel, a right-click on its Rope opens no menu, moves off')
  await panel.getByRole('button', { name: 'Close' }).click()
  await alice.tab('Inventory')
}
// The keyboard, at 1280.
const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await desk.tab('Inventory')
{
  const scope = tabpanel(desk)
  const potion = scope.getByRole('button', { name: /^Potion of Healing/, expanded: false }).first()
  await potion.waitFor({ timeout: 15_000 })
  await potion.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await potion.focus()
  await desk.page.keyboard.press('Shift+F10')
  const menu = desk.page.getByRole('menu', { name: 'Potion of Healing' })
  await menu.waitFor()
  const bottom = (await potion.boundingBox()).y + (await potion.boundingBox()).height
  const look = await menu.evaluate((m, under) => ({ below: m.getBoundingClientRect().top >= under - 2, focused: document.activeElement?.textContent?.trim() }), bottom)
  check(look.below && look.focused === 'Remove…', `Shift+F10 on the focused Potion's name (its row rolls) opens its menu below it, "Remove…" focused (${JSON.stringify(look)})`)
  await desk.page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
  check(await potion.evaluate(el => document.activeElement === el), 'Escape closes it, focus back on the Potion\'s name')
  // The Pebble, a plain row with nothing to open: reached by Tab from what comes before it.
  const pebble = targetOf(rowOf(scope, 'Pebble'))
  await pebble.evaluate(el => el.scrollIntoView({ block: 'center' }))
  const before = await pebble.evaluate(el => {
    const tab = el.closest('[role="tabpanel"]')
    const all = [...tab.querySelectorAll('a[href], button:not([disabled]), summary, input, [tabindex="0"]')].filter(n => n.getClientRects().length > 0)
    const at = all.indexOf(el)
    if (at > 0) all[at - 1].focus()
    return at
  })
  await desk.page.keyboard.press('Tab')
  const ring = await pebble.evaluate(el => {
    const style = getComputedStyle(el)
    return { focused: document.activeElement === el, visible: el.matches(':focus-visible'), outline: style.outlineStyle, width: style.outlineWidth, shadow: style.boxShadow, tag: el.tagName, tabIndex: el.tabIndex }
  })
  check(before > 0 && ring.focused && ring.visible && ((ring.outline !== 'none' && parseFloat(ring.width) > 0) || ring.shadow !== 'none') && ring.tag === 'DIV' && ring.tabIndex === 0,
    `Tab reaches the Pebble's plain row, a div taking focus, its focus ring visible (${JSON.stringify(ring)})`)
  await shoot(desk, 'removals-plain-focus', rowOf(scope, 'Pebble'))
  await desk.page.keyboard.press('Shift+F10')
  const pebbleMenu = desk.page.getByRole('menu', { name: 'Pebble' })
  await pebbleMenu.waitFor()
  const under = (await pebble.boundingBox()).y + (await pebble.boundingBox()).height
  const at = await pebbleMenu.evaluate((m, u) => m.getBoundingClientRect().top >= u - 2, under)
  check(same(await itemsOf(pebbleMenu), ['Remove…']) && at, 'Shift+F10 on it opens "Pebble" below it, "Remove…" alone')
  await desk.page.keyboard.press('Escape')
  await pebbleMenu.waitFor({ state: 'hidden' })
  check(await pebble.evaluate(el => document.activeElement === el), 'Escape gives focus back to the Pebble\'s row')
}

// =================================================================================================
// 3. Remove the Rope
// =================================================================================================
part('3. the Rope')
const DANGER = { light: 'rgb(200, 30, 30)', dark: 'rgb(248, 113, 113)' }
{
  const rope = rowOf(sheetTab, 'Rope')
  let dialog = await removeFrom(alice, rope, 'Rope')
  const buttons = await dialog.getByRole('button').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label') ?? b.textContent.trim()))
  check(await dialog.getByRole('textbox', { name: 'How many' }).count() === 0 && await summary(dialog) === 'You remove 1 Rope.' && await dialog.getByText('Foundry’s chat will say so.').isVisible()
    && same(buttons, ['Close', 'Cancel', 'Remove']),
    `"Remove Rope?": no How many, "You remove 1 Rope.", "Foundry’s chat will say so.", buttons ${JSON.stringify(buttons)}`)
  for (const scheme of ['light', 'dark']) {
    await theme(alice, scheme)
    const look = await removeButton(dialog).evaluate(b => ({ background: getComputedStyle(b).backgroundColor, token: getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim() }))
    check(look.background === DANGER[scheme], `${scheme}: Remove's background is the theme's --color-danger, ${look.token} (${look.background})`)
    await shoot(alice, 'removals-dialog', dialog)
  }
  await theme(alice, 'light')
  const count = removals().length
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await dialog.waitFor({ state: 'hidden' })
  await wait(300)
  check(await targetOf(rope).evaluate(el => document.activeElement === el && el.tagName === 'SUMMARY') && removals().length === count && sentBy.get(alice).length === 0,
    'Cancel: the dialog closes, focus is back on the Rope\'s summary, and nothing is posted')
  await paced()
  const before = posted.length
  dialog = await removeFrom(alice, rope, 'Rope')
  await removeButton(dialog).click()
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
  const made = await answered(1, 'the Rope removed')
  const body = sentBy.get(alice).at(-1)
  check(sameJson(body, { kind: 'remove', remove: { item: 'rope', quantity: 1, held: 1 }, ...PLAIN }), `the POST's body: ${JSON.stringify(body)}`)
  const line = lastLine()
  check(made.status === 'done' && line?.text === 'Removes 1 Rope' && line.actor === 'thorin' && line.author === 'alice' && line.by === null && line.flags.request === made.id
    && !('typed' in line.flags) && same(line.whisper, []) && badgeOn(line.message) === BADGE && made.result?.messageId === line.id && !holding(thorin, 'Rope').length,
    `Foundry's chat: "${line?.text}", spoken by Thorin, by Alice, for everyone, badged "${badgeOn(line.message)}"; the Rope is gone in Foundry`)
  const result = postsOf('command.result').find(p => p.data.id === made.id)
  const resultAt = posted.indexOf(result)
  const sheetAt = posted.findIndex((p, i) => i >= before && i < resultAt && p.type === 'character.updated' && p.data.character.id === 'thorin'
    && !listed(p.data.character.sheet?.inventory).some(it => it.name === 'Rope'))
  check(sheetAt >= 0 && resultAt > sheetAt && sameJson(result.data.removed, { item: 'rope', quantity: 1 }), `posted: Thorin's sheet without the Rope (${sheetAt}), then the result (${resultAt}), removed ${JSON.stringify(result.data.removed)}`)
  check(await chatHas(alice, ALICE_API, 'Removes 1 Rope', 'Thorin') && await chatHas(bob, BOB_API, 'Removes 1 Rope', 'Thorin'), "the app's chat shows the line to Alice and to Bob, as Thorin's")
  await tray(alice).getByText('Removed 1 Rope').waitFor({ timeout: 15_000 })
  check(true, 'her tray: "Removed 1 Rope"')
  await until(async () => (await rowOf(sheetTab, 'Rope').count()) === 0, 'the Rope\'s row to go', 15_000)
  check(true, 'the Rope\'s row is gone from her Inventory')
}

// =================================================================================================
// 4. Part of a stack
// =================================================================================================
part('4. part of a stack')
{
  await paced()
  const potion = rowOf(sheetTab, 'Potion of Healing')
  const dialog = await removeFrom(alice, potion, 'Potion of Healing')
  const box = dialog.getByRole('textbox', { name: 'How many' })
  check(await box.inputValue() === '3' && await dialog.getByRole('button', { name: 'All 3' }).isVisible() && await summary(dialog) === 'You remove 3 Potion of Healing.',
    `"Remove Potion of Healing?": How many holds 3, all of them; "All 3"; "${await summary(dialog)}"`)
  await dialog.getByRole('button', { name: 'One fewer' }).click()
  check(await summary(dialog) === 'You remove 2 Potion of Healing.', `One fewer: "${await summary(dialog)}"`)
  await shootBoth(alice, 'removals-stack', dialog)
  await removeButton(dialog).click()
  const made = await answered(2, 'two potions removed')
  check(sameJson(sentBy.get(alice).at(-1)?.remove, { item: 'potion', quantity: 2, held: 3 }), `the POST's remove: ${JSON.stringify(sentBy.get(alice).at(-1)?.remove)}`)
  check(made.status === 'done' && lastLine()?.text === 'Removes 2 Potion of Healing' && thorin.items.get('potion')?.system.quantity === 1 && sameJson(made.result?.removed, { item: 'potion', quantity: 2 }),
    `"${lastLine()?.text}"; Thorin has 1 left in Foundry; the result's removed ${JSON.stringify(made.result?.removed)}`)
  await sheetHas(alice, ALICE_API, 'Potion of Healing', 1, 'the sheet with one potion')
  await until(async () => !(await rowOf(sheetTab, 'Potion of Healing').textContent()).includes('×'), 'the row without its count', 15_000)
  check(true, 'the row shows no quantity mark at 1')
}

// =================================================================================================
// 5. Nested alone
// =================================================================================================
part('5. nested')
{
  await paced()
  const backpack = rowOf(sheetTab, 'Backpack')
  if (!(await targetOf(backpack).evaluate(el => el.closest('details').open))) await targetOf(backpack).click()
  const inPack = sheetTab.getByRole('list', { name: 'In the Backpack' })
  await inPack.waitFor({ timeout: 10_000 })
  const pouch = rowOf(inPack, 'Pouch')
  if (!(await targetOf(pouch).evaluate(el => el.closest('details').open))) await targetOf(pouch).click()
  const inPouch = sheetTab.getByRole('list', { name: 'In the Pouch' })
  await inPouch.waitFor({ timeout: 10_000 })
  const gem = rowOf(inPouch, 'Gem')
  const menu = await menuOf(alice, gem, 'Gem')
  check(same(await itemsOf(menu), ['Remove…']), 'the Gem, in the Pouch in the Backpack: its own menu, "Remove…"')
  await menu.getByRole('menuitem', { name: 'Remove…' }).click()
  const dialog = alice.page.getByRole('dialog', { name: 'Remove Gem?' })
  await dialog.waitFor()
  await removeButton(dialog).click()
  const made = await answered(3, 'the Gem removed')
  check(made.status === 'done' && lastLine()?.text === 'Removes 1 Gem' && !thorin.items.get('gem') && thorin.items.get('pouch') && thorin.items.get('backpack'),
    `"${lastLine()?.text}"; the Gem alone is gone in Foundry`)
  await sheetHas(alice, ALICE_API, 'Gem', null, 'the sheet without the Gem')
  check(listed((await sheetOf(alice, ALICE_API))?.inventory).some(it => it.name === 'Pouch') && await rowOf(inPack, 'Pouch').count() === 1, 'and the Pouch is still listed')
}

// =================================================================================================
// 6. A container
// =================================================================================================
part('6. a container')
{
  await paced()
  const dialog = await removeFrom(alice, rowOf(sheetTab, 'Backpack'), 'Backpack')
  check(await dialog.getByText('Everything in it goes too.').isVisible() && await summary(dialog) === 'You remove 1 Backpack.', '"Remove Backpack?": "Everything in it goes too."')
  await shoot(alice, 'removals-container', dialog)
  const writesBefore = writes.length
  await removeButton(dialog).click()
  const made = await answered(4, 'the Backpack removed')
  const deletes = writes.slice(writesBefore).filter(([kind, id]) => kind === 'delete' && id === 'thorin').map(([, , ids]) => [...ids].sort())
  check(made.status === 'done' && lastLine()?.text === 'Removes 1 Backpack' && !lastLine().text.includes('Bedroll') && same(deletes, [['backpack', 'bedroll', 'pouch']])
    && ['backpack', 'bedroll', 'pouch'].every(id => !thorin.items.get(id)),
    `"${lastLine()?.text}", no Bedroll in it; one deletion of the Backpack and all in it (${JSON.stringify(deletes)})`)
  await sheetHas(alice, ALICE_API, 'Backpack', null, 'the sheet without the Backpack')
  const names = listed((await sheetOf(alice, ALICE_API))?.inventory).map(it => it.name)
  await until(async () => (await rowOf(sheetTab, 'Backpack').count()) === 0, 'the Backpack\'s row to go', 15_000).catch(() => {})
  check(!names.includes('Bedroll') && !names.includes('Pouch') && await rowOf(sheetTab, 'Backpack').count() === 0, `the Backpack, Bedroll and Pouch are gone from the sheet (${JSON.stringify(names)})`)
}

// =================================================================================================
// 7. Hidden contents
// =================================================================================================
part('7. hidden contents')
{
  // Crafted first, while the chest is there: what it hides isn't on the sheet.
  const letter = await crafted(alice, ALICE_API, { item: 'letter', quantity: 1, held: 1 })
  check(letter.status === 422 && letter.json?.reason === 'gone', `a crafted removal of the Letter in the Sealed Chest: ${letter.status} ${letter.json?.reason}`)
  await paced()
  const dialog = await removeFrom(alice, rowOf(sheetTab, 'Sealed Chest'), 'Sealed Chest')
  check(await dialog.getByText('Everything in it goes too.').isVisible(), '"Remove Sealed Chest?", whose contents aren\'t known: "Everything in it goes too."')
  await removeButton(dialog).click()
  const made = await answered(5, 'the Sealed Chest removed')
  check(made.status === 'done' && lastLine()?.text === 'Removes 1 Sealed Chest' && !thorin.items.get('chest') && !thorin.items.get('letter'),
    `"${lastLine()?.text}"; it and the Letter are gone in Foundry`)
  await sheetHas(alice, ALICE_API, 'Sealed Chest', null, 'the sheet without the chest')
  const views = await Promise.all([[alice, `${ALICE_API}/table`], [bob, `${BOB_API}/table`]].map(([who, path]) => call(who.page, path)))
  const sent = JSON.stringify(posted.map(p => p.data))
  const said = lines().map(l => l.text).join(' ')
  const bodies = JSON.stringify(sentBy.get(alice))
  check(!sent.includes('Letter') && !sent.includes('Strongbox') && views.every(v => v.status === 200 && !v.text.includes('Letter')) && !said.includes('Letter') && !bodies.includes('Letter')
    && !(await alice.page.content()).includes('Letter'),
    '"Letter" is in no page, post or line, nor the chest\'s true name')
}

// =================================================================================================
// 8. Unidentified
// =================================================================================================
part('8. unidentified')
{
  await paced()
  const dialog = await removeFrom(alice, rowOf(sheetTab, 'Strange Vial'), 'Strange Vial')
  check(await summary(dialog) === 'You remove 1 Strange Vial.', `"Remove Strange Vial?": "${await summary(dialog)}"`)
  await removeButton(dialog).click()
  const made = await answered(6, 'the Strange Vial removed')
  check(made.status === 'done' && lastLine()?.text === 'Removes 1 Strange Vial' && !thorin.items.get('vial'), `"${lastLine()?.text}"`)
  const views = await Promise.all([[alice, `${ALICE_API}/table`], [bob, `${BOB_API}/table`]].map(([who, path]) => call(who.page, path)))
  const sent = JSON.stringify(posted.map(p => p.data))
  check(!sent.includes('Giant') && views.every(v => v.status === 200 && !v.text.includes('Giant')) && !lines().some(l => l.text.includes('Giant'))
    && !JSON.stringify(sentBy.get(alice)).includes('Giant') && !JSON.stringify(removals().map(r => r.payload)).includes('Giant'),
    '"Giant" is in no page, POST body, kept request or line')
}

// =================================================================================================
// 9. Worn, from the tablet, its toast
// =================================================================================================
part('9. worn')
const tablet = await browse({ width: 768, height: 1024, scheme: 'dark', path: '/characters/sheet-thorin' })
await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await tablet.tab('Inventory')
{
  await paced()
  const dialog = await removeFrom(tablet, rowOf(tabpanel(tablet), 'Ring of Protection'), 'Ring of Protection')
  await removeButton(dialog).click()
  const made = await answered(7, 'the Ring removed')
  check(made.status === 'done' && lastLine()?.text === 'Removes 1 Ring of Protection' && !thorin.items.get('ring'), `equipped and attuned, it's removed all the same: "${lastLine()?.text}"`)
  await toastLog(tablet).getByText('Removed 1 Ring of Protection').waitFor({ timeout: 15_000 })
  check(true, 'the tablet\'s toast: "Removed 1 Ring of Protection"')
  await shoot(tablet, 'removals-toast')
}

// =================================================================================================
// 10. An empty stack
// =================================================================================================
part('10. an empty stack')
{
  await paced()
  const dialog = await removeFrom(alice, rowOf(sheetTab, 'Arrows'), 'Arrows')
  check(await dialog.getByRole('textbox', { name: 'How many' }).count() === 0 && await summary(dialog) === 'You remove 0 Arrows.', `"Remove Arrows?", no How many: "${await summary(dialog)}"`)
  await removeButton(dialog).click()
  const made = await answered(8, 'the Arrows removed')
  check(made.status === 'done' && lastLine()?.text === 'Removes 0 Arrows' && !thorin.items.get('arrows') && sameJson(sentBy.get(alice).at(-1)?.remove, { item: 'arrows', quantity: 0, held: 0 }),
    `"${lastLine()?.text}", sent as none of none`)
}

if (DND5E6) {
  note('DND5E6=1: steps 1-10 under dnd5e 6.0.5\'s stand-ins')
  check(lines().every(l => same(l.whisper, [])), 'every line of a removal is public')
  await finish()
}

// =================================================================================================
// 11. Refused by the module
// =================================================================================================
part('11. refused by the module')
const answeredWith = async (who, from, status) => {
  await until(() => answersTo.get(who).length > from, 'the app to answer the POST', 10_000)
  return answersTo.get(who)[from] === status
}
{
  // The Potion a stack of 3 again, then 1 in Foundry alone: the app's sheet still says 3.
  await thorin.items.get('potion').update({ 'system.quantity': 3 })
  await sheetHas(alice, ALICE_API, 'Potion of Healing', 3, 'the sheet with three potions')
  await rowShows(sheetTab, 'Potion of Healing', '×3', 'her row with three potions')
  quantityInFoundry(thorin, 'potion', 1)
  await paced()
  const linesAt = lines().length
  const writesAt = writes.length
  const from = answersTo.get(alice).length
  const dialog = await removeFrom(alice, rowOf(sheetTab, 'Potion of Healing'), 'Potion of Healing')
  check(await dialog.getByRole('textbox', { name: 'How many' }).inputValue() === '3', 'the app still shows 3: How many 3')
  await removeButton(dialog).click()
  const taken = await answeredWith(alice, from, 202)
  const made = await answered(9, 'the removal of three of one')
  await tray(alice).getByText('Not removed: you haven’t that many').waitFor({ timeout: 15_000 })
  check(taken && made.status === 'failed' && made.result?.reason === 'short' && thorin.items.get('potion').system.quantity === 1 && lines().length === linesAt
    && writes.slice(writesAt).filter(([, id, p]) => id === 'potion' || (Array.isArray(p) && p.includes('potion'))).length === 0,
    'all 3 of what Foundry alone has as 1: taken (202), then "Not removed: you haven’t that many"; nothing written, no line')
}
{
  quantityInFoundry(thorin, 'torch', 2)
  await paced()
  const linesAt = lines().length
  const writesAt = writes.length
  const from = answersTo.get(alice).length
  const dialog = await removeFrom(alice, rowOf(sheetTab, 'Torch'), 'Torch')
  await dialog.getByRole('button', { name: 'One fewer' }).click()
  check(await summary(dialog) === 'You remove 2 Torch.', `the Torches, 3 as the app shows them, 2 in Foundry alone: "${await summary(dialog)}"`)
  await removeButton(dialog).click()
  const taken = await answeredWith(alice, from, 202)
  const made = await answered(10, 'the removal of two of three, now two')
  await tray(alice).getByText('Not removed: how many there are has changed. Try again').waitFor({ timeout: 15_000 })
  const touched = writes.slice(writesAt).filter(([kind, id, p]) => (kind === 'updateItem' && id === 'torch') || (kind === 'delete' && p.includes('torch')))
  check(taken && made.status === 'failed' && made.result?.reason === 'changed' && thorin.items.get('torch')?.system.quantity === 2 && touched.length === 0 && lines().length === linesAt,
    'taken (202), then "Not removed: how many there are has changed. Try again"; the Torches still 2 in Foundry, no updateItem or deleteItem of them, no line')
  await shootBoth(alice, 'removals-refused-tray', tray(alice))
}

// =================================================================================================
// 12. Refused by the app
// =================================================================================================
part('12. refused by the app')
{
  const linesAt = lines().length
  const rowsAt = removals().length
  const results = [
    await crafted(alice, ALICE_API, { item: 'nowhere', quantity: 1, held: 1 }),
    await crafted(alice, ALICE_API, { item: 'torch', quantity: 4, held: 4 }),
    await crafted(alice, ALICE_API, { item: 'torch', quantity: 2, held: 2 }),
    await crafted(alice, ALICE_API, { item: 'torch', quantity: 0, held: 3 }),
    await crafted(alice, ALICE_API, { item: 'torch', quantity: 1 }),
    await call(alice.page, `${ALICE_API}/rolls`, { method: 'POST', body: { kind: 'skill', key: 'prc', remove: { item: 'torch', quantity: 1, held: 3 }, ...PLAIN } }),
  ].map(r => [r.status, r.json?.reason ?? null])
  await wait(1000)
  check(same(results, [[422, 'gone'], [422, 'short'], [422, 'changed'], [400, null], [400, null], [400, null]]) && lines().length === linesAt && removals().length === rowsAt,
    `an id not on Thorin gone, 4 of 3 short, 2 with held 2 of 3 changed, none of 3, no held, and a skill naming a removal 400; Foundry posts nothing (${JSON.stringify(results)})`)
  // In step with Foundry again, then sent typed: made, with no "Entered by hand" badge.
  await thorin.items.get('torch').update({ 'system.quantity': 2 })
  await sheetHas(alice, ALICE_API, 'Torch', 2, 'the sheet with two torches')
  await paced()
  const typed = await crafted(alice, ALICE_API, { item: 'torch', quantity: 2, held: 2 }, { typed: true })
  const made = await answered(rowsAt + 1, 'the typed removal')
  const line = lastLine()
  check(typed.status === 202 && made.status === 'done' && !('typed' in (made.payload ?? {})) && line?.text === 'Removes 2 Torch' && !('typed' in line.flags) && badgeOn(line.message) === BADGE,
    `one sent with typed: true is taken (${typed.status}), kept without it, and made: "${line?.text}", badged "${badgeOn(line.message)}", not "Entered by hand"`)
}

// =================================================================================================
// 13. On its way
// =================================================================================================
part('13. on its way')
const gmThorin = await browse({ width: 768, height: 1024, path: `/campaigns/${A}/characters/thorin`, toasts: false })
await gmThorin.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await gmThorin.tab('Inventory')
watchPosts(gmThorin)
{
  await thorin.items.get('potion').update({ 'system.quantity': 3 })
  await sheetHas(alice, ALICE_API, 'Potion of Healing', 3, 'the sheet with three potions again')
  await rowShows(sheetTab, 'Potion of Healing', '×3', 'her row with three potions again')
  await paced()
  const hold = holdWrite((kind, target) => kind === 'delete' && target.id === 'thorin')
  const count = removals().length
  const dialog = await removeFrom(alice, rowOf(sheetTab, 'Potion of Healing'), 'Potion of Healing')
  await removeButton(dialog).click()
  await Promise.race([hold.held, wait(20_000)])
  const menu = await menuOf(alice, rowOf(sheetTab, 'Potion of Healing'), 'Potion of Healing')
  const look = await menu.evaluate(m => {
    const item = [...m.querySelectorAll('[role="menuitem"]')].find(i => i.textContent.includes('Remove…'))
    const said = ids => (ids ?? '').split(' ').filter(Boolean).map(id => document.getElementById(id)?.textContent.trim()).join(' ')
    // Each item's name: its words, without the reason said under a disabled one.
    const named = i => i.textContent.replace(said(i.getAttribute('aria-describedby')), '').trim()
    return {
      items: [...m.querySelectorAll('[role="menuitem"]')].map(named),
      disabled: item?.getAttribute('aria-disabled') === 'true' || item?.disabled === true,
      reason: said(item?.getAttribute('aria-describedby')), menu: said(m.getAttribute('aria-describedby')), inside: m.contains(document.activeElement),
    }
  })
  check(same(look.items, ['Remove…']) && look.disabled && look.reason === 'It’s on its way already' && look.menu === 'It’s on its way already' && look.inside,
    `while its removal is on its way: "Remove…" disabled, described "It’s on its way already"; the menu, whose only item it is, described so, focus inside it (${JSON.stringify(look)})`)
  await shootBoth(alice, 'removals-waiting', menu)
  await alice.page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
  check(await targetOf(rowOf(sheetTab, 'Potion of Healing')).evaluate(el => document.activeElement === el), 'Escape gives focus back to the row')
  const second = await crafted(alice, ALICE_API, { item: 'potion', quantity: 3, held: 3 })
  hold.release()
  const made = await answered(count + 1, 'the held removal')
  await wait(1000)
  check(second.status === 409 && second.json?.reason === 'moving' && made.status === 'done' && removals().length === count + 1 && !thorin.items.get('potion')
    && lines().filter(l => l.text === 'Removes 3 Potion of Healing').length === 1,
    `a crafted second removal meanwhile: ${second.status} ${second.json?.reason}; released, the first is made once`)
}
{
  // Moves on, in Manage Campaigns.
  const { openSettings, save, tick, view } = windowApp
  const hellos = postsOf('bridge.hello').length
  const win = await openSettings()
  await view(win, 'campaign', { campaignId: 'camp-iron', tab: 'actions' })
  tick(win, 'campaign.transfers', true)
  await save(win)
  await until(() => postsOf('bridge.hello').length > hellos && transfersEnabled(), 'moves on', 15_000)
  await until(async () => (await sheetTab.getByRole('button', { name: /^Send to/ }).count()) > 0, 'her Currency row\'s Send to', 15_000)
  check(true, 'ticked in Manage Campaigns, moves are on')
  await thorin.createEmbeddedDocuments('Item', [potionData('potion3', 3)], { keepId: true })
  await sheetHas(alice, ALICE_API, 'Potion of Healing', 3, 'a fresh stack of three potions')
  await rowShows(sheetTab, 'Potion of Healing', '×3', 'her row with the fresh stack')
  await rowShows(tabpanel(gmThorin), 'Potion of Healing', '×3', "the Gamemaster's row with the fresh stack")
  await paced()
}
// A give of all of them to Vex, held at its first write.
const giveHold = holdWrite((kind, target) => [target.id, target.actor?.id].some(id => ['thorin', 'vex'].includes(id)))
{
  let menu = await menuOf(alice, rowOf(sheetTab, 'Potion of Healing'), 'Potion of Healing')
  await menu.getByRole('menuitem', { name: 'Send to…' }).click()
  const dialog = alice.page.getByRole('dialog', { name: 'Give Potion of Healing' })
  await dialog.waitFor()
  await dialog.getByRole('radio', { name: /^Vex/ }).locator('xpath=ancestor::label[1]').click()
  await dialog.getByRole('button', { name: 'All 3' }).click()
  await dialog.getByRole('button', { name: /^Give/ }).last().click()
  await Promise.race([giveHold.held, wait(20_000)])
  menu = await menuOf(alice, rowOf(sheetTab, 'Potion of Healing'), 'Potion of Healing')
  const look = await menu.evaluate(m => {
    const items = [...m.querySelectorAll('[role="menuitem"]')]
    const remove = items.find(i => i.textContent.includes('Remove…'))
    const said = ids => (ids ?? '').split(' ').filter(Boolean).map(id => document.getElementById(id)?.textContent.trim()).join(' ')
    const named = i => i.textContent.replace(said(i.getAttribute('aria-describedby')), '').trim()
    return { items: items.map(named), disabled: remove?.getAttribute('aria-disabled') === 'true' || remove?.disabled === true, reason: said(remove?.getAttribute('aria-describedby')) }
  })
  check(same(look.items, ['Send to…', 'Remove…']) && look.disabled && look.reason === 'It’s on its way already',
    `moves on, with its give to Vex on its way: the menu ${JSON.stringify(look.items)}, "Remove…" disabled, "${look.reason}"`)
  await alice.page.keyboard.press('Escape')
  const refused = await crafted(alice, ALICE_API, { item: 'potion3', quantity: 3, held: 3 })
  check(refused.status === 409 && refused.json?.reason === 'moving', `a crafted removal of them meanwhile: ${refused.status} ${refused.json?.reason}`)
}

// =================================================================================================
// 14. Another seat's race
// =================================================================================================
part('14. another seat')
{
  const linesAt = lines().length
  const count = removals().length
  const from = answersTo.get(gmThorin).length
  const dialog = await removeFrom(gmThorin, rowOf(tabpanel(gmThorin), 'Potion of Healing'), 'Potion of Healing')
  check(await dialog.getByRole('textbox', { name: 'How many' }).inputValue() === '3', 'the Gamemaster at Thorin\'s page: How many 3')
  await removeButton(dialog).click()
  const taken = await answeredWith(gmThorin, from, 202)
  await until(() => removals().length === count + 1 && removals()[count].status !== 'pending', "the module to take the Gamemaster's removal", 20_000)
  giveHold.release()
  const give = await answered(moves().length, 'the give to Vex', moves)
  const theirs = await answered(count + 1, "the Gamemaster's removal")
  await tray(gmThorin).getByText('Not removed: it isn’t there any more').waitFor({ timeout: 15_000 })
  check(taken && give.status === 'done' && theirs.status === 'failed' && theirs.result?.reason === 'gone' && theirs.role === 'gm'
    && holding(vex, 'Potion of Healing').reduce((n, p) => n + p.system.quantity, 0) === 3 && holding(thorin, 'Potion of Healing').length === 0 && lines().length === linesAt,
    `another seat's removal is taken (202, no "moving"); released, the give is made and the Gamemaster's says "Not removed: it isn’t there any more"; the Potions on Vex alone, no line`)
}

// =================================================================================================
// 15. The Gamemaster
// =================================================================================================
part('15. the Gamemaster')
{
  await paced()
  const sword = gmThorin.page.getByRole('tabpanel').getByRole('button', { name: /^Longsword/, expanded: false }).first()
  const menu = await menuOf(gmThorin, sword.locator('xpath=ancestor::li[1]'), 'Longsword')
  check((await itemsOf(menu)).includes('Remove…'), `at Thorin's page, the Gamemaster's Longsword menu has "Remove…" (${JSON.stringify(await itemsOf(menu))})`)
  await menu.getByRole('menuitem', { name: 'Remove…' }).click()
  const dialog = gmThorin.page.getByRole('dialog', { name: 'Remove Longsword?' })
  await dialog.waitFor()
  check(await summary(dialog) === 'Thorin removes 1 Longsword.', `"${await summary(dialog)}"`)
  await shootBoth(gmThorin, 'removals-gm-dialog', dialog)
  const count = removals().length
  await removeButton(dialog).click()
  const made = await answered(count + 1, "the Gamemaster's Longsword")
  const line = lastLine()
  const result = postsOf('command.result').find(p => p.data.id === made.id)?.data
  check(made.status === 'done' && made.role === 'gm' && made.label === 'Remove 1 Longsword' && line?.text === 'Removes 1 Longsword' && line.actor === 'thorin' && line.author === 'alice'
    && line.by === 'gm' && badgeOn(line.message) === BADGE_GM && same(result?.messages, [line.id]) && same(line.whisper, []) && !thorin.items.get('longsword'),
    `"${line?.text}", Thorin's, flagged the Gamemaster's, badged "${badgeOn(line.message)}", listed in the result's messages; its label "${made.label}"`)
  await tray(gmThorin).getByText('Thorin removed 1 Longsword').waitFor({ timeout: 15_000 })
  check(true, 'the Gamemaster\'s tray: "Thorin removed 1 Longsword"')
  await shootBoth(gmThorin, 'removals-gm-tray', tray(gmThorin))
  await tray(alice).getByText('Remove 1 Longsword').waitFor({ timeout: 15_000 })
  await tray(alice).getByText('Removed at the table').waitFor({ timeout: 15_000 })
  check(true, 'Alice\'s page lists it among the Gamemaster\'s: "Remove 1 Longsword", "Removed at the table"')
}

// =================================================================================================
// 16. Not on a party sheet
// =================================================================================================
part('16. the party')
{
  await alice.party('The Iron Company')
  const panel = alice.page.getByRole('dialog', { name: 'The Iron Company' })
  await panel.getByRole('button', { name: 'Take Rope' }).waitFor({ timeout: 15_000 })
  const menu = await menuOf(alice, panel.locator('summary', { hasText: /^Rope/ }).first().locator('xpath=ancestor::li[1]'), 'Rope')
  check(same(await itemsOf(menu), ['Send to…']), `moves on, the Company's Rope menu is "Send to…" alone (${JSON.stringify(await itemsOf(menu))})`)
  await alice.page.keyboard.press('Escape')
  await panel.getByRole('button', { name: 'Close' }).click()
  await alice.tab('Inventory')
}

// =================================================================================================
// 17. Every width, both themes
// =================================================================================================
part('17. widths')
const PICK = 'Pick <b>Axe</b>'
for (const width of [360, 390, 768, 1280]) {
  await alice.page.setViewportSize({ width, height: width < 1024 ? 844 : 800 })
  alice.width = width
  for (const scheme of ['light', 'dark']) {
    await theme(alice, scheme)
    await alice.tab('Inventory')
    const menu = await menuOf(alice, rowOf(sheetTab, PICK), PICK)
    const onTop = await menu.getByRole('menuitem', { name: 'Remove…' }).evaluate(item => {
      const box = item.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return !!hit && item.contains(hit)
    })
    await menu.getByRole('menuitem', { name: 'Remove…' }).click()
    const dialog = alice.page.getByRole('dialog', { name: `Remove ${PICK}?`, exact: true })
    await dialog.waitFor()
    await wait(200)
    const look = await dialog.evaluate(d => {
      const inView = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.right <= document.documentElement.clientWidth && b.top >= 0 && b.bottom <= innerHeight }
      const button = name => [...d.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent.trim()) === name)
      const title = d.querySelector('h2')
      const header = d.querySelector('header')
      const t = title.getBoundingClientRect()
      const h = header.getBoundingClientRect()
      const close = button('Close').getBoundingClientRect()
      return {
        fits: inView(d), cancel: inView(button('Cancel')), remove: inView(button('Remove')), close: inView(button('Close')),
        title: title.textContent, bold: title.querySelector('b') !== null, inHeader: t.left >= h.left && t.right <= close.left + 0.5 && t.bottom <= h.bottom,
        lines: Math.round(t.height / parseFloat(getComputedStyle(title).lineHeight)), howMany: !!d.querySelector('input'),
      }
    })
    const wide = await sideways(alice.page)
    const narrow = width === 360
    check(onTop && look.fits && look.cancel && look.remove && look.howMany && wide === 0 && (!narrow || (look.title === `Remove ${PICK}?` && !look.bold && look.inHeader && look.close)),
      `at ${width} px, ${scheme}: the menu on top; the dialog with How many within the screen, Cancel and Remove in view, nothing sideways${narrow ? `; its title "${look.title}" as text, within the header on ${look.lines} line(s), Close in view` : ''} (${JSON.stringify(look)})`)
    if (width === 390 || width === 768) await shoot(alice, 'removals-dialog-stack', dialog)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.waitFor({ state: 'hidden' })
    if (narrow) {
      // A title that can't fit one line: it wraps inside the header, Close beside it, in view.
      const LANTERN = 'Lantern of the Deep Roads, Ever-Burning and Hooded'
      const long = await removeFrom(alice, rowOf(sheetTab, LANTERN), LANTERN)
      await wait(200)
      const wrap = await long.evaluate(d => {
        const title = d.querySelector('h2')
        const header = d.querySelector('header').getBoundingClientRect()
        const t = title.getBoundingClientRect()
        const close = [...d.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close').getBoundingClientRect()
        return {
          lines: Math.round(t.height / parseFloat(getComputedStyle(title).lineHeight)), inHeader: t.left >= header.left && t.right <= close.left + 0.5 && t.bottom <= header.bottom,
          close: close.left >= 0 && close.right <= document.documentElement.clientWidth && close.top >= 0 && close.width > 0,
        }
      })
      check(wrap.lines >= 2 && wrap.inHeader && wrap.close && await sideways(alice.page) === 0,
        `at 360 px, ${scheme}: "Remove ${LANTERN}?" wraps inside the header on ${wrap.lines} lines, Close beside it in view, nothing sideways`)
      if (scheme === 'light') await shoot(alice, 'removals-dialog-long', long)
      await long.getByRole('button', { name: 'Cancel' }).click()
      await long.waitFor({ state: 'hidden' })
    }
    if (width === 390 || width === 768) {
      // One item, and a container, on a phone and a tablet.
      let shown = await removeFrom(alice, rowOf(sheetTab, 'Pebble'), 'Pebble')
      await shoot(alice, 'removals-dialog-one', shown)
      await shown.getByRole('button', { name: 'Cancel' }).click()
      await shown.waitFor({ state: 'hidden' })
      shown = await removeFrom(alice, rowOf(sheetTab, 'Sack'), 'Sack')
      check(await shown.getByText('Everything in it goes too.').isVisible() && await sideways(alice.page) === 0, `at ${width} px, ${scheme}: "Remove Sack?" says everything in it goes too, nothing sideways`)
      await shoot(alice, 'removals-dialog-container', shown)
      await shown.getByRole('button', { name: 'Cancel' }).click()
      await shown.waitFor({ state: 'hidden' })
    }
  }
}
await alice.page.setViewportSize({ width: 390, height: 844 })
alice.width = 390
await theme(alice, 'light')

check(lines().every(l => same(l.whisper, [])), 'every line of a removal is public')
note(`lines: ${JSON.stringify(lines().map(l => l.text))}`)
await finish()
