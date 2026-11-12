// Help (ROADMAP item 12, the owner's decisions H1-H6 and D1-D4, the prototype's option A, Chips), end
// to end, in the world of world-030.mjs with module 0.44.0 under dnd5e 5.3.3. Alice plays Thorin,
// Trusted, so Make Manual Rolls is hers; Bob plays Seraphina Nightingale-Ashworth; Alice runs Help
// Desk, whose players roll in the app, at first without typing in their dice. Thorin's page at 360 ×
// 780: the header's ? (after Live, before Full screen) opens Help in the side panel, the whole
// width, its title focused, subtitled "Playing from Sending Stone", the "In this game, for Thorin" box
// at the top reading the campaign (typing "Not in this game", no typing rows), then the Go to chips
// and the eight sections, the paragraph on the dice an item rolls later among them, as the module
// is 0.44.0 under dnd5e 5, whatever its switches (round 3's decision 3); the panel's content
// measured (no section cut short or overlapping, its content scrolling to the last section), nothing
// to scroll sideways; a chip focuses its section's heading and scrolls it to 12 px from the top,
// smoothly, or at once with reduced motion; Escape gives the ? its focus back. The cog's "How to use
// Sending Stone", first in its Help group, opens the same panel at its title, and Escape gives the
// cog its focus back; with the cog's Send to the table off, the box says what he sends stays here.
// At 1280 × 800 the panel is 448 px at the right. The campaign lets players type in their dice:
// "Allowed: turn it on in Settings", the paragraph still shown; Thorin's Enter dice results manually
// on: "On", the dice his effects add and those an item rolls later "Asked for"; with Send to the
// table off, both "Not while Send is off" (round 3's decision 2). The Gamemaster's page for Seraphina
// at 360 × 780: the room her name has in the header, with the ? and without it, measured; Help "What
// your player sees", its note naming her, its own box, the same sections and paragraphs as her
// player's; at 1280 the same; at 390 with their Send to the table off, their rolls stay here.
// SKEW=042 (module 0.42.0) and DND5E6=1 (dnd5e 6.0.5, whose dice the module never asks for), typing
// allowed and on: no row and no paragraph for the dice an item rolls later, at either seat.
// Screenshots at twice the pixels, to SHOTS: the panel at 360, 390, 768 and 1280, in both themes at
// 390 and 1280; the Gamemaster's at 390 and 1280, and at 390 with their Send off; the box with typing
// off, on, and on with Send off; the paragraph with typing off; the settings menu; the Gamemaster's
// header at 360; under SKEW=042 and DND5E6=1, the box at 390. Focus and scrolling are waited for as
// they happen, never for a fixed time. Synthetic characters only. Run with --import
// ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
import {
  DND5E6, SKEW042, browse, character, check, finish, foundryWorld, launch, manualDice, newCampaign, note, part, same,
  settled, shoot, sideways, sql, startModule, theme, until,
} from './world-030.mjs'

const GAME = 'https://help-desk.forge-vtt.com'
const SECRET = 'help-desk-secret-44'
const TITLE = 'Help Desk'
const LONG = 'Seraphina Nightingale-Ashworth'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'help-desk.forge-vtt.com', secret: SECRET })
await foundryWorld()
game.modules.get('sending-stone').version = SKEW042 ? '0.42.0' : '0.44.0'
manualDice('active')
game.users.get('alice').role = 2

const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 2 }, hp: { value: 30, max: 40, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
game.users.get('alice').character = thorin
const seraphina = character({ id: 'seraphina', name: LONG, owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
seraphina.system.details = { level: 5 }
const CAMPAIGN = ({ typing = false } = {}) => ({ id: 'camp-help', title: TITLE, characters: ['thorin', 'seraphina'], groups: [], rolls: true, manualDice: typing })
await startModule({ campaigns: [CAMPAIGN()], secrets: { 'camp-help': SECRET } })
await settled()
const kinds = () => sql(`select array_to_string("rollKinds", ',') from campaign where id = '${A}'`).split(',')
// Module 0.42.0 makes no plain rolls: its checks, then.
await until(() => kinds().includes(SKEW042 ? 'skill' : 'plainRoll'), 'the app to keep the rolls the game takes', 15_000)
/** What the app keeps of the hello: its module's and game system's versions, and so whether it asks for later dice. */
const versions = () => sql(`select concat_ws(' ', foundry->'module'->>'version', foundry->'system'->>'id', foundry->'system'->>'version', "laterDice") from campaign where id = '${A}'`)
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)

const SECTIONS = ['Rolling', 'Hold for more', 'Dice tray', 'Typing in your own dice', 'Hit points and rests', 'Combat', 'Settings', 'What your Gamemaster turns on']
const LATER = 'Dice an item rolls later.'

/** A page at a width, at twice the pixels, as a phone's or a computer's. */
const open = (width, height, path, scheme = 'light') => browse({
  path, scheme, toasts: false,
  device: { viewport: { width, height }, deviceScaleFactor: 2, isMobile: width < 1024, hasTouch: width < 1024 },
})
const ready = async who => who.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const panelOf = who => who.page.getByRole('dialog', { name: 'Help' })
/** What has focus: its role or tag, and its name. */
const focused = who => who.page.evaluate(() => {
  const el = document.activeElement
  return `${el?.tagName.toLowerCase()} ${el?.getAttribute('aria-label') ?? el?.textContent?.trim()}`
})
/** What has focus once it's `want`, or after 5 s whatever has it, for the check after it to say. */
async function focusedOn(who, want) {
  const end = Date.now() + 5_000
  let now = await focused(who)
  while (now !== want && Date.now() < end) {
    await new Promise(resolve => setTimeout(resolve, 50))
    now = await focused(who)
  }
  return now
}
/** Help, once open: its slide in over, and its title focused, or 5 s on. */
async function opened(who) {
  await panelOf(who).waitFor()
  await panelOf(who).evaluate(dialog => Promise.all(dialog.getAnimations().map(slide => slide.finished)))
  await focusedOn(who, 'h2 Help')
}
/** Help, opened from the header's button. */
async function openHelp(who) {
  await who.page.getByRole('button', { name: 'Help', exact: true }).click()
  await opened(who)
}
/** The box's rows, "label: says". */
const boxOf = who => panelOf(who).getByRole('region', { name: /^In this game, for / })
const rowsOf = who => boxOf(who).locator('dl > div').evaluateAll(rows => rows.map(row => `${row.querySelector('dt').textContent}: ${row.querySelector('dd').textContent}`))
const shown = async (who, text) => (await panelOf(who).getByText(text, { exact: true }).count()) > 0
async function closeHelp(who) {
  await who.page.keyboard.press('Escape')
  await panelOf(who).waitFor({ state: 'hidden' })
}
/** This device's Send to the table, from the cog, Help closed: its label, as a finger taps it. */
async function sendFrom(who, on) {
  await who.page.getByRole('button', { name: 'Settings', exact: true }).click()
  const menu = who.page.getByRole('dialog', { name: 'Settings' })
  // The switch itself is drawn over its hidden checkbox.
  const toggle = menu.getByRole('switch', { name: 'Send to the table', exact: true })
  if ((await toggle.isChecked()) !== on) await menu.getByText('Send to the table', { exact: true }).click()
  await until(async () => (await toggle.isChecked()) === on, `Send to the table ${on ? 'on' : 'off'} at ${who.width}`, 5_000)
  await who.page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
}
/** The panel's own layout: its box and sections, and how its content scrolls. */
const layoutOf = who => panelOf(who).evaluate(dialog => {
  const scroller = dialog.querySelector('.overflow-y-auto')
  const sections = [...scroller.querySelectorAll('section')].map(section => {
    const { top, bottom, height } = section.getBoundingClientRect()
    return { name: section.querySelector('h3').textContent, top, bottom, height, content: section.scrollHeight }
  })
  const { width, left } = dialog.getBoundingClientRect()
  return { width, left, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight, sections, display: getComputedStyle(scroller).display }
})

if (SKEW042 || DND5E6) {
  // =================================================================================================
  // Module 0.42.0, or dnd5e 6.0.5: no dice an item rolls later asked, whatever the switches
  // =================================================================================================
  const which = SKEW042 ? 'module 0.42.0, under dnd5e 5' : 'module 0.44.0 under dnd5e 6, whose later dice it never asks for'
  part(SKEW042 ? 'module 0.42.0' : 'dnd5e 6')
  await game.settings.set('sending-stone', 'campaigns', [CAMPAIGN({ typing: true })])
  sql(`update "character" set "manualDice" = true where id = 'sheet-thorin'`)
  check(versions() === (SKEW042 ? '0.42.0 dnd5e 5.3.3 f' : '0.44.0 dnd5e 6.0.5 f'), `the app keeps the hello's versions, and that its module asks for no later dice: ${versions()}`)
  const player = await open(390, 844, '/characters/sheet-thorin')
  await ready(player)
  await openHelp(player)
  await until(async () => (await rowsOf(player)).includes('Typing in your dice: On'), 'the box to say typing is on', 20_000)
  const rows = await rowsOf(player)
  check(rows.some(row => row.startsWith('Dice your effects add: ')) && !rows.some(row => row.startsWith('Dice an item rolls later'))
    && !(await shown(player, LATER)) && await shown(player, 'Dice your effects add.'),
    `${which}, typing allowed and on: the box has the dice his effects add, but no row for the dice an item rolls later, and Help no paragraph on them (${JSON.stringify(rows.slice(5, 8))})`)
  await shoot(player, 'help-box-no-later-dice', boxOf(player))
  const gm = await open(390, 844, `/campaigns/${A}/characters/seraphina`)
  await ready(gm)
  await openHelp(gm)
  check(same(await panelOf(gm).locator('section h3').allTextContents(), [`In this game, for ${LONG}`, ...SECTIONS]) && !(await shown(gm, LATER)),
    "and the Gamemaster's Help has the same eight sections, without that paragraph")
  await finish()
}

// =================================================================================================
part('1. a player at 360: the header, the panel and its box')
const phone = await open(360, 780, '/characters/sheet-thorin')
await ready(phone)
{
  const cluster = await phone.page.locator('header').first().locator('> div').last().locator('> *').evaluateAll(els => els.map(el => el.getAttribute('aria-label') ?? el.getAttribute('role')))
  const help = await phone.page.getByRole('button', { name: 'Help', exact: true }).boundingBox()
  check(same(cluster.slice(0, 3), ['status', 'Help', 'Full screen']) && help.width === 32 && help.height === 32,
    `the header's ? sits after Live and before Full screen, ${help.width} × ${help.height} px at 360 (${cluster.join(', ')})`)
}
await openHelp(phone)
check(await focused(phone) === 'h2 Help' && await panelOf(phone).getByText('Playing from Sending Stone', { exact: true }).isVisible(),
  'the ? opens Help at its title, focused, subtitled "Playing from Sending Stone"')
{
  const layout = await layoutOf(phone)
  check(layout.width === 360 && layout.left === 0 && await sideways(phone.page) === 0, `at 360 the panel is the whole width (${layout.width} px), nothing to scroll sideways`)
  const rows = await rowsOf(phone)
  note(`the box at 360: ${JSON.stringify(rows)}`)
  check(rows[0] === 'Your rolls: Made in your Gamemaster’s game too' && rows.includes('Dice tray: Rolled in the game too') && rows.includes('End turn: From here')
    && rows.includes('Attacks, spells and features: Stay here') && rows.includes('Typing in your dice: Not in this game')
    && !rows.some(row => row.startsWith('Dice your effects add') || row.startsWith('Dice an item rolls later')),
    'the box reads the campaign: rolls, the dice tray and End turn made there, attacks not, typing not in this game, and no typing rows')
  check(versions() === '0.44.0 dnd5e 5.3.3 t' && await shown(phone, LATER) && await panelOf(phone).getByText('Missing something?', { exact: false }).isVisible(),
    `the paragraph on the dice an item rolls later, as the app keeps the module's hello (${versions()}), though the campaign doesn't let players type theirs in; the box says why something may be missing`)
  const chips = await panelOf(phone).getByRole('navigation', { name: 'Go to a section' }).getByRole('button').allTextContents()
  check(same(chips, SECTIONS) && await panelOf(phone).getByText('Go to', { exact: true }).isVisible(), `a "Go to" label above eight chips: ${chips.join(', ')}`)
  // Check 2: SidePanel's own layout, with every section and the box.
  const names = layout.sections.map(s => s.name)
  const collapsed = layout.sections.filter(s => s.height < 1 || s.height + 0.5 < s.content)
  const overlapping = layout.sections.filter((s, i) => i > 0 && s.top < layout.sections[i - 1].bottom - 0.5)
  check(same(names, ['In this game, for Thorin', ...SECTIONS]) && collapsed.length === 0 && overlapping.length === 0 && layout.scrollHeight > layout.clientHeight,
    `the panel's content, a ${layout.display} box, holds the box and the eight sections, none cut short or overlapping (heights ${layout.sections.map(s => Math.round(s.height)).join(', ')}), and scrolls: ${layout.scrollHeight} px in ${layout.clientHeight}`)
  const end = await panelOf(phone).evaluate(dialog => {
    const scroller = dialog.querySelector('.overflow-y-auto')
    scroller.scrollTop = scroller.scrollHeight
    const last = [...scroller.querySelectorAll('section')].at(-1).getBoundingClientRect()
    return { top: scroller.scrollTop, max: scroller.scrollHeight - scroller.clientHeight, lastBottom: last.bottom, bottom: scroller.getBoundingClientRect().bottom }
  })
  check(end.top === end.max && end.lastBottom <= end.bottom, `it scrolls to its end, ${end.top} px, the last section in view (${Math.round(end.lastBottom)} ≤ ${Math.round(end.bottom)})`)
}

part('2. the chips: focus, scroll and reduced motion')
/**
 * A chip clicked: the content's scroll as it's clicked, then every frame's, until it has moved and
 * stood still for 300 ms, or 3 s on; how many frames it was on its way; and the heading's place then.
 */
const jump = (who, name) => panelOf(who).evaluate(async (dialog, name) => {
  const scroller = dialog.querySelector('.overflow-y-auto')
  scroller.scrollTop = 0
  const chip = [...dialog.querySelectorAll('nav button')].find(button => button.textContent === name)
  chip.click()
  const atOnce = scroller.scrollTop
  const seen = [atOnce]
  const began = performance.now()
  let since = began
  while ((seen.at(-1) === 0 || performance.now() - since < 300) && performance.now() - began < 3_000) {
    await new Promise(requestAnimationFrame)
    if (scroller.scrollTop !== seen.at(-1)) since = performance.now()
    seen.push(scroller.scrollTop)
  }
  const final = scroller.scrollTop
  const heading = [...scroller.querySelectorAll('h3')].find(h3 => h3.textContent === name)
  return {
    atOnce, final, between: seen.filter(top => top > 0 && top < final).length, focused: document.activeElement === heading,
    offset: Math.round(heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top),
  }
}, name)
{
  const smooth = await jump(phone, 'Typing in your own dice')
  check(smooth.focused && smooth.atOnce === 0 && smooth.between > 0 && smooth.offset === 12,
    `a chip focuses its section's heading and scrolls it smoothly to ${smooth.offset} px from the top (from 0 to ${smooth.final} px, ${smooth.between} frames on its way)`)
  await phone.page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await jump(phone, 'Typing in your own dice')
  check(reduced.focused && reduced.atOnce === reduced.final && reduced.between === 0 && reduced.final === smooth.final && reduced.offset === 12,
    `with reduced motion it's there at once: ${reduced.atOnce} px as the chip is clicked, no frame on its way`)
  await phone.page.emulateMedia({ reducedMotion: 'no-preference' })
}
await closeHelp(phone)
check(await focusedOn(phone, 'button Help') === 'button Help', 'Escape closes Help and gives the header’s ? its focus back')

part('3. the settings menu’s How to use Sending Stone')
{
  await phone.page.getByRole('button', { name: 'Settings', exact: true }).click()
  const menu = phone.page.getByRole('dialog', { name: 'Settings' })
  const group = menu.getByRole('group', { name: 'Help' })
  await group.waitFor()
  const entries = await group.locator('button, a').evaluateAll(els => els.map(el => el.textContent.trim()))
  check(same(entries, ['How to use Sending Stone', 'Report a bug (opens in a new tab)', 'Request a feature (opens in a new tab)']),
    `"How to use Sending Stone" is first in the cog's Help group: ${entries.join(', ')}`)
  await group.scrollIntoViewIfNeeded()
  await shoot(phone, 'help-settings-menu', menu)
  await group.getByRole('button', { name: 'How to use Sending Stone' }).click()
  await opened(phone)
  check(await focused(phone) === 'h2 Help' && !(await menu.isVisible()), 'it closes the settings and opens the same Help, at its title')
  await closeHelp(phone)
  check(await focusedOn(phone, 'button Settings') === 'button Settings', 'Escape gives the cog its focus back')
  // This device's Send to the table, off: what he sends the game stays here, whatever it takes.
  await sendFrom(phone, false)
  await openHelp(phone)
  const rows = await rowsOf(phone)
  // This campaign asks its saves in Foundry, Send or not.
  check(same(rows.slice(0, 5), ['Your rolls: Stay here: only you see them', 'Attacks, spells and features: Stay here', 'Saves the game asks: Asked in Foundry', 'Dice tray: Rolls here only', 'End turn: Not from here']),
    `with the cog's Send to the table off, the box says his rolls stay here: ${JSON.stringify(rows.slice(0, 5))}`)
  await closeHelp(phone)
  await sendFrom(phone, true)
}

part('4. the panel at 1280, and its shots')
const desk = await open(1280, 800, '/characters/sheet-thorin')
await ready(desk)
await openHelp(desk)
{
  const layout = await layoutOf(desk)
  check(layout.width === 448 && layout.left === 1280 - 448 && await focused(desk) === 'h2 Help', `at 1280 the panel is ${layout.width} px wide at the right (from ${layout.left} px), its title focused`)
}
await closeHelp(desk)
check(await focusedOn(desk, 'button Help') === 'button Help', 'and Escape gives the ? its focus back there too')
await openHelp(desk)
await shoot(desk, 'help-panel-player')
await theme(desk, 'dark')
await shoot(desk, 'help-panel-player')
await theme(desk, 'light')
await openHelp(phone)
await shoot(phone, 'help-panel-player')
for (const [width, height, schemes] of [[390, 844, ['light', 'dark']], [768, 1024, ['light']]]) {
  const who = await open(width, height, '/characters/sheet-thorin')
  await ready(who)
  await openHelp(who)
  if (width === 390) {
    await shoot(who, 'help-box-typing-off', boxOf(who))
    // The paragraph in the middle of the panel, the page shot whole: its section is taller than the screen.
    await panelOf(who).getByText(LATER, { exact: true }).evaluate(lead => lead.closest('p').scrollIntoView({ block: 'center' }))
    await shoot(who, 'help-later-dice-typing-off')
  }
  for (const scheme of schemes) {
    await theme(who, scheme)
    await panelOf(who).evaluate(dialog => { dialog.querySelector('.overflow-y-auto').scrollTop = 0 })
    await shoot(who, 'help-panel-player')
  }
  await who.view.close()
}

part('5. typing in dice: allowed, then on')
await game.settings.set('sending-stone', 'campaigns', [CAMPAIGN({ typing: true })])
await until(() => kinds().includes('dice'), 'the app to keep that the game asks for the dice an item rolls later', 20_000)
await closeHelp(phone)
await openHelp(phone)
await until(async () => (await rowsOf(phone)).includes('Typing in your dice: Allowed: turn it on in Settings'), 'the box to say typing is allowed', 20_000)
{
  const rows = await rowsOf(phone)
  check(!rows.some(row => row.startsWith('Dice your effects add') || row.startsWith('Dice an item rolls later')) && await shown(phone, LATER),
    'typing allowed: "Allowed: turn it on in Settings", no typing rows while it\'s off, and the paragraph on the dice an item rolls later as before')
}
sql(`update "character" set "manualDice" = true where id = 'sheet-thorin'`)
await until(async () => (await rowsOf(phone)).includes('Typing in your dice: On'), 'the box to say typing is on', 20_000)
{
  const rows = await rowsOf(phone)
  note(`the box with typing on: ${JSON.stringify(rows)}`)
  check(rows.includes('Dice your effects add: Asked for') && rows.includes('Dice an item rolls later: Asked for'),
    'Enter dice results manually on: "On", the dice his effects add and those an item rolls later "Asked for"')
  const shot = await open(390, 844, '/characters/sheet-thorin')
  await ready(shot)
  await openHelp(shot)
  await until(async () => (await rowsOf(shot)).includes('Typing in your dice: On'), 'the box on the 390 page', 20_000)
  await shoot(shot, 'help-box-typing-on', boxOf(shot))
  // This device's Send to the table off: the dice the game asks for, of no roll kept here.
  await closeHelp(shot)
  await sendFrom(shot, false)
  await openHelp(shot)
  await until(async () => (await rowsOf(shot)).includes('Dice an item rolls later: Not while Send is off'), 'the box on the 390 page with Send off', 20_000)
  const unsent = await rowsOf(shot)
  note(`the box with typing on and Send to the table off: ${JSON.stringify(unsent)}`)
  check(same(unsent.slice(0, 8), ['Your rolls: Stay here: only you see them', 'Attacks, spells and features: Stay here', 'Saves the game asks: Asked in Foundry',
    'Dice tray: Rolls here only', 'End turn: Not from here', 'Typing in your dice: On', 'Dice your effects add: Not while Send is off', 'Dice an item rolls later: Not while Send is off'])
    && unsent.includes('Hit points: Set from here'),
    'with Send to the table off: his rolls, the dice tray and End turn stay here, typing still on, the dice his effects add and an item rolls later "Not while Send is off", his hit points still set from here')
  await shoot(shot, 'help-box-typing-on-send-off', boxOf(shot))
  await shot.view.close()
}

part('6. the Gamemaster’s seat, Seraphina at 360')
const gm = await open(360, 780, `/campaigns/${A}/characters/seraphina`)
await ready(gm)
{
  // Check 1: the room a long name has in the header, with the ? and without it.
  const room = () => gm.page.getByRole('heading', { level: 1 }).evaluate(h1 => ({ shown: h1.clientWidth, needs: h1.scrollWidth }))
  const withHelp = await room()
  const button = gm.page.locator('header button[aria-label="Help"]')
  await button.evaluate(el => { el.style.display = 'none' })
  const without = await room()
  await button.evaluate(el => { el.style.display = '' })
  note(`at 360 in the Gamemaster's seat, ${LONG} has ${withHelp.shown} px with the ? (${without.shown} px without it), of the ${withHelp.needs} px it needs`)
  check(withHelp.shown < without.shown && without.shown - withHelp.shown === 36 && withHelp.shown > 80 && await sideways(gm.page) === 0,
    `the ? takes ${without.shown - withHelp.shown} px from the name, leaving ${withHelp.shown} px, nothing to scroll sideways`)
  await shoot(gm, 'help-header-gm-long-name', gm.page.locator('header').first())
}
await openHelp(gm)
{
  const rows = await rowsOf(gm)
  check(await focused(gm) === 'h2 Help' && await panelOf(gm).getByText('What your player sees', { exact: true }).isVisible()
    && await panelOf(gm).getByText(`At your player’s sheet. This is the help your player sees. Here, you roll as ${LONG}, and your rolls are marked GM;`, { exact: false }).isVisible(),
    'at the Gamemaster\'s seat: "What your player sees", the seat\'s note naming her')
  check(same(rows, [`Your rolls here: Made in your game as ${LONG}, marked GM`, 'Moving items and coins: Not from here', 'Removing items: From here'])
    && await panelOf(gm).getByText('Your switches are on the Player actions tab of Sending Stone’s settings in Foundry.', { exact: true }).isVisible(),
    `its own box: ${JSON.stringify(rows)}`)
  const sections = await panelOf(gm).locator('section h3').allTextContents()
  check(same(sections, [`In this game, for ${LONG}`, ...SECTIONS]) && await shown(gm, LATER),
    'the same eight sections, with the paragraph on the dice an item rolls later, by the campaign\'s module\'s version')
}
await closeHelp(gm)
check(await focusedOn(gm, 'button Help') === 'button Help', 'Escape gives the Gamemaster\'s ? its focus back')
for (const [width, height] of [[390, 844], [1280, 800]]) {
  const who = await open(width, height, `/campaigns/${A}/characters/seraphina`)
  await ready(who)
  await openHelp(who)
  if (width === 1280) {
    const layout = await layoutOf(who)
    check(layout.width === 448 && await focused(who) === 'h2 Help', `at 1280 the Gamemaster's Help is ${layout.width} px, its title focused`)
  }
  await shoot(who, 'help-panel-gm')
  if (width === 390) {
    // Their own Send to the table off: their rolls here stay here (round 3's decision 4).
    await closeHelp(who)
    await sendFrom(who, false)
    await openHelp(who)
    const rows = await rowsOf(who)
    check(same(rows, ['Your rolls here: Stay here: only you see them', 'Moving items and coins: Not from here', 'Removing items: From here']),
      `with the Gamemaster's own Send to the table off at 390: ${JSON.stringify(rows)}`)
    await shoot(who, 'help-panel-gm-send-off')
  }
  await who.view.close()
}

await finish()
