// Moving items and coins (module 0.31.0 and the app, its contract §9 transfers-e2e.mjs, decisions 1-3),
// end to end, in the world of world-030.mjs, its actors' items Foundry's embedded documents with
// dnd5e's own createWithContents (`embedded()`). Alice plays Thorin and runs the campaign; her user
// owns The Iron Company, the primary party, which holds three Potions of Healing, a Rope, a
// Backpack with a Bedroll in it, an unidentified Strange Vial (a Potion of Giant Strength), five
// Fire Opals, 120 gp and 7 sp. Bob plays Vex, observes the Company, and can't see The Silent Order.
// The campaign starts with rolls off, so moves are proven apart from them: off by default, with no
// Take or Give anywhere and a crafted move turned down; turned on in Manage Campaigns, the controls
// within a poll, the module's fetching woken by the hello's answer. Alice takes two of the three
// potions into her own stack, the Backpack with what's in it, 50 gp; gives her equipped Longsword to
// the party, which gets it unequipped; gives a potion to Vex, and Bob sends Thorin 5 gp; takes the
// Strange Vial, whose true name goes nowhere. Each with its line in Foundry's chat as the character
// who moved it, and in the app's, and both sheets sent before the result. Refused: Bob's take (he
// only observes), a party he can't see, a second identical move on its way, a give of more than is
// left; the two characters' race for the last Rope, one move made and one "gone". The Gamemaster
// gives from Thorin's page, its line flagged theirs, and takes into a chosen Vex on the party page.
// Switched off with a dialog open; with rolls on too. The dialog and the party panel at 360, 390,
// 768 and 1280 px in both themes. Since module 0.32.0 and PR #44: the party opens from the Inventory
// tab's party list, the character's coin button reads "Send to" on the Currency row, and the hello
// says whether a party's Owner may send its things elsewhere and distribute its coin. Since module
// 0.33.0's feedback, a party row waiting has one spinner, beside its name, its Take without one.
// DND5E6=1: dnd5e 6.0.5, whose coin may be fractional. SKEW=030
// with MODULE=module 0.30.0: no moves at all. Synthetic characters only. Run with --import
// ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { readFileSync } from 'node:fs'
import {
  BASE, BOB, DND5E6, MODULE, SHOTS, SKEW030, VARIANT, W, actors, browse, call, character, check, embedded, finish, foundryWorld,
  group, holdWrite, launch, newCampaign, note, part, posted, postsOf, same, sameJson, settings, settled, shoot, shootBoth, sideways, sql,
  startModule, theme, until, wait, writes,
} from './world-030.mjs'

const GAME = 'https://iron-hills.forge-vtt.com'
const SECRET = 'iron-hills-transfers-31'
const TITLE = 'Iron Hills'
const NEW = !SKEW030
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'iron-hills.forge-vtt.com', secret: SECRET })
await foundryWorld()
// The version its release reports, not a dev checkout's module.json (0.1.0): the campaign card
// tells a module before 0.31.0, which has no switch, from one whose switch is off.
game.modules.get('sending-stone').version = SKEW030 ? '0.30.0' : '0.31.0'

// When the module's fetches for commands begin, and when its hellos are answered: the wake.
const fetchStarts = []
const helloAnswers = []
{
  const inner = globalThis.fetch
  globalThis.fetch = (url, init) => {
    if (String(url).endsWith('/api/bridge/commands')) fetchStarts.push(Date.now())
    const answer = inner(url, init)
    if (JSON.parse(init.body ?? '{}').type === 'bridge.hello') void answer.then(() => helloAnswers.push(Date.now()), () => {})
    return answer
  }
}
// Manage Campaigns, drawn from the module's own templates in jsdom, as the Gamemaster uses it.
process.env.MODULE_DIR ??= MODULE
const windowApp = NEW ? await import('./fvtt/settings-app.mjs') : null

// ---- The world ----
const POTION = 'Compendium.dnd5e.items.Item.phb-potion'
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${type}` })
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, wis: 1 }, skills: { prc: { ability: 'wis' } }, hp: { value: 30, max: 38, temp: 0 } }, {
  ac: 16,
  items: [
    {
      id: 'longsword', name: 'Longsword', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true, weight: { value: 3, units: 'lb' } },
      activities: [{ id: 'slash', damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+5', damage: [hits('1d8 + 3', 'slashing')] } }],
    },
    { id: 'flask', name: 'Potion of Healing', type: 'consumable', _stats: { compendiumSource: POTION }, system: { quantity: 1, identified: true, weight: { value: 0.5, units: 'lb' } } },
  ],
})
thorin.system.details = { level: 5 }
thorin.system.skills.prc.total = 4
thorin.system.skills.prc.passive = 14
thorin.system.attributes.init.total = 1
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
embedded(thorin, { currency: { gp: 15 } })
embedded(vex, { currency: { gp: 10 } })
const company = group('company', 'The Iron Company', { members: [thorin, vex], ownership: { alice: 3, bob: 2 }, currency: { gp: 120, sp: 7 } })
embedded(company, {
  items: [
    { _id: 'potion', name: 'Potion of Healing', type: 'consumable', _stats: { compendiumSource: POTION }, system: { quantity: 3, identified: true, description: { value: '<p>Drink it.</p>' }, weight: { value: 0.5, units: 'lb' } } },
    { _id: 'rope', name: 'Rope', type: 'loot', system: { quantity: 1, identified: true, weight: { value: 10, units: 'lb' } } },
    { _id: 'backpack', name: 'Backpack', type: 'container', system: { quantity: 1, identified: true, capacity: { count: 10 }, weight: { value: 5, units: 'lb' } } },
    { _id: 'bedroll', name: 'Bedroll', type: 'loot', system: { quantity: 1, identified: true, container: 'backpack', weight: { value: 7, units: 'lb' } } },
    {
      _id: 'vial', name: 'Potion of Giant Strength', type: 'consumable', _stats: { compendiumSource: 'Compendium.dnd5e.items.Item.dmg-giant-strength' },
      system: { quantity: 1, identified: false, unidentified: { name: 'Strange Vial', description: '<p>A cloudy vial.</p>' }, description: { value: '<p>Your Strength becomes 21.</p>' } },
    },
    { _id: 'opal', name: 'Fire Opal', type: 'loot', system: { quantity: 5, identified: true } },
  ],
})
// The Silent Order, which neither player's user may see.
const order = group('order', 'The Silent Order', { members: [vex], ownership: {} })
embedded(order, { items: [{ _id: 'seal', name: 'Signet of the Order', type: 'loot', system: { quantity: 1, identified: true } }] })
Object.defineProperty(actors, 'party', { get: () => actors.get('company') ?? null, configurable: true })
const campaign = changes => ({ id: 'camp-iron', title: TITLE, characters: ['thorin', 'vex'], groups: ['company', 'order'], rolls: false, ...changes })

await startModule({ campaigns: [campaign()], secrets: { 'camp-iron': SECRET } })
await settled()
const firstHello = postsOf('bridge.hello')[0]
const enabled = () => sql(`select "transfersEnabled" from campaign where id = '${A}'`) === 't'
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }
/** A move posted as a page would post it, through a seat's API. */
const crafted = (who, api, transfer) => call(who.page, `${api}/rolls`, { method: 'POST', body: { kind: 'transfer', transfer, ...PLAIN } })
/** The campaign's moves, as the app keeps them: every one this suite made. */
const moves = () => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, role, "actorId", label, status, payload, result, "createdAt" from roll_request where "campaignId" = '${A}' and kind = 'transfer') r`))
/** The lines Foundry's chat has of moves: their text, speaker, author and the module's flags. */
const lineTexts = () => [...W.messages.values()].filter(m => /^<p>(Takes|Gives) /.test(m.content ?? ''))
  .map(m => ({ text: m.content.slice(3, -4), actor: m.speaker?.actor, author: m.author?.id ?? m.author, by: m.flags?.['sending-stone']?.by ?? null, whisper: m.whisper ?? [], id: m.id }))
/** Every item an actor's inventory lists, at any depth: [name, quantity]. */
const listed = inventory => [...(inventory?.sections ?? []).flatMap(s => s.items), ...(inventory?.containers ?? [])]
  .flatMap(function flat(item) { return [item, ...(item.contents ?? []).flatMap(flat)] })
/** How many of an item an inventory lists, as sent: the slim format leaves out a quantity of 1. */
const quantityIn = (inventory, name) => { const it = listed(inventory).find(i => i.name === name); return it && (it.quantity ?? 1) }
const holding = (actor, name) => [...actor.items].filter(it => it.name === name)
/** Once a move is answered, as the app keeps it. */
async function answered(count, what) {
  await until(() => moves().length >= count && ['done', 'failed'].includes(moves()[count - 1].status), what, 30_000)
  const made = moves()[count - 1]
  // The app keeps the result before the module hears that it did.
  await until(() => postsOf('command.result').some(p => p.data?.id === made.id), `${what}: its result as posted`, 10_000)
  return made
}

if (NEW) {
  check(same(firstHello.data.features.transfers, { enabled: false, kinds: [], reason: 'off', partySends: false, distribute: false }),
    `1. off by default: the hello says ${JSON.stringify(firstHello.data.features.transfers)}`)
} else {
  check(!('transfers' in (firstHello.data.features ?? {})), `module 0.30.0's hello says nothing of moves (${JSON.stringify(Object.keys(firstHello.data.features ?? {}))})`)
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

const panelOf = who => who.page.getByRole('dialog', { name: 'The Iron Company' })
const takes = scope => scope.locator('button[aria-label^="Take "]')
const tray = who => who.page.getByRole('region', { name: 'Your rolls' }).getByRole('status')
const statusIn = scope => scope.getByRole('status').filter({ hasText: /Took|took|Not taken|Partly taken|Taking|Sending/ })
/** The Iron Company's panel, opened from the Inventory tab's party list ("Party" for a player, "Parties" for the Gamemaster). */
async function openParty(who) {
  await who.party('The Iron Company')
  const panel = panelOf(who)
  await panel.getByRole('tab', { name: 'Inventory' }).waitFor({ timeout: 15_000 })
  return panel
}
/** An item's row on a character's sheet, opened: an action's by its button, any other's by its summary. */
async function openRow(who, name) {
  const scope = who.page.getByRole('tabpanel')
  const action = scope.getByRole('button', { name: new RegExp(`^${name}`), expanded: false }).first()
  if (await action.count()) {
    await action.click()
    return scope
  }
  if (await scope.getByRole('button', { name: new RegExp(`^${name}`), expanded: true }).count()) return scope
  // Left open, it stays open: a tap on its summary would close it.
  const details = scope.locator('details').filter({ has: who.page.locator('summary', { hasText: name }) }).first()
  if (!(await details.evaluate(el => el.open))) await details.locator('summary').first().click()
  return scope
}
const card = async who => {
  await who.page.goto(`${BASE}/campaigns`)
  const article = who.page.getByRole('article', { name: TITLE })
  await article.waitFor()
  return article
}
const MOVES_OFF = 'Players can’t move items and coins from here. To let them, tick Players move items and coins on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
const MOVES_OLD = 'Players can’t move items and coins from here. Sending Stone 0.31.0 or later in Foundry lets them.'
const MOVES_ON = 'Your players take from and give to the parties they own in Foundry, and give to each other, from here. Each move is made in your game at once and posts a line in its chat.'
const movesSection = article => article.locator('section').filter({ has: article.page().locator('h4', { hasText: 'Items and coins' }) })

// =================================================================================================
// 1. Off by default
// =================================================================================================
part('1. off by default')
let panel = await openParty(alice)
await panel.getByText('Potion of Healing').first().waitFor({ timeout: 15_000 })
check(await takes(panel).count() === 0, "Alice's party panel has no Take")
await panel.getByRole('button', { name: 'Close' }).click()
await alice.tab('Inventory')
await openRow(alice, 'Potion of Healing')
check(await alice.page.getByRole('button', { name: /^Give/ }).count() === 0 && await alice.page.getByRole('button', { name: /^Send to/ }).count() === 0,
  'and her Inventory no Give… nor Send to, in an opened item or on her Currency row')
{
  const refused = await crafted(alice, ALICE_API, { from: 'company', to: 'thorin', items: [{ id: 'rope', quantity: 1 }] })
  check(refused.status === 409 && refused.json?.reason === 'unavailable', `a crafted move is turned down: ${refused.status} ${refused.json?.reason}`)
}
const gm = await browse({ width: 390, height: 844, toasts: false })
{
  const article = await card(gm)
  const text = await movesSection(article).locator('p').textContent()
  check(text === (SKEW030 ? MOVES_OLD : MOVES_OFF), `the campaign card's "Items and coins": "${text}"`)
  if (NEW) await shootBoth(gm, 'campaign-moves-off', movesSection(article))
}

if (SKEW030) {
  part('16. module 0.30.0')
  await wait(4000)
  panel = await openParty(alice)
  await panel.getByText('Potion of Healing').first().waitFor({ timeout: 15_000 })
  check(await takes(panel).count() === 0 && !enabled(), 'with module 0.30.0, no Take on the party panel, and the app keeps moves off')
  await panel.getByRole('button', { name: 'Close' }).click()
  const refused = await crafted(alice, ALICE_API, { from: 'company', to: 'thorin', currency: { gp: 1 } })
  check(refused.status === 409 && refused.json?.reason === 'unavailable', `a crafted move: ${refused.status} ${refused.json?.reason}`)
  const article = await card(gm)
  await article.locator('summary', { hasText: 'Foundry settings' }).click()
  await article.getByRole('heading', { name: 'Versions' }).waitFor()
  const rows = await article.locator('details dt').allTextContents()
  check(!rows.includes('Hit/miss and save results in the app') && !rows.includes('Players move items and coins'),
    `and its Foundry settings have no row of the results setting or of moves (${JSON.stringify(rows)})`)
  // A campaign switched on under 0.31.0, the module then rolled back: 0.30.0 says nothing of it.
  const hellos = postsOf('bridge.hello').length
  await game.settings.set('sending-stone', 'campaigns', [campaign({ transfers: true })])
  await until(() => postsOf('bridge.hello').length > hellos, 'the hello again', 15_000)
  await settled()
  const refusedAgain = await crafted(alice, ALICE_API, { from: 'company', to: 'thorin', currency: { gp: 1 } })
  check(!('transfers' in (postsOf('bridge.hello').at(-1).data.features ?? {})) && !enabled() && refusedAgain.status === 409 && refusedAgain.json?.reason === 'unavailable',
    `with the campaign's switch on as 0.31.0 stores it, module 0.30.0's hello still says nothing of moves, and a crafted move is still ${refusedAgain.status} ${refusedAgain.json?.reason}`)
  await finish()
}

// =================================================================================================
// 2. Turned on in Manage Campaigns
// =================================================================================================
part('2. turned on')
const { click, find, openSettings, save, tick, view } = windowApp
/** The window as Foundry draws it, with the module's styles, each box ticked as it is now. */
const windowTab = await (await browse({ width: 900, height: 900 })).view.newPage()
async function shootWindow(win, name) {
  if (!SHOTS) return
  const styles = readFileSync(`${MODULE}/styles/sending-stone.css`, 'utf8')
  const copy = win.element.cloneNode(true)
  const boxes = [...win.element.querySelectorAll('input')]
  copy.querySelectorAll('input').forEach((box, index) => box.toggleAttribute('checked', boxes[index].checked))
  await windowTab.setContent(`<!doctype html><style>${styles} body { font: 14px sans-serif; background: #f2efe6; color: #191813; padding: 12px; width: 860px }</style>${copy.outerHTML}`)
  await windowTab.waitForTimeout(200)
  await windowTab.locator('#sending-stone-settings').screenshot({ path: `${SHOTS}/${name}${VARIANT}.png` })
}
let hellos = postsOf('bridge.hello').length
{
  const win = await openSettings()
  await view(win, 'campaign', { campaignId: 'camp-iron', tab: 'actions' })
  const box = find(win, '[name="campaign.transfers"]')
  const label = find(win, 'label[for="sending-stone-transfers"]').textContent.trim()
  check(label === 'Players move items and coins' && box.type === 'checkbox' && !box.checked && !box.disabled,
    `Manage Campaigns' Player actions tab has "${label}", unticked`)
  tick(win, 'campaign.transfers', true)
  await shootWindow(win, 'manage-campaigns-transfers')
  await save(win)
}
const switchedAt = Date.now()
// Saving sends a hello for each setting it changes: the campaigns' last.
const helloOn = () => postsOf('bridge.hello').slice(hellos).find(p => p.data.features?.transfers?.enabled === true)
await until(() => helloOn(), 'a hello saying moves are made', 15_000).catch(() => {})
const onHello = helloOn() ?? postsOf('bridge.hello').at(-1)
check(same(onHello.data.features.transfers, { enabled: true, kinds: ['transfer'], reason: null, partySends: true, distribute: true }) && onHello.data.features.rolls.enabled === false,
  `ticked and saved, the hello says moves are made, rolls still off: ${JSON.stringify(onHello.data.features.transfers)}`)
await until(() => enabled(), 'the app to take moves', 15_000)
await until(() => helloAnswers.some(t => t >= switchedAt), "the hello's answer", 15_000)
{
  const answeredAt = helloAnswers.find(t => t >= switchedAt)
  await wait(1500)
  const since = posted.filter(p => p.url.endsWith('/api/bridge/commands') && posted.indexOf(p) >= posted.indexOf(onHello) - 5)
  const waited = since.filter(p => { try { return JSON.parse(p.body).wait >= 60_000 } catch { return false } })
  const woken = fetchStarts.some(t => (t >= answeredAt - 20) && (t - answeredAt < 3000))
  check((waited.length === 0 || woken) && fetchStarts.some(t => t >= switchedAt),
    `the module fetches for moves with rolls off, and no 60 s wait holds it after the hello's answer (${waited.length} answered with a wait, ${woken ? 'a fetch began' : 'none began'} within 3 s of the answer)`)
}
let at = Date.now()
panel = await openParty(alice)
await panel.getByRole('button', { name: 'Take Rope' }).waitFor({ timeout: 15_000 })
await panel.getByRole('button', { name: 'Take coins from The Iron Company' }).waitFor({ timeout: 5_000 })
check(Date.now() - at < 3000 + 5000 && await takes(panel).count() >= 5,
  `within a poll, Alice's party rows each have Take ("Take Rope"), and her coin "Take coins from The Iron Company" (${Date.now() - at} ms)`)
await shootBoth(alice, 'party-take', panel)
await panel.getByRole('button', { name: 'Close' }).click()
{
  const bobPanel = await openParty(bob)
  await bobPanel.getByText('Potion of Healing').first().waitFor({ timeout: 15_000 })
  await wait(3500)
  check(await takes(bobPanel).count() === 0, 'Bob, who only observes the Company, sees its sheet with no Take')
  await bobPanel.getByRole('button', { name: 'Close' }).click()
  await bob.tab('Inventory')
  await bob.currency(bob.page.getByRole('tabpanel')).getByRole('button', { name: 'Send to', exact: true }).click()
  const dialog = bob.page.getByRole('dialog', { name: 'Give coins' })
  await dialog.waitFor()
  check(await dialog.getByRole('group', { name: 'Parties' }).count() === 0 && same(await dialog.getByRole('group', { name: 'Characters' }).getByRole('radio').evaluateAll(rs => rs.map(r => r.closest('label').textContent.trim())), ['Thorin']),
    "his Give coins lists Thorin under Characters, and no Parties")
  await dialog.getByRole('button', { name: 'Cancel' }).click()
}
{
  const article = await card(gm)
  await until(async () => (await movesSection(article).locator('p').textContent()) === MOVES_ON, 'the card to say moves are on', 10_000)
  check(true, `the card: "${MOVES_ON}"`)
  await shootBoth(gm, 'campaign-moves-on', movesSection(article))
}

// =================================================================================================
// 3. Part of a stack, into her own (#212)
// =================================================================================================
part('3. part of a stack')
panel = await openParty(alice)
await panel.getByRole('button', { name: 'Take Potion of Healing' }).click()
let dialog = alice.page.getByRole('dialog', { name: 'Take Potion of Healing' })
await dialog.waitFor()
check(await dialog.getByText('From The Iron Company', { exact: true }).isVisible() && await dialog.getByRole('textbox', { name: 'How many' }).inputValue() === '1',
  'Take Potion of Healing opens "Take Potion of Healing", "From The Iron Company", one to take')
await dialog.getByRole('button', { name: 'One more' }).click()
const summary = d => d.locator('p[aria-live="polite"]').textContent()
check(await dialog.getByRole('button', { name: 'Take 2' }).isVisible() && await summary(dialog) === 'You take 2 Potion of Healing from The Iron Company.'
  && await dialog.getByText('Foundry’s chat will say so.').isVisible(),
  `one more: "Take 2", and "${await summary(dialog)}"`)
await shootBoth(alice, 'take-dialog', dialog)
let before = posted.length
await dialog.getByRole('button', { name: 'Take 2' }).click()
check(await dialog.count() === 0 || !(await dialog.isVisible()), 'the dialog closes at once')
let made = await answered(1, 'the take of two potions')
{
  const thorinPotions = holding(thorin, 'Potion of Healing')
  check(made.status === 'done' && company.items.get('potion').system.quantity === 1 && thorinPotions.length === 1 && thorinPotions[0].id === 'flask' && thorinPotions[0].system.quantity === 3
    && sameJson(made.result.transfer.items, [{ id: 'potion', quantity: 2, created: null, stacked: 'flask' }]),
    `the party has 1 left; Thorin's own stack, the same row, has 3 (${JSON.stringify(made.result.transfer)}; ${company.items.get('potion').system.quantity} and ${JSON.stringify(thorinPotions.map(p => [p.id, p.system.quantity]))})`)
  const [line] = lineTexts()
  check(same(line && { ...line, id: undefined }, { text: 'Takes 2 Potion of Healing from The Iron Company', actor: 'thorin', author: 'alice', by: null, whisper: [], id: undefined }) && made.result.messageId === line.id,
    `Foundry's chat: "${line?.text}", spoken by Thorin, for everyone`)
  const result = postsOf('command.result').find(p => p.data.id === made.id)
  const resultAt = posted.indexOf(result)
  const groupAt = posted.findIndex((p, i) => i >= before && i < resultAt && p.type === 'group.updated' && p.data.group.id === 'company'
    && quantityIn(p.data.group.sheet?.inventory, 'Potion of Healing') === 1)
  const charAt = posted.findIndex((p, i) => i >= before && i < resultAt && p.type === 'character.updated' && p.data.character.id === 'thorin'
    && quantityIn(p.data.character.sheet?.inventory, 'Potion of Healing') === 3)
  if (groupAt < 0) note(JSON.stringify(posted.slice(before, resultAt + 1).map((p, i) => [before + i, p.type, p.type === 'group.updated' ? [p.data.group.id, Object.keys(p.data.group.sheet ?? {}), listed(p.data.group.sheet?.inventory).map(it => [it.name, it.quantity])] : p.data?.character?.id ?? p.data?.id])))
  check(groupAt >= 0 && charAt > groupAt && resultAt > charAt, `posted: the party's sheet (${groupAt}), then Thorin's (${charAt}), then the result (${resultAt})`)
  check(!JSON.stringify(result.data.transfer).includes('Potion'), 'and the result names nothing')
}
await statusIn(panel).filter({ hasText: 'Took 2 Potion of Healing from The Iron Company' }).waitFor({ timeout: 10_000 })
check(true, 'the panel says "Took 2 Potion of Healing from The Iron Company"')
await until(async () => quantityIn((await call(alice.page, `${ALICE_API}/table`)).json?.sheet?.inventory, 'Potion of Healing') === 3
  && quantityIn((await call(alice.page, `${ALICE_API}/party/company`)).json?.sheet?.inventory, 'Potion of Healing') === 1, 'both sheets in the app', 15_000)
check(true, "in the app, Thorin's sheet has 3 Potions of Healing, the party's 1")
await shoot(alice, 'take-status', panel)
async function chatHas(who, api, text, speaker) {
  await until(async () => (await call(who.page, `${api}/table`)).json?.messages?.some(m => (m.speaker === speaker) && (m.text ?? '').includes(text)), `"${text}" in the app's chat`, 15_000)
  return true
}
check(await chatHas(alice, ALICE_API, 'Takes 2 Potion of Healing from The Iron Company', 'Thorin') && await chatHas(bob, BOB_API, 'Takes 2 Potion of Healing from The Iron Company', 'Thorin'),
  "the app's chat shows it to Alice and to Bob, as Thorin's")
await panel.getByRole('button', { name: 'Close' }).click()
await bob.chat()
{
  const row = bob.log.locator(':scope > li').filter({ hasText: 'Takes 2 Potion of Healing from The Iron Company' })
  await row.waitFor({ timeout: 15_000 })
  check((await row.textContent()).includes('Thorin'), "on Bob's page, the line, by Thorin")
  await shootBoth(bob, 'chat-move-line', row)
}
await bob.character()

// =================================================================================================
// 4. A container, with what it holds
// =================================================================================================
part('4. a container')
panel = await openParty(alice)
await panel.getByRole('button', { name: 'Take Backpack' }).click()
dialog = alice.page.getByRole('dialog', { name: 'Take Backpack' })
await dialog.waitFor()
check(await dialog.getByRole('textbox', { name: 'How many' }).count() === 0 && await dialog.getByText('Everything in it goes too.').isVisible(),
  'Take Backpack: no amount to choose, and "Everything in it goes too."')
let writesBefore = writes.length
await dialog.getByRole('button', { name: 'Take', exact: true }).click()
made = await answered(2, 'the take of the Backpack')
{
  const pack = holding(thorin, 'Backpack')[0]
  const roll = holding(thorin, 'Bedroll')[0]
  const deletes = writes.slice(writesBefore).filter(([kind, id]) => kind === 'delete' && id === 'company')
  check(made.status === 'done' && pack && roll && pack.id !== 'backpack' && roll.id !== 'bedroll' && roll.system.container === pack.id && pack.system.container == null
    && !company.items.get('backpack') && !company.items.get('bedroll') && same(deletes.map(([, , ids]) => ids), [['backpack', 'bedroll']]),
    `Thorin's Backpack holds the Bedroll, both new, and the party's both went in one deletion (${JSON.stringify(deletes)})`)
  check(lineTexts().at(-1).text === 'Takes 1 Backpack from The Iron Company' && same(made.result.transfer.items.map(i => i.id), ['backpack']),
    `one line, "${lineTexts().at(-1).text}", and the result lists the Backpack alone`)
}
await panel.getByRole('button', { name: 'Close' }).click()

// =================================================================================================
// 5. Coins (#213)
// =================================================================================================
part('5. coins')
panel = await openParty(alice)
await panel.getByRole('button', { name: 'Take coins from The Iron Company' }).click()
dialog = alice.page.getByRole('dialog', { name: 'Take coins' })
await dialog.waitFor()
check(await dialog.getByText('From The Iron Company', { exact: true }).isVisible() && (await dialog.getByRole('group', { name: 'Coins' }).textContent()).includes('of 120 gp'),
  '"Take coins", from the party, "of 120 gp"')
await dialog.getByRole('textbox', { name: 'Gold' }).fill('50')
await shootBoth(alice, 'take-coins-dialog', dialog)
await dialog.getByRole('button', { name: 'Take coins' }).click()
made = await answered(3, 'the take of 50 gp')
check(made.status === 'done' && company.system.currency.gp === 70 && thorin.system.currency.gp === 65 && lineTexts().at(-1).text === 'Takes 50 gp from The Iron Company',
  `the party has 70 gp, Thorin 65, and the line "${lineTexts().at(-1).text}"`)
// Once the open panel has the party's coin as it now is.
await until(async () => /^70\s*gp$/.test((await panel.locator('li[title="Gold"]').first().textContent())?.trim() ?? ''), 'the panel to show 70 gp', 15_000)
await panel.getByRole('button', { name: 'Take coins from The Iron Company' }).click()
dialog = alice.page.getByRole('dialog', { name: 'Take coins' })
await dialog.waitFor()
await dialog.getByRole('textbox', { name: 'Gold' }).fill('1000')
{
  const count = moves().length
  // Tapped all the same, as it can be: aria-disabled, it does nothing.
  await dialog.getByRole('button', { name: 'Take coins' }).click({ force: true })
  await wait(1000)
  const alert = await dialog.getByRole('alert').textContent()
  check(alert === 'Enter a whole number up to 70.' && await dialog.getByRole('button', { name: 'Take coins' }).getAttribute('aria-disabled') === 'true' && moves().length === count,
    `typing 1000: "${alert}", and nothing is sent`)
  await shootBoth(alice, 'take-coins-refused', dialog)
}
await dialog.getByRole('button', { name: 'Cancel' }).click()
await panel.getByRole('button', { name: 'Close' }).click()

// =================================================================================================
// 6. Give an equipped item (#214)
// =================================================================================================
part('6. give to the party')
await alice.tab('Inventory')
let sheet = await openRow(alice, 'Longsword')
await sheet.getByRole('button', { name: 'Give Longsword' }).click()
dialog = alice.page.getByRole('dialog', { name: 'Give Longsword' })
await dialog.waitFor()
{
  const radios = await dialog.getByRole('radio').evaluateAll(rs => rs.map(r => [r.closest('[role="group"]').getAttribute('aria-labelledby') && document.getElementById(r.closest('[role="group"]').getAttribute('aria-labelledby')).textContent, r.closest('label').textContent.trim(), r.checked]))
  check(same(radios, [['Parties', 'The Iron Company Primary', true], ['Characters', 'Vex', false]]) && await dialog.getByText('It arrives unequipped and unattuned.').isVisible()
    && await summary(dialog) === 'You give 1 Longsword to The Iron Company.',
    `"To" has The Iron Company (Primary) chosen, then Vex; "It arrives unequipped and unattuned." (${JSON.stringify(radios)})`)
}
await shootBoth(alice, 'give-dialog', dialog)
await dialog.getByRole('button', { name: 'Give', exact: true }).click()
made = await answered(4, 'the give of the Longsword')
{
  const sword = holding(company, 'Longsword')[0]
  check(made.status === 'done' && sword && sword.system.equipped !== true && holding(thorin, 'Longsword').length === 0 && lineTexts().at(-1).text === 'Gives 1 Longsword to The Iron Company'
    && lineTexts().at(-1).actor === 'thorin',
    `the party's Longsword isn't equipped, Thorin has none, and the line "${lineTexts().at(-1).text}"`)
}
await tray(alice).getByText('Gave 1 Longsword to The Iron Company').waitFor({ timeout: 15_000 })
// Rolls are off, but a move is made in the game all the same: nothing beneath it says it isn't.
check(!(await alice.page.getByRole('region', { name: 'Your rolls' }).textContent()).includes('Only you see these rolls'),
  'her tray: "Gave 1 Longsword to The Iron Company", with nothing beneath it saying it wasn\'t sent to the game')
await shootBoth(alice, 'give-tray', alice.page.getByRole('region', { name: 'Your rolls' }))
{
  const view = await call(alice.page, `${ALICE_API}/party/company`)
  const sword = listed(view.json?.sheet?.inventory).find(it => it.name === 'Longsword')
  check(sword && sword.equipped !== true, `and the party's sheet in the app has it, not equipped (${JSON.stringify(sword && { equipped: sword.equipped })})`)
}

// =================================================================================================
// 7. Send to another character (#215)
// =================================================================================================
part('7. send')
const tablet = await browse({ width: 768, height: 1024, scheme: 'dark', path: '/characters/sheet-thorin' })
await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await tablet.tab('Inventory')
sheet = await openRow(tablet, 'Potion of Healing')
await sheet.getByRole('button', { name: 'Give Potion of Healing' }).click()
dialog = tablet.page.getByRole('dialog', { name: 'Give Potion of Healing' })
await dialog.waitFor()
await dialog.getByRole('radio', { name: /^Vex/ }).check({ force: true })
check(await summary(dialog) === 'You give 1 Potion of Healing to Vex.' && await dialog.getByRole('textbox', { name: 'How many' }).inputValue() === '1',
  `to Vex: "${await summary(dialog)}"`)
await shootBoth(tablet, 'give-dialog', dialog)
await dialog.getByRole('button', { name: 'Give', exact: true }).click()
made = await answered(5, 'the send of a potion to Vex')
check(made.status === 'done' && holding(vex, 'Potion of Healing')[0]?.system.quantity === 1 && thorin.items.get('flask').system.quantity === 2
  && lineTexts().at(-1).text === 'Gives 1 Potion of Healing to Vex' && lineTexts().at(-1).actor === 'thorin',
  `Vex has a Potion of Healing, of no one's owning but Bob's, and the line "${lineTexts().at(-1).text}"`)
{
  const toast = tablet.page.getByRole('log', { name: 'Roll results' })
  await toast.getByText('Gave 1 Potion of Healing to Vex').waitFor({ timeout: 15_000 })
  check(true, 'the tablet\'s toast: "Gave 1 Potion of Healing to Vex"')
  await shoot(tablet, 'give-toast')
}
await until(async () => listed((await call(bob.page, `${BOB_API}/table`)).json?.sheet?.inventory).some(it => it.name === 'Potion of Healing'), "Vex's sheet with the potion", 15_000)
check(true, "Bob's sheet of Vex gains it")
await bob.tab('Inventory')
await bob.currency(bob.page.getByRole('tabpanel')).getByRole('button', { name: 'Send to', exact: true }).click()
dialog = bob.page.getByRole('dialog', { name: 'Give coins' })
await dialog.waitFor()
check(await summary(dialog) === 'Choose who gets it.' && await dialog.getByRole('button', { name: 'Give coins' }).getAttribute('aria-disabled') === 'true',
  'Bob\'s Give coins: no one is chosen for him, "Choose who gets it."')
await dialog.getByRole('radio', { name: /^Thorin/ }).check({ force: true })
await dialog.getByRole('textbox', { name: 'Gold' }).fill('5')
await dialog.getByRole('button', { name: 'Give coins' }).click()
made = await answered(6, "Bob's 5 gp to Thorin")
check(made.status === 'done' && vex.system.currency.gp === 5 && thorin.system.currency.gp === 70
  && same({ ...lineTexts().at(-1), id: undefined }, { text: 'Gives 5 gp to Thorin', actor: 'vex', author: 'bob', by: null, whisper: [], id: undefined }),
  `Bob sends Thorin 5 gp: "${lineTexts().at(-1).text}", spoken by Vex`)
await tray(bob).getByText('Gave 5 gp to Thorin').waitFor({ timeout: 15_000 })

// =================================================================================================
// 8. Unidentified
// =================================================================================================
part('8. unidentified')
panel = await openParty(alice)
await panel.getByRole('button', { name: 'Take Strange Vial' }).click()
dialog = alice.page.getByRole('dialog', { name: 'Take Strange Vial' })
await dialog.waitFor()
await dialog.getByRole('button', { name: 'Take', exact: true }).click()
made = await answered(7, 'the take of the Strange Vial')
{
  const vial = holding(thorin, 'Strange Vial')[0]
  check(made.status === 'done' && vial && vial.system.identified === false && vial._source.name === 'Potion of Giant Strength' && lineTexts().at(-1).text === 'Takes 1 Strange Vial from The Iron Company',
    `the line says "${lineTexts().at(-1).text}", and Thorin's copy is still unidentified`)
  const views = await Promise.all([[alice, `${ALICE_API}/table`], [alice, `${ALICE_API}/party/company`], [bob, `${BOB_API}/table`], [bob, `${BOB_API}/party/company`]].map(([who, path]) => call(who.page, path)))
  const sent = JSON.stringify(posted.map(p => p.data))
  const lines = [...W.messages.values()].map(m => m.content).join(' ')
  check(!sent.includes('Giant Strength') && views.every(v => v.status === 200 && !v.text.includes('Giant Strength')) && !lines.includes('Giant Strength')
    && !sql(`select coalesce(string_agg(data::text, ''), '') from actor_sheet where "campaignId" = '${A}'`).includes('Giant Strength'),
    'its true name is in nothing the app was sent, no view of either player\'s, and no line in Foundry\'s chat')
}
await panel.getByRole('button', { name: 'Close' }).click()

// =================================================================================================
// 9. Refused
// =================================================================================================
part('9. refused')
{
  const notOwner = await crafted(bob, BOB_API, { from: 'company', to: 'vex', items: [{ id: 'rope', quantity: 1 }] })
  check(notOwner.status === 422 && notOwner.json?.reason === 'not-owner', `Bob's crafted take of the Rope: ${notOwner.status} ${notOwner.json?.reason}`)
  const unknown = await crafted(bob, BOB_API, { from: 'order', to: 'vex', items: [{ id: 'seal', quantity: 1 }] })
  check(unknown.status === 422 && unknown.json?.reason === 'unknown', `from The Silent Order, which he can't see: ${unknown.status} ${unknown.json?.reason}`)
  const notYours = await crafted(bob, BOB_API, { from: 'thorin', to: 'vex', currency: { gp: 1 } })
  check(notYours.status === 422 && notYours.json?.reason === 'not-yours', `from Thorin's coin: ${notYours.status} ${notYours.json?.reason}`)
  // The first is held in the game at its first write, so it's still on its way as the second is sent.
  const hold = holdWrite((kind, target) => [target.id, target.actor?.id].some(id => ['company', 'thorin'].includes(id)))
  const first = await crafted(alice, ALICE_API, { from: 'company', to: 'thorin', currency: { gp: 1 } })
  await Promise.race([hold.held, wait(20_000)])
  const second = await crafted(alice, ALICE_API, { from: 'company', to: 'thorin', currency: { gp: 1 } })
  hold.release()
  check(first.status === 202 && second.status === 409 && second.json?.reason === 'moving', `two identical moves back to back: ${first.status}, then ${second.status} ${second.json?.reason}`)
  made = await answered(8, 'the first of the two')
  check(made.status === 'done' && company.system.currency.gp === 69 && moves().length === 8, 'the first is made, once')
}
{
  // A give of more than is left: Thorin's stack goes down to one in Foundry while the dialog is open.
  await alice.tab('Inventory')
  sheet = await openRow(alice, 'Potion of Healing')
  await sheet.getByRole('button', { name: 'Give Potion of Healing' }).click()
  dialog = alice.page.getByRole('dialog', { name: 'Give Potion of Healing' })
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'All 2' }).click()
  await thorin.items.get('flask').update({ 'system.quantity': 1 })
  await until(async () => listed((await call(alice.page, `${ALICE_API}/table`)).json?.sheet?.inventory).find(it => it.name === 'Potion of Healing')?.quantity === 1, 'his sheet with one potion', 15_000)
  await dialog.getByRole('button', { name: 'Give 2' }).click()
  await tray(alice).getByText('Not given: you haven’t that many').waitFor({ timeout: 15_000 })
  check(moves().length === 8 && thorin.items.get('flask').system.quantity === 1
    && !(await alice.page.getByRole('region', { name: 'Your rolls' }).textContent()).includes('Only you see these rolls'),
    'two given of one left: the tray says "Not given: you haven’t that many", and nothing goes')
  await shootBoth(alice, 'give-refused-tray', alice.page.getByRole('region', { name: 'Your rolls' }))
}

// =================================================================================================
// 10. The race for the last Rope: two characters
// =================================================================================================
part('10. the race')
const gmParty = await browse({ width: 390, height: 844, path: `/campaigns/${A}/party/company` })
await gmParty.page.getByRole('button', { name: 'Take Rope' }).waitFor({ timeout: 20_000 })
{
  const linesBefore = lineTexts().length
  const hold = holdWrite((kind, target) => [target.id, target.actor?.id].some(id => ['company', 'thorin', 'vex'].includes(id)))
  panel = await openParty(alice)
  await panel.getByRole('button', { name: 'Take Rope' }).click()
  dialog = alice.page.getByRole('dialog', { name: 'Take Rope' })
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'Take', exact: true }).click()
  await Promise.race([hold.held, wait(20_000)])
  {
    const take = panel.getByRole('button', { name: 'Take Rope' })
    await until(async () => (await take.getAttribute('aria-busy')) === 'true', 'her Take Rope to wait', 10_000)
    // Since module 0.33.0's feedback, the party's row has the one spinner, beside the item's name.
    const row = await take.evaluate(button => {
      const li = button.closest('li')
      const name = li.querySelector('summary span.truncate, div span.truncate')
      const spinners = [...li.querySelectorAll('svg.motion-safe\\:animate-spin')]
      return { busy: li.getAttribute('aria-busy'), name: name?.textContent.trim(), spinners: spinners.length, right: spinners.length === 1 && !!name && spinners[0].getBoundingClientRect().left >= name.getBoundingClientRect().right - 0.5 }
    })
    check(await take.isDisabled() && await take.locator('svg').count() === 0 && row.spinners === 1 && row.right && row.name === 'Rope' && row.busy === 'true',
      `while it's being made, her Take Rope waits: disabled, busy, and the spinner beside its name (${JSON.stringify(row)})`)
  }
  await gmParty.page.getByRole('button', { name: 'Take Rope' }).click()
  const gmDialog = gmParty.page.getByRole('dialog', { name: 'Take Rope' })
  await gmDialog.waitFor()
  check(await summary(gmDialog) === 'Choose who gets it.' && await gmDialog.getByRole('button', { name: 'Take', exact: true }).getAttribute('aria-disabled') === 'true'
    && same(await gmDialog.getByRole('radio').evaluateAll(rs => rs.map(r => r.closest('label').textContent.trim())), ['Thorin', 'Vex']),
    'on the Gamemaster\'s party page, Take Rope asks who gets it, of Thorin and Vex')
  await gmDialog.getByRole('radio', { name: /^Vex/ }).check({ force: true })
  check(await summary(gmDialog) === 'Vex takes 1 Rope from The Iron Company.', `chosen: "${await summary(gmDialog)}"`)
  await shootBoth(gmParty, 'gm-take-dialog', gmDialog)
  const posting = gmParty.page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith(`${GM_API('vex')}/rolls`))
  await gmDialog.getByRole('button', { name: 'Take', exact: true }).click()
  await posting
  await until(() => moves().length === 10, 'both moves taken', 15_000)
  hold.release()
  const [mine, theirs] = [await answered(9, "Alice's take"), await answered(10, "the Gamemaster's take")]
  const ropes = [company, thorin, vex].flatMap(actor => holding(actor, 'Rope'))
  check(mine.status === 'done' && theirs.status === 'failed' && theirs.result.reason === 'gone' && theirs.role === 'gm' && theirs.actorId === 'vex' && mine.actorId === 'thorin'
    && lineTexts().length === linesBefore + 1 && ropes.length === 1 && ropes[0].actor === thorin && ropes[0].system.quantity === 1,
    `both sent while the first was being made, as two characters: Thorin's is made, the Gamemaster's into Vex finds it gone; one line, one Rope (${ropes.map(r => `${r.actor.name} ×${r.system.quantity}`)})`)
  await statusIn(gmParty.page).filter({ hasText: 'Not taken: it isn’t there any more' }).waitFor({ timeout: 15_000 })
  check(true, 'the party page says "Not taken: it isn’t there any more"')
  await shootBoth(gmParty, 'gm-take-refused')
  await panel.getByRole('button', { name: 'Close' }).click()
}

// =================================================================================================
// 11. The Gamemaster
// =================================================================================================
part('11. the Gamemaster')
const gmThorin = await browse({ width: 768, height: 1024, path: `/campaigns/${A}/characters/thorin`, toasts: false })
await gmThorin.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await gmThorin.tab('Inventory')
await gmThorin.currency(gmThorin.page.getByRole('tabpanel')).getByRole('button', { name: 'Send to', exact: true }).click()
dialog = gmThorin.page.getByRole('dialog', { name: 'Give coins' })
await dialog.waitFor()
{
  const radios = await dialog.getByRole('radio').evaluateAll(rs => rs.map(r => r.closest('label').textContent.trim()))
  check(same(radios, ['The Iron Company Primary', 'The Silent Order', 'Vex']), `on the Gamemaster's page of Thorin, Give coins lists every party and Vex (${JSON.stringify(radios)})`)
}
await dialog.getByRole('radio', { name: /^Vex/ }).check({ force: true })
await dialog.getByRole('textbox', { name: 'Gold' }).fill('5')
check(await summary(dialog) === 'Thorin gives 5 gp to Vex.', `"${await summary(dialog)}"`)
await shootBoth(gmThorin, 'gm-give-dialog', dialog)
await dialog.getByRole('button', { name: 'Give coins' }).click()
made = await answered(11, "the Gamemaster's 5 gp to Vex")
{
  const line = lineTexts().at(-1)
  const result = postsOf('command.result').find(p => p.data.id === made.id)?.data
  check(made.status === 'done' && made.role === 'gm' && made.label === 'Give 5 gp to Vex' && same({ ...line, id: undefined }, { text: 'Gives 5 gp to Vex', actor: 'thorin', author: 'alice', by: 'gm', whisper: [], id: undefined })
    && same(result?.messages, [line.id]) && vex.system.currency.gp === 10,
    `its line "${line.text}", Thorin's, flagged the Gamemaster's and listed in the result's messages`)
}
await tray(gmThorin).getByText('Thorin gave 5 gp to Vex').waitFor({ timeout: 15_000 })
check(true, 'the Gamemaster\'s tray: "Thorin gave 5 gp to Vex"')
await shootBoth(gmThorin, 'gm-give-tray', gmThorin.page.getByRole('region', { name: 'Your rolls' }))
await tray(alice).getByText('Give 5 gp to Vex').waitFor({ timeout: 15_000 })
await tray(alice).getByText('Moved at the table').waitFor({ timeout: 15_000 })
check((await tray(alice).textContent()).includes('Give 5 gp to Vex'), `Alice's page shows it among the Gamemaster's: "${await tray(alice).textContent()}"`)
// Another Rope, put in the party in Foundry; taken on the party page into Vex.
await company.createEmbeddedDocuments('Item', [{ _id: 'rope2', name: 'Rope', type: 'loot', system: { quantity: 1, identified: true } }])
await gmParty.page.getByRole('button', { name: 'Take Rope' }).waitFor({ timeout: 15_000 })
await gmParty.page.getByRole('button', { name: 'Take Rope' }).click()
dialog = gmParty.page.getByRole('dialog', { name: 'Take Rope' })
await dialog.waitFor()
await dialog.getByRole('radio', { name: /^Vex/ }).check({ force: true })
{
  const posting = gmParty.page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith(`${GM_API('vex')}/rolls`))
  await dialog.getByRole('button', { name: 'Take', exact: true }).click()
  await posting
}
made = await answered(12, "the Gamemaster's Rope into Vex")
check(made.status === 'done' && made.label === 'Take 1 Rope from The Iron Company' && same({ ...lineTexts().at(-1), id: undefined }, { text: 'Takes 1 Rope from The Iron Company', actor: 'vex', author: 'bob', by: 'gm', whisper: [], id: undefined })
  && holding(vex, 'Rope').length === 1,
  `chosen Vex, it's posted through /api/campaigns/…/characters/vex/rolls, and the line is Vex's: "${lineTexts().at(-1).text}"`)
await statusIn(gmParty.page).filter({ hasText: 'Vex took 1 Rope from The Iron Company' }).waitFor({ timeout: 15_000 })
check(true, 'the party page says "Vex took 1 Rope from The Iron Company"')
await shootBoth(gmParty, 'gm-take-status')

// =================================================================================================
// 12. Switched off with a dialog open
// =================================================================================================
part('12. switched off')
panel = await openParty(alice)
await panel.getByRole('button', { name: 'Take Fire Opal' }).click()
dialog = alice.page.getByRole('dialog', { name: 'Take Fire Opal' })
await dialog.waitFor()
hellos = postsOf('bridge.hello').length
await game.settings.set('sending-stone', 'campaigns', [campaign({ transfers: false })])
await until(() => postsOf('bridge.hello').length > hellos && !enabled(), 'the switch off to reach the app', 15_000)
at = Date.now()
await until(async () => (await takes(panel).count()) === 0, 'the Take buttons to go', 15_000)
check(Date.now() - at < 3000 + 5000 && await dialog.isVisible(), `the Take buttons go within a poll (${Date.now() - at} ms), and the open dialog stays`)
await dialog.getByRole('button', { name: 'Take', exact: true }).click()
await statusIn(panel).filter({ hasText: 'Not taken: your Gamemaster’s game isn’t taking moves now' }).waitFor({ timeout: 15_000 })
check(holding(company, 'Fire Opal')[0]?.system.quantity === 5, 'its Take says "Not taken: your Gamemaster’s game isn’t taking moves now"')
await shootBoth(alice, 'take-switched-off', panel)
await panel.getByRole('button', { name: 'Close' }).click()

// =================================================================================================
// 13. With rolls on too
// =================================================================================================
part('13. with rolls on')
hellos = postsOf('bridge.hello').length
await game.settings.set('sending-stone', 'campaigns', [campaign({ transfers: true, rolls: true })])
await until(() => postsOf('bridge.hello').length > hellos && enabled(), 'moves and rolls on', 15_000)
panel = await openParty(alice)
await panel.getByRole('button', { name: 'Take Fire Opal' }).waitFor({ timeout: 15_000 })
await panel.getByRole('button', { name: 'Take Fire Opal' }).click()
dialog = alice.page.getByRole('dialog', { name: 'Take Fire Opal' })
await dialog.waitFor()
await dialog.getByRole('button', { name: 'Take', exact: true }).click()
made = await answered(13, 'a take with rolls on')
check(made.status === 'done' && holding(company, 'Fire Opal')[0]?.system.quantity === 4 && holding(thorin, 'Fire Opal')[0]?.system.quantity === 1, 'with rolls on too, a Take is made')
await panel.getByRole('button', { name: 'Close' }).click()
// Her page as it is once the app has the hello's rolls: sent to the table.
await until(async () => (await call(alice.page, `${ALICE_API}/table`)).json?.rollsToTable?.includes('skill'), 'the app to take her rolls', 15_000)
await alice.page.reload()
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await alice.tab('Character')
const skill = () => JSON.parse(sql(`select coalesce((select row_to_json(r)::text from (select status from roll_request where "campaignId" = '${A}' and kind = 'skill' order by "createdAt" desc limit 1) r), 'null')`))
await alice.page.getByRole('button', { name: /^Perception check/ }).first().click()
await until(() => ['done', 'failed'].includes(skill()?.status), 'the Perception check made at the table', 60_000)
check(skill().status === 'done', `and a Perception check is still made at the table (${JSON.stringify(skill())})`)

// =================================================================================================
// 14. Every width, both themes
// =================================================================================================
part('14. layout')
for (const width of [360, 390, 768, 1280]) {
  await alice.page.setViewportSize({ width, height: width < 1024 ? 844 : 800 })
  alice.width = width
  for (const scheme of ['light', 'dark']) {
    await theme(alice, scheme)
    await alice.tab('Inventory')
    // The party rows and the Currency row's Send to, on her own Inventory: in view, nothing sideways.
    const fit = await alice.page.getByRole('tabpanel').evaluate(tab => {
      const inView = el => { const box = el.getBoundingClientRect(); return box.width > 0 && box.left >= 0 && box.right <= document.documentElement.clientWidth }
      const rows = [...tab.querySelectorAll('section[aria-labelledby="inventory-parties"] button')]
      const send = [...tab.querySelectorAll('[role="group"] button')].find(b => b.textContent.trim() === 'Send to')
      return { rows: rows.length, rowsFit: rows.every(inView), send: !!send && inView(send) }
    })
    const listWide = await sideways(alice.page)
    panel = await openParty(alice)
    await panel.getByRole('button', { name: 'Take Fire Opal' }).waitFor({ timeout: 15_000 })
    const rowWide = await sideways(alice.page)
    await shoot(alice, 'party-take', panel)
    await panel.getByRole('button', { name: 'Take Fire Opal' }).click()
    dialog = alice.page.getByRole('dialog', { name: 'Take Fire Opal' })
    await dialog.waitFor()
    const onTop = await dialog.getByRole('button', { name: 'One more' }).evaluate(button => {
      const box = button.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return !!hit && button.closest('dialog').contains(hit)
    })
    const fits = await dialog.evaluate(d => d.getBoundingClientRect().right <= document.documentElement.clientWidth && d.getBoundingClientRect().left >= 0)
    check(listWide === 0 && fit.rows === 1 && fit.rowsFit && fit.send && rowWide === 0 && await sideways(alice.page) === 0 && onTop && fits,
      `at ${width} px, ${scheme}: her Inventory's party row and the Currency row's Send to fit, the party row with Take and the dialog scroll nothing sideways, the dialog on top and within the screen (${JSON.stringify(fit)})`)
    await shoot(alice, 'move-dialog', dialog)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await panel.getByRole('button', { name: 'Close' }).click()
  }
}
await alice.page.setViewportSize({ width: 390, height: 844 })
alice.width = 390
await theme(alice, 'light')
{
  await alice.tab('Inventory')
  sheet = await openRow(alice, 'Potion of Healing')
  await sheet.getByRole('button', { name: 'Give Potion of Healing' }).click()
  dialog = alice.page.getByRole('dialog', { name: 'Give Potion of Healing' })
  await dialog.waitFor()
  await dialog.getByRole('radio', { name: /^The Iron Company/ }).focus()
  await alice.page.keyboard.press('ArrowDown')
  const chosen = await dialog.getByRole('radio', { checked: true }).evaluate(r => r.closest('label').textContent.trim())
  check(chosen === 'Vex' && await summary(dialog) === 'You give 1 Potion of Healing to Vex.', `in the dialog, the arrow keys move the "To" choice: ${chosen}`)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
}

// =================================================================================================
// 15. dnd5e 6.0.5's fractional coin
// =================================================================================================
if (DND5E6) {
  part('15. dnd5e 6.0.5')
  await company.update({ 'system.currency.gp': 10.5 })
  await until(async () => (await call(alice.page, `${ALICE_API}/party/company`)).json?.sheet?.inventory?.currency?.find(c => c.id === 'gp')?.value === 10, 'the party sheet with 10 gp', 15_000)
  panel = await openParty(alice)
  await panel.getByRole('button', { name: 'Take coins from The Iron Company' }).click()
  dialog = alice.page.getByRole('dialog', { name: 'Take coins' })
  await dialog.waitFor()
  check(company._source.system.currency.gp === 10.5 && (await dialog.getByRole('group', { name: 'Coins' }).textContent()).includes('of 10 gp'), 'the party holds 10.5 gp as stored: "of 10 gp"')
  await dialog.getByRole('textbox', { name: 'Gold' }).fill('11')
  check(await dialog.getByRole('alert').textContent() === 'Enter a whole number up to 10.', '11 is turned down in the dialog')
  const short = await crafted(alice, ALICE_API, { from: 'company', to: 'thorin', currency: { gp: 11 } })
  check(short.status === 422 && short.json?.reason === 'short', `and by the app, crafted: ${short.status} ${short.json?.reason}`)
  await dialog.getByRole('textbox', { name: 'Gold' }).fill('10')
  await dialog.getByRole('button', { name: 'Take coins' }).click()
  made = await answered(14, 'the take of 10 of 10.5 gp')
  check(made.status === 'done' && company._source.system.currency.gp === 0.5 && company.system.currency.gp === 0 && lineTexts().at(-1).text === 'Takes 10 gp from The Iron Company',
    `10 taken leaves 0.5 gp as stored (${company._source.system.currency.gp}), and the line "${lineTexts().at(-1).text}"`)
  await panel.getByRole('button', { name: 'Close' }).click()
}

check(lineTexts().every(line => same(line.whisper, [])), 'every line of a move is public')
note(`lines: ${JSON.stringify(lineTexts().map(l => l.text))}`)
await finish()
