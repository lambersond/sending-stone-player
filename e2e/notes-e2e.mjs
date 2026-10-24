// A character's own journal (module 0.35.0 and the app, its contract §13.2; module 0.34.0's §13.2 before
// it), end to end, in the world of world-030.mjs, with Foundry's journals the harness's stand-in
// (fvtt/journal-core.mjs). Alice runs two campaigns, Erebor and Mirkwood, rolls and moves off (removals
// have no switch under dnd5e, so the module fetches for them too), and plays Thorin in Erebor, on a
// phone (390 × 844) and a laptop (1280 × 800); Bob plays Vex there, and in step 17 claims Thorin in
// Mirkwood. The Gamemaster, Alice's own campaign, at Thorin's page. The Iron Company is Erebor's party,
// for its panel over the sheet. The journal is a card, first on the Biography tab, under the sheet's
// seven tabs, no tab added; or, with no sheet (held back as too large, or never sent), under why there's
// none; its button opens the journal's modal: its header, its contents (a drawer on a phone) and its
// reader (journal-ui.mjs). A chapter and a note written live, the journal Foundry is made to hold, its
// pages and flags; headings refused, the preview; a note moved by Edit and by Move, each landing last in
// its group in Foundry; a delete and the journal's "Last changed by"; privacy (nothing of Thorin's
// reaches Bob's browser, 404s); the Gamemaster writing; Foundry's own edits, its rich-text editor, pages
// added and deleted there, the journal deleted; the keyboard; every width in both themes; another
// campaign's journal for the same character; unsafe HTML; the phone editor, and a keyboard's inset;
// the sheet withheld and sent again with a note half written; a draft kept with the journal closed.
// SKEW=033 with MODULE=module-0.33.0: no notes in the hello, notes kept and waiting, and no note
// command handed over. Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BOB, MODULE, SKEW033, addPageInFoundry, browse, browser, call, character, check, deleteInFoundry, editInFoundry,
  finish, foundryTab, foundryWorld, group, hold, journal, journalWrites, launch, lastHello, newCampaign, note, pagesOf, part,
  postsOf, same, settings, settled, shoot, shootBoth, sideways, sql, startModule, theme, until, wait,
} from './world-030.mjs'
import {
  addChapter, boxOf, button, cardCounts, closeJournal, contents, contentsButton, contentsPane, editorOf, header,
  headerLastChanged, journalCard, journalOf, listed, moveCard, moveMenu, moveTo, noteLines, notesIn, openJournal,
  pickGroup, pickNote, reader, readerShows, readerTitle, said, writeNote,
} from './journal-ui.mjs'

const GAME = 'https://erebor-hall.forge-vtt.com'
const ADDRESS = 'erebor-hall.forge-vtt.com'
const EREBOR = 'Erebor'
const MIRKWOOD = 'Mirkwood'
const SECRET = 'erebor-notes-secret-35'
const SECRET_M = 'mirkwood-notes-secret-35'
const MINE = 'My Journal'
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: EREBOR, address: ADDRESS, secret: SECRET })
const { id: M, invite: inviteM } = await newCampaign({ title: MIRKWOOD, address: ADDRESS, secret: SECRET_M })
await foundryWorld()
game.modules.get('sending-stone').version = SKEW033 ? '0.33.0' : '0.35.0'

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
/** Thorin's Erebor book's own record of its last change that no note shows (module 0.35.0). */
const bookRecord = () => JSON.parse(sql(`select coalesce(json_agg(b)::text, '[]') from (select "changedAt", "changedBy", "changedIn" from journal_book where "campaignId" = '${A}' and kind = 'personal' and "actorId" = 'thorin') b`))[0] ?? null
/** Thorin's journal for Erebor in the stand-in Foundry, and its pages in Foundry's order. */
const book = () => journal('personal', 'thorin', 'erebor')
const pages = () => (book() ? pagesOf(book()) : [])
const pageNamed = name => pages().find(p => p.name === name) ?? null
const flagsOf = page => page?.flags?.['sending-stone'] ?? null
/** Foundry's pages as groups: the loose notes before the first chapter page, then each chapter's, by title. */
const foundryGroups = () => {
  const groups = { '': [] }
  let at = ''
  for (const page of pages()) {
    if (page.title?.level === 1) { at = page.name; groups[at] = [] } else groups[at].push(page.name)
  }
  return groups
}
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

/** A page's Journal card. */
const cardOf = who => journalCard(who.page)
/** The card's line of counts, as shown. */
const countsOf = async who => (await cardCounts(cardOf(who)).textContent()).trim()
/** The Biography tab, on the sheet, and the card on it, read. */
async function biography(who) {
  await who.tab('Biography')
  await cardOf(who).waitFor({ timeout: 15_000 })
  await until(async () => !/^(Loading notes…|Notes couldn’t)/.test(await countsOf(who)), 'the card read', 15_000)
}
/** The journal opened from its card; its dialog. */
const open = (who, title = MINE) => openJournal(who.page, title)
const resize = async (who, width, height) => {
  await who.page.setViewportSize({ width, height })
  who.width = width
  await wait(300)
}
const focused = who => who.page.evaluate(() => {
  const el = document.activeElement
  return {
    tag: el?.tagName, text: el?.textContent?.trim().slice(0, 80), label: el?.getAttribute('aria-label'), name: el?.getAttribute('aria-label') ?? el?.textContent?.trim(),
    inContents: Boolean(el?.closest('[id$="-contents"]')), inDialog: Boolean(el?.closest('dialog')),
  }
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
/** Until the reader's note shows no chip: as the page last heard it, made in Foundry. */
const quiet = dialog => until(async () => (await reader(dialog).locator('article').getByText(/^(Saving to the game…|Waiting for the game)$/).count()) === 0, 'the note made, on the page', 15_000)
/** What the header said, once it says something. */
async function saidNow(dialog, test = text => text !== '') {
  let text = ''
  await until(async () => test(text = (await said(dialog).textContent()).trim()), `the header to say it (${JSON.stringify(text)})`, 15_000)
  return text
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
  const dialog = await open(alice)
  const BANNER = 'Notes are kept here for now. They reach Foundry once your Gamemaster’s game connects with Sending Stone 0.34.0 or later.'
  await dialog.getByText(BANNER, { exact: true }).waitFor({ timeout: 15_000 })
  check(true, `the journal's modal says "${BANNER}"`)
  await writeNote(dialog, { title: 'Kept for later', body: 'Written while the module was 0.33.0.' })
  const kept = await noted(alice, ALICE_API, 'Kept for later', { state: 'waiting' })
  await readerShows(dialog, 'Kept for later')
  await reader(dialog).locator('article').getByText('Waiting for the game', { exact: true }).waitFor({ timeout: 15_000 })
  check(true, 'the reader shows it, its chip "Waiting for the game"')
  const rows = writeRows()
  check(rows.length === 1 && rows[0].status === 'pending' && rows[0].op === 'create' && rows[0].noteId === kept.id,
    `Alice's note is kept: one write, pending, the note's id (${JSON.stringify(rows)})`)
  const words = await saidNow(dialog)
  check(words === 'Saved. It goes to Foundry when your Gamemaster’s game is next open.', `the header says it's saved, and when it goes (${words})`)
  await shootBoth(alice, 'journal-skew033')
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
// 1. Where it is
// =================================================================================================
part('1. where it is')
{
  const features = lastHello('erebor').data.features
  // Changed on purpose (round 0.35.0 §13.2): the hello also says it takes orders and says who changed a journal.
  // Changed on purpose (round 0.36.0 §13.4): and its features gain companions.
  check(same(Object.keys(features), ['rolls', 'transfers', 'removals', 'notes', 'companions'])
    && same(features.notes, { enabled: true, kinds: ['personal', 'party'], reason: null, journals: [], orders: true, changes: true }),
    `the hello says notes are kept here, with no journal yet, and that it takes orders and says who changed a journal (${JSON.stringify(features.notes)})`)
  await until(() => notesEnabled() === 't', 'the app to keep notes on', 15_000)
  check(notesEnabled() === 't', 'the app keeps notesEnabled on in the campaign row')
}
const tablist = who => who.page.getByRole('tablist', { name: 'Character sheet' })
const tabNames = async who => (await tablist(who).getByRole('tab').allTextContents()).map(t => t.trim().split(/[\s,]/)[0])
{
  const names = await tabNames(alice)
  const nav = await alice.nav.getByRole('button').evaluateAll(buttons => buttons.map(b => b.textContent.trim().split(/\s/)[0]))
  check(same(names, ['Character', 'Actions', 'Inventory', 'Spells', 'Features', 'Effects', 'Biography']) && same(nav, ['Character', 'Combat', 'Chat']),
    `at 390 the sheet's tablist has its seven tabs, no Notes or Journal among them, and the Table nav Character, Combat and Chat (${JSON.stringify([names, nav])})`)
}
await biography(alice)
{
  const order = await alice.page.getByRole('tabpanel').evaluate(panel => {
    const regions = [...panel.querySelectorAll('section[aria-labelledby]')].map(s => document.getElementById(s.getAttribute('aria-labelledby'))?.textContent.trim())
    const h2s = [...panel.querySelectorAll('h2')].map(h => h.textContent.trim())
    return { regions, h2s }
  })
  check(order.regions[0] === 'Journal' && order.h2s[0] === 'Journal' && order.h2s.indexOf('Details') > 0,
    `on Biography the first region is Journal, its h2 before Details' (${JSON.stringify(order)})`)
  const card = cardOf(alice)
  const shown = {
    title: await card.getByText(MINE, { exact: true }).isVisible(),
    who: await card.getByText('Only you and your Gamemaster see these.', { exact: true }).isVisible(),
    counts: await countsOf(alice),
    open: await button(card, `Open ${MINE}`).isVisible(),
  }
  check(shown.title && shown.who && shown.counts === 'No notes yet' && shown.open,
    `the card says "My Journal", "Only you and your Gamemaster see these.", "No notes yet", with "Open My Journal" (${JSON.stringify(shown)})`)
}
/** The card's box, its title's and its button's. */
const cardLayout = who => cardOf(who).evaluate(section => {
  const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height } }
  const inner = section.querySelector('div.rounded-2xl')
  const button = [...section.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Open '))
  const title = [...section.querySelectorAll('p')][0]
  return { section: box(section), inner: box(inner), button: box(button), title: box(title) }
})
let cardHeight
for (const width of [360, 390]) {
  await resize(alice, width, 844)
  check(await sideways(alice.page) === 0, `at ${width} px nothing on Biography scrolls sideways`)
}
{
  const look = await cardLayout(alice)
  cardHeight = look.section.height
  // A column: the button under the title, as wide as the card's inside (its 16 px padding and border aside).
  check(look.button.top >= look.title.bottom && Math.abs(look.button.width - (look.inner.width - 34)) <= 1,
    `at 390 the card is a column, its button under the title and full width (${Math.round(look.button.width)} of ${Math.round(look.inner.width)} px), the card ${Math.round(cardHeight)} px tall`)
}
await shootBoth(alice, 'journal-card', cardOf(alice))
await resize(alice, 768, 1024)
{
  const look = await cardLayout(alice)
  check(Math.abs(look.section.width - 608) <= 1 && look.button.top >= look.title.bottom && await sideways(alice.page) === 0,
    `at 768 the card is 608 px wide, a column (${Math.round(look.section.width)} px)`)
  await shootBoth(alice, 'journal-card', cardOf(alice))
}
await resize(alice, 390, 844)
const wide = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await tablist(wide).waitFor({ timeout: 20_000 })
await biography(wide)
{
  const look = await wide.page.evaluate(() => {
    const pane = document.getElementById('character-pane')
    const section = [...document.querySelectorAll('section[aria-labelledby]')].find(s => document.getElementById(s.getAttribute('aria-labelledby'))?.textContent.trim() === 'Journal')
    const column = pane?.nextElementSibling
    return {
      inPane: Boolean(pane?.contains(section)), section: section?.getBoundingClientRect().width ?? 0, column: column?.getBoundingClientRect().width ?? 0,
      aside: document.querySelector('[role=tablist][aria-label="Combat or chat"]') !== null,
    }
  })
  const card = await cardLayout(wide)
  check(look.inPane && look.section >= 700 && look.column >= 320 && look.column <= 500 && look.aside && await wide.nav.isVisible() === false
    && card.button.top < card.title.bottom && card.button.width < card.inner.width / 2 && Math.abs(card.button.right - (card.inner.right - 17)) <= 1,
    `at 1280 it's in the Character pane, ${Math.round(look.section)} px wide, beside the ${Math.round(look.column)} px column of combat and chat; the card a row, its button at its end (${JSON.stringify({ look, button: card.button })})`)
  await shootBoth(wide, 'journal-card', cardOf(wide))
}
/** The dialog's box on screen. */
const dialogBox = dialog => boxOf(dialog)
{
  // The modal's size, empty: full screen on a phone, at most 960 × 880 from 640 px of screen.
  const sizes = []
  for (const [who, width, height, want] of [[alice, 390, 844, [390, 844]], [alice, 768, 1024, [736, 880]], [wide, 1280, 800, [960, 736]]]) {
    await resize(who, width, height)
    const dialog = await open(who)
    const box = await dialogBox(dialog)
    sizes.push({ width, got: [Math.round(box.width), Math.round(box.height)], want, at: [Math.round(box.left), Math.round(box.top)] })
    await closeJournal(dialog)
  }
  check(sizes.every(s => same(s.got, s.want)) && same(sizes[0].at, [0, 0]),
    `the journal opens full screen at 390 × 844 (390 × 844 at the corner), 736 × 880 at 768 × 1024 and 960 × 736 at 1280 × 800 (${JSON.stringify(sizes)})`)
  await resize(alice, 390, 844)
}

// =================================================================================================
// 2. Empty
// =================================================================================================
part('2. empty')
let dialog = await open(alice)
{
  const shown = {
    empty: await dialog.getByText('No notes yet', { exact: true }).isVisible(),
    why: await dialog.getByText('Write down what happened, what you found and who you met.', { exact: true }).isVisible(),
    newNote: await button(dialog, 'New note').isVisible(), newChapter: await button(dialog, 'New chapter').isVisible(),
    header: await header(dialog).getByText('You and your Gamemaster', { exact: true }).isVisible(),
    contents: await dialog.locator('nav[aria-label="Contents"]').count(),
  }
  check(shown.empty && shown.why && shown.newNote && shown.newChapter && shown.header && shown.contents === 0,
    `empty, the journal says "No notes yet" and "Write down what happened, what you found and who you met.", with New note and New chapter, no contents; the header "You and your Gamemaster" (${JSON.stringify(shown)})`)
}

// =================================================================================================
// 3. A chapter and a note, live
// =================================================================================================
part('3. a chapter and a note')
const CAVE = 'The goblin cave'
const CAVE_BODY = '### Loot\n- 30 gp\n- a *strange* key\n\n| Who | What |\n|---|---|\n| Vex | rope |'
{
  await button(dialog, 'New chapter').click()
  const form = editorOf(dialog, 'New chapter')
  const field = form.getByLabel('Chapter title', { exact: true })
  await field.fill('Session 1')
  const [fieldBox, saveBox] = [await boxOf(field), await boxOf(button(form, 'Save'))]
  check(saveBox.top > fieldBox.bottom && await form.locator('footer, div.border-t').getByRole('button', { name: 'Save', exact: true }).count() === 1,
    `New chapter: its Save is in the footer, below the field (${Math.round(saveBox.top)} > ${Math.round(fieldBox.bottom)})`)
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
}
const session1 = await noted(alice, ALICE_API, 'Session 1', { chapter: true })
await until(() => pageNamed('Session 1'), 'the chapter in Foundry')
// The note's page is held at its write in Foundry a while, so that it's seen on its way.
const held = hold('create', (entry, list) => list.some(page => page.name === CAVE))
await writeNote(dialog, { title: CAVE, body: CAVE_BODY, chapter: 'Session 1' })
{
  const words = await saidNow(dialog)
  check(words === 'Saved.', `saved live, the header says "Saved." (${words})`)
  await readerShows(dialog, CAVE)
  await until(() => held.held, "the note's page to reach Foundry's write", 20_000)
  await reader(dialog).locator('article').getByText('Saving to the game…', { exact: true }).waitFor({ timeout: 15_000 })
  check(true, 'while Foundry makes it, the reader shows it, its chip "Saving to the game…"')
  held.release()
  await noted(alice, ALICE_API, CAVE)
  await quiet(dialog)
  check(true, 'and once it\'s made, it has no chip')
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
  const bar = await reader(dialog).evaluate(pane => {
    const row = pane.firstElementChild
    const p = [...row.querySelectorAll('p')].find(el => /Ch(apter|\.)/.test(el.textContent))
    const shown = [...(p?.children ?? [])].filter(el => getComputedStyle(el).display !== 'none' && !el.classList.contains('sr-only')).map(el => el.textContent)
    const sr = [...(p?.children ?? [])].filter(el => el.classList.contains('sr-only') && getComputedStyle(el).display !== 'none').map(el => el.textContent)
    return { shown, sr }
  })
  const chapterButton = reader(dialog).locator('article > button').first()
  const look = {
    bar, eyebrow: (await chapterButton.textContent()).trim(), upper: await chapterButton.evaluate(el => getComputedStyle(el).textTransform),
    h3: (await readerTitle(dialog).textContent()).trim(), lines: await noteLines(dialog), header: await headerLastChanged(dialog),
  }
  check(same(look.bar.shown, ['Ch. 1']) && same(look.bar.sr, ['Chapter 1']) && look.eyebrow === 'Session 1' && look.upper === 'uppercase' && look.h3 === CAVE,
    `the reader at 390: "Ch. 1" in its bar (said "Chapter 1"), the chapter's title over the note's, drawn uppercase, and the h3 "${CAVE}" (${JSON.stringify(look)})`)
  check(same(look.lines, ['Written by Thorin, just now', 'Last changed by Thorin, just now']) && look.header === 'Last changed by Thorin, just now',
    `its lines "Written by Thorin, just now" and "Last changed by Thorin, just now"; the header "Last changed by Thorin, just now" (${JSON.stringify(look)})`)
  const drawn = await reader(dialog).locator('article').evaluate(el => ({
    table: Boolean(el.querySelector('.note-text table')), loot: [...el.querySelectorAll('.note-text h4')].map(h => h.textContent),
    h5: el.querySelectorAll('.note-text h5').length, h3: el.querySelector('h3')?.textContent,
  }))
  check(drawn.table && same(drawn.loot, ['Loot']) && drawn.h5 === 0 && drawn.h3 === CAVE, `a table drawn, and "Loot" an h4 under the note's h3 (${JSON.stringify(drawn)})`)
  await shootBoth(alice, 'journal-note')
}
// Eleven more, through the API for speed: five in no chapter, six in Session 1.
const LOOSE = ['Loose 1', 'Loose 2', 'Loose 3', 'Loose 4', 'Loose 5']
const IN_S1 = ['S1 a', 'S1 b', 'S1 c', 'S1 d', 'S1 e', 'S1 f']
{
  await closeJournal(dialog)
  await until(async () => /^1 chapter · 1 note · Last changed by Thorin, just now$/.test(await countsOf(alice)), 'the card to count one', 15_000)
  // From its first note the card names the journal in Foundry, as v0.34's who-sees words do, and its
  // last change: as tall from then on, whatever the journal holds.
  const one = await cardLayout(alice)
  note(`the card at 390: ${cardHeight} px empty, ${one.section.height} px once the journal has a note`)
  for (const [title, chapterId] of [...LOOSE.map(t => [t, null]), ...IN_S1.map(t => [t, session1.id])]) {
    const made = await call(alice.page, `${ALICE_API}/notes`, { method: 'POST', body: { role: 'entry', title, body: `${title}'s text.`, chapterId } })
    if (made.status !== 201) throw new Error(`POST ${title}: ${made.status} ${made.text}`)
  }
  await noted(alice, ALICE_API, 'S1 f')
  await until(async () => /^1 chapter · 12 notes · Last changed by Thorin, just now$/.test(await countsOf(alice)), 'the card to count them', 15_000)
  const look = await cardLayout(alice)
  check(look.section.height === one.section.height && await cardOf(alice).locator('li, details, article').count() === 0,
    `with twelve notes the card says "${await countsOf(alice)}", lists none, and is as tall as with one (${look.section.height} px, was ${one.section.height})`)
}
{
  // The modal at each size, with its contents.
  const look = []
  for (const [who, width, height] of [[alice, 390, 844], [alice, 768, 1024], [wide, 1280, 800]]) {
    await resize(who, width, height)
    if (who === wide) await biography(wide)
    dialog = await open(who)
    await until(async () => (await dialog.locator('nav[aria-label="Contents"]').count()) > 0, 'the contents', 10_000)
    const pane = contentsPane(dialog)
    const at = {
      width, dialog: await dialogBox(dialog), contents: await boxOf(pane), button: await contentsButton(dialog).isVisible(),
      inert: await pane.evaluate(el => Boolean(el.closest('[inert]'))), pageX: await sideways(who.page),
      modalX: await dialog.evaluate(el => el.scrollWidth - el.clientWidth),
    }
    look.push(at)
    await shootBoth(who, 'journal-modal')
    if (width === 390) {
      await contents(dialog)
      await shootBoth(who, 'journal-drawer')
    }
    await closeJournal(dialog)
  }
  const [phone, tablet, desktop] = look
  check(phone.button && phone.inert && phone.contents.right <= phone.dialog.left + 1 && Math.round(phone.dialog.width) === 390,
    `at 390 × 844 the contents are behind "Contents", a drawer off the screen and inert while closed (${JSON.stringify(phone.contents)})`)
  check(!tablet.button && !tablet.inert && Math.round(tablet.contents.width) === 256 && !desktop.button && !desktop.inert && Math.round(desktop.contents.width) === 288,
    `at 768 × 1024 the contents are a pane 256 px wide, at 1280 × 800 288 px, with no Contents button (${Math.round(tablet.contents.width)}, ${Math.round(desktop.contents.width)})`)
  check(look.every(at => at.pageX === 0 && at.modalX === 0), `nothing scrolls sideways, in the page or the modal (${JSON.stringify(look.map(at => [at.pageX, at.modalX]))})`)
  await resize(alice, 390, 844)
}

// =================================================================================================
// 4. Headings refused
// =================================================================================================
part('4. headings')
dialog = await open(alice)
{
  const before = { pages: pages().length, writes: writeRows().length }
  await contents(dialog)
  await button(contentsPane(dialog), 'New note').click()
  const form = editorOf(dialog, 'New note')
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
  const [alertBox, saveBox] = [await boxOf(alert), await boxOf(button(form, 'Save'))]
  check(await alert.textContent() === 'Use ### or more for headings: # and ## are the journal’s chapters and notes.' && await form.isVisible() && await body.inputValue() === 'First line\n#loot'
    && alertBox.bottom <= saveBox.top + 1,
    `saved, the editor stays open with its text, its footer saying "${await alert.textContent()}" over Save`)
  await body.fill('Title\n-')
  await until(async () => (await hint.textContent()).includes('on the line below it'), 'the under-rule hint', 5_000)
  check(await hint.textContent() === 'Line 1 has = or - on the line below it, which makes it a heading. Leave a blank line between them.',
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
  await contents(dialog)
  await button(contentsPane(dialog), 'New note').click()
  const form = editorOf(dialog, 'New note')
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
  await pickNote(dialog, CAVE)
  await quiet(dialog)
  await button(reader(dialog), `Edit ${CAVE}`).click()
  const form = editorOf(dialog, `Edit ${CAVE}`)
  await form.getByLabel('Title', { exact: true }).fill('Goblin cave')
  await form.locator('select').selectOption({ label: 'No chapter' })
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await until(() => pageNamed('Goblin cave') && flagsOf(pageNamed('Goblin cave')).chapter === null, 'the page renamed and moved in Foundry', 20_000)
  await noted(alice, ALICE_API, 'Goblin cave')
  const groups = foundryGroups()
  check(pageNamed('Goblin cave').id === entryIn(await bookOf(alice, ALICE_API), 'Goblin cave').id && same(groups[''], [...LOOSE, 'Goblin cave']),
    `Edit's Chapter to No chapter: the page's name and its chapter flag change in Foundry, its id kept, and it's last of the notes in no chapter there, though older than them (${JSON.stringify(groups[''])})`)
  await until(async () => same(await notesIn(dialog, 'Not in a chapter'), [...LOOSE, 'Goblin cave']), 'the contents to list it last of Not in a chapter', 10_000)
  check(true, 'the contents list it last under "Not in a chapter"')
  await readerShows(dialog, 'Goblin cave')
  await quiet(dialog)
  await moveTo(dialog, 'Goblin cave', 'Session 1')
  const words = await saidNow(dialog, text => /^Moved/.test(text))
  await until(() => flagsOf(pageNamed('Goblin cave'))?.chapter === session1.id, 'the page moved back in Foundry', 20_000)
  const after = foundryGroups()
  check(words === 'Moved to Session 1.' && same(after['Session 1'], [...IN_S1, 'Goblin cave']) && same(after[''], LOOSE),
    `Move, from the note's bar, to Session 1: "${words}", and in Foundry it's last in Session 1 (${JSON.stringify(after['Session 1'])})`)
  await until(async () => same(await notesIn(dialog, 'Session 1'), [...IN_S1, 'Goblin cave']), 'the contents to list it last of Session 1', 10_000)
  check(true, 'the contents list it last under Session 1, at once')
  // The card's Move to chapter, from the page of the notes in no chapter.
  await pickGroup(dialog, 'Not in a chapter')
  const hint = reader(dialog).getByText('These notes aren’t in any chapter yet. Use Move to chapter to file one.', { exact: true })
  check(await hint.isVisible(), 'the page of the notes in no chapter says "These notes aren’t in any chapter yet. Use Move to chapter to file one."')
  await moveCard(dialog, 'Loose 1', 'Session 1')
  const moved = await saidNow(dialog, text => /^Moved/.test(text))
  await until(() => flagsOf(pageNamed('Loose 1'))?.chapter === session1.id, 'Loose 1 moved in Foundry', 20_000)
  await noted(alice, ALICE_API, 'Loose 1')
  const last = foundryGroups()
  check(moved === 'Moved to Session 1.' && same(last['Session 1'], [...IN_S1, 'Goblin cave', 'Loose 1']) && same(last[''], LOOSE.slice(1)),
    `the card's Move to chapter does the same: "${moved}", and Loose 1, the oldest of them, lands last in Session 1 in Foundry (${JSON.stringify(last)})`)
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
  check(bobs?.kind === 'personal' && bobs.entries.length === 0 && await countsOf(bob) === 'No notes yet' && !('lastChange' in bobs),
    "Bob's own Biography's card says No notes yet, his own book empty, none of Thorin's notes, and no last change")
  for (const [path, method] of [[`${ALICE_API}/notes`], [`${ALICE_API}/notes?version=0`], [`${ALICE_API}/notes?version=0&live=1`], [`${ALICE_API}/notes/${answer.json.id}?stamp=n:`, 'DELETE'], [`${ALICE_API}/notes/order`, 'PUT']]) {
    const got = await call(bob.page, path, { method, ...(method === 'PUT' && { body: { chapterId: null, ids: [answer.json.id], stamp: 'g:0' } }) })
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
  await pickNote(dialog, 'Goblin cave')
  // As the page last saw it: made in Foundry, its stamp Foundry's revision.
  await quiet(dialog)
  await button(reader(dialog), 'Delete Goblin cave').click()
  const confirm = alice.page.getByRole('dialog', { name: 'Delete Goblin cave?', exact: true })
  await confirm.waitFor({ timeout: 10_000 })
  check((await confirm.textContent()).includes('It’s deleted from Foundry’s journal too.') && !(await confirm.textContent()).includes('next open'),
    'Delete asks "Delete Goblin cave?": "It’s deleted from Foundry’s journal too."')
  const answered = alice.page.waitForResponse(r => r.request().method() === 'DELETE' && /\/notes\//.test(r.url()))
  await button(confirm, 'Delete').click()
  const answer = await answered
  check(answer.status() === 200, `the delete is taken (${answer.status()})`)
  const words = await saidNow(dialog, text => text === 'Deleted.')
  await readerShows(dialog, 'Loose 1')
  await focusIs(alice, f => f.tag === 'H3' && f.text === 'Loose 1', `"${words}", and the reader shows the next note, Loose 1, focus on its h3`)
  await until(() => !pageNamed('Goblin cave'), 'the note gone from Foundry', 20_000)
  await until(async () => !entryIn(await bookOf(alice, ALICE_API), 'Goblin cave'), 'the delete made, in the app', 20_000)
  const view = await bookOf(alice, ALICE_API)
  const record = bookRecord()
  const latest = Math.max(...[...view.entries, ...view.chapters].map(n => Date.parse(n.modifiedAt)))
  await until(async () => same(await notesIn(dialog, 'Session 1'), [...IN_S1, 'Loose 1', 'Ravenhill']), 'the contents without it', 10_000)
  check(!entryIn(view, 'Goblin cave'), 'it\'s gone from the contents and from Foundry\'s journal')
  await until(async () => await headerLastChanged(dialog) === 'Last changed by Thorin, just now', 'the header to name the delete', 10_000)
  check(record?.changedBy === 'Thorin' && record.changedIn === 'app' && Date.parse(view.lastChange.at) === Date.parse(record.changedAt) && Date.parse(record.changedAt) > latest,
    `the header says "Last changed by Thorin, just now" from the delete, later than any note's own change, which the book records (${JSON.stringify({ record, lastChange: view.lastChange, latest: new Date(latest).toISOString() })})`)
}

// =================================================================================================
// 9. The Gamemaster
// =================================================================================================
part('9. the Gamemaster')
const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin`, toasts: false })
await tablist(gm).waitFor({ timeout: 20_000 })
await biography(gm)
let gmDialog
{
  const card = cardOf(gm)
  check(await card.getByText('Thorin’s Journal', { exact: true }).isVisible() && await button(card, 'Open Thorin’s Journal').isVisible()
    && await card.getByText('Only Thorin’s player and you see these.', { exact: true }).isVisible(),
    'at Thorin\'s page, the Gamemaster\'s Biography has the card "Thorin’s Journal", "Only Thorin’s player and you see these.", and "Open Thorin’s Journal"')
  gmDialog = await openJournal(gm.page, 'Thorin’s Journal')
  check(await header(gmDialog).getByText('Thorin’s player and you', { exact: true }).isVisible() && (await notesIn(gmDialog, 'Session 1'))?.includes('Ravenhill'),
    'its header says "Thorin’s player and you", with his notes')
  await writeNote(gmDialog, { title: 'Watch rota', body: 'Dwalin keeps the first watch.', chapter: null })
  await until(() => pageNamed('Watch rota'), "the Gamemaster's note in Foundry", 20_000)
  const flags = flagsOf(pageNamed('Watch rota'))
  check(flags.modified.gm === true && flags.modified.actor === null && same(flags.author, { actor: null, gm: true }),
    `written by the Gamemaster: modified ${JSON.stringify(flags.modified)}, author ${JSON.stringify(flags.author)}`)
  await noted(alice, ALICE_API, 'Watch rota')
  await until(async () => (await notesIn(dialog, 'Not in a chapter'))?.includes('Watch rota'), 'Alice to see it', 15_000)
  await pickNote(dialog, 'Watch rota')
  const lines = await noteLines(dialog)
  check(same(lines, ['Written by Gamemaster, just now', 'Last changed by Gamemaster, just now']), `Alice's reader: ${JSON.stringify(lines)}`)
}

// =================================================================================================
// 10. Edited in Foundry
// =================================================================================================
part('10. edited in Foundry')
{
  await pickNote(dialog, 'Ravenhill')
  const at = Date.now()
  await editInFoundry('alice', pageNamed('Ravenhill'), { markdown: 'changed there' })
  await until(async () => (await noteLines(dialog))[1] === 'Last changed by Thorin in Foundry, just now', 'the reader to say it was changed in Foundry', 20_000)
  const took = Date.now() - at
  await reader(dialog).locator('.note-text').getByText('changed there').waitFor({ timeout: 10_000 })
  check(took < 5000, `Alice changes it in Foundry: within 5 s her reader says "Last changed by Thorin in Foundry, just now" and shows "changed there" (${took} ms)`)
}

// =================================================================================================
// 11. Foundry's own editor
// =================================================================================================
part("11. Foundry's own editor")
{
  await editInFoundry('gm', pageNamed('Watch rota'), { html: '<p>rich</p>' })
  await until(async () => (await entryIn(await bookOf(alice, ALICE_API), 'Watch rota'))?.foundryOnly === 'html', 'the note to come back read only', 20_000)
  await pickNote(dialog, 'Watch rota')
  await reader(dialog).getByText('Written in Foundry’s own editor: change it there.', { exact: true }).waitFor({ timeout: 10_000 })
  check(await button(reader(dialog), 'Edit Watch rota').count() === 0 && await button(reader(dialog), 'Move Watch rota to a chapter').count() === 0
    && await reader(dialog).locator('.note-text').getByText('rich').isVisible() && !('body' in entryIn(await bookOf(alice, ALICE_API), 'Watch rota')),
    'changed in the rich-text editor, it\'s read only: no Edit or Move in its bar, "Written in Foundry’s own editor: change it there.", and no Markdown sent')
}

// =================================================================================================
// 12. Added in Foundry
// =================================================================================================
part('12. added in Foundry')
let chapter2
{
  chapter2 = await addPageInFoundry('gm', book(), { name: 'Session 2', title: { show: true, level: 1 } })
  const stone = await addPageInFoundry('gm', book(), { name: 'The Arkenstone', title: { show: true, level: 2 }, text: { format: 2, markdown: 'It glows.', content: '<p>It glows.</p>' } })
  await until(async () => same(await notesIn(dialog, 'Session 2'), ['The Arkenstone']), 'Session 2 and its note in the contents', 20_000)
  await pickNote(dialog, 'The Arkenstone')
  const lines = await noteLines(dialog)
  check(same(lines, ['Written in Foundry, just now', 'Last changed by Gamemaster in Foundry, just now']) && entryIn(await bookOf(alice, ALICE_API), 'The Arkenstone')?.id === stone.id,
    `a level 1 page and a level 2 one after it, added by the Gamemaster: a chapter "Session 2" with the note in it, its lines ${JSON.stringify(lines)}`)
  await button(reader(dialog), 'Edit The Arkenstone').click()
  const form = editorOf(dialog, 'Edit The Arkenstone')
  await form.getByLabel('Note', { exact: true }).fill('It glows in the dark.')
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await until(() => stone.text.markdown === 'It glows in the dark.', 'her change in Foundry', 20_000)
  const flags = flagsOf(stone)
  check(flags?.page === stone.id && flags.role === 'entry' && flags.chapter === chapter2.id && flags.author === null && flags.modified.actor === 'thorin',
    `personal, Alice may change it: her edit is made, and gives the page flags of its own, its author still none (${JSON.stringify(flags)})`)
  await noted(alice, ALICE_API, 'The Arkenstone')
  // A chapter's page: its notes as cards, in its order.
  await pickGroup(dialog, 'Session 1')
  const cards = await reader(dialog).locator('article article h4').allTextContents()
  const eyebrow = (await reader(dialog).locator('article > p').first().textContent()).trim()
  check(same(cards, [...IN_S1, 'Loose 1', 'Ravenhill']) && eyebrow === 'Chapter 1 of 2',
    `Session 1's page: "${eyebrow}", its notes as cards in its order (${JSON.stringify(cards)})`)
  await shootBoth(alice, 'journal-chapter')
  await closeJournal(gmDialog)
  gmDialog = await openJournal(gm.page, 'Thorin’s Journal')
  await pickGroup(gmDialog, 'Session 1')
  await shootBoth(gm, 'journal-chapter')
  await closeJournal(gmDialog)
}

// =================================================================================================
// 13. Deleted in Foundry
// =================================================================================================
part('13. deleted in Foundry')
{
  await pickNote(dialog, 'The Arkenstone')
  await deleteInFoundry('gm', chapter2)
  await until(async () => {
    const view = await bookOf(alice, ALICE_API)
    return !chapterIn(view, 'Session 2') && entryIn(view, 'The Arkenstone')?.chapterId === null
  }, 'the chapter gone, its note under none', 20_000)
  await until(async () => (await notesIn(dialog, 'Not in a chapter'))?.includes('The Arkenstone') && !(await listed(dialog)).some(g => g.group === 'Session 2'), 'the contents to follow', 10_000)
  check(true, 'its chapter page deleted in Foundry, its note is listed under "Not in a chapter"')
  // Changed on purpose (round 0.35.0 §13.2 step 13; REQ item 2): Foundry's delete moves the journal's line.
  await until(async () => await headerLastChanged(dialog) === 'Last changed by Gamemaster, just now', "the header to name the Gamemaster's delete", 15_000)
  await closeJournal(dialog)
  await until(async () => / · Last changed by Gamemaster, just now$/.test(await countsOf(alice)), "the card to name the Gamemaster's delete", 15_000)
  const record = bookRecord()
  check(record?.changedBy === 'Gamemaster' && record.changedIn === 'foundry',
    `the header and the card say "Last changed by Gamemaster, just now", though no note says so: "${await countsOf(alice)}" (${JSON.stringify(record)})`)
  await shootBoth(alice, 'journal-foundry-delete-card', cardOf(alice))
  dialog = await open(alice)
  await shootBoth(alice, 'journal-foundry-delete', header(dialog))
  const was = book()
  await deleteInFoundry('gm', 'journal', { kind: 'personal', actorId: 'thorin', campaignId: 'erebor' })
  await until(async () => {
    const view = await bookOf(alice, ALICE_API)
    return view.entries.length === 0 && view.chapters.length === 0
  }, 'the book emptied', 20_000)
  await dialog.getByText('Write down what happened, what you found and who you met.', { exact: true }).waitFor({ timeout: 10_000 })
  check(!book(), 'the journal deleted in Foundry, the journal is empty: "No notes yet"')
  await writeNote(dialog, { title: 'After the fire', body: 'We begin again.' })
  await until(() => book() && pageNamed('After the fire'), 'a new journal', 20_000)
  check(book() !== was && book().id !== was.id && book().name === "Thorin's notes (Erebor)" && pages().length === 1,
    `and Alice's next note makes a new journal, "${book().name}" (${was.id} → ${book().id})`)
  await noted(alice, ALICE_API, 'After the fire')
  await closeJournal(dialog)
}

// =================================================================================================
// 14. The keyboard
// =================================================================================================
part('14. the keyboard')
{
  const key = k => wide.page.keyboard.press(k)
  const isFocused = locator => locator.evaluate(el => el === document.activeElement)
  await biography(wide)
  // This page reads the book by polling: the new journal's note reaches it within a poll of step 13.
  await until(async () => /^0 chapters · 1 note · /.test(await countsOf(wide)), "the card to read the new journal's note", 15_000)
  // From the card's own text: where a click puts the browser's place for Tab.
  await cardOf(wide).getByText('Only you and your Gamemaster see these.', { exact: false }).click()
  await key('Tab')
  check((await focused(wide)).name === `Open ${MINE}`, `Tab reaches the card's Open My Journal (${JSON.stringify(await focused(wide))})`)
  await key('Enter')
  let d = journalOf(wide.page, MINE)
  await focusIs(wide, f => f.tag === 'H2' && f.text === MINE && f.inDialog, 'Enter opens the journal, focus on its h2')
  const reached = []
  for (let n = 0; n < 12; n += 1) {
    await key('Tab')
    reached.push(await focused(wide))
  }
  check(reached.some(f => f.label === 'Search notes') && reached.some(f => f.inContents && f.label === 'After the fire') && reached.some(f => !f.inContents && f.label === 'Edit After the fire'),
    `Tab reaches the search, the contents and the reader's tools (${JSON.stringify(reached.map(f => f.name))})`)
  await button(contentsPane(d), 'New note').focus()
  await key('Enter')
  let form = editorOf(d, 'New note')
  await form.waitFor()
  const title = form.getByLabel('Title', { exact: true })
  const body = form.getByLabel('Note', { exact: true })
  await until(() => isFocused(title), 'focus in Title', 5_000).catch(() => {})
  check(await isFocused(title), `New note: the editor, focus in its Title (focus: ${JSON.stringify(await focused(wide))})`)
  const writes = writeRows().length
  await wide.page.keyboard.type('Keyed in')
  await key('Enter')
  await wait(500)
  check(await isFocused(body) && writeRows().length === writes && await form.isVisible(), 'Enter in Title moves to the note, and saves nothing')
  await wide.page.keyboard.type('Every word by keys.')
  await key('Control+Enter')
  await form.waitFor({ state: 'detached', timeout: 15_000 })
  await noted(alice, ALICE_API, 'Keyed in', { state: null })
  await focusIs(wide, f => f.tag === 'H3' && f.text === 'Keyed in', "Ctrl+Enter saves it, and focus is on the reader's h3")

  await button(contentsPane(d), 'New note').click()
  form = editorOf(d, 'New note')
  await form.getByLabel('Title', { exact: true }).fill('To be discarded')
  await button(form, 'Cancel').click()
  const discard = wide.page.getByRole('dialog', { name: 'Discard your changes?' })
  await discard.waitFor()
  check(await discard.getByText('What you wrote here isn’t saved.').isVisible() && await button(discard, 'Keep editing').isVisible(), 'Cancel with changes asks "Discard your changes?"')
  await key('Escape')
  await discard.waitFor({ state: 'hidden' })
  check(await form.isVisible() && await form.getByLabel('Title', { exact: true }).inputValue() === 'To be discarded' && await d.isVisible(),
    'Escape keeps editing, the title as typed, the journal open')
  await button(form, 'Cancel').click()
  await button(discard, 'Discard').click()
  await form.waitFor({ state: 'detached' })
  await focusIs(wide, f => f.name === 'New note' && f.inContents, 'Cancel, Discard: the editor goes, focus back on New note')
  await closeJournal(d)

  // At 390: the drawer.
  const phoneKey = k => alice.page.keyboard.press(k)
  await biography(alice)
  d = await open(alice)
  await readerTitle(d).waitFor()
  await contentsButton(d).click()
  await focusIs(alice, f => f.label === 'Close contents', 'at 390, Contents opens the drawer, focus on Close contents')
  await phoneKey('Escape')
  await focusIs(alice, f => f.name === 'Contents' && !f.inContents, 'Escape closes the drawer only, focus back on Contents')
  check(await d.isVisible() && await contentsPane(d).evaluate(el => Boolean(el.closest('[inert]'))), 'and the journal stays open, its drawer closed and inert')
  const tabbed = []
  for (let n = 0; n < 16; n += 1) {
    await phoneKey('Tab')
    tabbed.push(await focused(alice))
  }
  check(tabbed.every(f => !f.inContents), `with the drawer closed, Tab never lands in it (${JSON.stringify(tabbed.map(f => f.name))})`)
  await contentsButton(d).click()
  await focusIs(alice, f => f.label === 'Close contents', 'Contents again')
  const search = d.getByRole('searchbox', { name: 'Search notes' })
  await search.fill('fire')
  await search.focus()
  await phoneKey('Escape')
  check(await search.inputValue() === '' && await d.isVisible() && await contentsButton(d).getAttribute('aria-expanded') === 'true',
    'text in the search, Escape clears it, the drawer and the journal still open')
  await phoneKey('Escape')
  await until(async () => await contentsButton(d).getAttribute('aria-expanded') === 'false', 'the drawer to close', 5_000)
  check(await d.isVisible(), 'Escape again closes the drawer')
  await phoneKey('Escape')
  await d.waitFor({ state: 'hidden', timeout: 5_000 })
  await focusIs(alice, f => f.name === `Open ${MINE}`, 'and Escape once more closes the journal, focus on Open My Journal')
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
part('15. widths')
{
  // A chapter of its own after the notes in no chapter, so Next crosses from one group to another.
  const ch = await call(alice.page, `${ALICE_API}/notes`, { method: 'POST', body: { role: 'chapter', title: 'Session 3' } })
  const made = await call(alice.page, `${ALICE_API}/notes`, { method: 'POST', body: { role: 'entry', title: LONG_TITLE, body: WIDE_TABLE, chapterId: null } })
  for (const title of ['East road', 'West road']) await call(alice.page, `${ALICE_API}/notes`, { method: 'POST', body: { role: 'entry', title, body: `${title}.`, chapterId: ch.json.id } })
  check(made.status === 201 && LONG_TITLE.split(' ').length === 30, `a note with a 30-word title and a wide table (${made.status})`)
  await noted(alice, ALICE_API, 'West road')
  const view = await bookOf(alice, ALICE_API)
  const order = view.entries.map(e => e.title)
  const at = order.indexOf(LONG_TITLE)
  const next = order[at + 1]
  // The last of the notes in no chapter: the next is the first of a chapter.
  const crossing = view.entries[at].chapterId === null && view.entries[at + 1]?.chapterId === ch.json.id
  for (const [who, width, height] of [[alice, 360, 800], [alice, 390, 844], [alice, 768, 1024], [wide, 1280, 800]]) {
    await resize(who, width, height)
    await biography(who)
    const d = await open(who)
    await pickNote(d, LONG_TITLE)
    for (const scheme of ['light', 'dark']) {
      await theme(who, scheme)
      const look = await d.evaluate((el, long) => {
        const pane = el.querySelector('[id$="-contents"] + *')
        const bar = pane.firstElementChild
        const box = x => { const b = x.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom } }
        const shown = [...bar.querySelectorAll('button, p, span.tabular-nums')].filter(x => x.getBoundingClientRect().width > 0 && getComputedStyle(x).display !== 'none')
        const h3 = pane.querySelector('article h3')
        const wrap = pane.querySelector('.note-text')?.closest('.overflow-x-auto')
        const inContents = [...el.querySelectorAll('nav[aria-label="Contents"] button')].find(b => b.getAttribute('aria-label') === long)?.querySelector('span')
        return {
          modalX: el.scrollWidth - el.clientWidth, dialog: box(el),
          bar: shown.map(x => ({ name: x.getAttribute('aria-label') ?? x.textContent.trim(), ...box(x) })),
          lines: Math.round(h3.getBoundingClientRect().height / (parseFloat(getComputedStyle(h3).lineHeight) || 30)),
          scrolls: Boolean(wrap) && wrap.scrollWidth > wrap.clientWidth + 1, inside: Boolean(wrap) && wrap.getBoundingClientRect().right <= el.getBoundingClientRect().right + 0.5,
          truncated: Boolean(inContents) && inContents.scrollWidth > inContents.clientWidth,
          counter: [...bar.querySelectorAll('span.tabular-nums')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.textContent.trim()),
        }
      }, LONG_TITLE)
      const pageX = await sideways(who.page)
      const fits = look.bar.every(b => b.left >= look.dialog.left - 0.5 && b.right <= look.dialog.right + 0.5)
      const names = look.bar.map(b => b.name)
      const want = width >= 480 ? [`${at + 1} of ${order.length}`] : []
      check(pageX === 0 && look.modalX === 0 && fits && look.lines >= 2 && look.scrolls && look.inside && look.truncated && same(look.counter, want),
        `at ${width} px, ${scheme}: nothing scrolls sideways in the page or the modal, the note's bar fits (${JSON.stringify(names)}), the 30-word title wraps in the reader (${look.lines} lines) and is cut short in the contents, the wide table scrolls inside the note, and "i of n" ${width >= 480 ? `says "${want[0]}"` : 'is hidden'} (${JSON.stringify({ pageX, modalX: look.modalX, counter: look.counter })})`)
      if (width === 360) {
        const tops = new Set(look.bar.map(b => Math.round(b.top)))
        check(['Contents', 'Ch. 1', 'Move ' + LONG_TITLE + ' to a chapter', 'Edit ' + LONG_TITLE, 'Delete ' + LONG_TITLE, 'Previous note', 'Next note'].every(n => names.includes(n) || (n === 'Ch. 1' && !names.some(x => /^Ch/.test(x)))) && tops.size <= 2,
          `at 360 the bar holds Contents, Move, Edit, Delete, Previous and Next in one row (${JSON.stringify(names)})`)
      }
    }
    await theme(who, 'light')
    // Previous and Next across groups: Next from the last of the notes in no chapter is the first of a chapter.
    await button(reader(d), 'Next note').click()
    await readerShows(d, next)
    check(crossing, `at ${width} px, Next from it, the last of the notes in no chapter, shows "${next}", the first of Session 3: reading order across groups`)
    if (width === 360) {
      // A note in a chapter: its bar holds "Ch. 1" too, all of it inside the screen, one row.
      const bar = await reader(d).evaluate(pane => [...pane.firstElementChild.querySelectorAll('button, p > span')]
        .filter(x => x.getBoundingClientRect().width > 0 && getComputedStyle(x).display !== 'none' && !x.classList.contains('sr-only'))
        .map(x => { const b = x.getBoundingClientRect(); return { name: x.getAttribute('aria-label') ?? x.textContent.trim(), left: b.left, right: b.right, top: Math.round(b.top) } }))
      const names = bar.map(b => b.name)
      check(['Contents', 'Ch. 1', `Move ${next} to a chapter`, `Edit ${next}`, `Delete ${next}`, 'Previous note', 'Next note'].every(n => names.includes(n))
        && bar.every(b => b.left >= 0 && b.right <= 360.5) && new Set(bar.map(b => b.top)).size <= 2,
        `at 360 the bar of a note in a chapter holds Contents, Ch. 1, Move, Edit, Delete, Previous and Next, inside the screen (${JSON.stringify(bar.map(b => [b.name, Math.round(b.left), Math.round(b.right)]))})`)
    }
    await closeJournal(d)
  }
  await resize(alice, 390, 844)
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
  check(view.entries.length === 0 && view.chapters.length === 0 && await countsOf(bob) === 'No notes yet',
    "Bob claims Thorin in Mirkwood: his Mirkwood Biography's card says No notes yet, none of Alice's Erebor notes")
  const ELVES = "The Elvenking's halls"
  const d = await open(bob)
  await writeNote(d, { title: ELVES, body: 'Barrels, and a river.' })
  const theirs = () => journal('personal', 'thorin', 'mirkwood')
  await until(() => theirs() && pagesOf(theirs()).some(p => p.name === ELVES), 'his note in a journal of its own', 20_000)
  check(theirs() !== book() && theirs().name === "Thorin's notes (Mirkwood)" && theirs().flags['sending-stone'].journal.campaign === 'mirkwood' && !pageNamed(ELVES),
    `his note makes a second journal, "${theirs().name}", flagged campaign mirkwood, apart from Erebor's`)
  await noted(bob, BOB_M_API, ELVES)
  await closeJournal(d)
  const mine = await open(alice)
  check(!entryIn(await bookOf(alice, ALICE_API), ELVES) && !JSON.stringify(await listed(mine)).includes('Elvenking'), "and Alice's Erebor journal doesn't show it")
  await closeJournal(mine)
}

// =================================================================================================
// 18. Unsafe HTML
// =================================================================================================
part('18. unsafe HTML')
{
  const UNSAFE = '<img src="x" onerror="window.__hit=1">\n\n[a](javascript:window.__hit=2)'
  const d = await open(alice)
  await writeNote(d, { title: 'Unsafe', body: UNSAFE, chapter: null })
  await until(() => pageNamed('Unsafe'), 'the note in Foundry', 20_000)
  const content = pageNamed('Unsafe').text.content
  check(!/onerror/i.test(content) && !/javascript:/i.test(content) && /<img/.test(content), `the page's HTML in Foundry has neither the onerror nor the javascript: link (${content})`)
  await noted(alice, ALICE_API, 'Unsafe')
  await readerShows(d, 'Unsafe')
  await wait(800)
  const inReader = await reader(d).evaluate(el => ({
    onerror: el.querySelectorAll('[onerror]').length,
    js: [...el.querySelectorAll('a')].filter(a => /^\s*javascript:/i.test(a.getAttribute('href') ?? '')).length,
  }))
  await pickGroup(d, 'Not in a chapter')
  await reader(d).locator('article article').filter({ hasText: 'Unsafe' }).first().waitFor({ timeout: 10_000 })
  await wait(800)
  const onCard = await reader(d).evaluate(el => ({
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
  check(inReader.onerror === 0 && inReader.js === 0 && onCard.onerror === 0 && onCard.js === 0 && hits.app === undefined && hits.foundry === undefined && fired === 1,
    `the app draws it, in the reader and on its card, with no onerror and no javascript: link, and window.__hit stays undefined in the app's page and Foundry's (${JSON.stringify({ inReader, onCard, hits })}; uncleaned it fires: ${fired})`)
  await closeJournal(d)
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
  // An on-screen keyboard, as Chromium has none: what the browser says shows of the window, a visual
  // viewport this much shorter than it, as a phone's keyboard makes it.
  await alice.page.evaluate(() => {
    const real = window.visualViewport
    const fake = new EventTarget()
    let covered = 0
    for (const key of ['width', 'offsetLeft', 'pageLeft', 'pageTop', 'scale']) Object.defineProperty(fake, key, { get: () => real[key] })
    Object.defineProperty(fake, 'height', { get: () => window.innerHeight - covered })
    Object.defineProperty(fake, 'offsetTop', { get: () => 0 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake })
    window.__keyboard = px => { covered = px; fake.dispatchEvent(new Event('resize')) }
  })
  const d = await open(alice)
  await pickNote(d, 'The long road')
  await button(reader(d), 'Edit The long road').click()
  const form = editorOf(d, 'Edit The long road')
  const area = form.getByLabel('Note', { exact: true })
  const atEnd = async () => {
    await area.focus()
    await alice.page.keyboard.press('Control+End')
    await wait(400)
    const [save, fields, dialogNow] = [await boxOf(button(form, 'Save')), await boxOf(form.getByLabel('Title', { exact: true })), await dialogBox(d)]
    const end = await area.evaluate(el => ({ at: el.selectionStart === el.value.length, focused: el === document.activeElement }))
    return { save, fields, dialog: dialogNow, end }
  }
  let m = await atEnd()
  check(m.end.at && m.end.focused && m.save.top >= m.fields.bottom && m.save.bottom <= m.save.vh && m.save.top >= 0,
    `at 390 × 844, a 60-line note in the editor, the textarea focused at its end: Save is in the viewport, in the footer below the fields (${JSON.stringify({ save: m.save, end: m.end })})`)
  await alice.page.evaluate(() => window.__keyboard(374))
  await until(async () => Math.round((await dialogBox(d)).height) === 470, 'the journal to fit above the keyboard', 5_000)
  m = await atEnd()
  check(m.end.at && Math.round(m.dialog.top) === 0 && Math.round(m.dialog.height) === 470 && m.save.bottom <= 470 + 0.5 && m.save.top >= 0,
    `with a phone's keyboard up (the visual viewport 470 of 844 px), the journal fits above it, 470 px tall, and Save stays in view over the keyboard (${JSON.stringify({ dialog: m.dialog, save: m.save })})`)
  await shootBoth(alice, 'journal-editor-keyboard')
  await alice.page.evaluate(() => window.__keyboard(0))
  await until(async () => Math.round((await dialogBox(d)).height) === 844, 'the journal full height again', 5_000)
  check(true, 'the keyboard down, the journal is the whole screen again')
  await button(form, 'Cancel').click()
  await form.waitFor({ state: 'detached' })
  await closeJournal(d)
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
  const card = journalCard(pane)
  await card.waitFor({ timeout: 15_000 })
  check(await tablist(alice).count() === 0 && await card.isVisible() && /notes/.test(await cardCounts(card).textContent()),
    'his sheet held back as too large, at 390 the Character tab says "Thorin\'s sheet is too large to send", and below it the Journal card')
  await shootBoth(alice, 'journal-nosheet')
  let d = await openJournal(pane, MINE)
  await writeNote(d, { title: 'Under no sheet', body: 'Written with no sheet in view.', chapter: null })
  await noted(alice, ALICE_API, 'Under no sheet')
  check(Boolean(pageNamed('Under no sheet')), 'a note written in its journal is saved, and reaches Foundry')
  await paneOf(wide).getByText("Thorin's sheet is too large to send").waitFor({ timeout: 15_000 })
  const look = await wide.page.evaluate(() => {
    const pane = document.getElementById('character-pane')
    const column = pane?.nextElementSibling
    return { shown: pane ? getComputedStyle(pane).display !== 'none' : false, pane: pane?.getBoundingClientRect().width ?? 0, column: column?.getBoundingClientRect().width ?? 0 }
  })
  check(look.shown && look.pane > 600 && look.column >= 320 && look.column <= 500 && await journalCard(paneOf(wide)).isVisible(),
    `at 1280 the Character pane shows, with why there's no sheet and the Journal card, beside the ${Math.round(look.column)} px column of combat and chat (${JSON.stringify(look)})`)
  await shootBoth(wide, 'journal-nosheet')

  // A new note half written in the journal as the sheet comes again, the textarea in use.
  await contents(d)
  await button(contentsPane(d), 'New note').click()
  const form = editorOf(d, 'New note')
  await form.getByLabel('Title', { exact: true }).fill('Half written')
  const area = form.getByLabel('Note', { exact: true })
  await area.fill('Typed as the sheet came')
  await area.focus()
  await alice.page.keyboard.press('End')
  await sheetAgain()
  await tablist(alice).waitFor({ timeout: 20_000 })
  d = journalOf(alice.page, MINE)
  const back = editorOf(d, 'New note')
  await back.waitFor({ timeout: 10_000 })
  const now = {
    tab: await tablist(alice).getByRole('tab', { name: /^Biography/ }).getAttribute('aria-selected'),
    open: await d.isVisible(),
    title: await back.getByLabel('Title', { exact: true }).inputValue(), body: await back.getByLabel('Note', { exact: true }).inputValue(),
    focused: await back.getByLabel('Note', { exact: true }).evaluate(el => el === document.activeElement),
  }
  await alice.page.keyboard.type(', and kept on.')
  const typed = await back.getByLabel('Note', { exact: true }).inputValue()
  check(now.tab === 'true' && now.open && now.title === 'Half written' && now.body === 'Typed as the sheet came' && now.focused && typed === 'Typed as the sheet came, and kept on.',
    `the sheet sent again, the Biography tab is shown, the journal open with the same title and text, and the textarea still has focus: keys typed next go on its text (${JSON.stringify({ ...now, typed })})`)
  await button(back, 'Cancel').click()
  await button(alice.page.getByRole('dialog', { name: 'Discard your changes?' }), 'Discard').click()
  await back.waitFor({ state: 'detached' })
  await closeJournal(d)
}

// =================================================================================================
// 21. No sheet: never arrived
// =================================================================================================
part('21. no sheet, never arrived')
{
  await sheetless(null)
  const pane = paneOf(alice)
  await pane.getByText("Thorin's sheet hasn't arrived").waitFor({ timeout: 15_000 })
  const d = await openJournal(pane, MINE)
  await writeNote(d, { title: 'Before the sheet', body: 'Nothing to show yet.', chapter: null })
  await noted(alice, ALICE_API, 'Before the sheet')
  check(true, 'with no sheet, as from a system other than dnd5e: "Thorin\'s sheet hasn\'t arrived", the Journal card below it, working')
  await closeJournal(d)
  await paneOf(gm).getByText("Thorin's sheet hasn't arrived").waitFor({ timeout: 15_000 })
  const gmCard = journalCard(paneOf(gm))
  await until(async () => /notes/.test(await cardCounts(gmCard).textContent()), "the Gamemaster's card read", 15_000)
  const g = await openJournal(paneOf(gm), 'Thorin’s Journal')
  await until(async () => (await notesIn(g, 'Not in a chapter'))?.includes('Before the sheet'), "the note in the Gamemaster's journal", 15_000)
  check(await gmCard.getByText('Only Thorin’s player and you see these.', { exact: true }).isVisible(), "the same at the Gamemaster's page for Thorin")
  await closeJournal(g)
  await sheetAgain()
  await tablist(alice).waitFor({ timeout: 20_000 })
}

// =================================================================================================
// 22. Closed with a draft
// =================================================================================================
part('22. closed with a draft')
{
  const sent = []
  alice.page.on('request', request => { if (/\/notes(\/|$|\?)/.test(new URL(request.url()).pathname + new URL(request.url()).search) && request.method() !== 'GET') sent.push(request.method()) })
  await biography(alice)
  let d = await open(alice)
  await pickNote(d, 'After the fire')
  await button(reader(d), 'Edit After the fire').click()
  const form = editorOf(d, 'Edit After the fire')
  await form.getByLabel('Title', { exact: true }).fill('After the fire, again')
  await form.getByLabel('Note', { exact: true }).fill('Half of a change.')
  await closeJournal(d)
  const chip = cardOf(alice).getByText('Unsaved: After the fire, again', { exact: true })
  await chip.waitFor({ timeout: 5_000 })
  check(sent.length === 0, 'Close with an edit half made: the journal closes, saying nothing, and the card shows "Unsaved: After the fire, again"')
  await shootBoth(alice, 'journal-unsaved', cardOf(alice))
  const holds = async what => {
    await chip.waitFor({ timeout: 10_000 })
    check(sent.length === 0 && pageNamed('After the fire'), `${what}: the card still shows "Unsaved: After the fire, again", nothing saved (${sent.length} writes sent)`)
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
  d = await open(alice)
  const back = editorOf(d, 'Edit After the fire')
  await back.waitFor({ timeout: 10_000 })
  const kept = [await back.getByLabel('Title', { exact: true }).inputValue(), await back.getByLabel('Note', { exact: true }).inputValue()]
  check(same(kept, ['After the fire, again', 'Half of a change.']), `Open My Journal opens on the editor with the text (${JSON.stringify(kept)})`)
  await button(back, 'Cancel').click()
  await button(alice.page.getByRole('dialog', { name: 'Discard your changes?' }), 'Discard').click()
  await back.waitFor({ state: 'detached' })
  await closeJournal(d)
}

// =================================================================================================
// 8, again: nothing of Thorin's Erebor notes ever reached Bob's browser
// =================================================================================================
part('8b. what Bob saw')
{
  const words = ['goblin', 'ravenhill', 'watch rota', 'arkenstone', 'after the fire', 'keyed in', 'under no sheet', 'before the sheet', 'the long road', 'dwalin', 'loose 1', 's1 a']
  const leaks = bobSaw.filter(r => words.some(w => r.body.toLowerCase().includes(w))).map(r => r.url)
  // His own Mirkwood journal, Thorin's there since step 17, names him: every other's line is Vex's own.
  const bobThorin = sql(`select id from "character" where "actorId" = 'thorin' and "campaignId" = '${M}'`)
  const named = bobSaw.filter(r => !r.url.includes(bobThorin) && /"lastChange":\{"by":"(Thorin|Gamemaster)"/.test(r.body)).map(r => r.url)
  check(bobSaw.length > 20 && leaks.length === 0 && named.length === 0,
    `of the ${bobSaw.length} responses Bob's browser received, none carries a word of Thorin's Erebor notes, nor a last change naming who changed them (${JSON.stringify([...leaks, ...named].slice(0, 5))})`)
}
note(`journal writes in Foundry: ${journalWrites.length}`)
await finish()
