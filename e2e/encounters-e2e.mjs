// Two encounters at once (ROADMAP item 36, module 0.51.0 and the app), end to end, in the world of
// world-030.mjs with scenes and tokens (fvtt/token-core.mjs). Ashlands, on dnd5e 5.3.3, has one
// campaign, Erebor, its players' rolls and attacks on. Alice plays Thorin, with two sidekicks, each
// an owned, linked NPC: Brakka, on the arena with him, and Pip, alone on the den. Bob plays Vex. The
// arena's fight (Goblin 20, Thorin 15, Vex 12, Brakka 10) is under way alone first: the Combat tab
// with no tabs, as before, at 390, 768 and 1280. Then the den's (Wolf 16, Pip 8) is begun and chosen
// for its scene too, while the Gamemaster has the arena up. At 390: a tab for each, "Encounters",
// Thorin's shown, the arena's panel, order and header line; no dot. The den's Next Turn: Pip's tab
// marked with its dot, said "Pip's turn, in another encounter." in its own live region alone, the
// bar's Combat tab and Pip's tab above the sheet marked too. The Combat tab held from the Character
// tab ends Pip's turn in the den, the arena untouched, the toast naming it, and Undo takes it back.
// Pip's tab chosen: its panel, End turn and the header's line; End turn moves the den alone; the
// arrow keys, Home and End between the tabs. Both turns the seat's: the hold ends Thorin's in the
// encounter shown. Pip's initiative, cleared in Foundry, rolled from its tab into the den while the
// Gamemaster has the arena up (module 0.51.0), the arena untouched; its attack's picker lists the
// Wolf, not the Goblin. Bob sees the arena alone (the owner's Q2 A); the Gamemaster at Thorin's page
// sees both tabs; at 1280 the tabs sit in the Combat column, its line following the tab chosen, and
// at 768 in the pane beside the rail. The den unchosen, then chosen again (item 19's rule, read per
// scene); then ended. Screenshots to SHOTS at 390, 768 and 1280, in both themes. SKEW=050: module
// 0.50.0, the same, but Pip's tab offers no initiative into the den, which that module takes only
// where its Gamemaster has it up, and nothing is sent; no screenshots. Synthetic characters only.
// Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
import {
  BASE, BOB, activeScene, browse, character, check, companion, finish, foundryWorld, launch, newCampaign, note, npc,
  part, place, postsOf, same, sceneWorld, settled, shootBoth, sideways, sql, startModule, until, wait,
} from './world-030.mjs'

/** Module 0.50.0, which takes initiative only into the encounter the Gamemaster has up. */
const OLD = process.env.SKEW === '050'
const GAME = 'https://ashlands-encounters.forge-vtt.com'
const ADDRESS = 'ashlands-encounters.forge-vtt.com'
const SECRET = 'erebor-encounters-51'
const TITLE = 'Erebor'
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: ADDRESS, secret: SECRET })
await foundryWorld()
const T = await sceneWorld()
// A checkout's module.json carries its last release's version: the one this release stamps.
game.modules.get('sending-stone').version = OLD ? '0.50.0' : '0.51.0'

// ---- The world: Thorin and Vex, Thorin's two sidekicks, and what they fight ----
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { dex: 2 }, hp: { value: 30, max: 40, temp: 0 } }, { ac: 18, items: [] })
thorin.system.details = { level: 5 }
thorin.system.attributes.init.total = 2
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const goblin = npc('goblin', 'Goblin', 12, { dex: 1 })
const wolf = npc('wolf', 'Wolf', 13, { dex: 2 })
// As dnd5e prepares an actor's initiative (D5 data/actor/templates/attributes.mjs): its modifier.
const brakka = companion('brakka', 'Brakka', {
  owners: ['alice'], linked: true, ac: 14,
  npc: { spec: { mods: { dex: 1 }, hp: { value: 30, max: 30, temp: 0 } }, system: { attributes: { movement: { walk: 30, units: 'ft' }, init: { total: 1 } } } },
})
const pip = companion('pip', 'Pip', {
  owners: ['alice'], linked: true, ac: 13,
  gear: { items: [{
    id: 'bite', name: 'Bite', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{ id: 'nip', attack: { ability: 'dex' }, damage: [{ number: 1, denomination: 4, bonus: '@mod', types: ['piercing'] }], labels: { modifier: '+4', damage: [{ formula: '1d4 + 2', damageType: 'piercing', label: '1d4 + 2 Piercing' }] } }],
  }] },
  npc: { spec: { mods: { dex: 2 }, prof: 2, hp: { value: 11, max: 11, temp: 0 } }, system: { attributes: { movement: { walk: 30, units: 'ft' }, init: { total: 2 } } } },
})
const arena = await activeScene('arena')
const den = T.scene('den', { name: 'den' })
const tokens = {}
for (const actor of [thorin, vex, goblin, brakka]) tokens[actor.id] = await place(arena, actor, { id: `tok-${actor.id}`, actorLink: true, tell: false })
for (const actor of [wolf, pip]) tokens[actor.id] = await place(den, actor, { id: `tok-${actor.id}`, actorLink: true, tell: false })
await startModule({ campaigns: [{ id: 'erebor', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true, attacks: true }], secrets: { erebor: SECRET } })
await settled()

// ---- The arena's fight, under way alone: the Goblin's turn; the Gamemaster has it up ----
const fight = T.combatOf('fight', [
  { id: 'cbGoblin', actor: goblin, token: tokens.goblin, fields: { name: 'Goblin', initiative: 20 } },
  { id: 'cbThorin', actor: thorin, token: tokens.thorin, fields: { name: 'Thorin', initiative: 15 } },
  { id: 'cbVex', actor: vex, token: tokens.vex, fields: { name: 'Vex', initiative: 12 } },
  { id: 'cbBrakka', actor: brakka, token: tokens.brakka, fields: { name: 'Brakka', initiative: 10 } },
])
fight._source.scene = 'arena'
fight.round = 1
fight.turn = 0
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight') ?? null, configurable: true })
await Hooks.callAll('createCombat', fight)
const rows = () => Number(sql(`select count(*) from combat where "campaignId" = '${A}'`))
await until(() => rows() === 1, 'the app to hear of the arena’s fight', 15_000)

/** A fight as the app keeps it: its round, whose turn, whether chosen and begun, and initiatives. */
const stored = id => JSON.parse(sql(`select json_build_object('round', data->'round', 'combatantId', data->'combatantId', 'active', data->'active', 'started', data->'started', 'initiatives', (select json_object_agg(c->>'id', c->'initiative') from jsonb_array_elements(data->'combatants') c))::text from combat where "combatId" = '${id}' and "campaignId" = '${A}'`) || 'null')

// ---- The pages: Alice's at 390, 768 and 1280 ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const PAGE = '/characters/sheet-thorin'
/** A page of Thorin's, or `path`, on a phone, a tablet or a computer, its sheet drawn. */
async function open(width, height, path = PAGE, who) {
  const mobile = width < 1024
  const device = { viewport: { width, height }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile }
  const seat = await browse({ width, height, toasts: false, device, ...(who && { who }) })
  await seat.page.goto(`${BASE}${path}`)
  await seat.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 25_000 })
  return seat
}
/** The combat pane shown: the column's Combat tab on a wide screen, else the bar's or rail's. */
async function combatShown(seat) {
  if (seat.width >= 1024) {
    const tab = seat.page.getByRole('tablist', { name: 'Combat or chat' }).getByRole('tab', { name: /^Combat/ })
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click()
  } else await seat.nav.getByRole('button', { name: /^Combat/ }).click()
}
const encounterTabs = seat => seat.page.getByRole('tablist', { name: 'Encounters' })
/** The encounters' tab panel in the combat pane, which holds the turn and the order. */
const panelOf = seat => seat.page.locator('#combat-pane [role="tabpanel"]')
const encounterTab = (seat, name) => encounterTabs(seat).getByRole('tab', { name })
/** Each encounter's tab, by its name, "[shown]" after the one shown, "•" after one with its dot. */
const tabsOf = async seat => (await encounterTabs(seat).count()) === 0 ? [] : encounterTabs(seat).getByRole('tab').evaluateAll(tabs => tabs.map(tab =>
  `${tab.getAttribute('aria-label')}${tab.getAttribute('aria-selected') === 'true' ? ' [shown]' : ''}${tab.querySelector('span[aria-hidden="true"].rounded-full') ? ' •' : ''}`))
const tabsAre = async (seat, want) => same(await tabsOf(seat), want)
const heading = seat => seat.page.locator('#turn-heading').first().textContent({ timeout: 5_000 }).catch(() => null)
const header = seat => seat.page.locator('header').first().innerText().catch(() => '')
/** The column's line beside its Combat and Chat tabs, on a wide screen. */
const columnLine = seat => seat.page.getByRole('tablist', { name: 'Combat or chat' }).locator('xpath=following-sibling::span[1]').textContent()
/** The names in the initiative order shown. */
const order = seat => seat.page.locator('#combat-pane ol > li').evaluateAll(items => items.map(item => item.querySelector('span.truncate')?.textContent?.trim() ?? ''))
const switcherTab = (seat, name) => seat.page.getByRole('tablist', { name: 'Character and companions' }).getByRole('tab', { name })
const barCombat = seat => seat.nav.getByRole('button', { name: /^Combat/ })
/** What an element is described as, by its aria-describedby. */
const described = locator => locator.evaluate(el => {
  const id = el.getAttribute('aria-describedby')
  return id ? document.getElementById(id)?.textContent ?? '' : ''
})
/**
 * Every line said in the combat pane's two live regions since, and the turn toast's words, as they
 * come: kept on the page, since each region clears itself once said.
 */
const listen = seat => seat.page.evaluate(() => {
  globalThis.__said = []
  globalThis.__toasts = []
  for (const [index, region] of [...document.querySelectorAll('#combat-pane p[aria-live="polite"]')].entries()) {
    new MutationObserver(() => {
      const line = region.textContent
      if (line && globalThis.__said.at(-1)?.join('|') !== `${index}|${line}`) globalThis.__said.push([index, line])
    })
      .observe(region, { childList: true, characterData: true, subtree: true })
  }
  new MutationObserver(() => {
    const words = document.querySelector('[data-turn-toast] p')?.firstChild?.textContent
    if (words && globalThis.__toasts.at(-1) !== words) globalThis.__toasts.push(words)
  }).observe(document.body, { childList: true, characterData: true, subtree: true })
})
const said = seat => seat.page.evaluate(() => globalThis.__said)
const toasted = seat => seat.page.evaluate(() => globalThis.__toasts)
const toastText = seat => seat.page.locator('[data-turn-toast]').innerText().catch(() => '')
/** Shots of each seat in both themes, as `name`. */
async function shots(name, seats) {
  for (const seat of seats) await shootBoth(seat, `encounters-${name}`)
}

const phone = await open(390, 844)
const tablet = await open(768, 1024)
const desk = await open(1280, 800)
const seats = [phone, tablet, desk]

// ---- 0. One encounter, as before ----
part('0. one encounter, as before')
for (const seat of seats) await combatShown(seat)
await until(async () => (await heading(phone)) === 'Goblin is acting' && (await heading(tablet)) === 'Goblin is acting' && (await heading(desk)) === 'Goblin is acting', 'the arena’s turn at each width', 20_000)
{
  const tabs = await Promise.all(seats.map(seat => encounterTabs(seat).count()))
  const panels = await Promise.all(seats.map(seat => panelOf(seat).count()))
  check(tabs.every(count => count === 0) && panels.every(count => count === 0),
    `with one encounter under way, no tabs and no tab panel at 390, 768 or 1280, as before (${tabs}, ${panels})`)
  check((await header(phone)).includes('Round 1 · Goblin’s turn') && (await columnLine(desk)) === 'Round 1 · Goblin’s turn',
    `the header's line at 390 and the column's at 1280 read the arena's turn (${(await header(phone)).replaceAll('\n', ' | ')}; ${await columnLine(desk)})`)
}
await shots('one', seats)

// ---- The den's fight, begun and chosen for its scene too: the Wolf's turn ----
const denFight = T.combatOf('denfight', [
  { id: 'cbWolf', actor: wolf, token: tokens.wolf, fields: { name: 'Wolf', initiative: 16 } },
  { id: 'cbPip', actor: pip, token: tokens.pip, fields: { name: 'Pip', initiative: 8 } },
])
denFight._source.scene = 'den'
denFight.round = 1
denFight.turn = 0
await Hooks.callAll('createCombat', denFight)
await until(() => rows() === 2, 'the app to hear of the den’s fight', 15_000)
check(same([stored('fight').active, stored('fight').started, stored('denfight').active, stored('denfight').started], [true, true, true, true]),
  `both fights reach the app begun and chosen for their scenes, the Gamemaster with the arena's up (${JSON.stringify([stored('fight'), stored('denfight')])})`)

// ---- 1. A tab for each ----
part('1. a tab for each')
await until(() => tabsAre(phone, ['Thorin, round 1 [shown]', 'Pip, round 1']), 'the encounters’ tabs at 390', 20_000)
  .catch(async e => { note(`tabs: ${JSON.stringify(await tabsOf(phone))}`); throw e })
check(true, 'at 390, a tab row "Encounters": "Thorin, round 1" shown, "Pip, round 1", neither with a dot')
check((await heading(phone)) === 'Goblin is acting' && same(await order(phone), ['Goblin', 'Thorin', 'Vex', 'Brakka']),
  `the panel and the order are the arena's: "${await heading(phone)}", ${JSON.stringify(await order(phone))}`)
check((await header(phone)).includes('Round 1 · Goblin’s turn') && !/your turn/.test(await barCombat(phone).textContent()),
  `the header reads "Round 1 · Goblin’s turn", and the bar's Combat tab has no dot (${await barCombat(phone).textContent()})`)
check(await panelOf(phone).getAttribute('aria-labelledby') === 'encounter-tab-fight',
  'one tab panel, labelled by the arena’s tab, holds the turn and the order')
check((await sideways(phone.page)) === 0, `no sideways scroll at 390 with the tabs (${await sideways(phone.page)})`)
await until(async () => (await tabsOf(tablet)).length === 2 && (await tabsOf(desk)).length === 2, 'the tabs at 768 and 1280', 20_000)
await shots('two', seats)

// ---- 2. Pip's turn, in the other encounter ----
part('2. pip’s turn in the den')
await listen(phone)
const advancedBefore = { arena: fight.advances, den: denFight.advances }
await denFight.nextTurn()
await until(() => stored('denfight').combatantId === 'cbPip', 'the app to hear of Pip’s turn', 15_000)
await until(() => tabsAre(phone, ['Thorin, round 1 [shown]', 'Pip, round 1, Pip’s turn •']), 'Pip’s tab marked', 20_000)
  .catch(async e => { note(`tabs: ${JSON.stringify(await tabsOf(phone))}`); throw e })
check(true, 'Pip’s tab reads "Pip, round 1, Pip’s turn" with its dot; Thorin’s is still the one shown')
check((await heading(phone)) === 'Goblin is acting' && (await header(phone)).includes('Round 1 · Goblin’s turn'),
  `the panel and the header stay the arena's (${await heading(phone)})`)
await until(async () => (await said(phone)).length > 0, 'the live region to speak', 10_000)
await wait(1500)
check(same(await said(phone), [[1, 'Pip’s turn, in another encounter.']]),
  `the second live region alone says "Pip’s turn, in another encounter.", the first nothing (${JSON.stringify(await said(phone))})`)
await until(async () => (await tabsOf(desk))[1] === 'Pip, round 1, Pip’s turn •' && (await tabsOf(tablet))[1] === 'Pip, round 1, Pip’s turn •', 'the dot at 768 and 1280', 15_000)
check(true, 'at 768 and 1280 too, Pip’s tab has its dot')
await shots('dot', seats)
await phone.character()
await until(async () => /your turn/.test(await barCombat(phone).textContent()), 'the bar’s Combat tab marked', 10_000)
check(true, 'on the Character tab, the bar’s Combat tab is marked for Pip’s turn in the den')
check(await switcherTab(phone, /^Pip/).getAttribute('aria-label') === 'Pip, its turn',
  `and Pip's tab above the sheet is named "${await switcherTab(phone, /^Pip/).getAttribute('aria-label')}"`)
await shootBoth(phone, 'encounters-switcher', phone.page.getByRole('tablist', { name: 'Character and companions' }))

// ---- 3. The hold from the Character tab ends Pip's turn in the den, and Undo takes it back ----
part('3. the hold ends pip’s turn')
await until(async () => (await described(barCombat(phone))) !== '', 'the hold offered on Pip’s turn', 10_000)
check((await described(barCombat(phone))) === 'Press and hold to end Pip’s turn', `the bar's Combat tab is described "${await described(barCombat(phone))}"`)
const heldFrom = { arena: fight.advances, den: denFight.advances }
await phone.hold(barCombat(phone), 1300)
await until(() => stored('denfight').combatantId === 'cbWolf', 'the den to move on to the Wolf', 15_000)
check(denFight.advances === heldFrom.den + 1 && fight.advances === heldFrom.arena && stored('fight').combatantId === 'cbGoblin',
  `the den moves on once, to the Wolf; the arena doesn't, the Goblin still acting (den ${denFight.advances - heldFrom.den}, arena ${fight.advances - heldFrom.arena})`)
await until(async () => (await toastText(phone)).includes('Pip’s turn has ended.'), 'the toast to say Pip’s turn ended', 15_000)
check((await toasted(phone))[0] === 'Ending Pip’s turn…' && (await toastText(phone)).includes('Wolf is acting.'),
  `the toast says "Ending Pip's turn…", then "Pip's turn has ended." and "Wolf is acting." (${JSON.stringify(await toasted(phone))})`)
await phone.page.locator('[data-turn-toast]').getByRole('button', { name: 'Undo' }).click()
await until(() => stored('denfight').combatantId === 'cbPip', 'Undo to put the den back on Pip', 15_000)
check(stored('fight').combatantId === 'cbGoblin', 'Undo puts the den back on Pip’s turn, the arena still the Goblin’s')
note(`advances since part 2: arena ${fight.advances - advancedBefore.arena}, den ${denFight.advances - advancedBefore.den}`)

// ---- 4. Pip's tab chosen ----
part('4. pip’s tab')
await combatShown(phone)
await encounterTab(phone, /^Pip/).click()
await until(async () => (await heading(phone)) === 'Pip’s turn', 'Pip’s panel', 10_000)
check((await header(phone)).includes('Round 1 · Pip’s turn') && await phone.page.getByRole('button', { name: 'End turn' }).isVisible(),
  `Pip's tab shows its turn, with End turn, and the header reads "Round 1 · Pip’s turn" (${(await header(phone)).replaceAll('\n', ' | ')})`)
check(await panelOf(phone).getAttribute('aria-labelledby') === 'encounter-tab-denfight' && same(await order(phone), ['Wolf', 'Pip']),
  `the panel, labelled by Pip's tab, holds the den's order (${JSON.stringify(await order(phone))})`)
for (const seat of [tablet, desk]) await encounterTab(seat, /^Pip/).click()
await shots('den', seats)
for (const seat of [tablet, desk]) await encounterTab(seat, /^Thorin/).click()
const pressedFrom = { arena: fight.advances, den: denFight.advances }
await phone.page.getByRole('button', { name: 'End turn' }).click()
await until(() => stored('denfight').combatantId === 'cbWolf', 'End turn to move the den on', 15_000)
check(denFight.advances === pressedFrom.den + 1 && fight.advances === pressedFrom.arena && stored('fight').combatantId === 'cbGoblin',
  'End turn in the den’s panel moves the den on, to round 2 and the Wolf; the arena is untouched')
// The keyboard: focus moves first, then the tab is shown.
const focused = () => phone.page.evaluate(() => document.activeElement?.id)
const selected = async () => encounterTabs(phone).getByRole('tab', { selected: true }).getAttribute('id')
await encounterTabs(phone).getByRole('tab', { selected: true }).focus()
const steps = []
for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'ArrowRight']) {
  await phone.page.keyboard.press(key)
  await wait(200)
  steps.push(`${key}:${await focused()}/${await selected()}`)
}
check(same(steps, [
  'ArrowLeft:encounter-tab-fight/encounter-tab-fight', 'ArrowRight:encounter-tab-denfight/encounter-tab-denfight',
  'Home:encounter-tab-fight/encounter-tab-fight', 'End:encounter-tab-denfight/encounter-tab-denfight',
  'ArrowRight:encounter-tab-fight/encounter-tab-fight',
]), `ArrowLeft, ArrowRight, Home and End move focus and the choice between the tabs, wrapping (${steps.join(', ')})`)

// ---- 5. Both turns the seat's: the hold ends the one in the encounter shown ----
part('5. both turns the seat’s')
await denFight.setTurn(2, 1)
await fight.nextTurn()
await until(() => stored('denfight').combatantId === 'cbPip' && stored('fight').combatantId === 'cbThorin', 'Pip’s turn and Thorin’s', 15_000)
await until(async () => (await heading(phone)) === 'Your turn', 'Thorin’s turn in the arena, shown', 15_000)
// The hold is offered a moment after the turn shows, as End turn is.
await until(async () => (await described(barCombat(phone))) !== '', 'the hold offered on Thorin’s turn', 10_000)
check((await selected()) === 'encounter-tab-fight' && (await described(barCombat(phone))) === 'Press and hold to end your turn',
  `with Thorin's tab shown, the bar's Combat tab is described "${await described(barCombat(phone))}"`)
await phone.page.evaluate(() => { globalThis.__toasts = [] })
const bothFrom = { arena: fight.advances, den: denFight.advances }
await phone.hold(barCombat(phone), 1300)
await until(() => stored('fight').combatantId === 'cbVex', 'the arena to move on to Vex', 15_000)
check(fight.advances === bothFrom.arena + 1 && denFight.advances === bothFrom.den && stored('denfight').combatantId === 'cbPip',
  'the hold ends Thorin’s turn in the arena, Vex acting; the den’s isn’t, Pip still acting')
await until(async () => (await toasted(phone)).length > 0, 'the toast', 10_000)
check((await toasted(phone))[0] === 'Ending your turn…', `the toast says "Ending your turn…" (${JSON.stringify(await toasted(phone))})`)

// ---- 6. Pip's initiative into the den, begun, while the Gamemaster has the arena up ----
part('6. pip’s initiative into the den')
await denFight.setInitiative(denFight.combatants.get('cbPip'), null)
await until(() => stored('denfight').initiatives.cbPip === null, 'the app to hear Pip’s initiative cleared', 15_000)
// The Gamemaster, back on the arena, sets its Goblin's initiative again: the arena is the fight the
// app heard of last, the one an app before item 36 showed, and offered initiative into.
await fight.setInitiative(fight.combatants.get('cbGoblin'), 20)
const heardLast = () => sql(`select "combatId" from combat where "campaignId" = '${A}' order by "updatedAt" desc limit 1`)
await until(() => heardLast() === 'fight', 'the app to hear of the arena last', 15_000)
const initiativeRows = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and kind = 'initiative'`))
const rolledFrom = initiativeRows()
const arenaUntouched = () => same(['cbGoblin', 'cbThorin', 'cbVex', 'cbBrakka'].map(id => fight.combatants.get(id).initiative), [20, 15, 12, 10])
/** The next answer to a seat's poll of Pip's pane; with `test`, the next whose view passes it. */
const pipPolled = (seat, test) => seat.page.waitForResponse(async response => {
  if (response.request().method() !== 'GET' || !new URL(response.url()).pathname.endsWith('/companions/pip/table')) return false
  if (!test) return true
  const view = await response.json().catch(() => undefined)
  return Boolean(view && test(view))
}, { timeout: 45_000 })
await phone.character()
const tile = phone.page.getByRole('button', { name: /^Initiative, \+2/ }).filter({ visible: true }).first()
if (OLD) {
  // Module 0.50.0 takes initiative only into the encounter its Gamemaster has up, which the app can't
  // see: so it's offered only into the fight heard of last, as v0.50.0 offered it, and Pip isn't in
  // that one. Read once the pane has drawn a view with Pip's initiative cleared: the poll that brings
  // it, then the next.
  const cleared = pipPolled(phone, view => view.combat?.id === 'denfight' && view.combat.combatants.some(({ id, initiative }) => id === 'cbPip' && initiative === null))
  await switcherTab(phone, /^Pip/).click()
  await cleared
  await pipPolled(phone)
  const offered = await phone.page.getByRole('button', { name: /^Initiative, \+2, to roll for the combat/ }).filter({ visible: true }).count()
  const plain = await phone.page.getByRole('button', { name: 'Initiative, +2', exact: true }).filter({ visible: true }).count()
  check(offered === 0 && plain === 1,
    `with module 0.50.0, Pip's tab above the sheet offers no initiative into the den, its own encounter: "Initiative, +2" alone (${JSON.stringify({ offered, plain })})`)
} else {
  await switcherTab(phone, /^Pip/).click()
  await until(async () => (await tile.getAttribute('aria-label').catch(() => null))?.includes('to roll for the combat'), 'Pip’s Initiative tile to offer the roll', 20_000)
    .catch(async e => { note(`tile: ${await tile.getAttribute('aria-label').catch(() => 'none')}`); throw e })
  check(true, `Pip's tab above the sheet offers its initiative for its own encounter: "${await tile.getAttribute('aria-label')}"`)
}
for (const seat of [tablet, desk]) {
  if (seat.width < 1024) await seat.character()
  await switcherTab(seat, /^Pip/).click()
}
await shots('pip', seats)
if (OLD) {
  check(initiativeRows() === rolledFrom && denFight.combatants.get('cbPip').initiative === null && arenaUntouched(),
    `nothing is sent to the game: no initiative asked of it, the den's Pip still unrolled, the arena's untouched (${initiativeRows() - rolledFrom} sent)`)
} else {
  await tile.click()
  await until(() => initiativeRows() > rolledFrom, 'Pip’s initiative sent', 15_000)
  const rolled = () => JSON.parse(sql(`select row_to_json(r)::text from (select id, status, "actorId", payload, result from roll_request where "campaignId" = '${A}' and kind = 'initiative' order by "createdAt" desc limit 1) r`))
  await until(() => ['done', 'failed'].includes(rolled().status), 'the game’s answer to Pip’s initiative', 30_000)
  await until(() => stored('denfight').initiatives.cbPip !== null, 'the app to hear Pip’s initiative', 15_000)
  check(rolled().status === 'done' && rolled().payload?.combatId === 'denfight' && denFight.combatants.get('cbPip').initiative !== null && arenaUntouched(),
    `module 0.51.0 rolls it into the den, Pip ${denFight.combatants.get('cbPip').initiative}, the arena's untouched (${rolled().status}, for ${rolled().payload?.combatId})`)
}
// Its attacks are on its sheet's Actions tab.
await phone.page.locator('#creature-pip-sheet-tab-actions').click()
await phone.page.locator('#creature-panel-pip').getByRole('button', { name: /^Bite attack/ }).click()
const picker = phone.page.getByRole('dialog', { name: 'Bite attack' })
await picker.waitFor({ timeout: 10_000 })
check(await picker.getByRole('button', { name: /^Wolf/ }).count() === 1 && await picker.getByRole('button', { name: /^Goblin/ }).count() === 0,
  `Pip's attack's picker lists the Wolf, not the Goblin (${(await picker.innerText()).replaceAll('\n', ' | ').slice(0, 160)})`)
await phone.page.keyboard.press('Escape')
await picker.waitFor({ state: 'detached' })

// ---- 7. Bob, with none of his in the den: the arena alone ----
part('7. bob')
const bob = await browse({ width: 390, height: 844, who: BOB, toasts: false, device: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await combatShown(bob)
await until(async () => (await heading(bob)) === 'Your turn', 'Vex’s turn on Bob’s page', 20_000)
check((await encounterTabs(bob).count()) === 0 && same(await order(bob), ['Goblin', 'Thorin', 'Vex', 'Brakka']),
  `Bob, none of whose creatures is in the den, sees no tabs and the arena alone (${JSON.stringify(await order(bob))})`)

// ---- 8. The Gamemaster at Thorin's page ----
part('8. the gamemaster’s seat')
const gm = await open(390, 844, `/campaigns/${A}/characters/thorin`)
await combatShown(gm)
await until(async () => (await tabsOf(gm)).length === 2, 'the tabs at the Gamemaster’s seat', 20_000)
check(same((await tabsOf(gm)).map(name => name.split(',')[0]), ['Thorin', 'Pip']), `the Gamemaster at Thorin's page sees the same two tabs (${JSON.stringify(await tabsOf(gm))})`)
await gm.view.close()

// ---- 9. The column at 1280, and the pane beside the rail at 768 ----
part('9. 1280 and 768')
for (const seat of [tablet, desk]) await combatShown(seat)
await until(async () => (await tabsOf(desk)).length === 2, 'the tabs in the Combat column', 15_000)
check(await desk.page.locator('#combat-pane').getByRole('tablist', { name: 'Encounters' }).isVisible() && (await columnLine(desk)) === 'Round 1 · Vex’s turn',
  `at 1280 the tabs sit at the top of the Combat column, its line the arena's: "${await columnLine(desk)}"`)
await encounterTab(desk, /^Pip/).click()
await until(async () => (await columnLine(desk)) === 'Round 2 · Pip’s turn', 'the column’s line to follow the tab', 10_000)
check(true, 'and its line follows the tab chosen: "Round 2 · Pip’s turn"')
await shots('column', [desk])
await encounterTab(desk, /^Thorin/).click()
await until(async () => (await columnLine(desk)) === 'Round 1 · Vex’s turn', 'the column’s line back on the arena', 10_000)
check((await tabsOf(tablet)).length === 2 && (await sideways(tablet.page)) === 0, `at 768, beside the rail, the same two tabs, with no sideways scroll (${await sideways(tablet.page)})`)

// ---- 10. The den unchosen, then chosen again ----
part('10. the den unchosen')
await combatShown(phone)
await encounterTab(phone, /^Thorin/).click()
denFight.active = false
await Hooks.callAll('updateCombat', denFight, { active: false }, {}, 'gm')
await until(() => stored('denfight').active === false, 'the app to hear the den unchosen', 15_000)
await until(async () => (await encounterTabs(phone).count()) === 0, 'the den’s tab to go', 20_000)
check((await heading(phone)) === 'Vex is acting' && (await panelOf(phone).count()) === 0,
  `the den no longer its scene's chosen encounter, its tab goes and the arena shows alone (${await heading(phone)})`)
denFight.active = true
await Hooks.callAll('updateCombat', denFight, { active: true }, {}, 'gm')
await until(async () => (await tabsOf(phone)).length === 2, 'the tabs back', 20_000)
check((await tabsOf(phone))[0].startsWith('Thorin') && (await tabsOf(phone))[0].includes('[shown]'), `chosen again, the tabs return with Thorin's still shown (${JSON.stringify(await tabsOf(phone))})`)

// ---- 11. The den's fight ended ----
part('11. the den ended')
game.combats.delete('denfight')
await Hooks.callAll('deleteCombat', denFight)
await until(() => rows() === 1, 'the den’s fight to end in the app', 15_000)
await until(async () => (await encounterTabs(phone).count()) === 0, 'the tabs to go', 20_000)
check((await heading(phone)) === 'Vex is acting' && same(await order(phone), ['Goblin', 'Thorin', 'Vex', 'Brakka']),
  'the den’s fight ended, the tabs go and the arena shows alone')
note(`${postsOf('combat.turn').length} turn events posted`)
await finish()
