// The Foundry settings section on the Gamemaster's campaign card (module 0.30.0 and the app,
// its contract §7 settings-e2e.mjs, decision 8), end to end, in the world of world-030.mjs. Alice
// runs the campaign and plays Thorin in it. Her card at /campaigns has "Foundry settings", closed;
// open, Foundry's version, dnd5e's and Sending Stone's as a dev checkout reports them (module.json),
// the campaign's own switches and every campaign's by their labels in Foundry, dnd5e's two visibility
// settings in its own words, and what players see in chat; with MIDI=1, Midi-QOL among the modules
// and a section of its settings by Midi's own labels, and its lines, the Gamemaster's rolls among
// them. Challenge Visibility changed in Foundry sends one bridge.settings, which a reload shows,
// while her open page as Thorin's player fetches nothing anew; and neither her table view nor her
// party view as a player carries any of it. SKEW=029 with MODULE=module 0.29.0: the versions, and
// that this module doesn't report its settings. At 390 px in both themes, nothing to scroll sideways.
// Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BASE, MIDI, NEW, SHOTS, SHOTS_031, SKEW, VARIANT, actors, browse, call, changeSetting, character, check, finish, foundryWorld, group, item, launch,
  newCampaign, part, postsOf, same, sameJson, settings, settled, sideways, sql, startModule, theme, until, wait,
} from './world-030.mjs'

const GAME = 'https://skyhold-keep.forge-vtt.com'
const SECRET = 'skyhold-settings-secret-30'
const TITLE = 'Skyhold'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'skyhold-keep.forge-vtt.com', secret: SECRET })
const W = await foundryWorld()
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3 }, hp: { value: 30, max: 38, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
const company = group('company', 'The Iron Company', { members: [thorin, vex], ownership: { alice: 2 }, description: { full: '<p>Sworn at Skyhold.</p>' } })
item(company, 'rope', 'loot', 'Hempen Rope')
Object.defineProperty(actors, 'party', { get: () => null, configurable: true })
if (MIDI) {
  // Midi-QOL's own settings, as its Gamemaster has them: world-wide, then this browser's.
  settings.set('showGM', false)
  settings.set('ReplaceDefaultActivities', true)
  settings.set('ForceHideRoll', true)
  settings.set('EnableWorkflow', true)
}
await startModule({
  campaigns: [{ id: 'camp-sky', title: TITLE, characters: ['thorin', 'vex'], groups: ['company'], rolls: true }],
  secrets: { 'camp-sky': SECRET },
})
await settled()
const hello = postsOf('bridge.hello')[0]
const stored = () => JSON.parse(sql(`select coalesce(foundry::text, 'null') from campaign where id = '${A}'`))
const version = () => Number(sql(`select version from campaign where id = '${A}'`))
const FOUNDRY = game.version

// ---- What the app keeps ----
part('1. the hello')
await until(() => stored(), 'the app to keep what Foundry said of itself')
if (NEW) {
  const settingsSent = hello.data.settings
  check(settingsSent.format === 1 && same(settingsSent.sections.map(s => s.id), ['campaign', 'sending-stone', 'dnd5e', ...(MIDI ? ['midi-qol'] : [])])
    && same(settingsSent.results.map(r => r.id), MIDI ? ['hits', 'midiHits', 'saves', 'checks', 'midiSaves', 'gmRolls'] : ['hits', 'saves', 'checks']),
    `the hello carries the settings: ${settingsSent.sections.map(s => s.id).join(', ')}; and ${settingsSent.results.length} lines of what players see`)
  const text = JSON.stringify(settingsSent)
  check(!text.includes(SECRET) && !text.includes('localhost:3000') && !text.includes(new URL(BASE).host) && !/campaignSecrets|listenerUrl|"secret"/.test(text),
    'never the campaign\'s secret, nor where the app is')
  check(sameShape(stored(), { receivedAt: true, module: true, foundry: true, system: true, settings: true }) && sameJson(stored().settings, settingsSent),
    `the app keeps them, with the versions, as the campaign's, from the hello (${JSON.stringify(Object.keys(stored()))})`)
} else {
  check(!('settings' in hello.data) && !('settings' in stored()) && stored().module?.version === '0.1.0',
    `module 0.29.0 says nothing of its settings; the app keeps the versions alone (${JSON.stringify(stored())})`)
}
function sameShape(object, keys) { return same(Object.keys(object).sort(), Object.keys(keys).sort()) }

// ---- The Gamemaster's campaign card ----
part('2. the card')
// Changed on purpose (round 0.39.0 §4.8): on a phone the campaigns page lists its campaigns, and shows
// one chosen in the address in the list's place; its sections' headings one level up, Foundry
// settings' own h4s.
const CHOSEN = `/campaigns?campaign=${A}`
const gm = await browse({ width: 390, height: 844, path: CHOSEN })
const card = gm.page.getByRole('article', { name: TITLE })
await card.waitFor()
const section = card.locator('details').filter({ has: gm.page.locator('summary', { hasText: 'Foundry settings' }) })
check(await section.count() === 1 && await section.evaluate(el => !el.open) && !(await section.getByText('Versions').isVisible()),
  '"Foundry settings" is on the card, closed')
await shootSection('gm-campaigns-settings-closed')
await section.locator('summary').click()
await section.getByRole('heading', { name: 'Versions' }).waitFor()
/** A list of rows under a heading: each "label: value", and its note. */
const rowsUnder = heading => section.locator('h4', { hasText: heading }).first().locator('xpath=following-sibling::dl[1]/div')
  .evaluateAll(divs => divs.map(div => [div.querySelector('dt').textContent, div.querySelector('dd').textContent, div.querySelectorAll('dd')[1]?.textContent ?? null]))
const read = async heading => (await rowsUnder(heading)).map(([label, value, note]) => `${label}: ${value}${note ? ` (${note})` : ''}`)
{
  const versions = await read('Versions')
  const expected = [`Foundry: ${FOUNDRY}`, 'D&D Fifth Edition: 5.3.3', 'Sending Stone: 0.1.0', ...(NEW ? [...(MIDI ? ['Midi QOL: 14.1.2'] : []), 'libWrapper: 1.12.13.0 (not enabled)'] : [])]
  check(/^14\./.test(FOUNDRY) && same(versions, expected), `open, its versions: ${JSON.stringify(versions)}`)
  check(await section.getByText(/^As Foundry sent them at /).isVisible(), 'and when Foundry sent them')
}
if (SKEW) {
  check(await section.getByText("Sending Stone 0.1.0 in Foundry doesn't report its settings. Update it to 0.30.0 or later to see them here.").isVisible()
    && await section.getByRole('heading', { name: 'What players see in chat' }).count() === 0,
    'with module 0.29.0, the notice: "Sending Stone 0.1.0 in Foundry doesn\'t report its settings. Update it to 0.30.0 or later to see them here."')
  const text = await section.textContent()
  check(!text.includes('Hit/miss and save results in the app') && !text.includes('Players move items and coins'), 'and neither the results setting\'s row nor the moves switch\'s')
  await widths()
  await finish()
}
{
  const campaignRows = await read('This campaign')
  // Changed on purpose (round 0.36.0 §13.4): how its characters' companions enter initiative, after the moves switch.
  // Changed on purpose (round 0.38.0 §D10.4): dishes from the Magical Recipe Book, after the moves switch.
  // Changed on purpose (round 0.39.0 §1.11): a player's own effects, after dishes.
  // Changed on purpose (round 0.40.0 §10.4): Wild Shape from the app, after effects.
  check(same(campaignRows, ['Players roll in the app: On', 'Attacks, spells and features: Off', 'Save and concentration prompts: Off',
    'Allow Players to enter dice results manually: Off', 'Players move items and coins: Off', 'Dishes from the Magical Recipe Book: Off',
    'Allow Players to disable & remove their own active effects: Off', 'Allow Players to use Wild Shape from the app: Off',
    "Companions' initiative: Its own roll", 'Party sheets: The Iron Company']),
    `the campaign's own switches by their labels in Manage Campaigns, and its party sheets: ${JSON.stringify(campaignRows)}`)
  const world = await read('Sending Stone, for every campaign')
  check(same(world, ['Chat messages: On', 'Which messages: All its players can read', "Hit/miss and save results in the app: Follow Foundry's visibility settings",
    'Combat tracker: On', 'GM-only details: Off',
    ...(MIDI ? ["Run players' attacks through Midi: On", 'Allow targets off your screen: Off'] : [])]),
    `every campaign's: ${JSON.stringify(world)}`)
  const dnd5e = await read('D&D Fifth Edition')
  check(same(dnd5e, ['Attack Result Visibility: Hide all', 'Challenge Visibility: Show only from other players']), `dnd5e's, in its own words: ${JSON.stringify(dnd5e)}`)
}
const RESULTS_X = [
  ['hidden', 'Hit and miss: hidden (Attack Result Visibility: Hide all)'],
  ['partial', "Saves: shown on players' cards and rolls, hidden otherwise (Challenge Visibility: Show only from other players)"],
  ['partial', "Checks: shown on players' cards and rolls, hidden otherwise (Challenge Visibility: Show only from other players)"],
]
const HIGHLIGHT = 'Color code Hit/Miss/Save Display: On; Only highlight critical/fumble hits: Off'
const RESULTS_MIDI = [
  ['hidden', `Hit and miss on dnd5e's cards: hidden (Attack Result Visibility: Hide all; ${HIGHLIGHT})`],
  ['hidden', "Hit and miss on Midi-QOL's cards: hidden (Auto check if attack hits target: None; Attack Result Visibility: Hide all)"],
  RESULTS_X[1], RESULTS_X[2],
  ['hidden', "Saves on Midi-QOL's cards: hidden (Auto check Saves: Off; Challenge Visibility: Show only from other players)"],
  ['shown', "The Gamemaster's rolls on Midi-QOL's cards: shown (GM Attack Roll Display: Full Roll; GM Damage Roll Display: Full Roll)"],
]
const resultsShown = () => section.locator('h4', { hasText: 'What players see in chat' }).locator('xpath=following-sibling::ul[1]/li')
  .evaluateAll(lis => lis.map(li => [li.dataset.state, li.textContent]))
{
  const lines = await resultsShown()
  check(same(lines, MIDI ? RESULTS_MIDI : RESULTS_X), `"What players see in chat", ${MIDI ? "Midi-QOL's defaults and " : ''}dnd5e's as they come: ${JSON.stringify(lines)}`)
}
if (MIDI) {
  const rows = await read('Midi-QOL')
  check(same(rows, [
    'Auto check if attack hits target: None', 'Auto check Saves: Off', 'GM Attack Roll Display: Full Roll', 'GM Damage Roll Display: Full Roll',
    'Color code Hit/Miss/Save Display: On', 'Only highlight critical/fumble hits: Off', 'Prompt Players to Roll Saves: None (private roll)',
    'Prompt GM to Roll Saves (Unlinked): Auto', 'Prompt GM to Roll Saves (Linked): Auto', 'Which ability saves are rolled blind: None',
    'Which ability checks are rolled blind: None', 'Which skill checks are rolled blind: None', 'Blind roll display: Hidden (players see nothing)',
    'GM Sees all whispered messages: Off', 'Replace dnd5e activities with midi-qol equivalents: On',
    'Really Hide private/blind/self-rolls (this browser): On', 'Enable roll automation support (this browser): On',
  ]), `Midi-QOL's, each by Midi's own label, its choices in Midi's words: ${JSON.stringify(rows)}`)
}
await widths()

// ---- A setting changed in Foundry ----
part('3. a change')
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const player = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin' })
await player.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await wait(3500)
let sent = postsOf('bridge.settings').length
// Midi's own keys change too: one it never reads changes nothing.
if (MIDI) {
  W.midi.settings.autoTarget = 'always'
  await changeSetting('midi-qol', 'ConfigSettings', W.midi.settings)
  await settled()
  check(postsOf('bridge.settings').length === sent, 'a Midi-QOL setting that decides nothing players see, changed, sends nothing')
  await wait(3500)
}
const tableAnswers = []
player.page.on('response', response => { if (/\/api\/characters\/sheet-thorin\/table/.test(response.url())) tableAnswers.push(response.status()) })
const versionBefore = version()
await changeSetting('dnd5e', 'challengeVisibility', 'all')
await until(() => postsOf('bridge.settings').length > sent, 'bridge.settings', 10_000)
await settled(1500)
check(postsOf('bridge.settings').length === sent + 1 && postsOf('bridge.settings').at(-1).status === 204,
  'Challenge Visibility changed to "Show all" in Foundry: one bridge.settings is posted, and the app takes it')
await wait(7000)
check(version() === versionBefore && tableAnswers.length >= 2 && tableAnswers.every(status => status === 204),
  `the campaign's version is unchanged, so Thorin's open page, polling, fetched nothing anew (${JSON.stringify(tableAnswers)})`)
await gm.page.reload()
await section.locator('summary').click()
await section.getByRole('heading', { name: 'What players see in chat' }).waitFor()
{
  const lines = await resultsShown()
  const saves = lines.find(([, t]) => t.startsWith('Saves:'))
  check(same(saves, ['shown', 'Saves: shown (Challenge Visibility: Show all)']) && (await read('D&D Fifth Edition'))[1] === 'Challenge Visibility: Show all',
    `a reload shows it: ${JSON.stringify(saves)}`)
}

// ---- Hit/miss and save results in the app, changed in Foundry (module 0.31.0) ----
part('3b. results always')
{
  sent = postsOf('bridge.settings').length
  const hellos = postsOf('bridge.hello').length
  const before = version()
  await changeSetting('sending-stone', 'chatResults', 'always')
  await until(() => postsOf('bridge.settings').length > sent, 'bridge.settings', 10_000)
  await settled(1500)
  const report = postsOf('bridge.settings').at(-1)
  const row = report.data.settings.sections.find(s => s.id === 'sending-stone').rows.find(r => r.id === 'chatResults')
  check(postsOf('bridge.settings').length === sent + 1 && report.status === 204 && postsOf('bridge.hello').length === hellos && version() === before
    && same(row, { id: 'chatResults', label: 'Hit/miss and save results in the app', value: 'always', text: 'Always show them to players' }),
    `"Hit/miss and save results in the app" set to "Always show them to players" in Foundry: one bridge.settings, no hello, the campaign's version unchanged (${JSON.stringify(row)})`)
  await gm.page.reload()
  await section.locator('summary').click()
  await section.getByRole('heading', { name: 'What players see in chat' }).waitFor()
  const ALWAYS = 'Hit/miss and save results in the app: Always show them to players'
  const lines = await resultsShown()
  const want = MIDI ? [
    ['shown', `Hit and miss on dnd5e's cards: shown (${ALWAYS})`],
    ['shown', `Hit and miss on Midi-QOL's cards: shown (${ALWAYS})`],
    ['shown', `Saves: shown (${ALWAYS})`],
    ['shown', `Checks: shown (${ALWAYS})`],
    ['hidden', "Saves on Midi-QOL's cards: hidden (Auto check Saves: Off)"],
    RESULTS_MIDI[5],
  ] : [['shown', `Hit and miss: shown (${ALWAYS})`], ['shown', `Saves: shown (${ALWAYS})`], ['shown', `Checks: shown (${ALWAYS})`]]
  check(same(lines, want), `a reload shows every line shown by it${MIDI ? ", but Midi's saves, which it records none of, and the Gamemaster's rolls, which follow Midi" : ''}: ${JSON.stringify(lines)}`)
  const world = await read('Sending Stone, for every campaign')
  check(world[2] === 'Hit/miss and save results in the app: Always show them to players', `and its row: "${world[2]}"`)
  if (SHOTS) {
    for (const scheme of ['light', 'dark']) {
      await theme(gm, scheme)
      await gm.page.waitForTimeout(350)
      await section.screenshot({ path: `${SHOTS_031}/gm-campaigns-settings-always-390-${scheme}${VARIANT}.png` })
    }
    await theme(gm, 'light')
    const tablet = await browse({ width: 768, height: 1024, path: CHOSEN })
    const wide = tablet.page.getByRole('article', { name: TITLE })
    await wide.locator('summary', { hasText: 'Foundry settings' }).click()
    await wide.getByRole('heading', { name: 'What players see in chat' }).waitFor()
    for (const scheme of ['light', 'dark']) {
      await theme(tablet, scheme)
      await tablet.page.waitForTimeout(350)
      await wide.screenshot({ path: `${SHOTS_031}/gm-campaigns-settings-always-768-${scheme}${VARIANT}.png` })
    }
    await tablet.view.close()
  }
  await changeSetting('sending-stone', 'chatResults', 'foundry')
  await settled(1500)
}

// ---- Players never receive any of it ----
part('4. players')
{
  const table = await call(player.page, '/api/characters/sheet-thorin/table')
  const party = await call(player.page, '/api/characters/sheet-thorin/party/company')
  const leaks = text => /attackRollVisibility|challengeVisibility|Foundry settings|"settings"|receivedAt|What players see/.test(text)
  check(table.status === 200 && party.status === 200 && !leaks(table.text) && !leaks(party.text),
    `as Thorin's player, Alice's table view (${table.text.length} characters) and party view (${party.text.length}) carry none of it`)
}

/** The section at 390 px in both themes: nothing to scroll sideways; shots of it. */
async function widths() {
  for (const scheme of ['light', 'dark']) {
    await theme(gm, scheme)
    await wait(300)
    check(await sideways(gm.page) === 0, `at 390 px, ${scheme}, the card scrolls nothing sideways`)
    await shootSection(`gm-campaigns-settings-${scheme}`)
  }
  await theme(gm, 'light')
  // And on a tablet, 768 px.
  const tablet = await browse({ width: 768, height: 1024, path: CHOSEN })
  const wide = tablet.page.getByRole('article', { name: TITLE })
  await wide.locator('summary', { hasText: 'Foundry settings' }).click()
  await wide.getByRole('heading', { name: 'Versions' }).waitFor()
  for (const scheme of ['light', 'dark']) {
    await theme(tablet, scheme)
    check(await sideways(tablet.page) === 0, `at 768 px, ${scheme}, nothing to scroll sideways either`)
    if (SHOTS) await wide.screenshot({ path: `${SHOTS}/gm-campaigns-settings-768-${scheme}${VARIANT}.png` })
  }
  await tablet.view.close()
}
async function shootSection(name) {
  if (!SHOTS) return
  await gm.page.waitForTimeout(350)
  await card.screenshot({ path: `${SHOTS}/${name}${VARIANT}.png` })
}

await finish()
