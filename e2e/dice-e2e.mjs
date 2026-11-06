// The dice tray under the chat (v0.44, ROADMAP item 7, the user's placement D), end to end against
// module 0.44.0's plain roll, in the world of world-030.mjs with dnd5e 5.3.3's dice. Alice plays
// Thorin, a Trusted player, whom Make Manual Rolls is given to, in Dice Tray, whose players roll in
// the app and may type in their dice (Manual Dice active). At 390 × 844, on the Chat tab: the tray's
// bar under the chat, closed, then opened; a button for each size, d4 to d100, its shape and its
// size, 44 px at least; d6, d6, d8 and d20 added, the d20 taken away; the footer saying the game
// makes these; Roll 2d6 + 1d8: the request a plain roll of the dice thrown, the module's card in
// Foundry (Alice's, spoken by Thorin, "Dice roll", "2d6 + 1d8", Foundry's total of the app's dice,
// flagged with the request, dnd5e 5's generic roll), the tray's "At the table" the card's total, the
// card in the app's chat above the tray, the dice kept, and one dice renderer on the page. At
// 1280 × 800, in the chat column beside the sheet: the seven sizes in one row; 1d100 + 2, one die
// from 1 to 100, its card "1d100 + 2"; 20 dice the most, every way to add one saying so; Clear. With
// Manual Dice on, at 390: Roll asks the tray's own dialog for "2d6" and "+1d8", typed 3, 5 and 7,
// sent typed, the card flagged typed, its total 15. The Gamemaster's page for Thorin, at 1280: the
// tray rolls 1d20 as Thorin, the request the Gamemaster's, labelled, the card flagged GM. Send to the
// table off at 1280: rolled on the app's dice alone, nothing sent, the footer saying why. Synthetic
// characters only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
// Screenshots to SHOTS.
import {
  W, browse, character, check, finish, foundryWorld, launch, manualDice, newCampaign, part, same, sameJson,
  settled, shoot, sideways, sql, startModule, until, wait,
} from './world-030.mjs'

const GAME = 'https://dice-tray.forge-vtt.com'
const SECRET = 'dice-tray-secret-44'
const TITLE = 'Dice Tray'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'dice-tray.forge-vtt.com', secret: SECRET })
await foundryWorld()
// A checkout's module.json says 0.1.0: the version the release stamps.
game.modules.get('sending-stone').version = '0.44.0'
manualDice('active')
// Thorin's player is Trusted, whom Make Manual Rolls is given to out of the box.
game.users.get('alice').role = 2

// ---- The world: Thorin, Alice's ----
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 2, dex: 1 }, hp: { value: 30, max: 40, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
game.users.get('alice').character = thorin
await startModule({
  campaigns: [{ id: 'camp-tray', title: TITLE, characters: ['thorin'], groups: [], rolls: true, manualDice: true }],
  secrets: { 'camp-tray': SECRET },
})
await settled()

// ---- What's kept and made ----
const kinds = () => sql(`select array_to_string("rollKinds", ',') from campaign where id = '${A}'`).split(',')
const requests = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}'`))
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, role, label, status, payload, result from roll_request ${id ? `where id = '${id}'` : `where "campaignId" = '${A}' order by "createdAt" desc limit 1`}) r`) || 'null')
const madeFor = id => W.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
/** Each of a roll's dice terms' results, in order. */
const facesOf = roll => (roll?.dice ?? []).map(die => die.results.map(r => r.result))
const sum = values => values.flat().reduce((total, value) => total + value, 0)

part('0. the game takes plain rolls')
await until(() => kinds().includes('plainRoll'), 'the app to keep that the game takes plain rolls', 15_000)
check(kinds().indexOf('plainRoll') === kinds().indexOf('formula') + 1, `the app keeps that the game takes plain rolls, from module 0.44.0, right after formulas (${kinds()})`)

// ---- The pages and the tray ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const chatOf = who => who.page.getByRole('region', { name: 'Chat', exact: true })
const toggleOf = who => chatOf(who).getByRole('button', { name: 'Roll dice', exact: true })
const addOf = (who, size) => chatOf(who).getByRole('button', { name: `Add a ${size}`, exact: true })
const sizesOf = who => chatOf(who).getByRole('group', { name: 'Add a die' }).getByRole('button')
const chipsOf = async who => (await chatOf(who).getByRole('list', { name: 'Dice to roll' }).getByRole('listitem').allTextContents()).map(text => text.trim())
const latestOf = who => chatOf(who).getByRole('status', { name: 'Latest roll' })
const footerSays = (who, words) => chatOf(who).getByText(words, { exact: true }).isVisible()
const said = async locator => (await locator.textContent()).replace(/\s+/g, ' ').trim()
/** The tray, opened: from the Chat tab on a page that shows the table's panes one at a time. */
async function openTray(who) {
  if (await who.nav.isVisible()) await who.chat()
  await toggleOf(who).waitFor({ timeout: 20_000 })
  if ((await toggleOf(who).getAttribute('aria-expanded')) !== 'true') await toggleOf(who).click()
  await chatOf(who).getByRole('group', { name: 'Add a die' }).waitFor()
}
/** Roll, named as the tray names it: the request it sent once the game made it, its card, and what the tray says. */
async function rollTray(who, name, what) {
  const before = requests()
  await chatOf(who).getByRole('button', { name, exact: true }).click()
  await until(() => requests() > before, `${what} to be sent`)
  const sent = rollRow()
  await until(() => ['done', 'failed'].includes(rollRow(sent.id).status), `${what} to be made`)
  await latestOf(who).getByText(/At the table|Not made at the table/).waitFor({ timeout: 30_000 })
  const made = rollRow(sent.id)
  return { made, message: madeFor(made.id), shown: await said(latestOf(who)) }
}
/** The page's settings, behind the sheet's cog: opened, then the switch named so clicked, then closed. */
async function toggleSetting(who, name) {
  const dialog = who.page.getByRole('dialog', { name: 'Settings' })
  await who.page.getByRole('button', { name: 'Settings', exact: true }).click()
  await dialog.waitFor()
  const control = dialog.getByRole('switch', { name, exact: true })
  await control.waitFor({ timeout: 15_000 })
  await control.click()
  await who.page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
}
const MADE_THERE = 'Made in your Gamemaster’s game too, with the same dice.'

part('1. the tray under the chat, on a phone')
const phone = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin' })
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await phone.chat()
await toggleOf(phone).waitFor({ timeout: 20_000 })
check((await toggleOf(phone).getAttribute('aria-expanded')) === 'false' && (await sizesOf(phone).count()) === 0,
  'the Chat tab has the dice tray’s bar under the chat, closed')
await toggleOf(phone).click()
const sizes = await sizesOf(phone).evaluateAll(buttons => buttons.map(b => {
  const box = b.getBoundingClientRect()
  return { text: b.textContent.trim(), name: b.getAttribute('aria-label'), shape: !!b.querySelector('svg path'), w: Math.round(box.width), h: Math.round(box.height) }
}))
check(same(sizes.map(s => s.text), ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']) && sizes.every(s => s.name === `Add a ${s.text}` && s.shape && s.w >= 44 && s.h >= 44),
  `opened, it has a button for each size, d4 to d100, its die's shape and its size, 44 px at least (${JSON.stringify(sizes)})`)
for (const size of ['d6', 'd6', 'd8', 'd20']) await addOf(phone, size).click()
await chatOf(phone).getByRole('button', { name: 'One d20 fewer', exact: true }).click()
check(same(await chipsOf(phone), ['2d6', '1d8']) && (await chatOf(phone).getByRole('button', { name: 'Roll 2d6 + 1d8', exact: true }).isVisible()) && (await footerSays(phone, MADE_THERE)),
  `d6, d6, d8 and d20 added and the d20 taken away: the chips read 2d6 and 1d8, Roll says "Roll 2d6 + 1d8", and the footer that the game makes these (${await chipsOf(phone)})`)
check((await sideways(phone.page)) === 0, 'and the page doesn’t scroll sideways at 390 with the tray open')
await shoot(phone, 'dice-tray-open', chatOf(phone))

const first = await rollTray(phone, 'Roll 2d6 + 1d8', 'the tray’s 2d6 + 1d8')
const thrown = first.made.payload.dice
check(first.made.kind === 'plainRoll' && first.made.role === 'player' && first.made.status === 'done' && !first.made.payload.typed
  && sameJson(first.made.payload.plainRoll, { terms: [{ faces: 6, count: 2 }, { faces: 8, count: 1 }] })
  && same(thrown.map(die => [die.faces, die.results.length]), [[6, 2], [8, 1]]) && thrown.every(die => die.results.every(value => value >= 1 && value <= die.faces)),
  `the tray sends a plain roll of 2d6 and 1d8, with the dice the app threw, and the game makes it (${JSON.stringify(first.made.payload)} ${first.made.status} ${first.made.result?.reason ?? ''})`)
const card = first.message
check(card && card.author.id === 'alice' && card.speaker.actor === 'thorin' && card.flavor === 'Dice roll' && card.rolls[0].formula === '2d6 + 1d8'
  && same(facesOf(card.rolls[0]), thrown.map(die => die.results)) && card.rolls[0].total === sum(thrown.map(die => die.results))
  && card.flags['sending-stone'].request === first.made.id && card.flags.dnd5e?.roll?.type === 'generic',
  `the module's card in Foundry: Alice's, spoken by Thorin, "Dice roll", 2d6 + 1d8 of the app's dice, Foundry's total theirs, flagged with the request, dnd5e 5's generic roll (${card?.flavor} ${card?.rolls[0]?.formula} = ${card?.rolls[0]?.total} ${JSON.stringify(facesOf(card?.rolls[0]))})`)
check(first.shown.includes('Dice (2d6 + 1d8)') && first.shown.includes(`At the table: ${card?.rolls[0].total}`),
  `the tray says the roll, and that the game made it, its total the card's: "${first.shown}"`)
await phone.log.getByRole('listitem').filter({ hasText: 'Dice roll' }).first().waitFor({ timeout: 20_000 })
const inChat = await said(phone.log.getByRole('listitem').filter({ hasText: 'Dice roll' }).last())
check(inChat.includes(String(card?.rolls[0].total)), `its card comes in the app's chat, above the tray, "Dice roll" and its total: "${inChat}"`)
check(same(await chipsOf(phone), ['2d6', '1d8']) && (await chatOf(phone).getByRole('button', { name: 'Roll 2d6 + 1d8', exact: true }).isVisible()),
  'the tray keeps its dice for the next roll')
check((await phone.page.locator('[id^=dice-canvas-threejs]').count()) === 1, 'the whole page throws its dice on one renderer, the chat’s tray and the sheet alike')
await shoot(phone, 'dice-tray-rolled', chatOf(phone))

part('2. in the chat column beside the sheet, at 1280')
const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await openTray(desk)
const tops = await sizesOf(desk).evaluateAll(buttons => buttons.map(b => Math.round(b.getBoundingClientRect().top)))
check(tops.length === 7 && new Set(tops).size === 1 && (await desk.page.getByRole('region', { name: 'Character', exact: true }).isVisible()),
  `beside the sheet, the tray under the chat has its seven sizes in one row (${tops})`)
await addOf(desk, 'd100').click()
for (const _step of [1, 2]) await chatOf(desk).getByRole('button', { name: 'Raise the modifier', exact: true }).click()
const hundred = await rollTray(desk, 'Roll 1d100 + 2', 'the tray’s 1d100 + 2')
const [percentile] = hundred.made.payload.dice ?? []
check(sameJson(hundred.made.payload.plainRoll, { terms: [{ faces: 100, count: 1 }], bonus: 2 }) && percentile?.faces === 100 && percentile.results.length === 1
  && percentile.results[0] >= 1 && percentile.results[0] <= 100 && hundred.message?.rolls[0].formula === '1d100 + 2'
  && hundred.message.rolls[0].total === percentile.results[0] + 2 && hundred.shown.includes(`At the table: ${percentile.results[0] + 2}`),
  `a d100 and +2: one die of 100 faces, from 1 to 100, its card "1d100 + 2", the game's total the tray's (${JSON.stringify(hundred.made.payload)}: "${hundred.shown}")`)
await shoot(desk, 'dice-tray-wide')
await chatOf(desk).getByRole('button', { name: 'Clear', exact: true }).click()
for (let die = 0; die < 20; die++) await addOf(desk, 'd4').click()
check((await addOf(desk, 'd6').getAttribute('aria-disabled')) === 'true' && (await chatOf(desk).getByText('At most 20 dice', { exact: true }).isVisible())
  && (await chatOf(desk).getByRole('button', { name: 'One d4 more', exact: true }).getAttribute('aria-disabled')) === 'true'
  && same(await chipsOf(desk), ['20d4']) && (await chatOf(desk).getByRole('button', { name: 'Roll 20d4', exact: true }).isVisible()),
  'at 20 dice every way to add one says "At most 20 dice", and adds none')
await chatOf(desk).getByRole('button', { name: 'Clear', exact: true }).click()
check((await chatOf(desk).getByRole('button', { name: 'Pick dice to roll', exact: true }).getAttribute('aria-disabled')) === 'true'
  && (await chatOf(desk).getByRole('list', { name: 'Dice to roll' }).count()) === 0
  && (await chatOf(desk).getByRole('group', { name: 'Modifier' }).locator('output').textContent()) === '+0',
  'Clear empties the tray, its modifier +0 again, and Roll waits for dice')

part('3. typed in, with Manual Dice on')
await phone.character()
await toggleSetting(phone, 'Enter dice results manually')
await until(() => sql(`select "manualDice" from "character" where id = 'sheet-thorin'`) === 't', 'Manual Dice on, kept for Thorin', 10_000)
await openTray(phone)
const beforeTyped = requests()
await chatOf(phone).getByRole('button', { name: 'Roll 2d6 + 1d8', exact: true }).click()
const dialog = phone.page.getByRole('dialog', { name: 'Dice (2d6 + 1d8)' })
await dialog.waitFor({ timeout: 15_000 })
const groups = await dialog.evaluate(el => [...el.querySelectorAll('[role=group][aria-labelledby]')].map(group => ({
  name: document.getElementById(group.getAttribute('aria-labelledby'))?.textContent.trim(),
  boxes: [...group.querySelectorAll('input')].map(input => input.getAttribute('aria-label')),
})))
check(same(groups, [{ name: '2d6', boxes: ['d6 1 of 2', 'd6 2 of 2'] }, { name: '+1d8', boxes: ['d8'] }]),
  `Roll asks the tray's own dice dialog for 2d6 and +1d8, a box a die (${JSON.stringify(groups)})`)
for (const key of ['3', '5', '7']) await dialog.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: key, exact: true }).click()
await dialog.getByRole('button', { name: 'Done', exact: true }).click()
await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
await until(() => requests() > beforeTyped, 'the typed roll to be sent')
const typedSent = rollRow()
await until(() => ['done', 'failed'].includes(rollRow(typedSent.id).status), 'the typed roll to be made')
await latestOf(phone).getByText(/At the table|Not made at the table/).waitFor({ timeout: 30_000 })
const typed = rollRow(typedSent.id)
const typedCard = madeFor(typed.id)
const typedShown = await said(latestOf(phone))
check(typed.payload.typed === true && sameJson(typed.payload.dice, [{ faces: 6, results: [3, 5] }, { faces: 8, results: [7] }]) && typed.status === 'done'
  && typedCard?.flags['sending-stone'].typed === true && same(facesOf(typedCard.rolls[0]), [[3, 5], [7]]) && typedCard.rolls[0].total === 15
  && typedShown.includes('At the table: 15'),
  `typed 3, 5 and 7, it's sent typed, the card flagged typed with those dice, 15, and the tray says so: "${typedShown}"`)

part('4. the Gamemaster’s page')
const gmPage = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin`, toasts: false })
await gmPage.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await openTray(gmPage)
await addOf(gmPage, 'd20').click()
const gmRoll = await rollTray(gmPage, 'Roll 1d20', 'the Gamemaster’s 1d20')
check(gmRoll.made.role === 'gm' && gmRoll.made.label === 'Dice (1d20)' && gmRoll.made.status === 'done'
  && gmRoll.message?.flags['sending-stone'].by === 'gm' && gmRoll.message.speaker.actor === 'thorin' && gmRoll.message.rolls[0].formula === '1d20'
  && gmRoll.shown.includes(`At the table: ${gmRoll.message.rolls[0].total}`),
  `the Gamemaster's page has the tray too: 1d20 as Thorin, the request the Gamemaster's and labelled, the card flagged GM (${gmRoll.made.role} ${gmRoll.made.label}: "${gmRoll.shown}")`)

part('5. Send to the table off')
await toggleSetting(desk, 'Send to the table')
await chatOf(desk).getByText('Only you see these dice: Send to the table is off in Settings.', { exact: true }).waitFor({ timeout: 5_000 })
const beforeOff = requests()
await addOf(desk, 'd20').click()
await chatOf(desk).getByRole('button', { name: 'Roll 1d20', exact: true }).click()
await latestOf(desk).getByText('Dice (1d20)', { exact: true }).waitFor({ timeout: 30_000 })
await wait(2_000)
const offShown = await said(latestOf(desk))
check(requests() === beforeOff && !offShown.includes('At the table'),
  `with Send to the table off, the tray rolls on the app's dice alone, sends nothing, and says why the game makes none: "${offShown}"`)
await shoot(desk, 'dice-tray-send-off', chatOf(desk))

await finish()
