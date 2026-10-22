// A party's journal notes (module 0.34.0 and the app, its contract §13.3), end to end, in the world of
// world-030.mjs, with Foundry's journals the harness's stand-in (fvtt/journal-core.mjs). Alice runs
// Erebor, rolls and moves off, and plays Thorin; Bob plays Vex. The Iron Company: Alice's user its
// Owner, Bob's and Carol's (a table player not in the app) Observers. Party notes are the first
// section of the party sheet's Description tab, on its page and in its panel over a character's sheet,
// and under why there's no party sheet; no tab is added. Bob writes a chapter and a note: the party
// journal Foundry is made to hold, Observer to its readers, his note Owner to him alone. Alice reads
// his, can't change it (403), renames his chapter, writes her own after it; oldest first, and who
// changed each and wrote it; chapters never deleted (409). The Gamemaster changes and deletes any
// note and adds a chapter. Bob's access taken away while his change waits with Foundry closed: 404s
// at once, and the Gamemaster sees his change refused, "not-member", and discards it. A party no
// player can see, on the Gamemaster's page, read only (409 private, and 404 for Alice); the party
// sheet held back as too large, with a note half written as it comes; the panel's draft kept across
// its tabs and its closing; secrets, the Gamemaster's and Bob's own, never reaching those who may not
// read them; pages hidden from some of the journal's readers, and a waiting change of one met with
// "Deleted in Foundry"; every width in both themes. Synthetic characters only. Run with --import
// ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BASE, BOB, LEVELS, MODULE, addPageInFoundry, as, browse, call, character, check, editInFoundry, finish, foundryWorld, group,
  item, journal, launch, newCampaign, note, pagesOf, part, postsOf, same, settings, settled, shoot, shootBoth, sideways, sql,
  startFetching, startModule, stopFetching, theme, until, wait,
} from './world-030.mjs'

const GAME = 'https://iron-company.forge-vtt.com'
const TITLE = 'Erebor'
const SECRET = 'erebor-party-notes-34'
const PARTY = 'The Iron Company'
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'iron-company.forge-vtt.com', secret: SECRET })
await foundryWorld({ more: true })
game.modules.get('sending-stone').version = '0.34.0'

// ---- The world ----
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, con: 2 }, hp: { value: 30, max: 38, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const company = group('company', PARTY, {
  members: [thorin, vex], ownership: { alice: 3, bob: 2, carol: 2 },
  description: { full: '<p>Thirteen dwarves and a burglar.</p>' }, currency: { gp: 40 },
})
item(company, 'rope', 'loot', 'Hempen Rope', { quantity: 50 })
const erebor = { id: 'erebor', title: TITLE, characters: ['thorin', 'vex'], groups: ['company'], rolls: false }
await startModule({ campaigns: [erebor], secrets: { erebor: SECRET } })
await settled()

// ---- What's kept and posted ----
const partyBook = () => journal('party', 'company', 'erebor')
const pages = () => (partyBook() ? pagesOf(partyBook()) : [])
const pageNamed = name => pages().find(p => p.name === name) ?? null
const flagsOf = page => page?.flags?.['sending-stone'] ?? null
const writeRows = () => JSON.parse(sql(`select coalesce(json_agg(w order by w."createdAt")::text, '[]') from (select w.id, w.seq, w."noteId", w.op, w.title, w.status, w.reason, w."createdAt", w."requestedById" from journal_write w join journal_book b on b.id = w."bookId" where b."campaignId" = '${A}' and b.kind = 'party') w`))

// ---- Alice plays Thorin; Bob follows the invite and chooses Vex; the Gamemaster ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const ALICE_PARTY = '/characters/sheet-thorin/party/company'
const alice = await browse({ width: 390, height: 844, path: ALICE_PARTY, toasts: false })
const bob = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB, toasts: false })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const vexSheet = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)
const BOB_PARTY = `/characters/${vexSheet}/party/company`
await bob.page.goto(`${BASE}${BOB_PARTY}`)
const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/party/company`, toasts: false })
const API = { alice: `/api${ALICE_PARTY}`, bob: `/api${BOB_PARTY}`, gm: `/api/campaigns/${A}/party/company` }
// Every body each browser receives, from here on, to be sure none of a secret is among them.
const seen = { alice: [], bob: [], gm: [] }
for (const [name, who] of [['alice', alice], ['bob', bob], ['gm', gm]]) {
  who.page.on('response', async response => {
    const type = response.headers()['content-type'] ?? ''
    if (!/json|html|text|javascript|x-component/.test(type)) return
    try { seen[name].push({ url: response.url(), body: await response.text() }) } catch {}
  })
}

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
const sheetTabs = scope => scope.getByRole('tablist', { name: 'Party sheet' })
/** The party sheet's Description tab, on its page or in its panel, and the Notes section on it. */
async function description(who, scope = who.page) {
  await sheetTabs(scope).getByRole('tab', { name: 'Description', exact: true }).click()
  await notesOf(scope).waitFor({ timeout: 15_000 })
  await notesOf(scope).getByText(/^Everyone in /).waitFor({ timeout: 15_000 })
}
const notesOf = scope => scope.getByRole('region', { name: 'Notes', exact: true })
const rowOf = (scope, title) => scope.locator('details').filter({ has: scope.page().getByRole('heading', { level: 4, name: title, exact: true }) })
const metaOf = row => row.locator('summary span:has(> time)').first().textContent()
const chapterOf = (scope, title) => scope.getByRole('region', { name: title, exact: true })
const lineOf = chapter => chapter.locator('p:has(> time)').first().textContent()
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const formOf = (scope, name) => notesOf(scope).getByRole('form', { name, exact: true })
async function writeNote(scope, { title, body = '', chapter } = {}) {
  await button(notesOf(scope), chapter ? `New note in ${chapter}` : 'New note').click()
  const form = formOf(scope, 'New note')
  await form.getByLabel('Title', { exact: true }).fill(title)
  if (body) await form.getByLabel('Note', { exact: true }).fill(body)
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
}
async function addChapter(scope, title) {
  await button(notesOf(scope), 'New chapter').click()
  const form = formOf(scope, 'New chapter')
  await form.getByLabel('Chapter title', { exact: true }).fill(title)
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
}
async function open(row) {
  if (!(await row.evaluate(el => el.open))) await row.locator('summary').click()
  await until(() => row.evaluate(el => el.open), 'the row to open', 5_000)
}
const discard = async who => button(who.page.getByRole('dialog', { name: 'Discard your changes?' }), 'Discard').click()
const resize = async (who, width, height) => {
  await who.page.setViewportSize({ width, height })
  who.width = width
  await wait(300)
}
/** The entries as a list shows them, in order: under no chapter, and in each chapter. */
const listed = scope => notesOf(scope).evaluate(el => {
  const titles = within => [...within.querySelectorAll('details summary h4')].filter(h => h.closest('section') === within).map(h => h.textContent)
  return {
    loose: titles(el),
    chapters: Object.fromEntries([...el.querySelectorAll('section[aria-labelledby]')].filter(s => s !== el)
      .map(s => [document.getElementById(s.getAttribute('aria-labelledby'))?.textContent, titles(s)])),
  }
})

// =================================================================================================
// 1. Where they are
// =================================================================================================
part('1. where they are')
await alice.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
{
  const tabs = await sheetTabs(alice.page).getByRole('tab').allTextContents()
  check(same(tabs.map(t => t.trim()), ['Inventory', 'Description']), `the party page's tabs are Inventory and Description, as before (${JSON.stringify(tabs)})`)
  await description(alice)
  const order = await alice.page.getByRole('tabpanel').evaluate(panel => ({
    regions: [...panel.querySelectorAll('section[aria-labelledby]')].map(s => document.getElementById(s.getAttribute('aria-labelledby'))?.textContent.trim()),
    h2s: [...panel.querySelectorAll('h2')].map(h => h.textContent.trim()),
  }))
  await alice.page.getByText('Thirteen dwarves and a burglar.').waitFor({ timeout: 15_000 })
  check(order.regions[0] === 'Notes' && same(order.h2s, ['Notes', 'Description']) && await notesOf(alice.page).getByText(`Everyone in ${PARTY} sees these, here and in Foundry.`, { exact: true }).isVisible(),
    `on Description the first region is Notes, then the h2 Description and the party's description; "Everyone in ${PARTY} sees these, here and in Foundry." (${JSON.stringify(order)})`)
}

// =================================================================================================
// 2. Bob writes
// =================================================================================================
part('2. Bob writes')
await bob.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
await description(bob)
await addChapter(bob.page, 'Road to Erebor')
await noted(bob, API.bob, 'Road to Erebor', { chapter: true })
await writeNote(bob.page, { title: 'Wolves', body: 'Wargs on the ridge at dusk.', chapter: 'Road to Erebor' })
const wolves = await noted(bob, API.bob, 'Wolves')
{
  const entry = partyBook()
  const [chapter, page] = [pageNamed('Road to Erebor'), pageNamed('Wolves')]
  check(entry?.name === `${PARTY}: party notes` && same(entry.ownership, { default: 0, alice: 2, bob: 2, carol: 2 }),
    `Foundry holds the party's journal, "${entry?.name}", Observer to Alice, Bob and Carol, a table player not in the app (${JSON.stringify(entry?.ownership)})`)
  check(same(page.ownership, { default: -1, bob: 3 }) && same(chapter.ownership, { default: -1 }) && page.id === wolves.id && flagsOf(page).chapter === chapter.id,
    `Bob's note is Owner to him alone, inheriting the rest; the chapter inherits all (${JSON.stringify([page.ownership, chapter.ownership])})`)
}

// =================================================================================================
// 3. Alice reads, can't change Bob's
// =================================================================================================
part("3. Alice reads Bob's")
{
  const sec = notesOf(alice.page)
  const row = rowOf(sec, 'Wolves')
  await row.waitFor({ timeout: 15_000 })
  await open(row)
  await row.locator('.note-text').getByText('Wargs on the ridge at dusk.').waitFor()
  check(await button(row, 'Edit').count() === 0 && await button(row, 'Delete').count() === 0, "Alice reads Bob's Wolves, with no Edit or Delete")
  const mine = entryIn(await bookOf(alice, API.alice), 'Wolves')
  const crafted = await call(alice.page, `${API.alice}/notes/${wolves.id}`, { method: 'PATCH', body: { title: 'Mine now', body: 'x', chapterId: mine.chapterId, stamp: mine.stamp } })
  check(crafted.status === 403 && crafted.json?.reason === 'not-yours' && !('body' in mine),
    `a crafted PATCH of it answers 403 not-yours, and her view of it has no Markdown (${crafted.status} ${crafted.text})`)
  await button(chapterOf(sec, 'Road to Erebor'), 'Rename Road to Erebor').click()
  const form = formOf(alice.page, 'Rename Road to Erebor')
  await form.getByLabel('Chapter title', { exact: true }).fill('The road to Erebor')
  await alice.page.keyboard.press('Enter')
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await noted(alice, API.alice, 'The road to Erebor', { chapter: true })
  await until(() => pageNamed('The road to Erebor'), 'the chapter renamed in Foundry', 15_000)
  const lines = {}
  for (const [name, who] of [['alice', alice], ['bob', bob], ['gm', gm]]) {
    if (name === 'gm') await description(gm)
    const chapter = chapterOf(notesOf(who.page), 'The road to Erebor')
    await chapter.waitFor({ timeout: 15_000 })
    await until(async () => (await lineOf(chapter)).startsWith('Renamed by'), `${name}'s line under the chapter`, 15_000)
    lines[name] = await lineOf(chapter)
  }
  check(Object.values(lines).every(l => l === 'Renamed by Thorin, just now'), `she renames Bob's chapter: done, and the line under it reads "Renamed by Thorin, just now" for her, Bob and the Gamemaster (${JSON.stringify(lines)})`)
  await writeNote(alice.page, { title: 'Trolls', body: 'Three of them, by a fire.', chapter: 'The road to Erebor' })
  await noted(alice, API.alice, 'Trolls')
  await until(async () => same((await listed(alice.page)).chapters['The road to Erebor'], ['Wolves', 'Trolls']), 'Trolls after Wolves', 10_000)
  check(true, 'she adds Trolls: listed after Wolves, oldest first')
}

// =================================================================================================
// 4. Sorting and the line under each
// =================================================================================================
part('4. sorting')
{
  for (const title of ['B note', 'A note', 'C note']) {
    const made = await call(bob.page, `${API.bob}/notes`, { method: 'POST', body: { role: 'entry', title, body: `${title}'s text.`, chapterId: null } })
    check(made.status === 201, `Bob writes "${title}" (${made.status})`)
    await wait(50)
  }
  await noted(bob, API.bob, 'C note')
  await until(async () => same((await listed(alice.page)).loose, ['B note', 'A note', 'C note']), 'B, A, C', 15_000)
  check(true, 'three notes written B, A, C read B, A, C, by when they were written')
  const row = rowOf(notesOf(alice.page), 'B note')
  check(await metaOf(row) === 'Changed by Vex, just now', `Bob's note's line: "${await metaOf(row)}"`)
  // The Gamemaster changes Bob's note.
  const gmRow = rowOf(notesOf(gm.page), 'Wolves')
  await open(gmRow)
  await button(gmRow, 'Edit').click()
  const form = formOf(gm.page, 'Edit Wolves')
  await form.getByLabel('Note', { exact: true }).fill('Wargs on the ridge at dusk, a dozen of them.')
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await until(() => pageNamed('Wolves')?.text.markdown === 'Wargs on the ridge at dusk, a dozen of them.', "the Gamemaster's change in Foundry", 15_000)
  await noted(alice, API.alice, 'Wolves')
  const wolvesRow = rowOf(notesOf(alice.page), 'Wolves')
  await until(async () => (await metaOf(wolvesRow)).startsWith('Changed by Gamemaster'), 'the Gamemaster named on it', 10_000)
  check(await metaOf(wolvesRow) === 'Changed by Gamemaster, just now · written by Vex' && same(flagsOf(pageNamed('Wolves')).author, { actor: 'vex', gm: false }),
    `changed by the Gamemaster, Bob's note reads "${await metaOf(wolvesRow)}"`)
}

// =================================================================================================
// 5. No chapter is deleted
// =================================================================================================
part('5. no chapter delete')
{
  const sec = notesOf(bob.page)
  const chapter = chapterOf(sec, 'The road to Erebor')
  const named = await chapter.evaluate(el => [...el.querySelectorAll('button')].filter(b => !b.closest('details')).map(b => b.getAttribute('aria-label') ?? b.textContent.trim()))
  check(!named.some(n => /delete/i.test(n)) && named.includes('Rename The road to Erebor'), `no Delete on any chapter, only New note in and Rename (${JSON.stringify(named)})`)
  const view = await bookOf(bob, API.bob)
  const road = chapterIn(view, 'The road to Erebor')
  const crafted = await call(bob.page, `${API.bob}/notes/${road.id}?stamp=${encodeURIComponent(road.stamp)}`, { method: 'DELETE' })
  check(crafted.status === 409 && crafted.json?.reason === 'chapter', `a crafted DELETE of a chapter answers 409 chapter (${crafted.status} ${crafted.text})`)
}

// =================================================================================================
// 6. The Gamemaster
// =================================================================================================
part('6. the Gamemaster')
{
  const sec = notesOf(gm.page)
  const trolls = rowOf(sec, 'Trolls')
  await open(trolls)
  await button(trolls, 'Delete').click()
  const dialog = gm.page.getByRole('dialog', { name: 'Delete Trolls?', exact: true })
  await button(dialog, 'Delete').click()
  await until(() => !pageNamed('Trolls'), "Alice's note deleted in Foundry", 15_000)
  await addChapter(gm.page, 'Camp by the lake')
  await until(() => pageNamed('Camp by the lake'), "the Gamemaster's chapter in Foundry", 15_000)
  check(same(pageNamed('Camp by the lake').ownership, { default: -1 }) && same(flagsOf(pageNamed('Camp by the lake')).author, { actor: null, gm: true }),
    "the Gamemaster deletes Alice's note and adds a chapter, his own, inheriting the journal's readers")
  await until(async () => !entryIn(await bookOf(alice, API.alice), 'Trolls') && chapterIn(await bookOf(alice, API.alice), 'Camp by the lake'), 'Alice to see both', 15_000)
  check(true, 'Alice sees both')
  await shootBoth(gm, 'partynotes-gm')
}

// =================================================================================================
// 7. Access taken away, while Bob's change waits
// =================================================================================================
part('7. access taken away')
{
  const sec = notesOf(bob.page)
  const row = rowOf(sec, 'Wolves')
  // As Bob's page last heard it: the Gamemaster's change, made.
  await until(async () => (await metaOf(row)).startsWith('Changed by Gamemaster'), "the Gamemaster's change on Bob's page", 15_000)
  await stopFetching({ age: A })
  await open(row)
  await button(row, 'Edit').click()
  const form = formOf(bob.page, 'Edit Wolves')
  await form.getByLabel('Note', { exact: true }).fill('Wargs, and their riders.')
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await row.locator('summary').getByText('Waiting for the game').waitFor({ timeout: 15_000 })
  check(writeRows().some(w => w.noteId === wolves.id && w.status === 'pending'), "with Foundry closed, Bob's change of Wolves waits, \"Waiting for the game\"")
  const at = Date.now()
  await company.update({ ownership: { ...company.ownership, bob: 0 } })
  await bob.page.getByText("This party sheet isn't available").waitFor({ timeout: 20_000 })
  const took = Date.now() - at
  const notesNow = [await call(bob.page, `${API.bob}/notes`), await call(bob.page, `${API.bob}/notes?version=1&live=0`), await call(bob.page, API.bob)]
  check(took < 8000 && notesNow.every(r => r.status === 404) && await notesOf(bob.page).count() === 0 && await bob.page.locator('details summary h4').count() === 0,
    `Bob made None on the party in Foundry: his party page says it isn't available within a poll (${took} ms), every way to its notes answers 404, and his page shows none of them (${notesNow.map(r => r.status)})`)
  startFetching()
  await until(() => writeRows().some(w => w.noteId === wolves.id && w.status === 'failed'), "Bob's change refused", 30_000)
  const failed = writeRows().find(w => w.noteId === wolves.id)
  check(failed.status === 'failed' && failed.reason === 'not-member' && pageNamed('Wolves').text.markdown === 'Wargs on the ridge at dusk, a dozen of them.',
    `once Foundry fetches again, the module refuses it: its write reads failed, not-member, and Foundry keeps its text (${JSON.stringify(failed)})`)
  const gmRow = rowOf(notesOf(gm.page), 'Wolves')
  await gmRow.locator('summary').getByText('Not saved to the game').waitFor({ timeout: 15_000 })
  await open(gmRow)
  const problem = gmRow.getByRole('group', { name: 'Not saved to the game' })
  check(await problem.getByText('Vex’s change', { exact: true }).isVisible()
    && await problem.getByText('Not saved to your game: the character can’t see this party in Foundry now.', { exact: true }).isVisible()
    && await button(problem, 'Discard theirs').isVisible(),
    'the Gamemaster\'s party page shows it, under "Vex’s change": "Not saved to your game: the character can’t see this party in Foundry now.", with Discard theirs')
  await shootBoth(gm, 'partynotes-gm-failed', gmRow)
  await button(problem, 'Discard theirs').click()
  await until(() => !writeRows().some(w => w.noteId === wolves.id && w.status !== 'made'), 'the change discarded', 15_000)
  await until(async () => (await gmRow.locator('summary').getByText('Not saved to the game').count()) === 0, 'the chip gone', 15_000)
  check(true, 'Discard theirs removes it')
  await company.update({ ownership: { ...company.ownership, bob: 2 } })
  await until(async () => (await call(bob.page, API.bob)).status === 200, 'the party Bob\'s to see again', 20_000)
  await bob.page.reload()
  await bob.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
}

// =================================================================================================
// 8. Private
// =================================================================================================
part('8. private')
{
  await company.update({ ownership: { ...company.ownership, alice: 1, bob: 0 } })
  await gm.page.getByText('Not shared with any player in Foundry').waitFor({ timeout: 20_000 })
  const sec = notesOf(gm.page)
  await sec.getByText(`No player can see ${PARTY} in Foundry, so its notes aren’t shared.`, { exact: true }).waitFor({ timeout: 15_000 })
  check(await rowOf(sec, 'Wolves').isVisible() && await button(sec, 'New note').count() === 0 && await button(sec, 'New chapter').count() === 0
    && await sec.getByRole('button', { name: /^(Rename|New note in)/ }).count() === 0,
    `no campaign character may see it: the Gamemaster's party page says "Not shared with any player in Foundry", and below it the Notes section, "No player can see ${PARTY} in Foundry, so its notes aren’t shared.", the notes as last held, and nothing to add or rename`)
  await open(rowOf(sec, 'Wolves'))
  check(await button(rowOf(sec, 'Wolves'), 'Edit').count() === 0 && await button(rowOf(sec, 'Wolves'), 'Delete').count() === 0, 'nor to change or delete')
  await gm.page.getByText('Not shared with any player in Foundry').scrollIntoViewIfNeeded()
  await shootBoth(gm, 'partynotes-private')
  const crafted = await call(gm.page, `${API.gm}/notes`, { method: 'POST', body: { role: 'entry', title: 'Nobody reads', body: 'x', chapterId: null } })
  check(crafted.status === 409 && crafted.json?.reason === 'private', `a crafted write answers 409 private (${crafted.status} ${crafted.text})`)
  check((await call(alice.page, API.alice)).status === 404 && (await call(alice.page, `${API.alice}/notes`)).status === 404, "and Alice's party page and notes answer 404")
  await company.update({ ownership: { ...company.ownership, alice: 3, bob: 2 } })
  await gm.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
  await until(async () => (await call(alice.page, API.alice)).status === 200 && (await call(bob.page, API.bob)).status === 200, 'the party theirs to see again', 20_000)
  await alice.page.reload()
  await alice.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
}

// =================================================================================================
// 9. No party sheet: held back as too large
// =================================================================================================
part('9. no party sheet')
{
  const { buildEnvelope, post } = await import(`${MODULE}/scripts/transport.mjs`)
  const sent = postsOf('group.updated').filter(p => p.data.group.id === 'company' && p.data.group.sheet).at(-1).data.group
  const { sheet: _sheet, sheetWithheld: _withheld, ...entry } = sent
  const before = postsOf('group.updated').length
  post(buildEnvelope('group.updated', { group: { ...entry, sheet: null, sheetWithheld: { reason: 'tooLarge', bytes: 1_500_000, limit: 1_000_000 } } }, { campaign: settings.get('campaigns')[0] }))
  await until(() => postsOf('group.updated').slice(before).some(p => p.data.group.sheet === null && p.status < 300), 'the held-back sheet taken')
  await alice.page.getByText(`${PARTY} is too large to send`).waitFor({ timeout: 20_000 })
  const sec = notesOf(alice.page)
  await rowOf(sec, 'Wolves').waitFor({ timeout: 15_000 })
  check(await sheetTabs(alice.page).count() === 0, `the party sheet held back as too large: "${PARTY} is too large to send", and below it the Notes section`)
  await writeNote(alice.page, { title: 'While it was too large', body: 'Still written.' })
  await noted(alice, API.alice, 'While it was too large')
  check(Boolean(pageNamed('While it was too large')), 'working: a note written there reaches Foundry')
  await shootBoth(alice, 'partynotes-nosheet')
  await button(sec, 'New note').click()
  const form = formOf(alice.page, 'New note')
  await form.getByLabel('Title', { exact: true }).fill('Half a note')
  await form.getByLabel('Note', { exact: true }).fill('Typed while the sheet came')
  // The party's sheet sent again, as any change to it sends it.
  item(company, 'lamp', 'loot', 'Miner\'s Lamp')
  await Hooks.callAll('createItem', company.items.get('lamp'), {}, 'gm')
  await sheetTabs(alice.page).waitFor({ timeout: 20_000 })
  const back = formOf(alice.page, 'New note')
  await back.waitFor({ timeout: 10_000 })
  const now = {
    tab: await sheetTabs(alice.page).getByRole('tab', { name: 'Description', exact: true }).getAttribute('aria-selected'),
    title: await back.getByLabel('Title', { exact: true }).inputValue(), body: await back.getByLabel('Note', { exact: true }).inputValue(),
  }
  check(same(now, { tab: 'true', title: 'Half a note', body: 'Typed while the sheet came' }),
    `the sheet arrives with a note half written: the Description tab is shown, and the editor holds the same title and text (${JSON.stringify(now)})`)
  await button(back, 'Cancel').click()
  await discard(alice)
  await back.waitFor({ state: 'detached' })
}

// =================================================================================================
// 10. The panel
// =================================================================================================
part('10. the panel')
{
  await alice.page.goto(`${BASE}/characters/sheet-thorin`)
  await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await alice.party(PARTY)
  let panel = alice.page.getByRole('dialog', { name: PARTY })
  await panel.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 15_000 })
  await description(alice, panel)
  await rowOf(notesOf(panel), 'Wolves').waitFor({ timeout: 15_000 })
  check(await rowOf(notesOf(panel), 'Wolves').isVisible(), "the party panel over Thorin's sheet has the Notes section on its Description tab")
  await button(notesOf(panel), 'New note').click()
  let form = formOf(panel, 'New note')
  await form.getByLabel('Title', { exact: true }).fill('From the panel')
  await form.getByLabel('Note', { exact: true }).fill('Written over the sheet.')
  await shootBoth(alice, 'partynotes-panel', panel)
  const holds = async what => {
    form = formOf(panel, 'New note')
    await form.waitFor({ timeout: 10_000 })
    const kept = [await form.getByLabel('Title', { exact: true }).inputValue(), await form.getByLabel('Note', { exact: true }).inputValue()]
    check(same(kept, ['From the panel', 'Written over the sheet.']), `${what}: the draft is kept (${JSON.stringify(kept)})`)
  }
  await sheetTabs(panel).getByRole('tab', { name: 'Inventory', exact: true }).click()
  await panel.getByText('Hempen Rope').waitFor({ timeout: 10_000 })
  await sheetTabs(panel).getByRole('tab', { name: 'Description', exact: true }).click()
  await holds('Inventory, then Description again')
  await button(panel, 'Close').click()
  await panel.waitFor({ state: 'hidden' })
  await alice.party(PARTY)
  panel = alice.page.getByRole('dialog', { name: PARTY })
  await panel.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 15_000 })
  check(await sheetTabs(panel).getByRole('tab', { name: 'Description', exact: true }).getAttribute('aria-selected') === 'true', 'the panel closed and opened again opens on Description')
  await holds('closed and opened again')
  await button(formOf(panel, 'New note'), 'Cancel').click()
  await discard(alice)
  await button(panel, 'Close').click()
  await alice.page.goto(`${BASE}${ALICE_PARTY}`)
  await alice.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
  await description(alice)
}

// =================================================================================================
// 11. Secrets
// =================================================================================================
part('11. secrets')
{
  const marks = { alice: seen.alice.length, bob: seen.bob.length, gm: seen.gm.length }
  await addPageInFoundry('gm', partyBook(), { name: 'GM lore', title: { show: true, level: 2 }, text: { format: 1, content: '<p>Old lore.</p><section class="secret"><p>The dragon sleeps lightly.</p></section>' } })
  const hidden = await addPageInFoundry('gm', partyBook(), { name: 'Hidden road', title: { show: true, level: 2 } })
  await editInFoundry('gm', hidden, { markdown: 'A way in, by the side door.\n\n<section class="secret">\n\nthe traitor waits there\n\n</section>' })
  await noted(alice, API.alice, 'Hidden road')
  await noted(alice, API.alice, 'GM lore')
  const view = await bookOf(alice, API.alice)
  check(!JSON.stringify(view).includes('dragon sleeps') && entryIn(view, 'GM lore').html.includes('Old lore.'),
    "a Gamemaster's HTML page with a secret section in the party's journal: its secret is never in Alice's notes")
  const sec = notesOf(alice.page)
  const row = rowOf(sec, 'Hidden road')
  await open(row)
  await row.getByText('It holds a Gamemaster’s secret: change it in Foundry.', { exact: true }).waitFor({ timeout: 10_000 })
  check(await button(row, 'Edit').count() === 0 && await row.locator('.note-text').getByText('A way in, by the side door.').isVisible(),
    'his Markdown page holding a raw secret section shows read only: "It holds a Gamemaster’s secret: change it in Foundry."')
  await description(gm)
  await rowOf(notesOf(gm.page), 'Hidden road').waitFor({ timeout: 15_000 })
  await bob.page.reload()
  await bob.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
  await description(bob)
  await rowOf(notesOf(bob.page), 'Hidden road').waitFor({ timeout: 15_000 })
  await wait(3500)
  const leaked = Object.fromEntries(Object.entries(seen).map(([name, list]) => [name, list.slice(marks[name]).filter(r => /traitor|dragon sleeps/.test(r.body)).map(r => r.url)]))
  check(Object.values(leaked).every(urls => urls.length === 0), `the words of either secret are in no response to Alice, Bob or the Gamemaster's app page (${JSON.stringify(leaked)})`)
  const BOBS = 'Open part.\n\n<section class="secret">\n\nbob keeps this to himself\n\n</section>'
  await writeNote(bob.page, { title: "Bob's aside", body: BOBS })
  const his = await noted(bob, API.bob, "Bob's aside")
  const hers = await noted(alice, API.alice, "Bob's aside")
  check(his.body === BOBS && !hers.html.includes('bob keeps this') && hers.html.includes('Open part.') && !('body' in hers) && !his.html.includes('bob keeps this'),
    "Bob's own Markdown note with a raw secret section, written in the app: his view has it in its Markdown; Alice's drawn note hasn't it")
}

// =================================================================================================
// 12. Restricted pages
// =================================================================================================
part('12. restricted pages')
{
  await addPageInFoundry('gm', partyBook(), { name: 'For Alice', title: { show: true, level: 2 }, ownership: { default: 0, alice: 2 }, text: { format: 2, markdown: 'Only you.', content: '<p>Only you.</p>' } })
  await settled(1200)
  await wait(3500)
  const views = [await bookOf(alice, API.alice), await bookOf(bob, API.bob), await bookOf(gm, API.gm)]
  check(views.every(v => !entryIn(v, 'For Alice') && entryIn(v, 'Wolves')), "a Gamemaster's page shown only to Alice in the party journal is in no one's notes, hers included")
  // Bob's page made the Gamemaster's alone in Foundry, with nothing of his waiting: gone from every list.
  await as('gm', () => pageNamed('A note').update({ ownership: { default: LEVELS.NONE, bob: LEVELS.NONE } }))
  await until(async () => {
    const all = [await bookOf(alice, API.alice), await bookOf(bob, API.bob), await bookOf(gm, API.gm)]
    return all.every(v => v && !entryIn(v, 'A note'))
  }, 'A note gone from every list', 15_000)
  check(Boolean(pageNamed('A note')), "Bob's page set by the Gamemaster to { default: 0 } in Foundry: gone from every list, Alice's, Bob's and the Gamemaster's, though Foundry still holds it")
  await stopFetching({ age: A })
  const sec = notesOf(bob.page)
  const row = rowOf(sec, 'B note')
  await open(row)
  await button(row, 'Edit').click()
  const form = formOf(bob.page, 'Edit B note')
  await form.getByLabel('Note', { exact: true }).fill("B note's text, changed while Foundry was closed.")
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await row.locator('summary').getByText('Waiting for the game').waitFor({ timeout: 15_000 })
  // The Gamemaster makes another of Bob's pages his alone in Foundry, while Bob's change of it waits.
  await as('gm', () => pageNamed('B note').update({ ownership: { default: LEVELS.NONE, bob: LEVELS.NONE } }))
  await settled(1200)
  startFetching()
  await row.locator('summary').getByText('Deleted in Foundry').waitFor({ timeout: 30_000 })
  await until(async () => !entryIn(await bookOf(alice, API.alice), 'B note'), 'B note gone from Alice\'s', 15_000)
  await until(async () => (await rowOf(notesOf(alice.page), 'B note').count()) === 0, 'B note gone from her list', 15_000)
  check(true, 'once the module has refused his change, B note is gone from Alice\'s list too')
  await open(row)
  const problem = row.getByRole('group', { name: 'Deleted in Foundry' })
  check(await problem.getByText('Deleted in Foundry while your edit waited.', { exact: true }).isVisible() && await button(problem, 'Add it again').isVisible() && await button(problem, 'Discard yours').isVisible(),
    'his waiting change of it meets "Deleted in Foundry while your edit waited.", with Add it again and Discard yours')
  await button(problem, 'Discard yours').click()
  await until(async () => !entryIn(await bookOf(bob, API.bob), 'B note'), 'his change discarded, the note gone', 15_000)
  check(true, 'Discard yours: it goes from his list too')
}

// =================================================================================================
// 13. Widths, both themes
// =================================================================================================
part('13. widths')
{
  const tablet = await browse({ width: 768, height: 1024, path: ALICE_PARTY, toasts: false })
  for (const [who, width, height] of [[alice, 360, 800], [alice, 390, 844], [tablet, 768, 1024], [gm, 1280, 800]]) {
    await resize(who, width, height)
    await who.page.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 20_000 })
    await description(who)
    const sec = notesOf(who.page)
    await rowOf(sec, 'Wolves').waitFor({ timeout: 15_000 })
    for (const scheme of ['light', 'dark']) {
      await theme(who, scheme)
      await button(sec, 'New note').click()
      const form = formOf(who.page, 'New note')
      await form.waitFor()
      await wait(200)
      const boxes = await form.evaluate(el => {
        const box = b => { const r = b.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }
        const buttons = [...el.querySelectorAll('button')].filter(b => ['Save', 'Cancel'].includes(b.textContent.trim())).map(box)
        return { buttons, width: el.getBoundingClientRect().width, vw: document.documentElement.clientWidth, vh: innerHeight }
      })
      const pageX = await sideways(who.page)
      check(pageX === 0 && boxes.buttons.length === 2 && boxes.buttons.every(b => b.left >= 0 && b.right <= boxes.vw + 0.5 && b.top >= 0 && b.bottom <= boxes.vh + 0.5) && boxes.width <= 768,
        `at ${width} px, ${scheme}: nothing scrolls sideways on the party page, and its editor fits, Save and Cancel in view (${JSON.stringify({ pageX, width: Math.round(boxes.width) })})`)
      await button(form, 'Cancel').click()
      await form.waitFor({ state: 'detached' })
      if ([390, 1280].includes(width)) await shoot(who, 'partynotes')
    }
    await theme(who, 'light')
  }
  await tablet.view.close()
}

note(`party journal pages: ${pages().map(p => p.name).join(', ')}`)
await finish()
