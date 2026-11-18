// Other creatures' health on the Combat tab (module 0.50.0 and the app, ROADMAP item 58), end to
// end, in the world of world-030.mjs with scenes and tokens (fvtt/token-core.mjs). Ashlands, on
// dnd5e 5.3.3, has one campaign, Erebor, saved without the two switches, so both read off, its
// players' rolls off. Alice plays Thorin, 30 of 30, at 1280 × 800 and on a phone at 390 × 844; the
// Gamemaster is at Thorin's page and on the campaigns page. The fight, under way: a Goblin, Hostile,
// 10 of 10; an Ogre, Neutral, 59 of 59; a Wolf, Friendly and no one's, 11 of 11; a Bandit whose token
// is Secret, 11 of 11; a Scout whose token is hidden, 9 of 9; and the Lurker, a hidden combatant.
// The hello and the app's answer, both switches off; the switch on within a poll, Unhurt for the
// three shown and nothing for the rest; the Goblin's fall, Hurt, Bloodied and Down within seconds
// with no turn, then Defeated with no word; the posts counted, one for a new band and none in the
// same one; their hit points with the second switch; Gamemaster-only details, hit points off, then
// on, and never the Bandit's, the Scout's or the Lurker's in what the pages' own requests receive,
// read from every response at both seats, not only from what they show; the turn panel on the
// Ogre's turn; the Gamemaster at Thorin's page; Thorin's own hit points between turns (the owner's
// Q3 A); Help's part and row; the campaign card; and the Combat tab and the turn panel with each
// switch at 390 and 1280, in both themes. DND5E6=1: on dnd5e 6.0.5, each creature's own Bloodied
// percent, the Goblin's 25 as an effect would make it: 4 of 10 Hurt, 2 of 10 Bloodied. SKEW=049:
// module 0.49.0, which says nothing of health: no word, no other creature's numbers with
// Gamemaster-only details on, in what is shown or received, Help "Not shown", and the card naming
// 0.50.0. Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BASE, DND5E6, activeScene, browse, character, check, companion, finish, foundryWorld, launch, newCampaign, note, part,
  place, postsOf, same, sceneWorld, settled, shootBoth, sideways, sql, startModule, until, wait,
} from './world-030.mjs'
import { combat, combatant } from './fvtt/stub.mjs'

/** Module 0.49.0, before other creatures' health. */
const OLD = process.env.SKEW === '049'
const GAME = 'https://ashlands-health.forge-vtt.com'
const ADDRESS = 'ashlands-health.forge-vtt.com'
const SECRET = 'erebor-health-50'
const TITLE = 'Erebor'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: ADDRESS, secret: SECRET })
await foundryWorld({ dice6: DND5E6 })
const T = await sceneWorld()
// A checkout's module.json carries its last release's version: the one this release stamps.
game.modules.get('sending-stone').version = OLD ? '0.49.0' : '0.50.0'
// dnd5e's Bloodied threshold, as each release configures it: a fraction in 5, a percent in 6.
CONFIG.DND5E.bloodied = { threshold: DND5E6 ? 50 : 0.5 }

// ---- The world: Thorin, Alice's, and the creatures he fights ----
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { dex: 2 }, hp: { value: 30, max: 30, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
game.users.get('alice').character = thorin
/** A creature no player owns, its hit points as dnd5e prepares them; under dnd5e 6 its own Bloodied percent. */
const creature = (id, name, max, bloodied = 50) => {
  const made = companion(id, name, { owners: [], linked: true, ac: 12, npc: { spec: { hp: { value: max, max, temp: 0 } } } })
  if (DND5E6) made.system.attributes.hp.bloodied = bloodied
  return made
}
// The Goblin's Bloodied at 25 percent under dnd5e 6, as an effect would make it.
const goblin = creature('goblin', 'Goblin', 10, 25)
const ogre = creature('ogre', 'Ogre', 59)
const wolf = creature('wolf', 'Wolf', 11)
const bandit = creature('bandit', 'Bandit', 11)
const scout = creature('scout', 'Scout', 9)
const lurker = creature('lurker', 'Lurker', 14)
const { SECRET: SECRET_TOKEN, HOSTILE, NEUTRAL, FRIENDLY } = CONST.TOKEN_DISPOSITIONS
const arena = await activeScene('arena')
/** A token on the arena, linked, with its disposition; `hidden` from players. */
async function token(actor, disposition, hidden = false) {
  const made = await place(arena, actor, { id: `tok-${actor.id}`, actorLink: true, tell: false, hidden })
  made.disposition = disposition
  return made
}
const tokens = {
  thorin: await token(thorin, FRIENDLY), goblin: await token(goblin, HOSTILE), ogre: await token(ogre, NEUTRAL),
  wolf: await token(wolf, FRIENDLY), bandit: await token(bandit, SECRET_TOKEN), scout: await token(scout, HOSTILE, true),
  lurker: await token(lurker, HOSTILE),
}
// Saved before 0.50.0: neither switch, so both read off; the players' rolls off. SKEW=049 saves the
// first on, which module 0.49.0 knows nothing of.
const campaign = changes => ({ id: 'erebor', title: TITLE, characters: ['thorin'], groups: [], rolls: false, ...(OLD && { health: true }), ...changes })
await startModule({ campaigns: [campaign()], secrets: { erebor: SECRET } })
await settled()

// ---- The fight, under way: the Goblin's turn ----
const fight = combat('fight')
const join = (id, actor, initiative, fields = {}) => combatant(fight, id, actor, { name: actor.name, initiative, token: tokens[actor.id], tokenId: tokens[actor.id].id, ...fields })
join('cbGoblin', goblin, 18)
join('cbThorin', thorin, 16)
join('cbOgre', ogre, 14)
join('cbWolf', wolf, 12)
join('cbBandit', bandit, 10)
join('cbScout', scout, 8)
join('cbLurker', lurker, 5, { hidden: true })
fight.getCombatantsByActor = actor => fight.combatants.filter(each => each.actor?.id === actor.id)
fight.started = true
fight.round = 1
fight.turn = 0
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql(`select count(*) from combat where "campaignId" = '${A}'`) === '1', 'the app to hear of the fight', 15_000)

// ---- What's kept, posted and received ----
/** The campaign's last hello, as posted, with the app's answer. */
const hello = () => postsOf('bridge.hello').filter(p => p.campaign === 'erebor').at(-1)
const kept = column => sql(`select ${column} from campaign where id = '${A}'`)
/** Save Erebor with these switches, as the settings window does: the module says its hello again. */
async function switches(changes, what) {
  const from = postsOf('bridge.hello').length
  await game.settings.set('sending-stone', 'campaigns', [campaign(changes)])
  await until(() => postsOf('bridge.hello').length > from && hello().body !== undefined, `the hello after ${what}`, 15_000)
}
/** Gamemaster-only details on or off, as the world's setting saved: the hello again. */
async function gmDetails(on) {
  const from = postsOf('bridge.hello').length
  await game.settings.set('sending-stone', 'gmContent', on)
  await until(() => postsOf('bridge.hello').length > from, `the hello with Gamemaster-only details ${on ? 'on' : 'off'}`, 15_000)
}
/** Set a creature's hit points as Foundry does: written, then `updateActor`. */
const hitPointsTo = (actor, value) => T.changeActor(actor, { system: { attributes: { hp: { value } } } })
/** Each combatant.updated posted for one of Erebor's combatants. */
const updatesOf = id => postsOf('combat.combatant.updated').filter(p => (p.campaign === 'erebor') && (p.data?.combatant?.id === id))
/** Whose turn it is, as Foundry moves it: the turn written, then `combatTurnChange`. */
async function turnTo(id) {
  const prior = { round: fight.round, turn: fight.turn, combatantId: fight.combatant?.id }
  fight.turn = fight.turns.findIndex(each => each.id === id)
  await Hooks.callAll('combatTurnChange', fight, prior, { round: fight.round, turn: fight.turn, combatantId: id })
}

/**
 * Each object in a response's text that is a combatant's, by its id: JSON, or the page's own payload
 * in its HTML, its quotes escaped. From the object's opening brace to its matching close.
 */
function combatantsIn(text, id) {
  const plain = text.replaceAll('\\"', '"')
  const found = []
  const key = `"id":"${id}"`
  for (let at = plain.indexOf(key); at !== -1; at = plain.indexOf(key, at + 1)) {
    let depth = 0
    let start = -1
    for (let i = at; i >= 0; i--) {
      if (plain[i] === '}') depth++
      else if (plain[i] === '{') {
        if (depth === 0) { start = i; break }
        depth--
      }
    }
    let end = plain.length
    depth = 0
    for (let i = start; i < plain.length; i++) {
      if (plain[i] === '{') depth++
      else if (plain[i] === '}' && --depth === 0) { end = i + 1; break }
    }
    if (start !== -1) found.push(plain.slice(start, end))
  }
  return found
}
/**
 * What a page's own requests received that its seat may not see: the Lurker at all; the Bandit's
 * or the Scout's health or hit points; and, unless their hit points show, any other creature's.
 */
function leaksIn(bodies, numbersShown) {
  const leaks = []
  for (const body of bodies) {
    if (body.includes('cbLurker')) leaks.push('the Lurker')
    for (const id of ['cbBandit', 'cbScout']) {
      if (combatantsIn(body, id).some(object => /"(hp|health)":/.test(object))) leaks.push(`${id}'s health or hit points`)
    }
    for (const id of ['cbGoblin', 'cbOgre', 'cbWolf']) {
      if (!numbersShown && combatantsIn(body, id).some(object => /"hp":/.test(object))) leaks.push(`${id}'s hit points`)
    }
  }
  return [...new Set(leaks)]
}
/** The bodies a page received since `from`, that name the fight's Ogre: the views it was sent. */
const viewsSince = (who, from) => who.bodies.slice(from).filter(body => body.includes('cbOgre'))

// ---- The pages ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const PLAYER_PAGE = '/characters/sheet-thorin'
const GM_SEAT = `/campaigns/${A}/characters/thorin`
const GM_PAGE = `/campaigns?campaign=${A}`
/** A page in a browser of its own, every response from the app it receives kept as text. */
async function open(width, height, path) {
  const who = await browse({ width, height, toasts: false })
  who.bodies = []
  who.page.on('response', async response => {
    if (!response.url().startsWith(BASE)) return
    const type = response.headers()['content-type'] ?? ''
    if (!/json|html|x-component|text\/plain/.test(type)) return
    try { who.bodies.push(await response.text()) } catch {}
  })
  await who.page.goto(`${BASE}${path}`)
  await who.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  return who
}
/** The Combat tab in view: from 1024 px the column beside the sheet on Combat, else the bar's tab. */
async function combatShown(who) {
  if (who.width >= 1024) {
    const tab = who.page.getByRole('tablist', { name: 'Combat or chat' }).getByRole('tab', { name: /^Combat/ })
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click()
  } else await who.nav.getByRole('button', { name: /^Combat/ }).click()
  await tracker(who).waitFor({ timeout: 15_000 })
}
const tracker = who => who.page.locator('section[aria-labelledby="initiative-heading"]')
const regionOf = who => who.page.getByRole('region', { name: 'Combat' })
const panelOf = who => who.page.locator('section[aria-labelledby="turn-heading"]')
/** A combatant's row on the Combat tab, by its name, as its text reads. */
async function rowText(who, name) {
  const row = tracker(who).locator('ol > li').filter({ has: who.page.getByText(name, { exact: true }) })
  return (await row.count()) ? (await row.first().textContent()) ?? '' : null
}
/** Until a row reads as `test` says, within `ms`. */
const rowReads = (who, name, test, what, ms = 15_000) => until(async () => test(await rowText(who, name)), what, ms)
const says = words => text => (text ?? '').includes(words)
/** A row that shows neither a word nor numbers: absent, or with neither. */
const bare = text => (text === null) || (!text.includes('Health ') && !text.includes('Hit points'))
/** The campaign card's section on other creatures' health, its words. */
async function cardSays(gm) {
  const section = gm.page.getByRole('article', { name: TITLE }).locator('section')
    .filter({ has: gm.page.getByRole('heading', { name: "Other creatures' health" }) })
  await section.waitFor({ timeout: 15_000 })
  return (await section.locator('p').allTextContents()).join(' ')
}
/** Help, opened from the header's button, and its box's rows; closed after. */
async function helpRead(who) {
  await who.page.getByRole('button', { name: 'Help', exact: true }).click()
  const panel = who.page.getByRole('dialog', { name: 'Help' })
  await panel.waitFor()
  const rows = await panel.getByRole('region', { name: /^In this game, for / }).locator('dl > div')
    .evaluateAll(each => each.map(row => `${row.querySelector('dt').textContent}: ${row.querySelector('dd').textContent}`))
  const text = await panel.textContent()
  await who.page.keyboard.press('Escape')
  await panel.waitFor({ state: 'hidden' })
  return { rows, text }
}
const HELP_COMBAT = 'Where your Gamemaster allows it, each creature that isn’t one of the party shows how hurt it is: Unhurt, Hurt, Bloodied (at about half its hit points or less, by the game’s own rule) or Down (at 0).'
const healthRowOf = rows => rows.find(row => row.startsWith('Other creatures’ health: '))
/** The Combat tab, and the turn panel, at both widths in both themes. */
async function shots(name, panel = false) {
  for (const who of [phone, desk]) {
    await combatShown(who)
    await shootBoth(who, `health-combat-${name}`, () => regionOf(who))
    if (panel) await shootBoth(who, `health-panel-${name}`, () => panelOf(who))
  }
}

const desk = await open(1280, 800, PLAYER_PAGE)
const phone = await open(390, 844, PLAYER_PAGE)
const gm = await browse({ width: 1280, height: 800, path: GM_PAGE })
await combatShown(desk)
await combatShown(phone)
await rowReads(desk, 'Goblin', text => text !== null, 'the Goblin on the Combat tab')

if (OLD) {
  // ==============================================================================================
  // SKEW=049: module 0.49.0, before other creatures' health
  // ==============================================================================================
  part('S. module 0.49.0')
  {
    const features = hello().data.features
    check(!('health' in features) && JSON.parse(hello().body ?? '{}').features?.health === 1 && kept('"healthEnabled"') === 'f',
      `module 0.49.0's hello says nothing of health, with the switch saved on; the app answers health: 1 and keeps it off (${JSON.stringify(Object.keys(features))})`)
    await wait(3000)
    check(bare(await rowText(desk, 'Goblin')) && bare(await rowText(desk, 'Ogre')), 'no creature shows a word or numbers')
    await gmDetails(true)
    const from = desk.bodies.length
    await desk.page.reload()
    await combatShown(desk)
    await until(() => JSON.parse(sql(`select data::text from combat where "campaignId" = '${A}'`)).combatants.find(c => c.id === 'cbOgre')?.hp, 'the Ogre\'s hit points kept, as module 0.49.0 sends them with Gamemaster-only details', 15_000)
    await wait(3000)
    const views = viewsSince(desk, from)
    const leaks = leaksIn(desk.bodies.slice(from), false)
    check(bare(await rowText(desk, 'Ogre')) && bare(await rowText(desk, 'Bandit')) && views.length > 0 && leaks.length === 0,
      `with Gamemaster-only details on, no other creature's numbers shown, nor in the ${views.length} views Alice's page received (${JSON.stringify(leaks)})`)
    const help = await helpRead(desk)
    check(healthRowOf(help.rows) === 'Other creatures’ health: Not shown', `Help's row: ${healthRowOf(help.rows)}`)
    const said = await cardSays(gm)
    check(said === 'Your Sending Stone module doesn’t show players other creatures’ health yet. Version 0.50.0 or later does.', `the Gamemaster's campaign card: "${said}"`)
  }
  await finish()
}

// =================================================================================================
// 1. Off by default
// =================================================================================================
part('1. off by default')
{
  const features = hello().data.features
  check(same(features.health, { enabled: false, reason: 'off', hitPoints: false }) && Object.keys(features).at(-1) === 'health',
    `the hello says health is off, for a campaign saved without the switches, last among its features (${JSON.stringify({ health: features.health, keys: Object.keys(features) })})`)
  check(JSON.parse(hello().body ?? '{}').features?.health === 1 && kept('"healthEnabled"') === 'f', `the app answers health: 1, and keeps it off (${hello().body})`)
  await wait(2000)
  check(bare(await rowText(desk, 'Goblin')) && bare(await rowText(phone, 'Goblin')), "the Goblin's row has no word and no numbers")
  const said = await cardSays(gm)
  check(said === 'Off. To let them, tick Allow Players to see other creatures’ health in the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
    `the Gamemaster's campaign card: "${said}"`)
  await shots('off')
}

// =================================================================================================
// 2. On
// =================================================================================================
part('2. on')
{
  await switches({ health: true }, 'the switch on')
  check(same(hello().data.features.health, { enabled: true, reason: null, hitPoints: false }), `the hello says it's on, without hit points (${JSON.stringify(hello().data.features.health)})`)
  await until(() => kept('"healthEnabled"') === 't', 'the app to keep it on', 15_000)
  for (const name of ['Goblin', 'Ogre', 'Wolf']) await rowReads(desk, name, says('Health Unhurt'), `${name}: Unhurt`)
  const shown = await Promise.all(['Goblin', 'Ogre', 'Wolf', 'Bandit', 'Scout', 'Lurker'].map(name => rowText(desk, name)))
  check(shown.slice(0, 3).every(text => text.includes('Health Unhurt') && !text.includes('Hit points'))
    && bare(shown[3]) && bare(shown[4]) && shown[5] === null,
  `within a poll the Goblin, the Ogre and the Wolf read Unhurt; the Secret Bandit and the hidden Scout nothing; the Lurker isn't there (${JSON.stringify(shown)})`)
  await rowReads(phone, 'Wolf', says('Health Unhurt'), 'the phone too')
  await gm.page.reload()
  const said = await cardSays(gm)
  check(said === 'On in Foundry. Your players see how hurt other creatures in a fight are, but not their hit points.', `the Gamemaster's campaign card: "${said}"`)
  await shots('on')
}

// =================================================================================================
// 3. The Goblin's fall
// =================================================================================================
part("3. the Goblin's fall")
{
  const fall = DND5E6 ? [[9, 'Hurt'], [4, 'Hurt'], [2, 'Bloodied'], [0, 'Down']] : [[9, 'Hurt'], [5, 'Bloodied'], [0, 'Down']]
  const turns = postsOf('combat.turn').length
  const read = []
  let was = 'Unhurt'
  for (const [value, word] of fall) {
    const began = Date.now()
    await hitPointsTo(goblin, value)
    // In the band it was in already, past the watch's settle and a poll, it still reads the same.
    if (word === was) await wait(3000)
    await rowReads(desk, 'Goblin', says(`Health ${word}`), `the Goblin at ${value}: ${word}`, 5_000)
    read.push(`${value} ${word} ${word === was ? 'still, 3 s on' : `in ${((Date.now() - began) / 1000).toFixed(1)} s`}`)
    was = word
  }
  check(postsOf('combat.turn').length === turns,
    `the Goblin at ${fall.map(([value, word]) => `${value} reads ${word}`).join(', ')}, each within 5 s, with no reload and no turn${DND5E6 ? ', its own Bloodied at 25 percent' : ''} (${read.join('; ')})`)
  const cb = fight.combatants.get('cbGoblin')
  cb.isDefeated = true
  await Hooks.callAll('updateCombatant', cb, { defeated: true }, {}, 'gm')
  await rowReads(desk, 'Goblin', says('Defeated'), 'the Goblin defeated')
  const text = await rowText(desk, 'Goblin')
  check(text.includes('Defeated') && bare(text), `marked defeated, it reads Defeated and no word ("${text}")`)
}

// =================================================================================================
// 4. Posts counted
// =================================================================================================
part('4. posts counted')
{
  const before = updatesOf('cbOgre').length
  await hitPointsTo(ogre, 58)
  await until(() => updatesOf('cbOgre').length > before, "the Ogre's update", 5_000)
  await wait(1250)
  const posted = updatesOf('cbOgre').slice(before)
  check(posted.length === 1 && posted[0].data.combatant.health === 'hurt' && same(posted[0].data.changes, ['health']) && !('hp' in posted[0].data.combatant),
    `the Ogre at 58 of 59 posts one combat.combatant.updated, changes ["health"], Hurt, no hit points (${JSON.stringify(posted.map(p => p.data))})`)
  await rowReads(desk, 'Ogre', says('Health Hurt'), 'the Ogre: Hurt')
  const again = updatesOf('cbOgre').length
  await hitPointsTo(ogre, 57)
  await wait(250 + 1000)
  check(updatesOf('cbOgre').length === again, `at 57, in the same band, none within 1 s of the settle (${updatesOf('cbOgre').length - again} posted)`)
}

// =================================================================================================
// 5. Hit points too
// =================================================================================================
part('5. hit points too')
{
  await switches({ health: true, healthHitPoints: true }, 'hit points too')
  check(same(hello().data.features.health, { enabled: true, reason: null, hitPoints: true }), `the hello says hit points too (${JSON.stringify(hello().data.features.health)})`)
  await rowReads(desk, 'Ogre', says('Hit points 57 / 59'), 'the Ogre: 57 / 59')
  const text = await rowText(desk, 'Ogre')
  check(text.includes('Hit points 57 / 59') && !text.includes('Health '), `the Ogre's row reads its hit points instead of its word ("${text}")`)
  check(bare(await rowText(desk, 'Bandit')) && bare(await rowText(desk, 'Scout')), 'the Bandit and the Scout still show nothing')
  await gm.page.reload()
  const said = await cardSays(gm)
  check(said === 'On in Foundry. Your players see how hurt other creatures in a fight are, and their hit points.', `the Gamemaster's campaign card: "${said}"`)
  await shots('hit-points')
}

// =================================================================================================
// 6. Gamemaster-only details, hit points off; 6b, both on
// =================================================================================================
part('6. GM-only details, hit points off')
{
  await switches({ health: true }, 'hit points off')
  await gmDetails(true)
  await until(() => JSON.parse(sql(`select data::text from combat where "campaignId" = '${A}'`)).combatants.find(c => c.id === 'cbBandit')?.hp,
    "every creature's hit points kept, as the module sends them with Gamemaster-only details", 15_000)
  const from = desk.bodies.length
  await desk.page.reload()
  await combatShown(desk)
  await rowReads(desk, 'Ogre', says('Health Hurt'), 'the Ogre: Hurt, after the reload')
  await wait(3000)
  const shown = await Promise.all(['Ogre', 'Bandit', 'Scout'].map(name => rowText(desk, name)))
  const views = viewsSince(desk, from)
  const leaks = leaksIn(desk.bodies.slice(from), false)
  check(shown[0].includes('Health Hurt') && !shown[0].includes('Hit points') && bare(shown[1]) && bare(shown[2]),
    `with Gamemaster-only details on and hit points off, the Ogre shows its word and no numbers, the Bandit and the Scout nothing (${JSON.stringify(shown)})`)
  check(views.length > 0 && leaks.length === 0,
    `and the ${views.length} views Alice's page received hold no other creature's hit points, nothing of the Bandit's or the Scout's health, and no Lurker (${JSON.stringify(leaks)})`)
}
part('6b. GM-only details, both on')
{
  await switches({ health: true, healthHitPoints: true }, 'hit points on again')
  const from = desk.bodies.length
  await desk.page.reload()
  await combatShown(desk)
  await rowReads(desk, 'Ogre', says('Hit points 57 / 59'), 'the Ogre: 57 / 59, after the reload')
  await wait(3000)
  const shown = await Promise.all(['Ogre', 'Bandit', 'Scout'].map(name => rowText(desk, name)))
  const views = viewsSince(desk, from)
  const leaks = leaksIn(desk.bodies.slice(from), true)
  check(shown[0].includes('Hit points 57 / 59') && bare(shown[1]) && bare(shown[2]),
    `with both on, the Ogre shows its numbers; the Bandit and the Scout neither a word nor numbers (${JSON.stringify(shown)})`)
  check(views.length > 0 && leaks.length === 0,
    `and the ${views.length} views Alice's page received hold neither the Bandit's nor the Scout's health or hit points, though the app keeps them, and no Lurker (${JSON.stringify(leaks)})`)
  await gmDetails(false)
  await switches({ health: true }, 'hit points off again')
}

// =================================================================================================
// 7. The panel
// =================================================================================================
part('7. the panel')
{
  await turnTo('cbOgre')
  await until(async () => ((await panelOf(desk).textContent()) ?? '').includes('Ogre is acting'), "the Ogre's turn in the panel", 15_000)
  await until(async () => ((await panelOf(desk).textContent()) ?? '').includes('Health Hurt'), "the Ogre's word in the panel", 15_000)
  const text = await panelOf(desk).textContent()
  check(text.includes('Ogre is acting') && text.includes('Health Hurt') && !text.includes('Hit points'), `on the Ogre's turn the panel reads "Ogre is acting" and its word ("${text}")`)
  await shots('turn-health', true)
  await switches({ health: true, healthHitPoints: true }, 'hit points for the panel')
  await until(async () => ((await panelOf(desk).textContent()) ?? '').includes('Hit points 57 / 59'), "the Ogre's numbers in the panel", 15_000)
  await shots('turn-hit-points', true)
  check(await sideways(phone.page) === 0 && await sideways(desk.page) === 0, 'nothing scrolls sideways at 390 or 1280')
  await switches({ health: true }, 'hit points off for the Gamemaster')
  await until(async () => ((await panelOf(desk).textContent()) ?? '').includes('Health Hurt'), "the Ogre's word back in the panel", 15_000)
}

// =================================================================================================
// 8. The Gamemaster at Thorin's page
// =================================================================================================
part("8. the Gamemaster at Thorin's page")
{
  const seat = await open(1280, 800, GM_SEAT)
  await combatShown(seat)
  await rowReads(seat, 'Ogre', says('Health Hurt'), "the Gamemaster's Ogre: Hurt")
  const shown = await Promise.all(['Ogre', 'Wolf', 'Bandit', 'Scout', 'Lurker'].map(name => rowText(seat, name)))
  const panel = await panelOf(seat).textContent()
  const leaks = leaksIn(seat.bodies, false)
  check(shown[0].includes('Health Hurt') && shown[1].includes('Health Unhurt') && bare(shown[2]) && bare(shown[3]) && shown[4] === null
    && panel.includes('Ogre is acting') && panel.includes('Health Hurt'),
  `the Gamemaster at Thorin's page sees the same rows and panel (${JSON.stringify(shown)})`)
  check(viewsSince(seat, 0).length > 0 && leaks.length === 0, `and their page's own requests received nothing more (${JSON.stringify(leaks)})`)
  await seat.view.close()
}

// =================================================================================================
// 9. Thorin's own hit points between turns (Q3 A)
// =================================================================================================
part("9. Thorin's own row")
{
  const turns = postsOf('combat.turn').length
  await thorin.update({ 'system.attributes.hp.value': 12 })
  await rowReads(desk, 'Thorin', says('12 / 30'), "Thorin's row: 12 / 30", 5_000)
  check(postsOf('combat.turn').length === turns && (await rowText(desk, 'Thorin')).includes('12 / 30'), "Thorin at 12 of 30 reads 12 / 30 within 5 s, with no turn")
}

// =================================================================================================
// 10. Help
// =================================================================================================
part('10. Help')
{
  const words = await helpRead(desk)
  check(words.text.includes(HELP_COMBAT) && healthRowOf(words.rows) === 'Other creatures’ health: How hurt they are',
    `Help's Combat part, and its box's row: ${healthRowOf(words.rows)}`)
  await switches({ health: true, healthHitPoints: true }, 'hit points for Help')
  let row = null
  await until(async () => {
    row = healthRowOf((await helpRead(desk)).rows)
    return row === 'Other creatures’ health: Their hit points'
  }, "Help's row: Their hit points", 15_000).catch(() => {})
  check(row === 'Other creatures’ health: Their hit points', `with hit points too, Help's row: ${row}`)
}
note(`${postsOf('combat.combatant.updated').filter(p => p.campaign === 'erebor').length} combatant updates posted`)
await finish()
