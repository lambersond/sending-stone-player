// A character's own journal notes (module 0.34.0 and the app, its contract §13.2), end to end, in the
// world of world-030.mjs, with Foundry's journals the harness's stand-in (fvtt/journal-core.mjs).
// Alice runs two campaigns, Erebor and Mirkwood, rolls and moves off (removals have no switch under
// dnd5e, so the module fetches for them too), and plays Thorin in Erebor, on a phone (390 × 844) and a
// laptop (1280 × 800); Bob plays Vex there, and in step 17 claims Thorin in Mirkwood. The Gamemaster,
// Alice's own campaign, at Thorin's page. The Iron Company is Erebor's party, for its panel over the
// sheet. Notes are the first section of the Biography tab, under the sheet's seven tabs, no tab added;
// or, with no sheet (held back as too large, or never sent), under why there's none. A chapter and a
// note written live, the journal Foundry is made to hold, its pages and flags; headings refused, the
// preview, a note moved and deleted; privacy (nothing of Thorin's reaches Bob's browser, 404s); the
// Gamemaster writing; Foundry's own edits, its rich-text editor, pages added and deleted there, the
// journal deleted; the keyboard; every width in both themes; another campaign's journal for the same
// character; unsafe HTML; the phone editor with its keyboard up; the sheet withheld and sent again
// with a note half written, and tabs switched with one open. SKEW=033 with MODULE=module-0.33.0: no
// notes in the hello, notes kept and waiting, and no note command handed over. Synthetic characters
// only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to
// SHOTS.
import {
  BOB, MODULE, SKEW033, addPageInFoundry, browse, browser, call, character, check, deleteInFoundry, editInFoundry,
  finish, foundryTab, foundryWorld, group, hold, journal, journalWrites, launch, lastHello, newCampaign, note, pagesOf, part,
  postsOf, same, settings, settled, shoot, shootBoth, sideways, sql, startModule, theme, until, wait,
} from './world-030.mjs'

const GAME = 'https://erebor-hall.forge-vtt.com'
const ADDRESS = 'erebor-hall.forge-vtt.com'
const EREBOR = 'Erebor'
const MIRKWOOD = 'Mirkwood'
const SECRET = 'erebor-notes-secret-34'
const SECRET_M = 'mirkwood-notes-secret-34'
const NEW = !SKEW033
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: EREBOR, address: ADDRESS, secret: SECRET })
const { id: M, invite: inviteM } = await newCampaign({ title: MIRKWOOD, address: ADDRESS, secret: SECRET_M })
await foundryWorld()
game.modules.get('sending-stone').version = SKEW033 ? '0.33.0' : '0.34.0'

// When the module's fetches for commands begin, and what the app answers them.
const fetchStarts = []
{
  const inner = globalThis.fetch
  globalThis.fetch = (url, init) => {
    if (String(url).endsWith('/api/bridge/commands')) fetchStarts.push(Date.now())
    return inner(url, init)
  }
}

// ---- The world: Thorin, a caster with his details, and Vex; the Iron Company ----
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, con: 2, wis: 1 }, hp: { value: 30, max: 38, temp: 0 } }, {
  ac: 16,
  items: [{ id: 'light', name: 'Light', type: 'spell', system: { level: 0, method: 'spell', prepared: 1, canPrepare: true, properties: [] }, activities: [] }],
})
thorin.system.details = {
  level: 5, alignment: 'Lawful Good', age: '195', xp: { value: 6500, max: 14000 },
  trait: 'Proud and stubborn.', appearance: 'A long beard, braided.', biography: { value: '<p>Heir of Durin.</p>' },
}
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
group('company', 'The Iron Company', { members: [thorin, vex], ownership: { alice: 2, bob: 2 } })
const erebor = { id: 'erebor', title: EREBOR, characters: ['thorin', 'vex'], groups: ['company'], rolls: false }
const mirkwood = { id: 'mirkwood', title: MIRKWOOD, characters: ['thorin'], groups: [], rolls: false }
await startModule({ campaigns: [erebor, mirkwood], secrets: { erebor: SECRET, mirkwood: SECRET_M } })
await settled()

// ---- What's kept, posted and held ----
const notesEnabled = () => sql(`select "notesEnabled" from campaign where id = '${A}'`)
const writeRows = () => JSON.parse(sql(`select coalesce(json_agg(w order by w."createdAt")::text, '[]') from (select w.id, w.seq, w."noteId", w.op, w.role, w.title, w.status, w.reason, w."createdAt", b.kind, b."actorId", b."campaignId" from journal_write w join journal_book b on b.id = w."bookId" where b."campaignId" in ('${A}', '${M}')) w`))
/** Thorin's journal for Erebor in the stand-in Foundry, and its pages in Foundry's order. */
const book = () => journal('personal', 'thorin', 'erebor')
const pages = () => (book() ? pagesOf(book()) : [])
const pageNamed = name => pages().find(p => p.name === name) ?? null
const flagsOf = page => page?.flags?.['sending-stone'] ?? null
const ALICE_API = '/api/characters/sheet-thorin'
const GM_API = `/api/campaigns/${A}/characters/thorin`
/** A seat's book as its API answers it: the view, or null. */
const bookOf = async (who, api) => (await call(who.page, `${api}/notes`)).json
const entryIn = (view, title) => view?.entries?.find(e => e.title === title) ?? null
const chapterIn = (view, title) => view?.chapters?.find(c => c.title === title) ?? null
/** Until a seat's book has a note of that title, and where it stands is `state` (synced unless said). */
async function noted(who, api, title, { state = 'synced', chapter = false, ms = 30_000 } = {}) {
  let last
  await until(async () => {
    const view = await bookOf(who, api)
    last = (chapter ? chapterIn : entryIn)(view, title)
    return last && (!state || (last.state === state))
  }, `"${title}" ${state ?? 'listed'} in ${api}'s notes (${JSON.stringify(last?.state)})`, ms)
  return last
}

// ---- The pages ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${EREBOR}', '${A}', 'thorin', 'e2e-user', now())`)
const alice = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const bob = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB, toasts: false })
// Every body Bob's browser receives, from the start, to be sure none of Thorin's notes is among them.
const bobSaw = []
bob.page.on('response', async response => {
  const type = response.headers()['content-type'] ?? ''
  if (!/json|html|text|javascript|x-component/.test(type)) return
  try { bobSaw.push({ url: response.url(), body: await response.text() }) } catch {}
})
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const vexSheet = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)
const BOB_API = `/api/characters/${vexSheet}`

/** The Notes section, the region named so. */
const notesOf = who => who.page.getByRole('region', { name: 'Notes', exact: true })
/** A note's row in the section, by its title: its details. */
const rowOf = (scope, title) => scope.locator('details').filter({ has: scope.page().getByRole('heading', { level: 4, name: title, exact: true }) })
/** A note's row's line under its title: who changed it and when. */
const metaOf = row => row.locator('summary span:has(> time)').first().textContent()
/** A chapter, the region named by its title. */
const chapterOf = (scope, title) => scope.getByRole('region', { name: title, exact: true })
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const formOf = (who, name) => notesOf(who).getByRole('form', { name, exact: true })
/** The section's line that says what was done. */
const said = who => notesOf(who).locator('p[aria-live="polite"][aria-atomic="true"]')
/** The Biography tab, on the sheet, and the section on it. */
async function biography(who) {
  await who.tab('Biography')
  await notesOf(who).waitFor({ timeout: 15_000 })
  await notesOf(who).getByText(/^(No notes yet|Only|Everyone)/).first().waitFor({ timeout: 15_000 })
}
/** A note written from the section, by its New note or a chapter's New note in…, and saved. */
async function writeNote(who, { title, body = '', chapter, from } = {}) {
  const sec = notesOf(who)
  await button(sec, from ?? (chapter ? `New note in ${chapter}` : 'New note')).click()
  const form = formOf(who, 'New note')
  await form.getByLabel('Title', { exact: true }).fill(title)
  if (body) await form.getByLabel('Note', { exact: true }).fill(body)
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
}
/** A chapter added from the section. */
async function addChapter(who, title) {
  await button(notesOf(who), 'New chapter').click()
  const form = formOf(who, 'New chapter')
  await form.getByLabel('Chapter title', { exact: true }).fill(title)
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
}
/** A row opened, if it isn't. */
async function open(row) {
  if (!(await row.evaluate(el => el.open))) await row.locator('summary').click()
  await until(() => row.evaluate(el => el.open), 'the row to open', 5_000)
}
/** Where an element is on screen, and the viewport. */
const boxOf = locator => locator.evaluate(el => {
  const b = el.getBoundingClientRect()
  return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height, vw: document.documentElement.clientWidth, vh: innerHeight }
})
const resize = async (who, width, height) => {
  await who.page.setViewportSize({ width, height })
  who.width = width
  await wait(300)
}
const focused = who => who.page.evaluate(() => {
  const el = document.activeElement
  return { tag: el?.tagName, text: el?.textContent?.trim().slice(0, 80), label: el?.getAttribute('aria-label'), summary: el?.dataset?.noteSummary ?? null, name: el?.getAttribute('aria-label') ?? el?.textContent?.trim() }
})

/** Until focus is where `test` says, then a check saying where it is. */
async function focusIs(who, test, what) {
  const end = Date.now() + 10_000
  let now = await focused(who)
  while (!test(now) && Date.now() < end) {
    await wait(100)
    now = await focused(who)
  }
  check(test(now), `${what} (focus: ${JSON.stringify(now)})`)
}

if (SKEW033) {
  // =================================================================================================
  // 16. Module 0.33.0
  // =================================================================================================
  part('16. module 0.33.0')
  const features = lastHello('erebor').data.features ?? {}
  check(!('notes' in features) && 'removals' in features, `module 0.33.0's hello says nothing of notes (${JSON.stringify(Object.keys(features))})`)
  await wait(3000)
  check(notesEnabled() === 'f', `the app keeps notesEnabled off (${notesEnabled()})`)
  await biography(alice)
  const sec = notesOf(alice)
  const BANNER = 'Notes are kept here for now. They reach Foundry once your Gamemaster’s game connects with Sending Stone 0.34.0 or later.'
  await sec.getByText(BANNER).waitFor({ timeout: 15_000 })
  check(true, `the Notes section on Biography says "${BANNER}"`)
  await writeNote(alice, { title: 'Kept for later', body: 'Written while the module was 0.33.0.' })
  const kept = await noted(alice, ALICE_API, 'Kept for later', { state: 'waiting' })
  const row = rowOf(sec, 'Kept for later')
  await row.locator('summary').getByText('Waiting for the game').waitFor({ timeout: 15_000 })
  check(await row.locator('summary').getByText('Waiting for the game', { exact: true }).isVisible(), 'its row\'s chip says "Waiting for the game"')
  const rows = writeRows()
  check(rows.length === 1 && rows[0].status === 'pending' && rows[0].op === 'create' && rows[0].noteId === kept.id,
    `Alice's note is kept: one write, pending, the note's id (${JSON.stringify(rows)})`)
  check(await said(alice).textContent() === 'Saved. It goes to Foundry when your Gamemaster’s game is next open.',
    `the status line says it's saved, and when it goes (${await said(alice).textContent()})`)
  await shootBoth(alice, 'notes-skew033', sec)
  // Several of the module's fetches go by: removals keep it fetching under dnd5e, and the app hands it no note.
  const from = fetchStarts.length
  await until(() => fetchStarts.length >= from + 3, 'three more fetches for commands', 60_000)
  const answers = postsOf('fetch').filter(p => p.url.endsWith('/api/bridge/commands') && p.status === 200)
    .flatMap(p => { try { return JSON.parse(p.body).commands ?? [] } catch { return [] } })
  check(fetchStarts.length > 0 && answers.every(command => command.kind !== 'note'),
    `module 0.33.0 still fetches (${fetchStarts.length} fetches, for removals), and no answer carries a note command (${answers.length} commands in all)`)
  check(game.journal.size === 0 && writeRows()[0].status === 'pending', 'and Foundry holds no journal; the write still waits')
  await finish()
}

// =================================================================================================
// 1. Where they are
// =================================================================================================
part('1. where they are')
{
  const features = lastHello('erebor').data.features
  check(same(Object.keys(features), ['rolls', 'transfers', 'removals', 'notes']) && same(features.notes, { enabled: true, kinds: ['personal', 'party'], reason: null, journals: [] }),
    `the hello says notes are kept here, with no journal yet (${JSON.stringify(features.notes)})`)
  await until(() => notesEnabled() === 't', 'the app to keep notes on', 15_000)
  check(notesEnabled() === 't', 'the app keeps notesEnabled on in the campaign row')
}
const tablist = who => who.page.getByRole('tablist', { name: 'Character sheet' })
const tabNames = async who => (await tablist(who).getByRole('tab').allTextContents()).map(t => t.trim().split(/[\s,]/)[0])
{
  const names = await tabNames(alice)
  const nav = await alice.nav.getByRole('button').evaluateAll(buttons => buttons.map(b => b.textContent.trim().split(/\s/)[0]))
  check(same(names, ['Character', 'Actions', 'Inventory', 'Spells', 'Features', 'Effects', 'Biography']) && same(nav, ['Character', 'Combat', 'Chat']),
    `at 390 the sheet's tablist has its seven tabs, no Notes among them, and the Table nav Character, Combat and Chat (${JSON.stringify([names, nav])})`)
}
await biography(alice)
{
  const order = await alice.page.getByRole('tabpanel').evaluate(panel => {
    const regions = [...panel.querySelectorAll('section[aria-labelledby]')].map(s => document.getElementById(s.getAttribute('aria-labelledby'))?.textContent.trim())
    const h2s = [...panel.querySelectorAll('h2')].map(h => h.textContent.trim())
    return { regions, h2s }
  })
  check(order.regions[0] === 'Notes' && order.h2s[0] === 'Notes' && order.h2s.indexOf('Details') > 0,
    `on Biography the first region is Notes, its h2 before Details' (${JSON.stringify(order)})`)
}
for (const width of [360, 390]) {
  await resize(alice, width, 844)
  check(await sideways(alice.page) === 0, `at ${width} px nothing on Biography scrolls sideways`)
}
await shootBoth(alice, 'notes-biography')
await resize(alice, 768, 1024)
{
  const width = (await boxOf(notesOf(alice))).width
  check(Math.abs(width - 608) <= 1 && await sideways(alice.page) === 0, `at 768 the section is 608 px wide (${width})`)
  await shootBoth(alice, 'notes-biography')
}
await resize(alice, 390, 844)
const wide = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await tablist(wide).waitFor({ timeout: 20_000 })
await biography(wide)
{
  const look = await wide.page.evaluate(() => {
    const pane = document.getElementById('character-pane')
    const section = [...document.querySelectorAll('section[aria-labelledby]')].find(s => document.getElementById(s.getAttribute('aria-labelledby'))?.textContent.trim() === 'Notes')
    const column = pane?.nextElementSibling
    return {
      inPane: Boolean(pane?.contains(section)), section: section?.getBoundingClientRect().width ?? 0, column: column?.getBoundingClientRect().width ?? 0,
      aside: document.querySelector('[role=tablist][aria-label="Combat or chat"]') !== null,
    }
  })
  check(look.inPane && look.section >= 700 && look.column >= 320 && look.column <= 500 && look.aside && await wide.nav.isVisible() === false,
    `at 1280 it's in the Character pane, ${Math.round(look.section)} px wide, beside the ${Math.round(look.column)} px column of combat and chat, whose tablist is "Combat or chat" (${JSON.stringify(look)})`)
  await shootBoth(wide, 'notes-biography')
}

// =================================================================================================
// 2. Empty
// =================================================================================================
part('2. empty')
{
  const sec = notesOf(alice)
  check(await sec.getByText('No notes yet. Write down what happened, what you found and who you met.', { exact: true }).isVisible()
    && await sec.getByText('Only you and your Gamemaster see these.', { exact: true }).isVisible(),
    'empty, it says "No notes yet. Write down what happened, what you found and who you met." and "Only you and your Gamemaster see these."')
  const details = await boxOf(alice.page.getByRole('heading', { level: 2, name: 'Details', exact: true }))
  check(details.top < 844 && await sec.locator('.py-16').count() === 0, `a line, not an empty state: Details starts within the first screen at 390 × 844 (${Math.round(details.top)} px down)`)
}

// =================================================================================================
// 3. A chapter and a note, live
// =================================================================================================
part('3. a chapter and a note')
const CAVE = 'The goblin cave'
const CAVE_BODY = '### Loot\n- 30 gp\n- a *strange* key\n\n| Who | What |\n|---|---|\n| Vex | rope |'
await addChapter(alice, 'Session 1')
const session1 = await noted(alice, ALICE_API, 'Session 1', { chapter: true })
await until(() => pageNamed('Session 1'), 'the chapter in Foundry')
// The note's page is held at its write in Foundry a while, so that it's seen on its way.
const held = hold('create', (entry, list) => list.some(page => page.name === CAVE))
await writeNote(alice, { title: CAVE, body: CAVE_BODY, chapter: 'Session 1' })
check(await said(alice).textContent() === 'Saved.', `saved live, the status line says "Saved." (${await said(alice).textContent()})`)
{
  const sec = notesOf(alice)
  const row = rowOf(chapterOf(sec, 'Session 1'), CAVE)
  await until(() => held.held, "the note's page to reach Foundry's write", 20_000)
  await row.locator('summary').getByText('Saving to the game…').waitFor({ timeout: 15_000 })
  check(true, 'while Foundry makes it, its row\'s chip says "Saving to the game…"')
  held.release()
  await noted(alice, ALICE_API, CAVE)
  await until(async () => (await row.locator('summary').getByText(/Saving to the game|Waiting for the game/).count()) === 0, 'the chip to go', 15_000)
  check(true, 'and once it\'s made, the row has no chip')
}
{
  const entry = book()
  const folder = game.folders.find(f => f.flags?.['sending-stone']?.folder === 'notes')
  const [chapter, cave] = pages()
  const flags = flagsOf(cave)
  check(game.journal.size === 1 && entry.name === "Thorin's notes (Erebor)" && folder?.name === 'Sending Stone notes' && entry.folder === folder.id,
    `Foundry holds one journal for him, "${entry.name}", in the folder "${folder?.name}"`)
  check(same(entry.flags.core, { viewMode: 2, locked: true })
    && same(entry.flags['sending-stone'].journal, { kind: 'personal', actor: 'thorin', campaign: 'erebor', granted: ['alice'], default: 0 })
    && same(entry.ownership, { default: 0, alice: 3 }),
    `in multi-page view and locked, flagged as Thorin's book for Erebor, Owner to Alice alone (${JSON.stringify([entry.flags, entry.ownership])})`)
  check(pages().length === 2 && chapter.name === 'Session 1' && chapter.title.level === 1 && cave.name === CAVE && cave.title.level === 2
    && flagsOf(chapter).role === 'chapter' && flags.role === 'entry' && flags.chapter === chapter.id,
    `two pages, the chapter at level 1 and the note at level 2 in it (${JSON.stringify(pages().map(p => [p.name, p.title.level, flagsOf(p)?.role]))})`)
  check(cave.text.format === 2 && cave.text.markdown === CAVE_BODY && /<h3>Loot<\/h3>/.test(cave.text.content) && /<table>/.test(cave.text.content)
    && cave.flags.core?.sheetClass === 'core.JournalEntryPageMarkdownSheet',
    `its text is the Markdown, its HTML written with it, in the Markdown editor (${JSON.stringify([cave.text.format, cave.flags.core])})`)
  check(same(flags.author, { actor: 'thorin', gm: false }) && flags.page === cave.id && same(flags.modified.actor, 'thorin') && flags.modified.gm === false,
    `its flags: its own id, Thorin its author and last to change it (${JSON.stringify(flags)})`)
  const view = await bookOf(alice, ALICE_API)
  check(entryIn(view, CAVE)?.id === cave.id && chapterIn(view, 'Session 1')?.id === chapter.id && session1.id === chapter.id,
    `the note's id in the app is its page's in Foundry (${cave.id}), the chapter's too`)
}
{
  const row = rowOf(notesOf(alice), CAVE)
  const meta = await metaOf(row)
  check(meta === 'Changed by Thorin, just now', `its row says "${meta}"`)
  await open(row)
  const drawn = await row.evaluate(el => ({
    table: Boolean(el.querySelector('.note-text table')), loot: [...el.querySelectorAll('.note-text h5')].map(h => h.textContent),
    h4: el.querySelector('summary h4')?.textContent,
  }))
  check(drawn.table && same(drawn.loot, ['Loot']) && drawn.h4 === CAVE, `opened, a table, and "Loot" as an h5 under the note's h4 (${JSON.stringify(drawn)})`)
  await shootBoth(alice, 'notes-row', row)
}

// =================================================================================================
// 4. Headings refused
// =================================================================================================
part('4. headings')
{
  const sec = notesOf(alice)
  const before = { pages: pages().length, writes: writeRows().length }
  await button(sec, 'New note').click()
  const form = formOf(alice, 'New note')
  await form.getByLabel('Title', { exact: true }).fill('A heading')
  const body = form.getByLabel('Note', { exact: true })
  await body.fill('First line\n#loot')
  const hint = form.locator('p[aria-live="polite"]')
  await until(async () => (await hint.textContent()).startsWith('Line 2 is a # or ## heading'), 'the heading hint', 5_000)
  check(await hint.textContent() === 'Line 2 is a # or ## heading. Use ### or more, or put a \\ before the #.' && await button(form, 'Save').isEnabled(),
    `typing #loot on line 2: "${await hint.textContent()}", and Save still enabled`)
  await button(form, 'Save').click()
  const alert = form.getByRole('alert')
  await alert.waitFor({ timeout: 10_000 })
  check(await alert.textContent() === 'Use ### or more for headings: # and ## are the journal’s chapters and notes.' && await form.isVisible() && await body.inputValue() === 'First line\n#loot',
    `saved, the editor stays open with its text, saying "${await alert.textContent()}"`)
  await body.fill('Title\n-')
  await until(async () => (await hint.textContent()).includes('under-ruled'), 'the under-rule hint', 5_000)
  check(await hint.textContent() === 'Line 2 is under-ruled with = or -, which makes the line above it a heading. Leave a blank line between them.',
    `"Title" over "-": "${await hint.textContent()}"`)
  await button(form, 'Cancel').click()
  await button(alice.page.getByRole('dialog', { name: 'Discard your changes?' }), 'Discard').click()
  await form.waitFor({ state: 'detached' })
  const crafted = await call(alice.page, `${ALICE_API}/notes`, { method: 'POST', body: { role: 'entry', title: 'Crafted', body: '#loot', chapterId: null } })
  check(crafted.status === 422 && crafted.json?.reason === 'headings' && same(crafted.json?.lines, [1]), `a crafted POST with #loot answers 422 headings, lines [1] (${crafted.status} ${crafted.text})`)
  await wait(1500)
  check(pages().length === before.pages && writeRows().length === before.writes && !pageNamed('A heading') && !pageNamed('Crafted'),
    'and nothing of either reaches Foundry, nor waits for it')
}

// =================================================================================================
// 5. Preview
// =================================================================================================
part('5. preview')
{
  const sec = notesOf(alice)
  await button(sec, 'New note').click()
  const form = formOf(alice, 'New note')
  await form.getByLabel('Title', { exact: true }).fill('Previewed')
  await form.getByLabel('Note', { exact: true }).fill('| A | B |\n|---|---|\n| 1 | 2 |\n\n~~strike~~ and @UUID[Actor.vex]{Vex}')
  const tabs = form.getByRole('tablist', { name: 'Write or preview' })
  await tabs.getByRole('tab', { name: 'Preview', exact: true }).click()
  const panel = form.getByRole('tabpanel').filter({ has: alice.page.locator('.note-text') })
  await panel.locator('.note-text table').waitFor({ timeout: 10_000 })
  const shown = await panel.evaluate(el => ({
    table: Boolean(el.querySelector('table')), struck: [...el.querySelectorAll('s')].map(s => s.textContent),
    bold: [...el.querySelectorAll('strong')].map(s => s.textContent), links: el.querySelectorAll('a').length,
  }))
  check(shown.table && same(shown.struck, ['strike']) && same(shown.bold, ['Vex']) && shown.links === 0,
    `Preview shows the table, ~~strike~~ as <s>, and @UUID[Actor.vex]{Vex} as a bold Vex, no link (${JSON.stringify(shown)})`)
  await tabs.getByRole('tab', { name: 'Write', exact: true }).click()
  await button(form, 'Cancel').click()
  await button(alice.page.getByRole('dialog', { name: 'Discard your changes?' }), 'Discard').click()
  await form.waitFor({ state: 'detached' })
}

// =================================================================================================
// 6. Edit and move
// =================================================================================================
part('6. edit and move')
{
  const sec = notesOf(alice)
  const row = rowOf(sec, CAVE)
  await open(row)
  await button(row, 'Edit').click()
  const form = formOf(alice, `Edit ${CAVE}`)
  await form.getByLabel('Title', { exact: true }).fill('Goblin cave')
  await form.locator('select').selectOption({ label: 'No chapter' })
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await until(() => pageNamed('Goblin cave') && flagsOf(pageNamed('Goblin cave')).chapter === null, 'the page renamed and moved in Foundry', 20_000)
  check(pageNamed('Goblin cave').id === entryIn(await bookOf(alice, ALICE_API), 'Goblin cave').id, "Edit: the page's name and its chapter flag change in Foundry, its id kept")
  await noted(alice, ALICE_API, 'Goblin cave')
  const list = await sec.evaluate(el => ({
    first: el.querySelector('details summary h4')?.textContent,
    inChapter: [...el.querySelectorAll('details summary h4')].filter(h => h.closest('section') !== el).map(h => h.textContent),
  }))
  check(list.first === 'Goblin cave' && !list.inChapter.includes('Goblin cave'), `the list shows it first, under no chapter's heading (${JSON.stringify(list)})`)
}

// =================================================================================================
// 8. Privacy (before 7's delete, while Thorin has notes to keep from Bob)
// =================================================================================================
part('8. privacy')
{
  const answer = await call(alice.page, `${ALICE_API}/notes`, { method: 'POST', body: { role: 'entry', title: 'Ravenhill', body: 'Goblins were seen on the road.', chapterId: session1.id } })
  check(answer.status === 201 && /^[A-Za-z0-9]{16}$/.test(answer.json?.id ?? ''), `a note written through Alice's API: 201 with its id (${answer.text})`)
  await noted(alice, ALICE_API, 'Ravenhill')
  await biography(bob)
  const bobs = await bookOf(bob, BOB_API)
  check(bobs?.kind === 'personal' && bobs.entries.length === 0 && await notesOf(bob).getByText('No notes yet.', { exact: false }).isVisible(),
    "Bob's own Biography lists none of Thorin's notes, his own book empty")
  for (const [path, method] of [[`${ALICE_API}/notes`], [`${ALICE_API}/notes?version=0`], [`${ALICE_API}/notes?version=0&live=1`], [`${ALICE_API}/notes/${answer.json.id}?stamp=n:`, 'DELETE']]) {
    const got = await call(bob.page, path, { method })
    check(got.status === 404 && got.text === '', `for Bob, ${method ?? 'GET'} ${path} answers 404, saying nothing (${got.status})`)
  }
  for (const [path, why] of [
    [`/api/campaigns/${A}/characters/thorin/notes`, "Erebor's Gamemaster's route for Thorin, which isn't his"],
    [`/api/campaigns/${M}/characters/thorin/notes`, "Mirkwood's"],
  ]) check((await call(bob.page, path)).status === 404, `for Bob, ${why} answers 404`)
  check((await call(alice.page, `/api/campaigns/${M}/characters/vex/notes`)).status === 404 && (await call(alice.page, '/api/campaigns/no-such-campaign/characters/thorin/notes')).status === 404,
    "for the Gamemaster, her route for a character another campaign's, or a campaign that isn't, answers 404")
  const gmView = await bookOf(alice, GM_API)
  const own = await bookOf(alice, ALICE_API)
  check(entryIn(gmView, 'Ravenhill')?.body === 'Goblins were seen on the road.' && entryIn(own, 'Ravenhill')?.body === 'Goblins were seen on the road.',
    "Thorin's notes as the Gamemaster's route has them carry each note's Markdown, and as Alice's do")
}

// =================================================================================================
// 7. Delete
// =================================================================================================
part('7. delete')
{
  const sec = notesOf(alice)
  const row = rowOf(sec, 'Goblin cave')
  // As the page last saw it: made in Foundry, its stamp Foundry's revision.
  await until(async () => (await row.locator('summary').getByText(/Saving to the game|Waiting for the game/).count()) === 0, 'the row synced on the page', 15_000)
  await open(row)
  await button(row, 'Delete').click()
  const dialog = alice.page.getByRole('dialog', { name: 'Delete Goblin cave?', exact: true })
  await dialog.waitFor({ timeout: 10_000 })
  check((await dialog.textContent()).includes('It’s deleted from Foundry’s journal too.') && !(await dialog.textContent()).includes('next open'),
    'Delete asks "Delete Goblin cave?": "It’s deleted from Foundry’s journal too."')
  const answered = alice.page.waitForResponse(r => r.request().method() === 'DELETE' && /\/notes\//.test(r.url()))
  await button(dialog, 'Delete').click()
  const answer = await answered
  check(answer.status() === 200, `the delete is taken (${answer.status()} ${await answer.text().catch(() => '')} for ${new URL(answer.url()).search})`)
  await focusIs(alice, f => f.name === 'New note', 'deleted, focus is on New note')
  await until(async () => !pageNamed('Goblin cave') && (await rowOf(sec, 'Goblin cave').count()) === 0, 'the note gone from the list and from Foundry', 20_000)
  check(!entryIn(await bookOf(alice, ALICE_API), 'Goblin cave'), 'it\'s gone from the list and from Foundry\'s journal')
}

// =================================================================================================
// 9. The Gamemaster
// =================================================================================================
part('9. the Gamemaster')
const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin`, toasts: false })
await tablist(gm).waitFor({ timeout: 20_000 })
await biography(gm)
{
  const sec = notesOf(gm)
  check(await sec.getByText('Only Thorin’s player and you see these.', { exact: true }).isVisible() && await rowOf(sec, 'Ravenhill').isVisible(),
    "at Thorin's page, the Gamemaster's Biography has the Notes section, \"Only Thorin’s player and you see these.\", with his notes")
  await writeNote(gm, { title: 'Watch rota', body: 'Dwalin keeps the first watch.' })
  await until(() => pageNamed('Watch rota'), "the Gamemaster's note in Foundry", 20_000)
  const flags = flagsOf(pageNamed('Watch rota'))
  check(flags.modified.gm === true && flags.modified.actor === null && same(flags.author, { actor: null, gm: true }),
    `written by the Gamemaster: modified ${JSON.stringify(flags.modified)}, author ${JSON.stringify(flags.author)}`)
  await noted(alice, ALICE_API, 'Watch rota')
  const row = rowOf(notesOf(alice), 'Watch rota')
  await row.waitFor({ timeout: 15_000 })
  check(await metaOf(row) === 'Changed by Gamemaster, just now', `Alice's row reads "${await metaOf(row)}"`)
}

// =================================================================================================
// 10. Edited in Foundry
// =================================================================================================
part('10. edited in Foundry')
{
  const row = rowOf(notesOf(alice), 'Ravenhill')
  const at = Date.now()
  await editInFoundry('alice', pageNamed('Ravenhill'), { markdown: 'changed there' })
  await until(async () => (await metaOf(row)).startsWith('Changed in Foundry by Thorin, '), 'the row to say it was changed in Foundry', 20_000)
  const took = Date.now() - at
  await open(row)
  await row.locator('.note-text').getByText('changed there').waitFor({ timeout: 10_000 })
  check(took < 5000 && await metaOf(row) === 'Changed in Foundry by Thorin, just now',
    `Alice changes it in Foundry: within 5 s her row reads "${await metaOf(row)}" and shows "changed there" (${took} ms)`)
}

// =================================================================================================
// 11. Foundry's own editor
// =================================================================================================
part("11. Foundry's own editor")
{
  await editInFoundry('gm', pageNamed('Watch rota'), { html: '<p>rich</p>' })
  const row = rowOf(notesOf(alice), 'Watch rota')
  await until(async () => (await entryIn(await bookOf(alice, ALICE_API), 'Watch rota'))?.foundryOnly === 'html', 'the note to come back read only', 20_000)
  await open(row)
  await row.getByText('Written in Foundry’s own editor: change it there.', { exact: true }).waitFor({ timeout: 10_000 })
  check(await button(row, 'Edit').count() === 0 && await row.locator('.note-text').getByText('rich').isVisible() && !('body' in entryIn(await bookOf(alice, ALICE_API), 'Watch rota')),
    'changed in the rich-text editor, it\'s read only: no Edit, "Written in Foundry’s own editor: change it there.", and no Markdown sent')
}

// =================================================================================================
// 12. Added in Foundry
// =================================================================================================
part('12. added in Foundry')
let chapter2
{
  chapter2 = await addPageInFoundry('gm', book(), { name: 'Session 2', title: { show: true, level: 1 } })
  const stone = await addPageInFoundry('gm', book(), { name: 'The Arkenstone', title: { show: true, level: 2 }, text: { format: 2, markdown: 'It glows.', content: '<p>It glows.</p>' } })
  const sec = notesOf(alice)
  const row = rowOf(chapterOf(sec, 'Session 2'), 'The Arkenstone')
  await row.waitFor({ timeout: 20_000 })
  const meta = await metaOf(row)
  check(/^Changed in Foundry by Gamemaster, just now · written in Foundry$/.test(meta) && entryIn(await bookOf(alice, ALICE_API), 'The Arkenstone')?.id === stone.id,
    `a level 1 page and a level 2 one after it, added by the Gamemaster: a chapter "Session 2" with the note under it, "${meta}"`)
  await open(row)
  await button(row, 'Edit').click()
  const form = formOf(alice, 'Edit The Arkenstone')
  await form.getByLabel('Note', { exact: true }).fill('It glows in the dark.')
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await until(() => stone.text.markdown === 'It glows in the dark.', 'her change in Foundry', 20_000)
  const flags = flagsOf(stone)
  check(flags?.page === stone.id && flags.role === 'entry' && flags.chapter === chapter2.id && flags.author === null && flags.modified.actor === 'thorin',
    `personal, Alice may change it: her edit is made, and gives the page flags of its own, its author still none (${JSON.stringify(flags)})`)
  // The Biography tab's notes with chapters and entries in them, Alice's and the Gamemaster's.
  await noted(alice, ALICE_API, 'The Arkenstone')
  await until(async () => (await notesOf(alice).locator('summary').getByText(/^(Saving to the game…|Waiting for the game)$/).count()) === 0, 'every row made, on the page', 15_000)
  await chapterOf(notesOf(alice), 'Session 1').scrollIntoViewIfNeeded()
  await shootBoth(alice, 'notes-chapters')
  await biography(wide)
  await rowOf(chapterOf(notesOf(wide), 'Session 2'), 'The Arkenstone').waitFor({ timeout: 15_000 })
  await until(async () => (await notesOf(wide).locator('summary').getByText(/^(Saving to the game…|Waiting for the game)$/).count()) === 0, 'every row made, on the laptop', 15_000)
  await notesOf(wide).scrollIntoViewIfNeeded()
  await shootBoth(wide, 'notes-chapters')
  await rowOf(chapterOf(notesOf(gm), 'Session 2'), 'The Arkenstone').waitFor({ timeout: 15_000 })
  await shootBoth(gm, 'notes-gm')
}

// =================================================================================================
// 13. Deleted in Foundry
// =================================================================================================
part('13. deleted in Foundry')
{
  await deleteInFoundry('gm', chapter2)
  await until(async () => {
    const view = await bookOf(alice, ALICE_API)
    return !chapterIn(view, 'Session 2') && entryIn(view, 'The Arkenstone')?.chapterId === null
  }, 'the chapter gone, its note under none', 20_000)
  const sec = notesOf(alice)
  await until(async () => (await chapterOf(sec, 'Session 2').count()) === 0, 'the chapter gone from the list', 10_000)
  const loose = await sec.evaluate(el => [...el.querySelectorAll('details summary h4')].filter(h => h.closest('section') === el).map(h => h.textContent))
  check(loose.includes('The Arkenstone'), `its chapter page deleted in Foundry, its note is listed under no chapter (${JSON.stringify(loose)})`)
  const was = book()
  await deleteInFoundry('gm', 'journal', { kind: 'personal', actorId: 'thorin', campaignId: 'erebor' })
  await until(async () => {
    const view = await bookOf(alice, ALICE_API)
    return view.entries.length === 0 && view.chapters.length === 0
  }, 'the book emptied', 20_000)
  await sec.getByText('No notes yet. Write down what happened, what you found and who you met.').waitFor({ timeout: 10_000 })
  check(!book(), 'the journal deleted in Foundry, the list is empty')
  await writeNote(alice, { title: 'After the fire', body: 'We begin again.' })
  await until(() => book() && pageNamed('After the fire'), 'a new journal', 20_000)
  check(book() !== was && book().id !== was.id && book().name === "Thorin's notes (Erebor)" && pages().length === 1,
    `and Alice's next note makes a new journal, "${book().name}" (${was.id} → ${book().id})`)
}

// =================================================================================================
// 14. The keyboard
// =================================================================================================
part('14. the keyboard')
{
  const sec = notesOf(alice)
  const key = k => alice.page.keyboard.press(k)
  const isFocused = locator => locator.evaluate(el => el === document.activeElement)
  await noted(alice, ALICE_API, 'After the fire')
  await sec.getByRole('heading', { level: 2, name: 'Notes', exact: true }).focus()
  await key('Tab')
  check((await focused(alice)).name === 'New note', `Tab reaches New note (${JSON.stringify(await focused(alice))})`)
  await key('Enter')
  let form = formOf(alice, 'New note')
  await form.waitFor()
  const title = form.getByLabel('Title', { exact: true })
  const body = form.getByLabel('Note', { exact: true })
  await until(() => isFocused(title), 'focus in Title', 5_000).catch(() => {})
  check(await isFocused(title), `Enter opens the editor, focus in its Title (focus: ${JSON.stringify(await focused(alice))})`)
  const writes = writeRows().length
  await alice.page.keyboard.type('Keyed in')
  await key('Enter')
  await wait(500)
  check(await isFocused(body) && writeRows().length === writes && await form.isVisible(), 'Enter in Title moves to the note, and saves nothing')
  await alice.page.keyboard.type('Every word by keys.')
  await key('Control+Enter')
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  const keyed = await noted(alice, ALICE_API, 'Keyed in', { state: null })
  await focusIs(alice, f => f.summary === keyed.id, "Ctrl+Enter saves it, and focus is on its row's summary")

  await button(sec, 'New note').focus()
  await key('Enter')
  form = formOf(alice, 'New note')
  await form.waitFor()
  await until(() => isFocused(form.getByLabel('Title', { exact: true })), 'focus in Title', 5_000)
  await alice.page.keyboard.type('Shift tabbed')
  await key('Shift+Tab')
  check((await focused(alice)).name === 'Save', `Shift+Tab from Title is back on Save (${JSON.stringify(await focused(alice))})`)
  await key('Enter')
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await noted(alice, ALICE_API, 'Shift tabbed', { state: null })
  check(true, 'and Enter there saves it')

  await button(sec, 'New note').click()
  form = formOf(alice, 'New note')
  await form.getByLabel('Title', { exact: true }).fill('To be discarded')
  await button(form, 'Cancel').click()
  const discard = alice.page.getByRole('dialog', { name: 'Discard your changes?' })
  await discard.waitFor()
  check(await discard.getByText('What you wrote here isn’t saved.').isVisible() && await button(discard, 'Keep editing').isVisible(), 'Cancel with changes asks "Discard your changes?"')
  await key('Escape')
  await discard.waitFor({ state: 'hidden' })
  check(await form.isVisible() && await form.getByLabel('Title', { exact: true }).inputValue() === 'To be discarded', 'Escape keeps editing, the title as typed')
  await button(form, 'Cancel').click()
  await button(discard, 'Discard').click()
  await form.waitFor({ state: 'detached' })
  await focusIs(alice, f => f.name === 'New note', 'Cancel, Discard: the editor goes, focus on New note')

  await button(sec, 'New chapter').focus()
  await key('Enter')
  const chapterForm = formOf(alice, 'New chapter')
  await until(() => isFocused(chapterForm.getByLabel('Chapter title', { exact: true })), 'focus in the chapter title', 5_000)
  await alice.page.keyboard.type('Session 1')
  await key('Enter')
  await chapterForm.waitFor({ state: 'detached', timeout: 15_000 })
  await focusIs(alice, f => /^Session 1/.test(f.text ?? '') && f.tag === 'H3', "a chapter's title, Enter: saved, focus on its heading")
  await button(sec, 'New note in Session 1').click()
  form = formOf(alice, 'New note')
  await form.waitFor()
  check(await form.locator('select').evaluate(el => el.selectedOptions[0]?.textContent) === 'Session 1', 'New note in Session 1 starts in that chapter')
  await button(form, 'Cancel').click()
  await form.waitFor({ state: 'detached' })
  await focusIs(alice, f => f.label === 'New note in Session 1', 'unchanged, Cancel closes it at once, focus back on "New note in Session 1"')
}

// =================================================================================================
// 15. Widths, both themes
// =================================================================================================
const LONG_TITLE = 'We crossed the river at dawn and found the old dwarf road that runs north past the broken bridge toward the grey hills where the eagles nest above a lake'
const WIDE_TABLE = [
  '| Road | Distance | Danger | Supplies | Weather | Guide | Notes on the way |',
  '|---|---|---|---|---|---|---|',
  '| Overthemountainsandfarawayroad | Fourhundredleaguesandmore | Trollsandgoblinsandwargsalike | Lembasandropeandlanterns | Snowandwindandrainallday | Gandalfthegreywanderer | Nothingbutstonesandsilencefordays |',
].join('\n')
/**
 * At 360, 390 and 768 px (Alice's phone) and 1280 (her laptop), in both themes: no sideways scroll;
 * the 30-word title wraps; the wide table scrolls inside its note; the editor fits, Save and Cancel
 * in view, and at 1280 no wider than 768 px.
 */
async function widths(where, { biographyTab = true } = {}) {
  for (const [who, width, height] of [[alice, 360, 800], [alice, 390, 844], [alice, 768, 1024], [wide, 1280, 800]]) {
    await resize(who, width, height)
    if (biographyTab) await biography(who)
    const sec = notesOf(who)
    await rowOf(sec, LONG_TITLE).waitFor({ timeout: 15_000 })
    for (const scheme of ['light', 'dark']) {
      await theme(who, scheme)
      const row = rowOf(sec, LONG_TITLE)
      await open(row)
      const look = await row.evaluate(el => {
        const h4 = el.querySelector('summary h4')
        const line = parseFloat(getComputedStyle(h4).lineHeight) || 24
        const wrap = el.querySelector('.note-text')?.closest('.overflow-x-auto')
        const cells = [...(wrap?.querySelectorAll('td') ?? [])]
        return {
          lines: Math.round(h4.getBoundingClientRect().height / line), scrolls: Boolean(wrap) && wrap.scrollWidth > wrap.clientWidth + 1,
          inside: Boolean(wrap) && wrap.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5,
          wrap: Math.round(wrap?.clientWidth ?? 0), table: Math.round(wrap?.querySelector('table')?.getBoundingClientRect().width ?? 0),
          // The widest cell's text, on how many lines: a long word broken where the table won't scroll.
          cellLines: Math.max(0, ...cells.map(td => Math.round(td.getBoundingClientRect().height / (parseFloat(getComputedStyle(td).lineHeight) || 20)))),
        }
      })
      await button(sec, 'New note').click()
      const form = formOf(who, 'New note')
      await form.waitFor()
      await wait(200)
      const [save, cancel, box] = [await boxOf(button(form, 'Save')), await boxOf(button(form, 'Cancel')), await boxOf(form)]
      const pageX = await sideways(who.page)
      const fits = [save, cancel].every(b => b.left >= 0 && b.right <= b.vw + 0.5 && b.top >= 0 && b.bottom <= b.vh + 0.5)
      check(pageX === 0 && look.lines >= 2 && look.scrolls && look.inside && fits && (width < 1280 || box.width <= 768),
        `${where}, at ${width} px, ${scheme}: nothing scrolls sideways, the 30-word title wraps (${look.lines} lines), the wide table scrolls inside its note, and the editor fits, Save and Cancel in view${width >= 1280 ? `, ${Math.round(box.width)} px wide` : ''} (${JSON.stringify({ pageX, look, save: [save.left, save.right, save.top, save.bottom], box: Math.round(box.width) })})`)
      if (biographyTab && [390, 768].includes(width)) await shoot(who, 'notes-editor')
      await button(form, 'Cancel').click()
      await form.waitFor({ state: 'detached' })
    }
    await theme(who, 'light')
  }
  await resize(alice, 390, 844)
}
part('15. widths')
{
  const made = await call(alice.page, `${ALICE_API}/notes`, { method: 'POST', body: { role: 'entry', title: LONG_TITLE, body: WIDE_TABLE, chapterId: null } })
  check(made.status === 201 && LONG_TITLE.split(' ').length === 30, `a note with a 30-word title and a wide table (${made.status})`)
  await noted(alice, ALICE_API, LONG_TITLE)
  await widths('on Biography')
}

// =================================================================================================
// 17. Another campaign, the same character
// =================================================================================================
part('17. another campaign')
{
  await bob.page.goto(inviteM)
  await bob.page.getByRole('radio', { name: /^Thorin/ }).check()
  await bob.page.getByRole('button', { name: 'Join as this character' }).click()
  await bob.page.waitForURL(/\/characters\/[\w-]+$/)
  await tablist(bob).waitFor({ timeout: 20_000 })
  const bobThorin = sql(`select id from "character" where "actorId" = 'thorin' and "campaignId" = '${M}'`)
  const BOB_M_API = `/api/characters/${bobThorin}`
  await biography(bob)
  const view = await bookOf(bob, BOB_M_API)
  check(view.entries.length === 0 && view.chapters.length === 0 && await notesOf(bob).getByText('No notes yet.', { exact: false }).isVisible(),
    "Bob claims Thorin in Mirkwood: his Mirkwood Biography's Notes are empty, none of Alice's Erebor notes among them")
  const ELVES = "The Elvenking's halls"
  await writeNote(bob, { title: ELVES, body: 'Barrels, and a river.' })
  const theirs = () => journal('personal', 'thorin', 'mirkwood')
  await until(() => theirs() && pagesOf(theirs()).some(p => p.name === ELVES), 'his note in a journal of its own', 20_000)
  check(theirs() !== book() && theirs().name === "Thorin's notes (Mirkwood)" && theirs().flags['sending-stone'].journal.campaign === 'mirkwood' && !pageNamed(ELVES),
    `his note makes a second journal, "${theirs().name}", flagged campaign mirkwood, apart from Erebor's`)
  await noted(bob, BOB_M_API, ELVES)
  check(!entryIn(await bookOf(alice, ALICE_API), ELVES) && await rowOf(notesOf(alice), ELVES).count() === 0, "and Alice's Erebor list doesn't show it")
}

// =================================================================================================
// 18. Unsafe HTML
// =================================================================================================
part('18. unsafe HTML')
{
  const UNSAFE = '<img src="x" onerror="window.__hit=1">\n\n[a](javascript:window.__hit=2)'
  await writeNote(alice, { title: 'Unsafe', body: UNSAFE })
  await until(() => pageNamed('Unsafe'), 'the note in Foundry', 20_000)
  const content = pageNamed('Unsafe').text.content
  check(!/onerror/i.test(content) && !/javascript:/i.test(content) && /<img/.test(content), `the page's HTML in Foundry has neither the onerror nor the javascript: link (${content})`)
  await noted(alice, ALICE_API, 'Unsafe')
  const row = rowOf(notesOf(alice), 'Unsafe')
  await open(row)
  await wait(800)
  const drawn = await row.evaluate(el => ({
    onerror: el.querySelectorAll('[onerror]').length,
    js: [...el.querySelectorAll('a')].filter(a => /^\s*javascript:/i.test(a.getAttribute('href') ?? '')).length,
  }))
  // Foundry shows the page as its sheet does, its HTML in the page.
  const tab = foundryTab()
  await tab.evaluate(html => { const div = document.createElement('div'); div.className = 'journal-page-content'; div.innerHTML = html; document.body.append(div) }, content)
  await wait(800)
  const hits = { app: await alice.page.evaluate(() => window.__hit), foundry: await tab.evaluate(() => window.__hit) }
  // The same Markdown's HTML uncleaned, in a page of its own: the probe would fire there.
  const probe = await browser.newPage()
  await probe.setContent(new globalThis.showdown.Converter({ ...CONST.SHOWDOWN_OPTIONS }).makeHtml(UNSAFE))
  await wait(500)
  const fired = await probe.evaluate(() => window.__hit)
  await probe.close()
  check(drawn.onerror === 0 && drawn.js === 0 && hits.app === undefined && hits.foundry === undefined && fired === 1,
    `the app draws it with no onerror and no javascript: link, and window.__hit stays undefined in the app's page and Foundry's (${JSON.stringify({ drawn, hits })}; uncleaned it fires: ${fired})`)
}

// =================================================================================================
// 19. The phone editor
// =================================================================================================
part('19. the phone editor')
{
  const LONG = Array.from({ length: 60 }, (_, n) => `Line ${n + 1} of the long road east.`).join('\n')
  await call(alice.page, `${ALICE_API}/notes`, { method: 'POST', body: { role: 'entry', title: 'The long road', body: LONG, chapterId: null } })
  await noted(alice, ALICE_API, 'The long road')
  await resize(alice, 390, 844)
  await biography(alice)
  const row = rowOf(notesOf(alice), 'The long road')
  await open(row)
  await button(row, 'Edit').click()
  const form = formOf(alice, 'Edit The long road')
  const area = form.getByLabel('Note', { exact: true })
  const atEnd = async () => {
    await area.focus()
    await alice.page.keyboard.press('Control+End')
    await wait(400)
    const [save, tabs] = [await boxOf(button(form, 'Save')), await boxOf(tablist(alice))]
    const end = await area.evaluate(el => ({ at: el.selectionStart === el.value.length, focused: el === document.activeElement }))
    return { save, tabs, end }
  }
  let m = await atEnd()
  check(m.end.at && m.end.focused && m.save.top >= m.tabs.bottom - 1 && m.save.bottom <= m.save.vh,
    `at 390 × 844 on Biography, a 60-line note in the editor, its end in view: Save is in the viewport, below the sheet's tab row (${JSON.stringify(m)})`)
  // The keyboard up: the page's viewport is what's left above it.
  await resize(alice, 390, 470)
  m = await atEnd()
  check(m.end.at && m.save.top >= m.tabs.bottom - 1 && m.save.bottom <= m.save.vh,
    `with a phone's keyboard up (390 × 470 left above it), Save stays in view, under the tab row (${JSON.stringify(m)})`)
  await shootBoth(alice, 'notes-editor-keyboard')
  await resize(alice, 390, 844)
  await button(form, 'Cancel').click()
  await form.waitFor({ state: 'detached' })
}

// =================================================================================================
// 20. No sheet: held back as too large
// =================================================================================================
const { buildEnvelope, post } = await import(`${MODULE}/scripts/transport.mjs`)
const sentThorin = () => postsOf('character.updated').filter(p => (p.campaign === 'erebor') && (p.data.character.id === 'thorin') && p.data.character.sheet).at(-1).data.character
/** Thorin sent to Erebor's app with no sheet: held back, as party-e2e posts it, or none at all, as from a system other than dnd5e. */
async function sheetless(withheld) {
  const { sheet: _sheet, sheetWithheld: _withheld, ...entry } = sentThorin()
  const before = postsOf('character.updated').length
  post(buildEnvelope('character.updated', { character: { ...entry, sheet: null, ...(withheld && { sheetWithheld: withheld }) } }, { campaign: settings.get('campaigns').find(c => c.id === 'erebor') }))
  await until(() => postsOf('character.updated').slice(before).some(p => (p.data.character.sheet === null) && (p.status < 300)), 'the sheet-less update taken')
}
/** Thorin's sheet sent again, as any change to him sends it. */
let hp = 30
async function sheetAgain() {
  const before = postsOf('character.updated').length
  await thorin.update({ 'system.attributes.hp.value': --hp })
  await until(() => postsOf('character.updated').slice(before).some(p => (p.campaign === 'erebor') && (p.data.character.id === 'thorin') && p.data.character.sheet), "Thorin's sheet sent again")
}
const paneOf = who => who.page.getByRole('region', { name: 'Character', exact: true })
part('20. no sheet, held back')
{
  await sheetless({ reason: 'tooLarge', bytes: 1_500_000, limit: 1_000_000 })
  const pane = paneOf(alice)
  await pane.getByText("Thorin's sheet is too large to send").waitFor({ timeout: 15_000 })
  const sec = pane.getByRole('region', { name: 'Notes', exact: true })
  await rowOf(sec, 'After the fire').waitFor({ timeout: 15_000 })
  check(await tablist(alice).count() === 0 && await sec.isVisible(), 'his sheet held back as too large, at 390 the Character tab says "Thorin\'s sheet is too large to send", and below it the Notes section lists his notes')
  await shootBoth(alice, 'notes-nosheet')
  await writeNote(alice, { title: 'Under no sheet', body: 'Written with no sheet in view.' })
  await noted(alice, ALICE_API, 'Under no sheet')
  check(Boolean(pageNamed('Under no sheet')), 'a note added there is saved, and reaches Foundry')
  await paneOf(wide).getByText("Thorin's sheet is too large to send").waitFor({ timeout: 15_000 })
  const look = await wide.page.evaluate(() => {
    const pane = document.getElementById('character-pane')
    const column = pane?.nextElementSibling
    return { shown: pane ? getComputedStyle(pane).display !== 'none' : false, pane: pane?.getBoundingClientRect().width ?? 0, column: column?.getBoundingClientRect().width ?? 0 }
  })
  check(look.shown && look.pane > 600 && look.column >= 320 && look.column <= 500 && await paneOf(wide).getByRole('region', { name: 'Notes', exact: true }).isVisible(),
    `at 1280 the Character pane shows, with why there's no sheet and the notes, beside the ${Math.round(look.column)} px column of combat and chat (${JSON.stringify(look)})`)
  await shootBoth(wide, 'notes-nosheet')
  await widths('under why there\'s no sheet', { biographyTab: false })

  // A new note half written there as the sheet comes again, the textarea in use.
  await button(sec, 'New note').click()
  const form = formOf(alice, 'New note')
  await form.getByLabel('Title', { exact: true }).fill('Half written')
  const area = form.getByLabel('Note', { exact: true })
  await area.fill('Typed as the sheet came')
  await area.focus()
  await alice.page.keyboard.press('End')
  await sheetAgain()
  await tablist(alice).waitFor({ timeout: 20_000 })
  const back = formOf(alice, 'New note')
  await back.waitFor({ timeout: 10_000 })
  const now = {
    tab: await tablist(alice).getByRole('tab', { name: /^Biography/ }).getAttribute('aria-selected'),
    title: await back.getByLabel('Title', { exact: true }).inputValue(), body: await back.getByLabel('Note', { exact: true }).inputValue(),
    focused: await back.getByLabel('Note', { exact: true }).evaluate(el => el === document.activeElement),
  }
  await alice.page.keyboard.type(', and kept on.')
  const typed = await back.getByLabel('Note', { exact: true }).inputValue()
  check(now.tab === 'true' && now.title === 'Half written' && now.body === 'Typed as the sheet came' && now.focused && typed === 'Typed as the sheet came, and kept on.',
    `the sheet sent again, the Biography tab is shown, the editor holds the same title and text, and the textarea still has focus: keys typed next go on its text (${JSON.stringify({ ...now, typed })})`)
  await button(back, 'Cancel').click()
  await button(alice.page.getByRole('dialog', { name: 'Discard your changes?' }), 'Discard').click()
  await back.waitFor({ state: 'detached' })
}

// =================================================================================================
// 21. No sheet: never arrived
// =================================================================================================
part('21. no sheet, never arrived')
{
  await sheetless(null)
  const pane = paneOf(alice)
  await pane.getByText("Thorin's sheet hasn't arrived").waitFor({ timeout: 15_000 })
  const sec = pane.getByRole('region', { name: 'Notes', exact: true })
  await rowOf(sec, 'Under no sheet').waitFor({ timeout: 15_000 })
  await writeNote(alice, { title: 'Before the sheet', body: 'Nothing to show yet.' })
  await noted(alice, ALICE_API, 'Before the sheet')
  check(true, 'with no sheet, as from a system other than dnd5e: "Thorin\'s sheet hasn\'t arrived", the Notes section below it, working')
  await paneOf(gm).getByText("Thorin's sheet hasn't arrived").waitFor({ timeout: 15_000 })
  const gmSec = paneOf(gm).getByRole('region', { name: 'Notes', exact: true })
  await rowOf(gmSec, 'Before the sheet').waitFor({ timeout: 15_000 })
  check(await gmSec.getByText('Only Thorin’s player and you see these.', { exact: true }).isVisible(), "the same at the Gamemaster's page for Thorin")
  await sheetAgain()
  await tablist(alice).waitFor({ timeout: 20_000 })
}

// =================================================================================================
// 22. Tab switches
// =================================================================================================
part('22. tab switches')
{
  const sent = []
  alice.page.on('request', request => { if (/\/notes(\/|$|\?)/.test(new URL(request.url()).pathname + new URL(request.url()).search) && request.method() !== 'GET') sent.push(request.method()) })
  await biography(alice)
  const row = rowOf(notesOf(alice), 'After the fire')
  await open(row)
  await button(row, 'Edit').click()
  const form = formOf(alice, 'Edit After the fire')
  await form.getByLabel('Title', { exact: true }).fill('After the fire, again')
  await form.getByLabel('Note', { exact: true }).fill('Half of a change.')
  const holds = async what => {
    const back = formOf(alice, 'Edit After the fire')
    await back.waitFor({ timeout: 10_000 })
    const kept = [await back.getByLabel('Title', { exact: true }).inputValue(), await back.getByLabel('Note', { exact: true }).inputValue()]
    check(same(kept, ['After the fire, again', 'Half of a change.']) && sent.length === 0 && pageNamed('After the fire'),
      `${what}: the editor holds the change, and nothing was saved (${JSON.stringify(kept)}, ${sent.length} writes sent)`)
  }
  await alice.tab('Inventory')
  await alice.page.getByRole('tabpanel').getByText('Currency', { exact: true }).first().waitFor({ timeout: 15_000 })
  await alice.tab('Biography')
  await holds('Inventory, then Biography again')
  await alice.party('The Iron Company')
  const panel = alice.page.getByRole('dialog', { name: 'The Iron Company' })
  await panel.getByRole('heading', { name: /^Members/ }).waitFor({ timeout: 15_000 })
  await button(panel, 'Close').click()
  await panel.waitFor({ state: 'hidden' })
  await alice.tab('Biography')
  await holds('the party panel opened over the sheet and closed again')
  await button(formOf(alice, 'Edit After the fire'), 'Cancel').click()
  await button(alice.page.getByRole('dialog', { name: 'Discard your changes?' }), 'Discard').click()
}

// =================================================================================================
// 8, again: nothing of Thorin's Erebor notes ever reached Bob's browser
// =================================================================================================
part('8b. what Bob saw')
{
  const words = ['goblin', 'ravenhill', 'watch rota', 'arkenstone', 'after the fire', 'keyed in', 'shift tabbed', 'under no sheet', 'before the sheet', 'the long road', 'dwalin']
  const leaks = bobSaw.filter(r => words.some(w => r.body.toLowerCase().includes(w))).map(r => r.url)
  check(bobSaw.length > 20 && leaks.length === 0, `of the ${bobSaw.length} responses Bob's browser received, none carries a word of Thorin's Erebor notes (${JSON.stringify(leaks.slice(0, 5))})`)
}
note(`journal writes in Foundry: ${journalWrites.length}`)
await finish()
