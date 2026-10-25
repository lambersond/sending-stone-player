// The give/take feedback (module 0.32.0 and the app, its contract §11 and §14.4, decisions 6-10), end
// to end, in the world of world-030.mjs, its actors' items Foundry's embedded documents. Alice plays
// Thorin, Bob Vex; Bram and Lia are the campaign's characters too, Carol's and Dana's, who have no
// seat in the app. The Iron Company, the primary party, Alice's user owns and Bob's observes: its
// members Thorin, Vex, Bram, Lia and Grumble, the Gamemaster's hireling; 4 pp, 103 gp, 8 sp and 3 cp,
// 2 Rope, 3 Potions of Healing and a Backpack with a Bedroll in it. The Wardens of the Vale both
// players own; The Silent Order neither. Moves on, rolls off. The character's Currency row's "Send
// to" on the CURRENCY label's row, pushed right, opening 0.31.0's Give coins; half a space between a
// coin's amount and its abbreviation; "Send to…" in an item's own menu by a right-click, a held touch
// and Shift+F10, never among the favorites, a press on Take left to Take. The party's Currency row:
// Take, Send to, Give and Distribute. Distribute shares gold among the four, 3 gp left with the
// party and saying so in Foundry's chat, and silver with none left; refused when the members change
// under it, as the app or only the module knows. The party's coins and a Rope sent to Vex and to the
// Wardens, a potion stacking there; Thorin's gold given to the party; a potion sent to Thorin a take.
// Bob, an Observer, has none of it, and is refused; the Wardens' Owner sends from them. Crafted
// refusals. The Gamemaster sends to The Silent Order and distributes platinum from Vex's page; the
// party page keeps Take. A race between Alice's phone and tablet, refused by the app, by the module,
// and while a move is on its way. Every width in both themes. Since module 0.33.0: "Remove…" after
// "Send to…" in the character's item menu (not under module 0.31.0), and on the party's sheet one
// spinner by "Currency" or by the item's name while it's on its way, its buttons disabled with none of
// their own, the row or group busy; the character's own Send to keeps its spinner. DND5E6=1: dnd5e
// 6.0.5's fractional gold. SKEW=031 with MODULE=module-0.31.0: gives only. Synthetic characters only. Run with --import
// ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BASE, BOB, DND5E6, SHOTS_033, SKEW031, W, actors, browse, call, changeMembers, character, check, coinsInFoundry, embedded, finish, foundryWorld,
  group, holdWrite, launch, newCampaign, note, npc, part, posted, postsOf, same, settled, shoot, shootBoth, sideways, sql, startModule,
  theme, until, wait, writes,
} from './world-030.mjs'

const GAME = 'https://iron-ford.forge-vtt.com'
const SECRET = 'iron-ford-givetake-32'
const TITLE = 'Iron Ford'
const NEW = !SKEW031
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'iron-ford.forge-vtt.com', secret: SECRET })
await foundryWorld({ more: true })
game.modules.get('sending-stone').version = SKEW031 ? '0.31.0' : '0.32.0'

// ---- The world ----
const POTION = 'Compendium.dnd5e.items.Item.phb-potion'
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${type}` })
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, wis: 1 }, hp: { value: 30, max: 38, temp: 0 } }, {
  ac: 16,
  items: [{
    id: 'longsword', name: 'Longsword', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true, weight: { value: 3, units: 'lb' } },
    activities: [{ id: 'slash', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+5', damage: [hits('1d8 + 3', 'slashing')] } }],
  }],
})
thorin.system.details = { level: 5 }
// His Rope, a favorite.
thorin.system.favorites = [{ type: 'item', id: '.Item.rope', sort: 100000 }]
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
const bram = character({ id: 'bram', name: 'Bram', owners: ['carol'], mods: { str: 2 }, hp: { value: 20, max: 20, temp: 0 } }, { ac: 13, items: [] })
const lia = character({ id: 'lia', name: 'Lia', owners: ['dana'], mods: { dex: 2 }, hp: { value: 18, max: 18, temp: 0 } }, { ac: 13, items: [] })
for (const actor of [vex, bram, lia]) actor.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
game.users.get('carol').character = bram
game.users.get('dana').character = lia
embedded(thorin, { items: [{ _id: 'rope', name: 'Rope', type: 'loot', system: { quantity: 2, identified: true, weight: { value: 10, units: 'lb' } } }], currency: { gp: 40 } })
embedded(vex, { currency: { gp: 12 } })
embedded(bram, {})
embedded(lia, {})
const grumble = npc('grumble', 'Grumble', 11)
const company = group('company', 'The Iron Company', {
  members: [thorin, vex, bram, lia, grumble], ownership: { alice: 3, bob: 2 },
  currency: { pp: 4, gp: DND5E6 ? 103.5 : 103, sp: 8, cp: 3 },
})
embedded(company, {
  items: [
    { _id: 'rope', name: 'Rope', type: 'loot', system: { quantity: 2, identified: true, weight: { value: 10, units: 'lb' } } },
    { _id: 'potion', name: 'Potion of Healing', type: 'consumable', _stats: { compendiumSource: POTION }, system: { quantity: 3, identified: true, weight: { value: 0.5, units: 'lb' } } },
    { _id: 'backpack', name: 'Backpack', type: 'container', system: { quantity: 1, identified: true, capacity: { count: 10 }, weight: { value: 5, units: 'lb' } } },
    { _id: 'bedroll', name: 'Bedroll', type: 'loot', system: { quantity: 1, identified: true, container: 'backpack', weight: { value: 7, units: 'lb' } } },
  ],
})
const wardens = group('wardens', 'Wardens of the Vale', { members: [vex], ownership: { alice: 3, bob: 3 }, currency: { gp: 10 } })
embedded(wardens, { items: [{ _id: 'wpotion', name: 'Potion of Healing', type: 'consumable', _stats: { compendiumSource: POTION }, system: { quantity: 1, identified: true, weight: { value: 0.5, units: 'lb' } } }] })
const order = group('order', 'The Silent Order', { members: [bram], ownership: {} })
embedded(order, {})
Object.defineProperty(actors, 'party', { get: () => actors.get('company') ?? null, configurable: true })
const campaign = { id: 'camp-ford', title: TITLE, characters: ['thorin', 'vex', 'bram', 'lia'], groups: ['company', 'wardens', 'order'], rolls: false, transfers: true }
await startModule({ campaigns: [campaign], secrets: { 'camp-ford': SECRET } })
await settled()

// ---- What's kept and posted ----
const hello = () => postsOf('bridge.hello').at(-1)
const features = () => sql(`select array_to_string("transferFeatures", ',') from campaign where id = '${A}'`)
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }
const crafted = (who, api, transfer) => call(who.page, `${api}/rolls`, { method: 'POST', body: { kind: 'transfer', transfer, ...PLAIN } })
const moves = () => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, role, "actorId", label, status, payload, result, "createdAt" from roll_request where "campaignId" = '${A}' and kind = 'transfer') r`))
/** The lines Foundry's chat has of moves: their text, speaker, author and the module's flags. */
const lines = () => [...W.messages.values()].filter(m => /^<p>(Takes|Gives|Sends|Distributes) /.test(m.content ?? ''))
  .map(m => ({ text: m.content.slice(3, -4), actor: m.speaker?.actor, author: m.author?.id ?? m.author, by: m.flags?.['sending-stone']?.by ?? null }))
const lastLine = () => lines().at(-1)
/** Once a move is answered, as the app keeps it. */
const consumed = new Set()
/** The `count`th move, once the module has answered it and posted its result. */
async function answered(count, what) {
  await until(() => moves().length >= count && ['done', 'failed'].includes(moves()[count - 1].status), what, 30_000)
  const made = moves()[count - 1]
  consumed.add(made.id)
  await until(() => postsOf('command.result').some(p => p.data?.id === made.id), `${what}: its result as posted`, 10_000)
  return made
}
/**
 * The first move not yet looked at, once answered: the one a tap just asked for, though its POST
 * may land a moment after the tap.
 */
async function answeredNext(what) {
  const fresh = () => moves().find(m => !consumed.has(m.id))
  await until(() => ['done', 'failed'].includes(fresh()?.status), what, 30_000)
  return answered(moves().findIndex(m => m.id === fresh().id) + 1, what)
}
const gp = actor => actor._source.system.currency.gp
const held = (actor, key) => actor._source.system.currency[key]
const holding = (actor, name) => [...actor.items].filter(it => it.name === name)

if (NEW) {
  check(same(hello().data.features.transfers, { enabled: true, kinds: ['transfer'], reason: null, partySends: true, distribute: true }),
    `the hello says moves are made, a party's things may be sent by its Owner and its coin distributed (${JSON.stringify(hello().data.features.transfers)})`)
  await until(() => features() === 'partySends,distribute', 'the app to keep both', 15_000)
  check(features() === 'partySends,distribute', `and the app keeps both (${features()})`)
} else {
  check(same(hello().data.features.transfers, { enabled: true, kinds: ['transfer'], reason: null }), `module 0.31.0's hello says moves are made, nothing more (${JSON.stringify(hello().data.features.transfers)})`)
  await wait(1000)
  check(features() === '', `and the app keeps no party sends nor distribution (${JSON.stringify(features())})`)
}

// ---- Alice plays Thorin; Bob, Vex ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const alice = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const bob = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB, toasts: false })
await bob.page.goto(invite)
await pick(bob.page, /^Vex/)
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const vexSheet = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)
const ALICE_API = '/api/characters/sheet-thorin'
const BOB_API = `/api/characters/${vexSheet}`

const tabpanel = who => who.page.getByRole('tabpanel').first()
const panelOf = (who, name) => who.page.getByRole('dialog', { name })
/** Chooses a radio, as a tap does, on its label: the input itself is hidden from sight. */
async function pick(scope, name) {
  const radio = scope.getByRole('radio', { name })
  await radio.locator('xpath=ancestor::label[1]').click()
  if (!(await radio.isChecked())) throw new Error(`the radio ${name} isn't chosen after a tap on its label`)
}
const radiosOf = (dialog, group) => (group ? dialog.getByRole('group', { name: group }) : dialog).getByRole('radio').evaluateAll(rs => rs.map(r => r.closest('label').textContent.trim()))
const summary = d => d.locator('p[aria-live="polite"]').first().textContent()
/** A row of an item, by its name: its summary's li, or an action's. */
// The favorites strip (a section headed by its own toggle) and column (an aside) are left out:
// nothing moves there. The row is the li nearest its name.
const FAVORITES = 'section:has(> h2 > button[aria-expanded]), aside'
const itemRow = (scope, name) => scope.locator(`:is(summary, button[aria-expanded]):not(:is(${FAVORITES}) *)`)
  .filter({ hasText: new RegExp(`^${name}`) }).first().locator('xpath=ancestor::li[1]')
/** The Currency row's buttons by their accessible names, in order. */
const currencyButtons = scope => scope.getByRole('group', { name: 'Currency', exact: true }).getByRole('button')
  .evaluateAll(bs => bs.map(b => b.getAttribute('aria-label') ?? b.textContent.trim()))
/**
 * A Currency row as drawn (module 0.33.0's feedback): its group's aria-busy and name, each button's
 * disabled and spinners, the spinners in its label, and whether the label's one sits right of its text.
 */
const currencyLook = group => group.evaluate(g => {
  const dt = document.getElementById(g.getAttribute('aria-labelledby'))
  const text = dt.querySelector('span') ?? dt
  const spinners = [...dt.querySelectorAll('svg.motion-safe\\:animate-spin')]
  return {
    busy: g.getAttribute('aria-busy'), name: dt.textContent.trim(),
    buttons: [...g.querySelectorAll('button')].map(b => ({ name: b.getAttribute('aria-label') ?? b.textContent.trim(), disabled: b.disabled, svgs: b.querySelectorAll('svg').length })),
    termSpinners: spinners.length, right: spinners.length === 1 && spinners[0].getBoundingClientRect().left >= text.getBoundingClientRect().right - 0.5,
  }
})
/** An item's row as drawn, from its Take: the li's aria-busy, Take's state, its spinners, and the name's. */
const rowLook = take => take.evaluate(button => {
  const li = button.closest('li')
  const name = li.querySelector('summary span.truncate, div span.truncate')
  const spinners = [...li.querySelectorAll('svg.motion-safe\\:animate-spin')]
  return {
    busy: li.getAttribute('aria-busy'), disabled: button.disabled, svgs: button.querySelectorAll('svg').length, name: name?.textContent.trim(),
    rowSpinners: spinners.length, right: spinners.length === 1 && !!name && spinners[0].getBoundingClientRect().left >= name.getBoundingClientRect().right - 0.5,
  }
})
async function openParty(who, name = 'The Iron Company') {
  await who.party(name)
  const panel = panelOf(who, name)
  await panel.getByRole('tab', { name: 'Inventory' }).waitFor({ timeout: 15_000 })
  return panel
}
const statusIn = scope => scope.getByRole('status').first()

// =================================================================================================
// 1. The character's Currency row
// =================================================================================================
part('1. the character\'s Currency')
await alice.tab('Inventory')
const sheetTab = tabpanel(alice)
await sheetTab.getByRole('group', { name: 'Currency', exact: true }).waitFor({ timeout: 15_000 })
{
  const names = await currencyButtons(sheetTab)
  const look = await sheetTab.getByRole('group', { name: 'Currency', exact: true }).evaluate(group => {
    const card = group.closest('dl > div') ?? group.parentElement.parentElement
    const dt = card.querySelector('dt')
    const button = group.querySelector('button').getBoundingClientRect()
    const label = dt.getBoundingClientRect()
    const style = getComputedStyle(card)
    const contentRight = card.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth)
    return { overlap: button.top < label.bottom && label.top < button.bottom, right: contentRight - button.right, label: dt.textContent.trim() }
  })
  check(same(names, ['Send to']) && look.overlap && Math.abs(look.right) <= 1 && /^currency$/i.test(look.label) && await sheetTab.getByRole('button', { name: 'Give coins' }).count() === 0,
    `Thorin's Currency row has one button, "Send to", on the CURRENCY label's row, at the card's right edge, and none named Give coins (${JSON.stringify([names, look])})`)
}
await sheetTab.getByRole('group', { name: 'Currency', exact: true }).getByRole('button', { name: 'Send to', exact: true }).click()
let dialog = alice.page.getByRole('dialog', { name: 'Give coins' })
await dialog.waitFor()
{
  const radios = await radiosOf(dialog)
  check(same(radios, NEW ? ['The Iron Company Primary', 'Wardens of the Vale', 'Vex', 'Bram', 'Lia'] : ['The Iron Company Primary', 'Wardens of the Vale', 'Vex', 'Bram', 'Lia']),
    `"Send to" opens 0.31.0's "Give coins", its To without Thorin (${JSON.stringify(radios)})`)
}
await dialog.getByRole('button', { name: 'Cancel' }).click()
await dialog.waitFor({ state: 'hidden' })

// =================================================================================================
// 2. Coin spacing
// =================================================================================================
part('2. coin spacing')
async function spacing(who, scope, what) {
  const coins = scope.locator('dl li[title]')
  await coins.first().waitFor({ timeout: 15_000 })
  const seen = []
  for (let i = 0; i < await coins.count(); i++) seen.push(await who.halfSpace(coins.nth(i)))
  check(seen.length >= 1 && seen.every(s => s.separator !== null && Math.abs(s.separator - s.space / 2) <= 0.5 && /^[\d.,k]+ \S+$/.test(s.text)),
    `${what} at ${who.width}: every coin's space is half a space wide, and reads "amount abbreviation" (${JSON.stringify(seen.map(s => [s.text, +s.separator.toFixed(2), +(s.space / 2).toFixed(2)]))})`)
}
await spacing(alice, sheetTab, "Thorin's Holdings")

// =================================================================================================
// 3. The item's own menu on the character's sheet
// =================================================================================================
part('3. the item menu')
{
  const rope = itemRow(sheetTab, 'Rope')
  const summaryEl = rope.locator('summary').first()
  await summaryEl.scrollIntoViewIfNeeded()
  const box = await summaryEl.boundingBox()
  await summaryEl.click({ button: 'right', position: { x: 30, y: box.height / 2 } })
  const menu = alice.page.getByRole('menu', { name: 'Rope' })
  await menu.waitFor()
  const items = await menu.getByRole('menuitem').allTextContents()
  const at = await menu.boundingBox()
  // Below the pointer, or above it where it doesn't fit below: an edge of it within 60 px.
  const pointer = { x: box.x + 30, y: (await summaryEl.boundingBox()).y + box.height / 2 }
  const near = Math.min(Math.abs(at.y - pointer.y), Math.abs(at.y + at.height - pointer.y))
  // Module 0.33.0 removes items too, so its menu has "Remove…" after "Send to…"; module 0.31.0 doesn't.
  // Changed on purpose (round 0.37.0 §12.3): his Rope is one of his favorites, which module 0.37.0
  // removes from the app, first in its menu.
  const MENU = NEW ? ['Remove from favorites', 'Send to…', 'Remove…'] : ['Send to…']
  check(same(items, MENU) && near < 60 && at.x <= pointer.x + 60 && at.x + at.width >= pointer.x - 60,
    `a right-click on the Rope's name opens its menu, "Rope", at the pointer, with ${NEW ? '"Remove from favorites", "Send to…" then "Remove…", as module 0.37.0 removes favorites and 0.33.0 items' : '"Send to…" alone, as module 0.31.0 removes nothing'} (${JSON.stringify([items, pointer, at])})`)
  await menu.getByRole('menuitem', { name: 'Send to…' }).click()
  dialog = alice.page.getByRole('dialog', { name: 'Give Rope' })
  await dialog.waitFor()
  const radios = await radiosOf(dialog)
  check(!radios.includes('Thorin') && radios.includes('Vex'), `it opens "Give Rope", whose To lacks Thorin (${JSON.stringify(radios)})`)
  await pick(dialog, /^Vex/)
  await dialog.getByRole('button', { name: /^Give/ }).last().click()
  const made = await answered(1, 'the Rope given to Vex')
  check(made.status === 'done' && lastLine()?.text === 'Gives 1 Rope to Vex' && lastLine().actor === 'thorin',
    `1 to Vex: Foundry's line "${lastLine()?.text}", spoken by Thorin`)
}
// A held touch on the Longsword's name.
{
  const swordName = sheetTab.getByRole('button', { name: /^Longsword/, expanded: false }).first()
  const menu = await alice.itemMenu(swordName.locator('xpath=ancestor::li[1]'), 'touch', 'Longsword')
  await menu.waitFor({ timeout: 5_000 })
  await wait(300)
  check(await menu.isVisible() && await swordName.getAttribute('aria-expanded') === 'false',
    'a 600 ms held touch on the Longsword\'s name opens its menu, "Longsword"; let go, the row is still closed')
  await alice.page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
}
// The favorites strip's Rope: no menu under module 0.31.0; Remove from favorites alone under 0.37.0.
{
  const strip = alice.page.getByRole('region', { name: 'Favorites' })
  if (await strip.count()) {
    await strip.getByText('Rope', { exact: true }).first().click({ button: 'right' })
    if (NEW) {
      const menu = alice.page.getByRole('menu', { name: 'Rope' })
      await menu.waitFor({ timeout: 10_000 }).catch(() => {})
      const items = await menu.getByRole('menuitem').allTextContents()
      // Changed on purpose (round 0.37.0 §12.3): among his favorites, the Rope's menu removes it from them, and only that.
      check(await alice.page.getByRole('menu').count() === 1 && same(items, ['Remove from favorites']),
        `a right-click on the Rope among his favorites opens its menu, "Rope", "Remove from favorites" alone (${JSON.stringify(items)})`)
      await alice.page.keyboard.press('Escape')
      await menu.waitFor({ state: 'hidden' })
    } else {
      await wait(500)
      check(await alice.page.getByRole('menu').count() === 0, 'a right-click on the Rope among his favorites opens no menu')
      await alice.page.keyboard.press('Escape')
    }
  } else note('no favorites strip on Inventory at 390')
}
// The keyboard, at 1280.
const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await desk.tab('Inventory')
{
  const scope = tabpanel(desk)
  const rope = itemRow(scope, 'Rope').locator('summary').first()
  await rope.waitFor({ timeout: 15_000 })
  // Mid-screen, with room below it for the menu, which would otherwise flip above. Since module
  // 0.33.0 the menu holds Remove… too, taller than the room left under the Rope, near the page's
  // foot, at 800 px: the window is made taller for the menu's room, and given back after.
  await desk.page.setViewportSize({ width: 1280, height: 1000 })
  await rope.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await rope.focus()
  await desk.page.keyboard.press('Shift+F10')
  const menu = desk.page.getByRole('menu', { name: 'Rope' })
  await menu.waitFor()
  const look = await menu.evaluate((m, summaryBox) => ({
    below: m.getBoundingClientRect().top >= summaryBox - 2, focused: document.activeElement?.textContent?.trim(),
    at: { row: Math.round(summaryBox), top: Math.round(m.getBoundingClientRect().top), bottom: Math.round(m.getBoundingClientRect().bottom), screen: innerHeight },
  }), (await rope.boundingBox()).y + (await rope.boundingBox()).height)
  // Changed on purpose (round 0.37.0 §12.3): under module 0.37.0 the first item, "Remove from
  // favorites", takes focus.
  const FIRST = NEW ? 'Remove from favorites' : 'Send to…'
  check(look.below && look.focused === FIRST, `Shift+F10 on the focused Rope row opens its menu below it, "${FIRST}" focused (${JSON.stringify(look)})`)
  await desk.page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
  const back = await rope.evaluate(el => document.activeElement === el)
  await desk.page.keyboard.press('Enter')
  await wait(300)
  const opened = await rope.evaluate(el => el.closest('details').open)
  check(back && opened, 'Escape closes it, focus back on the row, and Enter then opens the row: nothing swallowed')
  await rope.focus()
  await desk.page.keyboard.press('Shift+F10')
  await menu.waitFor()
  // The menu shows a frame before its first item takes focus (floating-ui focuses it on the next
  // animation frame): an Enter in between, as under three lanes' load, would reach the row instead.
  await until(() => desk.page.evaluate(first => document.activeElement?.textContent?.trim() === first, FIRST), `"${FIRST}" to take focus`, 5_000)
  // Changed on purpose (round 0.37.0 §12.3): the arrow key down to "Send to…", after "Remove from favorites".
  if (NEW) {
    await desk.page.keyboard.press('ArrowDown')
    await until(() => desk.page.evaluate(() => document.activeElement?.textContent?.trim() === 'Send to…'), '"Send to…" to take focus', 5_000)
  }
  await desk.page.keyboard.press('Enter')
  const give = desk.page.getByRole('dialog', { name: 'Give Rope' })
  await give.waitFor()
  await wait(300)
  const inside = await give.evaluate(d => d.contains(document.activeElement))
  await desk.page.keyboard.press('Escape')
  await give.waitFor({ state: 'hidden' })
  await wait(300)
  const returned = await rope.evaluate(el => document.activeElement === el)
  check(inside && returned, 'Shift+F10 and Enter on "Send to…" opens "Give Rope" with focus inside it; Escape closes it, focus back on the Rope row')
  await desk.page.setViewportSize({ width: 1280, height: 800 })
}

if (SKEW031) {
  // ===============================================================================================
  // 18. Module 0.31.0: gives only
  // ===============================================================================================
  part('18. module 0.31.0')
  const panel = await openParty(alice)
  await panel.getByText('Bedroll').first().waitFor({ timeout: 15_000 }).catch(() => {})
  await panel.getByRole('group', { name: 'Currency', exact: true }).waitFor({ timeout: 15_000 })
  const names = await currencyButtons(panel)
  check(same(names, ['Take coins from The Iron Company', 'Give']) && await panel.getByRole('button', { name: 'Send to…' }).count() === 0,
    `the Company's Currency row holds Take and Give alone, and its stash no Send to… (${JSON.stringify(names)})`)
  await panel.locator('summary', { hasText: 'Rope' }).first().click({ button: 'right' })
  await wait(400)
  check(await alice.page.getByRole('menu').count() === 0, 'nor does its stash have a menu')
  await panel.getByRole('button', { name: 'Give', exact: true }).click()
  dialog = alice.page.getByRole('dialog', { name: 'Give coins' })
  await dialog.waitFor()
  await dialog.getByRole('textbox', { name: 'Gold' }).fill('15')
  check(await summary(dialog) === 'You give 15 gp to The Iron Company.', `Give: "${await summary(dialog)}"`)
  await dialog.getByRole('button', { name: 'Give coins' }).click()
  const made = await answered(2, 'the give into the party')
  check(made.status === 'done' && lastLine()?.text === 'Gives 15 gp to The Iron Company', `a give into the party, as 0.31.0 makes it: "${lastLine()?.text}"`)
  await panel.getByRole('button', { name: 'Close' }).click()
  const sent = await crafted(alice, ALICE_API, { from: 'company', to: 'vex', currency: { gp: 1 } })
  const shared = await crafted(alice, ALICE_API, { from: 'company', among: ['bram', 'lia', 'thorin', 'vex'], currency: { gp: 4 } })
  check(sent.status === 422 && sent.json?.reason === 'not-yours' && shared.status === 409 && shared.json?.reason === 'unavailable',
    `crafted, the Company to Vex is ${sent.status} ${sent.json?.reason}, a distribution ${shared.status} ${shared.json?.reason}`)
  await finish()
}

// =================================================================================================
// 4. The party's Currency row
// =================================================================================================
part('4. the party\'s Currency')
let panel = await openParty(alice)
await panel.getByRole('group', { name: 'Currency', exact: true }).waitFor({ timeout: 15_000 })
{
  const names = await currencyButtons(panel)
  check(same(names, ['Take coins from The Iron Company', 'Send to', 'Give', 'Distribute']),
    `the Company's Currency row: Take, Send to, Give and Distribute (${JSON.stringify(names)})`)
  await shootBoth(alice, 'givetake-party-currency', panel.getByRole('group', { name: 'Currency', exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]'))
  await spacing(alice, panel, "the Company's Holdings")
}
// A held touch on the Company's Rope's Take: Take, never the row's menu.
{
  const take = panel.getByRole('button', { name: 'Take Rope' })
  await alice.hold(take, 600)
  const takeDialog = alice.page.getByRole('dialog', { name: 'Take Rope' })
  await takeDialog.waitFor({ timeout: 5_000 })
  check(await alice.page.getByRole('menu').count() === 0, 'a 600 ms held touch on the Company\'s Rope\'s Take opens "Take Rope", and no item menu')
  await takeDialog.getByRole('button', { name: 'Cancel' }).click()
  await takeDialog.waitFor({ state: 'hidden' })
}

// =================================================================================================
// 5. Distribute gold
// =================================================================================================
part('5. distribute')
const AMONG = 'Bram, Lia, Thorin, and Vex'
const postsOfTransfer = []
alice.page.on('request', request => { if (request.method() === 'POST' && /\/rolls$/.test(request.url())) postsOfTransfer.push(request.postDataJSON()) })
await panel.getByRole('button', { name: 'Distribute', exact: true }).click()
dialog = alice.page.getByRole('dialog', { name: 'Distribute coins' })
await dialog.waitFor()
{
  const coins = await dialog.getByRole('group', { name: 'Coin' }).getByRole('radio').evaluateAll(rs => rs.map(r => ({
    name: r.closest('label').textContent.replace(/\s+/g, ' ').trim(), disabled: r.disabled, checked: r.checked,
    note: r.getAttribute('aria-describedby') ? document.getElementById(r.getAttribute('aria-describedby'))?.textContent.trim() : null,
  })))
  const among = await dialog.getByRole('list').getByRole('listitem').allTextContents()
  check(await dialog.getByText('From The Iron Company').isVisible()
    && same(coins.map(c => c.name), ['Platinum 4 pp', 'Gold 103 gp', 'Silver 8 sp', 'Copper 3 cp'])
    && coins[3].disabled && coins[3].note === 'Too few to share among 4' && coins.every(c => !c.checked)
    && await summary(dialog) === 'Choose a coin.' && await dialog.getByRole('button', { name: 'Distribute', exact: true }).getAttribute('aria-disabled') === 'true'
    && same(among.map(a => a.trim()), ['Bram', 'Lia', 'Thorin', 'Vex']),
    `"Distribute coins", from the Company: its coins, Copper too few to share among 4, none chosen, "Choose a coin.", Distribute disabled; among the four, no Grumble (${JSON.stringify([coins, among])})`)
  await pick(dialog, /^Gold/)
  const said = await summary(dialog)
  check(said.startsWith(`You distribute 100 gp among ${AMONG}: 25 gp each. 3 gp stays with The Iron Company.`), `with Gold chosen: "${said}"`)
  await shoot(alice, 'givetake-distribute', dialog)
  await dialog.getByRole('button', { name: 'Distribute', exact: true }).click()
}
let made = await answered(2, 'the distribution of gold')
{
  const body = postsOfTransfer.at(-1)
  check(same(body?.transfer, { from: 'company', among: ['bram', 'lia', 'thorin', 'vex'], currency: { gp: 103 } }), `the POST's transfer is the four and all 103 gp (${JSON.stringify(body?.transfer)})`)
  const line = lastLine()
  check(made.status === 'done' && line?.text === `Distributes 100 gp among ${AMONG} (25 gp each); 3 gp stays with The Iron Company` && line.actor === 'thorin' && line.author === 'alice',
    `Foundry's line "${line?.text}", spoken by Thorin, by Alice`)
  await statusIn(panel).getByText(`Distributed 100 gp among ${AMONG} (25 gp each)`).waitFor({ timeout: 15_000 })
  check(held(company, 'gp') === (DND5E6 ? 3.5 : 3) && gp(thorin) === 65 && gp(vex) === 37 && gp(bram) === 25 && gp(lia) === 25 && made.result?.transfer?.to === null,
    `the status over the stash says so; the Company ${held(company, 'gp')} gp, Thorin 65, Vex 37, Bram 25, Lia 25; the result's transfer.to null`)
  await until(async () => JSON.stringify((await call(alice.page, `${ALICE_API}/table`)).json?.messages ?? []).includes('Distributes 100 gp among'), "the line in the app's chat", 15_000)
  // On the wide screen, in the chat a tab away from Combat.
  await desk.page.getByRole('tab', { name: /^Chat/ }).click()
  const entry = desk.log.locator(':scope > li').filter({ hasText: `Distributes 100 gp among ${AMONG} (25 gp each)` }).last()
  await entry.waitFor({ timeout: 15_000 })
  check(await entry.isVisible() && (await entry.textContent()).includes('Thorin'), "the app's chat shows the line, by Thorin, on Alice's wide screen")
  await shootBoth(desk, 'givetake-distribute-line', entry)
}

// ---- 6. Distribute silver ----
part('6. silver')
await panel.getByRole('button', { name: 'Distribute', exact: true }).click()
await dialog.waitFor()
await pick(dialog, /^Silver/)
check((await summary(dialog)).includes('Nothing stays with The Iron Company.'), `silver: "${await summary(dialog)}"`)
await dialog.getByRole('button', { name: 'Distribute', exact: true }).click()
made = await answered(3, 'the distribution of silver')
check(made.status === 'done' && lastLine()?.text === `Distributes 8 sp among ${AMONG} (2 sp each); none stays with The Iron Company` && held(company, 'sp') === 0,
  `"${lastLine()?.text}", the Company left no sp`)

// ---- 7. The members change under an open Distribute ----
part('7. members')
const linesBefore = lines().length
const movesBefore = moves().length
await panel.getByRole('button', { name: 'Distribute', exact: true }).click()
await dialog.waitFor()
await pick(dialog, /^Platinum/)
const withoutLia = [thorin, vex, bram, grumble]
await changeMembers(company, withoutLia)
await until(() => postsOf('group.updated').some(p => p.data.group.id === 'company' && !JSON.stringify(p.data.group.sheet?.members ?? []).includes('"lia"')), "the Company's group.updated without Lia", 15_000)
await wait(3500)
check((await dialog.getByRole('list').textContent()).includes('Lia'), 'her group.updated reaches the app; the open dialog still says Lia')
await dialog.getByRole('button', { name: 'Distribute', exact: true }).click()
await statusIn(panel).getByText('Not distributed: the party’s members have changed. Try again').waitFor({ timeout: 15_000 })
check(moves().length === movesBefore && held(company, 'pp') === 4 && lines().length === linesBefore,
  'Distribute: "Not distributed: the party’s members have changed. Try again", the app\'s 422: nothing moved, no line')
await changeMembers(company, [thorin, vex, bram, lia, grumble])
await until(() => postsOf('group.updated').at(-1)?.data.group.sheet?.members?.some(m => m.id === 'lia'), 'Lia back', 15_000)
await wait(3500)
// The module alone knows: Lia leaves with no word to the app.
await panel.getByRole('button', { name: 'Distribute', exact: true }).click()
await dialog.waitFor()
await pick(dialog, /^Platinum/)
await changeMembers(company, withoutLia, { tell: false })
{
  const count = moves().length
  await dialog.getByRole('button', { name: 'Distribute', exact: true }).click()
  made = await answered(count + 1, 'the distribution the module refuses')
  await statusIn(panel).getByText('Not distributed: the party’s members have changed. Try again').waitFor({ timeout: 15_000 })
  check(made.status === 'failed' && made.result?.reason === 'members' && held(company, 'pp') === 4 && lines().length === linesBefore,
    `the module alone knowing, the POST is taken and the module says members, in the same words; nothing moved, no line (${made.result?.reason})`)
}
await changeMembers(company, [thorin, vex, bram, lia, grumble])
await until(() => postsOf('group.updated').at(-1)?.data.group.sheet?.members?.some(m => m.id === 'lia'), 'Lia back again', 15_000)

// ---- 8. The party's coins sent to Vex ----
part('8. send coins')
await panel.getByRole('button', { name: 'Send to', exact: true }).click()
dialog = alice.page.getByRole('dialog', { name: 'Send coins' })
await dialog.waitFor()
{
  const parties = await radiosOf(dialog, 'Parties')
  const characters = await radiosOf(dialog, 'Characters')
  check(await dialog.getByText('From The Iron Company').isVisible() && same(parties, ['Wardens of the Vale']) && same(characters, ['Thorin', 'Vex', 'Bram', 'Lia'])
    && await summary(dialog) === 'Choose who gets it.',
    `"Send coins", from the Company: Parties ${JSON.stringify(parties)}, Characters ${JSON.stringify(characters)}, no one chosen`)
  await pick(dialog, /^Vex/)
  await dialog.getByRole('textbox', { name: 'Gold' }).fill('2')
  await shoot(alice, 'givetake-send', dialog)
  await dialog.getByRole('button', { name: 'Send coins' }).click()
}
made = await answeredNext('the Company\'s 2 gp sent to Vex')
await statusIn(panel).getByText('Sent 2 gp from The Iron Company to Vex').waitFor({ timeout: 15_000 })
check(made.status === 'done' && lastLine()?.text === 'Sends 2 gp from The Iron Company to Vex' && lastLine().actor === 'thorin' && lastLine().author === 'alice'
  && held(company, 'gp') === (DND5E6 ? 1.5 : 1) && gp(vex) === 39,
  `"${lastLine()?.text}", spoken by Thorin, by Alice; the status says so; the Company ${held(company, 'gp')} gp, Vex 39`)

// ---- 9. The party's Rope to the Wardens, and a potion that stacks there ----
part('9. send an item')
{
  const ropeRow = panel.locator('summary', { hasText: /^Rope/ }).first()
  await ropeRow.click({ button: 'right' })
  const menu = alice.page.getByRole('menu', { name: 'Rope' })
  await menu.waitFor()
  check(same(await menu.getByRole('menuitem').allTextContents(), ['Send to…']), 'a right-click on the Company\'s Rope opens its menu, "Send to…"')
  await shoot(alice, 'givetake-item-menu')
  await menu.getByRole('menuitem', { name: 'Send to…' }).click()
  dialog = alice.page.getByRole('dialog', { name: 'Send Rope' })
  await dialog.waitFor()
  check(await dialog.getByText('From The Iron Company').isVisible() && await dialog.getByRole('spinbutton', { name: 'How many' }).or(dialog.getByRole('textbox', { name: 'How many' })).inputValue() === '1'
    && (await dialog.textContent()).includes('of 2'), '"Send Rope", from the Company, How many 1 of 2')
  await pick(dialog, /^Wardens of the Vale/)
  await dialog.getByRole('button', { name: /^Send/ }).last().click()
  made = await answeredNext('the Rope sent to the Wardens')
  check(made.status === 'done' && lastLine()?.text === 'Sends 1 Rope from The Iron Company to Wardens of the Vale' && holding(wardens, 'Rope')[0]?.system.quantity === 1
    && holding(company, 'Rope')[0]?.system.quantity === 1, `"${lastLine()?.text}"; the Wardens hold a Rope, the Company one`)
  // The opened row's pill.
  if (!(await ropeRow.evaluate(el => el.closest('details').open))) await ropeRow.click()
  const pill = ropeRow.locator('xpath=ancestor::li[1]').getByRole('button', { name: 'Send to…', exact: true })
  await pill.click()
  await alice.page.getByRole('dialog', { name: 'Send Rope' }).waitFor()
  check(true, 'the opened Rope row\'s "Send to…" pill opens the same dialog')
  await alice.page.getByRole('dialog', { name: 'Send Rope' }).getByRole('button', { name: 'Cancel' }).click()
  // A Potion of Healing stacks with the Wardens'.
  await panel.locator('summary', { hasText: /^Potion of Healing/ }).first().click({ button: 'right' })
  await alice.page.getByRole('menu', { name: 'Potion of Healing' }).getByRole('menuitem', { name: 'Send to…' }).click()
  dialog = alice.page.getByRole('dialog', { name: 'Send Potion of Healing' })
  await dialog.waitFor()
  await pick(dialog, /^Wardens of the Vale/)
  await dialog.getByRole('button', { name: /^Send/ }).last().click()
  made = await answeredNext('a potion sent to the Wardens')
  check(made.status === 'done' && holding(wardens, 'Potion of Healing').length === 1 && holding(wardens, 'Potion of Healing')[0].system.quantity === 2,
    `a Potion of Healing sent to the Wardens stacks: theirs ×${holding(wardens, 'Potion of Healing')[0]?.system.quantity}`)
}

// ---- 10. Give to the party ----
part('10. give')
await panel.getByRole('button', { name: 'Give', exact: true }).click()
dialog = alice.page.getByRole('dialog', { name: 'Give coins' })
await dialog.waitFor()
check(await dialog.getByRole('radio').count() === 0 && (await dialog.getByRole('group', { name: 'Coins' }).textContent()).includes('of 65 gp'), '"Give coins" has no To, and Thorin\'s coins: "of 65 gp"')
await dialog.getByRole('textbox', { name: 'Gold' }).fill('15')
check(await summary(dialog) === 'You give 15 gp to The Iron Company.', `"${await summary(dialog)}"`)
await dialog.getByRole('button', { name: 'Give coins' }).click()
made = await answeredNext('the give into the party')
check(made.status === 'done' && lastLine()?.text === 'Gives 15 gp to The Iron Company' && gp(thorin) === 50 && held(company, 'gp') === (DND5E6 ? 16.5 : 16),
  `"${lastLine()?.text}": Thorin 50, the Company ${held(company, 'gp')}`)

// ---- 11. Into her own ----
part('11. into her own')
await panel.locator('summary', { hasText: /^Potion of Healing/ }).first().click({ button: 'right' })
await alice.page.getByRole('menu', { name: 'Potion of Healing' }).getByRole('menuitem', { name: 'Send to…' }).click()
dialog = alice.page.getByRole('dialog', { name: 'Send Potion of Healing' })
await dialog.waitFor()
await pick(dialog.getByRole('group', { name: 'Characters' }), /^Thorin/)
await dialog.getByRole('button', { name: /^Send/ }).last().click()
made = await answeredNext('a potion sent to Thorin')
await statusIn(panel).getByText('Sent 1 Potion of Healing from The Iron Company to Thorin').waitFor({ timeout: 15_000 })
check(made.status === 'done' && lastLine()?.text === 'Takes 1 Potion of Healing from The Iron Company' && lastLine().actor === 'thorin',
  `sent into her own, Foundry's line is a take, "${lastLine()?.text}", spoken by Thorin; the status "Sent 1 Potion of Healing from The Iron Company to Thorin"`)
await panel.getByRole('button', { name: 'Close' }).click()

// ---- 12. Bob, an Observer of the Company and an Owner of the Wardens ----
part('12. Bob')
{
  const bobPanel = await openParty(bob)
  await bobPanel.getByText('Bedroll').first().waitFor({ timeout: 15_000 }).catch(() => {})
  await wait(3500)
  await bobPanel.locator('summary', { hasText: /^Rope/ }).first().click({ button: 'right' })
  await wait(400)
  check(await bobPanel.getByRole('group', { name: 'Currency', exact: true }).count() === 0 && await bob.page.getByRole('menu').count() === 0
    && await bobPanel.getByRole('button', { name: 'Send to…' }).count() === 0,
    'Bob\'s Company panel has no Currency buttons, no row menus and no pills')
  await bobPanel.getByRole('button', { name: 'Close' }).click()
  const refused = [
    await crafted(bob, BOB_API, { from: 'company', to: 'vex', currency: { gp: 1 } }),
    await crafted(bob, BOB_API, { from: 'company', among: ['bram', 'lia', 'thorin', 'vex'], currency: { pp: 4 } }),
    await crafted(bob, BOB_API, { from: 'wardens', to: 'company', currency: { gp: 1 } }),
  ].map(r => [r.status, r.json?.reason])
  check(same(refused, [[422, 'not-owner'], [422, 'not-owner'], [422, 'not-owner']]), `his crafted sends from the Company, its distribution, and the Wardens into the Company: ${JSON.stringify(refused)}`)
  const wardensPanel = await openParty(bob, 'Wardens of the Vale')
  await wardensPanel.getByRole('button', { name: 'Send to', exact: true }).click()
  dialog = bob.page.getByRole('dialog', { name: 'Send coins' })
  await dialog.waitFor()
  const characters = await radiosOf(dialog, 'Characters')
  check(await dialog.getByRole('group', { name: 'Parties' }).count() === 0 && same(characters, ['Thorin', 'Vex', 'Bram', 'Lia']),
    `his Wardens' Send to: no Parties, Characters ${JSON.stringify(characters)}`)
  await pick(dialog, /^Thorin/)
  await dialog.getByRole('textbox', { name: 'Gold' }).fill('5')
  await dialog.getByRole('button', { name: 'Send coins' }).click()
  made = await answeredNext('Bob\'s 5 gp from the Wardens')
  check(made.status === 'done' && lastLine()?.text === 'Sends 5 gp from Wardens of the Vale to Thorin' && lastLine().actor === 'vex' && lastLine().author === 'bob',
    `"${lastLine()?.text}", spoken by Vex, by Bob`)
  await wardensPanel.getByRole('button', { name: 'Close' }).click()
}

// ---- 13. Alice's crafted refusals ----
part('13. refusals')
{
  const linesAt = lines().length
  const results = [
    await crafted(alice, ALICE_API, { from: 'company', to: 'order', currency: { gp: 1 } }),
    await crafted(alice, ALICE_API, { from: 'company', among: ['bram', 'thorin', 'vex'], currency: { pp: 4 } }),
    await crafted(alice, ALICE_API, { from: 'company', among: ['bram', 'lia', 'thorin', 'vex'], currency: { cp: 3 } }),
    await crafted(alice, ALICE_API, { from: 'company', to: 'vex', among: ['bram', 'lia', 'thorin', 'vex'], currency: { pp: 4 } }),
    await crafted(alice, ALICE_API, { from: 'company', among: ['bram', 'lia', 'thorin', 'vex', 'grumble'], currency: { pp: 4 } }),
    await crafted(alice, ALICE_API, { from: 'company', among: ['bram', 'lia', 'thorin', 'wardens'], currency: { pp: 4 } }),
    await crafted(alice, ALICE_API, { from: 'company', among: ['bram', 'lia', 'thorin', 'order'], currency: { pp: 4 } }),
    await crafted(alice, ALICE_API, { from: 'vex', to: 'company', currency: { gp: 1 } }),
  ].map(r => [r.status, r.json?.reason ?? null])
  await wait(1000)
  check(same(results, [[422, 'unknown'], [422, 'members'], [422, 'split'], [400, null], [422, 'unknown'], [422, 'unknown'], [422, 'unknown'], [422, 'not-yours']]) && lines().length === linesAt,
    `to The Silent Order unknown, without Lia members, 3 cp among four split, to with among 400, Grumble unknown, the Wardens unknown as The Silent Order, from Vex's character not-yours; Foundry posts nothing (${JSON.stringify(results)})`)
}

// ---- 14. The Gamemaster ----
part('14. the Gamemaster')
{
  const gm = await browse({ width: 390, height: 844, path: `/campaigns/${A}/characters/vex`, toasts: false })
  await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  const gmPanel = await openParty(gm)
  await gmPanel.getByRole('group', { name: 'Currency', exact: true }).waitFor({ timeout: 15_000 })
  const names = await currencyButtons(gmPanel)
  check(same(names, ['Take coins from The Iron Company', 'Send to', 'Distribute']), `on Vex's GM page, the Company's Currency row: ${JSON.stringify(names)}, no Give`)
  await gmPanel.getByRole('button', { name: 'Send to', exact: true }).click()
  dialog = gm.page.getByRole('dialog', { name: 'Send coins' })
  await dialog.waitFor()
  const parties = await radiosOf(dialog, 'Parties')
  const characters = await radiosOf(dialog, 'Characters')
  check(same(parties, ['Wardens of the Vale', 'The Silent Order']) && same(characters, ['Thorin', 'Vex', 'Bram', 'Lia']), `its Send to: Parties ${JSON.stringify(parties)}, Characters ${JSON.stringify(characters)}`)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await gmPanel.locator('summary', { hasText: /^Potion of Healing/ }).first().click({ button: 'right' })
  await gm.page.getByRole('menu', { name: 'Potion of Healing' }).getByRole('menuitem', { name: 'Send to…' }).click()
  dialog = gm.page.getByRole('dialog', { name: 'Send Potion of Healing' })
  await dialog.waitFor()
  await pick(dialog, /^The Silent Order/)
  await dialog.getByRole('button', { name: /^Send/ }).last().click()
  made = await answeredNext("the Gamemaster's potion to The Silent Order")
  check(made.status === 'done' && made.role === 'gm' && lastLine()?.text === 'Sends 1 Potion of Healing from The Iron Company to The Silent Order' && lastLine().actor === 'vex' && lastLine().by === 'gm'
    && made.label === 'Send 1 Potion of Healing from The Iron Company to The Silent Order',
    `"${lastLine()?.text}", spoken by Vex, flagged the Gamemaster's; its label "${made.label}"`)
  await gmPanel.getByRole('button', { name: 'Distribute', exact: true }).click()
  dialog = gm.page.getByRole('dialog', { name: 'Distribute coins' })
  await dialog.waitFor()
  await pick(dialog, /^Platinum/)
  await dialog.getByRole('button', { name: 'Distribute', exact: true }).click()
  made = await answeredNext("the Gamemaster's distribution of platinum")
  await statusIn(gmPanel).getByText(`Vex distributed 4 pp among ${AMONG} (1 pp each)`).waitFor({ timeout: 15_000 })
  check(made.status === 'done' && lastLine()?.text === `Distributes 4 pp among ${AMONG} (1 pp each); none stays with The Iron Company` && lastLine().actor === 'vex' && lastLine().by === 'gm'
    && made.label === `Distribute 4 pp from The Iron Company among ${AMONG}`,
    `"${lastLine()?.text}", spoken by Vex, flagged; the label "${made.label}"; the status "Vex distributed 4 pp among ${AMONG} (1 pp each)"`)
  await gmPanel.getByRole('button', { name: 'Close' }).click()
  await gm.page.goto(`${BASE}/campaigns/${A}/party/company`)
  const gmParty = gm.page
  await gmParty.getByRole('group', { name: 'Currency', exact: true }).waitFor({ timeout: 20_000 })
  const own = await currencyButtons(gmParty)
  await gmParty.locator('summary', { hasText: /^Rope/ }).first().click({ button: 'right' })
  await wait(400)
  check(same(own, ['Take coins from The Iron Company']) && await gmParty.getByRole('menu').count() === 0 && await gmParty.getByRole('button', { name: 'Send to…' }).count() === 0,
    `the Gamemaster's own party page: Take alone, no row menus or pills (${JSON.stringify(own)})`)
  await gm.view.close()
}

if (DND5E6) {
  // ---- 17. dnd5e 6.0.5's fractional gold, through every move so far (the race below sets it whole) ----
  check(company._source.system.currency.gp === 16.5, `under dnd5e 6.0.5 the Company's gold kept its half throughout: ${company._source.system.currency.gp}`)
}
// ---- 15. A race between Alice's phone and tablet ----
part('15. a race')
{
  company._source.system.currency.gp = 16
  await company.update({ 'system.currency.gp': 16 })
  const tablet = await browse({ width: 768, height: 1024, path: '/characters/sheet-thorin', toasts: false })
  await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  panel = await openParty(alice)
  const tabletPanel = await openParty(tablet)
  const companyGold = async () => (await call(alice.page, `${ALICE_API}/party/company`)).json?.sheet?.inventory?.currency?.find(c => c.id === 'gp')?.value
  // What a dialog opened from a panel asks for is what that panel shows: once its poll has it.
  const panelShows = (p, coins, what) => until(async () => (await p.locator('dl li[title]').allTextContents()).includes(coins), what, 15_000)
  await until(async () => (await companyGold()) === 16, 'the Company at 16 gp', 15_000)
  await panelShows(panel, '16 gp', "the phone's panel at 16 gp")
  await panelShows(tabletPanel, '16 gp', "the tablet's panel at 16 gp")
  // (a) The tablet sends 2 gp to Vex first: the app refuses the phone's.
  await panel.getByRole('button', { name: 'Distribute', exact: true }).click()
  dialog = alice.page.getByRole('dialog', { name: 'Distribute coins' })
  await dialog.waitFor()
  await pick(dialog, /^Gold/)
  await tabletPanel.getByRole('button', { name: 'Send to', exact: true }).click()
  const tabletDialog = tablet.page.getByRole('dialog', { name: 'Send coins' })
  await tabletDialog.waitFor()
  await pick(tabletDialog, /^Vex/)
  await tabletDialog.getByRole('textbox', { name: 'Gold' }).fill('2')
  await tabletDialog.getByRole('button', { name: 'Send coins' }).click()
  await statusIn(tabletPanel).getByText('Sent 2 gp from The Iron Company to Vex').waitFor({ timeout: 20_000 })
  await until(async () => (await companyGold()) === 14, 'the Company at 14 gp', 15_000)
  await dialog.getByRole('button', { name: 'Distribute', exact: true }).click()
  await statusIn(panel).getByText('Not distributed: the party hasn’t that many').waitFor({ timeout: 15_000 })
  check(held(company, 'gp') === 14, "(a) the tablet's send made, the phone's Distribute of 16: \"Not distributed: the party hasn’t that many\", the app's; nothing moved")
  // (b) The app's sheet says 16; Foundry alone has 14: the module refuses it.
  await company.update({ 'system.currency.gp': 16 })
  await until(async () => (await companyGold()) === 16, 'the Company at 16 gp again', 15_000)
  await panelShows(panel, '16 gp', "the phone's panel at 16 gp again")
  coinsInFoundry(company, { gp: 14 })
  const linesAt = lines().length
  await panel.getByRole('button', { name: 'Distribute', exact: true }).click()
  await dialog.waitFor()
  await pick(dialog, /^Gold/)
  const count = moves().length
  await dialog.getByRole('button', { name: 'Distribute', exact: true }).click()
  made = await answered(count + 1, 'the distribution the module finds short')
  check(made.status === 'failed' && made.result?.reason === 'short' && held(company, 'gp') === 14 && lines().length === linesAt,
    `(b) the POST taken, the module says short: "Not distributed: the party hasn’t that many"; nothing moved, no line (${JSON.stringify([made.status, made.result, made.payload, held(company, 'gp'), lines().slice(linesAt).map(l => l.text)])})`)
  // (c) The tablet's send held at its first write: the phone's Distribute is on its way already.
  await company.update({ 'system.currency.gp': 16 })
  await until(async () => (await companyGold()) === 16, 'the Company at 16 gp, a third time', 15_000)
  await panelShows(panel, '16 gp', "the phone's panel at 16 gp, a third time")
  await panelShows(tabletPanel, '16 gp', "the tablet's panel at 16 gp, a third time")
  const hold = holdWrite((kind, target) => kind === 'update' && target.id === 'company')
  await tabletPanel.getByRole('button', { name: 'Send to', exact: true }).click()
  await tabletDialog.waitFor()
  await pick(tabletDialog, /^Vex/)
  await tabletDialog.getByRole('textbox', { name: 'Gold' }).fill('1')
  await tabletDialog.getByRole('button', { name: 'Send coins' }).click()
  await hold.held
  // Module 0.33.0's feedback: while the coins are on their way, the tablet's Currency row is busy,
  // its buttons disabled with no spinner of their own, and one spinner right of the "Currency" label.
  {
    const group = tabletPanel.getByRole('group', { name: 'Currency', exact: true })
    await until(async () => (await group.getAttribute('aria-busy')) === 'true', "the tablet's Currency row to wait", 10_000)
    const look = await currencyLook(group)
    check(look.busy === 'true' && look.buttons.length >= 2 && look.buttons.every(b => b.disabled && b.svgs === 0) && look.termSpinners === 1 && look.right && look.name === 'Currency',
      `while the tablet's send is on its way: its Currency group busy, still named "Currency", each button disabled with no spinner of its own, one spinner right of the label (${JSON.stringify(look)})`)
    await shootBoth(tablet, 'givetake-party-waiting', group.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]'), SHOTS_033)
  }
  await panel.getByRole('button', { name: 'Distribute', exact: true }).click()
  await dialog.waitFor()
  await pick(dialog, /^Gold/)
  await dialog.getByRole('button', { name: 'Distribute', exact: true }).click()
  await statusIn(panel).getByText('Not distributed: it’s on its way already').waitFor({ timeout: 15_000 })
  const vexBefore = gp(vex)
  hold.release()
  await statusIn(tabletPanel).getByText('Sent 1 gp from The Iron Company to Vex').waitFor({ timeout: 20_000 })
  await wait(1000)
  check(gp(vex) === vexBefore + 1 && writes.filter(([kind, id, payload]) => kind === 'update' && id === 'vex').length >= 1,
    '(c) with the tablet\'s send held at its first write, the phone\'s Distribute: "Not distributed: it’s on its way already"; released, the send is made once')
  {
    const group = tabletPanel.getByRole('group', { name: 'Currency', exact: true })
    await until(async () => (await group.getAttribute('aria-busy')) === null, "the tablet's Currency row to stop waiting", 10_000).catch(() => {})
    const look = await currencyLook(group)
    check(look.busy === null && look.termSpinners === 0 && look.buttons.every(b => !b.disabled && b.svgs === 0),
      `made, the tablet's Currency row: no spinner, not busy, its buttons enabled (${JSON.stringify(look)})`)
  }
  await tablet.view.close()
  // (d) Module 0.33.0's feedback: the Company's Rope taken, held at its first write: one spinner by its name.
  {
    const ropeHold = holdWrite((kind, target) => [target.id, target.actor?.id].some(id => ['company', 'thorin'].includes(id)))
    const take = panel.getByRole('button', { name: 'Take Rope' })
    await take.click()
    const takeDialog = alice.page.getByRole('dialog', { name: 'Take Rope' })
    await takeDialog.waitFor()
    await takeDialog.getByRole('button', { name: 'Take', exact: true }).click()
    await Promise.race([ropeHold.held, wait(20_000)])
    await until(async () => (await take.getAttribute('aria-busy')) === 'true', 'her Take Rope to wait', 10_000)
    const look = await rowLook(take)
    check(look.busy === 'true' && look.disabled && look.svgs === 0 && look.rowSpinners === 1 && look.right && look.name === 'Rope',
      `while the Rope is on its way: its row busy, Take Rope disabled with no spinner of its own, one spinner right of "Rope" (${JSON.stringify(look)})`)
    await shootBoth(alice, 'givetake-party-waiting-item', take.locator('xpath=ancestor::li[1]'), SHOTS_033)
    const others = await panel.locator('li[aria-busy="true"]').count()
    ropeHold.release()
    await statusIn(panel).getByText('Took 1 Rope from The Iron Company').waitFor({ timeout: 20_000 })
    await wait(500)
    const after = await panel.evaluate(p => ({ busy: p.querySelectorAll('li[aria-busy="true"]').length, spinners: [...p.querySelectorAll('li svg.motion-safe\\:animate-spin')].length }))
    check(others === 1 && after.busy === 0 && after.spinners === 0 && holding(thorin, 'Rope').reduce((n, r) => n + r.system.quantity, 0) === 2 && holding(company, 'Rope').length === 0,
      `no other row waited; taken, no row is busy and no row has a spinner (${JSON.stringify(after)})`)
    // A Rope again in the Company, for the widths below.
    await company.createEmbeddedDocuments('Item', [{ _id: 'rope3', name: 'Rope', type: 'loot', system: { quantity: 1, identified: true, weight: { value: 10, units: 'lb' } } }])
    await panel.locator('summary', { hasText: /^Rope/ }).first().waitFor({ timeout: 15_000 })
  }
  await panel.getByRole('button', { name: 'Close' }).click()
  // The character's sheet unchanged: a give of Thorin's coins held, his Send to has its own spinner.
  {
    await alice.tab('Inventory')
    const group = tabpanel(alice).getByRole('group', { name: 'Currency', exact: true })
    const giveHold = holdWrite((kind, target) => kind === 'update' && target.id === 'thorin')
    await group.getByRole('button', { name: 'Send to', exact: true }).click()
    dialog = alice.page.getByRole('dialog', { name: 'Give coins' })
    await dialog.waitFor()
    await pick(dialog, /^Vex/)
    await dialog.getByRole('textbox', { name: 'Gold' }).fill('1')
    await dialog.getByRole('button', { name: 'Give coins' }).click()
    await Promise.race([giveHold.held, wait(20_000)])
    const send = group.getByRole('button', { name: 'Send to', exact: true })
    await until(async () => (await send.getAttribute('aria-busy')) === 'true', 'his Send to to wait', 10_000)
    const look = await currencyLook(group)
    check(look.buttons.length === 1 && look.buttons[0].disabled && look.buttons[0].svgs === 1 && look.termSpinners === 0 && look.busy === null,
      `on Thorin's own sheet, as before: while his give is on its way, his Send to has its own spinner, his "Currency" label none, the group not busy (${JSON.stringify(look)})`)
    giveHold.release()
    // The give is the last move posted: it was taken before its write was held.
    await answered(moves().length, "Thorin's 1 gp to Vex")
  }
}

// ---- 16. Every width, both themes ----
part('16. widths')
for (const width of [360, 390, 768, 1280]) {
  await alice.page.setViewportSize({ width, height: width < 1024 ? 844 : 800 })
  alice.width = width
  for (const scheme of ['light', 'dark']) {
    await theme(alice, scheme)
    await alice.tab('Inventory')
    const own = await sideways(alice.page)
    const p = await openParty(alice)
    await p.getByRole('group', { name: 'Currency', exact: true }).waitFor()
    const wraps = width <= 360 ? await p.getByRole('group', { name: 'Currency', exact: true }).evaluate(group => {
      const card = group.closest('dl > div') ?? group.parentElement.parentElement
      const label = card.querySelector('dt').getBoundingClientRect()
      const style = getComputedStyle(card)
      return { below: group.getBoundingClientRect().top >= label.bottom - 1, right: Math.abs(card.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth) - group.getBoundingClientRect().right) <= 1 }
    }) : { below: true, right: true }
    const partyWide = await sideways(alice.page)
    if (width === 390) await shoot(alice, 'givetake-currency', p)
    await p.getByRole('button', { name: 'Send to', exact: true }).click()
    const send = alice.page.getByRole('dialog', { name: 'Send coins' })
    await send.waitFor()
    const sendWide = await sideways(alice.page)
    await send.getByRole('button', { name: 'Cancel' }).click()
    await p.getByRole('button', { name: 'Distribute', exact: true }).click()
    const share = alice.page.getByRole('dialog', { name: 'Distribute coins' })
    await share.waitFor()
    const shareWide = await sideways(alice.page)
    await share.getByRole('button', { name: 'Cancel' }).click()
    await p.locator('summary', { hasText: /^Rope/ }).first().click({ button: 'right' })
    const menu = alice.page.getByRole('menu', { name: 'Rope' })
    await menu.waitFor()
    const onTop = await menu.getByRole('menuitem').first().evaluate(item => {
      const box = item.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return !!hit && item.contains(hit)
    })
    await alice.page.keyboard.press('Escape')
    check(own === 0 && partyWide === 0 && sendWide === 0 && shareWide === 0 && onTop && wraps.below && wraps.right,
      `at ${width} px, ${scheme}: the Currency rows, Send coins and Distribute coins scroll nothing sideways${width <= 360 ? ', the party\'s group wraps under its label at the card\'s right' : ''}; the item's menu is on top`)
    await p.getByRole('button', { name: 'Close' }).click()
    if (width === 1280) await spacing(alice, tabpanel(alice), "Thorin's Holdings")
  }
}
await alice.page.setViewportSize({ width: 390, height: 844 })
alice.width = 390
await theme(alice, 'light')

note(`lines: ${JSON.stringify(lines().map(l => l.text))}`)
await finish()
