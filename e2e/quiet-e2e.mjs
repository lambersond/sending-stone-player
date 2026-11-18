// Quieter fetching while Foundry is open and nobody is in the app (module 0.50.0 and the app, ROADMAP
// item 61), end to end, in the world of world-030.mjs: the real module fetching from the production
// app, which answers a fetch that hands over nothing while nobody is in the app with `quiet`, 20
// seconds, and a quiet look after the campaign's lookup alone, unless a dish waits. Erebor, rolls and
// dishes on (the module's test/fvtt/dish-core.mjs), on dnd5e 5.3.3; Bob plays Vex. 1. Foundry open,
// nobody in the app: full fetches every 10 seconds for two minutes after the hello, then looks every
// 20 seconds, each answered with nothing and `quiet`, the game counted as fetching throughout. 2. Bob
// arrives and rolls at once: never refused, the game live and no "isn't connected" in Help, his roll
// made within 28 seconds, and, the module's fetches held, his next at once. 3. Everyone leaves; a dish
// posted by the Magical Recipe Book's server is found by the next look and handed over, its card in
// Foundry within 25 seconds. 4. Notes written while Foundry is closed, nobody there as it reconnects:
// the new page's first fetch is full and hands the note over within 5 seconds. SKEW=049 with
// MODULE=module-0.49.0: parts 1 and 2 only, the fetches as before, every 10 seconds, saying nothing of
// quiet and told nothing of it. Its bounds are its own timings: it runs alone after the lanes (`solo`).
// Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs, with TIMEOUT=600. No screenshots.
// The cookbook's server first: it keeps Node's own fetch, which the Foundry stand-ins replace.
import { dishBody, linkCode, postDish } from './cookbook-post.mjs'
import {
  BOB, W, browse, call, character, check, finish, foundryWorld, journal, lastHello, launch, newCampaign, note, pagesOf,
  part, posted, postsOf, reloadFoundry, settled, sql, startFetching, startModule, stopFetching, until, wait,
} from './world-030.mjs'

const SKEW049 = process.env.SKEW === '049'
const GAME = 'https://quiet-erebor.forge-vtt.com'
const SECRET = 'erebor-quiet-61'
const TITLE = 'Erebor'
/** The app's waits, from module 0.50.0 (COMMANDS_COLD_WAIT, COMMANDS_QUIET_WAIT). */
const COLD = 10_000
const QUIET = 20_000
/** How long after the hello a module from 0.50.0 keeps its usual pace (QUIET_AFTER). */
const QUIET_AFTER = 120_000
const NOT_CONNECTED = 'Your Gamemaster’s game isn’t connected right now, so nothing is made there.'

// When each post was answered, as the suite reads it: the world keeps no time of its own.
{
  const push = posted.push.bind(posted)
  posted.push = (...entries) => push(...entries.map(entry => Object.assign(entry, { at: Date.now() })))
}

await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'quiet-erebor.forge-vtt.com', secret: SECRET })
await foundryWorld()
// A checkout's module.json says 0.1.0: the version the release stamps.
game.modules.get('sending-stone').version = SKEW049 ? '0.49.0' : '0.50.0'
const D = await import('./fvtt/dish-core.mjs')
D.installDishCore()

// ---- The world: Thorin, and Vex, Bob's ----
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, con: 2 }, hp: { value: 30, max: 40, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3, wis: 2 }, skills: { prc: { ability: 'wis' } }, hp: { value: 20, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
D.withDishes(thorin, { hp: { value: 30, max: 40 } })
D.withDishes(vex, { hp: { value: 20, max: 30 } })
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const EREBOR = { id: 'erebor', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true, dishes: true }
await startModule({ campaigns: [EREBOR], secrets: { erebor: SECRET } })
await settled()
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-vex', 'Vex', '${GAME}', '${TITLE}', '${A}', 'vex', 'e2e-bob', now())`)
const API = '/api/characters/sheet-vex'

// ---- What the module fetched, and what the app answered ----
/** Every fetch for commands answered, from `since` (ms) on, oldest first, its answer read. */
const fetches = (since = 0) => postsOf('fetch')
  .filter(p => p.url.endsWith('/api/bridge/commands') && (p.status === 200) && (p.at >= since))
  .map(p => ({ ...p, answer: JSON.parse(p.body) }))
const heartbeats = (from, to) => postsOf('bridge.heartbeat').filter(p => (p.at >= from) && (p.at < to)).length
/** When the latest hello was answered. */
const helloAt = () => lastHello('erebor').at
const resultOf = id => postsOf('command.result').find(p => p.data?.id === id)
const ageOfPoll = () => Number(sql(`select extract(epoch from (now() at time zone 'UTC') - "bridgePolledAt") from campaign where id = '${A}'`))
const roll = who => call(who.page, `${API}/rolls`, {
  method: 'POST',
  body: { kind: 'skill', key: 'prc', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [12] }] },
})
const statusOf = id => sql(`select status from roll_request where id = '${id}'`)
const fromQuietLook = f => same(f.answer, { commands: [], wait: COLD, quiet: QUIET, open: [] })
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b) }

part('1. Foundry open, nobody in the app')
await until(() => fetches().length >= 1, 'the first fetch')
if (SKEW049) {
  // Three minutes with nobody in the app: the fetches as before, every 10 seconds.
  const from = Date.now()
  await wait(180_000)
  const list = fetches(from).filter(f => f.at < from + 180_000)
  check(list.every(f => f.look === undefined), `module 0.49.0's fetches say nothing of quiet (${list.length} fetches)`)
  check(list.every(f => !('quiet' in f.answer) && (f.answer.wait === COLD)), 'and every answer is as before: wait 10000, no quiet')
  check((list.length >= 15) && (list.length <= 19), `about 6 fetches a minute for three minutes with nobody in the app: ${list.length}`)
} else {
  // The usual pace for two minutes after the hello, each fetch saying it's a full one.
  await until(() => Date.now() >= helloAt() + 115_000, 'nearly two minutes after the hello', 130_000)
  const usual = fetches(helloAt()).filter(f => f.at < helloAt() + 115_000)
  const gaps = usual.slice(1).map((f, i) => f.at - usual[i].at)
  check(usual.length >= 9 && usual.every(f => f.look === false),
    `for the first 115 s after the hello every fetch says it's full, quiet false (${usual.length}: ${usual.map(f => f.look)})`)
  check(gaps.every(gap => (gap >= 9_000) && (gap <= 13_000)), `about 10 s apart (${gaps.map(g => (g / 1000).toFixed(1))})`)
  // Then looks, each answered with nothing and the quiet wait, about 20 seconds apart.
  await until(() => fetches(helloAt()).some(f => f.look === true), 'the first quiet look', 60_000)
  const firstLook = fetches(helloAt()).find(f => f.look === true)
  check(firstLook.at - helloAt() <= QUIET_AFTER + 35_000, `the first look within 35 s of two minutes after the hello (${((firstLook.at - helloAt()) / 1000).toFixed(1)} s)`)
  // Two quiet minutes, the game's last fetch as the app counts it read every second.
  const from = firstLook.at
  let oldest = 0
  while (Date.now() < from + 120_000) {
    oldest = Math.max(oldest, ageOfPoll())
    await wait(1_000)
  }
  const quietly = fetches(from).filter(f => f.at < from + 120_000)
  const looks = quietly.filter(f => f.look === true)
  const lookGaps = looks.slice(1).map((f, i) => f.at - looks[i].at)
  check(looks.length >= 4 && looks.every(fromQuietLook), `each look answered { commands: [], wait: 10000, quiet: 20000, open: [] } (${looks.length})`)
  check(lookGaps.every(gap => (gap >= 19_000) && (gap <= 23_000)), `about 20 s apart (${lookGaps.map(g => (g / 1000).toFixed(1))})`)
  check(quietly.length <= 7, `two quiet minutes: ${quietly.length} fetches, at most 7 (today 12)`)
  const beats = heartbeats(from, from + 120_000)
  check((beats >= 2) && (beats <= 6), `and the heartbeats as before, about 4 (${beats})`)
  check(oldest <= 30, `the game counted as fetching throughout: its last fetch at most ${oldest.toFixed(1)} s old, never more than 30`)
}

part('2. Someone arrives')
const bob = await browse({ width: 1280, height: 800, who: BOB, path: '/characters/sheet-vex', toasts: false })
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const shown = Date.now()
const first = await roll(bob)
check(first.status === 202, `his roll, sent the moment his table shows, is taken: ${first.status}${first.json?.reason ? ` ${first.json.reason}` : ''}, never 409 unavailable`)
await until(() => resultOf(first.json.id), 'the roll made in the game', 40_000)
const firstWait = resultOf(first.json.id).at - shown
check(firstWait <= (SKEW049 ? 15_000 : 28_000) && statusOf(first.json.id) === 'done',
  `and made in the game within ${SKEW049 ? 15 : 28} s: ${(firstWait / 1000).toFixed(1)} s, never expired (${statusOf(first.json.id)})`)
const handing = fetches(shown).find(f => f.answer.commands.some(c => c.id === first.json.id))
check(handing && !('quiet' in handing.answer), 'the fetch that hands it over says nothing of quiet')
// The header's status, as gm-e2e reads it, from the table's next poll at the latest.
const live = bob.page.getByRole('status').filter({ hasText: 'Live' })
await live.waitFor({ timeout: 10_000 }).catch(() => {})
check(await live.isVisible(), 'his header reads Live')
await bob.page.getByRole('button', { name: 'Help', exact: true }).click()
const help = bob.page.getByRole('dialog', { name: 'Help' })
await help.getByRole('region', { name: /^In this game, for / }).waitFor({ timeout: 10_000 })
check((await help.getByText(NOT_CONNECTED, { exact: true }).count()) === 0, `Help's box says nothing of the game being away ("${NOT_CONNECTED}")`)
await bob.page.keyboard.press('Escape')
await help.waitFor({ state: 'hidden' })
// His next roll once the module's fetches are held. The fetch that took his first may have been
// answered at once, before his page's first poll noted him there (module 0.49.0's, every 10
// seconds), its `wait` then waited before the next fetch. A held fetch's answer says no `wait`, and
// the module fetches again at once, held while he's there.
const heldFrom = Date.now()
await until(() => !('wait' in fetches().at(-1).answer), 'a held answer, saying no wait', 40_000)
note(`a held answer ${((Date.now() - heldFrom) / 1000).toFixed(1)} s after Help closed; his first roll's fetch said ${'wait' in handing.answer ? `wait ${handing.answer.wait}` : 'no wait'}`)
const secondSent = Date.now()
const second = await roll(bob)
await until(() => resultOf(second.json.id), 'the second roll made in the game', 30_000)
const secondWait = resultOf(second.json.id).at - secondSent
check(second.status === 202 && secondWait <= 5_000, `his next roll is made at once, within 5 s (${(secondWait / 1000).toFixed(1)} s)`)
const whileThere = fetches(resultOf(first.json.id).at).filter(f => f.at <= resultOf(second.json.id).at)
check(whileThere.every(f => !('quiet' in f.answer)) && (whileThere.every(f => f.look !== true)),
  `while he's there no answer says quiet and no fetch is a look (${whileThere.length})`)
if (SKEW049) {
  check(fetches().every(f => (f.look === undefined) && !('quiet' in f.answer)), 'module 0.49.0: no fetch said quiet, no answer had it, from start to end')
  await finish()
}

part('3. Everyone leaves; a dish comes')
const left = Date.now()
await bob.view.close()
// A poll already on its way when the page closed notes him present as it lands: then he leaves.
await wait(2_000)
sql(`update campaign set "playersSeenAt" = now() - interval '3 minutes' where id = '${A}'`)
await until(() => fetches(left).some(f => f.answer.quiet === QUIET), 'an answer saying quiet', 40_000)
const quietAgain = fetches(left).find(f => f.answer.quiet === QUIET)
check(quietAgain.at - left <= 35_000, `within 35 s of his leaving an answer says quiet (${((quietAgain.at - left) / 1000).toFixed(1)} s)`)
await until(() => fetches(quietAgain.at + 1).some(f => f.look === true), 'looks again', 30_000)
check(true, 'and looks follow')
const code = await linkCode('sheet-vex', A, 'vex')
const dish = dishBody({ recipe: 'Plain Porridge' })
const postedAt = Date.now()
const taken = await postDish(code, dish)
check(taken.status >= 200 && taken.status < 300, `the Magical Recipe Book's server posts a dish for Vex with no page open: ${taken.status}`)
const row = sql(`select id from cookbook_dish where "dishId" = '${dish.dish.id}'`)
const card = () => [...W.messages.values()].find(m => m.flags?.['sending-stone']?.dish?.command === `dish-${row}`)
await until(() => card(), "the dish's card in Foundry", 40_000)
const cardAt = Date.now()
check(cardAt - postedAt <= 25_000, `its card is in Foundry within 25 s of the post (${((cardAt - postedAt) / 1000).toFixed(1)} s)`)
const found = fetches(postedAt).find(f => f.answer.commands.some(c => c.id === `dish-${row}`))
check(found && (found.look === true) && !('quiet' in found.answer), 'the look that found it is answered in full: the dish handed over, no quiet')
await until(() => fetches(found.at + 1).some(f => f.look === true && fromQuietLook(f)), 'looks after the dish', 60_000)
check(true, 'and looks resume after it')

part('4. Notes written while Foundry was closed, nobody there as it connects')
await stopFetching({ age: A })
const writer = await browse({ width: 1280, height: 800, who: BOB, path: '/characters/sheet-vex', toasts: false })
await writer.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const written = await call(writer.page, `${API}/notes`, { method: 'POST', body: { role: 'entry', title: 'Quiet road', body: 'Nobody on the road tonight.', chapterId: null } })
check(written.status >= 200 && written.status < 300, `Bob writes a note in Vex's journal while Foundry is closed: ${written.status}`)
await writer.view.close()
await wait(2_000)
sql(`update campaign set "playersSeenAt" = now() - interval '3 minutes' where id = '${A}'`)
await reloadFoundry()
const session = lastHello('erebor').session
const released = Date.now()
startFetching()
const inJournal = () => {
  const entry = journal('personal', 'vex', 'erebor')
  return Boolean(entry && pagesOf(entry).some(page => page.name === 'Quiet road'))
}
await until(inJournal, "the note in Foundry's journal", 30_000)
const noteWait = Date.now() - released
check(noteWait <= 5_000, `the note is in Foundry's journal within 5 s of Foundry connecting, nobody in the app (${(noteWait / 1000).toFixed(1)} s)`)
const ofSession = () => fetches().filter(f => f.session === session)
await until(() => ofSession().length >= 3, "the new page's first three fetches", 40_000)
const firstThree = ofSession().slice(0, 3)
check(firstThree[0].answer.commands.some(c => c.kind === 'note'), "the new page's first fetch hands the note over")
check(firstThree.every(f => f.look === false), `the first three fetches after the hello are full, quiet false (${firstThree.map(f => f.look)})`)

await settled()
await finish()
