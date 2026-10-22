// Journal notes, and orders of a group's notes, kept in the app while Foundry is closed, and synced after
// (module 0.35.0 and the app, its contract §13.4; module 0.34.0's §13.4 before it), end to end, in the
// world of world-030.mjs, with Foundry's journals the harness's stand-in (fvtt/journal-core.mjs). Alice
// runs Erebor, rolls and moves off, and plays Thorin; Bob plays Vex; the Iron Company, Alice's user its
// Owner and Bob's an Observer. Every journal is read and written through its card's modal
// (journal-ui.mjs). Foundry starts with module 0.33.0, which keeps no notes: what's written then waits,
// and reaches Foundry once the Gamemaster's page is reloaded with this module. Then, with Foundry
// "closed" (the module's fetches for commands held): a chapter and two notes written, one changed twice
// and the other deleted, fold to two writes, which wait, and go in the order written, with the times
// they were written, once Foundry is open again; the party's note shown to Bob at once. With no
// Gamemaster in Foundry, a note changed both there and in the app (Use yours, Keep Foundry's), deleted
// there while an edit waited (Add it again, Discard yours), and changed there while a delete waited
// (Delete anyway). A save while a change is still on its way (409 saving); a result lost on its way, the
// write handed over again after 75 s and made once; the Gamemaster's page reloaded while a note is being
// made, made once by the new page; the journal deleted in Foundry while no Gamemaster was there; two
// saves at once from two pages, of which one lands. Then orders: two made with Foundry closed, one
// folded, both made once it's open, from the order Foundry held; an order meeting a reorder made in
// Foundry meanwhile (Use yours, Keep Foundry's), or only a note added there (no question); and an
// order of a chapter deleted in Foundry meanwhile, dropped. Synthetic characters only. Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs, with TIMEOUT=600. Screenshots to
// SHOTS.
import { fileURLToPath } from 'node:url'
import {
  BASE, BOB, MODULE, addPageInFoundry, agePolls, browse, call, character, check, deleteInFoundry, dragInFoundry, editInFoundry,
  finish, foundryWorld, gmAway, gmBack, group, hold, journal, journalWrites, lastHello, launch, newCampaign, note, pagesOf, part,
  posted, postsOf, relay, reloadFoundry, same, settled, shootBoth, sql, startFetching, startModule, stopFetching, until, wait,
} from './world-030.mjs'
import {
  addChapter, button, contentsPane, editorOf, header, journalCard, notesIn, openJournal, pickNote, reader, readerShows, reorder,
  writeNote,
} from './journal-ui.mjs'

const OLD = fileURLToPath(new URL('./.out/module-0.33.0', import.meta.url))
const GAME = 'https://lake-town.forge-vtt.com'
const TITLE = 'Erebor'
const SECRET = 'erebor-offline-notes-35'
const PARTY = 'The Iron Company'
const MINE = 'My Journal'
const THEIRS = `${PARTY}’s Journal`
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'lake-town.forge-vtt.com', secret: SECRET })
await foundryWorld()
game.modules.get('sending-stone').version = '0.33.0'

// ---- The world ----
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, con: 2 }, hp: { value: 30, max: 38, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
group('company', PARTY, { members: [thorin, vex], ownership: { alice: 3, bob: 2 }, description: { full: '<p>Bound for the mountain.</p>' } })
const erebor = { id: 'erebor', title: TITLE, characters: ['thorin', 'vex'], groups: ['company'], rolls: false }
await startModule({ campaigns: [erebor], secrets: { erebor: SECRET }, module: OLD })
await settled()

// ---- What's kept and posted ----
const notesEnabled = () => sql(`select "notesEnabled" from campaign where id = '${A}'`)
const writeRows = kind => JSON.parse(sql(`select coalesce(json_agg(w order by w."createdAt")::text, '[]') from (select w.id, w.seq, w."noteId", w.op, w.role, w.title, w.body, w.status, w.reason, w."noteCreatedAt", w."createdAt", b.kind from journal_write w join journal_book b on b.id = w."bookId" where b."campaignId" = '${A}'${kind ? ` and b.kind = '${kind}'` : ''}) w`))
const orderRows = kind => JSON.parse(sql(`select coalesce(json_agg(o order by o."createdAt")::text, '[]') from (select o.id, o.seq, o."chapterId", o.ids, o.was, o.status, o.reason, o."createdAt", b.kind from journal_order o join journal_book b on b.id = o."bookId" where b."campaignId" = '${A}'${kind ? ` and b.kind = '${kind}'` : ''}) o`))
const personal = () => journal('personal', 'thorin', 'erebor')
const party = () => journal('party', 'company', 'erebor')
const pagesIn = entry => (entry ? pagesOf(entry) : [])
const pageNamed = (entry, name) => pagesIn(entry).find(p => p.name === name) ?? null
const flagsOf = page => page?.flags?.['sending-stone'] ?? null
/** A journal's pages as groups, in Foundry's order: '' the notes before the first chapter page, then each chapter's. */
const foundryGroups = entry => {
  const groups = { '': [] }
  let at = ''
  for (const page of pagesIn(entry)) {
    if (page.title?.level === 1) { at = page.name; groups[at] = [] } else groups[at].push(page.name)
  }
  return groups
}

sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const alice = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const aliceParty = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin/party/company', toasts: false })
const bob = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB, toasts: false })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const vexSheet = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)
await bob.page.goto(`${BASE}/characters/${vexSheet}/party/company`)
const API = { alice: '/api/characters/sheet-thorin', party: '/api/characters/sheet-thorin/party/company', bob: `/api/characters/${vexSheet}/party/company` }

const bookOf = async (who, api) => (await call(who.page, `${api}/notes`)).json
const entryIn = (view, title) => view?.entries?.find(e => e.title === title) ?? null
const chapterIn = (view, title) => view?.chapters?.find(c => c.title === title) ?? null
async function noted(who, api, title, { state = 'synced', chapter = false, ms = 30_000 } = {}) {
  let last
  await until(async () => {
    last = (chapter ? chapterIn : entryIn)(await bookOf(who, api), title)
    return last && (!state || (last.state === state))
  }, `"${title}" ${state ?? 'listed'} in ${api}'s notes (${JSON.stringify(last?.state)})`, ms)
  return last
}
/** The note's chip in the reader: where it stands. */
const chipOf = (dialog, words) => reader(dialog).locator('article').getByText(words, { exact: true })
/**
 * Until the reader's note is as the page last heard it from Foundry: no chip saying it's on its way. A
 * page polls every 3 s, so a change made just now in Foundry is shown a moment later; one acted on
 * before then is refused as changed meanwhile (its stamp is the earlier one's).
 */
const quiet = dialog => until(async () => (await reader(dialog).locator('article').getByText(/^(Saving to the game…|Waiting for the game|Deleted here, waiting for the game)$/).count()) === 0, 'the note to show it made', 15_000)
/** A note changed from its Edit, the note picked first: its text, and its title if said; from a note as made, unless `waiting`. */
async function edit(dialog, title, { body, retitle, waiting = false } = {}) {
  await pickNote(dialog, title)
  if (!waiting) await quiet(dialog)
  await button(reader(dialog), `Edit ${title}`).click()
  const form = editorOf(dialog, `Edit ${title}`)
  if (retitle) await form.getByLabel('Title', { exact: true }).fill(retitle)
  if (body !== undefined) await form.getByLabel('Note', { exact: true }).fill(body)
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
}
async function remove(dialog, title, { waiting = false } = {}) {
  await pickNote(dialog, title)
  if (!waiting) await quiet(dialog)
  await button(reader(dialog), `Delete ${title}`).click()
  await button(dialog.page().getByRole('dialog', { name: `Delete ${title}?`, exact: true }), 'Delete').click()
}
/** The Biography tab and Alice's own journal opened from its card. */
async function mine() {
  await alice.tab('Biography')
  await journalCard(alice.page).waitFor({ timeout: 15_000 })
  return openJournal(alice.page, MINE)
}
/** The party sheet's Description tab, and its journal opened from its card. */
async function partyJournal(who) {
  await who.page.getByRole('tablist', { name: 'Party sheet' }).getByRole('tab', { name: 'Description', exact: true }).click()
  await journalCard(who.page).waitFor({ timeout: 15_000 })
  return openJournal(who.page, THEIRS)
}
/** The contents' row of a note, by its title: its name and what its marks say. */
const contentsMark = (dialog, title) => contentsPane(dialog).locator('nav').evaluate((nav, title) => {
  const row = [...nav.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === title)
  return row ? (document.getElementById(row.getAttribute('aria-describedby'))?.textContent ?? '') : null
}, title)
/** The header's sync status line. */
const headerLine = async dialog => (await header(dialog).locator('div.text-xs').first().textContent()).trim()
/** Where a post was made in the module's order: its place in `posted`. */
const at = p => posted.indexOf(p)

// =================================================================================================
// 10. Written under module 0.33.0, reaching Foundry once it's this round's
// =================================================================================================
part('10. module 0.33.0, then 0.35.0')
let aliceJ, partyJ, bobJ
{
  check(!('notes' in (lastHello('erebor').data.features ?? {})) && notesEnabled() === 'f', "Foundry starts with module 0.33.0: its hello says nothing of notes, and the app keeps them off")
  aliceJ = await mine()
  const before = Date.now()
  await writeNote(aliceJ, { title: 'Before the update', body: 'Written while the module was 0.33.0.' })
  partyJ = await partyJournal(aliceParty)
  await writeNote(partyJ, { title: 'Party, before the update', body: 'For the whole company.' })
  const written = Date.now()
  await readerShows(aliceJ, 'Before the update')
  await chipOf(aliceJ, 'Waiting for the game').waitFor({ timeout: 15_000 })
  check(writeRows().length === 2 && writeRows().every(w => w.status === 'pending'), `both kept and waiting: two writes, pending (${JSON.stringify(writeRows().map(w => [w.title, w.status]))})`)
  await reloadFoundry({ module: MODULE, version: '0.35.0' })
  check(Boolean(lastHello('erebor').data.features.notes?.orders), "the Gamemaster updates the module and reloads Foundry: the new page's hello says notes are kept, and orders taken")
  await until(() => pageNamed(personal(), 'Before the update') && pageNamed(party(), 'Party, before the update'), 'both notes in Foundry', 30_000)
  const page = pageNamed(personal(), 'Before the update')
  check(notesEnabled() === 't' && flagsOf(page).createdAt >= before && flagsOf(page).createdAt <= written,
    `the notes written under 0.33.0 reach Foundry, each with the time it was written in the app (${new Date(flagsOf(page).createdAt).toISOString()})`)
  await noted(alice, API.alice, 'Before the update')
  await noted(aliceParty, API.party, 'Party, before the update')
}

// =================================================================================================
// 1. Foundry closed
// =================================================================================================
part('1. Foundry closed')
let closedAt
/** When the notes written with Foundry closed were written: from, to. */
let writtenOffline
{
  // Foundry closed for real: the app sees no fetch for 45 s, and says the notes wait.
  await stopFetching()
  closedAt = Date.now()
  await until(async () => (await bookOf(alice, API.alice)).live === false, "the app to count the game as closed", 60_000)
  check(Date.now() - closedAt >= 40_000, `Foundry closed: the app counts its game as not taking notes once it hasn't fetched for 45 s (${Math.round((Date.now() - closedAt) / 1000)} s)`)
  const written = { from: Date.now() }
  await addChapter(aliceJ, 'Day one')
  await writeNote(aliceJ, { title: 'Kept', body: 'First words.', chapter: 'Day one' })
  await writeNote(aliceJ, { title: 'Dropped', body: 'Soon gone.', chapter: 'Day one' })
  await edit(aliceJ, 'Kept', { body: 'Second words.', waiting: true })
  await edit(aliceJ, 'Kept', { body: 'Third and last words.', waiting: true })
  await remove(aliceJ, 'Dropped', { waiting: true })
  written.to = Date.now()
  await until(async () => !entryIn(await bookOf(alice, API.alice), 'Dropped'), 'Dropped gone from the list', 10_000)
  const rows = writeRows('personal').filter(w => w.status === 'pending')
  check(rows.length === 2 && same(rows.map(w => [w.role, w.op, w.title]), [['chapter', 'create', 'Day one'], ['entry', 'create', 'Kept']]) && rows[1].body === 'Third and last words.' && rows[1].seq === 2,
    `a chapter and two notes written, one changed twice and the other deleted: two writes wait, the chapter's create and Kept's, both changes folded into it; Dropped never reached Foundry, so its create is dropped (${JSON.stringify(rows.map(w => [w.title, w.op, w.seq]))})`)
  await pickNote(aliceJ, 'Kept')
  await chipOf(aliceJ, 'Waiting for the game').waitFor({ timeout: 15_000 })
  await until(async () => await headerLine(aliceJ) !== '' && /Game closed · 2 waiting/.test(await headerLine(aliceJ)), 'the header', 10_000)
  check(await contentsMark(aliceJ, 'Kept') === 'Waiting for the game',
    `its chip: "Waiting for the game", its row in the contents marked so, and the header "Game closed · 2 waiting" (${await headerLine(aliceJ)})`)
  await shootBoth(alice, 'notesoffline-waiting')
  writtenOffline = written
  await writeNote(partyJ, { title: 'Ambush', body: 'Goblins at the pass.', chapter: null })
  bobJ = await partyJournal(bob)
  await until(async () => (await notesIn(bobJ, 'Not in a chapter'))?.includes('Ambush'), 'Ambush on Bob\'s page', 10_000)
  await pickNote(bobJ, 'Ambush')
  check(await chipOf(bobJ, 'Waiting for the game').isVisible(), 'in the party\'s journal Alice writes "Ambush": Bob\'s journal shows it at once, "Waiting for the game"')
  await shootBoth(bob, 'notesoffline-party-waiting')
}

// =================================================================================================
// 2. Back
// =================================================================================================
part('2. back')
{
  const reopened = Date.now()
  startFetching()
  await until(async () => {
    const [own, theirs] = [await bookOf(alice, API.alice), await bookOf(bob, API.bob)]
    return [...own.entries, ...own.chapters, ...theirs.entries].every(n => n.state === 'synced')
  }, 'every note synced', 30_000)
  const took = Date.now() - reopened
  await until(async () => (await reader(aliceJ).getByText(/^(Waiting for the game|Saving to the game…)$/).count()) === 0 && await contentsMark(aliceJ, 'Kept') === '', 'the chips and marks to clear', 10_000)
  check(took < 30_000, `Foundry open again: within 30 s every chip and mark clears (${took} ms)`)
  const kept = pageNamed(personal(), 'Kept')
  const chapter = pageNamed(personal(), 'Day one')
  const { from, to } = writtenOffline
  check(kept?.text.markdown === 'Third and last words.' && flagsOf(kept).createdAt >= from && flagsOf(kept).createdAt <= to && flagsOf(kept).chapter === chapter?.id
    && !pageNamed(personal(), 'Dropped') && pageNamed(party(), 'Ambush'),
    `Foundry holds the chapter and Kept, with its last change's text and the time it was written, and no page for Dropped; Ambush in the party's journal (${new Date(flagsOf(kept).createdAt).toISOString()})`)
  const names = pagesIn(personal()).map(p => p.name)
  check(same(names, ['Before the update', 'Day one', 'Kept']), `in the order written (${JSON.stringify(names)})`)
}

// =================================================================================================
// 3. No Gamemaster, edited in Foundry: Use yours, Keep Foundry's
// =================================================================================================
part('3. changed in both places')
await writeNote(bobJ, { title: 'Wolves', body: 'Wargs on the ridge.', chapter: null })
await noted(bob, API.bob, 'Wolves')
const wolvesId = pageNamed(party(), 'Wolves').id
/** With no Gamemaster in Foundry: Bob's change in the app, waiting; Bob's own in Foundry; the Gamemaster back. */
async function bothPlaces({ app, foundry }) {
  await gmAway()
  agePolls(A)
  await edit(bobJ, 'Wolves', { body: app })
  await chipOf(bobJ, 'Waiting for the game').waitFor({ timeout: 15_000 })
  await editInFoundry('bob', wolvesId, { markdown: foundry })
  const from = posted.length
  await gmBack()
  await until(() => postsOf('command.result').some(p => at(p) >= from && p.data.note?.id === wolvesId), "the module's answer to Bob's change", 30_000)
  return from
}
{
  const from = await bothPlaces({ app: "Bob's version, from the app.", foundry: "Bob's version, from Foundry." })
  const hello = postsOf('bridge.hello').find(p => at(p) >= from)
  const book = postsOf('journal.updated').find(p => at(p) > at(hello) && p.data.kind === 'party')
  const result = postsOf('command.result').find(p => at(p) >= from && p.data.note?.id === wolvesId)
  check(hello?.data.features.notes.journals.some(j => j.kind === 'party' && j.actorId === 'company') && book && at(book) < at(result) && result.data.status === 'failed' && result.data.reason === 'changed',
    `the Gamemaster back: the hello lists the party's journal, then its book comes, then the write is refused, changed (${JSON.stringify({ journals: hello?.data.features.notes.journals, reason: result?.data.reason, order: posted.slice(from).filter(p => p.type !== 'fetch').map(p => `${p.type}${p.data?.kind ? `:${p.data.kind}` : ''}${p.data?.note ? `:${p.data.status}` : ''}`) })})`)
  await chipOf(bobJ, 'Changed in Foundry').waitFor({ timeout: 15_000 })
  const problem = reader(bobJ).getByRole('group', { name: 'Changed in Foundry' })
  check(await problem.getByText('Changed in Foundry by Vex while your edit waited. Foundry’s version is shown.', { exact: true }).isVisible()
    && await reader(bobJ).locator('.note-text').first().getByText("Bob's version, from Foundry.").isVisible() && await contentsMark(bobJ, 'Wolves') === 'Changed in Foundry',
    'Bob sees "Changed in Foundry by Vex while your edit waited. Foundry’s version is shown.", the contents marking it')
  await button(problem, 'Show yours').click()
  await problem.getByText("Bob's version, from the app.").waitFor({ timeout: 5_000 })
  check(true, 'Show yours shows his')
  await shootBoth(bob, 'notesoffline-conflict')
  await button(problem, 'Use yours').click()
  await until(() => pageNamed(party(), 'Wolves')?.text.markdown === "Bob's version, from the app.", 'his version in Foundry', 30_000)
  await noted(bob, API.bob, 'Wolves')
  check(true, 'Use yours: Foundry holds his')
}
{
  await bothPlaces({ app: 'Changed in the app again.', foundry: 'Changed in Foundry again.' })
  await chipOf(bobJ, 'Changed in Foundry').waitFor({ timeout: 15_000 })
  const problem = reader(bobJ).getByRole('group', { name: 'Changed in Foundry' })
  await button(problem, 'Keep Foundry’s').click()
  await problem.waitFor({ state: 'detached', timeout: 15_000 })
  await noted(bob, API.bob, 'Wolves')
  check(pageNamed(party(), 'Wolves').text.markdown === 'Changed in Foundry again.' && !writeRows('party').some(w => w.noteId === wolvesId && w.status !== 'made'),
    "again, Keep Foundry’s: Foundry's version stays, and the panel goes")
}

// =================================================================================================
// 4. Deleted in Foundry while an edit waited
// =================================================================================================
part('4. deleted in Foundry')
/** With no Gamemaster in Foundry: Bob's change in the app waiting, and his page deleted there by him; the Gamemaster back. */
async function deletedThere(body) {
  await gmAway()
  agePolls(A)
  await edit(bobJ, 'Wolves', { body })
  await chipOf(bobJ, 'Waiting for the game').waitFor({ timeout: 15_000 })
  await deleteInFoundry('bob', wolvesId)
  await gmBack()
  await chipOf(bobJ, 'Deleted in Foundry').waitFor({ timeout: 30_000 })
  return reader(bobJ).getByRole('group', { name: 'Deleted in Foundry' })
}
{
  let problem = await deletedThere('Changed, and deleted in Foundry meanwhile.')
  check(await problem.getByText('Deleted in Foundry while your edit waited.', { exact: true }).isVisible() && !pageNamed(party(), 'Wolves'),
    'Bob\'s note deleted in Foundry by him while his edit waited: "Deleted in Foundry while your edit waited."')
  await button(problem, 'Add it again').click()
  await until(() => pageNamed(party(), 'Wolves'), 'the note made again', 30_000)
  check(pageNamed(party(), 'Wolves').id === wolvesId && pageNamed(party(), 'Wolves').text.markdown === 'Changed, and deleted in Foundry meanwhile.',
    `Add it again: a page with the same id as before (${wolvesId}), with his text`)
  await noted(bob, API.bob, 'Wolves')
  problem = await deletedThere('Changed again, deleted again.')
  await button(problem, 'Discard yours').click()
  await until(async () => !entryIn(await bookOf(bob, API.bob), 'Wolves'), 'the note gone from his list', 15_000)
  check(!pageNamed(party(), 'Wolves'), 'a second round, Discard yours: gone')
}

// =================================================================================================
// 5. A delete that met a change
// =================================================================================================
part('5. a delete met a change')
{
  await writeNote(bobJ, { title: 'Signal fire', body: 'Lit at dusk.', chapter: null })
  await noted(bob, API.bob, 'Signal fire')
  const id = pageNamed(party(), 'Signal fire').id
  await gmAway()
  agePolls(A)
  await remove(bobJ, 'Signal fire')
  await pickNote(bobJ, 'Signal fire')
  await chipOf(bobJ, 'Deleted here, waiting for the game').waitFor({ timeout: 15_000 })
  await editInFoundry('bob', id, { markdown: 'Lit at dusk, and kept burning.' })
  await gmBack()
  await chipOf(bobJ, 'Changed in Foundry').waitFor({ timeout: 30_000 })
  const problem = reader(bobJ).getByRole('group', { name: 'Changed in Foundry' })
  check(await problem.getByText('Changed in Foundry by Vex, so it wasn’t deleted.', { exact: true }).isVisible() && Boolean(pageNamed(party(), 'Signal fire')),
    'Bob deletes it in the app while he changes it in Foundry: "Changed in Foundry by Vex, so it wasn’t deleted."')
  await button(problem, 'Delete anyway').click()
  await until(() => !pageNamed(party(), 'Signal fire'), 'deleted in Foundry', 30_000)
  check(true, 'Delete anyway: deleted')
}

// =================================================================================================
// 6. Saving while claimed
// =================================================================================================
part('6. saving while claimed')
{
  const kept = pageNamed(personal(), 'Kept')
  const held = hold('update', doc => doc.id === kept.id)
  await edit(aliceJ, 'Kept', { body: 'On its way.' })
  await until(() => held.held, "the change held at Foundry's write", 20_000)
  await chipOf(aliceJ, 'Saving to the game…').waitFor({ timeout: 15_000 })
  await button(reader(aliceJ), 'Edit Kept').click()
  const form = editorOf(aliceJ, 'Edit Kept')
  await form.getByLabel('Note', { exact: true }).fill('A second change, too soon.')
  await button(form, 'Save').click()
  const alert = form.getByRole('alert')
  await alert.waitFor({ timeout: 10_000 })
  check(await alert.textContent() === 'Your last change is still on its way to the game. Try again in a moment.' && await form.getByLabel('Note', { exact: true }).inputValue() === 'A second change, too soon.',
    `a second change while the first is being made: refused, 409 saving, "${await alert.textContent()}", its text kept`)
  const crafted = await call(alice.page, `${API.alice}/notes/${kept.id}`, { method: 'PATCH', body: { title: 'Kept', body: 'x', chapterId: flagsOf(kept).chapter, stamp: entryIn(await bookOf(alice, API.alice), 'Kept').stamp } })
  check(crafted.status === 409 && crafted.json?.reason === 'saving', `and through the API, 409 saving (${crafted.status} ${crafted.text})`)
  held.release()
  await until(() => kept.text.markdown === 'On its way.', 'the first change made', 30_000)
  await noted(alice, API.alice, 'Kept')
  check(true, 'released: the first change is made')
  await button(form, 'Cancel').click()
  await button(alice.page.getByRole('dialog', { name: 'Discard your changes?' }), 'Discard').click()
  await form.waitFor({ state: 'detached' })
}

// =================================================================================================
// 7. A lost result
// =================================================================================================
part('7. a lost result')
{
  let lost = null
  relay.lose = sent => {
    if (lost || sent.type !== 'command.result' || !sent.data?.note) return false
    lost = sent.data
    return true
  }
  const made = await call(alice.page, `${API.alice}/notes`, { method: 'POST', body: { role: 'entry', title: 'Lost on the way', body: 'Its answer goes astray.', chapterId: null } })
  const id = made.json.id
  await until(() => lost, 'the result lost', 30_000)
  const since = Date.now()
  check(lost.note.id === id && lost.status === 'done' && Boolean(pageNamed(personal(), 'Lost on the way')), "the note made in Foundry, the module's result refused on its way, for good")
  await wait(5000)
  const row = writeRows('personal').find(w => w.noteId === id)
  check(row?.status === 'claimed', `the write stays claimed (${row?.status})`)
  relay.lose = null
  await until(() => writeRows('personal').find(w => w.noteId === id)?.status === 'made', 'the write handed over again and answered', 120_000)
  const creates = journalWrites.filter(w => w[0] === 'create' && w[2].includes(id))
  check(Date.now() - since >= 65_000 && pagesIn(personal()).filter(p => p.id === id || p.name === 'Lost on the way').length === 1 && creates.length === 1,
    `after 75 s it's handed over again and answered done, with one page in Foundry, never two (${Math.round((Date.now() - since) / 1000)} s; ${creates.length} create)`)
}

// =================================================================================================
// 8. The Gamemaster's page reloaded mid-write
// =================================================================================================
part('8. reload mid-write')
{
  const held = hold('create', (entry, list) => list.some(page => page.name === 'Made once'))
  const made = await call(alice.page, `${API.alice}/notes`, { method: 'POST', body: { role: 'entry', title: 'Made once', body: 'Through a reload.', chapterId: null } })
  const id = made.json.id
  await until(() => held.held, 'the create held in Foundry', 30_000)
  const before = lastHello('erebor').session
  await reloadFoundry()
  const since = Date.now()
  check(lastHello('erebor').session !== before && writeRows('personal').find(w => w.noteId === id)?.status === 'claimed',
    'the Foundry page reloaded while the create is being made: a new session says hello, and the write stays claimed')
  await until(() => pageNamed(personal(), 'Made once'), 'the new page to make it', 120_000)
  await until(() => writeRows('personal').find(w => w.noteId === id)?.status === 'made', 'the write made', 30_000)
  check(Date.now() - since >= 60_000 && pagesIn(personal()).filter(p => p.name === 'Made once').length === 1 && pageNamed(personal(), 'Made once').id === id,
    `after 75 s the new session makes it, once, with the note's id (${Math.round((Date.now() - since) / 1000)} s)`)
  await noted(alice, API.alice, 'Made once')
}

// =================================================================================================
// 9. The journal deleted while no Gamemaster was there
// =================================================================================================
part('9. the journal deleted')
{
  await gmAway()
  agePolls(A)
  await edit(aliceJ, 'Kept', { body: 'Changed as the journal went.' })
  await deleteInFoundry('gm', 'journal', { kind: 'personal', actorId: 'thorin', campaignId: 'erebor' })
  await gmBack()
  await pickNote(aliceJ, 'Kept')
  await chipOf(aliceJ, 'Deleted in Foundry').waitFor({ timeout: 30_000 })
  const view = await bookOf(alice, API.alice)
  check(same(view.entries.map(e => e.title), ['Kept']) && view.chapters.length === 0 && !personal(),
    `the journal deleted in Foundry with no Gamemaster there, then back: the app's mirror empties, and the waiting edit becomes "Deleted in Foundry" (${JSON.stringify(view.entries.map(e => [e.title, e.state]))})`)
  const problem = reader(aliceJ).getByRole('group', { name: 'Deleted in Foundry' })
  check(await problem.getByText('Deleted in Foundry while your edit waited.', { exact: true }).isVisible(), '"Deleted in Foundry while your edit waited."')
  await button(problem, 'Discard yours').click()
  await until(async () => (await bookOf(alice, API.alice)).entries.length === 0, 'the book empty', 15_000)
}

// =================================================================================================
// 11. Two saves at once
// =================================================================================================
part('11. two saves at once')
{
  await aliceJ.getByText('Write down what happened, what you found and who you met.', { exact: true }).waitFor({ timeout: 15_000 })
  await writeNote(aliceJ, { title: 'Twice', body: 'Once.' })
  await noted(alice, API.alice, 'Twice')
  const other = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
  await other.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await other.tab('Biography')
  const otherJ = await openJournal(other.page, MINE)
  const forms = []
  for (const [who, d, text] of [[alice, aliceJ, 'From the phone.'], [other, otherJ, 'From the laptop.']]) {
    await pickNote(d, 'Twice')
    await quiet(d)
    await button(reader(d), 'Edit Twice').click()
    const form = editorOf(d, 'Edit Twice')
    await form.getByLabel('Note', { exact: true }).fill(text)
    forms.push({ who, form, text })
  }
  const page = pageNamed(personal(), 'Twice')
  const updatesBefore = journalWrites.filter(w => w[0] === 'update' && w[1] === page.id).length
  await Promise.all(forms.map(({ form }) => button(form, 'Save').click()))
  await wait(1500)
  const outcome = []
  for (const { form, text } of forms) {
    const open = await form.count() > 0
    outcome.push({ open, alert: open ? await form.getByRole('alert').textContent().catch(() => '') : null, kept: open ? await form.getByLabel('Note', { exact: true }).inputValue() : null, text })
  }
  const saved = outcome.filter(o => !o.open)
  const refused = outcome.filter(o => o.open)
  check(saved.length === 1 && refused.length === 1 && refused[0].alert === 'It changed while you were editing. Your text is still here: copy what you need, then cancel to see the latest.' && refused[0].kept === refused[0].text,
    `two pages save the same note at once, from the same stamp: one is saved, the other says "It changed while you were editing…", its text still in its editor (${JSON.stringify(outcome)})`)
  await noted(alice, API.alice, 'Twice')
  await until(() => page.text.markdown === saved[0].text, 'the saved one in Foundry', 30_000)
  await wait(1500)
  const rows = writeRows('personal').filter(w => w.noteId === page.id)
  const updates = journalWrites.filter(w => w[0] === 'update' && w[1] === page.id).length - updatesBefore
  check(rows.length === 1 && updates === 1, `one write row, one change to the page in Foundry (${rows.length} rows, ${updates} updates)`)
  const { who, form } = forms.find(f => f.text === refused[0].text)
  await button(form, 'Cancel').click()
  await button(who.page.getByRole('dialog', { name: 'Discard your changes?' }), 'Discard').click()
  await other.view.close()
}

// =================================================================================================
// 12. An order while Foundry is closed
// =================================================================================================
part('12. an order while Foundry is closed')
const DAY = ['D one', 'D two', 'D three']
{
  const day = (await call(alice.page, `${API.alice}/notes`, { method: 'POST', body: { role: 'chapter', title: 'Day two' } })).json.id
  for (const title of ['L one', 'L two']) await call(alice.page, `${API.alice}/notes`, { method: 'POST', body: { role: 'entry', title, body: `${title}.`, chapterId: null } })
  for (const title of DAY) await call(alice.page, `${API.alice}/notes`, { method: 'POST', body: { role: 'entry', title, body: `${title}.`, chapterId: day } })
  await noted(alice, API.alice, 'D three')
  await until(() => same(foundryGroups(personal())['Day two'], DAY) && same(foundryGroups(personal())[''], ['Twice', 'L one', 'L two']), 'Foundry to hold them', 20_000)
  await until(async () => same(await notesIn(aliceJ, 'Day two'), DAY), 'her journal to list them', 15_000)
  const wasDay = [...DAY]
  await stopFetching({ age: A })
  await until(async () => (await bookOf(alice, API.alice)).live === false, 'the game closed', 15_000)
  check(await reorder(aliceJ, 'Not in a chapter', ['L two', 'Twice', 'L one'], { by: 'buttons' }) === null, 'with Foundry closed, Alice reorders her notes in no chapter')
  check(await reorder(aliceJ, 'Day two', ['D three', 'D one', 'D two'], { by: 'keys' }) === null, 'and the chapter Day two')
  const words = (await header(aliceJ).locator('[aria-live="polite"]').textContent()).trim()
  await reader(aliceJ).getByText('Order waiting for the game', { exact: true }).waitFor({ timeout: 10_000 })
  await until(async () => /Game closed · 2 waiting/.test(await headerLine(aliceJ)), 'the header', 10_000)
  const mark = await contentsPane(aliceJ).locator('nav').evaluate(nav => {
    const row = [...nav.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Day two')
    return document.getElementById(row.getAttribute('aria-describedby'))?.textContent ?? ''
  })
  check(words === 'Order saved. It goes to Foundry when your Gamemaster’s game is next open.' && /Order waiting for the game/.test(mark),
    `"${words}"; the chapter's page says "Order waiting for the game", the contents mark it with a clock, and the header "Game closed · 2 waiting" (${JSON.stringify(mark)})`)
  let rows = orderRows('personal')
  check(rows.length === 2 && rows.every(r => r.status === 'pending'), `two journal_order rows, one a group, waiting (${JSON.stringify(rows.map(r => [r.chapterId, r.seq, r.status]))})`)
  await shootBoth(alice, 'notesoffline-order-waiting')
  check(await reorder(aliceJ, 'Day two', ['D three', 'D two', 'D one'], { by: 'keys' }) === null, 'a second reorder of Day two')
  rows = orderRows('personal')
  const dayRow = rows.find(r => r.chapterId === day)
  check(rows.length === 2 && dayRow.seq === 1 && rows.every(r => r.status === 'pending'), `folds into its row: still two, Day two's at seq 1 (${JSON.stringify(rows.map(r => [r.chapterId, r.seq]))})`)
  const reopened = Date.now()
  const from = postsOf('fetch').length
  startFetching()
  await until(() => same(foundryGroups(personal())['Day two'], ['D three', 'D two', 'D one']) && same(foundryGroups(personal())[''], ['L two', 'Twice', 'L one']), "Foundry's pages in both orders", 30_000)
  await until(async () => (await bookOf(alice, API.alice)).groups.every(g => g.state === 'synced'), 'the orders made', 15_000)
  await until(async () => (await reader(aliceJ).getByText('Order waiting for the game', { exact: true }).count()) === 0, 'the chip gone', 10_000)
  const took = Date.now() - reopened
  const ids = Object.fromEntries((await bookOf(alice, API.alice)).entries.map(e => [e.id, e.title]))
  const handed = postsOf('fetch').slice(from).filter(p => p.status === 200).flatMap(p => { try { return JSON.parse(p.body).commands ?? [] } catch { return [] } }).filter(c => c.note?.op === 'order')
  const dayCommand = handed.find(c => c.note.chapter === day)
  check(took < 30_000 && same(dayCommand?.note.was.map(id => ids[id]), wasDay) && same(dayCommand.note.ids.map(id => ids[id]), ['D three', 'D two', 'D one']),
    `Foundry open again: within 30 s the marks clear and Foundry's pages are in both orders; the chapter's order went from the order the mirror held, was ${JSON.stringify(dayCommand?.note.was.map(id => ids[id]))} (${took} ms)`)
}

// =================================================================================================
// 13. Both places
// =================================================================================================
part('13. both places')
/** Foundry closed, Alice reorders Day two to `hers`; in Foundry meanwhile `meanwhile()`; Foundry open again. */
async function orderMeanwhile(hers, meanwhile) {
  await stopFetching({ age: A })
  await until(async () => (await bookOf(alice, API.alice)).live === false, 'the game closed', 15_000)
  const answer = await reorder(aliceJ, 'Day two', hers, { by: 'buttons' })
  if (answer !== null) throw new Error(`Day two's order refused at once: ${answer}`)
  await meanwhile()
  await settled(1200)
  startFetching()
}
const dayNow = () => foundryGroups(personal())['Day two']
{
  const start = dayNow()
  const hers = [start[1], start[2], start[0]]
  const gms = [start[2], start[1], start[0]]
  await orderMeanwhile(hers, () => dragInFoundry('gm', gms.map(name => pageNamed(personal(), name))))
  await reader(aliceJ).getByText('Order changed in Foundry', { exact: true }).waitFor({ timeout: 30_000 })
  const problem = reader(aliceJ).getByRole('group', { name: 'Order changed in Foundry' })
  await until(async () => same(await reader(aliceJ).locator('article article h4').allTextContents(), gms), "Foundry's order shown", 10_000)
  check(await problem.getByText('Reordered in Foundry while your order waited. Foundry’s order is shown.', { exact: true }).isVisible() && same(dayNow(), gms),
    `Alice reorders Day two with Foundry closed while the Gamemaster drags the same notes there: open again, her page says "Order changed in Foundry", "Reordered in Foundry while your order waited. Foundry’s order is shown.", and shows Foundry's ${JSON.stringify(gms)}`)
  await button(problem, 'Show yours').click()
  await until(async () => same(await problem.locator('ol li').allTextContents(), hers), 'hers listed', 5_000)
  check(true, `Show yours lists hers, ${JSON.stringify(hers)}`)
  await shootBoth(alice, 'notesoffline-order-conflict')
  await button(problem, 'Use yours').click()
  await until(() => same(dayNow(), hers), 'Foundry in her order', 30_000)
  await problem.waitFor({ state: 'detached', timeout: 15_000 })
  check(true, 'Use yours: Foundry in her order, the panel gone')
}
{
  const start = dayNow()
  const hers = [start[2], start[0], start[1]]
  const gms = [start[1], start[0], start[2]]
  await orderMeanwhile(hers, () => dragInFoundry('gm', gms.map(name => pageNamed(personal(), name))))
  await reader(aliceJ).getByText('Order changed in Foundry', { exact: true }).waitFor({ timeout: 30_000 })
  const problem = reader(aliceJ).getByRole('group', { name: 'Order changed in Foundry' })
  await button(problem, 'Keep Foundry’s').click()
  await problem.waitFor({ state: 'detached', timeout: 15_000 })
  await wait(3000)
  check(same(dayNow(), gms) && !orderRows('personal').some(r => r.status !== 'made'), `again, Keep Foundry’s: the Gamemaster's order stays, ${JSON.stringify(gms)}, and the panel goes`)
}
{
  const start = dayNow()
  const hers = [start[1], start[0], start[2]]
  await orderMeanwhile(hers, () => addPageInFoundry('gm', personal(), { name: 'D four', title: { show: true, level: 2 }, text: { format: 2, markdown: 'Added there.', content: '<p>Added there.</p>' } }))
  await until(() => same(dayNow(), [...hers, 'D four']), 'her order made, the new note after', 30_000)
  await until(async () => (await bookOf(alice, API.alice)).groups.every(g => g.state === 'synced'), 'the order made', 15_000)
  await until(async () => same(await notesIn(aliceJ, 'Day two'), [...hers, 'D four']), 'her journal to show it', 10_000)
  check(await reader(aliceJ).getByRole('group', { name: 'Order changed in Foundry' }).count() === 0,
    `a note the Gamemaster only added to the chapter meanwhile: no question, her order made, the new note after, in Foundry and in her journal (${JSON.stringify(dayNow())})`)
}

// =================================================================================================
// 14. A gone chapter
// =================================================================================================
part('14. a gone chapter')
{
  const start = dayNow()
  const hers = [...start].reverse()
  await orderMeanwhile(hers, () => deleteInFoundry('gm', pageNamed(personal(), 'Day two')))
  await until(async () => !chapterIn(await bookOf(alice, API.alice), 'Day two'), 'the chapter gone', 30_000)
  await until(() => orderRows('personal').every(r => r.status === 'made'), 'the order dropped', 30_000)
  let loose = []
  await until(async () => {
    loose = await notesIn(aliceJ, 'Not in a chapter') ?? []
    return start.every(t => loose.includes(t))
  }, 'her journal to show them in no chapter', 10_000)
  check(start.every(t => loose.includes(t)) && await aliceJ.getByRole('group', { name: 'Order changed in Foundry' }).count() === 0 && await aliceJ.getByRole('group', { name: 'Order not saved to the game' }).count() === 0,
    `Alice reorders a chapter the Gamemaster then deletes in Foundry: open again, no panel, the order dropped, its notes under "Not in a chapter" (${JSON.stringify(loose)})`)
}

note(`journal writes in Foundry: ${journalWrites.length}`)
await finish()
