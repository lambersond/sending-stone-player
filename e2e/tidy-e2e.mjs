// Tidy 5e Sheets' journal (module 0.44.0 and the app; the owner's T1 A, T2 A, T3 B, T4 B, T5 A and
// T6 A), end to end, in the world of world-030.mjs, Tidy's flags and its own writes from the module's
// stand-in (fvtt/tidy-core.mjs), Foundry 14's deletions in world-030's actors. Erebor, rolls off: Alice
// plays Thorin, who keeps three entries on Tidy's Journal tab (one untitled, one with a secret) and
// three of its Classic sheet's boxes (one named, one empty and so never sent), on a phone (390 × 844)
// and a laptop (1280 × 800); Bob plays Vex, who keeps none until his first, dated; Balin is no
// player's, his one entry's secret left out. The Gamemaster is Alice's own campaign, at Thorin's and
// Balin's pages. The hello's `features.notes.tidy` and the settings card's Tidy 5e Sheets; the "From
// Tidy 5e Sheets" section last in the contents, in Tidy's order, each entry chipped "Tidy 5e" or "Tidy
// 5e Classic", their page and the read-only reader, undated where they were there before the app saw
// them; Tidy's own edit, add and delete in Foundry reaching the app within a poll, dated, a deleted
// one giving way to the next; the Gamemaster; nothing of Thorin's in Bob's browser; Tidy turned off,
// "(not enabled)" on the settings card, then uninstalled, the entries still shown with the line that
// says so; both widths and themes. DND5E6=1: dnd5e 6.0.5 and Tidy 14.4.1, whose delete is Foundry 14's
// `_del`, and which no longer shows the Classic boxes. SKEW=042 with MODULE=module-0.42.0: the same
// flags, and nothing new: no `tidy` in the hello, no journal.tidy, no section, no Tidy row on the card.
// Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BASE, BOB, DND5E6, SKEW042, browse, call, character, check, finish, foundryWorld, journal, launch, lastHello, newCampaign,
  part, postsOf, reloadFoundry, same, settled, shootBoth, sideways, sql, startModule, theme, until, wait,
} from './world-030.mjs'
import {
  button, cardCounts, closeJournal, contents, journalCard, openJournal, reader, readerShows, tidyListed,
} from './journal-ui.mjs'

const { TIDY, JOURNAL, entry, tidy } = await import('./fvtt/tidy-core.mjs')

const GAME = 'https://erebor-tidy.forge-vtt.com'
const ADDRESS = 'erebor-tidy.forge-vtt.com'
const SECRET = 'erebor-tidy-secret-45'
const TITLE = 'Erebor'
const MINE = 'My Journal'
/** The Tidy for the system: 13.10.5 for dnd5e 5.3, 14.4.1 for dnd5e 6.0. */
const TIDY_VERSION = DND5E6 ? '14.4.1' : '13.10.5'
const SECTION = 'From Tidy 5e Sheets'
const OFF = 'Tidy 5e Sheets is turned off in Foundry: these are kept on Thorin, but can’t be changed until it’s back on.'
const GONE = 'Tidy 5e Sheets isn’t installed in Foundry: these are kept on Thorin, but can’t be changed until it’s back.'
const WHERE = 'Change it on Thorin’s Journal tab in Foundry.'
const CLASSIC_GONE = 'Tidy 5e Sheets no longer shows this: it was written on its Classic sheet, and is kept on Thorin.'
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: ADDRESS, secret: SECRET })
await foundryWorld()
game.modules.get('sending-stone').version = SKEW042 ? '0.42.0' : '0.44.0'

// ---- The world: Thorin's Tidy journal, Vex with none, and Balin, no player's ----
const SECRET_TEXT = 'He is the heir of Girion.'
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], hp: { value: 30, max: 38, temp: 0 } }, { ac: 16, items: [] })
thorin.flags[TIDY] = {
  [JOURNAL]: {
    tidyRavenhill001: entry('tidyRavenhill001', 'Ravenhill', '<p>The ravens speak of the old watch.</p>', 10),
    tidyUntitled0002: entry('tidyUntitled0002', '', '<p>Ask Balin about the map.</p>', 20),
    tidyBardKnows003: entry('tidyBardKnows003', 'What Bard knows', `<p>He sees far.</p><section class="secret"><p>${SECRET_TEXT}</p></section>`, 30),
  },
  // The Classic sheet's boxes: Persons of Interest unnamed, Quests named, Miscellaneous emptied, as
  // its editor leaves one, and Journal Entries.
  notes1: { name: '', value: '<p>Bard of Lake-town.</p>' },
  notes3: { name: 'Errands', value: '<p>Return the key to Dale.</p>' },
  notes4: { name: '', value: '<p></p>' },
  notes: { value: '<p>We left at dawn.</p>' },
}
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
const balin = character({ id: 'balin', name: 'Balin', owners: [], hp: { value: 20, max: 20, temp: 0 } }, { ac: 15, items: [] })
balin.flags[TIDY] = { [JOURNAL]: { tidyBalinSeen001: entry('tidyBalinSeen001', 'Seen', `<p>A shade on the road.</p><section class="secret"><p>${SECRET_TEXT}</p></section>`, 0) } }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
// Tidy 5e Sheets, installed and active.
game.modules.set(TIDY, { id: TIDY, title: 'Tidy 5e Sheets', version: TIDY_VERSION, active: true })
const erebor = { id: 'erebor', title: TITLE, characters: ['thorin', 'vex', 'balin'], groups: [], rolls: false }
await startModule({ campaigns: [erebor], secrets: { erebor: SECRET } })
await settled()

// ---- What's kept, posted and shown ----
const campaignTidy = () => JSON.parse(sql(`select json_build_object('active', "tidyActive", 'version', "tidyVersion")::text from campaign where id = '${A}'`))
const tidyRows = actorId => JSON.parse(sql(`select coalesce(json_agg(t order by t.source, t.sort)::text, '[]') from (select t.source, t."entryId", t.title, t.sort, t.secret, t."firstSeenAt", t."changedAt" from journal_tidy_entry t join journal_book b on b.id = t."bookId" where b."campaignId" = '${A}' and b."actorId" = '${actorId}') t`))
const tidyPosts = actorId => postsOf('journal.tidy').filter(p => (p.campaign === 'erebor') && (p.data.actorId === actorId))
const ALICE_API = '/api/characters/sheet-thorin'
const GM_API = `/api/campaigns/${A}/characters/thorin`
const bookOf = async (who, api) => (await call(who.page, `${api}/notes`)).json
/** The card's line of counts. */
const countsOf = async who => (await cardCounts(journalCard(who.page)).textContent()).trim()
/** The Biography tab, and the card on it read. */
async function biography(who) {
  await who.tab('Biography')
  await journalCard(who.page).waitFor({ timeout: 15_000 })
  await until(async () => !/^(Loading notes…|Notes couldn’t)/.test(await countsOf(who)), 'the card read', 15_000)
}
/** An entry, or their page, picked in the contents; the reader then shows it. */
async function pick(dialog, name, shows = name) {
  await button(await contents(dialog), name).click()
  await readerShows(dialog, shows)
}
/** The reader's text, as shown. */
const readerText = async dialog => (await reader(dialog).textContent()).replace(/\s+/g, ' ')
/** Buttons in the reader that would change it. */
const changers = dialog => reader(dialog).getByRole('button', { name: /^(Edit|Delete|Move)/ }).count()
/** Until the contents' Tidy entries are `names`, in order. */
async function tidyIs(dialog, names) {
  let got
  await until(async () => same((got = await tidyListed(dialog))?.map(([name]) => name) ?? null, names), `the contents' Tidy entries to be ${JSON.stringify(names)} (${JSON.stringify(got)})`, 20_000)
  return got
}

sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const alice = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })

/** The Gamemaster's campaign card's versions, from the campaigns page, as "label: value". */
async function cardVersions() {
  const gm = await browse({ width: 1280, height: 800, path: `/campaigns?campaign=${A}`, toasts: false })
  const card = gm.page.getByRole('article', { name: TITLE })
  await card.waitFor({ timeout: 20_000 })
  const section = card.locator('details').filter({ has: gm.page.locator('summary', { hasText: 'Foundry settings' }) })
  await section.locator('summary').click()
  await section.getByRole('heading', { name: 'Versions' }).waitFor()
  const rows = await section.locator('h4', { hasText: 'Versions' }).first().locator('xpath=following-sibling::dl[1]/div')
    .evaluateAll(divs => divs.map(div => `${div.querySelector('dt').textContent}: ${div.querySelector('dd').textContent}`))
  await gm.view.close()
  return rows
}

if (SKEW042) {
  // =================================================================================================
  // Module 0.42.0: the same flags, and nothing new
  // =================================================================================================
  part('module 0.42.0')
  const notes = lastHello('erebor').data.features.notes
  check(!('tidy' in notes) && !(lastHello('erebor').data.settings?.modules ?? []).some(m => m.id === TIDY),
    `module 0.42.0's hello says nothing of Tidy, in features.notes or settings.modules (${JSON.stringify(Object.keys(notes))})`)
  await wait(3000)
  check(postsOf('journal.tidy').length === 0 && same(campaignTidy(), { active: null, version: null }) && tidyRows('thorin').length === 0,
    `and sends no journal.tidy: the app keeps no Tidy state and no entry (${JSON.stringify(campaignTidy())})`)
  const versions = await cardVersions()
  check(!versions.some(row => row.startsWith('Tidy 5e Sheets')), `the settings card lists no Tidy 5e Sheets (${JSON.stringify(versions)})`)
  await biography(alice)
  check(await countsOf(alice) === 'No notes yet', `Thorin's journal card says "No notes yet", nothing from Tidy (${await countsOf(alice)})`)
  const dialog = await openJournal(alice.page, MINE)
  await dialog.getByText('No notes yet', { exact: true }).waitFor({ timeout: 15_000 })
  check(await dialog.getByText(SECTION).count() === 0 && await dialog.getByText(/Tidy 5e/).count() === 0,
    'and the journal opens empty: no section, no chip')
  await finish()
}

// =================================================================================================
// 1. The hello, and the settings card
// =================================================================================================
part('1. the hello and the settings card')
{
  const hello = lastHello('erebor').data
  check(same(hello.features.notes.tidy, { active: true, version: TIDY_VERSION, actors: ['thorin', 'balin'] }),
    `the hello's features.notes ends with tidy: active, ${TIDY_VERSION}, Thorin and Balin holding entries, never Vex (${JSON.stringify(hello.features.notes.tidy)})`)
  check(same(hello.settings?.modules.at(-1), { id: TIDY, title: 'Tidy 5e Sheets', version: TIDY_VERSION, active: true }),
    `and its settings.modules lists Tidy 5e Sheets last (${JSON.stringify(hello.settings?.modules.map(m => m.id))})`)
  await until(() => tidyRows('thorin').length === 6 && tidyRows('balin').length === 1, "Thorin's and Balin's entries kept in the app", 20_000)
  check(same(campaignTidy(), { active: true, version: TIDY_VERSION }), `the app keeps Tidy active, ${TIDY_VERSION} (${JSON.stringify(campaignTidy())})`)
  const rows = tidyRows('thorin')
  check(same(rows.map(r => `${r.source}:${r.entryId}`), ['journal:tidyRavenhill001', 'journal:tidyUntitled0002', 'journal:tidyBardKnows003', 'classic:notes1', 'classic:notes3', 'classic:notes'])
    && rows.every(r => r.firstSeenAt === null && r.changedAt === null),
    `Thorin's six, Miscellaneous's emptied box never sent, each undated: there before the app saw them (${JSON.stringify(rows.map(r => r.entryId))})`)
  check(tidyPosts('vex').length === 0 && tidyRows('vex').length === 0, 'Vex, who keeps none, is sent none')
  check(sql(`select "tidySyncedAt" is not null from journal_book where "campaignId" = '${A}' and kind = 'personal' and "actorId" = 'vex'`) === 't',
    "and the app knows Vex's Tidy journal from the hello, empty, so his first entry will be dated")
  const versions = await cardVersions()
  check(versions.at(-1) === `Tidy 5e Sheets: ${TIDY_VERSION}`, `the Gamemaster's settings card lists "Tidy 5e Sheets: ${TIDY_VERSION}" last (${JSON.stringify(versions)})`)
}

// =================================================================================================
// 2. Alice's journal, on a phone
// =================================================================================================
part("2. Alice's journal")
await biography(alice)
check(await countsOf(alice) === '6 from Tidy 5e Sheets', `Thorin's journal card counts "6 from Tidy 5e Sheets" (${await countsOf(alice)})`)
let dialog = await openJournal(alice.page, MINE)
await readerShows(dialog, 'Ravenhill')
check(await dialog.getByText('No notes yet', { exact: true }).count() === 0, 'the journal opens on its first Tidy entry, Ravenhill, never the empty journal')
{
  const listed = await tidyIs(dialog, ['Ravenhill', 'Journal Entry 2', 'What Bard knows', 'Persons of Interest', 'Errands', 'Journal Entries'])
  check(same(listed.map(([, chip]) => chip), ['Tidy 5e', 'Tidy 5e', 'Tidy 5e', 'Tidy 5e Classic', 'Tidy 5e Classic', 'Tidy 5e Classic']),
    `the contents end with "From Tidy 5e Sheets": in Tidy's order, the untitled one "Journal Entry 2", the Classic boxes after, unnamed ones by Tidy's headings, each with its chip (${JSON.stringify(listed)})`)
}
{
  const text = await readerText(dialog)
  check(text.includes('Tidy 5e') && text.includes('From Tidy 5e Sheets in Foundry') && !/First seen|Changed/.test(text)
    && text.includes('The ravens speak of the old watch.') && text.includes(WHERE) && await changers(dialog) === 0,
    `the reader: its chip, "From Tidy 5e Sheets in Foundry", undated, its text, "${WHERE}", and no Edit, Delete or Move`)
}
await pick(dialog, 'What Bard knows')
check((await readerText(dialog)).includes(SECRET_TEXT) && !(await readerText(dialog)).includes('secrets aren’t shown'),
  "Thorin's player owns him: his entry's secret is shown, with no line saying it's left out")
await pick(dialog, 'Persons of Interest')
{
  const text = await readerText(dialog)
  const classic = DND5E6
    ? text.includes(CLASSIC_GONE) && !text.includes(WHERE)
    : !text.includes(CLASSIC_GONE) && text.includes(WHERE)
  check(text.includes('Tidy 5e Classic') && text.includes('Bard of Lake-town.') && classic,
    `a Classic box: its chip "Tidy 5e Classic", its text, and ${DND5E6 ? `under Tidy 14 "${CLASSIC_GONE}", never where to change it` : 'where to change it'}`)
}
await pick(dialog, SECTION)
{
  const cards = await reader(dialog).locator('article h4').allTextContents()
  const undated = await reader(dialog).getByText('In Tidy 5e Sheets', { exact: true }).count()
  check(same(cards, ['Ravenhill', 'Journal Entry 2', 'What Bard knows', 'Persons of Interest', 'Errands', 'Journal Entries']) && undated === 6,
    `their page: "${SECTION}", a card for each in Tidy's order, each "In Tidy 5e Sheets" (${JSON.stringify({ cards, undated })})`)
}
await (await contents(dialog)).locator('xpath=..').getByRole('searchbox', { name: 'Search notes' }).fill('dawn')
await tidyIs(dialog, ['Journal Entries'])
check(true, 'searching "dawn" finds Journal Entries alone among their entries')
await (await contents(dialog)).locator('xpath=..').getByRole('searchbox', { name: 'Search notes' }).fill('')
await tidyIs(dialog, ['Ravenhill', 'Journal Entry 2', 'What Bard knows', 'Persons of Interest', 'Errands', 'Journal Entries'])
await button(dialog, 'Close contents').click()
await shootBoth(alice, 'tidy-section')
check(await sideways(alice.page) === 0, 'at 390 nothing scrolls sideways')

// =================================================================================================
// 3. Foundry's edits reach the app
// =================================================================================================
part("3. Foundry's edits")
await pick(dialog, 'Ravenhill')
await tidy.edit(thorin, 'tidyRavenhill001', { value: '<p>The ravens have gone quiet.</p>' })
await until(async () => (await readerText(dialog)).includes('The ravens have gone quiet.'), 'the edit made in Foundry shown in the reader', 20_000)
{
  const text = await readerText(dialog)
  const row = tidyRows('thorin').find(r => r.entryId === 'tidyRavenhill001')
  check(text.includes('Changed just now') && !text.includes('First seen') && row.changedAt !== null && row.firstSeenAt === null,
    `Tidy's edit in Foundry reaches the reader within a poll: "Changed just now", never first seen (${JSON.stringify(row)})`)
}
await tidy.add(thorin, 'tidyDaleBells0004', { title: 'Dale', value: '<p>The bells ring again.</p>' })
await tidyIs(dialog, ['Ravenhill', 'Journal Entry 2', 'What Bard knows', 'Dale', 'Persons of Interest', 'Errands', 'Journal Entries'])
await pick(dialog, 'Dale')
check((await readerText(dialog)).includes('First seen just now') && (await readerText(dialog)).includes('The bells ring again.'),
  'an entry added in Tidy comes after its others, before the Classic boxes: "First seen just now"')
await (DND5E6 ? tidy.delete14 : tidy.delete13)(thorin, 'tidyDaleBells0004')
await readerShows(dialog, 'Persons of Interest', 20_000)
await tidyIs(dialog, ['Ravenhill', 'Journal Entry 2', 'What Bard knows', 'Persons of Interest', 'Errands', 'Journal Entries'])
check(!('tidyDaleBells0004' in thorin.flags[TIDY][JOURNAL]),
  `deleted in Tidy (${DND5E6 ? "Tidy 14's _del" : "Tidy 13's -=<key>"}), it leaves the contents, and the reader gives way to the next, Persons of Interest, as a deleted page does`)
await pick(dialog, SECTION)
check(journal('personal', 'thorin', 'erebor') === null && game.journal.size === 0,
  'nothing was written to Foundry: no journal made, Tidy\'s flags only as Tidy wrote them')
await shootBoth(alice, 'tidy-section-page')

// =================================================================================================
// 4. The Gamemaster
// =================================================================================================
part('4. the Gamemaster')
const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin`, toasts: false })
await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await biography(gm)
check(await countsOf(gm) === '6 from Tidy 5e Sheets', `at Thorin's page the Gamemaster's card counts "6 from Tidy 5e Sheets" (${await countsOf(gm)})`)
{
  const gmDialog = await openJournal(gm.page, 'Thorin’s Journal')
  const listed = await tidyIs(gmDialog, ['Ravenhill', 'Journal Entry 2', 'What Bard knows', 'Persons of Interest', 'Errands', 'Journal Entries'])
  check(listed.length === 6, "the Gamemaster reads Thorin's Tidy entries, as his player does")
  await shootBoth(gm, 'tidy-gm')
  check(await sideways(gm.page) === 0, 'at 1280 nothing scrolls sideways')
  await closeJournal(gmDialog)
}
await gm.page.goto(`${BASE}/campaigns/${A}/characters/balin`)
await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await biography(gm)
{
  const balinDialog = await openJournal(gm.page, 'Balin’s Journal')
  await readerShows(balinDialog, 'Seen')
  const text = await readerText(balinDialog)
  check(text.includes('Its secrets aren’t shown: no player owns Balin in Foundry.') && text.includes('A shade on the road.') && !text.includes(SECRET_TEXT)
    && tidyRows('balin')[0]?.secret === true,
    "Balin is no player's: his entry comes without its secret, and says so")
  await closeJournal(balinDialog)
}

// =================================================================================================
// 5. Another player
// =================================================================================================
part('5. another player')
const bob = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB, toasts: false })
const bobSaw = []
bob.page.on('response', async response => {
  const type = response.headers()['content-type'] ?? ''
  if (!/json|html|text|javascript|x-component/.test(type)) return
  try { bobSaw.push(await response.text()) } catch {}
})
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await biography(bob)
{
  const vexSheet = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)
  const own = await bookOf(bob, `/api/characters/${vexSheet}`)
  check(await countsOf(bob) === 'No notes yet' && own?.kind === 'personal' && !('tidy' in own), "Bob's own journal, Vex's: no notes, and no Tidy entries")
  for (const path of [`${GM_API}/notes`, `${ALICE_API}/notes`, `/api/campaigns/${A}/characters/balin/notes`]) {
    check((await call(bob.page, path)).status === 404, `for Bob, ${path} answers 404`)
  }
  check(!bobSaw.some(body => /Ravenhill|ravens|Bard of Lake-town|A shade on the road/.test(body)), "nothing of Thorin's or Balin's Tidy entries ever reached Bob's browser")
}
// Vex held none when the app first heard of Tidy: the first entry his player writes is dated.
await tidy.add(vex, 'tidyVexMirkwood1', { title: 'Mirkwood', value: '<p>The path is dark.</p>' })
await until(async () => await countsOf(bob) === '1 from Tidy 5e Sheets', "Vex's first Tidy entry counted on Bob's card", 20_000)
{
  const [row] = tidyRows('vex')
  check(row?.firstSeenAt !== null && row?.changedAt === null,
    `Vex's first entry, written after the hello said he held none, is dated as first seen, never undated (${JSON.stringify(row)})`)
  const vexDialog = await openJournal(bob.page, MINE)
  await readerShows(vexDialog, 'Mirkwood')
  check((await readerText(vexDialog)).includes('First seen just now'), 'and Bob\'s reader says "First seen just now"')
  await closeJournal(vexDialog)
}

// =================================================================================================
// 6. Tidy turned off, then uninstalled
// =================================================================================================
part('6. Tidy off, then uninstalled')
game.modules.get(TIDY).active = false
await reloadFoundry()
await until(() => lastHello('erebor').data.features.notes.tidy?.active === false, 'a hello saying Tidy is off', 20_000)
await dialog.getByText(OFF, { exact: true }).first().waitFor({ timeout: 20_000 })
{
  const text = await readerText(dialog)
  check(text.includes(OFF) && (await tidyListed(dialog)).length === 6 && same(campaignTidy(), { active: false, version: TIDY_VERSION }),
    `Tidy turned off in Foundry: the entries still shown, read only, "${OFF}"`)
  const versions = await cardVersions()
  check(versions.at(-1) === `Tidy 5e Sheets: ${TIDY_VERSION} (not enabled)`,
    `and the Gamemaster's settings card lists "Tidy 5e Sheets: ${TIDY_VERSION} (not enabled)" (${JSON.stringify(versions)})`)
}
await pick(dialog, 'Ravenhill')
check(!(await readerText(dialog)).includes(WHERE) && (await readerText(dialog)).includes(OFF), 'and an entry says it, never where to change it')
await shootBoth(alice, 'tidy-off')
game.modules.delete(TIDY)
await reloadFoundry()
await until(() => same(lastHello('erebor').data.features.notes.tidy, { active: false, version: null, actors: ['thorin', 'vex', 'balin'] }), 'a hello saying Tidy is not installed', 20_000)
await dialog.getByText(GONE, { exact: true }).first().waitFor({ timeout: 20_000 })
check((await tidyListed(dialog)).length === 6 && !(lastHello('erebor').data.settings?.modules ?? []).some(m => m.id === TIDY),
  `uninstalled, the entries kept on Thorin still show, "${GONE}", and the hello's modules list it no more`)

// =================================================================================================
// 7. The laptop, both themes
// =================================================================================================
part('7. the laptop')
await closeJournal(dialog)
await alice.page.setViewportSize({ width: 1280, height: 800 })
alice.width = 1280
await wait(300)
dialog = await openJournal(alice.page, MINE)
await pick(dialog, 'What Bard knows')
for (const scheme of ['light', 'dark']) {
  await theme(alice, scheme)
  check(await sideways(alice.page) === 0, `at 1280 in the ${scheme} theme nothing scrolls sideways`)
}
await theme(alice, 'light')
await shootBoth(alice, 'tidy-reader')
await finish()
