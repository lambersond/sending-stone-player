// Coins added to a character, taken away and handed out from the app (module 0.49.0 and the app,
// ROADMAP items 67 and 68, and since item give the Currency row's Add or remove and one Give), end
// to end, in the world of world-030.mjs, whose coins carry dnd5e's rates. Ashlands, on dnd5e 5.3.3,
// has one campaign, Erebor, saved without the coins' switches, so both read on, with moves on and
// its players' rolls off: coins go on their own. Alice plays Thorin and runs the campaign; Bob plays
// Vex, and Carol's Bram has no page here. The hello and the app's answer, each coin's rate on the
// sheet; the Currency row's two buttons in their order, Add or remove and Give; 5 gp
// added, on the sheet, in Foundry's chat and the app's; 5 gp removed of 3 gp and 2 pp, a
// platinum broken, the dialog saying so first and the tray after; 2 gp of 1 gp and 40 sp, silver
// paying; more than the coins are worth held back in the dialog; the Gamemaster turning other
// coins off, the dialog saying so and a crafted request refused short; the Gamemaster adding at
// Thorin's page, marked as theirs; through Give, 2 gp each to Vex and Bram, each whispered their
// own, the Gamemasters the whole of it, Thorin's player reading all three and Vex's only his, and
// 1 gp to Vex alone, whispered the same way; the coins' switch off, Add or remove gone within a poll
// and Give still there, then moves off and it gone too; both dialogs at 360, 390, 768 and 1280 in
// both themes; Help's row and lines, and the Gamemaster's campaign card. DND5E6=1: on dnd5e 6.0.5,
// whose sheet shows whole coins. SKEW=047: module 0.47.0, which says nothing of coins: no button but
// Give, Help "Not from here", the
// card naming 0.49.0, and crafted requests refused. Synthetic characters only. Run with --import
// ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BOB, DND5E6, W, browse, call, character, check, coinsInFoundry, embedded, finish, foundryWorld, launch, newCampaign,
  note, part, postsOf, same, sameJson, settled, shootBoth, sideways, sql, startModule, until,
} from './world-030.mjs'

/** Module 0.47.0, before coins were added, taken away or handed out from the app. */
const OLD = process.env.SKEW === '047'
const GAME = 'https://ashlands-coins.forge-vtt.com'
const ADDRESS = 'ashlands-coins.forge-vtt.com'
const SECRET = 'erebor-coins-49'
const TITLE = 'Erebor'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: ADDRESS, secret: SECRET })
await foundryWorld({ dice6: DND5E6, more: true })
// A checkout's module.json carries its last release's version: the one this release stamps.
game.modules.get('sending-stone').version = OLD ? '0.47.0' : '0.49.0'

// ---- The world: Thorin, Alice's; Vex, Bob's; Bram, Carol's ----
const actor = (id, name, owner) => {
  const made = character({ id, name, owners: [owner], mods: { str: 2 }, hp: { value: 20, max: 20, temp: 0 } }, { ac: 14, items: [] })
  made.system.details = { level: 3 }
  game.users.get(owner).character = made
  return made
}
const thorin = actor('thorin', 'Thorin', 'alice')
const vex = actor('vex', 'Vex', 'bob')
const bram = actor('bram', 'Bram', 'carol')
embedded(thorin, { currency: { pp: 2, gp: 3 } })
embedded(vex, { currency: { gp: 10 } })
embedded(bram, {})
// Saved before 0.49.0: no coins nor coinChange key, so both read on; moves on, the rolls off.
const campaign = changes => ({ id: 'erebor', title: TITLE, characters: ['thorin', 'vex', 'bram'], groups: [], rolls: false, transfers: true, ...changes })
await startModule({ campaigns: [campaign()], secrets: { erebor: SECRET } })
await settled()

// ---- What's kept, posted and handed over ----
/**
 * The campaign's last hello, as posted. It's noted once the app's answer is back at the game's
 * page, after the app has kept what it says: a check of both waits for the app, then for this.
 */
const hello = () => postsOf('bridge.hello').filter(p => p.campaign === 'erebor').at(-1)
const kept = column => sql(`select ${column} from campaign where id = '${A}'`)
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }
/** The coins commands and moves kept, in order. */
const commands = () => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, role, kind, "actorId", label, status, payload, result, "createdAt" from roll_request where "campaignId" = '${A}' and kind in ('coins', 'transfer')) r`))
/** What the module posted as a command's result. */
const resultOf = row => postsOf('command.result').find(p => p.data?.id === row.id)?.data
/** The `count`th command, once the module has answered it and posted its result. */
async function answered(count, what) {
  await until(() => commands().length >= count && ['done', 'failed'].includes(commands()[count - 1].status), what, 30_000)
  const row = commands()[count - 1]
  await until(() => resultOf(row), `${what}: its result as the module posted it`, 15_000)
  return row
}
/** What an actor holds in Foundry, as stored: only the coins it has any of. */
const purse = holder => Object.fromEntries(Object.entries(holder._source.system.currency).filter(([, count]) => count > 0))
/** Thorin's coins as the app keeps his sheet: only those he has any of. */
const storedPurse = () => Object.fromEntries((JSON.parse(sql(`select coalesce((select (data->'inventory'->'currency')::text from actor_sheet where "campaignId" = '${A}' and "actorId" = 'thorin'), '[]')`)))
  .filter(coin => coin.value > 0).map(coin => [coin.id, coin.value]))
/** Foundry's chat lines of coins: their text, speaker, author, whom they're whispered to and the module's mark. */
const lines = () => [...W.messages.values()].filter(m => / (received|paid|handed out) /.test(m.content ?? ''))
  .map(m => ({ text: m.content.replace(/<[^>]+>/g, ''), actor: m.speaker?.actor, author: m.author?.id ?? m.author, by: m.flags?.['sending-stone']?.by ?? null, whisper: m.whisper ?? [], id: m.id }))
/** A request posted as a page would post it, through a seat's API. */
const crafted = (who, api, body) => call(who.page, `${api}/rolls`, { method: 'POST', body: { ...body, ...PLAIN } })
/** Room under the app's limit of rolls a minute from a seat. */
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 15, 'room under the rate limit', 70_000)
/** What a seat's chat in the app says, each line's text. */
const chatOf = async (who, api) => ((await call(who.page, `${api}/table`)).json?.messages ?? []).map(m => m.text ?? '')
/** Until the app's sheet of Thorin holds these coins, and no others. */
const sheetHolds = (coins, what) => until(() => sameJson(storedPurse(), coins), what, 20_000)
/** The coins a page's Currency row shows, by their abbreviations: only those there are any of. */
const shownPurse = who => who.currency().evaluate(group => Object.fromEntries([...group.closest('dl > div').querySelectorAll('ul > li')]
  .map(li => li.textContent.replace(/\s+/g, ' ').trim().split(' ')).map(([count, coin]) => [coin, Number(count.replace(/,/g, ''))]).filter(([, count]) => count > 0)))
/**
 * Thorin's coins set in Foundry, and his sheet sent again, as after the Gamemaster's own edit; then
 * Alice's page showing them, as a dialog opens with the coins its page has.
 */
async function holds(coins) {
  coinsInFoundry(thorin, { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...coins })
  await Hooks.callAll('updateActor', thorin, { system: { currency: coins } }, {}, 'gm')
  await sheetHolds(coins, `Thorin's sheet to hold ${JSON.stringify(coins)}`)
  await until(async () => sameJson(await shownPurse(desk).catch(() => null), coins), `Alice's page to show ${JSON.stringify(coins)}`, 30_000)
}

// ---- The pages and their parts ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now()),
         ('sheet-vex', 'Vex', '${GAME}', '${TITLE}', '${A}', 'vex', 'e2e-bob', now())`)
const API = '/api/characters/sheet-thorin'
const BOB_API = '/api/characters/sheet-vex'
const GM_API = `/api/campaigns/${A}/characters/thorin`
const GM_PAGE = `/campaigns?campaign=${A}`
const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await desk.tab('Inventory')

/** The Currency row's buttons by their names, in order. */
const rowButtons = who => who.currency().getByRole('button').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label') ?? b.textContent.trim()).filter(name => !name.endsWith('exact amount')))
const rowButton = (who, name) => who.currency().getByRole('button', { name, exact: true })
// Changed on purpose (item give): Add or take away reads Add or remove, its choices Add and Remove.
const coinsDialog = who => who.page.getByRole('dialog', { name: 'Add or remove coins', exact: true })
// Changed on purpose (item give): Send to and Hand out are one Give, whose dialog is Give coins.
const giveDialog = who => who.page.getByRole('dialog', { name: 'Give coins', exact: true })
const summary = dialog => dialog.locator('p[aria-live="polite"]').first().textContent()
/** Ticks a radio or a checkbox as a tap does, on its label: the input itself is hidden from sight. */
const tick = (dialog, role, name) => dialog.getByRole(role, { name, exact: true }).locator('xpath=ancestor::label[1]').click()
/** The field of a coin, by the coin's name as the sheet has it. */
const field = (dialog, name) => dialog.getByRole('textbox', { name, exact: true })
const sendOf = (dialog, name) => dialog.getByRole('button', { name, exact: true })
/** The Add or remove dialog, opened from the row, with one of the two chosen and gold typed. */
async function changing(who, op, gold) {
  await rowButton(who, 'Add or remove').click()
  const dialog = coinsDialog(who)
  await dialog.waitFor({ timeout: 10_000 })
  await tick(dialog, 'radio', op)
  await field(dialog, 'Gold').fill(gold)
  return dialog
}
const tray = who => who.page.getByRole('region', { name: 'Your rolls', exact: true })
const trayText = who => tray(who).evaluate(el => el.innerText.replace(/\s+/g, ' '))
/** Until the tray says all of these. */
const trayShows = (who, ...words) => until(async () => {
  const text = await trayText(who).catch(() => '')
  return words.every(word => text.includes(word))
}, `the tray to say ${JSON.stringify(words)}`, 20_000)

if (OLD) {
  // ===============================================================================================
  // Module 0.47.0: nothing of coins but Give
  // ===============================================================================================
  part('module 0.47.0: no coins added, taken away or handed out')
  const features = hello().data.features
  check(!('coins' in features) && !('handOut' in features.transfers) && kept('"coinsEnabled"') === 'f' && kept('array_to_string("transferFeatures", \',\')') === 'partySends,distribute',
    `module 0.47.0's hello says nothing of coins nor of handing out, and the app keeps neither (${JSON.stringify({ transfers: features.transfers, kept: kept('array_to_string("transferFeatures", \',\')') })})`)
  await desk.currency().waitFor({ timeout: 15_000 })
  // Changed on purpose (item give): the row's Send to reads Give.
  check(same(await rowButtons(desk), ['Give']), `Thorin's Currency row has Give alone (${JSON.stringify(await rowButtons(desk))})`)
  const coins = await crafted(desk, API, { kind: 'coins', coins: { op: 'add', currency: { gp: 5 } } })
  const each = await crafted(desk, API, { kind: 'transfer', transfer: { from: 'thorin', each: ['vex'], currency: { gp: 1 } } })
  check(coins.status === 409 && coins.json?.reason === 'unavailable' && each.status === 409 && each.json?.reason === 'unavailable' && commands().length === 0 && same(purse(thorin), { pp: 2, gp: 3 }),
    `coins and a hand-out posted anyway are answered ${coins.status} ${coins.json?.reason} and ${each.status} ${each.json?.reason}, nothing kept, Thorin as he was`)
  await desk.page.getByRole('button', { name: 'Help', exact: true }).click()
  const help = desk.page.getByRole('dialog', { name: 'Help', exact: true })
  await help.waitFor({ timeout: 10_000 })
  const rows = await help.getByRole('region', { name: /^In this game, for / }).locator('dl > div').evaluateAll(all => all.map(row => `${row.querySelector('dt').textContent}: ${row.querySelector('dd').textContent}`))
  check(rows.includes('Adding and removing coins: Not from here') && rows.includes('Moving items and coins: From here'), `Help's box: coins not from here, moves from here (${JSON.stringify(rows)})`)
  const gm = await browse({ width: 1280, height: 800, path: GM_PAGE })
  const section = gm.page.getByRole('article', { name: TITLE }).locator('section').filter({ has: gm.page.getByRole('heading', { name: "Players' coins" }) })
  await section.waitFor({ timeout: 15_000 })
  const said = (await section.locator('p').allTextContents()).join(' ')
  check(said === 'Your Sending Stone module doesn’t let players change coins yet. Version 0.49.0 or later does.', `the Gamemaster's campaign card: "${said}"`)
  await finish()
}

// =================================================================================================
// 1. The hello, the answer and the sheet
// =================================================================================================
part('1. the hello, the answer and the sheet')
{
  const features = hello().data.features
  // Changed on purpose (item 58): other creatures' health follows coins (module 0.50.0).
  check(same(features.coins, { enabled: true, kinds: ['coins'], reason: null, change: true }) && Object.keys(features).at(-2) === 'coins' && Object.keys(features).at(-1) === 'health',
    `the hello takes coins, on for a campaign saved without the switch, other coins paying, last among its features but other creatures' health (${JSON.stringify({ coins: features.coins, keys: Object.keys(features) })})`)
  check(same(features.transfers, { enabled: true, kinds: ['transfer'], reason: null, partySends: true, distribute: true, handOut: true, change: true }),
    `and hands a character's coins out (${JSON.stringify(features.transfers)})`)
  check(JSON.parse(hello().body ?? '{}').features?.coins === 1, `the app answers coins: 1 (${hello().body})`)
  await until(() => kept('"coinsEnabled"') === 't', 'the app to keep coins on', 15_000)
  check(kept('"coinsEnabled"') === 't' && kept('array_to_string("coinFeatures", \',\')') === 'change' && kept('array_to_string("transferFeatures", \',\')') === 'partySends,distribute,handOut,change' && kept('"rollsEnabled"') === 'f',
    `the campaign row keeps coins on with change, moves with handOut and change, the rolls off (${kept('array_to_string("transferFeatures", \',\')')})`)
  await sheetHolds({ pp: 2, gp: 3 }, 'Thorin\'s sheet in the app')
  const rates = JSON.parse(sql(`select (data->'inventory'->'currency')::text from actor_sheet where "campaignId" = '${A}' and "actorId" = 'thorin'`)).map(coin => [coin.id, coin.conversion])
  check(same(rates, [['pp', 0.1], ['gp', 1], ['ep', 2], ['sp', 10], ['cp', 100]]), `his sheet has each coin's rate, dnd5e's (${JSON.stringify(rates)})`)
}

// =================================================================================================
// 2. The Currency row
// =================================================================================================
part('2. the Currency row')
{
  await desk.currency().waitFor({ timeout: 15_000 })
  await until(async () => (await rowButtons(desk)).length === 2, 'the row\'s two buttons', 20_000)
  check(same(await rowButtons(desk), ['Add or remove', 'Give']), `Thorin's Currency row: ${JSON.stringify(await rowButtons(desk))}`)
}

// =================================================================================================
// 3. 5 gp added
// =================================================================================================
part('3. coins added')
{
  await paced()
  await rowButton(desk, 'Add or remove').click()
  const dialog = coinsDialog(desk)
  await dialog.waitFor({ timeout: 10_000 })
  const first = { said: await summary(dialog), send: await dialog.getByRole('button', { name: 'Add or remove', exact: true }).getAttribute('aria-disabled') }
  check(first.said === 'Choose Add or Remove.' && first.send === 'true', `the dialog asks which first, its button off (${JSON.stringify(first)})`)
  await tick(dialog, 'radio', 'Add')
  await field(dialog, 'Gold').fill('5')
  check(await summary(dialog) === 'You add 5 gp.' && await dialog.getByText('3 gp held', { exact: true }).count() === 1, `Add, 5 in Gold beside "3 gp held": "${await summary(dialog)}"`)
  await sendOf(dialog, 'Add coins').click()
  const made = await answered(1, 'the coins added')
  check(made.status === 'done' && made.kind === 'coins' && made.role === 'player' && made.label === null && sameJson(made.payload.coins, { op: 'add', currency: { gp: 5 } })
    && sameJson(resultOf(made)?.coins, { op: 'add', currency: { gp: 5 }, used: null }) && same(purse(thorin), { pp: 2, gp: 8 }),
  `one command, done: 5 gp added in Foundry, 2 pp and 8 gp now (${JSON.stringify({ coins: resultOf(made)?.coins, purse: purse(thorin) })})`)
  await sheetHolds({ pp: 2, gp: 8 }, 'the sheet to show 8 gp')
  const line = lines().at(-1)
  check(line?.text === 'Thorin received 5 gp' && line.actor === 'thorin' && line.author === 'alice' && line.whisper.length === 0 && line.by === null,
    `Foundry's chat says so, for all to read, as Thorin, written by Alice: ${JSON.stringify(line)}`)
  await until(async () => (await chatOf(desk, API)).some(text => text.includes('Thorin received 5 gp')), 'the line in the app\'s chat', 15_000)
  await trayShows(desk, 'Received 5 gp')
  check(true, `the app's chat has the line, and the tray says "Received 5 gp" (${await trayText(desk)})`)
}

// =================================================================================================
// 4. 5 gp removed of 3 gp and 2 pp: a platinum broken
// =================================================================================================
part('4. a larger coin broken')
{
  await holds({ pp: 2, gp: 3 })
  await paced()
  const dialog = await changing(desk, 'Remove', '5')
  check(await summary(dialog) === 'You remove 5 gp. You hold only 3 gp, so other coins pay for the rest.', `the dialog says other coins pay: "${await summary(dialog)}"`)
  await shootBoth(desk, 'coins-remove', dialog)
  await sendOf(dialog, 'Remove coins').click()
  const made = await answered(2, 'the coins removed')
  check(made.status === 'done' && sameJson(resultOf(made)?.coins, { op: 'remove', currency: { gp: 5 }, used: { pp: 1 } }) && same(purse(thorin), { pp: 1, gp: 8 }),
    `5 gp of 3 gp and 2 pp leaves 1 pp and 8 gp, the result saying a platinum was used (${JSON.stringify({ coins: resultOf(made)?.coins, purse: purse(thorin) })})`)
  await trayShows(desk, 'Paid 5 gp, using 1 pp')
  const line = lines().at(-1)
  check(line?.text === 'Thorin paid 5 gp' && line.whisper.length === 0, `the tray says "Paid 5 gp, using 1 pp", and Foundry's chat only "${line?.text}"`)
  await sheetHolds({ pp: 1, gp: 8 }, 'the sheet to show 1 pp and 8 gp')
}

// =================================================================================================
// 5. 2 gp removed of 1 gp and 40 sp: smaller coins pay
// =================================================================================================
part('5. smaller coins paying')
{
  await holds({ gp: 1, sp: 40 })
  await paced()
  const dialog = await changing(desk, 'Remove', '2')
  check(await summary(dialog) === 'You remove 2 gp. You hold only 1 gp, so other coins pay for the rest.', `with no larger coin: "${await summary(dialog)}"`)
  await sendOf(dialog, 'Remove coins').click()
  const made = await answered(3, 'the coins removed with silver')
  check(made.status === 'done' && sameJson(resultOf(made)?.coins?.used, { sp: 10 }) && same(purse(thorin), { sp: 30 }),
    `2 gp of 1 gp and 40 sp leaves 30 sp (${JSON.stringify({ coins: resultOf(made)?.coins, purse: purse(thorin) })})`)
  await trayShows(desk, 'Paid 2 gp, using 10 sp')
  check(true, 'the tray says "Paid 2 gp, using 10 sp"')
  await sheetHolds({ sp: 30 }, 'the sheet to show 30 sp')
}

// =================================================================================================
// 6. More than the coins are worth
// =================================================================================================
part('6. more than the coins are worth')
{
  const dialog = await changing(desk, 'Remove', '25')
  const said = { summary: await summary(dialog), send: await sendOf(dialog, 'Remove coins').getAttribute('aria-disabled') }
  check(said.summary === 'You haven’t that much: 25 gp is more than your coins are worth.' && said.send === 'true', `25 gp of 30 sp: "${said.summary}", Remove coins off`)
  // Tapped past its being off, as a finger would.
  await sendOf(dialog, 'Remove coins').click({ force: true })
  await sendOf(dialog, 'Cancel').click()
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
  check(commands().length === 3 && same(purse(thorin), { sp: 30 }), 'tapped all the same, nothing is sent')
}

// =================================================================================================
// 7. The Gamemaster turns other coins off
// =================================================================================================
part('7. other coins off')
{
  await game.settings.set('sending-stone', 'campaigns', [campaign({ coinChange: false })])
  await until(() => kept('array_to_string("coinFeatures", \',\')') === '', 'the app to keep no change', 20_000)
  await until(() => hello()?.data?.features?.coins?.change === false, 'the hello with other coins off, as posted', 10_000).catch(() => {})
  check(same(hello().data.features.coins, { enabled: true, kinds: ['coins'], reason: null, change: false }) && hello().data.features.transfers.change === false,
    `"Pay with other coins" off in Foundry: the hello says so of coins and of moves (${JSON.stringify(hello().data.features.coins)})`)
  await holds({ gp: 3, pp: 2 })
  let dialog
  await until(async () => {
    dialog = await changing(desk, 'Remove', '5')
    if ((await summary(dialog)).includes('doesn’t pay')) return true
    await sendOf(dialog, 'Cancel').click()
    return false
  }, 'the dialog to say the game pays with no other coin', 30_000)
  const said = { summary: await summary(dialog), send: await sendOf(dialog, 'Remove coins').getAttribute('aria-disabled') }
  check(said.summary === 'You hold only 3 gp, and your Gamemaster’s game doesn’t pay with other coins.' && said.send === 'true', `within a poll, the dialog: "${said.summary}", Remove coins off`)
  await sendOf(dialog, 'Cancel').click()
  await paced()
  const refused = await crafted(desk, API, { kind: 'coins', coins: { op: 'remove', currency: { gp: 5 } } })
  check(refused.status === 422 && refused.json?.reason === 'short' && commands().length === 3 && same(purse(thorin), { pp: 2, gp: 3 }), `posted anyway, it's answered ${refused.status} ${refused.json?.reason}, nothing kept`)
  await game.settings.set('sending-stone', 'campaigns', [campaign()])
  await until(() => kept('array_to_string("coinFeatures", \',\')') === 'change', 'the app to keep change again', 20_000)
}

// =================================================================================================
// 8. The Gamemaster, at Thorin's page
// =================================================================================================
part('8. the Gamemaster\'s')
{
  const gmSheet = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin`, toasts: false })
  await gmSheet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await gmSheet.tab('Inventory')
  await gmSheet.currency().waitFor({ timeout: 15_000 })
  await until(async () => (await rowButtons(gmSheet)).length === 2, 'the Gamemaster\'s two buttons', 20_000)
  await paced()
  const dialog = await changing(gmSheet, 'Add', '4')
  check(same(await rowButtons(gmSheet), ['Add or remove', 'Give']) && await summary(dialog) === 'Thorin adds 4 gp.', `the Gamemaster's row has the two too, and their dialog names him: "${await summary(dialog)}"`)
  await sendOf(dialog, 'Add coins').click()
  const made = await answered(4, 'the Gamemaster\'s coins')
  const line = lines().at(-1)
  check(made.status === 'done' && made.role === 'gm' && made.label === 'Add 4 gp' && same(purse(thorin), { pp: 2, gp: 7 })
    && line?.text === 'Thorin received 4 gp' && line.by === 'gm' && same(resultOf(made)?.messages, [line.id]),
  `made as theirs, called "Add 4 gp", Foundry's line marked the Gamemaster's and listed in the result (${JSON.stringify({ role: made.role, label: made.label, line, messages: resultOf(made)?.messages })})`)
  await until(async () => (await gmSheet.page.getByRole('region', { name: /rolls$/ }).first().innerText().catch(() => '')).includes('Thorin received 4 gp'), 'the Gamemaster\'s tray', 20_000)
  check(true, 'their tray says "Thorin received 4 gp"')
  await gmSheet.view.close()
}

// =================================================================================================
// 9. 2 gp each handed out to Vex and Bram
// =================================================================================================
part('9. coins given to Vex and Bram')
const bob = await browse({ width: 390, height: 844, who: BOB, path: '/characters/sheet-vex', toasts: false })
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const gms = game.users.filter(user => user.isGM).map(user => user.id).toSorted()
{
  await holds({ gp: 10 })
  const before = lines().length
  await paced()
  // Changed on purpose (item give): Hand out is Give's, its characters ticked; Erebor has no party,
  // so none is chosen as it opens.
  await rowButton(desk, 'Give').click()
  const dialog = giveDialog(desk)
  await dialog.waitFor({ timeout: 10_000 })
  const names = await dialog.getByRole('checkbox').evaluateAll(boxes => boxes.map(box => box.closest('label').textContent.trim()))
  check(same(names, ['Select all', 'Vex', 'Bram']) && await dialog.getByRole('radio').count() === 0 && await summary(dialog) === 'Choose who gets it.',
    `Give coins lists the campaign's other characters under Select all, and no party (${JSON.stringify(names)}): "${await summary(dialog)}"`)
  await tick(dialog, 'checkbox', 'Select all')
  await field(dialog, 'Gold').fill('2')
  check(await summary(dialog) === 'You give 2 gp each to Vex and Bram: 4 gp in all.'
    && await dialog.getByText('Each is whispered what they received in Foundry’s chat, and your Gamemaster is told.', { exact: true }).count() === 1,
  `"${await summary(dialog)}", each whispered, the Gamemaster told`)
  await shootBoth(desk, 'coins-give-each', dialog)
  await sendOf(dialog, 'Give coins').click()
  const made = await answered(5, 'the give to Vex and Bram')
  check(made.status === 'done' && made.kind === 'transfer' && sameJson(made.payload.transfer, { from: 'thorin', each: ['vex', 'bram'], currency: { gp: 2 } })
    && sameJson(resultOf(made)?.transfer, { from: 'thorin', to: null, items: [], currency: { gp: 2 }, each: ['vex', 'bram'], used: null })
    && same(purse(thorin), { gp: 6 }) && same(purse(vex), { gp: 12 }) && same(purse(bram), { gp: 2 }),
  `one move, done: Thorin 6 gp, Vex 12, Bram 2, the result saying what each got (${JSON.stringify(resultOf(made)?.transfer)})`)
  const told = lines().slice(before)
  check(told.length === 3 && told.every(line => line.whisper.length > 0 && line.actor === 'thorin' && line.author === 'alice')
    && same(told.map(line => [line.text, [...line.whisper].toSorted()]), [
      ['Vex received 2 gp from Thorin', ['bob']],
      ['Bram received 2 gp from Thorin', ['carol']],
      ['Thorin handed out 2 gp each to Vex and Bram: 4 gp in all', gms],
    ]),
  `Foundry's chat: a whisper to each one's player, and one to the Gamemasters, none for all to read (${JSON.stringify(told.map(line => [line.text, line.whisper]))})`)
  await trayShows(desk, 'Gave 2 gp each to Vex and Bram')
  await until(async () => (await chatOf(bob, BOB_API)).some(text => text.includes('Vex received 2 gp from Thorin')), 'Bob\'s chat', 20_000)
  const theirs = await chatOf(bob, BOB_API)
  check(!theirs.some(text => text.includes('Bram received')) && !theirs.some(text => text.includes('handed out')), `Bob's page shows "Vex received 2 gp from Thorin", and neither Bram's nor the Gamemasters' (${JSON.stringify(theirs.filter(text => /received|handed/.test(text)))})`)
  await until(async () => (await chatOf(desk, API)).filter(text => /from Thorin|handed out/.test(text)).length === 3, 'Alice\'s chat', 20_000)
  check(true, 'Alice, who wrote them, reads both whispers and the Gamemasters\' line, and her tray says "Gave 2 gp each to Vex and Bram"')
}

// =================================================================================================
// 9b. A give to one character: whispered as a hand-out to one (give-Q1 A)
// =================================================================================================
part('9b. coins given to Vex alone')
{
  const before = lines().length
  await paced()
  await rowButton(desk, 'Give').click()
  const dialog = giveDialog(desk)
  await dialog.waitFor({ timeout: 10_000 })
  await tick(dialog, 'checkbox', 'Vex')
  await field(dialog, 'Gold').fill('1')
  const legend = await dialog.locator('fieldset legend').evaluateAll(all => all.map(l => l.textContent.trim()))
  check(legend.includes('Coins') && !legend.includes('Each gets') && await summary(dialog) === 'You give 1 gp to Vex.'
    && await dialog.getByText('Vex is whispered what they received in Foundry’s chat, and your Gamemaster is told.', { exact: true }).count() === 1,
  `one character: the coins' legend "Coins", "${await summary(dialog)}", Vex whispered (${JSON.stringify(legend)})`)
  await sendOf(dialog, 'Give coins').click()
  const made = await answered(6, 'the give to Vex alone')
  check(made.status === 'done' && sameJson(made.payload.transfer, { from: 'thorin', each: ['vex'], currency: { gp: 1 } }) && same(purse(thorin), { gp: 5 }) && same(purse(vex), { gp: 13 }),
    `sent as a hand-out to one: ${JSON.stringify(made.payload.transfer)}, Thorin 5 gp, Vex 13`)
  const told = lines().slice(before)
  check(same(told.map(line => [line.text, [...line.whisper].toSorted()]), [
    ['Vex received 1 gp from Thorin', ['bob']],
    ['Thorin handed out 1 gp each to Vex: 1 gp in all', gms],
  ]) && [...W.messages.values()].filter(m => /^<p>Gives /.test(m.content ?? '')).length === 0,
  `Bob is whispered Vex's, the Gamemasters the whole of it, and no line is posted for all (${JSON.stringify(told.map(line => [line.text, line.whisper]))})`)
  await trayShows(desk, 'Gave 1 gp to Vex')
  check(true, 'the tray says "Gave 1 gp to Vex"')
}

// =================================================================================================
// 10. Both dialogs and the row, on phones, a tablet and the desk, in both themes, at a scale of 2
// =================================================================================================
part('10. phones, a tablet and both themes')
{
  await holds({ pp: 2, gp: 3 })
  for (const [width, height] of [[320, 640], [360, 780], [390, 844], [768, 1024], [1280, 800]]) {
    const seat = await browse({ device: { viewport: { width, height }, deviceScaleFactor: 2, isMobile: width < 1024, hasTouch: width < 1024 }, path: '/characters/sheet-thorin', toasts: false })
    await seat.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    await seat.tab('Inventory')
    await seat.currency().waitFor({ timeout: 15_000 })
    await until(async () => (await rowButtons(seat)).length === 2, `the two buttons at ${width}`, 20_000)
    // Changed on purpose (item give): the buttons are below the coins, at the card's left, by their
    // boxes: below the coins and the label, inside the card, the first at its content's left; the
    // card's children its label, its coins, then its buttons.
    const look = await seat.currency().evaluate(group => {
      const card = group.closest('dl > div')
      const edge = card.getBoundingClientRect()
      const style = getComputedStyle(card)
      const contentLeft = edge.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth)
      const label = card.querySelector('dt').getBoundingClientRect()
      const coins = card.querySelector('ul').getBoundingClientRect()
      const buttons = [...group.querySelectorAll('button')]
      const boxes = buttons.map(b => b.getBoundingClientRect())
      return {
        below: boxes.every(b => b.top >= coins.bottom - 0.5 && b.top >= label.bottom - 0.5),
        inside: boxes.every(b => b.left >= edge.left && b.right <= edge.right + 0.5 && b.bottom <= edge.bottom + 0.5),
        left: Math.abs(boxes[0].left - contentLeft) <= 1,
        children: [...card.children].map(child => child.tagName),
        name: document.getElementById(group.getAttribute('aria-labelledby'))?.textContent.trim(),
        names: buttons.map(b => b.textContent.trim()),
      }
    })
    check(look.below && look.inside && look.left && same(look.children, ['DT', 'DD', 'DD']) && look.name === 'Currency' && same(look.names, ['Add or remove', 'Give']) && await sideways(seat.page) === 0,
      `at ${width} the row's two buttons are below its coins, at the card's left and inside it, nothing scrolling sideways (${JSON.stringify(look)})`)
    if (width === 390 || width === 1280) await shootBoth(seat, 'coins-row', seat.currency().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]'))
    const coins = await changing(seat, 'Remove', '5')
    await shootBoth(seat, 'coins-dialog', coins)
    const fits = await sideways(seat.page) === 0
    await sendOf(coins, 'Cancel').click()
    await coins.waitFor({ state: 'hidden', timeout: 5_000 })
    await rowButton(seat, 'Give').click()
    const give = giveDialog(seat)
    await give.waitFor({ timeout: 10_000 })
    await tick(give, 'checkbox', 'Vex')
    await tick(give, 'checkbox', 'Bram')
    // What each gets is what Thorin's 3 gp pay for, so the summary is the give's alone.
    await field(give, 'Gold').fill('1')
    await shootBoth(seat, 'give-dialog', give)
    check(fits && await sideways(seat.page) === 0 && await summary(give) === 'You give 1 gp each to Vex and Bram: 2 gp in all.', `at ${width} both dialogs open, nothing scrolling sideways: "${await summary(give)}"`)
    await seat.view.close()
  }
  check(commands().length === 6, 'looked at and cancelled, nothing more is sent')
}

// =================================================================================================
// 11. Help, and the Gamemaster's campaign card
// =================================================================================================
part('11. Help and the campaign card')
const gm = await browse({ width: 1280, height: 800, path: GM_PAGE })
const article = gm.page.getByRole('article', { name: TITLE })
const section = article.locator('section').filter({ has: gm.page.getByRole('heading', { name: "Players' coins" }) })
{
  await desk.page.getByRole('button', { name: 'Help', exact: true }).click()
  const help = desk.page.getByRole('dialog', { name: 'Help', exact: true })
  await help.waitFor({ timeout: 10_000 })
  const rows = await help.getByRole('region', { name: /^In this game, for / }).locator('dl > div').evaluateAll(all => all.map(row => `${row.querySelector('dt').textContent}: ${row.querySelector('dd').textContent}`))
  const text = await help.evaluate(el => el.innerText.replace(/\s+/g, ' '))
  check(rows.indexOf('Adding and removing coins: From here') === rows.indexOf('Moving items and coins: From here') + 1
    && text.includes('Players move items and coins: Send to…, Take and Give (0.31.0), and Give to several characters at once (0.49.0).')
    && text.includes('Allow Players to add and take away coins from the app: Add or remove, on the Inventory tab’s Currency row; on unless they turn it off (0.49.0).')
    && text.includes('Pay with other coins when a character is short of one: removing more of a coin than you hold, or giving characters more of it, breaks a larger coin, then uses smaller ones; on unless they turn it off (0.49.0).'),
  `Help's box has coins from here, after moves, and its switches name the two and Give to several (${JSON.stringify(rows.filter(row => /coins/.test(row)))})`)
  await desk.page.keyboard.press('Escape')
  await help.waitFor({ state: 'hidden', timeout: 5_000 })
  await section.waitFor({ timeout: 15_000 })
  const said = (await section.locator('p').allTextContents()).join(' ')
  const order = await article.locator('h3').allTextContents()
  check(said === 'On in Foundry. Your players add coins to their characters and remove them from here, and each change posts a line in your game’s chat. A character short of a coin pays with their other coins.'
    && order.indexOf("Players' coins") === order.indexOf('Items and coins') + 1,
  `the Gamemaster's campaign card, after Items and coins: "${said}" (${JSON.stringify(order)})`)
  await shootBoth(gm, 'coins-gm', section)
}

// =================================================================================================
// 12. The switches off
// =================================================================================================
part('12. the switches off')
{
  await game.settings.set('sending-stone', 'campaigns', [campaign({ coins: false })])
  await until(() => kept('"coinsEnabled"') === 'f', 'the app to keep coins off', 20_000)
  await until(() => hello()?.data?.features?.coins?.reason === 'off', 'the hello with the switch off, as posted', 10_000).catch(() => {})
  check(same(hello().data.features.coins, { enabled: false, kinds: [], reason: 'off', change: false }) && hello().data.features.transfers.handOut === true,
    `the coins' switch off in Foundry: the hello says coins are off, and hands out still (${JSON.stringify(hello().data.features.coins)})`)
  await until(async () => same(await rowButtons(desk), ['Give']), 'Add or remove to go', 30_000)
  await paced()
  const refused = await crafted(desk, API, { kind: 'coins', coins: { op: 'add', currency: { gp: 1 } } })
  check(refused.status === 409 && refused.json?.reason === 'unavailable', `within a poll, Add or remove is gone and Give still there; coins posted are answered ${refused.status} ${refused.json?.reason}`)
  await gm.page.reload()
  await section.waitFor({ timeout: 15_000 })
  const said = (await section.locator('p').allTextContents()).join(' ')
  check(said === 'Off. To let them, tick Allow Players to add and take away coins from the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.', `the Gamemaster's card: "${said}"`)
  await game.settings.set('sending-stone', 'campaigns', [campaign({ coins: false, transfers: false })])
  await until(() => kept('"transfersEnabled"') === 'f', 'the app to keep moves off', 20_000)
  await until(async () => (await rowButtons(desk)).length === 0, 'the row\'s buttons to go', 30_000)
  const each = await crafted(desk, API, { kind: 'transfer', transfer: { from: 'thorin', each: ['vex'], currency: { gp: 1 } } })
  check(each.status === 409 && each.json?.reason === 'unavailable' && commands().length === 6 && same(purse(thorin), { pp: 2, gp: 3 }),
    `moves off too, Give is gone; a hand-out posted is answered ${each.status} ${each.json?.reason}, nothing kept`)
}
note(`${commands().length} coins commands and moves kept`)
await finish()
