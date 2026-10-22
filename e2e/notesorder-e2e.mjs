// Notes moved to a chapter and put in order, and the journal's "Last changed by …" counting Foundry's
// own deletes and reorders (module 0.35.0 and the app, its contract §13.5), end to end, in the world of
// world-030.mjs, with Foundry's journals the harness's stand-in (fvtt/journal-core.mjs). Erebor: Alice
// runs it and plays Thorin, on a laptop (1280 × 800) and a phone (390 × 844); Bob plays Vex, on a
// tablet (768 × 1024); the Iron Company, Alice's user its Owner and Bob's an Observer. The party
// journal's chapter of Bob's, the Gamemaster's and a Foundry-written note, reordered by Alice with the
// mouse, by keys and by Bob with the arrow buttons, none of it hers, the module taking it as Foundry's
// page order; the notes in no chapter reordered, a new note and a note moved in landing last; Cancel
// and Escape; the contents locked; the Gamemaster's drag in Foundry kept, and his deletes there named
// on every member's journal, not the module's own writes; two members reordering at once, a note
// added meanwhile, and a 40-note chapter dragged past the pane's end; every width, both themes.
// SKEW=034 with MODULE=module-0.34.0: no orders in the hello, an order kept and waiting, never handed
// over, words that say so, and Foundry's deletes not counted (step 10 alone). Synthetic characters
// only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to
// SHOTS.
import {
  BASE, BOB, SKEW034, addPageInFoundry, books, browse, call, character, check, deleteInFoundry, dragInFoundry, finish,
  foundryWorld, group, hold, journal, journalWrites, lastHello, launch, newCampaign, note, notesFormat, pagesOf, part,
  posted, postsOf, same, settled, shoot, shootBoth, sideways, sql, startModule, theme, until, wait,
} from './world-030.mjs'
import {
  announced, boxOf, button, cardCounts, closeJournal, contents, contentsPane, dragRow, editorOf, header, headerLastChanged,
  journalCard, journalOf, listed, moveMenu, moveTo, notesIn, openJournal, openReorder, pickGroup, pickNote, reader,
  readerShows, readerTitle, reorder, reorderList, gripOf, said, saveOrder, writeNote,
} from './journal-ui.mjs'

const GAME = 'https://iron-hills.forge-vtt.com'
const TITLE = 'Erebor'
const SECRET = 'erebor-notes-order-35'
const PARTY = 'The Iron Company'
const JOURNAL = `${PARTY}’s Journal`
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'iron-hills.forge-vtt.com', secret: SECRET })
await foundryWorld()
game.modules.get('sending-stone').version = SKEW034 ? '0.34.0' : '0.35.0'

// ---- The world ----
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, con: 2 }, hp: { value: 30, max: 38, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
group('company', PARTY, { members: [thorin, vex], ownership: { alice: 3, bob: 2 }, description: { full: '<p>Bound for the mountain.</p>' } })
const erebor = { id: 'erebor', title: TITLE, characters: ['thorin', 'vex'], groups: ['company'], rolls: false }
await startModule({ campaigns: [erebor], secrets: { erebor: SECRET } })
await settled()

// ---- What's kept and posted ----
const partyBook = () => journal('party', 'company', 'erebor')
const personalBook = () => journal('personal', 'thorin', 'erebor')
const pagesIn = entry => (entry ? pagesOf(entry) : [])
const pageNamed = (entry, name) => pagesIn(entry).find(p => p.name === name) ?? null
/** A journal's pages as groups, in Foundry's order: '' the notes before the first chapter page, then each chapter's. */
const foundryGroups = entry => {
  const groups = { '': [] }
  let at = ''
  for (const page of pagesIn(entry)) {
    if (page.title?.level === 1) { at = page.name; groups[at] = [] } else groups[at].push(page.name)
  }
  return groups
}
const orderRows = () => JSON.parse(sql(`select coalesce(json_agg(o order by o."createdAt")::text, '[]') from (select o.id, o.seq, o."chapterId", o.ids, o.was, o.status, o.reason, o."createdAt", b.kind from journal_order o join journal_book b on b.id = o."bookId" where b."campaignId" = '${A}') o`))
const bookRecord = kind => JSON.parse(sql(`select coalesce(json_agg(b)::text, '[]') from (select "changedAt", "changedBy", "changedIn" from journal_book where "campaignId" = '${A}' and kind = '${kind}') b`))[0] ?? null
/** The note commands the app handed the module, as its answers to the module's fetches said. */
const handed = () => postsOf('fetch').filter(p => p.url.endsWith('/api/bridge/commands') && p.status === 200)
  .flatMap(p => { try { return JSON.parse(p.body).commands ?? [] } catch { return [] } }).filter(c => c.kind === 'note')

// ---- Alice plays Thorin on a laptop and a phone; Bob follows the invite and chooses Vex ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const ALICE_PARTY = '/characters/sheet-thorin/party/company'
const alice = await browse({ width: 1280, height: 800, path: ALICE_PARTY, toasts: false })
const phone = await browse({ width: 390, height: 844, path: ALICE_PARTY, toasts: false })
const bob = await browse({ width: 768, height: 1024, scheme: 'dark', who: BOB, toasts: false })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const vexSheet = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)
const BOB_PARTY = `/characters/${vexSheet}/party/company`
await bob.page.goto(`${BASE}${BOB_PARTY}`)
const API = { alice: `/api${ALICE_PARTY}`, bob: `/api${BOB_PARTY}`, gm: `/api/campaigns/${A}/party/company`, mine: '/api/characters/sheet-thorin' }

const bookOf = async (who, api) => (await call(who.page, `${api}/notes`)).json
const entryIn = (view, title) => view?.entries?.find(e => e.title === title) ?? null
const chapterIn = (view, title) => view?.chapters?.find(c => c.title === title) ?? null
const groupIn = (view, chapterId) => view?.groups?.find(g => g.chapterId === chapterId) ?? null
async function noted(who, api, title, { state = 'synced', chapter = false, ms = 30_000 } = {}) {
  let last
  await until(async () => {
    last = (chapter ? chapterIn : entryIn)(await bookOf(who, api), title)
    return last && (!state || (last.state === state))
  }, `"${title}" ${state ?? 'listed'} in ${api}'s notes (${JSON.stringify(last?.state)})`, ms)
  return last
}
/** A note or chapter written through a seat's API, as a page would; its id. */
async function post(who, api, body) {
  const made = await call(who.page, `${api}/notes`, { method: 'POST', body })
  if (made.status !== 201) throw new Error(`POST ${JSON.stringify(body)} to ${api}: ${made.status} ${made.text}`)
  return made.json.id
}
/** The party sheet's Description tab, and its Journal card read. */
async function description(who) {
  await who.page.getByRole('tablist', { name: 'Party sheet' }).getByRole('tab', { name: 'Description', exact: true }).click()
  const card = journalCard(who.page)
  await card.waitFor({ timeout: 15_000 })
  await until(async () => !/^(Loading notes…|Notes couldn’t)/.test(await cardCounts(card).textContent()), 'the card read', 15_000)
}
const resize = async (who, width, height) => {
  await who.page.setViewportSize({ width, height })
  who.width = width
  await wait(300)
}
const focused = who => who.page.evaluate(() => {
  const el = document.activeElement
  return { tag: el?.tagName, label: el?.getAttribute('aria-label'), text: el?.textContent?.trim().slice(0, 80) }
})
/** What the header said, once it says something matching. */
async function saidNow(dialog, test = text => text !== '') {
  let text = ''
  await until(async () => test(text = (await said(dialog).textContent()).trim()), `the header to say it (${JSON.stringify(text)})`, 15_000)
  return text
}
/** A group page's cards, by title, in order. */
const cards = dialog => reader(dialog).locator('article article h4').allTextContents()
/** Until a group's page in the reader lists these cards. */
const cardsAre = (dialog, titles, what, ms = 15_000) => until(async () => same(await cards(dialog), titles), `${what} (${JSON.stringify(titles)})`, ms)

await alice.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
await description(alice)

if (SKEW034) {
  // =================================================================================================
  // 10. Module 0.34.0
  // =================================================================================================
  part('10. module 0.34.0')
  const features = lastHello('erebor').data.features
  check(same(features.notes, { enabled: true, kinds: ['personal', 'party'], reason: null, journals: [] }) && await notesFormat('erebor') === null,
    `module 0.34.0's hello says notes are kept, nothing of orders or who changed a journal (${JSON.stringify(features.notes)})`)
  const road = await post(alice, API.gm, { role: 'chapter', title: 'Road' })
  for (const title of ['First', 'Second', 'Third']) await post(alice, API.alice, { role: 'entry', title, body: `${title}.`, chapterId: road })
  await noted(alice, API.alice, 'Third')
  const dialog = await openJournal(alice.page, JOURNAL)
  await until(async () => same(await notesIn(dialog, 'Road'), ['First', 'Second', 'Third']), 'the chapter listed', 15_000)
  const before = foundryGroups(partyBook()).Road
  const answer = await reorder(dialog, 'Road', ['Third', 'First', 'Second'], { by: 'buttons' })
  const words = await saidNow(dialog, text => /^Order saved/.test(text))
  check(answer === null && words === 'Order saved. It goes to Foundry once your Gamemaster’s game has Sending Stone 0.35.0 or later.',
    `Alice reorders Road: "${words}"`)
  await reader(dialog).getByText('Order waiting for the game', { exact: true }).waitFor({ timeout: 10_000 })
  const BANNER = 'The new order is kept here for now. It reaches Foundry once your Gamemaster’s game connects with Sending Stone 0.35.0 or later.'
  await dialog.getByText(BANNER, { exact: true }).waitFor({ timeout: 10_000 })
  const status = header(dialog).getByText('1 waiting', { exact: true })
  check(await status.isVisible() && same(await cards(dialog), ['Third', 'First', 'Second']),
    `its page says "Order waiting for the game", the journal "${BANNER}", the header "1 waiting", and the order is shown at once`)
  await shootBoth(alice, 'journal-order-skew034')
  const rows = orderRows()
  check(rows.length === 1 && rows[0].status === 'pending', `the order kept, waiting (${JSON.stringify(rows)})`)
  // Several of the module's fetches go by: removals keep it fetching under dnd5e, and it's handed no order.
  const from = postsOf('fetch').length
  await until(() => postsOf('fetch').length >= from + 3, 'three more fetches for commands', 60_000)
  check(handed().every(c => c.note?.op !== 'order') && same(foundryGroups(partyBook()).Road, before) && orderRows()[0].status === 'pending',
    `no answer to the module's fetches carries an order; Foundry's Road is as it was (${JSON.stringify(before)}), the order still waiting`)
  await writeNote(dialog, { title: 'Fourth', body: 'Still syncs.', chapter: 'Road' })
  await noted(alice, API.alice, 'Fourth')
  check(Boolean(pageNamed(partyBook(), 'Fourth')), 'a note made meanwhile still reaches Foundry')
  const line = await headerLastChanged(dialog)
  await deleteInFoundry('gm', pageNamed(partyBook(), 'First'))
  await until(async () => !entryIn(await bookOf(alice, API.alice), 'First'), 'First gone from the view', 20_000)
  await wait(1500)
  check(bookRecord('party')?.changedIn !== 'foundry' && books('erebor', 'party', 'company').every(p => !('changed' in (p.data.journal ?? {}))),
    `the Gamemaster's delete in Foundry doesn't move the line, as 0.34.0 doesn't say who changed a journal (${line} → ${await headerLastChanged(dialog)})`)
  const first = bookRecord('party')
  await pickNote(dialog, 'Second')
  await button(reader(dialog), 'Delete Second').click()
  await button(alice.page.getByRole('dialog', { name: 'Delete Second?', exact: true }), 'Delete').click()
  await saidNow(dialog, text => text === 'Deleted.')
  await until(() => bookRecord('party')?.changedBy === 'Thorin' && bookRecord('party').changedIn === 'app', "the app's delete recorded", 10_000)
  await until(async () => await headerLastChanged(dialog) === 'Last changed by Thorin, just now', 'the line', 10_000)
  const after = bookRecord('party')
  check(!first?.changedAt || Date.parse(after.changedAt) > Date.parse(first.changedAt),
    `an app delete does: "Last changed by Thorin, just now", the book's record moved on (${JSON.stringify(first)} → ${JSON.stringify(after)})`)
  await finish()
}

// =================================================================================================
// 1. Reorder by drag
// =================================================================================================
part('1. reorder by drag')
check(await notesFormat('erebor') === 2 && same(lastHello('erebor').data.features.notes, { enabled: true, kinds: ['personal', 'party'], reason: null, journals: [], orders: true, changes: true }),
  'the module keeps the app\'s answer, notes format 2, and its hello says it takes orders and says who changed a journal')
// Road: Bob's note, the Gamemaster's, and one written in Foundry.
const ROAD = await post(bob, API.bob, { role: 'chapter', title: 'Road' })
await post(bob, API.bob, { role: 'entry', title: 'Wolves', body: 'Wargs on the ridge.', chapterId: ROAD })
await noted(bob, API.bob, 'Wolves')
await post(alice, API.gm, { role: 'entry', title: 'Camp', body: 'By the lake.', chapterId: ROAD })
await noted(alice, API.alice, 'Camp')
await addPageInFoundry('gm', partyBook(), { name: 'Old map', title: { show: true, level: 2 }, text: { format: 2, markdown: 'An old map.', content: '<p>An old map.</p>' } })
await noted(alice, API.alice, 'Old map')
let dialog = await openJournal(alice.page, JOURNAL)
{
  await until(async () => same(await notesIn(dialog, 'Road'), ['Wolves', 'Camp', 'Old map']), 'Road listed', 15_000)
  const sortsBefore = Object.fromEntries(pagesIn(partyBook()).map(p => [p.name, p.sort]))
  const writesFrom = journalWrites.length
  await openReorder(dialog, 'Road')
  check(same(await reorderList(dialog), ['Wolves', 'Camp', 'Old map']) && await reader(dialog).getByText(`Everyone in ${PARTY} sees the notes in this order, here and in Foundry.`, { exact: true }).isVisible(),
    `Reorder Road: its notes in order, "Everyone in ${PARTY} sees the notes in this order, here and in Foundry."`)
  // The third grip dragged above the first with the mouse, held mid-way to see the rows make room.
  const page = alice.page
  const grip = await gripOf(dialog, 'Old map').boundingBox()
  const first = await gripOf(dialog, 'Wolves').boundingBox()
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2, first.y + first.height * 0.2, { steps: 14 })
  await wait(300)
  const shifts = await reader(dialog).locator('ul > li').evaluateAll(lis => lis.map(li => li.style.transform || ''))
  await shootBoth(alice, 'journal-reorder-drag')
  await page.mouse.up()
  check(/translateY\(\d/.test(shifts[0]) && /translateY\(\d/.test(shifts[1]) && /translateY\(-/.test(shifts[2]),
    `mid-drag the rows shift: the dragged one up with the pointer, the two above it down to make room (${JSON.stringify(shifts)})`)
  await until(async () => same(await reorderList(dialog), ['Old map', 'Wolves', 'Camp']), 'the drop', 5_000)
  const answer = await saveOrder(dialog)
  const words = await saidNow(dialog, text => /^Order saved/.test(text))
  check(answer === null && words === 'Order saved.' && same(await cards(dialog), ['Old map', 'Wolves', 'Camp']),
    `dropped above the first: Old map, Wolves, Camp; Save order: "${words}", the page in that order at once`)
  await until(() => same(foundryGroups(partyBook()).Road, ['Old map', 'Wolves', 'Camp']), "Foundry's pages in that order", 20_000)
  const command = handed().find(c => c.note?.op === 'order')
  await until(() => postsOf('command.result').some(p => p.data.id === command?.id), "the order's result", 15_000)
  const result = postsOf('command.result').find(p => p.data.id === command?.id)
  const changed = pagesIn(partyBook()).filter(p => p.sort !== sortsBefore[p.name]).map(p => p.name)
  const updates = journalWrites.slice(writesFrom).filter(w => w[0] === 'updateMany' || w[0] === 'update')
  const keys = [...new Set(updates.flatMap(w => (w[0] === 'updateMany' ? w[2] : [w[2]]).flatMap(u => Object.keys(u))))]
  check(same(Object.keys(command?.note ?? {}), ['book', 'op', 'chapter', 'ids', 'was', 'writer', 'at']) && command.note.book === 'party' && command.note.chapter === ROAD && command.note.writer === 'thorin',
    `the app hands the module an order, its note exactly { book, op, chapter, ids, was, writer, at }, Thorin its writer (${JSON.stringify(command?.note)})`)
  check(result?.data.status === 'done' && changed.every(name => ['Old map', 'Wolves', 'Camp'].includes(name)) && changed.length > 0
    && keys.every(k => ['_id', 'sort', 'flags', 'flags.sending-stone.foundry'].includes(k)),
    `the module makes it, no not-yours though none of them is Alice's: only Road's notes' sorts change in Foundry (${JSON.stringify({ status: result?.data.status, reason: result?.data.reason, changed, keys })})`)
  await pickNote(dialog, 'Old map')
  const lines = await reader(dialog).locator('article > h3 + p > span').allTextContents()
  check(lines[1]?.trim() === 'Last changed by Gamemaster in Foundry, just now' && lines[0]?.trim().startsWith('Written in Foundry'),
    `the Foundry-written note still says "${lines[1]?.trim()}"`)
}

// =================================================================================================
// 2. Reorder by keys
// =================================================================================================
part('2. reorder by keys')
await description(phone)
let phoneDialog = await openJournal(phone.page, JOURNAL)
{
  await until(async () => same(await notesIn(phoneDialog, 'Road'), ['Old map', 'Wolves', 'Camp']), "the phone's journal to show the order", 15_000)
  await openReorder(phoneDialog, 'Road')
  await gripOf(phoneDialog, 'Old map').focus()
  await phone.page.keyboard.press('ArrowDown')
  await phone.page.keyboard.press('ArrowDown')
  await until(async () => (await announced(phoneDialog).textContent()).trim() === 'Old map, now 3 of 3.', 'the announcement', 5_000)
  const focus = await focused(phone)
  check(same(await reorderList(phoneDialog), ['Wolves', 'Camp', 'Old map']) && focus.label === 'Reorder Old map: drag it, or press the up and down arrows',
    `at 390, Down twice on Old map's grip: the live region says "${(await announced(phoneDialog).textContent()).trim()}", focus still on its grip`)
  const answer = await saveOrder(phoneDialog)
  check(answer === null, 'Save order')
  await until(() => same(foundryGroups(partyBook()).Road, ['Wolves', 'Camp', 'Old map']), 'Foundry in that order', 20_000)
  check(true, "Foundry's pages follow: Wolves, Camp, Old map")
}

// =================================================================================================
// 3. Reorder by buttons
// =================================================================================================
part('3. reorder by buttons')
await bob.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
await description(bob)
let bobDialog = await openJournal(bob.page, JOURNAL)
{
  await until(async () => same(await notesIn(bobDialog, 'Road'), ['Wolves', 'Camp', 'Old map']), "Bob's journal to show it", 15_000)
  await openReorder(bobDialog, 'Road')
  const firstUp = button(reader(bobDialog), 'Move Wolves up')
  check(await firstUp.isDisabled() && await button(reader(bobDialog), 'Move Old map down').isDisabled() && await button(reader(bobDialog), 'Save order').isDisabled(),
    "at 768 Bob's Reorder: the first's up button and the last's down button are off, and Save order is off till the order changes")
  await button(reader(bobDialog), 'Move Camp up').click()
  await until(async () => same(await reorderList(bobDialog), ['Camp', 'Wolves', 'Old map']), 'the move', 5_000)
  const focus = await focused(bob)
  check(focus.label === 'Reorder Camp: drag it, or press the up and down arrows' && (await announced(bobDialog).textContent()).trim() === 'Camp, now 1 of 3.',
    `Move Camp up: Camp first, focus on its grip, "Camp, now 1 of 3." said (${JSON.stringify(focus)})`)
  check(await saveOrder(bobDialog) === null, 'Save order')
  const at = Date.now()
  await pickGroup(dialog, 'Road')
  await cardsAre(dialog, ['Camp', 'Wolves', 'Old map'], "Alice's reader to follow", 8_000)
  check(Date.now() - at < 8_000, `Alice's reader follows within a poll (${Date.now() - at} ms)`)
  await until(() => same(foundryGroups(partyBook()).Road, ['Camp', 'Wolves', 'Old map']), 'Foundry in that order', 20_000)
  await until(async () => await headerLastChanged(dialog) === 'Last changed by Vex, just now', "Bob's order on Alice's header", 10_000)
  check(true, 'Alice\'s header: "Last changed by Vex, just now"')
}

// =================================================================================================
// 4. The notes in no chapter
// =================================================================================================
part('4. the notes in no chapter')
{
  for (const title of ['A', 'B', 'C']) await post(alice, API.alice, { role: 'entry', title, body: `${title}.`, chapterId: null })
  await noted(alice, API.alice, 'C')
  await until(async () => same(await notesIn(dialog, 'Not in a chapter'), ['A', 'B', 'C']), 'A, B, C listed', 15_000)
  check(await reorder(dialog, 'Not in a chapter', ['C', 'A', 'B'], { by: 'keys' }) === null, 'the notes in no chapter reordered to C, A, B by keys')
  await until(() => same(foundryGroups(partyBook())[''], ['C', 'A', 'B']), 'Foundry in that order', 20_000)
  await writeNote(dialog, { title: 'D', body: 'Last.', chapter: null })
  await noted(alice, API.alice, 'D')
  await until(() => same(foundryGroups(partyBook())[''], ['C', 'A', 'B', 'D']), 'D last in Foundry', 20_000)
  await until(async () => same(await notesIn(dialog, 'Not in a chapter'), ['C', 'A', 'B', 'D']), 'D last in the contents', 10_000)
  check(true, 'New note D lands last of them, C, A, B, D, not by when they were written, in the app and in Foundry')
  // A chapter whose notes are all younger than A; A moved into it lands last.
  const later = await post(alice, API.alice, { role: 'chapter', title: 'Later' })
  for (const title of ['L1', 'L2']) await post(alice, API.alice, { role: 'entry', title, body: `${title}.`, chapterId: later })
  await noted(alice, API.alice, 'L2')
  await until(async () => same(await notesIn(dialog, 'Later'), ['L1', 'L2']), 'Later listed', 15_000)
  const a = pageNamed(partyBook(), 'A')
  const held = hold('update', doc => doc.id === a.id)
  await pickNote(dialog, 'A')
  await moveTo(dialog, 'A', 'Later')
  const words = await saidNow(dialog, text => /^Moved/.test(text))
  await until(async () => same(await notesIn(dialog, 'Later'), ['L1', 'L2', 'A']), 'A last in Later, in the app', 10_000)
  check(words === 'Moved to Later.' && same(foundryGroups(partyBook())[''], ['C', 'A', 'B', 'D']),
    `A, older than every note of Later, moved into it: "${words}", last there in the app at once, while Foundry has yet to make it`)
  await shootBoth(alice, 'journal-moved')
  await until(() => held.held, "the move at Foundry's write", 20_000).catch(() => {})
  held.release()
  await until(() => same(foundryGroups(partyBook()).Later, ['L1', 'L2', 'A']), 'A last in Later in Foundry', 20_000)
  check(true, 'and last in Later in Foundry once made')
}

// =================================================================================================
// 5. Cancel and Escape
// =================================================================================================
part('5. cancel and Escape')
{
  const before = orderRows().map(r => [r.id, r.seq, r.status])
  await openReorder(dialog, 'Road')
  await button(reader(dialog), 'Move Old map up').click()
  await until(async () => same(await reorderList(dialog), ['Camp', 'Old map', 'Wolves']), 'the move', 5_000)
  await button(reader(dialog), 'Cancel').click()
  await readerShows(dialog, 'Road')
  await until(async () => (await focused(alice)).text === 'Reorder', 'focus on Reorder', 5_000)
  check(same(await cards(dialog), ['Camp', 'Wolves', 'Old map']), 'Reorder, a move, Cancel: unchanged, focus on Reorder')
  await openReorder(dialog, 'Road')
  await gripOf(dialog, 'Wolves').focus()
  await alice.page.keyboard.press('ArrowDown')
  await until(async () => same(await reorderList(dialog), ['Camp', 'Old map', 'Wolves']), 'the move', 5_000)
  await alice.page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
  await wait(1500)
  check(same(orderRows().map(r => [r.id, r.seq, r.status]), before) && same(foundryGroups(partyBook()).Road, ['Camp', 'Wolves', 'Old map']),
    'Reorder, a move, Escape: the journal closes, nothing saved')
  dialog = await openJournal(alice.page, JOURNAL)
}

// =================================================================================================
// 6. Locked
// =================================================================================================
part('6. locked')
{
  await openReorder(dialog, 'Road')
  const pane = contentsPane(dialog)
  check(await pane.evaluate(el => el.inert) && await pane.getByText('Save or cancel the new order first.', { exact: true }).isVisible(),
    'with Reorder open the contents are inert: "Save or cancel the new order first."')
  await button(reader(dialog), 'Cancel').click()
  await readerShows(dialog, 'Road')
  await pickNote(dialog, 'D')
  await button(reader(dialog), 'Edit D').click()
  await editorOf(dialog, 'Edit D').waitFor()
  check(await pane.evaluate(el => el.inert) && await pane.getByText('Save or cancel to read another note.', { exact: true }).isVisible(),
    'with the editor open: "Save or cancel to read another note."')
  await button(editorOf(dialog, 'Edit D'), 'Cancel').click()
  await editorOf(dialog, 'Edit D').waitFor({ state: 'detached' })
}

// =================================================================================================
// 7. Foundry reorders
// =================================================================================================
part('7. Foundry reorders')
{
  await pickGroup(dialog, 'Road')
  const [one, two] = foundryGroups(partyBook()).Road
  const at = Date.now()
  await dragInFoundry('gm', [pageNamed(partyBook(), two), pageNamed(partyBook(), one)])
  const want = foundryGroups(partyBook()).Road
  await cardsAre(dialog, want, "Alice's reader to show Foundry's order", 8_000)
  await until(async () => await headerLastChanged(dialog) === 'Last changed by Gamemaster, just now', 'the header', 8_000)
  const took = Date.now() - at
  const changed = books('erebor', 'party', 'company').at(-1).data.journal.changed
  check(took < 5000 && changed?.what === 'order' && changed.by === 'Gamemaster',
    `the Gamemaster drags ${two} above ${one} in Foundry: within 5 s Alice's reader shows ${JSON.stringify(want)}, the header "Last changed by Gamemaster, just now" (${took} ms; ${JSON.stringify(changed)})`)
  await writeNote(dialog, { title: 'Trail', body: 'A new note.', chapter: 'Road' })
  await noted(alice, API.alice, 'Trail')
  await until(() => same(foundryGroups(partyBook()).Road, [...want, 'Trail']), 'Foundry', 20_000)
  check(true, `the next note Alice adds keeps that order, not put back: ${JSON.stringify(foundryGroups(partyBook()).Road)}`)
}

// =================================================================================================
// 8. Foundry deletes
// =================================================================================================
part('8. Foundry deletes')
{
  await deleteInFoundry('gm', pageNamed(partyBook(), 'Trail'))
  await until(async () => !entryIn(await bookOf(alice, API.alice), 'Trail'), 'Trail gone', 20_000)
  const lines = {}
  for (const [name, d] of [['alice', dialog], ['bob', bobDialog]]) {
    await until(async () => await headerLastChanged(d) === 'Last changed by Gamemaster, just now', `${name}'s header`, 10_000)
    lines[name] = await headerLastChanged(d)
  }
  for (const [name, who, d] of [['alice', alice, dialog], ['bob', bob, bobDialog]]) {
    await closeJournal(d)
    await until(async () => / · Last changed by Gamemaster, just now$/.test(await cardCounts(journalCard(who.page)).textContent()), `${name}'s card`, 10_000)
    lines[`${name} card`] = (await cardCounts(journalCard(who.page)).textContent()).trim()
  }
  check(bookRecord('party')?.changedBy === 'Gamemaster' && bookRecord('party').changedIn === 'foundry',
    `the Gamemaster deletes a note in Foundry: every member's header and card say "Last changed by Gamemaster, just now" (${JSON.stringify(lines)})`)
  dialog = await openJournal(alice.page, JOURNAL)
  bobDialog = await openJournal(bob.page, JOURNAL)
  // Alice's own journal: her page deleted by her in Foundry, then a page only the Gamemaster sees.
  for (const title of ['Diary 1', 'Diary 2', 'Diary 3']) await post(alice, API.mine, { role: 'entry', title, body: `${title}.`, chapterId: null })
  await noted(alice, API.mine, 'Diary 3')
  await until(() => pageNamed(personalBook(), 'Diary 3'), 'her journal in Foundry', 20_000)
  await addPageInFoundry('gm', personalBook(), { name: 'GM aside', title: { show: true, level: 2 }, ownership: { default: 0, alice: 0 }, text: { format: 2, markdown: 'Hidden.', content: '<p>Hidden.</p>' } })
  await settled(1200)
  await deleteInFoundry('alice', pageNamed(personalBook(), 'Diary 1'))
  await until(() => bookRecord('personal')?.changedIn === 'foundry', 'her delete recorded', 20_000)
  const record = bookRecord('personal')
  const mine = await bookOf(alice, API.mine)
  check(record.changedBy === 'Thorin' && mine.lastChange?.by === 'Thorin' && Date.parse(mine.lastChange.at) === Date.parse(record.changedAt),
    `Alice, Owner of her own journal, deletes her page in Foundry as herself: its line "Last changed by Thorin", from Foundry (${JSON.stringify(record)})`)
  await deleteInFoundry('gm', pageNamed(personalBook(), 'GM aside'))
  await settled(1200)
  await wait(1000)
  check(same(bookRecord('personal'), record), `the Gamemaster deletes a page only he sees there: the line doesn't move (${JSON.stringify(bookRecord('personal'))})`)
}

// =================================================================================================
// 9. The module's own writes
// =================================================================================================
part("9. the module's own writes")
{
  await biographyCard()
  const mineDialog = await openJournal(alice.page, 'My Journal')
  check(await reorder(mineDialog, 'Not in a chapter', ['Diary 3', 'Diary 2'], { by: 'buttons' }) === null, 'Alice reorders her own notes')
  await until(() => same(foundryGroups(personalBook())[''], ['Diary 3', 'Diary 2']), 'Foundry in that order', 20_000)
  await until(async () => groupIn(await bookOf(alice, API.mine), null)?.state === 'synced', 'the order made', 15_000)
  await settled(1200)
  await wait(1000)
  const record = bookRecord('personal')
  check(record.changedBy === 'Thorin' && record.changedIn === 'app' && await headerLastChanged(mineDialog) === 'Last changed by Thorin, just now',
    `the module makes her order in Foundry, as the Gamemaster's client: the line stays Thorin's, recorded by the app, never the Gamemaster's (${JSON.stringify(record)})`)
  await closeJournal(mineDialog)
  await alice.page.goto(`${BASE}${ALICE_PARTY}`)
  await alice.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
  await description(alice)
  dialog = await openJournal(alice.page, JOURNAL)
}
/** Alice's own sheet, its Biography tab and her Journal card. */
async function biographyCard() {
  await closeJournal(dialog)
  await alice.page.goto(`${BASE}/characters/sheet-thorin`)
  await alice.page.getByRole('tablist', { name: 'Character sheet' }).getByRole('tab', { name: /^Biography/ }).click()
  await journalCard(alice.page).waitFor({ timeout: 15_000 })
}

// =================================================================================================
// 11. Widths, both themes
// =================================================================================================
part('11. widths')
{
  await closeJournal(phoneDialog)
  for (const [who, width, height] of [[phone, 360, 800], [phone, 390, 844], [phone, 768, 1024], [alice, 1280, 800]]) {
    await resize(who, width, height)
    if (who === phone) await description(phone)
    const d = who === alice ? dialog : await openJournal(phone.page, JOURNAL)
    for (const scheme of ['light', 'dark']) {
      await theme(who, scheme)
      await openReorder(d, 'Road')
      const look = await d.evaluate(el => {
        const pane = el.querySelector('[id$="-contents"] + *')
        const rows = [...pane.querySelectorAll('ul > li')].map(li => li.getBoundingClientRect())
        const box = el.getBoundingClientRect()
        return { modalX: el.scrollWidth - el.clientWidth, fits: rows.every(r => r.left >= box.left - 0.5 && r.right <= box.right + 0.5) }
      })
      const pageX = await sideways(who.page)
      check(pageX === 0 && look.modalX === 0 && look.fits, `at ${width} px, ${scheme}: Reorder's rows fit, nothing scrolls sideways (${JSON.stringify({ pageX, ...look })})`)
      if ([390, 1280].includes(width)) await shoot(who, 'journal-reorder')
      await button(reader(d), 'Cancel').click()
      await readerShows(d, 'Road')
      await pickNote(d, 'D')
      await button(reader(d), 'Move D to a chapter').click()
      const menu = moveMenu(d)
      await menu.waitFor({ timeout: 5_000 })
      const items = await menu.getByRole('menuitemradio').evaluateAll(els => els.map(e => ({ name: e.textContent.trim(), checked: e.getAttribute('aria-checked'), off: e.disabled || e.getAttribute('aria-disabled') === 'true' })))
      const menuBox = await boxOf(menu)
      check(menuBox.left >= 0 && menuBox.right <= menuBox.vw + 0.5 && menuBox.bottom <= menuBox.vh + 0.5 && same(items.map(i => i.name), ['Road', 'Later'])
        && items.every(i => i.checked === 'false' && !i.off),
        `at ${width} px, ${scheme}: Move's menu, "Move to", lists Road and Later, inside the screen (${JSON.stringify({ items, menu: [menuBox.left, menuBox.right, menuBox.bottom] })})`)
      if ([390, 1280].includes(width)) await shoot(who, 'journal-move')
      await who.page.keyboard.press('Escape')
      await menu.waitFor({ state: 'hidden', timeout: 5_000 })
      check(await d.isVisible() && (await focused(who)).label === 'Move D to a chapter', `Escape closes the menu only, focus back on its button, the journal open`)
    }
    await theme(who, 'light')
    if (who === phone) await closeJournal(d)
  }
  await resize(phone, 390, 844)
}

// =================================================================================================
// 12. Two at once
// =================================================================================================
part('12. two at once')
{
  await pickGroup(dialog, 'Road')
  await pickGroup(bobDialog, 'Road')
  const start = foundryGroups(partyBook()).Road
  await cardsAre(bobDialog, start, "Bob's Road", 10_000)
  await openReorder(dialog, 'Road')
  await openReorder(bobDialog, 'Road')
  const hers = [start[2], start[0], start[1]]
  check(await reorder(dialog, 'Road', hers, { by: 'keys' }) === null, `Alice saves ${JSON.stringify(hers)}`)
  const his = [start[1], start[0], start[2]]
  const refused = await reorder(bobDialog, 'Road', his, { by: 'buttons' })
  check(refused === 'The order changed while you were arranging it. Cancel to see the latest, then try again.' && /^Reorder /.test((await readerTitle(bobDialog).textContent()).trim())
    && same(await reorderList(bobDialog), his),
    `Bob's Save order meanwhile: "${refused}", his pane kept with his order`)
  await button(reader(bobDialog), 'Cancel').click()
  await cardsAre(bobDialog, hers, "Bob's page to show Alice's order", 10_000)
  check(true, "Cancel shows Alice's order")
  // Hers made in Foundry first: while it's on its way another is refused as saving, a moment.
  await until(() => same(foundryGroups(partyBook()).Road, hers) && orderRows().every(r => r.status === 'made'), "Alice's order made", 20_000)
  const again = [hers[1], hers[2], hers[0]]
  const second = await reorder(bobDialog, 'Road', again, { by: 'buttons' })
  check(second === null, `Bob's new order, made from it, saves (${JSON.stringify(again)}${second ? `: ${second}` : ''})`)
  await until(() => same(foundryGroups(partyBook()).Road, again), "Foundry in Bob's order", 20_000)
  check(true, "and Foundry ends in Bob's")
}

// =================================================================================================
// 13. Added meanwhile
// =================================================================================================
part('13. added meanwhile')
{
  await pickGroup(dialog, 'Road')
  const now = foundryGroups(partyBook()).Road
  await cardsAre(dialog, now, "Alice's Road", 10_000)
  await openReorder(dialog, 'Road')
  await post(bob, API.bob, { role: 'entry', title: 'Trolls', body: 'Three of them.', chapterId: ROAD })
  await noted(bob, API.bob, 'Trolls')
  await wait(3500)
  const refused = await reorder(dialog, 'Road', [now[1], now[0], now[2]], { by: 'keys' })
  check(refused === 'The order changed while you were arranging it. Cancel to see the latest, then try again.' && !(await reorderList(dialog)).includes('Trolls'),
    `Alice's Reorder open as Bob adds Trolls to Road: it isn't in her list, and her Save order is refused: "${refused}"`)
  await button(reader(dialog), 'Cancel').click()
  await cardsAre(dialog, [...now, 'Trolls'], 'Trolls last', 10_000)
  check(true, 'Cancel shows Trolls last')
}

// =================================================================================================
// 14. A long list
// =================================================================================================
part('14. a long list')
{
  const LONG = await post(alice, API.gm, { role: 'chapter', title: 'Long road' })
  const titles = Array.from({ length: 40 }, (_, n) => `Mile ${String(n + 1).padStart(2, '0')}`)
  // Alice's and Bob's, each 30 changes a minute at most: one turned away waits, and goes again.
  for (const [n, title] of titles.entries()) {
    const [who, api] = [[alice, API.alice], [bob, API.bob]][n % 2]
    const end = Date.now() + 90_000
    let made
    while ((made = await call(who.page, `${api}/notes`, { method: 'POST', body: { role: 'entry', title, body: `${title}.`, chapterId: LONG } })).status === 429 && Date.now() < end) await wait(3000)
    if (made.status !== 201) throw new Error(`POST ${title}: ${made.status} ${made.text}`)
  }
  await noted(alice, API.alice, 'Mile 40')
  await description(phone)
  phoneDialog = await openJournal(phone.page, JOURNAL)
  await until(async () => same(await notesIn(phoneDialog, 'Long road'), titles), 'the 40 listed', 20_000)
  await openReorder(phoneDialog, 'Long road')
  const scroller = reader(phoneDialog).locator('div.overflow-y-auto').first()
  const top = await scroller.evaluate(el => el.scrollTop)
  // The pane's end before the drag: held at its bottom, the drag scrolls to it and no further.
  const scrollEnd = await scroller.evaluate(el => el.scrollHeight - el.clientHeight)
  const paneBox = await boxOf(scroller)
  const grip = await gripOf(phoneDialog, 'Mile 02').boundingBox()
  const page = phone.page
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  // Down to the pane's bottom edge, and held there while it scrolls.
  await page.mouse.move(grip.x + grip.width / 2, paneBox.bottom - 10, { steps: 20 })
  await wait(4000)
  await page.mouse.move(grip.x + grip.width / 2, paneBox.bottom - 12, { steps: 2 })
  await wait(300)
  const scrolled = await scroller.evaluate(el => el.scrollTop)
  await page.mouse.up()
  const after = await reorderList(phoneDialog)
  const place = after.indexOf('Mile 02') + 1
  check(scrolled > top + 500 && scrolled <= scrollEnd && place > 30,
    `a 40-note chapter at 390 × 844: Mile 02's grip dragged to the pane's bottom edge and held, the pane scrolls (${top} → ${scrolled} px, its end ${scrollEnd} px) and it lands where it's dropped, ${place} of 40`)
  await gripOf(phoneDialog, 'Mile 01').focus()
  await page.keyboard.press('End')
  await until(async () => (await reorderList(phoneDialog)).at(-1) === 'Mile 01', 'Mile 01 last', 5_000)
  await until(async () => (await announced(phoneDialog).textContent()).trim() === 'Mile 01, now 40 of 40.', 'the announcement', 5_000)
  check(true, 'End on Mile 01\'s grip moves it last: "Mile 01, now 40 of 40."')
  const final = await reorderList(phoneDialog)
  check(await saveOrder(phoneDialog) === null, 'Save order')
  await until(() => same(foundryGroups(partyBook())['Long road'], final), 'Foundry in that order', 30_000)
  check(true, 'Foundry holds the 40 in that order')
  await closeJournal(phoneDialog)
}

note(`journal writes in Foundry: ${journalWrites.length}; posts: ${posted.length}`)
await finish()
