// A player's own effects turned off, on and deleted from the app (module 0.39.0 and the app, its
// contract §1.11), end to end, in the world of world-030.mjs, the effects the module's harness's
// stand-ins (fvtt/effects-core.mjs, on fvtt/dish-core.mjs's withDishes): each updated and deleted
// as Foundry does, its pre-hook first, and who put it there read from its origin. Ashlands, on
// dnd5e 5.3.3, has one campaign, Erebor, with "Allow Players to disable & remove their own active
// effects" on. Alice plays Thorin Oakenshield at 1280 × 800, on a tablet at 768 and on a phone at
// 390 × 844 (360 × 780 where said), with the contract's §1.2 effects on him: Bless from Vex's
// concentration; Invisibility, Shield of Faith turned off from the app and Heroism turned off in
// Foundry, from Vex's spells; Ember Skewers, a dish; Mage Armor, expired; Rage, off on its feature;
// a Ring of Protection's; Boots of Speed's, unavailable while unworn; Blessing of the Raven Queen,
// made on his sheet; Bane from a bandit's spell, Hold Person from a cultist's, NPCs no player owns;
// Prone with a round left; and his concentration on Haste, with Haste on him. Bob plays Vex; the
// Gamemaster is at Thorin's page and on the campaigns page. The hello and the app's answer; each
// row's `ops` as the module sends them; where the controls are, inside the opened row, and in its
// menu; Turn off and Turn on, focus following the row; Delete…, its dialog, from the button and
// from a closed row's menu; Rage turned on in Foundry and off and on from the app; a dish's effect
// deleted; an effect gone meanwhile; two taps, and a crafted second post; the Gamemaster's campaign
// page, and the switch off; never the Gamemaster's page nor another player's seat; phones and both
// themes; and the cog's Help links (item 3). DND5E6=1: dnd5e 6.0.5, its condition effects none,
// Turn off and Delete as under 5.3.3. SKEW=038 with MODULE=module-0.38.1: no effects, no `ops`, no
// controls, and an effect queued by hand never handed over. Synthetic characters only. Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BOB, DND5E6, SKEW038, W, browse, call, character, check, escapeRe, favoring, finish, foundryWorld, launch,
  newCampaign, note, npc, part, posted, postsOf, relay, same, sameJson, settled, shoot, shootBoth, sideways, sql, startModule,
  theme, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashlands-effects.forge-vtt.com'
const ADDRESS = 'ashlands-effects.forge-vtt.com'
const SECRET = 'erebor-effects-39'
const TITLE = 'Erebor'
const NEW = !SKEW038
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: ADDRESS, secret: SECRET })
await foundryWorld()
// A checkout's module.json says 0.1.0, which the Gamemaster's page reads as before effects: the
// version the release would stamp, as round 0.38.0's suite does.
game.modules.get('sending-stone').version = SKEW038 ? '0.38.1' : '0.39.0'
// What favorites need of Foundry's constants (common/constants.mjs), for Add to favorites.
CONST.SORT_INTEGER_DENSITY = 100000

// The module's harness's stand-ins for effects, the current checkout's under every variant.
const D = await import('./fvtt/dish-core.mjs')
D.installDishCore()
const E = await import('./fvtt/effects-core.mjs')
E.installEffectsCore()
// Foundry's fromUuidSync over effects too, as the module reads who put an effect there: the
// harness's, for actors, their items and their effects; the world's for anything else.
{
  const world = globalThis.fromUuidSync
  globalThis.fromUuidSync = (uuid, options = {}) => E.fromUuidSync(uuid, { ...options, strict: false }) ?? world(uuid, options)
}

// The module's results to the app, held while `results.held` is, as a result on its way takes its time.
const results = { held: null, release: null }
{
  const inner = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (results.held) {
      let type = null
      try { type = JSON.parse(init.body).type } catch {}
      while ((type === 'command.result') && results.held) await results.held
    }
    return inner(url, init)
  }
}
const holdResults = () => { results.held = new Promise(resolve => { results.release = resolve }) }
const releaseResults = () => {
  const release = results.release
  results.held = null
  results.release = null
  release?.()
}

// ---- The world: Thorin, Alice's; Vex, Bob's; a bandit and a cultist, NPCs no player owns ----
const thorin = character({ id: 'thorin', name: 'Thorin Oakenshield', owners: ['alice'], mods: { str: 3, con: 2, wis: 1 }, hp: { value: 30, max: 40, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3, wis: 2 }, hp: { value: 20, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
const bandit = npc('bandit', 'Bandit', 12)
const cultist = npc('cultist', 'Cultist', 12)
for (const foe of [bandit, cultist]) foe.hasPlayerOwner = false
// dnd5e's favorites, for Bless added to them from its menu; then what effects need.
favoring(thorin, [])
E.withEffects(thorin, { hp: { value: 30, max: 40 } })
E.withEffects(vex, { hp: { value: 20, max: 30 } })
const fx = E.partyEffects({ thorin, vex, bandit, cultist }, { dnd5e6: DND5E6 })
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
// Rolls on, as its concentration's End needs them; effects apart from them.
const campaign = changes => ({ id: 'erebor', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true, effects: true, ...changes })
await startModule({ campaigns: [campaign()], secrets: { erebor: SECRET } })
await settled()

// ---- What's kept, posted and handed over ----
const hello = () => postsOf('bridge.hello').filter(p => p.campaign === 'erebor').at(-1)
const effectsEnabled = () => sql(`select "effectsEnabled" from campaign where id = '${A}'`)
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }
/** The effect commands kept, in order: each its status, payload and result. */
const commands = () => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, role, "actorId", label, status, payload, result, "createdAt" from roll_request where "campaignId" = '${A}' and kind = 'effect') r`))
/** The `count`th effect command, once the module has answered it and posted its result. */
async function answered(count, what) {
  await until(() => commands().length >= count && ['done', 'failed'].includes(commands()[count - 1].status), what, 30_000)
  const made = commands()[count - 1]
  await until(() => postsOf('command.result').some(p => p.data?.id === made.id), `${what}: its result as posted`, 10_000)
  return made
}
const resultOf = row => postsOf('command.result').find(p => p.data?.id === row.id)?.data
/** Every command the app handed the module, as its answers to the module's fetches said them. */
const handed = () => postsOf('fetch').filter(p => p.url.endsWith('/api/bridge/commands') && p.status === 200)
  .flatMap(p => { try { return JSON.parse(p.body).commands ?? [] } catch { return [] } })
const fetchesAnswered = () => postsOf('fetch').filter(p => p.url.endsWith('/api/bridge/commands')).length
/** Thorin's effects as the app keeps his sheet: each row's id, name and `ops`, by section. */
const storedSheet = () => JSON.parse(sql(`select coalesce((select data::text from actor_sheet where "campaignId" = '${A}' and "actorId" = 'thorin'), 'null')`))
const storedRows = () => (storedSheet()?.effects ?? []).flatMap(section => section.effects.map(row => ({ ...row, section: section.id })))
/** The id a fixture has on the sheet: an item's effect's by its item's id too. */
const sheetId = effect => ((effect.parent?.documentName === 'Item') ? `${effect.parent.id}.${effect.id}` : effect.id)
/** An effect posted as a page would post it, through a seat's API. */
const crafted = (who, api, effect, extra = {}) => call(who.page, `${api}/rolls`, { method: 'POST', body: { kind: 'effect', effect, ...PLAIN, ...extra } })
/** A change to Thorin in Foundry, a hit point lost, so that his sheet goes again. */
const poke = () => thorin.update({ 'system.attributes.hp.value': thorin.system.attributes.hp.value - 1 })
/** Room under the app's limit of rolls a minute from a seat. */
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 15, 'room under the rate limit', 70_000)

// ---- The pages and their parts ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin Oakenshield', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now()),
         ('sheet-vex', 'Vex', '${GAME}', '${TITLE}', '${A}', 'vex', 'e2e-bob', now())`)
const API = '/api/characters/sheet-thorin'
const GM_API = `/api/campaigns/${A}/characters/thorin`
const GM_PAGE = `/campaigns?campaign=${A}`
const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const view = async (who, path = API) => (await call(who.page, `${path}/table`)).json

/** The sheet in view, on a page that shows the table's panes one at a time. */
async function sheetShown(who) {
  if (await who.nav.isVisible()) await who.character()
}
/** The Effects tab, shown. */
async function effectsTab(who) {
  await sheetShown(who)
  await who.tab('Effects')
  await who.page.getByRole('tabpanel').getByRole('heading', { name: 'Conditions' }).first().waitFor({ timeout: 15_000 })
}
const SECTIONS = { temporary: 'Temporary Effects', passive: 'Passive Effects', inactive: 'Inactive Effects', suppressed: 'Unavailable Effects' }
/** One of the Effects tab's sections, by its heading. */
const sectionOf = (who, id) => who.page.getByRole('region', { name: SECTIONS[id], exact: true })
/** The Effects tab's sections, the favorites apart. */
const tabSections = who => who.page.locator('#sheet-panel section[aria-labelledby]').filter({ has: who.page.locator('h2, h3', { hasText: / Effects$/ }) })
/** A row by its effect's name, in a section or the whole tab. */
const rowIn = (scope, name) => scope.locator('li').filter({ has: scope.page().locator('.font-medium', { hasText: new RegExp(`^${escapeRe(name)}$`) }) }).first()
const rowOf = (who, name) => rowIn(tabSections(who), name)
/** A row opened, where it opens, as a tap on it does. */
async function openRow(row) {
  const details = row.locator('details').first()
  if (!(await details.count())) return
  if ((await details.getAttribute('open')) === null) await row.locator('summary').first().click()
  // Open, and what it opens to drawn, as the page draws it once it knows.
  await until(async () => (await details.getAttribute('open')) !== null && (await details.evaluate(el => el.children.length)) > 1, 'the row to open', 5_000)
}
const CONTROL = /^(Turn off|Turn on|Delete) /
/** What a row offers, opened: its controls' names and visible words, in order; and whether its summary holds any. */
async function controlsOf(row) {
  await openRow(row)
  const buttons = row.getByRole('button', { name: CONTROL })
  return {
    names: await buttons.evaluateAll(all => all.map(b => b.getAttribute('aria-label'))),
    words: await buttons.evaluateAll(all => all.map(b => b.textContent.trim())),
    onSummary: await row.locator('summary button').count(),
    heights: await buttons.evaluateAll(all => all.map(b => Math.round(b.getBoundingClientRect().height))),
  }
}
/** The roll tray, as its banner shows it. */
const tray = who => who.page.getByRole('region', { name: 'Your rolls' })
/** What the tray shows, as a reader sees it. */
const trayText = who => tray(who).evaluate(el => el.innerText.replace(/\s+/g, ' '))
/** Until the tray shows a line of this effect's saying this. */
const trayShows = (who, name, words) => until(async () => {
  const text = await trayText(who)
  return text.includes(name) && text.includes(words)
}, `the tray to say "${words}" of ${name}`, 15_000)
/** What has focus: the tag, its row's name, its section's heading, and whether its row is open. */
const focusOf = who => who.page.evaluate(() => {
  const el = document.activeElement
  const section = el?.closest('section[aria-labelledby]')
  return {
    tag: el?.tagName.toLowerCase() ?? null,
    name: el?.closest('li')?.querySelector('.font-medium')?.textContent ?? null,
    section: section ? document.getElementById(section.getAttribute('aria-labelledby'))?.textContent.trim() : null,
    open: el?.closest('details')?.open ?? null,
  }
})
/** A menu, as a screen reader has it: each item's name, and whether it can be chosen. */
const itemsOf = menu => menu.evaluate(m => [...m.querySelectorAll('[role="menuitem"]')].map(i => {
  const said = (i.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map(id => document.getElementById(id)?.textContent.trim()).join(' ')
  return i.textContent.replace(said, '').trim()
}))
/** A right-click on a row's name: the menu named so. */
async function menuOf(who, row, name) {
  const target = row.locator('summary, [tabindex="0"]').first()
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  await target.click({ button: 'right', position: { x: Math.min(30, box.width / 2), y: Math.min(box.height / 2, 14) } })
  const menu = who.page.getByRole('menu', { name, exact: true })
  await menu.waitFor({ timeout: 10_000 })
  return menu
}
/** The favorites, a strip at the top of the tab or a column beside it. */
const favoritesOf = who => who.page.getByRole('region', { name: 'Favorites', exact: true }).or(who.page.getByRole('complementary', { name: 'Favorites', exact: true }))
/** Until Foundry's effect reads so. */
const foundrySays = (test, what) => until(test, what, 20_000)
/** Until the page's own sheet has a row reading so: its `ops` or its absence. */
const sheetSays = (who, test, what) => until(async () => {
  const rows = ((await view(who))?.sheet?.effects ?? []).flatMap(section => section.effects.map(row => ({ ...row, section: section.id })))
  return test(rows)
}, what, 20_000)

// =================================================================================================
// Module 0.38.1: no effects
// =================================================================================================
if (SKEW038) {
  part('module 0.38.1: no effects')
  const features = hello().data.features ?? {}
  check(!('effects' in features) && same(Object.keys(features).slice(-2), ['favorites', 'dishes']),
    `module 0.38.1's hello says nothing of effects (${JSON.stringify(Object.keys(features))})`)
  await wait(3000)
  check(effectsEnabled() === 'f', `the app keeps effectsEnabled off (${effectsEnabled()})`)
  await until(() => storedRows().some(row => row.id === 'bless'), "Thorin's sheet with Bless", 20_000)
  check(storedRows().length > 0 && storedRows().every(row => !('ops' in row)), `its sheet's effect rows carry no ops (${JSON.stringify(storedRows().map(row => Object.keys(row)))})`)
  await effectsTab(desk)
  const bless = rowIn(sectionOf(desk, 'temporary'), 'Bless')
  await bless.waitFor({ timeout: 15_000 })
  const offered = await controlsOf(bless)
  const menu = await menuOf(desk, bless, 'Bless')
  const items = await itemsOf(menu)
  await desk.page.keyboard.press('Escape')
  check(offered.names.length === 0 && !items.some(item => /^(Turn|Delete)/.test(item)),
    `Bless, opened, offers no control, nor its menu (${JSON.stringify({ offered, items })})`)
  const gm = await browse({ width: 1280, height: 800, path: GM_PAGE })
  const section = gm.page.getByRole('article', { name: TITLE }).locator('section').filter({ has: gm.page.getByRole('heading', { name: "Players' effects" }) })
  await section.waitFor({ timeout: 15_000 })
  const said = (await section.locator('p').allTextContents()).join(' ')
  check(said === 'Your Sending Stone module doesn’t let players change their effects yet. Version 0.39.0 or later does.', `the Gamemaster's campaign page: "${said}"`)
  await shootBoth(gm, 'effects-gm', section)
  // An effect queued by hand, as one from before a downgrade: module 0.38.1 is never handed it.
  sql(`insert into roll_request (id, "campaignId", "characterId", role, "requestedById", "actorId", kind, label, payload, status, "updatedAt")
    values ('e2equeued038', '${A}', 'sheet-thorin', 'player', 'e2e-user', 'thorin', 'effect', 'Bless', '${JSON.stringify({ kind: 'effect', effect: { op: 'disable', id: 'bless' }, ...PLAIN })}', 'pending', now())`)
  const from = fetchesAnswered()
  await until(() => fetchesAnswered() >= from + 2, "two more of the module's fetches answered", 120_000)
  const status = sql(`select status from roll_request where id = 'e2equeued038'`)
  check(!handed().some(command => command.kind === 'effect') && status === 'pending' && fx.bless.disabled === false,
    `module 0.38.1 still fetches, and no answer hands it an effect: the row stays pending, Bless on (${JSON.stringify({ fetches: fetchesAnswered() - from, status })})`)
  await finish()
}

// =================================================================================================
// 1. The hello and the answer
// =================================================================================================
part('1. the hello and the answer')
{
  const features = hello().data.features
  check(same(features.effects, { enabled: true, kinds: ['effect'], reason: null })
    && same(Object.keys(features), ['rolls', 'transfers', 'removals', 'notes', 'companions', 'favorites', 'dishes', 'effects']),
  `the hello takes effects, by the campaign's switch, its key last, after dishes (${JSON.stringify({ effects: features.effects, keys: Object.keys(features) })})`)
  check(JSON.parse(hello().body ?? '{}').features?.effects === 1, `the app answers effects: 1 (${hello().body})`)
  await until(() => effectsEnabled() === 't', 'the app to keep effects on', 15_000)
  check(effectsEnabled() === 't', 'the campaign row keeps effectsEnabled on')
}

// =================================================================================================
// 2. `ops` on the sheet
// =================================================================================================
if (!DND5E6) {
  part('2. ops on the sheet')
  await until(() => storedRows().some(row => row.id === 'bless'), "Thorin's sheet with Bless", 20_000)
  const rows = storedRows()
  const wrong = []
  for (const [name, ops] of Object.entries(E.EXPECTED_OPS)) {
    const row = rows.find(each => each.id === sheetId(fx[name]))
    if (!row || !same(row.ops, ops)) wrong.push({ name, id: sheetId(fx[name]), ops: row?.ops ?? 'missing', want: ops })
  }
  check(wrong.length === 0 && rows.every(row => Array.isArray(row.ops)),
    `each of Thorin's ${Object.keys(E.EXPECTED_OPS).length} effects carries the contract's ops, Rage's [] while off as dnd5e keeps it (${JSON.stringify(wrong)})`)
  const vexRows = (JSON.parse(sql(`select data::text from actor_sheet where "campaignId" = '${A}' and "actorId" = 'vex'`))?.effects ?? []).flatMap(section => section.effects)
  check(vexRows.some(row => row.name === 'Concentrating: Bless') && vexRows.every(row => same(row.ops, [])),
    `Vex's own concentration on Bless, End's alone, offers nothing (${JSON.stringify(vexRows.map(row => [row.name, row.ops]))})`)
}

// =================================================================================================
// 3. Where the controls are
// =================================================================================================
part('3. where the controls are')
await effectsTab(desk)
await rowIn(sectionOf(desk, 'temporary'), 'Bless').waitFor({ timeout: 20_000 })
{
  const bless = await controlsOf(rowOf(desk, 'Bless'))
  check(same(bless.names, ['Turn off Bless', 'Delete Bless']) && same(bless.words, ['Turn off', 'Delete…']) && bless.onSummary === 0,
    `Bless, opened: "Turn off" and "Delete…" inside, named with it, its summary holding no button (${JSON.stringify(bless)})`)
  const shield = await controlsOf(rowOf(desk, 'Shield of Faith'))
  check(same(shield.words, ['Turn on', 'Delete…']), `Shield of Faith, turned off from the app: ${JSON.stringify(shield.words)}`)
  const lone = {}
  for (const name of ['Heroism', 'Mage Armor']) lone[name] = (await controlsOf(rowOf(desk, name))).words
  check(Object.values(lone).every(words => same(words, ['Delete…'])), `Heroism, turned off in Foundry, and Mage Armor, expired: "Delete…" alone (${JSON.stringify(lone)})`)
  const none = {}
  for (const name of ['Rage', 'Ring of Protection', 'Boots of Speed', 'Blessing of the Raven Queen', 'Bane', 'Hold Person', ...(DND5E6 ? [] : ['Prone']), 'Haste']) {
    none[name] = (await controlsOf(rowOf(desk, name))).names
  }
  check(Object.values(none).every(names => names.length === 0) && await rowIn(sectionOf(desk, 'suppressed'), 'Boots of Speed').count() === 1,
    `Rage (off), the Ring's, the Boots' (unavailable, unworn), the Raven Queen's, Bane, Hold Person${DND5E6 ? '' : ', Prone'} and Haste: none (${JSON.stringify(none)})`)
  const concentration = rowOf(desk, 'Concentrating: Haste')
  await openRow(concentration)
  check(await concentration.getByRole('button', { name: /^End/ }).count() === 1 && (await controlsOf(concentration)).names.length === 0,
    `Concentrating: Haste keeps End, and nothing else (${JSON.stringify({ buttons: await concentration.getByRole('button').evaluateAll(all => all.map(b => [b.getAttribute('aria-label'), b.textContent])) })})`)
  if (DND5E6) {
    const names = await tabSections(desk).locator('li .font-medium').allTextContents()
    check(!names.includes('Prone') && !names.includes('Invisible'),
      `under dnd5e 6.0.5, its condition effects, Prone and Invisible, aren't among the effects, so nothing offers to change them (${JSON.stringify(names)})`)
  }
  await shootBoth(desk, 'effects', () => sectionOf(desk, 'temporary'))
}

// =================================================================================================
// 4. Turn off and Turn on
// =================================================================================================
part('4. turn off and turn on')
{
  const count = commands().length
  holdResults()
  await rowOf(desk, 'Bless').getByRole('button', { name: 'Turn off Bless', exact: true }).click()
  await foundrySays(() => fx.bless.disabled === true, "Foundry's Bless to be turned off")
  check(fx.bless.flags?.['sending-stone']?.offByPlayer === true, "Foundry's Bless is turned off, and marked as its player's")
  await trayShows(desk, 'Bless', 'Turning it off')
  check(true, `on its way, the tray says "Turning it off" of Bless (${await trayText(desk)})`)
  releaseResults()
  const made = await answered(count + 1, 'Bless turned off')
  check(made.status === 'done' && same(resultOf(made)?.effect, { id: 'bless', disabled: true, deleted: false }) && sameJson(made.payload.effect, { op: 'disable', id: 'bless' }) && made.label === null,
    `one command, done, its label not kept: ${JSON.stringify({ status: made.status, label: made.label, payload: made.payload.effect, effect: resultOf(made)?.effect })}`)
  await trayShows(desk, 'Bless', 'Turned off')
  const inactive = rowIn(sectionOf(desk, 'inactive'), 'Bless')
  await inactive.waitFor({ timeout: 15_000 })
  await until(async () => (await focusOf(desk)).name === 'Bless', 'focus to follow Bless', 10_000).catch(() => {})
  const focus = await focusOf(desk)
  check(await inactive.getByText('Off', { exact: true }).isVisible() && same(focus, { tag: 'summary', name: 'Bless', section: 'Inactive Effects', open: true })
    && (await controlsOf(inactive)).words.join() === 'Turn on,Delete…',
    `"Turned off": Bless under Inactive Effects, "Off", open, its summary focused, "Turn on" and "Delete…" (${JSON.stringify(focus)})`)
  await shootBoth(desk, 'effects-off', () => sectionOf(desk, 'inactive'))
  await inactive.getByRole('button', { name: 'Turn on Bless', exact: true }).click()
  const back = await answered(count + 2, 'Bless turned on')
  await rowIn(sectionOf(desk, 'temporary'), 'Bless').waitFor({ timeout: 15_000 })
  await until(async () => (await focusOf(desk)).section === 'Temporary Effects', 'focus to follow Bless back', 10_000).catch(() => {})
  const again = await focusOf(desk)
  check(back.status === 'done' && fx.bless.disabled === false && fx.bless.flags['sending-stone'].offByPlayer === false
    && same(again, { tag: 'summary', name: 'Bless', section: 'Temporary Effects', open: true }),
    `Turn on brings it back, the mark cleared, focus following it to Temporary Effects (${JSON.stringify(again)})`)
}

// =================================================================================================
// 5. Delete… from its button
// =================================================================================================
part('5. delete… from its button')
{
  const count = commands().length
  const row = rowOf(desk, 'Invisibility')
  await openRow(row)
  const next = await row.evaluate(li => li.nextElementSibling?.querySelector('.font-medium')?.textContent ?? null)
  await row.getByRole('button', { name: 'Delete Invisibility', exact: true }).click()
  const dialog = desk.page.getByRole('dialog', { name: 'Delete Invisibility?', exact: true })
  await dialog.waitFor()
  const said = (await dialog.locator('p').first().textContent()).replace(/\s+/g, ' ').trim()
  const buttons = await dialog.getByRole('button').allTextContents()
  check(said === 'It’s removed from Thorin Oakenshield in Foundry, and can’t be undone.' && buttons.map(b => b.trim()).includes('Delete') && buttons.map(b => b.trim()).includes('Keep'),
    `its dialog, "Delete Invisibility?": "${said}" ${JSON.stringify(buttons)}`)
  await shootBoth(desk, 'effects-delete-dialog', dialog)
  await dialog.getByRole('button', { name: 'Keep', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  check(commands().length === count && thorin.effects.includes(fx.invisibility), 'Keep closes it, nothing sent, Invisibility still there')
  await row.getByRole('button', { name: 'Delete Invisibility', exact: true }).click()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  const made = await answered(count + 1, 'Invisibility deleted')
  await rowOf(desk, 'Invisibility').waitFor({ state: 'detached', timeout: 15_000 })
  await until(async () => (await focusOf(desk)).tag === 'summary', 'focus on the next row', 10_000).catch(() => {})
  const focus = await focusOf(desk)
  check(made.status === 'done' && same(resultOf(made)?.effect, { id: 'invisibility', disabled: null, deleted: true }) && !thorin.effects.includes(fx.invisibility)
    && focus.tag === 'summary' && focus.name === next,
    `Delete: gone in Foundry and from the tab, focus on the next row's summary, ${next} (${JSON.stringify({ effect: resultOf(made)?.effect, focus })})`)
}
if (DND5E6) await finish()

// =================================================================================================
// 6. Delete… from a closed row's menu
// =================================================================================================
part('6. delete… from the menu')
{
  const count = commands().length
  const row = rowOf(desk, 'Mage Armor')
  if ((await row.locator('details').getAttribute('open')) !== null) await row.locator('summary').click()
  const menu = await menuOf(desk, row, 'Mage Armor')
  const items = await itemsOf(menu)
  await menu.getByRole('menuitem', { name: 'Delete…' }).click()
  const dialog = desk.page.getByRole('dialog', { name: 'Delete Mage Armor?', exact: true })
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  const made = await answered(count + 1, 'Mage Armor deleted')
  await rowOf(desk, 'Mage Armor').waitFor({ state: 'detached', timeout: 15_000 })
  check(same(items, ['Add to favorites', 'Delete…']) && made.status === 'done' && !thorin.effects.includes(fx.mageArmor),
    `right-clicked, closed, Mage Armor's menu offers ${JSON.stringify(items)}; Delete… opens its dialog, and Delete deletes it`)
}

// =================================================================================================
// 7. The menu, and the Favorites strip
// =================================================================================================
part('7. the menu')
{
  const menu = await menuOf(desk, rowOf(desk, 'Bless'), 'Bless')
  const items = await itemsOf(menu)
  check(same(items, ['Add to favorites', 'Turn off', 'Delete…']), `Bless's menu: ${JSON.stringify(items)}`)
  await shootBoth(desk, 'effects-menu', menu)
  await paced()
  await menu.getByRole('menuitem', { name: 'Add to favorites' }).click()
  await until(() => thorin.system.favorites.some(f => f.type === 'effect'), 'Bless among his favorites in Foundry', 20_000)
  const strip = rowIn(favoritesOf(desk), 'Bless')
  await strip.waitFor({ timeout: 20_000 })
  const offered = await controlsOf(strip)
  check(same(offered.names, ['Turn off Bless', 'Delete Bless']) && offered.onSummary === 0,
    `added to his favorites, Bless in the Favorites strip offers the same (${JSON.stringify(offered)})`)
}

// =================================================================================================
// 8. Rage
// =================================================================================================
part('8. rage')
{
  await fx.rage.update({ disabled: false })
  const temporary = rowIn(sectionOf(desk, 'temporary'), 'Rage')
  await temporary.waitFor({ timeout: 20_000 })
  const on = await controlsOf(temporary)
  check(same(on.words, ['Turn off']), `Rage turned on in Foundry: under Temporary Effects, "Turn off" and no "Delete…" (${JSON.stringify(on.words)})`)
  const count = commands().length
  await temporary.getByRole('button', { name: 'Turn off Rage', exact: true }).click()
  const off = await answered(count + 1, 'Rage turned off')
  await trayShows(desk, 'Rage', 'Turned off')
  const inactive = rowIn(sectionOf(desk, 'inactive'), 'Rage')
  await inactive.waitFor({ timeout: 15_000 })
  const offered = await controlsOf(inactive)
  check(off.status === 'done' && fx.rage.disabled === true && same(resultOf(off)?.effect, { id: 'rage.rageEffect', disabled: true, deleted: false }) && same(offered.words, ['Turn on']),
    `Turn off: "Turned off", its feature's effect off in Foundry, "Turn on" offered, never "Delete…" (${JSON.stringify(offered.words)})`)
  await inactive.getByRole('button', { name: 'Turn on Rage', exact: true }).click()
  const back = await answered(count + 2, 'Rage turned on')
  await rowIn(sectionOf(desk, 'temporary'), 'Rage').waitFor({ timeout: 15_000 })
  check(back.status === 'done' && fx.rage.disabled === false, 'and Turn on brings it back')
}

// =================================================================================================
// 9. A dish's effect
// =================================================================================================
part('9. a dish\'s effect')
{
  const count = commands().length
  const messages = W.messages.size
  const row = rowOf(desk, 'Ember Skewers (Boon)')
  await openRow(row)
  await row.getByRole('button', { name: 'Delete Ember Skewers (Boon)', exact: true }).click()
  await desk.page.getByRole('dialog', { name: 'Delete Ember Skewers (Boon)?', exact: true }).getByRole('button', { name: 'Delete', exact: true }).click()
  const made = await answered(count + 1, 'Ember Skewers deleted')
  await rowOf(desk, 'Ember Skewers (Boon)').waitFor({ state: 'detached', timeout: 15_000 })
  check(made.status === 'done' && !thorin.effects.includes(fx.ember) && W.messages.size === messages,
    'Ember Skewers (Boon), a dish, deleted from the app: gone in Foundry, no chat card posted or touched')
}

// =================================================================================================
// 11. Two taps (before Bless goes, in 10)
// =================================================================================================
part('11. two taps')
{
  const count = commands().length
  // The sheet held from the app, and the result too: the app's sheet still says Bless may be turned
  // off, while its command is on its way.
  relay.lose = sent => (sent.type === 'character.updated') && (sent.data?.character?.id === 'thorin')
  holdResults()
  await paced()
  const button = rowOf(desk, 'Bless').getByRole('button', { name: 'Turn off Bless', exact: true })
  await button.dblclick()
  await until(() => commands().length > count, 'the command', 10_000)
  const disabled = await button.isDisabled()
  const second = await crafted(desk, API, { op: 'disable', id: 'bless' })
  await wait(1000)
  check(commands().length === count + 1 && disabled && second.status === 409 && second.json?.reason === 'moving',
    `pressed twice quickly, one command: its button disabled while it's on its way, and a crafted second post answered ${second.status} ${second.json?.reason}`)
  releaseResults()
  await answered(count + 1, 'Bless turned off')
  relay.lose = null
  await poke()
  await rowIn(sectionOf(desk, 'inactive'), 'Bless').waitFor({ timeout: 20_000 })
  await rowIn(sectionOf(desk, 'inactive'), 'Bless').getByRole('button', { name: 'Turn on Bless', exact: true }).click()
  await answered(count + 2, 'Bless turned on')
  await rowIn(sectionOf(desk, 'temporary'), 'Bless').waitFor({ timeout: 15_000 })
}

// =================================================================================================
// 14. Phones and themes (Bless still there)
// =================================================================================================
part('14. phones and themes')
const phone = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await effectsTab(phone)
await rowOf(phone, 'Bless').waitFor({ timeout: 20_000 })
for (const [width, height] of [[390, 844], [360, 780]]) {
  await phone.page.setViewportSize({ width, height })
  phone.width = width
  await wait(400)
  const shown = {}
  for (const name of ['Bless', 'Shield of Faith', 'Heroism']) shown[name] = (await controlsOf(rowOf(phone, name))).heights
  check(await sideways(phone.page) === 0 && Object.values(shown).flat().length === 5 && Object.values(shown).flat().every(h => h >= 32),
    `at ${width}, nothing scrolls sideways, and every control is at least 32 px tall (${JSON.stringify(shown)})`)
  await rowOf(phone, 'Bless').scrollIntoViewIfNeeded()
  await shootBoth(phone, 'effects', () => sectionOf(phone, 'temporary'))
}
{
  const tablet = await browse({ width: 768, height: 1024, path: '/characters/sheet-thorin', toasts: false })
  await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await effectsTab(tablet)
  await openRow(rowOf(tablet, 'Bless'))
  check(await sideways(tablet.page) === 0, 'at 768, nothing scrolls sideways either')
  await shootBoth(tablet, 'effects', () => sectionOf(tablet, 'temporary'))
  await tablet.view.close()
}
await openRow(rowOf(desk, 'Bless'))
await shootBoth(desk, 'effects', () => sectionOf(desk, 'temporary'))

// =================================================================================================
// 10. Gone meanwhile
// =================================================================================================
part('10. gone meanwhile')
{
  const count = commands().length
  relay.lose = sent => (sent.type === 'character.updated') && (sent.data?.character?.id === 'thorin')
  await thorin.deleteEmbeddedDocuments('ActiveEffect', ['bless'])
  await wait(1500)
  const stillShown = (await view(desk))?.sheet?.effects?.some(section => section.effects.some(row => row.id === 'bless'))
  await paced()
  await rowOf(desk, 'Bless').getByRole('button', { name: 'Turn off Bless', exact: true }).click()
  const made = await answered(count + 1, 'Bless gone meanwhile')
  await trayShows(desk, 'Bless', 'Not turned off: it can’t be found in the game any more')
  check(stillShown && made.status === 'failed' && resultOf(made)?.reason === 'gone',
    'deleted in Foundry while the app\'s sheet is held, Bless\'s Turn off: "Not turned off: it can’t be found in the game any more"')
  await shootBoth(desk, 'effects-gone', tray(desk))
  relay.lose = null
  await poke()
  await rowOf(desk, 'Bless').waitFor({ state: 'detached', timeout: 20_000 })
}

// =================================================================================================
// 12. The Gamemaster's campaign page, and 13. not others'
// =================================================================================================
part('12. the Gamemaster\'s campaign page')
const gm = await browse({ width: 1280, height: 800, path: GM_PAGE })
const article = gm.page.getByRole('article', { name: TITLE })
const effectsSection = article.locator('section').filter({ has: gm.page.getByRole('heading', { name: "Players' effects" }) })
const ON_WORDS = 'On in Foundry. Your players turn off and delete the effects their party put on their own characters from here, and turn off an item’s temporary effect such as Rage: never one from a monster or one made on the sheet, a condition or a concentration.'
const OFF_WORDS = 'Off. To let them, tick Allow Players to disable & remove their own active effects on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
const SWITCH = 'Allow Players to disable & remove their own active effects'
/** The campaign's own switches in its Foundry settings: "label: value" each. */
async function switches() {
  const details = article.locator('details').filter({ has: gm.page.locator('summary', { hasText: 'Foundry settings' }) })
  if (!(await details.evaluate(el => el.open))) await details.locator('summary').click()
  return details.locator('h4', { hasText: 'This campaign' }).first().locator('xpath=following-sibling::dl[1]/div')
    .evaluateAll(divs => divs.map(div => `${div.querySelector('dt').textContent}: ${div.querySelector('dd').textContent}`))
}
{
  await effectsSection.waitFor({ timeout: 15_000 })
  const said = (await effectsSection.locator('p').allTextContents()).join(' ')
  const order = await article.locator('h3').allTextContents()
  const rows = await switches()
  check(said === ON_WORDS && order.indexOf("Players' effects") === order.indexOf('Cookbook dishes') + 1 && rows.includes(`${SWITCH}: On`),
    `the Gamemaster's campaign page, after Cookbook dishes: "${said}"; its Foundry settings "${SWITCH}: On" (${JSON.stringify(order)})`)
  await shootBoth(gm, 'effects-gm', effectsSection)
}
part('13. not others\'')
{
  const gmSheet = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin` })
  await gmSheet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await effectsTab(gmSheet)
  await rowOf(gmSheet, 'Shield of Faith').waitFor({ timeout: 20_000 })
  const offered = await controlsOf(rowOf(gmSheet, 'Shield of Faith'))
  const posted = await crafted(gmSheet, GM_API, { op: 'enable', id: 'shieldOfFaith' })
  check(offered.names.length === 0 && posted.status === 409 && (await gmSheet.page.getByRole('button', { name: CONTROL }).count()) === 0,
    `at Thorin's page, the Gamemaster has no controls, and an effect posted from it is answered ${posted.status} ${posted.json?.reason}`)
  await gmSheet.view.close()
  const bob = await browse({ width: 390, height: 844, who: BOB, path: '/characters/sheet-vex' })
  const theirs = await crafted(bob, API, { op: 'enable', id: 'shieldOfFaith' })
  check(theirs.status === 404 && fx.shieldOfFaith.disabled === true, `Bob, posting at Thorin's seat, is refused by its route: ${theirs.status}`)
  await bob.view.close()
}
part('12b. the switch off')
{
  await game.settings.set('sending-stone', 'campaigns', [campaign({ effects: false })])
  await until(() => effectsEnabled() === 'f', 'the app to keep effects off', 20_000)
  await until(() => hello()?.data?.features?.effects?.reason === 'off', 'the hello with the switch off, as posted', 10_000).catch(() => {})
  check(same(hello().data.features.effects, { enabled: false, kinds: [], reason: 'off' }), 'the switch off in Foundry, the hello says effects are off')
  await until(async () => (await tabSections(desk).getByRole('button', { name: CONTROL }).count()) === 0
    && (await rowOf(desk, 'Shield of Faith').count()) > 0, "Alice's controls to go", 30_000)
  const offered = await controlsOf(rowOf(desk, 'Shield of Faith'))
  check(offered.names.length === 0, 'within a poll, Alice\'s controls are gone: Shield of Faith, opened, offers none')
  await gm.page.reload()
  await effectsSection.waitFor({ timeout: 15_000 })
  const said = (await effectsSection.locator('p').allTextContents()).join(' ')
  const rows = await switches()
  check(said === OFF_WORDS && rows.includes(`${SWITCH}: Off`), `the Gamemaster's page: "${said}"; its Foundry settings "${SWITCH}: Off"`)
}

// =================================================================================================
// 15. The cog's Help links (item 3)
// =================================================================================================
part('15. the cog\'s help links')
{
  await sheetShown(desk)
  await desk.page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  const settings = desk.page.getByRole('dialog').filter({ has: desk.page.getByRole('link', { name: /^Report a bug/ }) })
  await settings.waitFor({ timeout: 10_000 })
  const links = await settings.getByRole('link').evaluateAll(all => all.map(a => ({ name: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), target: a.target, rel: a.rel })))
  const help = await settings.getByRole('group', { name: 'Help' }).count()
  check(help === 1 && same(links, [
    { name: 'Report a bug (opens in a new tab)', href: 'https://github.com/lambersond/sending-stone-player/issues/new?template=bug_report.yml', target: '_blank', rel: 'noopener noreferrer' },
    { name: 'Request a feature (opens in a new tab)', href: 'https://github.com/lambersond/sending-stone-player/issues/new?template=feature_request.yml', target: '_blank', rel: 'noopener noreferrer' },
  ]), `the cog ends with Help: ${JSON.stringify(links)}`)
  await shootBoth(desk, 'effects-cog-help', settings)
  await desk.page.keyboard.press('Escape')
}
note(`${commands().length} effect commands kept`)
await finish()
